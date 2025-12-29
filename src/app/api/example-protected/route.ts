import { NextRequest, NextResponse } from 'next/server';
import { withRateLimitAndQuota } from '@/lib/middleware/rate-limit';
import { QuotaManager, trackApiCall } from '@/lib/utils/quota-manager';

export async function GET(request: NextRequest) {
  // Apply rate limiting and quota checking
  const result = await withRateLimitAndQuota(
    request,
    {
      windowSeconds: 60,
      maxRequests: 10,
      endpoint: 'example-protected',
      globalLimit: {
        windowSeconds: 300,
        maxRequests: 1000,
      },
    },
    {
      quotaType: 'apiCalls',
      requestedAmount: 1,
    }
  );

  // Check if rate limit or quota was exceeded
  if (result instanceof NextResponse) {
    return result;
  }

  const { user, rateLimitHeaders } = result;
  const quotaInfo = 'quotaInfo' in result ? result.quotaInfo : null;

  try {
    // Simulate some work
    const data = {
      message: 'This is a protected endpoint with rate limiting and quota checking',
      user: {
        id: user.id,
        email: user.email,
      },
      quota: quotaInfo ? {
        usage: quotaInfo.usage,
        limit: quotaInfo.limit,
        remaining: quotaInfo.remaining,
        plan: quotaInfo.plan,
      } : null,
      timestamp: new Date().toISOString(),
    };

    // Track the API call usage
    await trackApiCall(user.id, 'example-protected');

    // Return response with rate limit headers
    const response = NextResponse.json(data);
    
    // Add rate limit headers
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add quota headers if available
    if (quotaInfo) {
      response.headers.set('X-Quota-Usage', quotaInfo.usage.toString());
      response.headers.set('X-Quota-Limit', quotaInfo.limit.toString());
      response.headers.set('X-Quota-Remaining', quotaInfo.remaining.toString());
      response.headers.set('X-User-Plan', quotaInfo.plan);
    }

    return response;
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Apply stricter rate limiting for POST requests
  const result = await withRateLimitAndQuota(
    request,
    {
      windowSeconds: 60,
      maxRequests: 5, // Stricter limit for POST
      endpoint: 'example-protected-post',
    },
    {
      quotaType: 'contentGeneration',
      requestedAmount: 1,
    }
  );

  if (result instanceof NextResponse) {
    return result;
  }

  const { user, rateLimitHeaders } = result;
  const quotaInfo = 'quotaInfo' in result ? result.quotaInfo : null;

  try {
    const body = await request.json();
    
    // Validate request body
    if (!body.action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    // Check if user can perform this specific operation
    const canPerform = await QuotaManager.checkQuota(user.id, 'contentGeneration', 1);
    
    if (!canPerform.allowed) {
      return NextResponse.json(
        { 
          error: canPerform.message || 'Quota exceeded',
          quota: {
            usage: canPerform.usage,
            limit: canPerform.limit,
            remaining: canPerform.remaining,
            plan: canPerform.plan,
          }
        },
        { status: 429 }
      );
    }

    // Simulate processing
    const result = {
      message: `Action '${body.action}' processed successfully`,
      user: {
        id: user.id,
        email: user.email,
      },
      quota: {
        usage: canPerform.usage + 1, // After this operation
        limit: canPerform.limit,
        remaining: canPerform.remaining - 1,
        plan: canPerform.plan,
      },
      timestamp: new Date().toISOString(),
    };

    // Track usage after successful operation
    await QuotaManager.trackUsage({
      userId: user.id,
      quotaType: 'contentGeneration',
      amount: 1,
      metadata: {
        operation: 'example-action',
        projectId: body.projectId,
      },
    });

    const response = NextResponse.json(result);
    
    // Add headers
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}