import { createClient } from '@supabase/supabase-js';

// Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ProjectStatus = 
  | 'created'
  | 'initializing'
  | 'researching'
  | 'generating_blueprint'
  | 'generating_content'
  | 'finalizing'
  | 'completed'
  | 'stuck'
  | 'error'
  | 'paused';

export interface StatusUpdate {
  status: ProjectStatus;
  message: string;
  progress?: number; // 0-100
  currentStep?: string;
  estimatedTimeRemaining?: number; // seconds
  metadata?: Record<string, any>;
}

/**
 * Update project status in database with detailed messaging
 * This provides real-time feedback to the UI about what's happening
 */
export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
  message: string,
  options?: {
    progress?: number;
    currentStep?: string;
    estimatedTimeRemaining?: number;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const statusUpdate: StatusUpdate = {
      status,
      message,
      progress: options?.progress,
      currentStep: options?.currentStep,
      estimatedTimeRemaining: options?.estimatedTimeRemaining,
      metadata: options?.metadata,
    };

    // Update the projects table with current status
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        status,
        status_message: message,
        progress: options?.progress || null,
        current_step: options?.currentStep || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (projectError) {
      console.error('Failed to update project status:', projectError);
      return;
    }

    // Also log to status_updates table for history tracking
    const { error: logError } = await supabase
      .from('project_status_updates')
      .insert({
        project_id: projectId,
        status,
        message,
        progress: options?.progress || null,
        current_step: options?.currentStep || null,
        estimated_time_remaining: options?.estimatedTimeRemaining || null,
        metadata: options?.metadata || null,
        created_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Failed to log status update:', logError);
    }

    console.log(`Project ${projectId} status updated: ${status} - ${message}`);
  } catch (error) {
    console.error('Error updating project status:', error);
  }
}

/**
 * Get current project status
 */
export async function getProjectStatus(projectId: string): Promise<StatusUpdate | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('status, status_message, progress, current_step, updated_at')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      console.error('Failed to get project status:', error);
      return null;
    }

    return {
      status: data.status as ProjectStatus,
      message: data.status_message || '',
      progress: data.progress || undefined,
      currentStep: data.current_step || undefined,
    };
  } catch (error) {
    console.error('Error getting project status:', error);
    return null;
  }
}

/**
 * Status message templates for common scenarios
 */
export const STATUS_MESSAGES = {
  // Normal flow - "Going" states
  INITIALIZING: '🚀 Going: Setting up your project...',
  RESEARCHING: '🚀 Going: AI is analyzing competitor data and market research...',
  GENERATING_BLUEPRINT: '🚀 Going: Creating content strategy and outline...',
  GENERATING_CONTENT: '🚀 Going: Writing your content sections...',
  FINALIZING: '🚀 Going: Polishing and optimizing your content...',
  COMPLETED: '✅ Your content is ready!',

  // Throttled/stuck states
  RATE_LIMIT_HIT: '⚠️ Stuck: Waiting for API quota reset (Free Tier limit reached)...',
  QUOTA_EXCEEDED: '⚠️ Stuck: Daily quota exceeded. Will retry automatically when quota resets.',
  AI_THROTTLED: '⚠️ Stuck: AI service is busy. Your request is queued and will continue shortly...',
  WAITING_IN_QUEUE: '⚠️ Stuck: Waiting in queue due to high demand. Your request will process soon...',

  // Error states
  AI_ERROR: '❌ AI service encountered an error. Retrying...',
  NETWORK_ERROR: '❌ Network issue detected. Retrying connection...',
  PERMANENT_ERROR: '❌ Unable to complete request. Please try again.',
  INVALID_INPUT: '❌ Invalid input detected. Please check your settings.',

  // Recovery states
  RETRYING: '🔄 Retrying after temporary issue...',
  RECOVERING: '🔄 Recovering from error. Please wait...',
  RESUMING: '🚀 Going: Resuming where we left off...',
} as const;

/**
 * Helper to update status with common scenarios
 */
export const statusHelpers = {
  setInitializing: (projectId: string) => 
    updateProjectStatus(projectId, 'initializing', STATUS_MESSAGES.INITIALIZING, { progress: 5 }),

  setResearching: (projectId: string, step?: string) => 
    updateProjectStatus(projectId, 'researching', STATUS_MESSAGES.RESEARCHING, { 
      progress: 20, 
      currentStep: step || 'Analyzing competitors' 
    }),

  setBlueprintGenerating: (projectId: string) => 
    updateProjectStatus(projectId, 'generating_blueprint', STATUS_MESSAGES.GENERATING_BLUEPRINT, { progress: 40 }),

  setContentGenerating: (projectId: string, sectionName?: string) => 
    updateProjectStatus(projectId, 'generating_content', STATUS_MESSAGES.GENERATING_CONTENT, { 
      progress: 60, 
      currentStep: sectionName ? `Writing: ${sectionName}` : 'Writing content' 
    }),

  setFinalizing: (projectId: string) => 
    updateProjectStatus(projectId, 'finalizing', STATUS_MESSAGES.FINALIZING, { progress: 85 }),

  setCompleted: (projectId: string) => 
    updateProjectStatus(projectId, 'completed', STATUS_MESSAGES.COMPLETED, { progress: 100 }),

  // Stuck/throttled states
  setRateLimitHit: (projectId: string, retryIn?: number) => 
    updateProjectStatus(projectId, 'stuck', STATUS_MESSAGES.RATE_LIMIT_HIT, { 
      estimatedTimeRemaining: retryIn || 60 
    }),

  setAIThrottled: (projectId: string) => 
    updateProjectStatus(projectId, 'stuck', STATUS_MESSAGES.AI_THROTTLED),

  setWaitingInQueue: (projectId: string, position?: number) => 
    updateProjectStatus(projectId, 'stuck', STATUS_MESSAGES.WAITING_IN_QUEUE, {
      metadata: { queuePosition: position }
    }),

  // Error states
  setAIError: (projectId: string, errorMessage: string) => 
    updateProjectStatus(projectId, 'error', `${STATUS_MESSAGES.AI_ERROR} Error: ${errorMessage}`),

  setPermanentError: (projectId: string, errorMessage: string) => 
    updateProjectStatus(projectId, 'error', `${STATUS_MESSAGES.PERMANENT_ERROR} ${errorMessage}`),

  // Recovery states
  setRetrying: (projectId: string, attempt: number) => 
    updateProjectStatus(projectId, 'stuck', `${STATUS_MESSAGES.RETRYING} (Attempt ${attempt})`),

  setResuming: (projectId: string) => 
    updateProjectStatus(projectId, 'researching', STATUS_MESSAGES.RESUMING),
};