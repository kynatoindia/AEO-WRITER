import { createClient } from '@supabase/supabase-js';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { generateAIText } from '@/lib/ai/gateway';

// PDF processing configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_MIME_TYPES = ['application/pdf'];
const CHUNK_SIZE = 1000; // Characters per chunk for vector embedding

// Supabase client for file storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface PDFProcessingResult {
  success: boolean;
  filePath: string;
  extractedText: string;
  chunks: TextChunk[];
  embeddings: VectorEmbedding[];
  brandAnalysis: BrandAnalysis;
  processingTime: number;
  error?: string;
}

export interface TextChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
}

export interface VectorEmbedding {
  chunkId: string;
  embedding: number[];
  metadata: {
    chunkIndex: number;
    contentLength: number;
    keywords: string[];
  };
}

export interface BrandAnalysis {
  tone: string;
  keyMessages: string[];
  targetAudience: string;
  brandValues: string[];
  competitiveAdvantages: string[];
  brandVoice: string;
  contentThemes: string[];
}

class PDFProcessorService {
  private readonly maxFileSize: number;
  private readonly supportedTypes: string[];
  private readonly chunkSize: number;

  constructor() {
    this.maxFileSize = MAX_FILE_SIZE;
    this.supportedTypes = SUPPORTED_MIME_TYPES;
    this.chunkSize = CHUNK_SIZE;
  }

  /**
   * Process uploaded PDF file with brand analysis and vector embeddings
   */
  async processPDF(file: File, userId: string, projectId: string): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate file
      this.validateFile(file);

      // Check cache first
      const cacheKey = CACHE_KEYS.CONTENT_CACHE(`pdf_${file.name}_${file.size}_${file.lastModified}`);
      const cached = await redis.get<PDFProcessingResult>(cacheKey);
      if (cached) {
        console.log('Returning cached PDF processing result');
        return cached;
      }

      // Upload file to Supabase Storage
      const filePath = await this.uploadFile(file, userId, projectId);

      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(filePath);

      // Create text chunks
      const chunks = this.createTextChunks(extractedText);

      // Generate vector embeddings (using AI service)
      const embeddings = await this.generateEmbeddings(chunks);

      // Analyze brand content using AI
      const brandAnalysis = await this.analyzeBrandContent(extractedText);

      const result: PDFProcessingResult = {
        success: true,
        filePath,
        extractedText,
        chunks,
        embeddings,
        brandAnalysis,
        processingTime: Date.now() - startTime,
      };

      // Cache result
      await redis.setex(cacheKey, CACHE_TTL.CONTENT_CACHE, result);

      console.log(`PDF processing completed in ${result.processingTime}ms`);
      return result;

    } catch (error) {
      console.error('PDF processing failed:', error);
      return {
        success: false,
        filePath: '',
        extractedText: '',
        chunks: [],
        embeddings: [],
        brandAnalysis: this.getDefaultBrandAnalysis(),
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: File): void {
    if (file.size > this.maxFileSize) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    if (!this.supportedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported. Supported types: ${this.supportedTypes.join(', ')}`);
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('File must have .pdf extension');
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private async uploadFile(file: File, userId: string, projectId: string): Promise<string> {
    const fileName = `${userId}/${projectId}/${Date.now()}_${file.name}`;
    const filePath = `brand-documents/${fileName}`;

    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }

    console.log(`File uploaded successfully: ${data.path}`);
    return data.path;
  }

  /**
   * Extract text from PDF using a PDF parsing service
   * Note: In production, you would use a proper PDF parsing library like pdf-parse
   * For now, we'll simulate text extraction
   */
  private async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      // Get file URL from Supabase
      const { data } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath);

      if (!data.publicUrl) {
        throw new Error('Failed to get file URL');
      }

      // In a real implementation, you would:
      // 1. Download the PDF file
      // 2. Use a PDF parsing library (like pdf-parse, pdf2pic, etc.)
      // 3. Extract text content
      
      // For now, we'll simulate text extraction
      // In production, replace this with actual PDF parsing
      const simulatedText = await this.simulatePDFTextExtraction(data.publicUrl);
      
      if (!simulatedText || simulatedText.length < 100) {
        throw new Error('Insufficient text content extracted from PDF');
      }

      return simulatedText;

    } catch (error) {
      console.error('PDF text extraction failed:', error);
      throw new Error(`PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate PDF text extraction (replace with real PDF parsing in production)
   */
  private async simulatePDFTextExtraction(fileUrl: string): Promise<string> {
    // This is a placeholder - in production, implement actual PDF parsing
    return `
    Brand Guidelines Document
    
    Our company mission is to provide innovative solutions that empower businesses to succeed in the digital age.
    
    Brand Voice and Tone:
    - Professional yet approachable
    - Data-driven and analytical
    - Solution-focused
    - Empowering and supportive
    
    Target Audience:
    - Business owners and entrepreneurs
    - Marketing professionals
    - Content creators and SEO specialists
    - Small to medium-sized businesses
    
    Key Messages:
    - Innovation drives success
    - Data-informed decision making
    - Scalable solutions for growing businesses
    - Expert guidance and support
    
    Brand Values:
    - Innovation and creativity
    - Reliability and trust
    - Customer success focus
    - Continuous improvement
    
    Competitive Advantages:
    - Advanced AI-powered technology
    - Comprehensive analytics and reporting
    - Expert customer support
    - Scalable pricing plans
    - User-friendly interface
    
    Content Themes:
    - Digital transformation
    - Business growth strategies
    - Marketing automation
    - SEO and content marketing
    - Data analytics and insights
    `;
  }

  /**
   * Create text chunks for vector embedding
   */
  private createTextChunks(text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    let startIndex = 0;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
      
      if (potentialChunk.length > this.chunkSize && currentChunk) {
        // Save current chunk
        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          startIndex,
          endIndex: startIndex + currentChunk.length,
          chunkIndex,
        });

        // Start new chunk
        currentChunk = trimmedSentence;
        startIndex = startIndex + currentChunk.length + 2; // +2 for '. '
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        startIndex,
        endIndex: startIndex + currentChunk.length,
        chunkIndex,
      });
    }

    console.log(`Created ${chunks.length} text chunks from PDF`);
    return chunks;
  }

  /**
   * Generate vector embeddings for text chunks
   * Note: In production, you would use a proper embedding service like OpenAI Embeddings
   */
  private async generateEmbeddings(chunks: TextChunk[]): Promise<VectorEmbedding[]> {
    const embeddings: VectorEmbedding[] = [];

    for (const chunk of chunks) {
      try {
        // In production, use OpenAI Embeddings API or similar service
        // For now, we'll create mock embeddings
        const embedding = await this.generateMockEmbedding(chunk.content);
        
        embeddings.push({
          chunkId: chunk.id,
          embedding,
          metadata: {
            chunkIndex: chunk.chunkIndex,
            contentLength: chunk.content.length,
            keywords: this.extractKeywords(chunk.content),
          },
        });

      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${chunk.id}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    console.log(`Generated ${embeddings.length} vector embeddings`);
    return embeddings;
  }

  /**
   * Generate mock embedding (replace with real embedding service in production)
   */
  private async generateMockEmbedding(text: string): Promise<number[]> {
    // This is a placeholder - in production, use OpenAI Embeddings API
    // or another embedding service
    const embedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    return embedding;
  }

  /**
   * Extract keywords from text chunk
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were']);

    const filteredWords = words.filter(word => !stopWords.has(word));
    const wordFreq: Record<string, number> = {};

    filteredWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Analyze brand content using AI
   */
  private async analyzeBrandContent(text: string): Promise<BrandAnalysis> {
    try {
      const analysisPrompt = `
        Analyze the following brand document and extract key brand information:

        ${text}

        Please provide a comprehensive brand analysis including:
        1. Brand tone and voice characteristics
        2. Key brand messages and value propositions
        3. Target audience description
        4. Core brand values
        5. Competitive advantages
        6. Content themes and topics

        Format your response as a structured analysis with clear sections.
      `;

      const aiResponse = await generateAIText(analysisPrompt, 'research');
      
      // Parse AI response into structured format
      return this.parseAIBrandAnalysis(aiResponse.text);

    } catch (error) {
      console.error('AI brand analysis failed:', error);
      // Return basic analysis based on text content
      return this.generateBasicBrandAnalysis(text);
    }
  }

  /**
   * Parse AI response into structured brand analysis
   */
  private parseAIBrandAnalysis(aiResponse: string): BrandAnalysis {
    // Simple parsing - in production, you might use more sophisticated NLP
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    return {
      tone: this.extractSection(lines, 'tone') || 'Professional',
      keyMessages: this.extractListSection(lines, 'messages') || ['Innovation', 'Quality', 'Customer Success'],
      targetAudience: this.extractSection(lines, 'audience') || 'Business professionals',
      brandValues: this.extractListSection(lines, 'values') || ['Innovation', 'Reliability', 'Excellence'],
      competitiveAdvantages: this.extractListSection(lines, 'advantages') || ['Advanced technology', 'Expert support'],
      brandVoice: this.extractSection(lines, 'voice') || 'Professional and approachable',
      contentThemes: this.extractListSection(lines, 'themes') || ['Business growth', 'Technology', 'Success'],
    };
  }

  /**
   * Extract section content from AI response
   */
  private extractSection(lines: string[], keyword: string): string | null {
    const sectionLine = lines.find(line => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (sectionLine) {
      return sectionLine.split(':')[1]?.trim() || null;
    }
    
    return null;
  }

  /**
   * Extract list section from AI response
   */
  private extractListSection(lines: string[], keyword: string): string[] | null {
    const startIndex = lines.findIndex(line => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (startIndex === -1) return null;
    
    const items: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)) {
        items.push(line.replace(/^[-•\d.]\s*/, '').trim());
      } else if (line && !line.includes(':')) {
        break;
      }
    }
    
    return items.length > 0 ? items : null;
  }

  /**
   * Generate basic brand analysis from text content
   */
  private generateBasicBrandAnalysis(text: string): BrandAnalysis {
    const keywords = this.extractKeywords(text);
    
    return {
      tone: 'Professional',
      keyMessages: keywords.slice(0, 3),
      targetAudience: 'Business professionals',
      brandValues: ['Quality', 'Innovation', 'Reliability'],
      competitiveAdvantages: ['Expertise', 'Technology'],
      brandVoice: 'Professional and informative',
      contentThemes: keywords,
    };
  }

  /**
   * Get default brand analysis for error cases
   */
  private getDefaultBrandAnalysis(): BrandAnalysis {
    return {
      tone: 'Professional',
      keyMessages: ['Quality service', 'Customer success'],
      targetAudience: 'Business professionals',
      brandValues: ['Quality', 'Reliability'],
      competitiveAdvantages: ['Expertise'],
      brandVoice: 'Professional',
      contentThemes: ['Business', 'Success'],
    };
  }

  /**
   * Search similar content using vector embeddings
   */
  async searchSimilarContent(query: string, embeddings: VectorEmbedding[], limit: number = 5): Promise<VectorEmbedding[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateMockEmbedding(query);
      
      // Calculate similarity scores
      const similarities = embeddings.map(embedding => ({
        ...embedding,
        similarity: this.calculateCosineSimilarity(queryEmbedding, embedding.embedding),
      }));

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      console.error('Similar content search failed:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Health check for PDF processing service
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Test Supabase storage connection
      const { data, error } = await supabase.storage.listBuckets();
      
      if (error) {
        return { healthy: false, error: `Storage error: ${error.message}` };
      }

      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const pdfProcessor = new PDFProcessorService();

// Export types
export type { PDFProcessingResult, TextChunk, VectorEmbedding, BrandAnalysis };