'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useContentFinalization } from '@/lib/hooks/use-content-finalization';
import { 
  CheckCircle, 
  Clock, 
  Sparkles, 
  FileText, 
  Search, 
  MessageSquare, 
  Target,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ContentFinalizationProps {
  projectId: string;
  onFinalizationComplete?: () => void;
}

export function ContentFinalization({ projectId, onFinalizationComplete }: ContentFinalizationProps) {
  const {
    isLoading,
    isFinalizationInProgress,
    finalizationStatus,
    error,
    triggerFinalization,
    getFinalizationStatus,
    clearError
  } = useContentFinalization();

  const [showForceOption, setShowForceOption] = useState(false);

  // Load finalization status on mount
  useEffect(() => {
    getFinalizationStatus(projectId);
  }, [projectId, getFinalizationStatus]);

  // Poll for status updates during finalization
  useEffect(() => {
    if (!isFinalizationInProgress) return;

    const interval = setInterval(async () => {
      const status = await getFinalizationStatus(projectId);
      if (status && !status.isFinalizationInProgress) {
        if (status.isFinalized && onFinalizationComplete) {
          onFinalizationComplete();
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isFinalizationInProgress, projectId, getFinalizationStatus, onFinalizationComplete]);

  const handleFinalize = async (force: boolean = false) => {
    const result = await triggerFinalization(projectId, force);
    if (result) {
      setShowForceOption(false);
    }
  };

  const handleRefreshStatus = () => {
    getFinalizationStatus(projectId);
  };

  if (isLoading && !finalizationStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Content Finalization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading finalization status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!finalizationStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Content Finalization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Unable to load finalization status</p>
            <Button variant="outline" onClick={handleRefreshStatus} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Content Finalization
            </CardTitle>
            <CardDescription>
              Enhance your content with SEO optimization, FAQ generation, and structured data
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStatus}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {finalizationStatus.isFinalized ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : isFinalizationInProgress ? (
              <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">
              {finalizationStatus.isFinalized 
                ? 'Finalized' 
                : isFinalizationInProgress 
                ? 'Finalizing...' 
                : 'Ready to Finalize'}
            </span>
          </div>
          <Badge variant={
            finalizationStatus.isFinalized 
              ? 'default' 
              : isFinalizationInProgress 
              ? 'secondary' 
              : 'outline'
          }>
            {finalizationStatus.status}
          </Badge>
        </div>

        {/* Progress Bar for Active Finalization */}
        {isFinalizationInProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Finalizing content...</span>
              <span>2-5 minutes</span>
            </div>
            <Progress value={undefined} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Generating SEO metadata, FAQ section, structured data, and key takeaways
            </p>
          </div>
        )}

        {/* Content Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{finalizationStatus.metrics.wordCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Words</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <MessageSquare className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{finalizationStatus.metrics.faqCount}</div>
            <div className="text-xs text-muted-foreground">FAQs</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Search className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">
              {finalizationStatus.metrics.seoScore || '--'}
            </div>
            <div className="text-xs text-muted-foreground">SEO Score</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">
              {finalizationStatus.metrics.readabilityScore || '--'}
            </div>
            <div className="text-xs text-muted-foreground">Readability</div>
          </div>
        </div>

        {/* Enhancement Features */}
        <div className="space-y-3">
          <h4 className="font-medium">Finalization includes:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Content polishing & flow optimization</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Enhanced SEO metadata generation</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>FAQ section with schema markup</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Structured data for search engines</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Key takeaways & action items</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Executive summary generation</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {finalizationStatus.isFinalized && (
              <span>Last finalized: {new Date(finalizationStatus.lastUpdated).toLocaleString()}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {finalizationStatus.isFinalized && !showForceOption && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForceOption(true)}
                disabled={isFinalizationInProgress}
              >
                Re-finalize
              </Button>
            )}
            
            {showForceOption && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForceOption(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleFinalize(true)}
                  disabled={isLoading || isFinalizationInProgress}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Force Re-finalize
                </Button>
              </>
            )}
            
            {finalizationStatus.canFinalize && !showForceOption && (
              <Button
                onClick={() => handleFinalize(false)}
                disabled={isLoading || isFinalizationInProgress}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Finalize Content
              </Button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={clearError}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}