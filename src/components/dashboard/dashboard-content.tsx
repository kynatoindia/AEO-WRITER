'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectCreationForm } from '@/components/project/project-creation-form';
import { ProjectStatusMonitor } from '@/components/project/project-status-monitor';
import { Plus, FileText, Clock, CheckCircle, AlertCircle, ExternalLink, Search, Filter, SortAsc, SortDesc, RefreshCw, Activity, LayoutGrid, List } from 'lucide-react';
import { Project, ProjectStatus, ContentTone, ContentFormat } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DashboardContentProps {
  user: User;
  initialProjects: Project[];
}

interface ProjectFilters {
  search: string;
  status: ProjectStatus | 'all';
  tone: ContentTone | 'all';
  format: ContentFormat | 'all';
  sortBy: 'created_at' | 'updated_at' | 'topic';
  sortOrder: 'asc' | 'desc';
}

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, color: 'text-gray-400', glow: 'bg-gray-500/10' },
  researching: { label: 'Researching', icon: Clock, color: 'text-blue-400', glow: 'bg-blue-500/10' },
  planning: { label: 'Planning', icon: Clock, color: 'text-yellow-400', glow: 'bg-yellow-500/10' },
  writing: { label: 'Writing', icon: Clock, color: 'text-primary', glow: 'bg-primary/10' },
  finalizing: { label: 'Finalizing', icon: Clock, color: 'text-purple-400', glow: 'bg-purple-500/10' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400', glow: 'bg-green-500/10' },
  error: { label: 'Error', icon: AlertCircle, color: 'text-red-400', glow: 'bg-red-500/10' },
};

export function DashboardContent({ user, initialProjects }: DashboardContentProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<ProjectFilters>({
    search: '',
    status: 'all',
    tone: 'all',
    format: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel('project-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProject = payload.new as Project;
            setProjects(prev => [newProject, ...prev]);
            toast.success(`New project "${newProject.topic}" created`);
          } else if (payload.eventType === 'UPDATE') {
            const updatedProject = payload.new as Project;
            setProjects(prev => prev.map(project =>
              project.id === updatedProject.id ? updatedProject : project
            ));
          } else if (payload.eventType === 'DELETE') {
            const deletedProject = payload.old as Project;
            setProjects(prev => prev.filter(project => project.id !== deletedProject.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(project =>
        project.topic.toLowerCase().includes(searchLower) ||
        project.competitor_urls.some(url => url.toLowerCase().includes(searchLower))
      );
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(project => project.status === filters.status);
    }

    if (filters.tone !== 'all') {
      filtered = filtered.filter(project => project.tone === filters.tone);
    }

    if (filters.format !== 'all') {
      filtered = filtered.filter(project => project.format === filters.format);
    }

    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (filters.sortBy) {
        case 'topic':
          aValue = a.topic.toLowerCase();
          bValue = b.topic.toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }

      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [projects, filters]);

  const stats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter(p => ['researching', 'planning', 'writing', 'finalizing'].includes(p.status)).length,
      completed: projects.filter(p => p.status === 'completed').length,
      issues: projects.filter(p => p.status === 'error').length,
    };
  }, [projects]);

  const handleProjectCreated = (newProject: Project) => {
    setProjects(prev => [newProject, ...prev]);
    setShowCreateForm(false);
    toast.success('Project created! Background processing has started.');
  };

  const refreshProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data.projects);
        toast.success('Projects refreshed');
      }
    } catch (error) {
      toast.error('Refresh failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (showCreateForm) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-gradient">Initialize Mission</h2>
            <p className="text-muted-foreground mt-2">Deploy a new agentic content project</p>
          </div>
          <Button variant="outline" onClick={() => setShowCreateForm(false)} className="glass-card border-white/10 hover:bg-white/8 h-12 px-6 rounded-2xl">
            Cancel Mission
          </Button>
        </div>

        <div className="glass-card p-8 rounded-3xl border border-white/5 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-50" />
          <div className="relative z-10">
            <ProjectCreationForm
              onSuccess={handleProjectCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-gradient"
          >
            Mission Control
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-2"
          >
            Orchestrating your AI content agents
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4"
        >
          <Button onClick={refreshProjects} variant="outline" className="glass-card h-12 px-6 border-white/10 hover:bg-white/8 rounded-2xl">
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Sync
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="auth-button h-12 px-8 rounded-2xl hover-lift">
            <Plus className="mr-2 h-5 w-5" />
            New Mission
          </Button>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Missions" value={stats.total} icon={<Activity className="w-5 h-5" />} delay={0.1} />
        <StatCard label="Active Agents" value={stats.active} icon={<Clock className="w-5 h-5" />} color="text-primary" delay={0.2} />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle className="w-5 h-5" />} color="text-green-400" delay={0.3} />
        <StatCard label="System Alerts" value={stats.issues} icon={<AlertCircle className="w-5 h-5" />} color="text-red-400" delay={0.4} />
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Enhanced Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-purple-600/5 opacity-30" />
          
          <div className="relative flex-1 w-full z-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search missions..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-primary/50 hover:bg-white/8 transition-all duration-300"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto relative z-10">
            <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v as any }))}>
              <SelectTrigger className="h-12 w-[160px] glass-card border-white/10 rounded-xl hover:bg-white/8 transition-all duration-300">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="glass-dark border-white/10 rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center glass-card rounded-xl p-1 border border-white/10">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-10 w-10 p-0 rounded-lg transition-all duration-300"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-10 w-10 p-0 rounded-lg transition-all duration-300"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Projects Display */}
        <AnimatePresence mode="popLayout">
          {filteredAndSortedProjects.length > 0 ? (
            <motion.div
              layout
              className={cn(
                "grid gap-6",
                viewMode === 'grid' ? "md:grid-cols-2" : "grid-cols-1"
              )}
            >
              {filteredAndSortedProjects.map((project, idx) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  viewMode={viewMode}
                  idx={idx}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-20 rounded-3xl text-center border border-white/5 relative overflow-hidden"
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-50" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                  <Search className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-gradient">No Missions Found</h3>
                <p className="text-muted-foreground mb-8">Adjust your filters or deploy a new agent</p>
                <Button onClick={() => setShowCreateForm(true)} className="auth-button px-8 rounded-2xl hover-lift">
                  Deploy First Agent
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = "text-muted-foreground", delay }: { label: string, value: number, icon: React.ReactNode, color?: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover-lift"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Icon Background */}
      <div className="absolute top-4 right-4 p-3 rounded-xl bg-white/5 border border-white/10 opacity-20 group-hover:opacity-40 transition-opacity duration-300">
        {icon}
      </div>
      
      <div className="relative z-10">
        <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground/60 mb-3">{label}</p>
        <div className={cn("text-4xl font-bold transition-colors duration-300", color, "group-hover:text-primary")}>{value}</div>
      </div>
    </motion.div>
  );
}

function ProjectCard({ project, viewMode, idx }: { project: Project, viewMode: 'grid' | 'list', idx: number }) {
  const config = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.draft;
  const StatusIcon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.05 }}
      className={cn(
        "glass-dark rounded-3xl border border-white/5 overflow-hidden group transition-all duration-500 relative hover-lift",
        viewMode === 'list' ? "flex items-center p-6 gap-6" : "p-6"
      )}
    >
      {/* Enhanced Background Glow */}
      <div className={cn("absolute inset-0 -z-10 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500", config.glow)} />
      
      {/* Gradient Border Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-purple-600/20 to-pink-500/20 rounded-3xl blur opacity-0 group-hover:opacity-75 transition-opacity duration-500 -z-10" />

      <div className={cn("flex-1 relative z-10", viewMode === 'list' && "flex items-center gap-6")}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-3 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 transition-all duration-300", config.color, "group-hover:scale-110")}>
                <StatusIcon className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-white/10 bg-white/5 hover:bg-white/10 transition-colors duration-300">
                {config.label}
              </Badge>
            </div>
            <h3 className="text-xl font-bold line-clamp-1 group-hover:text-gradient-primary transition-all duration-300 mb-2">
              {project.topic}
            </h3>
            <p className="text-sm text-muted-foreground/80 line-clamp-2">
              Advanced AI content generation with strategic intelligence
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/8 to-white/3 border border-white/10 hover:border-white/20 transition-all duration-300">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tone</p>
            <p className="text-sm font-medium capitalize text-white/90">{project.tone}</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/8 to-white/3 border border-white/10 hover:border-white/20 transition-all duration-300">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Format</p>
            <p className="text-sm font-medium capitalize text-white/90">{project.format.replace('-', ' ')}</p>
          </div>
        </div>

        {['researching', 'planning', 'writing', 'finalizing'].includes(project.status) && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-purple-600/5 border border-white/10">
            <ProjectStatusMonitor projectId={project.id} className="!p-0 !bg-transparent !border-none !shadow-none" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="flex-1 glass-card border-white/10 h-12 rounded-xl group-hover:border-primary/30 hover:bg-white/8 transition-all duration-300">
            <a href={`/project/${project.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Mission Details
            </a>
          </Button>
          {project.status === 'completed' && (
            <Button className="auth-button h-12 px-6 rounded-xl hover-lift">
              <div className="flex items-center gap-2">
                Export
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}