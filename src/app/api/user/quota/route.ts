import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { getUserCredits, checkUserQuota } from '@/lib/rate-limiting/quota';
import { PLAN_QUOTAS } from '@/lib/rate-limiting/quota-constants';

export async function GET() {
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

    // Get comprehensive user credits and usage
    const credits = await getUserCredits(user.id);
    
    // Get detailed quota status for each type
    const [contentQuota, apiQuota, projectsQuota, tokensQuota, costQuota] = await Promise.all([
      checkUserQuota(user.id, 'contentGeneration'),
      checkUserQuota(user.id, 'apiCalls'),
      checkUserQuota(user.id, 'projects'),
      checkUserQuota(user.id, 'tokensPerMonth'),
      checkUserQuota(user.id, 'costLimitUsd'),
    ]);

    return NextResponse.json({
      plan: credits.plan,
      resetDate: credits.resetDate.toISOString(),
      quotas: {
        contentGeneration: {
          used: contentQuota.usage,
          limit: contentQuota.limit,
          remaining: contentQuota.remaining,
          allowed: contentQuota.allowed,
          resetDate: contentQuota.resetDate.toISOString(),
        },
        apiCalls: {
          used: apiQuota.usage,
          limit: apiQuota.limit,
          remaining: apiQuota.remaining,
          allowed: apiQuota.allowed,
          resetDate: apiQuota.resetDate.toISOString(),
        },
        projects: {
          used: projectsQuota.usage,
          limit: projectsQuota.limit,
          remaining: projectsQuota.remaining,
          allowed: projectsQuota.allowed,
          resetDate: projectsQuota.resetDate.toISOString(),
        },
        tokensPerMonth: {
          used: tokensQuota.usage,
          limit: tokensQuota.limit,
          remaining: tokensQuota.remaining,
          allowed: tokensQuota.allowed,
          resetDate: tokensQuota.resetDate.toISOString(),
        },
        costLimitUsd: {
          used: Math.round(costQuota.usage * 100) / 100, // Round to 2 decimal places
          limit: costQuota.limit,
          remaining: Math.round(costQuota.remaining * 100) / 100,
          allowed: costQuota.allowed,
          resetDate: costQuota.resetDate.toISOString(),
        },
      },
      // Additional metadata
      planLimits: PLAN_QUOTAS[credits.plan],
      isNearLimit: {
        contentGeneration: contentQuota.limit > 0 && (contentQuota.usage / contentQuota.limit) >= 0.8,
        apiCalls: apiQuota.limit > 0 && (apiQuota.usage / apiQuota.limit) >= 0.8,
        projects: projectsQuota.limit > 0 && (projectsQuota.usage / projectsQuota.limit) >= 0.8,
        tokensPerMonth: tokensQuota.limit > 0 && (tokensQuota.usage / tokensQuota.limit) >= 0.8,
        costLimitUsd: costQuota.limit > 0 && (costQuota.usage / costQuota.limit) >= 0.8,
      },
    });
  } catch (error) {
    console.error('Quota check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually refresh quota cache
export async function POST() {
  try {
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Clear cache and get fresh data
    const { redis, CACHE_KEYS } = await import('@/lib/redis/client');
    await redis.del(CACHE_KEYS.USER_QUOTA(user.id));
    
    // Get fresh credits
    const credits = await getUserCredits(user.id);
    
    return NextResponse.json({
      message: 'Quota cache refreshed',
      plan: credits.plan,
      resetDate: credits.resetDate.toISOString(),
    });
  } catch (error) {
    console.error('Quota refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}