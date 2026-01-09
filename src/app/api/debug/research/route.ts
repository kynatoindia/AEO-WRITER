import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Testing research pipeline...');
    
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }
    
    // Create a test project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title: 'Test Research Project',
        topic: 'Digital Marketing Strategy',
        tone: 'professional',
        format: 'blog_post',
        status: 'draft'
      })
      .select()
      .single();
    
    if (projectError || !project) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }
    
    console.log(`Created test project: ${project.id}`);
    
    // Trigger research pipeline
    const eventData = {
      userId: user.id,
      projectId: project.id,
      competitorUrls: [
        'https://hubspot.com/marketing',
        'https://mailchimp.com/marketing-glossary',
        'https://blog.hootsuite.com/digital-marketing-plan'
      ],
      brandDocumentPath: null,
      topic: project.topic,
      tone: project.tone,
      format: project.format,
    };
    
    console.log('Sending Inngest event...');
    const eventResult = await inngest.send({
      name: 'project/research-started',
      data: eventData,
    });
    
    console.log('Inngest event sent:', eventResult.ids[0]);
    
    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        eventId: eventResult.ids[0],
        message: 'Research pipeline triggered successfully',
        testUrls: eventData.competitorUrls
      }
    });
    
  } catch (error) {
    console.error('Research pipeline test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}