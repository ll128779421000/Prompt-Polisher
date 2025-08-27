#!/bin/bash

# Prompt Polisher Build Script
set -e

echo "🚀 Building Prompt Polisher..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist

# Install dependencies  
echo "📦 Installing dependencies..."
npm install

# Type checking
echo "🔍 Type checking..."
npm run type-check

# Linting
echo "✨ Linting code..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

# Build Extension
echo "🔧 Building Chrome Extension..."
npm run build:extension

# Build PWA
echo "🌐 Building PWA..."
npm run build:pwa

# Copy shared assets
echo "📋 Copying shared assets..."
mkdir -p dist/extension/icons dist/pwa/icons

# Create placeholder icons (in production, use real icons)
for size in 16 32 48 96 128 192 512; do
  # Create simple colored squares as placeholder icons
  echo "Creating ${size}x${size} icon..."
  # In production, you'd use actual icon files
  echo "<!-- ${size}x${size} icon placeholder -->" > dist/extension/icons/icon-${size}.png
  echo "<!-- ${size}x${size} icon placeholder -->" > dist/pwa/icons/icon-${size}.png
done

# Copy manifest files
cp src/extension/manifest.json dist/extension/
cp src/shared/manifest.json dist/pwa/manifest.json

# Generate build info
echo "📊 Generating build info..."
cat > dist/build-info.json << EOF
{
  "version": "1.0.0",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "environment": "production"
}
EOF

echo "✅ Build completed successfully!"
echo ""
echo "📁 Output:"
echo "  Chrome Extension: dist/extension/"
echo "  PWA: dist/pwa/"
echo ""
echo "🚀 Next steps:"
echo "  1. Load extension: chrome://extensions -> Load unpacked -> dist/extension"
echo "  2. Test PWA: serve dist/pwa with a local server"
echo "  3. Deploy PWA: upload dist/pwa to your web server"