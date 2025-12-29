import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

// User plan quotas
export const PLAN_QUOTAS = {
  free: {
    contentGeneration: 10, // per month
    apiCalls: 100, // per day
    projects: 3,
  },
  pro: {
    contentGeneration: 500, // per month
    apiCalls: 5000, // per day
    projects: 50,
  },
  enterprise: {
    contentGeneration: -1, // unlimited
    apiCalls: -1, // unlimited
    projects: -1, // unlimited
  },
} as const;

export type UserPlan = keyof typeof PLAN_QUOTAS;
export type QuotaType = keyof typeof PLAN_QUOTAS.free;

// Get user's current usage
export async function getUserUsage(
  userId: string,
  quotaType: QuotaType
): Promise<number> {
  const key = `${CACHE_KEYS.USER_USAGE(userId)}:${quotaType}`;
  const usage = await redis.get<number>(key);
  return usage || 0;
}

// Increment user usage
export async function incrementUsage(
  userId: string,
  quotaType: QuotaType,
  amount: number = 1
): Promise<number> {
  const key = `${CACHE_KEYS.USER_USAGE(userId)}:${quotaType}`;
  
  // Get current usage
  const currentUsage = await getUserUsage(userId, quotaType);
  const newUsage = currentUsage + amount;
  
  // Set with appropriate TTL based on quota type
  const ttl = quotaType === 'apiCalls' ? 86400 : 2592000; // 1 day or 30 days
  await redis.setex(key, ttl, newUsage);
  
  return newUsage;
}

// Check if user has exceeded quota
export async function checkQuota(
  userId: string,
  userPlan: UserPlan,
  quotaType: QuotaType
): Promise<{ allowed: boolean; usage: number; limit: number }> {
  const limit = PLAN_QUOTAS[userPlan][quotaType];
  
  // Unlimited quota
  if (limit === -1) {
    return { allowed: true, usage: 0, limit: -1 };
  }
  
  const usage = await getUserUsage(userId, quotaType);
  const allowed = usage < limit;
  
  return { allowed, usage, limit };
}

// Rate limiting for API calls
export async function checkRateLimit(
  userId: string,
  windowSeconds: number = 60,
  maxRequests: number = 10
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = CACHE_KEYS.RATE_LIMIT(userId);
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  // Remove old entries and count current requests
  await redis.zremrangebyscore(key, 0, windowStart);
  const currentRequests = await redis.zcard(key);
  
  if (currentRequests >= maxRequests) {
    const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true });
    const resetTime = oldestRequest.length > 0 
      ? Math.ceil((oldestRequest[0].score + (windowSeconds * 1000)) / 1000)
      : Math.ceil((now + (windowSeconds * 1000)) / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }
  
  // Add current request
  await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  await redis.expire(key, windowSeconds);
  
  return {
    allowed: true,
    remaining: maxRequests - currentRequests - 1,
    resetTime: Math.ceil((now + (windowSeconds * 1000)) / 1000),
  };
}