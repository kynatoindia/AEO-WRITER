import { z } from 'zod';
import { 
  Project, 
  ContentBlueprint, 
  SEOMetadata, 
  TokenUsage, 
  CostBreakdown,
  ContentSection,
  SubSection,
  ContentElement
} from '@/lib/types';
import { Database } from '@/lib/database.types';

// Zod schemas for runtime validation of JSON fields
const SubSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  keyPoints: z.array(z.string())
});

const ContentElementSchema = z.object({
  type: z.enum(['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block']),
  properties: z.record(z.string(), z.unknown())
});

const ContentSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  goal: z.string(),
  subSections: z.array(SubSectionSchema),
  contentElements: z.array(ContentElementSchema),
  dataSources: z.array(z.string()),
  order: z.number(),
  status: z.enum(['pending', 'writing', 'completed']).optional(),
  generatedContent: z.string().optional()
});

const SEOMetadataSchema = z.object({
  title: z.string(),
  metaDescription: z.string(),
  targetKeywords: z.array(z.string()),
  focusKeyword: z.string(),
  readabilityScore: z.number().optional()
});

const ContentBlueprintSchema = z.object({
  sections: z.array(ContentSectionSchema),
  seoMetadata: SEOMetadataSchema,
  estimatedLength: z.number(),
  targetKeywords: z.array(z.string())
});

const TokenUsageSchema = z.object({
  research: z.number(),
  planning: z.number(),
  writing: z.number(),
  total: z.number()
});

const CostBreakdownSchema = z.object({
  research: z.number(),
  planning: z.number(),
  writing: z.number(),
  total: z.number()
});

/**
 * Safely transforms a Supabase database row to a typed Project
 */
export function transformDatabaseRowToProject(
  row: Database['public']['Tables']['projects']['Row']
): Project {
  // Safely parse JSON fields with fallbacks
  const blueprint = safeParseJSON(row.blueprint, ContentBlueprintSchema);
  const seoMetadata = safeParseJSON(row.seo_metadata, SEOMetadataSchema);
  const tokenUsage = safeParseJSON(row.token_usage, TokenUsageSchema);
  const costBreakdown = safeParseJSON(row.cost_breakdown, CostBreakdownSchema);

  return {
    id: row.id,
    user_id: row.user_id,
    topic: row.topic,
    status: row.status,
    competitor_urls: row.competitor_urls,
    tone: row.tone,
    format: row.format,
    brand_document_path: row.brand_document_path ?? undefined,
    openai_thread_id: row.openai_thread_id ?? undefined,
    blueprint,
    generated_content: row.generated_content ?? undefined,
    seo_metadata: seoMetadata,
    token_usage: tokenUsage,
    cost_breakdown: costBreakdown,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Safely parses JSON with schema validation
 */
function safeParseJSON<T>(
  jsonValue: unknown,
  schema: z.ZodSchema<T>
): T | undefined {
  if (!jsonValue) return undefined;
  
  try {
    // If it's already an object, validate it directly
    if (typeof jsonValue === 'object') {
      const result = schema.safeParse(jsonValue);
      return result.success ? result.data : undefined;
    }
    
    // If it's a string, try to parse it as JSON first
    if (typeof jsonValue === 'string') {
      const parsed = JSON.parse(jsonValue);
      const result = schema.safeParse(parsed);
      return result.success ? result.data : undefined;
    }
    
    return undefined;
  } catch (error) {
    console.warn('Failed to parse JSON field:', error);
    return undefined;
  }
}

/**
 * Transforms a Project to database insert format
 */
export function transformProjectToInsert(
  project: Omit<Project, 'id' | 'created_at' | 'updated_at'>
): Database['public']['Tables']['projects']['Insert'] {
  return {
    user_id: project.user_id,
    topic: project.topic,
    status: project.status as any,
    competitor_urls: project.competitor_urls,
    tone: project.tone,
    format: project.format,
    brand_document_path: project.brand_document_path,
    openai_thread_id: project.openai_thread_id,
    blueprint: project.blueprint ? JSON.stringify(project.blueprint) : null,
    generated_content: project.generated_content,
    seo_metadata: project.seo_metadata ? JSON.stringify(project.seo_metadata) : null,
    token_usage: project.token_usage ? JSON.stringify(project.token_usage) : null,
    cost_breakdown: project.cost_breakdown ? JSON.stringify(project.cost_breakdown) : null
  };
}

/**
 * Transforms a Project to database update format
 */
export function transformProjectToUpdate(
  project: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>
): Database['public']['Tables']['projects']['Update'] {
  const update: Database['public']['Tables']['projects']['Update'] = {};
  
  if (project.user_id !== undefined) update.user_id = project.user_id;
  if (project.topic !== undefined) update.topic = project.topic;
  if (project.status !== undefined) update.status = project.status as any;
  if (project.competitor_urls !== undefined) update.competitor_urls = project.competitor_urls;
  if (project.tone !== undefined) update.tone = project.tone;
  if (project.format !== undefined) update.format = project.format;
  if (project.brand_document_path !== undefined) update.brand_document_path = project.brand_document_path;
  if (project.openai_thread_id !== undefined) update.openai_thread_id = project.openai_thread_id;
  if (project.blueprint !== undefined) {
    update.blueprint = project.blueprint ? JSON.stringify(project.blueprint) : null;
  }
  if (project.generated_content !== undefined) update.generated_content = project.generated_content;
  if (project.seo_metadata !== undefined) {
    update.seo_metadata = project.seo_metadata ? JSON.stringify(project.seo_metadata) : null;
  }
  if (project.token_usage !== undefined) {
    update.token_usage = project.token_usage ? JSON.stringify(project.token_usage) : null;
  }
  if (project.cost_breakdown !== undefined) {
    update.cost_breakdown = project.cost_breakdown ? JSON.stringify(project.cost_breakdown) : null;
  }
  
  return update;
}

/**
 * Type guard to check if a value is a valid ContentBlueprint
 */
export function isValidContentBlueprint(value: unknown): value is ContentBlueprint {
  const result = ContentBlueprintSchema.safeParse(value);
  return result.success;
}

/**
 * Type guard to check if a value is a valid SEOMetadata
 */
export function isValidSEOMetadata(value: unknown): value is SEOMetadata {
  const result = SEOMetadataSchema.safeParse(value);
  return result.success;
}

/**
 * Type guard to check if a value is a valid TokenUsage
 */
export function isValidTokenUsage(value: unknown): value is TokenUsage {
  const result = TokenUsageSchema.safeParse(value);
  return result.success;
}

/**
 * Type guard to check if a value is a valid CostBreakdown
 */
export function isValidCostBreakdown(value: unknown): value is CostBreakdown {
  const result = CostBreakdownSchema.safeParse(value);
  return result.success;
}

/**
 * Validates and transforms an array of database rows to Projects
 */
export function transformDatabaseRowsToProjects(
  rows: Database['public']['Tables']['projects']['Row'][]
): Project[] {
  return rows.map(transformDatabaseRowToProject).filter(Boolean);
}

/**
 * Creates a safe project response that handles potential undefined JSON fields
 */
export function createSafeProjectResponse(project: Project) {
  return {
    ...project,
    blueprint: project.blueprint || null,
    seo_metadata: project.seo_metadata || null,
    token_usage: project.token_usage || null,
    cost_breakdown: project.cost_breakdown || null
  };
}