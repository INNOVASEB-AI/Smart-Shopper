/**
 * Error Handler for Smart Shopper SA
 * 
 * Provides centralized error handling, user feedback, and logging
 */

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      NETWORK: 'network',
      SEARCH: 'search',
      FIREBASE: 'firebase',
      STORAGE: 'storage',
      VALIDATION: 'validation',
      UNKNOWN: 'unknown'
    };

    this.errorMessages = {
      network: {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        action: 'Retry'
      },
      search: {
        title: 'Search Error',
        message: 'Unable to search for products. Please try again with different keywords.',
        action: 'Try Again'
      },
      firebase: {
        title: 'Data Error',
        message: 'Unable to load product data. Please refresh the page and try again.',
        action: 'Refresh'
      },
      storage: {
        title: 'Storage Error',
        message: 'Unable to save your data. Please check your browser settings.',
        action: 'Check Settings'
      },
      validation: {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        action: 'Fix Input'
      },
      unknown: {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again.',
        action: 'Try Again'
      }
    };

    this.notificationTypes = {
      SUCCESS: 'success',
      WARNING: 'warning',
      ERROR: 'error',
      INFO: 'info'
    };
  }

  /**
   * Handle and display errors with user-friendly messages
   */
  handleError(error, context = 'unknown', showNotification = true) {
    console.error(`[${context}] Error:`, error);

    // Determine error type
    const errorType = this.categorizeError(error);
    
    // Get user-friendly message
    const errorInfo = this.errorMessages[errorType];
    
    // Log error for debugging
    this.logError(error, context, errorType);
    
    // Show notification to user
    if (showNotification) {
      this.showNotification(errorInfo.title, errorInfo.message, this.notificationTypes.ERROR, errorInfo.action);
    }
    
    // Return error info for further handling
    return {
      type: errorType,
      title: errorInfo.title,
      message: errorInfo.message,
      action: errorInfo.action,
      originalError: error
    };
  }

  /**
   * Categorize errors based on their nature
   */
  categorizeError(error) {
    if (error.name === 'NetworkError' || error.message.includes('fetch') || error.message.includes('network')) {
      return this.errorTypes.NETWORK;
    }
    
    if (error.message.includes('search') || error.message.includes('query')) {
      return this.errorTypes.SEARCH;
    }
    
    if (error.message.includes('firebase') || error.message.includes('firestore') || error.code) {
      return this.errorTypes.FIREBASE;
    }
    
    if (error.message.includes('storage') || error.message.includes('localStorage')) {
      return this.errorTypes.STORAGE;
    }
    
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return this.errorTypes.VALIDATION;
    }
    
    return this.errorTypes.UNKNOWN;
  }

  /**
   * Show user-friendly notifications
   */
  showNotification(title, message, type = this.notificationTypes.INFO, actionText = null, actionCallback = null) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-header">
          <h4 class="notification-title">${title}</h4>
          <button class="notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <p class="notification-message">${message}</p>
        ${actionText ? `<button class="notification-action" onclick="this.parentElement.parentElement.remove(); ${actionCallback ? actionCallback : ''}">${actionText}</button>` : ''}
      </div>
    `;

    // Add to notification container
    const container = this.getNotificationContainer();
    container.appendChild(notification);

    // Auto-remove after 5 seconds (except for errors)
    if (type !== this.notificationTypes.ERROR) {
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 5000);
    }

    return notification;
  }

  /**
   * Show success notification
   */
  showSuccess(title, message, actionText = null, actionCallback = null) {
    return this.showNotification(title, message, this.notificationTypes.SUCCESS, actionText, actionCallback);
  }

  /**
   * Show warning notification
   */
  showWarning(title, message, actionText = null, actionCallback = null) {
    return this.showNotification(title, message, this.notificationTypes.WARNING, actionText, actionCallback);
  }

  /**
   * Show info notification
   */
  showInfo(title, message, actionText = null, actionCallback = null) {
    return this.showNotification(title, message, this.notificationTypes.INFO, actionText, actionCallback);
  }

  /**
   * Get or create notification container
   */
  getNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Log errors for debugging
   */
  logError(error, context, type) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      context: context,
      type: type,
      message: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Store in localStorage for debugging
    try {
      const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      logs.push(errorLog);
      
      // Keep only last 50 errors
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      localStorage.setItem('errorLogs', JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  /**
   * Get error logs for debugging
   */
  getErrorLogs() {
    try {
      return JSON.parse(localStorage.getItem('errorLogs') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear error logs
   */
  clearErrorLogs() {
    localStorage.removeItem('errorLogs');
  }

  /**
   * Handle async operations with error catching
   */
  async handleAsync(operation, context = 'unknown', showNotification = true) {
    try {
      return await operation();
    } catch (error) {
      return this.handleError(error, context, showNotification);
    }
  }

  /**
   * Validate user input and show appropriate errors
   */
  validateInput(value, rules, fieldName) {
    const errors = [];

    if (rules.required && (!value || value.trim() === '')) {
      errors.push(`${fieldName} is required`);
    }

    if (rules.minLength && value && value.length < rules.minLength) {
      errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
    }

    if (rules.maxLength && value && value.length > rules.maxLength) {
      errors.push(`${fieldName} must be no more than ${rules.maxLength} characters`);
    }

    if (rules.pattern && value && !rules.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }

    if (errors.length > 0) {
      const errorMessage = errors.join(', ');
      this.showNotification('Validation Error', errorMessage, this.notificationTypes.ERROR);
      return false;
    }

    return true;
  }

  /**
   * Show loading state
   */
  showLoading(message = 'Loading...') {
    const loading = document.createElement('div');
    loading.id = 'loading-overlay';
    loading.className = 'loading-overlay';
    loading.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p class="loading-message">${message}</p>
      </div>
    `;
    document.body.appendChild(loading);
    return loading;
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.remove();
    }
  }

  /**
   * Show retry dialog
   */
  showRetryDialog(title, message, retryCallback) {
    const dialog = document.createElement('div');
    dialog.className = 'retry-dialog';
    dialog.innerHTML = `
      <div class="retry-content">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="retry-actions">
          <button class="retry-button" onclick="this.parentElement.parentElement.parentElement.remove(); ${retryCallback}()">Retry</button>
          <button class="cancel-button" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    return dialog;
  }
}

// Create global error handler instance
const errorHandler = new ErrorHandler();

// Export for use in other modules
export default errorHandler; 