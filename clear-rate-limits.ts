#!/usr/bin/env tsx

/**
 * Clear all rate limits to fix the double-blocking issue
 * Run this when you're stuck with both Redis rate limits and Google quota limits
 */

import { redis } from './src/lib/redis/client';

async function clearAllRateLimits() {
  console.log('🧹 Clearing all rate limits...');

  try {
    // Clear all rate limit keys
    const rateLimitKeys = await redis.keys('rate_limit:*');
    console.log(`Found ${rateLimitKeys.length} rate limit keys`);

    if (rateLimitKeys.length > 0) {
      await redis.del(...rateLimitKeys);
      console.log('✅ Cleared Redis rate limit keys');
    }

    // Clear AI status keys
    const aiStatusKeys = await redis.keys('ai:*:status');
    console.log(`Found ${aiStatusKeys.length} AI status keys`);

    if (aiStatusKeys.length > 0) {
      await redis.del(...aiStatusKeys);
      console.log('✅ Cleared AI status keys');
    }

    // Clear quota keys
    const quotaKeys = await redis.keys('quota:*');
    console.log(`Found ${quotaKeys.length} quota keys`);

    if (quotaKeys.length > 0) {
      await redis.del(...quotaKeys);
      console.log('✅ Cleared quota keys');
    }

    // Clear circuit breaker keys
    const circuitKeys = await redis.keys('circuit:*');
    console.log(`Found ${circuitKeys.length} circuit breaker keys`);

    if (circuitKeys.length > 0) {
      await redis.del(...circuitKeys);
      console.log('✅ Cleared circuit breaker keys');
    }

    console.log('🎉 All rate limits cleared! You can now retry your requests.');

  } catch (error) {
    console.error('❌ Error clearing rate limits:', error);
  }
}

// Run if called directly
if (require.main === module) {
  clearAllRateLimits();
}

export { clearAllRateLimits };