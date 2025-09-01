// Only export database search functions - NO LIVE SCRAPING
const { 
  searchProducts,
  getProductDetails, 
  getDatabaseStats
} = require('./crawl4ai_scrapers');

module.exports = {
  // Database search functions only
  searchProducts,
  getProductDetails,
  getDatabaseStats,
  
  // Remove all live scraping functions
  // scrapeCheckers: REMOVED - use database only
  // scrapeShoprite: REMOVED - use database only  
  // scrapePicknPay: REMOVED - use database only
  // scrapeMakro: REMOVED - use database only
  // scrapeWoolworths: REMOVED - use database only
  // scrapePriceCheck: REMOVED - use database only
};
