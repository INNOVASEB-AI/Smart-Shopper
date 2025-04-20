const browserManager = require('./browserManager');
const BROWSER_HEADERS = require('./browserHeaders');
const config = require('../config');
const { logger } = require('../logger');

/**
 * Helper function for Puppeteer-based scraping with standardized error handling
 * 
 * @param {string} retailer - The retailer name
 * @param {string} searchUrl - The URL to navigate to
 * @param {function} scrapeFn - Function to execute the actual scraping
 * @returns {Promise<Object>} - Results object with data and error status
 */
async function scrapeWithPuppeteer(retailer, searchUrl, scrapeFn) {
  const retailerLogger = logger.child({ retailer });
  let page = null;
  
  try {
    retailerLogger.info(`Scraping ${retailer} at ${searchUrl}`);
    
    // Get a new page from the shared browser instance
    page = await browserManager.newPage();
    
    // Set user agent
    await page.setUserAgent(BROWSER_HEADERS['User-Agent']);
    
    // Set up console logging
    page.on('console', msg => retailerLogger.debug(`PAGE LOG: ${msg.text()}`));
    
    // Navigate to the URL with configurable timeout
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2', 
      timeout: config.timeouts.navigation
    });
    
    // Execute the scraping function
    const results = await scrapeFn(page, retailerLogger);
    
    retailerLogger.info(`Found ${results.length} results from ${retailer}`);
    return { results, error: false };
  } catch (error) {
    retailerLogger.error(`Error scraping: ${error.message}`);
    
    // Take screenshot on error if page is available
    if (page) {
      try {
        const screenshotPath = `${retailer.toLowerCase()}_error_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        retailerLogger.info(`Error screenshot saved to ${screenshotPath}`);
      } catch {
        // Ignore screenshot errors
      }
    }
    
    return { results: [], error: true, message: error.message };
  } finally {
    // Close the page when done (but keep the browser open)
    if (page) {
      try {
        await page.close();
      } catch (error) {
        retailerLogger.warn(`Error closing page: ${error.message}`);
      }
    }
  }
}

/**
 * Helper function to wait for a selector with retry logic
 * 
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector to wait for
 * @param {Object} logger - Logger instance
 * @param {Object} options - Options for waiting
 * @returns {Promise<boolean>} - True if selector was found, false otherwise
 */
async function waitForSelectorWithRetry(page, selector, logger, options = {}) {
  const {
    timeout = config.timeouts.selector,
    retries = config.timeouts.retryCount,
    visible = true,
    message = `Waiting for selector "${selector}"`,
  } = options;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      logger.debug(`${message} (attempt ${attempt}/${retries + 1})`);
      await page.waitForSelector(selector, { 
        timeout, 
        visible
      });
      logger.debug(`${message} - found!`);
      return true;
    } catch (error) {
      if (attempt <= retries) {
        logger.warn(`${message} - failed, retrying...`);
        // Optional: Add a small delay between retries
        await new Promise(r => setTimeout(r, 1000));
      } else {
        logger.error(`${message} - failed after ${retries + 1} attempts`);
        throw error;
      }
    }
  }
  
  return false;
}

module.exports = {
  scrapeWithPuppeteer,
  waitForSelectorWithRetry,
}; 