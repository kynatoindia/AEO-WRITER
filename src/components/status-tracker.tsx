'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StatusStep {
  id: string;
  label: string;
  state: 'pending' | 'processing' | 'completed' | 'error';
  timestamp?: string;
  details?: string;
}

interface ProjectStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  current_section?: string;
  progress_percentage?: number;
  steps?: StatusStep[];
  error_message?: string;
  updated_at: string;
}

export default function StatusTracker({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // 1. Initial Fetch
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, status, current_section, progress_percentage, steps, error_message, updated_at')
          .eq('id', projectId)
          .single();

        if (error) {
          console.error('Error fetching project status:', error);
          return;
        }

        if (data) {
          setStatus(data as ProjectStatus);
        }
      } catch (error) {
        console.error('Failed to fetch initial status:', error);
      }
    };

    fetchStatus();

    // 2. Realtime Subscription
    const channel = supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          setStatus(payload.new as ProjectStatus);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('Successfully subscribed to project updates');
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          console.error('Channel subscription error');
        }
      });

    // Cleanup: Essential to prevent memory leaks and "Channel Errors"
    return () => {
      console.log('Cleaning up status tracker subscription');
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase]);

  // Default steps if none are provided
  const defaultSteps: StatusStep[] = [
    { id: 'layout', label: 'Generating blog layout', state: 'pending' },
    { id: 'section-1', label: 'Writing introduction', state: 'pending' },
    { id: 'section-2', label: 'Writing main content', state: 'pending' },
    { id: 'section-3', label: 'Writing conclusion', state: 'pending' },
    { id: 'finalize', label: 'Final SEO optimization', state: 'pending' },
  ];

  const steps = status?.steps || defaultSteps;

  const getStepIcon = (step: StatusStep) => {
    switch (step.state) {
      case 'completed':
        return <CheckCircle2 className="text-green-500 w-5 h-5" />;
      case 'processing':
        return <Loader2 className="text-blue-500 w-5 h-5 animate-spin" />;
      case 'error':
        return <AlertCircle className="text-red-500 w-5 h-5" />;
      default:
        return <Circle className="text-gray-300 w-5 h-5" />;
    }
  };

  const getStepTextColor = (step: StatusStep) => {
    switch (step.state) {
      case 'completed':
        return 'text-gray-500 line-through';
      case 'processing':
        return 'text-blue-600 font-medium';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-700';
    }
  };

  const getOverallStatus = () => {
    if (!status) return 'Initializing...';
    
    switch (status.status) {
      case 'pending':
        return 'Waiting to start...';
      case 'processing':
        return 'Generating content...';
      case 'completed':
        return 'Blog generation completed!';
      case 'error':
        return 'Generation failed';
      default:
        return 'Unknown status';
    }
  };

  const getProgressPercentage = () => {
    if (status?.progress_percentage) {
      return status.progress_percentage;
    }
    
    const completedSteps = steps.filter(step => step.state === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  if (!status) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading Status...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Generation Progress</span>
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-500">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </CardTitle>
        <CardDescription>{getOverallStatus()}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
        
        <div className="text-sm text-gray-600 text-center">
          {getProgressPercentage()}% Complete
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id || index} className="flex items-center gap-3">
              {getStepIcon(step)}
              <div className="flex-1">
                <span className={getStepTextColor(step)}>
                  {step.label}
                </span>
                {step.details && (
                  <div className="text-xs text-gray-500 mt-1">
                    {step.details}
                  </div>
                )}
                {step.timestamp && (
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Current Section */}
        {status.current_section && status.status === 'processing' && (
          <Alert className="border-blue-200 bg-blue-50">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Currently writing:</strong> {status.current_section}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {status.status === 'error' && status.error_message && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {status.error_message}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {status.status === 'completed' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Success!</strong> Your blog has been generated successfully. 
              You can now review and publish it.
            </AlertDescription>
          </Alert>
        )}

        {/* Last Updated */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t">
          Last updated: {new Date(status.updated_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}