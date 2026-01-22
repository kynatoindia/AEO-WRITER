import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { checkQuota } from '@/lib/rate-limiting/quota';
import { z } from 'zod';

// Schema for modular research request
const ModularResearchRequestSchema = z.object({
  topic: z.string().min(1).max(200),
  tone: z.enum(['professional', 'casual', 'academic', 'conversational', 'authoritative']),
  format: z.enum(['blog-post', 'guide', 'tutorial', 'comparison', 'review', 'case-study']),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  brandDocumentPath: z.string().optional()
});

/**
 * Trigger Modular Agentic Research Pipeline
 * POST /api/projects/[id]/modular-research
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = ModularResearchRequestSchema.parse(body);

    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, status')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project is in correct state for research
    if (project.status !== 'created' && project.status !== 'planning') {
      return NextResponse.json(
        { error: `Cannot start research for project in ${project.status} status` },
        { status: 400 }
      );
    }

    // Check user quota for research operations
    const quotaCheck = await checkQuota(user.id, 'free', 'research'); // Get actual plan from DB

    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Research quota exceeded',
          usage: quotaCheck.usage,
          limit: quotaCheck.limit,
          resetDate: quotaCheck.resetDate
        },
        { status: 429 }
      );
    }

    // Update project status to researching
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'researching',
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project status' },
        { status: 500 }
      );
    }

    // Trigger Modular Agentic Research Pipeline
    const researchEvent = await inngest.send({
      name: 'project/modular-research-started',
      data: {
        userId: user.id,
        projectId,
        topic: validatedData.topic,
        tone: validatedData.tone,
        format: validatedData.format,
        industry: validatedData.industry,
        targetAudience: validatedData.targetAudience,
        brandDocumentPath: validatedData.brandDocumentPath,
        timestamp: Date.now()
      }
    });

    console.log(`Triggered Modular Agentic Research Pipeline for project ${projectId}`);

    return NextResponse.json({
      success: true,
      message: 'Modular Agentic Research Pipeline started',
      projectId,
      eventId: researchEvent.ids[0],
      status: 'researching',
      pipeline: 'modular-agentic-rag',
      features: {
        aiCompetitorDiscovery: true,
        atomicFactsExtraction: true,
        factVaultCompression: true,
        zeroDataLoss: true
      },
      estimatedTime: '3-5 minutes'
    });

  } catch (error) {
    console.error('Modular research pipeline error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get Modular Research Status
 * GET /api/projects/[id]/modular-research
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get project with research data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, research_data, updated_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if modular research data exists
    const researchData = project.research_data as any;
    const isModularResearch = researchData?.competitorDiscovery && researchData?.factVault;

    if (!isModularResearch) {
      return NextResponse.json({
        success: false,
        message: 'No modular research data found',
        projectId,
        status: project.status,
        hasResearchData: !!researchData,
        isModularResearch: false
      });
    }

    // Return modular research status and metrics
    return NextResponse.json({
      success: true,
      projectId,
      status: project.status,
      isModularResearch: true,
      researchMetrics: {
        competitorsDiscovered: researchData.competitorDiscovery?.discoveredCompetitors?.length || 0,
        competitorsAnalyzed: researchData.processingMetrics?.competitorsAnalyzed || 0,
        atomicFactsExtracted: researchData.factVault?.atomicFacts?.length || 0,
        compressionRatio: researchData.factVault?.extractionMetrics?.compressionRatio || 0,
        qualityScore: researchData.factVault?.extractionMetrics?.qualityScore || 0,
        topicCoverage: researchData.factVault?.topicCoverage?.coverageScore || 0,
        brandDocumentProcessed: researchData.processingMetrics?.brandDocumentProcessed || false,
        totalProcessingTime: researchData.processingMetrics?.totalProcessingTime || 0,
        tokensUsed: researchData.processingMetrics?.tokensUsed || 0,
        cost: researchData.processingMetrics?.cost || 0
      },
      competitorDiscovery: {
        searchStrategy: researchData.competitorDiscovery?.searchStrategy,
        topCompetitors: researchData.competitorDiscovery?.discoveredCompetitors?.slice(0, 5)
      },
      factVault: {
        totalFacts: researchData.factVault?.atomicFacts?.length || 0,
        topFacts: researchData.factVault?.atomicFacts
          ?.filter((fact: any) => fact.confidence > 80)
          ?.slice(0, 10)
          ?.map((fact: any) => ({
            category: fact.category,
            fact: fact.fact,
            confidence: fact.confidence,
            relevanceScore: fact.relevanceScore
          })) || [],
        categories: researchData.factVault?.atomicFacts
          ?.reduce((acc: any, fact: any) => {
            acc[fact.category] = (acc[fact.category] || 0) + 1;
            return acc;
          }, {}) || {},
        mainTopics: researchData.factVault?.topicCoverage?.mainTopics || []
      },
      lastUpdated: project.updated_at
    });

  } catch (error) {
    console.error('Get modular research status error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}