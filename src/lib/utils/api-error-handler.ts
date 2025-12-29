import { NextResponse } from 'next/server';
import { z } from 'zod';
import { APIResponse, APIError } from '@/lib/types';

/**
 * Standardized error responses for API routes
 */
export const ErrorResponses = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    retryable: false
  },
  FORBIDDEN: {
    code: 'FORBIDDEN', 
    message: 'Access denied',
    retryable: false
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
    retryable: false
  },
  QUOTA_EXCEEDED: {
    code: 'QUOTA_EXCEEDED',
    message: 'Usage quota exceeded',
    retryable: false
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    retryable: true
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    retryable: true
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    retryable: true
  }
} as const;

/**
 * Creates a standardized API error response
 */
export function createErrorResponse<T = unknown>(
  error: Partial<APIError> & { code: string; message: string },
  status: number = 500
): NextResponse<APIResponse<T>> {
  const apiError: APIError = {
    code: error.code,
    message: error.message,
    details: error.details || {},
    retryable: error.retryable ?? false,
    timestamp: new Date().toISOString(),
    requestId: error.requestId
  };

  return NextResponse.json({
    success: false,
    error: apiError,
    timestamp: new Date().toISOString()
  }, { status });
}

/**
 * Creates a validation error response from Zod errors
 */
export function createValidationErrorResponse<T = unknown>(
  zodError: z.ZodError,
  message: string = 'Validation failed'
): NextResponse<APIResponse<T>> {
  return createErrorResponse({
    code: 'VALIDATION_ERROR',
    message,
    details: {
      validationErrors: zodError.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    },
    retryable: false
  }, 400);
}

/**
 * Creates a success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status });
}

/**
 * Higher-order function to wrap API handlers with error handling
 */
export function withErrorHandling<T = unknown>(
  handler: (request: Request, context?: any) => Promise<NextResponse<APIResponse<T>>>
) {
  return async (request: Request, context?: any): Promise<NextResponse<APIResponse<T>>> => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return createValidationErrorResponse(error);
      }

      // Handle known error types
      if (error instanceof Error) {
        // Check for specific error patterns
        if (error.message.includes('auth')) {
          return createErrorResponse(ErrorResponses.UNAUTHORIZED, 401);
        }
        if (error.message.includes('quota')) {
          return createErrorResponse(ErrorResponses.QUOTA_EXCEEDED, 429);
        }
        if (error.message.includes('database') || error.message.includes('supabase')) {
          return createErrorResponse(ErrorResponses.DATABASE_ERROR, 500);
        }

        // Generic error response
        return createErrorResponse({
          code: 'INTERNAL_ERROR',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
          retryable: true
        }, 500);
      }

      // Fallback for unknown errors
      return createErrorResponse(ErrorResponses.INTERNAL_ERROR, 500);
    }
  };
}

/**
 * Utility to safely parse JSON with error handling
 */
export async function safeParseJSON<T>(
  request: Request,
  schema?: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: z.ZodError }> {
  try {
    const body = await request.json();
    
    if (schema) {
      const result = schema.safeParse(body);
      return result;
    }
    
    return { success: true, data: body };
  } catch (error) {
    // Create a synthetic Zod error for JSON parsing failures
    const zodError = new z.ZodError([{
      code: 'custom',
      message: 'Invalid JSON format',
      path: []
    }]);
    
    return { success: false, error: zodError };
  }
}

/**
 * Utility to extract and validate path parameters
 */
export function validatePathParams<T>(
  params: Record<string, string | string[]>,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(params);
}

/**
 * Utility to extract and validate query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const params = Object.fromEntries(searchParams.entries());
  return schema.safeParse(params);
}