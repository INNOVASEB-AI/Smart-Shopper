/**
 * Node.js integration for crawl4ai-based scrapers
 * This module provides a way to run Python-based crawl4ai scrapers from Node.js
 */

const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../../logger');

/**
 * Executes a Python script with the provided arguments
 * 
 * @param {string} scriptName - Name of the Python script to run (without .py extension)
 * @param {Array<string>} args - Arguments to pass to the script
 * @returns {Promise<any>} - Promise that resolves with the script's output as parsed JSON
 */
function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    // Construct the path to the Python script
    const scriptPath = path.join(__dirname, `${scriptName}.py`);
    
    // Log the command being executed
    logger.info(`Executing Python script: ${scriptPath} with args: ${args.join(' ')}`);
    
    // Spawn a child process to run the Python script
    const pythonProcess = spawn('python3', [scriptPath, ...args]);
    
    let dataString = '';
    let errorString = '';
    
    // Collect data from the script's stdout
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    // Collect error messages from the script's stderr
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      logger.warn(`Python stderr: ${data.toString()}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Python script exited with code ${code}`);
        logger.error(`Error output: ${errorString}`);
        return reject(new Error(`Python script exited with code ${code}: ${errorString}`));
      }
      
      // Try to parse the output as JSON
      try {
        // Extract any JSON content from the output
        const jsonMatch = dataString.match(/\[.*\]/s) || dataString.match(/\{.*\}/s);
        
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          resolve(jsonData);
        } else {
          logger.info(`Python script output: ${dataString}`);
          resolve([]); // Return empty array if no JSON found
        }
      } catch (error) {
        logger.error(`Failed to parse JSON from Python output: ${error.message}`);
        logger.debug(`Raw output: ${dataString}`);
        resolve([]); // Return empty array on parse error
      }
    });
    
    // Handle Python process errors
    pythonProcess.on('error', (error) => {
      logger.error(`Failed to start Python process: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Scrape PriceCheck website for products matching the given query
 * 
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Promise that resolves with product results
 */
async function scrapePriceCheck(query) {
  try {
    // Call the Python script and return the results
    const results = await runPythonScript('scrape_pricecheck', [query]);
    return results;
  } catch (error) {
    logger.error(`Error in scrapePriceCheck: ${error.message}`);
    return [];
  }
}

/**
 * Search for products in the database
 * 
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} options.retailer - Filter by retailer
 * @param {string} options.category - Filter by category
 * @param {string} options.brand - Filter by brand
 * @param {number} options.minPrice - Minimum price
 * @param {number} options.maxPrice - Maximum price
 * @param {number} options.limit - Maximum number of results to return
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} - Promise that resolves with search results
 */
async function searchProducts(options = {}) {
  try {
    // Build arguments array
    const args = ['search'];
    
    if (options.query) args.push('--query', options.query);
    if (options.retailer) args.push('--retailer', options.retailer);
    if (options.category) args.push('--category', options.category);
    if (options.brand) args.push('--brand', options.brand);
    if (options.minPrice) args.push('--min-price', options.minPrice);
    if (options.maxPrice) args.push('--max-price', options.maxPrice);
    if (options.limit) args.push('--limit', options.limit);
    if (options.offset) args.push('--offset', options.offset);
    
    // Custom database path
    if (options.dbPath) args.push('--db-path', options.dbPath);
    
    // Call the API integration script
    const output = await runPythonScript('api_integration', args);
    
    // Parse the JSON output if it's a string
    if (typeof output === 'string') {
      return JSON.parse(output);
    }
    
    return output;
  } catch (error) {
    logger.error(`Error in searchProducts: ${error.message}`);
    return {
      error: error.message,
      results: {},
      totalProducts: 0
    };
  }
}

/**
 * Get detailed information about a specific product
 * 
 * @param {string} productId - ID of the product to retrieve
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Promise<Object>} - Promise that resolves with product details
 */
async function getProductDetails(productId, dbPath) {
  try {
    // Build arguments array
    const args = ['details', productId];
    
    // Custom database path
    if (dbPath) args.push('--db-path', dbPath);
    
    // Call the API integration script
    const output = await runPythonScript('api_integration', args);
    
    // Parse the JSON output if it's a string
    if (typeof output === 'string') {
      return JSON.parse(output);
    }
    
    return output;
  } catch (error) {
    logger.error(`Error in getProductDetails: ${error.message}`);
    return {
      error: error.message
    };
  }
}

/**
 * Get statistics about the product database
 * 
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Promise<Object>} - Promise that resolves with database statistics
 */
async function getDatabaseStats(dbPath) {
  try {
    // Build arguments array
    const args = ['stats'];
    
    // Custom database path
    if (dbPath) args.push('--db-path', dbPath);
    
    // Call the API integration script
    const output = await runPythonScript('api_integration', args);
    
    // Parse the JSON output if it's a string
    if (typeof output === 'string') {
      return JSON.parse(output);
    }
    
    return output;
  } catch (error) {
    logger.error(`Error in getDatabaseStats: ${error.message}`);
    return {
      error: error.message
    };
  }
}

/**
 * Run a one-time crawl for a specific retailer
 * 
 * @param {Object} options - Crawl options
 * @param {string} options.retailer - Name of the retailer to crawl
 * @param {string} options.outputDir - Directory to save crawled data
 * @param {string} options.dbPath - Path to the product database
 * @param {number} options.maxUrls - Maximum number of URLs to crawl
 * @returns {Promise<Object>} - Promise that resolves with crawl results
 */
async function runCrawl(options = {}) {
  try {
    // Build arguments array
    const args = ['run'];
    
    if (!options.retailer) {
      throw new Error('Retailer name is required');
    }
    
    args.push(options.retailer);
    
    if (options.outputDir) args.push('--output-dir', options.outputDir);
    if (options.dbPath) args.push('--db-path', options.dbPath);
    if (options.maxUrls) args.push('--max-urls', options.maxUrls);
    
    // Call the scheduler script
    const output = await runPythonScript('scheduler', args);
    
    // Return the results
    return output;
  } catch (error) {
    logger.error(`Error in runCrawl: ${error.message}`);
    return {
      error: error.message
    };
  }
}

/**
 * Start the scheduler
 * 
 * @param {Object} options - Scheduler options
 * @param {string} options.outputDir - Directory to save crawled data
 * @param {string} options.dbPath - Path to the product database
 * @returns {Promise<boolean>} - Promise that resolves with true if scheduler started
 */
async function startScheduler(options = {}) {
  try {
    // Build arguments array
    const args = ['start'];
    
    if (options.outputDir) args.push('--output-dir', options.outputDir);
    if (options.dbPath) args.push('--db-path', options.dbPath);
    
    // Call the scheduler script - we won't wait for it to finish since it runs continuously
    const childProcess = spawn('python3', [
      path.join(__dirname, 'scheduler.py'),
      ...args
    ]);
    
    // Log output from the scheduler
    childProcess.stdout.on('data', (data) => {
      logger.info(`Scheduler: ${data.toString().trim()}`);
    });
    
    childProcess.stderr.on('data', (data) => {
      logger.error(`Scheduler error: ${data.toString().trim()}`);
    });
    
    // Handle process completion
    childProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`Scheduler exited with code ${code}`);
      } else {
        logger.info('Scheduler stopped');
      }
    });
    
    // Return success if the process was started
    return true;
  } catch (error) {
    logger.error(`Error starting scheduler: ${error.message}`);
    return false;
  }
}

/**
 * List available retailers
 * 
 * @returns {Promise<Array<string>>} - Promise that resolves with list of retailer names
 */
async function listRetailers() {
  try {
    // Call the scheduler script with list command
    const output = await runPythonScript('scheduler', ['list']);
    
    // Parse the output to extract retailer names
    const retailers = [];
    if (typeof output === 'string') {
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*-\s+(.+)$/);
        if (match) {
          retailers.push(match[1]);
        }
      }
    }
    
    return retailers;
  } catch (error) {
    logger.error(`Error listing retailers: ${error.message}`);
    return [];
  }
}

module.exports = {
  // Legacy function
  scrapePriceCheck,
  
  // New database search functions
  searchProducts,
  getProductDetails,
  getDatabaseStats,
  
  // Crawler/scheduler functions
  runCrawl,
  startScheduler,
  listRetailers
}; 