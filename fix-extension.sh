#!/bin/bash

echo "🔧 Fixing Chrome Extension Issues..."

# Create icons directory
mkdir -p dist/extension/icons
mkdir -p dist/pwa/icons

# Generate minimal PNG icons
node create-icons.js

# Copy missing CSS file
cp src/extension/content.css dist/extension/ 2>/dev/null || echo "ℹ️  content.css already exists or not needed"

# Copy any missing HTML files
cp src/extension/*.html dist/extension/ 2>/dev/null || echo "ℹ️  HTML files already copied"

# Verify all required files exist
echo ""
echo "🔍 Verifying extension files..."

required_files=(
    "dist/extension/manifest.json"
    "dist/extension/background.js" 
    "dist/extension/content.js"
    "dist/extension/content.css"
    "dist/extension/popup.html"
    "dist/extension/options.html"
    "dist/extension/icons/icon-16.png"
    "dist/extension/icons/icon-32.png"
    "dist/extension/icons/icon-48.png"
    "dist/extension/icons/icon-128.png"
)

missing_files=()

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING"
        missing_files+=("$file")
    fi
done

echo ""
if [[ ${#missing_files[@]} -eq 0 ]]; then
    echo "🎉 All extension files are present!"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Open Chrome browser"
    echo "2. Go to chrome://extensions/"
    echo "3. Enable 'Developer mode' (toggle in top right)"
    echo "4. Click 'Load unpacked' button"
    echo "5. Select the 'dist/extension' folder"
    echo "6. Look for the Prompt Polisher extension in the list"
    echo "7. Test on ChatGPT or Claude!"
else
    echo "❌ Missing files found. Please run:"
    echo "   npm run build:extension"
    echo "   Then run this script again."
fi