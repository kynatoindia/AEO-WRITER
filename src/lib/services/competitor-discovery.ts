import { tavilyService } from './tavily';
import { generateStructuredOutput } from '@/lib/ai/gateway';
import { z } from 'zod';

// Schema for competitor discovery results
const CompetitorDiscoverySchema = z.object({
  competitors: z.array(z.object({
    url: z.string().url(),
    title: z.string(),
    relevanceScore: z.number().min(0).max(100),
    reason: z.string(),
    domain: z.string(),
    estimatedAuthority: z.number().min(0).max(100)
  })).min(3).max(10),
  searchStrategy: z.object({
    primaryKeywords: z.array(z.string()),
    searchQueries: z.array(z.string()),
    totalResults: z.number(),
    filteredResults: z.number()
  }),
  competitiveAnalysis: z.object({
    marketLeaders: z.array(z.string()),
    contentGaps: z.array(z.string()),
    opportunityAreas: z.array(z.string())
  })
});

type CompetitorDiscoveryResult = z.infer<typeof CompetitorDiscoverySchema>;

export class CompetitorDiscoveryService {
  /**
   * Discover top competitors automatically using AI-powered search
   */
  async discoverCompetitors(
    topic: string,
    industry?: string,
    targetAudience?: string,
    userId?: string
  ): Promise<CompetitorDiscoveryResult> {
    console.log(`Starting AI-powered competitor discovery for topic: ${topic}`);

    // Step 1: Generate strategic search queries using AI
    const searchQueries = await this.generateSearchQueries(topic, industry, targetAudience, userId);

    // Step 2: Execute searches and collect results
    const searchResults = await this.executeSearches(searchQueries);

    // Step 3: AI-powered competitor analysis and ranking
    const competitorAnalysis = await this.analyzeAndRankCompetitors(
      searchResults,
      topic,
      industry,
      userId
    );

    return competitorAnalysis;
  }

  /**
   * Generate strategic search queries for competitor discovery
   */
  private async generateSearchQueries(
    topic: string,
    industry?: string,
    targetAudience?: string,
    userId?: string
  ): Promise<string[]> {
    const searchQueryPrompt = `
      Generate 5-8 strategic search queries to find the top competitors and authoritative content for this topic.
      
      Topic: ${topic}
      ${industry ? `Industry: ${industry}` : ''}
      ${targetAudience ? `Target Audience: ${targetAudience}` : ''}
      
      Create search queries that will find:
      1. Direct competitors writing about this topic
      2. Industry leaders and authoritative sources
      3. Popular blogs and publications in this space
      4. Educational and informational content
      5. Commercial pages and service providers
      
      Search Query Strategy:
      - Use specific keywords and phrases
      - Include industry-specific terms
      - Target different content types (guides, tutorials, comparisons)
      - Focus on high-authority domains
      
      Return 5-8 search queries that will comprehensively map the competitive landscape.
    `;

    const querySchema = z.object({
      queries: z.array(z.string()).min(5).max(8),
      strategy: z.string(),
      targetTypes: z.array(z.string())
    });

    const result = await generateStructuredOutput(
      searchQueryPrompt,
      querySchema,
      'research',
      userId
    );

    console.log(`Generated ${result.object.queries.length} search queries for competitor discovery`);
    return result.object.queries;
  }

  /**
   * Execute multiple searches and collect comprehensive results
   */
  private async executeSearches(queries: string[]): Promise<any[]> {
    const allResults: any[] = [];

    for (const query of queries) {
      try {
        console.log(`Executing search for: ${query}`);
        
        // Use Tavily to search for competitors
        const searchResults = await tavilyService.searchCompetitors(query, {
          maxResults: 10,
          includeDomains: [],
          excludeDomains: ['wikipedia.org', 'reddit.com', 'quora.com'], // Focus on primary sources
          searchDepth: 'advanced'
        });

        allResults.push(...searchResults);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Search failed for query "${query}":`, error);
        // Continue with other queries
      }
    }

    // Remove duplicates based on URL
    const uniqueResults = allResults.filter((result, index, self) => 
      index === self.findIndex(r => r.url === result.url)
    );

    console.log(`Collected ${uniqueResults.length} unique search results from ${queries.length} queries`);
    return uniqueResults;
  }

  /**
   * AI-powered analysis and ranking of discovered competitors
   */
  private async analyzeAndRankCompetitors(
    searchResults: any[],
    topic: string,
    industry?: string,
    userId?: string
  ): Promise<CompetitorDiscoveryResult> {
    const analysisPrompt = `
      Analyze these search results to identify and rank the top competitors for the topic "${topic}".
      
      Search Results:
      ${searchResults.map((result, index) => `
      ${index + 1}. ${result.title}
      URL: ${result.url}
      Content: ${result.content?.substring(0, 300)}...
      Domain: ${new URL(result.url).hostname}
      `).join('\n')}
      
      Analysis Requirements:
      1. Identify the top 5-8 most relevant competitors
      2. Score each competitor's relevance (0-100)
      3. Estimate domain authority and content quality
      4. Provide reasoning for each selection
      5. Identify market leaders and content gaps
      6. Suggest opportunity areas for differentiation
      
      Selection Criteria:
      - Content relevance to the topic
      - Domain authority and trustworthiness  
      - Content depth and quality
      - Target audience alignment
      - Commercial vs. educational focus
      - Recency and freshness of content
      
      Exclude:
      - Low-quality or spam sites
      - Irrelevant or off-topic content
      - Duplicate or similar domains
      - Social media posts or forums
      
      Return a comprehensive competitive analysis with ranked competitors.
    `;

    const result = await generateStructuredOutput(
      analysisPrompt,
      CompetitorDiscoverySchema,
      'research',
      userId
    );

    console.log(`AI analysis identified ${result.object.competitors.length} top competitors`);
    return result.object;
  }

  /**
   * Validate and enrich competitor data
   */
  async validateCompetitors(competitors: any[]): Promise<any[]> {
    const validatedCompetitors = [];

    for (const competitor of competitors) {
      try {
        // Basic URL validation
        new URL(competitor.url);
        
        // Check if site is accessible (basic validation)
        const isAccessible = await this.checkSiteAccessibility(competitor.url);
        
        if (isAccessible) {
          validatedCompetitors.push({
            ...competitor,
            validated: true,
            lastChecked: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Invalid competitor URL: ${competitor.url}`, error);
      }
    }

    return validatedCompetitors;
  }

  /**
   * Basic site accessibility check
   */
  private async checkSiteAccessibility(url: string): Promise<boolean> {
    try {
      // In a real implementation, you might want to do a HEAD request
      // For now, we'll assume URLs from search results are accessible
      return true;
    } catch (error) {
      console.error(`Site accessibility check failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Get competitor insights for content strategy
   */
  async getCompetitorInsights(competitors: any[], topic: string, userId?: string): Promise<any> {
    const insightsPrompt = `
      Analyze these competitors to provide strategic insights for creating superior content about "${topic}".
      
      Competitors:
      ${competitors.map(comp => `
      - ${comp.title} (${comp.url})
        Relevance: ${comp.relevanceScore}/100
        Reason: ${comp.reason}
      `).join('\n')}
      
      Provide insights on:
      1. Common content themes and approaches
      2. Content gaps and opportunities
      3. Unique angles and differentiators
      4. Target audience preferences
      5. Content format preferences
      6. SEO opportunities
      7. Recommended content strategy
      
      Focus on actionable insights that will help create better, more comprehensive content.
    `;

    const insightsSchema = z.object({
      contentThemes: z.array(z.string()),
      contentGaps: z.array(z.string()),
      uniqueAngles: z.array(z.string()),
      audiencePreferences: z.array(z.string()),
      formatRecommendations: z.array(z.string()),
      seoOpportunities: z.array(z.string()),
      contentStrategy: z.string()
    });

    const result = await generateStructuredOutput(
      insightsPrompt,
      insightsSchema,
      'research',
      userId
    );

    return result.object;
  }
}

// Export singleton instance
export const competitorDiscoveryService = new CompetitorDiscoveryService();