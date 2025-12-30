import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/validations/project';
import { APIResponse, Project } from '@/lib/types';
import { transformDatabaseRowToProject } from '@/lib/utils/type-transformers';

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<{ project: Project }>>> {
  console.log('POST /api/projects/minimal called');
  
  try {
    const supabase = await createServerSupabaseClient();
    console.log('Supabase client created');
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth check result:', { user: !!user, error: !!authError });
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
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

    // Parse form data for file upload support
    console.log('Parsing form data...');
    const formData = await request.formData();
    const projectData = {
      topic: formData.get('topic') as string,
      competitorUrls: JSON.parse(formData.get('competitorUrls') as string || '[]'),
      tone: formData.get('tone') as string,
      format: formData.get('format') as string,
    };
    
    console.log('Project data parsed:', {
      topic: projectData.topic?.substring(0, 50) + '...',
      competitorUrlsCount: projectData.competitorUrls?.length,
      tone: projectData.tone,
      format: projectData.format
    });
    
    const brandDocumentFile = formData.get('brandDocument') as File | null;
    console.log('Brand document:', { hasFile: !!brandDocumentFile, size: brandDocumentFile?.size });

    // Prepare validation data - only include brandDocument if it's a valid file
    const validationData: any = { ...projectData };
    if (brandDocumentFile && brandDocumentFile.size > 0) {
      validationData.brandDocument = brandDocumentFile;
    }

    console.log('Validating project data...');
    // Validate project data
    const validationResult = createProjectSchema.safeParse(validationData);

    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.issues);
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project data',
          details: {
            validationErrors: validationResult.error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code
            }))
          },
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    console.log('Validation passed, creating project...');

    // Create project record in database (minimal version - no file upload, no quota check, no background jobs)
    const { data: project, error: dbError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        topic: validationResult.data.topic,
        competitor_urls: validationResult.data.competitorUrls,
        tone: validationResult.data.tone as any,
        format: validationResult.data.format as any,
        brand_document_path: null, // Skip file upload for now
        status: 'draft',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create project',
          details: { error: dbError.message },
          retryable: true,
        },
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Convert database row to Project type safely
    const typedProject = transformDatabaseRowToProject(project);
    console.log('Project created successfully:', typedProject.id);

    // Return minimal success response
    const response = {
      success: true,
      data: {
        project: typedProject,
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log('Sending success response');
    return NextResponse.json(response, { status: 201 });

  } catch (error: any) {
    console.error('Minimal project creation error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: { error: error.message, stack: error.stack },
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}