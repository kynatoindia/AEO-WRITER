'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  FileText, 
  Target,
  Hash,
  Save,
  RotateCcw
} from 'lucide-react';
import type { ContentBlueprint, ContentSection } from '@/lib/types';
import { SortableBlueprintSection } from './sortable-blueprint-section';
import { AddSectionDialog } from './add-section-dialog';
import { toast } from 'sonner';

interface BlueprintReviewProps {
  blueprint: ContentBlueprint;
  onUpdate: (blueprint: ContentBlueprint) => void;
  onSave: (blueprint: ContentBlueprint) => void;
  isLoading?: boolean;
  className?: string;
}

export function BlueprintReview({
  blueprint,
  onUpdate,
  onSave,
  isLoading = false,
  className = ''
}: BlueprintReviewProps) {
  const [localBlueprint, setLocalBlueprint] = useState<ContentBlueprint>(blueprint);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateLocalBlueprint = useCallback((updatedBlueprint: ContentBlueprint) => {
    setLocalBlueprint(updatedBlueprint);
    setHasChanges(true);
    onUpdate(updatedBlueprint);
  }, [onUpdate]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localBlueprint.sections.findIndex(section => section.id === active.id);
      const newIndex = localBlueprint.sections.findIndex(section => section.id === over.id);
      
      const reorderedSections = arrayMove(localBlueprint.sections, oldIndex, newIndex).map(
        (section, index) => ({ ...section, order: index })
      );
      
      const updatedBlueprint = {
        ...localBlueprint,
        sections: reorderedSections
      };
      
      updateLocalBlueprint(updatedBlueprint);
      toast.success('Section order updated');
    }
  }, [localBlueprint, updateLocalBlueprint]);

  const handleSectionUpdate = useCallback((updatedSection: ContentSection) => {
    const updatedSections = localBlueprint.sections.map(section =>
      section.id === updatedSection.id ? updatedSection : section
    );
    
    const updatedBlueprint = {
      ...localBlueprint,
      sections: updatedSections
    };
    
    updateLocalBlueprint(updatedBlueprint);
  }, [localBlueprint, updateLocalBlueprint]);

  const handleSectionDelete = useCallback((sectionId: string) => {
    const updatedSections = localBlueprint.sections
      .filter(section => section.id !== sectionId)
      .map((section, index) => ({ ...section, order: index }));
    
    const updatedBlueprint = {
      ...localBlueprint,
      sections: updatedSections
    };
    
    updateLocalBlueprint(updatedBlueprint);
    toast.success('Section deleted');
  }, [localBlueprint, updateLocalBlueprint]);

  const handleAddSection = useCallback((newSection: Omit<ContentSection, 'id' | 'order'>) => {
    const sectionWithId: ContentSection = {
      ...newSection,
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: localBlueprint.sections.length
    };
    
    const updatedBlueprint = {
      ...localBlueprint,
      sections: [...localBlueprint.sections, sectionWithId]
    };
    
    updateLocalBlueprint(updatedBlueprint);
    setShowAddSection(false);
    toast.success('Section added');
  }, [localBlueprint, updateLocalBlueprint]);

  const handleSave = useCallback(() => {
    onSave(localBlueprint);
    setHasChanges(false);
    toast.success('Blueprint saved');
  }, [localBlueprint, onSave]);

  const handleReset = useCallback(() => {
    setLocalBlueprint(blueprint);
    setHasChanges(false);
    onUpdate(blueprint);
    toast.info('Changes reset');
  }, [blueprint, onUpdate]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Blueprint Review & Editing
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
              
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isLoading}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
          
          {/* SEO Metadata */}
          {localBlueprint.seoMetadata && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                SEO Strategy
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Title:</span>
                  <p className="text-muted-foreground mt-1">{localBlueprint.seoMetadata.title}</p>
                </div>
                <div>
                  <span className="font-medium">Focus Keyword:</span>
                  <p className="text-muted-foreground mt-1">{localBlueprint.seoMetadata.focusKeyword}</p>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium">Meta Description:</span>
                  <p className="text-muted-foreground mt-1">{localBlueprint.seoMetadata.metaDescription}</p>
                </div>
                {localBlueprint.seoMetadata.targetKeywords.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="font-medium">Target Keywords:</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {localBlueprint.seoMetadata.targetKeywords.map((keyword, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Sections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Content Sections ({localBlueprint.sections.length})
            </CardTitle>
            
            <Button
              onClick={() => setShowAddSection(true)}
              size="sm"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-[600px]">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localBlueprint.sections.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {localBlueprint.sections.map((section, index) => (
                    <SortableBlueprintSection
                      key={section.id}
                      section={section}
                      index={index}
                      onUpdate={handleSectionUpdate}
                      onDelete={handleSectionDelete}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            
            {localBlueprint.sections.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No sections yet</p>
                <p className="text-sm mb-4">Add your first content section to get started</p>
                <Button onClick={() => setShowAddSection(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Section Dialog */}
      <AddSectionDialog
        open={showAddSection}
        onOpenChange={setShowAddSection}
        onAdd={handleAddSection}
      />
    </div>
  );
}