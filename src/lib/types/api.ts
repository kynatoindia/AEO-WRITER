/**
 * API Types and Interfaces
 * Centralized API request/response type definitions
 */

import type {
  Project,
  ContentBlueprint,
  ContentSection,
  SEOMetadata,
  TokenUsage,
  CostBreakdown,
  UsageAnalytic,
  UsageReport,
  CompetitorData,
  BrandAnalysis,
  ResearchSummary,
  ContentAnalysis,
  ProjectStatus,
  ContentTone,
  ContentFormat,
  ExportFormat,
  OperationType,
  APIProvider,
  PaginationInfo,
  APIError,
  ValidationError
} from './index';

// Base API Response wrapper
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: string;
  requestId?: string;
}

// Project API Types
export interface CreateProjectRequest {
  topic: string;
  competitorUrls: string[];
  tone: ContentTone;
  format: ContentFormat;
  brandDocument?: File;
}

export interface CreateProjectResponse {
  project: Project;
  estimatedCost: number;
  estimatedTokens: number;
}

export interface UpdateProjectRequest {
  topic?: string;
  competitorUrls?: string[];
  tone?: ContentTone;
  format?: ContentFormat;
  status?: ProjectStatus;
  blueprint?: ContentBlueprint;
  generatedContent?: string;
  seoMetadata?: SEOMetadata;
}

export interface GetProjectResponse {
  project: Project;
  sections: ContentSection[];
  analytics: {
    tokensUsed: TokenUsage;
    costBreakdown: CostBreakdown;
    progress: number;
  };
}

export interface ListProjectsRequest {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  tone?: ContentTone;
  format?: ContentFormat;
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'topic';
  sortOrder?: 'asc' | 'desc';
}

export interface ListProjectsResponse {
  projects: Project[];
  pagination: PaginationInfo;
  summary: {
    total: number;
    byStatus: Record<ProjectStatus, number>;
    totalCost: number;
    totalTokens: number;
  };
}

export interface DeleteProjectRequest {
  projectId: string;
  confirmDelete: boolean;
}

// Research API Types
export interface ResearchRequest {
  projectId: string;
  competitorUrls: string[];
  brandDocument?: string;
  additionalContext?: string;
}

export interface ResearchResponse {
  competitorData: CompetitorData[];
  brandAnalysis?: BrandAnalysis;
  researchSummary: ResearchSummary;
  tokensUsed: number;
  cost: number;
  processingTime: number;
}

// Blueprint API Types
export interface GenerateBlueprintRequest {
  projectId: string;
  researchData: ResearchResponse;
  preferences: {
    tone: ContentTone;
    format: ContentFormat;
    targetLength: number;
    focusKeywords: string[];
  };
}

export interface GenerateBlueprintResponse {
  blueprint: ContentBlueprint;
  estimatedTokens: number;
  estimatedCost: number;
  estimatedWritingTime: number;
}

export interface UpdateBlueprintRequest {
  projectId: string;
  blueprint: ContentBlueprint;
}

// Writing API Types
export interface StartWritingRequest {
  projectId: string;
  blueprint: ContentBlueprint;
  resumeFromSection?: string;
  writingPreferences?: {
    includeImages: boolean;
    includeTables: boolean;
    includeCodeBlocks: boolean;
    targetReadingLevel: number;
  };
}

export interface StartWritingResponse {
  jobId: string;
  estimatedCompletionTime: number;
  sectionsToWrite: number;
}

export interface WritingSectionRequest {
  projectId: string;
  sectionId: string;
  context: {
    previousSections: string[];
    researchData: ResearchResponse;
    seoRequirements: SEOMetadata;
  };
}

export interface WritingSectionResponse {
  sectionId: string;
  content: string;
  tokensUsed: number;
  cost: number;
  processingTime: number;
  quality: {
    readabilityScore: number;
    seoScore: number;
    keywordDensity: number;
  };
}

export interface GetWritingProgressRequest {
  projectId: string;
}

export interface GetWritingProgressResponse {
  status: ProjectStatus;
  progress: number;
  currentSection: string;
  completedSections: string[];
  estimatedTimeRemaining: number;
  tokensUsed: TokenUsage;
  costSoFar: CostBreakdown;
}

// Export API Types
export interface ExportRequest {
  projectId: string;
  format: ExportFormat;
  options: {
    includeMetadata: boolean;
    includeSEOData: boolean;
    includeAnalytics: boolean;
    customStyling?: string;
  };
}

export interface ExportResponse {
  downloadUrl: string;
  filename: string;
  fileSize: number;
  expiresAt: string;
  format: ExportFormat;
}

// Analytics API Types
export interface GetUsageAnalyticsRequest {
  userId?: string;
  projectId?: string;
  operationType?: OperationType;
  apiProvider?: APIProvider;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface GetUsageAnalyticsResponse {
  analytics: UsageAnalytic[];
  pagination: PaginationInfo;
  summary: {
    totalTokens: number;
    totalCost: number;
    averageCostPerOperation: number;
    mostExpensiveOperation: OperationType;
  };
}

export interface GetUsageReportRequest {
  userId?: string;
  period: 'day' | 'week' | 'month' | 'year';
  startDate?: string;
  endDate?: string;
}

export interface GetUsageReportResponse {
  report: UsageReport;
  trends: {
    tokenUsageTrend: Array<{ date: string; tokens: number }>;
    costTrend: Array<{ date: string; cost: number }>;
    operationTrend: Array<{ operation: OperationType; count: number }>;
  };
  recommendations: string[];
}

// File Upload API Types
export interface UploadFileRequest {
  file: File;
  projectId?: string;
  purpose: 'brand-document' | 'user-avatar' | 'export-template';
}

export interface UploadFileResponse {
  fileId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadUrl: string;
  publicUrl?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface GetFileRequest {
  fileId: string;
}

export interface GetFileResponse {
  fileId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  publicUrl?: string;
  downloadUrl: string;
  metadata: Record<string, unknown>;
}

// User API Types
export interface UpdateUserProfileRequest {
  fullName?: string;
  avatarUrl?: string;
  preferences?: {
    defaultTone: ContentTone;
    defaultFormat: ContentFormat;
    emailNotifications: boolean;
    autoSave: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}

export interface GetUserStatsResponse {
  projectsCreated: number;
  projectsCompleted: number;
  totalTokensUsed: number;
  totalCostSpent: number;
  averageProjectCost: number;
  favoriteContentTone: ContentTone;
  favoriteContentFormat: ContentFormat;
  joinedAt: string;
  lastActiveAt: string;
}

// Health Check API Types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'up' | 'down' | 'degraded';
    openai: 'up' | 'down' | 'degraded';
    tavily: 'up' | 'down' | 'degraded';
    storage: 'up' | 'down' | 'degraded';
    redis?: 'up' | 'down' | 'degraded';
  };
  timestamp: string;
  version: string;
  uptime: number;
}

// Batch Operations API Types
export interface BatchUpdateProjectsRequest {
  projectIds: string[];
  updates: UpdateProjectRequest;
}

export interface BatchUpdateProjectsResponse {
  updated: string[];
  failed: Array<{
    projectId: string;
    error: string;
  }>;
  summary: {
    totalRequested: number;
    successful: number;
    failed: number;
  };
}

export interface BatchDeleteProjectsRequest {
  projectIds: string[];
  confirmDelete: boolean;
}

export interface BatchDeleteProjectsResponse {
  deleted: string[];
  failed: Array<{
    projectId: string;
    error: string;
  }>;
  summary: {
    totalRequested: number;
    successful: number;
    failed: number;
  };
}

// WebSocket/Real-time API Types
export interface RealtimeEvent {
  type: 'project_update' | 'section_complete' | 'error' | 'progress' | 'job_complete';
  projectId: string;
  userId: string;
  data: unknown;
  timestamp: string;
}

export interface ProjectUpdateEvent extends RealtimeEvent {
  type: 'project_update';
  data: {
    status: ProjectStatus;
    progress: number;
    currentSection?: string;
    message?: string;
  };
}

export interface SectionCompleteEvent extends RealtimeEvent {
  type: 'section_complete';
  data: {
    sectionId: string;
    content: string;
    tokensUsed: number;
    cost: number;
    quality: {
      readabilityScore: number;
      seoScore: number;
    };
  };
}

export interface ProgressEvent extends RealtimeEvent {
  type: 'progress';
  data: {
    operation: OperationType;
    progress: number;
    message: string;
    estimatedTimeRemaining?: number;
  };
}

export interface ErrorEvent extends RealtimeEvent {
  type: 'error';
  data: {
    error: APIError;
    operation: OperationType;
    recoverable: boolean;
    retryAfter?: number;
  };
}

export interface JobCompleteEvent extends RealtimeEvent {
  type: 'job_complete';
  data: {
    jobId: string;
    operation: OperationType;
    result: 'success' | 'failure' | 'partial';
    summary: {
      tokensUsed: number;
      cost: number;
      processingTime: number;
    };
    output?: unknown;
  };
}

// Error Response Types
export interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: {
      validationErrors: ValidationError[];
    };
  };
  timestamp: string;
}

export interface RateLimitErrorResponse {
  success: false;
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details: {
      limit: number;
      remaining: number;
      resetTime: string;
    };
  };
  timestamp: string;
}

export interface AuthErrorResponse {
  success: false;
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN';
    message: string;
    details?: {
      requiredPermissions?: string[];
      currentPermissions?: string[];
    };
  };
  timestamp: string;
}

// Type guards for API responses
export function isAPIError(response: unknown): response is APIResponse & { success: false } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  );
}

export function isValidationError(response: unknown): response is ValidationErrorResponse {
  return (
    isAPIError(response) &&
    response.error?.code === 'VALIDATION_ERROR'
  );
}

export function isRateLimitError(response: unknown): response is RateLimitErrorResponse {
  return (
    isAPIError(response) &&
    response.error?.code === 'RATE_LIMIT_EXCEEDED'
  );
}

export function isAuthError(response: unknown): response is AuthErrorResponse {
  return (
    isAPIError(response) &&
    (response.error?.code === 'UNAUTHORIZED' || response.error?.code === 'FORBIDDEN')
  );
}