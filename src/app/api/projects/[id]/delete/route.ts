import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { APIResponse } from '@/lib/types';

// All Inngest function IDs that might be running for a project
const INNGEST_FUNCTION_IDS = [
    'modular-agentic-research-pipeline',
    'modular-research-completion-handler',
    'generate-fact-based-content-strategy',
    'generate-fact-based-content-section',
    'fact-based-completion-handler',
    'finalize-content',
    'auto-trigger-finalization',
    'manual-trigger-finalization',
    'research-pipeline-workflow',
    'research-completion-handler',
    'research-retry-handler',
    'generate-content-strategy',
    'generate-content-section',
    'assemble-and-polish-content',
    'handle-content-generation',
    'handle-project-research',
    'handle-blueprint-generation',
    'write-aeo-blog',
    'handle-project-initialization',
    'handle-immediate-project-initialization',
    'handle-project-status-update',
];

/**
 * Cancel all running Inngest functions for a project
 */
async function cancelInngestRuns(projectId: string): Promise<{ success: boolean; cancelled: number; errors: string[] }> {
    const signingKey = process.env.INNGEST_SIGNING_KEY;
    const appId = 'aeo-writer-saas';

    if (!signingKey) {
        console.warn('INNGEST_SIGNING_KEY not set, skipping Inngest cancellation');
        return { success: true, cancelled: 0, errors: ['INNGEST_SIGNING_KEY not configured'] };
    }

    const errors: string[] = [];
    let cancelled = 0;

    // Cancel runs for each function type
    for (const functionId of INNGEST_FUNCTION_IDS) {
        try {
            // Use Inngest Bulk Cancellation API
            const response = await fetch('https://api.inngest.com/v1/cancellations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${signingKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    app_id: appId,
                    function_id: functionId,
                    // Cancel all runs from the last 24 hours that match this projectId
                    started_after: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    started_before: new Date().toISOString(),
                    if: `event.data.projectId == '${projectId}'`,
                }),
            });

            if (response.ok) {
                cancelled++;
                console.log(`Cancelled runs for function ${functionId} on project ${projectId}`);
            } else if (response.status !== 404) {
                // 404 means no runs found, which is fine
                const errorText = await response.text();
                console.error(`Failed to cancel ${functionId}:`, errorText);
                errors.push(`${functionId}: ${response.status}`);
            }
        } catch (error: any) {
            console.error(`Error cancelling ${functionId}:`, error.message);
            errors.push(`${functionId}: ${error.message}`);
        }
    }

    return { success: true, cancelled, errors };
}

/**
 * DELETE /api/projects/[id]/delete
 * Deletes a project and cancels all running Inngest functions
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<APIResponse<{ deleted: boolean }>>> {
    try {
        const { id: projectId } = await params;

        if (!projectId) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Project ID is required',
                    retryable: false,
                },
                timestamp: new Date().toISOString(),
            }, { status: 400 });
        }

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

        // Check if project exists and belongs to user
        const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('id, user_id, brand_document_path, status')
            .eq('id', projectId)
            .single();

        if (fetchError || !project) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Project not found',
                    retryable: false,
                },
                timestamp: new Date().toISOString(),
            }, { status: 404 });
        }

        // Verify ownership
        if (project.user_id !== user.id) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to delete this project',
                    retryable: false,
                },
                timestamp: new Date().toISOString(),
            }, { status: 403 });
        }

        console.log(`Deleting project ${projectId} for user ${user.id}`);

        // Step 1: Cancel all running Inngest functions
        const cancellationResult = await cancelInngestRuns(projectId);
        console.log('Inngest cancellation result:', cancellationResult);

        // Step 2: Delete associated storage files (brand document if any)
        if (project.brand_document_path) {
            try {
                const { error: storageError } = await supabase.storage
                    .from('brand-documents')
                    .remove([project.brand_document_path]);

                if (storageError) {
                    console.error('Failed to delete brand document:', storageError);
                    // Continue with deletion even if file cleanup fails
                }
            } catch (storageErr) {
                console.error('Storage deletion error:', storageErr);
            }
        }

        // Step 3: Delete usage analytics for this project (optional cleanup)
        try {
            await supabase
                .from('usage_analytics')
                .delete()
                .eq('project_id', projectId);
        } catch (analyticsErr) {
            console.error('Failed to delete usage analytics:', analyticsErr);
            // Continue with project deletion
        }

        // Step 4: Delete content sections for this project
        try {
            await supabase
                .from('content_sections')
                .delete()
                .eq('project_id', projectId);
        } catch (contentErr) {
            console.error('Failed to delete content sections:', contentErr);
            // Continue with project deletion
        }

        // Step 5: Delete the project itself
        const { error: deleteError } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (deleteError) {
            console.error('Failed to delete project:', deleteError);
            return NextResponse.json({
                success: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: 'Failed to delete project',
                    details: { error: deleteError.message },
                    retryable: true,
                },
                timestamp: new Date().toISOString(),
            }, { status: 500 });
        }

        console.log(`Project ${projectId} deleted successfully`);

        return NextResponse.json({
            success: true,
            data: {
                deleted: true,
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('Project deletion error:', error);
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
