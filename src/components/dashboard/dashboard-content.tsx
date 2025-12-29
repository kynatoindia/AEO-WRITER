'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProjectCreationForm } from '@/components/project/project-creation-form';
import { ProjectStatusTracker } from '@/components/project/project-status-tracker';
import { Plus, FileText, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Project, ProjectStatus } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface DashboardContentProps {
  user: User;
  initialProjects: Project[];
}

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-gray-500' },
  researching: { label: 'Researching', icon: Clock, color: 'bg-blue-500' },
  planning: { label: 'Planning', icon: Clock, color: 'bg-yellow-500' },
  writing: { label: 'Writing', icon: Clock, color: 'bg-green-500' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-emerald-500' },
  error: { label: 'Error', icon: AlertCircle, color: 'bg-red-500' },
};

export function DashboardContent({ user, initialProjects }: DashboardContentProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate project statistics
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => 
    ['researching', 'planning', 'writing'].includes(p.status)
  ).length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      </div>

      {/* Projects List */}
      {projects.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Your Projects</h3>
            <Button 
              variant="outline" 
              onClick={refreshProjects}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-2">
            {projects.map((project) => {
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
                    {['researching', 'planning', 'writing'].includes(project.status) && (
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