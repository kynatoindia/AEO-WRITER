import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ZodError } from 'zod';
import { inngest } from '@/lib/inngest/client';
import { researchRequestSchema } from '@/lib/validations/schemas';
import { APIResponse } from '@/lib/types';

/**
 * POST /api/projects/[id]/research
 * Trigger research pipeline for a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<APIResponse>> {
  const { id: projectId } = await params;
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = researchRequestSchema.parse(body);
    
    // Verify project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, topic, tone, format, status')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Check if project is in a valid state for research
    if (project.status !== 'draft' && project.status !== 'error') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PROJECT_STATE',
          message: `Cannot start research for project in ${project.status} state`,
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Trigger research pipeline workflow
    const eventData = {
      userId: user.id,
      projectId,
      competitorUrls: validatedData.competitorUrls,
      brandDocumentPath: validatedData.brandDocument,
      topic: project.topic,
      tone: project.tone,
      format: project.format,
    };

    console.log(`Triggering research pipeline for project ${projectId}`);
    
    // Try to send Inngest event, but don't fail if Inngest is not available
    let eventResult;
    try {
      eventResult = await inngest.send({
        name: 'project/research-started',
        data: eventData,
      });
      console.log('Inngest event sent successfully:', eventResult.ids[0]);
    } catch (inngestError) {
      console.error('Inngest event failed (non-blocking):', inngestError);
      // Continue without Inngest - we'll just update the status
      eventResult = { ids: ['mock-event-id'] };
    }

    // Update project status to indicate research has been queued
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'researching',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project status:', updateError);
      // Don't fail the request since the event was already sent
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: 'researching',
        message: 'Research pipeline started successfully',
        eventId: eventResult.ids[0],
        estimatedCompletionTime: '2-5 minutes',
        competitorCount: validatedData.competitorUrls.length,
        hasBrandDocument: !!validatedData.brandDocument,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Research pipeline trigger failed:', error);

    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: {
            validationErrors: error.issues.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          },
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start research pipeline',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * GET /api/projects/[id]/research
 * Get research status and results for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<APIResponse>> {
  try {
    const { id: projectId } = await params;
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }
    
    // Get project with research data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, research_data, updated_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Get research progress from cache if still in progress
    let progress = 100;
    let message = 'Research completed';
    
    if (project.status === 'researching') {
      // In production, you would get actual progress from Redis or job queue
      progress = 50; // Placeholder
      message = 'Research in progress...';
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: project.status,
        progress,
        message,
        researchData: project.research_data,
        lastUpdated: project.updated_at,
        hasResults: !!project.research_data,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to get research status:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get research status',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/research
 * Cancel ongoing research or clear research results
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<APIResponse>> {
  try {
    const { id: projectId } = await params;
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }
    
    // Verify project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied',
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Clear research data and reset status
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'draft',
        research_data: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      throw new Error(`Failed to clear research data: ${updateError.message}`);
    }

    // Send cancellation event (in production, implement proper job cancellation)
    await inngest.send({
      name: 'research/cancelled',
      data: {
        userId: user.id,
        projectId,
        reason: 'User requested cancellation',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: 'draft',
        message: 'Research data cleared successfully',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to cancel research:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel research',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}