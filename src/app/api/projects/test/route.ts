import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('Test API route called');
    
    const supabase = await createServerSupabaseClient();
    
    // Test authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({
        success: false,
        error: 'Authentication failed',
        details: authError.message
      });
    }
    
    if (!user) {
      console.log('No user found');
      return NextResponse.json({
        success: false,
        error: 'No user authenticated'
      });
    }
    
    console.log('User authenticated:', user.email);
    
    // Test database connection
    const { data: projects, error: dbError } = await supabase
      .from('projects')
      .select('id, topic, created_at')
      .eq('user_id', user.id)
      .limit(1);
    
    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: dbError.message
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email
        },
        projectCount: projects?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('Test API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Test POST API route called');
    
    const formData = await request.formData();
    const topic = formData.get('topic');
    const competitorUrls = formData.get('competitorUrls');
    const tone = formData.get('tone');
    const format = formData.get('format');
    const brandDocument = formData.get('brandDocument');
    
    console.log('Form data received:', {
      topic: !!topic,
      competitorUrls: !!competitorUrls,
      tone: !!tone,
      format: !!format,
      brandDocument: !!brandDocument && (brandDocument as File).size > 0
    });
    
    return NextResponse.json({
      success: true,
      data: {
        received: {
          topic: topic?.toString(),
          competitorUrls: competitorUrls?.toString(),
          tone: tone?.toString(),
          format: format?.toString(),
          hasFile: !!brandDocument && (brandDocument as File).size > 0
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('Test POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}