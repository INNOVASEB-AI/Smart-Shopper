const { scrapeWithPuppeteer, waitForSelectorWithRetry } = require('./puppeteerScraperHelper');
const { logger } = require('../logger');

/**
 * Scrapes Pick n Pay website for products matching the search query
 * 
 * @param {string} query - Search term
 * @returns {Promise<Array>} - Array of product results
 */
async function scrapePicknPay(query) {
  const searchUrl = `https://www.pnp.co.za/search/${encodeURIComponent(query)}`;
  
  // Use the helper function to handle the common scraping logic
  const { results, error } = await scrapeWithPuppeteer('Pick n Pay', searchUrl, async (page, retailerLogger) => {
    const productItemSelector = 'div.product-grid-item';
    
    // Wait for product items to appear with retry logic
    await waitForSelectorWithRetry(page, productItemSelector, retailerLogger, {
      message: 'Waiting for Pick n Pay product grid items to load'
    });
    
    // Extract product information
    const products = await page.evaluate((selector) => {
      const items = [];
      const itemElements = document.querySelectorAll(selector);
      
      // Using console.log here because this runs in the browser context
      console.log(`--- Found ${itemElements.length} PnP elements matching ${selector} ---`);
      
      // Here we would parse the product data from the page
      // This part is left empty in the original code, you might want to implement
      // the actual extraction logic here
      
      return items;
    }, productItemSelector);
    
    return products;
  });
  
  // Return just the results array to maintain the same interface as before
  return error ? [] : results;
}

module.exports = scrapePicknPay;
