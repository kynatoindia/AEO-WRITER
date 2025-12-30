'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus,
  X,
  Target,
  List,
  Database
} from 'lucide-react';
import type { ContentSection, SubSection, ContentElement } from '@/lib/types';

interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (section: Omit<ContentSection, 'id' | 'order'>) => void;
}

export function AddSectionDialog({
  open,
  onOpenChange,
  onAdd
}: AddSectionDialogProps) {
  const [heading, setHeading] = useState('');
  const [goal, setGoal] = useState('');
  const [subSections, setSubSections] = useState<Omit<SubSection, 'id'>[]>([]);
  const [contentElements, setContentElements] = useState<ContentElement[]>([]);
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [newSubSectionHeading, setNewSubSectionHeading] = useState('');
  const [newDataSource, setNewDataSource] = useState('');

  const resetForm = () => {
    setHeading('');
    setGoal('');
    setSubSections([]);
    setContentElements([]);
    setDataSources([]);
    setNewSubSectionHeading('');
    setNewDataSource('');
  };

  const handleSubmit = () => {
    if (!heading.trim()) return;

    const newSection: Omit<ContentSection, 'id' | 'order'> = {
      heading: heading.trim(),
      goal: goal.trim(),
      subSections: subSections.map((sub, index) => ({
        ...sub,
        id: `temp-subsection-${index}-${Date.now()}`
      })),
      contentElements,
      dataSources,
      status: 'pending'
    };

    onAdd(newSection);
    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleAddSubSection = () => {
    if (newSubSectionHeading.trim()) {
      setSubSections([
        ...subSections,
        {
          heading: newSubSectionHeading.trim(),
          keyPoints: []
        }
      ]);
      setNewSubSectionHeading('');
    }
  };

  const handleRemoveSubSection = (index: number) => {
    setSubSections(subSections.filter((_, i) => i !== index));
  };

  const handleAddContentElement = (type: string) => {
    const newElement: ContentElement = {
      type: type as any,
      properties: {}
    };
    setContentElements([...contentElements, newElement]);
  };

  const handleRemoveContentElement = (index: number) => {
    setContentElements(contentElements.filter((_, i) => i !== index));
  };

  const handleAddDataSource = () => {
    if (newDataSource.trim() && !dataSources.includes(newDataSource.trim())) {
      setDataSources([...dataSources, newDataSource.trim()]);
      setNewDataSource('');
    }
  };

  const handleRemoveDataSource = (index: number) => {
    setDataSources(dataSources.filter((_, i) => i !== index));
  };

  const contentElementTypes = [
    { value: 'direct-answer', label: 'Direct Answer' },
    { value: 'bullet-points', label: 'Bullet Points' },
    { value: 'comparison-table', label: 'Comparison Table' },
    { value: 'faq', label: 'FAQ' },
    { value: 'code-block', label: 'Code Block' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Section
          </DialogTitle>
          <DialogDescription>
            Create a new content section with sub-sections, elements, and data sources.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="heading">Section Heading *</Label>
              <Input
                id="heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="Enter section heading"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="goal">Section Goal</Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe the purpose and goal of this section"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          {/* Sub-sections */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <List className="h-4 w-4" />
              <Label className="text-sm font-medium">Sub-sections</Label>
            </div>

            {subSections.length > 0 && (
              <div className="space-y-2 mb-3">
                {subSections.map((subSection, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm flex-1">{subSection.heading}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSubSection(index)}
                      className="h-6 w-6 p-0 text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newSubSectionHeading}
                onChange={(e) => setNewSubSectionHeading(e.target.value)}
                placeholder="Sub-section heading"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubSection();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddSubSection}
                disabled={!newSubSectionHeading.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content Elements */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4" />
              <Label className="text-sm font-medium">Content Elements</Label>
            </div>

            {contentElements.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {contentElements.map((element, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {element.type.replace('-', ' ')}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveContentElement(index)}
                      className="h-5 w-5 p-0 text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {contentElementTypes.map(type => (
                <Button
                  key={type.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddContentElement(type.value)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4" />
              <Label className="text-sm font-medium">Data Sources</Label>
            </div>

            {dataSources.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {dataSources.map((source, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {source}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveDataSource(index)}
                      className="h-5 w-5 p-0 text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newDataSource}
                onChange={(e) => setNewDataSource(e.target.value)}
                placeholder="Data source (e.g., competitor analysis, research paper)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDataSource();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddDataSource}
                disabled={!newDataSource.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!heading.trim()}>
            Add Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}