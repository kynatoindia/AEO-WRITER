/**
 * API Helper Utilities
 * Common utilities for API request/response handling
 */

import type {
  APIResponse,
  APIError,
  PaginationInfo,
  PaginationParams
} from '@/lib/types';
import { handleAPIError, createAPIError } from './error-handler';
import { ERROR_CODES } from '@/lib/constants/errors';

/**
 * Create a standardized API response
 */
export function createAPIResponse<T>(
  data?: T,
  error?: APIError
): APIResponse<T> {
  return {
    success: !error,
    data,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a success API response
 */
export function createSuccessResponse<T>(data: T): APIResponse<T> {
  return createAPIResponse(data);
}

/**
 * Create an error API response
 */
export function createErrorResponse<T = undefined>(error: APIError): APIResponse<T> {
  return createAPIResponse<T>(undefined as T, error);
}

/**
 * Wrap async API handler with error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<APIResponse<R | undefined>> => {
    try {
      const result = await handler(...args);
      return createSuccessResponse(result);
    } catch (error) {
      const apiError = handleAPIError(error);
      return createErrorResponse<R | undefined>(apiError);
    }
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw createAPIError(
      'CONFIGURATION_ERROR',
      `Missing required environment variables: ${missing.join(', ')}`,
      { missingVars: missing }
    );
  }
}

/**
 * Parse and validate pagination parameters
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page: number; limit: number; maxLimit: number } = {
    page: 1,
    limit: 10,
    maxLimit: 100
  }
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || defaults.limit.toString(), 10))
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Create pagination info object
 */
export function createPaginationInfo(
  page: number,
  limit: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

/**
 * Validate request method
 */
export function validateMethod(
  request: Request,
  allowedMethods: string[]
): void {
  if (!allowedMethods.includes(request.method)) {
    throw createAPIError(
      'INVALID_INPUT',
      `Method ${request.method} not allowed`,
      { allowedMethods }
    );
  }
}

/**
 * Extract and validate JSON body from request
 */
export async function parseJSONBody<T = unknown>(
  request: Request
): Promise<T> {
  try {
    const body = await request.json();
    return body as T;
  } catch (error) {
    throw createAPIError(
      'INVALID_INPUT',
      'Invalid JSON in request body',
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Extract user ID from request headers or auth context
 */
export function extractUserId(request: Request): string {
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    throw createAPIError(
      'UNAUTHORIZED',
      'User ID not found in request'
    );
  }
  
  return userId;
}

/**
 * Validate content type
 */
export function validateContentType(
  request: Request,
  expectedType: string = 'application/json'
): void {
  const contentType = request.headers.get('content-type');
  
  if (!contentType?.includes(expectedType)) {
    throw createAPIError(
      'INVALID_INPUT',
      `Expected content type ${expectedType}`,
      { receivedType: contentType }
    );
  }
}

/**
 * Rate limiting helper
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  storage: Map<string, { count: number; resetTime: number }> = new Map()
): boolean {
  const now = Date.now();
  const key = identifier;
  const existing = storage.get(key);
  
  if (!existing || now > existing.resetTime) {
    storage.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (existing.count >= limit) {
    return false;
  }
  
  existing.count++;
  return true;
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
}

/**
 * Format error for API response
 */
export function formatErrorForResponse(error: APIError): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  return {
    code: error.code,
    message: error.message,
    ...(error.details && { details: error.details })
  };
}

/**
 * Check if request is from authenticated user
 */
export function isAuthenticated(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const userId = request.headers.get('x-user-id');
  
  return !!(authHeader && userId);
}

/**
 * Extract bearer token from authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
}

/**
 * Validate API key
 */
export function validateAPIKey(apiKey: string, expectedKey: string): boolean {
  return apiKey === expectedKey;
}

/**
 * Create CORS headers
 */
export function createCORSHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Handle CORS preflight request
 */
export function handleCORSPreflight(request: Request): Response {
  const origin = request.headers.get('origin');
  const headers = createCORSHeaders(origin);
  
  return new Response(null, {
    status: 200,
    headers
  });
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response: Response, origin?: string): Response {
  const headers = createCORSHeaders(origin);
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Create JSON response with proper headers
 */
export function createJSONResponse<T>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Create error response
 */
export function createErrorJSONResponse(
  error: APIError,
  status?: number
): Response {
  const responseData = createErrorResponse(error);
  const statusCode = status || getStatusCodeFromError(error);
  
  return createJSONResponse(responseData, statusCode);
}

/**
 * Get HTTP status code from error
 */
function getStatusCodeFromError(error: APIError): number {
  switch (error.code) {
    case ERROR_CODES.UNAUTHORIZED:
    case ERROR_CODES.INVALID_TOKEN:
    case ERROR_CODES.TOKEN_EXPIRED:
      return 401;
    case ERROR_CODES.FORBIDDEN:
      return 403;
    case ERROR_CODES.NOT_FOUND:
      return 404;
    case ERROR_CODES.VALIDATION_ERROR:
    case ERROR_CODES.INVALID_INPUT:
      return 400;
    case ERROR_CODES.RATE_LIMIT_EXCEEDED:
      return 429;
    case ERROR_CODES.INTERNAL_ERROR:
    case ERROR_CODES.DATABASE_ERROR:
      return 500;
    case ERROR_CODES.SERVICE_UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Convert search params to object
 */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  
  for (const [key, value] of searchParams.entries()) {
    obj[key] = value;
  }
  
  return obj;
}

/**
 * Validate required fields in object
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: (keyof T)[]
): void {
  const missing = requiredFields.filter(field => 
    obj[field] === undefined || obj[field] === null || obj[field] === ''
  );
  
  if (missing.length > 0) {
    throw createAPIError(
      'MISSING_REQUIRED_FIELD',
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
}