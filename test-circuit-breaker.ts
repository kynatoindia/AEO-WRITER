#!/usr/bin/env tsx

/**
 * Test script to verify the circuit breaker and global concurrency fixes
 * This script tests the 404 circuit breaker functionality
 */

import { generateAIText } from './src/lib/ai/gateway';

async function testCircuitBreaker() {
  console.log('🔧 Testing Circuit Breaker for 404 errors...');
  
  try {
    // This should trigger a 404 and immediately stop retries
    const result = await generateAIText(
      'Test prompt',
      'content',
      'test-user-id',
      { model: 'non-existent-model' as any } // Force a 404
    );
    
    console.log('❌ Circuit breaker failed - should have thrown NonRetriableError');
  } catch (error: any) {
    if (error.name === 'NonRetriableError') {
      console.log('✅ Circuit breaker working - NonRetriableError thrown for 404');
      console.log('   Message:', error.message);
    } else {
      console.log('⚠️  Different error thrown:', error.message);
    }
  }
}

async function testValidModel() {
  console.log('\n🧪 Testing valid model (gemini-2.0-flash)...');
  
  try {
    const result = await generateAIText(
      'Say "OK"',
      'content',
      'test-user-id'
    );
    
    console.log('✅ Valid model test successful');
    console.log('   Model used:', result.model);
    console.log('   Response:', result.text.substring(0, 50));
  } catch (error: any) {
    console.log('❌ Valid model test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Circuit Breaker and Model Tests\n');
  
  await testCircuitBreaker();
  await testValidModel();
  
  console.log('\n✨ Tests completed');
}

if (require.main === module) {
  main().catch(console.error);
}