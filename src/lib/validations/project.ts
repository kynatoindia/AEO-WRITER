import { z } from 'zod';

// Project creation validation schema
export const createProjectSchema = z.object({
  topic: z.string()
    .min(3, 'Topic must be at least 3 characters long')
    .max(200, 'Topic must be less than 200 characters'),
  competitorUrls: z.array(z.string().url('Invalid URL format'))
    .min(1, 'At least one competitor URL is required')
    .max(5, 'Maximum 5 competitor URLs allowed'),
  tone: z.enum(['professional', 'witty', 'data-driven'], {
    message: 'Please select a valid tone'
  }),
  format: z.enum(['how-to', 'listicle', 'case-study'], {
    message: 'Please select a valid format'
  }),
  brandDocument: z.instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
    .refine(file => file.type === 'application/pdf', 'Only PDF files are allowed')
    .optional()
});

// Project update validation schema
export const updateProjectSchema = z.object({
  topic: z.string()
    .min(3, 'Topic must be at least 3 characters long')
    .max(200, 'Topic must be less than 200 characters')
    .optional(),
  competitorUrls: z.array(z.string().url('Invalid URL format'))
    .min(1, 'At least one competitor URL is required')
    .max(5, 'Maximum 5 competitor URLs allowed')
    .optional(),
  tone: z.enum(['professional', 'witty', 'data-driven'])
    .optional(),
  format: z.enum(['how-to', 'listicle', 'case-study'])
    .optional(),
  status: z.enum(['draft', 'researching', 'planning', 'writing', 'completed', 'error'])
    .optional()
});

// Content section validation schema
export const contentSectionSchema = z.object({
  id: z.string(),
  heading: z.string().min(1, 'Section heading is required'),
  goal: z.string().min(1, 'Section goal is required'),
  subSections: z.array(z.object({
    id: z.string(),
    heading: z.string().min(1, 'Sub-section heading is required'),
    keyPoints: z.array(z.string())
  })),
  contentElements: z.array(z.object({
    type: z.enum(['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block']),
    properties: z.record(z.string(), z.any())
  })),
  dataSources: z.array(z.string()),
  order: z.number().min(0)
});

// Blueprint validation schema
export const blueprintSchema = z.object({
  sections: z.array(contentSectionSchema),
  seoMetadata: z.object({
    title: z.string().min(1, 'SEO title is required').max(60, 'SEO title must be less than 60 characters'),
    metaDescription: z.string().min(1, 'Meta description is required').max(160, 'Meta description must be less than 160 characters'),
    targetKeywords: z.array(z.string()).min(1, 'At least one target keyword is required'),
    focusKeyword: z.string().min(1, 'Focus keyword is required')
  }),
  estimatedLength: z.number().min(500, 'Content must be at least 500 words'),
  targetKeywords: z.array(z.string()).min(1, 'At least one target keyword is required')
});

// Research request validation schema
export const researchRequestSchema = z.object({
  competitorUrls: z.array(z.string().url('Invalid URL format'))
    .min(1, 'At least one competitor URL is required')
    .max(5, 'Maximum 5 competitor URLs allowed'),
  brandDocument: z.string().optional()
});

// Export types for use in components
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ContentSectionInput = z.infer<typeof contentSectionSchema>;
export type BlueprintInput = z.infer<typeof blueprintSchema>;
export type ResearchRequestInput = z.infer<typeof researchRequestSchema>;