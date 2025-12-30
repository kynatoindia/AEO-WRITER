'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectCreationForm } from '@/components/project/project-creation-form';
import { ProjectStatusTracker } from '@/components/project/project-status-tracker';
import { Plus, FileText, Clock, CheckCircle, AlertCircle, ExternalLink, Search, Filter, SortAsc, SortDesc, RefreshCw } from 'lucide-react';
import { Project, ProjectStatus, ContentTone, ContentFormat } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';

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
  draft: { label: 'Draft', icon: FileText, color: 'bg-gray-500' },
  researching: { label: 'Researching', icon: Clock, color: 'bg-blue-500' },
  planning: { label: 'Planning', icon: Clock, color: 'bg-yellow-500' },
  writing: { label: 'Writing', icon: Clock, color: 'bg-green-500' },
  finalizing: { label: 'Finalizing', icon: Clock, color: 'bg-purple-500' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-emerald-500' },
  error: { label: 'Error', icon: AlertCircle, color: 'bg-red-500' },
};

export function DashboardContent({ user, initialProjects }: DashboardContentProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>({
    search: '',
    status: 'all',
    tone: 'all',
    format: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  // Set up real-time subscriptions for project updates
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Subscribe to project changes for this user
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
          console.log('Real-time project update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newProject = payload.new as Project;
            setProjects(prev => [newProject, ...prev]);
            toast.success(`New project "${newProject.topic}" created`);
          } else if (payload.eventType === 'UPDATE') {
            const updatedProject = payload.new as Project;
            setProjects(prev => prev.map(project => 
              project.id === updatedProject.id ? updatedProject : project
            ));
            
            // Show status change notifications
            const oldProject = payload.old as Project;
            if (oldProject.status !== updatedProject.status) {
              toast.success(`Project "${updatedProject.topic}" status changed to ${updatedProject.status}`);
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedProject = payload.old as Project;
            setProjects(prev => prev.filter(project => project.id !== deletedProject.id));
            toast.success(`Project "${deletedProject.topic}" deleted`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // Filter and sort projects based on current filters
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(project =>
        project.topic.toLowerCase().includes(searchLower) ||
        project.competitor_urls.some(url => url.toLowerCase().includes(searchLower))
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(project => project.status === filters.status);
    }

    // Apply tone filter
    if (filters.tone !== 'all') {
      filtered = filtered.filter(project => project.tone === filters.tone);
    }

    // Apply format filter
    if (filters.format !== 'all') {
      filtered = filtered.filter(project => project.format === filters.format);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      switch (filters.sortBy) {
        case 'topic':
          aValue = a.topic.toLowerCase();
          bValue = b.topic.toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
      }

      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [projects, filters]);

  // Calculate project statistics
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => 
    ['researching', 'planning', 'writing', 'finalizing'].includes(p.status)
  ).length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const errorProjects = projects.filter(p => p.status === 'error').length;

  const handleProjectCreated = (newProject: Project) => {
    setProjects(prev => [newProject, ...prev]);
    setShowCreateForm(false);
    toast.success('Project created! Background processing has started.');
  };

  const handleProjectStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, status: newStatus, updated_at: new Date().toISOString() }
        : project
    ));
  };

  const refreshProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      
      if (result.success) {
        setProjects(result.data.projects);
        toast.success('Projects refreshed successfully');
      } else {
        toast.error('Failed to refresh projects');
      }
    } catch (error) {
      console.error('Error refreshing projects:', error);
      toast.error('Failed to refresh projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ProjectFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      tone: 'all',
      format: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  };

  const toggleSortOrder = () => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Create New Project</h2>
            <p className="text-gray-600 mt-2">
              Start creating SEO-optimized content with AI-powered research and writing
            </p>
          </div>
        </div>
        
        <ProjectCreationForm
          onSuccess={handleProjectCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-2">
            Welcome back! Here's an overview of your content projects.
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Projects</CardTitle>
            <CardDescription>All your content projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalProjects}</div>
            <p className="text-sm text-muted-foreground">
              {totalProjects === 0 ? 'No projects yet' : `${totalProjects} project${totalProjects !== 1 ? 's' : ''}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
            <CardDescription>Currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeProjects}</div>
            <p className="text-sm text-muted-foreground">
              {activeProjects === 0 ? 'No active projects' : 'In progress'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Projects</CardTitle>
            <CardDescription>Successfully finished</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedProjects}</div>
            <p className="text-sm text-muted-foreground">
              {completedProjects === 0 ? 'No completed projects' : 'Ready to export'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issues</CardTitle>
            <CardDescription>Projects with errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{errorProjects}</div>
            <p className="text-sm text-muted-foreground">
              {errorProjects === 0 ? 'No issues' : 'Need attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters & Search
            </CardTitle>
            <CardDescription>
              Filter and search your projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search projects by topic or competitor URL..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Controls */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="researching">Researching</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="writing">Writing</SelectItem>
                    <SelectItem value="finalizing">Finalizing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tone</label>
                <Select value={filters.tone} onValueChange={(value) => handleFilterChange('tone', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tones</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="witty">Witty</SelectItem>
                    <SelectItem value="data-driven">Data-Driven</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Format</label>
                <Select value={filters.format} onValueChange={(value) => handleFilterChange('format', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All formats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Formats</SelectItem>
                    <SelectItem value="how-to">How-to Guide</SelectItem>
                    <SelectItem value="listicle">Listicle</SelectItem>
                    <SelectItem value="case-study">Case Study</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <div className="flex gap-2">
                  <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Created Date</SelectItem>
                      <SelectItem value="updated_at">Updated Date</SelectItem>
                      <SelectItem value="topic">Topic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSortOrder}
                    className="px-3"
                  >
                    {filters.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
              <div className="flex-1" />
              <Badge variant="secondary">
                {filteredAndSortedProjects.length} of {totalProjects} projects
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      {projects.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Your Projects</h3>
            <Button 
              variant="outline" 
              onClick={refreshProjects}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          
          {filteredAndSortedProjects.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects match your filters</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filteredAndSortedProjects.map((project) => {
                const config = statusConfig[project.status];
                const Icon = config.icon;
                
                return (
                  <Card key={project.id} className="relative">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-2">
                            {project.topic}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Created {formatDate(project.created_at)}
                            {project.updated_at !== project.created_at && (
                              <span className="text-xs text-gray-400 ml-2">
                                • Updated {formatDate(project.updated_at)}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className={`p-1.5 rounded-full ${config.color}`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Project Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Tone:</span>
                          <p className="font-medium capitalize">{project.tone}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Format:</span>
                          <p className="font-medium capitalize">{project.format.replace('-', ' ')}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Competitors:</span>
                          <p className="font-medium">{project.competitor_urls.length} URLs</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Brand Doc:</span>
                          <p className="font-medium">{project.brand_document_path ? 'Yes' : 'No'}</p>
                        </div>
                      </div>

                      {/* Real-time Status Tracker for Active Projects */}
                      {['researching', 'planning', 'writing', 'finalizing'].includes(project.status) && (
                        <ProjectStatusTracker
                          projectId={project.id}
                          userId={user.id}
                          initialStatus={project.status}
                          onStatusChange={(newStatus) => handleProjectStatusChange(project.id, newStatus)}
                        />
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <a href={`/project/${project.id}`}>
                            <ExternalLink className="mr-2 h-3 w-3" />
                            View Project
                          </a>
                        </Button>
                        
                        {project.status === 'completed' && (
                          <Button size="sm" className="flex-1">
                            Export Content
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Create your first AI-powered SEO content project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Welcome to AEO Writer Pro! Create your first project to start generating 
                high-quality, SEO-optimized content using AI-powered research and writing.
              </p>
              <Button onClick={() => setShowCreateForm(true)} size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            </div>
            
            <div className="mt-8 pt-8 border-t">
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  <strong>User ID:</strong> {user.id}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Email:</strong> {user.email}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Email Verified:</strong> {user.email_confirmed_at ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}