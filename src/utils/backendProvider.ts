import { PromptAnalysis } from '@/types'

export interface BackendProviderResponse {
  improvedPrompt: string
  usage?: {
    tokens: number
    cost: number
    queriesUsed: number
    queriesLimit: number | string
    isPremium: boolean
  }
  error?: string
}

export class BackendProvider {
  private static readonly BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://your-railway-url.railway.app/api'
  private static extensionId: string

  public static initialize() {
    this.extensionId = chrome?.runtime?.id || 'web-app'
  }

  public static async improvePrompt(
    originalPrompt: string,
    provider: 'openai' | 'anthropic' | 'local' = 'openai',
    language?: string
  ): Promise<BackendProviderResponse> {
    try {
      const response = await fetch(`${this.BACKEND_API_URL}/prompts/improve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-extension-id': this.extensionId
        },
        body: JSON.stringify({
          text: originalPrompt,
          provider,
          language
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        if (response.status === 429) {
          // Rate limit exceeded
          return {
            improvedPrompt: originalPrompt,
            usage: errorData.usage || {
              tokens: 0,
              cost: 0,
              queriesUsed: errorData.queriesUsed || 5,
              queriesLimit: errorData.queriesLimit || 5,
              isPremium: false
            },
            error: errorData.message || 'Rate limit exceeded. Upgrade for unlimited access.'
          }
        }
        
        throw new Error(errorData.error || 'Failed to improve prompt')
      }

      const data = await response.json()
      
      return {
        improvedPrompt: data.improvedPrompt,
        usage: {
          tokens: data.usage.tokens,
          cost: data.usage.cost,
          queriesUsed: data.usage.queriesUsed,
          queriesLimit: data.usage.queriesLimit,
          isPremium: data.usage.isPremium
        }
      }
    } catch (error: any) {
      console.error('Backend API error:', error)
      
      // Don't fallback for rate limit errors
      if (error.message.includes('Rate limit') || error.message.includes('Usage limit')) {
        throw error
      }
      
      // Fallback to local improvement for other errors
      return this.fallbackToLocal(originalPrompt, language)
    }
  }

  private static async fallbackToLocal(originalPrompt: string, language?: string): Promise<BackendProviderResponse> {
    // Import local improvement rules
    const { OfflinePromptImprover } = await import('./offlineRules')
    const analysis = OfflinePromptImprover.improvePrompt(originalPrompt)
    
    return {
      improvedPrompt: analysis.improvedPrompt,
      usage: {
        tokens: 0,
        cost: 0,
        queriesUsed: 0,
        queriesLimit: 'offline',
        isPremium: false
      }
    }
  }

  public static async getUserUsage(): Promise<any> {
    try {
      const response = await fetch(`${this.BACKEND_API_URL}/prompts/usage`, {
        method: 'GET',
        headers: {
          'x-extension-id': this.extensionId
        }
      })

      if (!response.ok) {
        throw new Error('Failed to get usage stats')
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      return {
        user: {
          queriesUsed: 0,
          queriesLimit: 5,
          isPremium: false
        }
      }
    }
  }

  public static async createPaymentIntent(plan: string, email?: string): Promise<any> {
    try {
      const response = await fetch(`${this.BACKEND_API_URL}/payments/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-extension-id': this.extensionId
        },
        body: JSON.stringify({ plan, email })
      })

      if (!response.ok) {
        throw new Error('Failed to create payment intent')
      }

      return await response.json()
    } catch (error) {
      console.error('Payment intent creation failed:', error)
      throw error
    }
  }

  public static async getPricing(): Promise<any> {
    try {
      const response = await fetch(`${this.BACKEND_API_URL}/payments/pricing`)
      
      if (!response.ok) {
        throw new Error('Failed to get pricing')
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get pricing:', error)
      return { pricing: [] }
    }
  }

  public static getUpgradeUrl(): string {
    return `${this.BACKEND_API_URL.replace('/api', '')}/upgrade`
  }

  public static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BACKEND_API_URL}/prompts/health`)
      return response.ok
    } catch (error) {
      return false
    }
  }
}

// Initialize on load
if (typeof chrome !== 'undefined' && chrome.runtime) {
  BackendProvider.initialize()
}