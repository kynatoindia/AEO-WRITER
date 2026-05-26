import { redis } from '@/lib/redis/client';

// Multi-provider AI gateway with automatic failover and Redis-based health tracking
interface AIProvider {
  name: string;
  priority: number;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  generate: (prompt: string, options?: any) => Promise<string>;
  isAvailable: () => Promise<boolean>;
}

interface ProviderConfig {
  groq: {
    apiKey: string;
    model: string;
  };
  openrouter: {
    apiKey: string;
    model: string;
  };
}

// Redis key for provider health status
const PROVIDER_STATUS_KEY = (provider: string) => `ai:${provider}:status`;

class MultiProviderAIGateway {
  private providers: AIProvider[] = [];
  private rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

  constructor(private config: ProviderConfig) {
    this.initializeProviders();
  }

  // Mark a provider as rate-limited in Redis with TTL
  private async markProviderRateLimited(providerName: string, cooldownSeconds: number = 60): Promise<void> {
    try {
      const statusKey = PROVIDER_STATUS_KEY(providerName);
      await redis.setex(statusKey, cooldownSeconds, JSON.stringify({
        healthy: false,
        rateLimited: true,
        cooldownUntil: Date.now() + (cooldownSeconds * 1000),
        reason: '429 Rate limit hit',
        timestamp: new Date().toISOString()
      }));
      console.log(`[MultiProviderAI] Marked ${providerName} as rate-limited for ${cooldownSeconds}s`);
    } catch (error) {
      console.error(`[MultiProviderAI] Failed to mark provider status in Redis:`, error);
    }
  }

  // Check if provider is healthy (not rate-limited) via Redis
  private async isProviderHealthy(providerName: string): Promise<boolean> {
    try {
      const statusKey = PROVIDER_STATUS_KEY(providerName);
      const status = await redis.get(statusKey);

      if (!status) {
        return true; // No status = healthy
      }

      const parsed = typeof status === 'string' ? JSON.parse(status) : status;
      return parsed.healthy !== false;
    } catch (error) {
      console.error(`[MultiProviderAI] Failed to check provider status:`, error);
      return true; // Assume healthy on error
    }
  }

  // Reset provider status (for manual recovery)
  async resetProviderStatus(providerName: string): Promise<void> {
    try {
      const statusKey = PROVIDER_STATUS_KEY(providerName);
      await redis.del(statusKey);
      console.log(`[MultiProviderAI] Reset status for ${providerName}`);
    } catch (error) {
      console.error(`[MultiProviderAI] Failed to reset provider status:`, error);
    }
  }

  // Parse retry-after from 429 response (seconds)
  private parseRetryAfter(error: any): number {
    // Default cooldown
    let cooldown = 60;

    // Try to extract from error message or headers
    const message = error?.message || '';
    const retryMatch = message.match(/retry.?(?:in|after)\s*[:\s]?\s*(\d+(?:\.\d+)?)\s*s/i);
    if (retryMatch) {
      cooldown = Math.ceil(parseFloat(retryMatch[1]));
    }

    // Cap between 30s and 300s
    return Math.min(Math.max(cooldown, 30), 300);
  }

  private initializeProviders() {
    // Groq Provider (Fast inference for content generation)
    if (this.config.groq.apiKey) {
      this.providers.push({
        name: 'groq',
        priority: 2,
        rateLimit: {
          requestsPerMinute: 30, // Groq free tier
          burstLimit: 10,
        },
        generate: async (prompt: string) => {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.groq.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.config.groq.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 4000,
            }),
          });

          if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;
        },
        isAvailable: async () => {
          const redisHealthy = await this.isProviderHealthy('groq');
          return redisHealthy && !this.isRateLimited('groq');
        }
      });
    }

    // OpenRouter Provider (Primary)
    if (this.config.openrouter.apiKey) {
      this.providers.push({
        name: 'openrouter',
        priority: 1,
        rateLimit: {
          requestsPerMinute: 20, // OpenRouter free tier
          burstLimit: 8,
        },
        generate: async (prompt: string) => {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.openrouter.apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://aeo-writer.com',
              'X-Title': 'AEO Writer SaaS',
            },
            body: JSON.stringify({
              model: this.config.openrouter.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 4000,
            }),
          });

          if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;
        },
        isAvailable: async () => {
          const redisHealthy = await this.isProviderHealthy('openrouter');
          return redisHealthy && !this.isRateLimited('openrouter');
        }
      });
    }

    // Sort providers by priority
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  private isRateLimited(providerName: string): boolean {
    const tracker = this.rateLimitTracker.get(providerName);
    if (!tracker) return false;

    const now = Date.now();
    if (now > tracker.resetTime) {
      // Reset the counter
      this.rateLimitTracker.set(providerName, { count: 0, resetTime: now + 60000 });
      return false;
    }

    const provider = this.providers.find(p => p.name === providerName);
    return tracker.count >= (provider?.rateLimit.requestsPerMinute || 15);
  }

  private trackRequest(providerName: string) {
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(providerName) || { count: 0, resetTime: now + 60000 };

    if (now > tracker.resetTime) {
      // Reset the counter
      this.rateLimitTracker.set(providerName, { count: 1, resetTime: now + 60000 });
    } else {
      tracker.count++;
      this.rateLimitTracker.set(providerName, tracker);
    }
  }

  async generateWithFailover(prompt: string, options: {
    preferredProvider?: string;
    maxRetries?: number;
    taskType?: 'research' | 'content' | 'analysis';
  } = {}): Promise<{ content: string; provider: string; attempts: number }> {
    const { preferredProvider, maxRetries = 3, taskType = 'content' } = options;

    // Optimize provider selection based on task type
    let orderedProviders = [...this.providers];

    if (taskType === 'research') {
      // Prefer OpenRouter for research
      orderedProviders = orderedProviders.sort((a, b) => {
        if (a.name === 'openrouter') return -1;
        if (b.name === 'openrouter') return 1;
        return a.priority - b.priority;
      });
    } else if (taskType === 'content') {
      // Prefer OpenRouter for content generation
      orderedProviders = orderedProviders.sort((a, b) => {
        if (a.name === 'openrouter') return -1;
        if (b.name === 'openrouter') return 1;
        return a.priority - b.priority;
      });
    }

    // If preferred provider specified, try it first
    if (preferredProvider) {
      const preferred = orderedProviders.find(p => p.name === preferredProvider);
      if (preferred) {
        orderedProviders = [preferred, ...orderedProviders.filter(p => p.name !== preferredProvider)];
      }
    }

    let attempts = 0;
    let lastError: Error | null = null;

    for (const provider of orderedProviders) {
      if (attempts >= maxRetries) break;

      try {
        attempts++;

        // Check if provider is available
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          console.log(`Provider ${provider.name} is rate limited, trying next...`);
          continue;
        }

        // Track the request for rate limiting
        this.trackRequest(provider.name);

        console.log(`Attempting generation with ${provider.name} (attempt ${attempts})`);

        const content = await provider.generate(prompt);

        console.log(`Successfully generated content with ${provider.name}`);
        return { content, provider: provider.name, attempts };

      } catch (error: any) {
        lastError = error;
        console.error(`Provider ${provider.name} failed:`, error.message);

        // Handle specific error types
        if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('quota')) {
          // Parse retry-after from error and mark in Redis
          const cooldownSeconds = this.parseRetryAfter(error);
          await this.markProviderRateLimited(provider.name, cooldownSeconds);

          // Also mark in memory tracker
          const tracker = this.rateLimitTracker.get(provider.name) || { count: 0, resetTime: Date.now() + 60000 };
          tracker.count = provider.rateLimit.requestsPerMinute; // Max out the counter
          this.rateLimitTracker.set(provider.name, tracker);

          console.log(`[MultiProviderAI] Provider ${provider.name} hit rate limit, cooling down for ${cooldownSeconds}s`);
          continue;
        }

        if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
          // Server error - try next provider
          console.log(`Provider ${provider.name} has server issues, trying next...`);
          continue;
        }

        // For other errors, wait a bit before trying next provider
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // All providers failed
    throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}. Attempts: ${attempts}`);
  }

  // Specialized methods for different use cases
  async generateResearch(prompt: string): Promise<string> {
    const result = await this.generateWithFailover(prompt, {
      taskType: 'research',
      preferredProvider: 'openrouter',
    });
    return result.content;
  }

  async generateContent(prompt: string): Promise<string> {
    const result = await this.generateWithFailover(prompt, {
      taskType: 'content',
      preferredProvider: 'openrouter',
    });
    return result.content;
  }

  async generateAnalysis(prompt: string): Promise<string> {
    const result = await this.generateWithFailover(prompt, {
      taskType: 'analysis',
      preferredProvider: 'openrouter',
    });
    return result.content;
  }

  // Get provider status for monitoring
  getProviderStatus() {
    return this.providers.map(provider => ({
      name: provider.name,
      priority: provider.priority,
      isRateLimited: this.isRateLimited(provider.name),
      rateLimit: provider.rateLimit,
      tracker: this.rateLimitTracker.get(provider.name),
    }));
  }
}

// Initialize the gateway with environment variables
const providerConfig: ProviderConfig = {
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  },
};

export const multiProviderAI = new MultiProviderAIGateway(providerConfig);

// Export individual methods for backward compatibility
export const generateAIText = (prompt: string) => multiProviderAI.generateContent(prompt);
export const generateResearch = (prompt: string) => multiProviderAI.generateResearch(prompt);
export const generateAnalysis = (prompt: string) => multiProviderAI.generateAnalysis(prompt);
