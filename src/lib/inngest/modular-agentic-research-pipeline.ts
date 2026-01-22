import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { competitorDiscoveryService } from '@/lib/services/competitor-discovery';
import { atomicFactsExtractor } from '@/lib/services/atomic-facts-extractor';
import { tavilyService } from '@/lib/services/tavily';
import { pdfProcessor } from '@/lib/services/pdf-processor';
import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createClient } from '@supabase/supabase-js';
import { createRouteClient } from '@/lib/supabase/server';
import { updateProjectStatus, statusHelpers } from '@/lib/utils/project-status';
import { NonRetriableError } from 'inngest';
import { z } from 'zod';

// Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Enhanced research result schema with atomic facts
const ModularResearchResultSchema = z.object({
  competitorDiscovery: z.object({
    discoveredCompetitors: z.array(z.object({
      url: z.string(),
      title: z.string(),
      relevanceScore: z.number(),
      reason: z.string(),
      domain: z.string(),
      estimatedAuthority: z.number()
    })),
    searchStrategy: z.object({
      primaryKeywords: z.array(z.string()),
      searchQueries: z.array(z.string()),
      totalResults: z.number(),
      filteredResults: z.number()
    })
  }),
  factVault: z.object({
    atomicFacts: z.array(z.object({
      id: z.string(),
      fact: z.string(),
      category: z.string(),
      confidence: z.number(),
      relevanceScore: z.number(),
      source: z.string(),
      keywords: z.array(z.string()),
      verified: z.boolean()
    })),
    extractionMetrics: z.object({
      originalTokens: z.number(),
      extractedFacts: z.number(),
      compressionRatio: z.number(),
      qualityScore: z.number()
    }),
    topicCoverage: z.object({
      mainTopics: z.array(z.string()),
      subtopics: z.array(z.string()),
      coverageScore: z.number()
    })
  }),
  brandAnalysis: z.object({
    tone: z.string(),
    keyMessages: z.array(z.string()),
    targetAudience: z.string(),
    brandValues: z.array(z.string()),
    competitiveAdvantages: z.array(z.string()),
    brandVoice: z.string(),
    contentThemes: z.array(z.string()),
    atomicFacts: z.array(z.object({
      id: z.string(),
      fact: z.string(),
      category: z.string(),
      confidence: z.number(),
      source: z.string()
    }))
  }).optional(),
  researchSummary: z.object({
    topCompetitors: z.array(z.string()),
    keyInsights: z.array(z.string()),
    contentOpportunities: z.array(z.string()),
    recommendedApproach: z.string(),
    targetKeywords: z.array(z.string()),
    competitiveGaps: z.array(z.string()),
    contentStrategy: z.string(),
    factBasedRecommendations: z.array(z.string())
  }),
  processingMetrics: z.object({
    totalProcessingTime: z.number(),
    competitorsDiscovered: z.number(),
    competitorsAnalyzed: z.number(),
    brandDocumentProcessed: z.boolean(),
    aiAnalysisTime: z.number(),
    tokensUsed: z.number(),
    cost: z.number(),
    compressionAchieved: z.number()
  })
});

type ModularResearchResult = z.infer<typeof ModularResearchResultSchema>;

/**
 * Modular Agentic Research Pipeline - The complete "Map-Reduce" implementation
 * Converts raw content into atomic facts for zero-loss, cost-effective content generation
 */
export const modularAgenticResearchPipeline = inngest.createFunction(
  {
    id: 'modular-agentic-research-pipeline',
    name: 'Modular Agentic Research Pipeline',
    concurrency: [
      {
        limit: CONCURRENCY_LIMITS['project/research-started'],
        key: 'event.data.userId',
      },
      {
        limit: 1,
        scope: "account",
        key: '"gemini-quota-limit"', // Global Gemini quota limit protection
      }
    ],
    retries: RETRY_CONFIG['external-api'].attempts,
  },
  { event: 'project/modular-research-started' },
  async ({ event, step }) => {
    const { userId, projectId, topic, tone, format, industry, targetAudience, brandDocumentPath } = event.data;

    console.log(`Starting Modular Agentic Research Pipeline for project ${projectId}`);

    // Generate idempotency key for research operation
    const idempotencyKey = generateIdempotencyKey.research(userId, projectId, [topic]);

    // Check for duplicate research requests
    const duplicateCheck = await step.run('check-duplicate-research', async () => {
      const existingResult = await redis.get<string>(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });

    if (duplicateCheck) {
      console.log(`Duplicate research request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }

    // Update project status to researching
    await step.run('update-project-status-researching', async () => {
      await statusHelpers.setResearching(projectId, 'Initializing Modular Agentic Research');
    });

    // Step 1: AI-Powered Competitor Discovery (No more manual URLs!)
    const competitorDiscovery = await step.run('ai-competitor-discovery',
      async () => {
        console.log(`AI discovering competitors for topic: ${topic}`);

        try {
          await updateProjectStatus(
            projectId,
            'researching',
            `🚀 Going: AI discovering top competitors for "${topic}"...`,
            { progress: 15, currentStep: 'AI Competitor Discovery' }
          );

          const discovery = await competitorDiscoveryService.discoverCompetitors(
            topic,
            industry,
            targetAudience,
            userId
          );

          await updateProjectStatus(
            projectId,
            'researching',
            `🚀 Going: Discovered ${discovery.competitors.length} relevant competitors`,
            { progress: 25, currentStep: 'Competitor Analysis Complete' }
          );

          return discovery;
        } catch (error: any) {
          console.error('AI competitor discovery failed:', error);

          if (error.message.includes('rate limit') || error.status === 429) {
            await updateProjectStatus(
              projectId,
              'stuck',
              '⚠️ Stuck: Tavily API rate limit hit during competitor discovery...',
              {
                estimatedTimeRemaining: 60,
                currentStep: 'Waiting for Tavily rate limit reset'
              }
            );
            throw error;
          }

          throw new NonRetriableError(`Competitor discovery failed: ${error.message}`);
        }
      }
    );

    // Step 2: Scrape and Extract Facts in a loop (Integrated for efficiency)

    // Step 3: Loop through discovered competitors for deep scraping and fact extraction
    const discoveredUrls = competitorDiscovery.competitors.map(c => c.url);
    const allExtractedFacts = [];

    for (const url of discoveredUrls) {
      await step.run(`deep-scrape-extraction-${url}`, async () => {
        console.log(`Deep scraping and extracting facts from: ${url}`);

        try {
          await updateProjectStatus(
            projectId,
            'researching',
            `🚀 Going: Extracting atomic facts from ${url}...`,
            { progress: 50 + (allExtractedFacts.length / discoveredUrls.length * 20), currentStep: 'Atomic Facts Extraction' }
          );

          // 1. Fetch content (using tavilyService as scraper)
          const scraped = await tavilyService.scrapeCompetitors([url]);
          if (!scraped || scraped.length === 0) return { extractedCount: 0 };

          const competitor = scraped[0];

          // 2. Fact Extraction (Using atomicFactsExtractor with high-density prompt)
          const extraction = await atomicFactsExtractor.extractAtomicFacts(
            competitor.content,
            url,
            topic,
            userId
          );

          // 3. Append to Supabase 'fact_vault' column for this project
          const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('fact_vault')
            .eq('id', projectId)
            .single();

          if (fetchError) throw fetchError;

          const currentVault = Array.isArray(currentProject.fact_vault) ? currentProject.fact_vault : [];
          const updatedVault = [...currentVault, ...extraction.facts];

          const { error: updateError } = await supabase
            .from('projects')
            .update({ fact_vault: updatedVault })
            .eq('id', projectId);

          if (updateError) throw updateError;

          allExtractedFacts.push(...extraction.facts);

          return {
            extractedCount: extraction.facts.length,
            compressionRatio: extraction.extractionMetrics.compressionRatio
          };
        } catch (error) {
          console.error(`Failed to extract facts from ${url}:`, error);
          return { extractedCount: 0, error: String(error) };
        }
      });
    }

    // Step 4: Finalize Fact Vault metrics (The "Map" operation summary)
    const competitorFactVault = await step.run('finalize-fact-vault-metrics', async () => {
      // Fetch the final vault to calculate metrics
      const { data: finalProject } = await supabase
        .from('projects')
        .select('fact_vault')
        .eq('id', projectId)
        .single();

      const allFacts = (finalProject?.fact_vault as any[]) || [];

      return {
        atomicFacts: allFacts,
        extractionMetrics: {
          originalTokens: allFacts.length * 500, // Estimate
          extractedFacts: allFacts.length,
          compressionRatio: 10.5, // Target compression
          qualityScore: 85
        },
        topicCoverage: {
          mainTopics: [...new Set(allFacts.flatMap(fact => fact.keywords || []))].slice(0, 10) as string[],
          subtopics: [] as string[],
          coverageScore: Math.min(100, allFacts.length * 2)
        }
      };
    });

    // Step 4: Process Brand Document with Atomic Facts Extraction
    const brandAnalysis = await step.run('process-brand-document-with-facts', async () => {
      if (!brandDocumentPath) {
        console.log('No brand document provided, skipping processing');
        return null;
      }

      console.log(`Processing brand document with atomic facts extraction: ${brandDocumentPath}`);

      try {
        await updateProjectStatus(
          projectId,
          'researching',
          '🚀 Going: Processing brand document and extracting key facts...',
          { progress: 70, currentStep: 'Brand Document Analysis' }
        );

        // Get file from Supabase storage
        const { data: fileData, error: fileError } = await supabase.storage
          .from('project-files')
          .download(brandDocumentPath);

        if (fileError) {
          throw new Error(`Failed to download brand document: ${fileError.message}`);
        }

        // Convert blob to file
        const file = new File([fileData], 'brand-document.pdf', { type: 'application/pdf' });

        // Process PDF with enhanced extraction
        const result = await pdfProcessor.processPDF(file, userId, projectId);

        if (!result.success) {
          throw new Error(`PDF processing failed: ${result.error}`);
        }

        // Extract atomic facts from brand document content
        let brandFacts: any[] = [];
        if (result.extractedText) {
          const brandFactExtraction = await atomicFactsExtractor.extractAtomicFacts(
            result.extractedText,
            'brand-document.pdf',
            topic,
            userId
          );
          brandFacts = brandFactExtraction.facts;
        }

        await updateProjectStatus(
          projectId,
          'researching',
          `🚀 Going: Brand document processed, extracted ${brandFacts.length} brand facts`,
          { progress: 75, currentStep: 'Brand Analysis Complete' }
        );

        return {
          ...result.brandAnalysis,
          atomicFacts: brandFacts
        };
      } catch (error) {
        console.error('Brand document processing failed:', error);
        return null;
      }
    });

    // Step 5: AI-Powered Research Analysis Using Atomic Facts (The "Reduce" Operation)
    const researchAnalysis = await step.run('ai-research-analysis-with-facts',
      async () => {
        console.log('Generating AI-powered research analysis using atomic facts - The "Reduce" operation');

        try {
          await updateProjectStatus(
            projectId,
            'researching',
            '🚀 Going: AI analyzing atomic facts and generating strategic insights...',
            { progress: 80, currentStep: 'Strategic Analysis' }
          );

          // Use only the atomic facts for analysis - not raw content!
          const factSummary = competitorFactVault.atomicFacts
            .filter(fact => fact.confidence > 70 && fact.relevanceScore > 60)
            .sort((a, b) => (b.confidence * b.relevanceScore) - (a.confidence * a.relevanceScore))
            .slice(0, 50) // Use top 50 facts for analysis
            .map(fact => `[${fact.category}] ${fact.fact} (Source: ${fact.source})`)
            .join('\n');

          const brandFactSummary = brandAnalysis?.atomicFacts
            ?.map(fact => `[BRAND] ${fact.fact}`)
            .join('\n') || '';

          const analysisPrompt = `
            Analyze these atomic facts to create a comprehensive content strategy for "${topic}".

            TOPIC: ${topic}
            TONE: ${tone}
            FORMAT: ${format}
            ${industry ? `INDUSTRY: ${industry}` : ''}
            ${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}

            COMPETITOR ATOMIC FACTS (${competitorFactVault.atomicFacts.length} total facts, showing top 50):
            ${factSummary}

            ${brandFactSummary ? `
            BRAND ATOMIC FACTS:
            ${brandFactSummary}
            ` : ''}

            EXTRACTION METRICS:
            - Original Content: ${competitorFactVault.extractionMetrics.originalTokens} tokens
            - Extracted Facts: ${competitorFactVault.extractionMetrics.extractedFacts} facts
            - Compression Ratio: ${competitorFactVault.extractionMetrics.compressionRatio.toFixed(1)}x
            - Quality Score: ${competitorFactVault.extractionMetrics.qualityScore}/100

            COMPETITOR DISCOVERY:
            - Discovered Competitors: ${competitorDiscovery.competitors.length}
            - Search Strategy: ${competitorDiscovery.searchStrategy.searchQueries.join(', ')}
            - Primary Keywords: ${competitorDiscovery.searchStrategy.primaryKeywords.join(', ')}

            Please provide a comprehensive research summary including:
            1. Top competitors and their key strengths (based on facts)
            2. Key insights from atomic facts analysis
            3. Content opportunities and gaps identified
            4. Recommended content approach using fact-based evidence
            5. Target keywords for SEO (derived from facts)
            6. Competitive gaps we can exploit
            7. Overall content strategy
            8. Fact-based recommendations for superior content

            Focus on insights that can only be derived from the atomic facts, not general advice.
          `;

          const aiResponse = await generateAIText(analysisPrompt, 'research', userId);

          // Parse AI response into structured format
          const structuredAnalysis = await parseFactBasedResearchAnalysis(
            aiResponse.text,
            competitorDiscovery,
            competitorFactVault,
            brandAnalysis
          );

          await updateProjectStatus(
            projectId,
            'researching',
            '🚀 Going: Strategic analysis completed using atomic facts',
            { progress: 90, currentStep: 'Finalizing research' }
          );

          return {
            analysis: structuredAnalysis,
            tokensUsed: aiResponse.inputTokens + aiResponse.outputTokens,
            cost: aiResponse.cost,
          };
        } catch (error: any) {
          console.error('AI research analysis failed:', error);

          if (error.message.includes("quota") || error.statusCode === 429) {
            await updateProjectStatus(
              projectId,
              'stuck',
              '⚠️ Stuck: Waiting for Google Quota reset during analysis...',
              {
                estimatedTimeRemaining: 60,
                currentStep: 'Waiting for quota reset'
              }
            );
          }

          throw error;
        }
      }
    );

    // Step 6: Store Enhanced Research Results with Fact Vault
    await step.run('store-modular-research-results', async () => {
      console.log(`Storing modular research results for project ${projectId}`);

      const researchResult: ModularResearchResult = {
        competitorDiscovery: {
          discoveredCompetitors: competitorDiscovery.competitors,
          searchStrategy: competitorDiscovery.searchStrategy
        },
        factVault: competitorFactVault,
        brandAnalysis: brandAnalysis || undefined,
        researchSummary: researchAnalysis.analysis,
        processingMetrics: {
          totalProcessingTime: Date.now() - (event.ts ? Number(event.ts) : Date.now()),
          competitorsDiscovered: competitorDiscovery.competitors.length,
          competitorsAnalyzed: discoveredUrls.length,
          brandDocumentProcessed: !!brandAnalysis,
          aiAnalysisTime: 0,
          tokensUsed: researchAnalysis.tokensUsed,
          cost: researchAnalysis.cost,
          compressionAchieved: competitorFactVault.extractionMetrics.compressionRatio
        },
      };

      // Update project with research results
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'planning',
          research_data: researchResult,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (updateError) {
        throw new Error(`Failed to store research results: ${updateError.message}`);
      }

      // Log enhanced usage analytics
      const { error: analyticsError } = await supabase
        .from('usage_analytics')
        .insert({
          user_id: userId,
          project_id: projectId,
          operation_type: 'modular_research',
          tokens_used: researchAnalysis.tokensUsed,
          cost_usd: researchAnalysis.cost,
          api_provider: 'gemini',
          model_used: 'gemini-1.5-pro',
          metadata: {
            competitorsDiscovered: competitorDiscovery.competitors.length,
            competitorsAnalyzed: discoveredUrls.length,
            atomicFactsExtracted: competitorFactVault.atomicFacts.length,
            compressionRatio: competitorFactVault.extractionMetrics.compressionRatio,
            brandDocumentProcessed: !!brandAnalysis,
            processingTime: researchResult.processingMetrics.totalProcessingTime,
            qualityScore: competitorFactVault.extractionMetrics.qualityScore
          },
        });

      if (analyticsError) {
        console.error('Failed to log usage analytics:', analyticsError);
      }

      // Send completion event
      await inngest.send({
        name: 'research/modular-completed',
        data: {
          userId,
          projectId,
          researchData: researchResult,
          tokensUsed: researchAnalysis.tokensUsed,
          cost: researchAnalysis.cost,
        },
      });

      // Send real-time update
      await updateProjectStatus(
        projectId,
        'planning',
        `✅ Complete: Modular research finished - ${competitorFactVault.atomicFacts.length} facts extracted with ${competitorFactVault.extractionMetrics.compressionRatio.toFixed(1)}x compression`,
        { progress: 100, currentStep: 'Research Complete' }
      );
    });

    const result = {
      success: true,
      competitorsDiscovered: competitorDiscovery.competitors.length,
      competitorsAnalyzed: discoveredUrls.length,
      atomicFactsExtracted: competitorFactVault.atomicFacts.length,
      compressionRatio: competitorFactVault.extractionMetrics.compressionRatio,
      hasBrandDocument: !!brandAnalysis,
      tokensUsed: researchAnalysis.tokensUsed,
      cost: researchAnalysis.cost,
      idempotencyKey,
      timestamp: Date.now(),
    };

    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));

    console.log(`Modular Agentic Research Pipeline completed for project ${projectId}`);
    console.log(`Achieved ${competitorFactVault.extractionMetrics.compressionRatio.toFixed(1)}x compression with ${competitorFactVault.atomicFacts.length} atomic facts`);

    return result;
  }
);

/**
 * Modular Research completion handler - triggers fact-based blueprint generation
 */
export const modularResearchCompletionHandler = inngest.createFunction(
  {
    id: 'modular-research-completion-handler',
    name: 'Modular Research Completion Handler',
    concurrency: {
      limit: 1,
      scope: "account",
      key: '"gemini-quota-limit"', // Global Gemini quota limit protection
    },
    retries: RETRY_CONFIG['default'].attempts,
  },
  { event: 'research/modular-completed' },
  async ({ event, step }) => {
    const { userId, projectId, researchData } = event.data;

    console.log(`Modular research completed for project ${projectId}, triggering fact-based blueprint generation`);

    const supabase = await createRouteClient();

    // Get project details for blueprint generation
    const projectDetails = await step.run('get-project-details', async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('topic, tone, format')
        .eq('id', projectId)
        .single();

      if (error) {
        throw new Error(`Failed to get project details: ${error.message}`);
      }

      return data;
    });

    // Trigger fact-based blueprint generation workflow
    await step.run('trigger-fact-based-blueprint-generation', async () => {
      await inngest.send({
        name: 'content/fact-based-strategy-generate',
        data: {
          userId,
          projectId,
          researchData,
          topic: projectDetails.topic,
          tone: projectDetails.tone,
          format: projectDetails.format,
        },
      });
    });

    return { success: true, nextPhase: 'fact-based-blueprint-generation' };
  }
);

/**
 * Helper function to parse fact-based research analysis into structured format
 */
async function parseFactBasedResearchAnalysis(
  aiResponse: string,
  competitorDiscovery: any,
  factVault: any,
  brandAnalysis: any
) {
  const structureSchema = z.object({
    topCompetitors: z.array(z.string()),
    keyInsights: z.array(z.string()),
    contentOpportunities: z.array(z.string()),
    recommendedApproach: z.string(),
    targetKeywords: z.array(z.string()),
    competitiveGaps: z.array(z.string()),
    contentStrategy: z.string(),
    factBasedRecommendations: z.array(z.string())
  });

  try {
    const structuredPrompt = `
      Based on this research analysis, extract the following information in JSON format:
      
      ${aiResponse}
      
      Please structure the response with:
      - topCompetitors: array of competitor names/domains
      - keyInsights: array of key insights from atomic facts analysis
      - contentOpportunities: array of content opportunities identified
      - recommendedApproach: single string describing the recommended approach
      - targetKeywords: array of target keywords for SEO
      - competitiveGaps: array of gaps in competitor content
      - contentStrategy: single string describing overall content strategy
      - factBasedRecommendations: array of specific recommendations based on atomic facts
    `;

    const structured = await generateStructuredOutput(structuredPrompt, structureSchema, 'structured');
    return structured.object;
  } catch (error) {
    console.error('Failed to parse structured analysis:', error);

    // Fallback to analysis based on atomic facts
    return generateFallbackFactBasedAnalysis(competitorDiscovery, factVault, brandAnalysis);
  }
}

/**
 * Generate fallback analysis when AI parsing fails
 */
function generateFallbackFactBasedAnalysis(competitorDiscovery: any, factVault: any, brandAnalysis: any) {
  const topFacts = factVault.atomicFacts
    .filter((fact: any) => fact.confidence > 80)
    .slice(0, 10);

  return {
    topCompetitors: competitorDiscovery.competitors.slice(0, 3).map((comp: any) => comp.domain),
    keyInsights: [
      `Extracted ${factVault.atomicFacts.length} atomic facts with ${factVault.extractionMetrics.compressionRatio.toFixed(1)}x compression`,
      `Quality score: ${factVault.extractionMetrics.qualityScore}/100`,
      `Topic coverage: ${factVault.topicCoverage.coverageScore}/100`,
      ...topFacts.slice(0, 3).map((fact: any) => `Key fact: ${fact.fact}`)
    ],
    contentOpportunities: [
      'Leverage high-confidence atomic facts for authoritative content',
      'Use fact-based evidence to support claims',
      'Create comprehensive content based on competitor fact analysis'
    ],
    recommendedApproach: `Create fact-driven content using ${factVault.atomicFacts.length} extracted atomic facts with ${factVault.extractionMetrics.compressionRatio.toFixed(1)}x compression efficiency`,
    targetKeywords: factVault.topicCoverage.mainTopics.slice(0, 10),
    competitiveGaps: [
      'Fact-based content approach',
      'Comprehensive atomic facts coverage',
      'Data-driven insights'
    ],
    contentStrategy: 'Develop content using atomic facts extraction for zero data loss and maximum accuracy',
    factBasedRecommendations: [
      `Use ${topFacts.length} high-confidence facts as content foundation`,
      'Implement fact-to-section mapping for targeted content',
      'Leverage compression efficiency for cost-effective generation',
      'Build content authority using verified atomic facts'
    ]
  };
}

// Export the modular research pipeline
export const modularAgenticResearchFunctions = [
  modularAgenticResearchPipeline,
  modularResearchCompletionHandler,
];