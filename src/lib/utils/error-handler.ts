import { APIError, ValidationError, ErrorContext } from '@/lib/types';
import { ERROR_CODES, ERROR_MESSAGES, ERROR_HTTP_STATUS, RETRYABLE_ERRORS, getHttpStatusForError, getUserFriendlyMessage, isRetryableError } from '@/lib/constants/errors';
import { ZodError } from 'zod';

/**
 * Create a standardized API error
 */
export function createAPIError(
  code: keyof typeof ERROR_CODES,
  message: string,
  details?: Record<string, unknown>,
  retryable = false
): APIError {
  return {
    code: ERROR_CODES[code],
    message,
    details,
    retryable,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  };
}

/**
 * Handle and format API errors for client consumption
 */
export function handleAPIError(error: unknown, context?: ErrorContext): APIError {
  // If it's already an APIError, return it with context
  if (isAPIError(error)) {
    return {
      ...error,
      details: { ...error.details, context }
    };
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return createAPIError(
      'VALIDATION_ERROR',
      'Validation failed',
      {
        validationErrors: formatZodErrors(error),
        context
      },
      false
    );
  }

  // Handle common error types
  if (error instanceof Error) {
    return handleStandardError(error, context);
  }

  // Handle response errors (fetch API)
  if (isResponseError(error)) {
    return handleResponseError(error, context);
  }

  // Unknown error type
  return createAPIError(
    'INTERNAL_ERROR',
    'An unexpected error occurred',
    { originalError: String(error), context },
    false
  );
}

/**
 * Handle standard JavaScript errors
 */
function handleStandardError(error: Error, context?: ErrorContext): APIError {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('fetch') || message.includes('network')) {
    return createAPIError(
      'NETWORK_ERROR',
      'Network connection failed',
      { originalError: error.message, context },
      true
    );
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('aborted')) {
    return createAPIError(
      'TIMEOUT_ERROR',
      'Request timed out',
      { originalError: error.message, context },
      true
    );
  }

  // Rate limit errors
  if (message.includes('rate limit') || message.includes('429')) {
    return createAPIError(
      'RATE_LIMIT_EXCEEDED',
      'API rate limit exceeded',
      { originalError: error.message, context },
      true
    );
  }

  // Authentication errors
  if (message.includes('unauthorized') || message.includes('401')) {
    return createAPIError(
      'UNAUTHORIZED',
      'Authentication required',
      { originalError: error.message, context },
      false
    );
  }

  // Forbidden errors
  if (message.includes('forbidden') || message.includes('403')) {
    return createAPIError(
      'FORBIDDEN',
      'Access denied',
      { originalError: error.message, context },
      false
    );
  }

  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    return createAPIError(
      'NOT_FOUND',
      'Resource not found',
      { originalError: error.message, context },
      false
    );
  }

  // Generic error
  return createAPIError(
    'INTERNAL_ERROR',
    error.message,
    { originalError: error.message, context },
    false
  );
}

/**
 * Handle HTTP response errors
 */
function handleResponseError(response: Response, context?: ErrorContext): APIError {
  switch (response.status) {
    case 400:
      return createAPIError(
        'INVALID_INPUT',
        'Invalid request data',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 401:
      return createAPIError(
        'UNAUTHORIZED',
        'Authentication required',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 403:
      return createAPIError(
        'FORBIDDEN',
        'Access denied',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 404:
      return createAPIError(
        'NOT_FOUND',
        'Resource not found',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 409:
      return createAPIError(
        'RESOURCE_EXISTS',
        'Resource already exists',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 413:
      return createAPIError(
        'FILE_TOO_LARGE',
        'File size exceeds limit',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 415:
      return createAPIError(
        'INVALID_FILE_TYPE',
        'Unsupported file type',
        { status: response.status, statusText: response.statusText, context },
        false
      );
    case 429:
      return createAPIError(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests',
        { status: response.status, statusText: response.statusText, context },
        true
      );
    case 500:
      return createAPIError(
        'INTERNAL_ERROR',
        'Internal server error',
        { status: response.status, statusText: response.statusText, context },
        true
      );
    case 502:
    case 503:
    case 504:
      return createAPIError(
        'SERVICE_UNAVAILABLE',
        'Service temporarily unavailable',
        { status: response.status, statusText: response.statusText, context },
        true
      );
    default:
      return createAPIError(
        'INTERNAL_ERROR',
        `HTTP ${response.status}: ${response.statusText}`,
        { status: response.status, statusText: response.statusText, context },
        response.status >= 500
      );
  }
}

/**
 * Format Zod validation errors
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((err: any) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    value: err.received
  }));
}

/**
 * Check if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  );
}

/**
 * Check if an error is a Response object
 */
function isResponseError(error: unknown): error is Response {
  return error instanceof Response && !error.ok;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: APIError): string {
  return getUserFriendlyMessage(error.code) || error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Log error for debugging (in development) or monitoring (in production)
 */
export function logError(error: APIError, context?: ErrorContext): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      retryable: error.retryable,
      requestId: error.requestId
    },
    context
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', errorLog);
  } else {
    // In production, you might want to send this to a logging service
    // like Sentry, LogRocket, or similar
    console.error('API Error:', errorLog);
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const apiError = handleAPIError(error, context);
      
      // Don't retry if it's not a retryable error
      if (!apiError.retryable) {
        throw apiError;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw handleAPIError(lastError, context);
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create validation error from field and message
 */
export function createValidationError(
  field: string,
  message: string,
  code = 'invalid',
  value?: unknown
): ValidationError {
  return {
    field,
    message,
    code,
    value
  };
}

/**
 * Aggregate multiple validation errors into a single API error
 */
export function createValidationAPIError(
  errors: ValidationError[],
  context?: ErrorContext
): APIError {
  return createAPIError(
    'VALIDATION_ERROR',
    `Validation failed for ${errors.length} field(s)`,
    {
      validationErrors: errors,
      context
    },
    false
  );
}

/**
 * Check if an error should be retried
 */
export function shouldRetryError(error: APIError): boolean {
  return isRetryableError(error.code);
}

/**
 * Get HTTP status code for error
 */
export function getErrorHttpStatus(error: APIError): number {
  return getHttpStatusForError(error.code);
}

/**
 * Create error response for API routes
 */
export function createErrorResponse(error: APIError, status?: number) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
        timestamp: error.timestamp,
        requestId: error.requestId
      },
      timestamp: new Date().toISOString()
    }),
    {
      status: status || getErrorHttpStatus(error),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Handle async operation with error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<{ success: true; data: T } | { success: false; error: APIError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const apiError = handleAPIError(error, context);
    logError(apiError, context);
    return { success: false, error: apiError };
  }
}

/**
 * Wrap function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ErrorContext
) {
  return async (...args: T): Promise<{ success: true; data: R } | { success: false; error: APIError }> => {
    return handleAsyncOperation(() => fn(...args), context);
  };
}

/**
 * Create context for error tracking
 */
export function createErrorContext(
  operation: string,
  userId?: string,
  projectId?: string,
  metadata?: Record<string, unknown>
): ErrorContext {
  return {
    operation,
    userId,
    projectId,
    metadata: {
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      ...metadata
    }
  };
}

/**
 * Sanitize error for client consumption (remove sensitive data)
 */
export function sanitizeError(error: APIError): APIError {
  const sanitized = { ...error };
  
  // Remove potentially sensitive information from details
  if (sanitized.details) {
    const { originalError, context, ...safeDetails } = sanitized.details;
    sanitized.details = safeDetails;
  }
  
  return sanitized;
}

/**
 * Aggregate multiple errors into a single error
 */
export function aggregateErrors(errors: APIError[], operation: string): APIError {
  if (errors.length === 0) {
    return createAPIError('INTERNAL_ERROR', 'No errors provided to aggregate');
  }
  
  if (errors.length === 1) {
    return errors[0];
  }
  
  const errorCodes = errors.map(e => e.code);
  const uniqueCodes = [...new Set(errorCodes)];
  
  return createAPIError(
    'INTERNAL_ERROR',
    `Multiple errors occurred during ${operation}`,
    {
      errorCount: errors.length,
      errorCodes: uniqueCodes,
      errors: errors.map(e => ({
        code: e.code,
        message: e.message,
        retryable: e.retryable
      }))
    },
    errors.some(e => e.retryable)
  );
}

/**
 * Convert error to toast notification format
 */
export function errorToToast(error: APIError): {
  title: string;
  description: string;
  variant: 'destructive' | 'default';
  duration?: number;
} {
  return {
    title: 'Error',
    description: getUserFriendlyErrorMessage(error),
    variant: 'destructive',
    duration: error.retryable ? 5000 : 10000
  };
}

/**
 * Check if error is a specific type
 */
export function isErrorType(error: APIError, errorCode: keyof typeof ERROR_CODES): boolean {
  return error.code === ERROR_CODES[errorCode];
}

/**
 * Check if error is client-side (4xx)
 */
export function isClientError(error: APIError): boolean {
  const status = getErrorHttpStatus(error);
  return status >= 400 && status < 500;
}

/**
 * Check if error is server-side (5xx)
 */
export function isServerError(error: APIError): boolean {
  const status = getErrorHttpStatus(error);
  return status >= 500;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return 'Validation failed';
  if (errors.length === 1) return errors[0].message;
  
  return `Validation failed:\n${errors.map(e => `• ${e.field}: ${e.message}`).join('\n')}`;
}

/**
 * Create error boundary error
 */
export function createErrorBoundaryError(error: Error, componentStack?: string): APIError {
  return createAPIError(
    'INTERNAL_ERROR',
    'Component error occurred',
    {
      originalError: error.message,
      stack: error.stack,
      componentStack,
      boundary: true
    },
    false
  );
}