// locationPermissionModal.js - Custom location permission modal for Smart Shopper SA

class LocationPermissionModal {
  constructor() {
    this.modal = null;
    this.isVisible = false;
    this.onAllowCallback = null;
    this.onDenyCallback = null;
  }

  // Create the modal HTML
  createModal() {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.id = 'location-permission-modal';
    this.modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    this.modal.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'relative max-w-md w-full mx-auto';
    modalContent.style.cssText = `
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      transform: scale(0.9);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    // Modal header with close button
    const modalHeader = document.createElement('div');
    modalHeader.className = 'relative p-6 pb-4';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      color: var(--card-text);
    `;
    closeButton.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    `;
    closeButton.addEventListener('click', () => this.hide());
    
    modalHeader.appendChild(closeButton);

    // Feature icon and title
    const iconContainer = document.createElement('div');
    iconContainer.className = 'flex justify-center mb-4';
    
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'relative w-20 h-20 rounded-full flex items-center justify-center';
    iconWrapper.style.cssText = `
      background: linear-gradient(135deg, var(--accent) 0%, rgba(255, 186, 8, 0.8) 100%);
    `;
    
    // Location pin icon
    const locationIcon = document.createElement('svg');
    locationIcon.className = 'w-10 h-10';
    locationIcon.style.color = 'var(--accent-text)';
    locationIcon.innerHTML = `
      <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    `;
    
    // Deals badge
    const dealsBadge = document.createElement('div');
    dealsBadge.className = 'absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold';
    dealsBadge.style.cssText = `
      background: linear-gradient(135deg, #EC4899 0%, #F472B6 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
    `;
    dealsBadge.textContent = '%';
    
    iconWrapper.appendChild(locationIcon);
    iconWrapper.appendChild(dealsBadge);
    iconContainer.appendChild(iconWrapper);

    // Title and description
    const textContent = document.createElement('div');
    textContent.className = 'text-center mb-6';
    
    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold mb-3';
    title.style.color = 'var(--card-text)';
    title.textContent = 'Find nearby deals';
    
    const description = document.createElement('p');
    description.className = 'text-base leading-relaxed';
    description.style.color = 'var(--secondary-text)';
    description.textContent = 'Unlock exclusive discounts and offers at stores near you. Get the best prices and never miss a deal!';
    
    textContent.appendChild(title);
    textContent.appendChild(description);

    // Benefits list
    const benefitsList = document.createElement('div');
    benefitsList.className = 'mb-6 space-y-3';
    
    const benefits = [
      { icon: '📍', text: 'Discover stores within walking distance' },
      { icon: '💰', text: 'Find the best prices at nearby locations' },
      { icon: '🚀', text: 'Get real-time deal notifications' },
      { icon: '🗺️', text: 'Easy directions to store locations' }
    ];
    
    benefits.forEach(benefit => {
      const benefitItem = document.createElement('div');
      benefitItem.className = 'flex items-center space-x-3';
      
      const benefitIcon = document.createElement('span');
      benefitIcon.className = 'text-lg';
      benefitIcon.textContent = benefit.icon;
      
      const benefitText = document.createElement('span');
      benefitText.className = 'text-sm';
      benefitText.style.color = 'var(--card-text)';
      benefitText.textContent = benefit.text;
      
      benefitItem.appendChild(benefitIcon);
      benefitItem.appendChild(benefitText);
      benefitsList.appendChild(benefitItem);
    });

    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.className = 'flex space-x-3 p-6 pt-0';
    
    const allowButton = document.createElement('button');
    allowButton.id = 'location-allow-btn';
    allowButton.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all transform hover:scale-105';
    allowButton.style.cssText = `
      background: var(--accent);
      color: var(--accent-text);
      box-shadow: 0 4px 12px rgba(255, 186, 8, 0.3);
    `;
    allowButton.textContent = 'Allow Location';
    allowButton.addEventListener('click', () => this.handleAllow());
    
    const denyButton = document.createElement('button');
    denyButton.id = 'location-deny-btn';
    denyButton.className = 'flex-1 py-3 px-6 rounded-lg font-semibold transition-all border-2';
    denyButton.style.cssText = `
      background: transparent;
      color: var(--card-text);
      border-color: var(--border-color);
    `;
    denyButton.textContent = 'Not Now';
    denyButton.addEventListener('click', () => this.handleDeny());
    
    actionButtons.appendChild(allowButton);
    actionButtons.appendChild(denyButton);

    // Privacy note
    const privacyNote = document.createElement('div');
    privacyNote.className = 'text-center p-4 pt-0';
    privacyNote.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      margin: 0 6px;
    `;
    
    const privacyText = document.createElement('p');
    privacyText.className = 'text-xs';
    privacyText.style.color = 'var(--secondary-text)';
    privacyText.innerHTML = '🔒 Your location data stays on your device and is never shared with third parties.';
    
    privacyNote.appendChild(privacyText);

    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(iconContainer);
    modalContent.appendChild(textContent);
    modalContent.appendChild(benefitsList);
    modalContent.appendChild(actionButtons);
    modalContent.appendChild(privacyNote);
    
    this.modal.appendChild(modalContent);
    
    // Add to DOM
    document.body.appendChild(this.modal);
    
    // Add event listeners
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
  }

  // Show the modal
  show(onAllow = null, onDeny = null) {
    if (this.isVisible) return;
    
    this.onAllowCallback = onAllow;
    this.onDenyCallback = onDeny;
    
    if (!this.modal) {
      this.createModal();
    }
    
    this.modal.style.display = 'flex';
    
    // Trigger animation
    setTimeout(() => {
      const modalContent = this.modal.querySelector('div');
      modalContent.style.transform = 'scale(1)';
      modalContent.style.opacity = '1';
    }, 10);
    
    this.isVisible = true;
    
    // Add escape key listener
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  // Hide the modal
  hide() {
    if (!this.isVisible) return;
    
    const modalContent = this.modal.querySelector('div');
    modalContent.style.transform = 'scale(0.9)';
    modalContent.style.opacity = '0';
    
    setTimeout(() => {
      this.modal.style.display = 'none';
      this.isVisible = false;
    }, 300);
    
    // Remove escape key listener
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

  // Handle escape key
  handleEscapeKey = (e) => {
    if (e.key === 'Escape') {
      this.hide();
    }
  };

  // Handle allow button click
  async handleAllow() {
    try {
      // Show loading state
      const allowButton = document.getElementById('location-allow-btn');
      const originalText = allowButton.textContent;
      allowButton.textContent = 'Getting Location...';
      allowButton.disabled = true;
      
      // Request location permission
      if (navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          });
        });
        
        // Success - hide modal and call callback
        this.hide();
        if (this.onAllowCallback) {
          this.onAllowCallback(position);
        }
        
        // Show success message
        this.showSuccessMessage('Location enabled successfully! 🎉');
        
      } else {
        throw new Error('Geolocation not supported');
      }
      
    } catch (error) {
      console.error('Location request failed:', error);
      
      // Reset button state
      const allowButton = document.getElementById('location-allow-btn');
      allowButton.textContent = 'Allow Location';
      allowButton.disabled = false;
      
      // Show error message
      this.showErrorMessage(this.getErrorMessage(error));
    }
  }

  // Handle deny button click
  handleDeny() {
    this.hide();
    if (this.onDenyCallback) {
      this.onDenyCallback();
    }
    
    // Show info message
    this.showInfoMessage('Location services disabled. You can enable them later in settings.');
  }

  // Get user-friendly error message
  getErrorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location access was denied. Please enable location services in your browser settings.';
      case error.POSITION_UNAVAILABLE:
        return 'Location information is currently unavailable. Please try again.';
      case error.TIMEOUT:
        return 'Location request timed out. Please check your connection and try again.';
      default:
        return 'Unable to get your location. Please try again later.';
    }
  }

  // Show success message
  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }

  // Show error message
  showErrorMessage(message) {
    this.showToast(message, 'error');
  }

  // Show info message
  showInfoMessage(message) {
    this.showToast(message, 'info');
  }

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300';
    
    let bgColor, textColor, icon;
    switch (type) {
      case 'success':
        bgColor = 'var(--success)';
        textColor = 'white';
        icon = '✅';
        break;
      case 'error':
        bgColor = 'var(--error)';
        textColor = 'white';
        icon = '❌';
        break;
      default:
        bgColor = 'var(--accent)';
        textColor = 'var(--accent-text)';
        icon = 'ℹ️';
    }
    
    toast.style.cssText = `
      background: ${bgColor};
      color: ${textColor};
    `;
    
    toast.innerHTML = `
      <div class="flex items-center space-x-2">
        <span>${icon}</span>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(full)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  // Check if location permission is already granted
  static async checkLocationPermission() {
    if (!navigator.geolocation) {
      return 'not-supported';
    }
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000
        });
      });
      return 'granted';
    } catch (error) {
      if (error.code === error.PERMISSION_DENIED) {
        return 'denied';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        return 'unavailable';
      } else if (error.code === error.TIMEOUT) {
        return 'timeout';
      } else {
        return 'error';
      }
    }
  }

  // Destroy the modal
  destroy() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    this.modal = null;
    this.isVisible = false;
  }
}

// Export the modal class
export default LocationPermissionModal; 