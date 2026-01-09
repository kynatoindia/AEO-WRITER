import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis/client';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Redis connection...');
    console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL);
    console.log('UPSTASH_REDIS_REST_TOKEN exists:', !!process.env.UPSTASH_REDIS_REST_TOKEN);
    
    // Test 1: Simple ping
    console.log('Step 1: Ping test');
    const pingStart = Date.now();
    const pingResult = await redis.ping();
    const pingLatency = Date.now() - pingStart;
    console.log('Ping result:', pingResult, 'Latency:', pingLatency + 'ms');
    
    // Test 2: Set a test value
    console.log('Step 2: Set test value');
    const setStart = Date.now();
    const testKey = `test:${Date.now()}`;
    const testValue = { message: 'Redis connection test', timestamp: new Date().toISOString() };
    await redis.set(testKey, testValue, { ex: 60 }); // Expire in 60 seconds
    const setLatency = Date.now() - setStart;
    console.log('Set operation completed in:', setLatency + 'ms');
    
    // Test 3: Get the test value back
    console.log('Step 3: Get test value');
    const getStart = Date.now();
    const retrievedValue = await redis.get(testKey);
    const getLatency = Date.now() - getStart;
    console.log('Get operation completed in:', getLatency + 'ms');
    console.log('Retrieved value:', retrievedValue);
    
    // Test 4: Delete the test value
    console.log('Step 4: Delete test value');
    const delStart = Date.now();
    const deleteResult = await redis.del(testKey);
    const delLatency = Date.now() - delStart;
    console.log('Delete operation completed in:', delLatency + 'ms', 'Result:', deleteResult);
    
    return NextResponse.json({
      success: true,
      tests: {
        ping: { result: pingResult, latency: pingLatency },
        set: { latency: setLatency },
        get: { value: retrievedValue, latency: getLatency },
        delete: { result: deleteResult, latency: delLatency }
      },
      config: {
        url: process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
      }
    });
    
  } catch (error) {
    console.error('Redis test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError'
      },
      config: {
        url: process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
      }
    }, { status: 500 });
  }
}