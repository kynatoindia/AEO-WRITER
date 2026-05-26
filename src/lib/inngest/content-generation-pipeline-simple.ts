import { inngest } from './client';
import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAST_PIPELINE_MODE = process.env.AEO_FAST_MODE !== 'false';
const MAX_GENERATION_SECTIONS = Number.isFinite(Number(process.env.AEO_MAX_SECTIONS))
  ? Math.max(2, Number(process.env.AEO_MAX_SECTIONS))
  : (FAST_PIPELINE_MODE ? 4 : 6);
const SECTION_WORD_TARGET = FAST_PIPELINE_MODE ? '220-320' : '300-500';

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
    concurrency: [
      { limit: 1, key: 'event.data.userId' },
      {
        limit: 2,
        scope: "account",
        key: '"ai-provider-limit"', // Global AI provider limit protection
      }
    ],
  },
  { event: 'content/strategy-generate' },
  async ({ event, step }) => {
    const { userId, projectId, researchData, topic, tone, format } = event.data;
    
    // Get project from database
    const project = await step.run('fetch-project', async () => {
      const supabase = supabaseAdmin;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();
      
      if (error || !data) {
        throw new Error(`Project not found: ${error?.message}`);
      }
      return data;
    });
    
    // Generate content strategy using GPT-4o
    const blueprint = await step.run('generate-strategy', async () => {
      const strategyPrompt = `
        Create a comprehensive content strategy for a ${format} about "${topic}" with a ${tone} tone.
        
        Research Context:
        ${JSON.stringify(researchData, null, 2)}
        
        Requirements:
        1. Create ${FAST_PIPELINE_MODE ? '4-6' : '5-8'} main sections that provide comprehensive coverage
        2. Each section should have a clear goal and 2-4 sub-sections
        3. Include specific content elements (tables, lists, FAQs) where appropriate
        4. Optimize for SEO with target keywords
        5. Ensure logical flow and reader engagement
        
        Generate a detailed content blueprint.
      `;
      
      const result = await generateStructuredOutput(
        strategyPrompt,
        BlueprintSchema,
        'blueprint',
        userId
      );
      
      return result.object;
    });

    const optimizedBlueprint = {
      ...blueprint,
      sections: blueprint.sections
        .slice(0, MAX_GENERATION_SECTIONS)
        .map((section, index) => ({
          ...section,
          order: index + 1,
        })),
      estimatedLength: Math.max(1200, Math.round((blueprint.estimatedLength || 2000) * (MAX_GENERATION_SECTIONS / Math.max(1, blueprint.sections.length)))),
    };
    
    // Store blueprint and update project
    await step.run('store-blueprint', async () => {
      const supabase = supabaseAdmin;
      
      // Update project with blueprint
      await supabase
        .from('projects')
        .update({
          blueprint: optimizedBlueprint,
          status: 'writing',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      // Create content sections
      const sectionsToInsert = optimizedBlueprint.sections.map(section => ({
        project_id: projectId,
        section_order: section.order,
        heading: section.heading,
        goal: section.goal,
        sub_sections: section.subSections,
        content_elements: section.contentElements.map(el => el.type),
        data_sources: section.dataSources,
        status: 'pending' as const
      }));
      
      await supabase
        .from('content_sections')
        .insert(sectionsToInsert);
    });
    
    // Trigger section generation
    await step.run('trigger-sections', async () => {
      const fanOutEvents = optimizedBlueprint.sections.map(section => ({
        name: 'content/section-generate' as const,
        data: {
          userId,
          projectId,
          sectionId: section.id,
          section,
          blueprint: optimizedBlueprint,
          researchData
        }
      }));
      
      await inngest.send(fanOutEvents);
    });
    
    return {
      success: true,
      blueprint: optimizedBlueprint,
      sectionsCount: optimizedBlueprint.sections.length
    };
  }
);

// Individual section generation workflow - Uses GPT-4o-mini for cost efficiency
export const generateContentSection = inngest.createFunction(
  {
    id: 'generate-content-section',
    concurrency: [
      { limit: 2, key: 'event.data.projectId' },
      {
        limit: 2,
        scope: "account",
        key: '"ai-provider-limit"', // Global AI provider limit protection
      }
    ],
  },
  { event: 'content/section-generate' },
  async ({ event, step }) => {
    const { userId, projectId, sectionId, section, blueprint, researchData } = event.data;
    
    // Update section status to writing
    await step.run('update-status', async () => {
      const supabase = supabaseAdmin;
      await supabase
        .from('content_sections')
        .update({ status: 'writing' })
        .eq('project_id', projectId)
        .eq('heading', section.heading);
    });
    
    // Get previous sections for context
    const previousSections = await step.run('get-context', async () => {
      const supabase = supabaseAdmin;
      const { data } = await supabase
        .from('content_sections')
        .select('heading, generated_content')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('section_order');
      
      return data || [];
    });
    
    // Generate section content
    const content = await step.run('generate-content', async () => {
      const contextualPrompt = `
        Write the "${section.heading}" section for a ${blueprint.seoMetadata.focusKeyword} article.
        
        Section Goal: ${section.goal}
        
        Sub-sections to cover:
        ${section.subSections.map((sub: any) => `- ${sub.heading}: ${sub.keyPoints.join(', ')}`).join('\n')}
        
        Previous sections context:
        ${previousSections.map((prev: any) => `${prev.heading}: ${prev.generated_content?.substring(0, 200)}...`).join('\n')}
        
        Requirements:
        1. Write ${SECTION_WORD_TARGET} words for this section
        2. Use natural keyword integration
        3. Write in a ${blueprint.seoMetadata.focusKeyword} tone
        4. Use markdown formatting
        
        Write engaging, informative content.
      `;
      
      const result = await generateAIText(
        contextualPrompt,
        'content',
        userId
      );
      
      return result.text;
    });
    
    // Store generated content
    await step.run('store-content', async () => {
      const supabase = supabaseAdmin;
      
      await supabase
        .from('content_sections')
        .update({
          generated_content: content,
          status: 'completed'
        })
        .eq('project_id', projectId)
        .eq('heading', section.heading);
    });
    
    // Check if all sections are complete
    await step.run('check-completion', async () => {
      const supabase = supabaseAdmin;
      
      const { data: sections } = await supabase
        .from('content_sections')
        .select('status')
        .eq('project_id', projectId);
      
      const allCompleted = sections?.every((s: any) => s.status === 'completed');
      
      if (allCompleted) {
        await inngest.send({
          name: 'content/final-assembly',
          data: { userId, projectId, blueprint }
        });
      }
    });
    
    return {
      success: true,
      sectionId,
      heading: section.heading,
      contentLength: content.length
    };
  }
);

// Final content assembly workflow
export const assembleAndPolishContent = inngest.createFunction(
  {
    id: 'assemble-and-polish-content',
    concurrency: [
      { limit: 1, key: 'event.data.projectId' },
      {
        limit: 2,
        scope: "account",
        key: '"ai-provider-limit"', // Global AI provider limit protection
      }
    ],
  },
  { event: 'content/final-assembly' },
  async ({ event, step }) => {
    const { userId, projectId, blueprint } = event.data;
    
    // Fetch all completed sections
    const allSections = await step.run('fetch-sections', async () => {
      const supabase = supabaseAdmin;
      
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
    
    // Assemble and polish content
    const finalContent = await step.run('polish-content', async () => {
      const assembledContent = [
        `# ${blueprint.seoMetadata.title}`,
        '',
        blueprint.seoMetadata.metaDescription,
        '',
        ...allSections.map((section: any) => section.generated_content).filter(Boolean)
      ].join('\n\n');
      
      const polishPrompt = `
        Polish and enhance this complete article about "${blueprint.seoMetadata.focusKeyword}".
        
        Current Content:
        ${assembledContent}
        
        Enhancement Requirements:
        1. Add smooth transitions between sections
        2. Ensure consistent tone and style
        3. Add a compelling introduction and conclusion
        4. Include key takeaways
        5. Optimize for SEO
        6. Ensure proper markdown formatting
        
        Return the polished, publication-ready article.
      `;
      
      const result = await generateAIText(polishPrompt, 'polish', userId);
      return result.text;
    });
    
    // Store final content
    await step.run('store-final', async () => {
      const supabase = supabaseAdmin;
      
      await supabase
        .from('projects')
        .update({
          generated_content: finalContent,
          status: 'completed',
          status_message: 'Content generation completed successfully.',
          progress: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', userId);

      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'project_complete',
          payload: {
            projectId,
            status: 'completed',
            wordCount: finalContent.split(' ').length,
          }
        });
    });
    
    return {
      success: true,
      projectId,
      contentLength: finalContent.length,
      wordCount: finalContent.split(' ').length
    };
  }
);

// Export all content generation functions
export const contentGenerationFunctions = [
  generateContentStrategy,
  generateContentSection,
  assembleAndPolishContent,
];
