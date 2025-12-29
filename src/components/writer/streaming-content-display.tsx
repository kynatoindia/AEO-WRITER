'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Copy, 
  Check,
  Zap,
  FileText,
  Clock
} from 'lucide-react';
import { useStreamingContent } from '@/lib/hooks/use-streaming-content';
import type { ContentSection } from '@/lib/types';

interface StreamingContentDisplayProps {
  projectId: string;
  section: ContentSection;
  previousContent?: string;
  tone: 'professional' | 'witty' | 'data-driven';
  targetKeywords?: string[];
  onComplete?: (sectionId: string, content: string) => void;
  onError?: (sectionId: string, error: string) => void;
}

export function StreamingContentDisplay({
  projectId,
  section,
  previousContent,
  tone,
  targetKeywords,
  onComplete,
  onError
}: StreamingContentDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  
  const {
    isStreaming,
    content,
    error,
    isComplete,
    wordCount,
    tokensUsed,
    streamContent,
    cancelStream,
    resetState
  } = useStreamingContent(projectId, {
    onChunk: (chunk, fullContent) => {
      // Auto-scroll to bottom if user hasn't manually scrolled up
      if (isAutoScrolling && contentRef.current) {
        setTimeout(() => {
          if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
          }
        }, 10);
      }
    },
    onComplete: (content, metadata) => {
      onComplete?.(section.id, content);
    },
    onError: (error) => {
      onError?.(section.id, error);
    }
  });
  
  // Handle manual scrolling to disable auto-scroll
  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      
      // If user scrolled up, disable auto-scroll
      if (scrollTop < lastScrollTop.current) {
        setIsAutoScrolling(false);
      }
      
      // If user scrolled to bottom, re-enable auto-scroll
      if (isAtBottom) {
        setIsAutoScrolling(true);
      }
      
      lastScrollTop.current = scrollTop;
    }
  };
  
  const handleStartStreaming = async () => {
    resetState();
    
    const prompt = `Write a comprehensive section about "${section.heading}" for this blog post.`;
    
    await streamContent({
      sectionId: section.id,
      prompt,
      context: {
        previousContent,
        sectionHeading: section.heading,
        sectionGoal: section.goal,
        keyPoints: section.subSections.flatMap(sub => sub.keyPoints),
        tone,
        targetKeywords
      }
    });
  };
  
  const handleCopyContent = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const formatContent = (text: string) => {
    // Simple markdown-like formatting for display
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
      .replace(/^\- (.*$)/gm, '<li class="ml-4">• $1</li>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/^(.+)$/gm, '<p class="mb-4">$1</p>');
  };
  
  const getStatusColor = () => {
    if (error) return 'bg-red-500';
    if (isComplete) return 'bg-green-500';
    if (isStreaming) return 'bg-blue-500';
    return 'bg-gray-500';
  };
  
  const getStatusText = () => {
    if (error) return 'Error';
    if (isComplete) return 'Complete';
    if (isStreaming) return 'Writing...';
    return 'Ready';
  };
  
  const getStatusIcon = () => {
    if (error) return <RefreshCw className="h-4 w-4" />;
    if (isComplete) return <Check className="h-4 w-4" />;
    if (isStreaming) return <Zap className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{section.heading}</CardTitle>
            <Badge 
              variant="secondary" 
              className={`${getStatusColor()} text-white`}
            >
              <div className="flex items-center gap-1">
                {getStatusIcon()}
                {getStatusText()}
              </div>
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {wordCount > 0 && (
              <div className="text-sm text-muted-foreground">
                {wordCount} words
              </div>
            )}
            
            {tokensUsed > 0 && (
              <div className="text-sm text-muted-foreground">
                {tokensUsed} tokens
              </div>
            )}
          </div>
        </div>
        
        {section.goal && (
          <p className="text-sm text-muted-foreground mt-2">
            Goal: {section.goal}
          </p>
        )}
        
        {/* Progress bar for streaming */}
        {isStreaming && (
          <div className="mt-3">
            <Progress value={undefined} className="w-full animate-pulse" />
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Generating content...
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        {/* Control buttons */}
        <div className="flex items-center gap-2 mb-4">
          {!isStreaming && !isComplete && (
            <Button 
              onClick={handleStartStreaming}
              size="sm"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start Writing
            </Button>
          )}
          
          {isStreaming && (
            <Button 
              onClick={cancelStream}
              size="sm"
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          )}
          
          {(isComplete || error) && (
            <Button 
              onClick={handleStartStreaming}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
          )}
          
          {content && (
            <Button 
              onClick={handleCopyContent}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
        
        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="text-red-700 font-medium">Error generating content</div>
            <div className="text-red-600 text-sm mt-1">{error}</div>
          </div>
        )}
        
        {/* Content display */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50"
          onScroll={handleScroll}
        >
          {content ? (
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: formatContent(content) 
              }}
            />
          ) : (
            <div className="text-muted-foreground text-center py-8">
              {isStreaming ? (
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5 animate-pulse" />
                  Content will appear here as it's being generated...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5" />
                  Click "Start Writing" to generate content for this section
                </div>
              )}
            </div>
          )}
          
          {/* Streaming cursor */}
          {isStreaming && content && (
            <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1" />
          )}
        </div>
        
        {/* Auto-scroll indicator */}
        {!isAutoScrolling && isStreaming && (
          <div className="mt-2 text-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsAutoScrolling(true);
                if (contentRef.current) {
                  contentRef.current.scrollTop = contentRef.current.scrollHeight;
                }
              }}
              className="text-xs"
            >
              Scroll to bottom
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}