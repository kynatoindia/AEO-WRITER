import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserUsage, checkQuota, PLAN_QUOTAS } from '@/lib/rate-limiting/quota';

export async function GET(request: NextRequest) {
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

    // Get user plan from database (defaulting to free for now)
    const userPlan = 'free'; // TODO: Get from user profile in database

    // Get current usage for all quota types
    const [contentUsage, apiUsage, projectsUsage] = await Promise.all([
      getUserUsage(user.id, 'contentGeneration'),
      getUserUsage(user.id, 'apiCalls'),
      getUserUsage(user.id, 'projects'),
    ]);

    // Get quota limits
    const quotas = PLAN_QUOTAS[userPlan];

    // Check quota status for each type
    const [contentQuota, apiQuota, projectsQuota] = await Promise.all([
      checkQuota(user.id, userPlan, 'contentGeneration'),
      checkQuota(user.id, userPlan, 'apiCalls'),
      checkQuota(user.id, userPlan, 'projects'),
    ]);

    return NextResponse.json({
      plan: userPlan,
      quotas: {
        contentGeneration: {
          used: contentUsage,
          limit: quotas.contentGeneration,
          remaining: quotas.contentGeneration === -1 ? -1 : Math.max(0, quotas.contentGeneration - contentUsage),
          allowed: contentQuota.allowed,
        },
        apiCalls: {
          used: apiUsage,
          limit: quotas.apiCalls,
          remaining: quotas.apiCalls === -1 ? -1 : Math.max(0, quotas.apiCalls - apiUsage),
          allowed: apiQuota.allowed,
        },
        projects: {
          used: projectsUsage,
          limit: quotas.projects,
          remaining: quotas.projects === -1 ? -1 : Math.max(0, quotas.projects - projectsUsage),
          allowed: projectsQuota.allowed,
        },
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