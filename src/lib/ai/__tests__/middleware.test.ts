import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock Redis client
jest.mock('@/lib/redis/client', () => ({
  redis: {
    incr: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    hgetall: jest.fn(),
    lrange: jest.fn(),
  },
  CACHE_KEYS: {
    RATE_LIMIT: (userId: string) => `rate_limit:${userId}`,
  },
}));

// Mock AI gateway
jest.mock('../gateway', () => ({
  getUserAIUsage: jest.fn(),
}));

import { 
  checkUserQuota, 
  estimateOperationCost,
  getUsageAnalytics
} from '../middleware';

describe('AI Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Quota Checking', () => {
    it('should allow requests within quota', async () => {
      const { getUserAIUsage } = require('../gateway');
      
      getUserAIUsage.mockResolvedValue({
        totalCost: 5.0,
        totalTokensUsed: 50000,
      });

      const result = await checkUserQuota('user123', 1.0, 10000);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage.cost).toBe(5.0);
    });

    it('should block requests exceeding estimated cost', async () => {
      const { getUserAIUsage } = require('../gateway');
      
      getUserAIUsage.mockResolvedValue({
        totalCost: 9.5,
        totalTokensUsed: 50000,
      });

      const result = await checkUserQuota('user123', 1.0, 10000); // Would exceed 10.0 limit

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Estimated cost would exceed monthly limit');
    });

    it('should block requests exceeding estimated tokens', async () => {
      const { getUserAIUsage } = require('../gateway');
      
      getUserAIUsage.mockResolvedValue({
        totalCost: 5.0,
        totalTokensUsed: 950000,
      });

      const result = await checkUserQuota('user123', 1.0, 100000); // Would exceed 1M limit

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Estimated tokens would exceed monthly limit');
    });
  });

  describe('Operation Cost Estimation', () => {
    it('should estimate research operation cost', () => {
      const estimation = estimateOperationCost('research', 1000);

      expect(estimation.estimatedTokens).toBeGreaterThan(0);
      expect(estimation.estimatedCost).toBeGreaterThan(0);
      expect(estimation.recommendedModel).toBe('gpt-4o');
    });

    it('should estimate content operation cost', () => {
      const estimation = estimateOperationCost('content', 1000);

      expect(estimation.recommendedModel).toBe('gpt-4o-mini');
      expect(estimation.estimatedCost).toBeLessThan(
        estimateOperationCost('research', 1000).estimatedCost
      );
    });

    it('should scale with input length', () => {
      const small = estimateOperationCost('content', 100);
      const large = estimateOperationCost('content', 1000);

      expect(large.estimatedTokens).toBeGreaterThan(small.estimatedTokens);
      expect(large.estimatedCost).toBeGreaterThan(small.estimatedCost);
    });
  });

  describe('Usage Analytics', () => {
    it('should get usage analytics', async () => {
      const { redis } = require('@/lib/redis/client');
      
      redis.keys.mockResolvedValue(['ai:cost:user1:monthly', 'ai:cost:user2:monthly']);
      redis.hgetall.mockResolvedValue({
        'gpt-4o': '5.0',
        'gpt-4o_tokens': '100000',
        'gpt-4o-mini': '2.0',
        'gpt-4o-mini_tokens': '200000',
      });
      redis.lrange.mockResolvedValue([
        JSON.stringify({
          operation: 'content',
          cost: 0.1,
          timestamp: Date.now(),
        }),
      ]);

      const analytics = await getUsageAnalytics('week');

      expect(analytics).toHaveProperty('totalUsers');
      expect(analytics).toHaveProperty('totalCost');
      expect(analytics).toHaveProperty('modelDistribution');
      expect(analytics).toHaveProperty('operationDistribution');
      expect(analytics.totalUsers).toBeGreaterThan(0);
    });

    it('should handle different timeframes', async () => {
      const { redis } = require('@/lib/redis/client');
      
      redis.keys.mockResolvedValue([]);
      redis.hgetall.mockResolvedValue({});
      redis.lrange.mockResolvedValue([]);

      const dayAnalytics = await getUsageAnalytics('day');
      const weekAnalytics = await getUsageAnalytics('week');
      const monthAnalytics = await getUsageAnalytics('month');

      expect(dayAnalytics).toHaveProperty('totalUsers');
      expect(weekAnalytics).toHaveProperty('totalUsers');
      expect(monthAnalytics).toHaveProperty('totalUsers');
    });

    it('should handle analytics errors gracefully', async () => {
      const { redis } = require('@/lib/redis/client');
      
      redis.keys.mockRejectedValue(new Error('Redis error'));

      const analytics = await getUsageAnalytics();

      expect(analytics.totalUsers).toBe(0);
      expect(analytics.totalCost).toBe(0);
    });
  });
});