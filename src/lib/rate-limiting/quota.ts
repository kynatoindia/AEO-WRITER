import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { createRouteClient } from '@/lib/supabase/server';
import { PLAN_QUOTAS, type UserPlan, type QuotaType } from './quota-constants';

// User credit and quota tracking
export interface UserCredits {
  userId: string;
  plan: UserPlan;
  tokensUsed: number;
  tokensLimit: number;
  costUsedUsd: number;
  costLimitUsd: number;
  projectsUsed: number;
  projectsLimit: number;
  resetDate: Date;
}

// Get user plan from database with caching
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const cacheKey = `${CACHE_KEYS.USER_PROFILE(userId)}:plan`;
  
  // Try cache first
  const cachedPlan = await redis.get<UserPlan>(cacheKey);
  if (cachedPlan) {
    return cachedPlan;
  }
  
  // Fetch from database
  const supabase = await createRouteClient();
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('subscription_plan')
    .eq('id', userId)
    .single();
  
  if (error || !profile) {
    console.error('Error fetching user plan:', error);
    return 'free'; // Default to free plan
  }
  
  const plan = (profile as any).subscription_plan as UserPlan;
  
  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL.USER_PROFILE, plan);
  
  return plan;
}

// Get comprehensive user credits and usage
export async function getUserCredits(userId: string): Promise<UserCredits> {
  const cacheKey = CACHE_KEYS.USER_QUOTA(userId);
  
  // Try cache first
  const cachedCredits = await redis.get<UserCredits>(cacheKey);
  if (cachedCredits) {
    return cachedCredits;
  }
  
  // Fetch from database
  const supabase = await createRouteClient();
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !profile) {
    console.error('Error fetching user credits:', error);
    // Return default free plan limits
    const plan = 'free';
    const quotas = PLAN_QUOTAS[plan];
    return {
      userId,
      plan,
      tokensUsed: 0,
      tokensLimit: quotas.tokensPerMonth,
      costUsedUsd: 0,
      costLimitUsd: quotas.costLimitUsd,
      projectsUsed: 0,
      projectsLimit: quotas.projects,
      resetDate: getNextResetDate(),
    };
  }
  
  const profileData = profile as any;
  const plan = profileData.subscription_plan as UserPlan;
  const quotas = PLAN_QUOTAS[plan];
  
  const credits: UserCredits = {
    userId,
    plan,
    tokensUsed: profileData.tokens_used || 0,
    tokensLimit: quotas.tokensPerMonth,
    costUsedUsd: 0, // Will be calculated from usage_analytics
    costLimitUsd: quotas.costLimitUsd,
    projectsUsed: profileData.projects_used || 0,
    projectsLimit: quotas.projects,
    resetDate: getNextResetDate(),
  };
  
  // Get cost usage from analytics
  const { data: costData } = await supabase
    .from('usage_analytics')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', getMonthStart().toISOString());
  
  if (costData) {
    credits.costUsedUsd = costData.reduce((sum: number, record: any) => sum + (record.cost_usd || 0), 0);
  }
  
  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL.USER_QUOTA, credits);
  
  return credits;
}

// Update user credits after usage
export async function updateUserCredits(
  userId: string,
  tokensUsed: number,
  projectIncrement: number = 0
): Promise<UserCredits> {
  const supabase = await createRouteClient();
  
  // Update database using the stored functions
  if (tokensUsed > 0) {
    const { error: tokenError } = await (supabase.rpc as any)('increment_tokens', { 
      user_id: userId, 
      increment: tokensUsed 
    });
    
    if (tokenError) {
      console.error('Error updating user tokens:', tokenError);
      throw new Error('Failed to update user tokens');
    }
  }
  
  if (projectIncrement > 0) {
    const { error: projectError } = await (supabase.rpc as any)('increment_projects', { 
      user_id: userId, 
      increment: projectIncrement 
    });
    
    if (projectError) {
      console.error('Error updating user projects:', projectError);
      throw new Error('Failed to update user projects');
    }
  }
  
  // Invalidate cache
  await redis.del(CACHE_KEYS.USER_QUOTA(userId));
  
  // Return updated credits
  return await getUserCredits(userId);
}

// Helper functions
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getNextResetDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

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

// Check if user has exceeded quota (enhanced version)
export async function checkQuota(
  userId: string,
  userPlan: UserPlan,
  quotaType: QuotaType
): Promise<{ allowed: boolean; usage: number; limit: number; resetDate?: Date }> {
  const limit = PLAN_QUOTAS[userPlan][quotaType];
  
  // Unlimited quota
  if (limit === -1) {
    return { allowed: true, usage: 0, limit: -1 };
  }
  
  const usage = await getUserUsage(userId, quotaType);
  const allowed = usage < limit;
  
  return { 
    allowed, 
    usage, 
    limit,
    resetDate: quotaType === 'apiCalls' ? getTomorrowDate() : getNextResetDate()
  };
}

// Enhanced quota check using database and cache
export async function checkUserQuota(
  userId: string,
  quotaType: QuotaType,
  requestedAmount: number = 1
): Promise<{ 
  allowed: boolean; 
  usage: number; 
  limit: number; 
  remaining: number;
  resetDate: Date;
  plan: UserPlan;
}> {
  const credits = await getUserCredits(userId);
  const quotas = PLAN_QUOTAS[credits.plan];
  
  let usage: number;
  let limit: number;
  let allowed: boolean;
  
  switch (quotaType) {
    case 'contentGeneration':
      const contentUsage = await getUserUsage(userId, 'contentGeneration');
      usage = contentUsage;
      limit = quotas.contentGeneration;
      allowed = limit === -1 || (usage + requestedAmount) <= limit;
      break;
      
    case 'apiCalls':
      const apiUsage = await getUserUsage(userId, 'apiCalls');
      usage = apiUsage;
      limit = quotas.apiCalls;
      allowed = limit === -1 || (usage + requestedAmount) <= limit;
      break;
      
    case 'projects':
      usage = credits.projectsUsed;
      limit = credits.projectsLimit;
      allowed = limit === -1 || (usage + requestedAmount) <= limit;
      break;
      
    case 'tokensPerMonth':
      usage = credits.tokensUsed;
      limit = credits.tokensLimit;
      allowed = limit === -1 || (usage + requestedAmount) <= limit;
      break;
      
    case 'costLimitUsd':
      usage = Math.round(credits.costUsedUsd * 100) / 100; // Round to 2 decimal places
      limit = credits.costLimitUsd;
      allowed = limit === -1 || (usage + requestedAmount) <= limit;
      break;
      
    default:
      throw new Error(`Unknown quota type: ${quotaType}`);
  }
  
  const remaining = limit === -1 ? -1 : Math.max(0, limit - usage);
  
  return {
    allowed,
    usage,
    limit,
    remaining,
    resetDate: credits.resetDate,
    plan: credits.plan,
  };
}

// Helper functions
function getTomorrowDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

// Enhanced rate limiting for API calls with abuse prevention
export async function checkRateLimit(
  userId: string,
  windowSeconds: number = 60,
  maxRequests: number = 10,
  endpoint?: string
): Promise<{ 
  allowed: boolean; 
  remaining: number; 
  resetTime: number;
  retryAfter?: number;
  isAbusive?: boolean;
}> {
  const key = endpoint 
    ? `${CACHE_KEYS.RATE_LIMIT(userId)}:${endpoint}`
    : CACHE_KEYS.RATE_LIMIT(userId);
  
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  // Remove old entries and count current requests
  await redis.zremrangebyscore(key, 0, windowStart);
  const currentRequests = await redis.zcard(key);
  
  // Check for abusive behavior (too many requests in short time)
  const shortWindowStart = now - 10000; // 10 seconds
  const shortWindowRequests = await redis.zcount(key, shortWindowStart, now);
  const isAbusive = shortWindowRequests > (maxRequests * 0.8); // 80% of limit in 10 seconds
  
  if (currentRequests >= maxRequests) {
    const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true });
    const resetTime = oldestRequest.length > 0 
      ? Math.ceil(((oldestRequest[0] as any).score + (windowSeconds * 1000)) / 1000)
      : Math.ceil((now + (windowSeconds * 1000)) / 1000);
    
    // Increase penalty for abusive behavior
    const retryAfter = isAbusive ? resetTime + 300 : resetTime; // +5 minutes for abuse
    
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter,
      isAbusive,
    };
  }
  
  // Add current request
  await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  await redis.expire(key, windowSeconds);
  
  // Track abusive patterns
  if (isAbusive) {
    await trackAbusiveUser(userId, endpoint);
  }
  
  return {
    allowed: true,
    remaining: maxRequests - currentRequests - 1,
    resetTime: Math.ceil((now + (windowSeconds * 1000)) / 1000),
    isAbusive,
  };
}

// Track users with abusive patterns
async function trackAbusiveUser(userId: string, endpoint?: string): Promise<void> {
  const abuseKey = `${CACHE_KEYS.USER_USAGE(userId)}:abuse_score`;
  const currentScore = await redis.get<number>(abuseKey) || 0;
  const newScore = currentScore + 1;
  
  // Store abuse score with 24-hour TTL
  await redis.setex(abuseKey, 86400, newScore);
  
  // Log severe abuse (score > 10)
  if (newScore > 10) {
    console.warn(`User ${userId} showing abusive behavior on ${endpoint || 'unknown endpoint'}, score: ${newScore}`);
    
    // Could trigger additional actions like temporary suspension
    await redis.setex(`${CACHE_KEYS.USER_USAGE(userId)}:suspended`, 3600, true); // 1 hour suspension
  }
}

// Check if user is temporarily suspended
export async function isUserSuspended(userId: string): Promise<boolean> {
  const suspendedKey = `${CACHE_KEYS.USER_USAGE(userId)}:suspended`;
  const suspended = await redis.get<boolean>(suspendedKey);
  return suspended === true;
}

// Global rate limiting for endpoints
export async function checkGlobalRateLimit(
  endpoint: string,
  windowSeconds: number = 300, // 5 minutes
  maxRequests: number = 1000
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = CACHE_KEYS.RATE_LIMIT_GLOBAL(endpoint);
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  // Remove old entries and count current requests
  await redis.zremrangebyscore(key, 0, windowStart);
  const currentRequests = await redis.zcard(key);
  
  if (currentRequests >= maxRequests) {
    const oldestRequest = await redis.zrange(key, 0, 0, { withScores: true });
    const resetTime = oldestRequest.length > 0 
      ? Math.ceil(((oldestRequest[0] as any).score + (windowSeconds * 1000)) / 1000)
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