import { GoogleGenerativeAI } from '@google/generative-ai';

// Multi-provider AI gateway with automatic failover
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
  gemini: {
    apiKey: string;
    model: string;
  };
  groq: {
    apiKey: string;
    model: string;
  };
  openrouter: {
    apiKey: string;
    model: string;
  };
}

class MultiProviderAIGateway {
  private providers: AIProvider[] = [];
  private rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
  
  constructor(private config: ProviderConfig) {
    this.initializeProviders();
  }
  
  private initializeProviders() {
    // Gemini Provider (Primary for research/analysis)
    if (this.config.gemini.apiKey) {
      const gemini = new GoogleGenerativeAI(this.config.gemini.apiKey);
      this.providers.push({
        name: 'gemini',
        priority: 1,
        rateLimit: {
          requestsPerMinute: 15, // Free tier limit
          burstLimit: 5, // Max requests in 5 seconds
        },
        generate: async (prompt: string) => {
          const model = gemini.getGenerativeModel({ model: this.config.gemini.model });
          const result = await model.generateContent(prompt);
          return result.response.text();
        },
        isAvailable: async () => {
          return !this.isRateLimited('gemini');
        }
      });
    }
    
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
          return !this.isRateLimited('groq');
        }
      });
    }
    
    // OpenRouter Provider (Fallback with multiple models)
    if (this.config.openrouter.apiKey) {
      this.providers.push({
        name: 'openrouter',
        priority: 3,
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
          return !this.isRateLimited('openrouter');
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
      // Prefer Gemini for research (large context window)
      orderedProviders = orderedProviders.sort((a, b) => {
        if (a.name === 'gemini') return -1;
        if (b.name === 'gemini') return 1;
        return a.priority - b.priority;
      });
    } else if (taskType === 'content') {
      // Prefer Groq for content generation (fast inference)
      orderedProviders = orderedProviders.sort((a, b) => {
        if (a.name === 'groq') return -1;
        if (b.name === 'groq') return 1;
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
        
        // Add artificial delay for Gemini to prevent burst limits
        if (provider.name === 'gemini' && attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const content = await provider.generate(prompt);
        
        console.log(`Successfully generated content with ${provider.name}`);
        return { content, provider: provider.name, attempts };
        
      } catch (error: any) {
        lastError = error;
        console.error(`Provider ${provider.name} failed:`, error.message);
        
        // Handle specific error types
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          // Mark provider as rate limited
          const tracker = this.rateLimitTracker.get(provider.name) || { count: 0, resetTime: Date.now() + 60000 };
          tracker.count = provider.rateLimit.requestsPerMinute; // Max out the counter
          this.rateLimitTracker.set(provider.name, tracker);
          
          console.log(`Provider ${provider.name} hit rate limit, marking as unavailable`);
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
      preferredProvider: 'gemini', // Best for research with large context
    });
    return result.content;
  }
  
  async generateContent(prompt: string): Promise<string> {
    const result = await this.generateWithFailover(prompt, {
      taskType: 'content',
      preferredProvider: 'groq', // Fastest for content generation
    });
    return result.content;
  }
  
  async generateAnalysis(prompt: string): Promise<string> {
    const result = await this.generateWithFailover(prompt, {
      taskType: 'analysis',
      preferredProvider: 'gemini', // Best reasoning capabilities
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
  gemini: {
    apiKey: process.env.GOOGLE_AI_API_KEY || '',
    model: 'gemini-1.5-flash',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: 'mistralai/mistral-7b-instruct:free',
  },
};

export const multiProviderAI = new MultiProviderAIGateway(providerConfig);

// Export individual methods for backward compatibility
export const generateAIText = (prompt: string) => multiProviderAI.generateContent(prompt);
export const generateResearch = (prompt: string) => multiProviderAI.generateResearch(prompt);
export const generateAnalysis = (prompt: string) => multiProviderAI.generateAnalysis(prompt);