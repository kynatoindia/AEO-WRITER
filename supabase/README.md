# Database Setup Guide

This directory contains the database schema, migrations, and configuration for the AEO Writer SaaS application.

## Overview

The database is built on PostgreSQL via Supabase and includes:

- **Projects**: Core project management with AI content generation tracking
- **Content Sections**: Hierarchical content structure for generated articles
- **User Profiles**: Extended user information and subscription management
- **Usage Analytics**: Token usage and cost tracking for AI operations
- **Storage**: File storage for brand documents and exports

## Database Schema

### Core Tables

#### `projects`
Stores the main project information including topic, competitor URLs, AI settings, and generated content.

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 3 AND 200),
  status project_status NOT NULL DEFAULT 'draft',
  competitor_urls TEXT[] NOT NULL CHECK (array_length(competitor_urls, 1) BETWEEN 1 AND 5),
  tone content_tone NOT NULL,
  format content_format NOT NULL,
  brand_document_path TEXT,
  openai_thread_id TEXT,
  blueprint JSONB,
  generated_content TEXT,
  seo_metadata JSONB,
  token_usage JSONB,
  cost_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

#### `content_sections`
Stores individual sections of the generated content with hierarchical structure.

```sql
CREATE TABLE content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  section_order INTEGER NOT NULL CHECK (section_order > 0),
  heading TEXT NOT NULL CHECK (length(heading) > 0),
  goal TEXT,
  sub_sections JSONB DEFAULT '[]'::jsonb,
  content_elements TEXT[] DEFAULT '{}',
  data_sources TEXT[] DEFAULT '{}',
  generated_content TEXT,
  status section_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

#### `user_profiles`
Extended user information beyond Supabase auth.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_limit INTEGER NOT NULL DEFAULT 10000,
  projects_used INTEGER NOT NULL DEFAULT 0,
  projects_limit INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

#### `usage_analytics`
Tracks AI API usage and costs for monitoring and billing.

```sql
CREATE TABLE usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  tokens_used INTEGER CHECK (tokens_used >= 0),
  cost_usd DECIMAL(10,6) CHECK (cost_usd >= 0),
  api_provider TEXT NOT NULL,
  model_used TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Custom Types

```sql
CREATE TYPE project_status AS ENUM ('draft', 'researching', 'planning', 'writing', 'completed', 'error');
CREATE TYPE content_tone AS ENUM ('professional', 'witty', 'data-driven');
CREATE TYPE content_format AS ENUM ('how-to', 'listicle', 'case-study');
CREATE TYPE section_status AS ENUM ('pending', 'writing', 'completed');
```

## Row Level Security (RLS)

All tables have RLS enabled with policies ensuring users can only access their own data:

- **Projects**: Users can CRUD their own projects
- **Content Sections**: Users can CRUD sections from their own projects
- **User Profiles**: Users can view/update their own profile
- **Usage Analytics**: Users can view their own analytics, system can insert

## Database Functions

### `handle_new_user()`
Automatically creates a user profile when a new user signs up.

### `update_user_token_usage(user_uuid, tokens_consumed)`
Updates user token usage and handles limit checking.

### `can_create_project(user_uuid)`
Checks if user can create a new project based on their subscription limits.

### `get_project_with_sections(project_uuid)`
Returns a project with all its content sections in a single query.

### `log_usage(...)`
Logs API usage and automatically updates user token consumption.

## Storage Buckets

### `brand-documents`
- **Purpose**: Store user-uploaded PDF brand documents
- **Access**: Private, user-specific folders
- **Limits**: 10MB per file, PDF only

### `exports`
- **Purpose**: Store generated content exports
- **Access**: Private, user-specific folders  
- **Limits**: 50MB per file, markdown/html/pdf

## Setup Instructions

### 1. Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Supabase project created at [supabase.com](https://supabase.com)
- Environment variables configured in `.env.local`

### 2. Database Setup

```bash
# Run the automated setup script
./scripts/setup-database.sh

# Or manually:
supabase link --project-ref your-project-ref
supabase db push
supabase gen types typescript --local > src/lib/types/supabase.ts
```

### 3. Verify Setup

```bash
# Run database tests
npm run test -- --testPathPatterns=database.test.ts

# Check Supabase status
supabase status
```

## Development Workflow

### Making Schema Changes

1. Create a new migration file:
   ```bash
   supabase migration new your_migration_name
   ```

2. Write your SQL changes in the migration file

3. Apply migrations:
   ```bash
   supabase db push
   ```

4. Regenerate TypeScript types:
   ```bash
   supabase gen types typescript --local > src/lib/types/supabase.ts
   ```

### Testing

- Unit tests for database operations are in `src/lib/supabase/__tests__/`
- Run tests with: `npm run test -- --testPathPatterns=database.test.ts`
- Use mocked Supabase client for isolated testing

### Local Development

```bash
# Start local Supabase (optional)
supabase start

# Reset local database
supabase db reset

# View local dashboard
# Navigate to http://localhost:54323
```

## Security Considerations

1. **RLS Policies**: All tables have comprehensive RLS policies
2. **Input Validation**: All inputs validated with Zod schemas
3. **API Keys**: Service role key used only for server-side operations
4. **File Upload**: Restricted file types and sizes for uploads
5. **Rate Limiting**: Implemented at application level for API calls

## Monitoring and Maintenance

### Performance

- Indexes created on frequently queried columns
- Pagination implemented for large result sets
- Efficient queries using joins and RPC functions

### Backup and Recovery

- Supabase handles automated backups
- Point-in-time recovery available
- Export capabilities for data portability

### Scaling

- Connection pooling configured
- Read replicas available in production
- Horizontal scaling through Supabase infrastructure

## Troubleshooting

### Common Issues

1. **Migration Failures**
   - Check for syntax errors in SQL
   - Ensure proper foreign key relationships
   - Verify RLS policies don't conflict

2. **Connection Issues**
   - Verify environment variables
   - Check Supabase project status
   - Confirm network connectivity

3. **Permission Errors**
   - Review RLS policies
   - Check user authentication
   - Verify service role permissions

### Useful Commands

```bash
# Check migration status
supabase migration list

# View database logs
supabase logs db

# Reset and reseed database
supabase db reset --seed

# Generate fresh types
supabase gen types typescript --local
```

## Support

For database-related issues:

1. Check the [Supabase documentation](https://supabase.com/docs)
2. Review the application logs
3. Test with the local Supabase instance
4. Contact the development team with specific error messages