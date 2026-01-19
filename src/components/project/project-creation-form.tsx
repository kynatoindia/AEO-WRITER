'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { ContentTone, ContentFormat, Project } from '@/lib/types';

interface ProjectCreationFormProps {
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
}

interface FormData {
  topic: string;
  tone: ContentTone | '';
  format: ContentFormat | '';
  brandDocument: File | null;
}

interface FormErrors {
  topic?: string;
  tone?: string;
  format?: string;
  brandDocument?: string;
}

export function ProjectCreationForm({ onSuccess, onCancel }: ProjectCreationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState<FormData>({
    topic: '',
    tone: '',
    format: '',
    brandDocument: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Topic validation
    if (!formData.topic.trim()) {
      newErrors.topic = 'Topic is required';
    } else if (formData.topic.length < 3) {
      newErrors.topic = 'Topic must be at least 3 characters long';
    } else if (formData.topic.length > 200) {
      newErrors.topic = 'Topic must be less than 200 characters';
    }

    // No competitor URL validation needed - AI handles discovery automatically

    // Tone validation
    if (!formData.tone) {
      newErrors.tone = 'Please select a tone';
    }

    // Format validation
    if (!formData.format) {
      newErrors.format = 'Please select a format';
    }

    // Brand document validation
    if (formData.brandDocument) {
      if (formData.brandDocument.size > 10 * 1024 * 1024) {
        newErrors.brandDocument = 'File size must be less than 10MB';
      } else if (formData.brandDocument.type !== 'application/pdf') {
        newErrors.brandDocument = 'Only PDF files are allowed';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, brandDocument: file }));
    }
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, brandDocument: null }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('topic', formData.topic);
      submitData.append('tone', formData.tone);
      submitData.append('format', formData.format);
      
      // Only append brandDocument if a file is selected
      if (formData.brandDocument) {
        submitData.append('brandDocument', formData.brandDocument);
      }

      // Enhanced progress simulation with security steps
      const progressSteps = [
        { progress: 10, message: 'Validating project data...' },
        { progress: 25, message: 'Checking file security...' },
        { progress: 40, message: 'Performing virus scan...' },
        { progress: 60, message: 'Uploading files...' },
        { progress: 80, message: 'Creating project...' },
        { progress: 95, message: 'Starting background processing...' },
      ];

      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length) {
          const step = progressSteps[currentStep];
          setUploadProgress(step.progress);
          toast.info(step.message);
          currentStep++;
        } else {
          clearInterval(progressInterval);
        }
      }, 800);

      // For debugging - try the debug endpoint first
      console.log('Testing debug endpoint...');
      const debugResponse = await fetch('/api/debug', {
        method: 'POST',
        body: submitData,
      });
      
      console.log('Debug response status:', debugResponse.status);
      const debugResult = await debugResponse.json();
      console.log('Debug result:', debugResult);
      
      // Now try the actual projects endpoint
      const response = await fetch('/api/projects', {
        method: 'POST',
        body: submitData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Check if the response is ok
      if (!response.ok) {
        console.error('HTTP Error:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Invalid response from server');
      }

      console.log('API Response:', result);

      if (!result.success) {
        console.error('Project creation failed:', result);
        
        // Handle specific error types
        if (result.error?.code === 'VALIDATION_ERROR') {
          console.error('Validation errors:', result.error.details?.validationErrors);
          const validationErrors = result.error.details?.validationErrors || [];
          const errorMessages = validationErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ');
          toast.error(`Validation failed: ${errorMessages}`);
        } else if (result.error?.code === 'VIRUS_DETECTED') {
          toast.error('File failed virus scan. Please upload a different file.');
        } else if (result.error?.code === 'FILE_VALIDATION_ERROR') {
          toast.error('File validation failed. Please check file type and size.');
        } else if (result.error?.code === 'QUOTA_EXCEEDED') {
          toast.error('Project creation quota exceeded. Please upgrade your plan.');
        } else {
          toast.error(result.error?.message || 'Failed to create project');
        }
        throw new Error(result.error?.message || 'Failed to create project');
      }

      // Show enhanced success message with security info
      const securityInfo = result.data.securityInfo;
      if (securityInfo?.virusScanPassed) {
        toast.success('Project created successfully! File passed security scan. Research is starting in the background.');
      } else {
        toast.success('Project created successfully! Research is starting in the background.');
      }

      // Show processing information
      if (result.data.processingInfo) {
        const estimatedTime = new Date(result.data.processingInfo.estimatedCompletionTime);
        toast.info(`Estimated completion: ${estimatedTime.toLocaleTimeString()}`);
      }
      
      if (onSuccess) {
        onSuccess(result.data.project);
      } else {
        router.push(`/project/${result.data.project.id}`);
      }

    } catch (error: any) {
      console.error('Project creation error:', error);
      
      // Enhanced error handling
      if (error.message.includes('virus')) {
        toast.error('Security scan failed. Please try with a different file.');
      } else if (error.message.includes('quota')) {
        toast.error('Project limit reached. Please upgrade your plan or delete existing projects.');
      } else {
        toast.error(error.message || 'Failed to create project');
      }
      
      setUploadProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
        <CardDescription>
          Start creating SEO-optimized content with AI-powered research and writing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Topic Input */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic / Main Keyword *</Label>
            <Textarea
              id="topic"
              placeholder="e.g., Best project management tools for remote teams"
              value={formData.topic}
              onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
              className={errors.topic ? 'border-red-500' : ''}
              rows={3}
            />
            {errors.topic && (
              <p className="text-sm text-red-500">{errors.topic}</p>
            )}
          </div>

          {/* AI Competitor Discovery Info */}
          <div className="space-y-2">
            <Label>🤖 AI Competitor Discovery</Label>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Strategic Intelligence Loop</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    Our AI acts as your Market Analyst, automatically discovering and analyzing top-ranking competitors for your topic.
                  </p>
                  <div className="space-y-1 text-xs text-blue-600">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                      <span><strong>Scout Phase:</strong> Discovers real ranking leaders using advanced search queries</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                      <span><strong>Infiltrator Phase:</strong> Extracts every fact, data point, and semantic keyword</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                      <span><strong>Architect Phase:</strong> Identifies content gaps and builds superior authority</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tone Selection */}
          <div className="space-y-2">
            <Label>Content Tone *</Label>
            <Select
              value={formData.tone}
              onValueChange={(value: ContentTone) => setFormData(prev => ({ ...prev, tone: value }))}
            >
              <SelectTrigger className={errors.tone ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select content tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="witty">Witty</SelectItem>
                <SelectItem value="data-driven">Data-Driven</SelectItem>
              </SelectContent>
            </Select>
            {errors.tone && (
              <p className="text-sm text-red-500">{errors.tone}</p>
            )}
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Content Format *</Label>
            <Select
              value={formData.format}
              onValueChange={(value: ContentFormat) => setFormData(prev => ({ ...prev, format: value }))}
            >
              <SelectTrigger className={errors.format ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select content format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="how-to">How-to Guide</SelectItem>
                <SelectItem value="listicle">Listicle</SelectItem>
                <SelectItem value="case-study">Case Study</SelectItem>
              </SelectContent>
            </Select>
            {errors.format && (
              <p className="text-sm text-red-500">{errors.format}</p>
            )}
          </div>

          {/* Brand Document Upload */}
          <div className="space-y-2">
            <Label>Brand Document (Optional)</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {formData.brandDocument ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{formData.brandDocument.name}</span>
                    <Badge variant="secondary">
                      {(formData.brandDocument.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    onClick={removeFile}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Upload a PDF with your brand guidelines, tone of voice, or reference materials
                  </p>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Choose PDF File
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">Max 10MB</p>
                </div>
              )}
            </div>
            {errors.brandDocument && (
              <p className="text-sm text-red-500">{errors.brandDocument}</p>
            )}
          </div>

          {/* Upload Progress */}
          {isSubmitting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Creating project...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Project...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}