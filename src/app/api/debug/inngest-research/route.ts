import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

export async function POST(request: NextRequest) {
  try {
    console.log('Testing Inngest research pipeline...');
    
    // Create test event data
    const eventData = {
      userId: 'test-user-' + Date.now(),
      projectId: 'test-project-' + Date.now(),
      competitorUrls: [
        'https://hubspot.com/marketing',
        'https://mailchimp.com/marketing-glossary'
      ],
      brandDocumentPath: null,
      topic: 'Digital Marketing Strategy',
      tone: 'professional',
      format: 'blog_post',
    };
    
    console.log('Sending Inngest event with data:', eventData);
    
    // Send the research event
    const eventResult = await inngest.send({
      name: 'project/research-started',
      data: eventData,
    });
    
    console.log('Inngest event sent successfully:', eventResult.ids[0]);
    
    return NextResponse.json({
      success: true,
      data: {
        eventId: eventResult.ids[0],
        message: 'Research pipeline triggered via Inngest',
        testData: eventData,
        inngestUrl: 'http://localhost:8288',
        instructions: [
          '1. Check the Inngest Dev Server at http://localhost:8288',
          '2. Look for the "project/research-started" event',
          '3. Monitor the function execution logs',
          '4. Check your Upstash Redis dashboard for bandwidth usage'
        ]
      }
    });
    
  } catch (error) {
    console.error('Inngest research test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}