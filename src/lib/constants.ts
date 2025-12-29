// Application constants
export const APP_NAME = 'AEO Writer Pro';
export const APP_DESCRIPTION = 'AI-powered SEO content generation platform';

// API endpoints
export const API_ROUTES = {
  PROJECTS: '/api/projects',
  AUTH: '/api/auth',
  RESEARCH: '/api/research',
  BLUEPRINT: '/api/blueprint',
  WRITE: '/api/write',
  EXPORT: '/api/export'
} as const;

// Project configuration
export const PROJECT_LIMITS = {
  MAX_COMPETITOR_URLS: 5,
  MIN_COMPETITOR_URLS: 1,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOPIC_LENGTH: 200,
  MIN_TOPIC_LENGTH: 3,
  MAX_CONTENT_LENGTH: 10000,
  MIN_CONTENT_LENGTH: 500
} as const;

// Content configuration
export const CONTENT_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'witty', label: 'Witty' },
  { value: 'data-driven', label: 'Data-Driven' }
] as const;

export const CONTENT_FORMATS = [
  { value: 'how-to', label: 'How-to Guide' },
  { value: 'listicle', label: 'Listicle' },
  { value: 'case-study', label: 'Case Study' }
] as const;

// Project status configuration
export const PROJECT_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'gray' },
  researching: { label: 'Researching', color: 'blue' },
  planning: { label: 'Planning', color: 'yellow' },
  writing: { label: 'Writing', color: 'orange' },
  completed: { label: 'Completed', color: 'green' },
  error: { label: 'Error', color: 'red' }
} as const;

// AI model configuration
export const AI_MODELS = {
  STRATEGY: 'gpt-4',
  WRITING: 'gpt-4-mini',
  POLISH: 'gpt-4'
} as const;

// Token pricing (per 1K tokens)
export const TOKEN_PRICING = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-mini': { input: 0.00015, output: 0.0006 }
} as const;

// Re-export error constants from dedicated file
export {
  ERROR_CODES,
  ERROR_CATEGORIES,
  RETRYABLE_ERRORS,
  ERROR_MESSAGES,
  ERROR_HTTP_STATUS,
  RETRY_CONFIG,
  ERROR_LOG_LEVELS,
  isRetryableError,
  getErrorCategory,
  getHttpStatusForError,
  getUserFriendlyMessage,
  getLogLevel
} from './constants/errors';

// File upload configuration
export const UPLOAD_CONFIG = {
  ALLOWED_TYPES: ['application/pdf'],
  MAX_SIZE: PROJECT_LIMITS.MAX_FILE_SIZE,
  STORAGE_BUCKET: 'brand-documents'
} as const;

// SEO configuration
export const SEO_CONFIG = {
  MAX_TITLE_LENGTH: 60,
  MAX_DESCRIPTION_LENGTH: 160,
  MIN_CONTENT_LENGTH: 500,
  TARGET_READING_LEVEL: 8 // Grade level
} as const;

// Export formats
export const EXPORT_FORMATS = [
  { value: 'markdown', label: 'Markdown (.md)', extension: 'md' },
  { value: 'html', label: 'HTML (.html)', extension: 'html' },
  { value: 'pdf', label: 'PDF (.pdf)', extension: 'pdf' }
] as const;