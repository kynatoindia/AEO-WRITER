import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';
import { checkQuota } from '@/lib/rate-limiting/quota';
import { z } from 'zod';

/**
 * Trigger Fact-Based Content Generation Pipeline
 * POST /api/projects/[id]/fact-based-generate
 */
export async function POST(
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
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Verify project has modular research data
    const researchData = project.research_data as any;
    const hasFactVault = researchData?.factVault?.atomicFacts?.length > 0;
    
    if (!hasFactVault) {
      return NextResponse.json(
        { 
          error: 'No atomic facts available. Please run modular research first.',
          suggestion: 'Use /api/projects/[id]/modular-research to generate atomic facts'
        },
        { status: 400 }
      );
    }
    
    // Check if project is in correct state for content generation
    if (project.status !== 'planning' && project.status !== 'researching') {
      return NextResponse.json(
        { error: `Cannot start content generation for project in ${project.status} status` },
        { status: 400 }
      );
    }
    
    // Check user quota for content generation
    const quotaCheck = await checkQuota(user.id, 'free', 'contentGeneration'); // Get actual plan from DB
    
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Content generation quota exceeded',
          usage: quotaCheck.usage,
          limit: quotaCheck.limit,
          resetDate: quotaCheck.resetDate
        },
        { status: 429 }
      );
    }
    
    // Update project status to writing
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'writing',
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
    
    // Trigger Fact-Based Content Generation Pipeline
    const contentEvent = await inngest.send({
      name: 'content/fact-based-strategy-generate',
      data: {
        userId: user.id,
        projectId,
        researchData,
        topic: project.topic,
        tone: project.tone,
        format: project.format,
        timestamp: Date.now()
      }
    });
    
    console.log(`Triggered Fact-Based Content Generation Pipeline for project ${projectId}`);
    
    // Calculate estimated metrics
    const factCount = researchData.factVault.atomicFacts.length;
    const compressionRatio = researchData.factVault.extractionMetrics.compressionRatio;
    const qualityScore = researchData.factVault.extractionMetrics.qualityScore;
    
    return NextResponse.json({
      success: true,
      message: 'Fact-Based Content Generation Pipeline started',
      projectId,
      eventId: contentEvent.ids[0],
      status: 'writing',
      pipeline: 'fact-based-generation',
      factVaultMetrics: {
        totalFacts: factCount,
        compressionRatio: compressionRatio,
        qualityScore: qualityScore,
        estimatedSections: Math.ceil(factCount / 8), // ~8 facts per section
        costSavings: `${Math.round((compressionRatio - 1) * 100)}% token reduction`
      },
      features: {
        factBasedGeneration: true,
        zeroHallucination: true,
        sourceAttribution: true,
        sectionFactMapping: true,
        qualityValidation: true
      },
      estimatedTime: '2-4 minutes'
    });
    
  } catch (error) {
    console.error('Fact-based content generation error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get Fact-Based Content Generation Status
 * GET /api/projects/[id]/fact-based-generate
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
    
    // Get project with content sections
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status, blueprint, generated_content, updated_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Get content sections with fact metadata
    const { data: sections, error: sectionsError } = await supabase
      .from('content_sections')
      .select('*')
      .eq('project_id', projectId)
      .order('section_order');
    
    if (sectionsError) {
      console.error('Failed to fetch content sections:', sectionsError);
    }
    
    // Calculate generation progress
    const totalSections = sections?.length || 0;
    const completedSections = sections?.filter(s => s.status === 'completed').length || 0;
    const writingSections = sections?.filter(s => s.status === 'writing').length || 0;
    const progress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
    
    // Aggregate fact usage metrics
    const factMetrics = sections?.reduce((acc, section) => {
      const metadata = (section as any).fact_metadata;
      if (metadata) {
        acc.totalFactsUsed += metadata.factCount || 0;
        acc.totalConfidence += (metadata.averageConfidence || 0) * (metadata.factCount || 0);
        acc.categoriesUsed.push(...(metadata.categories || []));
      }
      return acc;
    }, {
      totalFactsUsed: 0,
      totalConfidence: 0,
      categoriesUsed: [] as string[]
    });
    
    const averageConfidence = (factMetrics?.totalFactsUsed ?? 0) > 0
      ? Math.round((factMetrics!.totalConfidence) / factMetrics!.totalFactsUsed)
      : 0;
    
    const uniqueCategories = [...new Set(factMetrics?.categoriesUsed || [])];
    
    return NextResponse.json({
      success: true,
      projectId,
      status: project.status,
      progress: {
        percentage: progress,
        sectionsCompleted: completedSections,
        sectionsWriting: writingSections,
        sectionsTotal: totalSections,
        isComplete: project.status === 'completed'
      },
      blueprint: project.blueprint ? {
        sectionsCount: (project.blueprint as any).sections?.length || 0,
        estimatedLength: (project.blueprint as any).estimatedLength || 0,
        targetKeywords: (project.blueprint as any).targetKeywords || []
      } : null,
      factUsageMetrics: {
        totalFactsUsed: factMetrics?.totalFactsUsed || 0,
        averageConfidence: averageConfidence,
        categoriesUsed: uniqueCategories,
        factDensity: totalSections > 0 ? Math.round((factMetrics?.totalFactsUsed || 0) / totalSections) : 0
      },
      sections: sections?.map(section => ({
        id: section.id,
        heading: section.heading,
        status: section.status,
        order: section.section_order,
        wordCount: section.generated_content ? section.generated_content.split(' ').length : 0,
        factMetadata: (section as any).fact_metadata ? {
          factCount: (section as any).fact_metadata.factCount,
          averageConfidence: (section as any).fact_metadata.averageConfidence,
          categories: (section as any).fact_metadata.categories
        } : null
      })) || [],
      generatedContent: project.generated_content ? {
        wordCount: project.generated_content.split(' ').length,
        hasContent: true
      } : {
        wordCount: 0,
        hasContent: false
      },
      lastUpdated: project.updated_at
    });
    
  } catch (error) {
    console.error('Get fact-based generation status error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}