import { ModernPromptModal } from './ModernPromptModal'
import { BackendProvider } from '../utils/backendProvider'

export class ModernImproveButton {
  private button: HTMLElement | null = null
  private targetElement: HTMLElement | null = null
  private modal: ModernPromptModal | null = null

  constructor(targetElement: HTMLElement) {
    this.targetElement = targetElement
    this.createButton()
    this.attachToTarget()
  }

  private createButton(): void {
    this.button = document.createElement('div')
    this.button.className = 'perfect-prompts-improve-btn'
    this.button.innerHTML = `
      <div class="improve-btn-content">
        <div class="improve-icon">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="improve-text">Improve</span>
        <div class="improve-shortcut">⇧⌘I</div>
      </div>
      <div class="improve-tooltip">
        <div class="tooltip-content">
          <strong>Perfect AI Prompts</strong>
          <p>Enhance your prompt with AI-powered improvements</p>
          <div class="tooltip-features">
            <span>✨ Better clarity</span>
            <span>🎯 More specific</span>
            <span>📝 Professional structure</span>
          </div>
        </div>
      </div>
    `

    this.addButtonStyles()
    this.setupButtonEvents()
  }

  private attachToTarget(): void {
    if (!this.targetElement || !this.button) return

    // Position button relative to target
    const rect = this.targetElement.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    this.button.style.position = 'absolute'
    this.button.style.top = `${rect.bottom + scrollTop + 8}px`
    this.button.style.right = `${window.innerWidth - rect.right - scrollLeft}px`
    this.button.style.zIndex = '2147483646'

    document.body.appendChild(this.button)

    // Show button with animation
    requestAnimationFrame(() => {
      this.button?.classList.add('show')
    })

    // Auto-hide after 5 seconds if not hovered
    setTimeout(() => {
      if (!this.button?.matches(':hover')) {
        this.hide()
      }
    }, 5000)
  }

  private setupButtonEvents(): void {
    if (!this.button) return

    // Click handler
    this.button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.handleImproveClick()
    })

    // Hover effects
    this.button.addEventListener('mouseenter', () => {
      this.button?.classList.add('hovered')
    })

    this.button.addEventListener('mouseleave', () => {
      this.button?.classList.remove('hovered')
    })

    // Keyboard shortcut (Ctrl+Shift+I or Cmd+Shift+I)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        if (this.isTargetActive()) {
          e.preventDefault()
          this.handleImproveClick()
        }
      }
    })
  }

  private async handleImproveClick(): Promise<void> {
    if (!this.targetElement) return

    // Get text from target element
    const text = this.getTextFromTarget()
    if (!text.trim()) {
      this.showNotification('Please enter some text to improve', 'warning')
      return
    }

    if (text.length > 10000) {
      this.showNotification('Text is too long (max 10,000 characters)', 'error')
      return
    }

    // Hide button and show modal
    this.hide()
    
    try {
      this.modal = new ModernPromptModal()
      await this.modal.show(text)
    } catch (error: any) {
      this.showNotification(`Error: ${error.message}`, 'error')
    }
  }

  private getTextFromTarget(): string {
    if (!this.targetElement) return ''

    if (this.targetElement.tagName === 'TEXTAREA') {
      return (this.targetElement as HTMLTextAreaElement).value
    } else if (this.targetElement.getAttribute('contenteditable')) {
      return this.targetElement.textContent || ''
    } else if (this.targetElement.tagName === 'INPUT') {
      return (this.targetElement as HTMLInputElement).value
    }

    return ''
  }

  private isTargetActive(): boolean {
    return document.activeElement === this.targetElement
  }

  private showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
    const notification = document.createElement('div')
    notification.className = `perfect-prompts-notification ${type}`
    
    const icons = {
      success: '<path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2"/>',
      warning: '<path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>',
      error: '<path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2"/>'
    }

    notification.innerHTML = `
      <div class="notification-content">
        <svg viewBox="0 0 24 24" fill="none">
          ${icons[type]}
        </svg>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => notification.classList.add('show'), 100)
    setTimeout(() => {
      notification.classList.add('hide')
      setTimeout(() => notification.remove(), 300)
    }, 4000)
  }

  public show(): void {
    if (this.button) {
      this.button.style.display = 'block'
      requestAnimationFrame(() => {
        this.button?.classList.add('show')
      })
    }
  }

  public hide(): void {
    if (this.button) {
      this.button.classList.remove('show')
      setTimeout(() => {
        this.button?.remove()
        this.button = null
      }, 300)
    }
  }

  public updatePosition(): void {
    if (!this.targetElement || !this.button) return

    const rect = this.targetElement.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    this.button.style.top = `${rect.bottom + scrollTop + 8}px`
    this.button.style.right = `${window.innerWidth - rect.right - scrollLeft}px`
  }

  private addButtonStyles(): void {
    if (document.getElementById('perfect-prompts-button-styles')) return

    const styles = document.createElement('style')
    styles.id = 'perfect-prompts-button-styles'
    styles.textContent = `
      .perfect-prompts-improve-btn {
        position: fixed;
        background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
        color: white;
        border-radius: 12px;
        padding: 0;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.1);
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 2147483646;
        user-select: none;
        backdrop-filter: blur(10px);
      }

      .perfect-prompts-improve-btn.show {
        opacity: 1;
        transform: translateY(0);
      }

      .perfect-prompts-improve-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.25);
      }

      .perfect-prompts-improve-btn.hovered .improve-tooltip {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .perfect-prompts-improve-btn .improve-btn-content {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        position: relative;
      }

      .perfect-prompts-improve-btn .improve-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
      }

      .perfect-prompts-improve-btn .improve-icon svg {
        width: 16px;
        height: 16px;
        color: white;
      }

      .perfect-prompts-improve-btn .improve-text {
        font-size: 14px;
        font-weight: 500;
        color: white;
        white-space: nowrap;
      }

      .perfect-prompts-improve-btn .improve-shortcut {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: ui-monospace, 'SF Mono', Monaco, monospace;
      }

      .perfect-prompts-improve-btn .improve-tooltip {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        padding: 20px;
        width: 280px;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        z-index: 2147483647;
      }

      .perfect-prompts-improve-btn .improve-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        right: 20px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid white;
      }

      .perfect-prompts-improve-btn .tooltip-content strong {
        font-size: 16px;
        color: #1e293b;
        display: block;
        margin-bottom: 4px;
      }

      .perfect-prompts-improve-btn .tooltip-content p {
        font-size: 14px;
        color: #64748b;
        margin: 0 0 12px;
        line-height: 1.4;
      }

      .perfect-prompts-improve-btn .tooltip-features {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .perfect-prompts-improve-btn .tooltip-features span {
        font-size: 12px;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .perfect-prompts-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        padding: 16px 20px;
        z-index: 2147483648;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid #e2e8f0;
        max-width: 400px;
      }

      .perfect-prompts-notification.show {
        transform: translateX(0);
        opacity: 1;
      }

      .perfect-prompts-notification.hide {
        transform: translateX(100%);
        opacity: 0;
      }

      .perfect-prompts-notification.success {
        border-left: 4px solid #22c55e;
      }

      .perfect-prompts-notification.warning {
        border-left: 4px solid #f59e0b;
      }

      .perfect-prompts-notification.error {
        border-left: 4px solid #ef4444;
      }

      .perfect-prompts-notification .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #1e293b;
        font-weight: 500;
        font-size: 14px;
      }

      .perfect-prompts-notification.success svg {
        width: 20px;
        height: 20px;
        color: #22c55e;
      }

      .perfect-prompts-notification.warning svg {
        width: 20px;
        height: 20px;
        color: #f59e0b;
      }

      .perfect-prompts-notification.error svg {
        width: 20px;
        height: 20px;
        color: #ef4444;
      }

      @media (max-width: 768px) {
        .perfect-prompts-improve-btn .improve-tooltip {
          width: 250px;
          right: -20px;
        }

        .perfect-prompts-improve-btn .improve-shortcut {
          display: none;
        }
      }
    `
    
    document.head.appendChild(styles)
  }
}