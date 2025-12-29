/**
 * Research Pipeline Usage Example
 * 
 * This example demonstrates how to use the research pipeline workflow
 * to analyze competitor content and generate research insights.
 */

import { inngest } from '../client';

/**
 * Example: Trigger research pipeline for a new project
 */
export async function triggerResearchPipeline() {
  const eventData = {
    userId: 'user_123',
    projectId: 'project_456',
    competitorUrls: [
      'https://blog.hubspot.com/marketing/seo-guide',
      'https://moz.com/beginners-guide-to-seo',
      'https://ahrefs.com/blog/seo-basics/',
    ],
    brandDocumentPath: 'brand-documents/user_123/project_456/brand-guide.pdf',
    topic: 'SEO Best Practices for Small Businesses',
    tone: 'professional',
    format: 'how-to',
  };

  console.log('Triggering research pipeline...');
  
  const result = await inngest.send({
    name: 'project/research-started',
    data: eventData,
  });

  console.log('Research pipeline triggered:', result.ids[0]);
  return result;
}

/**
 * Example: Monitor research pipeline progress
 */
export async function monitorResearchProgress(projectId: string) {
  // In a real application, you would:
  // 1. Subscribe to real-time updates via Supabase Realtime
  // 2. Poll the project status API endpoint
  // 3. Listen for Inngest events
  
  console.log(`Monitoring research progress for project: ${projectId}`);
  
  // Example of listening for completion events
  const completionHandler = async (event: any) => {
    if (event.name === 'research/completed' && event.data.projectId === projectId) {
      console.log('Research completed!', {
        competitorCount: event.data.researchData.competitorData.length,
        tokensUsed: event.data.tokensUsed,
        cost: event.data.cost,
      });
    }
  };

  // In practice, you would set up proper event listeners
  return completionHandler;
}

/**
 * Example: Handle research pipeline errors
 */
export async function handleResearchErrors() {
  // Example error handling workflow
  const errorHandler = async (event: any) => {
    if (event.name === 'research/error') {
      const { userId, projectId, error, retryable } = event.data;
      
      console.error(`Research failed for project ${projectId}:`, error);
      
      if (retryable) {
        console.log('Scheduling retry...');
        
        // Retry after delay
        await inngest.send({
          name: 'research/retry',
          data: {
            userId,
            projectId,
            retryReason: error,
            delay: '30s',
          },
        });
      } else {
        console.log('Error not retryable, updating project status...');
        
        // Update project status to error
        await inngest.send({
          name: 'project/status-updated',
          data: {
            userId,
            projectId,
            status: 'error',
            error: error,
          },
        });
      }
    }
  };

  return errorHandler;
}

/**
 * Example: Process research results
 */
export async function processResearchResults(researchData: any) {
  console.log('Processing research results...');
  
  const {
    competitorData,
    brandAnalysis,
    researchSummary,
    processingMetrics,
  } = researchData;

  // Example analysis
  console.log('Research Summary:');
  console.log('- Competitors analyzed:', competitorData.length);
  console.log('- Key insights:', researchSummary.keyInsights.length);
  console.log('- Content opportunities:', researchSummary.contentOpportunities.length);
  console.log('- Target keywords:', researchSummary.targetKeywords.join(', '));
  
  if (brandAnalysis) {
    console.log('Brand Analysis:');
    console.log('- Brand tone:', brandAnalysis.tone);
    console.log('- Target audience:', brandAnalysis.targetAudience);
    console.log('- Key messages:', brandAnalysis.keyMessages.join(', '));
  }

  console.log('Processing Metrics:');
  console.log('- Total processing time:', processingMetrics.totalProcessingTime, 'ms');
  console.log('- Tokens used:', processingMetrics.tokensUsed);
  console.log('- Cost:', '$' + processingMetrics.cost.toFixed(4));

  return {
    summary: researchSummary,
    brandInsights: brandAnalysis,
    metrics: processingMetrics,
  };
}

/**
 * Example: Custom research pipeline with specific requirements
 */
export async function customResearchPipeline(options: {
  userId: string;
  projectId: string;
  competitorUrls: string[];
  focusKeywords: string[];
  targetAudience: string;
  contentType: 'blog' | 'landing-page' | 'product-page';
}) {
  const { userId, projectId, competitorUrls, focusKeywords, targetAudience, contentType } = options;

  console.log('Starting custom research pipeline...');

  // Step 1: Enhanced competitor analysis with focus keywords
  await inngest.send({
    name: 'research/competitor-analysis',
    data: {
      userId,
      projectId,
      competitorUrls,
      focusKeywords,
      analysisDepth: 'advanced',
    },
  });

  // Step 2: Audience-specific content analysis
  await inngest.send({
    name: 'research/audience-analysis',
    data: {
      userId,
      projectId,
      targetAudience,
      contentType,
    },
  });

  // Step 3: Keyword gap analysis
  await inngest.send({
    name: 'research/keyword-gap-analysis',
    data: {
      userId,
      projectId,
      focusKeywords,
      competitorUrls,
    },
  });

  console.log('Custom research pipeline initiated');
}

/**
 * Example: Batch research for multiple projects
 */
export async function batchResearchPipeline(projects: Array<{
  projectId: string;
  userId: string;
  competitorUrls: string[];
  topic: string;
}>) {
  console.log(`Starting batch research for ${projects.length} projects...`);

  const results = [];

  for (const project of projects) {
    try {
      const result = await inngest.send({
        name: 'project/research-started',
        data: {
          ...project,
          tone: 'professional',
          format: 'how-to',
          batchId: `batch_${Date.now()}`,
        },
      });

      results.push({
        projectId: project.projectId,
        eventId: result.ids[0],
        status: 'queued',
      });

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Failed to queue research for project ${project.projectId}:`, error);
      results.push({
        projectId: project.projectId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log('Batch research queued:', results);
  return results;
}

/**
 * Example: Research pipeline with real-time updates
 */
export async function researchWithRealTimeUpdates(
  projectId: string,
  onProgress: (update: any) => void
) {
  console.log('Starting research with real-time updates...');

  // Set up progress listener
  const progressHandler = (event: any) => {
    if (event.data.projectId === projectId) {
      onProgress({
        status: event.data.status,
        progress: event.data.progress,
        message: event.data.message,
        timestamp: event.ts,
      });
    }
  };

  // In a real implementation, you would:
  // 1. Set up Supabase Realtime subscription
  // 2. Listen for project status updates
  // 3. Handle progress events

  return progressHandler;
}

// Export all examples
export const researchPipelineExamples = {
  triggerResearchPipeline,
  monitorResearchProgress,
  handleResearchErrors,
  processResearchResults,
  customResearchPipeline,
  batchResearchPipeline,
  researchWithRealTimeUpdates,
};