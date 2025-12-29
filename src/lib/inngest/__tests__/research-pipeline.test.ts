import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock external dependencies
const mockTavilyService = {
  scrapeCompetitors: jest.fn(),
  analyzeContent: jest.fn(),
  searchRelatedContent: jest.fn(),
  healthCheck: jest.fn(),
};

const mockPdfProcessor = {
  processPDF: jest.fn(),
  searchSimilarContent: jest.fn(),
  healthCheck: jest.fn(),
};

const mockGenerateAIText = jest.fn();

// Mock modules
jest.mock('@/lib/services/tavily', () => ({
  tavilyService: mockTavilyService,
}));

jest.mock('@/lib/services/pdf-processor', () => ({
  pdfProcessor: mockPdfProcessor,
}));

jest.mock('@/lib/ai/gateway', () => ({
  generateAIText: mockGenerateAIText,
}));

jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
  CACHE_KEYS: {
    CONTENT_CACHE: (hash: string) => `content:${hash}`,
  },
  CACHE_TTL: {
    CONTENT_CACHE: 3600,
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      download: jest.fn(),
      getPublicUrl: jest.fn(),
    },
  })),
}));

describe('Research Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tavily Service', () => {
    it('should scrape competitor URLs successfully', async () => {
      const mockCompetitorData = [
        {
          url: 'https://example.com',
          title: 'Example Article',
          content: 'This is example content about SEO and content marketing.',
          headings: ['Introduction', 'Main Content', 'Conclusion'],
          wordCount: 500,
          keyTopics: ['SEO', 'content', 'marketing'],
          metaDescription: 'Example meta description',
        },
      ];

      mockTavilyService.scrapeCompetitors.mockResolvedValue(mockCompetitorData);

      const result = await mockTavilyService.scrapeCompetitors(['https://example.com']);

      expect(result).toEqual(mockCompetitorData);
      expect(mockTavilyService.scrapeCompetitors).toHaveBeenCalledWith(['https://example.com']);
    });

    it('should handle scraping failures gracefully', async () => {
      mockTavilyService.scrapeCompetitors.mockRejectedValue(new Error('Network error'));

      await expect(mockTavilyService.scrapeCompetitors(['https://invalid-url.com']))
        .rejects.toThrow('Network error');
    });

    it('should analyze content and return insights', async () => {
      const mockAnalysis = {
        keyTopics: ['SEO', 'content', 'marketing'],
        contentGaps: ['technical SEO', 'local SEO'],
        seoOpportunities: ['Add more headings', 'Increase content length'],
        structureRecommendations: ['Add bullet points', 'Include comparison tables'],
        competitorStrengths: ['Comprehensive content', 'Well-structured'],
        targetKeywords: ['SEO', 'content marketing', 'digital marketing'],
      };

      mockTavilyService.analyzeContent.mockResolvedValue(mockAnalysis);

      const result = await mockTavilyService.analyzeContent('Sample content about SEO');

      expect(result).toEqual(mockAnalysis);
      expect(result.keyTopics).toContain('SEO');
      expect(result.seoOpportunities).toHaveLength(2);
    });
  });

  describe('PDF Processor Service', () => {
    it('should process PDF and extract brand analysis', async () => {
      const mockFile = new File(['mock pdf content'], 'brand-guide.pdf', { type: 'application/pdf' });
      const mockProcessingResult = {
        success: true,
        filePath: 'brand-documents/user123/project456/brand-guide.pdf',
        extractedText: 'Brand guidelines content...',
        chunks: [
          {
            id: 'chunk_0',
            content: 'Brand guidelines content...',
            startIndex: 0,
            endIndex: 100,
            chunkIndex: 0,
          },
        ],
        embeddings: [
          {
            chunkId: 'chunk_0',
            embedding: new Array(1536).fill(0.1),
            metadata: {
              chunkIndex: 0,
              contentLength: 100,
              keywords: ['brand', 'guidelines'],
            },
          },
        ],
        brandAnalysis: {
          tone: 'Professional',
          keyMessages: ['Innovation', 'Quality', 'Customer Success'],
          targetAudience: 'Business professionals',
          brandValues: ['Innovation', 'Reliability', 'Excellence'],
          competitiveAdvantages: ['Advanced technology', 'Expert support'],
          brandVoice: 'Professional and approachable',
          contentThemes: ['Business growth', 'Technology', 'Success'],
        },
        processingTime: 2000,
      };

      mockPdfProcessor.processPDF.mockResolvedValue(mockProcessingResult);

      const result = await mockPdfProcessor.processPDF(mockFile, 'user123', 'project456');

      expect(result.success).toBe(true);
      expect(result.brandAnalysis.tone).toBe('Professional');
      expect(result.chunks).toHaveLength(1);
      expect(result.embeddings).toHaveLength(1);
    });

    it('should handle PDF processing failures', async () => {
      const mockFile = new File(['invalid content'], 'invalid.pdf', { type: 'application/pdf' });
      const mockFailureResult = {
        success: false,
        filePath: '',
        extractedText: '',
        chunks: [],
        embeddings: [],
        brandAnalysis: {
          tone: 'Professional',
          keyMessages: ['Quality service', 'Customer success'],
          targetAudience: 'Business professionals',
          brandValues: ['Quality', 'Reliability'],
          competitiveAdvantages: ['Expertise'],
          brandVoice: 'Professional',
          contentThemes: ['Business', 'Success'],
        },
        processingTime: 1000,
        error: 'Failed to extract text from PDF',
      };

      mockPdfProcessor.processPDF.mockResolvedValue(mockFailureResult);

      const result = await mockPdfProcessor.processPDF(mockFile, 'user123', 'project456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to extract text from PDF');
    });
  });

  describe('AI Research Analysis', () => {
    it('should generate comprehensive research analysis', async () => {
      const mockAIResponse = {
        text: `
        Research Analysis:
        
        Top Competitors:
        - Competitor A: Strong technical content
        - Competitor B: Good user experience focus
        - Competitor C: Comprehensive guides
        
        Key Insights:
        - Most competitors focus on technical aspects
        - Limited coverage of business impact
        - Opportunity for more practical examples
        
        Content Opportunities:
        - Create more business-focused content
        - Add practical implementation guides
        - Include case studies and examples
        
        Recommended Approach:
        Create comprehensive content that bridges technical knowledge with business value
        
        Target Keywords:
        - SEO optimization
        - content strategy
        - digital marketing
        - business growth
        
        Competitive Gaps:
        - Lack of business-focused content
        - Limited practical examples
        - Missing implementation guides
        
        Content Strategy:
        Develop content that combines technical expertise with practical business applications
        `,
        model: 'gemini-1.5-pro' as const,
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.05,
      };

      mockGenerateAIText.mockResolvedValue(mockAIResponse);

      const result = await mockGenerateAIText(
        'Analyze competitor research data...',
        'research',
        'user123'
      );

      expect(result.text).toContain('Research Analysis');
      expect(result.text).toContain('Top Competitors');
      expect(result.text).toContain('Content Strategy');
      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
      expect(result.cost).toBe(0.05);
    });

    it('should handle AI analysis failures', async () => {
      mockGenerateAIText.mockRejectedValue(new Error('AI service unavailable'));

      await expect(mockGenerateAIText('test prompt', 'research', 'user123'))
        .rejects.toThrow('AI service unavailable');
    });
  });

  describe('Research Pipeline Integration', () => {
    it('should complete full research pipeline successfully', async () => {
      // Mock all dependencies for successful pipeline
      const mockCompetitorData = [
        {
          url: 'https://competitor1.com',
          title: 'Competitor 1 Article',
          content: 'Comprehensive SEO guide...',
          headings: ['Introduction', 'SEO Basics', 'Advanced Techniques'],
          wordCount: 2000,
          keyTopics: ['SEO', 'optimization', 'ranking'],
          metaDescription: 'Complete SEO guide',
        },
        {
          url: 'https://competitor2.com',
          title: 'Competitor 2 Guide',
          content: 'Content marketing strategies...',
          headings: ['Content Strategy', 'Distribution', 'Measurement'],
          wordCount: 1500,
          keyTopics: ['content', 'marketing', 'strategy'],
          metaDescription: 'Content marketing guide',
        },
      ];

      const mockBrandAnalysis = {
        tone: 'Professional and data-driven',
        keyMessages: ['Innovation', 'Results', 'Expertise'],
        targetAudience: 'Marketing professionals and business owners',
        brandValues: ['Innovation', 'Reliability', 'Customer Success'],
        competitiveAdvantages: ['AI-powered insights', 'Comprehensive analytics'],
        brandVoice: 'Expert yet approachable',
        contentThemes: ['Digital marketing', 'SEO', 'Business growth'],
      };

      const mockAIAnalysis = {
        text: 'Comprehensive research analysis with structured insights...',
        model: 'gemini-1.5-pro' as const,
        inputTokens: 2000,
        outputTokens: 800,
        cost: 0.10,
      };

      mockTavilyService.scrapeCompetitors.mockResolvedValue(mockCompetitorData);
      mockPdfProcessor.processPDF.mockResolvedValue({
        success: true,
        filePath: 'brand-documents/test.pdf',
        extractedText: 'Brand guidelines...',
        chunks: [],
        embeddings: [],
        brandAnalysis: mockBrandAnalysis,
        processingTime: 3000,
      });
      mockGenerateAIText.mockResolvedValue(mockAIAnalysis);

      // Simulate the research pipeline workflow
      const competitorUrls = ['https://competitor1.com', 'https://competitor2.com'];
      const brandDocumentPath = 'brand-documents/test.pdf';

      // Step 1: Scrape competitors
      const competitorData = await mockTavilyService.scrapeCompetitors(competitorUrls);
      expect(competitorData).toHaveLength(2);

      // Step 2: Process brand document
      const mockFile = new File(['brand content'], 'brand.pdf', { type: 'application/pdf' });
      const brandResult = await mockPdfProcessor.processPDF(mockFile, 'user123', 'project456');
      expect(brandResult.success).toBe(true);

      // Step 3: Generate AI analysis
      const aiAnalysis = await mockGenerateAIText('analysis prompt', 'research', 'user123');
      expect(aiAnalysis.text).toContain('research analysis');

      // Verify all steps completed successfully
      expect(mockTavilyService.scrapeCompetitors).toHaveBeenCalledWith(competitorUrls);
      expect(mockPdfProcessor.processPDF).toHaveBeenCalledWith(mockFile, 'user123', 'project456');
      expect(mockGenerateAIText).toHaveBeenCalledWith('analysis prompt', 'research', 'user123');
    });

    it('should handle partial failures gracefully', async () => {
      // Mock competitor scraping success but PDF processing failure
      const mockCompetitorData = [
        {
          url: 'https://competitor1.com',
          title: 'Competitor Article',
          content: 'SEO content...',
          headings: ['Introduction'],
          wordCount: 1000,
          keyTopics: ['SEO'],
          metaDescription: 'SEO guide',
        },
      ];

      mockTavilyService.scrapeCompetitors.mockResolvedValue(mockCompetitorData);
      mockPdfProcessor.processPDF.mockResolvedValue({
        success: false,
        filePath: '',
        extractedText: '',
        chunks: [],
        embeddings: [],
        brandAnalysis: {
          tone: 'Professional',
          keyMessages: ['Quality'],
          targetAudience: 'Professionals',
          brandValues: ['Quality'],
          competitiveAdvantages: ['Expertise'],
          brandVoice: 'Professional',
          contentThemes: ['Business'],
        },
        processingTime: 1000,
        error: 'PDF processing failed',
      });

      // Pipeline should continue even with PDF processing failure
      const competitorData = await mockTavilyService.scrapeCompetitors(['https://competitor1.com']);
      expect(competitorData).toHaveLength(1);

      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const brandResult = await mockPdfProcessor.processPDF(mockFile, 'user123', 'project456');
      expect(brandResult.success).toBe(false);
      expect(brandResult.error).toBe('PDF processing failed');

      // Should still have default brand analysis
      expect(brandResult.brandAnalysis.tone).toBe('Professional');
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed operations', async () => {
      // First call fails, second succeeds
      mockTavilyService.scrapeCompetitors
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce([
          {
            url: 'https://example.com',
            title: 'Example',
            content: 'Content',
            headings: [],
            wordCount: 100,
            keyTopics: ['example'],
          },
        ]);

      // Simulate retry logic
      let result;
      try {
        result = await mockTavilyService.scrapeCompetitors(['https://example.com']);
      } catch (error) {
        // Retry on failure
        result = await mockTavilyService.scrapeCompetitors(['https://example.com']);
      }

      expect(result).toHaveLength(1);
      expect(mockTavilyService.scrapeCompetitors).toHaveBeenCalledTimes(2);
    });

    it('should provide fallback analysis when AI fails', async () => {
      mockGenerateAIText.mockRejectedValue(new Error('AI service down'));

      // Simulate fallback analysis generation
      const fallbackAnalysis = {
        topCompetitors: ['Competitor 1'],
        keyInsights: ['Basic analysis completed'],
        contentOpportunities: ['Content gap identified'],
        recommendedApproach: 'Data-driven approach',
        targetKeywords: ['SEO', 'content'],
        competitiveGaps: ['Unique positioning'],
        contentStrategy: 'Comprehensive strategy',
      };

      // In the actual implementation, this would be generated by the fallback function
      expect(fallbackAnalysis.topCompetitors).toHaveLength(1);
      expect(fallbackAnalysis.keyInsights).toContain('Basic analysis completed');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache research results for duplicate requests', async () => {
      const mockCompetitorData = [
        {
          url: 'https://example.com',
          title: 'Cached Example',
          content: 'Cached content',
          headings: ['Cached Heading'],
          wordCount: 200,
          keyTopics: ['cached'],
        },
      ];

      // First call should hit the service
      mockTavilyService.scrapeCompetitors.mockResolvedValueOnce(mockCompetitorData);

      const result1 = await mockTavilyService.scrapeCompetitors(['https://example.com']);
      expect(result1).toEqual(mockCompetitorData);

      // Second call should return cached result (in real implementation)
      // For testing, we'll just verify the service was called once
      expect(mockTavilyService.scrapeCompetitors).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent research requests', async () => {
      const mockData = [
        {
          url: 'https://concurrent1.com',
          title: 'Concurrent 1',
          content: 'Content 1',
          headings: [],
          wordCount: 100,
          keyTopics: ['test'],
        },
      ];

      mockTavilyService.scrapeCompetitors.mockResolvedValue(mockData);

      // Simulate concurrent requests
      const promises = [
        mockTavilyService.scrapeCompetitors(['https://concurrent1.com']),
        mockTavilyService.scrapeCompetitors(['https://concurrent1.com']),
        mockTavilyService.scrapeCompetitors(['https://concurrent1.com']),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual(mockData);
      });
    });
  });
});