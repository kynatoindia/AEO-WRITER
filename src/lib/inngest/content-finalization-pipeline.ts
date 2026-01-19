import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createRouteClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type {
  ContentBlueprint,
  SEOMetadata,
  Project
} from '@/lib/types';

// Schema for enhanced SEO metadata generation
const EnhancedSEOMetadataSchema = z.object({
  title: z.string().min(30).max(60),
  metaDescription: z.string().min(120).max(160),
  focusKeyword: z.string(),
  targetKeywords: z.array(z.string()).min(5).max(10),
  readabilityScore: z.number().min(0).max(100),
  seoScore: z.number().min(0).max(100),
  headingStructure: z.object({
    h1: z.string(),
    h2: z.array(z.string()),
    h3: z.array(z.string())
  }),
  internalLinks: z.array(z.object({
    text: z.string(),
    url: z.string(),
    context: z.string()
  })),
  imageAltTexts: z.array(z.string())
});

// Schema for FAQ generation
const FAQSchema = z.object({
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    category: z.string().optional(),
    keywords: z.array(z.string()).optional()
  })).min(5).max(15)
});

// Schema for structured data generation
const StructuredDataSchema = z.object({
  article: z.object({
    '@type': z.literal('Article'),
    headline: z.string(),
    description: z.string(),
    author: z.object({
      '@type': z.literal('Person'),
      name: z.string()
    }),
    datePublished: z.string(),
    dateModified: z.string(),
    wordCount: z.number(),
    keywords: z.array(z.string())
  }),
  faqPage: z.object({
    '@type': z.literal('FAQPage'),
    mainEntity: z.array(z.object({
      '@type': z.literal('Question'),
      name: z.string(),
      acceptedAnswer: z.object({
        '@type': z.literal('Answer'),
        text: z.string()
      })
    }))
  }).optional(),
  howTo: z.object({
    '@type': z.literal('HowTo'),
    name: z.string(),
    description: z.string(),
    step: z.array(z.object({
      '@type': z.literal('HowToStep'),
      name: z.string(),
      text: z.string()
    }))
  }).optional()
});

// Schema for key takeaways and summary
const TakeawaysSchema = z.object({
  keyTakeaways: z.array(z.string()).min(3).max(7),
  executiveSummary: z.string().min(100).max(300),
  actionItems: z.array(z.string()).min(2).max(5),
  nextSteps: z.array(z.string()).min(1).max(3),
  relatedTopics: z.array(z.string()).min(3).max(6)
});

// Content finalization workflow - Main orchestrator
export const finalizeContent = inngest.createFunction(
  {
    id: 'finalize-content',
    concurrency: [
      {
        limit: CONCURRENCY_LIMITS['content/finalize'] || 2,
        key: 'event.data.projectId',
      },
      {
        limit: 1,
        scope: "account",
        key: '"gemini-quota-limit"', // Global Gemini quota limit protection
      }
    ],
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/finalize' },
  async ({ event, step }) => {
    const { userId, projectId, generatedContent, blueprint } = event.data;

    const idempotencyKey = generateIdempotencyKey.userOperation(userId, `finalize_${projectId}`);

    // Check for duplicate finalization requests
    const duplicateCheck = await step.run('check-duplicate-finalization', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult as string) : null;
    });

    if (duplicateCheck) {
      console.log(`Duplicate finalization request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }

    // Update project status to finalizing
    await step.run('update-project-status-finalizing', async () => {
      const supabase = await createRouteClient();

      const { error } = await supabase
        .from('projects')
        .update({
          status: 'finalizing',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        console.error(`Failed to update project status: ${error.message}`);
      }

      // Send real-time update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'finalization_started',
          payload: {
            projectId,
            status: 'finalizing',
            message: 'Starting content finalization...'
          }
        });
    });

    // Step 1: Polish the content
    const polishedContent = await step.run('polish-content', async () => {
      const polishPrompt = `
        Polish and enhance this complete article to make it publication-ready.
        
        Original Content:
        ${generatedContent}
        
        Blueprint Context:
        Topic: ${blueprint.seoMetadata.title}
        Target Keywords: ${blueprint.targetKeywords.join(', ')}
        Focus Keyword: ${blueprint.seoMetadata.focusKeyword}
        
        Enhancement Requirements:
        1. Improve readability and flow between sections
        2. Add smooth transitions and connecting phrases
        3. Enhance the introduction to be more compelling
        4. Strengthen the conclusion with clear call-to-action
        5. Optimize keyword placement naturally throughout
        6. Improve sentence variety and structure
        7. Add relevant examples and analogies where appropriate
        8. Ensure consistent tone and voice throughout
        9. Fix any grammatical errors or awkward phrasing
        10. Maintain all original information and structure
        
        Return the polished, publication-ready article in markdown format.
      `;

      const result = await generateAIText(
        polishPrompt,
        'polish',
        userId
      );

      return result.text;
    });

    // Step 2: Generate enhanced SEO metadata
    const enhancedSEO = await step.run('generate-enhanced-seo', async () => {
      const seoPrompt = `
        Generate comprehensive SEO metadata for this polished article:
        
        ${polishedContent.substring(0, 2000)}...
        
        Current SEO Data:
        - Title: ${blueprint.seoMetadata.title}
        - Focus Keyword: ${blueprint.seoMetadata.focusKeyword}
        - Target Keywords: ${blueprint.targetKeywords.join(', ')}
        
        Generate enhanced SEO metadata including:
        1. Optimized title (50-60 characters, compelling and keyword-rich)
        2. Meta description (150-160 characters, action-oriented)
        3. Focus keyword (primary keyword for ranking)
        4. Target keywords (5-10 related keywords)
        5. Readability score estimate (0-100)
        6. SEO score estimate (0-100)
        7. Heading structure (H1, H2, H3 recommendations)
        8. Internal link suggestions with anchor text
        9. Image alt text suggestions
        
        Ensure all metadata is optimized for search engines and user engagement.
      `;

      const result = await generateStructuredOutput(
        seoPrompt,
        EnhancedSEOMetadataSchema,
        'structured',
        userId
      );

      return result.object;
    });

    // Step 3: Generate FAQ section
    const faqData = await step.run('generate-faq', async () => {
      const faqPrompt = `
        Generate a comprehensive FAQ section for this article:
        
        ${polishedContent.substring(0, 1500)}...
        
        Topic: ${blueprint.seoMetadata.title}
        Target Keywords: ${blueprint.targetKeywords.join(', ')}
        
        Create 5-15 frequently asked questions that:
        1. Address common user concerns about the topic
        2. Include target keywords naturally
        3. Provide clear, helpful answers
        4. Cover different aspects of the main topic
        5. Are likely to be searched by users
        6. Help improve search visibility
        7. Add value beyond the main content
        
        Each FAQ should have:
        - A clear, specific question
        - A comprehensive but concise answer (50-150 words)
        - Optional category for organization
        - Relevant keywords for SEO
      `;

      const result = await generateStructuredOutput(
        faqPrompt,
        FAQSchema,
        'structured',
        userId
      );

      return result.object;
    });

    // Step 4: Generate structured data
    const structuredData = await step.run('generate-structured-data', async () => {
      const structuredPrompt = `
        Generate JSON-LD structured data for this article:
        
        Title: ${enhancedSEO.title}
        Content: ${polishedContent.substring(0, 1000)}...
        FAQ Data: ${JSON.stringify(faqData.faqs.slice(0, 3))}
        
        Create structured data including:
        1. Article schema with proper metadata
        2. FAQ schema if FAQs are present
        3. HowTo schema if it's a how-to guide
        4. Proper author and publication information
        5. Keywords and description
        6. Word count and reading time
        
        Ensure all structured data follows schema.org standards.
      `;

      const result = await generateStructuredOutput(
        structuredPrompt,
        StructuredDataSchema,
        'structured',
        userId
      );

      return result.object;
    });

    // Step 5: Generate key takeaways and summary
    const takeaways = await step.run('generate-takeaways', async () => {
      const takeawaysPrompt = `
        Generate key takeaways and summary for this article:
        
        ${polishedContent}
        
        Create:
        1. Key Takeaways (3-7 bullet points of main insights)
        2. Executive Summary (100-300 words overview)
        3. Action Items (2-5 specific steps readers can take)
        4. Next Steps (1-3 logical follow-up actions)
        5. Related Topics (3-6 topics for further exploration)
        
        Focus on:
        - Practical, actionable insights
        - Clear value propositions
        - Memorable key points
        - Logical next steps for readers
        - Related topics that add value
      `;

      const result = await generateStructuredOutput(
        takeawaysPrompt,
        TakeawaysSchema,
        'structured',
        userId
      );

      return result.object;
    });

    // Step 6: Assemble final content with all enhancements
    const finalContent = await step.run('assemble-final-content', async () => {
      const contentParts = [
        `# ${enhancedSEO.title}`,
        '',
        `> ${enhancedSEO.metaDescription}`,
        '',
        '## Executive Summary',
        '',
        takeaways.executiveSummary,
        '',
        '## Key Takeaways',
        '',
        ...takeaways.keyTakeaways.map(takeaway => `- ${takeaway}`),
        '',
        polishedContent,
        '',
        '## Frequently Asked Questions',
        '',
        ...faqData.faqs.map(faq => [
          `### ${faq.question}`,
          '',
          faq.answer,
          ''
        ]).flat(),
        '## Action Items',
        '',
        ...takeaways.actionItems.map(item => `- ${item}`),
        '',
        '## Next Steps',
        '',
        ...takeaways.nextSteps.map(step => `- ${step}`),
        '',
        '## Related Topics',
        '',
        ...takeaways.relatedTopics.map(topic => `- ${topic}`),
      ];

      return contentParts.join('\n');
    });

    // Step 7: Store finalized content and metadata
    await step.run('store-finalized-content', async () => {
      const supabase = await createRouteClient();

      const finalizedData = {
        generated_content: finalContent,
        seo_metadata: {
          ...enhancedSEO,
          faqData: faqData.faqs,
          structuredData,
          takeaways
        },
        status: 'completed',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('projects')
        .update(finalizedData)
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to store finalized content: ${error.message}`);
      }

      // Send final completion update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'finalization_complete',
          payload: {
            projectId,
            status: 'completed',
            wordCount: finalContent.split(' ').length,
            seoScore: enhancedSEO.seoScore,
            readabilityScore: enhancedSEO.readabilityScore,
            faqCount: faqData.faqs.length,
            takeawaysCount: takeaways.keyTakeaways.length
          }
        });
    });

    const result = {
      success: true,
      projectId,
      finalContentLength: finalContent.length,
      wordCount: finalContent.split(' ').length,
      seoMetadata: enhancedSEO,
      faqCount: faqData.faqs.length,
      takeawaysCount: takeaways.keyTakeaways.length,
      structuredDataTypes: Object.keys(structuredData),
      idempotencyKey,
      timestamp: Date.now(),
    };

    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));

    return result;
  }
);

// Auto-trigger finalization when all sections are complete
export const autoTriggerFinalization = inngest.createFunction(
  {
    id: 'auto-trigger-finalization',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"', // Global Gemini quota limit protection
    },
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'content/all-sections-complete' },
  async ({ event, step }) => {
    const { userId, projectId, blueprint } = event.data;

    // Get the assembled content from the project
    const projectData = await step.run('fetch-project-content', async () => {
      const supabase = await createRouteClient();

      const { data: project, error } = await supabase
        .from('projects')
        .select('generated_content, status')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      if (error || !project) {
        throw new Error(`Project not found: ${error?.message}`);
      }

      return project;
    });

    // Only trigger finalization if content exists and project is in writing status
    if (projectData.generated_content && projectData.status === 'writing') {
      await step.run('trigger-finalization', async () => {
        await inngest.send({
          name: 'content/finalize',
          data: {
            userId,
            projectId,
            generatedContent: projectData.generated_content,
            blueprint
          }
        });

        console.log(`Auto-triggered finalization for project ${projectId}`);
      });
    }

    return { success: true, triggered: !!projectData.generated_content };
  }
);

// Manual finalization trigger (for user-initiated finalization)
export const manualTriggerFinalization = inngest.createFunction(
  {
    id: 'manual-trigger-finalization',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"', // Global Gemini quota limit protection
    },
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'content/manual-finalize' },
  async ({ event, step }) => {
    const { userId, projectId } = event.data;

    // Get project data including content and blueprint
    const projectData = await step.run('fetch-project-data', async () => {
      const supabase = await createRouteClient();

      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

      if (error || !project) {
        throw new Error(`Project not found: ${error?.message}`);
      }

      return project as Project;
    });

    // Validate that project has content to finalize
    if (!projectData.generated_content) {
      throw new Error('No content available to finalize');
    }

    if (!projectData.blueprint) {
      throw new Error('No blueprint available for finalization');
    }

    // Trigger finalization
    await step.run('trigger-manual-finalization', async () => {
      await inngest.send({
        name: 'content/finalize',
        data: {
          userId,
          projectId,
          generatedContent: projectData.generated_content,
          blueprint: projectData.blueprint
        }
      });

      console.log(`Manual finalization triggered for project ${projectId}`);
    });

    return {
      success: true,
      projectId,
      contentLength: projectData.generated_content.length,
      hasBlueprint: !!projectData.blueprint
    };
  }
);

// Export all finalization functions
export const contentFinalizationFunctions = [
  finalizeContent,
  autoTriggerFinalization,
  manualTriggerFinalization,
];