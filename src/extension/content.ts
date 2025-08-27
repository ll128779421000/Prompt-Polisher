import { SiteConfig, ChromeMessage } from '@/types'

class ContentScript {
  private siteConfig: SiteConfig | null = null
  private observedElements = new Set<Element>()
  private improveButtons = new Map<Element, HTMLElement>()
  private isActive = true
  private mutationObserver: MutationObserver

  constructor() {
    this.init()
  }

  private async init() {
    // Get site configuration
    this.siteConfig = await this.getSiteConfig()
    
    // Setup message listener
    chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
      this.handleMessage(message, sendResponse)
    })

    // Setup mutation observer for dynamic content
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          this.scanForTextInputs()
        }
      }
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Initial scan
    this.scanForTextInputs()

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts()
  }

  private async getSiteConfig(): Promise<SiteConfig> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_SITE_CONFIG', data: { url: window.location.href } },
        (response) => {
          resolve(response.data)
        }
      )
    })
  }

  private scanForTextInputs() {
    if (!this.siteConfig || !this.isActive) return

    const allSelectors = [
      ...this.siteConfig.selectors.textInputs,
      ...this.siteConfig.selectors.contentEditable
    ]

    for (const selector of allSelectors) {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => {
        if (!this.observedElements.has(element)) {
          this.addImproveButton(element as HTMLElement)
          this.observedElements.add(element)
        }
      })
    }
  }

  private addImproveButton(element: HTMLElement) {
    // Skip if element is too small or hidden
    const rect = element.getBoundingClientRect()
    if (rect.width < 100 || rect.height < 30) return

    // Create improve button
    const button = this.createImproveButton()
    
    // Position button based on site config
    this.positionButton(button, element)
    
    // Store reference
    this.improveButtons.set(element, button)

    // Add event listeners
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.handleImproveClick(element)
    })

    element.addEventListener('focus', () => {
      button.style.display = 'block'
    })

    element.addEventListener('blur', () => {
      setTimeout(() => {
        if (!button.matches(':hover')) {
          button.style.display = 'none'
        }
      }, 100)
    })
  }

  private createImproveButton(): HTMLElement {
    const button = document.createElement('button')
    button.className = 'prompt-polisher-improve-btn'
    button.innerHTML = '✨ Improve'
    button.title = 'Improve this prompt (Ctrl+Shift+I)'
    
    // Apply styles
    Object.assign(button.style, {
      position: 'absolute',
      zIndex: '10000',
      padding: '4px 8px',
      fontSize: '12px',
      backgroundColor: '#4f46e5',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'none',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease'
    })

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#3730a3'
      button.style.transform = 'scale(1.05)'
    })

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#4f46e5'
      button.style.transform = 'scale(1)'
    })

    document.body.appendChild(button)
    return button
  }

  private positionButton(button: HTMLElement, element: HTMLElement) {
    const updatePosition = () => {
      const rect = element.getBoundingClientRect()
      const scrollX = window.scrollX
      const scrollY = window.scrollY

      switch (this.siteConfig?.position) {
        case 'before':
          button.style.left = `${rect.left + scrollX}px`
          button.style.top = `${rect.top + scrollY - 30}px`
          break
        case 'after':
          button.style.left = `${rect.right + scrollX - button.offsetWidth}px`
          button.style.top = `${rect.bottom + scrollY + 5}px`
          break
        case 'overlay':
        default:
          button.style.left = `${rect.right + scrollX - button.offsetWidth - 10}px`
          button.style.top = `${rect.top + scrollY + 5}px`
          break
      }
    }

    updatePosition()

    // Update position on scroll/resize
    const handlePositionUpdate = () => updatePosition()
    window.addEventListener('scroll', handlePositionUpdate, { passive: true })
    window.addEventListener('resize', handlePositionUpdate, { passive: true })
  }

  private async handleImproveClick(element: HTMLElement) {
    const text = this.getElementText(element)
    if (!text || text.trim().length < 5) {
      this.showToast('Please enter some text first', 'warning')
      return
    }

    try {
      // Show loading state
      const button = this.improveButtons.get(element)
      if (button) {
        button.innerHTML = '⏳ Improving...'
        button.disabled = true
      }

      // Analyze the prompt
      const analysis = await this.analyzePrompt(text)
      
      // Show confirmation modal
      this.showConfirmationModal(element, text, analysis)

    } catch (error) {
      console.error('Error improving prompt:', error)
      this.showToast('Error improving prompt. Please try again.', 'error')
    } finally {
      // Restore button state
      const button = this.improveButtons.get(element)
      if (button) {
        button.innerHTML = '✨ Improve'
        button.disabled = false
      }
    }
  }

  private getElementText(element: HTMLElement): string {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return (element as HTMLInputElement).value
    } else if (element.isContentEditable) {
      return element.textContent || ''
    }
    return ''
  }

  private setElementText(element: HTMLElement, text: string) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      (element as HTMLInputElement).value = text
      element.dispatchEvent(new Event('input', { bubbles: true }))
    } else if (element.isContentEditable) {
      element.textContent = text
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  private async analyzePrompt(text: string) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'ANALYZE_PROMPT', data: { text } },
        (response) => {
          if (response.success) {
            resolve(response.data)
          } else {
            reject(new Error(response.error))
          }
        }
      )
    })
  }

  private showConfirmationModal(element: HTMLElement, originalText: string, analysis: any) {
    // Create modal overlay
    const overlay = document.createElement('div')
    overlay.className = 'prompt-polisher-modal-overlay'
    
    // Create modal content
    const modal = document.createElement('div')
    modal.className = 'prompt-polisher-modal'
    modal.innerHTML = `
      <div class="modal-header">
        <h3>✨ Improved Prompt</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="prompt-comparison">
          <div class="original-prompt">
            <h4>Original:</h4>
            <div class="prompt-text">${this.escapeHtml(originalText)}</div>
          </div>
          <div class="improved-prompt">
            <h4>Improved:</h4>
            <div class="prompt-text">${this.escapeHtml(analysis.improvedPrompt || originalText)}</div>
          </div>
        </div>
        <div class="options">
          <label>
            <input type="checkbox" id="show-persona" checked> Include persona suggestions
          </label>
          <label>
            <input type="checkbox" id="show-format" checked> Include format instructions
          </label>
          <label>
            <input type="checkbox" id="show-examples" checked> Include examples
          </label>
        </div>
        <div class="improvements-list">
          <h4>Suggested Improvements:</h4>
          <ul>
            ${Object.entries(analysis.improvements || {})
              .filter(([_, items]: [string, any]) => Array.isArray(items) && items.length > 0)
              .map(([category, items]: [string, any]) => 
                items.map((item: string) => `<li><strong>${category}:</strong> ${item}</li>`).join('')
              ).join('')}
          </ul>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="copy-btn">📋 Copy</button>
        <button class="btn-secondary" id="save-btn">💾 Save to Library</button>
        <button class="btn-primary" id="apply-btn">✅ Apply</button>
        <button class="btn-secondary" id="cancel-btn">Cancel</button>
      </div>
    `

    // Apply modal styles
    this.applyModalStyles(overlay, modal)
    
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn')
    const cancelBtn = modal.querySelector('#cancel-btn')
    const applyBtn = modal.querySelector('#apply-btn')
    const copyBtn = modal.querySelector('#copy-btn')
    const saveBtn = modal.querySelector('#save-btn')

    const closeModal = () => {
      document.body.removeChild(overlay)
    }

    closeBtn?.addEventListener('click', closeModal)
    cancelBtn?.addEventListener('click', closeModal)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal()
    })

    applyBtn?.addEventListener('click', () => {
      this.setElementText(element, analysis.improvedPrompt || originalText)
      this.showToast('Prompt applied successfully!', 'success')
      closeModal()
    })

    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(analysis.improvedPrompt || originalText)
      this.showToast('Copied to clipboard!', 'success')
    })

    saveBtn?.addEventListener('click', () => {
      this.saveToLibrary(originalText, analysis.improvedPrompt || originalText)
      this.showToast('Saved to library!', 'success')
    })
  }

  private applyModalStyles(overlay: HTMLElement, modal: HTMLElement) {
    // Overlay styles
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '100000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    })

    // Modal styles
    Object.assign(modal.style, {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '80vh',
      overflow: 'auto',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    })

    // Add CSS for modal content
    const style = document.createElement('style')
    style.textContent = `
      .prompt-polisher-modal h3 { margin: 0 0 15px 0; color: #333; }
      .prompt-polisher-modal h4 { margin: 10px 0 5px 0; font-size: 14px; color: #666; }
      .prompt-polisher-modal .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
      .prompt-polisher-modal .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; }
      .prompt-polisher-modal .prompt-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
      .prompt-polisher-modal .prompt-text { background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 13px; line-height: 1.4; max-height: 150px; overflow-y: auto; }
      .prompt-polisher-modal .options { margin: 15px 0; }
      .prompt-polisher-modal .options label { display: block; margin: 5px 0; font-size: 14px; }
      .prompt-polisher-modal .improvements-list ul { margin: 5px 0; padding-left: 20px; }
      .prompt-polisher-modal .improvements-list li { margin: 3px 0; font-size: 13px; }
      .prompt-polisher-modal .modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
      .prompt-polisher-modal button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
      .prompt-polisher-modal .btn-primary { background: #4f46e5; color: white; }
      .prompt-polisher-modal .btn-secondary { background: #e5e7eb; color: #374151; }
      .prompt-polisher-modal .btn-primary:hover { background: #3730a3; }
      .prompt-polisher-modal .btn-secondary:hover { background: #d1d5db; }
    `
    document.head.appendChild(style)
  }

  private async saveToLibrary(originalPrompt: string, improvedPrompt: string) {
    chrome.runtime.sendMessage({
      type: 'SAVE_TO_LIBRARY',
      data: {
        title: originalPrompt.substring(0, 50) + (originalPrompt.length > 50 ? '...' : ''),
        originalPrompt,
        improvedPrompt,
        category: 'General',
        tags: []
      }
    })
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toast = document.createElement('div')
    toast.className = 'prompt-polisher-toast'
    toast.textContent = message
    
    const colors = {
      success: '#10b981',
      error: '#ef4444', 
      warning: '#f59e0b'
    }

    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: colors[type],
      color: 'white',
      padding: '10px 20px',
      borderRadius: '4px',
      zIndex: '100001',
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    })

    document.body.appendChild(toast)
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast)
      }
    }, 3000)
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        this.triggerImproveOnFocusedElement()
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        this.toggleSuggestions()
      }
    })
  }

  private triggerImproveOnFocusedElement() {
    const focused = document.activeElement as HTMLElement
    if (focused && this.observedElements.has(focused)) {
      this.handleImproveClick(focused)
    }
  }

  private toggleSuggestions() {
    this.isActive = !this.isActive
    this.improveButtons.forEach(button => {
      button.style.display = this.isActive ? 'block' : 'none'
    })
    this.showToast(`Suggestions ${this.isActive ? 'enabled' : 'disabled'}`, 'success')
  }

  private handleMessage(message: ChromeMessage, sendResponse: Function) {
    switch (message.type) {
      case 'TRIGGER_IMPROVE':
        this.triggerImproveOnFocusedElement()
        break
      case 'TOGGLE_SUGGESTIONS':
        this.toggleSuggestions()
        break
      case 'IMPROVE_SELECTION':
        if (message.data.text) {
          // Handle context menu improve
          console.log('Improving selection:', message.data.text)
        }
        break
      case 'SAVE_SELECTION':
        if (message.data.text) {
          this.saveToLibrary(message.data.text, message.data.text)
          this.showToast('Saved to library!', 'success')
        }
        break
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ContentScript())
} else {
  new ContentScript()
}