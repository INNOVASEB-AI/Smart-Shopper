const { scrapeWithPuppeteer, waitForSelectorWithRetry } = require('./puppeteerScraperHelper');
const { logger } = require('../logger');

/**
 * Scrapes Woolworths website for products matching the search query
 * 
 * @param {string} query - Search term
 * @returns {Promise<Array>} - Array of product results
 */
async function scrapeWoolworths(query) {
  const searchUrl = `https://www.woolworths.co.za/cat?Ntt=${encodeURIComponent(query)}`;
  
  // Use the helper function to handle the common scraping logic
  const { results, error } = await scrapeWithPuppeteer('Woolworths', searchUrl, async (page, retailerLogger) => {
    // --- Wait for product items and Extract Data ---
    const productItemSelector = 'div.product-list__item'; // *** ASSUMED SELECTOR - Verify this ***
    
    try {
      await waitForSelectorWithRetry(page, productItemSelector, retailerLogger, {
        message: 'Waiting for Woolworths product items to load',
        timeout: 20000
      });
    } catch (waitError) {
      retailerLogger.warn(
        `Woolworths product selector "${productItemSelector}" not found within timeout for query "${query}"`
      );
      return [];
    }
    
    // --- Scrape products on the page ---
    const products = await page.evaluate((selector) => {
      const items = [];
      const itemElements = document.querySelectorAll(selector);
      
      // --- Add logging for the first item's HTML ---
      // if (itemElements.length > 0) {
      //   console.log('--- HTML of first WOOLIES itemElement ---');
      //   console.log(itemElements[0].outerHTML);
      //   console.log('----------------------------------------');
      // }
      // --- End logging ---
      
      // Iterate using the fetched itemElements to avoid querying again
      itemElements.forEach((_element) => {
        // --- Temporarily commented out due to rendering/selector issues ---
        // Code that will use _element is commented out and will be implemented
        // once selector issues are fixed
      });
      
      return items;
    }, productItemSelector);
    
    retailerLogger.info(`Found ${products.length} results from Woolworths`);
    return products;
  });
  
  // Return just the results array to maintain the same interface as before
  return error ? [] : results;
}

module.exports = scrapeWoolworths;
