/**
 * Service Worker for Smart Shopper SA
 * 
 * Provides offline functionality, caching, and PWA features
 */

const CACHE_NAME = 'smart-shopper-v1.0.0';
const STATIC_CACHE = 'smart-shopper-static-v1.0.0';
const DYNAMIC_CACHE = 'smart-shopper-dynamic-v1.0.0';
const API_CACHE = 'smart-shopper-api-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/notifications.css',
  '/js/app.js',
  '/js/errorHandler.js',
  '/js/firebase.js',
  '/js/storage.js',
  '/js/ui.js',
  '/js/security.js',
  '/js/illustrations.js',
  '/js/listUI.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/images/logo_white.png',
  '/images/logo dark_gray.png',
  '/images/avocado.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/search',
  '/api/search/status',
  '/api/health'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (isStaticFile(request)) {
    event.respondWith(handleStaticFile(request));
  } else if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else {
    event.respondWith(handleOtherRequest(request));
  }
});

// Check if request is for a static file
function isStaticFile(request) {
  const url = new URL(request.url);
  return STATIC_FILES.some(file => url.pathname === file) ||
         url.pathname.startsWith('/css/') ||
         url.pathname.startsWith('/js/') ||
         url.pathname.startsWith('/images/') ||
         url.pathname.startsWith('/icons/');
}

// Check if request is for API
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') ||
         url.hostname === 'firestore.googleapis.com' ||
         url.hostname === 'identitytoolkit.googleapis.com';
}

// Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
}

// Handle static file requests
async function handleStaticFile(request) {
  try {
    // Try network first, fallback to cache
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the fresh response
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed for static file, trying cache:', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return offline page if nothing is cached
  return caches.match('/index.html');
}

// Handle API requests
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed for API request, trying cache:', request.url);
  }
  
  // Fallback to cache for API requests
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return offline response for API requests
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'You are offline. Please check your connection and try again.',
      timestamp: new Date().toISOString()
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

// Handle image requests
async function handleImageRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache images
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed for image, trying cache:', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return placeholder image if nothing is cached
  return caches.match('/images/avocado.png');
}

// Handle other requests
async function handleOtherRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('[SW] Network failed for request, trying cache:', request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Return offline page
  return caches.match('/index.html');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// Perform background sync
async function performBackgroundSync() {
  try {
    console.log('[SW] Performing background sync...');
    
    // Sync any pending actions when back online
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'background-sync',
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update available!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icons/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Smart Shopper SA', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATED') {
    // Handle cache updates
    console.log('[SW] Cache updated:', event.data);
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

// Unhandled promise rejection
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// Cache management utilities
async function clearOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name !== STATIC_CACHE && 
    name !== DYNAMIC_CACHE && 
    name !== API_CACHE
  );
  
  return Promise.all(
    oldCaches.map(name => {
      console.log('[SW] Deleting old cache:', name);
      return caches.delete(name);
    })
  );
}

// Cache size management
async function manageCacheSize() {
  const cacheNames = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    // Keep only the most recent 50 items for dynamic and API caches
    if (cacheName === DYNAMIC_CACHE || cacheName === API_CACHE) {
      if (keys.length > 50) {
        const keysToDelete = keys.slice(0, keys.length - 50);
        await Promise.all(keysToDelete.map(key => cache.delete(key)));
        console.log('[SW] Cleaned up cache:', cacheName);
      }
    }
  }
}

// Periodic cache cleanup
setInterval(() => {
  manageCacheSize();
}, 24 * 60 * 60 * 1000); // Run every 24 hours 