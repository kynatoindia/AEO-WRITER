# AI Gateway and Provider Management

This module provides a comprehensive AI gateway with multi-provider support, cost tracking, and intelligent failover capabilities.

## Features

- **Multi-Provider Support**: OpenAI (production) and Google AI (testing/fallback)
- **Intelligent Failover**: Automatic provider switching based on health and rate limits
- **Cost Optimization**: Model selection based on use case and cost efficiency
- **Token Tracking**: Comprehensive usage analytics and cost monitoring
- **Streaming Support**: Real-time content generation with progress tracking
- **Structured Output**: Schema-validated JSON generation
- **Rate Limiting**: User quotas and request throttling
- **Caching**: Intelligent caching for expensive operations

## Quick Start

### Basic Text Generation

```typescript
import { generateAIText } from '@/lib/ai/gateway';

const result = await generateAIText(
  'Write a blog post about AI',
  'content', // Use case: content, research, blueprint, polish, structured
  'user123', // User ID for tracking
  { temperature: 0.7 } // Optional overrides
);

console.log(result.text);
console.log(`Cost: $${result.cost}, Tokens: ${result.inputTokens + result.outputTokens}`);
```

### Streaming Generation

```typescript
import { streamAIText } from '@/lib/ai/gateway';

const streamResult = await streamAIText(
  'Write a blog post about AI',
  'content',
  'user123'
);

for await (const chunk of streamResult.stream.textStream) {
  process.stdout.write(chunk);
}
```

### Structured Output

```typescript
import { generateStructuredOutput } from '@/lib/ai/gateway';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
});

const result = await generateStructuredOutput(
  'Analyze this blog post topic',
  schema,
  'structured',
  'user123'
);

console.log(result.object); // Type-safe structured data
```

## Provider Configuration

### Available Models

- **OpenAI (Production)**
  - `gpt-4o`: High-quality, expensive ($15/1M tokens)
  - `gpt-4o-mini`: Cost-effective ($0.15/1M tokens)

- **Google AI (Testing/Fallback)**
  - `gemini-1.5-pro`: High-quality ($3.50/1M tokens)
  - `gemini-1.5-flash`: Very cost-effective ($0.35/1M tokens)

### Use Case Model Selection

```typescript
const USE_CASE_MODELS = {
  research: ['gpt-4o', 'gemini-1.5-pro'],     // High quality for research
  blueprint: ['gpt-4o', 'gemini-1.5-pro'],   // High quality for strategy
  content: ['gpt-4o-mini', 'gemini-1.5-flash'], // Cost effective for content
  polish: ['gpt-4o-mini', 'gemini-1.5-flash'],  // Cost effective for polishing
  structured: ['gpt-4o', 'gpt-4o-mini'],     // OpenAI better for JSON
};
```

## Cost Tracking and Analytics

### Track Usage

```typescript
import { trackAICost, getUserAIUsage } from '@/lib/ai/gateway';

// Automatic tracking happens during generation
const usage = await getUserAIUsage('user123');

console.log({
  totalCost: usage.totalCost,
  totalTokens: usage.totalTokensUsed,
  mostUsedModel: usage.mostUsedModel,
  operationBreakdown: usage.operationBreakdown,
});
```

### Cost Estimation

```typescript
import { estimateOperationCost } from '@/lib/ai/middleware';

const estimation = estimateOperationCost('research', 2000); // 2000 chars input
console.log({
  estimatedTokens: estimation.estimatedTokens,
  estimatedCost: estimation.estimatedCost,
  recommendedModel: estimation.recommendedModel,
});
```

## Quota Management

### Check User Quotas

```typescript
import { checkUserQuota } from '@/lib/ai/middleware';

const quotaCheck = await checkUserQuota('user123', 1.5, 10000);

if (!quotaCheck.allowed) {
  console.log(`Quota exceeded: ${quotaCheck.reason}`);
  return;
}

// Proceed with AI operation
```

### Middleware Integration

```typescript
import { withTokenTracking } from '@/lib/ai/middleware';

export async function POST(request: NextRequest) {
  return withTokenTracking(request, async (req) => {
    // Your AI operation here
    const result = await generateAIText('Hello world');
    return NextResponse.json(result);
  }, {
    maxCostPerUser: 20.0,      // $20 monthly limit
    maxTokensPerUser: 2000000, // 2M tokens monthly
    maxRequestsPerMinute: 100, // 100 requests per minute
  });
}
```

## Provider Health Monitoring

### Check Provider Status

```typescript
import { checkProviderHealth, getAvailableProviders } from '@/lib/ai/gateway';

const health = await checkProviderHealth();
console.log(health);

const providers = getAvailableProviders();
console.log('Available providers:', providers);
```

### Manual Provider Control

```typescript
import { setProviderEnabled } from '@/lib/ai/gateway';

// Disable Google AI for maintenance
setProviderEnabled('google', false);

// Re-enable later
setProviderEnabled('google', true);
```

## Error Handling

The gateway includes comprehensive error handling:

- **Automatic Retries**: Exponential backoff for transient failures
- **Provider Fallback**: Switches to healthy providers automatically
- **Rate Limit Handling**: Respects provider rate limits and waits
- **Graceful Degradation**: Falls back to available models

```typescript
try {
  const result = await generateAIText('Hello world');
} catch (error) {
  if (error.message.includes('All AI providers failed')) {
    // Handle complete provider failure
    console.error('No AI providers available');
  } else if (error.message.includes('rate limit')) {
    // Handle rate limiting
    console.error('Rate limited, try again later');
  }
}
```

## Testing

Use the test endpoint to verify functionality:

```bash
# Get provider info
curl http://localhost:3000/api/ai/test?action=info

# Check user usage
curl http://localhost:3000/api/ai/test?action=usage \
  -H "x-user-id: test-user"

# Generate text
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{
    "action": "generate",
    "prompt": "Write a haiku about coding",
    "useCase": "content",
    "userId": "test-user"
  }'

# Stream text
curl -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{
    "action": "stream",
    "prompt": "Write a story about AI",
    "useCase": "content"
  }'
```

## Environment Variables

Required environment variables:

```bash
# OpenAI (Required)
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORG_ID=your_openai_org_id  # Optional

# Google AI (Optional - for fallback)
GOOGLE_AI_API_KEY=your_google_ai_key

# Redis (Required for caching and tracking)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## Best Practices

1. **Use Appropriate Models**: Choose cost-effective models for bulk operations
2. **Implement Caching**: Cache expensive research and blueprint operations
3. **Monitor Costs**: Set up alerts for unusual usage patterns
4. **Handle Errors**: Always implement proper error handling and fallbacks
5. **Rate Limiting**: Implement user quotas to prevent abuse
6. **Streaming**: Use streaming for long-form content generation
7. **Structured Output**: Use structured generation for data extraction

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│   AI Gateway     │───▶│   Providers     │
│                 │    │                  │    │                 │
│ - API Routes    │    │ - Model Selection│    │ - OpenAI        │
│ - Components    │    │ - Health Checks  │    │ - Google AI     │
│ - Workflows     │    │ - Cost Tracking  │    │ - (Future)      │
└─────────────────┘    │ - Caching        │    └─────────────────┘
                       │ - Rate Limiting  │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Redis Cache    │
                       │                  │
                       │ - Usage Data     │
                       │ - Provider Health│
                       │ - Content Cache  │
                       └──────────────────┘
```

This AI gateway provides a production-ready foundation for scalable AI operations with comprehensive monitoring, cost control, and reliability features.