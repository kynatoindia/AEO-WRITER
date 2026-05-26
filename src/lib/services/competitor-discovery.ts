import { tavilyService } from './tavily';
import { generateAIText, generateStructuredOutput } from '@/lib/ai/gateway';
import { z } from 'zod';

const FAST_COMPETITOR_DISCOVERY = process.env.AEO_FAST_MODE !== 'false';
const DISCOVERY_QUERY_MIN = FAST_COMPETITOR_DISCOVERY ? 3 : 5;
const DISCOVERY_QUERY_MAX = FAST_COMPETITOR_DISCOVERY ? 5 : 8;
const DISCOVERY_RESULTS_PER_QUERY = FAST_COMPETITOR_DISCOVERY ? 6 : 10;
const DISCOVERY_DELAY_MS = FAST_COMPETITOR_DISCOVERY ? 150 : 1000;
const DISCOVERY_MAX_COMPETITORS = FAST_COMPETITOR_DISCOVERY ? 5 : 8;

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
      Generate ${DISCOVERY_QUERY_MIN}-${DISCOVERY_QUERY_MAX} strategic search queries to find the top competitors and authoritative content for this topic.
      
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
      
      Return ${DISCOVERY_QUERY_MIN}-${DISCOVERY_QUERY_MAX} search queries that will comprehensively map the competitive landscape.
    `;

    const querySchema = z.object({
      queries: z.array(z.string()).min(DISCOVERY_QUERY_MIN).max(DISCOVERY_QUERY_MAX),
      strategy: z.string(),
      targetTypes: z.array(z.string())
    });

    try {
      const result = await generateStructuredOutput(
        searchQueryPrompt,
        querySchema,
        'research',
        userId
      );

      console.log(`Generated ${result.object.queries.length} search queries for competitor discovery`);
      return result.object.queries;
    } catch (error) {
      console.warn('Structured query generation failed, using deterministic fallback:', error);
      return this.getFallbackSearchQueries(topic, industry, targetAudience);
    }
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
          maxResults: DISCOVERY_RESULTS_PER_QUERY,
          includeDomains: [],
          excludeDomains: ['wikipedia.org', 'reddit.com', 'quora.com'], // Focus on primary sources
          searchDepth: 'advanced'
        });

        allResults.push(...searchResults);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, DISCOVERY_DELAY_MS));
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

    try {
      const result = await generateStructuredOutput(
        analysisPrompt,
        CompetitorDiscoverySchema,
        'research',
        userId
      );

      console.log(`AI analysis identified ${result.object.competitors.length} top competitors`);
      return result.object;
    } catch (error) {
      console.warn('Structured competitor analysis failed, using deterministic fallback:', error);
      return this.buildFallbackCompetitorAnalysis(searchResults, topic, industry);
    }
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

    try {
      const result = await generateStructuredOutput(
        insightsPrompt,
        insightsSchema,
        'research',
        userId
      );

      return result.object;
    } catch (error) {
      console.warn('Structured competitor insights failed, using text fallback:', error);
      try {
        const textResult = await generateAIText(insightsPrompt, 'research', userId);
        return {
          contentThemes: [topic, `${topic} strategy`, `${topic} examples`],
          contentGaps: ['Actionable implementation details', 'Recent data points', 'Clear benchmarking'],
          uniqueAngles: ['Original frameworks', 'Fact-backed comparisons', 'Step-by-step execution'],
          audiencePreferences: ['Practical guidance', 'Scannable structure', 'Evidence-backed claims'],
          formatRecommendations: ['How-to sections', 'Comparison tables', 'FAQ blocks'],
          seoOpportunities: [`${topic} guide`, `${topic} best practices`, `${topic} examples`],
          contentStrategy: textResult.text.slice(0, 1200),
        };
      } catch {
        return {
          contentThemes: [topic, `${topic} strategy`],
          contentGaps: ['Clear process steps', 'Deeper examples'],
          uniqueAngles: ['Fact-first recommendations'],
          audiencePreferences: ['Actionable content', 'Concise summaries'],
          formatRecommendations: ['Guide format', 'FAQ additions'],
          seoOpportunities: [`${topic} guide`, `${topic} tips`],
          contentStrategy: `Create comprehensive, fact-backed content around "${topic}" with clear structure and practical examples.`,
        };
      }
    }
  }

  private getFallbackSearchQueries(topic: string, industry?: string, targetAudience?: string): string[] {
    const baseQueries = [
      `${topic} guide`,
      `${topic} best practices`,
      `${topic} strategy`,
      `${topic} examples`,
      `best ${topic} tools`,
      `${topic} case study`,
    ];

    if (industry) {
      baseQueries.push(`${industry} ${topic}`, `${topic} in ${industry}`);
    }

    if (targetAudience) {
      baseQueries.push(`${topic} for ${targetAudience}`);
    }

    return [...new Set(baseQueries)].slice(0, DISCOVERY_QUERY_MAX);
  }

  private tokenizeForMatching(input: string): string[] {
    return input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  private buildFallbackCompetitorAnalysis(
    searchResults: any[],
    topic: string,
    industry?: string
  ): CompetitorDiscoveryResult {
    const topicTokens = this.tokenizeForMatching(`${topic} ${industry || ''}`);
    const safeTopicTokens = topicTokens.length > 0 ? topicTokens : ['content', 'strategy'];

    const rankedCompetitors = (searchResults || [])
      .filter(result => result?.url && result?.title)
      .map(result => {
        let domain = '';
        try {
          domain = new URL(result.url).hostname.replace(/^www\./, '');
        } catch {
          domain = 'unknown-domain';
        }

        const haystack = `${result.title || ''} ${result.content || ''} ${domain}`.toLowerCase();
        const overlap = safeTopicTokens.filter(token => haystack.includes(token)).length;
        const overlapScore = Math.round((overlap / safeTopicTokens.length) * 45);
        const sourceScore = typeof result.score === 'number'
          ? Math.round(Math.min(1, Math.max(0, result.score)) * 40)
          : 20;
        const relevanceScore = Math.min(100, Math.max(20, overlapScore + sourceScore + 15));
        const estimatedAuthority = Math.min(
          95,
          Math.max(30, sourceScore + (domain.includes('.org') ? 10 : 0) + (domain.includes('.edu') ? 15 : 0))
        );

        return {
          url: result.url,
          title: result.title,
          relevanceScore,
          reason: `Matched ${overlap}/${safeTopicTokens.length} topic terms with strong search relevance`,
          domain,
          estimatedAuthority,
        };
      })
      .sort((a, b) => (b.relevanceScore + b.estimatedAuthority) - (a.relevanceScore + a.estimatedAuthority))
      .slice(0, DISCOVERY_MAX_COMPETITORS);

    const fallbackCompetitors = rankedCompetitors.length >= 3
      ? rankedCompetitors
      : [
          ...rankedCompetitors,
          {
            url: `https://www.hubspot.com`,
            title: 'HubSpot',
            relevanceScore: 72,
            reason: 'Fallback authoritative source',
            domain: 'hubspot.com',
            estimatedAuthority: 90,
          },
          {
            url: `https://www.semrush.com`,
            title: 'Semrush',
            relevanceScore: 70,
            reason: 'Fallback authoritative source',
            domain: 'semrush.com',
            estimatedAuthority: 88,
          },
          {
            url: `https://www.searchenginejournal.com`,
            title: 'Search Engine Journal',
            relevanceScore: 68,
            reason: 'Fallback authoritative source',
            domain: 'searchenginejournal.com',
            estimatedAuthority: 86,
          },
        ].slice(0, DISCOVERY_MAX_COMPETITORS);

    return {
      competitors: fallbackCompetitors,
      searchStrategy: {
        primaryKeywords: safeTopicTokens.slice(0, 8),
        searchQueries: this.getFallbackSearchQueries(topic, industry),
        totalResults: searchResults.length,
        filteredResults: fallbackCompetitors.length,
      },
      competitiveAnalysis: {
        marketLeaders: fallbackCompetitors.slice(0, 3).map(comp => comp.domain),
        contentGaps: [
          'Lack of implementation-level details',
          'Insufficient recent data references',
          'Weak differentiation in strategic recommendations',
        ],
        opportunityAreas: [
          'Fact-backed guidance',
          'Clear step-by-step frameworks',
          'Practical examples with benchmarks',
        ],
      },
    };
  }
}

// Export singleton instance
export const competitorDiscoveryService = new CompetitorDiscoveryService();
