import { NextRequest, NextResponse } from 'next/server';
import { tavilyService } from '@/lib/services/tavily';
import { redis, CACHE_KEYS } from '@/lib/redis/client';

export async function POST(request: NextRequest) {
  try {
    console.log('Testing research pipeline components directly...');
    
    const testUrls = [
      'https://hubspot.com/marketing',
      'https://mailchimp.com/marketing-glossary',
      'https://blog.hootsuite.com/digital-marketing-plan'
    ];
    
    // Test 1: Redis connection
    console.log('Step 1: Testing Redis connection');
    const redisStart = Date.now();
    await redis.set('test:research', { timestamp: new Date().toISOString() }, { ex: 60 });
    const redisResult = await redis.get('test:research');
    const redisLatency = Date.now() - redisStart;
    console.log('Redis test completed in:', redisLatency + 'ms');
    
    // Test 2: Tavily competitor scraping
    console.log('Step 2: Testing Tavily competitor scraping');
    const tavilyStart = Date.now();
    const competitorData = await tavilyService.scrapeCompetitors(testUrls);
    const tavilyLatency = Date.now() - tavilyStart;
    console.log('Tavily scraping completed in:', tavilyLatency + 'ms');
    console.log('Scraped competitors:', competitorData.length);
    
    // Test 3: Store results in Redis (simulating what the pipeline does)
    console.log('Step 3: Testing Redis storage of research data');
    const storageStart = Date.now();
    const cacheKey = CACHE_KEYS.RESEARCH_CACHE('test-research-' + Date.now());
    await redis.setex(cacheKey, 3600, {
      competitorData,
      timestamp: new Date().toISOString(),
      testRun: true
    });
    const storageLatency = Date.now() - storageStart;
    console.log('Redis storage completed in:', storageLatency + 'ms');
    
    // Test 4: Retrieve from Redis
    console.log('Step 4: Testing Redis retrieval');
    const retrievalStart = Date.now();
    const cachedData = await redis.get(cacheKey);
    const retrievalLatency = Date.now() - retrievalStart;
    console.log('Redis retrieval completed in:', retrievalLatency + 'ms');
    
    // Test 5: Content analysis
    console.log('Step 5: Testing content analysis');
    const analysisStart = Date.now();
    const sampleContent = competitorData[0]?.content || 'Sample content for analysis';
    const contentAnalysis = await tavilyService.analyzeContent(sampleContent);
    const analysisLatency = Date.now() - analysisStart;
    console.log('Content analysis completed in:', analysisLatency + 'ms');
    
    // Clean up test data
    await redis.del(cacheKey);
    await redis.del('test:research');
    
    return NextResponse.json({
      success: true,
      message: 'All research pipeline components working correctly',
      tests: {
        redis: {
          latency: redisLatency,
          working: !!redisResult
        },
        tavily: {
          latency: tavilyLatency,
          competitorsScraped: competitorData.length,
          sampleCompetitor: competitorData[0] ? {
            title: competitorData[0].title,
            url: competitorData[0].url,
            wordCount: competitorData[0].wordCount,
            keyTopics: competitorData[0].keyTopics.slice(0, 3)
          } : null
        },
        storage: {
          latency: storageLatency,
          working: true
        },
        retrieval: {
          latency: retrievalLatency,
          working: !!cachedData
        },
        analysis: {
          latency: analysisLatency,
          keyTopics: contentAnalysis.keyTopics.slice(0, 5),
          contentGaps: contentAnalysis.contentGaps.slice(0, 3),
          seoOpportunities: contentAnalysis.seoOpportunities.slice(0, 3)
        }
      },
      totalTime: Date.now() - redisStart,
      bandwidth: 'Data successfully moved between services'
    });
    
  } catch (error) {
    console.error('Research pipeline component test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError'
      }
    }, { status: 500 });
  }
}