# Production Infrastructure Setup Guide

This document outlines the production-grade infrastructure setup for AEO Writer SaaS, designed to handle 10k+ concurrent users with high availability, scalability, and cost optimization.

## 🏗️ Architecture Overview

The application uses a modern, event-driven architecture with the following components:

- **Frontend**: Next.js 14 with App Router and streaming responses
- **Database**: Supabase with Transaction Connection Pooler (Port 6543)
- **Caching**: Upstash Redis for rate limiting and caching
- **Event Processing**: Inngest for background job processing
- **AI Gateway**: Multi-provider setup (OpenAI/Google) with fallback
- **Monitoring**: Comprehensive health checks and performance monitoring

## 🔧 Infrastructure Components

### 1. Inngest Integration (Event-Driven Architecture)

**Purpose**: Handles all background processing to avoid blocking API routes

**Features**:
- Durable execution with automatic retries
- Concurrency control to prevent API rate limits
- Fan-out processing for parallel content generation
- Real-time progress tracking via Supabase Realtime

**Configuration**:
```typescript
// Concurrency limits to prevent rate limiting
const CONCURRENCY_LIMITS = {
  'content/generate': 5,
  'project/research-started': 3,
  'project/content-generation-started': 2,
  default: 10,
};
```

### 2. Upstash Redis (Caching & Rate Limiting)

**Purpose**: High-performance caching and rate limiting for scalability

**Features**:
- Multi-level caching with fallback strategies
- Advanced rate limiting per user and globally
- Cost tracking and quota management
- Session and temporary data storage

**Cache Strategy**:
- **User Data**: 30 minutes - 1 hour TTL
- **Content**: 12-48 hours TTL (expensive operations)
- **System Health**: 30 seconds - 1 minute TTL
- **Rate Limiting**: 1 minute TTL

### 3. Vercel AI SDK (AI Gateway)

**Purpose**: Multi-provider AI integration with cost optimization

**Features**:
- Automatic provider fallback (OpenAI → Google)
- Cost tracking and optimization
- Model selection based on use case
- Health monitoring for all providers

**Cost Optimization**:
- GPT-4o for high-quality research and strategy
- GPT-4o-mini for cost-effective content generation
- Gemini models as cost-effective alternatives
- Caching for expensive operations

### 4. Supabase Connection Pooling

**Purpose**: Optimized database connections for 10k+ concurrent users

**Configuration**:
```typescript
const POOL_CONFIG = {
  pool: {
    min: 5,
    max: 50, // Adjust based on Supabase plan
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  query: {
    timeout: 30000,
    maxRetries: 3,
  },
};
```

**Key Features**:
- Transaction Connection Pooler (Port 6543)
- Automatic retry with exponential backoff
- Read replica support for analytics
- Connection health monitoring

## 🚀 Setup Instructions

### 1. Environment Configuration

Copy `.env.example` to `.env.local` and configure all required variables:

```bash
cp .env.example .env.local
```

**Required Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations
- `DATABASE_URL`: Connection string with Transaction Pooler (Port 6543)
- `UPSTASH_REDIS_REST_URL`: Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Redis authentication token
- `INNGEST_EVENT_KEY`: Inngest event key
- `INNGEST_SIGNING_KEY`: Inngest signing key
- `OPENAI_API_KEY`: OpenAI API key
- `GOOGLE_AI_API_KEY`: Google AI API key
- `TAVILY_API_KEY`: Tavily web scraping API key

### 2. Infrastructure Validation

Run the infrastructure validation script:

```bash
./scripts/validate-infrastructure.sh
```

This script will:
- ✅ Check all environment variables
- ✅ Test service connectivity
- ✅ Verify dependencies
- ✅ Validate configuration
- ✅ Assess production readiness

### 3. Database Setup

Configure Supabase with Transaction Connection Pooler:

1. **Enable Connection Pooler** in your Supabase dashboard
2. **Use Port 6543** for pooled connections
3. **Update DATABASE_URL** to use the pooler:
   ```
   postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true
   ```

### 4. Redis Setup (Upstash)

1. Create an Upstash Redis database
2. Copy the REST URL and token
3. Configure in environment variables

### 5. Inngest Setup

1. Create an Inngest account
2. Get your event key and signing key
3. Configure the webhook endpoint: `/api/inngest`

### 6. AI Provider Setup

**OpenAI**:
1. Get API key from OpenAI dashboard
2. Optionally set organization ID

**Google AI**:
1. Get API key from Google AI Studio
2. Enable Gemini API access

## 📊 Monitoring & Health Checks

### Health Check Endpoint

The application provides comprehensive health monitoring at `/api/health`:

```bash
# Basic health check
curl https://your-app.com/api/health

# Detailed health check
curl https://your-app.com/api/health?detailed=true

# With system metrics
curl https://your-app.com/api/health?detailed=true&metrics=true
```

### Monitoring Features

- **Service Health**: Database, Redis, AI providers, Inngest
- **Performance Metrics**: Response times, error rates, throughput
- **Cost Tracking**: AI usage and costs per user
- **Connection Pool**: Active/idle connections, queue status
- **Error Tracking**: Categorized error logging with alerting

## 🔒 Security & Performance

### Security Features

- **Rate Limiting**: Per-user and global rate limits
- **Input Validation**: Comprehensive input sanitization
- **File Upload Security**: Type validation and virus scanning
- **API Key Encryption**: Secure storage of sensitive keys
- **Row Level Security**: Multi-tenant data isolation

### Performance Optimizations

- **Connection Pooling**: Optimized for 10k+ concurrent users
- **Caching Strategy**: Multi-level caching with intelligent TTLs
- **AI Cost Optimization**: Smart model selection and caching
- **Event-Driven Architecture**: Non-blocking background processing
- **Streaming Responses**: Real-time user feedback

## 📈 Scaling Considerations

### Horizontal Scaling

- **Stateless Design**: All state stored in Redis/Database
- **Event-Driven Processing**: Scales with Inngest workers
- **Connection Pooling**: Handles connection limits efficiently
- **Caching**: Reduces database load significantly

### Cost Optimization

- **AI Model Selection**: Use cheaper models for appropriate tasks
- **Caching Strategy**: Cache expensive AI operations
- **Connection Pooling**: Reduce database connection costs
- **Rate Limiting**: Prevent abuse and control costs

### Monitoring & Alerting

- **Health Checks**: Automated monitoring of all services
- **Performance Metrics**: Track response times and throughput
- **Cost Tracking**: Monitor AI usage and costs
- **Error Alerting**: Immediate notification of issues

## 🚨 Production Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Infrastructure validation script passes
- [ ] Database migrations applied
- [ ] Connection pooler configured
- [ ] Redis cache configured
- [ ] Inngest webhooks configured
- [ ] AI provider keys validated
- [ ] Health checks working

### Post-Deployment

- [ ] Health endpoint responding correctly
- [ ] All services showing as healthy
- [ ] Connection pool metrics normal
- [ ] Cache hit rates acceptable
- [ ] AI providers responding
- [ ] Background jobs processing
- [ ] Monitoring and alerting active

## 🔧 Troubleshooting

### Common Issues

**Database Connection Issues**:
- Verify Transaction Pooler is enabled
- Check connection string format
- Monitor connection pool metrics

**Redis Connection Issues**:
- Verify Upstash credentials
- Check network connectivity
- Monitor Redis health endpoint

**AI Provider Issues**:
- Check API key validity
- Monitor rate limits
- Verify fallback providers

**Inngest Issues**:
- Verify webhook endpoint
- Check signing key
- Monitor event processing

### Debug Commands

```bash
# Check system health
curl https://your-app.com/api/health?detailed=true

# Validate configuration
./scripts/validate-infrastructure.sh

# Check logs
npm run logs

# Monitor performance
npm run monitor
```

## 📚 Additional Resources

- [Supabase Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)

## 🆘 Support

For infrastructure-related issues:

1. Check the health endpoint first
2. Run the validation script
3. Review the monitoring dashboard
4. Check service-specific documentation
5. Contact support with detailed error information

---

This infrastructure setup is designed for production scale and reliability. Regular monitoring and maintenance ensure optimal performance and cost efficiency.