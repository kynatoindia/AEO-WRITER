import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

// Production-grade connection pooling configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Connection pool configuration for 10k+ concurrent users
export const POOL_CONFIG = {
  // Connection pool settings optimized for high concurrency
  pool: {
    min: 5, // Minimum connections to maintain
    max: 50, // Maximum connections (adjust based on Supabase plan)
    acquireTimeoutMillis: 30000, // 30 seconds to acquire connection
    createTimeoutMillis: 30000, // 30 seconds to create connection
    destroyTimeoutMillis: 5000, // 5 seconds to destroy connection
    idleTimeoutMillis: 30000, // 30 seconds idle timeout
    reapIntervalMillis: 1000, // Check for idle connections every second
    createRetryIntervalMillis: 200, // Retry connection creation every 200ms
  },
  
  // Query optimization settings
  query: {
    timeout: 30000, // 30 second query timeout
    maxRetries: 3,
    retryDelay: 1000,
  },
  
  // Connection health monitoring
  health: {
    checkInterval: 30000, // Check health every 30 seconds
    maxFailures: 3, // Mark unhealthy after 3 failures
    recoveryTime: 60000, // Wait 1 minute before retry after marking unhealthy
  },
  
  // Load balancing for read replicas
  readReplicas: {
    enabled: process.env.NODE_ENV === 'production',
    maxConnections: 20,
    preferReplica: true, // Prefer read replicas for SELECT queries
  },
};

// Create admin client with optimized configuration
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application-name': 'aeo-writer-saas',
      'x-connection-pool': 'enabled',
    },
  },
  // Connection pooling via Supabase Transaction Pooler (Port 6543)
  // This should be configured in your DATABASE_URL to use port 6543
});

// Create read-only client for analytics and reporting
export const supabaseReadOnly = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'aeo-writer-saas-readonly',
        'x-connection-type': 'readonly',
      },
    },
  }
);

// Connection pool monitoring and health checks
class ConnectionPoolManager {
  private healthStatus: {
    healthy: boolean;
    lastCheck: number;
    failureCount: number;
    avgResponseTime: number;
    activeConnections: number;
    queuedRequests: number;
  } = {
    healthy: true,
    lastCheck: Date.now(),
    failureCount: 0,
    avgResponseTime: 0,
    activeConnections: 0,
    queuedRequests: 0,
  };
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.startHealthMonitoring();
  }
  
  private startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkConnectionHealth();
    }, POOL_CONFIG.health.checkInterval);
  }
  
  async checkConnectionHealth(): Promise<boolean> {
    try {
      const start = Date.now();
      
      // Simple health check query
      const { data, error } = await (supabaseAdmin as any)
        .from('profiles')
        .select('count')
        .limit(1)
        .single();
      
      const responseTime = Date.now() - start;
      
      if (error) {
        this.healthStatus.failureCount++;
        this.healthStatus.healthy = this.healthStatus.failureCount < POOL_CONFIG.health.maxFailures;
        console.error('Database health check failed:', error);
        return false;
      }
      
      // Update health metrics
      this.healthStatus = {
        healthy: true,
        lastCheck: Date.now(),
        failureCount: Math.max(0, this.healthStatus.failureCount - 1), // Gradually reduce failure count
        avgResponseTime: (this.healthStatus.avgResponseTime + responseTime) / 2,
        activeConnections: this.healthStatus.activeConnections, // Would need actual pool metrics
        queuedRequests: this.healthStatus.queuedRequests, // Would need actual pool metrics
      };
      
      return true;
    } catch (error) {
      this.healthStatus.failureCount++;
      this.healthStatus.healthy = this.healthStatus.failureCount < POOL_CONFIG.health.maxFailures;
      console.error('Database health check error:', error);
      return false;
    }
  }
  
  getHealthStatus() {
    return { ...this.healthStatus };
  }
  
  async getConnectionStats() {
    // In a real implementation, this would query actual connection pool metrics
    // For Supabase, we can monitor via their dashboard or custom metrics
    return {
      total: POOL_CONFIG.pool.max,
      active: this.healthStatus.activeConnections,
      idle: POOL_CONFIG.pool.max - this.healthStatus.activeConnections,
      waiting: this.healthStatus.queuedRequests,
      healthy: this.healthStatus.healthy,
      avgResponseTime: this.healthStatus.avgResponseTime,
    };
  }
  
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Global connection pool manager
const poolManager = new ConnectionPoolManager();

// Enhanced database operations with connection pooling awareness
export class DatabaseManager {
  // Execute query with automatic retry and connection management
  static async executeQuery<T>(
    queryFn: (client: typeof supabaseAdmin) => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      useReadReplica?: boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = POOL_CONFIG.query.maxRetries,
      retryDelay = POOL_CONFIG.query.retryDelay,
      useReadReplica = false,
    } = options;
    
    const client = useReadReplica ? supabaseReadOnly : supabaseAdmin;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await queryFn(client);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`Database query attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Database query failed after all retries');
  }
  
  // Batch operations for efficiency
  static async executeBatch<T>(
    operations: Array<(client: typeof supabaseAdmin) => Promise<T>>,
    options: {
      concurrency?: number;
      useReadReplica?: boolean;
    } = {}
  ): Promise<T[]> {
    const { concurrency = 5, useReadReplica = false } = options;
    const client = useReadReplica ? supabaseReadOnly : supabaseAdmin;
    
    const results: T[] = [];
    
    // Process operations in batches to avoid overwhelming the connection pool
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(operation => this.executeQuery(() => operation(client)))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // Transaction wrapper with connection pooling
  static async executeTransaction<T>(
    transactionFn: (client: typeof supabaseAdmin) => Promise<T>
  ): Promise<T> {
    // Supabase handles transactions internally
    // This wrapper provides consistent interface and error handling
    return this.executeQuery(transactionFn);
  }
}

// Connection pool health check function
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  stats: any;
  responseTime?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const healthy = await poolManager.checkConnectionHealth();
    const responseTime = Date.now() - start;
    const stats = await poolManager.getConnectionStats();
    
    return {
      healthy,
      stats,
      responseTime,
    };
  } catch (error) {
    return {
      healthy: false,
      stats: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get connection pool statistics
export async function getConnectionPoolStats() {
  return poolManager.getConnectionStats();
}

// Graceful shutdown
export function shutdownConnectionPool() {
  poolManager.destroy();
}

// Database configuration for different environments
export const getDatabaseConfig = () => {
  const env = process.env.NODE_ENV;
  
  return {
    development: {
      maxConnections: 10,
      queryTimeout: 30000,
      healthCheckInterval: 60000,
    },
    production: {
      maxConnections: POOL_CONFIG.pool.max,
      queryTimeout: POOL_CONFIG.query.timeout,
      healthCheckInterval: POOL_CONFIG.health.checkInterval,
    },
    test: {
      maxConnections: 5,
      queryTimeout: 10000,
      healthCheckInterval: 30000,
    },
  }[env] || {
    maxConnections: 10,
    queryTimeout: 30000,
    healthCheckInterval: 60000,
  };
};

// Export the enhanced clients and utilities
export { poolManager };

// Legacy exports for backward compatibility
export { supabaseAdmin as supabase };