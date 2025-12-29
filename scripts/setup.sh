#!/bin/bash

# AEO Writer SaaS Setup Script
echo "🚀 Setting up AEO Writer SaaS development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Please copy .env.example to .env.local and fill in your API keys."
    echo "   Required environment variables:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - OPENAI_API_KEY"
    echo "   - TAVILY_API_KEY"
else
    echo "✅ .env.local found"
fi

# Run linting
echo "🔍 Running linter..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm run test -- --passWithNoTests

echo "✅ Setup complete! You can now run:"
echo "   npm run dev    - Start development server"
echo "   npm run test   - Run tests"
echo "   npm run build  - Build for production"