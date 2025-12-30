/**
 * Integration test for enhanced project creation with event-driven architecture
 * This test verifies the complete flow from API request to background processing
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => ({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-project-id',
              user_id: 'test-user-id',
              topic: 'Test Topic',
              competitor_urls: ['https://example.com'],
              tone: 'professional',
              format: 'how-to',
              status: 'draft',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => ({
          data: { path: 'test-path' },
          error: null,
        })),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: 'https://example.com/file.pdf' },
        })),
      })),
    },
    channel: jest.fn(() => ({
      send: jest.fn(() => Promise.resolve()),
    })),
  })),
}));

jest.mock('@/lib/rate-limiting/quota', () => ({
  checkQuota: jest.fn(() => Promise.resolve({
    allowed: true,
    usage: 1,
    limit: 10,
  })),
}));

jest.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/lib/utils/type-transformers', () => ({
  transformDatabaseRowToProject: jest.fn((row) => ({
    ...row,
    competitorUrls: row.competitor_urls,
    brandDocumentPath: row.brand_document_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })),
}));

// Mock file for testing
function createMockFile(name: string, type: string, content: string): File {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  
  // Mock arrayBuffer method
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode(content).buffer,
    writable: false,
  });
  
  return file;
}

describe('Enhanced Project Creation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create project with enhanced security validation', async () => {
    // Create form data with file
    const formData = new FormData();
    formData.append('topic', 'Best Project Management Tools');
    formData.append('competitorUrls', JSON.stringify(['https://example.com/article']));
    formData.append('tone', 'professional');
    formData.append('format', 'how-to');
    
    // Create a mock PDF file
    const pdfContent = '%PDF-1.4\nTest PDF content';
    const mockFile = createMockFile('brand-guide.pdf', 'application/pdf', pdfContent);
    formData.append('brandDocument', mockFile);

    // Create mock request
    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: formData,
    });

    // Call the API
    const response = await POST(request);
    const result = await response.json();

    // Verify response structure
    expect(response.status).toBe(201);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.project).toBeDefined();
    expect(result.data.securityInfo).toBeDefined();
    expect(result.data.processingInfo).toBeDefined();

    // Verify security information
    expect(result.data.securityInfo.virusScanPassed).toBe(true);
    expect(result.data.securityInfo.scanId).toBeDefined();

    // Verify processing information
    expect(result.data.processingInfo.backgroundProcessingStarted).toBe(true);
    expect(result.data.processingInfo.estimatedCompletionTime).toBeDefined();
    expect(result.data.processingInfo.realTimeUpdatesChannel).toBe('project:test-project-id');
  });

  it('should reject file with virus detected', async () => {
    const formData = new FormData();
    formData.append('topic', 'Test Topic');
    formData.append('competitorUrls', JSON.stringify(['https://example.com']));
    formData.append('tone', 'professional');
    formData.append('format', 'how-to');
    
    // Create a mock file with malicious content (PE executable header)
    const maliciousContent = String.fromCharCode(0x4D, 0x5A, 0x90, 0x00);
    const mockFile = createMockFile('malware.pdf', 'application/pdf', maliciousContent);
    formData.append('brandDocument', mockFile);

    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('VIRUS_DETECTED');
    expect(result.error.details.threats).toContain('Suspicious executable or script content detected');
  });

  it('should reject oversized file', async () => {
    const formData = new FormData();
    formData.append('topic', 'Test Topic');
    formData.append('competitorUrls', JSON.stringify(['https://example.com']));
    formData.append('tone', 'professional');
    formData.append('format', 'how-to');
    
    // Create a mock file that's too large
    const largeContent = 'x'.repeat(50 * 1024 * 1024); // 50MB
    const mockFile = createMockFile('large.pdf', 'application/pdf', largeContent);
    
    // Override size property
    Object.defineProperty(mockFile, 'size', {
      value: 50 * 1024 * 1024,
      writable: false,
    });
    
    formData.append('brandDocument', mockFile);

    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FILE_VALIDATION_ERROR');
  });

  it('should handle project creation without file upload', async () => {
    const formData = new FormData();
    formData.append('topic', 'Test Topic Without File');
    formData.append('competitorUrls', JSON.stringify(['https://example.com']));
    formData.append('tone', 'witty');
    formData.append('format', 'listicle');

    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.success).toBe(true);
    expect(result.data.project).toBeDefined();
    expect(result.data.securityInfo).toBeUndefined(); // No file uploaded
    expect(result.data.processingInfo.backgroundProcessingStarted).toBe(true);
  });

  it('should validate competitor URLs', async () => {
    const formData = new FormData();
    formData.append('topic', 'Test Topic');
    formData.append('competitorUrls', JSON.stringify(['invalid-url', 'not-a-url']));
    formData.append('tone', 'professional');
    formData.append('format', 'how-to');

    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle quota exceeded', async () => {
    // Mock quota check to return exceeded
    const { checkQuota } = require('@/lib/rate-limiting/quota');
    checkQuota.mockResolvedValueOnce({
      allowed: false,
      usage: 10,
      limit: 10,
    });

    const formData = new FormData();
    formData.append('topic', 'Test Topic');
    formData.append('competitorUrls', JSON.stringify(['https://example.com']));
    formData.append('tone', 'professional');
    formData.append('format', 'how-to');

    const request = new NextRequest('http://localhost:3000/api/projects', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(429);
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('QUOTA_EXCEEDED');
  });
});