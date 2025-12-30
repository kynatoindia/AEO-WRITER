import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { APIResponse } from '@/lib/types/api';

interface FinalizationStatus {
  projectId: string;
  status: string;
  hasContent: boolean;
  isFinalized: boolean;
  isFinalizationInProgress: boolean;
  canFinalize: boolean;
  lastUpdated: string;
  metrics: {
    wordCount: number;
    hasEnhancedSEO: boolean;
    faqCount: number;
    seoScore: number | null;
    readabilityScore: number | null;
  };
}

interface FinalizationResult {
  projectId: string;
  eventId: string;
  status: string;
  message: string;
  estimatedCompletionTime: string;
  currentStatus: string;
  contentLength: number;
}

interface UseContentFinalizationReturn {
  isLoading: boolean;
  isFinalizationInProgress: boolean;
  finalizationStatus: FinalizationStatus | null;
  error: string | null;
  triggerFinalization: (projectId: string, force?: boolean) => Promise<FinalizationResult | null>;
  getFinalizationStatus: (projectId: string) => Promise<FinalizationStatus | null>;
  clearError: () => void;
}

export function useContentFinalization(): UseContentFinalizationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [finalizationStatus, setFinalizationStatus] = useState<FinalizationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getFinalizationStatus = useCallback(async (projectId: string): Promise<FinalizationStatus | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/finalize`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: APIResponse<FinalizationStatus> = await response.json();

      if (!result.success) {
        const errorMessage = result.error?.message || 'Failed to get finalization status';
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      }

      if (result.data) {
        setFinalizationStatus(result.data);
        return result.data;
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
      setError(errorMessage);
      toast.error('Failed to get finalization status');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerFinalization = useCallback(async (
    projectId: string, 
    force: boolean = false
  ): Promise<FinalizationResult | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force }),
      });

      const result: APIResponse<FinalizationResult> = await response.json();

      if (!result.success) {
        const errorMessage = result.error?.message || 'Failed to trigger finalization';
        setError(errorMessage);
        
        // Handle specific error cases with appropriate messages
        if (result.error?.code === 'QUOTA_EXCEEDED') {
          toast.error('Content finalization quota exceeded. Please upgrade your plan.');
        } else if (result.error?.code === 'NO_CONTENT_TO_FINALIZE') {
          toast.error('No content available to finalize. Complete content generation first.');
        } else if (result.error?.code === 'ALREADY_FINALIZED') {
          toast.error('Project is already finalized. Use force option to re-finalize.');
        } else if (result.error?.code === 'FINALIZATION_IN_PROGRESS') {
          toast.error('Finalization is already in progress for this project.');
        } else {
          toast.error(errorMessage);
        }
        
        return null;
      }

      if (result.data) {
        toast.success('Content finalization started! This will take 2-5 minutes.');
        
        // Update status to show finalization in progress
        if (finalizationStatus) {
          setFinalizationStatus({
            ...finalizationStatus,
            isFinalizationInProgress: true,
            canFinalize: false
          });
        }
        
        return result.data;
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
      setError(errorMessage);
      toast.error('Failed to start content finalization');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [finalizationStatus]);

  const isFinalizationInProgress = finalizationStatus?.isFinalizationInProgress || false;

  return {
    isLoading,
    isFinalizationInProgress,
    finalizationStatus,
    error,
    triggerFinalization,
    getFinalizationStatus,
    clearError,
  };
}