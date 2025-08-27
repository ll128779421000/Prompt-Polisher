import { AuthSession, User, BackendError } from '@/types'
import { BackendService } from './backendService'

export class AuthManager {
  private static readonly SESSION_KEY = 'authSession'
  private static readonly DEVICE_ID_KEY = 'deviceId'
  private static listeners: Array<(session: AuthSession) => void> = []

  public static addSessionListener(callback: (session: AuthSession) => void) {
    this.listeners.push(callback)
  }

  public static removeSessionListener(callback: (session: AuthSession) => void) {
    const index = this.listeners.indexOf(callback)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  private static notifyListeners(session: AuthSession) {
    this.listeners.forEach(callback => {
      try {
        callback(session)
      } catch (error) {
        console.error('Error in session listener:', error)
      }
    })
  }

  public static async initialize(): Promise<AuthSession> {
    // Load existing session from storage
    const session = await BackendService.loadSession()
    
    // Generate device ID if not exists (for anonymous tracking)
    await this.ensureDeviceId()
    
    // Validate session if authenticated
    if (session.isAuthenticated && session.token) {
      try {
        // Try to refresh token if close to expiry
        if (this.isTokenNearExpiry(session)) {
          const refreshedSession = await BackendService.refreshToken()
          this.notifyListeners(refreshedSession)
          return refreshedSession
        }
        
        // Validate current session
        await BackendService.getUserInfo()
        this.notifyListeners(session)
        return session
      } catch (error) {
        console.log('Session validation failed, logging out:', error)
        await this.logout()
      }
    }
    
    // Return unauthenticated session
    const unauthenticatedSession = { isAuthenticated: false }
    this.notifyListeners(unauthenticatedSession)
    return unauthenticatedSession
  }

  public static async register(email: string, password?: string): Promise<AuthSession> {
    try {
      const session = await BackendService.register(email, password)
      this.notifyListeners(session)
      
      // Track registration event
      this.trackEvent('user_registered', { email, hasPassword: !!password })
      
      return session
    } catch (error) {
      this.handleAuthError(error)
      throw error
    }
  }

  public static async login(email: string, password: string): Promise<AuthSession> {
    try {
      const session = await BackendService.login(email, password)
      this.notifyListeners(session)
      
      // Track login event
      this.trackEvent('user_login', { email })
      
      return session
    } catch (error) {
      this.handleAuthError(error)
      throw error
    }
  }

  public static async logout(): Promise<void> {
    try {
      await BackendService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    const session = { isAuthenticated: false }
    this.notifyListeners(session)
    
    // Track logout event
    this.trackEvent('user_logout')
  }

  public static async refreshToken(): Promise<AuthSession> {
    try {
      const session = await BackendService.refreshToken()
      this.notifyListeners(session)
      return session
    } catch (error) {
      console.error('Token refresh failed:', error)
      await this.logout()
      throw error
    }
  }

  public static getSession(): AuthSession {
    return BackendService.getSession()
  }

  public static isAuthenticated(): boolean {
    return this.getSession().isAuthenticated
  }

  public static getUser(): User | undefined {
    return this.getSession().user
  }

  public static isPremiumUser(): boolean {
    const user = this.getUser()
    return user?.plan === 'premium' && user?.subscription?.status === 'active'
  }

  public static async getUserUsage() {
    try {
      return await BackendService.getUsageInfo()
    } catch (error) {
      // Return default usage for offline mode
      return {\n        current: 0,\n        limit: 10,\n        resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),\n        isLimitReached: false,\n        daysUntilReset: 1\n      }\n    }\n  }\n\n  private static isTokenNearExpiry(session: AuthSession): boolean {\n    if (!session.expiresAt) return false\n    \n    const expiryTime = new Date(session.expiresAt).getTime()\n    const currentTime = Date.now()\n    const timeUntilExpiry = expiryTime - currentTime\n    \n    // Refresh if token expires within 1 hour\n    return timeUntilExpiry < 60 * 60 * 1000\n  }\n\n  private static async ensureDeviceId(): Promise<string> {\n    if (typeof chrome === 'undefined' || !chrome.storage) {\n      return crypto.randomUUID()\n    }\n\n    try {\n      const result = await chrome.storage.local.get(this.DEVICE_ID_KEY)\n      if (result[this.DEVICE_ID_KEY]) {\n        return result[this.DEVICE_ID_KEY]\n      }\n      \n      const deviceId = crypto.randomUUID()\n      await chrome.storage.local.set({ [this.DEVICE_ID_KEY]: deviceId })\n      return deviceId\n    } catch (error) {\n      console.error('Failed to manage device ID:', error)\n      return crypto.randomUUID()\n    }\n  }\n\n  public static async getDeviceId(): Promise<string> {\n    return this.ensureDeviceId()\n  }\n\n  private static handleAuthError(error: BackendError) {\n    // Log authentication errors for debugging\n    console.error('Authentication error:', error)\n    \n    // Track authentication failures\n    this.trackEvent('auth_error', { \n      code: error.code, \n      message: error.message \n    })\n  }\n\n  private static trackEvent(event: string, data?: any) {\n    // Simple event tracking for analytics\n    if (typeof chrome !== 'undefined' && chrome.storage) {\n      chrome.storage.local.get('analytics').then(result => {\n        const analytics = result.analytics || []\n        analytics.push({\n          event,\n          data,\n          timestamp: new Date().toISOString(),\n          sessionId: this.getSession().user?.id || 'anonymous'\n        })\n        \n        // Keep only last 100 events\n        if (analytics.length > 100) {\n          analytics.splice(0, analytics.length - 100)\n        }\n        \n        chrome.storage.local.set({ analytics })\n      }).catch(error => {\n        console.error('Failed to track event:', error)\n      })\n    }\n  }\n\n  // Helper methods for UI\n  public static getDisplayName(): string {\n    const user = this.getUser()\n    if (!user) return 'Guest'\n    \n    return user.email || `User ${user.id.slice(0, 8)}`\n  }\n\n  public static getPlanDisplayName(): string {\n    const user = this.getUser()\n    if (!user) return 'Free'\n    \n    return user.plan === 'premium' ? 'Premium' : 'Free'\n  }\n\n  public static async canMakeRequest(): Promise<{ allowed: boolean; reason?: string }> {\n    if (!this.isAuthenticated()) {\n      // Anonymous users have limited access\n      try {\n        const usage = await this.getUserUsage()\n        if (usage.isLimitReached) {\n          return {\n            allowed: false,\n            reason: 'Free tier limit reached. Please sign up for more requests.'\n          }\n        }\n        return { allowed: true }\n      } catch (error) {\n        // Allow offline fallback\n        return { allowed: true }\n      }\n    }\n    \n    // Authenticated users\n    const user = this.getUser()!\n    \n    if (user.plan === 'premium') {\n      // Premium users have unlimited access (with reasonable rate limits)\n      return { allowed: true }\n    }\n    \n    // Free tier authenticated users\n    try {\n      const usage = await this.getUserUsage()\n      if (usage.isLimitReached) {\n        return {\n          allowed: false,\n          reason: 'Daily limit reached. Upgrade to premium for unlimited access.'\n        }\n      }\n      return { allowed: true }\n    } catch (error) {\n      // Allow offline fallback\n      return { allowed: true }\n    }\n  }\n\n  // Session persistence helpers\n  public static async clearAllData(): Promise<void> {\n    if (typeof chrome !== 'undefined' && chrome.storage) {\n      try {\n        await chrome.storage.local.clear()\n        await chrome.storage.sync.clear()\n      } catch (error) {\n        console.error('Failed to clear storage:', error)\n      }\n    }\n  }\n\n  public static async exportUserData(): Promise<any> {\n    if (typeof chrome !== 'undefined' && chrome.storage) {\n      try {\n        const local = await chrome.storage.local.get()\n        const sync = await chrome.storage.sync.get()\n        \n        return {\n          local,\n          sync,\n          exportedAt: new Date().toISOString()\n        }\n      } catch (error) {\n        console.error('Failed to export data:', error)\n        return null\n      }\n    }\n    \n    return null\n  }\n}