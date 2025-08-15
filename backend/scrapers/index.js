const scrapeShoprite = require('./scrapeShoprite');
const scrapePicknPay = require('./scrapePicknPay');
const scrapeMakro = require('./scrapeMakro');
const scrapeWoolworths = require('./scrapeWoolworths');
const { scrapePriceCheckJS } = require('./crawl4ai_scrapers');
const { scrapeCheckersScrapy } = require('../scrapy_scrapers');

// Use the JS implementation instead of the Python one to avoid dependency issues
const scrapePriceCheck = scrapePriceCheckJS;

module.exports = {
  scrapeCheckers: scrapeCheckersScrapy,
  scrapeShoprite,
  scrapePicknPay,
  scrapeMakro,
  scrapeWoolworths,
  scrapePriceCheck,
};
