/**
 * Centralized configuration for Smart Shopper SA
 * All settings can be configured via environment variables
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  // =============================================================================
  // FIREBASE CONFIGURATION
  // =============================================================================
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'smart-shopper-46f4c',
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'smart-shopper-46f4c.firebaseapp.com',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'smart-shopper-46f4c.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '227443313787',
    appId: process.env.FIREBASE_APP_ID || '1:227443313787:web:f7d0fb52c88e14254966de',
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null
  },

  // =============================================================================
  // FIRECRAWL CONFIGURATION
  // =============================================================================
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY,
    rateLimit: parseInt(process.env.FIRECRAWL_RATE_LIMIT) || 60
  },

  // =============================================================================
  // DATA SOURCE CONFIGURATION
  // =============================================================================
  dataSources: {
    useFirebase: process.env.USE_FIREBASE === 'true',
    useDatabase: process.env.USE_DATABASE === 'true',
    useJson: process.env.USE_JSON === 'true',
    useFirecrawl: process.env.USE_FIRECRAWL === 'true',
    
    // Database configuration
    databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, 'scrapers/crawl4ai_scrapers/data/products.db'),
    
    // JSON fallback
    jsonDataPath: process.env.JSON_DATA_PATH || path.resolve(__dirname, 'data/products.json')
  },

  // =============================================================================
  // APPLICATION CONFIGURATION
  // =============================================================================
  app: {
    port: parseInt(process.env.PORT) || 3001,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
      'http://localhost:3000',
      'https://smart-shopper-46f4c.web.app'
    ]
  },

  // =============================================================================
  // CRAWLER CONFIGURATION
  // =============================================================================
  crawler: {
    maxProductsPerRetailer: parseInt(process.env.MAX_PRODUCTS_PER_RETAILER) || 200,
    crawlDelay: parseInt(process.env.CRAWL_DELAY) || 1,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3
  },

  // =============================================================================
  // PRICE HISTORY CONFIGURATION
  // =============================================================================
  priceHistory: {
    enabled: process.env.ENABLE_PRICE_HISTORY === 'true',
    maxEntries: parseInt(process.env.MAX_PRICE_HISTORY_ENTRIES) || 30,
    changeThreshold: parseFloat(process.env.PRICE_CHANGE_THRESHOLD) || 5.0
  },

  // =============================================================================
  // SECURITY CONFIGURATION
  // =============================================================================
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production',
    apiRateLimit: parseInt(process.env.API_RATE_LIMIT) || 100
  },

  // =============================================================================
  // MONITORING CONFIGURATION
  // =============================================================================
  monitoring: {
    detailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true',
    reportInterval: parseInt(process.env.REPORT_INTERVAL) || 24,
    
    // Email notifications
    email: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      notificationEmail: process.env.NOTIFICATION_EMAIL
    }
  },

  // =============================================================================
  // RETAILER CONFIGURATION
  // =============================================================================
  retailers: {
    checkers: {
      name: 'Checkers',
      url: 'https://www.checkers.co.za',
      enabled: true
    },
    shoprite: {
      name: 'Shoprite',
      url: 'https://www.shoprite.co.za',
      enabled: true
    },
    picknpay: {
      name: 'Pick n Pay',
      url: 'https://www.pnp.co.za',
      enabled: true
    },
    makro: {
      name: 'Makro',
      url: 'https://www.makro.co.za',
      enabled: true
    },
    woolworths: {
      name: 'Woolworths',
      url: 'https://www.woolworths.co.za',
      enabled: true
    },
    pricecheck: {
      name: 'PriceCheck',
      url: 'https://www.pricecheck.co.za',
      enabled: true
    }
  }
};

// =============================================================================
// VALIDATION
// =============================================================================

// Validate required configuration
function validateConfig() {
  const errors = [];

  // Check Firebase configuration
  if (config.dataSources.useFirebase && !config.firebase.serviceAccount) {
    errors.push('FIREBASE_SERVICE_ACCOUNT is required when USE_FIREBASE=true');
  }

  // Check Firecrawl configuration
  if (config.dataSources.useFirecrawl && !config.firecrawl.apiKey) {
    errors.push('FIRECRAWL_API_KEY is required when USE_FIRECRAWL=true');
  }

  // Check database path
  if (config.dataSources.useDatabase && !config.dataSources.databasePath) {
    errors.push('DATABASE_PATH is required when USE_DATABASE=true');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\nPlease check your environment variables or .env file.');
    process.exit(1);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Get enabled retailers
function getEnabledRetailers() {
  return Object.entries(config.retailers)
    .filter(([key, retailer]) => retailer.enabled)
    .map(([key, retailer]) => ({ key, ...retailer }));
}

// Get data source status
function getDataSourceStatus() {
  return {
    firebase: {
      enabled: config.dataSources.useFirebase,
      configured: !!config.firebase.serviceAccount
    },
    database: {
      enabled: config.dataSources.useDatabase,
      path: config.dataSources.databasePath
    },
    json: {
      enabled: config.dataSources.useJson,
      path: config.dataSources.jsonDataPath
    },
    firecrawl: {
      enabled: config.dataSources.useFirecrawl,
      configured: !!config.firecrawl.apiKey
    }
  };
}

// Export configuration
module.exports = {
  ...config,
  validateConfig,
  getEnabledRetailers,
  getDataSourceStatus
}; 