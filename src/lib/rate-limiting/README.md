# Quota and Rate Limiting System

This document describes the comprehensive quota and rate limiting system implemented for the AEO Writer SaaS application.

## Overview

The system provides:
- **Upstash Redis** for fast quota checking and rate limiting
- **Pre-request quota validation** middleware
- **User credit system** with real-time balance updates
- **Rate limiting** to prevent API abuse
- **Real-time notifications** for quota updates
- **Multi-tier plan support** (Free, Pro, Enterprise)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Request   │───▶│   Middleware    │───▶│  Rate Limiting  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Quota Checking  │    │ Upstash Redis   │
                       └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Supabase DB     │    │ Usage Tracking  │
                       └─────────────────┘    └─────────────────┘
```

## Components

### 1. Quota Constants (`quota-constants.ts`)

Defines plan limits for different user tiers:

```typescript
export const PLAN_QUOTAS = {
  free: {
    contentGeneration: 10,    // per month
    apiCalls: 100,           // per day
    projects: 3,
    tokensPerMonth: 10000,
    costLimitUsd: 5.0,
  },
  pro: {
    contentGeneration: 500,
    apiCalls: 5000,
    projects: 50,
    tokensPerMonth: 500000,
    costLimitUsd: 50.0,
  },
  enterprise: {
    contentGeneration: -1,   // unlimited
    apiCalls: -1,
    projects: -1,
    tokensPerMonth: -1,
    costLimitUsd: -1,
  },
};
```

### 2. Redis Client (`redis/client.ts`)

Provides optimized Redis operations with:
- Connection pooling and retry logic
- Hierarchical cache keys
- TTL management
- Batch operations
- Cache warming and invalidation

### 3. Quota Management (`quota.ts`)

Core quota functions:
- `getUserCredits()` - Get comprehensive user quota info
- `checkUserQuota()` - Check if user can perform action
- `updateUserCredits()` - Update usage after operations
- `checkRateLimit()` - Rate limiting with abuse detection
- `isUserSuspended()` - Check for temporary suspensions

### 4. Middleware (`middleware/rate-limit.ts`)

Request middleware providing:
- `withRateLimit()` - Basic rate limiting
- `withQuotaCheck()` - Quota validation
- `withRateLimitAndQuota()` - Combined checking
- `withPreRequestQuotaValidation()` - Dynamic limits based on user plan

### 5. Quota Manager (`utils/quota-manager.ts`)

High-level quota management class:
- `QuotaManager.checkQuota()` - Check quotas with detailed responses
- `QuotaManager.trackUsage()` - Track usage with analytics
- `QuotaManager.getUserUsageStats()` - Get usage statistics
- `QuotaManager.resetUserQuotas()` - Reset quotas (admin)

### 6. Real-time Updates (`hooks/use-realtime-quota.ts`)

React hooks for real-time quota updates:
- `useRealtimeQuota()` - Subscribe to quota changes
- `useQuotaNotifications()` - Real-time notifications

## Usage Examples

### Basic API Route Protection

```typescript
import { withPreRequestQuotaValidation } from '@/lib/middleware/rate-limit';

export async function POST(request: NextRequest) {
  const result = await withPreRequestQuotaValidation(
    request,
    'contentGeneration', // Quota type
    1 // Amount requested
  );

  if (result instanceof NextResponse) {
    return result; // Quota/rate limit exceeded
  }

  const { user, quotaInfo } = result;
  
  // Your API logic here
  // ...
  
  // Track usage after successful operation
  await QuotaManager.trackUsage({
    userId: user.id,
    quotaType: 'contentGeneration',
    amount: 1,
    metadata: { operation: 'blog_generation' }
  });
}
```

### Manual Quota Checking

```typescript
import { QuotaManager } from '@/lib/utils/quota-manager';

// Check if user can generate content
const quotaCheck = await QuotaManager.checkQuota(
  userId, 
  'contentGeneration', 
  1
);

if (!quotaCheck.allowed) {
  throw new Error(quotaCheck.message);
}

// Perform operation
// ...

// Track usage
await QuotaManager.trackUsage({
  userId,
  quotaType: 'contentGeneration',
  amount: 1,
  metadata: {
    tokens: 1500,
    cost: 0.03,
    model: 'gpt-4o-mini',
    projectId: 'project-123'
  }
});
```

### React Component with Real-time Updates

```typescript
import { useRealtimeQuota, useQuotaNotifications } from '@/lib/hooks/use-realtime-quota';

function MyComponent() {
  const { isConnected, lastUpdate, getUsageChange } = useRealtimeQuota();
  const { notifications, dismissNotification } = useQuotaNotifications();
  
  return (
    <div>
      <div>Status: {isConnected ? 'Live' : 'Offline'}</div>
      {notifications.map(notif => (
        <Alert key={notif.id}>
          {notif.message}
          <button onClick={() => dismissNotification(notif.id)}>×</button>
        </Alert>
      ))}
    </div>
  );
}
```

## Rate Limiting Features

### Dynamic Rate Limits by Plan

```typescript
const rateLimits = {
  free: { windowSeconds: 60, maxRequests: 5 },
  pro: { windowSeconds: 60, maxRequests: 20 },
  enterprise: { windowSeconds: 60, maxRequests: 100 },
};
```

### Abuse Detection

- Tracks requests in short windows (10 seconds)
- Temporarily suspends abusive users
- Increases retry delays for repeat offenders
- Logs severe abuse patterns

### Global Rate Limiting

Protects against system-wide overload:
- Per-endpoint global limits
- Automatic service degradation
- Load balancing considerations

## Database Schema

### User Profiles Table

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  subscription_plan TEXT DEFAULT 'free',
  tokens_used INTEGER DEFAULT 0,
  projects_used INTEGER DEFAULT 0,
  -- ... other fields
);
```

### Usage Analytics Table

```sql
CREATE TABLE usage_analytics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  operation_type TEXT NOT NULL,
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  api_provider TEXT,
  model_used TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Database Functions

```sql
-- Atomic token increment
CREATE FUNCTION increment_tokens(user_id UUID, increment INTEGER)
RETURNS INTEGER;

-- Atomic project increment  
CREATE FUNCTION increment_projects(user_id UUID, increment INTEGER)
RETURNS INTEGER;

-- Get quota status
CREATE FUNCTION get_user_quota_status(user_id UUID)
RETURNS TABLE (...);
```

## Redis Cache Structure

### Cache Keys

```typescript
const CACHE_KEYS = {
  USER_QUOTA: (userId: string) => `user:${userId}:quota`,
  USER_USAGE: (userId: string) => `user:${userId}:usage`,
  RATE_LIMIT: (userId: string) => `rate_limit:${userId}`,
  // ... more keys
};
```

### TTL Values

```typescript
const CACHE_TTL = {
  USER_QUOTA: 3600,        // 1 hour
  USER_USAGE: 300,         // 5 minutes
  RATE_LIMIT: 60,          // 1 minute
  // ... more TTLs
};
```

## Error Handling

### Graceful Degradation

- Redis failures don't block requests
- Database errors return default limits
- Cache misses trigger fresh data fetches

### Error Types

```typescript
const ERROR_CODES = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
};
```

## Monitoring and Analytics

### Metrics Tracked

- Request rates per user/endpoint
- Quota usage patterns
- Cost tracking per operation
- Abuse detection events
- Cache hit/miss rates

### Health Checks

```typescript
// Redis health
const health = await checkRedisHealth();

// Quota system health
const quotaHealth = await checkQuotaSystemHealth();
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Database Configuration
DATABASE_URL=postgresql://...

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_QUOTA_CHECKING=true
ENABLE_ABUSE_DETECTION=true
```

### Plan Configuration

Plans can be dynamically updated by modifying `PLAN_QUOTAS` in `quota-constants.ts`.

## Testing

### Unit Tests

- Quota calculation logic
- Rate limiting algorithms
- Error handling scenarios
- Cache operations

### Integration Tests

- End-to-end quota flows
- Database operations
- Redis operations
- Middleware integration

### Load Testing

- Concurrent user scenarios
- Rate limit effectiveness
- Cache performance
- Database performance

## Best Practices

### For Developers

1. Always check quotas before expensive operations
2. Track usage after successful operations
3. Handle quota exceeded errors gracefully
4. Use appropriate quota types for different operations
5. Implement proper error handling

### For Operations

1. Monitor Redis memory usage
2. Set up alerts for quota violations
3. Regularly review abuse patterns
4. Monitor database performance
5. Plan for quota limit increases

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check Redis URL and token
   - Verify network connectivity
   - Monitor Redis memory usage

2. **Quota Not Updating**
   - Check cache invalidation
   - Verify database functions
   - Check real-time subscriptions

3. **Rate Limiting Too Strict**
   - Review rate limit configuration
   - Check for abuse detection false positives
   - Verify user plan assignments

### Debug Commands

```typescript
// Check user quota status
const status = await QuotaManager.getUserUsageStats(userId);

// Reset user quotas (development only)
await QuotaManager.resetUserQuotas(userId);

// Check Redis health
const health = await checkRedisHealth();
```

## Future Enhancements

1. **Advanced Analytics**
   - Usage prediction
   - Cost optimization suggestions
   - Anomaly detection

2. **Dynamic Pricing**
   - Usage-based billing
   - Overage charges
   - Credit system

3. **Enhanced Abuse Detection**
   - Machine learning models
   - Behavioral analysis
   - Automated responses

4. **Multi-Region Support**
   - Distributed rate limiting
   - Regional quotas
   - Cross-region synchronization