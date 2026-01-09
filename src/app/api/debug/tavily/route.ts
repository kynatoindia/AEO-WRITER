import { NextRequest, NextResponse } from 'next/server';
import { tavilyService } from '@/lib/services/tavily';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Tavily service...');
    console.log('TAVILY_API_KEY exists:', !!process.env.TAVILY_API_KEY);
    console.log('TAVILY_API_KEY value:', process.env.TAVILY_API_KEY ? '[REDACTED]' : 'EMPTY');
    
    // Test 1: Health check
    console.log('Step 1: Health check');
    const healthCheck = await tavilyService.healthCheck();
    console.log('Health check result:', healthCheck);
    
    if (!healthCheck.healthy) {
      return NextResponse.json({
        success: false,
        error: 'Tavily service is not healthy',
        details: healthCheck,
        config: {
          hasApiKey: !!process.env.TAVILY_API_KEY,
          apiKeyLength: process.env.TAVILY_API_KEY?.length || 0
        }
      }, { status: 500 });
    }
    
    // Test 2: Simple search
    console.log('Step 2: Simple search test');
    const searchStart = Date.now();
    const searchResults = await tavilyService.search({
      query: 'test search',
      max_results: 1,
      timeout: 10000
    });
    const searchLatency = Date.now() - searchStart;
    console.log('Search completed in:', searchLatency + 'ms');
    console.log('Search results count:', searchResults.length);
    
    return NextResponse.json({
      success: true,
      tests: {
        healthCheck,
        search: {
          latency: searchLatency,
          resultsCount: searchResults.length,
          firstResult: searchResults[0] ? {
            title: searchResults[0].title,
            url: searchResults[0].url,
            wordCount: searchResults[0].wordCount
          } : null
        }
      },
      config: {
        hasApiKey: !!process.env.TAVILY_API_KEY,
        apiKeyLength: process.env.TAVILY_API_KEY?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Tavily test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError'
      },
      config: {
        hasApiKey: !!process.env.TAVILY_API_KEY,
        apiKeyLength: process.env.TAVILY_API_KEY?.length || 0
      }
    }, { status: 500 });
  }
}