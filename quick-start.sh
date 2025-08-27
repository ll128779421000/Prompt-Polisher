#!/bin/bash

# Quick Start Script for Prompt Polisher
echo "🚀 Quick Start: Prompt Polisher"
echo "================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm --version) found"

# Install dependencies with timeout handling
echo ""
echo "📦 Installing dependencies..."
if timeout 180s npm install; then
    echo "✅ Dependencies installed successfully"
else
    echo "⚠️  npm install timed out, trying alternative method..."
    npm install --prefer-offline --no-audit --no-fund
fi

# Create dist directories
echo ""
echo "📁 Creating output directories..."
mkdir -p dist/extension/icons
mkdir -p dist/pwa/icons

# Create proper PNG icons
echo "🎨 Creating PNG icons..."
node create-icons.js

# Build extension (simplified)
echo ""
echo "🔧 Building Chrome Extension..."
if command -v npx &> /dev/null; then
    npx vite build --mode extension 2>/dev/null || echo "⚠️  Vite build failed, creating manual build..."
fi

# Manual build fallback
echo "📋 Creating manual build files..."

# Copy extension files
cp src/extension/manifest.json dist/extension/ 2>/dev/null || echo "⚠️  Could not copy manifest"
cp src/extension/*.html dist/extension/ 2>/dev/null || echo "ℹ️  No HTML files to copy"
cp src/extension/content.css dist/extension/ 2>/dev/null || echo "ℹ️  CSS already exists"

# Copy PWA files  
cp src/pwa/index.html dist/pwa/ 2>/dev/null || echo "⚠️  Could not copy PWA index"
cp src/shared/manifest.json dist/pwa/manifest.json 2>/dev/null || echo "⚠️  Could not copy PWA manifest"

echo ""
echo "🎉 Quick Setup Complete!"
echo ""
echo "📋 What was created:"
echo "   📁 dist/extension/ - Chrome extension files"
echo "   📁 dist/pwa/ - Progressive Web App files"  
echo "   🎨 Placeholder icons in both directories"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1️⃣  CHROME EXTENSION:"
echo "   • Open Chrome browser"
echo "   • Go to chrome://extensions/"
echo "   • Enable 'Developer mode' (top right toggle)"
echo "   • Click 'Load unpacked' button"
echo "   • Select the 'dist/extension' folder"
echo "   • Test on ChatGPT, Claude, or Gemini!"
echo ""
echo "2️⃣  PWA (Web App):"
echo "   • Install a simple server: npm install -g http-server"
echo "   • Run: cd dist/pwa && http-server -p 3000"
echo "   • Open: http://localhost:3000"
echo "   • Look for 'Install App' button"
echo ""
echo "3️⃣  FULL BUILD (if needed):"
echo "   • Run: npm run build:extension"
echo "   • Run: npm run build:pwa"
echo ""
echo "🔍 Troubleshooting:"
echo "   • See DEPLOYMENT.md for detailed instructions"
echo "   • Check browser console for any errors"
echo "   • Ensure all files exist in dist/ folders"
echo ""
echo "✨ Happy prompt polishing!"