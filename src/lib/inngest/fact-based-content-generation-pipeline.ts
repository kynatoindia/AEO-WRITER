import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis } from '@/lib/redis/client';
import { atomicFactsExtractor } from '@/lib/services/atomic-facts-extractor';
import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Project } from '@/lib/types';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FAST_PIPELINE_MODE = process.env.AEO_FAST_MODE !== 'false';
const MAX_GENERATION_SECTIONS = Number.isFinite(Number(process.env.AEO_MAX_SECTIONS))
  ? Math.max(2, Number(process.env.AEO_MAX_SECTIONS))
  : (FAST_PIPELINE_MODE ? 4 : 6);
const SECTION_WORD_TARGET = FAST_PIPELINE_MODE ? '220-320' : '300-500';

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

type FactBasedBlueprint = z.infer<typeof FactBasedBlueprintSchema>;
type FactType = 'statistic' | 'process' | 'definition' | 'insight' | 'claim' | 'example' | 'quote' | 'technical';
type FactRecord = {
  id?: string;
  fact?: string;
  category?: string;
  keywords?: string[];
  confidence?: number;
  relevanceScore?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function wordsFromTopic(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 6);
}

function buildFallbackFactBasedBlueprint(
  topic: string,
  tone: string,
  format: string,
  allFacts: FactRecord[],
  researchData: unknown
): FactBasedBlueprint {
  const summary = isObject(researchData) && isObject(researchData.researchSummary)
    ? researchData.researchSummary
    : undefined;
  const summaryKeywords = summary ? toStringArray(summary.targetKeywords) : [];

  const factKeywords = allFacts
    .flatMap((fact) => Array.isArray(fact.keywords) ? fact.keywords : [])
    .filter((keyword): keyword is string => typeof keyword === 'string')
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const keywordSet = [...new Set([...summaryKeywords, ...factKeywords, ...wordsFromTopic(topic), topic])];
  const targetKeywords = keywordSet.slice(0, 10);
  const focusKeyword = targetKeywords[0] || topic;

  const sections = [
    {
      id: 'fb_intro',
      heading: `What ${topic} Is and Why It Matters`,
      goal: `Establish context and core concepts for ${topic}.`,
      subSections: [
        {
          id: 'fb_intro_1',
          heading: 'Core Definition',
          keyPoints: ['Clear definition', 'Business relevance', 'Current landscape'],
          requiredFactTypes: ['definition', 'insight'] as FactType[],
        },
        {
          id: 'fb_intro_2',
          heading: 'Key Signals',
          keyPoints: ['Major indicators', 'Notable benchmarks'],
          requiredFactTypes: ['statistic', 'insight'] as FactType[],
        },
      ],
      contentElements: [{ type: 'direct-answer' as const, properties: { intent: 'overview' } }],
      factRequirements: {
        minimumFacts: 3,
        preferredCategories: ['definition', 'insight', 'statistic'],
        confidenceThreshold: 60,
        relevanceThreshold: 55,
      },
      order: 1,
    },
    {
      id: 'fb_strategy',
      heading: `${topic} Strategy Framework`,
      goal: `Provide a practical strategy framework for ${topic}.`,
      subSections: [
        {
          id: 'fb_strategy_1',
          heading: 'Framework Components',
          keyPoints: ['Planning pillars', 'Execution model', 'Priority setting'],
          requiredFactTypes: ['process', 'insight'] as FactType[],
        },
        {
          id: 'fb_strategy_2',
          heading: 'Decision Criteria',
          keyPoints: ['How to choose tactics', 'Trade-off guidance'],
          requiredFactTypes: ['claim', 'example'] as FactType[],
        },
      ],
      contentElements: [{ type: 'bullet-points' as const, properties: { style: 'checklist' } }],
      factRequirements: {
        minimumFacts: 4,
        preferredCategories: ['process', 'insight', 'example'],
        confidenceThreshold: 65,
        relevanceThreshold: 60,
      },
      order: 2,
    },
    {
      id: 'fb_execution',
      heading: `How to Execute ${topic} Step by Step`,
      goal: 'Give actionable implementation guidance.',
      subSections: [
        {
          id: 'fb_execution_1',
          heading: 'Preparation',
          keyPoints: ['Inputs needed', 'Setup checklist'],
          requiredFactTypes: ['process', 'technical'] as FactType[],
        },
        {
          id: 'fb_execution_2',
          heading: 'Execution Workflow',
          keyPoints: ['Operational sequence', 'Milestones'],
          requiredFactTypes: ['process', 'example'] as FactType[],
        },
      ],
      contentElements: [{ type: 'code-block' as const, properties: { label: 'workflow' } }],
      factRequirements: {
        minimumFacts: 4,
        preferredCategories: ['process', 'technical', 'example'],
        confidenceThreshold: 65,
        relevanceThreshold: 60,
      },
      order: 3,
    },
    {
      id: 'fb_comparison',
      heading: `${topic} Options and Comparisons`,
      goal: 'Compare approaches and highlight trade-offs.',
      subSections: [
        {
          id: 'fb_comparison_1',
          heading: 'Approach Comparison',
          keyPoints: ['Pros and cons', 'When each approach works best'],
          requiredFactTypes: ['statistic', 'claim', 'example'] as FactType[],
        },
      ],
      contentElements: [{ type: 'comparison-table' as const, properties: { columns: ['Option', 'Strength', 'Risk'] } }],
      factRequirements: {
        minimumFacts: 3,
        preferredCategories: ['statistic', 'claim', 'example'],
        confidenceThreshold: 60,
        relevanceThreshold: 55,
      },
      order: 4,
    },
    {
      id: 'fb_pitfalls',
      heading: `Common ${topic} Mistakes and Fixes`,
      goal: 'Surface frequent pitfalls with corrective actions.',
      subSections: [
        {
          id: 'fb_pitfalls_1',
          heading: 'Frequent Pitfalls',
          keyPoints: ['Top mistakes', 'Root causes'],
          requiredFactTypes: ['claim', 'insight'] as FactType[],
        },
        {
          id: 'fb_pitfalls_2',
          heading: 'Corrective Actions',
          keyPoints: ['How to recover', 'Prevention checklist'],
          requiredFactTypes: ['process', 'example'] as FactType[],
        },
      ],
      contentElements: [{ type: 'bullet-points' as const, properties: { style: 'warnings' } }],
      factRequirements: {
        minimumFacts: 3,
        preferredCategories: ['insight', 'claim', 'process'],
        confidenceThreshold: 60,
        relevanceThreshold: 55,
      },
      order: 5,
    },
    {
      id: 'fb_faq',
      heading: `${topic} FAQs`,
      goal: 'Answer high-intent user questions.',
      subSections: [
        {
          id: 'fb_faq_1',
          heading: 'Most Asked Questions',
          keyPoints: ['Clarify common concerns', 'Address practical objections'],
          requiredFactTypes: ['definition', 'insight', 'example'] as FactType[],
        },
      ],
      contentElements: [{ type: 'faq' as const, properties: { minQuestions: 5 } }],
      factRequirements: {
        minimumFacts: 3,
        preferredCategories: ['definition', 'insight', 'example'],
        confidenceThreshold: 55,
        relevanceThreshold: 50,
      },
      order: 6,
    },
  ];

  const sectionCount = Math.max(1, sections.length);
  const factsPerSection = Math.max(1, Math.floor(Math.max(allFacts.length, sectionCount) / sectionCount));
  const estimatedLength = Math.max(2200, sectionCount * 380);

  return {
    sections,
    seoMetadata: {
      title: `${topic}: Practical ${format} Guide`,
      metaDescription: `Actionable, fact-based ${topic} guide with frameworks, comparisons, and implementation steps in a ${tone} tone.`,
      targetKeywords: targetKeywords.length > 0 ? targetKeywords : [topic],
      focusKeyword,
    },
    estimatedLength,
    targetKeywords: targetKeywords.length > 0 ? targetKeywords : [topic],
    factMappingStrategy: {
      totalFactsAvailable: allFacts.length,
      factsPerSection,
      overlapStrategy: 'moderate',
      qualityThreshold: 70,
    },
  };
}

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
        limit: 2,
        scope: "account",
        key: '"ai-provider-limit"',
      }
    ],
    retries: RETRY_CONFIG['ai-request'].attempts,
  },
  { event: 'content/fact-based-strategy-generate' },
  async ({ event, step }) => {
    const { userId, projectId, researchData, topic, tone, format } = event.data;

    const idempotencyKey = generateIdempotencyKey.blueprint(userId, projectId);

    try {
      // Check for duplicate strategy requests
      const duplicateCheck = await step.run('check-duplicate-strategy', async () => {
        const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
        return existingResult ? JSON.parse(existingResult as string) : null;
      });

      if (duplicateCheck) {
        console.log(`Duplicate strategy request detected for ${idempotencyKey}`);
        return duplicateCheck;
      }

      await step.run('update-project-status-planning', async () => {
        await supabaseAdmin
          .from('projects')
          .update({
            status: 'planning',
            status_message: 'Generating fact-based content blueprint...',
            current_step: 'Blueprint generation',
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', userId);
      });

      // Get project data
      const projectData = await step.run('fetch-project-data', async () => {
        const supabase = supabaseAdmin;

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
      const allFacts = [...availableFacts, ...brandFacts] as FactRecord[];

      console.log(`Generating fact-based strategy for project ${projectData.id} using ${allFacts.length} atomic facts`);

      // Generate fact-aware content strategy
      const blueprint = await step.run('generate-fact-based-blueprint-strategy', async () => {
        // Prepare fact summary for strategy generation
        const factSummary = allFacts
          .filter((fact) => (fact.confidence || 0) > 70 && (fact.relevanceScore || 0) > 60)
          .sort((a, b) => ((b.confidence || 0) * (b.relevanceScore || 0)) - ((a.confidence || 0) * (a.relevanceScore || 0)))
          .slice(0, 30)
          .map((fact) => `[${fact.category}] ${fact.fact} (Confidence: ${fact.confidence}%, Relevance: ${fact.relevanceScore}%)`)
          .join('\n');

        const factsByCategory = allFacts.reduce((acc, fact) => {
          const category = fact.category || 'uncategorized';
          if (!acc[category]) acc[category] = 0;
          acc[category]++;
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
        1. Create ${FAST_PIPELINE_MODE ? '4-6' : '5-8'} main sections that maximize use of available atomic facts
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
        Target Length: ${FAST_PIPELINE_MODE ? '1400-2200' : '2000-3000'} words
        
        Generate a detailed content blueprint that maps atomic facts to sections for maximum impact.
      `;

        try {
          const result = await generateStructuredOutput(
            strategyPrompt,
            FactBasedBlueprintSchema,
            'blueprint',
            userId
          );

          return result.object;
        } catch (structuredError) {
          console.warn('Structured blueprint generation failed, using deterministic fallback:', structuredError);
          return buildFallbackFactBasedBlueprint(topic, tone, format, allFacts, researchData);
        }
      });

      // Validate and optimize fact mapping
      const optimizedBlueprint = await step.run('optimize-fact-mapping', async () => {
        const limitedSections = blueprint.sections
          .slice(0, MAX_GENERATION_SECTIONS)
          .map((section, index) => ({
            ...section,
            order: index + 1,
          }));

        // Ensure each section has adequate fact coverage
        const optimizedSections = await Promise.all(
          limitedSections.map(async (section) => {
            // Find relevant facts for this section
            const sectionFacts = await atomicFactsExtractor.filterFactsForSection(
              allFacts as any,
              section.heading,
              section.goal,
              section.subSections.flatMap((sub) => sub.keyPoints),
              userId
            );

            // Update section with actual fact availability
            return {
              ...section,
              factRequirements: {
                ...section.factRequirements,
                availableFacts: sectionFacts.length,
                factIds: sectionFacts.map((fact) => fact.id)
              }
            };
          })
        );

        const sectionCount = Math.max(1, optimizedSections.length);

        return {
          ...blueprint,
          sections: optimizedSections,
          estimatedLength: Math.max(1200, optimizedSections.length * (FAST_PIPELINE_MODE ? 260 : 380)),
          factMappingStrategy: {
            ...blueprint.factMappingStrategy,
            totalFactsAvailable: allFacts.length,
            factsPerSection: Math.max(1, Math.floor(allFacts.length / sectionCount)),
            qualityThreshold: 70
          }
        };
      });

      // Store blueprint and create content sections
      await step.run('store-fact-based-blueprint', async () => {
        const supabase = supabaseAdmin;

        // Update project with fact-based blueprint
        const { error: projectError } = await supabase
          .from('projects')
          .update({
            blueprint: optimizedBlueprint,
            status: 'writing',
            status_message: `Blueprint ready. Generating ${optimizedBlueprint.sections.length} content sections...`,
            current_step: 'Section generation',
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId)
          .eq('user_id', userId);

        if (projectError) {
          throw new Error(`Failed to update project: ${projectError.message}`);
        }

        // Create content sections with fact mapping
        const sectionsToInsert = optimizedBlueprint.sections.map((section) => ({
          project_id: projectId,
          section_order: section.order,
          heading: section.heading,
          goal: section.goal,
          sub_sections: section.subSections,
          content_elements: section.contentElements.map((el) => el.type),
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

        // Backward-compatible event for existing realtime UI hooks.
        await supabase
          .channel(`project:${projectId}`)
          .send({
            type: 'broadcast',
            event: 'strategy_complete',
            payload: {
              projectId,
              blueprint: optimizedBlueprint,
              sectionsCount: optimizedBlueprint.sections.length,
              status: 'writing'
            }
          });
      });

      // Fan-out: Trigger parallel fact-based content generation
      await step.run('trigger-fact-based-section-generation', async () => {
        const fanOutEvents = optimizedBlueprint.sections.map((section) => ({
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
    } catch (error) {
      console.error(`Fact-based strategy generation failed for project ${projectId}:`, error);

      await step.run('mark-strategy-generation-error', async () => {
        await supabaseAdmin
          .from('projects')
          .update({
            status: 'error',
            status_message: 'Failed to generate content blueprint. Please retry research.',
            current_step: 'Blueprint generation failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', userId);
      });

      throw error;
    }
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
        limit: 2,
        scope: "account",
        key: '"ai-provider-limit"',
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
      return existingResult ? JSON.parse(existingResult as string) : null;
    });

    if (duplicateCheck) {
      console.log(`Duplicate section request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }

    // Update section status
    await step.run('update-section-status-writing', async () => {
      const supabase = supabaseAdmin;

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

    // Filter and select relevant atomic facts for this section
    const sectionFacts = await step.run('select-section-facts', async () => {
      console.log(`Selecting atomic facts for section: ${section.heading}`);

      const relevantFacts = await atomicFactsExtractor.filterFactsForSection(
        availableFacts,
        section.heading,
        section.goal,
        section.subSections.flatMap((sub: any) => sub.keyPoints),
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
      const supabase = supabaseAdmin;

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
        ${section.subSections.map((sub: any) => `- ${sub.heading}: ${sub.keyPoints.join(', ')}`).join('\n')}

        Content Elements to include:
        ${section.contentElements.map((el: any) => `- ${el.type}: ${JSON.stringify(el.properties)}`).join('\n')}
        
        ATOMIC FACTS FOR THIS SECTION (${sectionFacts.length} facts):
        ${factContext}
        
        FACTS BY CATEGORY:
        ${Object.entries(factsByCategory).map(([category, facts]) =>
        `${category.toUpperCase()}:\n${facts.map(fact => `  • ${fact}`).join('\n')}`
      ).join('\n\n')}
        
        Previous Sections Context:
        ${previousSections.map(prev => `${prev.heading}: ${prev.generated_content?.substring(0, 200)}...`).join('\n')}
        
        FACT-BASED WRITING REQUIREMENTS:
        1. Write ${SECTION_WORD_TARGET} words for this section
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
        averageConfidence: sectionFacts.length > 0
          ? Math.round(sectionFacts.reduce((sum, fact) => sum + fact.confidence, 0) / sectionFacts.length)
          : 0,
        categories: [...new Set(sectionFacts.map(fact => fact.category))]
      };

      return contentWithMetadata;
    });

    // Store generated content with fact metadata
    await step.run('store-fact-based-section-content', async () => {
      const supabase = supabaseAdmin;

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

      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'section_complete',
          payload: {
            projectId,
            sectionId,
            heading: section.heading,
            content: validatedContent.content,
            status: 'completed',
            wordCount: validatedContent.content.split(' ').length,
          }
        });
    });

    // Check if all sections are complete
    await step.run('check-project-completion', async () => {
      const supabase = supabaseAdmin;

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
      limit: 2,
      scope: "account",
      key: '"ai-provider-limit"',
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
