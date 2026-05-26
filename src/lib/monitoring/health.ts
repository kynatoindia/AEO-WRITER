import { redis } from '@/lib/redis/client';
import { checkDatabaseHealth } from '@/lib/supabase/pool';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: boolean | { healthy: boolean; stats: any; responseTime?: number; error?: string };
    redis: boolean;
    ai: boolean;
  };
  timestamp: number;
  uptime: number;
}

// Check Redis health
async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

// Check AI services health
async function checkAIHealth(): Promise<boolean> {
  try {
    // Simple test to check if AI services are responsive
    // This is a lightweight check - you might want to make it more comprehensive
    return process.env.GOOGLE_AI_API_KEY !== undefined || 
           process.env.OPENAI_API_KEY !== undefined;
  } catch (error) {
    console.error('AI health check failed:', error);
    return false;
  }
}

// Get overall system health
export async function getSystemHealth(): Promise<HealthStatus> {
  const startTime = Date.now();
  
  const [databaseHealth, redisHealth, aiHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkAIHealth(),
  ]);

  const services = {
    database: databaseHealth,
    redis: redisHealth,
    ai: aiHealth,
  };

  const healthyServices = Object.values(services).filter(s => (typeof s === 'object' ? (s as any).healthy : s)).length;
  const totalServices = Object.keys(services).length;

  let status: HealthStatus['status'];
  if (healthyServices === totalServices) {
    status = 'healthy';
  } else if (healthyServices >= totalServices / 2) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    services,
    timestamp: Date.now(),
    uptime: Date.now() - startTime,
  };
}

// Log system metrics
export async function logSystemMetrics() {
  try {
    const health = await getSystemHealth();
    
    // Store health metrics in Redis for monitoring
    await redis.lpush('system_health_log', JSON.stringify(health));
    
    // Keep only last 100 health checks
    await redis.ltrim('system_health_log', 0, 99);
    
    console.log('System health:', health);
    
    return health;
  } catch (error) {
    console.error('Failed to log system metrics:', error);
    return null;
  }
}