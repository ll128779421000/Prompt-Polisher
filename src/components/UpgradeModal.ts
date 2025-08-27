import { BackendProvider } from '../utils/backendProvider'

export class UpgradeModal {
  private modal: HTMLElement | null = null
  private pricing: any[] = []

  constructor() {
    this.loadPricing()
  }

  private async loadPricing() {
    try {
      const response = await BackendProvider.getPricing()
      this.pricing = response.pricing || []
    } catch (error) {
      console.error('Failed to load pricing:', error)
    }
  }

  public show(currentUsage: any) {
    this.modal = this.createModal(currentUsage)
    document.body.appendChild(this.modal)
    
    // Add event listeners
    this.setupEventListeners()
    
    // Show with animation
    requestAnimationFrame(() => {
      this.modal?.classList.add('show')
    })
  }

  private createModal(usage: any): HTMLElement {
    const modal = document.createElement('div')
    modal.className = 'prompt-polisher-upgrade-modal'
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🚀 Upgrade to Premium</h2>
          <button class="close-btn" data-action="close">×</button>
        </div>
        
        <div class="modal-body">
          <div class="usage-info">
            <p>You've used <strong>${usage.queriesUsed || 0}/${usage.queriesLimit || 5}</strong> free queries today.</p>
            <p>Upgrade for unlimited access to advanced prompt improvements!</p>
          </div>
          
          <div class="pricing-plans">
            ${this.renderPricingPlans()}
          </div>
          
          <div class="premium-features">
            <h3>Premium Benefits</h3>
            <ul>
              <li>✅ Unlimited prompt improvements</li>
              <li>✅ Priority AI processing</li>
              <li>✅ Advanced prompt analysis</li>
              <li>✅ Export your prompt library</li>
              <li>✅ Premium support</li>
            </ul>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn secondary" data-action="close">Maybe Later</button>
          <button class="btn primary" data-action="continue-free">Continue with Local Mode</button>
        </div>
      </div>
    `

    this.addModalStyles()
    return modal
  }

  private renderPricingPlans(): string {
    if (!this.pricing.length) {
      return '<p>Loading pricing...</p>'
    }

    return this.pricing.map(plan => `
      <div class="pricing-card ${plan.id.includes('premium') ? 'recommended' : ''}" data-plan="${plan.id}">
        ${plan.id.includes('yearly') ? '<div class="badge">Best Value</div>' : ''}
        <h4>${plan.name}</h4>
        <div class="price">$${plan.amount}</div>
        <p class="description">${plan.description}</p>
        <div class="queries-info">
          ${plan.queries === -1 ? 'Unlimited queries' : `${plan.queries} queries`}
        </div>
        <button class="btn select-plan" data-plan="${plan.id}">
          ${plan.id.includes('premium') ? 'Start Subscription' : 'Buy Now'}
        </button>
      </div>
    `).join('')
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

    // Continue with free/local mode
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.dataset.action === 'continue-free') {
        this.close()
        this.showLocalModeInfo()
      }
    })

    // Select plan
    this.modal.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('select-plan')) {
        const planId = target.dataset.plan
        if (planId) {
          await this.startPaymentFlow(planId)
        }
      }
    })
  }

  private async startPaymentFlow(planId: string) {
    try {
      // Show loading
      const button = this.modal?.querySelector(`[data-plan="${planId}"] .select-plan`) as HTMLButtonElement
      if (button) {
        button.textContent = 'Processing...'
        button.disabled = true
      }

      // For now, redirect to external payment page
      // In a full implementation, you'd integrate Stripe Elements here
      const upgradeUrl = 'https://perfect-ai-prompts.lovable.app/pricing'
      window.open(`${upgradeUrl}?plan=${planId}&source=extension`, '_blank')
      
      this.close()

    } catch (error) {
      console.error('Payment flow error:', error)
      alert('Payment processing failed. Please try again.')
    }
  }

  private showLocalModeInfo() {
    // Create a simple notification about local mode
    const notification = document.createElement('div')
    notification.className = 'prompt-polisher-notification success'
    notification.innerHTML = `
      <div class="notification-content">
        <strong>Local Mode Activated</strong>
        <p>Using offline prompt improvement rules. Upgrade anytime for AI-powered enhancements!</p>
      </div>
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 5000)
  }

  public close() {
    if (!this.modal) return

    this.modal.classList.add('hiding')
    setTimeout(() => {
      this.modal?.remove()
      this.modal = null
    }, 300)
  }

  private addModalStyles() {
    if (document.getElementById('upgrade-modal-styles')) return

    const styles = document.createElement('style')
    styles.id = 'upgrade-modal-styles'
    styles.textContent = `
      .prompt-polisher-upgrade-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .prompt-polisher-upgrade-modal.show {
        opacity: 1;
      }

      .prompt-polisher-upgrade-modal.hiding {
        opacity: 0;
      }

      .prompt-polisher-upgrade-modal .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
      }

      .prompt-polisher-upgrade-modal .modal-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
      }

      .prompt-polisher-upgrade-modal .modal-header {
        padding: 24px 24px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 24px;
      }

      .prompt-polisher-upgrade-modal h2 {
        margin: 0;
        font-size: 24px;
        color: #1f2937;
      }

      .prompt-polisher-upgrade-modal .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .prompt-polisher-upgrade-modal .modal-body {
        padding: 0 24px;
      }

      .prompt-polisher-upgrade-modal .usage-info {
        background: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 24px;
      }

      .prompt-polisher-upgrade-modal .pricing-plans {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .prompt-polisher-upgrade-modal .pricing-card {
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        position: relative;
        transition: all 0.2s ease;
      }

      .prompt-polisher-upgrade-modal .pricing-card:hover {
        border-color: #3b82f6;
        transform: translateY(-2px);
      }

      .prompt-polisher-upgrade-modal .pricing-card.recommended {
        border-color: #10b981;
        background: #ecfdf5;
      }

      .prompt-polisher-upgrade-modal .badge {
        position: absolute;
        top: -8px;
        right: 16px;
        background: #10b981;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
      }

      .prompt-polisher-upgrade-modal .pricing-card h4 {
        margin: 0 0 8px;
        font-size: 18px;
      }

      .prompt-polisher-upgrade-modal .price {
        font-size: 32px;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 8px;
      }

      .prompt-polisher-upgrade-modal .premium-features {
        background: #f8fafc;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      }

      .prompt-polisher-upgrade-modal .premium-features h3 {
        margin: 0 0 12px;
        color: #1f2937;
      }

      .prompt-polisher-upgrade-modal .premium-features ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .prompt-polisher-upgrade-modal .premium-features li {
        margin-bottom: 8px;
        color: #4b5563;
      }

      .prompt-polisher-upgrade-modal .modal-footer {
        padding: 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .prompt-polisher-upgrade-modal .btn {
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
      }

      .prompt-polisher-upgrade-modal .btn.primary {
        background: #3b82f6;
        color: white;
      }

      .prompt-polisher-upgrade-modal .btn.primary:hover {
        background: #2563eb;
      }

      .prompt-polisher-upgrade-modal .btn.secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .prompt-polisher-upgrade-modal .btn.select-plan {
        background: #10b981;
        color: white;
        width: 100%;
        margin-top: 16px;
      }

      .prompt-polisher-upgrade-modal .btn.select-plan:hover {
        background: #059669;
      }

      .prompt-polisher-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        padding: 16px 20px;
        z-index: 1000000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
      }

      .prompt-polisher-notification.success {
        border-left: 4px solid #10b981;
      }

      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `
    
    document.head.appendChild(styles)
  }
}