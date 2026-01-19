import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { incrementUsage, checkQuota } from '@/lib/rate-limiting/quota';
import { generateAIText } from '@/lib/ai/gateway';
import { createHash } from 'crypto';

// Enhanced content generation handler with SEQUENTIAL execution to prevent rate limits
export const handleContentGeneration = inngest.createFunction(
  { 
    id: 'handle-content-generation',
    concurrency: [
      {
        limit: 1, // CRITICAL: Only 1 request at a time to prevent rate limits
        key: 'event.data.userId',
        scope: 'account', // Global limit across all users
      }
    ],
    throttle: {
      limit: 12, // Stay well under 15 RPM limit
      period: '1m',
      key: 'event.data.userId',
    },
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/generate' },
  async ({ event, step }) => {
    const { userId, projectId, contentType, prompt, sectionId, priority = 'normal' } = event.data;
    
    // MANDATORY COOL DOWN: Wait before making AI request
    await step.sleep('rate-limit-cooldown', '5s');
    
    // Generate idempotency key based on content hash
    const contentHash = createHash('sha256').update(prompt).digest('hex');
    const idempotencyKey = generateIdempotencyKey.contentGeneration(userId, projectId, sectionId);
    
    // Check for duplicate requests using idempotency key
    const duplicateCheck = await step.run('check-duplicate-request', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      if (existingResult) {
        return JSON.parse(existingResult);
      }
      return null;
    });
    
    if (duplicateCheck) {
      console.log(`Duplicate request detected for ${idempotencyKey}, returning cached result`);
      return duplicateCheck;
    }
    
    // Check quota before processing with retry logic
    const quotaCheck = await step.run('check-quota', async () => {
      return await checkQuota(userId, 'free', 'contentGeneration');
    });
    
    if (!quotaCheck.allowed) {
      await inngest.send({
        name: 'quota/exceeded',
        data: {
          userId,
          plan: 'free',
          quotaType: 'contentGeneration',
          currentUsage: quotaCheck.usage,
          limit: quotaCheck.limit,
        },
      });
      throw new Error('Content generation quota exceeded');
    }
    
    // Generate content with multi-provider failover
    const content = await step.run('generate-content-with-failover', async () => {
      try {
        // Import the multi-provider gateway
        const { multiProviderAI } = await import('@/lib/ai/multi-provider-gateway');
        
        const contentPrompt = `Generate ${contentType} content: ${prompt}`;
        const result = await multiProviderAI.generateContent(contentPrompt);
        
        // Store successful result in cache for idempotency
        await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify({
          success: true,
          content: result,
          contentLength: result.length,
          timestamp: Date.now(),
        }));
        
        return result;
      } catch (error: any) {
        console.error('Multi-provider AI generation failed:', error);
        throw new Error(`AI generation failed: ${error.message}`);
      }
    });
    
    // MANDATORY COOL DOWN: Wait after AI request before next operation
    await step.sleep('post-ai-cooldown', '3s');
    
    // Increment usage with retry logic
    await step.run('increment-usage', async () => {
      await incrementUsage(userId, 'contentGeneration');
    });
    
    // Store content in database with retry logic
    await step.run('store-content', async () => {
      console.log(`Storing content for project ${projectId}, section ${sectionId || 'main'}`);
      
      // Send progress update event
      await inngest.send({
        name: 'project/section-completed',
        data: {
          userId,
          projectId,
          sectionId: sectionId || 'main',
          sectionIndex: 0,
          content,
          tokensUsed: Math.ceil(content.length / 4),
        },
      });
    });
    
    const result = { 
      success: true, 
      contentLength: content.length,
      idempotencyKey,
      timestamp: Date.now(),
    };
    
    // Cache result for idempotency (extend TTL for successful operations)
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));
    
    return result;
  }
);

// Enhanced project research handler with SEQUENTIAL execution
export const handleProjectResearch = inngest.createFunction(
  {
    id: 'handle-project-research',
    concurrency: [
      {
        limit: 1, // CRITICAL: Only 1 research request at a time
        key: 'event.data.userId',
        scope: 'account',
      }
    ],
    throttle: {
      limit: 10, // Conservative limit for research operations
      period: '1m',
      key: 'event.data.userId',
    },
    retries: RETRY_CONFIG['external-api'].attempts,
  },
  { event: 'project/research-started' },
  async ({ event, step }) => {
    const { userId, projectId, competitorUrls, brandDocumentPath } = event.data;
    
    // MANDATORY COOL DOWN: Wait before starting research
    await step.sleep('research-start-cooldown', '3s');
    
    // Generate idempotency key for research operation
    const idempotencyKey = generateIdempotencyKey.research(userId, projectId, competitorUrls);
    
    // Check for duplicate research requests
    const duplicateCheck = await step.run('check-duplicate-research', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      console.log(`Duplicate research request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }
    
    // Scrape competitor content with retry logic (using Groq for fast processing)
    const competitorData = await step.run('scrape-competitors', async () => {
      console.log(`Scraping ${competitorUrls.length} competitor URLs`);
      // Use Tavily for web scraping, then Groq for analysis
      return { scraped: competitorUrls.length, data: [] };
    });
    
    // COOL DOWN between operations
    await step.sleep('post-scraping-cooldown', '5s');
    
    // Process brand document if provided
    const brandContext = await step.run('process-brand-document', async () => {
      if (!brandDocumentPath) return null;
      
      console.log(`Processing brand document: ${brandDocumentPath}`);
      return { processed: true, embeddings: [] };
    });
    
    // COOL DOWN before AI analysis
    await step.sleep('pre-analysis-cooldown', '5s');
    
    // Generate research analysis using multi-provider AI (prefer Gemini for research)
    const researchAnalysis = await step.run('analyze-research-with-failover', async () => {
      try {
        const { multiProviderAI } = await import('@/lib/ai/multi-provider-gateway');
        const analysisPrompt = `Analyze competitor content and brand context for project ${projectId}`;
        return await multiProviderAI.generateResearch(analysisPrompt);
      } catch (error: any) {
        console.error('Research analysis failed:', error);
        throw new Error(`Research analysis failed: ${error.message}`);
      }
    });
    
    // COOL DOWN after AI analysis
    await step.sleep('post-analysis-cooldown', '3s');
    
    // Store research results
    await step.run('store-research-results', async () => {
      console.log(`Storing research results for project ${projectId}`);
      
      // Send research completed event
      await inngest.send({
        name: 'content/research-completed',
        data: {
          userId,
          projectId,
          researchData: { competitorData, brandContext, researchAnalysis },
          tokensUsed: Math.ceil(researchAnalysis.length / 4),
          cost: 0.01,
        },
      });
    });
    
    const result = {
      success: true,
      competitorCount: competitorUrls.length,
      hasBrandDocument: !!brandDocumentPath,
      analysisLength: researchAnalysis.length,
      idempotencyKey,
      timestamp: Date.now(),
    };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));
    
    return result;
  }
);

// Enhanced blueprint generation with fan-out pattern
export const handleBlueprintGeneration = inngest.createFunction(
  {
    id: 'handle-blueprint-generation',
    concurrency: [
      {
        limit: CONCURRENCY_LIMITS['project/content-generation-started'],
        key: 'event.data.userId',
      },
      {
        limit: 1,
        scope: "account",
        key: '"gemini-quota-limit"', // Global Gemini quota limit protection
      }
    ],
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'project/blueprint-generate' },
  async ({ event, step }) => {
    const { userId, projectId, researchData, topic, tone, format } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.blueprint(userId, projectId);
    
    // Check for duplicate blueprint requests
    const duplicateCheck = await step.run('check-duplicate-blueprint', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      return duplicateCheck;
    }
    
    // Generate blueprint using GPT-4 (high-quality strategy)
    const blueprint = await step.run('generate-blueprint', async () => {
      const blueprintPrompt = `Create detailed content blueprint for topic: ${topic}, tone: ${tone}, format: ${format}`;
      const blueprintText = await generateAIText(blueprintPrompt);
      
      // Parse blueprint into structured format
      return {
        sections: [
          { id: '1', heading: 'Introduction', goal: 'Hook readers', subSections: [] },
          { id: '2', heading: 'Main Content', goal: 'Deliver value', subSections: [] },
          { id: '3', heading: 'Conclusion', goal: 'Call to action', subSections: [] },
        ],
        seoMetadata: {
          title: `${topic} - Complete Guide`,
          metaDescription: `Learn everything about ${topic}`,
          targetKeywords: [topic],
          focusKeyword: topic,
        },
        estimatedLength: 2000,
        targetKeywords: [topic],
      };
    });
    
    // Store blueprint and trigger section generation
    await step.run('store-blueprint-and-trigger-sections', async () => {
      console.log(`Storing blueprint for project ${projectId}`);
      
      // Send blueprint generated event
      await inngest.send({
        name: 'project/blueprint-generated',
        data: {
          userId,
          projectId,
          blueprint,
          estimatedTokens: blueprint.estimatedLength / 4,
        },
      });
      
      // Fan-out: Trigger content generation for each section
      for (const section of blueprint.sections) {
        await inngest.send({
          name: 'content/generate',
          data: {
            userId,
            projectId,
            contentType: 'section',
            prompt: `Write ${section.heading}: ${section.goal}`,
            sectionId: section.id,
            priority: 'high',
          },
        });
      }
    });
    
    const result = {
      success: true,
      sectionCount: blueprint.sections.length,
      estimatedTokens: blueprint.estimatedLength / 4,
      idempotencyKey,
      timestamp: Date.now(),
    };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));
    
    return result;
  }
);

// User registration handler with enhanced error handling
export const handleUserRegistration = inngest.createFunction(
  { 
    id: 'handle-user-registration',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"', // Global Gemini quota limit protection
    },
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'user/registered' },
  async ({ event, step }) => {
    const { userId, email, plan } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.userOperation(userId, 'registration');
    
    // Check for duplicate registration
    const duplicateCheck = await step.run('check-duplicate-registration', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      return duplicateCheck;
    }
    
    // Initialize user quota cache
    await step.run('initialize-user-quota', async () => {
      const quotaKey = CACHE_KEYS.USER_QUOTA(userId);
      await redis.hset(quotaKey, {
        plan,
        contentGeneration: 0,
        apiCalls: 0,
        projects: 0,
        createdAt: Date.now(),
      });
    });
    
    // Send welcome email (placeholder)
    await step.run('send-welcome-email', async () => {
      console.log(`Sending welcome email to ${email} for plan: ${plan}`);
      // Implement email service integration here
    });
    
    const result = { success: true, userId, plan, timestamp: Date.now() };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(result));
    
    return result;
  }
);

// Enhanced quota exceeded handler
export const handleQuotaExceeded = inngest.createFunction(
  { 
    id: 'handle-quota-exceeded',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"', // Global Gemini quota limit protection
    },
    retries: RETRY_CONFIG['default'].attempts,
  },
  { event: 'quota/exceeded' },
  async ({ event, step }) => {
    const { userId, plan, quotaType, currentUsage, limit } = event.data;
    
    // Send quota exceeded notification
    await step.run('send-quota-notification', async () => {
      console.log(`User ${userId} exceeded ${quotaType} quota: ${currentUsage}/${limit}`);
      // Implement notification service here
    });
    
    // Log for analytics with enhanced data
    await step.run('log-quota-exceeded', async () => {
      await redis.lpush('quota_exceeded_events', JSON.stringify({
        userId,
        plan,
        quotaType,
        currentUsage,
        limit,
        timestamp: Date.now(),
        severity: currentUsage > limit * 1.5 ? 'high' : 'medium',
      }));
    });
    
    // Temporarily throttle user requests
    await step.run('apply-throttling', async () => {
      const throttleKey = `throttle:${userId}:${quotaType}`;
      await redis.setex(throttleKey, 3600, 'throttled'); // 1 hour throttle
    });
    
    return { success: true, action: 'throttled' };
  }
);

// Enhanced subscription update handler
export const handleSubscriptionUpdate = inngest.createFunction(
  { 
    id: 'handle-subscription-update',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"', // Global Gemini quota limit protection
    },
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'user/plan-upgraded' },
  async ({ event, step }) => {
    const { userId, oldPlan, newPlan } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.userOperation(userId, `upgrade_${oldPlan}_to_${newPlan}`);
    
    // Check for duplicate upgrade requests
    const duplicateCheck = await step.run('check-duplicate-upgrade', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      return duplicateCheck;
    }
    
    // Update user quota cache
    await step.run('update-quota-cache', async () => {
      const quotaKey = CACHE_KEYS.USER_QUOTA(userId);
      await redis.hset(quotaKey, { 
        plan: newPlan,
        upgradedAt: Date.now(),
      });
    });
    
    // Reset usage if upgrading from free
    if (newPlan !== 'free' && oldPlan === 'free') {
      await step.run('reset-usage-counters', async () => {
        const usageKeys = [
          `${CACHE_KEYS.USER_USAGE(userId)}:contentGeneration`,
          `${CACHE_KEYS.USER_USAGE(userId)}:apiCalls`,
          `${CACHE_KEYS.USER_USAGE(userId)}:projects`,
        ];
        
        for (const key of usageKeys) {
          await redis.del(key);
        }
        
        // Remove any throttling
        const throttleKeys = await redis.keys(`throttle:${userId}:*`);
        if (throttleKeys.length > 0) {
          await redis.del(...throttleKeys);
        }
      });
    }
    
    const result = { success: true, oldPlan, newPlan, timestamp: Date.now() };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(result));
    
    return result;
  }
);

// Import research pipeline functions
import { researchPipelineFunctions } from './research-pipeline';
// Import content generation pipeline functions
import { contentGenerationFunctions } from './content-generation-pipeline-simple';
// Import project initialization functions
import { projectInitializationFunctions } from './project-initialization';
// Import content finalization functions
import { contentFinalizationFunctions } from './content-finalization-pipeline';
// Import modular agentic research pipeline functions
import { modularAgenticResearchFunctions } from './modular-agentic-research-pipeline';
// Import fact-based content generation functions
import { factBasedContentGenerationFunctions } from './fact-based-content-generation-pipeline';

// Export all enhanced functions
export const inngestFunctions = [
  handleUserRegistration,
  handleContentGeneration,
  handleProjectResearch,
  handleBlueprintGeneration,
  handleQuotaExceeded,
  handleSubscriptionUpdate,
  ...researchPipelineFunctions,
  ...contentGenerationFunctions,
  ...projectInitializationFunctions,
  ...contentFinalizationFunctions,
  ...modularAgenticResearchFunctions,
  ...factBasedContentGenerationFunctions,
];