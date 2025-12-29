# Production Infrastructure Setup

This document outlines the production infrastructure components for scaling the AEO Writer SaaS application to support 10k+ users.

## 🏗️ Architecture Overview

The application uses a modern, scalable architecture with the following components:

- **Next.js 14** - Full-stack React framework
- **Supabase** - Database with connection pooling
- **Upstash Redis** - Caching and rate limiting
- **Inngest** - Event-driven background jobs
- **Vercel AI SDK** - Multi-provider AI gateway
- **TypeScript** - Type safety throughout

## 🚀 Infrastructure Components

### 1. Inngest Integration

Event-driven architecture for background processing:

- **User Registration**: Initialize quotas and send welcome emails
- **Content Generation**: Async AI content processing
- **Quota Management**: Handle quota exceeded events
- **Subscription Updates**: Update user limits and reset counters

**Files:**
- `src/lib/inngest/client.ts` - Inngest client configuration
- `src/lib/inngest/functions.ts` - Event handlers
- `src/app/api/inngest/route.ts` - API endpoint

### 2. Upstash Redis

High-performance caching and rate limiting:

- **User Quotas**: Cache user plan limits
- **Rate Limiting**: Sliding window rate limiting
- **Content Caching**: Cache generated content
- **Session Management**: Fast session lookups

**Files:**
- `src/lib/redis/client.ts` - Redis client and cache keys
- `src/lib/rate-limiting/quota.ts` - Quota and rate limiting logic

### 3. Vercel AI SDK

Multi-provider AI gateway with fallback:

- **Provider Fallback**: OpenAI → Google AI automatic fallback
- **Streaming Support**: Real-time response streaming
- **Error Handling**: Graceful provider failures
- **Cost Optimization**: Route to most cost-effective provider

**Files:**
- `src/lib/ai/gateway.ts` - AI provider abstraction
- `src/app/api/ai/chat/route.ts` - Streaming chat endpoint

### 4. Connection Pooling

Optimized database connections for high concurrency:

- **Supabase Pooler**: Transaction pooling for 10k+ users
- **Health Monitoring**: Connection pool health checks
- **Retry Logic**: Automatic connection retry
- **Performance Metrics**: Pool utilization tracking

**Files:**
- `src/lib/supabase/pool.ts` - Connection pooling configuration
- `src/lib/monitoring/health.ts` - Health monitoring

## 📊 Scaling Features

### Rate Limiting & Quotas

```typescript
// Plan-based quotas
const PLAN_QUOTAS = {
  free: {
    contentGeneration: 10, // per month
    apiCalls: 100, // per day
    projects: 3,
  },
  pro: {
    contentGeneration: 500,
    apiCalls: 5000,
    projects: 50,
  },
  enterprise: {
    contentGeneration: -1, // unlimited
    apiCalls: -1,
    projects: -1,
  },
};
```

### Middleware Integration

```typescript
// Apply rate limiting to API routes
const rateLimitResult = await withRateLimit(request, {
  windowSeconds: 60,
  maxRequests: 10,
});

// Check user quotas
const quotaResult = await withQuotaCheck(userId, 'contentGeneration', userPlan);
```

## 🔧 Environment Variables

Required environment variables for production:

```bash
# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# Upstash Redis
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# AI Providers
GOOGLE_AI_API_KEY=your_google_ai_key
OPENAI_API_KEY=your_openai_key

# Supabase (with pooling)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_connection_pooler_url
```

## 📈 Performance Optimizations

### 1. Caching Strategy

- **User Profiles**: 30-minute TTL
- **Quotas**: 1-hour TTL
- **Content**: 24-hour TTL
- **Rate Limits**: 1-minute sliding window

### 2. Connection Pooling

- **Min Connections**: 2
- **Max Connections**: 10
- **Acquire Timeout**: 30s
- **Idle Timeout**: 30s

### 3. AI Provider Optimization

- **Fallback Order**: OpenAI → Google AI
- **Streaming**: Real-time response delivery
- **Error Recovery**: Automatic provider switching

## 🔍 Monitoring & Health Checks

### Health Endpoint

```bash
GET /api/health
```

Returns system health status:

```json
{
  "status": "healthy",
  "services": {
    "database": true,
    "redis": true,
    "ai": true
  },
  "timestamp": 1703123456789,
  "uptime": 1234
}
```

### Metrics Tracking

- Connection pool utilization
- Rate limit hit rates
- AI provider response times
- Quota usage patterns

## 🚀 Deployment Checklist

### Pre-deployment

- [ ] Set all environment variables
- [ ] Configure Supabase connection pooler
- [ ] Set up Upstash Redis instance
- [ ] Configure Inngest webhooks
- [ ] Test AI provider fallback

### Post-deployment

- [ ] Verify health endpoints
- [ ] Test rate limiting
- [ ] Validate quota enforcement
- [ ] Monitor connection pools
- [ ] Check event processing

## 🔧 Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Fill in your actual values
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Test infrastructure:**
   ```bash
   # Health check
   curl http://localhost:3000/api/health
   
   # Quota check
   curl http://localhost:3000/api/user/quota
   ```

## 📚 API Endpoints

### Core Infrastructure APIs

- `GET /api/health` - System health status
- `GET /api/user/quota` - User quota information
- `POST /api/ai/chat` - Streaming AI chat
- `POST /api/content/generate` - Async content generation
- `POST /api/inngest` - Inngest webhook endpoint

### Usage Examples

```typescript
// Check user quotas
const response = await fetch('/api/user/quota');
const { quotas } = await response.json();

// Generate content with rate limiting
const response = await fetch('/api/content/generate', {
  method: 'POST',
  body: JSON.stringify({
    projectId: 'proj_123',
    contentType: 'blog',
    prompt: 'Write about AI trends',
  }),
});
```

## 🛠️ Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**: Check Redis connection and quota settings
2. **AI Provider Failures**: Verify API keys and fallback configuration
3. **Database Timeouts**: Check connection pool settings
4. **Event Processing**: Verify Inngest webhook configuration

### Debug Commands

```bash
# Check Redis connection
redis-cli -u $UPSTASH_REDIS_REST_URL ping

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Verify environment variables
env | grep -E "(INNGEST|UPSTASH|GOOGLE|OPENAI)"
```

This infrastructure setup provides a robust foundation for scaling to 10k+ users with high availability, performance, and reliability.