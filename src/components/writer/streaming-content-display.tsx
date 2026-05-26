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
  Clock,
  AlertCircle
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
  
  const formatContent = (text: string): string => {
    const lines = text.split('\n');
    const result: string[] = [];
    let inParagraph = false;

    const applyInline = (str: string) =>
      str
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:rgba(255,255,255,0.95);font-weight:600;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:rgba(255,255,255,0.75);font-style:italic;">$1</em>');

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        if (inParagraph) {
          result.push('</p>');
          inParagraph = false;
        }
        continue;
      }

      if (trimmed.startsWith('### ')) {
        if (inParagraph) { result.push('</p>'); inParagraph = false; }
        result.push(`<h3 style="color:rgba(255,255,255,0.95);font-size:1rem;font-weight:600;margin:1.25rem 0 0.5rem;">${applyInline(trimmed.slice(4))}</h3>`);
      } else if (trimmed.startsWith('## ')) {
        if (inParagraph) { result.push('</p>'); inParagraph = false; }
        result.push(`<h2 style="color:rgba(255,255,255,0.95);font-size:1.15rem;font-weight:700;margin:1.5rem 0 0.6rem;">${applyInline(trimmed.slice(3))}</h2>`);
      } else if (trimmed.startsWith('# ')) {
        if (inParagraph) { result.push('</p>'); inParagraph = false; }
        result.push(`<h1 style="color:rgba(255,255,255,0.95);font-size:1.35rem;font-weight:700;margin:1.75rem 0 0.75rem;">${applyInline(trimmed.slice(2))}</h1>`);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (inParagraph) { result.push('</p>'); inParagraph = false; }
        result.push(`<li style="color:rgba(255,255,255,0.8);margin-left:1.25rem;margin-bottom:0.35rem;list-style:disc;">` +
          applyInline(trimmed.slice(2)) + `</li>`);
      } else {
        if (!inParagraph) {
          result.push('<p style="color:rgba(255,255,255,0.8);line-height:1.75;margin-bottom:0.9rem;">');
          inParagraph = true;
        } else {
          result.push(' ');
        }
        result.push(applyInline(trimmed));
      }
    }

    if (inParagraph) result.push('</p>');
    return result.join('');
  };
  
  const getStatusColor = () => {
    if (error) return 'text-destructive';
    if (isComplete) return 'text-green-400';
    if (isStreaming) return 'text-primary';
    return 'text-muted-foreground';
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
    <div className="glass-card rounded-3xl border border-border h-full flex flex-col relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 opacity-30" />
      
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-shrink-0 p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-border">
                <div className={`w-5 h-5 ${getStatusColor()} rounded-lg flex items-center justify-center`}>
                  {getStatusIcon()}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gradient">{section.heading}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`px-3 py-1 rounded-full border ${
                    error ? 'bg-destructive/20 border-destructive/30 text-destructive' :
                    isComplete ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                    isStreaming ? 'bg-primary/20 border-primary/30 text-primary' :
                    'bg-muted/20 border-muted/30 text-muted-foreground'
                  }`}>
                    <span className="text-sm font-semibold">{getStatusText()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {wordCount > 0 && (
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {wordCount} words
                </div>
              )}
              
              {tokensUsed > 0 && (
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {tokensUsed} tokens
                </div>
              )}
            </div>
          </div>
          
          {section.goal && (
            <p className="text-sm text-muted-foreground mt-3 p-3 rounded-xl bg-surface-1 border border-border">
              <span className="font-medium">Goal:</span> {section.goal}
            </p>
          )}
          
          {/* Enhanced Progress bar for streaming */}
          {isStreaming && (
            <div className="mt-4">
              <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" />
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="animate-pulse">Generating content...</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 flex flex-col p-6">
          {/* Enhanced Control buttons */}
          <div className="flex items-center gap-3 mb-6">
            {!isStreaming && !isComplete && (
              <Button 
                onClick={handleStartStreaming}
                size="sm"
                className="auth-button px-6 rounded-xl hover-lift"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Writing
              </Button>
            )}
            
            {isStreaming && (
              <Button 
                onClick={cancelStream}
                size="sm"
                variant="destructive"
                className="px-6 rounded-xl hover-lift"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
            
            {(isComplete || error) && (
              <Button 
                onClick={handleStartStreaming}
                size="sm"
                variant="outline"
                className="glass-card border-border hover:bg-surface-1 px-6 rounded-xl"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
            
            {content && (
              <Button 
                onClick={handleCopyContent}
                size="sm"
                variant="outline"
                className="glass-card border-border hover:bg-surface-1 px-6 rounded-xl"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Enhanced Error display */}
          {error && (
            <div className="glass-card border border-destructive/20 bg-gradient-to-r from-destructive/10 to-red-500/5 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-destructive/20 border border-destructive/30">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <div className="text-destructive font-semibold">Error generating content</div>
                  <div className="text-destructive/80 text-sm mt-1">{error}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Enhanced Content display */}
          <div 
            ref={contentRef}
            className="flex-1 overflow-y-auto glass-card border border-border rounded-2xl p-6 relative"
            onScroll={handleScroll}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-surface-1/50 via-transparent to-surface-2/30 opacity-50 rounded-2xl" />
            
            <div className="relative z-10">
              {content ? (
                <div
                  style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.75' }}
                  dangerouslySetInnerHTML={{ __html: formatContent(content) }}
                />
              ) : (
                <div className="text-muted-foreground text-center py-12">
                  {isStreaming ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-primary/20 border border-primary/30">
                        <Zap className="h-8 w-8 text-primary animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gradient mb-2">AI is Writing...</h4>
                        <p>Content will appear here as it's being generated</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-muted/20 border border-muted/30">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gradient mb-2">Ready to Generate</h4>
                        <p>Click "Start Writing" to generate content for this section</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Enhanced Streaming cursor */}
              {isStreaming && content && (
                <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1 rounded-sm" />
              )}
            </div>
          </div>
          
          {/* Enhanced Auto-scroll indicator */}
          {!isAutoScrolling && isStreaming && (
            <div className="mt-4 text-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAutoScrolling(true);
                  if (contentRef.current) {
                    contentRef.current.scrollTop = contentRef.current.scrollHeight;
                  }
                }}
                className="glass-card border-border hover:bg-surface-1 text-xs px-4 rounded-xl"
              >
                Scroll to bottom
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}