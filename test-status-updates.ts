#!/usr/bin/env tsx

/**
 * Test the "Going" vs "Stuck" status updates
 */

import { updateProjectStatus, statusHelpers } from './src/lib/utils/project-status';

async function testStatusUpdates() {
  const testProjectId = 'test-project-123';
  
  console.log('🧪 Testing status updates...');
  
  try {
    // Test "Going" states
    console.log('1. Testing "Going" state...');
    await updateProjectStatus(
      testProjectId,
      'researching',
      '🚀 Going: AI is analyzing competitors and generating insights...',
      { progress: 60, currentStep: 'AI Analysis' }
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test "Stuck" state
    console.log('2. Testing "Stuck" state...');
    await updateProjectStatus(
      testProjectId,
      'stuck',
      '⚠️ Stuck: Waiting for Google Quota reset (60s)...',
      { 
        estimatedTimeRemaining: 60,
        currentStep: 'Waiting for quota reset'
      }
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test recovery
    console.log('3. Testing recovery state...');
    await statusHelpers.setResuming(testProjectId);
    
    console.log('✅ Status update test completed!');
    console.log('Check your UI to see if the "Going" vs "Stuck" messages appear correctly.');
    
  } catch (error) {
    console.error('❌ Error testing status updates:', error);
  }
}

// Run if called directly
if (require.main === module) {
  testStatusUpdates();
}

export { testStatusUpdates };