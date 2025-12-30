import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createRouteClient } from '@/lib/supabase/server';
import { LiveWriter } from '@/components/writer/live-writer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Project } from '@/lib/types';

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Loading component for the project page
function ProjectPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1">
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6 h-[calc(100vh-120px)]">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}

// Main project content component
async function ProjectContent({ projectId }: { projectId: string }) {
  const supabase = await createRouteClient();
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/auth/login');
  }
  
  // Fetch project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();
  
  if (projectError || !project) {
    notFound();
  }
  
  const typedProject = project as Project;
  
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
  
  const statusConfig = getStatusConfig(typedProject.status);
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
                    <h1 className="text-2xl font-bold">{typedProject.topic}</h1>
                    <Badge className={statusConfig.color}>
                      {typedProject.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{statusConfig.description}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  {typedProject.status === 'completed' && (
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
                </div>
              </div>
              
              {/* Project Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    Created
                  </div>
                  <p className="font-medium">{formatDate(typedProject.created_at)}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Last Updated
                  </div>
                  <p className="font-medium">{formatDate(typedProject.updated_at)}</p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    Tone & Format
                  </div>
                  <p className="font-medium capitalize">
                    {typedProject.tone} • {typedProject.format.replace('-', ' ')}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Globe className="h-4 w-4" />
                    Competitors
                  </div>
                  <p className="font-medium">{typedProject.competitor_urls.length} URLs</p>
                </div>
              </div>
              
              {/* Additional Project Details */}
              {(typedProject.brand_document_path || typedProject.competitor_urls.length > 0) && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    {typedProject.brand_document_path && (
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
                    
                    {typedProject.competitor_urls.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Globe className="h-4 w-4" />
                          Competitor URLs ({typedProject.competitor_urls.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {typedProject.competitor_urls.slice(0, 3).map((url, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {new URL(url).hostname}
                            </Badge>
                          ))}
                          {typedProject.competitor_urls.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{typedProject.competitor_urls.length - 3} more
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
        {typedProject.status === 'draft' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
              <CardTitle className="mb-4 text-xl">Ready to Start</CardTitle>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Your project has been created successfully. Click the button below to begin 
                the research phase, where we'll analyze your competitors and create a content strategy.
              </p>
              <div className="space-y-3">
                <Button size="lg" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Start Research & Planning
                </Button>
                <p className="text-xs text-muted-foreground">
                  This will analyze {typedProject.competitor_urls.length} competitor URLs
                  {typedProject.brand_document_path && ' and your brand document'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : typedProject.status === 'error' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center max-w-md">
              <ExternalLink className="h-16 w-16 mx-auto mb-6 text-red-500" />
              <CardTitle className="mb-4 text-xl text-red-600">Processing Error</CardTitle>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                An error occurred while processing your project. This could be due to 
                network issues, API limits, or invalid competitor URLs.
              </p>
              <div className="space-y-3">
                <Button size="lg" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Processing
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  View Error Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <LiveWriter
            projectId={projectId}
            onComplete={handleComplete}
            onError={handleError}
          />
        )}
      </div>
    </div>
  );
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  
  return (
    <Suspense fallback={<ProjectPageSkeleton />}>
      <ProjectContent projectId={id} />
    </Suspense>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createRouteClient();
  
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('topic')
      .eq('id', id)
      .single();
    
    return {
      title: project?.topic ? `${project.topic} - AEO Writer` : 'Project - AEO Writer',
      description: 'AI-powered content generation in real-time'
    };
  } catch {
    return {
      title: 'Project - AEO Writer',
      description: 'AI-powered content generation in real-time'
    };
  }
}