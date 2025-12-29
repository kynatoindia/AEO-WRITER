/**
 * Example demonstrating Inngest workflow usage
 * This shows how to trigger and manage event-driven workflows
 */

import { inngest, generateIdempotencyKey } from '../client';
import { WorkflowUtils, ConcurrencyManager, AIRateLimiter } from '../workflow-manager';

/**
 * Example: Trigger a complete content generation workflow
 */
export async function triggerContentGenerationWorkflow(
  userId: string,
  projectId: string,
  topic: string,
  competitorUrls: string[]
): Promise<void> {
  console.log(`Starting content generation workflow for project ${projectId}`);

  // Step 1: Create project and trigger research
  await WorkflowUtils.sendEventSafe('project/created', {
    userId,
    projectId,
    topic,
    competitorUrls,
    tone: 'professional',
    format: 'how-to',
  });

  // Step 2: Trigger research workflow
  await WorkflowUtils.sendEventSafe('project/research-started', {
    userId,
    projectId,
    competitorUrls,
    brandDocumentPath: null,
  }, {
    priority: 'high',
    delay: '5s', // Small delay to ensure project is created
  });

  console.log(`Content generation workflow initiated for project ${projectId}`);
}

/**
 * Example: Trigger blueprint generation after research
 */
export async function triggerBlueprintGeneration(
  userId: string,
  projectId: string,
  researchData: any,
  topic: string
): Promise<void> {
  // Check concurrency before proceeding
  const canProceed = await ConcurrencyManager.checkConcurrency('project/content-generation-started', userId);
  
  if (!canProceed.allowed) {
    console.log(`Blueprint generation delayed - concurrency limit reached (${canProceed.currentConcurrency}/${canProceed.limit})`);
    
    // Schedule for later
    await WorkflowUtils.sendEventSafe('project/blueprint-generate', {
      userId,
      projectId,
      researchData,
      topic,
      tone: 'professional',
      format: 'how-to',
    }, {
      delay: '30s', // Retry in 30 seconds
      priority: 'normal',
    });
    return;
  }

  // Proceed with blueprint generation
  await WorkflowUtils.sendEventSafe('project/blueprint-generate', {
    userId,
    projectId,
    researchData,
    topic,
    tone: 'professional',
    format: 'how-to',
  }, {
    priority: 'high',
  });

  console.log(`Blueprint generation triggered for project ${projectId}`);
}

/**
 * Example: Trigger individual section generation with rate limiting
 */
export async function triggerSectionGeneration(
  userId: string,
  projectId: string,
  sectionId: string,
  prompt: string
): Promise<void> {
  // Check AI provider rate limits
  await AIRateLimiter.waitForRateLimit('openai', userId);

  // Generate idempotency key to prevent duplicates
  const idempotencyKey = generateIdempotencyKey.contentGeneration(userId, projectId, sectionId);

  await WorkflowUtils.sendEventSafe('content/generate', {
    userId,
    projectId,
    contentType: 'section',
    prompt,
    sectionId,
    priority: 'high',
  }, {
    idempotencyKey,
  });

  console.log(`Section generation triggered: ${sectionId} for project ${projectId}`);
}

/**
 * Example: Handle user registration workflow
 */
export async function handleNewUserRegistration(
  userId: string,
  email: string,
  plan: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<void> {
  await WorkflowUtils.sendEventSafe('user/registered', {
    userId,
    email,
    plan,
    metadata: {
      registrationSource: 'web',
      timestamp: Date.now(),
    },
  });

  console.log(`User registration workflow triggered for ${email}`);
}

/**
 * Example: Handle subscription upgrade
 */
export async function handleSubscriptionUpgrade(
  userId: string,
  oldPlan: string,
  newPlan: string
): Promise<void> {
  await WorkflowUtils.sendEventSafe('user/plan-upgraded', {
    userId,
    oldPlan,
    newPlan,
    upgradeDate: new Date().toISOString(),
  });

  console.log(`Subscription upgrade workflow triggered: ${oldPlan} -> ${newPlan}`);
}

/**
 * Example: Batch process multiple content sections with concurrency control
 */
export async function batchGenerateContentSections(
  userId: string,
  projectId: string,
  sections: Array<{ id: string; heading: string; prompt: string }>
): Promise<void> {
  console.log(`Starting batch content generation for ${sections.length} sections`);

  // Process sections with controlled concurrency
  const batchSize = 2; // Process 2 sections at a time
  
  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    
    // Process batch in parallel
    const promises = batch.map(async (section, index) => {
      // Stagger requests to avoid rate limits
      const delay = index * 2; // 2 second delay between requests
      
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      
      return triggerSectionGeneration(userId, projectId, section.id, section.prompt);
    });

    await Promise.all(promises);
    
    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sections.length / batchSize)}`);
    
    // Wait between batches to respect rate limits
    if (i + batchSize < sections.length) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second pause between batches
    }
  }

  console.log(`Batch content generation completed for project ${projectId}`);
}

/**
 * Example: Monitor workflow progress
 */
export async function monitorWorkflowProgress(projectId: string): Promise<void> {
  // This would typically be called from a monitoring dashboard
  console.log(`Monitoring workflow progress for project ${projectId}`);
  
  // In a real implementation, you would:
  // 1. Query workflow status from Redis
  // 2. Check completion status of each step
  // 3. Provide real-time updates to the UI
  // 4. Handle error recovery if needed
}

/**
 * Example usage in an API route or service
 */
export const WorkflowExamples = {
  triggerContentGenerationWorkflow,
  triggerBlueprintGeneration,
  triggerSectionGeneration,
  handleNewUserRegistration,
  handleSubscriptionUpgrade,
  batchGenerateContentSections,
  monitorWorkflowProgress,
};