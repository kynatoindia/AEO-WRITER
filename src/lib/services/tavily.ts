import { z } from 'zod';
import { CompetitorData, ContentAnalysis } from '@/lib/types';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { mockTavilyService } from './tavily-mock';

// Tavily API configuration
const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!TAVILY_API_KEY) {
  console.warn('TAVILY_API_KEY not found in environment variables - using mock service');
}

// Tavily API response schemas
const tavilySearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  raw_content: z.string().optional(),
  score: z.number(),
  published_date: z.string().optional(),
});

const tavilySearchResponseSchema = z.object({
  query: z.string(),
  follow_up_questions: z.array(z.string()).optional().nullable(),
  answer: z.string().optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  results: z.array(tavilySearchResultSchema),
  response_time: z.number(),
});

export interface TavilySearchOptions {
  query: string;
  search_depth?: 'basic' | 'advanced';
  include_answer?: boolean;
  include_raw_content?: boolean;
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  timeout?: number;
}

export interface TavilyCompetitorAnalysis {
  url: string;
  title: string;
  content: string;
  headings: string[];
  wordCount: number;
  keyTopics: string[];
  metaDescription?: string;
  structuredData?: Record<string, any>;
  lastUpdated?: string;
  score: number;
  publishedDate?: string;
}

class TavilyService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor() {
    this.apiKey = TAVILY_API_KEY || '';
    this.baseUrl = TAVILY_API_URL;
    this.defaultTimeout = 30000; // 30 seconds
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Search for content using Tavily API with retry logic
   */
  async search(options: TavilySearchOptions): Promise<TavilyCompetitorAnalysis[]> {
    if (!this.apiKey) {
      console.log('Using mock Tavily service for search');
      // Convert mock data to TavilyCompetitorAnalysis format
      const mockResults = await mockTavilyService.scrapeCompetitors([
        `https://example.com/${options.query.replace(/\s+/g, '-')}`
      ]);
      
      return mockResults.map(result => ({
        ...result,
        score: 0.8 + Math.random() * 0.2,
        publishedDate: result.lastUpdated
      }));
    }

    // Check cache first
    const cacheKey = CACHE_KEYS.CONTENT_CACHE(
      Buffer.from(JSON.stringify(options)).toString('base64').slice(0, 32)
    );
    
    const cached = await redis.get<TavilyCompetitorAnalysis[]>(cacheKey);
    if (cached) {
      console.log('Returning cached Tavily search results');
      return cached;
    }

    const requestBody = {
      api_key: this.apiKey,
      query: options.query,
      search_depth: options.search_depth || 'basic',
      include_answer: options.include_answer || false,
      include_raw_content: options.include_raw_content || true,
      max_results: options.max_results || 5,
      include_domains: options.include_domains,
      exclude_domains: options.exclude_domains,
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Tavily search attempt ${attempt}/${this.maxRetries} for query: ${options.query}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AEO-Writer-SaaS/1.0',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const validatedData = tavilySearchResponseSchema.parse(data);
        
        // Transform Tavily results to our CompetitorData format
        const competitorData: TavilyCompetitorAnalysis[] = validatedData.results.map(result => ({
          url: result.url,
          title: result.title,
          content: result.content,
          headings: this.extractHeadings(result.raw_content || result.content),
          wordCount: this.countWords(result.content),
          keyTopics: this.extractKeyTopics(result.content),
          metaDescription: this.extractMetaDescription(result.raw_content || result.content),
          structuredData: this.extractStructuredData(result.raw_content || result.content),
          lastUpdated: result.published_date,
          score: result.score,
          publishedDate: result.published_date,
        }));

        // Cache successful results
        await redis.setex(cacheKey, CACHE_TTL.CONTENT_CACHE, competitorData);
        
        console.log(`Tavily search successful: ${competitorData.length} results found`);
        return competitorData;

      } catch (error) {
        lastError = error as Error;
        console.error(`Tavily search attempt ${attempt} failed:`, error);

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('400')) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying Tavily search in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Tavily search failed after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Scrape competitor URLs with enhanced analysis
   */
  async scrapeCompetitors(urls: string[]): Promise<CompetitorData[]> {
    // Use mock service if API key is not available
    if (!this.apiKey) {
      console.log('Using mock Tavily service for competitor scraping');
      return mockTavilyService.scrapeCompetitors(urls);
    }

    const results: CompetitorData[] = [];
    const errors: string[] = [];

    // Process URLs in parallel with concurrency limit
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(urls, concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        try {
          // Extract domain and create a meaningful search query
          const domain = new URL(url).hostname;
          const path = new URL(url).pathname;
          
          // Create a search query that includes the domain and relevant terms
          const searchQuery = `site:${domain} ${path.split('/').filter(p => p && p.length > 2).join(' ')} marketing guide content`;
          
          // Use Tavily to search for content from specific URL
          const searchResults = await this.search({
            query: searchQuery,
            search_depth: 'advanced',
            include_raw_content: true,
            max_results: 1,
            include_domains: [domain],
          });

          if (searchResults.length > 0) {
            const result = searchResults[0];
            return {
              url: result.url,
              title: result.title,
              content: result.content,
              headings: result.headings,
              wordCount: result.wordCount,
              keyTopics: result.keyTopics,
              metaDescription: result.metaDescription,
              structuredData: result.structuredData,
              lastUpdated: result.lastUpdated,
            } as CompetitorData;
          } else {
            throw new Error('No content found for URL');
          }
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error);
          errors.push(`${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults.filter(Boolean) as CompetitorData[]);
    }

    if (results.length === 0 && errors.length > 0) {
      throw new Error(`Failed to scrape any competitor URLs. Errors: ${errors.join(', ')}`);
    }

    console.log(`Successfully scraped ${results.length}/${urls.length} competitor URLs`);
    return results;
  }

  /**
   * Analyze content for key insights
   */
  async analyzeContent(content: string): Promise<ContentAnalysis> {
    // Use mock service if API key is not available
    if (!this.apiKey) {
      console.log('Using mock Tavily service for content analysis');
      return mockTavilyService.analyzeContent(content);
    }

    // Use Tavily to search for related content and trends
    const keyTopics = this.extractKeyTopics(content);
    const searchQuery = keyTopics.slice(0, 3).join(' ');

    try {
      const relatedContent = await this.search({
        query: `${searchQuery} trends analysis`,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 3,
      });

      return {
        keyTopics,
        contentGaps: this.identifyContentGaps(content, relatedContent),
        seoOpportunities: this.identifySEOOpportunities(content),
        structureRecommendations: this.generateStructureRecommendations(content),
        competitorStrengths: this.identifyCompetitorStrengths(relatedContent),
        targetKeywords: this.extractTargetKeywords(content, relatedContent),
      };
    } catch (error) {
      console.error('Content analysis failed:', error);
      // Return basic analysis if Tavily search fails
      return {
        keyTopics,
        contentGaps: [],
        seoOpportunities: this.identifySEOOpportunities(content),
        structureRecommendations: this.generateStructureRecommendations(content),
        competitorStrengths: [],
        targetKeywords: keyTopics,
      };
    }
  }

  /**
   * Search for related content based on query
   */
  async searchRelatedContent(query: string): Promise<CompetitorData[]> {
    // Use mock service if API key is not available
    if (!this.apiKey) {
      console.log('Using mock Tavily service for related content search');
      return mockTavilyService.searchRelatedContent(query);
    }

    const searchResults = await this.search({
      query,
      search_depth: 'advanced',
      include_raw_content: true,
      max_results: 10,
    });

    return searchResults.map(result => ({
      url: result.url,
      title: result.title,
      content: result.content,
      headings: result.headings,
      wordCount: result.wordCount,
      keyTopics: result.keyTopics,
      metaDescription: result.metaDescription,
      structuredData: result.structuredData,
      lastUpdated: result.lastUpdated,
    }));
  }

  // Helper methods for content analysis
  private extractHeadings(content: string): string[] {
    const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
    const headings: string[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1].replace(/<[^>]*>/g, '').trim());
    }

    // Also extract markdown-style headings
    const markdownHeadings = content.match(/^#{1,6}\s+(.+)$/gm);
    if (markdownHeadings) {
      headings.push(...markdownHeadings.map(h => h.replace(/^#+\s+/, '').trim()));
    }

    return [...new Set(headings)]; // Remove duplicates
  }

  private countWords(content: string): number {
    return content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length;
  }

  private extractKeyTopics(content: string): string[] {
    // Simple keyword extraction - in production, you might use NLP libraries
    const cleanContent = content.replace(/<[^>]*>/g, '').toLowerCase();
    const words = cleanContent.split(/\s+/);
    const wordFreq: Record<string, number> = {};

    // Count word frequency (excluding common words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);

    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && !stopWords.has(cleanWord)) {
        wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
      }
    });

    // Return top 10 most frequent words
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractMetaDescription(content: string): string | undefined {
    const metaMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    return metaMatch ? metaMatch[1] : undefined;
  }

  private extractStructuredData(content: string): Record<string, any> | undefined {
    try {
      const jsonLdMatch = content.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        return JSON.parse(jsonLdMatch[1]);
      }
    } catch (error) {
      console.warn('Failed to parse structured data:', error);
    }
    return undefined;
  }

  private identifyContentGaps(content: string, relatedContent: TavilyCompetitorAnalysis[]): string[] {
    const contentTopics = new Set(this.extractKeyTopics(content));
    const competitorTopics = new Set();

    relatedContent.forEach(competitor => {
      competitor.keyTopics.forEach(topic => competitorTopics.add(topic));
    });

    // Find topics that competitors cover but our content doesn't
    const gaps: string[] = [];
    competitorTopics.forEach(topic => {
      if (!contentTopics.has(topic as string)) {
        gaps.push(topic as string);
      }
    });

    return gaps.slice(0, 5); // Return top 5 gaps
  }

  private identifySEOOpportunities(content: string): string[] {
    const opportunities: string[] = [];
    
    // Check for missing elements
    if (!content.includes('<h1')) {
      opportunities.push('Add H1 heading for better SEO structure');
    }
    
    if (!content.includes('<h2')) {
      opportunities.push('Add H2 subheadings to improve content structure');
    }
    
    if (this.countWords(content) < 300) {
      opportunities.push('Increase content length to at least 300 words');
    }
    
    if (!content.includes('meta name="description"')) {
      opportunities.push('Add meta description for better search snippets');
    }
    
    return opportunities;
  }

  private generateStructureRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const headings = this.extractHeadings(content);
    
    if (headings.length < 3) {
      recommendations.push('Add more subheadings to improve content structure');
    }
    
    if (this.countWords(content) > 1000 && !content.includes('<ul>') && !content.includes('<ol>')) {
      recommendations.push('Add bullet points or numbered lists to break up long content');
    }
    
    if (!content.includes('table') && content.includes('vs') || content.includes('comparison')) {
      recommendations.push('Consider adding comparison tables for better readability');
    }
    
    return recommendations;
  }

  private identifyCompetitorStrengths(competitors: TavilyCompetitorAnalysis[]): string[] {
    const strengths: string[] = [];
    
    competitors.forEach(competitor => {
      if (competitor.wordCount > 1500) {
        strengths.push(`Comprehensive content (${competitor.wordCount} words)`);
      }
      
      if (competitor.headings.length > 5) {
        strengths.push('Well-structured with multiple headings');
      }
      
      if (competitor.structuredData) {
        strengths.push('Uses structured data for rich snippets');
      }
    });
    
    return [...new Set(strengths)]; // Remove duplicates
  }

  private extractTargetKeywords(content: string, relatedContent: TavilyCompetitorAnalysis[]): string[] {
    const contentKeywords = this.extractKeyTopics(content);
    const competitorKeywords = new Set<string>();
    
    relatedContent.forEach(competitor => {
      competitor.keyTopics.forEach(topic => competitorKeywords.add(topic));
    });
    
    // Combine and prioritize keywords
    const allKeywords = [...contentKeywords, ...Array.from(competitorKeywords)];
    const keywordFreq: Record<string, number> = {};
    
    allKeywords.forEach(keyword => {
      keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
    });
    
    return Object.entries(keywordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Search for competitors using AI-powered discovery
   */
  async searchCompetitors(
    query: string,
    options: {
      maxResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      searchDepth?: 'basic' | 'advanced';
    } = {}
  ): Promise<TavilyCompetitorAnalysis[]> {
    const searchOptions: TavilySearchOptions = {
      query,
      search_depth: options.searchDepth || 'advanced',
      include_raw_content: true,
      max_results: options.maxResults || 10,
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains || [
        'wikipedia.org',
        'reddit.com',
        'quora.com',
        'facebook.com',
        'twitter.com',
        'linkedin.com'
      ],
    };

    return this.search(searchOptions);
  }

  /**
   * Health check for Tavily service
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime?: number; error?: string }> {
    if (!this.apiKey) {
      console.log('Using mock Tavily service for health check');
      return mockTavilyService.healthCheck();
    }
    if (!this.apiKey) {
      return { healthy: false, error: 'API key not configured' };
    }

    try {
      const start = Date.now();
      await this.search({
        query: 'test',
        max_results: 1,
        timeout: 5000,
      });
      const responseTime = Date.now() - start;
      
      return { healthy: true, responseTime };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const tavilyService = new TavilyService();

