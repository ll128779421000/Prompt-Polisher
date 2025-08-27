# 🚀 Prompt Polisher Backend Deployment Guide

This guide will help you deploy the secure Prompt Polisher backend to protect your API keys and monetize the extension.

## 📋 Prerequisites

1. **Server/VPS** with Node.js 18+ (DigitalOcean, AWS, Railway.app)
2. **Domain name** with SSL certificate
3. **Stripe account** for payment processing
4. **LLM Provider API key** (OpenAI, Anthropic, or local setup)

## 🔧 Quick Setup Commands

### 1. Server Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd prompt-polisher/backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration (see below)
nano .env
```

### 2. Environment Configuration

Edit `.env` file:

```bash
# REQUIRED - Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# REQUIRED - Choose ONE LLM Provider (Recommended: OpenAI for cost-effectiveness)
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-3.5-turbo

# REQUIRED - Payment Processing
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# REQUIRED - Security
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# OPTIONAL - Cost Controls
DAILY_COST_LIMIT=50.00
MONTHLY_COST_LIMIT=500.00
```

### 3. Database Setup
```bash
# Initialize database
npm run migrate

# Start server
npm run build
npm start
```

## 🏗️ Production Deployment Options

### Option A: Railway.app (Easiest)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option B: DigitalOcean App Platform
1. Create new app from GitHub
2. Set environment variables in dashboard
3. Deploy automatically

### Option C: AWS/VPS Manual Setup
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start dist/server.js --name prompt-polisher-backend
pm2 startup
pm2 save

# Setup nginx reverse proxy
sudo nano /etc/nginx/sites-available/prompt-polisher
```

Nginx config:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 💳 Stripe Payment Setup

### 1. Create Stripe Products
```bash
# Use Stripe CLI or dashboard to create:
# - "100 Queries Pack" - $5.00
# - "500 Queries Pack" - $20.00  
# - "Monthly Premium" - $9.99/month
# - "Yearly Premium" - $99.99/year
```

### 2. Webhook Configuration
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed` 
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook secret to `.env`

## 🔒 Security Checklist

### ✅ Essential Security Steps
- [ ] Use HTTPS only (SSL certificate)
- [ ] Set strong JWT secret (32+ characters)
- [ ] Enable rate limiting (configured automatically)
- [ ] Use environment variables for secrets
- [ ] Enable CORS only for your extension
- [ ] Set up request logging
- [ ] Configure firewall (ports 22, 80, 443 only)

### ✅ API Key Protection
- [ ] API keys stored only on server
- [ ] No keys in client-side code
- [ ] API keys in environment variables only
- [ ] Regular key rotation schedule

### ✅ Cost Protection
- [ ] Set daily/monthly spending limits
- [ ] Monitor API usage costs
- [ ] Alert on unusual usage spikes
- [ ] Rate limit per IP and user

## 📊 Monitoring & Analytics

### Health Checks
```bash
# Test your deployment
curl https://yourdomain.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "version": "1.0.0"
}
```

### Usage Monitoring
- Check `/api/admin/stats` for real-time usage
- Monitor costs in your LLM provider dashboard
- Set up alerts for spending limits

### Log Monitoring
```bash
# View logs
pm2 logs prompt-polisher-backend

# Or if using Railway/Heroku, check platform dashboard
```

## 🎯 Extension Configuration

Update your extension to use the backend:

1. Edit `src/utils/backendProvider.ts`:
```typescript
private static readonly BACKEND_API_URL = 'https://yourdomain.com/api'
```

2. Update `manifest.json` permissions:
```json
{
  "permissions": [
    "storage",
    "activeTab",
    "contextMenus"
  ],
  "host_permissions": [
    "https://yourdomain.com/*"
  ]
}
```

## 💰 Pricing Strategy

### Recommended Pricing
- **Free Tier**: 5 queries/day
- **100 Queries Pack**: $5 (5¢ per query)
- **Monthly Premium**: $9.99/month unlimited
- **Yearly Premium**: $99.99/year unlimited (17% savings)

### Cost Analysis (OpenAI GPT-3.5-turbo)
- **Cost per query**: ~$0.002-0.004
- **Profit margin**: 90%+ with query packs
- **Break-even**: ~2-3 paid users cover all free users

## 🚨 Emergency Procedures

### Cost Control Emergency
```bash
# Temporarily disable AI providers (fallback to local)
export OPENAI_API_KEY=""
pm2 restart prompt-polisher-backend
```

### High Load Emergency
```bash
# Reduce rate limits temporarily
# Edit rate limiting in src/middleware/rateLimiter.ts
# Redeploy quickly
```

### Database Issues
```bash
# Backup database
cp data/database.sqlite data/backup-$(date +%Y%m%d).sqlite

# Reset if needed
npm run migrate
```

## 📈 Scaling Considerations

### When to Scale
- **1,000+ daily users**: Consider Redis for rate limiting
- **10,000+ daily users**: Database optimization needed
- **100,000+ users**: Load balancer + multiple instances

### Scaling Steps
1. Use Redis for caching and rate limiting
2. Migrate to PostgreSQL for better performance
3. Implement API key pooling and rotation
4. Add load balancer with multiple backend instances
5. Use CDN for static assets

## ✅ Final Deployment Checklist

Before going live:

- [ ] Backend deployed and accessible via HTTPS
- [ ] All environment variables configured
- [ ] Database initialized and working
- [ ] Stripe webhooks configured and tested
- [ ] Extension updated with correct backend URL
- [ ] Health checks passing
- [ ] Rate limiting tested
- [ ] Payment flow tested end-to-end
- [ ] Monitoring and alerts configured
- [ ] Backup procedures in place

## 📞 Support & Troubleshooting

### Common Issues

**"Rate limit exceeded" immediately**
- Check database initialization
- Verify user creation is working
- Test with different IP address

**Stripe webhooks failing**
- Verify webhook secret matches
- Check endpoint URL is accessible
- Test webhook with Stripe CLI

**High API costs**
- Check for abuse in logs
- Verify rate limiting is working
- Monitor usage patterns

Your backend is now secure, scalable, and ready for production! 🎉

The system protects your API keys, enforces usage limits, and provides a seamless upgrade path for users who want unlimited access.