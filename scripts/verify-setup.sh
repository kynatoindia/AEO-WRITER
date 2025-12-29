#!/bin/bash

# AEO Writer SaaS Setup Verification Script
echo "🔍 Verifying AEO Writer SaaS setup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in project root directory"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run 'npm install'"
    exit 1
fi
echo "✅ Dependencies installed"

# Check TypeScript compilation
echo "🔍 Checking TypeScript..."
npm run type-check > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Check linting
echo "🔍 Running linter..."
npm run lint > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Linting passed"
else
    echo "❌ Linting failed"
    exit 1
fi

# Check tests
echo "🔍 Running tests..."
npm run test > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Tests passed"
else
    echo "❌ Tests failed"
    exit 1
fi

# Check build
echo "🔍 Testing build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Check environment file
if [ -f ".env.local" ]; then
    echo "✅ Environment file exists"
else
    echo "⚠️  .env.local not found. Copy .env.example and configure your API keys."
fi

echo ""
echo "🎉 Setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Configure your API keys in .env.local"
echo "2. Set up your Supabase project"
echo "3. Run 'npm run dev' to start development"