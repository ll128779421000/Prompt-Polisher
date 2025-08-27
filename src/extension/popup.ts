class PopupController {
  private settings: any = {}
  private stats = { prompts: 0, improvements: 0 }

  constructor() {
    this.init()
  }

  private async init() {
    await this.loadSettings()
    await this.loadStats()
    await this.loadRecentPrompts()
    this.setupEventListeners()
    this.updateUI()
  }

  private async loadSettings() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' })
      this.settings = response.data || {}
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  private async loadStats() {
    try {
      // Get prompts from storage
      const result = await chrome.storage.local.get('promptLibrary')
      const prompts = result.promptLibrary || []
      
      this.stats.prompts = prompts.length
      this.stats.improvements = prompts.reduce((sum: number, p: any) => sum + (p.usageCount || 0), 0)
      
      // Update display
      document.getElementById('prompts-count')!.textContent = this.stats.prompts.toString()
      document.getElementById('improvements-count')!.textContent = this.stats.improvements.toString()
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  private async loadRecentPrompts() {
    try {
      const result = await chrome.storage.local.get('promptLibrary')
      const prompts = result.promptLibrary || []
      
      // Sort by updatedAt and take last 5
      const recent = prompts
        .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 5)

      this.renderRecentPrompts(recent)
    } catch (error) {
      console.error('Failed to load recent prompts:', error)
      this.renderRecentPrompts([])
    }
  }

  private renderRecentPrompts(prompts: any[]) {
    const container = document.getElementById('recent-prompts')!
    
    if (prompts.length === 0) {
      container.innerHTML = '<div class="empty-state">No saved prompts yet.<br>Start improving prompts to see them here!</div>'
      return
    }

    container.innerHTML = prompts.map(prompt => `
      <div class="prompt-item" data-id="${prompt.id}">
        <div class="prompt-title">${this.truncate(prompt.title, 40)}</div>
        <div class="prompt-category">${prompt.category}</div>
      </div>
    `).join('')

    // Add click listeners
    container.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id')
        this.openPromptDetail(id)
      })
    })
  }

  private setupEventListeners() {
    // Quick actions
    document.getElementById('trigger-improve')?.addEventListener('click', () => {
      this.triggerImprove()
    })

    document.getElementById('open-library')?.addEventListener('click', () => {
      this.openLibrary()
    })

    document.getElementById('open-options')?.addEventListener('click', () => {
      this.openOptions()
    })

    document.getElementById('open-help')?.addEventListener('click', () => {
      this.openHelp()
    })

    // Feature toggles
    document.getElementById('toggle-suggestions')?.addEventListener('click', () => {
      this.toggleFeature('suggestions')
    })

    document.getElementById('toggle-language')?.addEventListener('click', () => {
      this.toggleFeature('language')
    })

    document.getElementById('toggle-offline')?.addEventListener('click', () => {
      this.toggleFeature('offline')
    })
  }

  private updateUI() {
    // Update toggle states based on settings
    const suggestionsToggle = document.getElementById('toggle-suggestions')
    const languageToggle = document.getElementById('toggle-language')
    const offlineToggle = document.getElementById('toggle-offline')

    if (suggestionsToggle) {
      suggestionsToggle.classList.toggle('active', this.settings.showPersonaSuggestions !== false)
    }

    if (languageToggle) {
      languageToggle.classList.toggle('active', this.settings.autoDetectLanguage !== false)
    }

    if (offlineToggle) {
      offlineToggle.classList.toggle('active', this.settings.enableOfflineFallback === true)
    }
  }

  private async triggerImprove() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_IMPROVE', data: {} })
        window.close()
      }
    } catch (error) {
      console.error('Failed to trigger improve:', error)
    }
  }

  private openLibrary() {
    chrome.tabs.create({ url: chrome.runtime.getURL('library.html') })
    window.close()
  }

  private openOptions() {
    chrome.runtime.openOptionsPage()
    window.close()
  }

  private openHelp() {
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') })
    window.close()
  }

  private openPromptDetail(id: string | null) {
    if (id) {
      chrome.tabs.create({ url: chrome.runtime.getURL(`library.html?id=${id}`) })
      window.close()
    }
  }

  private async toggleFeature(feature: string) {
    const toggleElement = document.getElementById(`toggle-${feature}`)
    if (!toggleElement) return

    const isActive = toggleElement.classList.contains('active')
    toggleElement.classList.toggle('active')

    // Update settings
    const settingKey = feature === 'suggestions' ? 'showPersonaSuggestions' :
                      feature === 'language' ? 'autoDetectLanguage' :
                      'enableOfflineFallback'

    this.settings[settingKey] = !isActive

    try {
      await this.sendMessage({ 
        type: 'UPDATE_SETTINGS', 
        data: this.settings 
      })
    } catch (error) {
      console.error('Failed to update settings:', error)
      // Revert UI change on error
      toggleElement.classList.toggle('active')
    }
  }

  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
        } else if (response.success) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      })
    })
  }

  private truncate(text: string, length: number): string {
    return text.length > length ? text.substring(0, length) + '...' : text
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController()
})