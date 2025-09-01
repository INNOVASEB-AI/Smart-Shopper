const express = require('express');
const cors = require('cors');
const app = express();
const config = require('./config');
const browserManager = require('./scrapers/browserManager');

// Import database functions only - NO LIVE SCRAPING
const {
  searchProducts,
  getProductDetails,
  getDatabaseStats
} = require('./scrapers');

// Import logger
const { logger } = require('./logger');

// Import route handlers
const searchRouter = require('./routes/api/search');
const crawlerRouter = require('./routes/api/crawler');

app.use(cors());
app.use(express.json());

// Use the search router for /api/search endpoints
app.use('/api/search', searchRouter);

// Use the crawler router for /api/crawler endpoints
app.use('/api/crawler', crawlerRouter);

// --- Basket Comparison Endpoint ---
app.post('/api/compare-basket', async (req, res) => {
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Request body must contain a non-empty array of "items".' });
  }
  // Basic sanitization/validation
  const uniqueItems = [...new Set(items.map(item => String(item).trim()).filter(Boolean))];
  if (uniqueItems.length === 0) {
    return res.status(400).json({ error: 'No valid items provided after trimming.' });
  }

  logger.info(`Starting basket comparison for items: [${uniqueItems.join(', ')}]`);

  // Simulated price data for demonstration
  const mockPrices = {
    'Checkers': {
      'bread': 15.99, 'bagels': 12.50, 'cookies': 8.99, 'almond milk': 25.99,
      'chicken': 45.99, 'milk': 18.99, 'butter': 22.50, 'cheese': 35.99,
      'eggs': 28.99, 'yogurt': 15.99, 'muffins': 12.99, 'croissants': 8.50,
      'cereal': 45.99, 'half and half': 18.99, 'steak': 89.99, 'tomatoes': 12.99,
      'onions': 8.99, 'potatoes': 15.99, 'carrots': 9.99, 'lettuce': 7.99,
      'bananas': 11.99, 'apples': 14.99, 'oranges': 13.99, 'grapes': 18.99,
      'rice': 22.99, 'pasta': 16.99, 'sauce': 12.99, 'oil': 19.99,
      'sugar': 14.99, 'flour': 18.99, 'salt': 6.99, 'pepper': 8.99
    },
    'Pick n Pay': {
      'bread': 16.99, 'bagels': 13.50, 'cookies': 9.99, 'almond milk': 27.99,
      'chicken': 47.99, 'milk': 19.99, 'butter': 23.50, 'cheese': 37.99,
      'eggs': 29.99, 'yogurt': 16.99, 'muffins': 13.99, 'croissants': 9.50,
      'cereal': 47.99, 'half and half': 19.99, 'steak': 92.99, 'tomatoes': 13.99,
      'onions': 9.99, 'potatoes': 16.99, 'carrots': 10.99, 'lettuce': 8.99,
      'bananas': 12.99, 'apples': 15.99, 'oranges': 14.99, 'grapes': 19.99,
      'rice': 24.99, 'pasta': 17.99, 'sauce': 13.99, 'oil': 20.99,
      'sugar': 15.99, 'flour': 19.99, 'salt': 7.99, 'pepper': 9.99
    },
    'Woolworths': {
      'bread': 18.99, 'bagels': 15.50, 'cookies': 11.99, 'almond milk': 29.99,
      'chicken': 52.99, 'milk': 22.99, 'butter': 26.50, 'cheese': 42.99,
      'eggs': 32.99, 'yogurt': 18.99, 'muffins': 15.99, 'croissants': 11.50,
      'cereal': 52.99, 'half and half': 22.99, 'steak': 99.99, 'tomatoes': 15.99,
      'onions': 11.99, 'potatoes': 18.99, 'carrots': 12.99, 'lettuce': 10.99,
      'bananas': 14.99, 'apples': 17.99, 'oranges': 16.99, 'grapes': 21.99,
      'rice': 26.99, 'pasta': 19.99, 'sauce': 15.99, 'oil': 22.99,
      'sugar': 17.99, 'flour': 21.99, 'salt': 8.99, 'pepper': 10.99
    },
    'Shoprite': {
      'bread': 14.99, 'bagels': 11.50, 'cookies': 7.99, 'almond milk': 23.99,
      'chicken': 42.99, 'milk': 17.99, 'butter': 20.50, 'cheese': 32.99,
      'eggs': 26.99, 'yogurt': 14.99, 'muffins': 11.99, 'croissants': 7.50,
      'cereal': 42.99, 'half and half': 17.99, 'steak': 79.99, 'tomatoes': 11.99,
      'onions': 7.99, 'potatoes': 14.99, 'carrots': 8.99, 'lettuce': 6.99,
      'bananas': 10.99, 'apples': 13.99, 'oranges': 12.99, 'grapes': 16.99,
      'rice': 20.99, 'pasta': 14.99, 'sauce': 10.99, 'oil': 17.99,
      'sugar': 12.99, 'flour': 16.99, 'salt': 5.99, 'pepper': 7.99
    },
    'Makro': {
      'bread': 13.99, 'bagels': 10.50, 'cookies': 6.99, 'almond milk': 21.99,
      'chicken': 39.99, 'milk': 16.99, 'butter': 19.50, 'cheese': 29.99,
      'eggs': 24.99, 'yogurt': 13.99, 'muffins': 10.99, 'croissants': 6.50,
      'cereal': 39.99, 'half and half': 16.99, 'steak': 74.99, 'tomatoes': 10.99,
      'onions': 6.99, 'potatoes': 13.99, 'carrots': 7.99, 'lettuce': 5.99,
      'bananas': 9.99, 'apples': 12.99, 'oranges': 11.99, 'grapes': 15.99,
      'rice': 18.99, 'pasta': 12.99, 'sauce': 8.99, 'oil': 15.99,
      'sugar': 11.99, 'flour': 14.99, 'salt': 4.99, 'pepper': 6.99
    }
  };

  // Initialize results structure
  const comparisonResults = {};
  const retailers = Object.keys(mockPrices);
  
  retailers.forEach(retailer => {
    comparisonResults[retailer] = {
      totalPrice: 0,
      foundItems: [],
      missingItems: [],
      potentialErrors: [],
      itemCount: 0
    };
  });

  // Calculate totals for each retailer
  uniqueItems.forEach(item => {
    const lowerItemName = item.toLowerCase();
    
    retailers.forEach(retailer => {
      const retailerResult = comparisonResults[retailer];
      let found = false;
      
      // Try to find a matching item in the store's price list
      for (const [priceItem, price] of Object.entries(mockPrices[retailer])) {
        if (priceItem.toLowerCase().includes(lowerItemName) || 
            lowerItemName.includes(priceItem.toLowerCase())) {
          retailerResult.totalPrice += price;
          retailerResult.foundItems.push({ 
            name: item, 
            price: price, 
            details: { name: priceItem, price: price, retailer: retailer }
          });
          retailerResult.itemCount++;
          found = true;
          break;
        }
      }
      
      // If no match found, add to missing items
      if (!found) {
        retailerResult.missingItems.push(item);
        // Add a default price for demonstration
        const defaultPrice = 20 + Math.random() * 10; // Random price between 20-30
        retailerResult.totalPrice += defaultPrice;
        retailerResult.foundItems.push({ 
          name: item, 
          price: defaultPrice, 
          details: { name: item, price: defaultPrice, retailer: retailer }
        });
        retailerResult.itemCount++;
      }
    });
  });

  // Format prices to 2 decimal places
  Object.values(comparisonResults).forEach(res => {
    res.totalPrice = parseFloat(res.totalPrice.toFixed(2));
  });

  logger.info(`Basket comparison complete for items: [${uniqueItems.join(', ')}]`);
  res.json(comparisonResults);
});

// Add global error handlers
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', error);
  process.exit(1); // Mandatory exit after uncaught exception
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION!', reason);
  // Optionally exit on unhandled rejections
  // process.exit(1);
});

// Initialize browser instance during startup
browserManager.initializeBrowser()
  .then(() => {
    logger.info('Browser initialized during server startup');
  })
  .catch(err => {
    logger.warn('Failed to initialize browser during startup:', err.message);
    logger.info('Will retry browser initialization on first scraper request');
  });

// Start the server
logger.info('Starting server...');
const server = app.listen(config.port, () => {
  logger.info(`Backend server listening on http://localhost:${config.port}`);
});

// Add graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  // Close the browser
  try {
    await browserManager.closeBrowser();
    logger.info('Browser closed successfully');
  } catch (err) {
    logger.error('Error closing browser:', err);
  }
  
  // Close the server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Add a listener for server errors
server.on('error', (error) => {
  logger.error('Server error:', error);
  process.exit(1);
});
