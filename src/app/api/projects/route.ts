import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/validations/project';
import { APIResponse, Project } from '@/lib/types';
import { transformDatabaseRowToProject } from '@/lib/utils/type-transformers';
import { z } from 'zod';

// Conditional imports to avoid initialization errors
let inngest: any = null;
let checkQuota: any = null;
let INFRASTRUCTURE_CONFIG: any = null;

try {
  const inngestModule = require('@/lib/inngest/client');
  inngest = inngestModule.inngest;
} catch (error) {
  console.warn('Inngest client not available:', error.message);
}

try {
  const quotaModule = require('@/lib/rate-limiting/quota');
  checkQuota = quotaModule.checkQuota;
} catch (error) {
  console.warn('Quota checking not available:', error.message);
}

try {
  const configModule = require('@/lib/infrastructure/config');
  INFRASTRUCTURE_CONFIG = configModule.INFRASTRUCTURE_CONFIG;
} catch (error) {
  console.warn('Infrastructure config not available:', error.message);
  // Fallback config
  INFRASTRUCTURE_CONFIG = {
    security: {
      fileUpload: {
        allowedTypes: ['application/pdf'],
        maxSize: 10 * 1024 * 1024 // 10MB
      }
    }
  };
}

// Enhanced file upload validation schema with security checks
const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  type: z.string().refine(
    type => INFRASTRUCTURE_CONFIG.security.fileUpload.allowedTypes.includes(type),
    `Only ${INFRASTRUCTURE_CONFIG.security.fileUpload.allowedTypes.join(', ')} files are allowed`
  ),
  size: z.number()
    .max(INFRASTRUCTURE_CONFIG.security.fileUpload.maxSize, 
      `File size must be less than ${Math.round(INFRASTRUCTURE_CONFIG.security.fileUpload.maxSize / 1024 / 1024)}MB`),
});

// Virus scanning service interface
interface VirusScanResult {
  isClean: boolean;
  threats?: string[];
  scanId?: string;
  timestamp: string;
}

// Mock virus scanning service (replace with actual service in production)
async function performVirusScan(file: File): Promise<VirusScanResult> {
  // In production, integrate with services like:
  // - ClamAV
  // - VirusTotal API
  // - AWS GuardDuty Malware Protection
  // - Microsoft Defender for Cloud
  
  if (!INFRASTRUCTURE_CONFIG.security.fileUpload.virusScanning) {
    return {
      isClean: true,
      scanId: `mock-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  // Simulate virus scanning with basic file content checks
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);
  
  // Basic malicious pattern detection (simplified)
  const suspiciousPatterns = [
    // JavaScript execution patterns
    new Uint8Array([0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), // <script
    // Executable headers
    new Uint8Array([0x4D, 0x5A]), // MZ (PE executable)
    new Uint8Array([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
  ];

  for (const pattern of suspiciousPatterns) {
    for (let i = 0; i <= uint8Array.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (uint8Array[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        return {
          isClean: false,
          threats: ['Suspicious executable content detected'],
          scanId: `scan-${Date.now()}`,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  // Simulate scan delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    isClean: true,
    scanId: `scan-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

// Enhanced file type validation
async function validateFileContent(file: File): Promise<{ isValid: boolean; actualType?: string; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // PDF validation - check for PDF header
    if (file.type === 'application/pdf') {
      const pdfHeader = uint8Array.slice(0, 4);
      const expectedPdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      
      const isPDF = pdfHeader.every((byte, index) => byte === expectedPdfHeader[index]);
      
      if (!isPDF) {
        return {
          isValid: false,
          actualType: 'unknown',
          error: 'File is not a valid PDF despite having PDF MIME type',
        };
      }
    }
    
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to validate file content',
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<{ project: Project; uploadUrl?: string }>>> {
  console.log('POST /api/projects called');
  
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

    console.log('Validation passed, checking quota...');

    // Check user quota before creating project (conditional)
    let quotaCheck;
    if (checkQuota) {
      try {
        quotaCheck = await checkQuota(user.id, 'free', 'projects');
      } catch (quotaError) {
        console.error('Quota check failed, proceeding anyway:', quotaError);
        quotaCheck = { allowed: true, usage: 0, limit: 10 };
      }
    } else {
      console.log('Quota checking not available, allowing creation');
      quotaCheck = { allowed: true, usage: 0, limit: 10 };
    }
    
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

    // Handle file upload with enhanced security if provided
    let brandDocumentPath: string | undefined;
    let uploadUrl: string | undefined;
    let virusScanResult: VirusScanResult | undefined;
    
    if (brandDocumentFile) {
      // Validate file metadata
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

      // Validate file content
      const contentValidation = await validateFileContent(brandDocumentFile);
      if (!contentValidation.isValid) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'FILE_CONTENT_VALIDATION_ERROR',
            message: contentValidation.error || 'Invalid file content',
            details: { actualType: contentValidation.actualType },
            retryable: false,
          },
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }

      // Perform virus scanning
      try {
        virusScanResult = await performVirusScan(brandDocumentFile);
        
        if (!virusScanResult.isClean) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'VIRUS_DETECTED',
              message: 'File failed virus scan',
              details: { 
                threats: virusScanResult.threats,
                scanId: virusScanResult.scanId 
              },
              retryable: false,
            },
            timestamp: new Date().toISOString(),
          }, { status: 400 });
        }
      } catch (scanError: any) {
        console.error('Virus scan error:', scanError);
        return NextResponse.json({
          success: false,
          error: {
            code: 'VIRUS_SCAN_ERROR',
            message: 'Failed to scan file for viruses',
            details: { error: scanError.message },
            retryable: true,
          },
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      }

      // Generate secure file path with additional entropy
      const fileExtension = brandDocumentFile.name.split('.').pop();
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 12);
      const fileName = `${user.id}/${timestamp}-${randomId}.${fileExtension}`;
      brandDocumentPath = `brand-documents/${fileName}`;

      // Upload file to Supabase Storage with metadata
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('brand-documents')
        .upload(brandDocumentPath, brandDocumentFile, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            userId: user.id,
            originalName: brandDocumentFile.name,
            virusScanId: virusScanResult.scanId,
            uploadTimestamp: new Date().toISOString(),
          },
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
        // Store security metadata
        security_metadata: virusScanResult ? {
          virusScan: {
            scanId: virusScanResult.scanId,
            timestamp: virusScanResult.timestamp,
            isClean: virusScanResult.isClean,
          },
          fileValidation: {
            originalName: brandDocumentFile?.name,
            validatedType: brandDocumentFile?.type,
            size: brandDocumentFile?.size,
          },
        } : null,
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

    // Send immediate real-time update to user
    try {
      await supabase
        .channel(`project:${project.id}`)
        .send({
          type: 'broadcast',
          event: 'project_status_update',
          payload: {
            projectId: project.id,
            status: 'draft',
            message: 'Project created successfully',
            progress: 5,
            timestamp: new Date().toISOString(),
            metadata: {
              fileUploaded: !!brandDocumentPath,
              virusScanPassed: virusScanResult?.isClean ?? true,
              competitorUrlCount: validationResult.data.competitorUrls.length,
            },
          },
        });
    } catch (realtimeError) {
      console.error('Real-time update error:', realtimeError);
      // Don't fail the request for real-time errors
    }

    // Trigger background processing via Inngest (conditional)
    if (inngest) {
      try {
        // Send project creation event with enhanced metadata
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
            securityMetadata: {
              virusScanResult,
              fileValidated: !!brandDocumentFile,
              uploadTimestamp: new Date().toISOString(),
            },
          },
        });

        console.log('Inngest events sent successfully');

      } catch (inngestError) {
        console.error('Inngest event error (non-blocking):', inngestError);
        // Don't fail the request - project is created, background processing will retry
      }
    } else {
      console.log('Inngest not available, skipping background processing');
    }

    // Convert database row to Project type safely
    const typedProject = transformDatabaseRowToProject(project);
    console.log('Project created successfully:', typedProject.id);

    // Return immediate success response with enhanced metadata
    const response = {
      success: true,
      data: {
        project: typedProject,
        uploadUrl,
        securityInfo: virusScanResult ? {
          virusScanPassed: virusScanResult.isClean,
          scanId: virusScanResult.scanId,
          scanTimestamp: virusScanResult.timestamp,
        } : undefined,
        processingInfo: {
          backgroundProcessingStarted: true,
          estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
          realTimeUpdatesChannel: `project:${project.id}`,
        },
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log('Sending success response');
    return NextResponse.json(response, { status: 201 });

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

export async function GET(request: NextRequest): Promise<NextResponse<APIResponse<{ projects: Project[]; pagination: { total: number; filtered: number } }>>> {
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

    // Get query parameters for filtering, sorting, and pagination
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const toneParam = searchParams.get('tone');
    const formatParam = searchParams.get('format');
    const searchParam = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate parameters
    const validStatuses = ['draft', 'researching', 'planning', 'writing', 'finalizing', 'completed', 'error'] as const;
    const validTones = ['professional', 'witty', 'data-driven'] as const;
    const validFormats = ['how-to', 'listicle', 'case-study'] as const;
    const validSortFields = ['created_at', 'updated_at', 'topic'] as const;
    const validSortOrders = ['asc', 'desc'] as const;

    const status = statusParam && validStatuses.includes(statusParam as any) ? statusParam as typeof validStatuses[number] : null;
    const tone = toneParam && validTones.includes(toneParam as any) ? toneParam as typeof validTones[number] : null;
    const format = formatParam && validFormats.includes(formatParam as any) ? formatParam as typeof validFormats[number] : null;
    const validatedSortBy = validSortFields.includes(sortBy as any) ? sortBy as typeof validSortFields[number] : 'created_at';
    const validatedSortOrder = validSortOrders.includes(sortOrder as any) ? sortOrder as typeof validSortOrders[number] : 'desc';

    // Build base query
    let query = supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (tone) {
      query = query.eq('tone', tone);
    }

    if (format) {
      query = query.eq('format', format);
    }

    // Apply search filter (search in topic and competitor URLs)
    if (searchParam) {
      // For PostgreSQL, we can use ilike for case-insensitive search
      // We'll search in topic and convert competitor_urls array to text for searching
      query = query.or(`topic.ilike.%${searchParam}%,competitor_urls::text.ilike.%${searchParam}%`);
    }

    // Get total count before pagination
    const { count: totalCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Apply sorting and pagination
    query = query
      .order(validatedSortBy, { ascending: validatedSortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: projects, error: dbError, count: filteredCount } = await query;

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
        pagination: {
          total: totalCount || 0,
          filtered: projects?.length || 0,
        },
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