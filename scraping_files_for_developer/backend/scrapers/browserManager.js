const puppeteer = require('puppeteer');
const { logger } = require('../logger');

/**
 * Browser Manager to maintain a singleton Puppeteer browser instance
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
    this.initPromise = null;
  }

  /**
   * Initialize the browser if it doesn't exist
   */
  async initializeBrowser() {
    if (this.browser) {
      return this.browser;
    }

    // If already initializing, return the existing promise
    if (this.isInitializing) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        logger.info('Initializing Puppeteer browser instance');
        this.browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        // Listen for disconnection events
        this.browser.on('disconnected', () => {
          logger.warn('Browser disconnected, will reinitialize on next request');
          this.browser = null;
          this.isInitializing = false;
        });

        logger.info('Browser initialized successfully');
        this.isInitializing = false;
        resolve(this.browser);
      } catch (error) {
        logger.error(`Failed to initialize browser: ${error.message}`);
        this.browser = null;
        this.isInitializing = false;
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * Get the browser instance, initializing if necessary
   */
  async getBrowser() {
    return this.initializeBrowser();
  }

  /**
   * Create a new page in the existing browser
   */
  async newPage() {
    const browser = await this.getBrowser();
    return browser.newPage();
  }

  /**
   * Gracefully shut down the browser
   */
  async closeBrowser() {
    if (this.browser) {
      logger.info('Closing browser instance');
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export a singleton instance
module.exports = new BrowserManager(); 