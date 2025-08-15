const scrapeCheckers = require('./scrapeCheckers');
const scrapeShoprite = require('./scrapeShoprite');
const scrapePicknPay = require('./scrapePicknPay');
const scrapeMakro = require('./scrapeMakro');
const scrapeWoolworths = require('./scrapeWoolworths');
const { scrapePriceCheckJS } = require('./crawl4ai_scrapers');

// Use the JS implementation instead of the Python one to avoid dependency issues
const scrapePriceCheck = scrapePriceCheckJS;

module.exports = {
  scrapeCheckers,
  scrapeShoprite,
  scrapePicknPay,
  scrapeMakro,
  scrapeWoolworths,
  scrapePriceCheck,
};
