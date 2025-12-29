import { NextRequest, NextResponse } from 'next/server';
import { 
  generateAIText, 
  streamAIText, 
  generateStructuredOutput,
  checkProviderHealth,
  getUserAIUsage,
  getAvailableProviders,
  getAvailableModels,
  estimateCost
} from '@/lib/ai/gateway';
import { checkUserQuota, estimateOperationCost } from '@/lib/ai/middleware';
import { z } from 'zod';

// Test schema for structured output
const TestSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'info';
    const userId = request.headers.get('x-user-id') || 'test-user';

    switch (action) {
      case 'info':
        return NextResponse.json({
          availableProviders: getAvailableProviders(),
          availableModels: getAvailableModels(),
          providerHealth: await checkProviderHealth(),
        });

      case 'usage':
        const usage = await getUserAIUsage(userId);
        return NextResponse.json(usage);

      case 'estimate':
        const operation = searchParams.get('operation') as 'research' | 'content' | 'blueprint' | 'polish' || 'content';
        const inputLength = parseInt(searchParams.get('inputLength') || '1000');
        const estimation = estimateOperationCost(operation, inputLength);
        return NextResponse.json(estimation);

      case 'quota':
        const estimatedCost = parseFloat(searchParams.get('estimatedCost') || '1.0');
        const estimatedTokens = parseInt(searchParams.get('estimatedTokens') || '1000');
        const quotaCheck = await checkUserQuota(userId, estimatedCost, estimatedTokens);
        return NextResponse.json(quotaCheck);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI test endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, prompt, useCase = 'content', userId = 'test-user', options = {} } = body;

    switch (action) {
      case 'generate':
        const result = await generateAIText(prompt, useCase, userId, options);
        return NextResponse.json(result);

      case 'stream':
        const streamResult = await streamAIText(prompt, useCase, userId, options);
        
        // Convert stream to response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of streamResult.stream.textStream) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });

      case 'structured':
        const { schema } = body;
        if (!schema) {
          return NextResponse.json({ error: 'Schema required for structured output' }, { status: 400 });
        }
        
        const structuredResult = await generateStructuredOutput(
          prompt, 
          TestSchema, // Using test schema for demo
          'structured', 
          userId, 
          options
        );
        return NextResponse.json(structuredResult);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI test endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}