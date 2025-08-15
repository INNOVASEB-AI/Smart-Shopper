/**
 * API routes for product search functionality
 */

const express = require('express');
const router = express.Router();
const { 
  scrapeCheckers, 
  scrapeShoprite, 
  scrapePicknPay, 
  scrapeMakro, 
  scrapeWoolworths,
  scrapePriceCheck,
  // Import new database search functions
  searchProducts,
  getProductDetails,
  getDatabaseStats
} = require('../../scrapers');

// Import Scrapy integration
const {
  scrapeCheckersScrapy,
  scrapeShopriteScrappy,
  scrapePicknPayScrapy
} = require('../../scrapy_scrapers');

const { logger } = require('../../logger');
// Optional Firestore search
let firestoreSearchEnabled = process.env.USE_FIREBASE === 'true';
let firestore;
try {
  firestore = require('../../services/firestore');
} catch (_) {
  firestore = null;
}

// Environment configuration
const useDatabase = process.env.USE_DATABASE === 'true';
const databasePath = process.env.DATABASE_PATH || './data/products.db';
const useScrapy = process.env.USE_SCRAPY === 'true';

/**
 * @route POST /api/search
 * @description Search for products across multiple retailers
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const { query, retailers = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    logger.info(`Searching for "${query}" across retailers: ${retailers.length ? retailers.join(', ') : 'all'}`);
    
    // Prefer Firestore if enabled
    if (firestoreSearchEnabled && firestore && typeof firestore.searchPrices === 'function') {
      const products = await firestore.searchPrices({ query, retailer: retailers[0] });
      return res.json({ query, results: products });
    }

    // Use database search if enabled
    if (useDatabase) {
      const results = await searchProducts({
        query,
        retailer: retailers.length ? retailers[0] : undefined,
        dbPath: databasePath
      });
      
      return res.json(results);
    }
    
    // Otherwise, scrape retailers in real-time with timeouts so slow scrapers don't block the response
    const withTimeout = (promise, ms, retailerName) => {
      return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve({ retailer: retailerName, results: [], error: true, message: 'Timed out' }), ms))
      ]);
    };
    const SCRAPER_TIMEOUT_MS = parseInt(process.env.SCRAPER_TIMEOUT_MS || '15000', 10);

    const tasks = [];
    
    if (!retailers.length || retailers.includes('checkers')) {
      tasks.push(withTimeout(
        (useScrapy 
          ? scrapeCheckersScrapy(query).then(data => ({ retailer: 'Checkers', ...data }))
          : scrapeCheckers(query).then(data => ({ retailer: 'Checkers', ...data }))),
        SCRAPER_TIMEOUT_MS,
        'Checkers'
      ));
    }
    
    if (!retailers.length || retailers.includes('shoprite')) {
      tasks.push(withTimeout(
        (useScrapy 
          ? scrapeShopriteScrappy(query).then(data => ({ retailer: 'Shoprite', ...data }))
          : scrapeShoprite(query).then(data => ({ retailer: 'Shoprite', ...data }))),
        SCRAPER_TIMEOUT_MS,
        'Shoprite'
      ));
    }
    
    if (!retailers.length || retailers.includes('picknpay')) {
      tasks.push(withTimeout(
        (useScrapy 
          ? scrapePicknPayScrapy(query).then(data => ({ retailer: 'Pick n Pay', ...data }))
          : scrapePicknPay(query).then(data => ({ retailer: 'Pick n Pay', ...data }))),
        SCRAPER_TIMEOUT_MS,
        'Pick n Pay'
      ));
    }
    
    if (!retailers.length || retailers.includes('makro')) {
      tasks.push(withTimeout(
        scrapeMakro(query).then(data => ({ retailer: 'Makro', ...data })),
        SCRAPER_TIMEOUT_MS,
        'Makro'
      ));
    }
    
    if (!retailers.length || retailers.includes('woolworths')) {
      tasks.push(withTimeout(
        scrapeWoolworths(query).then(data => ({ retailer: 'Woolworths', ...data })),
        SCRAPER_TIMEOUT_MS,
        'Woolworths'
      ));
    }
    
    if (!retailers.length || retailers.includes('pricecheck')) {
      tasks.push(withTimeout(
        scrapePriceCheck(query).then(data => ({ retailer: 'PriceCheck', ...data })),
        SCRAPER_TIMEOUT_MS,
        'PriceCheck'
      ));
    }
    
    // Execute all tasks and allow failures/timeouts without blocking others
    const settled = await Promise.allSettled(tasks);
    
    // Normalize results
    const results = settled
      .filter(s => s.status === 'fulfilled')
      .map(s => s.value)
      .map(result => ({
        name: result.retailer,
        results: result.results || [],
        error: result.error || false,
        message: result.message || ''
      }));

    const combinedResults = { query, retailers: results };
    
    return res.json(combinedResults);
    
  } catch (error) {
    logger.error(`Search API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

/**
 * @route GET /api/search
 * @description Search for products across multiple retailers (GET version for frontend compatibility)
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { query, retailers } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Convert retailers string to array if provided
    let retailersArray = [];
    if (retailers) {
      retailersArray = typeof retailers === 'string' ? retailers.split(',') : retailers;
    }
    
    logger.info(`GET search for "${query}" across retailers: ${retailersArray.length ? retailersArray.join(', ') : 'all'}`);

    // Prefer Firestore if enabled
    if (firestoreSearchEnabled && firestore && typeof firestore.searchPrices === 'function') {
      const products = await firestore.searchPrices({ query, retailer: retailersArray[0] });
      return res.json({ query, results: products });
    }

    // Use database search if enabled
    if (useDatabase) {
      const results = await searchProducts({
        query,
        retailer: retailersArray.length ? retailersArray[0] : undefined,
        dbPath: databasePath
      });
      
      return res.json(results);
    }
    
    // Otherwise, scrape retailers in real-time with timeouts
    const withTimeout = (promise, ms, retailerName) => {
      return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve({ retailer: retailerName, results: [], error: true, message: 'Timed out' }), ms))
      ]);
    };
    const SCRAPER_TIMEOUT_MS = parseInt(process.env.SCRAPER_TIMEOUT_MS || '15000', 10);

    const tasks = [];
    
    if (!retailersArray.length || retailersArray.includes('checkers')) {
      tasks.push(withTimeout(
        (useScrapy 
          ? scrapeCheckersScrapy(query).then(data => ({ retailer: 'Checkers', ...data }))
          : scrapeCheckers(query).then(data => ({ retailer: 'Checkers', ...data }))),
        SCRAPER_TIMEOUT_MS,
        'Checkers'
      ));
    }
    
    if (!retailersArray.length || retailersArray.includes('shoprite')) {
      tasks.push(withTimeout(
        (useScrapy 
          ? scrapeShopriteScrappy(query).then(data => ({ retailer: 'Shoprite', ...data }))
          : scrapeShoprite(query).then(data => ({ retailer: 'Shoprite', ...data }))),
        SCRAPER_TIMEOUT_MS,
        'Shoprite'
      ));
    }
    
    if (!retailersArray.length || retailersArray.includes('picknpay')) {
      tasks.push(withTimeout(
        (useScrapy 
          ? scrapePicknPayScrapy(query).then(data => ({ retailer: 'Pick n Pay', ...data }))
          : scrapePicknPay(query).then(data => ({ retailer: 'Pick n Pay', ...data }))),
        SCRAPER_TIMEOUT_MS,
        'Pick n Pay'
      ));
    }
    
    if (!retailersArray.length || retailersArray.includes('makro')) {
      tasks.push(withTimeout(
        scrapeMakro(query).then(data => ({ retailer: 'Makro', ...data })),
        SCRAPER_TIMEOUT_MS,
        'Makro'
      ));
    }
    
    if (!retailersArray.length || retailersArray.includes('woolworths')) {
      tasks.push(withTimeout(
        scrapeWoolworths(query).then(data => ({ retailer: 'Woolworths', ...data })),
        SCRAPER_TIMEOUT_MS,
        'Woolworths'
      ));
    }
    
    if (!retailersArray.length || retailersArray.includes('pricecheck')) {
      tasks.push(withTimeout(
        scrapePriceCheck(query).then(data => ({ retailer: 'PriceCheck', ...data })),
        SCRAPER_TIMEOUT_MS,
        'PriceCheck'
      ));
    }

    const settled = await Promise.allSettled(tasks);

    const products = settled
      .filter(s => s.status === 'fulfilled')
      .map(s => s.value)
      .flatMap(result => (result && Array.isArray(result.results)) ? result.results : [])
      .map(product => ({
        ...product,
        retailer: product.store || product.retailer
      }));
    
    return res.json({ query, results: products });
    
  } catch (error) {
    logger.error(`GET search API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

/**
 * @route GET /api/search/database
 * @description Search for products in the database
 * @access Public
 */
router.get('/database', async (req, res) => {
  try {
    const { 
      q: query, 
      retailer, 
      category, 
      brand, 
      minPrice, 
      maxPrice, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    // Check if database search is enabled
    if (!useDatabase) {
      return res.status(400).json({ 
        error: 'Database search is not enabled',
        message: 'Set USE_DATABASE=true in environment to enable database search'
      });
    }
    
    logger.info(`Database search for query: "${query || '*'}"`);
    
    // Build search options
    const searchOptions = {
      query,
      retailer,
      category,
      brand,
      minPrice,
      maxPrice,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      dbPath: databasePath
    };
    
    // Search the database
    const results = await searchProducts(searchOptions);
    
    // Return the results
    return res.json(results);
    
  } catch (error) {
    logger.error(`Database search API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

/**
 * @route GET /api/search/product/:id
 * @description Get details for a specific product from the database
 * @access Public
 */
router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if database search is enabled
    if (!useDatabase) {
      return res.status(400).json({ 
        error: 'Database search is not enabled',
        message: 'Set USE_DATABASE=true in environment to enable database search'
      });
    }
    
    logger.info(`Getting product details for ID: ${id}`);
    
    // Get product details
    const result = await getProductDetails(id, databasePath);
    
    // Check if product was found
    if (result.error) {
      return res.status(404).json(result);
    }
    
    // Return the product details
    return res.json(result);
    
  } catch (error) {
    logger.error(`Product details API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

/**
 * @route GET /api/search/stats
 * @description Get statistics about the product database
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    // Check if database search is enabled
    if (!useDatabase) {
      return res.status(400).json({ 
        error: 'Database search is not enabled',
        message: 'Set USE_DATABASE=true in environment to enable database search'
      });
    }
    
    logger.info('Getting database statistics');
    
    // Get database stats
    const result = await getDatabaseStats(databasePath);
    
    // Return the statistics
    return res.json(result);
    
  } catch (error) {
    logger.error(`Database stats API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

module.exports = router; 