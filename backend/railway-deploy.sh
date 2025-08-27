#!/bin/bash

# Railway.app Deployment Script for Prompt Polisher Backend
# This script handles the complete deployment process

set -e

echo "🚀 Starting Railway deployment for Prompt Polisher Backend..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Build the application first
echo "🔨 Building application..."
npm run build

# Check if we're already in a Railway project
if [ ! -f .railway.json ]; then
    echo "🔧 Initializing Railway project..."
    railway init
fi

# Set essential environment variables
echo "⚙️ Setting environment variables..."

# Prompt for required variables if not set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "🔑 Please enter your OpenAI API key:"
    read -s OPENAI_API_KEY
    railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
fi

if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "💳 Please enter your Stripe secret key:"
    read -s STRIPE_SECRET_KEY
    railway variables set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo "🔗 Please enter your Stripe webhook secret:"
    read -s STRIPE_WEBHOOK_SECRET
    railway variables set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
fi

if [ -z "$JWT_SECRET" ]; then
    echo "🔒 Generating secure JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    railway variables set JWT_SECRET="$JWT_SECRET"
fi

if [ -z "$ADMIN_PASSWORD" ]; then
    echo "👤 Please enter admin password (min 12 characters):"
    read -s ADMIN_PASSWORD
    railway variables set ADMIN_PASSWORD="$ADMIN_PASSWORD"
fi

# Set other required variables
railway variables set NODE_ENV=production
railway variables set OPENAI_MODEL=gpt-3.5-turbo
railway variables set FREE_QUERIES_PER_DAY=5
railway variables set FRONTEND_URL=https://perfect-ai-prompts.lovable.app
railway variables set BCRYPT_ROUNDS=12
railway variables set LOG_LEVEL=info

echo "📦 Deploying to Railway..."
railway up

echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get the deployment URL
RAILWAY_URL=$(railway status --json | jq -r '.deployments[0].url' 2>/dev/null || echo "")

if [ -n "$RAILWAY_URL" ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your backend is live at: $RAILWAY_URL"
    echo "🩺 Health check: $RAILWAY_URL/health"
    
    # Test the deployment
    echo "🧪 Testing deployment..."
    if curl -f -s "$RAILWAY_URL/health" > /dev/null; then
        echo "✅ Health check passed!"
    else
        echo "⚠️ Health check failed. Check logs with: railway logs"
    fi
    
    echo ""
    echo "📋 Next Steps:"
    echo "1. Update your Chrome extension with the backend URL:"
    echo "   BACKEND_API_URL = '$RAILWAY_URL/api'"
    echo ""
    echo "2. Configure Stripe webhook endpoint:"
    echo "   Webhook URL: $RAILWAY_URL/api/payments/webhook"
    echo ""
    echo "3. Test the full integration:"
    echo "   - Install your updated extension"
    echo "   - Try improving a prompt"
    echo "   - Test payment flow"
    echo ""
    echo "🔍 Monitor logs: railway logs --tail"
    echo "📊 View deployment: railway open"
    
else
    echo "❌ Could not retrieve deployment URL. Check Railway dashboard."
    echo "🔍 Check logs: railway logs"
fi