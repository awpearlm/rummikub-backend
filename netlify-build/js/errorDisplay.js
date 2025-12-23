/**
 * Client-side Error Display System
 * Implements Requirements 6.1, 6.4
 */

class ErrorDisplay {
  constructor() {
    this.errorContainer = null;
    this.activeErrors = new Map();
    this.errorQueue = [];
    this.maxVisibleErrors = 3;
    
    this.init();
    console.log('🚨 Error Display System initialized');
  }

  /**
   * Initialize error display system
   * Requirements: 6.1
   */
  init() {
    // Create error container if it doesn't exist
    this.createErrorContainer();
    
    // Set up styles
    this.injectStyles();
    
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  /**
   * Create error display container
   * Requirements: 6.1
   */
  createErrorContainer() {
    this.errorContainer = document.getElementById('error-container');
    
    if (!this.errorContainer) {
      this.errorContainer = document.createElement('div');
      this.errorContainer.id = 'error-container';
      this.errorContainer.className = 'error-container';
      document.body.appendChild(this.errorContainer);
    }
  }

  /**
   * Inject CSS styles for error display
   * Requirements: 6.1
   */
  injectStyles() {
    const styleId = 'error-display-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      .error-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      }

      .error-message {
        background: #ff4757;
        color: white;
        padding: 16px;
        margin-bottom: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        pointer-events: auto;
        animation: slideIn 0.3s ease-out;
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }

      .error-message.warning {
        background: #ffa502;
      }

      .error-message.info {
        background: #3742fa;
      }

      .error-message.success {
        background: #2ed573;
      }

      .error-message-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }

      .error-message-title {
        font-weight: 600;
        font-size: 15px;
      }

      .error-message-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 10px;
        opacity: 0.8;
        transition: opacity 0.2s;
      }

      .error-message-close:hover {
        opacity: 1;
      }

      .error-message-content {
        margin-bottom: 12px;
      }

      .error-message-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .error-action-button {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.2s;
      }

      .error-action-button:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .error-action-button.primary {
        background: rgba(255, 255, 255, 0.9);
        color: #333;
      }

      .error-action-button.primary:hover {
        background: white;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }

      .error-message.removing {
        animation: slideOut 0.3s ease-in forwards;
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .error-container {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }

        .error-message {
          padding: 12px;
          font-size: 13px;
        }

        .error-message-title {
          font-size: 14px;
        }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  /**
   * Set up global error handlers
   * Requirements: 6.1
   */
  setupGlobalErrorHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.showError('JavaScript Error', event.message, {
        type: 'error',
        canRetry: false,
        actions: [
          { text: 'Refresh Page', action: () => window.location.reload(), primary: true }
        ]
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.showError('Network Error', 'A network request failed. Please check your connection.', {
        type: 'error',
        canRetry: true,
        actions: [
          { text: 'Try Again', action: () => window.location.reload(), primary: true }
        ]
      });
    });
  }

  /**
   * Show error message to user
   * Requirements: 6.1
   */
  showError(title, message, options = {}) {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorData = {
      id: errorId,
      title: title || 'Error',
      message: message || 'An unexpected error occurred.',
      type: options.type || 'error',
      canRetry: options.canRetry !== false,
      actions: options.actions || [],
      duration: options.duration || (options.type === 'success' ? 5000 : 0), // Auto-hide success messages
      timestamp: Date.now()
    };

    // Add default retry action if error can be retried
    if (errorData.canRetry && errorData.actions.length === 0) {
      errorData.actions.push({
        text: 'Try Again',
        action: options.retryAction || (() => window.location.reload()),
        primary: true
      });
    }

    // Queue error if too many are visible
    if (this.activeErrors.size >= this.maxVisibleErrors) {
      this.errorQueue.push(errorData);
      return errorId;
    }

    this.displayError(errorData);
    return errorId;
  }

  /**
   * Display error message in the UI
   * Requirements: 6.1
   */
  displayError(errorData) {
    const errorElement = document.createElement('div');
    errorElement.className = `error-message ${errorData.type}`;
    errorElement.dataset.errorId = errorData.id;

    // Create error content
    errorElement.innerHTML = `
      <div class="error-message-header">
        <div class="error-message-title">${this.escapeHtml(errorData.title)}</div>
        <button class="error-message-close" aria-label="Close">&times;</button>
      </div>
      <div class="error-message-content">
        ${this.escapeHtml(errorData.message)}
      </div>
      ${errorData.actions.length > 0 ? `
        <div class="error-message-actions">
          ${errorData.actions.map(action => `
            <button class="error-action-button ${action.primary ? 'primary' : ''}" 
                    data-action="${action.text}">
              ${this.escapeHtml(action.text)}
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Set up event listeners
    const closeButton = errorElement.querySelector('.error-message-close');
    closeButton.addEventListener('click', () => {
      this.hideError(errorData.id);
    });

    // Set up action button listeners
    errorData.actions.forEach((action, index) => {
      const button = errorElement.querySelector(`[data-action="${action.text}"]`);
      if (button) {
        button.addEventListener('click', () => {
          if (typeof action.action === 'function') {
            action.action();
          }
          this.hideError(errorData.id);
        });
      }
    });

    // Add to container
    this.errorContainer.appendChild(errorElement);
    this.activeErrors.set(errorData.id, errorData);

    // Auto-hide if duration is set
    if (errorData.duration > 0) {
      setTimeout(() => {
        this.hideError(errorData.id);
      }, errorData.duration);
    }
  }

  /**
   * Hide error message
   * Requirements: 6.1
   */
  hideError(errorId) {
    const errorElement = this.errorContainer.querySelector(`[data-error-id="${errorId}"]`);
    if (!errorElement) return;

    errorElement.classList.add('removing');
    
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
      this.activeErrors.delete(errorId);
      
      // Show next queued error if any
      if (this.errorQueue.length > 0) {
        const nextError = this.errorQueue.shift();
        this.displayError(nextError);
      }
    }, 300);
  }

  /**
   * Show connection error
   * Requirements: 6.1, 6.4
   */
  showConnectionError(message, canRetry = true) {
    return this.showError('Connection Error', message, {
      type: 'error',
      canRetry: canRetry,
      actions: canRetry ? [
        { text: 'Reconnect', action: () => this.attemptReconnection(), primary: true },
        { text: 'Refresh Page', action: () => window.location.reload() }
      ] : [
        { text: 'Refresh Page', action: () => window.location.reload(), primary: true }
      ]
    });
  }

  /**
   * Show game error
   * Requirements: 6.1
   */
  showGameError(message, canRetry = true, retryAction = null) {
    return this.showError('Game Error', message, {
      type: 'error',
      canRetry: canRetry,
      actions: canRetry ? [
        { text: 'Try Again', action: retryAction || (() => window.location.reload()), primary: true }
      ] : []
    });
  }

  /**
   * Show success message
   * Requirements: 6.1
   */
  showSuccess(title, message) {
    return this.showError(title, message, {
      type: 'success',
      canRetry: false,
      duration: 5000
    });
  }

  /**
   * Show warning message
   * Requirements: 6.1
   */
  showWarning(title, message, actions = []) {
    return this.showError(title, message, {
      type: 'warning',
      canRetry: false,
      actions: actions
    });
  }

  /**
   * Show info message
   * Requirements: 6.1
   */
  showInfo(title, message, actions = []) {
    return this.showError(title, message, {
      type: 'info',
      canRetry: false,
      actions: actions,
      duration: 8000
    });
  }

  /**
   * Clear all error messages
   * Requirements: 6.1
   */
  clearAllErrors() {
    this.activeErrors.forEach((_, errorId) => {
      this.hideError(errorId);
    });
    this.errorQueue = [];
  }

  /**
   * Attempt reconnection (to be overridden by game client)
   * Requirements: 6.4
   */
  attemptReconnection() {
    // This should be overridden by the game client
    console.log('Attempting reconnection...');
    window.location.reload();
  }

  /**
   * Escape HTML to prevent XSS
   * Requirements: 6.1
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get error statistics
   * Requirements: 6.2
   */
  getStatistics() {
    return {
      activeErrors: this.activeErrors.size,
      queuedErrors: this.errorQueue.length,
      totalErrorsShown: this.activeErrors.size + this.errorQueue.length
    };
  }
}

// Create global error display instance
window.errorDisplay = new ErrorDisplay();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorDisplay;
}