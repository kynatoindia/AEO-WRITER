import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis/client';

export async function POST(request: NextRequest) {
  try {
    console.log('Clearing all rate limit keys...');
    
    // Get all rate limit keys
    const rateLimitKeys = await redis.keys('rate_limit:*');
    const abuseKeys = await redis.keys('*:abuse_score');
    const suspendedKeys = await redis.keys('*:suspended');
    const usageKeys = await redis.keys('*:usage:*');
    
    const allKeys = [...rateLimitKeys, ...abuseKeys, ...suspendedKeys, ...usageKeys];
    
    console.log(`Found ${allKeys.length} keys to clear:`, allKeys.slice(0, 10)); // Show first 10
    
    if (allKeys.length > 0) {
      // Delete all rate limiting keys
      await redis.del(...allKeys);
      console.log(`Cleared ${allKeys.length} rate limit keys`);
    }
    
    // Also clear any global rate limits
    const globalKeys = await redis.keys('rate_limit:global:*');
    if (globalKeys.length > 0) {
      await redis.del(...globalKeys);
      console.log(`Cleared ${globalKeys.length} global rate limit keys`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'All rate limits cleared successfully',
      clearedKeys: {
        rateLimitKeys: rateLimitKeys.length,
        abuseKeys: abuseKeys.length,
        suspendedKeys: suspendedKeys.length,
        usageKeys: usageKeys.length,
        globalKeys: globalKeys.length,
        total: allKeys.length + globalKeys.length
      },
      instructions: [
        'All rate limits have been cleared',
        'You can now make requests without rate limiting',
        'Rate limits will gradually rebuild as you make new requests',
        'Consider increasing limits for development in the middleware'
      ]
    });
    
  } catch (error) {
    console.error('Failed to clear rate limits:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}