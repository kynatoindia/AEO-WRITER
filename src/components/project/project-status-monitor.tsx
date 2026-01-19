'use client';

import { useEffect, useState } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Loader2, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface StatusUpdate {
  status: ProjectStatus;
  message: string;
  progress?: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  updatedAt: string;
}

interface ProjectStatusMonitorProps {
  projectId: string;
  onStatusChange?: (status: StatusUpdate) => void;
  className?: string;
}

export function ProjectStatusMonitor({ 
  projectId, 
  onStatusChange, 
  className 
}: ProjectStatusMonitorProps) {
  const [status, setStatus] = useState<StatusUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientSupabaseClient();

  useEffect(() => {
    let mounted = true;

    // Initial fetch
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('status, status_message, progress, current_step, updated_at')
          .eq('id', projectId)
          .single();

        if (error) {
          console.error('Error fetching project status:', error);
          return;
        }

        if (mounted && data) {
          const statusUpdate: StatusUpdate = {
            status: data.status as ProjectStatus,
            message: data.status_message || 'Processing...',
            progress: data.progress || undefined,
            currentStep: data.current_step || undefined,
            updatedAt: data.updated_at,
          };
          
          setStatus(statusUpdate);
          onStatusChange?.(statusUpdate);
        }
      } catch (error) {
        console.error('Error fetching project status:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`project-status-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          if (mounted) {
            const statusUpdate: StatusUpdate = {
              status: payload.new.status as ProjectStatus,
              message: payload.new.status_message || 'Processing...',
              progress: payload.new.progress || undefined,
              currentStep: payload.new.current_step || undefined,
              updatedAt: payload.new.updated_at,
            };
            
            setStatus(statusUpdate);
            onStatusChange?.(statusUpdate);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [projectId, onStatusChange, supabase]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 p-4 bg-gray-50 rounded-lg", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-gray-600">Loading status...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={cn("flex items-center gap-2 p-4 bg-gray-50 rounded-lg", className)}>
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <span className="text-sm text-gray-600">Status unavailable</span>
      </div>
    );
  }

  return (
    <ProjectStatusDisplay status={status} className={className} />
  );
}

interface ProjectStatusDisplayProps {
  status: StatusUpdate;
  className?: string;
}

function ProjectStatusDisplay({ status, className }: ProjectStatusDisplayProps) {
  const getStatusConfig = (status: ProjectStatus) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          showProgress: false,
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          showProgress: false,
        };
      case 'stuck':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          showProgress: true,
        };
      case 'paused':
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          showProgress: true,
        };
      default:
        return {
          icon: Zap,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          showProgress: true,
        };
    }
  };

  const config = getStatusConfig(status.status);
  const Icon = config.icon;

  return (
    <div className={cn(
      "p-4 rounded-lg border-l-4",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className={cn("font-semibold text-sm", config.color)}>
              {getStatusTitle(status.status)}
            </h3>
            {status.estimatedTimeRemaining && (
              <span className="text-xs text-gray-500">
                ~{Math.ceil(status.estimatedTimeRemaining / 60)}m remaining
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-700 mb-3">
            {status.message}
          </p>
          
          {status.currentStep && (
            <p className="text-xs text-gray-500 mb-2">
              Current step: {status.currentStep}
            </p>
          )}
          
          {config.showProgress && status.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{status.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    status.status === 'stuck' ? 'bg-yellow-400' : 'bg-blue-500'
                  )}
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {status.status === 'stuck' && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 mb-1">
                    ⚠️ Temporarily Paused
                  </p>
                  <p className="text-amber-700">
                    {status.message.includes('quota') || status.message.includes('Quota') ? (
                      <>
                        We're currently on the <strong>Free Tier</strong> and have hit our API quota limit. 
                        Your request is queued and will continue automatically in ~60 seconds.
                      </>
                    ) : (
                      <>
                        The AI service is currently rate-limited. Your request is queued and will continue automatically.
                      </>
                    )}
                  </p>
                  {status.estimatedTimeRemaining && (
                    <p className="text-xs text-amber-600 mt-1">
                      Estimated resume time: ~{Math.ceil(status.estimatedTimeRemaining / 60)} minutes
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {status.status === 'error' && (
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded"
              >
                Retry
              </button>
              <button 
                onClick={() => {/* Handle support */}}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-2 py-1 rounded"
              >
                Get Help
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusTitle(status: ProjectStatus): string {
  switch (status) {
    case 'created':
      return 'Project Created';
    case 'initializing':
      return 'Initializing';
    case 'researching':
      return 'Researching';
    case 'generating_blueprint':
      return 'Creating Blueprint';
    case 'generating_content':
      return 'Writing Content';
    case 'finalizing':
      return 'Finalizing';
    case 'completed':
      return 'Completed';
    case 'stuck':
      return 'Temporarily Paused';
    case 'error':
      return 'Error Occurred';
    case 'paused':
      return 'Paused';
    default:
      return 'Processing';
  }
}