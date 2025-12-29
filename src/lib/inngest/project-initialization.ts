import { inngest, CONCURRENCY_LIMITS, RETRY_CONFIG, generateIdempotencyKey } from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis/client';
import { incrementUsage } from '@/lib/rate-limiting/quota';

// Project initialization workflow - handles immediate setup after project creation
export const handleProjectInitialization = inngest.createFunction(
  {
    id: 'handle-project-initialization',
    concurrency: {
      limit: CONCURRENCY_LIMITS['project/created'] || 5,
      key: 'event.data.userId',
    },
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'project/created' },
  async ({ event, step }) => {
    const { userId, projectId, topic, competitorUrls, tone, format, brandDocumentPath } = event.data;
    
    const idempotencyKey = generateIdempotencyKey.userOperation(userId, `project_init_${projectId}`);
    
    // Check for duplicate initialization
    const duplicateCheck = await step.run('check-duplicate-initialization', async () => {
      const existingResult = await redis.get(`idempotency:${idempotencyKey}`);
      return existingResult ? JSON.parse(existingResult) : null;
    });
    
    if (duplicateCheck) {
      console.log(`Duplicate project initialization detected for ${projectId}`);
      return duplicateCheck;
    }

    // Update project status to indicate initialization started
    await step.run('update-project-status', async () => {
      const supabase = await createServerSupabaseClient();
      
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: 'researching',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update project status: ${error.message}`);
      }

      // Send real-time update to user
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'project_status_update',
          payload: {
            projectId,
            status: 'researching',
            message: 'Project initialization started',
            progress: 10,
            timestamp: new Date().toISOString(),
          },
        });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });

    // Process brand document if provided
    const brandProcessingResult = await step.run('process-brand-document', async () => {
      if (!brandDocumentPath) {
        return { processed: false, message: 'No brand document provided' };
      }

      try {
        const supabase = await createServerSupabaseClient();
        
        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('brand-documents')
          .download(brandDocumentPath);

        if (downloadError) {
          throw new Error(`Failed to download brand document: ${downloadError.message}`);
        }

        // Validate file type and size
        if (!fileData || fileData.size === 0) {
          throw new Error('Brand document is empty or corrupted');
        }

        // Virus scan simulation (in production, integrate with actual virus scanning service)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate scan time
        
        // Type validation - ensure it's actually a PDF
        const buffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const isPDF = uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && uint8Array[2] === 0x44 && uint8Array[3] === 0x46; // %PDF
        
        if (!isPDF) {
          throw new Error('Uploaded file is not a valid PDF');
        }

        // Send progress update
        await supabase
          .channel(`project:${projectId}`)
          .send({
            type: 'broadcast',
            event: 'project_status_update',
            payload: {
              projectId,
              status: 'researching',
              message: 'Brand document processed successfully',
              progress: 25,
              timestamp: new Date().toISOString(),
            },
          });

        return {
          processed: true,
          fileSize: fileData.size,
          filePath: brandDocumentPath,
          message: 'Brand document processed and validated',
        };

      } catch (error: any) {
        console.error('Brand document processing error:', error);
        
        // Update project with error status
        await supabase
          .from('projects')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId);

        throw new Error(`Brand document processing failed: ${error.message}`);
      }
    }, {
      retries: RETRY_CONFIG['external-api'].attempts,
    });

    // Validate competitor URLs
    const urlValidationResult = await step.run('validate-competitor-urls', async () => {
      const validUrls: string[] = [];
      const invalidUrls: string[] = [];

      for (const url of competitorUrls) {
        try {
          // Basic URL validation
          new URL(url);
          
          // Check if URL is accessible (basic HEAD request simulation)
          // In production, you might want to do actual HTTP checks
          if (url.startsWith('http://') || url.startsWith('https://')) {
            validUrls.push(url);
          } else {
            invalidUrls.push(url);
          }
        } catch {
          invalidUrls.push(url);
        }
      }

      if (validUrls.length === 0) {
        throw new Error('No valid competitor URLs provided');
      }

      const supabase = await createServerSupabaseClient();
      
      // Send progress update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'project_status_update',
          payload: {
            projectId,
            status: 'researching',
            message: `Validated ${validUrls.length} competitor URLs`,
            progress: 40,
            timestamp: new Date().toISOString(),
          },
        });

      return {
        validUrls,
        invalidUrls,
        validCount: validUrls.length,
        totalCount: competitorUrls.length,
      };
    }, {
      retries: RETRY_CONFIG['default'].attempts,
    });

    // Initialize project metadata
    await step.run('initialize-project-metadata', async () => {
      const supabase = await createServerSupabaseClient();
      
      const metadata = {
        initialization: {
          startedAt: new Date().toISOString(),
          brandDocumentProcessed: brandProcessingResult.processed,
          validCompetitorUrls: urlValidationResult.validCount,
          totalCompetitorUrls: urlValidationResult.totalCount,
        },
        progress: {
          initialization: 100,
          research: 0,
          blueprint: 0,
          writing: 0,
        },
        estimatedCost: 0.50, // Base estimation
        estimatedTokens: 2000, // Base estimation
      };

      const { error } = await supabase
        .from('projects')
        .update({
          research_data: metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update project metadata: ${error.message}`);
      }

      // Send final initialization update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'project_status_update',
          payload: {
            projectId,
            status: 'researching',
            message: 'Project initialization completed',
            progress: 50,
            timestamp: new Date().toISOString(),
            metadata,
          },
        });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });

    // Increment user project usage
    await step.run('increment-project-usage', async () => {
      await incrementUsage(userId, 'projects');
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });

    const result = {
      success: true,
      projectId,
      brandDocumentProcessed: brandProcessingResult.processed,
      validCompetitorUrls: urlValidationResult.validCount,
      initializationCompleted: true,
      idempotencyKey,
      timestamp: new Date().toISOString(),
    };

    // Cache result for idempotency
    await redis.setex(`idempotency:${idempotencyKey}`, 7200, JSON.stringify(result));

    return result;
  }
);

// Project status update handler for real-time updates
export const handleProjectStatusUpdate = inngest.createFunction(
  {
    id: 'handle-project-status-update',
    retries: RETRY_CONFIG['database-operation'].attempts,
  },
  { event: 'project/status-update' },
  async ({ event, step }) => {
    const { userId, projectId, status, progress, message, metadata } = event.data;

    await step.run('update-project-status', async () => {
      const supabase = await createServerSupabaseClient();

      // Update database
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (metadata) {
        updateData.research_data = metadata;
      }

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to update project status: ${error.message}`);
      }

      // Send real-time update
      await supabase
        .channel(`project:${projectId}`)
        .send({
          type: 'broadcast',
          event: 'project_status_update',
          payload: {
            projectId,
            status,
            progress,
            message,
            metadata,
            timestamp: new Date().toISOString(),
          },
        });
    }, {
      retries: RETRY_CONFIG['database-operation'].attempts,
    });

    return { success: true, projectId, status, timestamp: new Date().toISOString() };
  }
);

// Export project initialization functions
export const projectInitializationFunctions = [
  handleProjectInitialization,
  handleProjectStatusUpdate,
];