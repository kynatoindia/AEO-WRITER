'use client';

import { useState, useEffect, Suspense } from 'react';
import { useContentGeneration } from '@/lib/hooks/use-content-generation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  FileText, 
  Zap,
  AlertCircle,
  Eye,
  Layout,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { StreamingContentDisplay } from './streaming-content-display';
import { BlueprintSidebar } from './blueprint-sidebar';
import type { ContentBlueprint } from '@/lib/types';

interface LiveWriterProps {
  projectId: string;
  onComplete?: (content: string) => void;
  onError?: (error: string) => void;
}

// Loading fallback component
function LiveWriterSkeleton() {
  return (
    <div className="h-full flex gap-6">
      {/* Sidebar skeleton */}
      <div className="w-80 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      
      {/* Content area skeleton */}
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-96 w-full" />
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
  
  const {
    progress,
    isLoading,
    error,
    isGenerating,
    realtimeEvents,
    startGeneration,
    refreshProgress,
    isCompleted,
    hasError,
    progressPercentage,
    estimatedTimeRemaining,
    clearError
  } = useContentGeneration({ projectId });
  
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
        const data = event.data as any;
        setSectionProgress(prev => ({
          ...prev,
          [data.sectionId]: {
            status: 'completed',
            wordCount: data.wordCount || 0
          }
        }));
        
        if (data.content) {
          setGeneratedContent(prev => ({
            ...prev,
            [data.sectionId]: data.content
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
      }
    }
  }, [isCompleted, progress?.status, progress?.blueprint, generatedContent, onComplete]);
  
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
    setSectionProgress(prev => ({
      ...prev,
      [sectionId]: {
        status: 'pending', // Reset to allow retry
        wordCount: prev[sectionId]?.wordCount || 0
      }
    }));
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
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-white">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-500" />
            Live Content Generation
          </h2>
          <p className="text-muted-foreground">
            Watch your content being created in real-time with AI streaming
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Demo button for development */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              variant="default"
              size="sm"
              onClick={startDemoGeneration}
              disabled={isDemoRunning}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDemoRunning ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Demo Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
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
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Generation Controls */}
      {!isGenerating && !isCompleted && !progress?.blueprint && (
        <div className="mx-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Start Content Generation</CardTitle>
              <CardDescription>
                Begin the AI-powered content generation process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleStartGeneration}
                disabled={isLoading}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Generation
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Progress Overview */}
      {progress && (
        <div className="mx-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <CardTitle className="capitalize">{progress.status}</CardTitle>
                  <Badge variant="secondary">
                    {progressPercentage}%
                  </Badge>
                </div>
                
                {estimatedTimeRemaining > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatTime(estimatedTimeRemaining)} remaining
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <Progress value={progressPercentage} className="w-full mb-4" />
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {progress.completedSections}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {progress.writingSections}
                  </div>
                  <div className="text-sm text-muted-foreground">Writing</div>
                </div>
                
                <div>
                  <div className="text-2xl font-bold text-gray-600">
                    {progress.sectionsRemaining}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Main Content Area */}
      {progress?.blueprint && (
        <div className="flex-1 flex gap-6 p-6 min-h-0">
          {/* Blueprint Sidebar */}
          <div className="w-80 flex-shrink-0">
            <BlueprintSidebar
              blueprint={progress.blueprint}
              currentSectionId={currentSectionId || undefined}
              sectionProgress={sectionProgress}
              onSectionSelect={setCurrentSectionId}
              className="h-full"
            />
          </div>
          
          {/* Streaming Content Display */}
          <div className="flex-1 min-w-0">
            {getCurrentSection() ? (
              <div className="h-full">
                {isDemoRunning && currentSectionId && demoContent[currentSectionId] ? (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-500 animate-pulse" />
                        {getCurrentSection()?.heading}
                        <Badge variant="secondary" className="animate-pulse">
                          {sectionProgress[currentSectionId]?.status === 'writing' ? 'Writing...' : 'Completed'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-full overflow-auto">
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {demoContent[currentSectionId]}
                          {sectionProgress[currentSectionId]?.status === 'writing' && (
                            <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1"></span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
              <Card className="h-full flex items-center justify-center">
                <CardContent>
                  <div className="text-center text-muted-foreground">
                    <Layout className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select a Section</h3>
                    <p>Choose a section from the blueprint to start writing</p>
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-4">
                        <Button onClick={startDemoGeneration} disabled={isDemoRunning}>
                          <Play className="h-4 w-4 mr-2" />
                          Try Demo Content Generation
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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