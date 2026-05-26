import { NextRequest } from 'next/server';
import { streamAIText } from '@/lib/ai/gateway';
import { withRateLimit, withQuotaCheck } from '@/lib/middleware/rate-limit';
import { incrementUsage } from '@/lib/rate-limiting/quota';

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await withRateLimit(request, {
      windowSeconds: 60,
      maxRequests: 20, // Higher limit for chat
    });

    if (rateLimitResult instanceof Response) {
      return rateLimitResult;
    }

    const { user, rateLimitHeaders } = rateLimitResult;

    // Parse request body
    const body = await request.json();
    const { prompt, provider, model, temperature, maxTokens } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check API quota
    const quotaResult = await withQuotaCheck(user.id, { quotaType: 'apiCalls' });
    
    if (quotaResult instanceof Response) {
      return quotaResult;
    }

    // Configure AI settings
    const aiConfig = {
      provider: provider || 'openai',
      model: model || undefined,
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 2000,
    };

    // Stream AI response
    const streamingResponse = await streamAIText(prompt, 'content', user.id);

    // Increment usage after successful generation
    await incrementUsage(user.id, 'apiCalls');

    // Return the AI SDK stream directly
    return streamingResponse.stream.toTextStreamResponse();
  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(
      JSON.stringify({ error: 'AI service unavailable' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}