export interface PromptAnalysis {
  originalText: string
  improvements: {
    clarity: string[]
    specificity: string[]
    structure: string[]
    examples: string[]
  }
  suggestedPersona?: string
  suggestedFormat?: string
  improvedPrompt: string
  confidence: number
}

export interface PromptLibraryItem {
  id: string
  title: string
  originalPrompt: string
  improvedPrompt: string
  category: string
  tags: string[]
  notes?: string
  createdAt: Date
  updatedAt: Date
  usageCount: number
}

export interface ProviderConfig {
  id: string
  name: string
  apiKey: string
  baseUrl?: string
  model?: string
  enabled: boolean
}

export interface UserSettings {
  language: string
  autoDetectLanguage: boolean
  defaultProvider: string
  showPersonaSuggestions: boolean
  showFormatSuggestions: boolean
  showExamples: boolean
  enableOfflineFallback: boolean
  shortcuts: {
    improve: string
    toggle: string
  }
}

export interface SiteConfig {
  domain: string
  selectors: {
    textInputs: string[]
    contentEditable: string[]
    submitButtons?: string[]
  }
  insertionMethod: 'replace' | 'append' | 'clipboard'
  position: 'before' | 'after' | 'overlay'
}

export interface DetectedLanguage {
  code: string
  name: string
  confidence: number
}

export interface PromptDiff {
  type: 'addition' | 'deletion' | 'modification'
  original: string
  improved: string
  reason: string
  category: 'clarity' | 'specificity' | 'structure' | 'persona' | 'format' | 'examples'
}

export interface ConfirmationOptions {
  showPersona: boolean
  showFormat: boolean
  showExamples: boolean
  showDiff: boolean
}

// Backend API Types
export interface BackendConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
}

export interface User {
  id: string
  email?: string
  plan: 'free' | 'premium'
  usage: {
    current: number
    limit: number
    resetDate: string
  }
  subscription?: {
    id: string
    status: 'active' | 'canceled' | 'expired'
    expiresAt: string
  }
}

export interface AuthSession {
  token?: string
  user?: User
  isAuthenticated: boolean
  expiresAt?: string
}

export interface BackendResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  usage?: {
    current: number
    limit: number
    resetDate: string
  }
}

export interface PaymentIntent {
  id: string
  clientSecret: string
  amount: number
  currency: string
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled'
}

export interface UsageInfo {
  current: number
  limit: number
  resetDate: string
  isLimitReached: boolean
  daysUntilReset: number
}

export interface BackendError {
  code: 'RATE_LIMIT' | 'PAYMENT_REQUIRED' | 'UNAUTHORIZED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR'
  message: string
  details?: any
  retryAfter?: number
}

export type MessageType = 
  | 'ANALYZE_PROMPT'
  | 'IMPROVE_PROMPT' 
  | 'SAVE_TO_LIBRARY'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'DETECT_LANGUAGE'
  | 'GET_SITE_CONFIG'
  | 'AUTHENTICATE_USER'
  | 'GET_USER_INFO'
  | 'GET_USAGE_INFO'
  | 'CREATE_PAYMENT_INTENT'
  | 'LOGOUT_USER'
  | 'REFRESH_TOKEN'

export interface ChromeMessage {
  type: MessageType
  data?: any
  tabId?: number
}