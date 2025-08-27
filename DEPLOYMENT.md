# 🚀 Deployment Guide - Prompt Polisher

## Overview
This project consists of three main components:
- **Backend API** (Node.js/TypeScript) - Railway deployment
- **Chrome Extension** (MV3) - Chrome Web Store
- **PWA** (Progressive Web App) - Static hosting

## 🚄 Railway Backend Deployment

### Quick Deploy
```bash
# 1. Clone and install dependencies
git clone <your-repo>
cd prompt-polisher

# 2. Set up Railway
npm install -g @railway/cli
railway login
railway link  # Link to your Railway project

# 3. Set environment variables (copy from .env.railway template)
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set OPENAI_API_KEY=sk-your-actual-key
railway variables set JWT_SECRET=your-32-char-secret
railway variables set STRIPE_SECRET_KEY=sk-your-stripe-key

# 4. Deploy
railway deploy
```

### Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `8080` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Anthropic key (optional) | `sk-ant-...` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your-secure-secret-key-here` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `ADMIN_KEY` | Admin dashboard key | `admin-access-key` |
| `DB_PATH` | SQLite database path | `./data/database.sqlite` |

### Troubleshooting Railway Issues

#### ❌ Build Failures

**Issue**: `npm ERR! Cannot find package 'prometheus-client'`
```bash
# Fixed: Updated to correct package name
"prom-client": "^14.2.0"
```

**Issue**: `sh: 1: webpack: not found`
```bash
# Fixed: Removed webpack, using backend-only build
# Build command: cd backend && npm install && npm run build
```

**Issue**: Railway can't find build command
```bash
# Fixed: Updated railway.toml
[build]
buildCommand = "cd backend && npm install && npm run build"
startCommand = "cd backend && npm start"
rootDir = "."
```

#### ❌ Runtime Errors

**Issue**: `Error: Cannot find module './server.js'`
- **Fix**: Backend package.json main points to `dist/server.js`
- **Fix**: Railway startCommand is `cd backend && npm start`

**Issue**: API key errors in production
- **Fix**: Set actual API keys in Railway environment variables
- **Fix**: Remove placeholder values like `your-key-here`

**Issue**: Database connection failures
- **Fix**: Ensure `data/` directory exists in deployment
- **Fix**: Set proper DB_PATH environment variable

### Testing Railway Deployment

```bash
# Check deployment status
railway status

# View logs
railway logs

# Test API endpoint
curl https://your-railway-domain.up.railway.app/api/health

# Monitor in real-time
railway logs --follow
```

## 🧩 Chrome Extension

### Build and Package
```bash
# Build extension
npm run build:extension

# Package for Chrome Web Store
cd dist/extension
zip -r ../prompt-polisher-extension.zip .
```

### Chrome Web Store Submission
1. Create [Chrome Web Store Developer account](https://developer.chrome.com/docs/webstore/register/)
2. Pay $5 registration fee
3. Upload `prompt-polisher-extension.zip`
4. Fill out store listing details
5. Submit for review (7-14 days)

### Extension Testing Checklist
- [ ] Loads without errors in `chrome://extensions/`
- [ ] Works on ChatGPT, Claude, Gemini, Perplexity
- [ ] Keyboard shortcut `Ctrl+Shift+I` functions
- [ ] Popup displays correctly
- [ ] Options page loads and saves settings
- [ ] No console errors or warnings

### Common Extension Issues

**Issue**: `Manifest parsing error`
- **Fix**: Removed `*://*/*` catch-all pattern
- **Fix**: Use specific HTTPS domains only

**Issue**: Missing popup.js or options.js
- **Fix**: Updated Vite config to build TypeScript files
- **Fix**: HTML files reference correct script names

## 📱 PWA Deployment

### Build PWA
```bash
# Build PWA
npm run build:pwa

# Output: dist/pwa/
```

### Deploy Options

#### Option 1: Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd dist/pwa
netlify deploy --prod
```

#### Option 2: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd dist/pwa
vercel --prod
```

#### Option 3: GitHub Pages
```bash
# Push dist/pwa to gh-pages branch
git subtree push --prefix dist/pwa origin gh-pages
```

### PWA Testing Checklist
- [ ] Installs as PWA on mobile
- [ ] Service worker caches resources
- [ ] Works offline
- [ ] Share target receives shared content
- [ ] Responsive on mobile/tablet/desktop

## 🔧 Project Structure After Fixes

```
prompt-polisher/
├── backend/                 # Backend API service
│   ├── package.json        # Backend dependencies
│   ├── src/
│   └── dist/               # Compiled backend
├── src/
│   ├── extension/          # Chrome extension source
│   ├── pwa/               # PWA source
│   └── utils/             # Shared utilities
├── dist/
│   ├── extension/         # Built extension
│   └── pwa/              # Built PWA
├── package.json           # Root package (build scripts)
├── railway.toml          # Railway deployment config
├── vite.config.ts        # Vite build config
├── .env.railway          # Environment template
└── README.md
```

## ⚡ Quick Deployment Checklist

### Backend (Railway)
- [ ] Environment variables set
- [ ] Database path configured
- [ ] API keys are real (not placeholders)
- [ ] `railway deploy` succeeds
- [ ] Health endpoint responds

### Extension
- [ ] `npm run build:extension` works
- [ ] Manifest.json is valid
- [ ] All TypeScript files compile
- [ ] Extension loads in Chrome

### PWA
- [ ] `npm run build:pwa` works
- [ ] Service worker compiles
- [ ] PWA manifest is valid
- [ ] Installable on devices

## 🆘 Getting Help

If you encounter issues:
1. Check Railway logs: `railway logs`
2. Verify environment variables are set
3. Test builds locally first
4. Check Chrome extension console for errors
5. Use browser dev tools to debug PWA

## 📋 Post-Deployment

### Security
- [ ] API keys are in environment variables (not code)
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled

### Monitoring
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Monitor API usage and costs
- [ ] Set up uptime monitoring
- [ ] Track extension installation metrics

### Maintenance
- [ ] Regular dependency updates
- [ ] Monitor Chrome Web Store reviews
- [ ] Keep Railway deployment up to date
- [ ] Backup database periodically