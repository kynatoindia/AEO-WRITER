'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { 
  ProjectStatus, 
  ContentBlueprint,
  RealtimeEvent 
} from '@/lib/types';

interface ContentGenerationProgress {
  projectId: string;
  status: ProjectStatus;
  statusMessage?: string | null;
  progress: number;
  totalSections: number;
  completedSections: number;
  writingSections: number;
  sectionsRemaining: number;
  estimatedTimeRemaining: number;
  currentSection?: string;
  blueprint?: ContentBlueprint;
  finalContent?: string | null;
  seoMetadata?: unknown;
  sections: Array<{
    id: string;
    heading: string;
    status: 'pending' | 'writing' | 'completed';
    wordCount: number;
    content?: string;
  }>;
}

interface ContentGenerationState {
  progress: ContentGenerationProgress | null;
  isLoading: boolean;
  error: string | null;
  isGenerating: boolean;
  realtimeEvents: RealtimeEvent[];
}

interface UseContentGenerationOptions {
  projectId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useContentGeneration({
  projectId,
  autoRefresh = true,
  refreshInterval = 5000
}: UseContentGenerationOptions) {
  const [state, setState] = useState<ContentGenerationState>({
    progress: null,
    isLoading: false,
    error: null,
    isGenerating: false,
    realtimeEvents: []
  });
  
  const supabase = createClient();

  const isActiveGenerationStatus = useCallback((status: string) => {
    return !['draft', 'completed', 'error'].includes(status);
  }, []);
  
  // Fetch current progress from API
  const fetchProgress = useCallback(async () => {
    if (!projectId) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch(`/api/projects/${projectId}/generate`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch progress');
      }
      
      setState(prev => ({
        ...prev,
        progress: result.data,
        isLoading: false,
        isGenerating: isActiveGenerationStatus(result.data.status)
      }));
      
    } catch (error) {
      console.error('Failed to fetch progress:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  }, [projectId, isActiveGenerationStatus]);
  
  // Start content generation
  const startGeneration = useCallback(async (options?: {
    resumeFromSection?: string;
    preferences?: {
      includeImages?: boolean;
      includeTables?: boolean;
      includeCodeBlocks?: boolean;
      targetReadingLevel?: number;
    };
  }) => {
    if (!projectId) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch(`/api/projects/${projectId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {})
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to start generation');
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isGenerating: true
      }));
      
      // Fetch initial progress
      await fetchProgress();
      
      return result.data;
      
    } catch (error) {
      console.error('Failed to start generation:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
      throw error;
    }
  }, [projectId, fetchProgress]);
  
  // Set up real-time subscriptions
  useEffect(() => {
    if (!projectId) return;
    
    type BroadcastPayload = {
      payload: Record<string, unknown>;
    };

    const channel = supabase
      .channel(`project:${projectId}`)
      .on('broadcast', { event: 'generation_started' }, (payload: BroadcastPayload) => {
        console.log('Generation started:', payload);
        setState(prev => ({
          ...prev,
          isGenerating: true,
          realtimeEvents: [...prev.realtimeEvents, {
            type: 'progress',
            projectId,
            data: payload.payload,
            timestamp: new Date().toISOString()
          }]
        }));
      })
      .on('broadcast', { event: 'strategy_complete' }, (payload: BroadcastPayload) => {
        console.log('Strategy complete:', payload);
        const eventPayload = payload.payload as {
          blueprint?: ContentBlueprint;
          sectionsCount?: number;
        };

        setState(prev => ({
          ...prev,
          progress: prev.progress ? {
            ...prev.progress,
            status: 'writing',
            blueprint: eventPayload.blueprint,
            totalSections: typeof eventPayload.sectionsCount === 'number'
              ? eventPayload.sectionsCount
              : prev.progress.totalSections
          } : null,
          realtimeEvents: [...prev.realtimeEvents, {
            type: 'project_update',
            projectId,
            data: payload.payload,
            timestamp: new Date().toISOString()
          }]
        }));
      })
      .on('broadcast', { event: 'section_started' }, (payload: BroadcastPayload) => {
        console.log('Section started:', payload);
        const eventPayload = payload.payload as { heading?: string };

        setState(prev => ({
          ...prev,
          progress: prev.progress ? {
            ...prev.progress,
            currentSection: typeof eventPayload.heading === 'string'
              ? eventPayload.heading
              : prev.progress.currentSection,
            writingSections: prev.progress.writingSections + 1
          } : null,
          realtimeEvents: [...prev.realtimeEvents, {
            type: 'progress',
            projectId,
            data: payload.payload,
            timestamp: new Date().toISOString()
          }]
        }));
      })
      .on('broadcast', { event: 'section_complete' }, (payload: BroadcastPayload) => {
        console.log('Section complete:', payload);
        const eventPayload = payload.payload as {
          heading?: string;
          wordCount?: number;
        };

        setState(prev => {
          if (!prev.progress) return prev;
          
          const newCompletedSections = prev.progress.completedSections + 1;
          const newProgress = Math.round((newCompletedSections / prev.progress.totalSections) * 100);
          
          return {
            ...prev,
            progress: {
              ...prev.progress,
              completedSections: newCompletedSections,
              writingSections: Math.max(0, prev.progress.writingSections - 1),
              sectionsRemaining: prev.progress.totalSections - newCompletedSections,
              progress: newProgress,
              sections: prev.progress.sections.map(section => 
                section.heading === eventPayload.heading
                  ? {
                    ...section,
                    status: 'completed',
                    wordCount: typeof eventPayload.wordCount === 'number' ? eventPayload.wordCount : section.wordCount
                  }
                  : section
              )
            },
            realtimeEvents: [...prev.realtimeEvents, {
              type: 'section_complete',
              projectId,
              data: payload.payload,
              timestamp: new Date().toISOString()
            }]
          };
        });
      })
      .on('broadcast', { event: 'project_complete' }, (payload: BroadcastPayload) => {
        console.log('Project complete:', payload);
        setState(prev => ({
          ...prev,
          progress: prev.progress ? {
            ...prev.progress,
            status: 'completed',
            progress: 100
          } : null,
          isGenerating: false,
          realtimeEvents: [...prev.realtimeEvents, {
            type: 'project_update',
            projectId,
            data: payload.payload,
            timestamp: new Date().toISOString()
          }]
        }));
        void fetchProgress();
      })
      .on('broadcast', { event: 'finalization_complete' }, (payload: BroadcastPayload) => {
        console.log('Finalization complete:', payload);
        setState(prev => ({
          ...prev,
          progress: prev.progress ? {
            ...prev.progress,
            status: 'completed',
            progress: 100
          } : null,
          isGenerating: false,
          realtimeEvents: [...prev.realtimeEvents, {
            type: 'project_update',
            projectId,
            data: payload.payload,
            timestamp: new Date().toISOString()
          }]
        }));
        void fetchProgress();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase, fetchProgress]);
  
  // Auto-refresh progress
  useEffect(() => {
    if (!autoRefresh || !state.isGenerating) return;
    
    const interval = setInterval(fetchProgress, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, state.isGenerating, fetchProgress]);
  
  // Initial fetch
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);
  
  // Clear events older than 1 hour
  useEffect(() => {
    const cleanup = setInterval(() => {
      setState(prev => ({
        ...prev,
        realtimeEvents: prev.realtimeEvents.filter(event => {
          const eventTime = new Date(event.timestamp).getTime();
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          return eventTime > oneHourAgo;
        })
      }));
    }, 5 * 60 * 1000); // Clean up every 5 minutes
    
    return () => clearInterval(cleanup);
  }, []);
  
  return {
    // State
    progress: state.progress,
    isLoading: state.isLoading,
    error: state.error,
    isGenerating: state.isGenerating,
    realtimeEvents: state.realtimeEvents,
    
    // Actions
    startGeneration,
    refreshProgress: fetchProgress,
    
    // Computed values
    isCompleted: state.progress?.status === 'completed',
    hasError: state.progress?.status === 'error',
    progressPercentage: state.progress?.progress || 0,
    estimatedTimeRemaining: state.progress?.estimatedTimeRemaining || 0,
    
    // Helper functions
    clearEvents: () => setState(prev => ({ ...prev, realtimeEvents: [] })),
    clearError: () => setState(prev => ({ ...prev, error: null }))
  };
}
