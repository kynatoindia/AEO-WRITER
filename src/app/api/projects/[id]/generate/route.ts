import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { checkQuota } from '@/lib/rate-limiting/quota';
import { APIResponse, ProjectStatus } from '@/lib/types';
import { z } from 'zod';
import { ErrorResponses, createErrorResponse, createValidationErrorResponse, createSuccessResponse } from '@/lib/utils/api-error-handler';

// Request validation schema
const GenerateContentSchema = z.object({
  resumeFromSection: z.string().optional(),
  preferences: z.object({
    includeImages: z.boolean().default(false),
    includeTables: z.boolean().default(true),
    includeCodeBlocks: z.boolean().default(false),
    targetReadingLevel: z.number().min(1).max(10).default(7)
  }).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<APIResponse>> {
  try {
    const { id: projectId } = await params;
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = GenerateContentSchema.parse(body);
    
    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
    
    // Check user quota before starting generation
    const quotaCheck = await checkQuota(user.id, 'free', 'contentGeneration'); // TODO: Get actual plan from DB
    
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Content generation quota exceeded',
          details: {
            currentUsage: quotaCheck.usage,
            limit: quotaCheck.limit
          },
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 429 });
    }
    
    // Fetch project and verify ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied',
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
    // Cast to Project type for TypeScript
    const typedProject = project as any;
    
    // Check if project has research data
    if (!typedProject.research_data) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RESEARCH_REQUIRED',
          message: 'Project research must be completed before content generation',
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Check if project is already being processed
    if (typedProject.status === 'writing') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'GENERATION_IN_PROGRESS',
          message: 'Content generation is already in progress for this project',
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 409 });
    }
    
    // Update project status to indicate generation has started
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'planning',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('user_id', user.id);
    
    if (updateError) {
      console.error('Failed to update project status:', updateError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update project status',
          retryable: true
        },
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    // Trigger content strategy generation workflow
    const eventResult = await inngest.send({
      name: 'content/strategy-generate',
      data: {
        userId: user.id,
        projectId,
        researchData: typedProject.research_data,
        topic: typedProject.topic,
        tone: typedProject.tone,
        format: typedProject.format
      }
    });
    
    // Send real-time update to notify client that generation has started
    await supabase
      .channel(`project:${projectId}`)
      .send({
        type: 'broadcast',
        event: 'generation_started',
        payload: {
          projectId,
          status: 'planning',
          message: 'Content strategy generation started'
        }
      });
    
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: 'planning',
        message: 'Content generation started',
        eventId: eventResult.ids[0],
        estimatedCompletionTime: 300, // 5 minutes estimate
        preferences: validatedData.preferences
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Content generation error:', error);
    
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse(error);
    }
    
    return createErrorResponse(ErrorResponses.INTERNAL_ERROR, 500);
  }
}

// Get content generation progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<APIResponse>> {
  try {
    const { id: projectId } = await params;
    
    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
    
    // Fetch project with sections
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied',
          retryable: false
        },
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
    // Fetch content sections
    const { data: sections, error: sectionsError } = await supabase
      .from('content_sections')
      .select('*')
      .eq('project_id', projectId)
      .order('section_order');
    
    if (sectionsError) {
      console.error('Failed to fetch sections:', sectionsError);
    }
    
    const totalSections = sections?.length || 0;
    const completedSections = sections?.filter(s => s.status === 'completed').length || 0;
    const writingSections = sections?.filter(s => s.status === 'writing').length || 0;
    
    // Calculate progress percentage
    let progress = 0;
    if (totalSections > 0) {
      progress = Math.round((completedSections / totalSections) * 100);
    } else if (project.status === 'planning') {
      progress = 10; // Strategy generation in progress
    }
    
    // Estimate time remaining based on sections left
    const sectionsRemaining = totalSections - completedSections;
    const estimatedTimePerSection = 60; // 1 minute per section
    const estimatedTimeRemaining = sectionsRemaining * estimatedTimePerSection;
    
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: project.status,
        progress,
        totalSections,
        completedSections,
        writingSections,
        sectionsRemaining,
        estimatedTimeRemaining,
        currentSection: sections?.find(s => s.status === 'writing')?.heading,
        blueprint: project.blueprint,
        sections: sections?.map(section => ({
          id: section.id,
          heading: section.heading,
          status: section.status,
          wordCount: section.generated_content?.split(' ').length || 0
        }))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get progress error:', error);
    return createErrorResponse(ErrorResponses.INTERNAL_ERROR, 500);
  }
}