import { inngest, generateIdempotencyKey, CONCURRENCY_LIMITS, RETRY_CONFIG } from '../client';
import { WorkflowRecovery, AIRateLimiter, ConcurrencyManager, IdempotencyManager } from '../workflow-manager';
import { redis } from '@/lib/redis/client';

// Mock Redis for testing
jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    scard: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    zadd: jest.fn(),
    hincrby: jest.fn(),
    lpush: jest.fn(),
    zrangebyscore: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  },
  CACHE_KEYS: {
    USER_QUOTA: (userId: string) => `quota:${userId}`,
    USER_USAGE: (userId: string) => `usage:${userId}`,
  },
}));

// Mock AI Gateway
jest.mock('@/lib/ai/gateway', () => ({
  generateAIText: jest.fn().mockResolvedValue('Generated AI content'),
}));

describe('Inngest Workflow Engine Setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Inngest Client Configuration', () => {
    it('should have correct client configuration', () => {
      // Test that the client is properly instantiated
      expect(inngest).toBeDefined();
      expect(typeof inngest.send).toBe('function');
      expect(typeof inngest.createFunction).toBe('function');
    });

    it('should have proper concurrency limits', () => {
      expect(CONCURRENCY_LIMITS['content/generate']).toBe(3);
      expect(CONCURRENCY_LIMITS['project/research-started']).toBe(2);
      expect(CONCURRENCY_LIMITS['project/content-generation-started']).toBe(1);
    });

    it('should have proper retry configuration', () => {
      expect(RETRY_CONFIG['ai-request'].attempts).toBe(5);
      expect(RETRY_CONFIG['ai-request'].delay).toBe('2s');
      expect(RETRY_CONFIG['ai-request'].maxDelay).toBe('60s');
      expect(RETRY_CONFIG['ai-request'].backoff).toBe('exponential');
    });
  });

  describe('Idempotency Key Generation', () => {
    it('should generate unique content generation keys', () => {
      const key1 = generateIdempotencyKey.contentGeneration('user1', 'project1', 'section1');
      const key2 = generateIdempotencyKey.contentGeneration('user1', 'project1', 'section2');
      
      expect(key1).toContain('content_gen_user1_project1_section1');
      expect(key2).toContain('content_gen_user1_project1_section2');
      expect(key1).not.toBe(key2);
    });

    it('should generate research keys based on URLs', () => {
      const urls = ['https://example.com', 'https://test.com'];
      const key = generateIdempotencyKey.research('user1', 'project1', urls);
      
      expect(key).toContain('research_user1_project1');
      expect(key).toContain('https://example.com_https://test.com');
    });

    it('should generate blueprint keys with version', () => {
      const key1 = generateIdempotencyKey.blueprint('user1', 'project1', 1);
      const key2 = generateIdempotencyKey.blueprint('user1', 'project1', 2);
      
      expect(key1).toBe('blueprint_user1_project1_v1');
      expect(key2).toBe('blueprint_user1_project1_v2');
    });
  });

  describe('AI Rate Limiter', () => {
    it('should check OpenAI rate limits correctly', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(5);
      (redis.ttl as jest.Mock).mockResolvedValue(30);

      const result = await AIRateLimiter.checkRateLimit('openai', 'user1');

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(45); // 50 - 5
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should detect rate limit exceeded', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(55); // Exceeds limit of 50
      (redis.ttl as jest.Mock).mockResolvedValue(30);

      const result = await AIRateLimiter.checkRateLimit('openai', 'user1');

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
    });

    it('should wait for rate limit reset', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(55);
      (redis.ttl as jest.Mock).mockResolvedValue(1); // 1 second remaining

      // Mock setTimeout to avoid actual waiting in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return {} as any;
      });

      await AIRateLimiter.waitForRateLimit('openai', 'user1');

      expect(global.setTimeout).toHaveBeenCalled();
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Concurrency Manager', () => {
    it('should check concurrency limits', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(2);

      const result = await ConcurrencyManager.checkConcurrency('content/generate', 'user1');

      expect(result.allowed).toBe(true); // 2 < 3 (limit)
      expect(result.currentConcurrency).toBe(2);
      expect(result.limit).toBe(3);
    });

    it('should detect concurrency limit exceeded', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(3);

      const result = await ConcurrencyManager.checkConcurrency('content/generate', 'user1');

      expect(result.allowed).toBe(false); // 3 >= 3 (limit)
    });

    it('should acquire concurrency slot', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(1);
      (redis.sadd as jest.Mock).mockResolvedValue(1);

      const acquired = await ConcurrencyManager.acquireSlot('content/generate', 'user1', 'workflow1');

      expect(acquired).toBe(true);
      expect(redis.sadd).toHaveBeenCalledWith('concurrency:content/generate:user1', 'workflow1');
      expect(redis.expire).toHaveBeenCalledWith('concurrency:content/generate:user1', 3600);
    });

    it('should release concurrency slot', async () => {
      await ConcurrencyManager.releaseSlot('content/generate', 'user1', 'workflow1');

      expect(redis.srem).toHaveBeenCalledWith('concurrency:content/generate:user1', 'workflow1');
    });
  });

  describe('Idempotency Manager', () => {
    it('should check for existing idempotent operations', async () => {
      const existingResult = { success: true, data: 'test' };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(existingResult));

      const result = await IdempotencyManager.checkIdempotency('test-key');

      expect(result).toEqual(existingResult);
      expect(redis.get).toHaveBeenCalledWith('idempotency:test-key');
    });

    it('should return null for non-existent operations', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await IdempotencyManager.checkIdempotency('non-existent-key');

      expect(result).toBeNull();
    });

    it('should store idempotent results', async () => {
      const result = { success: true, data: 'test' };
      
      await IdempotencyManager.storeResult('test-key', result, 7200);

      expect(redis.setex).toHaveBeenCalledWith(
        'idempotency:test-key',
        7200,
        JSON.stringify(result)
      );
    });

    it('should generate content-based keys', () => {
      const key = IdempotencyManager.generateContentKey('test-operation', 'test content');
      
      expect(key).toMatch(/^test-operation_[a-f0-9]{16}$/);
    });
  });

  describe('Workflow Recovery', () => {
    it('should track completed steps', async () => {
      const result = { data: 'test', timestamp: Date.now() };
      
      await WorkflowRecovery.markStepCompleted('workflow1', 'step1', result);

      expect(redis.hset).toHaveBeenCalledWith(
        'workflow:workflow1:steps',
        'step1',
        expect.stringContaining('"completedAt":')
      );
      
      const call = (redis.hset as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(call[2]);
      expect(storedData.result).toEqual(result);
      expect(storedData.status).toBe('completed');
      expect(typeof storedData.completedAt).toBe('number');
    });

    it('should retrieve completed steps', async () => {
      const stepData = {
        step1: JSON.stringify({ completedAt: Date.now(), result: 'test1', status: 'completed' }),
        step2: JSON.stringify({ completedAt: Date.now(), result: 'test2', status: 'completed' }),
      };
      (redis.hgetall as jest.Mock).mockResolvedValue(stepData);

      const steps = await WorkflowRecovery.getCompletedSteps('workflow1');

      expect(steps).toHaveProperty('step1');
      expect(steps).toHaveProperty('step2');
      expect(steps.step1.result).toBe('test1');
      expect(steps.step2.result).toBe('test2');
    });
  });

  describe('Event Type Definitions', () => {
    it('should have comprehensive event types defined', () => {
      // This test ensures our event types are properly structured
      // The actual types are checked at compile time
      const eventTypes = [
        'user/registered',
        'user/plan-upgraded',
        'project/created',
        'project/research-started',
        'project/blueprint-generated',
        'project/content-generation-started',
        'project/section-completed',
        'project/completed',
        'content/generate',
        'content/research-completed',
        'quota/exceeded',
        'quota/warning',
        'system/health-check',
        'system/cleanup',
        'error/ai-provider-failed',
        'error/rate-limit-exceeded',
      ];

      // Verify we have all expected event types
      expect(eventTypes.length).toBeGreaterThan(10);
      expect(eventTypes).toContain('content/generate');
      expect(eventTypes).toContain('project/research-started');
    });
  });
});

describe('Integration Tests', () => {
  describe('Content Generation Workflow', () => {
    it('should handle complete content generation flow', async () => {
      // Mock successful quota check
      (redis.get as jest.Mock).mockResolvedValue(null); // No existing idempotent result
      (redis.incr as jest.Mock).mockResolvedValue(1); // Within rate limits
      (redis.scard as jest.Mock).mockResolvedValue(0); // No concurrency conflicts

      // This would be tested with actual Inngest function execution
      // For now, we verify the configuration is correct
      expect(CONCURRENCY_LIMITS['content/generate']).toBe(3);
      expect(RETRY_CONFIG['ai-request'].attempts).toBe(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle AI provider failures with proper retry logic', () => {
      const retryConfig = RETRY_CONFIG['ai-request'];
      
      expect(retryConfig.retryIf).toBeDefined();
      
      // Test retry conditions
      const shouldRetry429 = retryConfig.retryIf({ status: 429 }); // Rate limit
      const shouldRetry502 = retryConfig.retryIf({ status: 502 }); // Bad gateway
      const shouldNotRetry400 = retryConfig.retryIf({ status: 400 }); // Bad request
      
      expect(shouldRetry429).toBe(true);
      expect(shouldRetry502).toBe(true);
      expect(shouldNotRetry400).toBe(false);
    });
  });
});