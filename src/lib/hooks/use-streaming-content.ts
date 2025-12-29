'use client';

import { useState, useCallback, useRef } from 'react';

interface StreamingContentState {
  isStreaming: boolean;
  content: string;
  error: string | null;
  isComplete: boolean;
  wordCount: number;
  tokensUsed: number;
}

interface StreamingContentOptions {
  onChunk?: (chunk: string, fullContent: string) => void;
  onComplete?: (content: string, metadata: { wordCount: number; tokensUsed: number }) => void;
  onError?: (error: string) => void;
}

interface StreamContentRequest {
  sectionId: string;
  prompt: string;
  context: {
    previousContent?: string;
    sectionHeading: string;
    sectionGoal: string;
    keyPoints?: string[];
    tone: 'professional' | 'witty' | 'data-driven';
    targetKeywords?: string[];
  };
}

export function useStreamingContent(
  projectId: string,
  options: StreamingContentOptions = {}
) {
  const [state, setState] = useState<StreamingContentState>({
    isStreaming: false,
    content: '',
    error: null,
    isComplete: false,
    wordCount: 0,
    tokensUsed: 0
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const streamContent = useCallback(async (request: StreamContentRequest) => {
    // Reset state
    setState({
      isStreaming: true,
      content: '',
      error: null,
      isComplete: false,
      wordCount: 0,
      tokensUsed: 0
    });
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(`/api/projects/${projectId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start streaming');
      }
      
      if (!response.body) {
        throw new Error('No response body received');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'content_chunk':
                  setState(prev => ({
                    ...prev,
                    content: data.data.fullContent,
                    wordCount: data.data.fullContent.split(' ').length
                  }));
                  
                  options.onChunk?.(data.data.chunk, data.data.fullContent);
                  break;
                  
                case 'section_complete':
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    isComplete: true,
                    content: data.data.content,
                    wordCount: data.data.wordCount,
                    tokensUsed: data.data.tokensUsed
                  }));
                  
                  options.onComplete?.(data.data.content, {
                    wordCount: data.data.wordCount,
                    tokensUsed: data.data.tokensUsed
                  });
                  break;
                  
                case 'error':
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: data.data.error
                  }));
                  
                  options.onError?.(data.data.error);
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse streaming data:', parseError);
            }
          }
        }
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: 'Stream cancelled'
        }));
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMessage
        }));
        
        options.onError?.(errorMessage);
      }
    }
  }, [projectId, options]);
  
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  
  const resetState = useCallback(() => {
    setState({
      isStreaming: false,
      content: '',
      error: null,
      isComplete: false,
      wordCount: 0,
      tokensUsed: 0
    });
  }, []);
  
  return {
    // State
    isStreaming: state.isStreaming,
    content: state.content,
    error: state.error,
    isComplete: state.isComplete,
    wordCount: state.wordCount,
    tokensUsed: state.tokensUsed,
    
    // Actions
    streamContent,
    cancelStream,
    resetState
  };
}