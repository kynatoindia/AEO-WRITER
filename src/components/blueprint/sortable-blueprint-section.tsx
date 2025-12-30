'use client';

import { useState } from 'react';
import {
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  GripVertical,
  Edit3,
  Trash2,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  Target,
  List,
  Database
} from 'lucide-react';
import type { ContentSection, SubSection } from '@/lib/types';
import { SubSectionEditor } from './sub-section-editor';

interface SortableBlueprintSectionProps {
  section: ContentSection;
  index: number;
  onUpdate: (section: ContentSection) => void;
  onDelete: (sectionId: string) => void;
  isLoading?: boolean;
}

export function SortableBlueprintSection({
  section,
  index,
  onUpdate,
  onDelete,
  isLoading = false
}: SortableBlueprintSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedSection, setEditedSection] = useState<ContentSection>(section);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = () => {
    onUpdate(editedSection);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSection(section);
    setIsEditing(false);
  };

  const handleSubSectionUpdate = (updatedSubSection: SubSection) => {
    const updatedSubSections = editedSection.subSections.map(sub =>
      sub.id === updatedSubSection.id ? updatedSubSection : sub
    );
    
    setEditedSection({
      ...editedSection,
      subSections: updatedSubSections
    });
  };

  const handleSubSectionDelete = (subSectionId: string) => {
    const updatedSubSections = editedSection.subSections.filter(
      sub => sub.id !== subSectionId
    );
    
    setEditedSection({
      ...editedSection,
      subSections: updatedSubSections
    });
  };

  const handleAddSubSection = () => {
    const newSubSection: SubSection = {
      id: `subsection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      heading: 'New Sub-section',
      keyPoints: []
    };
    
    setEditedSection({
      ...editedSection,
      subSections: [...editedSection.subSections, newSubSection]
    });
  };

  const handleContentElementAdd = (elementType: string) => {
    const newElement = {
      type: elementType as any,
      properties: {}
    };
    
    setEditedSection({
      ...editedSection,
      contentElements: [...editedSection.contentElements, newElement]
    });
  };

  const handleContentElementRemove = (index: number) => {
    const updatedElements = editedSection.contentElements.filter((_, i) => i !== index);
    setEditedSection({
      ...editedSection,
      contentElements: updatedElements
    });
  };

  const handleDataSourceAdd = (source: string) => {
    if (source.trim() && !editedSection.dataSources.includes(source.trim())) {
      setEditedSection({
        ...editedSection,
        dataSources: [...editedSection.dataSources, source.trim()]
      });
    }
  };

  const handleDataSourceRemove = (index: number) => {
    const updatedSources = editedSection.dataSources.filter((_, i) => i !== index);
    setEditedSection({
      ...editedSection,
      dataSources: updatedSources
    });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`
        transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg scale-105' : ''}
        ${isEditing ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
      `}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing mt-1"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          
          {/* Section Number */}
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex-shrink-0 mt-0.5">
            {index + 1}
          </div>
          
          {/* Section Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editedSection.heading}
                  onChange={(e) => setEditedSection({
                    ...editedSection,
                    heading: e.target.value
                  })}
                  placeholder="Section heading"
                  className="font-medium"
                />
                <Textarea
                  value={editedSection.goal}
                  onChange={(e) => setEditedSection({
                    ...editedSection,
                    goal: e.target.value
                  })}
                  placeholder="Section goal or purpose"
                  rows={2}
                />
              </div>
            ) : (
              <div>
                <h3 className="font-medium text-lg mb-1">{section.heading}</h3>
                {section.goal && (
                  <p className="text-sm text-muted-foreground mb-2">{section.goal}</p>
                )}
                
                {/* Section Stats */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <List className="h-3 w-3" />
                    {section.subSections.length} sub-sections
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {section.contentElements.length} elements
                  </span>
                  <span className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    {section.dataSources.length} sources
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={isLoading}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(section.id)}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      {/* Expanded Content */}
      {(isExpanded || isEditing) && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Sub-sections */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">Sub-sections</h4>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddSubSection}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Sub-section
                  </Button>
                )}
              </div>
              
              {editedSection.subSections.length > 0 ? (
                <div className="space-y-2">
                  {editedSection.subSections.map((subSection, subIndex) => (
                    <SubSectionEditor
                      key={subSection.id}
                      subSection={subSection}
                      index={subIndex}
                      isEditing={isEditing}
                      onUpdate={handleSubSectionUpdate}
                      onDelete={handleSubSectionDelete}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No sub-sections</p>
              )}
            </div>
            
            {/* Content Elements */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">Content Elements</h4>
                {isEditing && (
                  <div className="flex gap-1">
                    {['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block'].map(type => (
                      <Button
                        key={type}
                        size="sm"
                        variant="outline"
                        onClick={() => handleContentElementAdd(type)}
                        className="text-xs"
                      >
                        {type.replace('-', ' ')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              
              {editedSection.contentElements.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editedSection.contentElements.map((element, elementIndex) => (
                    <div key={elementIndex} className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {element.type.replace('-', ' ')}
                      </Badge>
                      {isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleContentElementRemove(elementIndex)}
                          className="h-5 w-5 p-0 text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No content elements</p>
              )}
            </div>
            
            {/* Data Sources */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">Data Sources</h4>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const source = prompt('Enter data source:');
                      if (source) handleDataSourceAdd(source);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Source
                  </Button>
                )}
              </div>
              
              {editedSection.dataSources.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editedSection.dataSources.map((source, sourceIndex) => (
                    <div key={sourceIndex} className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {source}
                      </Badge>
                      {isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDataSourceRemove(sourceIndex)}
                          className="h-5 w-5 p-0 text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No data sources</p>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}