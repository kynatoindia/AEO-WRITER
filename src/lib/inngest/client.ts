import { Inngest } from 'inngest';

// Create the Inngest client with production-ready configuration
export const inngest = new Inngest({
  id: 'aeo-writer-saas',
  name: 'AEO Writer SaaS',
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: process.env.NODE_ENV === 'development',
  // Production configuration with enhanced retry and concurrency
  retries: {
    attempts: 5,
    delay: '1s',
    maxDelay: '30s',
    backoff: 'exponential',
  },
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
  // Global middleware for error handling and monitoring
  middleware: [
    // Add request ID for tracing
    async (ctx, next) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ctx.event.data = { ...ctx.event.data, requestId };
      return next();
    },
  ],
});

// Event types for type safety with enhanced event structure
export type InngestEvents = {
  // User lifecycle events
  'user/registered': {
    data: {
      userId: string;
      email: string;
      plan: 'free' | 'pro' | 'enterprise';
      metadata?: Record<string, any>;
    };
  };
  'user/plan-upgraded': {
    data: {
      userId: string;
      oldPlan: string;
      newPlan: string;
      upgradeDate: string;
    };
  };
  
  // Project lifecycle events
  'project/created': {
    data: {
      userId: string;
      projectId: string;
      topic: string;
      competitorUrls: string[];
      tone: string;
      format: string;
    };
  };
  'project/research-started': {
    data: {
      userId: string;
      projectId: string;
      competitorUrls: string[];
      brandDocumentPath?: string;
    };
  };
  'project/blueprint-generated': {
    data: {
      userId: string;
      projectId: string;
      blueprint: any;
      estimatedTokens: number;
    };
  };
  'project/content-generation-started': {
    data: {
      userId: string;
      projectId: string;
      blueprint: any;
      sectionCount: number;
    };
  };
  'project/section-completed': {
    data: {
      userId: string;
      projectId: string;
      sectionId: string;
      sectionIndex: number;
      content: string;
      tokensUsed: number;
    };
  };
  'project/completed': {
    data: {
      userId: string;
      projectId: string;
      totalTokensUsed: number;
      totalCost: number;
      completionTime: number;
    };
  };
  
  // Content generation events
  'content/generate': {
    data: {
      userId: string;
      projectId: string;
      contentType: 'research' | 'blueprint' | 'section' | 'polish';
      prompt: string;
      sectionId?: string;
      priority?: 'high' | 'normal' | 'low';
    };
  };
  'content/strategy-generate': {
    data: {
      userId: string;
      projectId: string;
      researchData: any;
      topic: string;
      tone: string;
      format: string;
    };
  };
  'content/section-generate': {
    data: {
      userId: string;
      projectId: string;
      sectionId: string;
      section: any;
      blueprint: any;
      researchData: any;
      priority?: 'high' | 'normal' | 'low';
    };
  };
  'content/final-assembly': {
    data: {
      userId: string;
      projectId: string;
      blueprint: any;
    };
  };
  'content/finalize': {
    data: {
      userId: string;
      projectId: string;
      generatedContent: string;
      blueprint: any;
    };
  };
  'content/all-sections-complete': {
    data: {
      userId: string;
      projectId: string;
      blueprint: any;
    };
  };
  'content/manual-finalize': {
    data: {
      userId: string;
      projectId: string;
    };
  };
  'content/research-completed': {
    data: {
      userId: string;
      projectId: string;
      researchData: any;
      tokensUsed: number;
      cost: number;
    };
  };
  
  // Quota and billing events
  'quota/exceeded': {
    data: {
      userId: string;
      plan: string;
      quotaType: 'contentGeneration' | 'apiCalls' | 'projects';
      currentUsage: number;
      limit: number;
    };
  };
  'quota/warning': {
    data: {
      userId: string;
      plan: string;
      quotaType: 'contentGeneration' | 'apiCalls' | 'projects';
      currentUsage: number;
      limit: number;
      warningThreshold: number;
    };
  };
  
  // System events
  'system/health-check': {
    data: {
      timestamp: string;
      services: string[];
    };
  };
  'system/cleanup': {
    data: {
      type: 'cache' | 'temp-files' | 'old-projects';
      olderThan: string;
    };
  };
  
  // Error and monitoring events
  'error/ai-provider-failed': {
    data: {
      userId: string;
      projectId?: string;
      provider: string;
      error: string;
      fallbackUsed?: string;
    };
  };
  'error/rate-limit-exceeded': {
    data: {
      userId: string;
      endpoint: string;
      currentRequests: number;
      limit: number;
    };
  };
};

// Event priority levels for queue management
export const EVENT_PRIORITIES = {
  HIGH: ['project/research-started', 'content/generate'],
  NORMAL: ['project/created', 'user/registered'],
  LOW: ['system/cleanup', 'system/health-check'],
} as const;

// Concurrency limits for different event types to prevent rate limiting
export const CONCURRENCY_LIMITS = {
  'content/generate': 3, // Strict limit for AI API calls to prevent OpenAI rate limiting
  'content/strategy-generate': 1, // Sequential strategy generation for quality
  'content/section-generate': 2, // Parallel section generation with limit
  'content/final-assembly': 1, // Sequential final assembly
  'content/finalize': 2, // Content finalization with SEO and FAQ generation
  'project/research-started': 2, // Limit research operations
  'project/content-generation-started': 1, // Sequential content generation to manage costs
  'ai/openai-request': 5, // Global OpenAI request limit
  'ai/gemini-request': 8, // Higher limit for Gemini
  default: 10,
} as const;

// Retry configuration for different operation types
export const RETRY_CONFIG = {
  'ai-request': {
    attempts: 5,
    delay: '2s',
    maxDelay: '60s',
    backoff: 'exponential',
    retryIf: (error: any) => {
      // Retry on rate limits, timeouts, and temporary failures
      return error.status === 429 || 
             error.status === 502 || 
             error.status === 503 || 
             error.status === 504 ||
             error.code === 'ECONNRESET' ||
             error.code === 'ETIMEDOUT';
    },
  },
  'database-operation': {
    attempts: 3,
    delay: '1s',
    maxDelay: '10s',
    backoff: 'exponential',
  },
  'external-api': {
    attempts: 4,
    delay: '1s',
    maxDelay: '30s',
    backoff: 'exponential',
  },
  default: {
    attempts: 3,
    delay: '1s',
    maxDelay: '15s',
    backoff: 'exponential',
  },
} as const;

// Idempotency key generators for different operations
export const generateIdempotencyKey = {
  contentGeneration: (userId: string, projectId: string, sectionId?: string) => 
    `content_gen_${userId}_${projectId}_${sectionId || 'main'}_${Date.now()}`,
  
  research: (userId: string, projectId: string, urls: string[]) => 
    `research_${userId}_${projectId}_${urls.sort().join('_').slice(0, 50)}`,
  
  blueprint: (userId: string, projectId: string, version: number = 1) => 
    `blueprint_${userId}_${projectId}_v${version}`,
  
  aiRequest: (operation: string, userId: string, contentHash: string) => 
    `ai_${operation}_${userId}_${contentHash.slice(0, 16)}`,
  
  userOperation: (userId: string, operation: string, timestamp?: number) => 
    `user_${userId}_${operation}_${timestamp || Date.now()}`,
} as const;

// Rate limiting configuration for AI providers
export const AI_RATE_LIMITS = {
  openai: {
    requestsPerMinute: 50,
    tokensPerMinute: 150000,
    requestsPerDay: 10000,
  },
  gemini: {
    requestsPerMinute: 60,
    tokensPerMinute: 200000,
    requestsPerDay: 15000,
  },
} as const;