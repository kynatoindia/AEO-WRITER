# Blueprint Review Components

This directory contains the interactive Blueprint Review interface components that allow users to review, edit, and manage content blueprints with drag-and-drop functionality.

## Components

### BlueprintReview

The main component that provides a comprehensive interface for reviewing and editing content blueprints.

**Features:**
- Interactive section cards with drag-and-drop reordering
- Inline editing capabilities for sections and sub-sections
- Section addition and deletion
- SEO metadata display
- Save/reset functionality with change tracking
- Empty state handling

**Props:**
```typescript
interface BlueprintReviewProps {
  blueprint: ContentBlueprint;
  onUpdate: (blueprint: ContentBlueprint) => void;
  onSave: (blueprint: ContentBlueprint) => void;
  isLoading?: boolean;
  className?: string;
}
```

**Usage:**
```tsx
import { BlueprintReview } from '@/components/blueprint';

<BlueprintReview
  blueprint={blueprint}
  onUpdate={handleUpdate}
  onSave={handleSave}
  isLoading={false}
/>
```

### SortableBlueprintSection

A sortable section component that supports drag-and-drop reordering and inline editing.

**Features:**
- Drag-and-drop handle with visual feedback
- Expandable/collapsible content
- Inline editing mode for section details
- Sub-section management
- Content elements and data sources management
- Delete functionality

**Props:**
```typescript
interface SortableBlueprintSectionProps {
  section: ContentSection;
  index: number;
  onUpdate: (section: ContentSection) => void;
  onDelete: (sectionId: string) => void;
  isLoading?: boolean;
}
```

### SubSectionEditor

A component for editing individual sub-sections within a content section.

**Features:**
- Inline editing of sub-section headings
- Key points management (add/edit/remove)
- Individual edit mode toggle
- Delete functionality

**Props:**
```typescript
interface SubSectionEditorProps {
  subSection: SubSection;
  index: number;
  isEditing: boolean;
  onUpdate: (subSection: SubSection) => void;
  onDelete: (subSectionId: string) => void;
}
```

### AddSectionDialog

A modal dialog for adding new content sections to the blueprint.

**Features:**
- Form-based section creation
- Sub-section addition
- Content elements selection
- Data sources management
- Form validation

**Props:**
```typescript
interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (section: Omit<ContentSection, 'id' | 'order'>) => void;
}
```

## Dependencies

The components use the following external libraries:

- `@dnd-kit/core` - Core drag-and-drop functionality
- `@dnd-kit/sortable` - Sortable list implementation
- `@dnd-kit/utilities` - Utility functions for drag-and-drop
- `sonner` - Toast notifications
- `lucide-react` - Icons

## Key Features

### Drag-and-Drop Reordering

Sections can be reordered by dragging the grip handle. The component uses `@dnd-kit` for accessible drag-and-drop functionality with keyboard support.

### Inline Editing

- **Section Level**: Edit heading, goal, content elements, and data sources
- **Sub-section Level**: Edit heading and key points
- **Real-time Updates**: Changes are reflected immediately in the UI

### Change Tracking

The component tracks changes and enables/disables the save button accordingly. Users can reset changes to return to the original state.

### Content Elements

Supports various content element types:
- Direct Answer
- Bullet Points
- Comparison Table
- FAQ
- Code Block

### Data Sources

Manage data sources that inform each section's content, such as:
- Competitor analysis
- Research papers
- Internal data
- External APIs

## Accessibility

- Keyboard navigation support for drag-and-drop
- ARIA labels and roles
- Focus management
- Screen reader friendly

## Testing

The components include comprehensive tests covering:
- Rendering with different blueprint states
- User interactions (editing, adding, deleting)
- Drag-and-drop functionality (mocked)
- Change tracking and save/reset functionality
- Empty states

Run tests with:
```bash
npm test -- --testPathPatterns=blueprint-review.test.tsx
```

## Demo

A demo page is available at `/blueprint-demo` that showcases all the component features with sample data.

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **2.2**: Interactive blueprint review with section cards ✅
- **2.3**: Drag-and-drop reordering functionality ✅
- **2.4**: Inline editing capabilities for sections and sub-sections ✅
- **2.5**: Section addition and deletion features ✅

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Operations**: Select multiple sections for bulk actions
2. **Templates**: Pre-defined section templates for common content types
3. **Collaboration**: Real-time collaborative editing
4. **Version History**: Track and revert to previous blueprint versions
5. **AI Suggestions**: AI-powered suggestions for section improvements
6. **Export Options**: Export blueprint to various formats (JSON, PDF, etc.)