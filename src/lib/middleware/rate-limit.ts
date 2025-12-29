import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, checkQuota } from '@/lib/rate-limiting/quota';
import { createClient } from '@/lib/supabase/server';

export interface RateLimitOptions {
  windowSeconds?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
}

// Rate limiting middleware
export async function withRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
) {
  const {
    windowSeconds = 60,
    maxRequests = 10,
    skipSuccessfulRequests = false,
  } = options;

  try {
    // Get user from session
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(
      user.id,
      windowSeconds,
      maxRequests
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
            'Retry-After': rateLimitResult.resetTime.toString(),
          },
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

// Quota checking middleware
export async function withQuotaCheck(
  userId: string,
  quotaType: 'contentGeneration' | 'apiCalls' | 'projects',
  userPlan: 'free' | 'pro' | 'enterprise' = 'free'
) {
  try {
    const quotaResult = await checkQuota(userId, userPlan, quotaType);

    if (!quotaResult.allowed) {
      return NextResponse.json(
        {
          error: 'Quota exceeded',
          usage: quotaResult.usage,
          limit: quotaResult.limit,
          quotaType,
        },
        { status: 429 }
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