import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DashboardContent } from '../dashboard-content';
import { Project } from '@/lib/types';
import { User } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
    })),
    removeChannel: jest.fn(),
  })),
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
};

const mockProjects: Project[] = [
  {
    id: 'project-1',
    user_id: 'user-123',
    topic: 'How to Build a SaaS Application',
    status: 'completed',
    competitor_urls: ['https://example1.com', 'https://example2.com'],
    tone: 'professional',
    format: 'how-to',
    brand_document_path: null,
    openai_thread_id: null,
    blueprint: null,
    generated_content: null,
    seo_metadata: null,
    token_usage: null,
    cost_breakdown: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 'project-2',
    user_id: 'user-123',
    topic: 'Best Marketing Strategies for 2024',
    status: 'writing',
    competitor_urls: ['https://marketing1.com'],
    tone: 'witty',
    format: 'listicle',
    brand_document_path: '/path/to/brand.pdf',
    openai_thread_id: null,
    blueprint: null,
    generated_content: null,
    seo_metadata: null,
    token_usage: null,
    cost_breakdown: null,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
  },
  {
    id: 'project-3',
    user_id: 'user-123',
    topic: 'Data-Driven Decision Making',
    status: 'error',
    competitor_urls: ['https://data1.com', 'https://data2.com', 'https://data3.com'],
    tone: 'data-driven',
    format: 'case-study',
    brand_document_path: null,
    openai_thread_id: null,
    blueprint: null,
    generated_content: null,
    seo_metadata: null,
    token_usage: null,
    cost_breakdown: null,
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z',
  },
];

describe('DashboardContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: { projects: mockProjects },
      }),
    });
  });

  it('renders dashboard with project statistics', () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Check statistics cards
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Total projects count
    
    expect(screen.getByText('Active Projects')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument(); // Active projects description
    
    expect(screen.getByText('Completed Projects')).toBeInTheDocument();
    expect(screen.getByText('Ready to export')).toBeInTheDocument(); // Completed projects description
    
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Need attention')).toBeInTheDocument(); // Error projects description
  });

  it('displays project cards with correct information', () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Check if project topics are displayed
    expect(screen.getByText('How to Build a SaaS Application')).toBeInTheDocument();
    expect(screen.getByText('Best Marketing Strategies for 2024')).toBeInTheDocument();
    expect(screen.getByText('Data-Driven Decision Making')).toBeInTheDocument();
    
    // Check status badges - look for the actual status text in badges
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('writing')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('filters projects by search term', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    const searchInput = screen.getByPlaceholderText('Search projects by topic or competitor URL...');
    fireEvent.change(searchInput, { target: { value: 'SaaS' } });
    
    await waitFor(() => {
      expect(screen.getByText('How to Build a SaaS Application')).toBeInTheDocument();
      expect(screen.queryByText('Best Marketing Strategies for 2024')).not.toBeInTheDocument();
      expect(screen.queryByText('Data-Driven Decision Making')).not.toBeInTheDocument();
    });
  });

  it('filters projects by status', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Find the status select trigger
    const statusTrigger = screen.getByRole('combobox', { name: /status/i });
    fireEvent.click(statusTrigger);
    
    // Select "Completed" status
    const completedOption = screen.getByRole('option', { name: /completed/i });
    fireEvent.click(completedOption);
    
    await waitFor(() => {
      expect(screen.getByText('How to Build a SaaS Application')).toBeInTheDocument();
      expect(screen.queryByText('Best Marketing Strategies for 2024')).not.toBeInTheDocument();
      expect(screen.queryByText('Data-Driven Decision Making')).not.toBeInTheDocument();
    });
  });

  it('filters projects by tone', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Find the tone select trigger
    const toneSelect = screen.getByRole('combobox', { name: /tone/i });
    fireEvent.click(toneSelect);
    
    // Select "Witty" tone
    const wittyOption = screen.getByRole('option', { name: /witty/i });
    fireEvent.click(wittyOption);
    
    await waitFor(() => {
      expect(screen.queryByText('How to Build a SaaS Application')).not.toBeInTheDocument();
      expect(screen.getByText('Best Marketing Strategies for 2024')).toBeInTheDocument();
      expect(screen.queryByText('Data-Driven Decision Making')).not.toBeInTheDocument();
    });
  });

  it('sorts projects correctly', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Find the sort by select
    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    fireEvent.click(sortSelect);
    
    // Select "Topic" sorting
    const topicOption = screen.getByRole('option', { name: /topic/i });
    fireEvent.click(topicOption);
    
    await waitFor(() => {
      const projectTitles = screen.getAllByRole('heading', { level: 3 });
      // When sorted by topic alphabetically, "Best Marketing..." should come first
      expect(projectTitles[0]).toHaveTextContent('Best Marketing Strategies for 2024');
    });
  });

  it('shows empty state when no projects match filters', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    const searchInput = screen.getByPlaceholderText('Search projects by topic or competitor URL...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent project' } });
    
    await waitFor(() => {
      expect(screen.getByText('No projects match your filters')).toBeInTheDocument();
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });
  });

  it('clears filters when clear button is clicked', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Apply a search filter
    const searchInput = screen.getByPlaceholderText('Search projects by topic or competitor URL...');
    fireEvent.change(searchInput, { target: { value: 'SaaS' } });
    
    // Click clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('How to Build a SaaS Application')).toBeInTheDocument();
      expect(screen.getByText('Best Marketing Strategies for 2024')).toBeInTheDocument();
      expect(screen.getByText('Data-Driven Decision Making')).toBeInTheDocument();
    });
  });

  it('refreshes projects when refresh button is clicked', async () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/projects');
    });
  });

  it('shows create form when new project button is clicked', () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    const newProjectButton = screen.getByText('New Project');
    fireEvent.click(newProjectButton);
    
    expect(screen.getAllByText('Create New Project')[0]).toBeInTheDocument();
  });

  it('displays correct project metadata', () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Check that project details are displayed (look for capitalized versions)
    expect(screen.getByText('professional', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('how to', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('2 URLs')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument(); // Brand document for first project
    
    expect(screen.getByText('witty', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('listicle', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 URLs')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument(); // Brand document for second project
  });

  it('shows export button for completed projects', () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    // Should show export button for completed project
    const exportButtons = screen.getAllByText('Export Content');
    expect(exportButtons).toHaveLength(1);
  });

  it('shows view project links for all projects', () => {
    render(<DashboardContent user={mockUser} initialProjects={mockProjects} />);
    
    const viewProjectLinks = screen.getAllByText('View Project');
    expect(viewProjectLinks).toHaveLength(3);
  });
});