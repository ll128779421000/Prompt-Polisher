# Data Models and API Specifications

## Core Data Models

### Prompt-Related Models

```typescript
interface PromptRecord {
  id: string;                    // UUID
  title: string;                 // User-defined title
  content: string;               // The actual prompt text
  originalContent?: string;      // Original before improvements
  category: PromptCategory;      // Classification category
  tags: string[];               // User-defined tags
  language: string;             // ISO 639-1 language code
  createdAt: Date;              // Creation timestamp
  updatedAt: Date;              // Last modification timestamp
  usageCount: number;           // How many times used
  rating?: number;              // User rating (1-5)
  provider?: string;            // Last used provider
  isBookmarked: boolean;        // Favorited status
  metadata: PromptMetadata;     // Analysis results and metrics
  shareSettings: ShareSettings; // Privacy and sharing config
}

interface PromptMetadata {
  wordCount: number;
  characterCount: number;
  complexity: number;           // 0-1 scale
  readabilityScore: number;     // Flesch reading ease
  intent: PromptIntent;
  structure: PromptStructure;
  qualityScore: number;         // Overall quality (0-100)
  improvements: string[];       // Applied improvement types
  analysisVersion: string;      // Version of analysis engine used
  lastAnalyzed: Date;
}

enum PromptCategory {
  CREATIVE = 'creative',
  ANALYTICAL = 'analytical',
  INSTRUCTIONAL = 'instructional',
  CONVERSATIONAL = 'conversational',
  TECHNICAL = 'technical',
  EDUCATIONAL = 'educational',
  BUSINESS = 'business',
  OTHER = 'other'
}

enum PromptIntent {
  QUESTION = 'question',
  COMMAND = 'command',
  REQUEST = 'request',
  INSTRUCTION = 'instruction',
  BRAINSTORM = 'brainstorm',
  ANALYZE = 'analyze',
  CREATE = 'create',
  EXPLAIN = 'explain',
  SUMMARIZE = 'summarize',
  TRANSLATE = 'translate'
}

interface PromptStructure {
  hasContext: boolean;
  hasConstraints: boolean;
  hasExamples: boolean;
  hasFormat: boolean;
  hasTone: boolean;
  hasRole: boolean;
  sections: StructureSection[];
}

interface StructureSection {
  type: 'context' | 'task' | 'constraint' | 'example' | 'format' | 'tone' | 'role';
  content: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

interface ShareSettings {
  isPublic: boolean;
  allowCopy: boolean;
  allowModification: boolean;
  expiresAt?: Date;
  sharedWith: string[];         // User IDs or emails
}
```

### Template Models

```typescript
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  template: string;             // Template with variables
  variables: TemplateVariable[];
  examples: TemplateExample[];
  isBuiltIn: boolean;
  createdBy?: string;           // User ID for custom templates
  usageCount: number;
  rating: number;
  tags: string[];
  language: string;
  version: string;
  lastUpdated: Date;
}

interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multitext';
  required: boolean;
  defaultValue?: any;
  options?: string[];           // For select type
  placeholder?: string;
  validation?: ValidationRule;
}

interface TemplateExample {
  name: string;
  description: string;
  variables: Record<string, any>;
  expectedOutput?: string;
}

interface ValidationRule {
  pattern?: string;             // Regex pattern
  minLength?: number;
  maxLength?: number;
  min?: number;                // For numeric values
  max?: number;
}
```

### Analysis Models

```typescript
interface AnalysisResult {
  id: string;
  promptId: string;
  language: string;
  intent: PromptIntent;
  quality: QualityAssessment;
  structure: PromptStructure;
  suggestions: Suggestion[];
  metadata: AnalysisMetadata;
  createdAt: Date;
  provider: string;             // Which provider performed analysis
}

interface QualityAssessment {
  overallScore: number;         // 0-100
  clarity: number;              // 0-100
  specificity: number;          // 0-100
  completeness: number;         // 0-100
  effectiveness: number;        // 0-100
  grammar: number;              // 0-100
  readability: number;          // 0-100
  issues: QualityIssue[];
}

interface QualityIssue {
  type: 'grammar' | 'clarity' | 'specificity' | 'structure' | 'completeness';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  position?: TextPosition;
  suggestion?: string;
  confidence: number;
}

interface TextPosition {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  before: string;
  after: string;
  position?: TextPosition;
  importance: number;           // 0-1 scale
  confidence: number;           // 0-1 scale
  category: 'grammar' | 'style' | 'structure' | 'content' | 'clarity';
  automated: boolean;           // Can be auto-applied
  reasoning?: string;
}

enum SuggestionType {
  GRAMMAR_FIX = 'grammar_fix',
  CLARITY_IMPROVEMENT = 'clarity_improvement',
  STRUCTURE_ENHANCEMENT = 'structure_enhancement',
  SPECIFICITY_ADDITION = 'specificity_addition',
  CONTEXT_ADDITION = 'context_addition',
  CONSTRAINT_ADDITION = 'constraint_addition',
  EXAMPLE_ADDITION = 'example_addition',
  TONE_ADJUSTMENT = 'tone_adjustment',
  FORMAT_SPECIFICATION = 'format_specification'
}

interface AnalysisMetadata {
  processingTime: number;       // milliseconds
  tokensUsed?: number;
  model?: string;
  version: string;
  features: string[];           // Which analysis features were used
}
```

### User and Settings Models

```typescript
interface UserSettings {
  id: string;
  language: string;             // UI language
  theme: 'light' | 'dark' | 'auto';
  providers: ProviderConfig[];
  preferences: UserPreferences;
  features: FeatureFlags;
  privacy: PrivacySettings;
  shortcuts: KeyboardShortcuts;
  lastSyncAt?: Date;
}

interface ProviderConfig {
  name: string;
  enabled: boolean;
  credentials: ProviderCredentials;
  settings: ProviderSettings;
  priority: number;             // Provider preference order
}

interface ProviderCredentials {
  apiKey?: string;
  endpoint?: string;
  organizationId?: string;
  model?: string;
}

interface ProviderSettings {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  timeout?: number;
  retryAttempts?: number;
  fallbackEnabled?: boolean;
}

interface UserPreferences {
  autoAnalyze: boolean;
  realTimeAnalysis: boolean;
  autoSuggest: boolean;
  autoApplyGrammar: boolean;
  confirmBeforeApply: boolean;
  saveHistory: boolean;
  enableNotifications: boolean;
  defaultCategory: PromptCategory;
  defaultProvider: string;
  analysisDepth: 'basic' | 'standard' | 'detailed';
  languageDetection: 'auto' | 'manual';
}

interface FeatureFlags {
  betaFeatures: boolean;
  experimentalAnalysis: boolean;
  cloudSync: boolean;
  collaboration: boolean;
  advancedTemplates: boolean;
  customProviders: boolean;
}

interface PrivacySettings {
  shareUsageData: boolean;
  allowTelemetry: boolean;
  savePromptsLocally: boolean;
  autoDeleteAfterDays?: number;
  encryptSensitiveData: boolean;
}

interface KeyboardShortcuts {
  analyze: string;              // e.g., "Ctrl+A"
  improve: string;
  save: string;
  newPrompt: string;
  search: string;
  toggleSidebar: string;
  [key: string]: string;
}
```

### Cache and Storage Models

```typescript
interface CacheRecord {
  key: string;
  data: any;
  expiry: Date;
  type: CacheType;
  size: number;                 // bytes
  hits: number;
  lastAccessed: Date;
}

enum CacheType {
  ANALYSIS_RESULT = 'analysis_result',
  IMPROVEMENT_SUGGESTION = 'improvement_suggestion',
  TRANSLATION = 'translation',
  TEMPLATE = 'template',
  PROVIDER_RESPONSE = 'provider_response',
  USER_PREFERENCE = 'user_preference'
}

interface StorageQuota {
  used: number;                 // bytes
  available: number;            // bytes
  total: number;                // bytes
  quotaExceeded: boolean;
}

interface SyncRecord {
  id: string;
  type: 'prompt' | 'template' | 'settings';
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  data: any;
  synced: boolean;
  conflictResolution?: 'local' | 'remote' | 'manual';
}
```

## API Specifications

### Internal API (Extension/PWA Communication)

#### Message Types

```typescript
// Request/Response types for internal communication
interface APIRequest<T = any> {
  id: string;
  type: string;
  data: T;
  timestamp: Date;
  source: 'extension' | 'pwa';
}

interface APIResponse<T = any> {
  id: string;                   // Matches request ID
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
}

interface APIError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

// Specific request types
interface AnalyzePromptRequest {
  prompt: string;
  options: AnalysisOptions;
  provider?: string;
  language?: string;
}

interface AnalysisOptions {
  includeGrammar: boolean;
  includeStyle: boolean;
  includeStructure: boolean;
  includeContent: boolean;
  depth: 'basic' | 'standard' | 'detailed';
  realTime: boolean;
}

interface ImprovePromptRequest {
  prompt: string;
  suggestions: string[];        // Which suggestions to apply
  provider?: string;
  context?: ImprovementContext;
}

interface ImprovementContext {
  targetAudience?: string;
  desiredTone?: string;
  outputFormat?: string;
  constraints?: string[];
  examples?: string[];
}

interface SavePromptRequest {
  prompt: Partial<PromptRecord>;
  overwrite?: boolean;
}

interface SearchPromptsRequest {
  query?: string;
  filters: PromptFilter;
  sort: SortOptions;
  pagination: PaginationOptions;
}

interface PromptFilter {
  category?: PromptCategory;
  tags?: string[];
  language?: string;
  dateRange?: DateRange;
  qualityRange?: NumberRange;
  provider?: string;
  hasImprovements?: boolean;
}

interface DateRange {
  start?: Date;
  end?: Date;
}

interface NumberRange {
  min?: number;
  max?: number;
}

interface SortOptions {
  field: 'createdAt' | 'updatedAt' | 'usageCount' | 'quality' | 'title';
  direction: 'asc' | 'desc';
}

interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}
```

#### API Endpoints (Internal)

```typescript
class InternalAPI {
  // Prompt management
  async analyzePrompt(request: AnalyzePromptRequest): Promise<AnalysisResult>;
  async improvePrompt(request: ImprovePromptRequest): Promise<string>;
  async savePrompt(request: SavePromptRequest): Promise<PromptRecord>;
  async getPrompt(id: string): Promise<PromptRecord>;
  async updatePrompt(id: string, updates: Partial<PromptRecord>): Promise<PromptRecord>;
  async deletePrompt(id: string): Promise<void>;
  async searchPrompts(request: SearchPromptsRequest): Promise<PaginatedResponse<PromptRecord>>;
  async duplicatePrompt(id: string, title?: string): Promise<PromptRecord>;

  // Template management
  async getTemplates(category?: PromptCategory): Promise<PromptTemplate[]>;
  async getTemplate(id: string): Promise<PromptTemplate>;
  async saveTemplate(template: Partial<PromptTemplate>): Promise<PromptTemplate>;
  async deleteTemplate(id: string): Promise<void>;
  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<string>;

  // Settings management
  async getSettings(): Promise<UserSettings>;
  async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings>;
  async resetSettings(): Promise<UserSettings>;

  // Provider management
  async testProvider(config: ProviderConfig): Promise<boolean>;
  async getProviderStatus(): Promise<ProviderStatus[]>;
  async updateProviderConfig(name: string, config: Partial<ProviderConfig>): Promise<void>;

  // Cache management
  async clearCache(type?: CacheType): Promise<void>;
  async getCacheStats(): Promise<CacheStats>;

  // Import/Export
  async exportData(options: ExportOptions): Promise<ExportResult>;
  async importData(data: ImportData): Promise<ImportResult>;

  // Sync (for future cloud features)
  async syncData(): Promise<SyncResult>;
  async getSyncStatus(): Promise<SyncStatus>;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface ProviderStatus {
  name: string;
  enabled: boolean;
  connected: boolean;
  lastError?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

interface CacheStats {
  totalSize: number;
  itemCount: number;
  hitRate: number;
  oldestItem: Date;
  newestItem: Date;
  typeBreakdown: Record<CacheType, number>;
}

interface ExportOptions {
  includePrompts: boolean;
  includeTemplates: boolean;
  includeSettings: boolean;
  dateRange?: DateRange;
  format: 'json' | 'csv' | 'yaml';
}

interface ExportResult {
  success: boolean;
  data?: string;
  filename: string;
  size: number;
  error?: string;
}

interface ImportData {
  prompts?: PromptRecord[];
  templates?: PromptTemplate[];
  settings?: Partial<UserSettings>;
  format: string;
  version: string;
}

interface ImportResult {
  success: boolean;
  imported: {
    prompts: number;
    templates: number;
    settings: boolean;
  };
  skipped: number;
  errors: string[];
}

interface SyncResult {
  success: boolean;
  synced: {
    prompts: number;
    templates: number;
    settings: boolean;
  };
  conflicts: SyncConflict[];
  lastSyncAt: Date;
}

interface SyncConflict {
  type: 'prompt' | 'template' | 'settings';
  id: string;
  localVersion: any;
  remoteVersion: any;
  resolution?: 'local' | 'remote' | 'manual';
}

interface SyncStatus {
  enabled: boolean;
  lastSync?: Date;
  pendingChanges: number;
  conflicts: number;
  status: 'idle' | 'syncing' | 'error';
}
```

### External Provider APIs

#### Provider Interface

```typescript
interface ProviderAPI {
  authenticate(credentials: ProviderCredentials): Promise<AuthResult>;
  analyzePrompt(request: ProviderAnalysisRequest): Promise<ProviderAnalysisResponse>;
  improvePrompt(request: ProviderImprovementRequest): Promise<ProviderImprovementResponse>;
  translatePrompt(request: ProviderTranslationRequest): Promise<ProviderTranslationResponse>;
  getModels(): Promise<ProviderModel[]>;
  getRateLimit(): Promise<RateLimitInfo>;
  getUsage(): Promise<UsageInfo>;
}

interface AuthResult {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

interface ProviderAnalysisRequest {
  prompt: string;
  language?: string;
  features: string[];           // Which analysis features to include
  model?: string;
  options?: Record<string, any>;
}

interface ProviderAnalysisResponse {
  analysis: {
    quality: number;
    clarity: number;
    specificity: number;
    structure: any;
    intent: string;
    suggestions: ProviderSuggestion[];
  };
  metadata: {
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
}

interface ProviderSuggestion {
  type: string;
  description: string;
  before: string;
  after: string;
  confidence: number;
  reasoning?: string;
}

interface ProviderImprovementRequest {
  prompt: string;
  context?: string;
  targetTone?: string;
  targetAudience?: string;
  constraints?: string[];
  model?: string;
}

interface ProviderImprovementResponse {
  improvedPrompt: string;
  changes: ProviderChange[];
  explanation: string;
  metadata: {
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
}

interface ProviderChange {
  type: string;
  original: string;
  improved: string;
  reasoning: string;
}

interface ProviderTranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  preserveFormatting?: boolean;
}

interface ProviderTranslationResponse {
  translatedText: string;
  confidence: number;
  detectedLanguage?: string;
  metadata: {
    model: string;
    tokensUsed: number;
  };
}

interface ProviderModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  features: string[];
  pricing?: {
    inputTokens: number;        // cost per 1k tokens
    outputTokens: number;
  };
}

interface RateLimitInfo {
  requestsRemaining: number;
  tokensRemaining: number;
  resetAt: Date;
  dailyLimit: number;
  monthlyLimit?: number;
}

interface UsageInfo {
  requestsToday: number;
  tokensToday: number;
  requestsMonth: number;
  tokensMonth: number;
  cost?: {
    today: number;
    month: number;
    currency: string;
  };
}
```

## Event System

### Event Types

```typescript
type SystemEvent = 
  | { type: 'PROMPT_ANALYZED'; data: { promptId: string; analysis: AnalysisResult } }
  | { type: 'PROMPT_IMPROVED'; data: { promptId: string; before: string; after: string } }
  | { type: 'PROMPT_SAVED'; data: { prompt: PromptRecord } }
  | { type: 'PROMPT_DELETED'; data: { promptId: string } }
  | { type: 'SETTINGS_UPDATED'; data: { settings: UserSettings } }
  | { type: 'PROVIDER_STATUS_CHANGED'; data: { provider: string; status: ProviderStatus } }
  | { type: 'CACHE_CLEARED'; data: { type?: CacheType } }
  | { type: 'SYNC_COMPLETED'; data: { result: SyncResult } }
  | { type: 'ERROR_OCCURRED'; data: { error: APIError; context: string } };

interface EventBus {
  emit<T extends SystemEvent>(event: T): void;
  on<T extends SystemEvent>(type: T['type'], handler: (data: T['data']) => void): void;
  off<T extends SystemEvent>(type: T['type'], handler: (data: T['data']) => void): void;
  once<T extends SystemEvent>(type: T['type'], handler: (data: T['data']) => void): void;
}
```

This comprehensive data model and API specification provides a solid foundation for implementing the Prompt Polisher system with proper type safety, clear interfaces, and extensible architecture.