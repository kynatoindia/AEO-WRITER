import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createRouteClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      insert: jest.fn(),
    })),
  })),
}));

jest.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: jest.fn(() => Promise.resolve({ ids: ['test-event-id'] })),
  },
}));

jest.mock('@/lib/rate-limiting/quota', () => ({
  checkQuota: jest.fn(() => Promise.resolve({ allowed: true, usage: 0, limit: 100 })),
  incrementUsage: jest.fn(() => Promise.resolve()),
}));

describe('/api/projects/[id]/finalize', () => {
  const mockParams = { params: { id: 'test-project-id' } };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects/[id]/finalize', () => {
    it('should handle finalization request with valid data', async () => {
      // Mock authenticated user
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      // Mock project data
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: {
          id: 'test-project-id',
          user_id: 'test-user-id',
          generated_content: 'Test content to finalize',
          blueprint: { sections: [] },
          status: 'writing',
        },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({ force: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('projectId', 'test-project-id');
      expect(data.data).toHaveProperty('eventId', 'test-event-id');
      expect(data.data).toHaveProperty('status', 'finalization_queued');
    });

    it('should reject unauthenticated requests', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle quota exceeded', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const { checkQuota } = require('@/lib/rate-limiting/quota');
      
      const mockSupabase = createRouteClient();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      checkQuota.mockResolvedValue({
        allowed: false,
        usage: 100,
        limit: 100,
        resetDate: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('QUOTA_EXCEEDED');
    });

    it('should handle project not found', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Project not found'),
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should handle no content to finalize', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: {
          id: 'test-project-id',
          user_id: 'test-user-id',
          generated_content: null, // No content
          blueprint: { sections: [] },
          status: 'writing',
        },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NO_CONTENT_TO_FINALIZE');
    });

    it('should handle already finalized project', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: {
          id: 'test-project-id',
          user_id: 'test-user-id',
          generated_content: 'Test content',
          blueprint: { sections: [] },
          status: 'completed', // Already completed
        },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({ force: false }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ALREADY_FINALIZED');
    });

    it('should allow force re-finalization', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: {
          id: 'test-project-id',
          user_id: 'test-user-id',
          generated_content: 'Test content',
          blueprint: { sections: [] },
          status: 'completed', // Already completed
        },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({ force: true }), // Force re-finalization
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('projectId', 'test-project-id');
    });
  });

  describe('GET /api/projects/[id]/finalize', () => {
    it('should return finalization status', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: {
          id: 'test-project-id',
          status: 'completed',
          generated_content: 'Test content with 10 words here for counting',
          seo_metadata: {
            faqData: [{ question: 'Test?', answer: 'Yes' }],
            seoScore: 85,
            readabilityScore: 75,
          },
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'GET',
      });

      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('projectId', 'test-project-id');
      expect(data.data).toHaveProperty('status', 'completed');
      expect(data.data).toHaveProperty('isFinalized', true);
      expect(data.data.metrics).toHaveProperty('wordCount', 10);
      expect(data.data.metrics).toHaveProperty('faqCount', 1);
      expect(data.data.metrics).toHaveProperty('seoScore', 85);
    });

    it('should handle project not found for status check', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Project not found'),
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'GET',
      });

      const response = await GET(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('Input Validation', () => {
    it('should handle invalid JSON in request body', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      
      // Should still work because we have a fallback for invalid JSON
      expect(response.status).toBeLessThan(500);
    });

    it('should validate force parameter type', async () => {
      const { createRouteClient } = require('@/lib/supabase/server');
      const mockSupabase = createRouteClient();
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      });

      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: {
          id: 'test-project-id',
          user_id: 'test-user-id',
          generated_content: 'Test content',
          blueprint: { sections: [] },
          status: 'writing',
        },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/projects/test-project-id/finalize', {
        method: 'POST',
        body: JSON.stringify({ force: 'invalid' }), // Should be boolean
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, mockParams);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});