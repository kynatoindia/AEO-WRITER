import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { checkQuota, incrementUsage } from '@/lib/rate-limiting/quota';
import { APIError } from '@/lib/constants/errors';
import { z } from 'zod';

// Request validation schema
const FinalizeRequestSchema = z.object({
  force: z.boolean().optional().default(false), // Force finalization even if already completed
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    
    // Validate request body
    const body = await request.json().catch(() => ({}));
    const { force } = FinalizeRequestSchema.parse(body);
    
    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required' 
          } 
        },
        { status: 401 }
      );
    }
    
    // Check user quota for finalization operations
    const quotaCheck = await checkQuota(user.id, 'free', 'contentGeneration'); // Get actual plan from DB
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: 'Content finalization quota exceeded',
            details: {
              usage: quotaCheck.usage,
              limit: quotaCheck.limit,
              resetDate: quotaCheck.resetDate
            }
          }
        },
        { status: 429 }
      );
    }
    
    // Get project and validate ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found or access denied'
          }
        },
        { status: 404 }
      );
    }
    
    // Validate project state
    if (!project.generated_content) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_CONTENT_TO_FINALIZE',
            message: 'Project has no content to finalize. Complete content generation first.'
          }
        },
        { status: 400 }
      );
    }
    
    if (!project.blueprint) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_BLUEPRINT_AVAILABLE',
            message: 'Project blueprint is required for finalization'
          }
        },
        { status: 400 }
      );
    }
    
    // Check if already finalized (unless force is true)
    if (project.status === 'completed' && !force) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_FINALIZED',
            message: 'Project is already finalized. Use force=true to re-finalize.'
          }
        },
        { status: 400 }
      );
    }
    
    // Check if currently being finalized
    if (project.status === 'finalizing') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FINALIZATION_IN_PROGRESS',
            message: 'Project finalization is already in progress'
          }
        },
        { status: 409 }
      );
    }
    
    // Trigger manual finalization workflow
    const eventData = {
      name: 'content/manual-finalize' as const,
      data: {
        userId: user.id,
        projectId: projectId,
      }
    };
    
    const { ids } = await inngest.send(eventData);
    
    // Increment usage quota
    await incrementUsage(user.id, 'contentGeneration');
    
    // Log the finalization request
    await supabase
      .from('usage_analytics')
      .insert({
        user_id: user.id,
        project_id: projectId,
        operation_type: 'finalization',
        api_provider: 'inngest',
        model_used: 'finalization-pipeline',
        metadata: {
          force,
          eventId: ids[0],
          contentLength: project.generated_content?.length || 0,
          hasBlueprint: !!project.blueprint
        }
      });
    
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        eventId: ids[0],
        status: 'finalization_queued',
        message: 'Content finalization has been queued and will complete shortly',
        estimatedCompletionTime: '2-5 minutes',
        currentStatus: project.status,
        contentLength: project.generated_content?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Finalization API error:', error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }
    
    // Handle Inngest errors
    if (error instanceof Error && error.message.includes('Inngest')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKFLOW_ERROR',
            message: 'Failed to queue finalization workflow',
            details: { originalError: error.message }
          }
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred during finalization',
          details: process.env.NODE_ENV === 'development' ? { error: error instanceof Error ? error.message : 'Unknown error' } : undefined
        }
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check finalization status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    
    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required' 
          } 
        },
        { status: 401 }
      );
    }
    
    // Get project finalization status
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, generated_content, seo_metadata, updated_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found or access denied'
          }
        },
        { status: 404 }
      );
    }
    
    // Calculate finalization metrics
    const hasContent = !!project.generated_content;
    const hasEnhancedSEO = project.seo_metadata && 
      typeof project.seo_metadata === 'object' && 
      'faqData' in project.seo_metadata;
    
    const wordCount = project.generated_content ? 
      project.generated_content.split(' ').length : 0;
    
    const faqCount = hasEnhancedSEO && project.seo_metadata.faqData ? 
      project.seo_metadata.faqData.length : 0;
    
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: project.status,
        hasContent,
        isFinalized: project.status === 'completed',
        isFinalizationInProgress: project.status === 'finalizing',
        canFinalize: hasContent && project.status !== 'finalizing',
        lastUpdated: project.updated_at,
        metrics: {
          wordCount,
          hasEnhancedSEO,
          faqCount,
          seoScore: hasEnhancedSEO && project.seo_metadata.seoScore ? 
            project.seo_metadata.seoScore : null,
          readabilityScore: hasEnhancedSEO && project.seo_metadata.readabilityScore ? 
            project.seo_metadata.readabilityScore : null
        }
      }
    });
    
  } catch (error) {
    console.error('Finalization status API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get finalization status',
          details: process.env.NODE_ENV === 'development' ? { error: error instanceof Error ? error.message : 'Unknown error' } : undefined
        }
      },
      { status: 500 }
    );
  }
}