'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Search, 
  Lightbulb, 
  PenTool,
  ExternalLink 
} from 'lucide-react';
import { ProjectStatus } from '@/lib/types';
import { toast } from 'sonner';

interface ProjectStatusUpdate {
  projectId: string;
  status: ProjectStatus;
  progress: number;
  message: string;
  metadata?: any;
  timestamp: string;
}

interface ProjectStatusTrackerProps {
  projectId: string;
  userId: string;
  initialStatus?: ProjectStatus;
  onStatusChange?: (status: ProjectStatus) => void;
}

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: FileText,
    color: 'bg-gray-500',
    description: 'Project created, ready to start',
  },
  researching: {
    label: 'Researching',
    icon: Search,
    color: 'bg-blue-500',
    description: 'Analyzing competitors and gathering insights',
  },
  planning: {
    label: 'Planning',
    icon: Lightbulb,
    color: 'bg-yellow-500',
    description: 'Creating content blueprint and strategy',
  },
  writing: {
    label: 'Writing',
    icon: PenTool,
    color: 'bg-green-500',
    description: 'Generating content sections',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'bg-emerald-500',
    description: 'Content generation finished',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    color: 'bg-red-500',
    description: 'An error occurred during processing',
  },
};

export function ProjectStatusTracker({ 
  projectId, 
  userId, 
  initialStatus = 'draft',
  onStatusChange 
}: ProjectStatusTrackerProps) {
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [updates, setUpdates] = useState<ProjectStatusUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to real-time updates for this project
    const channel = supabase
      .channel(`project:${projectId}`)
      .on('broadcast', { event: 'project_status_update' }, (payload) => {
        const update = payload.payload as ProjectStatusUpdate;
        
        if (update.projectId === projectId) {
          setStatus(update.status);
          setProgress(update.progress);
          setMessage(update.message);
          
          if (update.metadata) {
            setMetadata(update.metadata);
          }

          // Add to updates history
          setUpdates(prev => [update, ...prev.slice(0, 9)]); // Keep last 10 updates

          // Notify parent component
          if (onStatusChange) {
            onStatusChange(update.status);
          }

          // Show toast for important updates
          if (update.status === 'completed') {
            toast.success('Project completed successfully!');
          } else if (update.status === 'error') {
            toast.error('An error occurred during processing');
          }
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('Connected to project updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to connect to project updates');
          toast.error('Lost connection to real-time updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, onStatusChange]);

  const getProgressSteps = () => {
    const steps = [
      { key: 'draft', label: 'Created', progress: 0 },
      { key: 'researching', label: 'Research', progress: 25 },
      { key: 'planning', label: 'Planning', progress: 50 },
      { key: 'writing', label: 'Writing', progress: 75 },
      { key: 'completed', label: 'Complete', progress: 100 },
    ];

    const currentIndex = steps.findIndex(step => step.key === status);
    return steps.map((step, index) => ({
      ...step,
      isActive: index === currentIndex,
      isCompleted: index < currentIndex || status === 'completed',
      isError: status === 'error' && index === currentIndex,
    }));
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const currentConfig = statusConfig[status];
  const Icon = currentConfig.icon;
  const progressSteps = getProgressSteps();

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${currentConfig.color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{currentConfig.label}</CardTitle>
                <CardDescription>{currentConfig.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Current Message */}
          {message && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-blue-700">{message}</span>
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {progressSteps.map((step, index) => (
              <div key={step.key} className="flex flex-col items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  ${step.isCompleted 
                    ? 'bg-green-500 text-white' 
                    : step.isActive 
                      ? step.isError 
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {step.isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : step.isError ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : step.isActive ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-xs mt-1 text-center">{step.label}</span>
              </div>
            ))}
          </div>

          {/* Metadata Display */}
          {metadata && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
              {metadata.initialization && (
                <>
                  <div>
                    <span className="text-xs text-gray-500">Brand Document</span>
                    <p className="text-sm font-medium">
                      {metadata.initialization.brandDocumentProcessed ? 'Processed' : 'None'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Competitor URLs</span>
                    <p className="text-sm font-medium">
                      {metadata.initialization.validCompetitorUrls}/{metadata.initialization.totalCompetitorUrls}
                    </p>
                  </div>
                </>
              )}
              {metadata.estimatedCost && (
                <div>
                  <span className="text-xs text-gray-500">Estimated Cost</span>
                  <p className="text-sm font-medium">${metadata.estimatedCost}</p>
                </div>
              )}
              {metadata.estimatedTokens && (
                <div>
                  <span className="text-xs text-gray-500">Estimated Tokens</span>
                  <p className="text-sm font-medium">{metadata.estimatedTokens.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Updates */}
      {updates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {updates.slice(0, 5).map((update, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <Badge variant="outline" className="text-xs">
                    {formatTimestamp(update.timestamp)}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm">{update.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {statusConfig[update.status].label}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {update.progress}% complete
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {status === 'completed' && (
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <a href={`/project/${projectId}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              View Project
            </a>
          </Button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">
            Retry Processing
          </Button>
          <Button variant="outline">
            Contact Support
          </Button>
        </div>
      )}
    </div>
  );
}