import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('Debug API called');
  
  try {
    // Test 1: Basic response
    console.log('Test 1: Basic response - OK');
    
    // Test 2: Environment variables
    const envTest = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    console.log('Test 2: Environment variables', envTest);
    
    // Test 3: Try importing Supabase
    let supabaseTest = 'not tested';
    try {
      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      supabaseTest = 'import successful';
      console.log('Test 3: Supabase import - OK');
    } catch (error) {
      supabaseTest = `import failed: ${error.message}`;
      console.error('Test 3: Supabase import failed:', error);
    }
    
    // Test 4: Try creating Supabase client
    let clientTest = 'not tested';
    if (supabaseTest === 'import successful') {
      try {
        const { createServerSupabaseClient } = require('@/lib/supabase/server');
        const supabase = await createServerSupabaseClient();
        clientTest = 'client creation successful';
        console.log('Test 4: Supabase client creation - OK');
      } catch (error) {
        clientTest = `client creation failed: ${error.message}`;
        console.error('Test 4: Supabase client creation failed:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        basicResponse: 'OK',
        environment: envTest,
        supabaseImport: supabaseTest,
        supabaseClient: clientTest,
      }
    });
    
  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log('Debug POST API called');
  
  try {
    // Test form data parsing
    const formData = await request.formData();
    const topic = formData.get('topic');
    
    console.log('Form data received:', { topic: !!topic });
    
    return NextResponse.json({
      success: true,
      message: 'POST test successful',
      receivedData: {
        topic: topic?.toString(),
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('Debug POST API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}