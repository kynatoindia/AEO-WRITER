import {
  ProjectStatus,
  ContentTone,
  ContentFormat,
  SectionStatus,
  SubscriptionPlan,
  ContentElementType,
  OperationType,
  APIProvider,
  ExportFormat,
  Theme,
  BillingCycle,
  FileUploadStatus,
  ServiceStatus,
  HealthStatus,
  JobResult,
  APIError,
  Project,
  ContentSection,
  ContentBlueprint,
  User,
  UserProfile,
  UsageAnalytic,
  CompetitorData,
  BrandAnalysis,
  ResearchSummary,
  ContentAnalysis,
  WritingContext,
  UserSubscription,
  UsageReport,
  RealtimeEvent,
  ProjectUpdateEvent,
  SectionCompleteEvent,
  ProgressEvent
} from '@/lib/types';

/**
 * Type guard for ProjectStatus
 */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && 
    ['draft', 'researching', 'planning', 'writing', 'completed', 'error'].includes(value);
}

/**
 * Type guard for ContentTone
 */
export function isContentTone(value: unknown): value is ContentTone {
  return typeof value === 'string' && 
    ['professional', 'witty', 'data-driven'].includes(value);
}

/**
 * Type guard for ContentFormat
 */
export function isContentFormat(value: unknown): value is ContentFormat {
  return typeof value === 'string' && 
    ['how-to', 'listicle', 'case-study'].includes(value);
}

/**
 * Type guard for SectionStatus
 */
export function isSectionStatus(value: unknown): value is SectionStatus {
  return typeof value === 'string' && 
    ['pending', 'writing', 'completed'].includes(value);
}

/**
 * Type guard for SubscriptionPlan
 */
export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return typeof value === 'string' && 
    ['free', 'pro', 'enterprise'].includes(value);
}

/**
 * Type guard for ContentElementType
 */
export function isContentElementType(value: unknown): value is ContentElementType {
  return typeof value === 'string' && 
    ['direct-answer', 'bullet-points', 'comparison-table', 'faq', 'code-block'].includes(value);
}

/**
 * Type guard for OperationType
 */
export function isOperationType(value: unknown): value is OperationType {
  return typeof value === 'string' && 
    ['research', 'planning', 'writing', 'polish', 'export'].includes(value);
}

/**
 * Type guard for APIProvider
 */
export function isAPIProvider(value: unknown): value is APIProvider {
  return typeof value === 'string' && 
    ['openai', 'tavily'].includes(value);
}

/**
 * Type guard for ExportFormat
 */
export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && 
    ['markdown', 'html', 'pdf'].includes(value);
}

/**
 * Type guard for APIError
 */
export function isAPIError(value: unknown): value is APIError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'retryable' in value &&
    typeof (value as APIError).code === 'string' &&
    typeof (value as APIError).message === 'string' &&
    typeof (value as APIError).retryable === 'boolean'
  );
}

/**
 * Type guard for Project
 */
export function isProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    typeof obj.topic === 'string' &&
    isProjectStatus(obj.status) &&
    Array.isArray(obj.competitor_urls) &&
    obj.competitor_urls.every((url: unknown) => typeof url === 'string') &&
    isContentTone(obj.tone) &&
    isContentFormat(obj.format) &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

/**
 * Type guard for ContentSection
 */
export function isContentSection(value: unknown): value is ContentSection {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.heading === 'string' &&
    typeof obj.goal === 'string' &&
    Array.isArray(obj.subSections) &&
    Array.isArray(obj.contentElements) &&
    Array.isArray(obj.dataSources) &&
    typeof obj.order === 'number'
  );
}

/**
 * Type guard for ContentBlueprint
 */
export function isContentBlueprint(value: unknown): value is ContentBlueprint {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    Array.isArray(obj.sections) &&
    obj.sections.every(isContentSection) &&
    typeof obj.seoMetadata === 'object' &&
    obj.seoMetadata !== null &&
    typeof obj.estimatedLength === 'number' &&
    Array.isArray(obj.targetKeywords) &&
    obj.targetKeywords.every((keyword: unknown) => typeof keyword === 'string')
  );
}

/**
 * Type guard for User
 */
export function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    (obj.name === undefined || typeof obj.name === 'string') &&
    (obj.avatar === undefined || typeof obj.avatar === 'string')
  );
}

/**
 * Type guard for UserProfile
 */
export function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    isSubscriptionPlan(obj.subscription_plan) &&
    typeof obj.tokens_used === 'number' &&
    typeof obj.tokens_limit === 'number' &&
    typeof obj.projects_used === 'number' &&
    typeof obj.projects_limit === 'number' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

/**
 * Type guard for UsageAnalytic
 */
export function isUsageAnalytic(value: unknown): value is UsageAnalytic {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    isOperationType(obj.operation_type) &&
    isAPIProvider(obj.api_provider) &&
    typeof obj.model_used === 'string' &&
    typeof obj.created_at === 'string'
  );
}

/**
 * Type guard for valid UUID
 */
export function isUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard for valid URL
 */
export function isValidURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for valid email
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard for valid date string
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Type guard for non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard for positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Type guard for non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && !isNaN(value);
}

/**
 * Type guard for Theme
 */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && 
    ['light', 'dark', 'system'].includes(value);
}

/**
 * Type guard for BillingCycle
 */
export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && 
    ['monthly', 'yearly'].includes(value);
}

/**
 * Type guard for FileUploadStatus
 */
export function isFileUploadStatus(value: unknown): value is FileUploadStatus {
  return typeof value === 'string' && 
    ['pending', 'uploading', 'completed', 'error'].includes(value);
}

/**
 * Type guard for ServiceStatus
 */
export function isServiceStatus(value: unknown): value is ServiceStatus {
  return typeof value === 'string' && 
    ['up', 'down', 'degraded'].includes(value);
}

/**
 * Type guard for HealthStatus
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === 'string' && 
    ['healthy', 'degraded', 'unhealthy'].includes(value);
}

/**
 * Type guard for JobResult
 */
export function isJobResult(value: unknown): value is JobResult {
  return typeof value === 'string' && 
    ['success', 'failure', 'partial'].includes(value);
}

/**
 * Type guard for CompetitorData
 */
export function isCompetitorData(value: unknown): value is CompetitorData {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isValidURL(obj.url) &&
    typeof obj.title === 'string' &&
    typeof obj.content === 'string' &&
    Array.isArray(obj.headings) &&
    obj.headings.every((h: unknown) => typeof h === 'string') &&
    typeof obj.wordCount === 'number' &&
    Array.isArray(obj.keyTopics) &&
    obj.keyTopics.every((t: unknown) => typeof t === 'string')
  );
}

/**
 * Type guard for BrandAnalysis
 */
export function isBrandAnalysis(value: unknown): value is BrandAnalysis {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.tone === 'string' &&
    Array.isArray(obj.keyMessages) &&
    obj.keyMessages.every((m: unknown) => typeof m === 'string') &&
    typeof obj.targetAudience === 'string' &&
    Array.isArray(obj.brandValues) &&
    obj.brandValues.every((v: unknown) => typeof v === 'string') &&
    Array.isArray(obj.competitiveAdvantages) &&
    obj.competitiveAdvantages.every((a: unknown) => typeof a === 'string')
  );
}

/**
 * Type guard for ResearchSummary
 */
export function isResearchSummary(value: unknown): value is ResearchSummary {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    Array.isArray(obj.topCompetitors) &&
    obj.topCompetitors.every((c: unknown) => typeof c === 'string') &&
    Array.isArray(obj.keyInsights) &&
    obj.keyInsights.every((i: unknown) => typeof i === 'string') &&
    Array.isArray(obj.contentOpportunities) &&
    obj.contentOpportunities.every((o: unknown) => typeof o === 'string') &&
    typeof obj.recommendedApproach === 'string' &&
    Array.isArray(obj.targetKeywords) &&
    obj.targetKeywords.every((k: unknown) => typeof k === 'string')
  );
}

/**
 * Type guard for ContentAnalysis
 */
export function isContentAnalysis(value: unknown): value is ContentAnalysis {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    Array.isArray(obj.keyTopics) &&
    obj.keyTopics.every((t: unknown) => typeof t === 'string') &&
    Array.isArray(obj.contentGaps) &&
    obj.contentGaps.every((g: unknown) => typeof g === 'string') &&
    Array.isArray(obj.seoOpportunities) &&
    obj.seoOpportunities.every((o: unknown) => typeof o === 'string') &&
    Array.isArray(obj.structureRecommendations) &&
    obj.structureRecommendations.every((r: unknown) => typeof r === 'string') &&
    Array.isArray(obj.competitorStrengths) &&
    obj.competitorStrengths.every((s: unknown) => typeof s === 'string') &&
    Array.isArray(obj.targetKeywords) &&
    obj.targetKeywords.every((k: unknown) => typeof k === 'string')
  );
}

/**
 * Type guard for UserSubscription
 */
export function isUserSubscription(value: unknown): value is UserSubscription {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isSubscriptionPlan(obj.plan) &&
    typeof obj.tokensUsed === 'number' &&
    typeof obj.tokensLimit === 'number' &&
    typeof obj.projectsUsed === 'number' &&
    typeof obj.projectsLimit === 'number' &&
    typeof obj.isActive === 'boolean'
  );
}

/**
 * Type guard for UsageReport
 */
export function isUsageReport(value: unknown): value is UsageReport {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.period === 'object' &&
    obj.period !== null &&
    typeof (obj.period as any).start === 'string' &&
    typeof (obj.period as any).end === 'string' &&
    typeof obj.totalTokens === 'number' &&
    typeof obj.totalCost === 'number' &&
    typeof obj.operationBreakdown === 'object' &&
    typeof obj.modelBreakdown === 'object'
  );
}

/**
 * Type guard for RealtimeEvent
 */
export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.type === 'string' &&
    ['project_update', 'section_complete', 'error', 'progress'].includes(obj.type) &&
    isUUID(obj.projectId) &&
    isUUID(obj.userId) &&
    typeof obj.timestamp === 'string'
  );
}

/**
 * Type guard for ProjectUpdateEvent
 */
export function isProjectUpdateEvent(value: unknown): value is ProjectUpdateEvent {
  if (!isRealtimeEvent(value)) return false;
  
  return (
    value.type === 'project_update' &&
    typeof value.data === 'object' &&
    value.data !== null &&
    isProjectStatus((value.data as any).status) &&
    typeof (value.data as any).progress === 'number'
  );
}

/**
 * Type guard for SectionCompleteEvent
 */
export function isSectionCompleteEvent(value: unknown): value is SectionCompleteEvent {
  if (!isRealtimeEvent(value)) return false;
  
  return (
    value.type === 'section_complete' &&
    typeof value.data === 'object' &&
    value.data !== null &&
    typeof (value.data as any).sectionId === 'string' &&
    typeof (value.data as any).content === 'string' &&
    typeof (value.data as any).tokensUsed === 'number'
  );
}

/**
 * Type guard for ProgressEvent
 */
export function isProgressEvent(value: unknown): value is ProgressEvent {
  if (!isRealtimeEvent(value)) return false;
  
  return (
    value.type === 'progress' &&
    typeof value.data === 'object' &&
    value.data !== null &&
    isOperationType((value.data as any).operation) &&
    typeof (value.data as any).progress === 'number' &&
    typeof (value.data as any).message === 'string'
  );
}

/**
 * Type guard for PDF file
 */
export function isPDFFile(value: unknown): value is File {
  return isValidFile(value) && value.type === 'application/pdf';
}

/**
 * Type guard for valid file
 */
export function isValidFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Type guard for file within size limit
 */
export function isFileSizeValid(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Utility function to assert a type guard
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage?: string
): asserts value is T {
  if (!guard(value)) {
    throw new Error(errorMessage || `Type assertion failed`);
  }
}

/**
 * Utility function to safely cast with type guard
 */
export function safeCast<T>(
  value: unknown,
  guard: (value: unknown) => value is T
): T | null {
  return guard(value) ? value : null;
}

/**
 * Utility function to filter array by type guard
 */
export function filterByType<T>(
  array: unknown[],
  guard: (value: unknown) => value is T
): T[] {
  return array.filter(guard);
}

/**
 * Type guard for WritingContext
 */
export function isWritingContext(value: unknown): value is WritingContext {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isContentBlueprint(obj.blueprint) &&
    Array.isArray(obj.previousSections) &&
    obj.previousSections.every((s: unknown) => typeof s === 'string') &&
    isContentSection(obj.currentSection) &&
    typeof obj.brandVoice === 'string' &&
    typeof obj.targetAudience === 'string' &&
    typeof obj.researchData === 'object' &&
    typeof obj.seoRequirements === 'object'
  );
}

/**
 * Type guard for numeric string
 */
export function isNumericString(value: unknown): value is string {
  return typeof value === 'string' && !isNaN(Number(value));
}

/**
 * Type guard for integer
 */
export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Type guard for positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

/**
 * Type guard for non-negative integer
 */
export function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

/**
 * Type guard for percentage (0-100)
 */
export function isPercentage(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

/**
 * Type guard for valid JSON string
 */
export function isValidJSONString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for array of specific type
 */
export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/**
 * Type guard for record with string keys and specific value type
 */
export function isRecordOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is Record<string, T> {
  if (typeof value !== 'object' || value === null) return false;
  
  return Object.values(value).every(guard);
}

/**
 * Type guard for optional value
 */
export function isOptional<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | undefined {
  return value === undefined || guard(value);
}

/**
 * Type guard for nullable value
 */
export function isNullable<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | null {
  return value === null || guard(value);
}

/**
 * Type guard for value that can be undefined or null
 */
export function isOptionalNullable<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T | null | undefined {
  return value === null || value === undefined || guard(value);
}