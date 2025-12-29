import { 
  getUserCredits, 
  checkUserQuota, 
  updateUserCredits, 
  incrementUsage,
  getUserUsage,
  checkRateLimit,
  isUserSuspended,
  type UserCredits 
} from '@/lib/rate-limiting/quota';
import { PLAN_QUOTAS, type UserPlan, type QuotaType } from '@/lib/rate-limiting/quota-constants';
import { redis, CACHE_KEYS } from '@/lib/redis/client';

export interface QuotaCheckResult {
  allowed: boolean;
  usage: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  plan: UserPlan;
  message?: string;
}

export interface UsageTrackingData {
  userId: string;
  quotaType: QuotaType;
  amount: number;
  metadata?: {
    projectId?: string;
    operation?: string;
    model?: string;
    tokens?: number;
    cost?: number;
  };
}

/**
 * Comprehensive quota manager for handling user limits and usage tracking
 */
export class QuotaManager {
  /**
   * Check if user can perform an action based on quota limits
   */
  static async checkQuota(
    userId: string,
    quotaType: QuotaType,
    requestedAmount: number = 1
  ): Promise<QuotaCheckResult> {
    try {
      const result = await checkUserQuota(userId, quotaType, requestedAmount);
      
      return {
        allowed: result.allowed,
        usage: result.usage,
        limit: result.limit,
        remaining: result.remaining,
        resetDate: result.resetDate,
        plan: result.plan,
        message: result.allowed ? undefined : this.getQuotaExceededMessage(quotaType, result),
      };
    } catch (error) {
      console.error('Quota check error:', error);
      return {
        allowed: false,
        usage: 0,
        limit: 0,
        remaining: 0,
        resetDate: new Date(),
        plan: 'free',
        message: 'Unable to check quota limits',
      };
    }
  }

  /**
   * Track usage and update quotas after an operation
   */
  static async trackUsage(data: UsageTrackingData): Promise<void> {
    try {
      const { userId, quotaType, amount, metadata } = data;
      
      // Increment usage in Redis for fast access
      await incrementUsage(userId, quotaType, amount);
      
      // Update database for persistent tracking
      if (quotaType === 'tokensPerMonth' && metadata?.tokens) {
        await updateUserCredits(userId, metadata.tokens);
      }
      
      if (quotaType === 'projects') {
        await updateUserCredits(userId, 0, amount);
      }
      
      // Log usage analytics if cost information is available
      if (metadata?.cost && metadata.cost > 0) {
        await this.logUsageAnalytics(userId, {
          operation_type: metadata.operation || quotaType,
          tokens_used: metadata.tokens || 0,
          cost_usd: metadata.cost,
          model_used: metadata.model || 'unknown',
          project_id: metadata.projectId,
        });
      }
      
      // Invalidate user quota cache to ensure fresh data on next check
      await redis.del(CACHE_KEYS.USER_QUOTA(userId));
      
    } catch (error) {
      console.error('Usage tracking error:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Get comprehensive user quota information
   */
  static async getUserQuotaInfo(userId: string): Promise<UserCredits | null> {
    try {
      return await getUserCredits(userId);
    } catch (error) {
      console.error('Error fetching user quota info:', error);
      return null;
    }
  }

  /**
   * Check rate limiting for API calls
   */
  static async checkRateLimit(
    userId: string,
    endpoint?: string,
    windowSeconds: number = 60,
    maxRequests: number = 10
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
    isAbusive?: boolean;
  }> {
    try {
      // Check if user is suspended
      const suspended = await isUserSuspended(userId);
      if (suspended) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          retryAfter: Math.floor(Date.now() / 1000) + 3600,
          isAbusive: true,
        };
      }

      return await checkRateLimit(userId, windowSeconds, maxRequests, endpoint);
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Allow request on error to avoid blocking legitimate users
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: Math.floor(Date.now() / 1000) + windowSeconds,
      };
    }
  }

  /**
   * Get usage statistics for a user
   */
  static async getUserUsageStats(userId: string): Promise<{
    daily: Record<QuotaType, number>;
    monthly: Record<QuotaType, number>;
    plan: UserPlan;
    limits: Record<QuotaType, number>;
  }> {
    try {
      const credits = await getUserCredits(userId);
      const planLimits = PLAN_QUOTAS[credits.plan];
      
      // Get current usage from Redis
      const [
        contentUsage,
        apiUsage,
        projectsUsage,
        tokensUsage,
        costUsage,
      ] = await Promise.all([
        getUserUsage(userId, 'contentGeneration'),
        getUserUsage(userId, 'apiCalls'),
        getUserUsage(userId, 'projects'),
        getUserUsage(userId, 'tokensPerMonth'),
        getUserUsage(userId, 'costLimitUsd'),
      ]);

      return {
        daily: {
          contentGeneration: contentUsage,
          apiCalls: apiUsage,
          projects: projectsUsage,
          tokensPerMonth: tokensUsage,
          costLimitUsd: costUsage,
        },
        monthly: {
          contentGeneration: credits.projectsUsed, // Projects are monthly
          apiCalls: apiUsage, // API calls are daily
          projects: credits.projectsUsed,
          tokensPerMonth: credits.tokensUsed,
          costLimitUsd: credits.costUsedUsd,
        },
        plan: credits.plan,
        limits: planLimits,
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      return {
        daily: { contentGeneration: 0, apiCalls: 0, projects: 0, tokensPerMonth: 0, costLimitUsd: 0 },
        monthly: { contentGeneration: 0, apiCalls: 0, projects: 0, tokensPerMonth: 0, costLimitUsd: 0 },
        plan: 'free',
        limits: PLAN_QUOTAS.free,
      };
    }
  }

  /**
   * Reset user quotas (for testing or admin purposes)
   */
  static async resetUserQuotas(userId: string): Promise<void> {
    try {
      // Clear Redis cache
      const pattern = `user:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      // Reset database counters
      const { createRouteClient } = await import('@/lib/supabase/server');
      const supabase = await createRouteClient();
      
      await supabase
        .from('user_profiles')
        .update({
          tokens_used: 0,
          projects_used: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
        
    } catch (error) {
      console.error('Error resetting user quotas:', error);
      throw new Error('Failed to reset user quotas');
    }
  }

  /**
   * Upgrade user plan
   */
  static async upgradeUserPlan(userId: string, newPlan: UserPlan): Promise<void> {
    try {
      const { createRouteClient } = await import('@/lib/supabase/server');
      const supabase = await createRouteClient();
      
      await supabase
        .from('user_profiles')
        .update({
          subscription_plan: newPlan,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      
      // Clear cache to force refresh
      await redis.del(CACHE_KEYS.USER_QUOTA(userId));
      await redis.del(`${CACHE_KEYS.USER_PROFILE(userId)}:plan`);
      
    } catch (error) {
      console.error('Error upgrading user plan:', error);
      throw new Error('Failed to upgrade user plan');
    }
  }

  /**
   * Get quota exceeded message
   */
  private static getQuotaExceededMessage(quotaType: QuotaType, result: any): string {
    const { plan, limit, usage, resetDate } = result;
    const resetDateStr = new Date(resetDate).toLocaleDateString();
    
    switch (quotaType) {
      case 'contentGeneration':
        return `Content generation limit exceeded. You've used ${usage}/${limit} generations on the ${plan} plan. Resets on ${resetDateStr}.`;
      
      case 'apiCalls':
        return `API call limit exceeded. You've made ${usage}/${limit} calls today on the ${plan} plan. Resets tomorrow.`;
      
      case 'projects':
        return `Project limit exceeded. You have ${usage}/${limit} projects on the ${plan} plan. Upgrade to create more projects.`;
      
      case 'tokensPerMonth':
        return `Token limit exceeded. You've used ${usage}/${limit} tokens this month on the ${plan} plan. Resets on ${resetDateStr}.`;
      
      case 'costLimitUsd':
        return `Cost limit exceeded. You've spent $${usage.toFixed(2)}/$${limit} this month on the ${plan} plan. Resets on ${resetDateStr}.`;
      
      default:
        return `Quota exceeded for ${quotaType}. Usage: ${usage}/${limit}. Plan: ${plan}.`;
    }
  }

  /**
   * Log usage analytics to database
   */
  private static async logUsageAnalytics(userId: string, data: {
    operation_type: string;
    tokens_used: number;
    cost_usd: number;
    model_used: string;
    project_id?: string;
  }): Promise<void> {
    try {
      const { createRouteClient } = await import('@/lib/supabase/server');
      const supabase = await createRouteClient();
      
      await supabase
        .from('usage_analytics')
        .insert({
          user_id: userId,
          project_id: data.project_id,
          operation_type: data.operation_type,
          tokens_used: data.tokens_used,
          cost_usd: data.cost_usd,
          api_provider: 'openai', // Default to OpenAI for now
          model_used: data.model_used,
          created_at: new Date().toISOString(),
        });
        
    } catch (error) {
      console.error('Error logging usage analytics:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }
}

// Convenience functions for common operations
export const checkContentGenerationQuota = (userId: string) => 
  QuotaManager.checkQuota(userId, 'contentGeneration');

export const checkProjectQuota = (userId: string) => 
  QuotaManager.checkQuota(userId, 'projects');

export const checkTokenQuota = (userId: string, tokens: number) => 
  QuotaManager.checkQuota(userId, 'tokensPerMonth', tokens);

export const checkCostQuota = (userId: string, cost: number) => 
  QuotaManager.checkQuota(userId, 'costLimitUsd', cost);

export const trackContentGeneration = (userId: string, projectId?: string) =>
  QuotaManager.trackUsage({
    userId,
    quotaType: 'contentGeneration',
    amount: 1,
    metadata: { projectId, operation: 'content_generation' },
  });

export const trackTokenUsage = (userId: string, tokens: number, cost: number, model: string, projectId?: string) =>
  QuotaManager.trackUsage({
    userId,
    quotaType: 'tokensPerMonth',
    amount: tokens,
    metadata: { tokens, cost, model, projectId, operation: 'ai_generation' },
  });

export const trackProjectCreation = (userId: string, projectId: string) =>
  QuotaManager.trackUsage({
    userId,
    quotaType: 'projects',
    amount: 1,
    metadata: { projectId, operation: 'project_creation' },
  });

export const trackApiCall = (userId: string, endpoint: string) =>
  QuotaManager.trackUsage({
    userId,
    quotaType: 'apiCalls',
    amount: 1,
    metadata: { operation: endpoint },
  });