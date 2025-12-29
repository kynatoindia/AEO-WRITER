import { z } from 'zod';

// Project validation schemas
export const projectStatusSchema = z.enum(['draft', 'researching', 'planning', 'writing', 'completed', 'error']);
export const contentToneSchema = z.enum(['professional', 'witty', 'data-driven']);
export const contentFormatSchema = z.enum(['how-to', 'listicle', 'case-study']);
export const sectionStatusSchema = z.enum(['pending', 'writing', 'completed']);

export const createProjectSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(200, 'Topic must be less than 200 characters'),
  competitor_urls: z.array(z.string().url('Invalid URL')).min(1, 'At least one competitor URL is required').max(5, 'Maximum 5 competitor URLs allowed'),
  tone: contentToneSchema,
  format: contentFormatSchema,
  brand_document_path: z.string().optional(),
});

export const updateProjectSchema = z.object({
  topic: z.string().min(3).max(200).optional(),
  status: projectStatusSchema.optional(),
  competitor_urls: z.array(z.string().url()).min(1).max(5).optional(),
  tone: contentToneSchema.optional(),
  format: contentFormatSchema.optional(),
  brand_document_path: z.string().optional(),
  openai_thread_id: z.string().optional(),
  blueprint: z.any().optional(), // JSONB field
  generated_content: z.string().optional(),
  seo_metadata: z.any().optional(), // JSONB field
  token_usage: z.any().optional(), // JSONB field
  cost_breakdown: z.any().optional(), // JSONB field
});

// Content section validation schemas
export const subSectionSchema = z.object({
  id: z.string(),
  heading: z.string().min(1, 'Heading is required'),
  keyPoints: z.array(z.string()),
});

export const contentElementSchema = z.object({
  type: z.enum(['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block']),
  properties: z.record(z.string(), z.unknown()),
});

export const createContentSectionSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  section_order: z.number().int().positive('Section order must be positive'),
  heading: z.string().min(1, 'Heading is required'),
  goal: z.string().optional(),
  sub_sections: z.array(subSectionSchema).default([]),
  content_elements: z.array(z.string()).default([]),
  data_sources: z.array(z.string().url('Invalid data source URL')).default([]),
});

export const updateContentSectionSchema = z.object({
  section_order: z.number().int().positive().optional(),
  heading: z.string().min(1).optional(),
  goal: z.string().optional(),
  sub_sections: z.array(subSectionSchema).optional(),
  content_elements: z.array(z.string()).optional(),
  data_sources: z.array(z.string().url()).optional(),
  generated_content: z.string().optional(),
  status: sectionStatusSchema.optional(),
});

// User profile validation schemas
export const subscriptionPlanSchema = z.enum(['free', 'pro', 'enterprise']);

export const updateUserProfileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
  subscription_plan: subscriptionPlanSchema.optional(),
});

// Usage analytics validation schemas
export const createUsageAnalyticsSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  project_id: z.string().uuid('Invalid project ID').optional(),
  operation_type: z.string().min(1, 'Operation type is required'),
  tokens_used: z.number().int().nonnegative('Tokens used must be non-negative'),
  cost_usd: z.number().nonnegative('Cost must be non-negative'),
  api_provider: z.string().min(1, 'API provider is required'),
  model_used: z.string().min(1, 'Model is required'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

// SEO metadata validation schema
export const seoMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(60, 'Title must be less than 60 characters'),
  metaDescription: z.string().min(1, 'Meta description is required').max(160, 'Meta description must be less than 160 characters'),
  targetKeywords: z.array(z.string()).min(1, 'At least one target keyword is required'),
  focusKeyword: z.string().min(1, 'Focus keyword is required'),
  readabilityScore: z.number().min(0).max(100).optional(),
});

// Content blueprint validation schema
export const contentBlueprintSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    heading: z.string().min(1, 'Section heading is required'),
    goal: z.string().min(1, 'Section goal is required'),
    subSections: z.array(subSectionSchema),
    contentElements: z.array(contentElementSchema),
    dataSources: z.array(z.string().url('Invalid data source URL')),
    order: z.number().int().positive('Order must be positive'),
  })),
  seoMetadata: seoMetadataSchema,
  estimatedLength: z.number().int().positive('Estimated length must be positive'),
  targetKeywords: z.array(z.string()).min(1, 'At least one target keyword is required'),
});

// Token usage validation schema
export const tokenUsageSchema = z.object({
  research: z.number().int().nonnegative('Research tokens must be non-negative'),
  planning: z.number().int().nonnegative('Planning tokens must be non-negative'),
  writing: z.number().int().nonnegative('Writing tokens must be non-negative'),
  total: z.number().int().nonnegative('Total tokens must be non-negative'),
});

// Cost breakdown validation schema
export const costBreakdownSchema = z.object({
  research: z.number().nonnegative('Research cost must be non-negative'),
  planning: z.number().nonnegative('Planning cost must be non-negative'),
  writing: z.number().nonnegative('Writing cost must be non-negative'),
  total: z.number().nonnegative('Total cost must be non-negative'),
});

// File upload validation schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: 'File is required' }),
  maxSize: z.number().default(10 * 1024 * 1024), // 10MB default
  allowedTypes: z.array(z.string()).default(['application/pdf']),
});

// API response validation schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().optional(),
});

// Query parameter validation schemas
export const projectQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  tone: contentToneSchema.optional(),
  format: contentFormatSchema.optional(),
  search: z.string().optional(),
}).merge(paginationSchema);

export const usageAnalyticsQuerySchema = z.object({
  operation_type: z.string().optional(),
  api_provider: z.string().optional(),
  model_used: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
}).merge(paginationSchema);