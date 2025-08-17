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
    const productItemSelector = 'a.product-grid-item, div.product-grid-item';
    
    // Wait for product items to appear with retry logic
    await waitForSelectorWithRetry(page, productItemSelector, retailerLogger, {
      message: 'Waiting for Pick n Pay product grid items to load'
    });
    
    // Extract product information
    const products = await page.evaluate((selector) => {
      const items = [];
      const elements = Array.from(document.querySelectorAll(selector));

      elements.forEach((el) => {
        try {
          // Ensure anchor
          const anchor = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
          const urlRel = anchor ? anchor.getAttribute('href') : null;
          let url = null;
          if (urlRel) {
            if (urlRel.startsWith('/')) url = `https://www.pnp.co.za${urlRel}`;
            else if (urlRel.startsWith('http')) url = urlRel;
          }

          const nameEl = el.querySelector('[data-testid="product-tile-name"], .product-name, h3');
          const name = nameEl ? nameEl.textContent.trim() : null;

          const priceEl = el.querySelector('[data-testid="product-tile-price"], .price, .amount');
          let price = null;
          if (priceEl) {
            const text = priceEl.textContent.replace(/,/g, '.');
            const match = text.match(/R\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
            if (match) price = parseFloat(match[1]).toFixed(2);
          }

          if (url && name && price) {
            items.push({ retailer: 'Pick n Pay', url, name, price });
          }
        } catch (e) {}
      });
      return items;
    }, productItemSelector);
    
    return products;
  });
  
  // Return just the results array to maintain the same interface as before
  return error ? [] : results;
}

module.exports = scrapePicknPay;
