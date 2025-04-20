const { scrapeWithCheerio } = require('./httpScraperHelper');
const config = require('../config');
const { createScraperLogger } = require('../logger');

// Create retailer-specific logger
const logger = createScraperLogger('Shoprite');

/**
 * Extract product information from a Shoprite product element
 * 
 * @param {Object} $ - Cheerio instance
 * @param {Object} element - The product element
 * @param {String} retailer - The retailer name
 * @returns {Object|null} - Product object or null if invalid
 */
function extractShopriteProduct($, element, retailer) {
  const productGaData = $(element).attr('data-product-ga');
  if (!productGaData) return null;
  
  try {
    const productJson = JSON.parse(productGaData);
    const name = productJson.name;
    const price = productJson.price;
    const productId = productJson.id;
    const imageUrl = productJson.product_image_url;

    if (name && price && productId) {
      return {
        id: productId,
        name: name,
        price: price.toString(),
        retailer: retailer,
        imageUrl: imageUrl || null,
      };
    }
  } catch (parseError) {
    // Error will be logged by the helper
    return null;
  }
  
  return null;
}

/**
 * Scrape Shoprite website for products
 * 
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Results object with data and error status
 */
async function scrapeShoprite(query) {
  const searchUrl = `https://www.shoprite.co.za/search?q=${encodeURIComponent(query)}`;
  
  return scrapeWithCheerio(
    'Shoprite',
    searchUrl,
    '.product-frame',
    extractShopriteProduct
  );
}

module.exports = scrapeShoprite;
