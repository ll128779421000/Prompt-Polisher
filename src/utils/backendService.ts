import { BackendConfig, BackendResponse, BackendError, AuthSession, User, PaymentIntent, UsageInfo, ProviderResponse } from '@/types'

export class BackendService {
  private static config: BackendConfig = {
    baseUrl: process.env.REACT_APP_BACKEND_URL || 'https://api.prompt-polisher.com',
    timeout: 30000
  }
  
  private static session: AuthSession = {
    isAuthenticated: false
  }

  public static setConfig(config: Partial<BackendConfig>) {
    this.config = { ...this.config, ...config }
  }

  public static getSession(): AuthSession {
    return { ...this.session }
  }

  public static setSession(session: AuthSession) {
    this.session = session
    // Store session in extension storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ authSession: session })
    }
  }

  public static async loadSession(): Promise<AuthSession> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get('authSession')
        if (result.authSession) {
          this.session = result.authSession
          
          // Check if session is expired
          if (this.session.expiresAt && new Date(this.session.expiresAt) < new Date()) {
            await this.logout()
            return this.session
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      }
    }
    return this.session
  }

  private static async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<BackendResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    // Add auth token if available
    if (this.session.token) {
      headers['Authorization'] = `Bearer ${this.session.token}`
    }

    // Add API key if configured
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout || 30000)
    }

    try {
      const response = await fetch(url, requestOptions)
      const data = await response.json()

      if (!response.ok) {
        const error: BackendError = {
          code: this.mapStatusToErrorCode(response.status),
          message: data.error?.message || response.statusText,
          details: data.error?.details
        }

        if (response.status === 429) {
          error.retryAfter = parseInt(response.headers.get('Retry-After') || '60')
        }

        throw error
      }

      // Update usage info if provided
      if (data.usage && this.session.user) {
        this.session.user.usage = data.usage
        this.setSession(this.session)
      }

      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw { code: 'NETWORK_ERROR', message: 'Request timeout' } as BackendError
      }
      
      if (error.code) {
        throw error as BackendError
      }

      throw { 
        code: 'NETWORK_ERROR', 
        message: error.message || 'Network request failed' 
      } as BackendError
    }
  }

  private static mapStatusToErrorCode(status: number): BackendError['code'] {
    switch (status) {
      case 401: return 'UNAUTHORIZED'
      case 402: return 'PAYMENT_REQUIRED'
      case 429: return 'RATE_LIMIT'
      case 400: return 'VALIDATION_ERROR'
      case 500:
      case 502:
      case 503:
      case 504: return 'SERVER_ERROR'
      default: return 'SERVER_ERROR'
    }
  }

  // Authentication methods
  public static async register(email: string, password?: string): Promise<AuthSession> {
    const response = await this.makeRequest<{ user: User; token: string; expiresAt: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })

    const session: AuthSession = {
      token: response.data?.token,
      user: response.data?.user,
      isAuthenticated: true,
      expiresAt: response.data?.expiresAt
    }

    this.setSession(session)
    return session
  }

  public static async login(email: string, password: string): Promise<AuthSession> {
    const response = await this.makeRequest<{ user: User; token: string; expiresAt: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })

    const session: AuthSession = {
      token: response.data?.token,
      user: response.data?.user,
      isAuthenticated: true,
      expiresAt: response.data?.expiresAt
    }

    this.setSession(session)
    return session
  }

  public static async logout(): Promise<void> {
    if (this.session.token) {
      try {
        await this.makeRequest('/auth/logout', { method: 'POST' })
      } catch (error) {
        console.error('Logout request failed:', error)
      }
    }

    this.session = { isAuthenticated: false }
    this.setSession(this.session)
  }

  public static async refreshToken(): Promise<AuthSession> {
    const response = await this.makeRequest<{ user: User; token: string; expiresAt: string }>('/auth/refresh', {
      method: 'POST'
    })

    const session: AuthSession = {
      token: response.data?.token,
      user: response.data?.user,
      isAuthenticated: true,
      expiresAt: response.data?.expiresAt
    }

    this.setSession(session)
    return session
  }

  public static async getUserInfo(): Promise<User> {
    const response = await this.makeRequest<User>('/user/profile')
    
    if (response.data && this.session.user) {
      this.session.user = response.data
      this.setSession(this.session)
    }
    
    return response.data!
  }

  public static async getUsageInfo(): Promise<UsageInfo> {
    const response = await this.makeRequest<UsageInfo>('/user/usage')
    return response.data!
  }

  // Prompt improvement methods
  public static async improvePrompt(
    originalPrompt: string,
    provider: string = 'openai',
    model?: string,
    language?: string
  ): Promise<ProviderResponse> {
    const response = await this.makeRequest<ProviderResponse>('/ai/improve', {
      method: 'POST',
      body: JSON.stringify({
        prompt: originalPrompt,
        provider,
        model,
        language
      })
    })

    return response.data!
  }

  public static async analyzePrompt(text: string): Promise<any> {
    const response = await this.makeRequest('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ prompt: text })
    })

    return response.data
  }

  // Payment methods
  public static async createPaymentIntent(
    planId: string, 
    currency: string = 'usd'
  ): Promise<PaymentIntent> {
    const response = await this.makeRequest<PaymentIntent>('/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ planId, currency })
    })

    return response.data!
  }

  public static async confirmPayment(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<{ success: boolean; subscription?: any }> {
    const response = await this.makeRequest('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId, paymentMethodId })
    })

    return response.data!
  }

  public static async cancelSubscription(): Promise<void> {
    await this.makeRequest('/payments/cancel-subscription', { method: 'POST' })
  }

  // Health check
  public static async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health')
      return response.success
    } catch (error) {
      return false
    }
  }

  // Anonymous usage for free tier
  public static async improvePromptAnonymous(
    originalPrompt: string,
    provider: string = 'openai',
    model?: string,
    language?: string
  ): Promise<ProviderResponse> {
    // Try to get a device ID for rate limiting
    let deviceId = ''
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get('deviceId')
        if (!result.deviceId) {
          deviceId = crypto.randomUUID()
          await chrome.storage.local.set({ deviceId })
        } else {
          deviceId = result.deviceId
        }
      } catch (error) {
        deviceId = crypto.randomUUID()
      }
    }

    const response = await this.makeRequest<ProviderResponse>('/ai/improve-anonymous', {
      method: 'POST',
      body: JSON.stringify({
        prompt: originalPrompt,
        provider,
        model,
        language,
        deviceId
      })
    })

    return response.data!
  }

  // Validation helpers
  public static validateResponse<T>(response: any): response is BackendResponse<T> {
    return (
      typeof response === 'object' &&
      response !== null &&
      typeof response.success === 'boolean'
    )
  }

  public static isAuthError(error: BackendError): boolean {
    return error.code === 'UNAUTHORIZED'
  }

  public static isRateLimitError(error: BackendError): boolean {
    return error.code === 'RATE_LIMIT'
  }

  public static isPaymentError(error: BackendError): boolean {
    return error.code === 'PAYMENT_REQUIRED'
  }
}