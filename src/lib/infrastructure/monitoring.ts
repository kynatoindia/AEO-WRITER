import { redis, checkRedisHealth } from '@/lib/redis/client';
import { checkDatabaseHealth, getConnectionPoolStats } from '@/lib/supabase/pool';
import { providerManager } from '@/lib/ai/gateway';
import { inngest } from '@/lib/inngest/client';

// Infrastructure health monitoring system
export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthCheckResult[];
  timestamp: number;
  uptime: number;
}

class InfrastructureMonitor {
  private startTime: number = Date.now();
  private healthHistory: SystemHealth[] = [];
  private readonly maxHistorySize = 100;
  
  // Check all infrastructure services
  async checkAllServices(): Promise<SystemHealth> {
    const services: HealthCheckResult[] = [];
    
    // Check Redis
    const redisHealth = await this.checkRedis();
    services.push(redisHealth);
    
    // Check Database
    const dbHealth = await this.checkDatabase();
    services.push(dbHealth);
    
    // Check AI Providers
    const aiHealth = await this.checkAIProviders();
    services.push(...aiHealth);
    
    // Check Inngest
    const inngestHealth = await this.checkInngest();
    services.push(inngestHealth);
    
    // Determine overall health
    const healthyCount = services.filter(s => s.healthy).length;
    const totalCount = services.length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount >= totalCount * 0.7) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }
    
    const systemHealth: SystemHealth = {
      overall,
      services,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
    };
    
    // Store in history
    this.healthHistory.push(systemHealth);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
    
    // Cache the result
    await redis.setex('system:health', 30, systemHealth);
    
    return systemHealth;
  }
  
  private async checkRedis(): Promise<HealthCheckResult> {
    try {
      const result = await checkRedisHealth();
      return {
        service: 'redis',
        healthy: result.healthy,
        responseTime: result.latency,
        error: result.error,
        metadata: {
          provider: 'upstash',
        },
      };
    } catch (error) {
      return {
        service: 'redis',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private async checkDatabase(): Promise<HealthCheckResult> {
    try {
      const result = await checkDatabaseHealth();
      const stats = await getConnectionPoolStats();
      
      return {
        service: 'database',
        healthy: result.healthy,
        responseTime: result.responseTime,
        error: result.error,
        metadata: {
          provider: 'supabase',
          connectionPool: stats,
        },
      };
    } catch (error) {
      return {
        service: 'database',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private async checkAIProviders(): Promise<HealthCheckResult[]> {
    const providers = ['openai', 'google'] as const;
    const results: HealthCheckResult[] = [];
    
    for (const provider of providers) {
      try {
        // Check cached health status
        const cachedHealth = await redis.get(`ai:${provider}:status`);
        
        results.push({
          service: `ai-${provider}`,
          healthy: cachedHealth?.healthy ?? true,
          responseTime: cachedHealth?.responseTime,
          error: cachedHealth?.error,
          metadata: {
            provider,
            lastCheck: cachedHealth?.lastCheck,
          },
        });
      } catch (error) {
        results.push({
          service: `ai-${provider}`,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return results;
  }
  
  private async checkInngest(): Promise<HealthCheckResult> {
    try {
      // Simple check - try to send a health check event
      await inngest.send({
        name: 'system/health-check',
        data: {
          timestamp: new Date().toISOString(),
          services: ['inngest'],
        },
      });
      
      return {
        service: 'inngest',
        healthy: true,
        metadata: {
          provider: 'inngest',
        },
      };
    } catch (error) {
      return {
        service: 'inngest',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // Get health history for monitoring dashboards
  getHealthHistory(): SystemHealth[] {
    return [...this.healthHistory];
  }
  
  // Get system metrics
  async getSystemMetrics(): Promise<{
    uptime: number;
    healthScore: number;
    avgResponseTime: number;
    errorRate: number;
    serviceStatus: Record<string, boolean>;
  }> {
    const recentHealth = this.healthHistory.slice(-10);
    
    if (recentHealth.length === 0) {
      return {
        uptime: Date.now() - this.startTime,
        healthScore: 0,
        avgResponseTime: 0,
        errorRate: 0,
        serviceStatus: {},
      };
    }
    
    const healthyChecks = recentHealth.filter(h => h.overall === 'healthy').length;
    const healthScore = (healthyChecks / recentHealth.length) * 100;
    
    const responseTimes = recentHealth
      .flatMap(h => h.services)
      .map(s => s.responseTime)
      .filter(rt => rt !== undefined) as number[];
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
      : 0;
    
    const totalChecks = recentHealth.flatMap(h => h.services).length;
    const errorChecks = recentHealth.flatMap(h => h.services).filter(s => !s.healthy).length;
    const errorRate = totalChecks > 0 ? (errorChecks / totalChecks) * 100 : 0;
    
    // Get current service status
    const latestHealth = recentHealth[recentHealth.length - 1];
    const serviceStatus: Record<string, boolean> = {};
    
    if (latestHealth) {
      for (const service of latestHealth.services) {
        serviceStatus[service.service] = service.healthy;
      }
    }
    
    return {
      uptime: Date.now() - this.startTime,
      healthScore,
      avgResponseTime,
      errorRate,
      serviceStatus,
    };
  }
}

// Global monitor instance
const monitor = new InfrastructureMonitor();

// Export monitoring functions
export async function checkSystemHealth(): Promise<SystemHealth> {
  return monitor.checkAllServices();
}

export function getHealthHistory(): SystemHealth[] {
  return monitor.getHealthHistory();
}

export async function getSystemMetrics() {
  return monitor.getSystemMetrics();
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();
  
  static startTimer(operation: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }
      
      const operationMetrics = this.metrics.get(operation)!;
      operationMetrics.push(duration);
      
      // Keep only last 100 measurements
      if (operationMetrics.length > 100) {
        operationMetrics.shift();
      }
      
      // Log slow operations
      if (duration > 5000) { // 5 seconds
        console.warn(`Slow operation detected: ${operation} took ${duration}ms`);
      }
    };
  }
  
  static getMetrics(operation: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
    p95: number;
  } | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) {
      return null;
    }
    
    const sorted = [...metrics].sort((a, b) => a - b);
    const sum = metrics.reduce((a, b) => a + b, 0);
    
    return {
      avg: sum / metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: metrics.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }
  
  static getAllMetrics(): Record<string, ReturnType<typeof PerformanceMonitor.getMetrics>> {
    const result: Record<string, ReturnType<typeof PerformanceMonitor.getMetrics>> = {};
    
    for (const [operation] of this.metrics) {
      result[operation] = this.getMetrics(operation);
    }
    
    return result;
  }
}

// Error tracking and alerting
export class ErrorTracker {
  private static errors: Map<string, Array<{ error: string; timestamp: number; metadata?: any }>> = new Map();
  
  static trackError(
    category: string,
    error: Error | string,
    metadata?: any
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    
    if (!this.errors.has(category)) {
      this.errors.set(category, []);
    }
    
    const categoryErrors = this.errors.get(category)!;
    categoryErrors.push({
      error: errorMessage,
      timestamp: Date.now(),
      metadata,
    });
    
    // Keep only last 50 errors per category
    if (categoryErrors.length > 50) {
      categoryErrors.shift();
    }
    
    // Log to Redis for persistence
    redis.lpush(`errors:${category}`, JSON.stringify({
      error: errorMessage,
      timestamp: Date.now(),
      metadata,
    })).catch(console.error);
    
    // Alert on high error rates
    const recentErrors = categoryErrors.filter(
      e => Date.now() - e.timestamp < 300000 // Last 5 minutes
    );
    
    if (recentErrors.length > 10) {
      console.error(`High error rate detected in ${category}: ${recentErrors.length} errors in 5 minutes`);
      // Here you would integrate with your alerting system (email, Slack, etc.)
    }
  }
  
  static getErrors(category: string): Array<{ error: string; timestamp: number; metadata?: any }> {
    return this.errors.get(category) || [];
  }
  
  static getAllErrors(): Record<string, Array<{ error: string; timestamp: number; metadata?: any }>> {
    const result: Record<string, Array<{ error: string; timestamp: number; metadata?: any }>> = {};
    
    for (const [category, errors] of this.errors) {
      result[category] = errors;
    }
    
    return result;
  }
}

// Export utilities
export { monitor, PerformanceMonitor, ErrorTracker };