#!/usr/bin/env tsx

/**
 * Test script for multi-provider AI gateway
 * This tests the failover mechanism and rate limiting
 */

import { multiProviderAI } from './src/lib/ai/multi-provider-gateway';

async function testMultiProviderAI() {
  console.log('🧪 Testing Multi-Provider AI Gateway...\n');
  
  // Test 1: Basic content generation
  console.log('📝 Test 1: Basic Content Generation');
  try {
    const result = await multiProviderAI.generateContent('Write a short paragraph about project management.');
    console.log('✅ Success:', result.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  console.log('\n⏱️  Waiting 2 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Research generation (should prefer Gemini)
  console.log('🔍 Test 2: Research Generation');
  try {
    const result = await multiProviderAI.generateResearch('Analyze the current trends in AI-powered content creation tools.');
    console.log('✅ Success:', result.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  console.log('\n⏱️  Waiting 2 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Analysis generation
  console.log('📊 Test 3: Analysis Generation');
  try {
    const result = await multiProviderAI.generateAnalysis('Compare the pros and cons of different project management methodologies.');
    console.log('✅ Success:', result.substring(0, 100) + '...');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  // Test 4: Provider status
  console.log('\n📈 Test 4: Provider Status');
  const status = multiProviderAI.getProviderStatus();
  console.table(status);
  
  // Test 5: Rapid requests to test rate limiting
  console.log('\n🚀 Test 5: Rate Limiting (5 rapid requests)');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      multiProviderAI.generateContent(`Write a brief sentence about topic ${i + 1}.`)
        .then(result => ({ success: true, length: result.length }))
        .catch(error => ({ success: false, error: error.message }))
    );
  }
  
  const results = await Promise.all(promises);
  results.forEach((result, index) => {
    if (result.success) {
      console.log(`✅ Request ${index + 1}: Success (${result.length} chars)`);
    } else {
      console.log(`❌ Request ${index + 1}: Failed - ${result.error}`);
    }
  });
  
  // Final status check
  console.log('\n📊 Final Provider Status:');
  const finalStatus = multiProviderAI.getProviderStatus();
  console.table(finalStatus);
  
  console.log('\n🎉 Multi-Provider AI Gateway test completed!');
}

// Run the test
testMultiProviderAI().catch(console.error);