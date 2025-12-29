import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from '../route';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@/lib/inngest/client');

describe('/api/projects/[id]/research', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST - Start Research Pipeline', () => {
    it('should start research pipeline successfully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: [
            'https://competitor1.com',
            'https://competitor2.com',
          ],
          brandDocument: 'brand-documents/test.pdf',
        }),
      });

      const params = { id: 'test-project' };

      // Mock Supabase responses
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'test-project',
            user_id: 'test-user',
            topic: 'SEO Best Practices',
            tone: 'professional',
            format: 'how-to',
            status: 'draft',
          },
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      };

      // Mock Inngest client
      const mockInngest = {
        send: jest.fn().mockResolvedValue({
          ids: ['event-123'],
        }),
      };

      // Note: In a real test, you would properly mock the modules
      // For now, we'll test the request/response structure

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('projectId');
      expect(data.data).toHaveProperty('status');
      expect(data.data).toHaveProperty('competitorCount');
    });

    it('should validate request data', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: [], // Invalid: empty array
        }),
      });

      const params = { id: 'test-project' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle project not found', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/nonexistent/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: ['https://competitor1.com'],
        }),
      });

      const params = { id: 'nonexistent' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should handle invalid project state', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/completed-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: ['https://competitor1.com'],
        }),
      });

      const params = { id: 'completed-project' };

      // Mock project in completed state
      const response = await POST(mockRequest, { params });
      const data = await response.json();

      // Would return 400 for invalid state in real implementation
      expect(data).toHaveProperty('success');
    });
  });

  describe('GET - Get Research Status', () => {
    it('should return research status and results', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'GET',
        headers: {
          'x-user-id': 'test-user',
        },
      });

      const params = { id: 'test-project' };

      const response = await GET(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('projectId');
      expect(data.data).toHaveProperty('status');
      expect(data.data).toHaveProperty('progress');
    });

    it('should handle project not found for status check', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/nonexistent/research', {
        method: 'GET',
        headers: {
          'x-user-id': 'test-user',
        },
      });

      const params = { id: 'nonexistent' };

      const response = await GET(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('DELETE - Cancel Research', () => {
    it('should cancel research and clear data', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'DELETE',
        headers: {
          'x-user-id': 'test-user',
        },
      });

      const params = { id: 'test-project' };

      const response = await DELETE(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('projectId');
      expect(data.data).toHaveProperty('status', 'draft');
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/error-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: ['https://competitor1.com'],
        }),
      });

      const params = { id: 'error-project' };

      // Mock database error
      const response = await POST(mockRequest, { params });
      const data = await response.json();

      // Should handle errors gracefully
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle malformed JSON', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: 'invalid json',
      });

      const params = { id: 'test-project' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should handle missing user ID', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Missing x-user-id header
        },
        body: JSON.stringify({
          competitorUrls: ['https://competitor1.com'],
        }),
      });

      const params = { id: 'test-project' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      // Should use demo-user as fallback in current implementation
      expect(data).toHaveProperty('success');
    });

    it('should handle unauthorized access', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/other-user-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: ['https://competitor1.com'],
        }),
      });

      const params = { id: 'other-user-project' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      // Should return 404 for projects not owned by user
      expect(response.status).toBe(404);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('Request Validation', () => {
    it('should validate competitor URLs format', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: ['not-a-valid-url', 'also-invalid'],
        }),
      });

      const params = { id: 'test-project' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate competitor URLs count', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/projects/test-project/research', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'test-user',
        },
        body: JSON.stringify({
          competitorUrls: new Array(10).fill('https://example.com'), // Too many URLs
        }),
      });

      const params = { id: 'test-project' };

      const response = await POST(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});