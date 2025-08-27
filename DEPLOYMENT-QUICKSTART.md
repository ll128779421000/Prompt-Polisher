# 🚀 Quick Deployment Guide

Your backend is ready to deploy! Follow these simple steps:

## 🔑 Step 1: Get Your API Keys (5 minutes)

### **Get OpenAI API Key** (Recommended)
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key" 
3. Copy the key (starts with `sk-`)
4. **Cost**: ~$0.002 per query (very affordable)

### **Get Stripe Keys** (For payments)
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_`)
3. Copy your **Publishable key** (starts with `pk_`)

## 🌐 Step 2: Deploy to Railway (5 minutes)

### **Option A: Railway.app (Easiest)**

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Initialize and deploy**:
   ```bash
   cd backend
   railway login
   railway init
   railway up
   ```

3. **Set environment variables**:
   ```bash
   railway variables set OPENAI_API_KEY=sk-your-key-here
   railway variables set STRIPE_SECRET_KEY=sk_your-stripe-key
   railway variables set JWT_SECRET=your-super-secret-32-char-key
   railway variables set NODE_ENV=production
   ```

4. **Get your URL**:
   ```bash
   railway status
   ```
   You'll get a URL like: `https://your-app.railway.app`

### **Option B: Render.com (Free tier available)**

1. Go to https://render.com
2. Connect your GitHub repository
3. Choose "Web Service"
4. Set these environment variables in dashboard:
   - `OPENAI_API_KEY`: Your OpenAI key
   - `STRIPE_SECRET_KEY`: Your Stripe key  
   - `JWT_SECRET`: A random 32+ character string
   - `NODE_ENV`: production

### **Option C: DigitalOcean App Platform**

1. Go to https://cloud.digitalocean.com/apps
2. Create new app from GitHub
3. Set environment variables in dashboard
4. Deploy!

## ⚙️ Step 3: Configure Stripe Webhooks (5 minutes)

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://your-deployed-url.com/api/payments/webhook`
4. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Webhook secret** and set it:
   ```bash
   railway variables set STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
   ```

## 🔧 Step 4: Update Extension (2 minutes)

1. Edit `src/utils/backendProvider.ts` in your extension:
   ```typescript
   private static readonly BACKEND_API_URL = 'https://your-deployed-url.com/api'
   ```

2. Rebuild your extension:
   ```bash
   npm run build:extension
   ```

## ✅ Step 5: Test Everything (5 minutes)

### Test Backend Health
```bash
curl https://your-deployed-url.com/health
# Should return: {"status":"healthy"}
```

### Test Extension
1. Load the updated extension in Chrome
2. Go to ChatGPT or Claude
3. Type a prompt and click "Improve" 
4. Should work for 5 queries, then show upgrade modal

## 💰 Pricing Setup

### **Recommended Pricing Strategy**:
- **Free**: 5 queries/day per user
- **100 Queries**: $5 (5¢ each)
- **Monthly Unlimited**: $9.99
- **Yearly Unlimited**: $99.99 (17% savings)

### **Your Profit Margins**:
- **Cost per query**: ~$0.002-0.004 (OpenAI)
- **Revenue per query**: $0.05 (query packs)
- **Profit margin**: ~90%+

## 🔒 Security Checklist

- ✅ API keys stored securely on server
- ✅ Rate limiting prevents abuse  
- ✅ CORS configured for your extension
- ✅ Request logging for monitoring
- ✅ Payment processing secured with Stripe

## 📊 Monitor Your Business

### **Access Admin Dashboard**:
```bash
curl -H "x-admin-key: your-admin-key" https://your-url.com/api/admin/stats
```

### **Key Metrics to Watch**:
- Daily active users
- Conversion rate (free → paid)
- API costs vs revenue
- Query success rate

## 🚨 Emergency Procedures

### **Stop All Requests** (if costs spike):
```bash
railway variables set OPENAI_API_KEY=""
railway deploy
```

### **Change Rate Limits**:
```bash
railway variables set FREE_QUERIES_PER_DAY=2
railway deploy
```

---

## 🎉 You're Live!

Once deployed:
1. **Users get 5 free queries daily**
2. **Upgrade modal appears when limit reached**
3. **Premium users get unlimited access**
4. **You earn revenue from every upgrade**

**Estimated setup time**: 20-30 minutes total

**Break-even point**: ~2-3 paying users covers all free users

**Questions?** Check the logs in your deployment dashboard!

---

**Your secure, monetized Prompt Polisher backend is ready for production! 🚀**