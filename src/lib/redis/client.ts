import { Redis } from '@upstash/redis';

// Create Redis client with production configuration
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  // Production optimizations
  retry: {
    retries: 3,
    retryDelayOnFailure: 1000,
  },
  automaticDeserialization: true,
});

// Cache keys with hierarchical structure
export const CACHE_KEYS = {
  // User-related caches
  USER_QUOTA: (userId: string) => `user:${userId}:quota`,
  USER_USAGE: (userId: string) => `user:${userId}:usage`,
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  USER_PROJECTS: (userId: string) => `user:${userId}:projects`,
  USER_SUBSCRIPTION: (userId: string) => `user:${userId}:subscription`,
  
  // Rate limiting
  RATE_LIMIT: (userId: string) => `rate_limit:${userId}`,
  RATE_LIMIT_GLOBAL: (endpoint: string) => `rate_limit:global:${endpoint}`,
  
  // Content caching
  CONTENT_CACHE: (hash: string) => `content:${hash}`,
  RESEARCH_CACHE: (hash: string) => `research:${hash}`,
  BLUEPRINT_CACHE: (hash: string) => `blueprint:${hash}`,
  
  // Project-related caches
  PROJECT_STATUS: (projectId: string) => `project:${projectId}:status`,
  PROJECT_PROGRESS: (projectId: string) => `project:${projectId}:progress`,
  PROJECT_SECTIONS: (projectId: string) => `project:${projectId}:sections`,
  
  // AI provider caches
  AI_PROVIDER_STATUS: (provider: string) => `ai:${provider}:status`,
  AI_COST_TRACKING: (userId: string) => `ai:cost:${userId}`,
  
  // System caches
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_METRICS: 'system:metrics',
  ACTIVE_USERS: 'system:active_users',
  
  // Session and temporary data
  SESSION_DATA: (sessionId: string) => `session:${sessionId}`,
  TEMP_UPLOAD: (uploadId: string) => `temp:upload:${uploadId}`,
  
  // Analytics and monitoring
  USAGE_ANALYTICS: (date: string) => `analytics:usage:${date}`,
  ERROR_TRACKING: (type: string) => `errors:${type}`,
} as const;

// Cache TTL values (in seconds) with different strategies
export const CACHE_TTL = {
  // User data - medium term caching
  USER_QUOTA: 3600, // 1 hour
  USER_USAGE: 300, // 5 minutes (frequent updates)
  USER_PROFILE: 1800, // 30 minutes
  USER_PROJECTS: 600, // 10 minutes
  USER_SUBSCRIPTION: 7200, // 2 hours
  
  // Rate limiting - short term
  RATE_LIMIT: 60, // 1 minute
  RATE_LIMIT_GLOBAL: 300, // 5 minutes
  
  // Content caching - long term
  CONTENT_CACHE: 86400, // 24 hours
  RESEARCH_CACHE: 172800, // 48 hours (research is expensive)
  BLUEPRINT_CACHE: 43200, // 12 hours
  
  // Project data - medium term
  PROJECT_STATUS: 300, // 5 minutes
  PROJECT_PROGRESS: 60, // 1 minute (real-time updates)
  PROJECT_SECTIONS: 1800, // 30 minutes
  
  // AI provider status - short term
  AI_PROVIDER_STATUS: 120, // 2 minutes
  AI_COST_TRACKING: 3600, // 1 hour
  
  // System monitoring - very short term
  SYSTEM_HEALTH: 30, // 30 seconds
  SYSTEM_METRICS: 60, // 1 minute
  ACTIVE_USERS: 300, // 5 minutes
  
  // Session data - medium term
  SESSION_DATA: 1800, // 30 minutes
  TEMP_UPLOAD: 3600, // 1 hour
  
  // Analytics - long term
  USAGE_ANALYTICS: 604800, // 1 week
  ERROR_TRACKING: 86400, // 24 hours
} as const;

// Advanced caching utilities
export class CacheManager {
  // Multi-level cache with fallback
  static async getWithFallback<T>(
    primaryKey: string,
    fallbackKey: string,
    fallbackFn: () => Promise<T>,
    ttl: number = CACHE_TTL.CONTENT_CACHE
  ): Promise<T> {
    try {
      // Try primary cache first
      const primaryData = await redis.get<T>(primaryKey);
      if (primaryData !== null) {
        return primaryData;
      }
      
      // Try fallback cache
      const fallbackData = await redis.get<T>(fallbackKey);
      if (fallbackData !== null) {
        // Refresh primary cache
        await redis.setex(primaryKey, ttl, fallbackData);
        return fallbackData;
      }
      
      // Execute fallback function
      const freshData = await fallbackFn();
      
      // Cache in both locations
      await Promise.all([
        redis.setex(primaryKey, ttl, freshData),
        redis.setex(fallbackKey, ttl * 2, freshData), // Longer TTL for fallback
      ]);
      
      return freshData;
    } catch (error) {
      console.error('Cache fallback error:', error);
      return await fallbackFn();
    }
  }
  
  // Batch operations for efficiency
  static async mgetWithTTL<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    
    try {
      return await redis.mget<T>(...keys);
    } catch (error) {
      console.error('Batch get error:', error);
      return keys.map(() => null);
    }
  }
  
  static async msetWithTTL<T>(
    data: Array<{ key: string; value: T; ttl: number }>
  ): Promise<void> {
    if (data.length === 0) return;
    
    try {
      const pipeline = redis.pipeline();
      
      for (const { key, value, ttl } of data) {
        pipeline.setex(key, ttl, value);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Batch set error:', error);
    }
  }
  
  // Cache warming for frequently accessed data
  static async warmCache(userId: string): Promise<void> {
    try {
      const keys = [
        CACHE_KEYS.USER_QUOTA(userId),
        CACHE_KEYS.USER_USAGE(userId),
        CACHE_KEYS.USER_PROFILE(userId),
        CACHE_KEYS.USER_PROJECTS(userId),
      ];
      
      // Check which keys are missing
      const values = await redis.mget(...keys);
      const missingKeys = keys.filter((_, index) => values[index] === null);
      
      if (missingKeys.length > 0) {
        console.log(`Warming cache for user ${userId}, missing keys:`, missingKeys);
        // Implement cache warming logic here
      }
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }
  
  // Cache invalidation patterns
  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `user:${userId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  static async invalidateProjectCache(projectId: string): Promise<void> {
    try {
      const pattern = `project:${projectId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Project cache invalidation error:', error);
    }
  }
}

// Connection health monitoring
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Memory usage monitoring
export async function getRedisMemoryInfo(): Promise<{
  usedMemory: number;
  maxMemory: number;
  memoryUsagePercent: number;
} | null> {
  try {
    // This would require Redis INFO command which might not be available in Upstash REST API
    // For now, return null and implement via Upstash dashboard monitoring
    return null;
  } catch (error) {
    console.error('Redis memory info error:', error);
    return null;
  }
}