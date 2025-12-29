// Production infrastructure configuration
export const INFRASTRUCTURE_CONFIG = {
  // Environment settings
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Application settings
  app: {
    name: 'AEO Writer SaaS',
    version: process.env.npm_package_version || '1.0.0',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // Database configuration (Supabase with Transaction Pooler)
  database: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // Use Transaction Pooler (Port 6543) for production
    poolerUrl: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    maxConnections: process.env.NODE_ENV === 'production' ? 50 : 10,
    connectionTimeout: 30000,
    queryTimeout: 30000,
  },
  
  // Redis configuration (Upstash)
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    maxRetries: 3,
    retryDelay: 1000,
  },
  
  // Inngest configuration
  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY!,
    signingKey: process.env.INNGEST_SIGNING_KEY!,
    isDev: process.env.NODE_ENV === 'development',
    concurrency: {
      'content/generate': 5,
      'project/research-started': 3,
      'project/content-generation-started': 2,
      default: 10,
    },
  },
  
  // AI Provider configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      organization: process.env.OPENAI_ORG_ID,
      maxRetries: 3,
      timeout: 60000,
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY!,
      maxRetries: 3,
      timeout: 60000,
    },
    // Cost optimization settings
    costOptimization: {
      enabled: process.env.NODE_ENV === 'production',
      preferCheaperModels: true,
      cacheExpensiveOperations: true,
      maxCostPerUser: 10.0, // $10 per user per month
    },
  },
  
  // External API configuration
  external: {
    tavily: {
      apiKey: process.env.TAVILY_API_KEY!,
      maxRetries: 3,
      timeout: 30000,
    },
  },
  
  // Rate limiting configuration
  rateLimiting: {
    enabled: true,
    global: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    },
    perUser: {
      windowMs: 60000, // 1 minute
      maxRequests: 30,
    },
    perIP: {
      windowMs: 60000, // 1 minute
      maxRequests: 50,
    },
  },
  
  // Quota configuration by plan
  quotas: {
    free: {
      contentGeneration: 10, // per month
      apiCalls: 100, // per day
      projects: 3,
      maxFileSize: 5 * 1024 * 1024, // 5MB
    },
    pro: {
      contentGeneration: 500, // per month
      apiCalls: 5000, // per day
      projects: 50,
      maxFileSize: 25 * 1024 * 1024, // 25MB
    },
    enterprise: {
      contentGeneration: -1, // unlimited
      apiCalls: -1, // unlimited
      projects: -1, // unlimited
      maxFileSize: 100 * 1024 * 1024, // 100MB
    },
  },
  
  // Caching configuration
  cache: {
    defaultTTL: 3600, // 1 hour
    strategies: {
      user: {
        profile: 1800, // 30 minutes
        quota: 3600, // 1 hour
        usage: 300, // 5 minutes
      },
      content: {
        research: 172800, // 48 hours (expensive)
        blueprint: 43200, // 12 hours
        generated: 86400, // 24 hours
      },
      system: {
        health: 30, // 30 seconds
        metrics: 60, // 1 minute
      },
    },
  },
  
  // Monitoring and alerting
  monitoring: {
    healthCheck: {
      interval: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      retries: 3,
    },
    performance: {
      slowQueryThreshold: 5000, // 5 seconds
      highMemoryThreshold: 0.8, // 80%
      highCpuThreshold: 0.8, // 80%
    },
    alerting: {
      enabled: process.env.NODE_ENV === 'production',
      channels: {
        email: process.env.ALERT_EMAIL,
        slack: process.env.SLACK_WEBHOOK_URL,
      },
      thresholds: {
        errorRate: 0.05, // 5%
        responseTime: 2000, // 2 seconds
        availability: 0.99, // 99%
      },
    },
  },
  
  // Security configuration
  security: {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.NEXT_PUBLIC_APP_URL!]
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
    fileUpload: {
      maxSize: 25 * 1024 * 1024, // 25MB
      allowedTypes: ['application/pdf', 'text/plain', 'text/markdown'],
      virusScanning: process.env.NODE_ENV === 'production',
    },
  },
  
  // Feature flags
  features: {
    realTimeUpdates: true,
    advancedAnalytics: process.env.NODE_ENV === 'production',
    betaFeatures: process.env.ENABLE_BETA_FEATURES === 'true',
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    destinations: {
      console: true,
      file: process.env.NODE_ENV === 'production',
      external: process.env.LOG_SERVICE_URL,
    },
  },
} as const;

// Validation function to ensure all required environment variables are set
export function validateConfiguration(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'TAVILY_API_KEY',
  ];
  
  const optional = [
    'DATABASE_URL',
    'OPENAI_ORG_ID',
    'ALERT_EMAIL',
    'SLACK_WEBHOOK_URL',
    'LOG_SERVICE_URL',
  ];
  
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required variables
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  // Check optional variables for production
  if (process.env.NODE_ENV === 'production') {
    for (const key of optional) {
      if (!process.env[key]) {
        warnings.push(`Optional environment variable ${key} is not set`);
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// Get configuration for specific service
export function getServiceConfig<T extends keyof typeof INFRASTRUCTURE_CONFIG>(
  service: T
): typeof INFRASTRUCTURE_CONFIG[T] {
  return INFRASTRUCTURE_CONFIG[service];
}

// Environment-specific overrides
export function getEnvironmentConfig() {
  const base = INFRASTRUCTURE_CONFIG;
  
  switch (process.env.NODE_ENV) {
    case 'development':
      return {
        ...base,
        database: {
          ...base.database,
          maxConnections: 5,
        },
        rateLimiting: {
          ...base.rateLimiting,
          enabled: false,
        },
        monitoring: {
          ...base.monitoring,
          alerting: {
            ...base.monitoring.alerting,
            enabled: false,
          },
        },
      };
      
    case 'test':
      return {
        ...base,
        database: {
          ...base.database,
          maxConnections: 2,
        },
        cache: {
          ...base.cache,
          defaultTTL: 60, // 1 minute for faster tests
        },
        rateLimiting: {
          ...base.rateLimiting,
          enabled: false,
        },
      };
      
    case 'production':
      return base;
      
    default:
      return base;
  }
}

// Export types for TypeScript
export type InfrastructureConfig = typeof INFRASTRUCTURE_CONFIG;
export type ServiceConfig<T extends keyof InfrastructureConfig> = InfrastructureConfig[T];