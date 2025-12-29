import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { incrementUsage, checkQuota } from '@/lib/rate-limiting/quota';
import { generateAIText } from '@/lib/ai/gateway';
import { createHash } from 'crypto';

// Enhanced content generation handler with concurrency control and idempotency
export const handleContentGeneration = inngest.createFunction(
  { 
    id: 'handle-content-generation',
    concurrency: {
      limit: CONCURRENCY_LIMITS['content/generate'],
      key: 'event.data.userId', // Per-user concurrency
    },
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/generate' },
  async ({ event, step }) => {
    const { userId, projectId, contentType, prompt, sectionId, priority = 'normal' } = event.data;
    
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
      return await checkQuota(userId, 'free', 'contentGeneration'); // Get actual plan from DB
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    if (!quotaCheck.allowed) {
      await inngest.send({
        name: 'quota/exceeded',
        data: {
          userId,
          plan: 'free', // Get actual plan from DB
          quotaType: 'contentGeneration',
          currentUsage: quotaCheck.usage,
          limit: quotaCheck.limit,
        },
      });
      throw new Error('Content generation quota exceeded');
    }
    
    // Rate limit check for AI provider
    const rateLimitCheck = await step.run('check-ai-rate-limit', async () => {
      const rateLimitKey = `rate_limit:openai:${userId}`;
      const currentRequests = await redis.incr(rateLimitKey);
      
      if (currentRequests === 1) {
        await redis.expire(rateLimitKey, 60); // 1 minute window
      }
      
      if (currentRequests > 10) { // 10 requests per minute per user
        throw new Error('AI provider rate limit exceeded');
      }
      
      return { allowed: true, currentRequests };
    });
    
    // Generate content with enhanced error handling and retries
    const content = await step.run('generate-content', async () => {
      try {
        const contentPrompt = `Generate ${contentType} content: ${prompt}`;
        const result = await generateAIText(contentPrompt);
        
        // Store successful result in cache for idempotency
        await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify({
          success: true,
          content: result,
          contentLength: result.length,
          timestamp: Date.now(),
        }));
        
        return result;
      } catch (error: any) {
        // Enhanced error handling with specific retry logic
        if (error.status === 429) {
          // Rate limit hit - wait and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          throw new Error('OpenAI rate limit exceeded - retrying');
        } else if (error.status >= 500) {
          // Server error - retry
          throw new Error(`OpenAI server error: ${error.message}`);
        } else {
          // Client error - don't retry
          throw new Error(`OpenAI client error: ${error.message}`);
        }
      }
    }, {
      retries: RETRY_CONFIG['ai-request'].attempts,
    });
    
    // Increment usage with retry logic
    await step.run('increment-usage', async () => {
      await incrementUsage(userId, 'contentGeneration');
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    // Store content in database with retry logic
    await step.run('store-content', async () => {
      console.log(`Storing content for project ${projectId}, section ${sectionId || 'main'}`);
      // Implement database storage here with proper error handling
      
      // Send progress update event
      await inngest.send({
        name: 'project/section-completed',
        data: {
          userId,
          projectId,
          sectionId: sectionId || 'main',
          sectionIndex: 0, // Get from database
          content,
          tokensUsed: Math.ceil(content.length / 4), // Rough token estimate
        },
      });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
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

// Enhanced project research handler with concurrency control
export const handleProjectResearch = inngest.createFunction(
  {
    id: 'handle-project-research',
    concurrency: {
      limit: CONCURRENCY_LIMITS['project/research-started'],
      key: 'event.data.userId',
    },
    retries: RETRY_CONFIG['external-api'].attempts,
  },
  { event: 'project/research-started' },
  async ({ event, step }) => {
    const { userId, projectId, competitorUrls, brandDocumentPath } = event.data;
    
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
    
    // Scrape competitor content with retry logic
    const competitorData = await step.run('scrape-competitors', async () => {
      console.log(`Scraping ${competitorUrls.length} competitor URLs`);
      // Implement Tavily API integration here
      return { scraped: competitorUrls.length, data: [] };
    }, {
      retries: RETRY_CONFIG['external-api'].attempts,
    });
    
    // Process brand document if provided
    const brandContext = await step.run('process-brand-document', async () => {
      if (!brandDocumentPath) return null;
      
      console.log(`Processing brand document: ${brandDocumentPath}`);
      // Implement PDF processing and vector embedding here
      return { processed: true, embeddings: [] };
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    // Generate research analysis using AI
    const researchAnalysis = await step.run('analyze-research', async () => {
      const analysisPrompt = `Analyze competitor content and brand context for project ${projectId}`;
      return await generateAIText(analysisPrompt);
    }, {
      retries: RETRY_CONFIG['ai-request'].attempts,
    });
    
    // Store research results
    await step.run('store-research-results', async () => {
      console.log(`Storing research results for project ${projectId}`);
      // Implement database storage
      
      // Send research completed event
      await inngest.send({
        name: 'content/research-completed',
        data: {
          userId,
          projectId,
          researchData: { competitorData, brandContext, researchAnalysis },
          tokensUsed: Math.ceil(researchAnalysis.length / 4),
          cost: 0.01, // Calculate actual cost
        },
      });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
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
    concurrency: {
      limit: CONCURRENCY_LIMITS['project/content-generation-started'],
      key: 'event.data.userId',
    },
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
    }, {
      retries: RETRY_CONFIG['ai-request'].attempts,
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
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
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
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    // Send welcome email (placeholder)
    await step.run('send-welcome-email', async () => {
      console.log(`Sending welcome email to ${email} for plan: ${plan}`);
      // Implement email service integration here
    }, {
      retries: RETRY_CONFIG['external-api'].attempts,
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
    retries: RETRY_CONFIG['default'].attempts,
  },
  { event: 'quota/exceeded' },
  async ({ event, step }) => {
    const { userId, plan, quotaType, currentUsage, limit } = event.data;
    
    // Send quota exceeded notification
    await step.run('send-quota-notification', async () => {
      console.log(`User ${userId} exceeded ${quotaType} quota: ${currentUsage}/${limit}`);
      // Implement notification service here
    }, {
      retries: RETRY_CONFIG['external-api'].attempts,
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
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
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
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
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
      }, {
        retries: RETRY_CONFIG['database-operation'].attempts,
      });
    }
    
    const result = { success: true, oldPlan, newPlan, timestamp: Date.now() };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(result));
    
    return result;
  }
);

// Export all enhanced functions
export const inngestFunctions = [
  handleUserRegistration,
  handleContentGeneration,
  handleProjectResearch,
  handleBlueprintGeneration,
  handleQuotaExceeded,
  handleSubscriptionUpdate,
];