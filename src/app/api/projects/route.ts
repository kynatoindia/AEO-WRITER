import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/validations/project';
import { inngest } from '@/lib/inngest/client';
import { checkQuota } from '@/lib/rate-limiting/quota';
import { APIResponse, Project } from '@/lib/types';
import { transformDatabaseRowToProject } from '@/lib/utils/type-transformers';
import { z } from 'zod';

// File upload validation schema
const fileUploadSchema = z.object({
  name: z.string(),
  type: z.string().refine(type => type === 'application/pdf', 'Only PDF files are allowed'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
});

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<{ project: Project; uploadUrl?: string }>>> {
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

    // Parse form data for file upload support
    const formData = await request.formData();
    const projectData = {
      topic: formData.get('topic') as string,
      competitorUrls: JSON.parse(formData.get('competitorUrls') as string || '[]'),
      tone: formData.get('tone') as string,
      format: formData.get('format') as string,
    };
    
    const brandDocumentFile = formData.get('brandDocument') as File | null;

    // Validate project data
    const validationResult = createProjectSchema.safeParse({
      ...projectData,
      brandDocument: brandDocumentFile,
    });

    if (!validationResult.success) {
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

    // Check user quota before creating project
    const quotaCheck = await checkQuota(user.id, 'free', 'projects'); // TODO: Get actual plan from user profile
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Project creation quota exceeded',
          details: { current: quotaCheck.usage, limit: quotaCheck.limit },
          retryable: false,
        },
        timestamp: new Date().toISOString(),
      }, { status: 429 });
    }

    // Handle file upload if provided
    let brandDocumentPath: string | undefined;
    let uploadUrl: string | undefined;
    
    if (brandDocumentFile) {
      // Validate file
      const fileValidation = fileUploadSchema.safeParse({
        name: brandDocumentFile.name,
        type: brandDocumentFile.type,
        size: brandDocumentFile.size,
      });

      if (!fileValidation.success) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'FILE_VALIDATION_ERROR',
            message: 'Invalid file upload',
            details: {
              validationErrors: fileValidation.error.issues.map(issue => ({
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

      // Generate secure file path
      const fileExtension = brandDocumentFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
      brandDocumentPath = `brand-documents/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('brand-documents')
        .upload(brandDocumentPath, brandDocumentFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('File upload error:', uploadError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'FILE_UPLOAD_ERROR',
            message: 'Failed to upload brand document',
            details: { error: uploadError.message },
            retryable: true,
          },
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('brand-documents')
        .getPublicUrl(brandDocumentPath);
      
      uploadUrl = urlData.publicUrl;
    }

    // Create project record in database (immediate response)
    const { data: project, error: dbError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        topic: validationResult.data.topic,
        competitor_urls: validationResult.data.competitorUrls,
        tone: validationResult.data.tone as any,
        format: validationResult.data.format as any,
        brand_document_path: brandDocumentPath,
        status: 'draft',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      
      // Clean up uploaded file if project creation failed
      if (brandDocumentPath) {
        await supabase.storage
          .from('brand-documents')
          .remove([brandDocumentPath]);
      }

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

    // Trigger background processing via Inngest (non-blocking)
    try {
      await inngest.send({
        name: 'project/created',
        data: {
          userId: user.id,
          projectId: project.id,
          topic: project.topic,
          competitorUrls: project.competitor_urls,
          tone: project.tone,
          format: project.format,
          brandDocumentPath,
        },
      });

      // Also trigger research pipeline immediately
      await inngest.send({
        name: 'project/research-started',
        data: {
          userId: user.id,
          projectId: project.id,
          competitorUrls: project.competitor_urls,
          brandDocumentPath,
        },
      });
    } catch (inngestError) {
      console.error('Inngest event error:', inngestError);
      // Don't fail the request - project is created, background processing will retry
    }

    // Convert database row to Project type safely
    const typedProject = transformDatabaseRowToProject(project);

    // Return immediate success response
    return NextResponse.json({
      success: true,
      data: {
        project: typedProject,
        uploadUrl,
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<APIResponse<{ projects: Project[] }>>> {
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

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate status parameter
    const validStatuses = ['draft', 'researching', 'planning', 'writing', 'completed', 'error'] as const;
    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam as typeof validStatuses[number] : null;

    // Build query
    let query = supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: projects, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch projects',
          details: { error: dbError.message },
          retryable: true,
        },
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        projects: projects as Project[],
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Projects fetch error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        retryable: true,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}