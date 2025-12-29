import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, withQuotaCheck } from '@/lib/middleware/rate-limit';
import { inngest } from '@/lib/inngest/client';
import { incrementUsage } from '@/lib/rate-limiting/quota';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await withRateLimit(request, {
      windowSeconds: 60,
      maxRequests: 10,
    });

    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    const { user, rateLimitHeaders } = rateLimitResult;

    // Parse request body
    const body = await request.json();
    const { projectId, contentType, prompt } = body;

    if (!projectId || !contentType || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check quota (assuming free plan for now - get from DB in production)
    const quotaResult = await withQuotaCheck(user.id, { quotaType: 'contentGeneration' });
    
    if (quotaResult instanceof NextResponse) {
      return quotaResult;
    }

    // Trigger content generation via Inngest
    await inngest.send({
      name: 'content/generate',
      data: {
        userId: user.id,
        projectId,
        contentType,
        prompt,
      },
    });

    // Increment API calls usage
    await incrementUsage(user.id, 'apiCalls');

    return NextResponse.json(
      {
        success: true,
        message: 'Content generation started',
        projectId,
      },
      {
        status: 202,
        headers: rateLimitHeaders,
      }
    );
  } catch (error) {
    console.error('Content generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}