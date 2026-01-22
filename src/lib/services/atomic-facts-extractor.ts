import { generateStructuredOutput, generateAIText } from '@/lib/ai/gateway';
import { z } from 'zod';

// Schema for atomic facts
const AtomicFactSchema = z.object({
  id: z.string(),
  fact: z.string().min(10).max(200), // Concise, single-sentence facts
  category: z.enum(['statistic', 'process', 'definition', 'insight', 'claim', 'example', 'quote', 'technical']),
  confidence: z.number().min(0).max(100), // Confidence in fact accuracy
  relevanceScore: z.number().min(0).max(100), // Relevance to main topic
  source: z.string(), // Source URL or document
  keywords: z.array(z.string()).max(5), // Key terms in this fact
  context: z.string().optional(), // Additional context if needed
  verified: z.boolean().default(false) // Whether fact has been verified
});

const AtomicFactsExtractionSchema = z.object({
  facts: z.array(AtomicFactSchema).min(5).max(50),
  extractionMetrics: z.object({
    originalTokens: z.number(),
    extractedFacts: z.number(),
    compressionRatio: z.number(), // How much we compressed the content
    qualityScore: z.number().min(0).max(100)
  }),
  topicCoverage: z.object({
    mainTopics: z.array(z.string()),
    subtopics: z.array(z.string()),
    coverageScore: z.number().min(0).max(100)
  })
});

type AtomicFact = z.infer<typeof AtomicFactSchema>;
type AtomicFactsExtraction = z.infer<typeof AtomicFactsExtractionSchema>;

export class AtomicFactsExtractor {
  /**
   * Extract atomic facts from raw content - The core "Map" operation
   * Converts 20k tokens of "noise" into 1.5k tokens of "pure signal"
   */
  async extractAtomicFacts(
    rawContent: string,
    source: string,
    topic: string,
    userId?: string
  ): Promise<AtomicFactsExtraction> {
    console.log(`Extracting atomic facts from ${rawContent.length} characters of content`);

    // Step 1: Clean and preprocess content
    const cleanedContent = this.preprocessContent(rawContent);

    // Step 2: Extract facts using AI with structured output
    const extraction = await this.performFactExtraction(cleanedContent, source, topic, userId);

    // Step 3: Post-process and validate facts
    const validatedFacts = await this.validateAndEnrichFacts(extraction.facts, topic, userId);

    // Step 4: Calculate metrics
    const metrics = this.calculateExtractionMetrics(rawContent, validatedFacts);

    console.log(`Extracted ${validatedFacts.length} atomic facts with ${metrics.compressionRatio}x compression`);

    return {
      facts: validatedFacts,
      extractionMetrics: metrics,
      topicCoverage: extraction.topicCoverage
    };
  }

  /**
   * Clean and preprocess raw content for fact extraction
   */
  private preprocessContent(rawContent: string): string {
    // Remove HTML tags, ads, navigation, and other noise
    let cleaned = rawContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    // Remove common noise patterns
    const noisePatterns = [
      /cookie policy/gi,
      /privacy policy/gi,
      /terms of service/gi,
      /subscribe to newsletter/gi,
      /follow us on/gi,
      /share this article/gi,
      /advertisement/gi,
      /sponsored content/gi
    ];

    noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned;
  }

  /**
   * Perform AI-powered fact extraction with structured output
   */
  private async performFactExtraction(
    content: string,
    source: string,
    topic: string,
    userId?: string
  ): Promise<AtomicFactsExtraction> {
    const extractionPrompt = `
      SYSTEM PROMPT:
      "You are a specialized Data Extraction Agent. Your goal is to convert the provided Markdown text into a high-density list of Atomic Facts.
      STRICT RULES:
      1. No Summarization: Do not use phrases like 'The article discusses...' or 'In summary...'.
      2. Atomicity: Every single feature, pricing dollar amount, integration name, technical limit, or expert claim must be its own bullet point.
      3. Preserve Specifics: If a competitor mentions '99.9% uptime' or '$12/user/month', you MUST include the exact numbers.
      4. Entity Extraction: List every brand, tool, and software mentioned in the text.

      OUTPUT FORMAT:
      * [CATEGORY]: [SPECIFIC FACT]
      Example: - PRICING: Professional tier starts at $45/user/month billed annually."

      TOPIC: ${topic}
      SOURCE: ${source}
      CONTENT: ${content.substring(0, 8000)}${content.length > 8000 ? '...' : ''}

      Extract 10-50 high-quality atomic facts that capture the essential information with maximum density.
    `;

    const result = await generateStructuredOutput(
      extractionPrompt,
      AtomicFactsExtractionSchema,
      'research', // Use research model for extraction
      userId
    );

    return result.object;
  }

  /**
   * Validate and enrich extracted facts
   */
  private async validateAndEnrichFacts(
    facts: AtomicFact[],
    topic: string,
    userId?: string
  ): Promise<AtomicFact[]> {
    const validatedFacts: AtomicFact[] = [];

    for (const fact of facts) {
      // Basic validation
      if (this.isValidFact(fact)) {
        // Enrich with additional metadata
        const enrichedFact = await this.enrichFact(fact, topic, userId);
        validatedFacts.push(enrichedFact);
      }
    }

    // Sort by relevance and confidence
    return validatedFacts.sort((a, b) =>
      (b.relevanceScore * b.confidence) - (a.relevanceScore * a.confidence)
    );
  }

  /**
   * Basic fact validation
   */
  private isValidFact(fact: AtomicFact): boolean {
    // Check minimum requirements
    if (!fact.fact || fact.fact.length < 10) return false;
    if (fact.confidence < 50) return false; // Only high-confidence facts
    if (fact.relevanceScore < 30) return false; // Only relevant facts

    // Check for common issues
    const lowQualityPatterns = [
      /click here/i,
      /learn more/i,
      /contact us/i,
      /subscribe/i,
      /advertisement/i
    ];

    return !lowQualityPatterns.some(pattern => pattern.test(fact.fact));
  }

  /**
   * Enrich fact with additional metadata
   */
  private async enrichFact(fact: AtomicFact, topic: string, userId?: string): Promise<AtomicFact> {
    // Generate unique ID if not present
    if (!fact.id) {
      fact.id = `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Extract keywords if not present
    if (!fact.keywords || fact.keywords.length === 0) {
      fact.keywords = this.extractKeywords(fact.fact, topic);
    }

    // Set verification status (in production, this could involve fact-checking APIs)
    fact.verified = fact.confidence > 80 && fact.category !== 'claim';

    return fact;
  }

  /**
   * Extract keywords from fact text
   */
  private extractKeywords(factText: string, topic: string): string[] {
    // Simple keyword extraction (in production, use more sophisticated NLP)
    const words = factText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Remove common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'said', 'each', 'which', 'their', 'time', 'more', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were']);

    const keywords = words
      .filter(word => !stopWords.has(word))
      .slice(0, 5); // Limit to 5 keywords

    return keywords;
  }

  /**
   * Calculate extraction metrics
   */
  private calculateExtractionMetrics(originalContent: string, facts: AtomicFact[]): any {
    const originalTokens = Math.ceil(originalContent.length / 4); // Rough token estimate
    const factTokens = facts.reduce((total, fact) => total + Math.ceil(fact.fact.length / 4), 0);

    return {
      originalTokens,
      extractedFacts: facts.length,
      compressionRatio: Math.round((originalTokens / factTokens) * 10) / 10,
      qualityScore: Math.round(facts.reduce((sum, fact) => sum + (fact.confidence * fact.relevanceScore / 100), 0) / facts.length)
    };
  }

  /**
   * Filter facts by relevance to specific section
   */
  async filterFactsForSection(
    facts: AtomicFact[],
    sectionHeading: string,
    sectionGoal: string,
    keyPoints: string[],
    userId?: string
  ): Promise<AtomicFact[]> {
    const filterPrompt = `
      Filter these atomic facts to find the most relevant ones for this content section.
      
      Section: ${sectionHeading}
      Goal: ${sectionGoal}
      Key Points: ${keyPoints.join(', ')}
      
      Available Facts:
      ${facts.map((fact, index) => `${index + 1}. [${fact.category}] ${fact.fact} (Confidence: ${fact.confidence}%)`).join('\n')}
      
      Select the facts that are:
      1. Directly relevant to the section goal
      2. Support the key points being made
      3. Provide specific data or insights
      4. High confidence and verified
      
      Return the indices of the most relevant facts (maximum 10).
    `;

    const filterSchema = z.object({
      selectedIndices: z.array(z.number()).max(10),
      reasoning: z.string()
    });

    const result = await generateStructuredOutput(
      filterPrompt,
      filterSchema,
      'structured',
      userId
    );

    // Return filtered facts
    return result.object.selectedIndices
      .filter(index => index >= 0 && index < facts.length)
      .map(index => facts[index]);
  }

  /**
   * Batch process multiple content sources
   */
  async batchExtractFacts(
    sources: Array<{ content: string; source: string; topic: string }>,
    userId?: string
  ): Promise<AtomicFact[]> {
    const allFacts: AtomicFact[] = [];

    for (const { content, source, topic } of sources) {
      try {
        const extraction = await this.extractAtomicFacts(content, source, topic, userId);
        allFacts.push(...extraction.facts);
      } catch (error) {
        console.error(`Failed to extract facts from ${source}:`, error);
      }
    }

    // Deduplicate similar facts
    return this.deduplicateFacts(allFacts);
  }

  /**
   * Remove duplicate or very similar facts
   */
  private deduplicateFacts(facts: AtomicFact[]): AtomicFact[] {
    const uniqueFacts: AtomicFact[] = [];

    for (const fact of facts) {
      const isDuplicate = uniqueFacts.some(existing =>
        this.calculateSimilarity(fact.fact, existing.fact) > 0.8
      );

      if (!isDuplicate) {
        uniqueFacts.push(fact);
      }
    }

    return uniqueFacts;
  }

  /**
   * Calculate similarity between two fact texts
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation (in production, use more sophisticated methods)
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}

// Export singleton instance
export const atomicFactsExtractor = new AtomicFactsExtractor();