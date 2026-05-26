'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Zap, 
  FileText, 
  ChevronRight,
  ChevronDown,
  Target,
  Hash,
  List
} from 'lucide-react';
import type { ContentBlueprint, ContentSection } from '@/lib/types';

interface BlueprintSidebarProps {
  blueprint: ContentBlueprint;
  currentSectionId?: string;
  sectionProgress: Record<string, {
    status: 'pending' | 'writing' | 'completed';
    wordCount: number;
  }>;
  onSectionSelect: (sectionId: string) => void;
  className?: string;
}

export function BlueprintSidebar({
  blueprint,
  currentSectionId,
  sectionProgress,
  onSectionSelect,
  className = ''
}: BlueprintSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  const toggleSectionExpansion = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };
  
  const getSectionStatus = (sectionId: string) => {
    return sectionProgress[sectionId]?.status || 'pending';
  };
  
  const getSectionWordCount = (sectionId: string) => {
    return sectionProgress[sectionId]?.wordCount || 0;
  };
  
  const getStatusIcon = (status: 'pending' | 'writing' | 'completed') => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'writing':
        return <Zap className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Circle className="h-4 w-4 text-white/40" />;
    }
  };
  
  const getStatusColor = (status: 'pending' | 'writing' | 'completed') => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 border-green-500/25';
      case 'writing':
        return 'bg-primary/10 border-primary/30';
      default:
        return 'bg-white/4 border-white/10';
    }
  };
  
  // Calculate overall progress
  const totalSections = blueprint.sections.length;
  const completedSections = blueprint.sections.filter(
    section => getSectionStatus(section.id) === 'completed'
  ).length;
  const progressPercentage = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
  
  const totalWords = blueprint.sections.reduce(
    (sum, section) => sum + getSectionWordCount(section.id), 
    0
  );
  
  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Content Blueprint
        </CardTitle>
        
        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
          
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="text-center">
              <div className="font-medium text-green-600">{completedSections}</div>
              <div>Complete</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-600">
                {blueprint.sections.filter(s => getSectionStatus(s.id) === 'writing').length}
              </div>
              <div>Writing</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-white/60">
                {totalSections - completedSections}
              </div>
              <div>Remaining</div>
            </div>
          </div>
          
          {totalWords > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              {totalWords.toLocaleString()} words generated
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {/* SEO Metadata */}
            {blueprint.seoMetadata && (
              <div className="mb-6">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  SEO Strategy
                </h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium">Focus:</span> {blueprint.seoMetadata.focusKeyword}
                  </div>
                  {blueprint.seoMetadata.targetKeywords.length > 0 && (
                    <div>
                      <span className="font-medium">Keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {blueprint.seoMetadata.targetKeywords.slice(0, 5).map((keyword, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                        {blueprint.seoMetadata.targetKeywords.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{blueprint.seoMetadata.targetKeywords.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Sections */}
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <List className="h-4 w-4" />
                Sections ({blueprint.sections.length})
              </h4>
              
              <div className="space-y-2">
                {blueprint.sections.map((section, index) => {
                  const status = getSectionStatus(section.id);
                  const wordCount = getSectionWordCount(section.id);
                  const isExpanded = expandedSections.has(section.id);
                  const isSelected = currentSectionId === section.id;
                  
                  return (
                    <div key={section.id} className="space-y-2">
                      {/* Section header */}
                      <div
                        className={`
                          p-3 rounded-lg border cursor-pointer transition-all
                          ${getStatusColor(status)}
                          ${isSelected ? 'ring-2 ring-primary/50' : ''}
                          hover:shadow-sm
                        `}
                        onClick={() => onSectionSelect(section.id)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                              {index + 1}.
                            </span>
                            {getStatusIcon(status)}
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-sm truncate">
                                {section.heading}
                              </h5>
                              {section.goal && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {section.goal}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {wordCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {wordCount}w
                              </Badge>
                            )}
                            
                            {section.subSections.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSectionExpansion(section.id);
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Sub-sections */}
                      {isExpanded && section.subSections.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {section.subSections.map((subSection, subIndex) => (
                            <div 
                              key={subSection.id}
                              className="p-2 rounded border border-white/8 bg-white/4"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {index + 1}.{subIndex + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <h6 className="text-sm font-medium">
                                    {subSection.heading}
                                  </h6>
                                  {subSection.keyPoints.length > 0 && (
                                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                      {subSection.keyPoints.slice(0, 3).map((point, pointIndex) => (
                                        <li key={pointIndex} className="flex items-start gap-1">
                                          <span className="text-white/40">•</span>
                                          <span className="line-clamp-1">{point}</span>
                                        </li>
                                      ))}
                                      {subSection.keyPoints.length > 3 && (
                                        <li className="text-white/40 text-xs">
                                          +{subSection.keyPoints.length - 3} more points
                                        </li>
                                      )}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}