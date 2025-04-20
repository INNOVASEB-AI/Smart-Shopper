const express = require('express');
const cors = require('cors');
const app = express();
const config = require('./config');
const browserManager = require('./scrapers/browserManager');

// Import scrapers from the scrapers module
const {
  scrapeCheckers,
  scrapeShoprite,
  scrapePicknPay,
  scrapeMakro,
  scrapeWoolworths,
  scrapePriceCheck,
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

// --- Legacy Search Endpoint (will be removed in future versions) ---
app.get('/api/search-legacy', async (req, res) => {
  const query = req.query.query || '';
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  logger.info(`Starting legacy search for: "${query}"`);

  // Define retailers and their corresponding scraper functions
  const scrapers = [
    { retailer: 'Checkers', func: scrapeCheckers },
    { retailer: 'Shoprite', func: scrapeShoprite },
    { retailer: 'Pick n Pay', func: scrapePicknPay },
    { retailer: 'Makro', func: scrapeMakro },
    { retailer: 'Woolworths', func: scrapeWoolworths },
    { retailer: 'PriceCheck', func: scrapePriceCheck },
  ];

  // Run scrapers in parallel
  try {
    const scraperPromises = scrapers.map((s) => s.func(query));
    const settledResults = await Promise.allSettled(scraperPromises);

    const allResults = [];
    const errors = [];

    settledResults.forEach((result, index) => {
      const retailer = scrapers[index].retailer;
      if (result.status === 'fulfilled') {
        // Handle standardized response format
        if (result.value.error) {
          errors.push({ retailer, message: result.value.message });
        } else {
          allResults.push(...(result.value.results || []));
        }
      } else {
        logger.error(`Scraper for ${retailer} failed:`, result.reason || 'Unknown reason');
        errors.push({ retailer, message: result.reason?.message || 'Unknown error' });
      }
    });

    logger.info(`Total results collected for "${query}": ${allResults.length}`);

    // Return the results with any errors that occurred
    res.json({ 
      results: allResults,
      errors: errors.length > 0 ? errors : undefined,
      retailersWithErrors: errors.length > 0 ? errors.map(e => e.retailer) : undefined
    });
  } catch (error) {
    logger.error(`General error during search aggregation for "${query}":`, error);
    res
      .status(500)
      .json({ 
        error: 'An error occurred during search aggregation.', 
        details: error.message,
        results: []
      });
  }
});

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

  // Define retailers and their corresponding scraper functions (same as search)
  const scrapers = [
    { retailer: 'Checkers', func: scrapeCheckers },
    { retailer: 'Shoprite', func: scrapeShoprite },
    { retailer: 'Pick n Pay', func: scrapePicknPay },
    { retailer: 'Makro', func: scrapeMakro },
    { retailer: 'Woolworths', func: scrapeWoolworths },
  ];

  // Create all scraping tasks: one per item per retailer
  const tasks = [];
  uniqueItems.forEach(item => {
    scrapers.forEach(scraper => {
      tasks.push({
        item: item,
        retailer: scraper.retailer,
        promise: scraper.func(item) // Call the scraper function for the specific item
      });
    });
  });

  try {
    const settledResults = await Promise.allSettled(tasks.map(task => task.promise));

    // Initialize results structure
    const comparisonResults = {};
    scrapers.forEach(s => {
      comparisonResults[s.retailer] = {
        totalPrice: 0,
        foundItems: [],
        missingItems: [],
        potentialErrors: [], // Store errors encountered for this retailer
        itemCount: 0
      };
    });

    // Process results
    settledResults.forEach((result, index) => {
      const task = tasks[index]; // Get corresponding item and retailer
      const retailerResult = comparisonResults[task.retailer];

      if (result.status === 'fulfilled') {
        const scrapeOutput = result.value;
        if (scrapeOutput.error) {
          // Scraper function returned an error object
          retailerResult.missingItems.push(task.item);
          retailerResult.potentialErrors.push({ item: task.item, message: scrapeOutput.message });
        } else if (scrapeOutput.results && scrapeOutput.results.length > 0) {
          // Scraper succeeded and found at least one result
          // Strategy: Use the first result found for the price
          const foundProduct = scrapeOutput.results[0]; 
          // Ensure price is a number
          const price = parseFloat(foundProduct.price);
          if (!isNaN(price)) {
             retailerResult.totalPrice += price;
             retailerResult.foundItems.push({ name: task.item, price: price, details: foundProduct });
             retailerResult.itemCount++;
          } else {
             logger.warn(`Invalid price found for item '${task.item}' at ${task.retailer}: ${foundProduct.price}`);
             retailerResult.missingItems.push(task.item); // Treat as missing if price invalid
             retailerResult.potentialErrors.push({ item: task.item, message: `Invalid price format: ${foundProduct.price}` });
          }
        } else {
          // Scraper succeeded but found no results for the item
          retailerResult.missingItems.push(task.item);
        }
      } else {
        // Promise rejected (e.g., network error, scraper crash)
        logger.error(`Scraper task failed for item "${task.item}" at ${task.retailer}:`, result.reason);
        retailerResult.missingItems.push(task.item);
        retailerResult.potentialErrors.push({ item: task.item, message: result.reason?.message || 'Unknown error' });
      }
    });

    // Format prices to 2 decimal places
    Object.values(comparisonResults).forEach(res => {
       res.totalPrice = parseFloat(res.totalPrice.toFixed(2));
    });

    logger.info(`Basket comparison complete for items: [${uniqueItems.join(', ')}]`);
    res.json(comparisonResults);

  } catch (error) { // Catch errors in the overall Promise.allSettled or processing logic
    logger.error(`General error during basket comparison for items [${uniqueItems.join(', ')}]:`, error);
    res.status(500).json({ error: 'An error occurred during basket comparison.' });
  }
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
