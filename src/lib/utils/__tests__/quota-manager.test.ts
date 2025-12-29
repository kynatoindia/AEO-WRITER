import { QuotaManager, checkContentGenerationQuota, trackTokenUsage } from '../quota-manager';
import { PLAN_QUOTAS } from '@/lib/rate-limiting/quota-constants';

// Mock the dependencies
jest.mock('@/lib/rate-limiting/quota', () => ({
  getUserCredits: jest.fn(),
  checkUserQuota: jest.fn(),
  updateUserCredits: jest.fn(),
  incrementUsage: jest.fn(),
  getUserUsage: jest.fn(),
  checkRateLimit: jest.fn(),
  isUserSuspended: jest.fn(),
}));

jest.mock('@/lib/redis/client', () => ({
  redis: {
    del: jest.fn(),
    keys: jest.fn(),
  },
  CACHE_KEYS: {
    USER_QUOTA: (userId: string) => `user:${userId}:quota`,
    USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createRouteClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null })),
      })),
    })),
  })),
}));

const mockQuotaFunctions = require('@/lib/rate-limiting/quota');
const mockRedis = require('@/lib/redis/client');

describe('QuotaManager', () => {
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkQuota', () => {
    it('should return allowed when quota check passes', async () => {
      mockQuotaFunctions.checkUserQuota.mockResolvedValue({
        allowed: true,
        usage: 5,
        limit: 10,
        remaining: 5,
        resetDate: new Date('2024-02-01'),
        plan: 'free',
      });

      const result = await QuotaManager.checkQuota(testUserId, 'contentGeneration', 1);

      expect(result).toEqual({
        allowed: true,
        usage: 5,
        limit: 10,
        remaining: 5,
        resetDate: new Date('2024-02-01'),
        plan: 'free',
        message: undefined,
      });
    });

    it('should return not allowed with message when quota exceeded', async () => {
      mockQuotaFunctions.checkUserQuota.mockResolvedValue({
        allowed: false,
        usage: 10,
        limit: 10,
        remaining: 0,
        resetDate: new Date('2024-02-01'),
        plan: 'free',
      });

      const result = await QuotaManager.checkQuota(testUserId, 'contentGeneration', 1);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Content generation limit exceeded');
      expect(result.message).toContain('free plan');
    });

    it('should handle errors gracefully', async () => {
      mockQuotaFunctions.checkUserQuota.mockRejectedValue(new Error('Database error'));

      const result = await QuotaManager.checkQuota(testUserId, 'contentGeneration', 1);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('Unable to check quota limits');
    });
  });

  describe('trackUsage', () => {
    it('should track token usage correctly', async () => {
      mockQuotaFunctions.incrementUsage.mockResolvedValue(undefined);
      mockQuotaFunctions.updateUserCredits.mockResolvedValue(undefined);
      mockRedis.redis.del.mockResolvedValue(undefined);

      await QuotaManager.trackUsage({
        userId: testUserId,
        quotaType: 'tokensPerMonth',
        amount: 1000,
        metadata: {
          tokens: 1000,
          cost: 0.02,
          model: 'gpt-4o-mini',
          projectId: 'project-123',
          operation: 'content_generation',
        },
      });

      expect(mockQuotaFunctions.incrementUsage).toHaveBeenCalledWith(
        testUserId,
        'tokensPerMonth',
        1000
      );
      expect(mockQuotaFunctions.updateUserCredits).toHaveBeenCalledWith(
        testUserId,
        1000
      );
      expect(mockRedis.redis.del).toHaveBeenCalledWith(`user:${testUserId}:quota`);
    });

    it('should track project creation correctly', async () => {
      mockQuotaFunctions.incrementUsage.mockResolvedValue(undefined);
      mockQuotaFunctions.updateUserCredits.mockResolvedValue(undefined);
      mockRedis.redis.del.mockResolvedValue(undefined);

      await QuotaManager.trackUsage({
        userId: testUserId,
        quotaType: 'projects',
        amount: 1,
        metadata: {
          projectId: 'project-123',
          operation: 'project_creation',
        },
      });

      expect(mockQuotaFunctions.incrementUsage).toHaveBeenCalledWith(
        testUserId,
        'projects',
        1
      );
      expect(mockQuotaFunctions.updateUserCredits).toHaveBeenCalledWith(
        testUserId,
        0,
        1
      );
    });

    it('should handle tracking errors gracefully', async () => {
      mockQuotaFunctions.incrementUsage.mockRejectedValue(new Error('Redis error'));

      // Should not throw error
      await expect(QuotaManager.trackUsage({
        userId: testUserId,
        quotaType: 'contentGeneration',
        amount: 1,
      })).resolves.toBeUndefined();
    });
  });

  describe('checkRateLimit', () => {
    it('should return suspended status for suspended users', async () => {
      mockQuotaFunctions.isUserSuspended.mockResolvedValue(true);

      const result = await QuotaManager.checkRateLimit(testUserId, 'test-endpoint');

      expect(result.allowed).toBe(false);
      expect(result.isAbusive).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should return rate limit result for normal users', async () => {
      mockQuotaFunctions.isUserSuspended.mockResolvedValue(false);
      mockQuotaFunctions.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: Math.floor(Date.now() / 1000) + 60,
      });

      const result = await QuotaManager.checkRateLimit(testUserId, 'test-endpoint');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should handle rate limit errors gracefully', async () => {
      mockQuotaFunctions.isUserSuspended.mockRejectedValue(new Error('Redis error'));

      const result = await QuotaManager.checkRateLimit(testUserId, 'test-endpoint');

      expect(result.allowed).toBe(true); // Should allow on error
    });
  });

  describe('getUserUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockCredits = {
        userId: testUserId,
        plan: 'free' as const,
        tokensUsed: 5000,
        tokensLimit: 10000,
        costUsedUsd: 2.5,
        costLimitUsd: 5.0,
        projectsUsed: 2,
        projectsLimit: 3,
        resetDate: new Date('2024-02-01'),
      };

      mockQuotaFunctions.getUserCredits.mockResolvedValue(mockCredits);
      mockQuotaFunctions.getUserUsage
        .mockResolvedValueOnce(8) // contentGeneration
        .mockResolvedValueOnce(50) // apiCalls
        .mockResolvedValueOnce(2) // projects
        .mockResolvedValueOnce(5000) // tokensPerMonth
        .mockResolvedValueOnce(2.5); // costLimitUsd

      const result = await QuotaManager.getUserUsageStats(testUserId);

      expect(result.plan).toBe('free');
      expect(result.limits).toEqual(PLAN_QUOTAS.free);
      expect(result.daily.contentGeneration).toBe(8);
      expect(result.monthly.tokensPerMonth).toBe(5000);
    });

    it('should handle errors and return default values', async () => {
      mockQuotaFunctions.getUserCredits.mockRejectedValue(new Error('Database error'));

      const result = await QuotaManager.getUserUsageStats(testUserId);

      expect(result.plan).toBe('free');
      expect(result.limits).toEqual(PLAN_QUOTAS.free);
      expect(result.daily.contentGeneration).toBe(0);
    });
  });

  describe('resetUserQuotas', () => {
    it('should reset user quotas successfully', async () => {
      mockRedis.redis.keys.mockResolvedValue(['user:test-user-123:quota', 'user:test-user-123:usage']);
      mockRedis.redis.del.mockResolvedValue(2);

      await QuotaManager.resetUserQuotas(testUserId);

      expect(mockRedis.redis.keys).toHaveBeenCalledWith('user:test-user-123:*');
      expect(mockRedis.redis.del).toHaveBeenCalledWith(
        'user:test-user-123:quota',
        'user:test-user-123:usage'
      );
    });

    it('should handle reset errors', async () => {
      mockRedis.redis.keys.mockRejectedValue(new Error('Redis error'));

      await expect(QuotaManager.resetUserQuotas(testUserId))
        .rejects.toThrow('Failed to reset user quotas');
    });
  });

  describe('upgradeUserPlan', () => {
    it('should upgrade user plan successfully', async () => {
      await QuotaManager.upgradeUserPlan(testUserId, 'pro');

      expect(mockRedis.redis.del).toHaveBeenCalledWith(`user:${testUserId}:quota`);
      expect(mockRedis.redis.del).toHaveBeenCalledWith(`user:${testUserId}:profile:plan`);
    });
  });
});

describe('Convenience functions', () => {
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call QuotaManager.checkQuota for content generation', async () => {
    const spy = jest.spyOn(QuotaManager, 'checkQuota').mockResolvedValue({
      allowed: true,
      usage: 0,
      limit: 10,
      remaining: 10,
      resetDate: new Date(),
      plan: 'free',
    });

    await checkContentGenerationQuota(testUserId);

    expect(spy).toHaveBeenCalledWith(testUserId, 'contentGeneration');
  });

  it('should call QuotaManager.trackUsage for token usage', async () => {
    const spy = jest.spyOn(QuotaManager, 'trackUsage').mockResolvedValue(undefined);

    await trackTokenUsage(testUserId, 1000, 0.02, 'gpt-4o-mini', 'project-123');

    expect(spy).toHaveBeenCalledWith({
      userId: testUserId,
      quotaType: 'tokensPerMonth',
      amount: 1000,
      metadata: {
        tokens: 1000,
        cost: 0.02,
        model: 'gpt-4o-mini',
        projectId: 'project-123',
        operation: 'ai_generation',
      },
    });
  });
});