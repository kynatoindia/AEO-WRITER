import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { redis, CACHE_KEYS } from '@/lib/redis/client';
import { tavilyService } from '@/lib/services/tavily';
import { pdfProcessor } from '@/lib/services/pdf-processor';
import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Research pipeline schemas
const researchResultSchema = z.object({
  competitorData: z.array(z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    headings: z.array(z.string()),
    wordCount: z.number(),
    keyTopics: z.array(z.string()),
    metaDescription: z.string().optional(),
    structuredData: z.record(z.any()).optional(),
    lastUpdated: z.string().optional(),
  })),
  brandAnalysis: z.object({
    tone: z.string(),
    keyMessages: z.array(z.string()),
    targetAudience: z.string(),
    brandValues: z.array(z.string()),
    competitiveAdvantages: z.array(z.string()),
    brandVoice: z.string(),
    contentThemes: z.array(z.string()),
  }).optional(),
  researchSummary: z.object({
    topCompetitors: z.array(z.string()),
    keyInsights: z.array(z.string()),
    contentOpportunities: z.array(z.string()),
    recommendedApproach: z.string(),
    targetKeywords: z.array(z.string()),
    competitiveGaps: z.array(z.string()),
    contentStrategy: z.string(),
  }),
  processingMetrics: z.object({
    totalProcessingTime: z.number(),
    competitorsScrapped: z.number(),
    brandDocumentProcessed: z.boolean(),
    aiAnalysisTime: z.number(),
    tokensUsed: z.number(),
    cost: z.number(),
  }),
});

type ResearchResult = z.infer<typeof researchResultSchema>;

/**
 * Main research pipeline workflow - orchestrates the entire research process
 */
export const researchPipelineWorkflow = inngest.createFunction(
  {
    id: 'research-pipeline-workflow',
    name: 'Research Pipeline Workflow',
    concurrency: {
      limit: CONCURRENCY_LIMITS['project/research-started'],
      key: 'event.data.userId',
    },
    retries: RETRY_CONFIG['external-api'].attempts,
  },
  { event: 'project/research-started' },
  async ({ event, step }) => {
    const { userId, projectId, competitorUrls, brandDocumentPath, topic, tone, format } = event.data;
    
    console.log(`Starting research pipeline for project ${projectId}`);
    
    // Generate idempotency key for research operation
    const idempotencyKey = generateIdempotencyKey.research(userId, projectId, competitorUrls);
    
    // Check for duplicate research requests
    const duplicateCheck = await step.run('check-duplicate-research', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      console.log(`Duplicate research request detected for ${idempotencyKey}`);
      return duplicateCheck;
    }

    // Update project status to researching
    await step.run('update-project-status', async () => {
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: 'researching',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (error) {
        throw new Error(`Failed to update project status: ${error.message}`);
      }

      // Send real-time update
      await inngest.send({
        name: 'project/status-updated',
        data: {
          userId,
          projectId,
          status: 'researching',
          progress: 10,
          message: 'Starting research phase...',
        },
      });
    });

    // Step 1: Scrape competitor content with retry logic
    const competitorData = await step.run('scrape-competitors', async () => {
      console.log(`Scraping ${competitorUrls.length} competitor URLs`);
      
      try {
        const scraped = await tavilyService.scrapeCompetitors(competitorUrls);
        
        // Send progress update
        await inngest.send({
          name: 'project/status-updated',
          data: {
            userId,
            projectId,
            status: 'researching',
            progress: 30,
            message: `Scraped ${scraped.length} competitor sites`,
          },
        });

        return scraped;
      } catch (error) {
        console.error('Competitor scraping failed:', error);
        
        // Try fallback approach with individual URL processing
        const fallbackResults = [];
        for (const url of competitorUrls) {
          try {
            const result = await tavilyService.scrapeCompetitors([url]);
            fallbackResults.push(...result);
          } catch (urlError) {
            console.error(`Failed to scrape ${url}:`, urlError);
          }
        }
        
        if (fallbackResults.length === 0) {
          throw new Error('Failed to scrape any competitor URLs');
        }
        
        return fallbackResults;
      }
    }, {
      retries: RETRY_CONFIG['external-api'].attempts,
    });

    // Step 2: Process brand document if provided
    const brandAnalysis = await step.run('process-brand-document', async () => {
      if (!brandDocumentPath) {
        console.log('No brand document provided, skipping processing');
        return null;
      }

      console.log(`Processing brand document: ${brandDocumentPath}`);
      
      try {
        // Get file from Supabase storage
        const { data: fileData, error: fileError } = await supabase.storage
          .from('project-files')
          .download(brandDocumentPath);

        if (fileError) {
          throw new Error(`Failed to download brand document: ${fileError.message}`);
        }

        // Convert blob to file
        const file = new File([fileData], 'brand-document.pdf', { type: 'application/pdf' });
        
        // Process PDF
        const result = await pdfProcessor.processPDF(file, userId, projectId);
        
        if (!result.success) {
          throw new Error(`PDF processing failed: ${result.error}`);
        }

        // Send progress update
        await inngest.send({
          name: 'project/status-updated',
          data: {
            userId,
            projectId,
            status: 'researching',
            progress: 50,
            message: 'Brand document processed successfully',
          },
        });

        return result.brandAnalysis;
      } catch (error) {
        console.error('Brand document processing failed:', error);
        // Continue without brand analysis rather than failing the entire pipeline
        return null;
      }
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });

    // Step 3: Generate comprehensive research analysis using AI
    const researchAnalysis = await step.run('generate-research-analysis', async () => {
      console.log('Generating AI-powered research analysis');
      
      const analysisPrompt = `
        Analyze the following competitor research data and brand information to create a comprehensive content strategy:

        TOPIC: ${topic}
        TONE: ${tone}
        FORMAT: ${format}

        COMPETITOR DATA:
        ${competitorData.map((comp, index) => `
        Competitor ${index + 1}: ${comp.title} (${comp.url})
        Word Count: ${comp.wordCount}
        Key Topics: ${comp.keyTopics.join(', ')}
        Headings: ${comp.headings.slice(0, 5).join(', ')}
        Content Preview: ${comp.content.substring(0, 500)}...
        `).join('\n')}

        ${brandAnalysis ? `
        BRAND ANALYSIS:
        Brand Tone: ${brandAnalysis.tone}
        Key Messages: ${brandAnalysis.keyMessages.join(', ')}
        Target Audience: ${brandAnalysis.targetAudience}
        Brand Values: ${brandAnalysis.brandValues.join(', ')}
        Competitive Advantages: ${brandAnalysis.competitiveAdvantages.join(', ')}
        Content Themes: ${brandAnalysis.contentThemes.join(', ')}
        ` : ''}

        Please provide a comprehensive research summary including:
        1. Top competitors and their strengths
        2. Key insights from competitor analysis
        3. Content opportunities and gaps
        4. Recommended content approach
        5. Target keywords for SEO
        6. Competitive gaps we can exploit
        7. Overall content strategy

        Format your response as a structured analysis with clear sections.
      `;

      try {
        const aiResponse = await generateAIText(analysisPrompt, 'research', userId);
        
        // Parse AI response into structured format
        const structuredAnalysis = await parseResearchAnalysis(aiResponse.text, competitorData, brandAnalysis);
        
        // Send progress update
        await inngest.send({
          name: 'project/status-updated',
          data: {
            userId,
            projectId,
            status: 'researching',
            progress: 80,
            message: 'Research analysis completed',
          },
        });

        return {
          analysis: structuredAnalysis,
          tokensUsed: aiResponse.inputTokens + aiResponse.outputTokens,
          cost: aiResponse.cost,
        };
      } catch (error) {
        console.error('AI research analysis failed:', error);
        
        // Generate fallback analysis
        return {
          analysis: generateFallbackAnalysis(competitorData, brandAnalysis, topic),
          tokensUsed: 0,
          cost: 0,
        };
      }
    }, {
      retries: RETRY_CONFIG['ai-request'].attempts,
    });

    // Step 4: Store research results in database
    await step.run('store-research-results', async () => {
      console.log(`Storing research results for project ${projectId}`);
      
      const researchResult: ResearchResult = {
        competitorData,
        brandAnalysis: brandAnalysis || undefined,
        researchSummary: researchAnalysis.analysis,
        processingMetrics: {
          totalProcessingTime: Date.now() - parseInt(event.ts),
          competitorsScrapped: competitorData.length,
          brandDocumentProcessed: !!brandAnalysis,
          aiAnalysisTime: 0, // Would be tracked in production
          tokensUsed: researchAnalysis.tokensUsed,
          cost: researchAnalysis.cost,
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

      // Log usage analytics
      const { error: analyticsError } = await supabase
        .from('usage_analytics')
        .insert({
          user_id: userId,
          project_id: projectId,
          operation_type: 'research',
          tokens_used: researchAnalysis.tokensUsed,
          cost_usd: researchAnalysis.cost,
          api_provider: 'gemini', // Using Gemini as specified in task
          model_used: 'gemini-1.5-pro',
          metadata: {
            competitorCount: competitorData.length,
            brandDocumentProcessed: !!brandAnalysis,
            processingTime: researchResult.processingMetrics.totalProcessingTime,
          },
        });

      if (analyticsError) {
        console.error('Failed to log usage analytics:', analyticsError);
        // Don't fail the entire operation for analytics errors
      }

      // Send completion event
      await inngest.send({
        name: 'research/completed',
        data: {
          userId,
          projectId,
          researchData: researchResult,
          tokensUsed: researchAnalysis.tokensUsed,
          cost: researchAnalysis.cost,
        },
      });

      // Send real-time update
      await inngest.send({
        name: 'project/status-updated',
        data: {
          userId,
          projectId,
          status: 'planning',
          progress: 100,
          message: 'Research phase completed successfully',
        },
      });

    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });

    const result = {
      success: true,
      competitorCount: competitorData.length,
      hasBrandDocument: !!brandAnalysis,
      tokensUsed: researchAnalysis.tokensUsed,
      cost: researchAnalysis.cost,
      idempotencyKey,
      timestamp: Date.now(),
    };

    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));

    console.log(`Research pipeline completed for project ${projectId}`);
    return result;
  }
);

/**
 * Research completion handler - triggers blueprint generation
 */
export const researchCompletionHandler = inngest.createFunction(
  {
    id: 'research-completion-handler',
    name: 'Research Completion Handler',
    retries: RETRY_CONFIG['default'].attempts,
  },
  { event: 'research/completed' },
  async ({ event, step }) => {
    const { userId, projectId, researchData } = event.data;
    
    console.log(`Research completed for project ${projectId}, triggering blueprint generation`);

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

    // Trigger blueprint generation workflow
    await step.run('trigger-blueprint-generation', async () => {
      await inngest.send({
        name: 'project/blueprint-generate',
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

    return { success: true, nextPhase: 'blueprint-generation' };
  }
);

/**
 * Research retry handler for failed research operations
 */
export const researchRetryHandler = inngest.createFunction(
  {
    id: 'research-retry-handler',
    name: 'Research Retry Handler',
    retries: 1, // Only retry once to avoid infinite loops
  },
  { event: 'research/retry' },
  async ({ event, step }) => {
    const { userId, projectId, competitorUrls, brandDocumentPath, retryReason } = event.data;
    
    console.log(`Retrying research for project ${projectId}, reason: ${retryReason}`);

    // Wait before retrying
    await step.sleep('wait-before-retry', '30s');

    // Trigger research pipeline again
    await step.run('retry-research-pipeline', async () => {
      await inngest.send({
        name: 'project/research-started',
        data: {
          userId,
          projectId,
          competitorUrls,
          brandDocumentPath,
          isRetry: true,
          originalFailureReason: retryReason,
        },
      });
    });

    return { success: true, action: 'retried' };
  }
);

/**
 * Helper function to parse AI research analysis into structured format
 */
async function parseResearchAnalysis(aiResponse: string, competitorData: any[], brandAnalysis: any) {
  // Use structured output generation for better parsing
  const structureSchema = z.object({
    topCompetitors: z.array(z.string()),
    keyInsights: z.array(z.string()),
    contentOpportunities: z.array(z.string()),
    recommendedApproach: z.string(),
    targetKeywords: z.array(z.string()),
    competitiveGaps: z.array(z.string()),
    contentStrategy: z.string(),
  });

  try {
    const structuredPrompt = `
      Based on this research analysis, extract the following information in JSON format:
      
      ${aiResponse}
      
      Please structure the response according to the schema with:
      - topCompetitors: array of competitor names/URLs
      - keyInsights: array of key insights from analysis
      - contentOpportunities: array of content opportunities identified
      - recommendedApproach: single string describing the recommended approach
      - targetKeywords: array of target keywords for SEO
      - competitiveGaps: array of gaps in competitor content
      - contentStrategy: single string describing overall content strategy
    `;

    const structured = await generateStructuredOutput(structuredPrompt, structureSchema, 'structured');
    return structured.object;
  } catch (error) {
    console.error('Failed to parse structured analysis:', error);
    
    // Fallback to simple text parsing
    return parseResearchAnalysisSimple(aiResponse, competitorData);
  }
}

/**
 * Simple text parsing fallback for research analysis
 */
function parseResearchAnalysisSimple(aiResponse: string, competitorData: any[]) {
  const lines = aiResponse.split('\n').filter(line => line.trim());
  
  return {
    topCompetitors: competitorData.slice(0, 3).map(comp => comp.title),
    keyInsights: extractListItems(lines, 'insights') || ['Competitive landscape analysis completed'],
    contentOpportunities: extractListItems(lines, 'opportunities') || ['Content gap analysis identified'],
    recommendedApproach: extractSection(lines, 'approach') || 'Data-driven content strategy',
    targetKeywords: extractListItems(lines, 'keywords') || competitorData.flatMap(comp => comp.keyTopics).slice(0, 10),
    competitiveGaps: extractListItems(lines, 'gaps') || ['Unique positioning opportunities'],
    contentStrategy: extractSection(lines, 'strategy') || 'Comprehensive content strategy based on competitive analysis',
  };
}

/**
 * Generate fallback analysis when AI fails
 */
function generateFallbackAnalysis(competitorData: any[], brandAnalysis: any, topic: string) {
  return {
    topCompetitors: competitorData.slice(0, 3).map(comp => comp.title),
    keyInsights: [
      `Analyzed ${competitorData.length} competitors`,
      'Identified key content themes and structures',
      'Found opportunities for differentiation',
    ],
    contentOpportunities: [
      'Create more comprehensive content',
      'Focus on unique brand positioning',
      'Leverage competitive gaps',
    ],
    recommendedApproach: `Create comprehensive ${topic} content that leverages brand strengths and addresses competitive gaps`,
    targetKeywords: competitorData.flatMap(comp => comp.keyTopics).slice(0, 10),
    competitiveGaps: [
      'Unique brand perspective',
      'More detailed analysis',
      'Better user experience',
    ],
    contentStrategy: 'Develop content that combines competitive insights with unique brand positioning',
  };
}

/**
 * Extract list items from text lines
 */
function extractListItems(lines: string[], keyword: string): string[] | null {
  const startIndex = lines.findIndex(line => 
    line.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (startIndex === -1) return null;
  
  const items: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)) {
      items.push(line.replace(/^[-•\d.]\s*/, '').trim());
    } else if (line && !line.includes(':')) {
      break;
    }
  }
  
  return items.length > 0 ? items : null;
}

/**
 * Extract section content from text lines
 */
function extractSection(lines: string[], keyword: string): string | null {
  const sectionLine = lines.find(line => 
    line.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (sectionLine) {
    return sectionLine.split(':')[1]?.trim() || null;
  }
  
  return null;
}

// Export all research pipeline functions
export const researchPipelineFunctions = [
  researchPipelineWorkflow,
  researchCompletionHandler,
  researchRetryHandler,
];