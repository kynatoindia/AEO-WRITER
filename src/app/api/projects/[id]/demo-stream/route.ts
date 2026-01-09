import { NextRequest, NextResponse } from 'next/server';

/**
 * Demo streaming endpoint that simulates real content generation
 * This shows what the actual streaming would look like with AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  
  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Demo content for different sections
      const demoContent = {
        'mock-1': {
          title: 'Introduction',
          content: `# Introduction to Project Management Tools

In today's fast-paced business environment, effective project management has become crucial for organizational success. With remote work becoming the norm, teams need robust tools that can facilitate collaboration, track progress, and ensure deadlines are met.

Project management tools serve as the backbone of modern business operations, providing structure and clarity to complex workflows. These platforms enable teams to break down large projects into manageable tasks, assign responsibilities, and monitor progress in real-time.

The right project management solution can transform how your team operates, leading to increased productivity, better communication, and ultimately, more successful project outcomes.`
        },
        'mock-2': {
          title: 'Main Content',
          content: `# Top Project Management Tools for Remote Teams

## 1. Asana - The Versatile Organizer

Asana stands out as one of the most user-friendly project management platforms available today. Its intuitive interface makes it easy for teams to get started quickly, while its powerful features support complex project requirements.

**Key Features:**
- Task management with subtasks and dependencies
- Multiple project views (list, board, timeline, calendar)
- Team collaboration tools and proofing
- Custom fields and forms
- Advanced search and reporting

**Best For:** Teams that need flexibility and ease of use without sacrificing functionality.

## 2. Trello - Visual Project Management

Trello's card-based system, inspired by the Kanban methodology, provides a visual approach to project management that many teams find intuitive and engaging.

**Key Features:**
- Kanban-style boards with drag-and-drop functionality
- Power-ups for extended functionality
- Butler automation for repetitive tasks
- Calendar and timeline views
- Integration with popular tools

**Best For:** Small to medium teams that prefer visual organization and simple workflows.`
        },
        'mock-3': {
          title: 'Key Benefits',
          content: `# Key Benefits of Modern Project Management Tools

## Enhanced Team Collaboration

Modern project management tools break down silos and create a centralized hub where team members can communicate, share files, and stay updated on project progress. This leads to:

- **Improved Communication:** Real-time updates and notifications keep everyone in the loop
- **Better File Management:** Centralized document storage with version control
- **Transparent Progress Tracking:** Everyone can see what's being worked on and by whom

## Increased Productivity and Efficiency

By automating routine tasks and providing clear visibility into project status, these tools help teams work more efficiently:

- **Automated Workflows:** Reduce manual work with smart automation
- **Time Tracking:** Understand where time is being spent and optimize accordingly
- **Resource Management:** Allocate resources effectively across projects

## Better Decision Making

With comprehensive reporting and analytics, project managers can make data-driven decisions:

- **Real-time Dashboards:** Get instant insights into project health
- **Performance Metrics:** Track team productivity and project success rates
- **Predictive Analytics:** Identify potential issues before they become problems`
        },
        'mock-4': {
          title: 'Conclusion',
          content: `# Conclusion: Choosing the Right Project Management Tool

Selecting the right project management tool for your remote team is a critical decision that can significantly impact your organization's productivity and success. The tools we've explored each offer unique strengths and cater to different team sizes, workflows, and requirements.

## Key Takeaways

When evaluating project management solutions, consider these essential factors:

1. **Team Size and Structure:** Ensure the tool can scale with your team
2. **Workflow Complexity:** Choose a solution that matches your process complexity
3. **Integration Needs:** Verify compatibility with your existing tech stack
4. **Budget Constraints:** Balance features with cost-effectiveness
5. **Learning Curve:** Consider how quickly your team can adopt the new tool

## Making the Final Decision

The best project management tool is the one that your team will actually use consistently. Start with a trial period, involve key stakeholders in the evaluation process, and don't be afraid to switch if your initial choice doesn't meet your needs.

Remember, the goal is not just to manage projects, but to empower your team to deliver exceptional results efficiently and collaboratively. With the right tool in place, your remote team can achieve new levels of productivity and success.

**Ready to transform your project management approach?** Choose a tool that aligns with your team's needs and start experiencing the benefits of streamlined, efficient project management today.`
        }
      };
      
      // Simulate streaming content generation
      const sections = ['mock-1', 'mock-2', 'mock-3', 'mock-4'];
      let currentSection = 0;
      
      const streamSection = async (sectionId: string) => {
        const section = demoContent[sectionId as keyof typeof demoContent];
        const words = section.content.split(' ');
        
        // Send section start event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'section_started',
          data: {
            sectionId,
            heading: section.title,
            totalWords: words.length
          }
        })}\n\n`));
        
        // Stream words with realistic timing
        let currentContent = '';
        for (let i = 0; i < words.length; i++) {
          currentContent += (i > 0 ? ' ' : '') + words[i];
          
          // Send content chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'content_chunk',
            data: {
              sectionId,
              chunk: words[i],
              fullContent: currentContent,
              progress: Math.round((i + 1) / words.length * 100)
            }
          })}\n\n`));
          
          // Realistic typing speed (50-150ms per word)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        }
        
        // Send section complete event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'section_complete',
          data: {
            sectionId,
            heading: section.title,
            content: currentContent,
            wordCount: words.length
          }
        })}\n\n`));
        
        // Pause between sections
        await new Promise(resolve => setTimeout(resolve, 1000));
      };
      
      // Stream all sections
      const processAllSections = async () => {
        try {
          // Send generation started event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_started',
            data: {
              projectId,
              totalSections: sections.length,
              message: 'Starting content generation...'
            }
          })}\n\n`));
          
          // Process each section
          for (const sectionId of sections) {
            await streamSection(sectionId);
          }
          
          // Send completion event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'generation_complete',
            data: {
              projectId,
              message: 'Content generation completed successfully!',
              totalSections: sections.length,
              totalWords: Object.values(demoContent).reduce((sum, section) => sum + section.content.split(' ').length, 0)
            }
          })}\n\n`));
          
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            data: {
              error: 'Demo generation failed',
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          })}\n\n`));
        } finally {
          controller.close();
        }
      };
      
      // Start the demo generation
      processAllSections();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}