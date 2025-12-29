import { NextRequest } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { streamAIText } from '@/lib/ai/gateway';
import { z } from 'zod';

// Request validation schema
const StreamContentSchema = z.object({
  sectionId: z.string(),
  prompt: z.string(),
  context: z.object({
    previousContent: z.string().optional(),
    sectionHeading: z.string(),
    sectionGoal: z.string(),
    keyPoints: z.array(z.string()).optional(),
    tone: z.enum(['professional', 'witty', 'data-driven']),
    targetKeywords: z.array(z.string()).optional()
  })
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = StreamContentSchema.parse(body);
    
    // Get authenticated user
    const supabase = await createRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: 'Authentication required'
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, topic, tone, format')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return new Response(
        JSON.stringify({
          error: 'Project not found or access denied'
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Update section status to 'writing'
    await supabase
      .from('content_sections')
      .update({ 
        status: 'writing',
        updated_at: new Date().toISOString()
      } as any) // Type assertion to handle database type issues
      .eq('id', validatedData.sectionId)
      .eq('project_id', projectId);
    
    // Build comprehensive prompt for content generation
    const { context } = validatedData;
    const fullPrompt = `
You are writing a section for a ${project.format} blog post about "${project.topic}".

Section Details:
- Heading: ${context.sectionHeading}
- Goal: ${context.sectionGoal}
- Tone: ${context.tone}
${context.keyPoints ? `- Key Points to Cover: ${context.keyPoints.join(', ')}` : ''}
${context.targetKeywords ? `- Target Keywords: ${context.targetKeywords.join(', ')}` : ''}

${context.previousContent ? `Previous Content Context:\n${context.previousContent}\n` : ''}

Instructions:
1. Write engaging, informative content that matches the ${context.tone} tone
2. Use proper markdown formatting with headers, lists, and emphasis
3. Include specific examples and actionable insights
4. Naturally incorporate target keywords without keyword stuffing
5. Write 300-500 words for this section
6. Use transition sentences to connect with previous content
7. Include relevant data points or statistics when appropriate

Write the complete section content now:
    `.trim();
    
    // Stream content generation using AI SDK
    const streamingResponse = await streamAIText(
      fullPrompt,
      'content', // Use case for cost-effective content generation
      user.id,
      {
        maxTokens: 800, // Limit for section content
        temperature: 0.7
      }
    );
    
    // Create a readable stream that handles the AI response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = '';
          
          // Process the AI stream
          for await (const chunk of streamingResponse.stream.textStream) {
            fullContent += chunk;
            
            // Send chunk to client
            const data = JSON.stringify({
              type: 'content_chunk',
              data: {
                sectionId: validatedData.sectionId,
                chunk,
                fullContent
              }
            });
            
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          }
          
          // Wait for usage information
          const usage = await streamingResponse.stream.usage;
          
          // Update section with completed content
          await supabase
            .from('content_sections')
            .update({
              generated_content: fullContent,
              status: 'completed',
              updated_at: new Date().toISOString()
            } as any) // Type assertion to handle database type issues
            .eq('id', validatedData.sectionId)
            .eq('project_id', projectId);
          
          // Send completion event
          const completionData = JSON.stringify({
            type: 'section_complete',
            data: {
              sectionId: validatedData.sectionId,
              content: fullContent,
              wordCount: fullContent.split(' ').length,
              tokensUsed: usage?.totalTokens || 0,
              model: streamingResponse.model
            }
          });
          
          controller.enqueue(new TextEncoder().encode(`data: ${completionData}\n\n`));
          
          // Send real-time update via Supabase
          await supabase
            .channel(`project:${projectId}`)
            .send({
              type: 'broadcast',
              event: 'section_complete',
              payload: {
                sectionId: validatedData.sectionId,
                heading: context.sectionHeading,
                wordCount: fullContent.split(' ').length,
                tokensUsed: usage?.totalTokens || 0
              }
            });
          
          controller.close();
          
        } catch (error) {
          console.error('Streaming error:', error);
          
          // Update section status to error
          await supabase
            .from('content_sections')
            .update({
              status: 'pending', // Reset to allow retry
              updated_at: new Date().toISOString()
            } as any) // Type assertion to handle database type issues
            .eq('id', validatedData.sectionId)
            .eq('project_id', projectId);
          
          // Send error event
          const errorData = JSON.stringify({
            type: 'error',
            data: {
              sectionId: validatedData.sectionId,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
          
          controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
    
  } catch (error) {
    console.error('Stream content error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
          details: error.issues
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}