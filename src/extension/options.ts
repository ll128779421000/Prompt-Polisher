class OptionsController {
  private settings: any = {}
  private providers: any[] = []

  constructor() {
    this.init()
  }

  private async init() {
    await this.loadSettings()
    await this.loadProviders()
    this.updateUI()
    this.setupEventListeners()
  }

  private async loadSettings() {
    try {
      const response = await this.sendMessage({ type: 'GET_SETTINGS' })
      this.settings = response.data || this.getDefaultSettings()
    } catch (error) {
      console.error('Failed to load settings:', error)
      this.settings = this.getDefaultSettings()
    }
  }

  private async loadProviders() {
    try {
      const result = await chrome.storage.local.get('providers')
      this.providers = result.providers || []
    } catch (error) {
      console.error('Failed to load providers:', error)
      this.providers = []
    }
  }

  private getDefaultSettings() {
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

  private updateUI() {
    // Update toggles
    document.getElementById('toggle-auto-language')?.classList.toggle('active', this.settings.autoDetectLanguage)
    document.getElementById('toggle-persona')?.classList.toggle('active', this.settings.showPersonaSuggestions)
    document.getElementById('toggle-format')?.classList.toggle('active', this.settings.showFormatSuggestions)
    document.getElementById('toggle-examples')?.classList.toggle('active', this.settings.showExamples)
    document.getElementById('toggle-offline')?.classList.toggle('active', this.settings.enableOfflineFallback)

    // Update shortcuts
    const improveInput = document.getElementById('shortcut-improve') as HTMLInputElement
    const toggleInput = document.getElementById('shortcut-toggle') as HTMLInputElement
    if (improveInput) improveInput.value = this.settings.shortcuts?.improve || 'Ctrl+Shift+I'
    if (toggleInput) toggleInput.value = this.settings.shortcuts?.toggle || 'Ctrl+Shift+T'

    // Update providers list
    this.renderProviders()
  }

  private renderProviders() {
    const container = document.getElementById('providers-list')!
    
    if (this.providers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6b7280;">
          <p>No AI providers configured yet.</p>
          <p style="font-size: 14px; margin-top: 8px;">Add a provider to enable AI-powered prompt improvements.</p>
        </div>
      `
      return
    }

    container.innerHTML = this.providers.map(provider => `
      <div class="provider-card" data-id="${provider.id}">
        <div class="provider-header">
          <div class="provider-name">${provider.name}</div>
          <div class="provider-status ${provider.enabled ? 'enabled' : 'disabled'}">
            ${provider.enabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
        <div class="input-group">
          <label>API Key</label>
          <input type="password" value="${provider.apiKey || ''}" placeholder="Enter API key">
        </div>
        ${provider.baseUrl ? `
          <div class="input-group" style="margin-top: 8px;">
            <label>Base URL</label>
            <input type="url" value="${provider.baseUrl}" placeholder="https://api.example.com">
          </div>
        ` : ''}
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <button class="btn btn-secondary toggle-provider">${provider.enabled ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-danger remove-provider">Remove</button>
        </div>
      </div>
    `).join('')

    // Add event listeners for provider actions
    container.querySelectorAll('.toggle-provider').forEach((btn, index) => {
      btn.addEventListener('click', () => this.toggleProvider(index))
    })

    container.querySelectorAll('.remove-provider').forEach((btn, index) => {
      btn.addEventListener('click', () => this.removeProvider(index))
    })
  }

  private setupEventListeners() {
    // Toggle switches
    document.getElementById('toggle-auto-language')?.addEventListener('click', () => {
      this.toggleSetting('autoDetectLanguage')
    })

    document.getElementById('toggle-persona')?.addEventListener('click', () => {
      this.toggleSetting('showPersonaSuggestions')
    })

    document.getElementById('toggle-format')?.addEventListener('click', () => {
      this.toggleSetting('showFormatSuggestions')
    })

    document.getElementById('toggle-examples')?.addEventListener('click', () => {
      this.toggleSetting('showExamples')
    })

    document.getElementById('toggle-offline')?.addEventListener('click', () => {
      this.toggleSetting('enableOfflineFallback')
    })

    // Action buttons
    document.getElementById('add-provider')?.addEventListener('click', () => {
      this.showAddProviderDialog()
    })

    document.getElementById('export-data')?.addEventListener('click', () => {
      this.exportData()
    })

    document.getElementById('import-data')?.addEventListener('click', () => {
      document.getElementById('import-file')?.click()
    })

    document.getElementById('import-file')?.addEventListener('change', (e) => {
      this.importData(e.target as HTMLInputElement)
    })

    document.getElementById('clear-data')?.addEventListener('click', () => {
      this.clearAllData()
    })

    document.getElementById('reset-settings')?.addEventListener('click', () => {
      this.resetSettings()
    })

    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.saveSettings()
    })
  }

  private toggleSetting(key: string) {
    const toggle = document.getElementById(`toggle-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`)
    if (!toggle) return

    toggle.classList.toggle('active')
    this.settings[key] = toggle.classList.contains('active')
  }

  private async toggleProvider(index: number) {
    if (index >= 0 && index < this.providers.length) {
      this.providers[index].enabled = !this.providers[index].enabled
      await this.saveProviders()
      this.renderProviders()
    }
  }

  private async removeProvider(index: number) {
    if (index >= 0 && index < this.providers.length) {
      if (confirm('Are you sure you want to remove this provider?')) {
        this.providers.splice(index, 1)
        await this.saveProviders()
        this.renderProviders()
      }
    }
  }

  private showAddProviderDialog() {
    const name = prompt('Provider name (e.g., OpenAI, Anthropic, Local):')
    if (!name) return

    const apiKey = prompt('API Key (leave empty for local providers):')
    const baseUrl = prompt('Base URL (optional, for custom endpoints):')

    const provider = {
      id: Date.now().toString(),
      name,
      apiKey: apiKey || '',
      baseUrl: baseUrl || '',
      enabled: true
    }

    this.providers.push(provider)
    this.saveProviders()
    this.renderProviders()
  }

  private async saveProviders() {
    try {
      await chrome.storage.local.set({ providers: this.providers })
    } catch (error) {
      console.error('Failed to save providers:', error)
    }
  }

  private async exportData() {
    try {
      // Get all data
      const [settingsResponse, libraryResult, providersResult] = await Promise.all([
        this.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.storage.local.get('promptLibrary'),
        chrome.storage.local.get('providers')
      ])

      const exportData = {
        settings: settingsResponse.data,
        prompts: libraryResult.promptLibrary || [],
        providers: providersResult.providers || [],
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prompt-polisher-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      this.showMessage('Data exported successfully!', 'success')
    } catch (error) {
      console.error('Export failed:', error)
      this.showMessage('Export failed. Please try again.', 'error')
    }
  }

  private async importData(fileInput: HTMLInputElement) {
    const file = fileInput.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate data structure
      if (!data.settings && !data.prompts && !data.providers) {
        throw new Error('Invalid backup file format')
      }

      // Confirm import
      const promptCount = data.prompts?.length || 0
      const providerCount = data.providers?.length || 0
      
      if (!confirm(`Import ${promptCount} prompts and ${providerCount} providers? This will merge with existing data.`)) {
        return
      }

      // Import data
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings }
        await this.sendMessage({ type: 'UPDATE_SETTINGS', data: this.settings })
      }

      if (data.prompts) {
        const existing = await chrome.storage.local.get('promptLibrary')
        const merged = [...(existing.promptLibrary || []), ...data.prompts]
        await chrome.storage.local.set({ promptLibrary: merged })
      }

      if (data.providers) {
        this.providers = [...this.providers, ...data.providers]
        await this.saveProviders()
      }

      // Update UI
      this.updateUI()
      this.showMessage(`Import successful! Added ${promptCount} prompts and ${providerCount} providers.`, 'success')
    } catch (error) {
      console.error('Import failed:', error)
      this.showMessage('Import failed. Please check the file format.', 'error')
    }

    // Reset file input
    fileInput.value = ''
  }

  private async clearAllData() {
    const confirmed = confirm('Are you sure you want to clear ALL data? This cannot be undone.\\n\\nThis will remove:\\n• All saved prompts\\n• All provider settings\\n• All custom settings')
    
    if (confirmed) {
      try {
        await chrome.storage.local.clear()
        await chrome.storage.sync.clear()
        
        this.settings = this.getDefaultSettings()
        this.providers = []
        this.updateUI()
        
        this.showMessage('All data cleared successfully.', 'success')
      } catch (error) {
        console.error('Failed to clear data:', error)
        this.showMessage('Failed to clear data. Please try again.', 'error')
      }
    }
  }

  private async resetSettings() {
    if (confirm('Reset all settings to defaults? Your saved prompts and providers will not be affected.')) {
      this.settings = this.getDefaultSettings()
      this.updateUI()
      this.showMessage('Settings reset to defaults.', 'success')
    }
  }

  private async saveSettings() {
    try {
      await this.sendMessage({ type: 'UPDATE_SETTINGS', data: this.settings })
      this.showMessage('Settings saved successfully!', 'success')
    } catch (error) {
      console.error('Failed to save settings:', error)
      this.showMessage('Failed to save settings. Please try again.', 'error')
    }
  }

  private showMessage(text: string, type: 'success' | 'error') {
    const successEl = document.getElementById('success-message')!
    const errorEl = document.getElementById('error-message')!
    
    // Hide both first
    successEl.style.display = 'none'
    errorEl.style.display = 'none'
    
    // Show appropriate message
    const element = type === 'success' ? successEl : errorEl
    element.textContent = text
    element.style.display = 'block'
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      element.style.display = 'none'
    }, 3000)
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
}

// Initialize options when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController()
})