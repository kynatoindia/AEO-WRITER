#!/bin/bash

# AEO Blog Workflow Setup Script
# This script helps you get the "One-Go" fix running

echo "🚀 Setting up AEO Blog Workflow - One-Go Fix"
echo "============================================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if Inngest CLI is available
if ! command -v inngest &> /dev/null; then
    echo "📥 Installing Inngest CLI globally..."
    npm install -g inngest-cli@latest
else
    echo "✅ Inngest CLI is installed"
fi

echo
echo "🔧 Setup Complete! Here's how to run the AEO Blog Workflow:"
echo
echo "1. Start Next.js development server:"
echo "   npm run dev"
echo
echo "2. In a new terminal, start Inngest dev server:"
echo "   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"
echo
echo "3. Visit the Inngest dashboard:"
echo "   http://localhost:8288"
echo
echo "4. Test the workflow:"
echo "   npx tsx test-aeo-blog-workflow.ts"
echo
echo "5. Or test via API:"
echo '   curl -X POST http://localhost:3000/api/generate-aeo-blog \'
echo '   -H "Content-Type: application/json" \'
echo '   -d '"'"'{"userId":"test","projectId":"test","title":"Test Blog","keyword":"test keyword"}'"'"
echo
echo "🎯 Benefits of this implementation:"
echo "- ✅ No more HTTP 429 errors"
echo "- ✅ Immediate 202 response to browser"
echo "- ✅ Sequential AI requests prevent rate limits"
echo "- ✅ Automatic retries on failures"
echo "- ✅ Real-time progress updates"
echo
echo "📚 For more details, see: AEO-BLOG-WORKFLOW-IMPLEMENTATION.md"
echo
echo "🎉 Ready to generate blogs without rate limit errors!"