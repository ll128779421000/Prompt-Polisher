import { ModernImproveButton } from '../components/ModernImproveButton'
import { BackendProvider } from '../utils/backendProvider'

export class SiteIntegration {
  private observer: MutationObserver | null = null
  private activeButtons: Map<HTMLElement, ModernImproveButton> = new Map()
  private isInitialized = false

  // Supported sites configuration
  private siteConfigs = {
    'chat.openai.com': {
      name: 'ChatGPT',
      selectors: [
        'textarea[placeholder*="message"]',
        '#prompt-textarea',
        'textarea[data-id*="root"]',
        '.ProseMirror'
      ],
      waitForLoad: 2000,
      checkInterval: 1000
    },
    'claude.ai': {
      name: 'Claude',
      selectors: [
        'div[contenteditable="true"]',
        '.ProseMirror',
        'textarea[placeholder*="Talk to Claude"]'
      ],
      waitForLoad: 1500,
      checkInterval: 1000
    },
    'gemini.google.com': {
      name: 'Gemini',
      selectors: [
        'rich-textarea',
        '.ql-editor',
        'textarea[placeholder*="Enter a prompt"]'
      ],
      waitForLoad: 2000,
      checkInterval: 1000
    },
    'www.perplexity.ai': {
      name: 'Perplexity',
      selectors: [
        'textarea[placeholder*="Ask anything"]',
        '.relative textarea',
        '[data-testid="search-input"]'
      ],
      waitForLoad: 1500,
      checkInterval: 1000
    },
    'huggingface.co': {
      name: 'Hugging Face',
      selectors: [
        'textarea[placeholder*="Type a message"]',
        '.chat-input textarea',
        'textarea[name="prompt"]'
      ],
      waitForLoad: 1000,
      checkInterval: 1500
    },
    'character.ai': {
      name: 'Character.AI',
      selectors: [
        'textarea[placeholder*="Type a message"]',
        '.composer-input textarea',
        '[data-testid="composer-input"]'
      ],
      waitForLoad: 2000,
      checkInterval: 1000
    },
    'poe.com': {
      name: 'Poe',
      selectors: [
        'textarea[class*="GrowingTextArea"]',
        'textarea[placeholder*="Talk to"]',
        '.ChatMessageInputView textarea'
      ],
      waitForLoad: 1500,
      checkInterval: 1000
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Initialize backend provider
    BackendProvider.initialize()

    // Get current site config
    const hostname = window.location.hostname
    const config = this.siteConfigs[hostname as keyof typeof this.siteConfigs]

    if (!config) {
      console.log('Perfect AI Prompts: Site not supported:', hostname)
      return
    }

    console.log(`Perfect AI Prompts: Initializing for ${config.name}`)

    // Wait for page to load
    await this.waitForPageLoad(config.waitForLoad)

    // Start monitoring for text inputs
    this.startInputMonitoring(config)

    this.isInitialized = true

    // Add custom styles
    this.addGlobalStyles()

    // Inject branding
    this.injectBrandingInfo()
  }

  private async waitForPageLoad(delay: number): Promise<void> {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, delay)
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, delay)
        })
      }
    })
  }

  private startInputMonitoring(config: any): void {
    // Initial scan
    this.scanForInputs(config.selectors)

    // Set up mutation observer
    this.observer = new MutationObserver(() => {
      this.scanForInputs(config.selectors)
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'contenteditable']
    })

    // Periodic scan as fallback
    setInterval(() => {
      this.scanForInputs(config.selectors)
    }, config.checkInterval)
  }

  private scanForInputs(selectors: string[]): void {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>
      
      for (const element of elements) {
        if (this.shouldAttachButton(element)) {
          this.attachImproveButton(element)
        }
      }
    }
  }

  private shouldAttachButton(element: HTMLElement): boolean {
    // Skip if already has button
    if (this.activeButtons.has(element)) return false

    // Skip if element is not visible
    if (!this.isElementVisible(element)) return false

    // Skip if element is too small
    const rect = element.getBoundingClientRect()
    if (rect.width < 200 || rect.height < 30) return false

    // Skip if element is readonly or disabled
    if (element.hasAttribute('readonly') || element.hasAttribute('disabled')) return false

    // Skip if element is inside a form that looks like search
    const form = element.closest('form')
    if (form && (form.className.includes('search') || form.id.includes('search'))) return false

    return true
  }

  private isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element)
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    )
  }

  private attachImproveButton(element: HTMLElement): void {
    try {
      // Create and attach improve button
      const improveButton = new ModernImproveButton(element)
      this.activeButtons.set(element, improveButton)

      // Listen for element removal to cleanup
      const cleanupObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.removedNodes.forEach(node => {
            if (node === element || (node as Element)?.contains?.(element)) {
              this.cleanupButton(element)
              cleanupObserver.disconnect()
            }
          })
        })
      })

      cleanupObserver.observe(document.body, {
        childList: true,
        subtree: true
      })

      // Focus/blur handlers
      element.addEventListener('focus', () => {
        setTimeout(() => {
          if (document.activeElement === element) {
            improveButton.show()
          }
        }, 100)
      })

      element.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.activeElement !== element) {
            improveButton.hide()
          }
        }, 5000) // Give time for user to interact with button
      })

    } catch (error) {
      console.error('Perfect AI Prompts: Failed to attach button:', error)
    }
  }

  private cleanupButton(element: HTMLElement): void {
    const button = this.activeButtons.get(element)
    if (button) {
      button.hide()
      this.activeButtons.delete(element)
    }
  }

  private injectBrandingInfo(): void {
    // Only inject once
    if (document.getElementById('perfect-prompts-branding')) return

    const branding = document.createElement('div')
    branding.id = 'perfect-prompts-branding'
    branding.innerHTML = `
      <div class="perfect-prompts-info">
        <div class="info-content">
          <span class="info-text">Enhanced by Perfect AI Prompts</span>
          <a href="https://perfect-ai-prompts.lovable.app/" target="_blank" class="info-link">
            Learn More
          </a>
        </div>
      </div>
    `

    document.body.appendChild(branding)

    // Auto-hide after 8 seconds
    setTimeout(() => {
      branding.style.opacity = '0'
      setTimeout(() => branding.remove(), 300)
    }, 8000)
  }

  private addGlobalStyles(): void {
    if (document.getElementById('perfect-prompts-global-styles')) return

    const styles = document.createElement('style')
    styles.id = 'perfect-prompts-global-styles'
    styles.textContent = `
      .perfect-prompts-info {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 2147483645;
        background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
        color: white;
        border-radius: 10px;
        padding: 12px 16px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        transition: all 0.3s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .perfect-prompts-info:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25);
      }

      .perfect-prompts-info .info-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .perfect-prompts-info .info-text {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
      }

      .perfect-prompts-info .info-link {
        font-size: 12px;
        color: white;
        text-decoration: none;
        background: rgba(255, 255, 255, 0.1);
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: all 0.2s ease;
      }

      .perfect-prompts-info .info-link:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }

      /* Hide on mobile to avoid clutter */
      @media (max-width: 768px) {
        .perfect-prompts-info {
          display: none;
        }
      }
    `

    document.head.appendChild(styles)
  }

  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    // Cleanup all buttons
    for (const [element, button] of this.activeButtons.entries()) {
      button.hide()
    }
    this.activeButtons.clear()

    // Remove branding
    document.getElementById('perfect-prompts-branding')?.remove()
    document.getElementById('perfect-prompts-global-styles')?.remove()

    this.isInitialized = false
  }
}

// Auto-initialize on supported sites
const integration = new SiteIntegration()

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    integration.initialize()
  })
} else {
  integration.initialize()
}

// Handle navigation changes (SPA sites)
let lastUrl = location.href
new MutationObserver(() => {
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    console.log('Perfect AI Prompts: Navigation detected, reinitializing...')
    integration.destroy()
    setTimeout(() => {
      integration.initialize()
    }, 1000)
  }
}).observe(document, { subtree: true, childList: true })

// Keyboard shortcut handler (global)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
    // This will be handled by the active button if target is supported
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && (
      activeElement.tagName === 'TEXTAREA' || 
      activeElement.getAttribute('contenteditable') === 'true'
    )) {
      console.log('Perfect AI Prompts: Global shortcut triggered')
    }
  }
})

// Export for potential external use
;(window as any).PerfectPrompts = {
  integration,
  BackendProvider
}