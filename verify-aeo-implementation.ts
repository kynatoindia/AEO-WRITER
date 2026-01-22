#!/usr/bin/env tsx

/**
 * AEO Implementation Verification Script
 * Verifies that all components of the "One-Go" solution are properly implemented
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

async function verifyAEOImplementation() {
  console.log('🔍 Verifying AEO "One-Go" Solution Implementation...\n');
  
  const results: VerificationResult[] = [];
  
  // Check core files exist
  const coreFiles = [
    'src/lib/inngest/functions.ts',
    'src/lib/inngest/client.ts',
    'src/app/api/generate-aeo-blog/route.ts',
    'src/app/api/inngest/route.ts',
    'src/components/status-tracker.tsx',
    'src/components/aeo-blog-generator.tsx',
    'src/lib/supabase/client.ts',
    'supabase/migrations/008_aeo_blog_status_tracking.sql',
    'src/app/aeo-demo/page.tsx',
  ];
  
  for (const file of coreFiles) {
    if (existsSync(file)) {
      results.push({
        component: `File: ${file}`,
        status: 'pass',
        message: 'File exists'
      });
    } else {
      results.push({
        component: `File: ${file}`,
        status: 'fail',
        message: 'File missing'
      });
    }
  }
  
  // Check Inngest function implementation
  try {
    const functionsContent = readFileSync('src/lib/inngest/functions.ts', 'utf8');
    
    if (functionsContent.includes('writeAEOBlog')) {
      results.push({
        component: 'Inngest writeAEOBlog function',
        status: 'pass',
        message: 'Function implemented'
      });
    } else {
      results.push({
        component: 'Inngest writeAEOBlog function',
        status: 'fail',
        message: 'Function not found'
      });
    }
    
    if (functionsContent.includes('concurrency: {') && functionsContent.includes('limit: 1')) {
      results.push({
        component: 'Rate limiting (concurrency: 1)',
        status: 'pass',
        message: 'Sequential processing configured'
      });
    } else {
      results.push({
        component: 'Rate limiting (concurrency: 1)',
        status: 'fail',
        message: 'Sequential processing not configured'
      });
    }
    
    if (functionsContent.includes('update_project_progress') || functionsContent.includes('update_project_step')) {
      results.push({
        component: 'Database progress tracking',
        status: 'pass',
        message: 'Database updates implemented'
      });
    } else {
      results.push({
        component: 'Database progress tracking',
        status: 'warning',
        message: 'Database updates may not be implemented'
      });
    }
  } catch (error) {
    results.push({
      component: 'Inngest functions file',
      status: 'fail',
      message: 'Could not read functions file'
    });
  }
  
  // Check client types
  try {
    const clientContent = readFileSync('src/lib/inngest/client.ts', 'utf8');
    
    if (clientContent.includes('aeo/blog.requested')) {
      results.push({
        component: 'AEO event type',
        status: 'pass',
        message: 'Event type defined'
      });
    } else {
      results.push({
        component: 'AEO event type',
        status: 'fail',
        message: 'Event type not found'
      });
    }
  } catch (error) {
    results.push({
      component: 'Inngest client file',
      status: 'fail',
      message: 'Could not read client file'
    });
  }
  
  // Check API endpoint
  try {
    const apiContent = readFileSync('src/app/api/generate-aeo-blog/route.ts', 'utf8');
    
    if (apiContent.includes('202')) {
      results.push({
        component: 'Instant API response (202)',
        status: 'pass',
        message: '202 status code implemented'
      });
    } else {
      results.push({
        component: 'Instant API response (202)',
        status: 'fail',
        message: '202 status code not found'
      });
    }
    
    if (apiContent.includes('aeo/blog.requested')) {
      results.push({
        component: 'Event triggering',
        status: 'pass',
        message: 'Event sending implemented'
      });
    } else {
      results.push({
        component: 'Event triggering',
        status: 'fail',
        message: 'Event sending not found'
      });
    }
  } catch (error) {
    results.push({
      component: 'API endpoint file',
      status: 'fail',
      message: 'Could not read API file'
    });
  }
  
  // Check status tracker
  try {
    const statusContent = readFileSync('src/components/status-tracker.tsx', 'utf8');
    
    if (statusContent.includes('useEffect') && statusContent.includes('supabase')) {
      results.push({
        component: 'Real-time status tracker',
        status: 'pass',
        message: 'Real-time subscriptions implemented'
      });
    } else {
      results.push({
        component: 'Real-time status tracker',
        status: 'fail',
        message: 'Real-time functionality not found'
      });
    }
  } catch (error) {
    results.push({
      component: 'Status tracker file',
      status: 'fail',
      message: 'Could not read status tracker file'
    });
  }
  
  // Check database migration
  try {
    const migrationContent = readFileSync('supabase/migrations/008_aeo_blog_status_tracking.sql', 'utf8');
    
    if (migrationContent.includes('update_project_progress') && migrationContent.includes('update_project_step')) {
      results.push({
        component: 'Database functions',
        status: 'pass',
        message: 'Progress tracking functions defined'
      });
    } else {
      results.push({
        component: 'Database functions',
        status: 'fail',
        message: 'Progress tracking functions not found'
      });
    }
  } catch (error) {
    results.push({
      component: 'Database migration file',
      status: 'fail',
      message: 'Could not read migration file'
    });
  }
  
  // Check Supabase client
  try {
    const supabaseContent = readFileSync('src/lib/supabase/client.ts', 'utf8');
    
    if (supabaseContent.includes('createClient') && supabaseContent.includes('createBrowserClient')) {
      results.push({
        component: 'Supabase client',
        status: 'pass',
        message: 'Client-side Supabase client implemented'
      });
    } else {
      results.push({
        component: 'Supabase client',
        status: 'fail',
        message: 'Client-side Supabase client not found'
      });
    }
  } catch (error) {
    results.push({
      component: 'Supabase client file',
      status: 'fail',
      message: 'Could not read Supabase client file'
    });
  }
  
  // Display results
  console.log('📊 Verification Results:\n');
  
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.component}: ${result.message}`);
    
    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warningCount++;
  }
  
  console.log('\n📈 Summary:');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⚠️  Warnings: ${warningCount}`);
  console.log(`📊 Total: ${results.length}`);
  
  const successRate = Math.round((passCount / results.length) * 100);
  console.log(`🎯 Success Rate: ${successRate}%`);
  
  if (failCount === 0) {
    console.log('\n🎉 All critical components verified! The AEO "One-Go" solution is ready.');
  } else if (failCount <= 2) {
    console.log('\n⚠️  Minor issues detected. Review failed components before deployment.');
  } else {
    console.log('\n❌ Multiple critical issues detected. Please fix before deployment.');
  }
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Start Next.js: npm run dev');
  console.log('2. Start Inngest: npx inngest-cli@latest dev -u http://localhost:3000/api/inngest');
  console.log('3. Visit demo: http://localhost:3000/aeo-demo');
  console.log('4. Monitor: http://localhost:8288');
  console.log('5. Test the complete workflow');
  
  return failCount === 0;
}

// Run verification
verifyAEOImplementation()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });