import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintReview } from '../blueprint-review';
import type { ContentBlueprint } from '@/lib/types';

// Mock the toast function
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the DnD context for testing
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((array, oldIndex, newIndex) => {
    const result = [...array];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: jest.fn(() => ''),
    },
  },
}));

const mockBlueprint: ContentBlueprint = {
  sections: [
    {
      id: 'section-1',
      heading: 'Introduction',
      goal: 'Introduce the topic',
      subSections: [
        {
          id: 'subsection-1',
          heading: 'Overview',
          keyPoints: ['Point 1', 'Point 2']
        }
      ],
      contentElements: [
        {
          type: 'direct-answer',
          properties: {}
        }
      ],
      dataSources: ['Source 1'],
      order: 0,
      status: 'pending'
    },
    {
      id: 'section-2',
      heading: 'Main Content',
      goal: 'Provide detailed information',
      subSections: [],
      contentElements: [],
      dataSources: [],
      order: 1,
      status: 'pending'
    }
  ],
  seoMetadata: {
    title: 'Test Article',
    metaDescription: 'Test description',
    targetKeywords: ['keyword1', 'keyword2'],
    focusKeyword: 'keyword1'
  },
  estimatedLength: 2000,
  targetKeywords: ['keyword1', 'keyword2']
};

describe('BlueprintReview', () => {
  const mockOnUpdate = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders blueprint with sections', () => {
    render(
      <BlueprintReview
        blueprint={mockBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Blueprint Review & Editing')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
    expect(screen.getByText('Content Sections (2)')).toBeInTheDocument();
  });

  it('displays SEO metadata', () => {
    render(
      <BlueprintReview
        blueprint={mockBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('SEO Strategy')).toBeInTheDocument();
    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getAllByText('keyword1')).toHaveLength(2); // Focus keyword and in target keywords
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('shows save button when changes are made', async () => {
    const user = userEvent.setup();
    
    render(
      <BlueprintReview
        blueprint={mockBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    // Initially, save button should be disabled
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();

    // Make a change by adding a section
    const addSectionButton = screen.getByRole('button', { name: /add section/i });
    await user.click(addSectionButton);

    // Fill in the dialog
    const headingInput = screen.getByLabelText(/section heading/i);
    await user.type(headingInput, 'New Section');

    const addButton = screen.getByRole('button', { name: 'Add Section' });
    await user.click(addButton);

    // Now save button should be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('calls onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <BlueprintReview
        blueprint={mockBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    // Add a section to enable save
    const addSectionButton = screen.getByRole('button', { name: /add section/i });
    await user.click(addSectionButton);

    const headingInput = screen.getByLabelText(/section heading/i);
    await user.type(headingInput, 'New Section');

    const addButton = screen.getByRole('button', { name: 'Add Section' });
    await user.click(addButton);

    // Click save
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('opens add section dialog when add button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <BlueprintReview
        blueprint={mockBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    const addSectionButton = screen.getByRole('button', { name: /add section/i });
    await user.click(addSectionButton);

    expect(screen.getByText('Add New Section')).toBeInTheDocument();
    expect(screen.getByLabelText(/section heading/i)).toBeInTheDocument();
  });

  it('resets changes when reset button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <BlueprintReview
        blueprint={mockBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    // Add a section to make changes
    const addSectionButton = screen.getByRole('button', { name: /add section/i });
    await user.click(addSectionButton);

    const headingInput = screen.getByLabelText(/section heading/i);
    await user.type(headingInput, 'New Section');

    const addButton = screen.getByRole('button', { name: 'Add Section' });
    await user.click(addButton);

    // Reset changes
    const resetButton = screen.getByRole('button', { name: /reset/i });
    await user.click(resetButton);

    // Save button should be disabled again
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();
  });

  it('shows empty state when no sections exist', () => {
    const emptyBlueprint: ContentBlueprint = {
      ...mockBlueprint,
      sections: []
    };

    render(
      <BlueprintReview
        blueprint={emptyBlueprint}
        onUpdate={mockOnUpdate}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('No sections yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first content section to get started')).toBeInTheDocument();
  });
});