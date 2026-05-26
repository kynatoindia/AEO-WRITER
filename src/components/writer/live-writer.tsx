'use client';

import { useState, useEffect, Suspense } from 'react';
import { useContentGeneration } from '@/lib/hooks/use-content-generation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Pause,
  RefreshCw,
  Copy,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Zap,
  AlertCircle,
  Layout,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { StreamingContentDisplay } from './streaming-content-display';
import { BlueprintSidebar } from './blueprint-sidebar';

interface LiveWriterProps {
  projectId: string;
  onComplete?: (content: string) => void;
  onError?: (error: string) => void;
}

// Enhanced Loading fallback component
function LiveWriterSkeleton() {
  return (
    <div className="h-full flex gap-6 p-6">
      {/* Sidebar skeleton */}
      <div className="w-80 space-y-4">
        <div className="glass-card rounded-2xl p-4 border border-border">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-24 w-full mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-card rounded-xl p-3 border border-border">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content area skeleton */}
      <div className="flex-1 space-y-4">
        <div className="glass-card rounded-3xl p-6 border border-border">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    </div>
  );
}

// Main content component wrapped in Suspense
function LiveWriterContent({ projectId, onComplete, onError }: LiveWriterProps) {
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [sectionProgress, setSectionProgress] = useState<Record<string, {
    status: 'pending' | 'writing' | 'completed';
    wordCount: number;
  }>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoContent, setDemoContent] = useState<Record<string, string>>({});
  const [isFinalContentCopied, setIsFinalContentCopied] = useState(false);

  const {
    progress,
    isLoading,
    error,
    isGenerating,
    realtimeEvents,
    startGeneration,
    refreshProgress,
    isCompleted,
    progressPercentage,
    estimatedTimeRemaining,
    clearError
  } = useContentGeneration({ projectId });

  // Hydrate section state and content from persisted API data.
  useEffect(() => {
    if (!progress?.sections?.length) return;

    setSectionProgress((prev) => {
      const next = { ...prev };
      let changed = false;

      progress.sections.forEach((section) => {
        const nextStatus = section.status || 'pending';
        const nextWordCount = section.wordCount || 0;
        const current = prev[section.id];

        if (!current || current.status !== nextStatus || current.wordCount !== nextWordCount) {
          next[section.id] = {
            status: nextStatus,
            wordCount: nextWordCount,
          };
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    setGeneratedContent((prev) => {
      const next = { ...prev };
      let changed = false;

      progress.sections.forEach((section) => {
        if (section.content && section.content.length > 0 && next[section.id] !== section.content) {
          next[section.id] = section.content;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [progress?.sections]);

  // Initialize current section when blueprint is available
  useEffect(() => {
    if (progress?.blueprint?.sections && !currentSectionId) {
      const firstPendingSection = progress.blueprint.sections.find(
        section => !sectionProgress[section.id] || sectionProgress[section.id].status === 'pending'
      );
      if (firstPendingSection) {
        setCurrentSectionId(firstPendingSection.id);
      } else if (progress.blueprint.sections.length > 0) {
        setCurrentSectionId(progress.blueprint.sections[0].id);
      }
    }
  }, [progress?.blueprint, currentSectionId, sectionProgress]);

  // Update section progress from real-time events
  useEffect(() => {
    realtimeEvents.forEach(event => {
      if (event.type === 'section_complete') {
        const data = event.data as {
          sectionId?: string;
          wordCount?: number;
          content?: string;
        };

        if (!data.sectionId) {
          return;
        }

        const sectionId = data.sectionId as string;
        setSectionProgress(prev => ({
          ...prev,
          [sectionId]: {
            status: 'completed',
            wordCount: data.wordCount || 0
          }
        }));

        if (data.content) {
          setGeneratedContent(prev => ({
            ...prev,
            [sectionId]: data.content as string
          }));
        }
      }
    });
  }, [realtimeEvents]);

  // Handle completion
  useEffect(() => {
    if (isCompleted && progress?.status === 'completed' && onComplete) {
      // Combine all generated content
      const fullContent = progress.blueprint?.sections
        .map(section => generatedContent[section.id] || '')
        .filter(content => content.length > 0)
        .join('\n\n');

      if (fullContent) {
        onComplete(fullContent);
      } else if (progress.finalContent) {
        onComplete(progress.finalContent);
      }
    }
  }, [isCompleted, progress?.status, progress?.blueprint, progress?.finalContent, generatedContent, onComplete]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleStartGeneration = async () => {
    try {
      clearError();
      await startGeneration({
        preferences: {
          includeTables: true,
          includeImages: false,
          includeCodeBlocks: false,
          targetReadingLevel: 7
        }
      });
    } catch (err) {
      console.error('Failed to start generation:', err);
    }
  };

  const startDemoGeneration = async () => {
    if (isDemoRunning) return;

    setIsDemoRunning(true);
    setDemoContent({});

    // Reset section progress for demo
    setSectionProgress({
      'mock-1': { status: 'pending', wordCount: 0 },
      'mock-2': { status: 'pending', wordCount: 0 },
      'mock-3': { status: 'pending', wordCount: 0 },
      'mock-4': { status: 'pending', wordCount: 0 },
    });

    try {
      const response = await fetch(`/api/projects/${projectId}/demo-stream`, {
        method: 'POST',
      });

      if (!response.body) {
        throw new Error('No response body');
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
                case 'section_started':
                  setSectionProgress(prev => ({
                    ...prev,
                    [data.data.sectionId]: { status: 'writing', wordCount: 0 }
                  }));
                  setCurrentSectionId(data.data.sectionId);
                  break;

                case 'content_chunk':
                  setDemoContent(prev => ({
                    ...prev,
                    [data.data.sectionId]: data.data.fullContent
                  }));
                  break;

                case 'section_complete':
                  setSectionProgress(prev => ({
                    ...prev,
                    [data.data.sectionId]: { status: 'completed', wordCount: data.data.wordCount }
                  }));
                  setGeneratedContent(prev => ({
                    ...prev,
                    [data.data.sectionId]: data.data.content
                  }));
                  break;

                case 'generation_complete':
                  console.log('Demo generation completed!');
                  break;

                case 'error':
                  console.error('Demo error:', data.data.error);
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse demo data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Demo generation failed:', error);
    } finally {
      setIsDemoRunning(false);
    }
  };

  const handleSectionComplete = (sectionId: string, content: string) => {
    setSectionProgress(prev => ({
      ...prev,
      [sectionId]: {
        status: 'completed',
        wordCount: content.split(' ').length
      }
    }));

    setGeneratedContent(prev => ({
      ...prev,
      [sectionId]: content
    }));

    // Auto-advance to next pending section
    if (progress?.blueprint?.sections) {
      const currentIndex = progress.blueprint.sections.findIndex(s => s.id === sectionId);
      const nextSection = progress.blueprint.sections
        .slice(currentIndex + 1)
        .find(section => !sectionProgress[section.id] || sectionProgress[section.id].status === 'pending');

      if (nextSection) {
        setCurrentSectionId(nextSection.id);
      }
    }
  };

  const handleSectionError = (sectionId: string, error: string) => {
    void error;
    setSectionProgress(prev => ({
      ...prev,
      [sectionId]: {
        status: 'pending', // Reset to allow retry
        wordCount: prev[sectionId]?.wordCount || 0
      }
    }));
  };

  const handleCopyFinalContent = async () => {
    if (!progress?.finalContent) return;

    try {
      await navigator.clipboard.writeText(progress.finalContent);
      setIsFinalContentCopied(true);
      setTimeout(() => setIsFinalContentCopied(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy final content:', copyError);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentSection = () => {
    if (!progress?.blueprint?.sections || !currentSectionId) return null;
    return progress.blueprint.sections.find(s => s.id === currentSectionId);
  };

  const getPreviousContent = () => {
    if (!progress?.blueprint?.sections || !currentSectionId) return '';

    const currentIndex = progress.blueprint.sections.findIndex(s => s.id === currentSectionId);
    return progress.blueprint.sections
      .slice(0, currentIndex)
      .map(section => generatedContent[section.id] || '')
      .filter(content => content.length > 0)
      .join('\n\n');
  };

  if (isLoading && !progress) {
    return <LiveWriterSkeleton />;
  }

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-6 border-b border-border glass-card backdrop-blur-xl">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/10 border border-border">
              <Zap className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <span className="text-gradient-primary">Live Content Generation</span>
          </h2>
          <p className="text-muted-foreground mt-1">
            Watch your content being created in real-time with AI streaming
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Demo button for development */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              variant="default"
              size="sm"
              onClick={startDemoGeneration}
              disabled={isDemoRunning}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 rounded-xl hover-lift"
            >
              {isDemoRunning ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Demo Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Demo Content Stream
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refreshProgress}
            disabled={isLoading}
            className="glass-card border-border hover:bg-surface-1 rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="glass-card border-border hover:bg-surface-1 rounded-xl"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Enhanced Error Display */}
      {error && (
        <div className="mx-6 mt-4">
          <div className="glass-card border border-destructive/20 bg-gradient-to-r from-destructive/10 to-red-500/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2 rounded-xl bg-destructive/20 border border-destructive/30">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <span className="font-semibold">Generation Error</span>
                <p className="text-sm mt-1 text-destructive/80">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Generation Controls */}
      {!isGenerating && !isCompleted && !progress?.blueprint && (
        <div className="mx-6 mt-4">
          <div className="glass-card rounded-3xl border border-border p-8 text-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-50" />

            <div className="relative z-10">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-purple-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                <Play className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gradient">Start Content Generation</h3>
              <p className="text-muted-foreground mb-8">
                Begin the AI-powered content generation process
              </p>
              <Button
                onClick={handleStartGeneration}
                disabled={isLoading}
                className="auth-button px-8 rounded-2xl hover-lift"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Generation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Progress Overview */}
      {progress && (
        <div className="mx-6 mt-4">
          <div className="glass-card rounded-3xl border border-border p-6 relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-purple-600/5 opacity-30" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-600/10 border border-border">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gradient capitalize">{progress.status}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
                        <span className="text-sm font-semibold text-primary">{progressPercentage}%</span>
                      </div>
                      {estimatedTimeRemaining > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatTime(estimatedTimeRemaining)} remaining
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full transition-all duration-500 ease-out relative"
                    style={{ width: `${progressPercentage}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20">
                  <div className="text-3xl font-bold text-green-400 mb-1">
                    {progress.completedSections}
                  </div>
                  <div className="text-sm text-green-300/80">Completed</div>
                </div>

                <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/5 border border-primary/20">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {progress.writingSections}
                  </div>
                  <div className="text-sm text-primary/80">Writing</div>
                </div>

                <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/10 border border-muted/30">
                  <div className="text-3xl font-bold text-muted-foreground mb-1">
                    {progress.sectionsRemaining}
                  </div>
                  <div className="text-sm text-muted-foreground/80">Remaining</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {(progress?.blueprint || (isCompleted && progress?.finalContent)) && (
        <div className={`flex-1 p-6 min-h-0 ${progress?.blueprint ? 'flex gap-6' : ''}`}>
          {/* Blueprint Sidebar */}
          {progress?.blueprint && (
            <div className="w-80 flex-shrink-0">
              <BlueprintSidebar
                blueprint={progress.blueprint}
                currentSectionId={currentSectionId || undefined}
                sectionProgress={sectionProgress}
                onSectionSelect={setCurrentSectionId}
                className="h-full"
              />
            </div>
          )}

          {/* Streaming Content Display */}
          <div className={progress?.blueprint ? 'flex-1 min-w-0' : 'h-full'}>
            {isCompleted && progress.finalContent ? (
              <Card className="h-full glass-card border border-border flex flex-col overflow-hidden">
                <CardHeader className="border-b border-border bg-gradient-to-r from-green-500/10 to-emerald-500/5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        Final Generated Content
                      </CardTitle>
                      <CardDescription>
                        Your content is complete and ready to use.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyFinalContent}
                      className="glass-card border-border hover:bg-surface-1 rounded-xl"
                    >
                      {isFinalContentCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Final
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6">
                  <div className="prose prose-invert max-w-none">
                    <article className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {progress.finalContent}
                    </article>
                  </div>
                </CardContent>
              </Card>
            ) : progress?.blueprint && getCurrentSection() ? (
              <div className="h-full">
                {isDemoRunning && currentSectionId && demoContent[currentSectionId] ? (
                  <div className="glass-card rounded-3xl border border-border h-full relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-30" />

                    <div className="relative z-10 h-full flex flex-col">
                      <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/10 border border-border">
                            <Zap className="h-5 w-5 text-primary animate-pulse" />
                          </div>
                          <h3 className="text-xl font-bold text-gradient">{getCurrentSection()?.heading}</h3>
                          <div className="px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
                            <span className="text-sm font-semibold text-primary animate-pulse">
                              {sectionProgress[currentSectionId]?.status === 'writing' ? 'Writing...' : 'Completed'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 p-6 overflow-auto">
                        <div className="prose prose-invert max-w-none">
                          <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                            {demoContent[currentSectionId]}
                            {sectionProgress[currentSectionId]?.status === 'writing' && (
                              <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1 rounded-sm"></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <StreamingContentDisplay
                    projectId={projectId}
                    section={getCurrentSection()!}
                    previousContent={getPreviousContent()}
                    tone={progress.blueprint.seoMetadata?.focusKeyword ? 'professional' : 'professional'} // TODO: Get from project
                    targetKeywords={progress.blueprint.seoMetadata?.targetKeywords}
                    onComplete={handleSectionComplete}
                    onError={handleSectionError}
                  />
                )}
              </div>
            ) : (
              <div className="glass-card rounded-3xl border border-border h-full flex items-center justify-center relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-30" />

                <div className="relative z-10 text-center text-muted-foreground">
                  <div className="w-16 h-16 bg-gradient-to-br from-muted/20 to-muted/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                    <Layout className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gradient">Select a Section</h3>
                  <p className="text-muted-foreground mb-6">Choose a section from the blueprint to start writing</p>
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      onClick={startDemoGeneration}
                      disabled={isDemoRunning}
                      className="auth-button px-6 rounded-2xl hover-lift"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Try Demo Content Generation
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveWriter({ projectId, onComplete, onError }: LiveWriterProps) {
  return (
    <Suspense fallback={<LiveWriterSkeleton />}>
      <LiveWriterContent
        projectId={projectId}
        onComplete={onComplete}
        onError={onError}
      />
    </Suspense>
  );
}
