import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { APIResponse } from '@/lib/types';

/**
 * PATCH /api/projects/[id]/status
 * Manually update project status for testing purposes
 */
export async function PATCH(
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
    
    const body = await request.json();
    const { status } = body;
    
    // Validate status
    const validStatuses = ['draft', 'researching', 'planning', 'writing', 'finalizing', 'completed', 'error'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
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

    // Update project status
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project status:', updateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update project status',
          retryable: true,
        },
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        oldStatus: project.status,
        newStatus: status,
        message: `Project status updated from ${project.status} to ${status}`,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Status update failed:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update project status',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}