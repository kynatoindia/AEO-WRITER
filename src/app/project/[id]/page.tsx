import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createRouteClient } from '@/lib/supabase/server';
import { LiveWriter } from '@/components/writer/live-writer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  User,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

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
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'writing': return 'bg-blue-100 text-blue-800';
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'researching': return 'bg-purple-100 text-purple-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleComplete = async (content: string) => {
    // Content completion is handled by the LiveWriter component
    // This could trigger additional actions like notifications
    console.log('Content generation completed');
  };
  
  const handleError = async (error: string) => {
    // Error handling is managed by the LiveWriter component
    console.error('Content generation error:', error);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">{project.topic}</h1>
                <Badge className={getStatusColor(project.status)}>
                  {project.status}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created {new Date(project.created_at).toLocaleDateString()}
                </div>
                
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {project.tone} tone
                </div>
                
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {project.format} format
                </div>
              </div>
            </div>
            
            {project.status === 'completed' && (
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Export Content
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-6 h-[calc(100vh-120px)]">
        {project.status === 'draft' ? (
          <Card className="h-full flex items-center justify-center">
            <CardContent className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle className="mb-2">Project Not Started</CardTitle>
              <p className="text-muted-foreground mb-4">
                This project needs research data before content generation can begin.
              </p>
              <Button asChild>
                <Link href={`/project/${projectId}/research`}>
                  Start Research
                </Link>
              </Button>
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