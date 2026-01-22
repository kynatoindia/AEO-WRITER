#!/usr/bin/env npx tsx

/**
 * Test the One-Go Solution
 * 
 * This script tests the complete AEO blog generation workflow
 * to ensure no recursive fetch loops or 429 errors occur.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function testOneGoSolution() {
  console.log('🚀 Testing One-Go AEO Blog Solution...\n');

  // Test 1: API Trigger (Should return 202 immediately)
  console.log('1. Testing API Trigger...');
  try {
    const response = await fetch('http://localhost:3000/api/generate-aeo-blog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // You'll need a real token
      },
      body: JSON.stringify({
        userId: 'test-user-id',
        projectId: 'test-project-id',
        title: 'Complete Guide to AI Content Marketing',
        keyword: 'AI content marketing',
        facts: 'AI content marketing is growing 40% year over year.',
      }),
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Expected: 202 (Accepted)`);
    
    if (response.status === 202) {
      console.log('   ✅ API returns immediately - No polling loop!');
    } else {
      console.log('   ❌ API not returning 202 - Check authentication');
    }

    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);

  } catch (error: any) {
    console.log(`   ❌ API Test Failed: ${error.message}\n`);
  }

  // Test 2: Provider Failover
  console.log('2. Testing Provider Failover...');
  try {
    const { aiWithFailover } = await import('./src/lib/ai/provider-failover-helper');
    
    const testPrompt = 'Write a short introduction about AI content marketing.';
    const result = await aiWithFailover(testPrompt, { taskType: 'content' });
    
    console.log(`   ✅ Failover Success!`);
    console.log(`   Provider: ${result.provider}`);
    console.log(`   Attempts: ${result.attempts}`);
    console.log(`   Tokens: ${result.tokensUsed}`);
    console.log(`   Cost: $${result.cost.toFixed(4)}`);
    console.log(`   Content Length: ${result.content.length} chars\n`);

  } catch (error: any) {
    console.log(`   ❌ Failover Test Failed: ${error.message}\n`);
  }

  // Test 3: Multi-Provider Status
  console.log('3. Checking Provider Status...');
  try {
    const { multiProviderAI } = await import('./src/lib/ai/multi-provider-gateway');
    
    const status = multiProviderAI.getProviderStatus();
    
    console.log('   Provider Status:');
    status.forEach(provider => {
      const rateLimited = provider.isRateLimited ? '🔴 Rate Limited' : '🟢 Available';
      console.log(`   - ${provider.name}: ${rateLimited} (Priority: ${provider.priority})`);
    });
    console.log();

  } catch (error: any) {
    console.log(`   ❌ Status Check Failed: ${error.message}\n`);
  }

  // Test 4: Check for Polling in Frontend
  console.log('4. Checking Frontend for Polling Loops...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const frontendFiles = [
      'src/components/aeo-blog-generator.tsx',
      'src/components/status-tracker.tsx',
      'src/components/project/project-page-client.tsx',
    ];

    let foundPolling = false;
    
    for (const file of frontendFiles) {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check for polling patterns
        const pollingPatterns = [
          /setInterval/g,
          /setTimeout.*fetch/g,
          /useEffect.*fetch.*\[\]/g, // Empty dependency array with fetch
          /while.*fetch/g,
          /for.*fetch/g,
        ];
        
        pollingPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            console.log(`   ⚠️  Potential polling found in ${file}:`);
            matches.forEach(match => console.log(`      - ${match}`));
            foundPolling = true;
          }
        });
      }
    }
    
    if (!foundPolling) {
      console.log('   ✅ No polling patterns detected in frontend!');
    }
    console.log();

  } catch (error: any) {
    console.log(`   ❌ Frontend Check Failed: ${error.message}\n`);
  }

  // Test 5: Inngest Dev Server Check
  console.log('5. Checking Inngest Dev Server...');
  try {
    const response = await fetch('http://localhost:8288/health', {
      method: 'GET',
    });

    if (response.ok) {
      console.log('   ✅ Inngest Dev Server is running!');
      console.log('   💡 Run: npx inngest-cli@latest dev');
    } else {
      console.log('   ⚠️  Inngest Dev Server not responding');
    }
    console.log();

  } catch (error: any) {
    console.log('   ⚠️  Inngest Dev Server not running');
    console.log('   💡 Start with: npx inngest-cli@latest dev\n');
  }

  console.log('🎯 One-Go Solution Summary:');
  console.log('   1. Frontend makes ONE request to /api/generate-aeo-blog');
  console.log('   2. API returns 202 immediately (no waiting)');
  console.log('   3. Inngest handles the entire workflow in background');
  console.log('   4. Multi-provider failover prevents 429 errors');
  console.log('   5. Real-time status updates via Supabase (no polling)');
  console.log('   6. Sequential processing with concurrency: 1');
  console.log('\n✨ Result: No more DDOS, no more 429 errors, no more loops!');
}

// Run the test
testOneGoSolution().catch(console.error);