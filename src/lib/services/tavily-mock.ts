import { CompetitorData, ContentAnalysis } from '@/lib/types';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

/**
 * Mock Tavily service for development when API key is not available
 * This provides realistic test data to keep development flowing
 */
export class MockTavilyService {
  /**
   * Mock competitor scraping with realistic data
   */
  async scrapeCompetitors(urls: string[]): Promise<CompetitorData[]> {
    console.log(`Mock: Scraping ${urls.length} competitor URLs`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    const mockData: CompetitorData[] = urls.map((url, index) => {
      const domain = new URL(url).hostname;
      const topics = this.generateMockTopics(domain);
      const content = this.generateMockContent(domain, topics);
      
      return {
        url,
        title: `${domain.replace('www.', '').split('.')[0]} - Complete Guide to ${topics[0]}`,
        content,
        headings: [
          `Complete Guide to ${topics[0]}`,
          `What is ${topics[0]}?`,
          `Benefits of ${topics[0]}`,
          `How to Get Started`,
          `Best Practices`,
          `Common Mistakes to Avoid`,
          `Advanced Techniques`,
          `Conclusion`
        ],
        wordCount: 1200 + Math.floor(Math.random() * 800),
        keyTopics: topics,
        metaDescription: `Learn everything about ${topics[0]} with our comprehensive guide. Discover best practices, tips, and strategies.`,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": `Complete Guide to ${topics[0]}`,
          "author": {
            "@type": "Organization",
            "name": domain
          }
        },
        lastUpdated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    });
    
    console.log(`Mock: Successfully scraped ${mockData.length} competitors`);
    return mockData;
  }
  
  /**
   * Mock content analysis
   */
  async analyzeContent(content: string): Promise<ContentAnalysis> {
    console.log('Mock: Analyzing content');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const keyTopics = this.extractKeyTopics(content);
    
    return {
      keyTopics,
      contentGaps: [
        'More detailed examples needed',
        'Missing case studies',
        'Lack of visual elements',
        'No comparison tables'
      ],
      seoOpportunities: [
        'Add more internal links',
        'Optimize meta descriptions',
        'Include FAQ section',
        'Add structured data markup'
      ],
      structureRecommendations: [
        'Break up long paragraphs',
        'Add more subheadings',
        'Include bullet points',
        'Add call-to-action sections'
      ],
      competitorStrengths: [
        'Comprehensive coverage',
        'Strong visual elements',
        'Good user engagement',
        'Regular content updates'
      ],
      targetKeywords: keyTopics.concat([
        'best practices',
        'guide',
        'tutorial',
        'tips',
        'strategies'
      ])
    };
  }
  
  /**
   * Mock related content search
   */
  async searchRelatedContent(query: string): Promise<CompetitorData[]> {
    console.log(`Mock: Searching for related content: ${query}`);
    
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockUrls = [
      `https://example1.com/${query.replace(/\s+/g, '-').toLowerCase()}`,
      `https://example2.com/guide-to-${query.replace(/\s+/g, '-').toLowerCase()}`,
      `https://example3.com/${query.replace(/\s+/g, '-').toLowerCase()}-tips`
    ];
    
    return this.scrapeCompetitors(mockUrls);
  }
  
  /**
   * Mock health check - always returns healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    const responseTime = 100 + Math.random() * 200;
    await new Promise(resolve => setTimeout(resolve, responseTime));
    
    return {
      healthy: true,
      responseTime: Math.round(responseTime)
    };
  }
  
  // Helper methods
  private generateMockTopics(domain: string): string[] {
    const baseTopics = [
      'digital marketing',
      'content strategy',
      'SEO optimization',
      'social media',
      'email marketing',
      'web development',
      'user experience',
      'analytics',
      'conversion optimization',
      'brand building'
    ];
    
    // Generate domain-specific topics
    const domainKeyword = domain.split('.')[0].replace('www', '');
    const topics = [
      `${domainKeyword} strategy`,
      ...baseTopics.slice(0, 5 + Math.floor(Math.random() * 3))
    ];
    
    return topics;
  }
  
  private generateMockContent(domain: string, topics: string[]): string {
    const paragraphs = [
      `Welcome to the comprehensive guide on ${topics[0]}. In today's digital landscape, understanding ${topics[0]} is crucial for business success.`,
      
      `${topics[0]} has evolved significantly over the past few years. Modern approaches focus on data-driven strategies and user-centric design principles.`,
      
      `Key benefits of implementing ${topics[0]} include improved user engagement, higher conversion rates, and better ROI on marketing investments.`,
      
      `To get started with ${topics[0]}, you need to understand your target audience, define clear objectives, and choose the right tools and platforms.`,
      
      `Best practices for ${topics[0]} include regular monitoring and optimization, A/B testing different approaches, and staying updated with industry trends.`,
      
      `Common mistakes to avoid include neglecting mobile optimization, ignoring analytics data, and failing to adapt to changing user behaviors.`,
      
      `Advanced techniques in ${topics[0]} involve leveraging artificial intelligence, implementing personalization strategies, and using predictive analytics.`,
      
      `In conclusion, ${topics[0]} is an essential component of modern business strategy. By following the guidelines outlined in this guide, you can achieve significant improvements in your results.`
    ];
    
    return paragraphs.join('\n\n');
  }
  
  private extractKeyTopics(content: string): string[] {
    // Simple keyword extraction for mock purposes
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);
    
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([word]) => word);
  }
}

// Export mock instance
export const mockTavilyService = new MockTavilyService();