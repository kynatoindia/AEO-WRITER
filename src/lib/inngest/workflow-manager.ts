import { inngest, generateIdempotencyKey, CONCURRENCY_LIMITS, AI_RATE_LIMITS } from './client';
import { redis } from '@/lib/redis/client';

/**
 * Workflow Manager for Inngest operations
 * Provides utilities for managing workflows, monitoring, and recovery
 */

// Workflow status tracking
export interface WorkflowStatus {
  id: string;
  userId: string;
  projectId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  startedAt: number;
  completedAt?: number;
  error?: string;
  retryCount: number;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

// Workflow recovery utilities
export class WorkflowRecovery {
  /**
   * Resume failed workflow from last successful step
   */
  static async resumeWorkflow(workflowId: string, lastSuccessfulStep: string): Promise<void> {
    const workflowStatus = await redis.hgetall(`workflow:${workflowId}`);
    
    if (!workflowStatus) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    console.log(`Resuming workflow ${workflowId} from step: ${lastSuccessfulStep}`);
    
    // Trigger workflow resume event
    await inngest.send({
      name: 'workflow/resume',
      data: {
        workflowId,
        lastSuccessfulStep,
        originalData: JSON.parse(workflowStatus.originalData || '{}'),
        retryCount: parseInt(workflowStatus.retryCount || '0') + 1,
      },
    });
  }
  
  /**
   * Mark workflow step as completed for recovery tracking
   */
  static async markStepCompleted(workflowId: string, stepName: string, result: any): Promise<void> {
    await redis.hset(`workflow:${workflowId}:steps`, stepName, JSON.stringify({
      completedAt: Date.now(),
      result,
      status: 'completed',
    }));
  }
  
  /**
   * Get completed steps for a workflow
   */
  static async getCompletedSteps(workflowId: string): Promise<Record<string, any>> {
    const steps = await redis.hgetall(`workflow:${workflowId}:steps`);
    const completedSteps: Record<string, any> = {};
    
    for (const [stepName, stepData] of Object.entries(steps)) {
      completedSteps[stepName] = JSON.parse(stepData);
    }
    
    return completedSteps;
  }
}

// Rate limiting for AI providers
export class AIRateLimiter {
  /**
   * Check if AI request is within rate limits
   */
  static async checkRateLimit(provider: 'openai' | 'gemini', userId: string): Promise<{
    allowed: boolean;
    remainingRequests: number;
    resetTime: number;
  }> {
    const limits = AI_RATE_LIMITS[provider];
    const rateLimitKey = `rate_limit:${provider}:${userId}`;
    
    const currentRequests = await redis.incr(rateLimitKey);
    
    if (currentRequests === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }
    
    const ttl = await redis.ttl(rateLimitKey);
    const resetTime = Date.now() + (ttl * 1000);
    
    return {
      allowed: currentRequests <= limits.requestsPerMinute,
      remainingRequests: Math.max(0, limits.requestsPerMinute - currentRequests),
      resetTime,
    };
  }
  
  /**
   * Wait for rate limit reset if needed
   */
  static async waitForRateLimit(provider: 'openai' | 'gemini', userId: string): Promise<void> {
    const rateLimit = await this.checkRateLimit(provider, userId);
    
    if (!rateLimit.allowed) {
      const waitTime = rateLimit.resetTime - Date.now();
      console.log(`Rate limit exceeded for ${provider}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Concurrency management
export class ConcurrencyManager {
  /**
   * Check if operation can proceed based on concurrency limits
   */
  static async checkConcurrency(eventType: string, userId: string): Promise<{
    allowed: boolean;
    currentConcurrency: number;
    limit: number;
  }> {
    const limit = CONCURRENCY_LIMITS[eventType as keyof typeof CONCURRENCY_LIMITS] || CONCURRENCY_LIMITS.default;
    const concurrencyKey = `concurrency:${eventType}:${userId}`;
    
    const currentConcurrency = await redis.scard(concurrencyKey);
    
    return {
      allowed: currentConcurrency < limit,
      currentConcurrency,
      limit,
    };
  }
  
  /**
   * Acquire concurrency slot
   */
  static async acquireSlot(eventType: string, userId: string, workflowId: string): Promise<boolean> {
    const concurrencyCheck = await this.checkConcurrency(eventType, userId);
    
    if (!concurrencyCheck.allowed) {
      return false;
    }
    
    const concurrencyKey = `concurrency:${eventType}:${userId}`;
    await redis.sadd(concurrencyKey, workflowId);
    await redis.expire(concurrencyKey, 3600); // 1 hour expiry
    
    return true;
  }
  
  /**
   * Release concurrency slot
   */
  static async releaseSlot(eventType: string, userId: string, workflowId: string): Promise<void> {
    const concurrencyKey = `concurrency:${eventType}:${userId}`;
    await redis.srem(concurrencyKey, workflowId);
  }
}

// Workflow monitoring and metrics
export class WorkflowMonitor {
  /**
   * Track workflow execution metrics
   */
  static async trackExecution(workflowId: string, eventType: string, duration: number, success: boolean): Promise<void> {
    const metricsKey = `metrics:workflow:${eventType}`;
    const timestamp = Date.now();
    
    // Store execution metrics
    await redis.zadd(`${metricsKey}:executions`, timestamp, JSON.stringify({
      workflowId,
      duration,
      success,
      timestamp,
    }));
    
    // Update counters
    await redis.hincrby(`${metricsKey}:counters`, 'total', 1);
    if (success) {
      await redis.hincrby(`${metricsKey}:counters`, 'success', 1);
    } else {
      await redis.hincrby(`${metricsKey}:counters`, 'failed', 1);
    }
    
    // Update average duration
    const avgDurationKey = `${metricsKey}:avg_duration`;
    const currentAvg = parseFloat(await redis.get(avgDurationKey) || '0');
    const totalExecutions = await redis.hget(`${metricsKey}:counters`, 'total');
    const newAvg = ((currentAvg * (parseInt(totalExecutions || '1') - 1)) + duration) / parseInt(totalExecutions || '1');
    await redis.set(avgDurationKey, newAvg.toString());
  }
  
  /**
   * Get workflow metrics for monitoring dashboard
   */
  static async getMetrics(eventType: string, timeRange: number = 3600): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    recentExecutions: any[];
  }> {
    const metricsKey = `metrics:workflow:${eventType}`;
    const counters = await redis.hgetall(`${metricsKey}:counters`);
    const avgDuration = parseFloat(await redis.get(`${metricsKey}:avg_duration`) || '0');
    
    const since = Date.now() - (timeRange * 1000);
    const recentExecutions = await redis.zrangebyscore(`${metricsKey}:executions`, since, '+inf');
    
    const total = parseInt(counters.total || '0');
    const success = parseInt(counters.success || '0');
    
    return {
      totalExecutions: total,
      successRate: total > 0 ? (success / total) * 100 : 0,
      averageDuration: avgDuration,
      recentExecutions: recentExecutions.map(exec => JSON.parse(exec)),
    };
  }
}

// Idempotency utilities
export class IdempotencyManager {
  /**
   * Check if operation has already been completed
   */
  static async checkIdempotency(key: string): Promise<any | null> {
    const result = await redis.get(`idempotency:${key}`);
    return result ? JSON.parse(result) : null;
  }
  
  /**
   * Store idempotent result
   */
  static async storeResult(key: string, result: any, ttlSeconds: number = 3600): Promise<void> {
    await redis.setex(`idempotency:${key}`, ttlSeconds, JSON.stringify(result));
  }
  
  /**
   * Generate content-based idempotency key
   */
  static generateContentKey(operation: string, content: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    return `${operation}_${hash}`;
  }
}

// Workflow utilities for common patterns
export class WorkflowUtils {
  /**
   * Send event with automatic retry and idempotency
   */
  static async sendEventSafe(eventName: string, data: any, options?: {
    idempotencyKey?: string;
    priority?: 'high' | 'normal' | 'low';
    delay?: string;
  }): Promise<void> {
    const idempotencyKey = options?.idempotencyKey || generateIdempotencyKey.userOperation(
      data.userId,
      eventName,
      Date.now()
    );
    
    // Check if event already sent
    const existing = await IdempotencyManager.checkIdempotency(idempotencyKey);
    if (existing) {
      console.log(`Event ${eventName} already sent with key ${idempotencyKey}`);
      return;
    }
    
    await inngest.send({
      name: eventName,
      data: {
        ...data,
        idempotencyKey,
        priority: options?.priority || 'normal',
      },
      ...(options?.delay && { delay: options.delay }),
    });
    
    // Mark as sent
    await IdempotencyManager.storeResult(idempotencyKey, { sent: true, timestamp: Date.now() });
  }
  
  /**
   * Create workflow with automatic monitoring and recovery
   */
  static async createMonitoredWorkflow(
    workflowId: string,
    userId: string,
    eventType: string,
    data: any
  ): Promise<void> {
    // Store workflow metadata
    await redis.hset(`workflow:${workflowId}`, {
      userId,
      eventType,
      status: 'pending',
      startedAt: Date.now(),
      originalData: JSON.stringify(data),
      retryCount: 0,
    });
    
    // Set workflow expiry (24 hours)
    await redis.expire(`workflow:${workflowId}`, 86400);
    
    console.log(`Created monitored workflow ${workflowId} for user ${userId}`);
  }
}