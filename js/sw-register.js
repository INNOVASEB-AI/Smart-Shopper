/**
 * Service Worker Registration for Smart Shopper SA
 * 
 * Handles PWA installation, updates, and offline functionality
 */

class ServiceWorkerManager {
  constructor() {
    this.swRegistration = null;
    this.isOnline = navigator.onLine;
    this.updateAvailable = false;
    this.installPrompt = null;
    
    this.init();
  }

  async init() {
    try {
      console.log('[SW Manager] Initializing service worker...');
      
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('[SW Manager] Service workers not supported');
        return;
      }

      // Register service worker
      await this.registerServiceWorker();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check for app updates
      this.checkForUpdates();
      
      console.log('[SW Manager] Service worker manager initialized');
      
    } catch (error) {
      console.error('[SW Manager] Failed to initialize:', error);
    }
  }

  async registerServiceWorker() {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('[SW Manager] Service worker registered:', this.swRegistration);

      // Handle service worker updates
      this.swRegistration.addEventListener('updatefound', () => {
        console.log('[SW Manager] Service worker update found');
        this.handleUpdateFound();
      });

      // Handle service worker state changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] Service worker controller changed');
        this.handleControllerChange();
      });

      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });

    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error);
    }
  }

  setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOffline();
    });

    // Before install prompt
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('[SW Manager] Before install prompt');
      event.preventDefault();
      this.installPrompt = event;
      this.showInstallPrompt();
    });

    // App installed
    window.addEventListener('appinstalled', () => {
      console.log('[SW Manager] App installed');
      this.handleAppInstalled();
    });

    // Visibility change (app in background/foreground)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.handleAppVisible();
      }
    });
  }

  handleUpdateFound() {
    const newWorker = this.swRegistration.installing;
    
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New service worker is available
          this.updateAvailable = true;
          this.showUpdateNotification();
        } else {
          // First time installation
          console.log('[SW Manager] Service worker installed for the first time');
        }
      }
    });
  }

  handleControllerChange() {
    // Reload the page to use the new service worker
    if (this.updateAvailable) {
      this.updateAvailable = false;
      this.showReloadNotification();
    }
  }

  handleServiceWorkerMessage(event) {
    const { data } = event;
    
    switch (data.type) {
      case 'background-sync':
        console.log('[SW Manager] Background sync message received');
        this.handleBackgroundSync();
        break;
        
      case 'cache-updated':
        console.log('[SW Manager] Cache updated');
        this.handleCacheUpdate(data);
        break;
        
      default:
        console.log('[SW Manager] Unknown message type:', data.type);
    }
  }

  handleOnline() {
    console.log('[SW Manager] App is online');
    
    // Show online notification
    if (window.errorHandler) {
      window.errorHandler.showSuccess('Back Online', 'Your connection has been restored');
    }
    
    // Sync any pending data
    this.syncPendingData();
  }

  handleOffline() {
    console.log('[SW Manager] App is offline');
    
    // Show offline notification
    if (window.errorHandler) {
      window.errorHandler.showWarning('You\'re Offline', 'Some features may be limited. Your data is saved locally.');
    }
  }

  handleAppInstalled() {
    // Track installation
    if ('gtag' in window) {
      gtag('event', 'pwa_install', {
        event_category: 'engagement',
        event_label: 'Smart Shopper SA'
      });
    }
    
    // Show welcome message
    if (window.errorHandler) {
      window.errorHandler.showSuccess('App Installed!', 'Smart Shopper SA is now installed on your device');
    }
  }

  handleAppVisible() {
    // Check for updates when app becomes visible
    this.checkForUpdates();
  }

  showInstallPrompt() {
    // Create install button if not already present
    if (!document.getElementById('install-button')) {
      const installButton = document.createElement('button');
      installButton.id = 'install-button';
      installButton.className = 'install-button';
      installButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7,10 12,15 17,10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Install App
      `;
      
      installButton.addEventListener('click', () => {
        this.installApp();
      });
      
      // Add to page
      const header = document.querySelector('header');
      if (header) {
        header.appendChild(installButton);
      }
    }
  }

  async installApp() {
    if (!this.installPrompt) {
      return;
    }

    try {
      // Show the install prompt
      const result = await this.installPrompt.prompt();
      
      if (result.outcome === 'accepted') {
        console.log('[SW Manager] User accepted the install prompt');
      } else {
        console.log('[SW Manager] User dismissed the install prompt');
      }
      
      // Clear the prompt
      this.installPrompt = null;
      
      // Remove install button
      const installButton = document.getElementById('install-button');
      if (installButton) {
        installButton.remove();
      }
      
    } catch (error) {
      console.error('[SW Manager] Install prompt failed:', error);
    }
  }

  showUpdateNotification() {
    if (window.errorHandler) {
      window.errorHandler.showInfo(
        'Update Available',
        'A new version of Smart Shopper SA is available. Refresh to update.',
        'Update Now',
        () => this.updateApp()
      );
    }
  }

  showReloadNotification() {
    if (window.errorHandler) {
      window.errorHandler.showSuccess(
        'App Updated',
        'Smart Shopper SA has been updated with new features!'
      );
    }
  }

  updateApp() {
    // Send message to service worker to skip waiting
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SKIP_WAITING'
      });
    }
    
    // Reload the page
    window.location.reload();
  }

  async checkForUpdates() {
    if (this.swRegistration) {
      try {
        await this.swRegistration.update();
      } catch (error) {
        console.error('[SW Manager] Update check failed:', error);
      }
    }
  }

  async syncPendingData() {
    // Sync any pending shopping list changes
    if (window.storage) {
      try {
        await window.storage.syncPendingChanges();
      } catch (error) {
        console.error('[SW Manager] Sync failed:', error);
      }
    }
  }

  handleBackgroundSync() {
    // Handle background sync when back online
    console.log('[SW Manager] Performing background sync...');
    
    // Sync any pending data
    this.syncPendingData();
    
    // Check for updates
    this.checkForUpdates();
  }

  handleCacheUpdate(data) {
    console.log('[SW Manager] Cache updated:', data);
    
    // Update UI if needed
    if (data.cacheType === 'products') {
      // Refresh product data
      if (window.refreshProductData) {
        window.refreshProductData();
      }
    }
  }

  // Public methods for external use
  async clearCache() {
    if (this.swRegistration) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
        console.log('[SW Manager] Cache cleared');
        return true;
      } catch (error) {
        console.error('[SW Manager] Failed to clear cache:', error);
        return false;
      }
    }
    return false;
  }

  async getCacheInfo() {
    try {
      const cacheNames = await caches.keys();
      const cacheInfo = {};
      
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        cacheInfo[name] = keys.length;
      }
      
      return cacheInfo;
    } catch (error) {
      console.error('[SW Manager] Failed to get cache info:', error);
      return {};
    }
  }

  isUpdateAvailable() {
    return this.updateAvailable;
  }

  isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  getConnectionInfo() {
    return {
      online: this.isOnline,
      connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
      downlink: navigator.connection ? navigator.connection.downlink : null,
      rtt: navigator.connection ? navigator.connection.rtt : null
    };
  }
}

// Create global instance
const swManager = new ServiceWorkerManager();

// Export for use in other modules
export default swManager; 