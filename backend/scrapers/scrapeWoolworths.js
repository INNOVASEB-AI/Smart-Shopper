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
    const productItemSelector = 'div.product-list__item, li.product-grid__item, article';
    
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
      const elements = Array.from(document.querySelectorAll(selector));

      elements.forEach(el => {
        try {
          const anchor = el.querySelector('a');
          const urlRel = anchor ? anchor.getAttribute('href') : null;
          let url = null;
          if (urlRel) {
            if (urlRel.startsWith('/')) url = `https://www.woolworths.co.za${urlRel}`;
            else if (urlRel.startsWith('http')) url = urlRel;
          }

          const nameEl = el.querySelector('.product__name, [data-testid="product-name"], h3, h2');
          const name = nameEl ? nameEl.textContent.trim() : null;

          const priceEl = el.querySelector('.price, [data-testid="product-price"], .product__price');
          let price = null;
          if (priceEl) {
            const text = priceEl.textContent.replace(/,/g, '.');
            const match = text.match(/R\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
            if (match) price = parseFloat(match[1]).toFixed(2);
          }

          if (url && name && price) {
            items.push({ retailer: 'Woolworths', url, name, price });
          }
        } catch (e) {}
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
