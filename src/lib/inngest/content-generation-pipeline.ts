import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { generateAIText, streamAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createRouteClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type { 
  ContentBlueprint, 
  ContentSection, 
  SEOMetadata, 
  Project,
  ResearchResponse 
} from '@/lib/types';

// Schema for structured blueprint generation
const BlueprintSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    heading: z.string(),
    goal: z.string(),
    subSections: z.array(z.object({
      id: z.string(),
      heading: z.string(),
      keyPoints: z.array(z.string())
    })),
    contentElements: z.array(z.object({
      type: z.enum(['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block']),
      properties: z.record(z.string(), z.any())
    })),
    dataSources: z.array(z.string()),
    order: z.number()
  })),
  seoMetadata: z.object({
    title: z.string(),
    metaDescription: z.string(),
    targetKeywords: z.array(z.string()),
    focusKeyword: z.string()
  }),
  estimatedLength: z.number(),
  targetKeywords: z.array(z.string())
});

// Content generation strategy workflow - Uses GPT-4o for high-quality strategy
export const generateContentStrategy = inngest.createFunction(
  {
    id: 'generate-content-strategy',
    concurrency: {
      limit: CONCURRENCY_LIMITS['project/content-generation-started'],
      key: 'event.data.userId',
    },
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/strategy-generate' },
  async ({ event, step }) => {
    const { userId, projectId, researchData, topic, tone, format } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.blueprint(userId, projectId);
    
    // Check for duplicate strategy requests
    const duplicateCheck = await step.run('check-duplicate-strategy', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult as string) : null;
    });
    
    if (duplicateCheck) {
      console.log(`Duplicate strategy request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }
    
    // Get project and research data from database
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
    
    // Generate high-quality content strategy using GPT-4o
    const blueprint = await step.run('generate-blueprint-strategy', async () => {
      const strategyPrompt = `
        Create a comprehensive content strategy for a ${format} about "${topic}" with a ${tone} tone.
        
        Research Context:
        ${JSON.stringify(researchData, null, 2)}
        
        Requirements:
        1. Create 5-8 main sections that provide comprehensive coverage
        2. Each section should have a clear goal and 2-4 sub-sections
        3. Include specific content elements (tables, lists, FAQs) where appropriate
        4. Optimize for SEO with target keywords
        5. Ensure logical flow and reader engagement
        6. Consider competitor gaps and opportunities
        
        Format: ${format}
        Tone: ${tone}
        Target Length: 2000-3000 words
        
        Generate a detailed content blueprint that will guide section-by-section writing.
      `;
      
      const result = await generateStructuredOutput(
        strategyPrompt,
        BlueprintSchema,
        'blueprint', // Use high-quality model for strategy
        userId
      );
      
      return result.object;
    });
    
    // Store blueprint in database and update project status
    await step.run('store-blueprint', async () => {
      const supabase = await createRouteClient();
      
      // Update project with blueprint
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          blueprint,
          status: 'writing',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', userId);
      
      if (projectError) {
        throw new Error(`Failed to update project: ${projectError.message}`);
      }
      
      // Create content sections in database
      const sectionsToInsert = blueprint.sections.map(section => ({
        project_id: projectId,
        section_order: section.order,
        heading: section.heading,
        goal: section.goal,
        sub_sections: section.subSections,
        content_elements: section.contentElements.map(el => el.type),
        data_sources: section.dataSources,
        status: 'pending' as const
      }));
      
      const { error: sectionsError } = await supabase
        .from('content_sections')
        .insert(sectionsToInsert);
      
      if (sectionsError) {
        throw new Error(`Failed to create sections: ${sectionsError.message}`);
      }
      
      // Send real-time update via Supabase Realtime
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'strategy_complete',
          payload: {
            projectId,
            blueprint,
            sectionsCount: blueprint.sections.length,
            status: 'writing'
          }
        });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    // Fan-out: Trigger parallel content generation for each section
    await step.run('trigger-section-generation', async () => {
      const fanOutEvents = blueprint.sections.map(section => ({
        name: 'content/section-generate' as const,
        data: {
          userId,
          projectId,
          sectionId: section.id,
          section,
          blueprint,
          researchData,
          priority: 'high' as const
        }
      }));
      
      // Send all section generation events in parallel
      await inngest.send(fanOutEvents);
      
      console.log(`Triggered ${fanOutEvents.length} section generation jobs for project ${projectId}`);
    });
    
    const result = {
      success: true,
      blueprint,
      sectionsCount: blueprint.sections.length,
      estimatedTokens: blueprint.estimatedLength / 4,
      idempotencyKey,
      timestamp: Date.now(),
    };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));
    
    return result;
  }
);

// Individual section generation workflow - Uses GPT-4o-mini for cost efficiency
export const generateContentSection = inngest.createFunction(
  {
    id: 'generate-content-section',
    concurrency: {
      limit: CONCURRENCY_LIMITS['content/generate'],
      key: 'event.data.projectId', // Limit per project to manage costs
    },
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/section-generate' },
  async ({ event, step }) => {
    const { userId, projectId, sectionId, section, blueprint, researchData } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.contentGeneration(userId, projectId, sectionId);
    
    // Check for duplicate section requests
    const duplicateCheck = await step.run('check-duplicate-section', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      console.log(`Duplicate section request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }
    
    // Update section status to 'writing'
    await step.run('update-section-status-writing', async () => {
      const supabase = await createRouteClient();
      
      const { error } = await supabase
        .from('content_sections')
        .update({ status: 'writing' })
        .eq('project_id', projectId)
        .eq('heading', section.heading);
      
      if (error) {
        console.error(`Failed to update section status: ${error.message}`);
      }
      
      // Send real-time progress update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'section_started',
          payload: {
            projectId,
            sectionId,
            heading: section.heading,
            status: 'writing'
          }
        });
    });
    
    // Get previously written sections for context
    const previousSections = await step.run('get-previous-sections', async () => {
      const supabase = await createRouteClient();
      
      const { data: sections, error } = await supabase
        .from('content_sections')
        .select('heading, generated_content')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('section_order');
      
      if (error) {
        console.error(`Failed to fetch previous sections: ${error.message}`);
        return [];
      }
      
      return sections || [];
    });
    
    // Generate section content using GPT-4o-mini for cost efficiency
    const sectionContent = await step.run('generate-section-content', async () => {
      const contextualPrompt = `
        Write the "${section.heading}" section for a ${blueprint.seoMetadata.focusKeyword} article.
        
        Section Goal: ${section.goal}
        
        Sub-sections to cover:
        ${section.subSections.map(sub => `- ${sub.heading}: ${sub.keyPoints.join(', ')}`).join('\n')}
        
        Content Elements to include:
        ${section.contentElements.map(el => `- ${el.type}: ${JSON.stringify(el.properties)}`).join('\n')}
        
        Research Context:
        ${JSON.stringify(researchData, null, 2)}
        
        Previous Sections Context:
        ${previousSections.map(prev => `${prev.heading}: ${prev.generated_content?.substring(0, 200)}...`).join('\n')}
        
        Requirements:
        1. Write 300-500 words for this section
        2. Use natural keyword integration for: ${blueprint.targetKeywords.join(', ')}
        3. Include the specified content elements naturally
        4. Maintain consistency with previous sections
        5. Write in a ${blueprint.seoMetadata.focusKeyword} tone
        6. Use markdown formatting
        7. Include relevant data from research where appropriate
        
        Write engaging, informative content that flows naturally from previous sections.
      `;
      
      const result = await generateAIText(
        contextualPrompt,
        'content', // Use cost-effective model for content generation
        userId
      );
      
      return result.text;
    }, {
      retries: RETRY_CONFIG['ai-request'].attempts,
    });
    
    // Store generated content and update section status
    await step.run('store-section-content', async () => {
      const supabase = await createRouteClient();
      
      const { error } = await supabase
        .from('content_sections')
        .update({
          generated_content: sectionContent,
          status: 'completed'
        })
        .eq('project_id', projectId)
        .eq('heading', section.heading);
      
      if (error) {
        throw new Error(`Failed to store section content: ${error.message}`);
      }
      
      // Send real-time completion update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'section_complete',
          payload: {
            projectId,
            sectionId,
            heading: section.heading,
            content: sectionContent,
            status: 'completed',
            wordCount: sectionContent.split(' ').length
          }
        });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    // Check if all sections are complete and trigger finalization
    await step.run('check-project-completion', async () => {
      const supabase = await createRouteClient();
      
      const { data: sections, error } = await supabase
        .from('content_sections')
        .select('status')
        .eq('project_id', projectId);
      
      if (error) {
        console.error(`Failed to check section completion: ${error.message}`);
        return;
      }
      
      const allCompleted = sections?.every(s => s.status === 'completed');
      
      if (allCompleted) {
        // Trigger content finalization pipeline (includes assembly, polishing, SEO, FAQ, etc.)
        await inngest.send({
          name: 'content/all-sections-complete',
          data: {
            userId,
            projectId,
            blueprint
          }
        });
        
        console.log(`All sections completed for project ${projectId}, triggering content finalization`);
      }
    });
    
    const result = {
      success: true,
      sectionId,
      heading: section.heading,
      contentLength: sectionContent.length,
      wordCount: sectionContent.split(' ').length,
      idempotencyKey,
      timestamp: Date.now(),
    };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(result));
    
    return result;
  }
);

// Final content assembly and polishing workflow
export const assembleAndPolishContent = inngest.createFunction(
  {
    id: 'assemble-and-polish-content',
    concurrency: {
      limit: 1, // Sequential processing for final assembly
      key: 'event.data.projectId',
    },
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/final-assembly' },
  async ({ event, step }) => {
    const { userId, projectId, blueprint } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.userOperation(userId, `final_assembly_${projectId}`);
    
    // Check for duplicate assembly requests
    const duplicateCheck = await step.run('check-duplicate-assembly', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      return duplicateCheck;
    }
    
    // Fetch all completed sections
    const allSections = await step.run('fetch-all-sections', async () => {
      const supabase = await createRouteClient();
      
      const { data: sections, error } = await supabase
        .from('content_sections')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('section_order');
      
      if (error || !sections) {
        throw new Error(`Failed to fetch sections: ${error?.message}`);
      }
      
      return sections;
    });
    
    // Assemble complete content
    const assembledContent = await step.run('assemble-content', async () => {
      const contentParts = [
        `# ${blueprint.seoMetadata.title}`,
        '',
        blueprint.seoMetadata.metaDescription,
        '',
        ...allSections.map(section => section.generated_content).filter(Boolean)
      ];
      
      return contentParts.join('\n\n');
    });
    
    // Polish and enhance the final content using GPT-4o-mini
    const polishedContent = await step.run('polish-final-content', async () => {
      const polishPrompt = `
        Polish and enhance this complete article about "${blueprint.seoMetadata.focusKeyword}".
        
        Current Content:
        ${assembledContent}
        
        Enhancement Requirements:
        1. Add smooth transitions between sections
        2. Ensure consistent tone and style throughout
        3. Add a compelling introduction and conclusion
        4. Include key takeaways or summary
        5. Optimize for SEO with target keywords: ${blueprint.targetKeywords.join(', ')}
        6. Add FAQ section if beneficial
        7. Ensure proper markdown formatting
        8. Maintain the original structure and information
        
        Return the polished, publication-ready article.
      `;
      
      const result = await generateAIText(
        polishPrompt,
        'polish',
        userId
      );
      
      return result.text;
    }, {
      retries: RETRY_CONFIG['ai-request'].attempts,
    });
    
    // Generate final SEO metadata
    const finalSEOMetadata = await step.run('generate-final-seo', async () => {
      const seoPrompt = `
        Generate comprehensive SEO metadata for this article:
        
        ${polishedContent.substring(0, 1000)}...
        
        Generate:
        1. Optimized title (50-60 characters)
        2. Meta description (150-160 characters)
        3. Focus keyword
        4. Target keywords (5-8 keywords)
        5. Readability score estimate
        
        Return as JSON.
      `;
      
      const seoSchema = z.object({
        title: z.string(),
        metaDescription: z.string(),
        focusKeyword: z.string(),
        targetKeywords: z.array(z.string()),
        readabilityScore: z.number()
      });
      
      const result = await generateStructuredOutput(
        seoPrompt,
        seoSchema,
        'structured',
        userId
      );
      
      return result.object;
    });
    
    // Store final content and update project status
    await step.run('store-final-content', async () => {
      const supabase = await createRouteClient();
      
      const { error } = await supabase
        .from('projects')
        .update({
          generated_content: polishedContent,
          seo_metadata: finalSEOMetadata,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', userId);
      
      if (error) {
        throw new Error(`Failed to store final content: ${error.message}`);
      }
      
      // Send final completion update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'project_complete',
          payload: {
            projectId,
            status: 'completed',
            wordCount: polishedContent.split(' ').length,
            seoMetadata: finalSEOMetadata
          }
        });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });
    
    const result = {
      success: true,
      projectId,
      contentLength: polishedContent.length,
      wordCount: polishedContent.split(' ').length,
      seoMetadata: finalSEOMetadata,
      idempotencyKey,
      timestamp: Date.now(),
    };
    
    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));
    
    return result;
  }
);

// Export all content generation functions
export const contentGenerationFunctions = [
  generateContentStrategy,
  generateContentSection,
  assembleAndPolishContent,
];