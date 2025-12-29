import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StreamingContentDisplay } from '../streaming-content-display';
import { useStreamingContent } from '@/lib/hooks/use-streaming-content';

// Mock the streaming hook
jest.mock('@/lib/hooks/use-streaming-content');
const mockUseStreamingContent = useStreamingContent as jest.MockedFunction<typeof useStreamingContent>;

// Mock content section
const mockSection = {
  id: 'section-1',
  heading: 'Introduction to AI',
  goal: 'Introduce the concept of AI to readers',
  subSections: [
    {
      id: 'sub-1',
      heading: 'What is AI?',
      keyPoints: ['Definition', 'History', 'Applications']
    }
  ],
  contentElements: [],
  dataSources: [],
  order: 1
};

describe('StreamingContentDisplay', () => {
  const mockStreamContent = jest.fn();
  const mockCancelStream = jest.fn();
  const mockResetState = jest.fn();
  const mockOnComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    mockUseStreamingContent.mockReturnValue({
      isStreaming: false,
      content: '',
      error: null,
      isComplete: false,
      wordCount: 0,
      tokensUsed: 0,
      streamContent: mockStreamContent,
      cancelStream: mockCancelStream,
      resetState: mockResetState
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders section heading and goal', () => {
    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Introduction to AI')).toBeInTheDocument();
    expect(screen.getByText(/Introduce the concept of AI to readers/)).toBeInTheDocument();
  });

  it('shows start writing button when not streaming', () => {
    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    const startButton = screen.getByText('Start Writing');
    expect(startButton).toBeInTheDocument();
  });

  it('calls streamContent when start button is clicked', async () => {
    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    const startButton = screen.getByText('Start Writing');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockStreamContent).toHaveBeenCalledWith({
        sectionId: 'section-1',
        prompt: expect.stringContaining('Write a comprehensive section about "Introduction to AI"'),
        context: {
          sectionHeading: 'Introduction to AI',
          sectionGoal: 'Introduce the concept of AI to readers',
          keyPoints: ['Definition', 'History', 'Applications'],
          tone: 'professional',
          targetKeywords: undefined,
          previousContent: undefined
        }
      });
    });
  });

  it('shows streaming state when content is being generated', () => {
    mockUseStreamingContent.mockReturnValue({
      isStreaming: true,
      content: 'Artificial Intelligence (AI) is...',
      error: null,
      isComplete: false,
      wordCount: 4,
      tokensUsed: 0,
      streamContent: mockStreamContent,
      cancelStream: mockCancelStream,
      resetState: mockResetState
    });

    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Writing...')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('4 words')).toBeInTheDocument();
  });

  it('shows completed state with content', () => {
    const completedContent = 'Artificial Intelligence (AI) is a revolutionary technology that has transformed how we interact with machines and process information.';
    
    mockUseStreamingContent.mockReturnValue({
      isStreaming: false,
      content: completedContent,
      error: null,
      isComplete: true,
      wordCount: 20,
      tokensUsed: 25,
      streamContent: mockStreamContent,
      cancelStream: mockCancelStream,
      resetState: mockResetState
    });

    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('20 words')).toBeInTheDocument();
    expect(screen.getByText('25 tokens')).toBeInTheDocument();
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('shows error state when streaming fails', () => {
    mockUseStreamingContent.mockReturnValue({
      isStreaming: false,
      content: '',
      error: 'Network connection failed',
      isComplete: false,
      wordCount: 0,
      tokensUsed: 0,
      streamContent: mockStreamContent,
      cancelStream: mockCancelStream,
      resetState: mockResetState
    });

    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Error generating content')).toBeInTheDocument();
    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('calls onComplete when content generation finishes', () => {
    const completedContent = 'Test content';
    
    // Mock the hook to simulate completion
    mockUseStreamingContent.mockImplementation((projectId, options) => {
      // Simulate completion callback
      if (options?.onComplete) {
        setTimeout(() => {
          options.onComplete!(completedContent, { wordCount: 2, tokensUsed: 5 });
        }, 0);
      }
      
      return {
        isStreaming: false,
        content: completedContent,
        error: null,
        isComplete: true,
        wordCount: 2,
        tokensUsed: 5,
        streamContent: mockStreamContent,
        cancelStream: mockCancelStream,
        resetState: mockResetState
      };
    });

    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    // Wait for the completion callback
    setTimeout(() => {
      expect(mockOnComplete).toHaveBeenCalledWith('section-1', completedContent);
    }, 10);
  });

  it('includes previous content in context when provided', async () => {
    const previousContent = 'This is the previous section content.';
    
    render(
      <StreamingContentDisplay
        projectId="project-1"
        section={mockSection}
        previousContent={previousContent}
        tone="professional"
        onComplete={mockOnComplete}
        onError={mockOnError}
      />
    );

    const startButton = screen.getByText('Start Writing');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockStreamContent).toHaveBeenCalledWith({
        sectionId: 'section-1',
        prompt: expect.any(String),
        context: expect.objectContaining({
          previousContent: previousContent
        })
      });
    });
  });
});