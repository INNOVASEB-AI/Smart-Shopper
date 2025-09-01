/**
 * API routes for product search functionality
 */

const express = require('express');
const router = express.Router();
const config = require('../../config');
const { 
  // Remove live scraping imports - only use database functions
  searchProducts,
  getProductDetails,
  getDatabaseStats
} = require('../../scrapers');

const { logger } = require('../../logger');

// Optional Firestore search
let firestoreSearchEnabled = config.dataSources.useFirebase;
let firestore;
try {
  firestore = require('../../services/firestore');
} catch (_) {
  firestore = null;
  logger.warn('Firestore service not available');
}

// Environment configuration from config
const useDatabase = config.dataSources.useDatabase;
const databasePath = config.dataSources.databasePath;

// Optional: prefer local crawler JSON dataset
const fs = require('fs');
const path = require('path');
const useJson = config.dataSources.useJson;
let cachedCrawlerData = null;

function loadCrawlerJsonData() {
  if (cachedCrawlerData) return cachedCrawlerData;
  try {
    const dir = path.resolve(__dirname, '..', '..');
    const files = fs.readdirSync(dir).filter(f => f.startsWith('crawler-data-') && f.endsWith('.json'));
    const all = [];
    for (const f of files) {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (Array.isArray(arr)) all.push(...arr);
      } catch (e) {
        logger.warn(`Failed to read crawler dataset ${f}: ${e.message}`);
      }
    }
    // Normalize shape
    cachedCrawlerData = all.map(item => ({
      id: item.id || `${item.store || item.retailer || 'Unknown'}-${(item.name || '').slice(0,40)}`,
      name: item.name || '',
      price: item.price,
      retailer: item.store || item.retailer || 'Unknown',
      store: item.store || item.retailer || 'Unknown',
      url: item.url || ''
    }));
    logger.info(`Loaded crawler JSON dataset: ${cachedCrawlerData.length} products`);
  } catch (e) {
    logger.warn(`No crawler JSON dataset loaded: ${e.message}`);
    cachedCrawlerData = [];
  }
  return cachedCrawlerData;
}

function searchCrawlerJson({ query, retailer }) {
  const data = loadCrawlerJsonData();
  const q = (query || '').toLowerCase();
  return data.filter(p => (
    (!retailer || (p.retailer && p.retailer.toLowerCase() === retailer.toLowerCase())) &&
    (!q || (p.name && p.name.toLowerCase().includes(q)))
  ));
}

/**
 * @route POST /api/search
 * @description Search for products across multiple retailers (DATABASE ONLY)
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
      try {
      const products = await firestore.searchPrices({ query, retailer: retailers[0] });
        logger.info(`Found ${products.length} products from Firestore`);
      return res.json({ query, results: products });
      } catch (error) {
        logger.error(`Firestore search failed: ${error.message}`);
        // Continue to fallback options
      }
    }

    // Use database search if enabled
    if (useDatabase) {
      try {
      const results = await searchProducts({
        query,
        retailer: retailers.length ? retailers[0] : undefined,
        dbPath: databasePath
      });
      
        logger.info(`Found ${results.totalProducts || 0} products from database`);
      return res.json(results);
      } catch (error) {
        logger.error(`Database search failed: ${error.message}`);
        // Continue to fallback options
      }
    }

    // Use local crawler JSON if enabled
    if (useJson) {
      try {
      const products = searchCrawlerJson({ query });
        logger.info(`Found ${products.length} products from JSON cache`);
      return res.json({ query, results: products });
      } catch (error) {
        logger.error(`JSON search failed: ${error.message}`);
        // Continue to fallback options
      }
    }
    
    // If we get here, no data sources worked
    logger.error(`No data sources available for search. Configuration:`, {
      firestore: firestoreSearchEnabled && firestore,
      database: useDatabase,
      json: useJson,
      databasePath
    });
    
    return res.status(503).json({ 
      error: 'No data sources available', 
      message: 'Search is currently unavailable. Please check data source configuration.',
      available_sources: {
        firestore: firestoreSearchEnabled && firestore,
        database: useDatabase,
        json: useJson
      },
      configuration: {
        databasePath,
        useFirebase: config.dataSources.useFirebase,
        useDatabase: config.dataSources.useDatabase,
        useJson: config.dataSources.useJson
      }
    });
    
  } catch (error) {
    logger.error(`Search API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

/**
 * @route GET /api/search
 * @description Search for products across multiple retailers (DATABASE ONLY)
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
      try {
      const products = await firestore.searchPrices({ query, retailer: retailersArray[0] });
        logger.info(`Found ${products.length} products from Firestore`);
      return res.json({ query, results: products });
      } catch (error) {
        logger.error(`Firestore search failed: ${error.message}`);
        // Continue to fallback options
      }
    }

    // Use database search if enabled
    if (useDatabase) {
      try {
      const results = await searchProducts({
        query,
        retailer: retailersArray.length ? retailersArray[0] : undefined,
        dbPath: databasePath
      });
      
        logger.info(`Found ${results.totalProducts || 0} products from database`);
      return res.json(results);
      } catch (error) {
        logger.error(`Database search failed: ${error.message}`);
        // Continue to fallback options
      }
    }
    
    // Use local crawler JSON if enabled
    if (useJson) {
      try {
      const products = searchCrawlerJson({ query, retailer: retailersArray[0] });
        logger.info(`Found ${products.length} products from JSON cache`);
      return res.json({ query, results: products });
      } catch (error) {
        logger.error(`JSON search failed: ${error.message}`);
        // Continue to fallback options
      }
    }
    
    // If we get here, no data sources worked
    logger.error(`No data sources available for search. Configuration:`, {
      firestore: firestoreSearchEnabled && firestore,
      database: useDatabase,
      json: useJson,
      databasePath
    });
    
    return res.status(503).json({ 
      error: 'No data sources available', 
      message: 'Search is currently unavailable. Please check data source configuration.',
      available_sources: {
        firestore: firestoreSearchEnabled && firestore,
        database: useDatabase,
        json: useJson
      },
      configuration: {
        databasePath,
        useFirebase: config.dataSources.useFirebase,
        useDatabase: config.dataSources.useDatabase,
        useJson: config.dataSources.useJson
      }
    });
    
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

/**
 * @route GET /api/search/status
 * @description Get the status of all data sources
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      dataSources: {
        firestore: {
          enabled: firestoreSearchEnabled,
          available: !!(firestore && typeof firestore.searchPrices === 'function'),
          path: 'Firestore'
        },
        database: {
          enabled: useDatabase,
          available: false,
          path: databasePath
        },
        json: {
          enabled: useJson,
          available: false,
          path: 'Local JSON files'
        }
      },
      configuration: {
        useFirebase: config.dataSources.useFirebase,
        useDatabase: config.dataSources.useDatabase,
        useJson: config.dataSources.useJson,
        databasePath: config.dataSources.databasePath
      }
    };

    // Check database availability
    if (useDatabase) {
      try {
        const fs = require('fs');
        status.dataSources.database.available = fs.existsSync(databasePath);
        if (status.dataSources.database.available) {
          const stats = await getDatabaseStats(databasePath);
          status.dataSources.database.stats = stats;
        }
      } catch (error) {
        logger.error(`Error checking database status: ${error.message}`);
      }
    }

    // Check JSON availability
    if (useJson) {
      try {
        const data = loadCrawlerJsonData();
        status.dataSources.json.available = data.length > 0;
        status.dataSources.json.count = data.length;
      } catch (error) {
        logger.error(`Error checking JSON status: ${error.message}`);
      }
    }

    return res.json(status);
    
  } catch (error) {
    logger.error(`Status API error: ${error.message}`);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

module.exports = router; 