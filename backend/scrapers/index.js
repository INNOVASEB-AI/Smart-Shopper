const scrapeCheckers = require('./scrapeCheckers');
const scrapeShoprite = require('./scrapeShoprite');
const scrapePicknPay = require('./scrapePicknPay');
const scrapeMakro = require('./scrapeMakro');
const scrapeWoolworths = require('./scrapeWoolworths');
const { scrapePriceCheck } = require('./crawl4ai_scrapers');

module.exports = {
  scrapeCheckers,
  scrapeShoprite,
  scrapePicknPay,
  scrapeMakro,
  scrapeWoolworths,
  scrapePriceCheck,
};
