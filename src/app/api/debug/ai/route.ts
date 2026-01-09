import { NextRequest, NextResponse } from 'next/server';
import { generateAIText } from '@/lib/ai/gateway';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing AI gateway with Gemini...');
    console.log('GOOGLE_AI_API_KEY exists:', !!process.env.GOOGLE_AI_API_KEY);
    console.log('GOOGLE_GENERATIVE_AI_API_KEY exists:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    
    // Test simple text generation
    console.log('Step 1: Testing simple text generation');
    const textStart = Date.now();
    const textResult = await generateAIText(
      'Write a brief 2-sentence summary about digital marketing.',
      'content',
      'test-user'
    );
    const textLatency = Date.now() - textStart;
    console.log('Text generation completed in:', textLatency + 'ms');
    console.log('Model used:', textResult.model);
    console.log('Generated text:', textResult.text.substring(0, 100) + '...');
    
    // Test research-level generation
    console.log('Step 2: Testing research-level generation');
    const researchStart = Date.now();
    const researchResult = await generateAIText(
      'Analyze the key trends in digital marketing for 2024. Provide 3 main insights.',
      'research',
      'test-user'
    );
    const researchLatency = Date.now() - researchStart;
    console.log('Research generation completed in:', researchLatency + 'ms');
    console.log('Model used:', researchResult.model);
    
    return NextResponse.json({
      success: true,
      message: 'AI gateway working correctly with Gemini',
      tests: {
        textGeneration: {
          latency: textLatency,
          model: textResult.model,
          inputTokens: textResult.inputTokens,
          outputTokens: textResult.outputTokens,
          cost: textResult.cost,
          preview: textResult.text.substring(0, 150) + '...'
        },
        researchGeneration: {
          latency: researchLatency,
          model: researchResult.model,
          inputTokens: researchResult.inputTokens,
          outputTokens: researchResult.outputTokens,
          cost: researchResult.cost,
          preview: researchResult.text.substring(0, 150) + '...'
        }
      },
      config: {
        hasGoogleKey: !!(process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        usingGeminiOnly: true
      }
    });
    
  } catch (error) {
    console.error('AI gateway test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      config: {
        hasGoogleKey: !!(process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        usingGeminiOnly: true
      }
    }, { status: 500 });
  }
}