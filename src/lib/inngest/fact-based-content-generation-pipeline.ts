import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { atomicFactsExtractor } from '@/lib/services/atomic-facts-extractor';
import { generateAIText, streamAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createRouteClient } from '@/lib/supabase/server';
import { z } from 'zod';
import type {
  ContentBlueprint,
  ContentSection,
  SEOMetadata,
  Project
} from '@/lib/types';

// Schema for fact-based blueprint generation
const FactBasedBlueprintSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    heading: z.string(),
    goal: z.string(),
    subSections: z.array(z.object({
      id: z.string(),
      heading: z.string(),
      keyPoints: z.array(z.string()),
      requiredFactTypes: z.array(z.enum(['statistic', 'process', 'definition', 'insight', 'claim', 'example', 'quote', 'technical']))
    })),
    contentElements: z.array(z.object({
      type: z.enum(['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block']),
      properties: z.record(z.string(), z.any())
    })),
    factRequirements: z.object({
      minimumFacts: z.number(),
      preferredCategories: z.array(z.string()),
      confidenceThreshold: z.number(),
      relevanceThreshold: z.number()
    }),
    order: z.number()
  })),
  seoMetadata: z.object({
    title: z.string(),
    metaDescription: z.string(),
    targetKeywords: z.array(z.string()),
    focusKeyword: z.string()
  }),
  estimatedLength: z.number(),
  targetKeywords: z.array(z.string()),
  factMappingStrategy: z.object({
    totalFactsAvailable: z.number(),
    factsPerSection: z.number(),
    overlapStrategy: z.enum(['minimal', 'moderate', 'high']),
    qualityThreshold: z.number()
  })
});

// Fact-based content generation strategy workflow
export const generateFactBasedContentStrategy = inngest.createFunction(
  {
    id: 'generate-fact-based-content-strategy',
    concurrency: [
      {
        limit: CONCURRENCY_LIMITS['project/content-generation-started'],
        key: 'event.data.userId',
      },
      {
        limit: 1,
        scope: "account",
        key: '"gemini-quota-limit"',
      }
    ],
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/fact-based-strategy-generate' },
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

    // Get project data
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

      return project as unknown as Project;
    });

    // Extract atomic facts from research data
    const availableFacts = researchData.factVault?.atomicFacts || [];
    const brandFacts = researchData.brandAnalysis?.atomicFacts || [];
    const allFacts = [...availableFacts, ...brandFacts];

    console.log(`Generating fact-based strategy using ${allFacts.length} atomic facts`);

    // Generate fact-aware content strategy using GPT-4o
    const blueprint = await step.run('generate-fact-based-blueprint-strategy', async () => {
      // Prepare fact summary for strategy generation
      const factSummary = allFacts
        .filter(fact => fact.confidence > 70 && fact.relevanceScore > 60)
        .sort((a, b) => (b.confidence * b.relevanceScore) - (a.confidence * a.relevanceScore))
        .slice(0, 30) // Use top 30 facts for strategy
        .map(fact => `[${fact.category}] ${fact.fact} (Confidence: ${fact.confidence}%, Relevance: ${fact.relevanceScore}%)`)
        .join('\n');

      const factsByCategory = allFacts.reduce((acc, fact) => {
        if (!acc[fact.category]) acc[fact.category] = 0;
        acc[fact.category]++;
        return acc;
      }, {} as Record<string, number>);

      const strategyPrompt = `
        Create a comprehensive content strategy for a ${format} about "${topic}" with a ${tone} tone.
        This strategy must be FACT-BASED using the atomic facts extracted from competitor research.
        
        AVAILABLE ATOMIC FACTS (${allFacts.length} total):
        ${factSummary}
        
        FACT DISTRIBUTION BY CATEGORY:
        ${Object.entries(factsByCategory).map(([category, count]) => `- ${category}: ${count} facts`).join('\n')}
        
        RESEARCH CONTEXT:
        - Competitors Analyzed: ${researchData.processingMetrics?.competitorsAnalyzed || 0}
        - Compression Ratio: ${researchData.factVault?.extractionMetrics?.compressionRatio || 0}x
        - Quality Score: ${researchData.factVault?.extractionMetrics?.qualityScore || 0}/100
        
        STRATEGY REQUIREMENTS:
        1. Create 5-8 main sections that maximize use of available atomic facts
        2. Each section should specify required fact types and minimum fact count
        3. Map facts to sections based on relevance and category
        4. Ensure comprehensive coverage using fact-based evidence
        5. Include specific content elements that showcase facts effectively
        6. Optimize for SEO using keywords from atomic facts
        7. Design sections to prevent fact overlap and maximize coverage
        8. Consider fact confidence levels for content authority
        
        FACT-BASED CONTENT PRINCIPLES:
        - Each section must be supported by minimum 3-5 atomic facts
        - Prioritize high-confidence facts (>80%) for key claims
        - Use statistics and data facts for credibility
        - Include process facts for how-to sections
        - Leverage definition facts for explanatory content
        - Incorporate insight facts for unique perspectives
        
        Format: ${format}
        Tone: ${tone}
        Target Length: 2000-3000 words
        
        Generate a detailed content blueprint that maps atomic facts to sections for maximum impact.
      `;

      const result = await generateStructuredOutput(
        strategyPrompt,
        FactBasedBlueprintSchema,
        'blueprint',
        userId
      );

      return result.object;
    });

    // Validate and optimize fact mapping
    const optimizedBlueprint = await step.run('optimize-fact-mapping', async () => {
      // Ensure each section has adequate fact coverage
      const optimizedSections = await Promise.all(
        blueprint.sections.map(async (section) => {
          // Find relevant facts for this section
          const sectionFacts = await atomicFactsExtractor.filterFactsForSection(
            allFacts,
            section.heading,
            section.goal,
            section.subSections.flatMap(sub => sub.keyPoints),
            userId
          );

          // Update section with actual fact availability
          return {
            ...section,
            factRequirements: {
              ...section.factRequirements,
              availableFacts: sectionFacts.length,
              factIds: sectionFacts.map(fact => fact.id)
            }
          };
        })
      );

      return {
        ...blueprint,
        sections: optimizedSections,
        factMappingStrategy: {
          ...blueprint.factMappingStrategy,
          totalFactsAvailable: allFacts.length,
          factsPerSection: Math.floor(allFacts.length / blueprint.sections.length),
          qualityThreshold: 70
        }
      };
    });

    // Store blueprint and create content sections
    await step.run('store-fact-based-blueprint', async () => {
      const supabase = await createRouteClient();

      // Update project with fact-based blueprint
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          blueprint: optimizedBlueprint,
          status: 'writing',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (projectError) {
        throw new Error(`Failed to update project: ${projectError.message}`);
      }

      // Create content sections with fact mapping
      const sectionsToInsert = optimizedBlueprint.sections.map(section => ({
        project_id: projectId,
        section_order: section.order,
        heading: section.heading,
        goal: section.goal,
        sub_sections: section.subSections,
        content_elements: section.contentElements.map(el => el.type),
        fact_requirements: section.factRequirements,
        status: 'pending' as const
      }));

      const { error: sectionsError } = await supabase
        .from('content_sections')
        .insert(sectionsToInsert);

      if (sectionsError) {
        throw new Error(`Failed to create sections: ${sectionsError.message}`);
      }

      // Send real-time update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'fact_based_strategy_complete',
          payload: {
            projectId,
            blueprint: optimizedBlueprint,
            sectionsCount: optimizedBlueprint.sections.length,
            totalFacts: allFacts.length,
            status: 'writing'
          }
        });
    });

    // Fan-out: Trigger parallel fact-based content generation
    await step.run('trigger-fact-based-section-generation', async () => {
      const fanOutEvents = optimizedBlueprint.sections.map(section => ({
        name: 'content/fact-based-section-generate' as const,
        data: {
          userId,
          projectId,
          sectionId: section.id,
          section,
          blueprint: optimizedBlueprint,
          availableFacts: allFacts,
          priority: 'high' as const
        }
      }));

      await inngest.send(fanOutEvents);

      console.log(`Triggered ${fanOutEvents.length} fact-based section generation jobs for project ${projectId}`);
    });

    const result = {
      success: true,
      blueprint: optimizedBlueprint,
      sectionsCount: optimizedBlueprint.sections.length,
      totalFactsAvailable: allFacts.length,
      estimatedTokens: optimizedBlueprint.estimatedLength / 4,
      compressionRatio: researchData.factVault?.extractionMetrics?.compressionRatio || 1,
      idempotencyKey,
      timestamp: Date.now(),
    };

    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));

    return result;
  }
);

// Fact-based section generation workflow
export const generateFactBasedContentSection = inngest.createFunction(
  {
    id: 'generate-fact-based-content-section',
    concurrency: [
      {
        limit: CONCURRENCY_LIMITS['content/generate'],
        key: 'event.data.projectId',
      },
      {
        limit: 1,
        scope: "account",
        key: '"gemini-quota-limit"',
      }
    ],
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/fact-based-section-generate' },
  async ({ event, step }) => {
    const { userId, projectId, sectionId, section, blueprint, availableFacts } = event.data;

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

    // Update section status
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
          event: 'fact_based_section_started',
          payload: {
            projectId,
            sectionId,
            heading: section.heading,
            status: 'writing'
          }
        });
    });

    // Filter and select relevant atomic facts for this section
    const sectionFacts = await step.run('select-section-facts', async () => {
      console.log(`Selecting atomic facts for section: ${section.heading}`);

      const relevantFacts = await atomicFactsExtractor.filterFactsForSection(
        availableFacts,
        section.heading,
        section.goal,
        section.subSections.flatMap(sub => sub.keyPoints),
        userId
      );

      // Apply section-specific filtering
      const filteredFacts = relevantFacts.filter(fact => {
        const meetsConfidence = fact.confidence >= (section.factRequirements?.confidenceThreshold || 70);
        const meetsRelevance = fact.relevanceScore >= (section.factRequirements?.relevanceThreshold || 60);
        const matchesCategory = !section.factRequirements?.preferredCategories?.length ||
          section.factRequirements.preferredCategories.includes(fact.category);

        return meetsConfidence && meetsRelevance && matchesCategory;
      });

      // Sort by quality score and limit to required amount
      const sortedFacts = filteredFacts
        .sort((a, b) => (b.confidence * b.relevanceScore) - (a.confidence * a.relevanceScore))
        .slice(0, section.factRequirements?.minimumFacts || 10);

      console.log(`Selected ${sortedFacts.length} atomic facts for section "${section.heading}"`);
      return sortedFacts;
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

    // Generate section content using atomic facts
    const sectionContent = await step.run('generate-fact-based-section-content', async () => {
      // Prepare facts for content generation
      const factContext = sectionFacts.map(fact =>
        `[${fact.category.toUpperCase()}] ${fact.fact} (Confidence: ${fact.confidence}%, Source: ${fact.source})`
      ).join('\n');

      const factsByCategory = sectionFacts.reduce((acc, fact) => {
        if (!acc[fact.category]) acc[fact.category] = [];
        acc[fact.category].push(fact.fact);
        return acc;
      }, {} as Record<string, string[]>);

      const contextualPrompt = `
        Write the "${section.heading}" section using ONLY the provided atomic facts as your source material.
        
        Section Goal: ${section.goal}
        
        Sub-sections to cover:
        ${section.subSections.map(sub => `- ${sub.heading}: ${sub.keyPoints.join(', ')}`).join('\n')}
        
        Content Elements to include:
        ${section.contentElements.map(el => `- ${el.type}: ${JSON.stringify(el.properties)}`).join('\n')}
        
        ATOMIC FACTS FOR THIS SECTION (${sectionFacts.length} facts):
        ${factContext}
        
        FACTS BY CATEGORY:
        ${Object.entries(factsByCategory).map(([category, facts]) =>
        `${category.toUpperCase()}:\n${facts.map(fact => `  • ${fact}`).join('\n')}`
      ).join('\n\n')}
        
        Previous Sections Context:
        ${previousSections.map(prev => `${prev.heading}: ${prev.generated_content?.substring(0, 200)}...`).join('\n')}
        
        FACT-BASED WRITING REQUIREMENTS:
        1. Write 300-500 words for this section
        2. Use ONLY the provided atomic facts - do not add external information
        3. Cite facts naturally within the content flow
        4. Prioritize high-confidence facts (>80%) for key claims
        5. Use statistics and data facts for credibility
        6. Include process facts for step-by-step explanations
        7. Leverage definition facts for clear explanations
        8. Incorporate insight facts for unique perspectives
        9. Maintain consistency with previous sections
        10. Use natural keyword integration from fact keywords
        11. Include the specified content elements naturally
        12. Write in a ${blueprint.seoMetadata.focusKeyword} tone
        13. Use markdown formatting
        14. Ensure every claim is backed by an atomic fact
        
        CRITICAL: Base every statement on the atomic facts provided. Do not hallucinate or add information not present in the facts.
      `;

      const result = await generateAIText(
        contextualPrompt,
        'content',
        userId
      );

      return result.text;
    });

    // Validate content against facts
    const validatedContent = await step.run('validate-content-against-facts', async () => {
      // In production, you might want to validate that all claims in the content
      // are supported by the atomic facts provided

      // For now, we'll add fact attribution metadata
      const contentWithMetadata = {
        content: sectionContent,
        factsUsed: sectionFacts.map(fact => ({
          id: fact.id,
          fact: fact.fact,
          category: fact.category,
          confidence: fact.confidence,
          source: fact.source
        })),
        factCount: sectionFacts.length,
        averageConfidence: Math.round(sectionFacts.reduce((sum, fact) => sum + fact.confidence, 0) / sectionFacts.length),
        categories: [...new Set(sectionFacts.map(fact => fact.category))]
      };

      return contentWithMetadata;
    });

    // Store generated content with fact metadata
    await step.run('store-fact-based-section-content', async () => {
      const supabase = await createRouteClient();

      const { error } = await supabase
        .from('content_sections')
        .update({
          generated_content: validatedContent.content,
          fact_metadata: {
            factsUsed: validatedContent.factsUsed,
            factCount: validatedContent.factCount,
            averageConfidence: validatedContent.averageConfidence,
            categories: validatedContent.categories
          },
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
          event: 'fact_based_section_complete',
          payload: {
            projectId,
            sectionId,
            heading: section.heading,
            content: validatedContent.content,
            status: 'completed',
            wordCount: validatedContent.content.split(' ').length,
            factCount: validatedContent.factCount,
            averageConfidence: validatedContent.averageConfidence
          }
        });
    });

    // Check if all sections are complete
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
        // Trigger content finalization pipeline
        await inngest.send({
          name: 'content/fact-based-all-sections-complete',
          data: {
            userId,
            projectId,
            blueprint
          }
        });

        console.log(`All fact-based sections completed for project ${projectId}, triggering finalization`);
      }
    });

    const result = {
      success: true,
      sectionId,
      heading: section.heading,
      contentLength: validatedContent.content.length,
      wordCount: validatedContent.content.split(' ').length,
      factCount: validatedContent.factCount,
      averageConfidence: validatedContent.averageConfidence,
      categories: validatedContent.categories,
      idempotencyKey,
      timestamp: Date.now(),
    };

    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 3600, JSON.stringify(result));

    return result;
  }
);

// Fact-based completion handler - triggers final assembly
export const factBasedCompletionHandler = inngest.createFunction(
  {
    id: 'fact-based-completion-handler',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"',
    },
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'content/fact-based-all-sections-complete' },
  async ({ event, step }) => {
    const { userId, projectId, blueprint } = event.data;

    console.log(`All fact-based sections completed for project ${projectId}, triggering final assembly`);

    await step.run('trigger-final-assembly', async () => {
      await inngest.send({
        name: 'content/final-assembly',
        data: {
          userId,
          projectId,
          blueprint
        }
      });
    });

    return { success: true, nextPhase: 'final-assembly' };
  }
);

// Export fact-based content generation functions
export const factBasedContentGenerationFunctions = [
  generateFactBasedContentStrategy,
  generateFactBasedContentSection,
  factBasedCompletionHandler,
];