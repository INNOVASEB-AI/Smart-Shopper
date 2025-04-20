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
const { logger } = require('../../logger');

// Environment configuration
const useDatabase = process.env.USE_DATABASE === 'true';
const databasePath = process.env.DATABASE_PATH || './data/products.db';

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
    
    // Check if we should use the database for searching
    if (useDatabase) {
      logger.info(`Using database search for query: "${query}"`);
      
      try {
        // Build search options
        const searchOptions = {
          query,
          dbPath: databasePath,
          limit: 100
        };
        
        // Add retailer filter if specified
        if (retailers.length === 1) {
          searchOptions.retailer = retailers[0];
        }
        
        // Search the database
        const results = await searchProducts(searchOptions);
        
        // If results were found in the database, return them
        if (results && results.totalProducts > 0) {
          logger.info(`Found ${results.totalProducts} products in database for "${query}"`);
          return res.json(results);
        }
        
        // If no results were found in the database, fall back to real-time scraping
        logger.info(`No results found in database for "${query}", falling back to real-time scraping`);
      } catch (dbError) {
        logger.error(`Database search error for "${query}": ${dbError.message}`);
        // Continue with real-time scraping
      }
    }
    
    // Determine which retailers to search
    const searchAll = retailers.length === 0;
    const searchCheckers = searchAll || retailers.includes('checkers');
    const searchShoprite = searchAll || retailers.includes('shoprite');
    const searchPicknPay = searchAll || retailers.includes('picknpay');
    const searchMakro = searchAll || retailers.includes('makro');
    const searchWoolworths = searchAll || retailers.includes('woolworths');
    const searchPriceCheck = searchAll || retailers.includes('pricecheck');
    
    // Initialize results object
    const results = {};
    
    // Run all selected scrapers in parallel
    const promises = [];
    
    if (searchCheckers) {
      promises.push(
        scrapeCheckers(query)
          .then(data => { results.checkers = data; })
          .catch(error => {
            logger.error(`Error scraping Checkers: ${error.message}`);
            results.checkers = [];
          })
      );
    }
    
    if (searchShoprite) {
      promises.push(
        scrapeShoprite(query)
          .then(data => { results.shoprite = data; })
          .catch(error => {
            logger.error(`Error scraping Shoprite: ${error.message}`);
            results.shoprite = [];
          })
      );
    }
    
    if (searchPicknPay) {
      promises.push(
        scrapePicknPay(query)
          .then(data => { results.picknpay = data; })
          .catch(error => {
            logger.error(`Error scraping Pick n Pay: ${error.message}`);
            results.picknpay = [];
          })
      );
    }
    
    if (searchMakro) {
      promises.push(
        scrapeMakro(query)
          .then(data => { results.makro = data; })
          .catch(error => {
            logger.error(`Error scraping Makro: ${error.message}`);
            results.makro = [];
          })
      );
    }
    
    if (searchWoolworths) {
      promises.push(
        scrapeWoolworths(query)
          .then(data => { results.woolworths = data; })
          .catch(error => {
            logger.error(`Error scraping Woolworths: ${error.message}`);
            results.woolworths = [];
          })
      );
    }
    
    if (searchPriceCheck) {
      promises.push(
        scrapePriceCheck(query)
          .then(data => { results.pricecheck = data; })
          .catch(error => {
            logger.error(`Error scraping PriceCheck: ${error.message}`);
            results.pricecheck = [];
          })
      );
    }
    
    // Wait for all scrapers to complete
    await Promise.all(promises);
    
    // Count total products
    let totalProducts = 0;
    Object.values(results).forEach(retailerResults => {
      totalProducts += retailerResults.length;
    });
    
    logger.info(`Search complete, found ${totalProducts} products across all retailers`);
    
    // Return the results
    return res.json({
      query,
      results,
      totalProducts,
      timestamp: new Date(),
    });
    
  } catch (error) {
    logger.error(`Search API error: ${error.message}`);
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