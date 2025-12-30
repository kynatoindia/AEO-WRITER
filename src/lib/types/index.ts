// Core application types
export type ProjectStatus = 'draft' | 'researching' | 'planning' | 'writing' | 'finalizing' | 'completed' | 'error';
export type ContentTone = 'professional' | 'witty' | 'data-driven';
export type ContentFormat = 'how-to' | 'listicle' | 'case-study';
export type SectionStatus = 'pending' | 'writing' | 'completed';
export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';
export type ContentElementType = 'direct-answer' | 'bullet-points' | 'comparison-table' | 'faq' | 'code-block';
export type OperationType = 'research' | 'planning' | 'writing' | 'polish' | 'finalization' | 'export';
export type APIProvider = 'openai' | 'tavily';
export type ExportFormat = 'markdown' | 'html' | 'pdf';
export type Theme = 'light' | 'dark' | 'system';
export type BillingCycle = 'monthly' | 'yearly';
export type FileUploadStatus = 'pending' | 'uploading' | 'completed' | 'error';
export type ServiceStatus = 'up' | 'down' | 'degraded';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type JobResult = 'success' | 'failure' | 'partial';

// Project related types
export interface Project {
  id: string;
  user_id: string;
  topic: string;
  status: ProjectStatus;
  competitor_urls: string[];
  tone: ContentTone;
  format: ContentFormat;
  brand_document_path?: string;
  openai_thread_id?: string;
  blueprint?: ContentBlueprint;
  generated_content?: string;
  seo_metadata?: SEOMetadata;
  token_usage?: TokenUsage;
  cost_breakdown?: CostBreakdown;
  created_at: string;
  updated_at: string;
}

// Content Blueprint types
export interface ContentBlueprint {
  sections: ContentSection[];
  seoMetadata: SEOMetadata;
  estimatedLength: number;
  targetKeywords: string[];
}

export interface ContentSection {
  id: string;
  heading: string;
  goal: string;
  subSections: SubSection[];
  contentElements: ContentElement[];
  dataSources: string[];
  order: number;
  status?: 'pending' | 'writing' | 'completed';
  generatedContent?: string;
}

export interface SubSection {
  id: string;
  heading: string;
  keyPoints: string[];
}

export interface ContentElement {
  type: 'direct-answer' | 'bullet-points' | 'comparison-table' | 'faq' | 'code-block';
  properties: Record<string, unknown>;
}

// SEO and Metadata types
export interface SEOMetadata {
  title: string;
  metaDescription: string;
  targetKeywords: string[];
  focusKeyword: string;
  readabilityScore?: number;
}

// Usage and Cost tracking types
export interface TokenUsage {
  research: number;
  planning: number;
  writing: number;
  total: number;
}

export interface CostBreakdown {
  research: number;
  planning: number;
  writing: number;
  total: number;
}

// API Request/Response types
export interface CreateProjectRequest {
  topic: string;
  competitorUrls: string[];
  tone: ContentTone;
  format: ContentFormat;
  brandDocument?: File;
}

export interface UpdateProjectRequest {
  topic?: string;
  competitorUrls?: string[];
  tone?: ContentTone;
  format?: ContentFormat;
  status?: ProjectStatus;
}

export interface ProjectResponse {
  id: string;
  userId: string;
  topic: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  metadata: ProjectMetadata;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
  pagination: PaginationInfo;
}

export interface ProjectMetadata {
  estimatedCost?: number;
  estimatedTokens?: number;
  progress?: number;
  completedSections?: number;
  totalSections?: number;
}

// Research API types
export interface ResearchRequest {
  competitorUrls: string[];
  brandDocument?: string;
}

export interface ResearchResponse {
  competitorData: CompetitorData[];
  brandAnalysis?: BrandAnalysis;
  researchSummary: ResearchSummary;
}

// Blueprint API types
export interface BlueprintRequest {
  researchData: ResearchResponse;
  preferences: {
    tone: ContentTone;
    format: ContentFormat;
    targetLength: number;
  };
}

export interface BlueprintResponse {
  blueprint: ContentBlueprint;
  estimatedTokens: number;
  estimatedCost: number;
}

// Writing API types
export interface WriteRequest {
  projectId: string;
  blueprint: ContentBlueprint;
  sectionIndex?: number;
  resumeFromSection?: string;
}

export interface WriteResponse {
  sectionId: string;
  content: string;
  status: SectionStatus;
  tokensUsed: number;
  cost: number;
}

export interface WriteProgressUpdate {
  projectId: string;
  currentSection: string;
  progress: number;
  status: ProjectStatus;
  content?: string;
}

// Export API types
export interface ExportRequest {
  projectId: string;
  format: ExportFormat;
  includeMetadata: boolean;
}

export interface ExportResponse {
  downloadUrl: string;
  filename: string;
  size: number;
  expiresAt: string;
}

// Generic API response wrapper
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: string;
}

// Pagination types
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// Research and Analysis types
export interface ResearchContext {
  topic: string;
  competitorData: CompetitorData[];
  brandDocument?: string;
  tone: ContentTone;
  format: ContentFormat;
}

export interface CompetitorData {
  url: string;
  title: string;
  content: string;
  headings: string[];
  wordCount: number;
  keyTopics: string[];
  metaDescription?: string;
  structuredData?: Record<string, unknown>;
  lastUpdated?: string;
}

export interface ContentAnalysis {
  keyTopics: string[];
  contentGaps: string[];
  seoOpportunities: string[];
  structureRecommendations: string[];
  competitorStrengths: string[];
  targetKeywords: string[];
}

export interface BrandAnalysis {
  tone: string;
  keyMessages: string[];
  targetAudience: string;
  brandValues: string[];
  competitiveAdvantages: string[];
}

export interface ResearchSummary {
  topCompetitors: string[];
  keyInsights: string[];
  contentOpportunities: string[];
  recommendedApproach: string;
  targetKeywords: string[];
}

// Writing Context types
export interface WritingContext {
  blueprint: ContentBlueprint;
  previousSections: string[];
  currentSection: ContentSection;
  brandVoice: string;
  targetAudience: string;
  researchData: ResearchResponse;
  seoRequirements: SEORequirements;
}

export interface SEORequirements {
  targetKeywords: string[];
  focusKeyword: string;
  keywordDensity: number;
  readabilityTarget: number;
  includeSchema: boolean;
}

// Error handling types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp?: string;
  requestId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription?: UserSubscription;
  preferences?: UserPreferences;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  subscription_plan: SubscriptionPlan;
  tokens_used: number;
  tokens_limit: number;
  projects_used: number;
  projects_limit: number;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  plan: SubscriptionPlan;
  tokensUsed: number;
  tokensLimit: number;
  projectsUsed: number;
  projectsLimit: number;
  billingCycle?: 'monthly' | 'yearly';
  nextBillingDate?: string;
  isActive: boolean;
}

export interface UserPreferences {
  defaultTone: ContentTone;
  defaultFormat: ContentFormat;
  emailNotifications: boolean;
  autoSave: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Usage Analytics types
export interface UsageAnalytic {
  id: string;
  user_id: string;
  project_id?: string;
  operation_type: OperationType;
  tokens_used?: number;
  cost_usd?: number;
  api_provider: APIProvider;
  model_used: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsageReport {
  period: {
    start: string;
    end: string;
  };
  totalTokens: number;
  totalCost: number;
  operationBreakdown: Record<OperationType, {
    tokens: number;
    cost: number;
    count: number;
  }>;
  modelBreakdown: Record<string, {
    tokens: number;
    cost: number;
    count: number;
  }>;
}

// File Upload types
export interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
}

export interface UploadConfig {
  maxSize: number;
  allowedTypes: string[];
  bucket: string;
}

// Database types
export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>;
      };
      content_sections: {
        Row: {
          id: string;
          project_id: string;
          section_order: number;
          heading: string;
          goal?: string;
          sub_sections: SubSection[];
          content_elements: string[];
          data_sources: string[];
          generated_content?: string;
          status: 'pending' | 'writing' | 'completed';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['content_sections']['Row'], 'id' | 'created_at'>;
        Update: Partial<Omit<Database['public']['Tables']['content_sections']['Row'], 'id' | 'created_at'>>;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
      };
      usage_analytics: {
        Row: UsageAnalytic;
        Insert: Omit<UsageAnalytic, 'id' | 'created_at'>;
        Update: Partial<Omit<UsageAnalytic, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      can_create_project: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      increment_user_projects: {
        Args: { user_uuid: string };
        Returns: boolean;
      };
      get_project_with_sections: {
        Args: { project_uuid: string };
        Returns: any;
      };
      log_usage: {
        Args: {
          user_uuid: string;
          project_uuid: string | null;
          operation: string;
          tokens: number;
          cost: number;
          provider: string;
          model: string;
          metadata_json?: Record<string, any>;
        };
        Returns: string;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

// External Service Integration types
export interface OpenAIService {
  createThread(): Promise<string>;
  generateBlueprint(context: ResearchContext): Promise<ContentBlueprint>;
  writeSection(section: ContentSection, context: WritingContext): Promise<string>;
  polishContent(content: string, seoRequirements: SEORequirements): Promise<string>;
  estimateTokens(text: string): number;
  calculateCost(tokens: number, model: string): number;
}

export interface TavilyService {
  scrapeCompetitors(urls: string[]): Promise<CompetitorData[]>;
  analyzeContent(content: string): Promise<ContentAnalysis>;
  searchRelatedContent(query: string): Promise<CompetitorData[]>;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout?: number;
}

export interface TavilyConfig {
  apiKey: string;
  maxResults: number;
  includeContent: boolean;
  timeout?: number;
}

// Service Response types
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
  cost?: number;
  requestId?: string;
}

// Real-time types
export interface RealtimeEvent {
  type: 'project_update' | 'section_complete' | 'error' | 'progress';
  projectId: string;
  data: unknown;
  timestamp: string;
}

export interface ProjectUpdateEvent extends RealtimeEvent {
  type: 'project_update';
  data: {
    status: ProjectStatus;
    progress: number;
    currentSection?: string;
  };
}

export interface SectionCompleteEvent extends RealtimeEvent {
  type: 'section_complete';
  data: {
    sectionId: string;
    content: string;
    tokensUsed: number;
  };
}

export interface ProgressEvent extends RealtimeEvent {
  type: 'progress';
  data: {
    operation: OperationType;
    progress: number;
    message: string;
  };
}

// Component Props types
export interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onExport: (project: Project) => void;
}

export interface BlueprintSectionProps {
  section: ContentSection;
  onUpdate: (section: ContentSection) => void;
  onDelete: (sectionId: string) => void;
  onReorder: (sectionId: string, newOrder: number) => void;
}

export interface LiveWriterProps {
  projectId: string;
  blueprint: ContentBlueprint;
  onProgress: (progress: ProgressEvent) => void;
  onComplete: (content: string) => void;
  onError: (error: APIError) => void;
}

// Form types
export interface ProjectFormData {
  topic: string;
  competitorUrls: string[];
  tone: ContentTone;
  format: ContentFormat;
  brandDocument?: File;
}

export interface BlueprintFormData {
  sections: ContentSection[];
  seoMetadata: SEOMetadata;
  targetKeywords: string[];
}

// Additional API Response types
export interface ProjectListResponse {
  projects: ProjectResponse[];
  pagination: PaginationInfo;
}

export interface UsageReportResponse {
  report: UsageReport;
  summary: {
    totalProjects: number;
    averageCostPerProject: number;
    mostUsedModel: string;
    totalSavings: number;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'up' | 'down';
    openai: 'up' | 'down';
    tavily: 'up' | 'down';
    storage: 'up' | 'down';
  };
  timestamp: string;
}

// Query types
export interface ProjectQuery extends PaginationParams {
  status?: ProjectStatus;
  tone?: ContentTone;
  format?: ContentFormat;
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'topic';
  sortOrder?: 'asc' | 'desc';
}

export interface UsageQuery extends PaginationParams {
  operationType?: OperationType;
  apiProvider?: APIProvider;
  modelUsed?: string;
  startDate?: string;
  endDate?: string;
}