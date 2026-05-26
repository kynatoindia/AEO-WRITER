import { Redis } from '@upstash/redis';

// Detect whether Redis is actually configured (non-placeholder URL)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? '';
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
const isRedisConfigured = redisUrl.startsWith('https://') && redisToken.length > 10;

let _warnedAboutRedis = false;
function warnOnce() {
  if (!_warnedAboutRedis) {
    _warnedAboutRedis = true;
    console.warn(
      '[Redis] Upstash Redis is not reachable — falling back to in-memory store. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local for persistent caching.'
    );
  }
}

// Simple in-memory store used when Redis is unavailable
class InMemoryRedis {
  private store = new Map<string, { value: unknown; expiresAt?: number }>();

  private isExpired(entry: { value: unknown; expiresAt?: number }): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }

  async get<T>(key: string): Promise<T | null> {
    warnOnce();
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return null;
    return entry.value as T;
  }

  async set(key: string, value: unknown): Promise<'OK'> {
    warnOnce();
    this.store.set(key, { value });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: unknown): Promise<'OK'> {
    warnOnce();
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    warnOnce();
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    warnOnce();
    return keys.filter(k => {
      const e = this.store.get(k);
      return e && !this.isExpired(e);
    }).length;
  }

  async expire(key: string, seconds: number): Promise<0 | 1> {
    warnOnce();
    const entry = this.store.get(key);
    if (!entry) return 0;
    this.store.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 });
    return 1;
  }

  async incr(key: string): Promise<number> {
    warnOnce();
    const entry = this.store.get(key);
    const current = entry && !this.isExpired(entry) ? Number(entry.value) || 0 : 0;
    const next = current + 1;
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt });
    return next;
  }

  async incrby(key: string, by: number): Promise<number> {
    warnOnce();
    const entry = this.store.get(key);
    const current = entry && !this.isExpired(entry) ? Number(entry.value) || 0 : 0;
    const next = current + by;
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt });
    return next;
  }

  async keys(pattern: string): Promise<string[]> {
    warnOnce();
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return [...this.store.keys()].filter(k => regex.test(k) && !this.isExpired(this.store.get(k)!));
  }

  async mget(...keys: string[]): Promise<(unknown | null)[]> {
    warnOnce();
    return keys.map(k => {
      const e = this.store.get(k);
      return e && !this.isExpired(e) ? e.value : null;
    });
  }

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    warnOnce();
    const entry = this.store.get(key);
    const list = (entry && !this.isExpired(entry) ? entry.value : []) as unknown[];
    const next = [...values.reverse(), ...list];
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt });
    return next.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<unknown[]> {
    warnOnce();
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return [];
    const list = entry.value as unknown[];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    warnOnce();
    const entry = this.store.get(key);
    const hash = (entry && !this.isExpired(entry) ? entry.value : {}) as Record<string, unknown>;
    const current = Number(hash[field]) || 0;
    const next = current + increment;
    this.store.set(key, { value: { ...hash, [field]: next }, expiresAt: entry?.expiresAt });
    return next;
  }

  async hincrbyfloat(key: string, field: string, increment: number): Promise<number> {
    return this.hincrby(key, field, increment);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async zadd(key: string, ...args: unknown[]): Promise<number> {
    warnOnce();
    return 0;
  }

  async zrange(key: string, ...args: unknown[]): Promise<unknown[]> {
    warnOnce();
    return [];
  }

  async zcard(key: string): Promise<number> {
    warnOnce();
    return 0;
  }

  async hset(key: string, obj: Record<string, unknown>): Promise<number> {
    warnOnce();
    const entry = this.store.get(key);
    const current = (entry && !this.isExpired(entry) ? entry.value : {}) as Record<string, unknown>;
    this.store.set(key, { value: { ...current, ...obj }, expiresAt: entry?.expiresAt });
    return Object.keys(obj).length;
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    warnOnce();
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return null;
    return ((entry.value as Record<string, unknown>)[field] as T) ?? null;
  }

  async hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    warnOnce();
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return null;
    return entry.value as T;
  }

  pipeline() {
    warnOnce();
    const ops: Array<() => Promise<unknown>> = [];
    const self = this;
    const pipe = {
      setex: (key: string, ttl: number, val: unknown) => { ops.push(() => self.setex(key, ttl, val)); return pipe; },
      set: (key: string, val: unknown) => { ops.push(() => self.set(key, val)); return pipe; },
      del: (...keys: string[]) => { ops.push(() => self.del(...keys)); return pipe; },
      incr: (key: string) => { ops.push(() => self.incr(key)); return pipe; },
      exec: async () => { return await Promise.all(ops.map(f => f())); },
    };
    return pipe;
  }
}

// Create the real Redis client if credentials are available
const _realRedis = isRedisConfigured
  ? new Redis({
      url: redisUrl,
      token: redisToken,
      retry: { retries: 1, backoff: () => 500 },
      automaticDeserialization: true,
    })
  : null;

const _fallback = new InMemoryRedis();

// Proxy that tries the real client first and falls back to in-memory on any error
function createRedisProxy(real: Redis | null, fallback: InMemoryRedis): Redis {
  if (!real) return fallback as unknown as Redis;

  return new Proxy(real, {
    get(target, prop) {
      const original = (target as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof original !== 'function') return original;
      return async (...args: unknown[]) => {
        try {
          return await (original as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        } catch (err) {
          warnOnce();
          const fb = (fallback as unknown as Record<string | symbol, unknown>)[prop];
          if (typeof fb === 'function') {
            return await (fb as (...a: unknown[]) => Promise<unknown>).apply(fallback, args);
          }
          return null;
        }
      };
    },
  });
}

// Create Redis client with production configuration
export const redis = createRedisProxy(_realRedis, _fallback);

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
      return await (redis.mget as (...args: string[]) => Promise<(T | null)[]>)(...keys);
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