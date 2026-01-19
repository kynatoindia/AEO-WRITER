import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { updateProjectStatus, statusHelpers } from './project-status';
import { NonRetriableError } from 'inngest';
import { z } from 'zod';

/**
 * Wrapper for generateAIText that includes comprehensive status updates
 * This prevents the UI from getting "stuck" by providing real-time feedback
 */
export async function generateAITextWithStatus(
  projectId: string,
  prompt: string,
  useCase: 'research' | 'content' | 'blueprint' | 'polish' | 'structured' = 'content',
  userId?: string,
  options?: {
    statusMessage?: string;
    currentStep?: string;
    progress?: number;
    onStart?: () => Promise<void>;
    onSuccess?: () => Promise<void>;
    onError?: (error: any) => Promise<void>;
  }
) {
  try {
    // Update status: Starting AI call
    if (options?.statusMessage) {
      await updateProjectStatus(
        projectId,
        'researching', // or appropriate status
        options.statusMessage,
        {
          progress: options.progress,
          currentStep: options.currentStep,
        }
      );
    }

    // Call custom onStart hook
    if (options?.onStart) {
      await options.onStart();
    }

    // Make the AI call
    const result = await generateAIText(prompt, useCase, userId);

    // Call custom onSuccess hook
    if (options?.onSuccess) {
      await options.onSuccess();
    }

    return result;

  } catch (error: any) {
    console.error(`AI call failed for project ${projectId}:`, error);

    // Handle specific error types with appropriate status updates
    if (error.statusCode === 404 || error.message.includes("not found")) {
      await statusHelpers.setPermanentError(projectId, 'AI model not available');
      throw new NonRetriableError("AI model not found", { cause: error });
    }

    if (error.statusCode === 429 || error.message.includes('rate limit')) {
      await statusHelpers.setRateLimitHit(projectId, 60);
      throw error; // Let Inngest retry with backoff
    }

    if (error.message.includes('quota')) {
      await statusHelpers.setAIThrottled(projectId);
      throw error; // Let Inngest retry
    }

    // For other errors, update status and call custom error handler
    await statusHelpers.setAIError(projectId, error.message);
    
    if (options?.onError) {
      await options.onError(error);
    }

    throw error;
  }
}

/**
 * Wrapper for generateStructuredOutput that includes status updates
 */
export async function generateStructuredOutputWithStatus<T>(
  projectId: string,
  prompt: string,
  schema: z.ZodSchema<T>,
  useCase: 'research' | 'content' | 'blueprint' | 'polish' | 'structured' = 'structured',
  userId?: string,
  options?: {
    statusMessage?: string;
    currentStep?: string;
    progress?: number;
    onStart?: () => Promise<void>;
    onSuccess?: () => Promise<void>;
    onError?: (error: any) => Promise<void>;
  }
) {
  try {
    // Update status: Starting AI call
    if (options?.statusMessage) {
      await updateProjectStatus(
        projectId,
        'generating_blueprint', // or appropriate status
        options.statusMessage,
        {
          progress: options.progress,
          currentStep: options.currentStep,
        }
      );
    }

    // Call custom onStart hook
    if (options?.onStart) {
      await options.onStart();
    }

    // Make the AI call
    const result = await generateStructuredOutput(prompt, schema, useCase, userId);

    // Call custom onSuccess hook
    if (options?.onSuccess) {
      await options.onSuccess();
    }

    return result;

  } catch (error: any) {
    console.error(`Structured AI call failed for project ${projectId}:`, error);

    // Handle specific error types
    if (error.statusCode === 404 || error.message.includes("not found")) {
      await statusHelpers.setPermanentError(projectId, 'AI model not available');
      throw new NonRetriableError("AI model not found", { cause: error });
    }

    if (error.statusCode === 429 || error.message.includes('rate limit')) {
      await statusHelpers.setRateLimitHit(projectId, 60);
      throw error;
    }

    if (error.message.includes('quota')) {
      await statusHelpers.setAIThrottled(projectId);
      throw error;
    }

    // For other errors
    await statusHelpers.setAIError(projectId, error.message);
    
    if (options?.onError) {
      await options.onError(error);
    }

    throw error;
  }
}

/**
 * Helper to wrap any async operation with status updates
 */
export async function withStatusUpdates<T>(
  projectId: string,
  operation: () => Promise<T>,
  options: {
    startMessage: string;
    successMessage?: string;
    errorMessage?: string;
    currentStep?: string;
    startProgress?: number;
    successProgress?: number;
  }
): Promise<T> {
  try {
    // Update status: Starting operation
    await updateProjectStatus(
      projectId,
      'researching', // or appropriate status
      options.startMessage,
      {
        progress: options.startProgress,
        currentStep: options.currentStep,
      }
    );

    // Execute the operation
    const result = await operation();

    // Update status: Success
    if (options.successMessage) {
      await updateProjectStatus(
        projectId,
        'researching', // or appropriate status
        options.successMessage,
        {
          progress: options.successProgress,
          currentStep: options.currentStep,
        }
      );
    }

    return result;

  } catch (error: any) {
    console.error(`Operation failed for project ${projectId}:`, error);

    // Update status: Error
    const errorMessage = options.errorMessage || `Operation failed: ${error.message}`;
    await statusHelpers.setAIError(projectId, errorMessage);

    throw error;
  }
}

/**
 * Status update helpers for common AI operations
 */
export const aiStatusHelpers = {
  research: {
    starting: (projectId: string) => 
      updateProjectStatus(projectId, 'researching', 'Starting competitor research...', { progress: 10 }),
    
    analyzing: (projectId: string, count: number) => 
      updateProjectStatus(projectId, 'researching', `Analyzing ${count} competitor sites...`, { progress: 30 }),
    
    aiProcessing: (projectId: string) => 
      updateProjectStatus(projectId, 'researching', 'AI is processing insights...', { progress: 60 }),
    
    completed: (projectId: string) => 
      updateProjectStatus(projectId, 'researching', 'Research completed successfully', { progress: 90 }),
  },

  blueprint: {
    starting: (projectId: string) => 
      updateProjectStatus(projectId, 'generating_blueprint', 'Creating content strategy...', { progress: 40 }),
    
    structuring: (projectId: string) => 
      updateProjectStatus(projectId, 'generating_blueprint', 'Structuring content outline...', { progress: 50 }),
    
    completed: (projectId: string) => 
      updateProjectStatus(projectId, 'generating_blueprint', 'Blueprint created successfully', { progress: 60 }),
  },

  content: {
    starting: (projectId: string, section?: string) => 
      updateProjectStatus(projectId, 'generating_content', 
        section ? `Writing section: ${section}` : 'Writing content...', 
        { progress: 70 }
      ),
    
    completed: (projectId: string) => 
      updateProjectStatus(projectId, 'generating_content', 'Content generation completed', { progress: 85 }),
  },

  finalization: {
    starting: (projectId: string) => 
      updateProjectStatus(projectId, 'finalizing', 'Polishing and optimizing content...', { progress: 90 }),
    
    completed: (projectId: string) => 
      statusHelpers.setCompleted(projectId),
  },
};