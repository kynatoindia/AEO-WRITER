'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import StatusTracker from '@/components/status-tracker';

interface AEOBlogGeneratorProps {
  projectId?: string;
  userId: string;
}

export function AEOBlogGenerator({ projectId: initialProjectId, userId }: AEOBlogGeneratorProps) {
  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('');
  const [facts, setFacts] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !keyword.trim()) {
      setStatus('error');
      setMessage('Please fill in both title and keyword fields.');
      return;
    }

    setIsGenerating(true);
    setStatus('processing');
    setMessage('Starting blog generation...');

    try {
      // First, create a project if we don't have one
      let currentProjectId = projectId;
      
      if (!currentProjectId) {
        const createResponse = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic: title.trim(),
            competitorUrls: ['https://example.com'], // Default for now
            tone: 'professional',
            format: 'how-to',
          }),
        });

        if (!createResponse.ok) {
          throw new Error('Failed to create project');
        }

        const projectData = await createResponse.json();
        currentProjectId = projectData.id;
        setProjectId(currentProjectId);
      }

      // THE FIX: This now returns immediately with 202 status
      const response = await fetch('/api/generate-aeo-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          projectId: currentProjectId,
          title: title.trim(),
          keyword: keyword.trim(),
          facts: facts.trim(),
        }),
      });

      const data = await response.json();

      if (response.status === 202) {
        // Success! Blog generation started
        setStatus('success');
        setMessage('Blog generation started! Watch the progress below.');
        
        // Reset form
        setTitle('');
        setKeyword('');
        setFacts('');
      } else {
        throw new Error(data.error || 'Failed to start blog generation');
      }
    } catch (error: any) {
      console.error('Blog generation failed:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to start blog generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AEO Blog Generator</CardTitle>
          <CardDescription>
            Generate SEO-optimized blog posts with Answer Engine Optimization (AEO).
            No more timeout errors - generation happens in the background!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Blog Title *
              </label>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Complete Guide to AI Content Marketing"
                disabled={isGenerating}
                required
              />
            </div>

            <div>
              <label htmlFor="keyword" className="block text-sm font-medium mb-2">
                Target Keyword *
              </label>
              <Input
                id="keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., AI content marketing"
                disabled={isGenerating}
                required
              />
            </div>

            <div>
              <label htmlFor="facts" className="block text-sm font-medium mb-2">
                Key Facts & Context (Optional)
              </label>
              <Textarea
                id="facts"
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Add any specific facts, statistics, or context you want included in the blog..."
                rows={4}
                disabled={isGenerating}
              />
            </div>

            {status !== 'idle' && (
              <Alert className={getStatusColor()}>
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <AlertDescription>{message}</AlertDescription>
                </div>
              </Alert>
            )}

            <Button 
              type="submit" 
              disabled={isGenerating || !title.trim() || !keyword.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Starting Generation...
                </>
              ) : (
                'Generate AEO Blog'
              )}
            </Button>
          </form>

          {status === 'success' && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Layout generation with Pro AI model</li>
                <li>• Sequential section writing (no rate limits!)</li>
                <li>• Real-time progress updates</li>
                <li>• Final SEO optimization</li>
                <li>• Automatic completion notification</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time Status Tracker */}
      {projectId && (
        <StatusTracker projectId={projectId} />
      )}
    </div>
  );
}