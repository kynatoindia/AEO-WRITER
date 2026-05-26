import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { checkQuota } from '@/lib/rate-limiting/quota';
import { APIResponse } from '@/lib/types';
import { z } from 'zod';
import { ErrorResponses, createErrorResponse, createValidationErrorResponse } from '@/lib/utils/api-error-handler';

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

type ProjectForGeneration = {
  status: string;
  research_data: unknown;
  topic: string;
  tone: string;
  format: string;
};

type SectionProgressRow = {
  id: string;
  heading: string;
  status: 'pending' | 'writing' | 'completed';
  generated_content: string | null;
};

type BlueprintSectionLike = {
  id: string;
  heading: string;
};

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
    const typedProject = project as ProjectForGeneration;
    
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
    
    // Fetch content sections (handle missing table gracefully)
    let sections: SectionProgressRow[] = [];
    let sectionsErrorMessage = '';
    
    try {
      const { data: sectionsData, error: sectionsErr } = await supabase
        .from('content_sections')
        .select('*')
        .eq('project_id', projectId)
        .order('section_order');
      
      sections = (sectionsData as SectionProgressRow[]) || [];
      sectionsErrorMessage = sectionsErr?.message || '';
    } catch (error) {
      console.error('Failed to fetch sections:', error);
      sectionsErrorMessage = error instanceof Error ? error.message : '';
      // Continue with empty sections array for development
    }
    
    if (sectionsErrorMessage && !sectionsErrorMessage.includes('content_sections')) {
      console.error('Failed to fetch sections:', sectionsErrorMessage);
    }
    
    const totalSections = sections?.length || 0;
    
    // For development: Create mock sections if none exist and project is in writing status
    let mockSections: SectionProgressRow[] = [];
    if (totalSections === 0 && project.status === 'writing') {
      mockSections = [
        { id: 'mock-1', heading: 'Introduction', status: 'pending', generated_content: '' },
        { id: 'mock-2', heading: 'Main Content', status: 'pending', generated_content: '' },
        { id: 'mock-3', heading: 'Key Benefits', status: 'pending', generated_content: '' },
        { id: 'mock-4', heading: 'Conclusion', status: 'pending', generated_content: '' },
      ];
      
      // For testing: Make first section "writing" to show progress
      if (process.env.NODE_ENV === 'development') {
        mockSections[0].status = 'writing';
      }
    }
    
    const effectiveSections = sections?.length > 0 ? sections : mockSections;
    const effectiveTotalSections = effectiveSections.length;
    const effectiveCompletedSections = effectiveSections.filter(s => s.status === 'completed').length;
    const effectiveWritingSections = effectiveSections.filter(s => s.status === 'writing').length;

    const blueprintSections = (() => {
      const raw = project.blueprint as { sections?: unknown } | null;
      if (!raw || !Array.isArray(raw.sections)) return [];
      return raw.sections
        .filter((section): section is BlueprintSectionLike => {
          if (!section || typeof section !== 'object') return false;
          const candidate = section as Record<string, unknown>;
          return typeof candidate.id === 'string' && typeof candidate.heading === 'string';
        });
    })();
    const sectionIdByHeading = new Map(blueprintSections.map(section => [section.heading, section.id]));
    
    // Calculate progress percentage
    let progress = 0;
    if (effectiveTotalSections > 0) {
      progress = Math.round((effectiveCompletedSections / effectiveTotalSections) * 100);
    } else if (project.status === 'completed') {
      progress = 100;
    } else if (project.status === 'writing') {
      progress = 70;
    } else if (project.status === 'planning') {
      progress = 20; // Strategy generation in progress
    }
    
    // Estimate time remaining based on sections left
    const sectionsRemaining = effectiveTotalSections - effectiveCompletedSections;
    const estimatedTimePerSection = 60; // 1 minute per section
    const estimatedTimeRemaining = sectionsRemaining * estimatedTimePerSection;
    
    return NextResponse.json({
      success: true,
      data: {
        projectId,
        status: project.status,
        statusMessage: project.status_message ?? null,
        progress,
        totalSections: effectiveTotalSections,
        completedSections: effectiveCompletedSections,
        writingSections: effectiveWritingSections,
        sectionsRemaining,
        estimatedTimeRemaining,
        currentSection: effectiveSections?.find(s => s.status === 'writing')?.heading,
        blueprint: project.blueprint,
        finalContent: project.generated_content ?? null,
        seoMetadata: project.seo_metadata ?? null,
        sections: effectiveSections?.map(section => ({
          id: sectionIdByHeading.get(section.heading) ?? section.id,
          heading: section.heading,
          status: section.status,
          wordCount: section.generated_content?.split(' ').length || 0,
          content: section.generated_content || ''
        }))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get progress error:', error);
    return createErrorResponse(ErrorResponses.INTERNAL_ERROR, 500);
  }
}
