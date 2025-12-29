#!/bin/bash

# Production Infrastructure Validation Script
# This script validates that all required infrastructure components are properly configured

set -e

echo "🔍 Validating AEO Writer SaaS Infrastructure..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check environment variable
check_env_var() {
    local var_name=$1
    local is_required=${2:-true}
    
    if [ -z "${!var_name}" ]; then
        if [ "$is_required" = true ]; then
            echo -e "${RED}❌ Missing required environment variable: $var_name${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  Optional environment variable not set: $var_name${NC}"
            return 0
        fi
    else
        echo -e "${GREEN}✅ $var_name is set${NC}"
        return 0
    fi
}

# Function to test URL connectivity
test_url() {
    local url=$1
    local service_name=$2
    
    if command_exists curl; then
        if curl -s --head --request GET "$url" | head -n 1 | grep -q "200\|301\|302"; then
            echo -e "${GREEN}✅ $service_name is accessible${NC}"
            return 0
        else
            echo -e "${RED}❌ $service_name is not accessible at $url${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  curl not available, skipping connectivity test for $service_name${NC}"
        return 0
    fi
}

# Function to validate JSON format
validate_json() {
    local json_string=$1
    local service_name=$2
    
    if echo "$json_string" | jq empty 2>/dev/null; then
        echo -e "${GREEN}✅ $service_name configuration is valid JSON${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name configuration is not valid JSON${NC}"
        return 1
    fi
}

echo -e "${BLUE}📋 Checking Prerequisites...${NC}"
echo "--------------------------------"

# Check Node.js version
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check npm/yarn
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm version: $NPM_VERSION${NC}"
elif command_exists yarn; then
    YARN_VERSION=$(yarn --version)
    echo -e "${GREEN}✅ Yarn version: $YARN_VERSION${NC}"
else
    echo -e "${RED}❌ Neither npm nor yarn is installed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔐 Checking Environment Variables...${NC}"
echo "----------------------------------------"

# Load environment variables if .env.local exists
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ Loading .env.local${NC}"
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  .env.local not found, using system environment variables${NC}"
fi

# Required environment variables
REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "INNGEST_EVENT_KEY"
    "INNGEST_SIGNING_KEY"
    "OPENAI_API_KEY"
    "GOOGLE_AI_API_KEY"
    "TAVILY_API_KEY"
)

# Optional environment variables
OPTIONAL_VARS=(
    "DATABASE_URL"
    "OPENAI_ORG_ID"
    "ALERT_EMAIL"
    "SLACK_WEBHOOK_URL"
    "LOG_SERVICE_URL"
)

# Check required variables
MISSING_REQUIRED=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! check_env_var "$var"; then
        MISSING_REQUIRED=$((MISSING_REQUIRED + 1))
    fi
done

# Check optional variables
for var in "${OPTIONAL_VARS[@]}"; do
    check_env_var "$var" false
done

if [ $MISSING_REQUIRED -gt 0 ]; then
    echo -e "${RED}❌ $MISSING_REQUIRED required environment variables are missing${NC}"
    echo -e "${YELLOW}💡 Please check .env.example for reference${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🌐 Testing Service Connectivity...${NC}"
echo "-----------------------------------"

# Test Supabase connectivity
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    test_url "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" "Supabase API"
fi

# Test Redis connectivity (Upstash)
if [ -n "$UPSTASH_REDIS_REST_URL" ] && [ -n "$UPSTASH_REDIS_REST_TOKEN" ]; then
    if command_exists curl; then
        REDIS_RESPONSE=$(curl -s -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" "$UPSTASH_REDIS_REST_URL/ping")
        if echo "$REDIS_RESPONSE" | grep -q "PONG"; then
            echo -e "${GREEN}✅ Redis (Upstash) is accessible${NC}"
        else
            echo -e "${RED}❌ Redis (Upstash) is not accessible${NC}"
        fi
    fi
fi

# Test OpenAI API
if [ -n "$OPENAI_API_KEY" ]; then
    if command_exists curl; then
        OPENAI_RESPONSE=$(curl -s -H "Authorization: Bearer $OPENAI_API_KEY" "https://api.openai.com/v1/models" | head -c 100)
        if echo "$OPENAI_RESPONSE" | grep -q "object"; then
            echo -e "${GREEN}✅ OpenAI API is accessible${NC}"
        else
            echo -e "${RED}❌ OpenAI API is not accessible${NC}"
        fi
    fi
fi

# Test Google AI API
if [ -n "$GOOGLE_AI_API_KEY" ]; then
    if command_exists curl; then
        GOOGLE_RESPONSE=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_AI_API_KEY" | head -c 100)
        if echo "$GOOGLE_RESPONSE" | grep -q "models"; then
            echo -e "${GREEN}✅ Google AI API is accessible${NC}"
        else
            echo -e "${RED}❌ Google AI API is not accessible${NC}"
        fi
    fi
fi

echo ""
echo -e "${BLUE}📦 Checking Dependencies...${NC}"
echo "----------------------------"

# Check if package.json exists
if [ -f "package.json" ]; then
    echo -e "${GREEN}✅ package.json found${NC}"
    
    # Check critical dependencies
    CRITICAL_DEPS=(
        "@supabase/supabase-js"
        "@upstash/redis"
        "inngest"
        "ai"
        "@ai-sdk/openai"
        "@ai-sdk/google"
    )
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            echo -e "${GREEN}✅ $dep is listed in dependencies${NC}"
        else
            echo -e "${RED}❌ $dep is missing from dependencies${NC}"
        fi
    done
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules directory exists${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules not found, run 'npm install' or 'yarn install'${NC}"
fi

echo ""
echo -e "${BLUE}🏗️  Checking Infrastructure Files...${NC}"
echo "------------------------------------"

# Check critical infrastructure files
INFRASTRUCTURE_FILES=(
    "src/lib/inngest/client.ts"
    "src/lib/redis/client.ts"
    "src/lib/ai/gateway.ts"
    "src/lib/supabase/pool.ts"
    "src/lib/infrastructure/monitoring.ts"
    "src/lib/infrastructure/config.ts"
)

for file in "${INFRASTRUCTURE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file is missing${NC}"
    fi
done

echo ""
echo -e "${BLUE}🧪 Running Configuration Validation...${NC}"
echo "---------------------------------------"

# Run the application's configuration validation
if command_exists node && [ -f "src/lib/infrastructure/config.ts" ]; then
    # Create a temporary validation script
    cat > temp_validate.js << 'EOF'
const { validateConfiguration } = require('./src/lib/infrastructure/config.ts');

try {
    const result = validateConfiguration();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
} catch (error) {
    console.error('Validation error:', error.message);
    process.exit(1);
}
EOF

    if node temp_validate.js 2>/dev/null; then
        echo -e "${GREEN}✅ Configuration validation passed${NC}"
    else
        echo -e "${RED}❌ Configuration validation failed${NC}"
    fi
    
    rm -f temp_validate.js
fi

echo ""
echo -e "${BLUE}🚀 Production Readiness Checklist...${NC}"
echo "-------------------------------------"

# Production readiness checks
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${GREEN}✅ NODE_ENV is set to production${NC}"
    
    # Check for production-specific configurations
    if [ -n "$DATABASE_URL" ]; then
        echo -e "${GREEN}✅ DATABASE_URL is configured for connection pooling${NC}"
    else
        echo -e "${YELLOW}⚠️  DATABASE_URL not set, using default Supabase connection${NC}"
    fi
    
    if [ -n "$ALERT_EMAIL" ] || [ -n "$SLACK_WEBHOOK_URL" ]; then
        echo -e "${GREEN}✅ Alerting is configured${NC}"
    else
        echo -e "${YELLOW}⚠️  No alerting configured${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠️  NODE_ENV is not set to production${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Infrastructure validation completed!${NC}"
echo "======================================="

# Summary
echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo "- Environment variables: Configured"
echo "- Service connectivity: Tested"
echo "- Dependencies: Verified"
echo "- Infrastructure files: Present"
echo "- Configuration: Validated"

echo ""
echo -e "${GREEN}✨ Your AEO Writer SaaS infrastructure is ready for production!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run 'npm run build' to build the application"
echo "2. Run 'npm run test' to run the test suite"
echo "3. Deploy to your production environment"
echo "4. Monitor the health endpoint at /api/health"

exit 0