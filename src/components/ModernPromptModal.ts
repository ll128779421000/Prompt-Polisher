import { BackendProvider } from '../utils/backendProvider'

export class ModernPromptModal {
  private modal: HTMLElement | null = null
  private isProcessing = false

  public async show(originalText: string, improvedText?: string, analysis?: any) {
    this.modal = this.createModal(originalText, improvedText, analysis)
    document.body.appendChild(this.modal)
    
    this.setupEventListeners()
    this.addModernStyles()
    
    // Animate in
    requestAnimationFrame(() => {
      this.modal?.classList.add('show')
    })

    // Auto-improve if no improved text provided
    if (!improvedText) {
      await this.improvePrompt(originalText)
    }
  }

  private createModal(originalText: string, improvedText?: string, analysis?: any): HTMLElement {
    const modal = document.createElement('div')
    modal.className = 'perfect-prompts-modal'
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-container">
        <div class="modal-header">
          <div class="brand-section">
            <svg class="brand-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
            <div class="brand-text">
              <h2>Perfect AI Prompts</h2>
              <p>Professional prompt enhancement</p>
            </div>
          </div>
          <button class="close-btn" data-action="close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="prompt-comparison">
            <div class="prompt-section original">
              <div class="section-header">
                <span class="section-label">Original Prompt</span>
                <span class="word-count">${this.getWordCount(originalText)} words</span>
              </div>
              <div class="prompt-content">
                <div class="text-area" data-content="original">${this.escapeHtml(originalText)}</div>
              </div>
            </div>

            <div class="improvement-arrow">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>

            <div class="prompt-section improved">
              <div class="section-header">
                <span class="section-label">Enhanced Prompt</span>
                <div class="enhancement-indicators">
                  <span class="improvement-badge clarity">Clarity</span>
                  <span class="improvement-badge structure">Structure</span>
                  <span class="improvement-badge context">Context</span>
                </div>
              </div>
              <div class="prompt-content">
                ${improvedText ? 
                  `<div class="text-area enhanced" data-content="improved">${this.escapeHtml(improvedText)}</div>` :
                  '<div class="loading-content"><div class="spinner"></div><p>Enhancing your prompt...</p></div>'
                }
              </div>
            </div>
          </div>

          <div class="analysis-section" style="display: ${analysis ? 'block' : 'none'}">
            <h3>Enhancement Analysis</h3>
            <div class="analysis-grid">
              <div class="analysis-item">
                <span class="analysis-label">Clarity Score</span>
                <div class="score-bar">
                  <div class="score-fill" style="width: 85%"></div>
                </div>
                <span class="score-text">85%</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">Specificity</span>
                <div class="score-bar">
                  <div class="score-fill" style="width: 78%"></div>
                </div>
                <span class="score-text">78%</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">Structure</span>
                <div class="score-bar">
                  <div class="score-fill" style="width: 92%"></div>
                </div>
                <span class="score-text">92%</span>
              </div>
            </div>
          </div>

          <div class="usage-info">
            <div class="usage-stats">
              <span class="stat-item">
                <span class="stat-value" data-usage="used">-</span>
                <span class="stat-label">Used Today</span>
              </span>
              <span class="stat-divider">/</span>
              <span class="stat-item">
                <span class="stat-value" data-usage="limit">-</span>
                <span class="stat-label">Daily Limit</span>
              </span>
            </div>
            <div class="upgrade-hint" style="display: none">
              <span>Upgrade for unlimited enhancements</span>
              <a href="https://perfect-ai-prompts.lovable.app/" target="_blank" class="upgrade-link">Learn More</a>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="action-buttons">
            <button class="btn secondary" data-action="copy">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
              </svg>
              Copy Enhanced
            </button>
            <button class="btn secondary" data-action="retry">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M1 4V10H7M23 20V14H17" stroke="currentColor" stroke-width="2"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" stroke-width="2"/>
              </svg>
              Try Again
            </button>
            <button class="btn primary" data-action="apply">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Apply Enhancement
            </button>
          </div>
          <div class="powered-by">
            Powered by <a href="https://perfect-ai-prompts.lovable.app/" target="_blank">Perfect AI Prompts</a>
          </div>
        </div>
      </div>
    `

    return modal
  }

  private async improvePrompt(originalText: string) {
    try {
      this.setProcessingState(true)
      
      const result = await BackendProvider.improvePrompt(originalText)
      
      if (result.error) {
        this.showUpgradeRequired(result.usage)
        return
      }

      this.updateImprovedContent(result.improvedPrompt)
      this.updateUsageInfo(result.usage)
      
    } catch (error: any) {
      this.showError(error.message)
    } finally {
      this.setProcessingState(false)
    }
  }

  private setProcessingState(processing: boolean) {
    this.isProcessing = processing
    const improvedSection = this.modal?.querySelector('.improved .prompt-content')
    
    if (processing && improvedSection) {
      improvedSection.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          <p>Enhancing your prompt...</p>
        </div>
      `
    }
  }

  private updateImprovedContent(improvedText: string) {
    const improvedSection = this.modal?.querySelector('.improved .prompt-content')
    if (improvedSection) {
      improvedSection.innerHTML = `
        <div class="text-area enhanced" data-content="improved">${this.escapeHtml(improvedText)}</div>
      `
    }

    // Show analysis section
    const analysisSection = this.modal?.querySelector('.analysis-section') as HTMLElement
    if (analysisSection) {
      analysisSection.style.display = 'block'
    }
  }

  private updateUsageInfo(usage: any) {
    const usedElement = this.modal?.querySelector('[data-usage="used"]')
    const limitElement = this.modal?.querySelector('[data-usage="limit"]')
    
    if (usedElement) usedElement.textContent = usage?.queriesUsed?.toString() || '0'
    if (limitElement) limitElement.textContent = usage?.queriesLimit?.toString() || '5'

    if (usage?.queriesUsed >= usage?.queriesLimit && !usage?.isPremium) {
      const upgradeHint = this.modal?.querySelector('.upgrade-hint') as HTMLElement
      if (upgradeHint) upgradeHint.style.display = 'flex'
    }
  }

  private showUpgradeRequired(usage: any) {
    const improvedSection = this.modal?.querySelector('.improved .prompt-content')
    if (improvedSection) {
      improvedSection.innerHTML = `
        <div class="upgrade-required">
          <div class="upgrade-icon">🚀</div>
          <h4>Daily Limit Reached</h4>
          <p>You've used all ${usage?.queriesLimit || 5} free enhancements today.</p>
          <a href="https://perfect-ai-prompts.lovable.app/" target="_blank" class="upgrade-btn">
            Upgrade for Unlimited Access
          </a>
        </div>
      `
    }
    this.updateUsageInfo(usage)
  }

  private showError(message: string) {
    const improvedSection = this.modal?.querySelector('.improved .prompt-content')
    if (improvedSection) {
      improvedSection.innerHTML = `
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <p>Enhancement temporarily unavailable</p>
          <button class="retry-btn" data-action="retry">Try Again</button>
        </div>
      `
    }
  }

  private setupEventListeners() {
    if (!this.modal) return

    // Close modal
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset.action === 'close' || target.classList.contains('modal-backdrop')) {
        this.close()
      }
    })

    // Copy enhanced prompt
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset.action === 'copy' || target.closest('[data-action="copy"]')) {
        this.copyEnhancedPrompt()
      }
    })

    // Apply enhancement
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset.action === 'apply' || target.closest('[data-action="apply"]')) {
        this.applyEnhancement()
      }
    })

    // Retry
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset.action === 'retry' || target.closest('[data-action="retry"]')) {
        const originalText = this.modal?.querySelector('[data-content="original"]')?.textContent || ''
        this.improvePrompt(originalText)
      }
    })

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.applyEnhancement()
    })
  }

  private copyEnhancedPrompt() {
    const improvedText = this.modal?.querySelector('[data-content="improved"]')?.textContent
    if (improvedText) {
      navigator.clipboard.writeText(improvedText).then(() => {
        this.showNotification('Enhanced prompt copied to clipboard!')
      })
    }
  }

  private applyEnhancement() {
    const improvedText = this.modal?.querySelector('[data-content="improved"]')?.textContent
    if (improvedText) {
      // Apply to original input field
      this.replaceOriginalText(improvedText)
      this.close()
      this.showNotification('Enhancement applied successfully!')
    }
  }

  private replaceOriginalText(newText: string) {
    // Find the active input field and replace its content
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.getAttribute('contenteditable'))) {
      if (activeElement.tagName === 'TEXTAREA') {
        (activeElement as HTMLTextAreaElement).value = newText
        activeElement.dispatchEvent(new Event('input', { bubbles: true }))
      } else {
        activeElement.textContent = newText
        activeElement.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  }

  private showNotification(message: string) {
    const notification = document.createElement('div')
    notification.className = 'perfect-prompts-notification'
    notification.innerHTML = `
      <div class="notification-content">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => notification.classList.add('show'), 100)
    setTimeout(() => {
      notification.classList.add('hide')
      setTimeout(() => notification.remove(), 300)
    }, 3000)
  }

  public close() {
    if (!this.modal) return

    this.modal.classList.add('hiding')
    setTimeout(() => {
      this.modal?.remove()
      this.modal = null
    }, 300)
  }

  private getWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private addModernStyles() {
    if (document.getElementById('perfect-prompts-modal-styles')) return

    const styles = document.createElement('style')
    styles.id = 'perfect-prompts-modal-styles'
    styles.textContent = `
      .perfect-prompts-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .perfect-prompts-modal.show {
        opacity: 1;
      }

      .perfect-prompts-modal.hiding {
        opacity: 0;
      }

      .perfect-prompts-modal .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
      }

      .perfect-prompts-modal .modal-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        width: 90vw;
        max-width: 900px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .perfect-prompts-modal .modal-header {
        padding: 24px 32px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
        color: white;
      }

      .perfect-prompts-modal .brand-section {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .perfect-prompts-modal .brand-icon {
        width: 32px;
        height: 32px;
        color: #ffffff;
      }

      .perfect-prompts-modal .brand-text h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        line-height: 1.2;
      }

      .perfect-prompts-modal .brand-text p {
        margin: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }

      .perfect-prompts-modal .close-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        color: white;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .perfect-prompts-modal .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .perfect-prompts-modal .close-btn svg {
        width: 20px;
        height: 20px;
      }

      .perfect-prompts-modal .modal-body {
        padding: 32px;
        overflow-y: auto;
        flex: 1;
      }

      .perfect-prompts-modal .prompt-comparison {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 24px;
        margin-bottom: 32px;
      }

      .perfect-prompts-modal .prompt-section {
        background: #f8fafc;
        border-radius: 12px;
        padding: 20px;
        border: 2px solid transparent;
        transition: border-color 0.2s ease;
      }

      .perfect-prompts-modal .prompt-section.improved {
        background: linear-gradient(135deg, #f0fdf4 0%, #f7fee7 100%);
        border-color: #22c55e;
      }

      .perfect-prompts-modal .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .perfect-prompts-modal .section-label {
        font-weight: 600;
        color: #1e293b;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .perfect-prompts-modal .word-count {
        font-size: 12px;
        color: #64748b;
        background: rgba(0, 0, 0, 0.05);
        padding: 4px 8px;
        border-radius: 6px;
      }

      .perfect-prompts-modal .enhancement-indicators {
        display: flex;
        gap: 8px;
      }

      .perfect-prompts-modal .improvement-badge {
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .perfect-prompts-modal .improvement-badge.clarity {
        background: #dbeafe;
        color: #1e40af;
      }

      .perfect-prompts-modal .improvement-badge.structure {
        background: #fef3c7;
        color: #92400e;
      }

      .perfect-prompts-modal .improvement-badge.context {
        background: #f3e8ff;
        color: #7c3aed;
      }

      .perfect-prompts-modal .text-area {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        min-height: 120px;
        font-size: 14px;
        line-height: 1.6;
        color: #1e293b;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .perfect-prompts-modal .text-area.enhanced {
        border-color: #22c55e;
        background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
      }

      .perfect-prompts-modal .improvement-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #22c55e;
        font-size: 24px;
        font-weight: bold;
      }

      .perfect-prompts-modal .improvement-arrow svg {
        width: 32px;
        height: 32px;
      }

      .perfect-prompts-modal .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: #64748b;
      }

      .perfect-prompts-modal .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f1f5f9;
        border-top: 3px solid #22c55e;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .perfect-prompts-modal .upgrade-required {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }

      .perfect-prompts-modal .upgrade-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .perfect-prompts-modal .upgrade-required h4 {
        margin: 0 0 8px;
        color: #1e293b;
        font-size: 18px;
      }

      .perfect-prompts-modal .upgrade-required p {
        margin: 0 0 20px;
        color: #64748b;
      }

      .perfect-prompts-modal .upgrade-btn {
        background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 500;
        transition: all 0.2s ease;
        display: inline-block;
      }

      .perfect-prompts-modal .upgrade-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
      }

      .perfect-prompts-modal .analysis-section {
        background: #f8fafc;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
      }

      .perfect-prompts-modal .analysis-section h3 {
        margin: 0 0 20px;
        color: #1e293b;
        font-size: 16px;
      }

      .perfect-prompts-modal .analysis-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
      }

      .perfect-prompts-modal .analysis-item {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .perfect-prompts-modal .analysis-label {
        font-weight: 500;
        color: #1e293b;
        min-width: 80px;
      }

      .perfect-prompts-modal .score-bar {
        flex: 1;
        height: 6px;
        background: #e2e8f0;
        border-radius: 3px;
        overflow: hidden;
      }

      .perfect-prompts-modal .score-fill {
        height: 100%;
        background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
        border-radius: 3px;
        transition: width 0.6s ease;
      }

      .perfect-prompts-modal .score-text {
        font-weight: 600;
        color: #16a34a;
        min-width: 40px;
        text-align: right;
      }

      .perfect-prompts-modal .usage-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 10px;
        border: 1px solid #e2e8f0;
      }

      .perfect-prompts-modal .usage-stats {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }

      .perfect-prompts-modal .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .perfect-prompts-modal .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
      }

      .perfect-prompts-modal .stat-label {
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .perfect-prompts-modal .stat-divider {
        font-size: 18px;
        color: #cbd5e1;
        margin: 0 8px;
      }

      .perfect-prompts-modal .upgrade-hint {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        color: #64748b;
      }

      .perfect-prompts-modal .upgrade-link {
        color: #000000;
        text-decoration: none;
        font-weight: 500;
        border-bottom: 1px solid currentColor;
      }

      .perfect-prompts-modal .modal-footer {
        padding: 24px 32px;
        border-top: 1px solid #f1f5f9;
        background: #fafbfc;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .perfect-prompts-modal .action-buttons {
        display: flex;
        gap: 12px;
      }

      .perfect-prompts-modal .btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        font-size: 14px;
      }

      .perfect-prompts-modal .btn svg {
        width: 16px;
        height: 16px;
      }

      .perfect-prompts-modal .btn.primary {
        background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
        color: white;
      }

      .perfect-prompts-modal .btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
      }

      .perfect-prompts-modal .btn.secondary {
        background: white;
        color: #64748b;
        border: 1px solid #e2e8f0;
      }

      .perfect-prompts-modal .btn.secondary:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      .perfect-prompts-modal .powered-by {
        font-size: 12px;
        color: #94a3b8;
      }

      .perfect-prompts-modal .powered-by a {
        color: #000000;
        text-decoration: none;
        font-weight: 500;
      }

      .perfect-prompts-modal .error-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }

      .perfect-prompts-modal .error-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .perfect-prompts-modal .retry-btn {
        background: #ef4444;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        margin-top: 12px;
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
      }

      .perfect-prompts-notification.show {
        transform: translateX(0);
        opacity: 1;
      }

      .perfect-prompts-notification.hide {
        transform: translateX(100%);
        opacity: 0;
      }

      .perfect-prompts-notification .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #1e293b;
        font-weight: 500;
      }

      .perfect-prompts-notification svg {
        width: 20px;
        height: 20px;
        color: #22c55e;
      }

      @media (max-width: 768px) {
        .perfect-prompts-modal .modal-container {
          width: 95vw;
          max-height: 95vh;
        }

        .perfect-prompts-modal .prompt-comparison {
          grid-template-columns: 1fr;
          grid-template-rows: auto auto auto;
        }

        .perfect-prompts-modal .improvement-arrow {
          transform: rotate(90deg);
        }

        .perfect-prompts-modal .modal-header,
        .perfect-prompts-modal .modal-body,
        .perfect-prompts-modal .modal-footer {
          padding: 20px;
        }

        .perfect-prompts-modal .action-buttons {
          flex-direction: column;
          width: 100%;
        }

        .perfect-prompts-modal .modal-footer {
          flex-direction: column;
          gap: 16px;
        }
      }
    `
    
    document.head.appendChild(styles)
  }
}