# 🔧 **TROUBLESHOOTING GUIDE**

## **Chrome Extension Issues** 🌐

### ❌ **"Could not load icon" Error**
**Problem**: Extension fails to load with icon errors

**Solution**:
```bash
# Run the fix script
./fix-extension.sh

# Or manually create icons:
node create-icons.js
```

**What it does**: Creates minimal valid PNG files for all required icon sizes.

---

### ❌ **"Could not load manifest" Error**
**Problem**: Manifest.json file issues

**Check**: 
1. File exists: `ls dist/extension/manifest.json`
2. Valid JSON: `cat dist/extension/manifest.json`

**Fix**:
```bash
# Copy manifest from source
cp src/extension/manifest.json dist/extension/

# Or rebuild
npm run build:extension
```

---

### ❌ **Content Script Not Working**
**Problem**: "✨ Improve" buttons don't appear on websites

**Checklist**:
```bash
# 1. Verify files exist
ls dist/extension/content.js
ls dist/extension/content.css

# 2. Check browser console (F12) for errors
# 3. Try reloading extension in chrome://extensions/
# 4. Test on different sites (ChatGPT, Claude)
```

**Fix**:
```bash
# Copy missing CSS file
cp src/extension/content.css dist/extension/

# Reload extension in Chrome
```

---

### ❌ **Extension Loads But Doesn't Work**
**Problem**: Extension appears but no functionality

**Debug Steps**:
1. **Check Extension Popup**: Click extension icon in toolbar
2. **Check Console**: Right-click extension → Inspect popup → Console tab
3. **Check Permissions**: Extension should have "activeTab" permission
4. **Test Sites**: Try on https://chat.openai.com

**Common Fixes**:
```bash
# Rebuild completely
rm -rf dist/extension
npm run build:extension
./fix-extension.sh
```

---

## **Build Issues** 🛠️

### ❌ **npm install Timeout**
**Problem**: Dependencies installation hangs

**Solutions**:
```bash
# Option 1: Increase timeout
npm install --timeout=300000

# Option 2: Use yarn instead
yarn install

# Option 3: Offline mode
npm install --prefer-offline --no-audit

# Option 4: Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

### ❌ **Build Command Fails**
**Problem**: `npm run build:extension` errors

**Debug**:
```bash
# Check if TypeScript compiles
npm run type-check

# Check for lint errors  
npm run lint

# Try manual build
npx vite build --mode extension
```

**Common Issues**:
- **TypeScript errors**: Fix type issues in source files
- **Missing dependencies**: Run `npm install`
- **Path issues**: Ensure you're in project root

---

## **PWA Issues** 📱

### ❌ **PWA Won't Install**
**Problem**: No install prompt or install fails

**Requirements**:
- ✅ HTTPS (required for PWA features)
- ✅ Valid manifest.json
- ✅ Service worker registered
- ✅ Proper icons

**Check**:
1. **Chrome DevTools** → Application → Manifest
2. **Service Worker** tab shows registration
3. **Icons** are accessible

**Fix**:
```bash
# Ensure all PWA files exist
ls dist/pwa/index.html
ls dist/pwa/manifest.json
ls dist/pwa/icons/icon-192.png

# Test locally with HTTPS
npx http-server dist/pwa -p 3000 -S
```

---

## **Development Issues** 💻

### ❌ **TypeScript Errors**
```bash
# Check specific errors
npm run type-check

# Common fixes:
# 1. Install missing @types packages
# 2. Check import paths
# 3. Verify tsconfig.json is correct
```

### ❌ **Import/Export Issues**
```bash
# Check module type in package.json
grep "type.*module" package.json

# Ensure all imports use .js extensions in built files
# Verify vite.config.ts settings
```

---

## **Testing Extension** 🧪

### **Quick Test Checklist**:

1. **Load Extension**:
   - ✅ Loads without errors in chrome://extensions/
   - ✅ Shows in extensions toolbar

2. **Visit ChatGPT**:
   - ✅ Go to https://chat.openai.com
   - ✅ Look for "✨ Improve" button near text input
   - ✅ Button appears on focus/hover

3. **Test Functionality**:
   - ✅ Click improve button shows modal
   - ✅ Keyboard shortcut `Ctrl+Shift+I` works
   - ✅ Can apply improved prompt
   - ✅ Can copy to clipboard

4. **Test Other Sites**:
   - ✅ Claude.ai
   - ✅ Gemini (bard.google.com)
   - ✅ Any site with textareas

---

## **Quick Fixes** ⚡

### **Complete Reset**:
```bash
# Nuclear option - start fresh
rm -rf dist node_modules package-lock.json
npm install
npm run build:extension
npm run build:pwa
./fix-extension.sh
```

### **Extension Only Reset**:
```bash
# Just fix extension issues
rm -rf dist/extension
npm run build:extension
./fix-extension.sh
```

### **Manual File Check**:
```bash
# Verify all required files
./fix-extension.sh

# Should show all ✅ checkmarks
```

---

## **Get Help** 💬

1. **Check Browser Console**: F12 → Console tab for JavaScript errors
2. **Check Extension Console**: Right-click extension icon → Inspect popup
3. **Chrome Extensions Page**: chrome://extensions/ → Details → Inspect views
4. **Check File Permissions**: Ensure all files in dist/ are readable

**Still Having Issues?**
- Run `./fix-extension.sh` and check output
- Verify you're using Chrome (not Firefox/Safari)
- Try incognito mode to rule out other extensions
- Check if any antivirus is blocking files

---

## **Success Criteria** ✅

Your extension is working correctly when:
- ✅ Loads without errors in chrome://extensions/
- ✅ Shows "✨ Improve" buttons on ChatGPT/Claude
- ✅ Clicking button opens improvement modal
- ✅ Can apply changes to text input
- ✅ Keyboard shortcuts work (`Ctrl+Shift+I`)
- ✅ Extension popup opens with stats/settings

**Ready to use!** 🎉