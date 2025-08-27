# ✨ Prompt Polisher

A Chrome MV3 extension and lightweight PWA that automatically polishes your prompts for better AI interactions with intelligent language detection and response.

## 🎯 Features

### Core Functionality
- **Auto-Language Detection**: Detects the language of your prompt and ensures AI responds in the same language
- **Smart Prompt Analysis**: Identifies areas for improvement in clarity, specificity, structure, and examples
- **Expert Persona Suggestions**: Automatically suggests appropriate expert roles based on prompt content
- **Output Format Recommendations**: Suggests optimal response formats (lists, tables, step-by-step, etc.)
- **Real-time Improvement**: Shows before/after comparison with detailed explanations

### Chrome Extension
- **Universal Compatibility**: Works on ChatGPT, Claude, Gemini, Perplexity, and other AI platforms
- **Seamless Integration**: Adds "✨ Improve" buttons next to text inputs
- **Keyboard Shortcuts**: 
  - `Ctrl+Shift+I` - Improve current prompt
  - `Ctrl+Shift+T` - Toggle suggestions
- **Non-intrusive UI**: Buttons appear on focus, disappear when not needed
- **Confirmation Modal**: Review changes before applying with toggleable options

### PWA (Progressive Web App)
- **Share Target Support**: Receive shared text from other apps on mobile
- **Offline Functionality**: Local improvement rules when internet is unavailable
- **Prompt Library**: Save, search, and organize improved prompts
- **Cross-Platform**: Works on desktop and mobile browsers
- **Installable**: Add to home screen for native app experience

### Privacy & Security
- **Local Processing**: Core improvements work offline
- **User-Controlled API Keys**: You provide your own API keys for AI providers
- **No Data Collection**: All data stays on your device
- **Open Source**: Full transparency with audit-friendly code

## 🚀 Quick Start

### Chrome Extension Installation

1. **Download & Install**:
   ```bash
   git clone https://github.com/your-repo/prompt-polisher
   cd prompt-polisher
   npm install
   npm run build:extension
   ```

2. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/extension` folder

3. **First Use**:
   - Visit any AI chat platform (ChatGPT, Claude, etc.)
   - Look for the "✨ Improve" button next to text inputs
   - Try the keyboard shortcut `Ctrl+Shift+I`

### PWA Installation

1. **Build PWA**:
   ```bash
   npm run build:pwa
   ```

2. **Serve locally** (for testing):
   ```bash
   npm run preview
   ```

3. **Deploy**: Upload `dist/pwa` to your web server

4. **Install**: Visit the PWA in a browser and click "Install" when prompted

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome browser (for extension testing)

### Setup
```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Build specific targets
npm run build:extension
npm run build:pwa

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Project Structure
```
src/
├── types/           # TypeScript type definitions
├── utils/           # Core utilities
│   ├── languageDetector.ts
│   ├── promptImprover.ts
│   ├── offlineRules.ts
│   ├── storage.ts
│   └── providers.ts
├── extension/       # Chrome extension files
│   ├── manifest.json
│   ├── background.ts
│   ├── content.ts
│   ├── popup.html/ts
│   └── options.html/ts
├── pwa/            # PWA files
│   ├── index.html
│   └── app.ts
└── shared/         # Shared resources
    └── manifest.json
```

## 🔧 Configuration

### AI Providers

The system supports multiple AI providers:

1. **OpenAI** (GPT-3.5, GPT-4)
   - Get API key from [OpenAI Platform](https://platform.openai.com)
   - Add in extension options or PWA settings

2. **Anthropic** (Claude)
   - Get API key from [Anthropic Console](https://console.anthropic.com)
   - Configure in settings

3. **Local/Self-hosted**
   - Set up local LLM server (ollama, text-generation-webui, etc.)
   - Configure endpoint URL

4. **Offline Mode**
   - Uses built-in improvement rules
   - Works without internet connection
   - Fallback when API providers fail

### Extension Settings

Access via extension popup → Settings or `chrome://extensions/` → Prompt Polisher → Options:

- **Language Detection**: Auto-detect or force specific language
- **Suggestions**: Toggle persona, format, and example suggestions
- **Providers**: Configure API keys and endpoints
- **Shortcuts**: View/modify keyboard shortcuts
- **Data**: Export/import prompt library

## 📱 Usage Examples

### Basic Improvement
**Before**: "Help me write a blog post"
**After**: 
```
Act as a professional writer and editor.

I need you to write a blog post.

Context: [Please provide relevant background information]
Constraints: [Any limitations or requirements] 
Desired outcome: [What success looks like]

Format your response as a numbered list.
Please include 1-2 concrete examples to illustrate your points.
```

### Coding Assistance
**Before**: "Debug my code"
**After**:
```
Act as an experienced software engineer.

I need you to debug my code.

Context: [Programming language, error messages, expected behavior]
Constraints: [Performance requirements, library restrictions]
Desired outcome: [Working code with explanation]

Provide code examples with explanations.
```

### Language-Aware Responses
**Detected Spanish Input**: "Ayúdame a escribir un email profesional"
**Improved Output**: 
```
Responde en español.

Actúa como un escritor profesional.

Necesito que me ayudes a escribir un email profesional.
[Additional improvements in Spanish...]
```

## 🧪 Testing

Run the test suite:
```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (if implemented)
npm run test:e2e
```

### Manual Testing

1. **Extension Testing**:
   - Test on ChatGPT, Claude, Gemini
   - Verify button placement and functionality
   - Test keyboard shortcuts
   - Check modal interactions

2. **PWA Testing**:
   - Test share target functionality
   - Verify offline mode
   - Test installation flow
   - Check responsive design

3. **Cross-browser Testing**:
   - Chrome (primary)
   - Edge (Chromium)
   - Firefox (limited extension support)
   - Safari (PWA only)

## 🚀 Deployment

### Backend Service (Railway)

The backend service handles LLM API requests and provides a secure proxy for API keys.

1. **Railway Setup**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Link to your Railway project
   railway link
   ```

2. **Environment Variables**:
   ```bash
   # Set required environment variables in Railway dashboard
   railway variables set NODE_ENV=production
   railway variables set PORT=8080
   railway variables set OPENAI_API_KEY=sk-your-actual-openai-key
   railway variables set JWT_SECRET=your-secure-32-plus-character-secret
   railway variables set STRIPE_SECRET_KEY=sk-your-stripe-key
   ```

3. **Deploy**:
   ```bash
   # Deploy to Railway
   railway deploy
   
   # Check logs
   railway logs
   ```

4. **Custom Domain** (Optional):
   - Add your domain in Railway dashboard
   - Update FRONTEND_URL environment variable

### Chrome Web Store
1. Create developer account
2. Prepare store assets (icons, screenshots, descriptions)
3. Build extension: `npm run build:extension`
4. Upload `dist/extension` folder as zip
5. Submit for review

### PWA Deployment
1. Build production PWA: `npm run build:pwa`
2. Deploy to your web server or CDN
3. Ensure HTTPS for full PWA features
4. Test installation and share target

### Local Development with Backend

```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..

# Start development servers
npm run dev

# Or start individually:
npm run dev:backend    # Backend API server
npm run dev:extension  # Extension development
npm run dev:pwa        # PWA development
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Create Pull Request

### Development Guidelines

- **TypeScript**: All code should be properly typed
- **Testing**: Add tests for new features
- **Performance**: Keep bundle size minimal
- **Accessibility**: Follow WCAG guidelines
- **Privacy**: No tracking or analytics
- **Security**: Validate all inputs, use CSP

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Language detection algorithms inspired by various open-source projects
- UI/UX patterns from modern web applications
- Chrome extension patterns from official documentation
- PWA best practices from web.dev

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/prompt-polisher/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/prompt-polisher/discussions)
- **Email**: support@promptpolisher.com

## 🗺️ Roadmap

- [ ] Firefox extension support
- [ ] More AI provider integrations
- [ ] Advanced prompt templates
- [ ] Collaborative prompt sharing
- [ ] Analytics dashboard (privacy-preserving)
- [ ] Mobile app versions

---

**Made with ❤️ for better AI interactions**