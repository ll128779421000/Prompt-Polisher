#!/usr/bin/env node

// Quick verification script for Prompt Polisher
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🔍 Verifying Prompt Polisher Project...\n')

// Check essential files
const essentialFiles = [
  'package.json',
  'vite.config.ts',
  'src/extension/manifest.json',
  'src/extension/background.ts',
  'src/extension/content.ts',
  'src/pwa/index.html',
  'src/pwa/app.ts',
  'src/utils/languageDetector.ts',
  'src/utils/promptImprover.ts',
  'src/types/index.ts'
]

let missingFiles = []
let validFiles = []

essentialFiles.forEach(file => {
  const filePath = join(__dirname, file)
  if (existsSync(filePath)) {
    validFiles.push(file)
    console.log(`✅ ${file}`)
  } else {
    missingFiles.push(file)
    console.log(`❌ ${file} - MISSING`)
  }
})

console.log(`\n📊 Summary:`)
console.log(`✅ Valid files: ${validFiles.length}/${essentialFiles.length}`)
if (missingFiles.length > 0) {
  console.log(`❌ Missing files: ${missingFiles.length}`)
  console.log(`Missing: ${missingFiles.join(', ')}`)
}

// Check package.json structure
if (existsSync(join(__dirname, 'package.json'))) {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
    console.log(`\n📦 Package Info:`)
    console.log(`   Name: ${pkg.name}`)
    console.log(`   Version: ${pkg.version}`)
    console.log(`   Scripts: ${Object.keys(pkg.scripts || {}).join(', ')}`)
    
    // Check if essential dependencies exist
    const deps = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})}
    const requiredDeps = ['vite', 'typescript', 'dexie']
    const missingDeps = requiredDeps.filter(dep => !deps[dep])
    
    if (missingDeps.length === 0) {
      console.log(`   Dependencies: ✅ All essential deps present`)
    } else {
      console.log(`   Dependencies: ❌ Missing: ${missingDeps.join(', ')}`)
    }
  } catch (e) {
    console.log(`❌ package.json parse error: ${e.message}`)
  }
}

// Check TypeScript configuration
if (existsSync(join(__dirname, 'tsconfig.json'))) {
  console.log(`✅ TypeScript configuration present`)
} else {
  console.log(`❌ tsconfig.json missing`)
}

console.log(`\n🚀 Next Steps:`)
if (missingFiles.length === 0) {
  console.log(`1. Run: npm install`)
  console.log(`2. Run: npm run build:extension`)  
  console.log(`3. Run: npm run build:pwa`)
  console.log(`4. Load extension from dist/extension/ in Chrome`)
  console.log(`5. Serve PWA from dist/pwa/`)
} else {
  console.log(`❌ Fix missing files first, then run this verification again`)
}

console.log(`\n📖 See DEPLOYMENT.md for detailed instructions`)