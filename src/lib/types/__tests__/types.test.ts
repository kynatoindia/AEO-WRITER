/**
 * Types and Validation Tests
 * Test the TypeScript interfaces and Zod validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import {
  createProjectSchema,
  contentSectionSchema,
  contentBlueprintSchema,
  seoMetadataSchema,
  tokenUsageSchema,
  costBreakdownSchema,
  userPreferencesSchema,
  apiResponseSchema,
  projectQuerySchema,
  usageAnalyticsQuerySchema
} from '@/lib/validations/schemas';
import {
  isProjectStatus,
  isContentTone,
  isContentFormat,
  isAPIError,
  isProject,
  isContentSection,
  isContentBlueprint,
  isUUID,
  isValidURL,
  isValidEmail,
  isPositiveNumber,
  isNonNegativeNumber
} from '@/lib/utils/type-guards';
import { createAPIError } from '@/lib/utils/error-handler';
import { ERROR_CODES } from '@/lib/constants/errors';

describe('Type Guards', () => {
  describe('isProjectStatus', () => {
    it('should validate correct project statuses', () => {
      expect(isProjectStatus('draft')).toBe(true);
      expect(isProjectStatus('researching')).toBe(true);
      expect(isProjectStatus('planning')).toBe(true);
      expect(isProjectStatus('writing')).toBe(true);
      expect(isProjectStatus('completed')).toBe(true);
      expect(isProjectStatus('error')).toBe(true);
    });

    it('should reject invalid project statuses', () => {
      expect(isProjectStatus('invalid')).toBe(false);
      expect(isProjectStatus('')).toBe(false);
      expect(isProjectStatus(null)).toBe(false);
      expect(isProjectStatus(undefined)).toBe(false);
      expect(isProjectStatus(123)).toBe(false);
    });
  });

  describe('isContentTone', () => {
    it('should validate correct content tones', () => {
      expect(isContentTone('professional')).toBe(true);
      expect(isContentTone('witty')).toBe(true);
      expect(isContentTone('data-driven')).toBe(true);
    });

    it('should reject invalid content tones', () => {
      expect(isContentTone('casual')).toBe(false);
      expect(isContentTone('')).toBe(false);
      expect(isContentTone(null)).toBe(false);
    });
  });

  describe('isContentFormat', () => {
    it('should validate correct content formats', () => {
      expect(isContentFormat('how-to')).toBe(true);
      expect(isContentFormat('listicle')).toBe(true);
      expect(isContentFormat('case-study')).toBe(true);
    });

    it('should reject invalid content formats', () => {
      expect(isContentFormat('blog-post')).toBe(false);
      expect(isContentFormat('')).toBe(false);
      expect(isContentFormat(null)).toBe(false);
    });
  });

  describe('isUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isUUID('')).toBe(false);
      expect(isUUID(null)).toBe(false);
    });
  });

  describe('isValidURL', () => {
    it('should validate correct URLs', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://test.org/path')).toBe(true);
      expect(isValidURL('https://subdomain.example.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidURL('not-a-url')).toBe(false);
      expect(isValidURL('just-text')).toBe(false);
      expect(isValidURL('')).toBe(false);
      expect(isValidURL(null)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should validate positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(100)).toBe(true);
    });

    it('should reject non-positive numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('1')).toBe(false);
    });
  });

  describe('isNonNegativeNumber', () => {
    it('should validate non-negative numbers', () => {
      expect(isNonNegativeNumber(0)).toBe(true);
      expect(isNonNegativeNumber(1)).toBe(true);
      expect(isNonNegativeNumber(100.5)).toBe(true);
    });

    it('should reject negative numbers', () => {
      expect(isNonNegativeNumber(-1)).toBe(false);
      expect(isNonNegativeNumber(-0.1)).toBe(false);
      expect(isNonNegativeNumber(NaN)).toBe(false);
    });
  });

  describe('isAPIError', () => {
    it('should validate correct API errors', () => {
      const error = createAPIError('VALIDATION_ERROR', 'Test error');
      expect(isAPIError(error)).toBe(true);
    });

    it('should reject invalid API errors', () => {
      expect(isAPIError({})).toBe(false);
      expect(isAPIError({ code: 'TEST' })).toBe(false);
      expect(isAPIError({ message: 'Test' })).toBe(false);
      expect(isAPIError(null)).toBe(false);
    });
  });
});

describe('Validation Schemas', () => {
  describe('createProjectSchema', () => {
    it('should validate correct project data', () => {
      const validProject = {
        topic: 'Test Topic',
        competitorUrls: ['https://example.com', 'https://test.org'],
        tone: 'professional' as const,
        format: 'how-to' as const
      };

      expect(() => createProjectSchema.parse(validProject)).not.toThrow();
    });

    it('should reject invalid project data', () => {
      const invalidProject = {
        topic: 'A', // Too short
        competitorUrls: ['invalid-url'],
        tone: 'invalid-tone',
        format: 'invalid-format'
      };

      expect(() => createProjectSchema.parse(invalidProject)).toThrow();
    });

    it('should validate topic length constraints', () => {
      const shortTopic = {
        topic: 'AB', // Too short
        competitorUrls: ['https://example.com'],
        tone: 'professional' as const,
        format: 'how-to' as const
      };

      const longTopic = {
        topic: 'A'.repeat(201), // Too long
        competitorUrls: ['https://example.com'],
        tone: 'professional' as const,
        format: 'how-to' as const
      };

      expect(() => createProjectSchema.parse(shortTopic)).toThrow();
      expect(() => createProjectSchema.parse(longTopic)).toThrow();
    });

    it('should validate competitor URLs constraints', () => {
      const noUrls = {
        topic: 'Test Topic',
        competitorUrls: [],
        tone: 'professional' as const,
        format: 'how-to' as const
      };

      const tooManyUrls = {
        topic: 'Test Topic',
        competitorUrls: Array(6).fill('https://example.com'),
        tone: 'professional' as const,
        format: 'how-to' as const
      };

      expect(() => createProjectSchema.parse(noUrls)).toThrow();
      expect(() => createProjectSchema.parse(tooManyUrls)).toThrow();
    });
  });

  describe('seoMetadataSchema', () => {
    it('should validate correct SEO metadata', () => {
      const validSEO = {
        title: 'Test Title',
        metaDescription: 'Test meta description',
        targetKeywords: ['keyword1', 'keyword2'],
        focusKeyword: 'main keyword'
      };

      expect(() => seoMetadataSchema.parse(validSEO)).not.toThrow();
    });

    it('should reject SEO metadata with invalid lengths', () => {
      const longTitle = {
        title: 'A'.repeat(61), // Too long
        metaDescription: 'Test description',
        targetKeywords: ['keyword1'],
        focusKeyword: 'main keyword'
      };

      const longDescription = {
        title: 'Test Title',
        metaDescription: 'A'.repeat(161), // Too long
        targetKeywords: ['keyword1'],
        focusKeyword: 'main keyword'
      };

      expect(() => seoMetadataSchema.parse(longTitle)).toThrow();
      expect(() => seoMetadataSchema.parse(longDescription)).toThrow();
    });
  });

  describe('tokenUsageSchema', () => {
    it('should validate correct token usage', () => {
      const validUsage = {
        research: 100,
        planning: 200,
        writing: 500,
        total: 800
      };

      expect(() => tokenUsageSchema.parse(validUsage)).not.toThrow();
    });

    it('should reject negative token values', () => {
      const invalidUsage = {
        research: -100,
        planning: 200,
        writing: 500,
        total: 600
      };

      expect(() => tokenUsageSchema.parse(invalidUsage)).toThrow();
    });
  });

  describe('costBreakdownSchema', () => {
    it('should validate correct cost breakdown', () => {
      const validCost = {
        research: 0.50,
        planning: 1.00,
        writing: 2.50,
        total: 4.00
      };

      expect(() => costBreakdownSchema.parse(validCost)).not.toThrow();
    });

    it('should reject negative cost values', () => {
      const invalidCost = {
        research: -0.50,
        planning: 1.00,
        writing: 2.50,
        total: 3.00
      };

      expect(() => costBreakdownSchema.parse(invalidCost)).toThrow();
    });
  });

  describe('userPreferencesSchema', () => {
    it('should validate correct user preferences', () => {
      const validPrefs = {
        defaultTone: 'professional' as const,
        defaultFormat: 'how-to' as const,
        emailNotifications: true,
        autoSave: false,
        theme: 'dark' as const
      };

      expect(() => userPreferencesSchema.parse(validPrefs)).not.toThrow();
    });

    it('should reject invalid preference values', () => {
      const invalidPrefs = {
        defaultTone: 'invalid-tone',
        defaultFormat: 'how-to' as const,
        emailNotifications: true,
        autoSave: false,
        theme: 'dark' as const
      };

      expect(() => userPreferencesSchema.parse(invalidPrefs)).toThrow();
    });
  });

  describe('apiResponseSchema', () => {
    it('should validate correct API response', () => {
      const validResponse = {
        success: true,
        data: { test: 'data' },
        timestamp: new Date().toISOString()
      };

      expect(() => apiResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should validate error response', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          retryable: false
        },
        timestamp: new Date().toISOString()
      };

      expect(() => apiResponseSchema.parse(errorResponse)).not.toThrow();
    });
  });

  describe('projectQuerySchema', () => {
    it('should validate correct project query', () => {
      const validQuery = {
        page: 1,
        limit: 10,
        status: 'completed' as const,
        tone: 'professional' as const,
        search: 'test query',
        sortBy: 'created_at' as const,
        sortOrder: 'desc' as const
      };

      expect(() => projectQuerySchema.parse(validQuery)).not.toThrow();
    });

    it('should apply default values', () => {
      const minimalQuery = {};
      const parsed = projectQuerySchema.parse(minimalQuery);
      
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
    });

    it('should enforce limit constraints', () => {
      const invalidQuery = {
        page: 1,
        limit: 150 // Too high
      };

      expect(() => projectQuerySchema.parse(invalidQuery)).toThrow();
    });
  });
});

describe('Error Handling', () => {
  describe('createAPIError', () => {
    it('should create valid API error', () => {
      const error = createAPIError('VALIDATION_ERROR', 'Test error message');
      
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('Test error message');
      expect(error.retryable).toBe(false);
      expect(error.timestamp).toBeDefined();
      expect(error.requestId).toBeDefined();
    });

    it('should include details when provided', () => {
      const details = { field: 'test', value: 'invalid' };
      const error = createAPIError('VALIDATION_ERROR', 'Test error', details);
      
      expect(error.details).toEqual(details);
    });

    it('should set retryable flag correctly', () => {
      const retryableError = createAPIError('NETWORK_ERROR', 'Network failed', undefined, true);
      const nonRetryableError = createAPIError('VALIDATION_ERROR', 'Invalid input', undefined, false);
      
      expect(retryableError.retryable).toBe(true);
      expect(nonRetryableError.retryable).toBe(false);
    });
  });
});