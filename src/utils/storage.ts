import Dexie, { Table } from 'dexie'
import { PromptLibraryItem, UserSettings, ProviderConfig } from '@/types'

export class PromptPolisherDB extends Dexie {
  prompts!: Table<PromptLibraryItem>
  settings!: Table<UserSettings & { id: string }>
  providers!: Table<ProviderConfig>

  constructor() {
    super('PromptPolisherDB')
    
    this.version(1).stores({
      prompts: '++id, title, category, tags, createdAt, updatedAt, usageCount',
      settings: '++id',
      providers: '++id, name, enabled'
    })
  }
}

export const db = new PromptPolisherDB()

export class StorageManager {
  private static readonly SETTINGS_KEY = 'user-settings'

  // Prompt Library Management
  public static async savePrompt(item: Omit<PromptLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
    const now = new Date()
    const prompt: Omit<PromptLibraryItem, 'id'> = {
      ...item,
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    }
    
    const id = await db.prompts.add(prompt as PromptLibraryItem)
    return id.toString()
  }

  public static async getPrompts(limit?: number): Promise<PromptLibraryItem[]> {
    let query = db.prompts.orderBy('updatedAt').reverse()
    if (limit) {
      query = query.limit(limit)
    }
    return query.toArray()
  }

  public static async searchPrompts(searchTerm: string): Promise<PromptLibraryItem[]> {
    const term = searchTerm.toLowerCase()
    return db.prompts
      .filter(prompt => 
        prompt.title.toLowerCase().includes(term) ||
        prompt.originalPrompt.toLowerCase().includes(term) ||
        prompt.improvedPrompt.toLowerCase().includes(term) ||
        prompt.tags.some(tag => tag.toLowerCase().includes(term)) ||
        prompt.category.toLowerCase().includes(term) ||
        (prompt.notes && prompt.notes.toLowerCase().includes(term))
      )
      .toArray()
  }

  public static async getPromptsByCategory(category: string): Promise<PromptLibraryItem[]> {
    return db.prompts.where('category').equals(category).toArray()
  }

  public static async updatePrompt(id: string, updates: Partial<PromptLibraryItem>): Promise<void> {
    await db.prompts.update(id, { ...updates, updatedAt: new Date() })
  }

  public static async deletePrompt(id: string): Promise<void> {
    await db.prompts.delete(id)
  }

  public static async incrementUsage(id: string): Promise<void> {
    const prompt = await db.prompts.get(id)
    if (prompt) {
      await db.prompts.update(id, { 
        usageCount: prompt.usageCount + 1,
        updatedAt: new Date()
      })
    }
  }

  // Settings Management
  public static async getSettings(): Promise<UserSettings> {
    const settings = await db.settings.get(this.SETTINGS_KEY)
    return settings || this.getDefaultSettings()
  }

  public static async updateSettings(updates: Partial<UserSettings>): Promise<void> {
    const current = await this.getSettings()
    const newSettings = { ...current, ...updates }
    await db.settings.put({ ...newSettings, id: this.SETTINGS_KEY })
  }

  private static getDefaultSettings(): UserSettings {
    return {
      language: 'en',
      autoDetectLanguage: true,
      defaultProvider: 'openai',
      showPersonaSuggestions: true,
      showFormatSuggestions: true,
      showExamples: true,
      enableOfflineFallback: true,
      shortcuts: {
        improve: 'Ctrl+Shift+I',
        toggle: 'Ctrl+Shift+T'
      }
    }
  }

  // Provider Management
  public static async getProviders(): Promise<ProviderConfig[]> {
    return db.providers.toArray()
  }

  public static async saveProvider(provider: Omit<ProviderConfig, 'id'>): Promise<string> {
    const id = await db.providers.add(provider as ProviderConfig)
    return id.toString()
  }

  public static async updateProvider(id: string, updates: Partial<ProviderConfig>): Promise<void> {
    await db.providers.update(id, updates)
  }

  public static async deleteProvider(id: string): Promise<void> {
    await db.providers.delete(id)
  }

  public static async getEnabledProvider(): Promise<ProviderConfig | null> {
    const settings = await this.getSettings()
    const providers = await this.getProviders()
    return providers.find(p => p.id === settings.defaultProvider && p.enabled) || null
  }

  // Export/Import
  public static async exportData(): Promise<{ prompts: PromptLibraryItem[], settings: UserSettings, providers: ProviderConfig[] }> {
    const [prompts, settings, providers] = await Promise.all([
      this.getPrompts(),
      this.getSettings(), 
      this.getProviders()
    ])
    
    return { prompts, settings, providers }
  }

  public static async importData(data: { prompts?: PromptLibraryItem[], settings?: UserSettings, providers?: ProviderConfig[] }): Promise<void> {
    if (data.prompts) {
      await db.prompts.clear()
      await db.prompts.bulkAdd(data.prompts)
    }
    
    if (data.settings) {
      await this.updateSettings(data.settings)
    }
    
    if (data.providers) {
      await db.providers.clear()
      await db.providers.bulkAdd(data.providers)
    }
  }

  // Category Management
  public static async getCategories(): Promise<string[]> {
    const prompts = await db.prompts.toArray()
    const categories = new Set(prompts.map(p => p.category))
    return Array.from(categories).sort()
  }

  public static suggestCategory(promptText: string): string {
    const text = promptText.toLowerCase()
    
    if (text.match(/\b(code|programming|function|algorithm|debug|script)\b/)) return 'Programming'
    if (text.match(/\b(write|article|essay|content|blog|copy)\b/)) return 'Writing'
    if (text.match(/\b(analyze|data|research|study|report)\b/)) return 'Analysis'
    if (text.match(/\b(design|ui|ux|interface|mockup)\b/)) return 'Design'
    if (text.match(/\b(business|strategy|market|plan|revenue)\b/)) return 'Business'
    if (text.match(/\b(teach|learn|explain|tutorial|education)\b/)) return 'Education'
    if (text.match(/\b(email|message|communication|letter)\b/)) return 'Communication'
    if (text.match(/\b(summary|summarize|brief|overview)\b/)) return 'Summarization'
    if (text.match(/\b(translate|translation|language)\b/)) return 'Translation'
    if (text.match(/\b(creative|story|creative writing|fiction)\b/)) return 'Creative'
    
    return 'General'
  }
}