import { PromptAnalysis, ProviderConfig, BackendError } from '@/types'
import { LanguageDetector } from './languageDetector'
import { BackendService } from './backendService'
import { OfflinePromptImprover } from './offlineRules'

export interface ProviderResponse {
  improvedPrompt: string
  analysis?: PromptAnalysis
  usage?: {
    tokens: number
    cost: number
  }
}

export class ProviderManager {
  private static fallbackMode = false
  private static lastBackendCheck = 0
  private static readonly BACKEND_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

  public static async improvePrompt(
    originalPrompt: string,
    provider: ProviderConfig,
    language?: string
  ): Promise<ProviderResponse> {
    // First try backend service if not in fallback mode
    if (!this.fallbackMode && await this.isBackendAvailable()) {
      try {
        return await this.improveWithBackend(originalPrompt, provider, language)
      } catch (error) {
        console.log('Backend failed, falling back to offline mode:', error)
        this.enableFallbackMode()
      }
    }

    // Fallback to offline improvement
    return this.improveWithOffline(originalPrompt, provider, language)
  }

  private static async improveWithBackend(
    originalPrompt: string,
    provider: ProviderConfig,
    language?: string
  ): Promise<ProviderResponse> {
    const detectedLang = LanguageDetector.detect(originalPrompt)
    const responseLanguage = language || detectedLang.code
    
    try {
      // Check if user is authenticated for premium features
      const session = BackendService.getSession()
      
      if (session.isAuthenticated) {
        // Use authenticated endpoint
        return await BackendService.improvePrompt(
          originalPrompt,
          provider.name.toLowerCase(),
          provider.model,
          responseLanguage
        )
      } else {
        // Use anonymous endpoint with rate limiting
        return await BackendService.improvePromptAnonymous(
          originalPrompt,
          provider.name.toLowerCase(),
          provider.model,
          responseLanguage
        )
      }
    } catch (error) {
      // Handle specific backend errors
      if (error.code === 'RATE_LIMIT') {
        throw new Error(`Rate limit exceeded. ${error.retryAfter ? `Try again in ${error.retryAfter} seconds.` : 'Please try again later.'}`)
      }
      
      if (error.code === 'PAYMENT_REQUIRED') {
        throw new Error('Upgrade to premium for unlimited access. Free tier limit reached.')
      }
      
      if (error.code === 'UNAUTHORIZED') {
        throw new Error('Authentication required. Please log in to continue.')
      }
      
      throw error
    }
  }

  private static async improveWithOffline(
    originalPrompt: string,
    provider: ProviderConfig,
    language?: string
  ): Promise<ProviderResponse> {
    // Use local offline rules as fallback
    const analysis = OfflinePromptImprover.improvePrompt(originalPrompt)
    
    return {
      improvedPrompt: analysis.improvedPrompt,
      analysis,
      usage: { tokens: 0, cost: 0 }
    }
  }

  private static async isBackendAvailable(): Promise<boolean> {
    const now = Date.now()
    
    // Check cache first
    if (now - this.lastBackendCheck < this.BACKEND_CHECK_INTERVAL) {
      return !this.fallbackMode
    }
    
    this.lastBackendCheck = now
    
    try {
      const isHealthy = await BackendService.healthCheck()
      if (isHealthy && this.fallbackMode) {
        this.disableFallbackMode()
      }
      return isHealthy
    } catch (error) {
      this.enableFallbackMode()
      return false
    }
  }
  
  private static enableFallbackMode() {
    this.fallbackMode = true
    // Notify user about offline mode
    this.notifyFallbackMode()
  }
  
  private static disableFallbackMode() {
    this.fallbackMode = false
    // Notify user that online features are restored
    this.notifyOnlineMode()
  }
  
  private static notifyFallbackMode() {
    if (typeof chrome !== 'undefined' && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Prompt Polisher',
        message: 'Backend unavailable. Using offline mode with basic improvements.'
      })
    }
  }
  
  private static notifyOnlineMode() {
    if (typeof chrome !== 'undefined' && chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Prompt Polisher',
        message: 'Online features restored. Premium AI improvements now available.'
      })
    }
  }

  // Authentication and session management
  public static async authenticate(email: string, password?: string): Promise<void> {
    try {
      if (password) {
        await BackendService.login(email, password)
      } else {
        await BackendService.register(email)
      }
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }
  
  public static async logout(): Promise<void> {
    await BackendService.logout()
  }
  
  public static isAuthenticated(): boolean {
    return BackendService.getSession().isAuthenticated
  }
  
  public static async getUsageInfo() {
    try {
      return await BackendService.getUsageInfo()
    } catch (error) {
      // Return default usage info if backend unavailable
      return {
        current: 0,
        limit: 10, // Free tier limit
        resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isLimitReached: false,
        daysUntilReset: 1
      }
    }
  }

  public static async testConnection(provider: ProviderConfig): Promise<boolean> {
    // For backend service, test the backend connection
    if (!this.fallbackMode) {
      try {
        return await BackendService.healthCheck()
      } catch (error) {
        console.error('Backend connection test failed:', error)
        return false
      }
    }
    
    // For offline mode, always return true
    return true
  }

  public static getDefaultProviders(): ProviderConfig[] {
    return [
      {
        id: 'backend-openai',
        name: 'OpenAI',
        apiKey: '', // Not needed for backend
        baseUrl: '',
        model: 'gpt-3.5-turbo',
        enabled: true
      },
      {
        id: 'backend-anthropic',
        name: 'Anthropic',
        apiKey: '', // Not needed for backend
        baseUrl: '',
        model: 'claude-3-haiku-20240307',
        enabled: true
      },
      {
        id: 'offline-fallback',
        name: 'Offline',
        apiKey: '',
        baseUrl: '',
        model: 'offline-rules',
        enabled: true
      }
    ]
  }

  // Error handling for backend errors
  public static handleBackendError(error: BackendError): string {
    switch (error.code) {
      case 'RATE_LIMIT':
        return `Rate limit exceeded. ${error.retryAfter ? `Try again in ${error.retryAfter} seconds.` : 'Please try again later.'}`
      case 'PAYMENT_REQUIRED':
        return 'Upgrade to premium for unlimited access. Free tier limit reached.'
      case 'UNAUTHORIZED':
        return 'Authentication required. Please log in to continue.'
      case 'SERVER_ERROR':
        return 'Server temporarily unavailable. Using offline mode.'
      case 'NETWORK_ERROR':
        return 'Network connection failed. Check your internet connection.'
      case 'VALIDATION_ERROR':
        return `Invalid request: ${error.message}`
      default:
        return error.message || 'An unexpected error occurred.'
    }
  }
  
  // Check if user needs to upgrade
  public static async checkUpgradeNeeded(): Promise<boolean> {
    try {
      const session = BackendService.getSession()
      if (!session.isAuthenticated) return false
      
      const usage = await BackendService.getUsageInfo()
      return usage.isLimitReached && session.user?.plan === 'free'
    } catch (error) {
      return false
    }
  }
  
  // Manual fallback mode controls (for error handler)
  public static enableFallbackMode() {
    this.fallbackMode = true
    this.notifyFallbackMode()
  }
  
  public static disableFallbackMode() {
    this.fallbackMode = false
    this.notifyOnlineMode()
  }
  
  public static isFallbackMode(): boolean {
    return this.fallbackMode
  }
}