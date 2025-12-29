/**
 * Error Constants and Configuration
 * Centralized error codes, messages, and handling configuration
 */

// Error codes organized by category
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation & Input
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_URL: 'INVALID_URL',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_UUID: 'INVALID_UUID',
  
  // Resource Management
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  
  // API & External Services
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  API_TIMEOUT: 'API_TIMEOUT',
  API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Content & AI
  CONTENT_POLICY_VIOLATION: 'CONTENT_POLICY_VIOLATION',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  CONTENT_TOO_SHORT: 'CONTENT_TOO_SHORT',
  CONTENT_GENERATION_FAILED: 'CONTENT_GENERATION_FAILED',
  CONTENT_ANALYSIS_FAILED: 'CONTENT_ANALYSIS_FAILED',
  BLUEPRINT_GENERATION_FAILED: 'BLUEPRINT_GENERATION_FAILED',
  RESEARCH_FAILED: 'RESEARCH_FAILED',
  
  // Billing & Subscription
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  BILLING_ERROR: 'BILLING_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // File Operations
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  
  // Network & Connectivity
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  DNS_ERROR: 'DNS_ERROR',
  SSL_ERROR: 'SSL_ERROR',
  
  // Server & System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  
  // Concurrency & State
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  OPERATION_IN_PROGRESS: 'OPERATION_IN_PROGRESS',
  INVALID_STATE: 'INVALID_STATE',
  STATE_CONFLICT: 'STATE_CONFLICT',
  
  // Export & Import
  EXPORT_FAILED: 'EXPORT_FAILED',
  IMPORT_FAILED: 'IMPORT_FAILED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  CONVERSION_FAILED: 'CONVERSION_FAILED'
} as const;

// Error categories for grouping and handling
export const ERROR_CATEGORIES = {
  CLIENT_ERROR: [
    ERROR_CODES.VALIDATION_ERROR,
    ERROR_CODES.INVALID_INPUT,
    ERROR_CODES.MISSING_REQUIRED_FIELD,
    ERROR_CODES.INVALID_FORMAT,
    ERROR_CODES.INVALID_URL,
    ERROR_CODES.INVALID_EMAIL,
    ERROR_CODES.INVALID_UUID,
    ERROR_CODES.FILE_TOO_LARGE,
    ERROR_CODES.INVALID_FILE_TYPE
  ],
  AUTH_ERROR: [
    ERROR_CODES.UNAUTHORIZED,
    ERROR_CODES.FORBIDDEN,
    ERROR_CODES.INVALID_TOKEN,
    ERROR_CODES.TOKEN_EXPIRED,
    ERROR_CODES.SESSION_EXPIRED,
    ERROR_CODES.INVALID_CREDENTIALS
  ],
  RESOURCE_ERROR: [
    ERROR_CODES.NOT_FOUND,
    ERROR_CODES.RESOURCE_EXISTS,
    ERROR_CODES.RESOURCE_LIMIT_EXCEEDED,
    ERROR_CODES.RESOURCE_LOCKED,
    ERROR_CODES.RESOURCE_DELETED
  ],
  BILLING_ERROR: [
    ERROR_CODES.INSUFFICIENT_CREDITS,
    ERROR_CODES.PAYMENT_REQUIRED,
    ERROR_CODES.SUBSCRIPTION_EXPIRED,
    ERROR_CODES.SUBSCRIPTION_CANCELLED,
    ERROR_CODES.BILLING_ERROR,
    ERROR_CODES.QUOTA_EXCEEDED
  ],
  EXTERNAL_ERROR: [
    ERROR_CODES.API_UNAVAILABLE,
    ERROR_CODES.API_TIMEOUT,
    ERROR_CODES.API_QUOTA_EXCEEDED,
    ERROR_CODES.EXTERNAL_SERVICE_ERROR,
    ERROR_CODES.RATE_LIMIT_EXCEEDED
  ],
  SERVER_ERROR: [
    ERROR_CODES.INTERNAL_ERROR,
    ERROR_CODES.DATABASE_ERROR,
    ERROR_CODES.SERVICE_UNAVAILABLE,
    ERROR_CODES.MAINTENANCE_MODE,
    ERROR_CODES.CONFIGURATION_ERROR,
    ERROR_CODES.DEPENDENCY_ERROR
  ],
  NETWORK_ERROR: [
    ERROR_CODES.NETWORK_ERROR,
    ERROR_CODES.TIMEOUT_ERROR,
    ERROR_CODES.CONNECTION_FAILED,
    ERROR_CODES.DNS_ERROR,
    ERROR_CODES.SSL_ERROR
  ]
} as const;

// Retryable error codes
export const RETRYABLE_ERRORS = [
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.TIMEOUT_ERROR,
  ERROR_CODES.CONNECTION_FAILED,
  ERROR_CODES.SERVICE_UNAVAILABLE,
  ERROR_CODES.API_TIMEOUT,
  ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ERROR_CODES.INTERNAL_ERROR,
  ERROR_CODES.DATABASE_ERROR
] as const;

// User-friendly error messages
export const ERROR_MESSAGES = {
  [ERROR_CODES.UNAUTHORIZED]: 'Please log in to continue.',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ERROR_CODES.INVALID_TOKEN]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password.',
  
  [ERROR_CODES.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input data. Please check your information.',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',
  [ERROR_CODES.INVALID_FORMAT]: 'Invalid format. Please check your input.',
  [ERROR_CODES.INVALID_URL]: 'Please enter a valid URL.',
  [ERROR_CODES.INVALID_EMAIL]: 'Please enter a valid email address.',
  [ERROR_CODES.INVALID_UUID]: 'Invalid identifier format.',
  
  [ERROR_CODES.NOT_FOUND]: 'The requested resource was not found.',
  [ERROR_CODES.RESOURCE_EXISTS]: 'A resource with this information already exists.',
  [ERROR_CODES.RESOURCE_LIMIT_EXCEEDED]: 'You have reached the maximum limit for this resource.',
  [ERROR_CODES.RESOURCE_LOCKED]: 'This resource is currently locked by another operation.',
  [ERROR_CODES.RESOURCE_DELETED]: 'This resource has been deleted.',
  
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again.',
  [ERROR_CODES.INVALID_API_KEY]: 'Service configuration error. Please contact support.',
  [ERROR_CODES.API_UNAVAILABLE]: 'External service is temporarily unavailable.',
  [ERROR_CODES.API_TIMEOUT]: 'Request timed out. Please try again.',
  [ERROR_CODES.API_QUOTA_EXCEEDED]: 'API quota exceeded. Please try again later.',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service error. Please try again.',
  
  [ERROR_CODES.CONTENT_POLICY_VIOLATION]: 'Content violates our policies. Please modify your request.',
  [ERROR_CODES.CONTENT_TOO_LONG]: 'Content is too long. Please reduce the length.',
  [ERROR_CODES.CONTENT_TOO_SHORT]: 'Content is too short. Please provide more information.',
  [ERROR_CODES.CONTENT_GENERATION_FAILED]: 'Failed to generate content. Please try again.',
  [ERROR_CODES.CONTENT_ANALYSIS_FAILED]: 'Failed to analyze content. Please try again.',
  [ERROR_CODES.BLUEPRINT_GENERATION_FAILED]: 'Failed to generate content blueprint. Please try again.',
  [ERROR_CODES.RESEARCH_FAILED]: 'Failed to complete research. Please check your URLs and try again.',
  
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 'Insufficient credits. Please upgrade your plan.',
  [ERROR_CODES.PAYMENT_REQUIRED]: 'Payment is required to continue. Please update your billing information.',
  [ERROR_CODES.SUBSCRIPTION_EXPIRED]: 'Your subscription has expired. Please renew to continue.',
  [ERROR_CODES.SUBSCRIPTION_CANCELLED]: 'Your subscription has been cancelled.',
  [ERROR_CODES.BILLING_ERROR]: 'Billing error. Please contact support.',
  [ERROR_CODES.QUOTA_EXCEEDED]: 'You have exceeded your usage quota.',
  
  [ERROR_CODES.FILE_TOO_LARGE]: 'File size is too large. Please choose a smaller file.',
  [ERROR_CODES.INVALID_FILE_TYPE]: 'Invalid file type. Please upload a PDF file.',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: 'File upload failed. Please try again.',
  [ERROR_CODES.FILE_PROCESSING_FAILED]: 'Failed to process file. Please try again.',
  [ERROR_CODES.FILE_NOT_FOUND]: 'File not found.',
  [ERROR_CODES.FILE_CORRUPTED]: 'File appears to be corrupted. Please upload a new file.',
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please delete some files.',
  
  [ERROR_CODES.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection.',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ERROR_CODES.CONNECTION_FAILED]: 'Connection failed. Please try again.',
  [ERROR_CODES.DNS_ERROR]: 'DNS resolution failed. Please check your connection.',
  [ERROR_CODES.SSL_ERROR]: 'SSL connection error. Please try again.',
  
  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ERROR_CODES.DATABASE_ERROR]: 'Database error. Please try again.',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  [ERROR_CODES.MAINTENANCE_MODE]: 'System is under maintenance. Please try again later.',
  [ERROR_CODES.CONFIGURATION_ERROR]: 'Configuration error. Please contact support.',
  [ERROR_CODES.DEPENDENCY_ERROR]: 'Dependency error. Please contact support.',
  
  [ERROR_CODES.CONCURRENT_MODIFICATION]: 'Resource was modified by another user. Please refresh and try again.',
  [ERROR_CODES.OPERATION_IN_PROGRESS]: 'Another operation is in progress. Please wait.',
  [ERROR_CODES.INVALID_STATE]: 'Invalid operation state. Please refresh and try again.',
  [ERROR_CODES.STATE_CONFLICT]: 'State conflict detected. Please refresh and try again.',
  
  [ERROR_CODES.EXPORT_FAILED]: 'Export failed. Please try again.',
  [ERROR_CODES.IMPORT_FAILED]: 'Import failed. Please check your file and try again.',
  [ERROR_CODES.UNSUPPORTED_FORMAT]: 'Unsupported file format.',
  [ERROR_CODES.CONVERSION_FAILED]: 'File conversion failed. Please try again.'
} as const;

// HTTP status code mappings
export const ERROR_HTTP_STATUS = {
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.INVALID_TOKEN]: 401,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.SESSION_EXPIRED]: 401,
  [ERROR_CODES.INVALID_CREDENTIALS]: 401,
  
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
  [ERROR_CODES.INVALID_FORMAT]: 400,
  [ERROR_CODES.INVALID_URL]: 400,
  [ERROR_CODES.INVALID_EMAIL]: 400,
  [ERROR_CODES.INVALID_UUID]: 400,
  
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.RESOURCE_EXISTS]: 409,
  [ERROR_CODES.RESOURCE_LIMIT_EXCEEDED]: 429,
  [ERROR_CODES.RESOURCE_LOCKED]: 423,
  [ERROR_CODES.RESOURCE_DELETED]: 410,
  
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
  [ERROR_CODES.INVALID_API_KEY]: 401,
  [ERROR_CODES.API_UNAVAILABLE]: 503,
  [ERROR_CODES.API_TIMEOUT]: 408,
  [ERROR_CODES.API_QUOTA_EXCEEDED]: 429,
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
  
  [ERROR_CODES.CONTENT_POLICY_VIOLATION]: 400,
  [ERROR_CODES.CONTENT_TOO_LONG]: 413,
  [ERROR_CODES.CONTENT_TOO_SHORT]: 400,
  [ERROR_CODES.CONTENT_GENERATION_FAILED]: 500,
  [ERROR_CODES.CONTENT_ANALYSIS_FAILED]: 500,
  [ERROR_CODES.BLUEPRINT_GENERATION_FAILED]: 500,
  [ERROR_CODES.RESEARCH_FAILED]: 500,
  
  [ERROR_CODES.INSUFFICIENT_CREDITS]: 402,
  [ERROR_CODES.PAYMENT_REQUIRED]: 402,
  [ERROR_CODES.SUBSCRIPTION_EXPIRED]: 402,
  [ERROR_CODES.SUBSCRIPTION_CANCELLED]: 402,
  [ERROR_CODES.BILLING_ERROR]: 402,
  [ERROR_CODES.QUOTA_EXCEEDED]: 429,
  
  [ERROR_CODES.FILE_TOO_LARGE]: 413,
  [ERROR_CODES.INVALID_FILE_TYPE]: 415,
  [ERROR_CODES.FILE_UPLOAD_FAILED]: 500,
  [ERROR_CODES.FILE_PROCESSING_FAILED]: 500,
  [ERROR_CODES.FILE_NOT_FOUND]: 404,
  [ERROR_CODES.FILE_CORRUPTED]: 400,
  [ERROR_CODES.STORAGE_QUOTA_EXCEEDED]: 507,
  
  [ERROR_CODES.NETWORK_ERROR]: 503,
  [ERROR_CODES.TIMEOUT_ERROR]: 408,
  [ERROR_CODES.CONNECTION_FAILED]: 503,
  [ERROR_CODES.DNS_ERROR]: 503,
  [ERROR_CODES.SSL_ERROR]: 503,
  
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.MAINTENANCE_MODE]: 503,
  [ERROR_CODES.CONFIGURATION_ERROR]: 500,
  [ERROR_CODES.DEPENDENCY_ERROR]: 500,
  
  [ERROR_CODES.CONCURRENT_MODIFICATION]: 409,
  [ERROR_CODES.OPERATION_IN_PROGRESS]: 409,
  [ERROR_CODES.INVALID_STATE]: 409,
  [ERROR_CODES.STATE_CONFLICT]: 409,
  
  [ERROR_CODES.EXPORT_FAILED]: 500,
  [ERROR_CODES.IMPORT_FAILED]: 400,
  [ERROR_CODES.UNSUPPORTED_FORMAT]: 415,
  [ERROR_CODES.CONVERSION_FAILED]: 500
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
  BACKOFF_MULTIPLIER: 2,
  JITTER_MAX: 1000 // 1 second
} as const;

// Error logging levels
export const ERROR_LOG_LEVELS = {
  [ERROR_CODES.VALIDATION_ERROR]: 'warn',
  [ERROR_CODES.UNAUTHORIZED]: 'warn',
  [ERROR_CODES.FORBIDDEN]: 'warn',
  [ERROR_CODES.NOT_FOUND]: 'info',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'warn',
  [ERROR_CODES.INTERNAL_ERROR]: 'error',
  [ERROR_CODES.DATABASE_ERROR]: 'error',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'error'
} as const;

// Helper functions
export function isRetryableError(errorCode: string): boolean {
  return RETRYABLE_ERRORS.includes(errorCode as any);
}

export function getErrorCategory(errorCode: string): string | null {
  for (const [category, codes] of Object.entries(ERROR_CATEGORIES)) {
    if ((codes as readonly string[]).includes(errorCode)) {
      return category;
    }
  }
  return null;
}

export function getHttpStatusForError(errorCode: string): number {
  return ERROR_HTTP_STATUS[errorCode as keyof typeof ERROR_HTTP_STATUS] || 500;
}

export function getUserFriendlyMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES] || 'An unexpected error occurred.';
}

export function getLogLevel(errorCode: string): string {
  return ERROR_LOG_LEVELS[errorCode as keyof typeof ERROR_LOG_LEVELS] || 'error';
}

// Type exports
export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorCategory = keyof typeof ERROR_CATEGORIES;
export type RetryableErrorCode = typeof RETRYABLE_ERRORS[number];