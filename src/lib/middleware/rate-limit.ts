import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, checkUserQuota, isUserSuspended, checkGlobalRateLimit, getUserPlan } from '@/lib/rate-limiting/quota';
import { createRouteClient } from '@/lib/supabase/server';

export interface RateLimitOptions {
  windowSeconds?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
  endpoint?: string;
  globalLimit?: {
    windowSeconds: number;
    maxRequests: number;
  };
}

export interface QuotaCheckOptions {
  quotaType: 'contentGeneration' | 'apiCalls' | 'projects' | 'tokensPerMonth' | 'costLimitUsd';
  requestedAmount?: number;
  skipQuotaCheck?: boolean;
}

// Enhanced rate limiting middleware with abuse prevention
export async function withRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
) {
  const {
    windowSeconds = 60,
    maxRequests = process.env.NODE_ENV === 'development' ? 100 : 10, // Much higher for dev
    endpoint,
    globalLimit,
  } = options;

  // Skip rate limiting entirely for localhost in development
  if (process.env.NODE_ENV === 'development') {
    const host = request.headers.get('host');
    if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
      console.log('Skipping rate limit for localhost in development');
      
      // Still get user for consistency
      const supabase = await createRouteClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      return {
        user,
        rateLimitHeaders: {
          'X-RateLimit-Limit': '999999',
          'X-RateLimit-Remaining': '999999',
          'X-RateLimit-Reset': (Date.now() + 3600000).toString(),
        },
      };
    }
  }

  try {
    // Get user from session
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is suspended due to abuse
    const suspended = await isUserSuspended(user.id);
    if (suspended) {
      return NextResponse.json(
        {
          error: 'Account temporarily suspended due to excessive requests',
          retryAfter: 3600, // 1 hour
        },
        {
          status: 429,
          headers: {
            'Retry-After': '3600',
          },
        }
      );
    }

    // Check global rate limit first (if configured)
    if (globalLimit && endpoint) {
      const globalResult = await checkGlobalRateLimit(
        endpoint,
        globalLimit.windowSeconds,
        globalLimit.maxRequests
      );

      if (!globalResult.allowed) {
        return NextResponse.json(
          {
            error: 'Service temporarily unavailable due to high demand',
            retryAfter: globalResult.resetTime,
          },
          {
            status: 503,
            headers: {
              'Retry-After': globalResult.resetTime.toString(),
            },
          }
        );
      }
    }

    // Check user-specific rate limit
    const rateLimitResult = await checkRateLimit(
      user.id,
      windowSeconds,
      maxRequests,
      endpoint
    );

    if (!rateLimitResult.allowed) {
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        'Retry-After': (rateLimitResult.retryAfter || rateLimitResult.resetTime).toString(),
      };

      // Add abuse warning header
      if (rateLimitResult.isAbusive) {
        headers['X-Abuse-Warning'] = 'Excessive requests detected';
      }

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter || rateLimitResult.resetTime,
          isAbusive: rateLimitResult.isAbusive,
        },
        {
          status: 429,
          headers,
        }
      );
    }

    return {
      user,
      rateLimitHeaders: {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
      },
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Enhanced quota checking middleware
export async function withQuotaCheck(
  userId: string,
  options: QuotaCheckOptions
) {
  const { quotaType, requestedAmount = 1, skipQuotaCheck = false } = options;

  if (skipQuotaCheck) {
    return { quotaInfo: null };
  }

  try {
    const quotaResult = await checkUserQuota(userId, quotaType, requestedAmount);

    if (!quotaResult.allowed) {
      const errorMessage = getQuotaErrorMessage(quotaType, quotaResult);
      
      return NextResponse.json(
        {
          error: errorMessage,
          usage: quotaResult.usage,
          limit: quotaResult.limit,
          remaining: quotaResult.remaining,
          resetDate: quotaResult.resetDate.toISOString(),
          quotaType,
          plan: quotaResult.plan,
        },
        { 
          status: 429,
          headers: {
            'X-Quota-Limit': quotaResult.limit.toString(),
            'X-Quota-Remaining': quotaResult.remaining.toString(),
            'X-Quota-Reset': quotaResult.resetDate.toISOString(),
          }
        }
      );
    }

    return {
      quotaInfo: quotaResult,
    };
  } catch (error) {
    console.error('Quota checking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Combined middleware for both rate limiting and quota checking
export async function withRateLimitAndQuota(
  request: NextRequest,
  rateLimitOptions: RateLimitOptions = {},
  quotaOptions?: QuotaCheckOptions
) {
  // First check rate limiting
  const rateLimitResult = await withRateLimit(request, rateLimitOptions);
  
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult; // Rate limit exceeded
  }

  // Then check quota if specified
  if (quotaOptions) {
    const quotaResult = await withQuotaCheck(rateLimitResult.user.id, quotaOptions);
    
    if (quotaResult instanceof NextResponse) {
      return quotaResult; // Quota exceeded
    }

    return {
      ...rateLimitResult,
      quotaInfo: quotaResult.quotaInfo,
    };
  }

  return rateLimitResult;
}

// Pre-request quota validation middleware
export async function withPreRequestQuotaValidation(
  request: NextRequest,
  quotaType: QuotaCheckOptions['quotaType'],
  requestedAmount: number = 1
) {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user plan for dynamic rate limiting
    const userPlan = await getUserPlan(user.id);
    
    // Apply stricter rate limits for free users (but lenient in development)
    const rateLimits = process.env.NODE_ENV === 'development' ? {
      free: { windowSeconds: 60, maxRequests: 100 },
      pro: { windowSeconds: 60, maxRequests: 200 },
      enterprise: { windowSeconds: 60, maxRequests: 500 },
    } : {
      free: { windowSeconds: 60, maxRequests: 5 },
      pro: { windowSeconds: 60, maxRequests: 20 },
      enterprise: { windowSeconds: 60, maxRequests: 100 },
    };
    
    const { windowSeconds, maxRequests } = rateLimits[userPlan];
    
    // Check both rate limit and quota
    const result = await withRateLimitAndQuota(
      request,
      { 
        windowSeconds, 
        maxRequests,
        endpoint: request.nextUrl.pathname,
        globalLimit: {
          windowSeconds: 300,
          maxRequests: 1000,
        }
      },
      { 
        quotaType, 
        requestedAmount 
      }
    );

    return result;
  } catch (error) {
    console.error('Pre-request validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate appropriate error messages
function getQuotaErrorMessage(quotaType: string, quotaResult: any): string {
  const { plan, limit, usage, resetDate } = quotaResult;
  
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
      return `Cost limit exceeded. You've spent ${usage.toFixed(2)}/${limit} this month on the ${plan} plan. Resets on ${resetDateStr}.`;
    
    default:
      return `Quota exceeded for ${quotaType}. Usage: ${usage}/${limit}. Plan: ${plan}.`;
  }
}