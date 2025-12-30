'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Edit3,
  Trash2,
  Check,
  X,
  Plus,
  Minus
} from 'lucide-react';
import type { SubSection } from '@/lib/types';

interface SubSectionEditorProps {
  subSection: SubSection;
  index: number;
  isEditing: boolean;
  onUpdate: (subSection: SubSection) => void;
  onDelete: (subSectionId: string) => void;
}

export function SubSectionEditor({
  subSection,
  index,
  isEditing,
  onUpdate,
  onDelete
}: SubSectionEditorProps) {
  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const [editedSubSection, setEditedSubSection] = useState<SubSection>(subSection);
  const [newKeyPoint, setNewKeyPoint] = useState('');

  const handleSave = () => {
    onUpdate(editedSubSection);
    setIsEditingLocal(false);
  };

  const handleCancel = () => {
    setEditedSubSection(subSection);
    setIsEditingLocal(false);
  };

  const handleAddKeyPoint = () => {
    if (newKeyPoint.trim()) {
      setEditedSubSection({
        ...editedSubSection,
        keyPoints: [...editedSubSection.keyPoints, newKeyPoint.trim()]
      });
      setNewKeyPoint('');
    }
  };

  const handleRemoveKeyPoint = (pointIndex: number) => {
    const updatedKeyPoints = editedSubSection.keyPoints.filter((_, i) => i !== pointIndex);
    setEditedSubSection({
      ...editedSubSection,
      keyPoints: updatedKeyPoints
    });
  };

  const handleKeyPointChange = (pointIndex: number, value: string) => {
    const updatedKeyPoints = editedSubSection.keyPoints.map((point, i) =>
      i === pointIndex ? value : point
    );
    setEditedSubSection({
      ...editedSubSection,
      keyPoints: updatedKeyPoints
    });
  };

  const canEdit = isEditing || isEditingLocal;

  return (
    <Card className="border-l-4 border-l-blue-200">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Sub-section Number */}
          <div className="flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-600 rounded text-xs font-medium flex-shrink-0 mt-0.5">
            {index + 1}
          </div>
          
          {/* Sub-section Content */}
          <div className="flex-1 min-w-0">
            {canEdit ? (
              <div className="space-y-3">
                <Input
                  value={editedSubSection.heading}
                  onChange={(e) => setEditedSubSection({
                    ...editedSubSection,
                    heading: e.target.value
                  })}
                  placeholder="Sub-section heading"
                  className="font-medium"
                />
                
                {/* Key Points Editor */}
                <div>
                  <h5 className="text-sm font-medium mb-2">Key Points</h5>
                  
                  {editedSubSection.keyPoints.map((point, pointIndex) => (
                    <div key={pointIndex} className="flex items-center gap-2 mb-2">
                      <Input
                        value={point}
                        onChange={(e) => handleKeyPointChange(pointIndex, e.target.value)}
                        placeholder="Key point"
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveKeyPoint(pointIndex)}
                        className="h-8 w-8 p-0 text-red-600"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={newKeyPoint}
                      onChange={(e) => setNewKeyPoint(e.target.value)}
                      placeholder="Add new key point"
                      className="text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyPoint();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddKeyPoint}
                      disabled={!newKeyPoint.trim()}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-sm mb-2">{subSection.heading}</h4>
                
                {subSection.keyPoints.length > 0 ? (
                  <div className="space-y-1">
                    {subSection.keyPoints.map((point, pointIndex) => (
                      <div key={pointIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No key points</p>
                )}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  className="h-7 w-7 p-0"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingLocal(true)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(subSection.id)}
                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}