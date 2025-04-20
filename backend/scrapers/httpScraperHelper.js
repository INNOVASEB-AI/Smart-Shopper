const axios = require('axios');
const cheerio = require('cheerio');
const BROWSER_HEADERS = require('./browserHeaders');
const { logger } = require('../logger');

/**
 * Generic HTTP scraper helper that uses axios and cheerio
 * 
 * @param {string} retailer - The retailer name
 * @param {string} searchUrl - The URL to scrape
 * @param {string} itemSelector - The CSS selector for product items
 * @param {Function} extractFn - Function to extract product details from a cheerio element
 * @returns {Promise<Array>} - Array of product objects
 */
async function scrapeWithCheerio(retailer, searchUrl, itemSelector, extractFn) {
  const results = [];
  const retailerLogger = logger.child({ retailer });
  
  try {
    retailerLogger.info(`Scraping ${retailer} at ${searchUrl}`);
    const { data } = await axios.get(searchUrl, { headers: BROWSER_HEADERS });
    const $ = cheerio.load(data);
    
    $(itemSelector).each((index, element) => {
      try {
        const product = extractFn($, element, retailer);
        if (product) {
          results.push(product);
        }
      } catch (parseError) {
        retailerLogger.error(`Error parsing item: ${parseError.message}`);
      }
    });
    
    retailerLogger.info(`Found ${results.length} results from ${retailer}`);
    return { results, error: false };
  } catch (error) {
    retailerLogger.error(`Error scraping: ${error.message}`);
    if (error.response) {
      retailerLogger.error(`Status: ${error.response.status}`);
    }
    return { results: [], error: true, message: error.message };
  }
}

module.exports = { scrapeWithCheerio }; 