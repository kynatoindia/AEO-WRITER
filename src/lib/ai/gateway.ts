import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

// AI Provider configuration with cost optimization
export type AIProvider = 'openai' | 'google';
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

export interface AIConfig {
  provider: AIProvider;
  model: AIModel;
  maxTokens?: number;
  temperature?: number;
  costPerToken?: number; // Cost per 1K tokens in USD
  priority?: number; // Lower number = higher priority
}

// Model configurations with cost optimization
export const AI_MODELS: Record<AIModel, AIConfig> = {
  // OpenAI models
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.7,
    costPerToken: 0.015, // $15 per 1M tokens
    priority: 2,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.7,
    costPerToken: 0.00015, // $0.15 per 1M tokens
    priority: 1, // Preferred for cost efficiency
  },
  
  // Google models
  'gemini-1.5-pro': {
    provider: 'google',
    model: 'gemini-1.5-pro',
    maxTokens: 4000,
    temperature: 0.7,
    costPerToken: 0.0035, // $3.50 per 1M tokens
    priority: 3,
  },
  'gemini-1.5-flash': {
    provider: 'google',
    model: 'gemini-1.5-flash',
    maxTokens: 2000,
    temperature: 0.7,
    costPerToken: 0.00035, // $0.35 per 1M tokens
    priority: 1, // Very cost effective
  },
};

// Use case specific model selection
export const USE_CASE_MODELS = {
  research: ['gpt-4o', 'gemini-1.5-pro'], // High quality for research
  blueprint: ['gpt-4o', 'gemini-1.5-pro'], // High quality for strategy
  content: ['gpt-4o-mini', 'gemini-1.5-flash'], // Cost effective for content
  polish: ['gpt-4o-mini', 'gemini-1.5-flash'], // Cost effective for polishing
} as const;

// Provider health tracking
interface ProviderHealth {
  healthy: boolean;
  lastCheck: number;
  errorCount: number;
  avgResponseTime: number;
  lastError?: string;
}

class AIProviderManager {
  private providerHealth: Map<AIProvider, ProviderHealth> = new Map();
  private readonly healthCheckInterval = 60000; // 1 minute
  
  constructor() {
    // Initialize provider health
    this.providerHealth.set('openai', {
      healthy: true,
      lastCheck: Date.now(),
      errorCount: 0,
      avgResponseTime: 0,
    });
    
    this.providerHealth.set('google', {
      healthy: true,
      lastCheck: Date.now(),
      errorCount: 0,
      avgResponseTime: 0,
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
      try {
        const start = Date.now();
        
        // Simple health check with minimal cost
        const testPrompt = "Say 'OK'";
        const config = provider === 'openai' 
          ? AI_MODELS['gpt-4o-mini'] 
          : AI_MODELS['gemini-1.5-flash'];
        
        await this.generateWithProvider(testPrompt, config);
        
        const responseTime = Date.now() - start;
        
        // Update health status
        this.providerHealth.set(provider, {
          healthy: true,
          lastCheck: Date.now(),
          errorCount: Math.max(0, health.errorCount - 1), // Gradually reduce error count
          avgResponseTime: (health.avgResponseTime + responseTime) / 2,
        });
        
        // Cache health status
        await redis.setex(
          CACHE_KEYS.AI_PROVIDER_STATUS(provider),
          CACHE_TTL.AI_PROVIDER_STATUS,
          { healthy: true, responseTime, lastCheck: Date.now() }
        );
        
      } catch (error) {
        const updatedHealth = {
          healthy: health.errorCount < 3, // Mark unhealthy after 3 consecutive errors
          lastCheck: Date.now(),
          errorCount: health.errorCount + 1,
          avgResponseTime: health.avgResponseTime,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        };
        
        this.providerHealth.set(provider, updatedHealth);
        
        // Cache unhealthy status
        await redis.setex(
          CACHE_KEYS.AI_PROVIDER_STATUS(provider),
          CACHE_TTL.AI_PROVIDER_STATUS,
          { healthy: false, error: updatedHealth.lastError, lastCheck: Date.now() }
        );
      }
    }
  }
  
  getHealthyProviders(): AIProvider[] {
    return Array.from(this.providerHealth.entries())
      .filter(([_, health]) => health.healthy)
      .map(([provider]) => provider);
  }
  
  getBestModel(useCase: keyof typeof USE_CASE_MODELS): AIModel {
    const healthyProviders = this.getHealthyProviders();
    const availableModels = USE_CASE_MODELS[useCase].filter(model => 
      healthyProviders.includes(AI_MODELS[model].provider)
    );
    
    if (availableModels.length === 0) {
      // Fallback to any available model
      return Object.keys(AI_MODELS).find(model => 
        healthyProviders.includes(AI_MODELS[model as AIModel].provider)
      ) as AIModel || 'gpt-4o-mini';
    }
    
    // Sort by priority (lower number = higher priority)
    return availableModels.sort((a, b) => 
      AI_MODELS[a as AIModel].priority! - AI_MODELS[b as AIModel].priority!
    )[0] as AIModel;
  }
  
  private async generateWithProvider(prompt: string, config: AIConfig): Promise<string> {
    const model = this.getModel(config);
    
    const result = await generateText({
      model,
      prompt,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });
    
    return result.text;
  }
  
  private getModel(config: AIConfig) {
    switch (config.provider) {
      case 'openai':
        return openai(config.model);
      case 'google':
        return google(config.model);
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
}

// Global provider manager instance
const providerManager = new AIProviderManager();

// Cost tracking utilities
export async function trackAICost(
  userId: string,
  model: AIModel,
  tokensUsed: number,
  operation: string
): Promise<void> {
  try {
    const config = AI_MODELS[model];
    const cost = (tokensUsed / 1000) * config.costPerToken!;
    
    const costData = {
      model,
      tokensUsed,
      cost,
      operation,
      timestamp: Date.now(),
    };
    
    // Track daily costs
    const today = new Date().toISOString().split('T')[0];
    const dailyCostKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:${today}`;
    
    await redis.lpush(dailyCostKey, JSON.stringify(costData));
    await redis.expire(dailyCostKey, CACHE_TTL.AI_COST_TRACKING);
    
    // Track monthly totals
    const monthKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:monthly`;
    await redis.hincrbyfloat(monthKey, model, cost);
    await redis.expire(monthKey, 30 * 24 * 3600); // 30 days
    
  } catch (error) {
    console.error('Cost tracking error:', error);
  }
}

// Enhanced text generation with cost optimization and fallback
export async function generateAIText(
  prompt: string,
  useCase: keyof typeof USE_CASE_MODELS = 'content',
  userId?: string,
  options?: Partial<AIConfig>
): Promise<{ text: string; model: AIModel; tokensUsed: number; cost: number }> {
  const bestModel = providerManager.getBestModel(useCase);
  const config = { ...AI_MODELS[bestModel], ...options };
  
  // Check cache first for expensive operations
  if (useCase === 'research' || useCase === 'blueprint') {
    const cacheKey = CACHE_KEYS.CONTENT_CACHE(
      Buffer.from(prompt + bestModel).toString('base64').slice(0, 32)
    );
    
    const cached = await redis.get<{
      text: string;
      model: AIModel;
      tokensUsed: number;
      cost: number;
    }>(cacheKey);
    
    if (cached) {
      return cached;
    }
  }
  
  const errors: Error[] = [];
  const healthyProviders = providerManager.getHealthyProviders();
  
  // Try providers in order of preference
  for (const provider of healthyProviders) {
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, modelConfig]) => modelConfig.provider === provider)
      .sort(([_, a], [__, b]) => a.priority! - b.priority!)
      .map(([model]) => model as AIModel);
    
    for (const model of availableModels) {
      try {
        const modelConfig = { ...AI_MODELS[model], ...options };
        const modelInstance = providerManager['getModel'](modelConfig);
        
        const start = Date.now();
        const result = await generateText({
          model: modelInstance,
          prompt,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
        });
        
        const responseTime = Date.now() - start;
        const tokensUsed = result.usage?.totalTokens || 0;
        const cost = (tokensUsed / 1000) * modelConfig.costPerToken!;
        
        const response = {
          text: result.text,
          model,
          tokensUsed,
          cost,
        };
        
        // Track costs if user provided
        if (userId) {
          await trackAICost(userId, model, tokensUsed, useCase);
        }
        
        // Cache expensive operations
        if (useCase === 'research' || useCase === 'blueprint') {
          const cacheKey = CACHE_KEYS.CONTENT_CACHE(
            Buffer.from(prompt + model).toString('base64').slice(0, 32)
          );
          await redis.setex(cacheKey, CACHE_TTL.CONTENT_CACHE, response);
        }
        
        return response;
        
      } catch (error) {
        console.error(`AI provider ${provider} model ${model} failed:`, error);
        errors.push(error as Error);
        continue;
      }
    }
  }
  
  throw new Error(
    `All AI providers failed. Errors: ${errors.map(e => e.message).join(', ')}`
  );
}

// Enhanced streaming with fallback support
export async function streamAIText(
  prompt: string,
  useCase: keyof typeof USE_CASE_MODELS = 'content',
  userId?: string,
  options?: Partial<AIConfig>
) {
  const bestModel = providerManager.getBestModel(useCase);
  const config = { ...AI_MODELS[bestModel], ...options };
  
  const errors: Error[] = [];
  const healthyProviders = providerManager.getHealthyProviders();
  
  for (const provider of healthyProviders) {
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, modelConfig]) => modelConfig.provider === provider)
      .sort(([_, a], [__, b]) => a.priority! - b.priority!)
      .map(([model]) => model as AIModel);
    
    for (const model of availableModels) {
      try {
        const modelConfig = { ...AI_MODELS[model], ...options };
        const modelInstance = providerManager['getModel'](modelConfig);
        
        const stream = await streamText({
          model: modelInstance,
          prompt,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
        });
        
        // Track usage after streaming completes
        if (userId) {
          stream.usage.then(usage => {
            if (usage?.totalTokens) {
              trackAICost(userId, model, usage.totalTokens, useCase);
            }
          });
        }
        
        return stream;
        
      } catch (error) {
        console.error(`AI provider ${provider} model ${model} failed:`, error);
        errors.push(error as Error);
        continue;
      }
    }
  }
  
  throw new Error(
    `All AI providers failed. Errors: ${errors.map(e => e.message).join(', ')}`
  );
}

// Get user's AI usage statistics
export async function getUserAIUsage(userId: string): Promise<{
  dailyCosts: Record<string, number>;
  monthlyCosts: Record<AIModel, number>;
  totalTokensUsed: number;
  totalCost: number;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dailyCostKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:${today}`;
    const monthlyKey = `${CACHE_KEYS.AI_COST_TRACKING(userId)}:monthly`;
    
    const [dailyData, monthlyData] = await Promise.all([
      redis.lrange(dailyCostKey, 0, -1),
      redis.hgetall(monthlyKey),
    ]);
    
    const dailyCosts: Record<string, number> = {};
    let totalTokensUsed = 0;
    
    for (const item of dailyData) {
      try {
        const parsed = JSON.parse(item);
        const date = new Date(parsed.timestamp).toISOString().split('T')[0];
        dailyCosts[date] = (dailyCosts[date] || 0) + parsed.cost;
        totalTokensUsed += parsed.tokensUsed;
      } catch (e) {
        console.error('Error parsing daily cost data:', e);
      }
    }
    
    const monthlyCosts = monthlyData as Record<AIModel, number>;
    const totalCost = Object.values(monthlyCosts).reduce((sum, cost) => sum + cost, 0);
    
    return {
      dailyCosts,
      monthlyCosts,
      totalTokensUsed,
      totalCost,
    };
  } catch (error) {
    console.error('Error getting user AI usage:', error);
    return {
      dailyCosts: {},
      monthlyCosts: {} as Record<AIModel, number>,
      totalTokensUsed: 0,
      totalCost: 0,
    };
  }
}

// Export provider manager for health checks
export { providerManager };