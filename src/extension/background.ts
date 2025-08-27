import { ChromeMessage, MessageType } from '@/types'

class BackgroundService {
  constructor() {
    this.setupEventListeners()
    this.initializeExtension()
  }

  private setupEventListeners() {
    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // Keep message channel open for async responses
    })

    // Handle keyboard shortcuts
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command)
    })

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenu(info, tab)
    })

    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details)
    })
  }

  private async initializeExtension() {
    // Create context menu items
    chrome.contextMenus.create({
      id: 'improve-prompt',
      title: 'Improve this prompt',
      contexts: ['selection', 'editable']
    })

    chrome.contextMenus.create({
      id: 'save-to-library',
      title: 'Save to prompt library',
      contexts: ['selection']
    })

    // Initialize default settings if not exists
    const settings = await chrome.storage.sync.get('userSettings')
    if (!settings.userSettings) {
      await chrome.storage.sync.set({
        userSettings: {
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
      })
    }
  }

  private async handleMessage(message: ChromeMessage, sender: chrome.runtime.MessageSender, sendResponse: Function) {
    try {
      switch (message.type) {
        case 'ANALYZE_PROMPT':
          const analysis = await this.analyzePrompt(message.data.text)
          sendResponse({ success: true, data: analysis })
          break

        case 'IMPROVE_PROMPT':
          const improved = await this.improvePrompt(message.data)
          sendResponse({ success: true, data: improved })
          break

        case 'SAVE_TO_LIBRARY':
          await this.saveToLibrary(message.data)
          sendResponse({ success: true })
          break

        case 'GET_SETTINGS':
          const settings = await chrome.storage.sync.get('userSettings')
          sendResponse({ success: true, data: settings.userSettings })
          break

        case 'UPDATE_SETTINGS':
          await chrome.storage.sync.set({ userSettings: message.data })
          sendResponse({ success: true })
          break

        case 'DETECT_LANGUAGE':
          const language = await this.detectLanguage(message.data.text)
          sendResponse({ success: true, data: language })
          break

        case 'GET_SITE_CONFIG':
          const config = await this.getSiteConfig(message.data.url)
          sendResponse({ success: true, data: config })
          break

        default:
          sendResponse({ success: false, error: 'Unknown message type' })
      }
    } catch (error) {
      console.error('Background script error:', error)
      sendResponse({ success: false, error: error.message })
    }
  }

  private async handleCommand(command: string) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    switch (command) {
      case 'improve-prompt':
        chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_IMPROVE', data: {} })
        break
      case 'toggle-suggestions':
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SUGGESTIONS', data: {} })
        break
    }
  }

  private async handleContextMenu(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
    if (!tab?.id) return

    switch (info.menuItemId) {
      case 'improve-prompt':
        const text = info.selectionText || ''
        chrome.tabs.sendMessage(tab.id, { 
          type: 'IMPROVE_SELECTION', 
          data: { text }
        })
        break
      case 'save-to-library':
        chrome.tabs.sendMessage(tab.id, {
          type: 'SAVE_SELECTION',
          data: { text: info.selectionText || '' }
        })
        break
    }
  }

  private handleInstallation(details: chrome.runtime.InstalledDetails) {
    if (details.reason === 'install') {
      // Open options page on first install
      chrome.runtime.openOptionsPage()
    }
  }

  // Helper methods that would interface with the prompt improvement engine
  private async analyzePrompt(text: string) {
    // This would use the PromptImprover class
    // For now, return a mock response
    return {
      originalText: text,
      improvements: {
        clarity: text.length < 20 ? ['Add more specific details'] : [],
        specificity: [],
        structure: [],
        examples: []
      },
      confidence: 0.8
    }
  }

  private async improvePrompt(data: any) {
    // This would use the PromptImprover class and possibly call external APIs
    return {
      improvedPrompt: `Improved: ${data.text}`,
      changes: []
    }
  }

  private async saveToLibrary(data: any) {
    // Save to chrome.storage.local
    const items = await chrome.storage.local.get('promptLibrary') || { promptLibrary: [] }
    items.promptLibrary.push({
      id: Date.now().toString(),
      ...data,
      createdAt: new Date().toISOString()
    })
    await chrome.storage.local.set(items)
  }

  private async detectLanguage(text: string) {
    // This would use the LanguageDetector class
    return { code: 'en', name: 'English', confidence: 0.9 }
  }

  private async getSiteConfig(url: string) {
    // Return site-specific configuration
    const domain = new URL(url).hostname
    
    const siteConfigs = {
      'chat.openai.com': {
        domain,
        selectors: {
          textInputs: ['textarea[placeholder*="message"]', '#prompt-textarea'],
          contentEditable: ['[contenteditable="true"]'],
          submitButtons: ['button[data-testid="send-button"]']
        },
        insertionMethod: 'replace',
        position: 'after'
      },
      'claude.ai': {
        domain,
        selectors: {
          textInputs: ['div[contenteditable="true"]'],
          contentEditable: ['div[contenteditable="true"]'],
          submitButtons: ['button[aria-label="Send Message"]']
        },
        insertionMethod: 'replace',
        position: 'after'
      },
      // Default config for other sites
      default: {
        domain,
        selectors: {
          textInputs: ['textarea', 'input[type="text"]'],
          contentEditable: ['[contenteditable="true"]']
        },
        insertionMethod: 'clipboard',
        position: 'overlay'
      }
    }

    return siteConfigs[domain] || siteConfigs.default
  }
}

// Initialize the background service
new BackgroundService()