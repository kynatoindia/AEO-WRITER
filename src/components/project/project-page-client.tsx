'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LiveWriter } from '@/components/writer/live-writer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  User,
  ExternalLink,
  Globe,
  FileUp,
  Clock,
  Target,
  BarChart3,
  Download,
  Edit,
  Trash2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { Project } from '@/lib/types';

interface ProjectPageClientProps {
  project: Project;
}

export function ProjectPageClient({ project: initialProject }: ProjectPageClientProps) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [isStartingResearch, setIsStartingResearch] = useState(false);
  
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': 
        return { color: 'bg-green-100 text-green-800', icon: FileText, description: 'Content generation completed' };
      case 'writing': 
        return { color: 'bg-blue-100 text-blue-800', icon: Clock, description: 'AI is writing content' };
      case 'finalizing': 
        return { color: 'bg-purple-100 text-purple-800', icon: Clock, description: 'Finalizing and polishing content' };
      case 'planning': 
        return { color: 'bg-yellow-100 text-yellow-800', icon: Target, description: 'Creating content blueprint' };
      case 'researching': 
        return { color: 'bg-indigo-100 text-indigo-800', icon: BarChart3, description: 'Analyzing competitors and research' };
      case 'error': 
        return { color: 'bg-red-100 text-red-800', icon: ExternalLink, description: 'Error occurred during processing' };
      default: 
        return { color: 'bg-gray-100 text-gray-800', icon: FileText, description: 'Project created, ready to start' };
    }
  };
  
  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const startResearch = async () => {
    setIsStartingResearch(true);
    
    try {
      const requestBody: any = {
        competitorUrls: project.competitor_urls,
      };
      
      // Only include brandDocument if it exists
      if (project.brand_document_path) {
        requestBody.brandDocument = project.brand_document_path;
      }
      
      console.log('Starting research with data:', requestBody);
      
      const response = await fetch(`/api/projects/${project.id}/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Research API response status:', response.status);
      
      const result = await response.json();
      console.log('Research API result:', result);

      if (!response.ok || !result.success) {
        console.error('Research API error:', result);
        throw new Error(result.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Update project status
      setProject(prev => ({ ...prev, status: 'researching' }));
      
      toast.success('Research started successfully!');
      toast.info(`Analyzing ${project.competitor_urls.length} competitor URLs...`);
      
      // Refresh the page to show the updated status
      router.refresh();
      
    } catch (error: any) {
      console.error('Failed to start research:', error);
      toast.error(error.message || 'Failed to start research');
    } finally {
      setIsStartingResearch(false);
    }
  };

  const retryProcessing = async () => {
    // For retry, we'll use the same research endpoint
    await startResearch();
  };

  const updateProjectStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/projects/${project.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to update status');
      }

      // Update local project state
      setProject(prev => ({ ...prev, status: newStatus as any }));
      toast.success(`Project status updated to ${newStatus}`);
      
      // Refresh the page to show updated UI
      router.refresh();
      
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };
  
  const handleComplete = async (content: string) => {
    console.log('Content generation completed');
  };
  
  const handleError = async (error: string) => {
    console.error('Content generation error:', error);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Project Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-6">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StatusIcon className="h-6 w-6 text-muted-foreground" />
                    <h1 className="text-2xl font-bold">{project.topic}</h1>
                    <Badge className={statusConfig.color}>
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{statusConfig.description}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {project.status === 'completed' && (
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  
                  {/* Temporary testing buttons */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="flex items-center gap-1 ml-4 border-l pl-4">
                      <span className="text-xs text-muted-foreground">Test:</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-7 px-2"
                        onClick={() => updateProjectStatus('planning')}
                      >
                        →Planning
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-7 px-2"
                        onClick={() => updateProjectStatus('writing')}
                      >
                        →Writing
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Project Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    Created
                  </div>
                  <p className="font-medium">{formatDate(project.created_at)}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Last Updated
                  </div>
                  <p className="font-medium">{formatDate(project.updated_at)}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    Tone & Format
                  </div>
                  <p className="font-medium capitalize">
                    {project.tone} • {project.format.replace('-', ' ')}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Globe className="h-4 w-4" />
                    Competitors
                  </div>
                  <p className="font-medium">{project.competitor_urls.length} URLs</p>
                </div>
              </div>
              
              {/* Additional Project Details */}
              {(project.brand_document_path || project.competitor_urls.length > 0) && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    {project.brand_document_path && (
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <FileUp className="h-4 w-4" />
                          Brand Document
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">PDF Uploaded</Badge>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            View Document
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {project.competitor_urls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Globe className="h-4 w-4" />
                          Competitor URLs ({project.competitor_urls.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {project.competitor_urls.slice(0, 3).map((url, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {new URL(url).hostname}
                            </Badge>
                          ))}
                          {project.competitor_urls.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{project.competitor_urls.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-6 h-[calc(100vh-200px)]">
        {project.status === 'draft' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
              <CardTitle className="mb-4 text-xl">Ready to Start</CardTitle>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Your project has been created successfully. Click the button below to begin 
                the research phase, where we'll analyze your competitors and create a content strategy.
              </p>
              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={startResearch}
                  disabled={isStartingResearch}
                >
                  {isStartingResearch ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Research...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Start Research & Planning
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  This will analyze {project.competitor_urls.length} competitor URLs
                  {project.brand_document_path && ' and your brand document'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : project.status === 'researching' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <BarChart3 className="h-16 w-16 mx-auto mb-6 text-indigo-500 animate-pulse" />
              <CardTitle className="mb-4 text-xl">Research in Progress</CardTitle>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We're analyzing your competitor URLs and gathering insights to create 
                a comprehensive content strategy. This usually takes 2-5 minutes.
              </p>
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Analyzing {project.competitor_urls.length} competitor URLs...
                </p>
                
                {/* Development mode: Show manual progress button */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Development Mode:</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateProjectStatus('planning')}
                      className="text-xs"
                    >
                      Skip to Planning Phase →
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : project.status === 'planning' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <Target className="h-16 w-16 mx-auto mb-6 text-yellow-500 animate-pulse" />
              <CardTitle className="mb-4 text-xl">Creating Content Blueprint</CardTitle>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Based on the research, we're creating a detailed content blueprint 
                with sections, key points, and writing strategy.
              </p>
              <div className="space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full animate-pulse" style={{ width: '80%' }}></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Generating content outline...
                </p>
                
                {/* Development mode: Show manual progress button */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Development Mode:</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateProjectStatus('writing')}
                      className="text-xs"
                    >
                      Skip to Writing Phase →
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : project.status === 'error' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <ExternalLink className="h-16 w-16 mx-auto mb-6 text-red-500" />
              <CardTitle className="mb-4 text-xl text-red-600">Processing Error</CardTitle>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                An error occurred while processing your project. This could be due to 
                network issues, API limits, or invalid competitor URLs.
              </p>
              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={retryProcessing}
                  disabled={isStartingResearch}
                >
                  {isStartingResearch ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Processing
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  View Error Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Show LiveWriter for 'writing', 'finalizing', 'completed' statuses
          <LiveWriter
            projectId={project.id}
            onComplete={handleComplete}
            onError={handleError}
          />
        )}
      </div>
    </div>
  );
}