#!/bin/bash

# Start One-Go Development Environment
# This script starts all services needed for the one-go solution

echo "🚀 Starting One-Go AEO Blog Solution..."
echo ""

# Check if required environment variables are set
if [ -z "$GOOGLE_AI_API_KEY" ] && [ -z "$GROQ_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ]; then
    echo "❌ Error: No AI provider API keys found!"
    echo "   Please set at least one of:"
    echo "   - GOOGLE_AI_API_KEY (for Gemini)"
    echo "   - GROQ_API_KEY (for Groq)"
    echo "   - OPENROUTER_API_KEY (for OpenRouter)"
    echo ""
    exit 1
fi

echo "✅ Environment variables checked"

# Start Inngest Dev Server in background
echo "🔧 Starting Inngest Dev Server..."
npx inngest-cli@latest dev &
INNGEST_PID=$!

# Wait for Inngest to start
sleep 3

# Start Next.js Dev Server in background
echo "🔧 Starting Next.js Dev Server..."
npm run dev &
NEXTJS_PID=$!

# Wait for Next.js to start
sleep 5

echo ""
echo "🎯 One-Go Solution is now running!"
echo ""
echo "📊 Services:"
echo "   - Next.js: http://localhost:3000"
echo "   - Inngest: http://localhost:8288"
echo ""
echo "🧪 Test the solution:"
echo "   1. Open http://localhost:3000/aeo-demo"
echo "   2. Fill in title and keyword"
echo "   3. Click 'Generate AEO Blog'"
echo "   4. Watch real-time progress (no polling!)"
echo ""
echo "🔍 Monitor Inngest workflows:"
echo "   - Open http://localhost:8288"
echo "   - Watch for 'aeo/blog.requested' events"
echo ""
echo "⚡ Key Features:"
echo "   ✅ No recursive fetch loops"
echo "   ✅ No 429 rate limit errors"
echo "   ✅ Automatic provider failover"
echo "   ✅ Real-time status updates"
echo "   ✅ Sequential processing"
echo ""
echo "Press Ctrl+C to stop all services..."

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $INNGEST_PID 2>/dev/null
    kill $NEXTJS_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Wait for user to stop
wait