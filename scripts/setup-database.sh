#!/bin/bash

# AEO Writer SaaS Database Setup Script
echo "🗄️  Setting up AEO Writer SaaS database..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    echo "   or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in project root directory"
    exit 1
fi

# Check if .env.local exists and has required variables
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Please create it from .env.example"
    exit 1
fi

# Check for required environment variables
if ! grep -q "NEXT_PUBLIC_SUPABASE_URL=" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
    exit 1
fi

if ! grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local"
    exit 1
fi

echo "✅ Environment variables configured"

# Initialize Supabase project (if not already initialized)
if [ ! -d "supabase" ]; then
    echo "🚀 Initializing Supabase project..."
    supabase init
else
    echo "✅ Supabase project already initialized"
fi

# Link to remote Supabase project
echo "🔗 Linking to remote Supabase project..."
SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2)
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\([^.]*\).*/\1/')

if [ -n "$PROJECT_REF" ]; then
    supabase link --project-ref $PROJECT_REF
    echo "✅ Linked to project: $PROJECT_REF"
else
    echo "❌ Could not extract project reference from SUPABASE_URL"
    exit 1
fi

# Apply database migrations
echo "📊 Applying database migrations..."
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations)" ]; then
    supabase db push
    echo "✅ Database migrations applied"
else
    echo "⚠️  No migrations found to apply"
fi

# Generate TypeScript types
echo "🔧 Generating TypeScript types..."
supabase gen types typescript --local > src/lib/types/supabase.ts
echo "✅ TypeScript types generated"

# Run database tests (if any)
echo "🧪 Running database tests..."
npm run test -- --testPathPattern=database.test.ts --passWithNoTests
if [ $? -eq 0 ]; then
    echo "✅ Database tests passed"
else
    echo "❌ Database tests failed"
    exit 1
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Check your Supabase dashboard to verify tables were created"
echo "2. Test the connection by running 'npm run dev'"
echo "3. Create a test user account to verify authentication"
echo ""
echo "Useful commands:"
echo "- supabase status: Check local development status"
echo "- supabase db reset: Reset local database"
echo "- supabase gen types typescript --local: Regenerate types"