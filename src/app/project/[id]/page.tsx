import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createRouteClient } from '@/lib/supabase/server';
import { ProjectPageClient } from '@/components/project/project-page-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Project } from '@/lib/types';

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Loading component for the project page
function ProjectPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border glass-card">
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

  const typedProject = project as unknown as Project;

  return <ProjectPageClient project={typedProject} />;
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