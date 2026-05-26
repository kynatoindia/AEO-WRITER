import { inngest } from "@/lib/inngest/client";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validation schema for the request
const generateBlogSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(1, "Title is required"),
  keyword: z.string().min(1, "Keyword is required"),
  facts: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Validate input
    const validatedData = generateBlogSchema.parse(body);
    
    // 2. Verify user authentication
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" }, 
        { status: 401 }
      );
    }
    
    // 3. Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', validatedData.projectId)
      .eq('user_id', user.id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }
    
    // 4. Trigger Inngest workflow - THE ONE-GO FIX
    await inngest.send({
      name: "aeo/blog.requested",
      data: {
        userId: user.id,
        projectId: validatedData.projectId,
        title: validatedData.title,
        keyword: validatedData.keyword,
        facts: validatedData.facts || "",
      },
    });
    
    // 5. Return 202 Accepted. No more 429 in the browser!
    return NextResponse.json(
      { 
        message: "Blog generation started",
        projectId: validatedData.projectId,
        status: "processing"
      }, 
      { status: 202 }
    );
    
  } catch (error: any) {
    console.error('AEO blog generation trigger failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "Invalid request data",
          details: error.issues
        }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to start blog generation",
        message: error.message
      }, 
      { status: 500 }
    );
  }
}