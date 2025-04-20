/**
 * Application configuration
 * Loads from environment variables with sensible defaults
 */
module.exports = {
  // Server config
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Browser headers
  userAgent: process.env.USER_AGENT || 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  
  // Timeout settings (in milliseconds)
  timeouts: {
    // Navigation timeout for puppeteer page.goto()
    navigation: parseInt(process.env.NAVIGATION_TIMEOUT || '30000', 10),
    // Selector wait timeout
    selector: parseInt(process.env.SELECTOR_TIMEOUT || '15000', 10),
    // HTTP request timeout
    httpRequest: parseInt(process.env.HTTP_REQUEST_TIMEOUT || '30000', 10),
    // Default retry count for failed operations
    retryCount: parseInt(process.env.RETRY_COUNT || '2', 10),
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
  },
}; 