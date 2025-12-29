import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/inngest/client');
jest.mock('@/lib/rate-limiting/quota');

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          range: jest.fn(),
        })),
      })),
    })),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
      remove: jest.fn(),
    })),
  },
};

const mockInngest = {
  send: jest.fn(),
};

const mockCheckQuota = jest.fn();

// Mock implementations
require('@/lib/supabase/server').createServerSupabaseClient = jest.fn(() => Promise.resolve(mockSupabase));
require('@/lib/inngest/client').inngest = mockInngest;
require('@/lib/rate-limiting/quota').checkQuota = mockCheckQuota;

describe('/api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects', () => {
    it('should create a project successfully', async () => {
      // Mock user authentication
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock quota check
      mockCheckQuota.mockResolvedValue({ allowed: true, usage: 1, limit: 3 });

      // Mock database insert
      const mockProject = {
        id: 'project-123',
        user_id: 'user-123',
        topic: 'Test Topic',
        status: 'draft',
        competitor_urls: ['https://example.com'],
        tone: 'professional',
        format: 'how-to',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: mockProject,
        error: null,
      });

      // Mock Inngest events
      mockInngest.send.mockResolvedValue({ ids: ['event-1', 'event-2'] });

      // Create form data
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

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.project).toEqual(mockProject);
      expect(mockInngest.send).toHaveBeenCalledTimes(2); // project/created and project/research-started
    });

    it('should return 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
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

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for invalid project data', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Invalid data - missing required fields
      const formData = new FormData();
      formData.append('topic', ''); // Empty topic
      formData.append('competitorUrls', JSON.stringify([])); // No URLs
      formData.append('tone', '');
      formData.append('format', '');

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

    it('should return 429 when quota is exceeded', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      // Mock quota exceeded
      mockCheckQuota.mockResolvedValue({ allowed: false, usage: 3, limit: 3 });

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

    it('should handle file upload validation', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockCheckQuota.mockResolvedValue({ allowed: true, usage: 1, limit: 3 });

      // Create invalid file (too large)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', {
        type: 'application/pdf',
      });

      const formData = new FormData();
      formData.append('topic', 'Test Topic');
      formData.append('competitorUrls', JSON.stringify(['https://example.com']));
      formData.append('tone', 'professional');
      formData.append('format', 'how-to');
      formData.append('brandDocument', largeFile);

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
  });

  describe('GET /api/projects', () => {
    it('should fetch user projects successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const mockProjects = [
        {
          id: 'project-1',
          user_id: 'user-123',
          topic: 'Project 1',
          status: 'completed',
          created_at: new Date().toISOString(),
        },
        {
          id: 'project-2',
          user_id: 'user-123',
          topic: 'Project 2',
          status: 'writing',
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.from().select().eq().order().range.mockResolvedValue({
        data: mockProjects,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.projects).toEqual(mockProjects);
    });

    it('should return 401 for unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle database errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from().select().eq().order().range.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      });

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DATABASE_ERROR');
    });
  });
});