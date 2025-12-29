import { z } from 'zod';

// Base validation schemas for enum types
export const projectStatusSchema = z.enum(['draft', 'researching', 'planning', 'writing', 'completed', 'error']);
export const contentToneSchema = z.enum(['professional', 'witty', 'data-driven']);
export const contentFormatSchema = z.enum(['how-to', 'listicle', 'case-study']);
export const sectionStatusSchema = z.enum(['pending', 'writing', 'completed']);
export const subscriptionPlanSchema = z.enum(['free', 'pro', 'enterprise']);
export const contentElementTypeSchema = z.enum(['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block']);
export const operationTypeSchema = z.enum(['research', 'planning', 'writing', 'polish', 'export']);
export const apiProviderSchema = z.enum(['openai', 'tavily']);
export const exportFormatSchema = z.enum(['markdown', 'html', 'pdf']);
export const themeSchema = z.enum(['light', 'dark', 'system']);
export const billingCycleSchema = z.enum(['monthly', 'yearly']);
export const fileUploadStatusSchema = z.enum(['pending', 'uploading', 'completed', 'error']);
export const serviceStatusSchema = z.enum(['up', 'down', 'degraded']);
export const healthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
export const jobResultSchema = z.enum(['success', 'failure', 'partial']);

// URL validation with better error messages
const urlSchema = z.string().refine(
  (val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid URL format' }
);

// UUID validation
const uuidSchema = z.string().refine(
  (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val),
  { message: 'Invalid UUID format' }
);

// DateTime validation
const dateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid datetime format' }
);

// Project validation schemas
export const createProjectSchema = z.object({
  topic: z.string()
    .min(3, 'Topic must be at least 3 characters long')
    .max(200, 'Topic must be less than 200 characters'),
  competitorUrls: z.array(urlSchema)
    .min(1, 'At least one competitor URL is required')
    .max(5, 'Maximum 5 competitor URLs allowed'),
  tone: contentToneSchema,
  format: contentFormatSchema,
  brandDocument: z.instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
    .refine(file => file.type === 'application/pdf', 'Only PDF files are allowed')
    .optional()
});

export const updateProjectSchema = z.object({
  topic: z.string().min(3).max(200).optional(),
  competitorUrls: z.array(urlSchema).min(1).max(5).optional(),
  tone: contentToneSchema.optional(),
  format: contentFormatSchema.optional(),
  status: projectStatusSchema.optional(),
  brandDocumentPath: z.string().optional(),
  openaiThreadId: z.string().optional(),
  blueprint: z.any().optional(), // JSONB field
  generatedContent: z.string().optional(),
  seoMetadata: z.any().optional(), // JSONB field
  tokenUsage: z.any().optional(), // JSONB field
  costBreakdown: z.any().optional() // JSONB field
});

// Content section validation schemas
export const subSectionSchema = z.object({
  id: z.string(),
  heading: z.string().min(1, 'Sub-section heading is required'),
  keyPoints: z.array(z.string())
});

export const contentElementSchema = z.object({
  type: contentElementTypeSchema,
  properties: z.record(z.string(), z.unknown())
});

export const contentSectionSchema = z.object({
  id: z.string(),
  heading: z.string().min(1, 'Section heading is required'),
  goal: z.string().min(1, 'Section goal is required'),
  subSections: z.array(subSectionSchema),
  contentElements: z.array(contentElementSchema),
  dataSources: z.array(urlSchema),
  order: z.number().int().positive('Order must be positive'),
  status: sectionStatusSchema.optional(),
  generatedContent: z.string().optional()
});

export const createContentSectionSchema = z.object({
  projectId: uuidSchema,
  sectionOrder: z.number().int().positive('Section order must be positive'),
  heading: z.string().min(1, 'Heading is required'),
  goal: z.string().optional(),
  subSections: z.array(subSectionSchema).default([]),
  contentElements: z.array(z.string()).default([]),
  dataSources: z.array(urlSchema).default([])
});

export const updateContentSectionSchema = z.object({
  sectionOrder: z.number().int().positive().optional(),
  heading: z.string().min(1).optional(),
  goal: z.string().optional(),
  subSections: z.array(subSectionSchema).optional(),
  contentElements: z.array(z.string()).optional(),
  dataSources: z.array(urlSchema).optional(),
  generatedContent: z.string().optional(),
  status: sectionStatusSchema.optional()
});

// SEO metadata validation schema
export const seoMetadataSchema = z.object({
  title: z.string()
    .min(1, 'SEO title is required')
    .max(60, 'SEO title must be less than 60 characters'),
  metaDescription: z.string()
    .min(1, 'Meta description is required')
    .max(160, 'Meta description must be less than 160 characters'),
  targetKeywords: z.array(z.string())
    .min(1, 'At least one target keyword is required'),
  focusKeyword: z.string().min(1, 'Focus keyword is required'),
  readabilityScore: z.number().min(0).max(100).optional()
});

// Content blueprint validation schema
export const contentBlueprintSchema = z.object({
  sections: z.array(contentSectionSchema),
  seoMetadata: seoMetadataSchema,
  estimatedLength: z.number().int().positive('Estimated length must be positive'),
  targetKeywords: z.array(z.string()).min(1, 'At least one target keyword is required')
});

// Token usage validation schema
export const tokenUsageSchema = z.object({
  research: z.number().int().nonnegative('Research tokens must be non-negative'),
  planning: z.number().int().nonnegative('Planning tokens must be non-negative'),
  writing: z.number().int().nonnegative('Writing tokens must be non-negative'),
  total: z.number().int().nonnegative('Total tokens must be non-negative')
});

// Cost breakdown validation schema
export const costBreakdownSchema = z.object({
  research: z.number().nonnegative('Research cost must be non-negative'),
  planning: z.number().nonnegative('Planning cost must be non-negative'),
  writing: z.number().nonnegative('Writing cost must be non-negative'),
  total: z.number().nonnegative('Total cost must be non-negative')
});

// User profile validation schemas
export const updateUserProfileSchema = z.object({
  fullName: z.string().min(1, 'Name is required').optional(),
  avatarUrl: urlSchema.optional(),
  subscriptionPlan: subscriptionPlanSchema.optional()
});

export const userPreferencesSchema = z.object({
  defaultTone: contentToneSchema,
  defaultFormat: contentFormatSchema,
  emailNotifications: z.boolean(),
  autoSave: z.boolean(),
  theme: z.enum(['light', 'dark', 'system'])
});

// Usage analytics validation schemas
export const createUsageAnalyticsSchema = z.object({
  userId: uuidSchema,
  projectId: uuidSchema.optional(),
  operationType: operationTypeSchema,
  tokensUsed: z.number().int().nonnegative('Tokens used must be non-negative'),
  costUsd: z.number().nonnegative('Cost must be non-negative'),
  apiProvider: apiProviderSchema,
  modelUsed: z.string().min(1, 'Model is required'),
  metadata: z.record(z.string(), z.unknown()).default({})
});

// API request validation schemas
export const researchRequestSchema = z.object({
  competitorUrls: z.array(urlSchema)
    .min(1, 'At least one competitor URL is required')
    .max(5, 'Maximum 5 competitor URLs allowed'),
  brandDocument: z.string().optional()
});

export const blueprintRequestSchema = z.object({
  researchData: z.object({
    competitorData: z.array(z.any()),
    brandAnalysis: z.any().optional(),
    researchSummary: z.any()
  }),
  preferences: z.object({
    tone: contentToneSchema,
    format: contentFormatSchema,
    targetLength: z.number().int().positive()
  })
});

export const writeRequestSchema = z.object({
  projectId: uuidSchema,
  blueprint: contentBlueprintSchema,
  sectionIndex: z.number().int().nonnegative().optional(),
  resumeFromSection: z.string().optional()
});

export const exportRequestSchema = z.object({
  projectId: uuidSchema,
  format: exportFormatSchema,
  includeMetadata: z.boolean()
});

// File upload validation schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: 'File is required' }),
  maxSize: z.number().default(10 * 1024 * 1024), // 10MB default
  allowedTypes: z.array(z.string()).default(['application/pdf'])
});

// API response validation schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    retryable: z.boolean(),
    timestamp: z.string().optional(),
    requestId: z.string().optional()
  }).optional(),
  timestamp: z.string()
});

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().optional()
});

export const paginationInfoSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

// Query parameter validation schemas
export const projectQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  tone: contentToneSchema.optional(),
  format: contentFormatSchema.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'topic']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
}).merge(paginationSchema);

export const usageAnalyticsQuerySchema = z.object({
  operationType: operationTypeSchema.optional(),
  apiProvider: apiProviderSchema.optional(),
  modelUsed: z.string().optional(),
  startDate: dateTimeSchema.optional(),
  endDate: dateTimeSchema.optional()
}).merge(paginationSchema);

// Real-time event validation schemas
export const realtimeEventSchema = z.object({
  type: z.enum(['project_update', 'section_complete', 'error', 'progress']),
  projectId: uuidSchema,
  data: z.unknown(),
  timestamp: z.string()
});

export const projectUpdateEventSchema = z.object({
  type: z.literal('project_update'),
  projectId: uuidSchema,
  data: z.object({
    status: projectStatusSchema,
    progress: z.number().min(0).max(100),
    currentSection: z.string().optional()
  }),
  timestamp: z.string()
});

export const sectionCompleteEventSchema = z.object({
  type: z.literal('section_complete'),
  projectId: uuidSchema,
  data: z.object({
    sectionId: z.string(),
    content: z.string(),
    tokensUsed: z.number().int().nonnegative()
  }),
  timestamp: z.string()
});

export const progressEventSchema = z.object({
  type: z.literal('progress'),
  projectId: uuidSchema,
  data: z.object({
    operation: operationTypeSchema,
    progress: z.number().min(0).max(100),
    message: z.string()
  }),
  timestamp: z.string()
});

// External service configuration schemas
export const openaiConfigSchema = z.object({
  apiKey: z.string().min(1, 'OpenAI API key is required'),
  model: z.string().min(1, 'Model is required'),
  maxTokens: z.number().int().positive('Max tokens must be positive'),
  temperature: z.number().min(0).max(2, 'Temperature must be between 0 and 2'),
  timeout: z.number().int().positive().optional()
});

export const tavilyConfigSchema = z.object({
  apiKey: z.string().min(1, 'Tavily API key is required'),
  maxResults: z.number().int().positive('Max results must be positive'),
  includeContent: z.boolean(),
  timeout: z.number().int().positive().optional()
});

// Health check schema
export const healthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  services: z.object({
    database: z.enum(['up', 'down']),
    openai: z.enum(['up', 'down']),
    tavily: z.enum(['up', 'down']),
    storage: z.enum(['up', 'down'])
  }),
  timestamp: z.string()
});

// Service response schema
export const serviceResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  tokensUsed: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  requestId: z.string().optional()
});

// Batch operation schemas
export const batchProjectUpdateSchema = z.object({
  projectIds: z.array(uuidSchema).min(1, 'At least one project ID is required'),
  updates: updateProjectSchema
});

export const batchDeleteSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID is required'),
  confirmDelete: z.boolean().refine(val => val === true, 'Delete confirmation required')
});

// Export type inference helpers
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ContentSectionInput = z.infer<typeof contentSectionSchema>;
export type BlueprintInput = z.infer<typeof contentBlueprintSchema>;
export type ResearchRequestInput = z.infer<typeof researchRequestSchema>;
export type BlueprintRequestInput = z.infer<typeof blueprintRequestSchema>;
export type WriteRequestInput = z.infer<typeof writeRequestSchema>;
export type ExportRequestInput = z.infer<typeof exportRequestSchema>;
export type ProjectQueryInput = z.infer<typeof projectQuerySchema>;
export type UsageAnalyticsQueryInput = z.infer<typeof usageAnalyticsQuerySchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type APIResponseType<T = unknown> = z.infer<typeof apiResponseSchema> & { data?: T };
export type OpenAIConfigInput = z.infer<typeof openaiConfigSchema>;
export type TavilyConfigInput = z.infer<typeof tavilyConfigSchema>;
export type HealthCheckResponseType = z.infer<typeof healthCheckResponseSchema>;
export type ServiceResponseType<T = unknown> = z.infer<typeof serviceResponseSchema> & { data?: T };
export type BatchProjectUpdateInput = z.infer<typeof batchProjectUpdateSchema>;
export type BatchDeleteInput = z.infer<typeof batchDeleteSchema>;

// Additional validation schemas for comprehensive coverage
export const competitorDataSchema = z.object({
  url: urlSchema,
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  headings: z.array(z.string()),
  wordCount: z.number().int().nonnegative('Word count must be non-negative'),
  keyTopics: z.array(z.string()),
  metaDescription: z.string().optional(),
  structuredData: z.record(z.string(), z.unknown()).optional(),
  lastUpdated: dateTimeSchema.optional()
});

export const brandAnalysisSchema = z.object({
  tone: z.string().min(1, 'Tone is required'),
  keyMessages: z.array(z.string()),
  targetAudience: z.string().min(1, 'Target audience is required'),
  brandValues: z.array(z.string()),
  competitiveAdvantages: z.array(z.string())
});

export const researchSummarySchema = z.object({
  topCompetitors: z.array(z.string()),
  keyInsights: z.array(z.string()),
  contentOpportunities: z.array(z.string()),
  recommendedApproach: z.string().min(1, 'Recommended approach is required'),
  targetKeywords: z.array(z.string())
});

export const contentAnalysisSchema = z.object({
  keyTopics: z.array(z.string()),
  contentGaps: z.array(z.string()),
  seoOpportunities: z.array(z.string()),
  structureRecommendations: z.array(z.string()),
  competitorStrengths: z.array(z.string()),
  targetKeywords: z.array(z.string())
});

export const writingContextSchema = z.object({
  blueprint: contentBlueprintSchema,
  previousSections: z.array(z.string()),
  currentSection: contentSectionSchema,
  brandVoice: z.string().min(1, 'Brand voice is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  researchData: z.object({
    competitorData: z.array(competitorDataSchema),
    brandAnalysis: brandAnalysisSchema.optional(),
    researchSummary: researchSummarySchema
  }),
  seoRequirements: z.object({
    targetKeywords: z.array(z.string()),
    focusKeyword: z.string().min(1, 'Focus keyword is required'),
    keywordDensity: z.number().min(0).max(100, 'Keyword density must be between 0 and 100'),
    readabilityTarget: z.number().min(0).max(100, 'Readability target must be between 0 and 100'),
    includeSchema: z.boolean()
  })
});

export const userSubscriptionSchema = z.object({
  plan: subscriptionPlanSchema,
  tokensUsed: z.number().int().nonnegative('Tokens used must be non-negative'),
  tokensLimit: z.number().int().positive('Tokens limit must be positive'),
  projectsUsed: z.number().int().nonnegative('Projects used must be non-negative'),
  projectsLimit: z.number().int().positive('Projects limit must be positive'),
  billingCycle: billingCycleSchema.optional(),
  nextBillingDate: dateTimeSchema.optional(),
  isActive: z.boolean()
});

export const usageReportSchema = z.object({
  period: z.object({
    start: dateTimeSchema,
    end: dateTimeSchema
  }),
  totalTokens: z.number().int().nonnegative('Total tokens must be non-negative'),
  totalCost: z.number().nonnegative('Total cost must be non-negative'),
  operationBreakdown: z.record(operationTypeSchema, z.object({
    tokens: z.number().int().nonnegative(),
    cost: z.number().nonnegative(),
    count: z.number().int().nonnegative()
  })),
  modelBreakdown: z.record(z.string(), z.object({
    tokens: z.number().int().nonnegative(),
    cost: z.number().nonnegative(),
    count: z.number().int().nonnegative()
  }))
});

export const fileUploadConfigSchema = z.object({
  maxSize: z.number().int().positive('Max size must be positive'),
  allowedTypes: z.array(z.string()).min(1, 'At least one allowed type is required'),
  bucket: z.string().min(1, 'Bucket name is required')
});

// Real-time event schemas
export const baseRealtimeEventSchema = z.object({
  type: z.enum(['project_update', 'section_complete', 'error', 'progress', 'job_complete']),
  projectId: uuidSchema,
  userId: uuidSchema,
  data: z.unknown(),
  timestamp: dateTimeSchema
});

export const errorEventSchema = baseRealtimeEventSchema.extend({
  type: z.literal('error'),
  data: z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
      retryable: z.boolean()
    }),
    operation: operationTypeSchema,
    recoverable: z.boolean(),
    retryAfter: z.number().int().positive().optional()
  })
});

export const jobCompleteEventSchema = baseRealtimeEventSchema.extend({
  type: z.literal('job_complete'),
  data: z.object({
    jobId: z.string().min(1, 'Job ID is required'),
    operation: operationTypeSchema,
    result: jobResultSchema,
    summary: z.object({
      tokensUsed: z.number().int().nonnegative(),
      cost: z.number().nonnegative(),
      processingTime: z.number().nonnegative()
    }),
    output: z.unknown().optional()
  })
});

// Component prop validation schemas
export const projectFormDataSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(200, 'Topic must be less than 200 characters'),
  competitorUrls: z.array(urlSchema).min(1, 'At least one competitor URL is required').max(5, 'Maximum 5 competitor URLs allowed'),
  tone: contentToneSchema,
  format: contentFormatSchema,
  brandDocument: z.instanceof(File).optional()
});

export const blueprintFormDataSchema = z.object({
  sections: z.array(contentSectionSchema),
  seoMetadata: seoMetadataSchema,
  targetKeywords: z.array(z.string()).min(1, 'At least one target keyword is required')
});

// Database operation schemas
export const databaseProjectSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  topic: z.string().min(1, 'Topic is required'),
  status: projectStatusSchema,
  competitor_urls: z.array(urlSchema),
  tone: contentToneSchema,
  format: contentFormatSchema,
  brand_document_path: z.string().optional(),
  openai_thread_id: z.string().optional(),
  blueprint: z.any().optional(), // JSONB
  generated_content: z.string().optional(),
  seo_metadata: z.any().optional(), // JSONB
  token_usage: z.any().optional(), // JSONB
  cost_breakdown: z.any().optional(), // JSONB
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema
});

export const databaseContentSectionSchema = z.object({
  id: uuidSchema,
  project_id: uuidSchema,
  section_order: z.number().int().nonnegative('Section order must be non-negative'),
  heading: z.string().min(1, 'Heading is required'),
  goal: z.string().optional(),
  sub_sections: z.array(subSectionSchema),
  content_elements: z.array(z.string()),
  data_sources: z.array(urlSchema),
  generated_content: z.string().optional(),
  status: sectionStatusSchema,
  created_at: dateTimeSchema
});

export const databaseUserProfileSchema = z.object({
  id: uuidSchema,
  email: z.string().email('Invalid email format'),
  full_name: z.string().optional(),
  avatar_url: urlSchema.optional(),
  subscription_plan: subscriptionPlanSchema,
  tokens_used: z.number().int().nonnegative('Tokens used must be non-negative'),
  tokens_limit: z.number().int().positive('Tokens limit must be positive'),
  projects_used: z.number().int().nonnegative('Projects used must be non-negative'),
  projects_limit: z.number().int().positive('Projects limit must be positive'),
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema
});

export const databaseUsageAnalyticsSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  project_id: uuidSchema.optional(),
  operation_type: operationTypeSchema,
  tokens_used: z.number().int().nonnegative('Tokens used must be non-negative').optional(),
  cost_usd: z.number().nonnegative('Cost must be non-negative').optional(),
  api_provider: apiProviderSchema,
  model_used: z.string().min(1, 'Model is required'),
  metadata: z.record(z.string(), z.unknown()),
  created_at: dateTimeSchema
});

// Additional type exports
export type CompetitorDataInput = z.infer<typeof competitorDataSchema>;
export type BrandAnalysisInput = z.infer<typeof brandAnalysisSchema>;
export type ResearchSummaryInput = z.infer<typeof researchSummarySchema>;
export type ContentAnalysisInput = z.infer<typeof contentAnalysisSchema>;
export type WritingContextInput = z.infer<typeof writingContextSchema>;
export type UserSubscriptionInput = z.infer<typeof userSubscriptionSchema>;
export type UsageReportInput = z.infer<typeof usageReportSchema>;
export type FileUploadConfigInput = z.infer<typeof fileUploadConfigSchema>;
export type ProjectFormDataInput = z.infer<typeof projectFormDataSchema>;
export type BlueprintFormDataInput = z.infer<typeof blueprintFormDataSchema>;
export type DatabaseProjectInput = z.infer<typeof databaseProjectSchema>;
export type DatabaseContentSectionInput = z.infer<typeof databaseContentSectionSchema>;
export type DatabaseUserProfileInput = z.infer<typeof databaseUserProfileSchema>;
export type DatabaseUsageAnalyticsInput = z.infer<typeof databaseUsageAnalyticsSchema>;