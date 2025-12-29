import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the AI SDK modules before importing
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn((model: string) => ({ model, provider: 'openai' })),
}));

jest.mock('@ai-sdk/google', () => ({
  google: jest.fn((model: string) => ({ model, provider: 'google' })),
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  generateObject: jest.fn(),
  streamObject: jest.fn(),
}));

// Mock Redis client
jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    lpush: jest.fn(),
    lrange: jest.fn(),
    hgetall: jest.fn(),
    hincrbyfloat: jest.fn(),
    hincrby: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    ping: jest.fn(),
  },
  CACHE_KEYS: {
    CONTENT_CACHE: (hash: string) => `content:${hash}`,
    AI_PROVIDER_STATUS: (provider: string) => `ai:${provider}:status`,
    AI_COST_TRACKING: (userId: string) => `ai:cost:${userId}`,
  },
  CACHE_TTL: {
    CONTENT_CACHE: 86400,
    AI_PROVIDER_STATUS: 120,
    AI_COST_TRACKING: 3600,
  },
}));

import { 
  generateAIText, 
  trackAICost,
  getUserAIUsage,
  AI_MODELS,
  USE_CASE_MODELS,
  getAvailableProviders,
  getAvailableModels,
  estimateCost
} from '../gateway';
import { z } from 'zod';

describe('AI Gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.GOOGLE_AI_API_KEY = 'test-google-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should have correct model configurations', () => {
      expect(AI_MODELS['gpt-4o']).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
        maxTokens: 4000,
        temperature: 0.7,
        costPerToken: 0.015,
        priority: 2,
        enabled: true,
      });

      expect(AI_MODELS['gpt-4o-mini']).toEqual({
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxTokens: 2000,
        temperature: 0.7,
        costPerToken: 0.00015,
        priority: 1,
        enabled: true,
      });
    });

    it('should have correct use case model mappings', () => {
      expect(USE_CASE_MODELS.research).toContain('gpt-4o');
      expect(USE_CASE_MODELS.content).toContain('gpt-4o-mini');
      expect(USE_CASE_MODELS.structured).toContain('gpt-4o');
    });

    it('should return available providers', () => {
      const providers = getAvailableProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
    });

    it('should return available models for a provider', () => {
      const openaiModels = getAvailableModels('openai');
      expect(openaiModels).toContain('gpt-4o');
      expect(openaiModels).toContain('gpt-4o-mini');
    });
  });

  describe('Cost Estimation', () => {
    it('should calculate cost correctly', () => {
      const cost = estimateCost('gpt-4o-mini', 1000, 500);
      // Input: 1000 tokens * 0.00015 = 0.15
      // Output: 500 tokens * 0.00015 * 1.5 = 0.1125
      // Total: 0.2625
      expect(cost).toBeCloseTo(0.2625, 4);
    });

    it('should handle different models', () => {
      const gpt4Cost = estimateCost('gpt-4o', 1000, 500);
      const miniCost = estimateCost('gpt-4o-mini', 1000, 500);
      
      expect(gpt4Cost).toBeGreaterThan(miniCost);
    });
  });

  describe('Text Generation', () => {
    it('should generate text successfully', async () => {
      const mockResult = {
        text: 'Generated text',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };

      const { generateText } = require('ai');
      generateText.mockResolvedValue(mockResult);

      const result = await generateAIText('Test prompt', 'content', 'user123');

      expect(result).toEqual({
        text: 'Generated text',
        model: expect.any(String),
        inputTokens: 100,
        outputTokens: 50,
        cost: expect.any(Number),
      });

      expect(generateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        prompt: 'Test prompt',
        maxTokens: expect.any(Number),
        temperature: expect.any(Number),
      });
    });

    it('should use cache for expensive operations', async () => {
      const { redis } = require('@/lib/redis/client');
      const cachedResult = {
        text: 'Cached text',
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.1,
      };

      redis.get.mockResolvedValue(cachedResult);

      const result = await generateAIText('Test prompt', 'research');

      expect(result).toEqual(cachedResult);
      expect(redis.get).toHaveBeenCalled();
    });
  });

  describe('Cost Tracking', () => {
    it('should track AI costs', async () => {
      const { redis } = require('@/lib/redis/client');
      
      await trackAICost('user123', 'gpt-4o-mini', 100, 50, 'content');

      expect(redis.lpush).toHaveBeenCalled();
      expect(redis.hincrbyfloat).toHaveBeenCalled();
      expect(redis.expire).toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      const { redis } = require('@/lib/redis/client');
      redis.lpush.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(trackAICost('user123', 'gpt-4o-mini', 100, 50, 'content')).resolves.toBeUndefined();
    });
  });

  describe('Usage Statistics', () => {
    it('should get user AI usage', async () => {
      const { redis } = require('@/lib/redis/client');
      
      redis.lrange.mockResolvedValue([
        JSON.stringify({
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          cost: 0.1,
          model: 'gpt-4o-mini',
          timestamp: Date.now(),
          operation: 'content',
        }),
      ]);
      
      redis.hgetall.mockResolvedValue({
        'gpt-4o-mini': '0.5',
        'gpt-4o-mini_tokens': '1000',
      });

      const usage = await getUserAIUsage('user123');

      expect(usage).toHaveProperty('totalCost');
      expect(usage).toHaveProperty('totalTokensUsed');
      expect(usage).toHaveProperty('monthlyCosts');
      expect(usage).toHaveProperty('operationBreakdown');
    });
  });
});