# Prompt Polisher Component Specifications

## Component Interaction Diagrams

### Chrome Extension Component Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │   Service        │    │   Popup/Panel  │
│   Scripts       │◄──►│   Worker         │◄──►│   UI            │
│                 │    │                  │    │                 │
│ • Prompt        │    │ • API Calls      │    │ • Settings      │
│   Injection     │    │ • Data Storage   │    │ • Quick Access  │
│ • UI Overlay    │    │ • Background     │    │ • Library View  │
│ • Event         │    │   Processing     │    │                 │
│   Handling      │    │ • Auth Mgmt      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                 ┌──────────────────┐
                 │   IndexedDB      │
                 │   Storage        │
                 │                  │
                 │ • Prompts        │
                 │ • Templates      │
                 │ • Settings       │
                 │ • Cache          │
                 └──────────────────┘
```

### PWA Component Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   App Shell     │    │   Service        │    │   Core Modules  │
│                 │    │   Worker         │    │                 │
│ • Header        │    │                  │    │ • Prompt Editor │
│ • Navigation    │◄──►│ • Cache Mgmt     │◄──►│ • Analyzer      │
│ • Footer        │    │ • Background     │    │ • Library       │
│ • Theme         │    │   Sync           │    │ • Settings      │
│                 │    │ • Share Target   │    │ • Templates     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                 ┌──────────────────┐
                 │   Shared Storage │
                 │   (IndexedDB)    │
                 │                  │
                 │ • Cross-platform │
                 │   Data Sync      │
                 └──────────────────┘
```

## Detailed Component Specifications

### 1. Chrome Extension Components

#### Service Worker (background.js)

```typescript
// Core service worker responsibilities
class PromptPolisherServiceWorker {
  private apiManager: APIManager;
  private storageManager: StorageManager;
  private messageHandler: MessageHandler;

  async initialize() {
    // Initialize API clients
    this.apiManager = new APIManager();
    this.storageManager = new StorageManager();
    this.messageHandler = new MessageHandler();

    // Set up message listeners
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Initialize background tasks
    this.setupPeriodicTasks();
  }

  async handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender) {
    switch (message.type) {
      case 'ANALYZE_PROMPT':
        return await this.analyzePrompt(message.data);
      case 'IMPROVE_PROMPT':
        return await this.improvePrompt(message.data);
      case 'SAVE_PROMPT':
        return await this.savePrompt(message.data);
      case 'GET_TEMPLATES':
        return await this.getTemplates(message.data);
    }
  }

  private async analyzePrompt(data: PromptAnalysisRequest): Promise<AnalysisResult> {
    // Implementation details
  }
}
```

#### Content Script (content.js)

```typescript
class PromptInterceptor {
  private overlayManager: OverlayManager;
  private promptDetector: PromptDetector;
  private enhancementUI: EnhancementUI;

  constructor() {
    this.overlayManager = new OverlayManager();
    this.promptDetector = new PromptDetector();
    this.enhancementUI = new EnhancementUI();
  }

  initialize() {
    // Detect supported chat interfaces
    const platform = this.detectPlatform();
    
    // Inject prompt enhancement UI
    this.injectEnhancementInterface(platform);
    
    // Set up prompt interception
    this.setupPromptInterception(platform);
    
    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private detectPlatform(): ChatPlatform {
    // Platform detection logic
  }

  private injectEnhancementInterface(platform: ChatPlatform) {
    // UI injection logic
  }
}
```

### 2. PWA Components

#### App Shell (app-shell.ts)

```typescript
class AppShell {
  private router: Router;
  private themeManager: ThemeManager;
  private i18nManager: InternationalizationManager;

  constructor() {
    this.router = new Router();
    this.themeManager = new ThemeManager();
    this.i18nManager = new InternationalizationManager();
  }

  async initialize() {
    // Initialize routing
    await this.setupRouting();
    
    // Load user preferences
    await this.loadUserPreferences();
    
    // Initialize theme
    await this.themeManager.initialize();
    
    // Setup internationalization
    await this.i18nManager.initialize();
    
    // Register service worker
    await this.registerServiceWorker();
  }

  private async setupRouting() {
    this.router.register('/editor', () => import('./components/PromptEditor'));
    this.router.register('/library', () => import('./components/PromptLibrary'));
    this.router.register('/settings', () => import('./components/Settings'));
    this.router.register('/analyze', () => import('./components/AnalysisDashboard'));
  }
}
```

#### Prompt Editor Component

```typescript
class PromptEditor {
  private editor: CodeMirror.Editor;
  private analyzer: PromptAnalyzer;
  private suggestionEngine: SuggestionEngine;
  private realTimeAnalysis: boolean = true;

  constructor(container: HTMLElement) {
    this.initializeEditor(container);
    this.analyzer = new PromptAnalyzer();
    this.suggestionEngine = new SuggestionEngine();
  }

  private initializeEditor(container: HTMLElement) {
    this.editor = CodeMirror(container, {
      mode: 'prompt',
      theme: 'prompt-polisher',
      lineNumbers: false,
      lineWrapping: true,
      placeholder: 'Enter your prompt here...',
    });

    // Set up real-time analysis
    this.editor.on('change', debounce(this.onContentChange.bind(this), 500));
  }

  private async onContentChange() {
    if (!this.realTimeAnalysis) return;

    const content = this.editor.getValue();
    
    // Perform analysis
    const analysis = await this.analyzer.analyze(content);
    
    // Update UI with suggestions
    this.displaySuggestions(analysis);
    
    // Update quality indicators
    this.updateQualityIndicators(analysis);
  }
}
```

### 3. Storage Components

#### IndexedDB Manager

```typescript
class StorageManager {
  private db: IDBDatabase;
  private version: number = 1;
  private dbName: string = 'PromptPolisher';

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores();
      };
    });
  }

  private createObjectStores(): void {
    // Prompts store
    if (!this.db.objectStoreNames.contains('prompts')) {
      const promptStore = this.db.createObjectStore('prompts', { keyPath: 'id' });
      promptStore.createIndex('category', 'category', { unique: false });
      promptStore.createIndex('createdAt', 'createdAt', { unique: false });
      promptStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
    }

    // Templates store
    if (!this.db.objectStoreNames.contains('templates')) {
      const templateStore = this.db.createObjectStore('templates', { keyPath: 'id' });
      templateStore.createIndex('category', 'category', { unique: false });
    }

    // Settings store
    if (!this.db.objectStoreNames.contains('settings')) {
      this.db.createObjectStore('settings', { keyPath: 'id' });
    }

    // Cache store
    if (!this.db.objectStoreNames.contains('cache')) {
      const cacheStore = this.db.createObjectStore('cache', { keyPath: 'key' });
      cacheStore.createIndex('expiry', 'expiry', { unique: false });
    }
  }

  // CRUD operations for each store
  async savePrompt(prompt: PromptRecord): Promise<void> {
    return this.performTransaction('prompts', 'readwrite', (store) => {
      store.put(prompt);
    });
  }

  async getPrompts(filter?: PromptFilter): Promise<PromptRecord[]> {
    // Implementation with filtering support
  }
}
```

### 4. Analysis Engine Components

#### Prompt Analyzer

```typescript
class PromptAnalyzer {
  private languageDetector: LanguageDetector;
  private intentClassifier: IntentClassifier;
  private qualityAssessor: QualityAssessor;
  private structureAnalyzer: StructureAnalyzer;

  constructor() {
    this.languageDetector = new LanguageDetector();
    this.intentClassifier = new IntentClassifier();
    this.qualityAssessor = new QualityAssessor();
    this.structureAnalyzer = new StructureAnalyzer();
  }

  async analyze(prompt: string): Promise<AnalysisResult> {
    // Detect language
    const language = await this.languageDetector.detect(prompt);

    // Classify intent
    const intent = await this.intentClassifier.classify(prompt);

    // Assess quality
    const quality = await this.qualityAssessor.assess(prompt);

    // Analyze structure
    const structure = await this.structureAnalyzer.analyze(prompt);

    return {
      language,
      intent,
      quality,
      structure,
      suggestions: await this.generateSuggestions(prompt, { language, intent, quality, structure }),
      metadata: {
        wordCount: prompt.split(' ').length,
        characterCount: prompt.length,
        complexity: this.calculateComplexity(prompt),
        readabilityScore: this.calculateReadability(prompt),
      }
    };
  }

  private async generateSuggestions(prompt: string, analysis: Partial<AnalysisResult>): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Grammar suggestions
    suggestions.push(...await this.getGrammarSuggestions(prompt));

    // Clarity suggestions
    suggestions.push(...await this.getClaritySuggestions(prompt, analysis));

    // Structure suggestions
    suggestions.push(...await this.getStructureSuggestions(prompt, analysis));

    // Specificity suggestions
    suggestions.push(...await this.getSpecificitySuggestions(prompt, analysis));

    return suggestions.sort((a, b) => b.importance - a.importance);
  }
}
```

### 5. Provider Integration Components

#### Provider Adapter Interface

```typescript
abstract class ProviderAdapter {
  abstract name: string;
  abstract maxTokens: number;
  abstract rateLimit: RateLimitConfig;

  abstract authenticate(credentials: ProviderCredentials): Promise<boolean>;
  abstract analyzePrompt(prompt: string, options: AnalysisOptions): Promise<AnalysisResult>;
  abstract improvePrompt(prompt: string, context: ImprovementContext): Promise<string>;
  abstract translatePrompt(prompt: string, targetLanguage: string): Promise<string>;

  // Common functionality
  protected async makeRequest(endpoint: string, data: any): Promise<any> {
    // Common request logic with retry and error handling
  }

  protected handleRateLimit(): Promise<void> {
    // Rate limiting logic
  }

  protected validateResponse(response: any): boolean {
    // Response validation logic
  }
}
```

#### OpenAI Provider Implementation

```typescript
class OpenAIProvider extends ProviderAdapter {
  name = 'OpenAI';
  maxTokens = 4000;
  rateLimit = { requestsPerMinute: 60, tokensPerMinute: 90000 };

  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  async authenticate(credentials: ProviderCredentials): Promise<boolean> {
    this.apiKey = credentials.apiKey;
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async analyzePrompt(prompt: string, options: AnalysisOptions): Promise<AnalysisResult> {
    const messages = [
      {
        role: 'system',
        content: 'You are a prompt analysis expert. Analyze the given prompt and provide structured feedback.'
      },
      {
        role: 'user',
        content: `Analyze this prompt: "${prompt}"`
      }
    ];

    const response = await this.makeRequest('/chat/completions', {
      model: 'gpt-4',
      messages,
      temperature: 0.1,
      max_tokens: 1000
    });

    return this.parseAnalysisResponse(response);
  }

  async improvePrompt(prompt: string, context: ImprovementContext): Promise<string> {
    // Implementation for prompt improvement
  }
}
```

### 6. Offline Components

#### Local Rewrite Engine

```typescript
class LocalRewriteEngine {
  private rules: Map<string, RewriteRule[]> = new Map();
  private grammarChecker: GrammarChecker;

  constructor() {
    this.grammarChecker = new GrammarChecker();
    this.loadBuiltInRules();
  }

  private loadBuiltInRules(): void {
    // Load grammar rules
    this.addRules('grammar', [
      {
        id: 'fix-its-vs-its',
        pattern: /\bit's\b(?=\s+\w+(?:\s+\w+)*\s+(?:is|are|was|were|will|can|could|should|would))/gi,
        replacement: 'its',
        category: 'grammar',
        language: 'en',
        confidence: 0.9
      },
      // More grammar rules...
    ]);

    // Load clarity rules
    this.addRules('clarity', [
      {
        id: 'remove-filler-words',
        pattern: /\b(?:um|uh|like|you know|sort of|kind of)\b/gi,
        replacement: '',
        category: 'clarity',
        language: 'en',
        confidence: 0.8
      },
      // More clarity rules...
    ]);

    // Load structure rules
    this.addRules('structure', [
      {
        id: 'add-context-prompt',
        pattern: /^(?!.*context)(.+)$/i,
        replacement: (match) => `Context: Please help me with the following task.\n\nTask: ${match}`,
        category: 'structure',
        language: 'en',
        confidence: 0.6
      },
      // More structure rules...
    ]);
  }

  async improve(prompt: string, options: LocalImprovementOptions): Promise<ImprovementResult> {
    let improvedPrompt = prompt;
    const appliedRules: AppliedRule[] = [];

    // Apply grammar rules
    if (options.includeGrammar) {
      const grammarResult = await this.applyRules(improvedPrompt, 'grammar');
      improvedPrompt = grammarResult.text;
      appliedRules.push(...grammarResult.appliedRules);
    }

    // Apply clarity rules
    if (options.includeClarity) {
      const clarityResult = await this.applyRules(improvedPrompt, 'clarity');
      improvedPrompt = clarityResult.text;
      appliedRules.push(...clarityResult.appliedRules);
    }

    // Apply structure rules
    if (options.includeStructure) {
      const structureResult = await this.applyRules(improvedPrompt, 'structure');
      improvedPrompt = structureResult.text;
      appliedRules.push(...structureResult.appliedRules);
    }

    return {
      originalPrompt: prompt,
      improvedPrompt,
      appliedRules,
      confidence: this.calculateOverallConfidence(appliedRules),
      suggestions: await this.generateAdditionalSuggestions(improvedPrompt)
    };
  }

  private async applyRules(text: string, category: string): Promise<RuleApplicationResult> {
    const rules = this.rules.get(category) || [];
    let modifiedText = text;
    const appliedRules: AppliedRule[] = [];

    for (const rule of rules) {
      const matches = text.match(rule.pattern);
      if (matches) {
        const before = modifiedText;
        modifiedText = modifiedText.replace(rule.pattern, rule.replacement);
        
        if (before !== modifiedText) {
          appliedRules.push({
            ruleId: rule.id,
            category: rule.category,
            before,
            after: modifiedText,
            confidence: rule.confidence
          });
        }
      }
    }

    return {
      text: modifiedText,
      appliedRules
    };
  }
}
```

## Message Passing Architecture

### Extension Message Types

```typescript
type ExtensionMessage = 
  | { type: 'ANALYZE_PROMPT'; data: PromptAnalysisRequest }
  | { type: 'IMPROVE_PROMPT'; data: PromptImprovementRequest }
  | { type: 'SAVE_PROMPT'; data: SavePromptRequest }
  | { type: 'GET_TEMPLATES'; data: GetTemplatesRequest }
  | { type: 'UPDATE_SETTINGS'; data: UpdateSettingsRequest }
  | { type: 'SYNC_DATA'; data: SyncDataRequest };

interface MessageHandler {
  handle<T extends ExtensionMessage>(message: T): Promise<any>;
}
```

### Cross-Platform Communication

```typescript
class CrossPlatformBridge {
  private eventBus: EventBus;
  
  constructor() {
    this.eventBus = new EventBus();
  }

  // Extension to PWA communication
  async sendToPWA(data: SharedPromptData): Promise<void> {
    // Method 1: URL parameters (for direct navigation)
    const url = new URL('/editor', window.location.origin);
    url.searchParams.set('prompt', encodeURIComponent(JSON.stringify(data)));
    window.open(url.toString());

    // Method 2: PostMessage (for existing PWA windows)
    const pwaWindows = await this.getPWAWindows();
    pwaWindows.forEach(window => {
      window.postMessage({ type: 'PROMPT_SHARED', data }, '*');
    });
  }

  // PWA to Extension communication
  async sendToExtension(data: any): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime.sendMessage(data);
    } else {
      // Fallback for when extension is not available
      throw new Error('Extension not available');
    }
  }
}
```

This comprehensive component specification provides detailed implementation guidance for each major component of the Prompt Polisher system, ensuring proper separation of concerns and extensible architecture.