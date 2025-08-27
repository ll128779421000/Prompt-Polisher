import { PromptAnalysis, DetectedLanguage, PromptLibraryItem } from '../types'
import { LanguageDetector } from '../utils/languageDetector'
import { PromptImprover } from '../utils/promptImprover'
import { StorageManager } from '../utils/storage'

class PromptPolisherApp {
  private currentAnalysis: PromptAnalysis | null = null
  private deferredPrompt: any = null

  constructor() {
    this.init()
  }

  private async init() {
    this.setupEventListeners()
    this.setupPWA()
    this.handleShareTarget()
    await this.loadRecentPrompts()
  }

  private setupEventListeners() {
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement
    const improveBtn = document.getElementById('improve-btn') as HTMLButtonElement
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement
    const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement

    // Input handling
    promptInput?.addEventListener('input', () => {
      this.handleInputChange()
    })

    promptInput?.addEventListener('paste', (e) => {
      setTimeout(() => this.handleInputChange(), 0)
    })

    // Action buttons
    improveBtn?.addEventListener('click', () => {
      this.improvePrompt()
    })

    saveBtn?.addEventListener('click', () => {
      this.saveToLibrary()
    })

    copyBtn?.addEventListener('click', () => {
      this.copyResult()
    })

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        this.improvePrompt()
      }
    })
  }

  private setupPWA() {
    // Service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered:', registration)
        })
        .catch(error => {
          console.log('SW registration failed:', error)
        })
    }

    // Install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.showInstallPrompt()
    })

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      this.hideInstallPrompt()
      this.showToast('App installed successfully! 🎉', 'success')
    })
  }

  private handleShareTarget() {
    // Check for share target data
    const urlParams = new URLSearchParams(window.location.search)
    const sharedText = urlParams.get('text') || urlParams.get('title')
    
    if (sharedText) {
      this.displaySharedContent(sharedText)
      // Pre-fill the input
      const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement
      if (promptInput) {
        promptInput.value = sharedText
        this.handleInputChange()
      }
    }
  }

  private displaySharedContent(text: string) {
    const shareContent = document.getElementById('share-content')
    const sharedText = document.getElementById('shared-text')
    
    if (shareContent && sharedText) {
      shareContent.style.display = 'block'
      sharedText.textContent = text.substring(0, 200) + (text.length > 200 ? '...' : '')
    }
  }

  private async handleInputChange() {
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement
    const text = promptInput?.value || ''

    // Hide previous results
    this.hideResults()

    if (text.length > 10) {
      // Detect language
      const detected = LanguageDetector.detect(text)
      this.showLanguageDetection(detected)
    } else {
      this.hideLanguageDetection()
    }
  }

  private async improvePrompt() {
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement
    const text = promptInput?.value?.trim()

    if (!text) {
      this.showToast('Please enter a prompt first', 'error')
      return
    }

    if (text.length < 5) {
      this.showToast('Prompt is too short to improve', 'error')
      return
    }

    try {
      this.showLoading()
      this.hideResults()

      // Simulate API call delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Analyze and improve the prompt
      this.currentAnalysis = PromptImprover.analyzePrompt(text)

      // Show results
      this.displayResults(this.currentAnalysis)
      this.enableActionButtons()

    } catch (error) {
      console.error('Error improving prompt:', error)
      this.showToast('Failed to improve prompt. Please try again.', 'error')
    } finally {
      this.hideLoading()
    }
  }

  private displayResults(analysis: PromptAnalysis) {
    const resultsSection = document.getElementById('results')
    const originalText = document.getElementById('original-text')
    const improvedText = document.getElementById('improved-text')
    const improvementsList = document.getElementById('improvements-list')

    if (!resultsSection || !originalText || !improvedText || !improvementsList) return

    // Show results section
    resultsSection.style.display = 'block'

    // Display original and improved prompts
    originalText.textContent = analysis.originalText
    improvedText.textContent = analysis.improvedPrompt

    // Display improvements
    const improvements = []
    for (const [category, items] of Object.entries(analysis.improvements)) {
      if (Array.isArray(items) && items.length > 0) {
        items.forEach(item => {
          improvements.push(`<li><strong>${category}:</strong> ${item}</li>`)
        })
      }
    }

    if (analysis.suggestedPersona) {
      improvements.push(`<li><strong>persona:</strong> Added expert role - ${analysis.suggestedPersona}</li>`)
    }

    if (analysis.suggestedFormat) {
      improvements.push(`<li><strong>format:</strong> ${analysis.suggestedFormat}</li>`)
    }

    improvementsList.innerHTML = improvements.length > 0 
      ? improvements.join('')
      : '<li>No specific improvements needed - your prompt looks good!</li>'

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  private async saveToLibrary() {
    if (!this.currentAnalysis) return

    try {
      const category = StorageManager.suggestCategory(this.currentAnalysis.originalText)
      const title = this.currentAnalysis.originalText.substring(0, 50) + 
                    (this.currentAnalysis.originalText.length > 50 ? '...' : '')

      await StorageManager.savePrompt({
        title,
        originalPrompt: this.currentAnalysis.originalText,
        improvedPrompt: this.currentAnalysis.improvedPrompt,
        category,
        tags: []
      })

      this.showToast('Saved to library! 💾', 'success')
      await this.loadRecentPrompts()

    } catch (error) {
      console.error('Error saving to library:', error)
      this.showToast('Failed to save. Please try again.', 'error')
    }
  }

  private async copyResult() {
    if (!this.currentAnalysis) return

    try {
      await navigator.clipboard.writeText(this.currentAnalysis.improvedPrompt)
      this.showToast('Copied to clipboard! 📋', 'success')
    } catch (error) {
      // Fallback for older browsers
      this.fallbackCopyToClipboard(this.currentAnalysis.improvedPrompt)
      this.showToast('Copied to clipboard! 📋', 'success')
    }
  }

  private fallbackCopyToClipboard(text: string) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    document.execCommand('copy')
    textArea.remove()
  }

  private async loadRecentPrompts() {
    try {
      const prompts = await StorageManager.getPrompts(5)
      const container = document.getElementById('recent-prompts')
      
      if (!container) return

      if (prompts.length === 0) {
        container.innerHTML = `
          <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">
            No saved prompts yet. Improve some prompts to see them here!
          </p>
        `
        return
      }

      container.innerHTML = prompts.map(prompt => `
        <div class="prompt-item" style="background: var(--background); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s;">
          <div style="font-weight: 500; margin-bottom: 0.25rem; font-size: 0.875rem;">${this.escapeHtml(prompt.title)}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">${prompt.category} • ${this.formatDate(prompt.createdAt)}</div>
        </div>
      `).join('')

      // Add click listeners
      container.querySelectorAll('.prompt-item').forEach((item, index) => {
        item.addEventListener('click', () => {
          this.loadPrompt(prompts[index])
        })
        
        item.addEventListener('mouseenter', () => {
          item.style.borderColor = 'var(--primary)'
        })
        
        item.addEventListener('mouseleave', () => {
          item.style.borderColor = 'var(--border)'
        })
      })

    } catch (error) {
      console.error('Error loading recent prompts:', error)
    }
  }

  private loadPrompt(prompt: PromptLibraryItem) {
    const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement
    if (promptInput) {
      promptInput.value = prompt.originalPrompt
      this.handleInputChange()
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  private showLanguageDetection(detected: DetectedLanguage) {
    const detector = document.getElementById('language-detector')
    const languageText = document.getElementById('detected-language')
    const confidenceFill = document.getElementById('confidence-fill')

    if (detector && languageText && confidenceFill) {
      detector.style.display = 'flex'
      languageText.textContent = `${detected.name} (${Math.round(detected.confidence * 100)}% confidence)`
      confidenceFill.style.width = `${detected.confidence * 100}%`
    }
  }

  private hideLanguageDetection() {
    const detector = document.getElementById('language-detector')
    if (detector) {
      detector.style.display = 'none'
    }
  }

  private showLoading() {
    const loading = document.getElementById('loading')
    const improveBtn = document.getElementById('improve-btn') as HTMLButtonElement
    
    if (loading) loading.style.display = 'block'
    if (improveBtn) {
      improveBtn.disabled = true
      improveBtn.innerHTML = '<div class="spinner"></div> Polishing...'
    }
  }

  private hideLoading() {
    const loading = document.getElementById('loading')
    const improveBtn = document.getElementById('improve-btn') as HTMLButtonElement
    
    if (loading) loading.style.display = 'none'
    if (improveBtn) {
      improveBtn.disabled = false
      improveBtn.innerHTML = '<span>✨</span> Improve Prompt'
    }
  }

  private hideResults() {
    const results = document.getElementById('results')
    if (results) results.style.display = 'none'
    this.disableActionButtons()
  }

  private enableActionButtons() {
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement
    const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
    
    if (saveBtn) saveBtn.disabled = false
    if (copyBtn) copyBtn.disabled = false
  }

  private disableActionButtons() {
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement
    const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement
    
    if (saveBtn) saveBtn.disabled = true
    if (copyBtn) copyBtn.disabled = true
  }

  private showInstallPrompt() {
    const installPrompt = document.getElementById('install-prompt')
    if (installPrompt) installPrompt.style.display = 'block'
  }

  private hideInstallPrompt() {
    const installPrompt = document.getElementById('install-prompt')
    if (installPrompt) installPrompt.style.display = 'none'
  }

  private showToast(message: string, type: 'success' | 'error' = 'success') {
    const toast = document.getElementById('toast')
    if (!toast) return

    toast.textContent = message
    toast.className = `toast ${type}`
    toast.classList.add('show')

    setTimeout(() => {
      toast.classList.remove('show')
    }, 3000)
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private formatDate(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString()
  }
}

// Global function for install button
declare global {
  interface Window {
    installApp: () => void
  }
}

window.installApp = function() {
  const app = (window as any).promptPolisherApp
  if (app && app.deferredPrompt) {
    app.deferredPrompt.prompt()
    app.deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt')
      }
      app.deferredPrompt = null
    })
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  (window as any).promptPolisherApp = new PromptPolisherApp()
})