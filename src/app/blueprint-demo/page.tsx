'use client';

import { useState } from 'react';
import { BlueprintReview } from '@/components/blueprint';
import type { ContentBlueprint } from '@/lib/types';

const sampleBlueprint: ContentBlueprint = {
  sections: [
    {
      id: 'section-1',
      heading: 'Introduction to SEO Content Writing',
      goal: 'Introduce readers to the fundamentals of SEO content writing and its importance',
      subSections: [
        {
          id: 'subsection-1-1',
          heading: 'What is SEO Content Writing?',
          keyPoints: [
            'Definition of SEO content writing',
            'Difference between regular writing and SEO writing',
            'Key components of SEO content'
          ]
        },
        {
          id: 'subsection-1-2',
          heading: 'Why SEO Content Matters',
          keyPoints: [
            'Increased organic visibility',
            'Better user engagement',
            'Higher conversion rates'
          ]
        }
      ],
      contentElements: [
        {
          type: 'direct-answer',
          properties: { question: 'What is SEO content writing?' }
        },
        {
          type: 'bullet-points',
          properties: { title: 'Benefits of SEO Content' }
        }
      ],
      dataSources: [
        'Moz SEO Guide',
        'Google Search Quality Guidelines',
        'Competitor analysis from top 5 ranking pages'
      ],
      order: 0,
      status: 'pending'
    },
    {
      id: 'section-2',
      heading: 'Keyword Research and Strategy',
      goal: 'Teach readers how to conduct effective keyword research for content creation',
      subSections: [
        {
          id: 'subsection-2-1',
          heading: 'Finding the Right Keywords',
          keyPoints: [
            'Using keyword research tools',
            'Understanding search intent',
            'Analyzing keyword difficulty'
          ]
        },
        {
          id: 'subsection-2-2',
          heading: 'Keyword Mapping and Strategy',
          keyPoints: [
            'Creating keyword clusters',
            'Mapping keywords to content',
            'Long-tail vs short-tail keywords'
          ]
        }
      ],
      contentElements: [
        {
          type: 'comparison-table',
          properties: { title: 'Keyword Research Tools Comparison' }
        },
        {
          type: 'faq',
          properties: { questions: ['How many keywords should I target?', 'What is keyword cannibalization?'] }
        }
      ],
      dataSources: [
        'Ahrefs Keyword Research Guide',
        'SEMrush Keyword Strategy',
        'Internal keyword performance data'
      ],
      order: 1,
      status: 'pending'
    },
    {
      id: 'section-3',
      heading: 'Content Structure and Optimization',
      goal: 'Guide readers through the process of structuring and optimizing content for search engines',
      subSections: [
        {
          id: 'subsection-3-1',
          heading: 'Creating SEO-Friendly Headlines',
          keyPoints: [
            'H1, H2, H3 hierarchy',
            'Including target keywords naturally',
            'Making headlines compelling for users'
          ]
        },
        {
          id: 'subsection-3-2',
          heading: 'Content Formatting Best Practices',
          keyPoints: [
            'Using bullet points and numbered lists',
            'Optimizing paragraph length',
            'Adding internal and external links'
          ]
        }
      ],
      contentElements: [
        {
          type: 'code-block',
          properties: { language: 'html', title: 'HTML Structure Example' }
        },
        {
          type: 'bullet-points',
          properties: { title: 'Content Optimization Checklist' }
        }
      ],
      dataSources: [
        'Google Search Console data',
        'Content performance analytics',
        'User behavior studies'
      ],
      order: 2,
      status: 'pending'
    }
  ],
  seoMetadata: {
    title: 'The Complete Guide to SEO Content Writing in 2024',
    metaDescription: 'Learn how to write SEO-optimized content that ranks higher in search results and drives organic traffic. Complete guide with actionable tips and strategies.',
    targetKeywords: [
      'SEO content writing',
      'content optimization',
      'keyword research',
      'search engine optimization',
      'content strategy',
      'organic traffic'
    ],
    focusKeyword: 'SEO content writing'
  },
  estimatedLength: 3500,
  targetKeywords: [
    'SEO content writing',
    'content optimization',
    'keyword research',
    'search engine optimization',
    'content strategy'
  ]
};

export default function BlueprintDemoPage() {
  const [blueprint, setBlueprint] = useState<ContentBlueprint>(sampleBlueprint);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = (updatedBlueprint: ContentBlueprint) => {
    setBlueprint(updatedBlueprint);
    console.log('Blueprint updated:', updatedBlueprint);
  };

  const handleSave = async (blueprintToSave: ContentBlueprint) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Blueprint saved:', blueprintToSave);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Blueprint Review Demo
          </h1>
          <p className="text-gray-600">
            Interactive demo of the Blueprint Review component with drag-and-drop reordering,
            inline editing, and section management features.
          </p>
        </div>
        
        <BlueprintReview
          blueprint={blueprint}
          onUpdate={handleUpdate}
          onSave={handleSave}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}