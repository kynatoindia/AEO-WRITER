import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, generateObject, streamObject, StreamTextResult, ToolSet } from 'ai';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import { z } from 'zod';

const openRouterProvider = createOpenAI({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'AEO Writer SaaS',
  },
});

// AI Provider configuration with cost optimization
export type AIProvider = 'openrouter';
export type AIModel = string;
export type AIUseCase = 'research' | 'blueprint' | 'content' | 'polish' | 'structured';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
  costPerToken?: number; // Cost per 1K tokens in USD
  priority?: number; // Lower number = higher priority
  enabled?: boolean; // Provider availability toggle
}

function parseModelList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
}

const OPENROUTER_MODEL_CANDIDATES: AIModel[] = Array.from(new Set([
  ...parseModelList(process.env.OPENROUTER_MODEL),
  ...parseModelList(process.env.OPENROUTER_FALLBACK_MODELS),
  'openrouter/auto',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.1-8b-instruct',
]));

const OPENROUTER_MODELS_ENABLED = !!process.env.OPENROUTER_API_KEY;

// Main AI model configuration (OpenRouter, ordered by priority)
export const AI_MODELS: Record<AIModel, AIConfig> = Object.fromEntries(
  OPENROUTER_MODEL_CANDIDATES.map((model, index) => [
    model,
    {
      provider: 'openrouter' as const,
      model,
      maxTokens: 8000,
      temperature: 0.7,
      costPerToken: 0.00005,
      priority: index + 1,
      enabled: OPENROUTER_MODELS_ENABLED,
    },
  ])
) as Record<AIModel, AIConfig>;

// Use case specific model selection
export const USE_CASE_MODELS: Record<AIUseCase, AIModel[]> = {
  research: [...OPENROUTER_MODEL_CANDIDATES],
  blueprint: [...OPENROUTER_MODEL_CANDIDATES],
  content: [...OPENROUTER_MODEL_CANDIDATES],
  polish: [...OPENROUTER_MODEL_CANDIDATES],
  structured: [...OPENROUTER_MODEL_CANDIDATES],
};

interface GatewayErrorLike {
  statusCode?: number;
  message?: string;
  responseBody?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Unknown error';
}

function isRateLimitError(error: unknown): boolean {
  const candidate = error as GatewayErrorLike;
  const errorText = `${candidate?.message || ''} ${candidate?.responseBody || ''}`.toLowerCase();
  return candidate?.statusCode === 429 || errorText.includes('rate limit') || errorText.includes('quota');
}

function isModelUnavailableError(error: unknown): boolean {
  const candidate = error as GatewayErrorLike;
  const errorText = `${candidate?.message || ''} ${candidate?.responseBody || ''}`.toLowerCase();

  return (
    candidate?.statusCode === 404 ||
    errorText.includes('no endpoints found') ||
    errorText.includes('model not found') ||
    errorText.includes('unsupported model') ||
    errorText.includes('no such model')
  );
}

function getEnabledProviders(): AIProvider[] {
  return Object.values(AI_MODELS)
    .filter(config => config.enabled)
    .map(config => config.provider)
    .filter((provider, index, arr) => arr.indexOf(provider) === index);
}

// Provider health tracking with enhanced metrics
interface ProviderHealth {
  healthy: boolean;
  lastCheck: number;
  errorCount: number;
  avgResponseTime: number;
  successRate: number;
  totalRequests: number;
  lastError?: string;
  rateLimitHit?: boolean;
  rateLimitResetTime?: number;
}

// Token usage tracking interface
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: AIModel;
  timestamp: number;
  operation: string;
  userId?: string;
}

// Streaming response wrapper
interface StreamingResponse {
  stream: StreamTextResult<ToolSet, never>;
  model: AIModel;
  provider: AIProvider;
  onFinish?: (usage: TokenUsage) => void;
  onError?: (error: Error) => void;
}

class AIProviderManager {
  private providerHealth: Map<AIProvider, ProviderHealth> = new Map();
  private readonly healthCheckInterval = 60000; // 1 minute
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  
  constructor() {
    // Initialize provider health with enhanced metrics
    this.providerHealth.set('openrouter', {
      healthy: !!process.env.OPENROUTER_API_KEY,
      lastCheck: Date.now(),
      errorCount: 0,
      avgResponseTime: 0,
      successRate: 1.0,
      totalRequests: 0,
    });
    
    // Start health monitoring
    this.startHealthMonitoring();
  }
  
  private async startHealthMonitoring() {
    setInterval(async () => {
      await this.checkProviderHealth();
    }, this.healthCheckInterval);
  }
  
  private async checkProviderHealth() {
    for (const [provider, health] of this.providerHealth.entries()) {
      const enabledModels = this.getEnabledModelsForProvider(provider);

      if (enabledModels.length === 0) {
        continue;
      }

      // Simple health check with minimal cost
      const testPrompt = "Respond with 'OK'";
      let healthCheckPassed = false;
      let responseTime = 0;
      let lastError: unknown;

      for (const [model, config] of enabledModels) {
        try {
          const start = Date.now();
          await this.generateWithProvider(testPrompt, config);
          responseTime = Date.now() - start;
          healthCheckPassed = true;
          break;
        } catch (error) {
          lastError = error;

          if (isModelUnavailableError(error)) {
            this.disableModel(model, getErrorMessage(error));
            continue;
          }

          if (isRateLimitError(error)) {
            break;
          }
        }
      }

      if (healthCheckPassed) {
        const newTotalRequests = health.totalRequests + 1;
        const newSuccessRate = (health.successRate * health.totalRequests + 1) / newTotalRequests;

        // Update health status with success
        this.providerHealth.set(provider, {
          healthy: true,
          lastCheck: Date.now(),
          errorCount: Math.max(0, health.errorCount - 1), // Gradually reduce error count
          avgResponseTime: (health.avgResponseTime + responseTime) / 2,
          successRate: newSuccessRate,
          totalRequests: newTotalRequests,
          rateLimitHit: false,
        });

        // Cache health status
        await redis.setex(
          CACHE_KEYS.AI_PROVIDER_STATUS(provider),
          CACHE_TTL.AI_PROVIDER_STATUS,
          {
            healthy: true,
            responseTime,
            successRate: newSuccessRate,
            lastCheck: Date.now()
          }
        );
        continue;
      }

      const isRateLimit = isRateLimitError(lastError);
      const newTotalRequests = health.totalRequests + 1;
      const newSuccessRate = (health.successRate * health.totalRequests) / newTotalRequests;

      const updatedHealth: ProviderHealth = {
        healthy: health.errorCount < 2, // Mark unhealthy after 3 consecutive errors
        lastCheck: Date.now(),
        errorCount: health.errorCount + 1,
        avgResponseTime: health.avgResponseTime,
        successRate: newSuccessRate,
        totalRequests: newTotalRequests,
        lastError: getErrorMessage(lastError),
        rateLimitHit: isRateLimit,
        rateLimitResetTime: isRateLimit ? Date.now() + 60000 : undefined, // 1 minute reset
      };

      this.providerHealth.set(provider, updatedHealth);

      // Cache unhealthy status
      await redis.setex(
        CACHE_KEYS.AI_PROVIDER_STATUS(provider),
        CACHE_TTL.AI_PROVIDER_STATUS,
        {
          healthy: false,
          error: updatedHealth.lastError,
          rateLimitHit: isRateLimit,
          lastCheck: Date.now()
        }
      );
    }
  }
  
  getHealthyProviders(): AIProvider[] {
    return Array.from(this.providerHealth.entries())
      .filter(([_, health]) => {
        // Check if rate limit has expired
        if (health.rateLimitHit && health.rateLimitResetTime) {
          if (Date.now() > health.rateLimitResetTime) {
            health.rateLimitHit = false;
            health.rateLimitResetTime = undefined;
          }
        }
        
        return health.healthy && !health.rateLimitHit;
      })
      .map(([provider]) => provider);
  }

  private getEnabledModelsForProvider(provider: AIProvider): Array<[AIModel, AIConfig]> {
    return Object.entries(AI_MODELS)
      .filter(([_, config]) => config.provider === provider && config.enabled)
      .sort(([_, a], [__, b]) => (a.priority || 999) - (b.priority || 999)) as Array<[AIModel, AIConfig]>;
  }

  private getProvidersForModelSelection(): AIProvider[] {
    const healthyProviders = this.getHealthyProviders();
    if (healthyProviders.length > 0) {
      return healthyProviders;
    }

    return getEnabledProviders();
  }

  disableModel(model: AIModel, reason: string): void {
    const currentConfig = AI_MODELS[model];
    if (!currentConfig?.enabled) {
      return;
    }

    currentConfig.enabled = false;
    console.warn(`[AI Gateway] Disabled model "${model}" due to permanent API error: ${reason}`);
  }
  
  getBestModel(useCase: AIUseCase): AIModel {
    const candidateProviders = this.getProvidersForModelSelection();
    const availableModels = USE_CASE_MODELS[useCase].filter(model =>
      AI_MODELS[model]?.enabled && candidateProviders.includes(AI_MODELS[model].provider)
    );
    
    if (availableModels.length === 0) {
      // Fallback to any available enabled model
      const fallbackModel = Object.entries(AI_MODELS).find(([_, config]) =>
        candidateProviders.includes(config.provider) && config.enabled
      );
      
      if (!fallbackModel) {
        throw new Error('No enabled AI providers available');
      }
      
      return fallbackModel[0] as AIModel;
    }
    
    // Sort by priority (lower number = higher priority) and success rate
    return availableModels.sort((a, b) => {
      const configA = AI_MODELS[a as AIModel];
      const configB = AI_MODELS[b as AIModel];
      const healthA = this.providerHealth.get(configA.provider);
      const healthB = this.providerHealth.get(configB.provider);
      
      // Primary sort by priority
      const priorityDiff = configA.priority! - configB.priority!;
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by success rate
      return (healthB?.successRate || 0) - (healthA?.successRate || 0);
    })[0] as AIModel;
  }
  
  async recordUsage(provider: AIProvider, success: boolean, responseTime: number) {
    const health = this.providerHealth.get(provider);
    if (!health) return;
    
    const newTotalRequests = health.totalRequests + 1;
    const newSuccessRate = success 
      ? (health.successRate * health.totalRequests + 1) / newTotalRequests
      : (health.successRate * health.totalRequests) / newTotalRequests;
    
    this.providerHealth.set(provider, {
      ...health,
      totalRequests: newTotalRequests,
      successRate: newSuccessRate,
      avgResponseTime: (health.avgResponseTime + responseTime) / 2,
      errorCount: success ? Math.max(0, health.errorCount - 1) : health.errorCount + 1,
    });
  }
  
  getProviderStats(): Record<AIProvider, ProviderHealth> {
    return Object.fromEntries(this.providerHealth.entries()) as Record<AIProvider, ProviderHealth>;
  }
  
  private async generateWithProvider(prompt: string, config: AIConfig): Promise<string> {
    const model = this.getModel(config);
    
    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: config.maxTokens,
      temperature: config.temperature,
    });
    
    return result.text;
  }
  
  private getModel(config: AIConfig) {
    switch (config.provider) {
      case 'openrouter':
        return openRouterProvider(config.model);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
}

// Global provider manager instance
const providerManager = new AIProviderManager();

function getProvidersForRequest(): AIProvider[] {
  const healthyProviders = providerManager.getHealthyProviders();
  if (healthyProviders.length > 0) {
    return healthyProviders;
  }

  return getEnabledProviders();
}

// Enhanced cost tracking with detailed analytics
export async function trackAICost(
  userId: string,
  model: AIModel,
  inputTokens: number,
  outputTokens: number,
  operation: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const config = AI_MODELS[model];
    const totalTokens = inputTokens + outputTokens;
    
    // Calculate cost (different rates for input/output tokens in some models)
    const inputCost = (inputTokens / 1000) * config.costPerToken!;
    const outputCost = (outputTokens / 1000) * config.costPerToken! * 1.5; // Output typically costs more
    const totalCost = inputCost + outputCost;
    
    const costData: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      cost: totalCost,
      model,
      timestamp: Date.now(),
      operation,
      userId,
    };
    
    // Track daily costs with detailed breakdown
    const today = new Date().toISOString().split('T')[0];
    const dailyCostKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:${today}`;
    
    await redis.lpush(dailyCostKey, JSON.stringify({ ...costData, metadata }));
    await redis.expire(dailyCostKey, CACHE_TTL.AI_COST_TRACKING);
    
    // Track monthly totals by model
    const monthKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:monthly`;
    await redis.hincrbyfloat(monthKey, model, totalCost);
    await redis.hincrbyfloat(monthKey, `${model}_tokens`, totalTokens);
    await redis.expire(monthKey, 30 * 24 * 3600); // 30 days
    
    // Track operation-specific costs
    const operationKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:operation:${operation}`;
    await redis.hincrbyfloat(operationKey, 'cost', totalCost);
    await redis.hincrbyfloat(operationKey, 'tokens', totalTokens);
    await redis.hincrby(operationKey, 'requests', 1);
    await redis.expire(operationKey, 7 * 24 * 3600); // 7 days
    
    // Global usage tracking for system monitoring
    const globalKey = 'system:ai_usage:' + today;
    await redis.hincrbyfloat(globalKey, model, totalCost);
    await redis.expire(globalKey, 30 * 24 * 3600);
    
  } catch (error) {
    console.error('Cost tracking error:', error);
  }
}

// Enhanced text generation with comprehensive error handling and retries
export async function generateAIText(
  prompt: string,
  useCase: AIUseCase = 'content',
  userId?: string,
  options?: Partial<AIConfig>
): Promise<{ text: string; model: AIModel; inputTokens: number; outputTokens: number; cost: number }> {
  const bestModel = providerManager.getBestModel(useCase);
  
  // Check cache first for expensive operations
  if (useCase === 'research' || useCase === 'blueprint') {
    const cacheKey = CACHE_KEYS.CONTENT_CACHE(
      Buffer.from(prompt + bestModel + JSON.stringify(options || {})).toString('base64').slice(0, 32)
    );
    
    const cached = await redis.get<{
      text: string;
      model: AIModel;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
  }
  
  const errors: Error[] = [];
  const providersToTry = getProvidersForRequest();

  if (providersToTry.length === 0) {
    throw new Error('No enabled AI providers available');
  }
  
  // Try providers in order of preference with retry logic
  for (const provider of providersToTry) {
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, modelConfig]) => modelConfig.provider === provider && modelConfig.enabled)
      .sort(([_, a], [__, b]) => a.priority! - b.priority!)
      .map(([model]) => model as AIModel);
    
    for (const model of availableModels) {
      let retryCount = 0;
      
      while (retryCount < providerManager['maxRetries']) {
        const start = Date.now(); // Move start declaration outside try block
        try {
          const modelConfig = { ...AI_MODELS[model], ...options };
          const modelInstance = providerManager['getModel'](modelConfig);
          
          const result = await generateText({
            model: modelInstance,
            prompt,
            maxOutputTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
          });
          
          const responseTime = Date.now() - start;
          const inputTokens = result.usage?.inputTokens || 0;
          const outputTokens = result.usage?.outputTokens || 0;
          const totalTokens = result.usage?.totalTokens || inputTokens + outputTokens;
          
          // Calculate cost with input/output differentiation
          const inputCost = (inputTokens / 1000) * modelConfig.costPerToken!;
          const outputCost = (outputTokens / 1000) * modelConfig.costPerToken! * 1.5;
          const cost = inputCost + outputCost;
          
          const response = {
            text: result.text,
            model,
            inputTokens,
            outputTokens,
            cost,
          };
          
          // Record successful usage
          await providerManager.recordUsage(provider, true, responseTime);
          
          // Track costs if user provided
          if (userId) {
            await trackAICost(userId, model, inputTokens, outputTokens, useCase, {
              responseTime,
              retryCount,
              cacheHit: false,
            });
          }
          
          // Cache expensive operations
          if (useCase === 'research' || useCase === 'blueprint') {
            const cacheKey = CACHE_KEYS.CONTENT_CACHE(
              Buffer.from(prompt + model + JSON.stringify(options || {})).toString('base64').slice(0, 32)
            );
            await redis.setex(cacheKey, CACHE_TTL.CONTENT_CACHE, response);
          }
          
          return response;
          
        } catch (error) {
          const responseTime = Date.now() - start;
          await providerManager.recordUsage(provider, false, responseTime);
          const errorMessage = getErrorMessage(error);
          
          console.error(`AI provider ${provider} model ${model} attempt ${retryCount + 1} failed:`, error);
          errors.push(error instanceof Error ? error : new Error(errorMessage));
          
          // Permanent model mismatch -> disable and move to next model
          if (isModelUnavailableError(error)) {
            providerManager.disableModel(model, errorMessage);
            break;
          }
          
          // Check if it's a rate limit error
          if (isRateLimitError(error)) {
            break; // Don't retry rate limit errors, try next provider
          }
          
          retryCount++;
          
          // Exponential backoff
          if (retryCount < providerManager['maxRetries']) {
            await new Promise(resolve => 
              setTimeout(resolve, providerManager['retryDelay'] * Math.pow(2, retryCount))
            );
          }
        }
      }
    }
  }
  
  throw new Error(
    `All AI providers failed after retries. Errors: ${errors.map(e => e.message).join(', ')}`
  );
}

// Enhanced streaming with comprehensive error handling and token tracking
export async function streamAIText(
  prompt: string,
  useCase: AIUseCase = 'content',
  userId?: string,
  options?: Partial<AIConfig>
): Promise<StreamingResponse> {
  const errors: Error[] = [];
  const providersToTry = getProvidersForRequest();

  if (providersToTry.length === 0) {
    throw new Error('No enabled AI providers available');
  }
  
  for (const provider of providersToTry) {
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, modelConfig]) => modelConfig.provider === provider && modelConfig.enabled)
      .sort(([_, a], [__, b]) => a.priority! - b.priority!)
      .map(([model]) => model as AIModel);
    
    for (const model of availableModels) {
      let retryCount = 0;
      
      while (retryCount < providerManager['maxRetries']) {
        const start = Date.now();
        try {
          const modelConfig = { ...AI_MODELS[model], ...options };
          const modelInstance = providerManager['getModel'](modelConfig);
          
          const stream = await streamText({
            model: modelInstance,
            prompt,
            maxOutputTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
          });
          
          // Create enhanced streaming response with tracking
          const streamingResponse: StreamingResponse = {
            stream,
            model,
            provider,
            onFinish: async (usage: TokenUsage) => {
              const responseTime = Date.now() - start;
              await providerManager.recordUsage(provider, true, responseTime);
              
              if (userId) {
                await trackAICost(
                  userId, 
                  model, 
                  usage.inputTokens, 
                  usage.outputTokens, 
                  useCase,
                  { responseTime, streaming: true, retryCount }
                );
              }
            },
            onError: async (error: Error) => {
              const responseTime = Date.now() - start;
              await providerManager.recordUsage(provider, false, responseTime);
              console.error(`Streaming error for ${provider}/${model}:`, error);
            }
          };
          
          // Wrap the stream to handle usage tracking
          const originalStream = stream;
          const enhancedStream = {
            ...originalStream,
            usage: Promise.resolve(originalStream.usage).then(async (usage) => {
              if (usage && streamingResponse.onFinish) {
                await streamingResponse.onFinish({
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                  cost: 0, // Will be calculated in onFinish
                  model,
                  timestamp: Date.now(),
                  operation: useCase,
                  userId,
                });
              }
              return usage;
            }).catch(async (error) => {
              if (streamingResponse.onError) {
                await streamingResponse.onError(error);
              }
              throw error;
            })
          };
          
          return {
            ...streamingResponse,
            stream: enhancedStream as unknown as StreamTextResult<ToolSet, never>
          };
          
        } catch (error) {
          const responseTime = Date.now() - start;
          await providerManager.recordUsage(provider, false, responseTime);
          const errorMessage = getErrorMessage(error);
          
          console.error(`AI provider ${provider} model ${model} streaming attempt ${retryCount + 1} failed:`, error);
          errors.push(error instanceof Error ? error : new Error(errorMessage));

          if (isModelUnavailableError(error)) {
            providerManager.disableModel(model, errorMessage);
            break;
          }
          
          // Check if it's a rate limit error
          if (isRateLimitError(error)) {
            break; // Don't retry rate limit errors, try next provider
          }
          
          retryCount++;
          
          // Exponential backoff
          if (retryCount < providerManager['maxRetries']) {
            await new Promise(resolve => 
              setTimeout(resolve, providerManager['retryDelay'] * Math.pow(2, retryCount))
            );
          }
        }
      }
    }
  }
  
  throw new Error(
    `All AI providers failed for streaming. Errors: ${errors.map(e => e.message).join(', ')}`
  );
}

// Structured output generation with schema validation
export async function generateStructuredOutput<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  useCase: AIUseCase = 'structured',
  userId?: string,
  options?: Partial<AIConfig>
): Promise<{ object: T; model: AIModel; inputTokens: number; outputTokens: number; cost: number }> {
  const errors: Error[] = [];
  const providersToTry = getProvidersForRequest();
  
  const preferredProviders = [...providersToTry];

  if (preferredProviders.length === 0) {
    throw new Error('No enabled AI providers available');
  }
  
  for (const provider of preferredProviders) {
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, modelConfig]) => modelConfig.provider === provider && modelConfig.enabled)
      .sort(([_, a], [__, b]) => a.priority! - b.priority!)
      .map(([model]) => model as AIModel);
    
    for (const model of availableModels) {
      let retryCount = 0;
      
      while (retryCount < providerManager['maxRetries']) {
        const start = Date.now();
        try {
          const modelConfig = { ...AI_MODELS[model], ...options };
          const modelInstance = providerManager['getModel'](modelConfig);
          
          const result = await generateObject({
            model: modelInstance,
            prompt,
            schema,
            maxOutputTokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
          });
          
          const responseTime = Date.now() - start;
          const inputTokens = result.usage?.inputTokens || 0;
          const outputTokens = result.usage?.outputTokens || 0;
          
          // Calculate cost
          const inputCost = (inputTokens / 1000) * modelConfig.costPerToken!;
          const outputCost = (outputTokens / 1000) * modelConfig.costPerToken! * 1.5;
          const cost = inputCost + outputCost;
          
          const response = {
            object: result.object,
            model,
            inputTokens,
            outputTokens,
            cost,
          };
          
          // Record successful usage
          await providerManager.recordUsage(provider, true, responseTime);
          
          // Track costs if user provided
          if (userId) {
            await trackAICost(userId, model, inputTokens, outputTokens, useCase, {
              responseTime,
              retryCount,
              structured: true,
            });
          }
          
          return response;
          
        } catch (error) {
          const responseTime = Date.now() - start;
          await providerManager.recordUsage(provider, false, responseTime);
          const errorMessage = getErrorMessage(error);
          
          console.error(`Structured output ${provider} model ${model} attempt ${retryCount + 1} failed:`, error);
          errors.push(error instanceof Error ? error : new Error(errorMessage));

          if (isModelUnavailableError(error)) {
            providerManager.disableModel(model, errorMessage);
            break;
          }
          
          // Check if it's a rate limit error
          if (isRateLimitError(error)) {
            break;
          }
          
          retryCount++;
          
          if (retryCount < providerManager['maxRetries']) {
            await new Promise(resolve => 
              setTimeout(resolve, providerManager['retryDelay'] * Math.pow(2, retryCount))
            );
          }
        }
      }
    }
  }
  
  throw new Error(
    `All AI providers failed for structured output. Errors: ${errors.map(e => e.message).join(', ')}`
  );
}

// Streaming structured output (for supported providers)
export async function streamStructuredOutput<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  useCase: AIUseCase = 'structured',
  userId?: string,
  options?: Partial<AIConfig>
) {
  const errors: Error[] = [];
  const providersToTry = getProvidersForRequest();
  
  const openrouterProviders = providersToTry.filter(p => p === 'openrouter');

  if (openrouterProviders.length === 0) {
    throw new Error('No enabled AI providers available for streaming structured output');
  }
  
  for (const provider of openrouterProviders) {
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, modelConfig]) => modelConfig.provider === provider && modelConfig.enabled)
      .sort(([_, a], [__, b]) => a.priority! - b.priority!)
      .map(([model]) => model as AIModel);
    
    for (const model of availableModels) {
      try {
        const modelConfig = { ...AI_MODELS[model], ...options };
        const modelInstance = providerManager['getModel'](modelConfig);
        
        const start = Date.now();
        const stream = await streamObject({
          model: modelInstance,
          prompt,
          schema,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
        });
        
        // Track usage after streaming completes
        if (userId) {
          stream.usage.then(async (usage) => {
            if (usage) {
              const responseTime = Date.now() - start;
              await providerManager.recordUsage(provider, true, responseTime);
              
              await trackAICost(
                userId, 
                model, 
                usage.inputTokens || 0, 
                usage.outputTokens || 0, 
                useCase,
                { responseTime, streaming: true, structured: true }
              );
            }
          }).catch(async (error) => {
            const responseTime = Date.now() - start;
            await providerManager.recordUsage(provider, false, responseTime);
            console.error(`Streaming structured output error:`, error);
          });
        }
        
        return stream;
        
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error(`Streaming structured output ${provider} model ${model} failed:`, error);
        errors.push(error instanceof Error ? error : new Error(errorMessage));

        if (isModelUnavailableError(error)) {
          providerManager.disableModel(model, errorMessage);
        }
        continue;
      }
    }
  }
  
  throw new Error(
    `Streaming structured output not available. Errors: ${errors.map(e => e.message).join(', ')}`
  );
}
// Enhanced user AI usage statistics with detailed analytics
export async function getUserAIUsage(userId: string): Promise<{
  dailyCosts: Record<string, number>;
  monthlyCosts: Record<AIModel, number>;
  monthlyTokens: Record<AIModel, number>;
  operationBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
  totalTokensUsed: number;
  totalCost: number;
  averageCostPerRequest: number;
  mostUsedModel: AIModel | null;
  costTrend: Array<{ date: string; cost: number }>;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyCostKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:${today}`;
    const monthlyKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:monthly`;
    
    // Get daily data for the last 30 days
    const dailyPromises: Promise<any>[] = [];
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
      dailyPromises.push(
        redis.lrange(`${CACHE_KEYS.AI_COST_TRACKING(userId)}:${dateStr}`, 0, -1)
      );
    }
    
    const [monthlyData, ...dailyDataArrays] = await Promise.all([
      redis.hgetall(monthlyKey),
      ...dailyPromises
    ]);
    
    const dailyCosts: Record<string, number> = {};
    const operationBreakdown: Record<string, { cost: number; tokens: number; requests: number }> = {};
    const modelUsage: Record<AIModel, number> = {} as Record<AIModel, number>;
    let totalTokensUsed = 0;
    let totalRequests = 0;
    
    // Process daily data
    dailyDataArrays.forEach((dailyData, index) => {
      const date = dates[index];
      let dayCost = 0;
      
      for (const item of dailyData) {
        try {
          const parsed: TokenUsage = JSON.parse(item);
          dayCost += parsed.cost;
          totalTokensUsed += parsed.totalTokens;
          totalRequests++;
          
          // Track model usage
          modelUsage[parsed.model] = (modelUsage[parsed.model] || 0) + 1;
          
          // Track operation breakdown
          if (!operationBreakdown[parsed.operation]) {
            operationBreakdown[parsed.operation] = { cost: 0, tokens: 0, requests: 0 };
          }
          operationBreakdown[parsed.operation].cost += parsed.cost;
          operationBreakdown[parsed.operation].tokens += parsed.totalTokens;
          operationBreakdown[parsed.operation].requests += 1;
          
        } catch (e) {
          console.error('Error parsing daily cost data:', e);
        }
      }
      
      if (dayCost > 0) {
        dailyCosts[date] = dayCost;
      }
    });
    
    // Process monthly data
    const monthlyCosts: Record<AIModel, number> = {};
    const monthlyTokens: Record<AIModel, number> = {};
    let totalCost = 0;
    
    for (const [key, value] of Object.entries(monthlyData ?? {})) {
      if (key.endsWith('_tokens')) {
        const model = key.replace('_tokens', '') as AIModel;
        monthlyTokens[model] = Number(value);
      } else {
        const model = key as AIModel;
        monthlyCosts[model] = Number(value);
        totalCost += Number(value);
      }
    }
    
    // Calculate trends and insights
    const costTrend = Object.entries(dailyCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date, cost }));
    
    const mostUsedModel = Object.entries(modelUsage).length > 0
      ? (Object.entries(modelUsage).sort(([,a], [,b]) => b - a)[0][0] as AIModel)
      : null;
    
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;
    
    return {
      dailyCosts,
      monthlyCosts,
      monthlyTokens,
      operationBreakdown,
      totalTokensUsed,
      totalCost,
      averageCostPerRequest,
      mostUsedModel,
      costTrend,
    };
  } catch (error) {
    console.error('Error getting user AI usage:', error);
    return {
      dailyCosts: {},
      monthlyCosts: {} as Record<AIModel, number>,
      monthlyTokens: {} as Record<AIModel, number>,
      operationBreakdown: {},
      totalTokensUsed: 0,
      totalCost: 0,
      averageCostPerRequest: 0,
      mostUsedModel: null,
      costTrend: [],
    };
  }
}

// Get system-wide AI usage statistics (for admin dashboard)
export async function getSystemAIUsage(): Promise<{
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  providerStats: Record<AIProvider, ProviderHealth>;
  modelDistribution: Record<AIModel, number>;
  dailyUsage: Array<{ date: string; cost: number; requests: number }>;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const providerStats = providerManager.getProviderStats();
    
    // Get last 7 days of system usage
    const dailyPromises: Promise<any>[] = [];
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
      dailyPromises.push(
        redis.hgetall(`system:ai_usage:${dateStr}`)
      );
    }
    
    const dailyDataArrays = await Promise.all(dailyPromises);
    
    let totalCost = 0;
    let totalRequests = 0;
    const modelDistribution: Record<AIModel, number> = {} as Record<AIModel, number>;
    const dailyUsage: Array<{ date: string; cost: number; requests: number }> = [];
    
    dailyDataArrays.forEach((dailyData, index) => {
      const date = dates[index];
      let dayCost = 0;
      let dayRequests = 0;
      
      for (const [model, cost] of Object.entries(dailyData ?? {})) {
        const modelCost = Number(cost);
        dayCost += modelCost;
        totalCost += modelCost;
        dayRequests++;
        totalRequests++;
        
        modelDistribution[model as AIModel] = (modelDistribution[model as AIModel] || 0) + 1;
      }
      
      dailyUsage.push({ date, cost: dayCost, requests: dayRequests });
    });
    
    return {
      totalCost,
      totalTokens: 0, // Would need to track separately
      totalRequests,
      providerStats,
      modelDistribution,
      dailyUsage: dailyUsage.reverse(), // Most recent first
    };
  } catch (error) {
    console.error('Error getting system AI usage:', error);
    return {
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      providerStats: {} as Record<AIProvider, ProviderHealth>,
      modelDistribution: {} as Record<AIModel, number>,
      dailyUsage: [],
    };
  }
}

// Provider configuration utilities
export function getAvailableProviders(): AIProvider[] {
  return Object.values(AI_MODELS)
    .filter(config => config.enabled)
    .map(config => config.provider)
    .filter((provider, index, arr) => arr.indexOf(provider) === index);
}

export function getAvailableModels(provider?: AIProvider): AIModel[] {
  return Object.entries(AI_MODELS)
    .filter(([_, config]) => config.enabled && (!provider || config.provider === provider))
    .map(([model]) => model as AIModel);
}

export function getModelConfig(model: AIModel): AIConfig {
  return AI_MODELS[model];
}

export function estimateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
  const config = AI_MODELS[model];
  const inputCost = (inputTokens / 1000) * config.costPerToken!;
  const outputCost = (outputTokens / 1000) * config.costPerToken! * 1.5;
  return inputCost + outputCost;
}

// Provider health check endpoint
export async function checkProviderHealth(provider?: AIProvider): Promise<Record<AIProvider, ProviderHealth>> {
  if (provider) {
    const health = providerManager.getProviderStats()[provider];
    return { [provider]: health };
  }
  return providerManager.getProviderStats();
}

// Emergency provider override (for maintenance)
export function setProviderEnabled(provider: AIProvider, enabled: boolean): void {
  Object.entries(AI_MODELS).forEach(([model, config]) => {
    if (config.provider === provider) {
      AI_MODELS[model as AIModel].enabled = enabled;
    }
  });
}

// Export provider manager for health checks and monitoring
export { providerManager };
