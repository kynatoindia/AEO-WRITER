'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertTriangle, CheckCircle, Clock, Zap, Activity, Terminal, Cpu, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      if (!projectId || projectId === 'undefined' || projectId === '[id]') {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('status, status_message, progress, progress_percentage, current_step, estimated_completion_time, updated_at')
          .eq('id', projectId)
          .maybeSingle();

        if (error) {
          console.error('[ProjectStatusMonitor] Error:', error);
          return;
        }

        if (mounted && data) {
          const statusUpdate: StatusUpdate = {
            status: data.status as ProjectStatus,
            message: data.status_message || 'Processing...',
            progress: data.progress_percentage ?? data.progress ?? undefined,
            currentStep: data.current_step || undefined,
            updatedAt: data.updated_at,
          };

          setStatus(statusUpdate);
          onStatusChange?.(statusUpdate);
        }
      } catch (err) {
        console.error('Error fetching project status:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

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
              progress: payload.new.progress_percentage ?? payload.new.progress ?? undefined,
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
      <div className={cn("flex items-center gap-3 p-6 glass rounded-2xl", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Synchronizing Mission Data...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={cn("flex items-center gap-3 p-6 glass rounded-2xl border-destructive/20", className)}>
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <span className="text-sm font-medium text-muted-foreground">Mission Control Offline</span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.status}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn("relative overflow-hidden", className)}
      >
        <ProjectStatusDisplay status={status} />
      </motion.div>
    </AnimatePresence>
  );
}

function ProjectStatusDisplay({ status }: { status: StatusUpdate }) {
  const getStatusConfig = (status: ProjectStatus) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-green-400',
          borderColor: 'border-green-500/20',
          glowColor: 'bg-green-500/10',
          label: 'Mission Accomplished',
          agentIcon: CheckCircle
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-400',
          borderColor: 'border-red-500/20',
          glowColor: 'bg-red-500/10',
          label: 'System Failure',
          agentIcon: AlertTriangle
        };
      case 'stuck':
        return {
          icon: Clock,
          color: 'text-amber-400',
          borderColor: 'border-amber-500/20',
          glowColor: 'bg-amber-500/10',
          label: 'Mission Paused',
          agentIcon: Clock
        };
      case 'researching':
        return {
          icon: Globe,
          color: 'text-blue-400',
          borderColor: 'border-blue-500/20',
          glowColor: 'bg-blue-500/10',
          label: 'Agent Researching',
          agentIcon: Globe
        };
      case 'generating_content':
        return {
          icon: Terminal,
          color: 'text-primary',
          borderColor: 'border-primary/20',
          glowColor: 'bg-primary/10',
          label: 'Agent Writing',
          agentIcon: PenTool
        };
      default:
        return {
          icon: Cpu,
          color: 'text-primary',
          borderColor: 'border-primary/20',
          glowColor: 'bg-primary/10',
          label: 'Agent Processing',
          agentIcon: Cpu
        };
    }
  };

  const config = getStatusConfig(status.status);
  const Icon = config.icon;

  return (
    <div className={cn(
      "p-6 rounded-2xl glass-dark border transition-all duration-500",
      config.borderColor
    )}>
      {/* Background Glow */}
      <div className={cn("absolute inset-0 -z-10 blur-3xl opacity-20 transition-colors duration-500", config.glowColor)} />

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl bg-white/5", config.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground/60">
                Status Report
              </h3>
              <p className={cn("text-lg font-bold", config.color)}>
                {config.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <Activity className="h-3 w-3 text-primary animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
              Live Feed
            </span>
          </div>
        </div>

        {/* Message & Progress */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 font-mono text-sm leading-relaxed">
            <span className="text-primary mr-2">❯</span>
            {status.message}
          </div>

          {status.progress !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                <span>Mission Progress</span>
                <span>{status.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${status.progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={cn("h-full rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]",
                    status.status === 'stuck' ? 'bg-amber-500' : 'bg-primary'
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-4">
            {status.currentStep && (
              <div className="flex items-center gap-2">
                <Terminal className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  Step: {status.currentStep}
                </span>
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase">
            Last Update: {new Date(status.updatedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Stuck/Error Overlays */}
      {status.status === 'stuck' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/80 leading-relaxed"
        >
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p>
              <strong>System Notice:</strong> {status.message.includes('quota') ?
                "API Quota limit reached. Automatic failover and retry in progress..." :
                "Service rate-limited. Mission will resume automatically."}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Helper icons for the display
function PenTool(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19 7-7 3 3-7 7-3-3z" />
      <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="m2 2 20 20" />
      <path d="m8 21 3-3" />
    </svg>
  );
}