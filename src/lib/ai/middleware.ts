import { NextRequest, NextResponse } from 'next/server';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { getUserAIUsage, AIModel } from './gateway';

// Token tracking middleware for API routes
export interface TokenTrackingOptions {
  maxCostPerUser?: number;
  maxTokensPerUser?: number;
  maxRequestsPerMinute?: number;
  requireAuth?: boolean;
}

// Default limits
const DEFAULT_LIMITS: Required<TokenTrackingOptions> = {
  maxCostPerUser: 10.0, // $10 per month
  maxTokensPerUser: 1000000, // 1M tokens per month
  maxRequestsPerMinute: 60, // 60 requests per minute
  requireAuth: true,
};

// Middleware to check user quotas before AI operations
export async function withTokenTracking(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: TokenTrackingOptions = {}
): Promise<NextResponse> {
  const opts = { ...DEFAULT_LIMITS, ...options };
  
  try {
    // Extract user ID from request (assuming it's in headers or auth)
    const userId = request.headers.get('x-user-id') || 
                   request.headers.get('authorization')?.split(' ')[1]; // Bearer token
    
    if (opts.requireAuth && !userId) {
      return NextResponse.json(
        { error: 'Authentication required for AI operations' },
        { status: 401 }
      );
    }
    
    if (userId) {
      // Check rate limiting
      const rateLimitKey = CACHE_KEYS.RATE_LIMIT(userId);
      const currentRequests = await redis.incr(rateLimitKey);
      
      if (currentRequests === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute window
      }
      
      if (currentRequests > opts.maxRequestsPerMinute) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            limit: opts.maxRequestsPerMinute,
            resetTime: 60
          },
          { status: 429 }
        );
      }
      
      // Check user quotas
      const usage = await getUserAIUsage(userId);
      
      if (usage.totalCost >= opts.maxCostPerUser) {
        return NextResponse.json(
          {
            error: 'Monthly cost limit exceeded',
            currentCost: usage.totalCost,
            limit: opts.maxCostPerUser
          },
          { status: 402 } // Payment required
        );
      }
      
      if (usage.totalTokensUsed >= opts.maxTokensPerUser) {
        return NextResponse.json(
          {
            error: 'Monthly token limit exceeded',
            currentTokens: usage.totalTokensUsed,
            limit: opts.maxTokensPerUser
          },
          { status: 402 }
        );
      }
      
      // Add usage info to response headers
      const response = await handler(request);
      response.headers.set('X-AI-Cost-Used', usage.totalCost.toString());
      response.headers.set('X-AI-Cost-Limit', opts.maxCostPerUser.toString());
      response.headers.set('X-AI-Tokens-Used', usage.totalTokensUsed.toString());
      response.headers.set('X-AI-Tokens-Limit', opts.maxTokensPerUser.toString());
      response.headers.set('X-Rate-Limit-Remaining', (opts.maxRequestsPerMinute - currentRequests).toString());
      
      return response;
    }
    
    // No user ID, proceed without tracking
    return await handler(request);
    
  } catch (error) {
    console.error('Token tracking middleware error:', error);
    
    // Don't block requests due to middleware errors
    return await handler(request);
  }
}

// Quota checking utility for use in API routes
export async function checkUserQuota(
  userId: string,
  estimatedCost: number,
  estimatedTokens: number,
  options: TokenTrackingOptions = {}
): Promise<{
  allowed: boolean;
  reason?: string;
  currentUsage: {
    cost: number;
    tokens: number;
    costLimit: number;
    tokenLimit: number;
  };
}> {
  const opts = { ...DEFAULT_LIMITS, ...options };
  
  try {
    const usage = await getUserAIUsage(userId);
    
    const currentUsage = {
      cost: usage.totalCost,
      tokens: usage.totalTokensUsed,
      costLimit: opts.maxCostPerUser,
      tokenLimit: opts.maxTokensPerUser,
    };
    
    // Check if the estimated usage would exceed limits
    if (usage.totalCost + estimatedCost > opts.maxCostPerUser) {
      return {
        allowed: false,
        reason: 'Estimated cost would exceed monthly limit',
        currentUsage,
      };
    }
    
    if (usage.totalTokensUsed + estimatedTokens > opts.maxTokensPerUser) {
      return {
        allowed: false,
        reason: 'Estimated tokens would exceed monthly limit',
        currentUsage,
      };
    }
    
    return {
      allowed: true,
      currentUsage,
    };
    
  } catch (error) {
    console.error('Quota check error:', error);
    
    // Allow request if quota check fails (fail open)
    return {
      allowed: true,
      currentUsage: {
        cost: 0,
        tokens: 0,
        costLimit: opts.maxCostPerUser,
        tokenLimit: opts.maxTokensPerUser,
      },
    };
  }
}

// Pre-flight cost estimation for different operations
export function estimateOperationCost(
  operation: 'research' | 'blueprint' | 'content' | 'polish',
  inputLength: number
): {
  estimatedTokens: number;
  estimatedCost: number;
  recommendedModel: AIModel;
} {
  // Rough estimation based on operation type and input length
  const estimations = {
    research: {
      tokensMultiplier: 3, // Research generates more output
      baseTokens: 1000,
      preferredModel: 'gpt-4o' as AIModel,
    },
    blueprint: {
      tokensMultiplier: 2.5,
      baseTokens: 800,
      preferredModel: 'gpt-4o' as AIModel,
    },
    content: {
      tokensMultiplier: 2,
      baseTokens: 500,
      preferredModel: 'gpt-4o-mini' as AIModel,
    },
    polish: {
      tokensMultiplier: 1.2,
      baseTokens: 200,
      preferredModel: 'gpt-4o-mini' as AIModel,
    },
  };
  
  const config = estimations[operation];
  const inputTokens = Math.ceil(inputLength / 4); // Rough token estimation
  const outputTokens = Math.ceil(inputTokens * config.tokensMultiplier) + config.baseTokens;
  const totalTokens = inputTokens + outputTokens;
  
  // Get model cost
  const modelConfig = {
    'gpt-4o': 0.015,
    'gpt-4o-mini': 0.00015,
    'gemini-1.5-pro': 0.0035,
    'gemini-1.5-flash': 0.00035,
  };
  
  const costPerToken = modelConfig[config.preferredModel];
  const estimatedCost = (totalTokens / 1000) * costPerToken;
  
  return {
    estimatedTokens: totalTokens,
    estimatedCost,
    recommendedModel: config.preferredModel,
  };
}

// Usage analytics for admin dashboard
export async function getUsageAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
  totalUsers: number;
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  averageCostPerUser: number;
  topUsers: Array<{ userId: string; cost: number; tokens: number }>;
  modelDistribution: Record<AIModel, number>;
  operationDistribution: Record<string, number>;
}> {
  try {
    const days = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
    const userKeys = await redis.keys('ai:cost:*:monthly');
    
    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;
    const userCosts: Array<{ userId: string; cost: number; tokens: number }> = [];
    const modelDistribution: Record<AIModel, number> = {} as Record<AIModel, number>;
    const operationDistribution: Record<string, number> = {};
    
    for (const userKey of userKeys) {
      const userId = userKey.split(':')[2];
      const monthlyData = await redis.hgetall(userKey);
      
      let userCost = 0;
      let userTokens = 0;
      
      for (const [key, value] of Object.entries(monthlyData)) {
        if (key.endsWith('_tokens')) {
          const model = key.replace('_tokens', '') as AIModel;
          const tokens = Number(value);
          userTokens += tokens;
          totalTokens += tokens;
        } else {
          const model = key as AIModel;
          const cost = Number(value);
          userCost += cost;
          totalCost += cost;
          
          modelDistribution[model] = (modelDistribution[model] || 0) + cost;
        }
      }
      
      if (userCost > 0) {
        userCosts.push({ userId, cost: userCost, tokens: userTokens });
      }
    }
    
    // Get operation distribution from recent daily data
    const today = new Date().toISOString().split('T')[0];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      for (const userKey of userKeys) {
        const userId = userKey.split(':')[2];
        const dailyKey = `ai:cost:${userId}:${dateStr}`;
        const dailyData = await redis.lrange(dailyKey, 0, -1);
        
        for (const item of dailyData) {
          try {
            const parsed = JSON.parse(item);
            totalRequests++;
            operationDistribution[parsed.operation] = (operationDistribution[parsed.operation] || 0) + 1;
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
    }
    
    const totalUsers = userCosts.length;
    const averageCostPerUser = totalUsers > 0 ? totalCost / totalUsers : 0;
    const topUsers = userCosts.sort((a, b) => b.cost - a.cost).slice(0, 10);
    
    return {
      totalUsers,
      totalCost,
      totalTokens,
      totalRequests,
      averageCostPerUser,
      topUsers,
      modelDistribution,
      operationDistribution,
    };
    
  } catch (error) {
    console.error('Usage analytics error:', error);
    return {
      totalUsers: 0,
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      averageCostPerUser: 0,
      topUsers: [],
      modelDistribution: {} as Record<AIModel, number>,
      operationDistribution: {},
    };
  }
}