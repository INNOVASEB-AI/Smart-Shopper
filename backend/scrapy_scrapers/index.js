/**
 * Node.js integration for Scrapy spiders
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../logger').createScraperLogger('ScrapyIntegration');

// Path to the Python script
const PYTHON_SCRIPT = path.join(__dirname, 'run_spider.py');
// Prefer python3 by default; allow override via env
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

// Check if the script exists
if (!fs.existsSync(PYTHON_SCRIPT)) {
  logger.error(`Python script not found: ${PYTHON_SCRIPT}`);
}

/**
 * Run a Scrapy spider from Node.js
 * 
 * @param {string} spider - Spider name (checkers, shoprite, picknpay, all)
 * @param {Object} options - Spider options
 * @param {string} options.query - Search query
 * @param {string} options.output - Output file path
 * @param {string} options.format - Output format (json, csv, xml)
 * @param {string} options.logLevel - Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
 * @returns {Promise<Object>} - Promise that resolves with the spider result
 */
function runSpider(spider, options = {}) {
  return new Promise((resolve, reject) => {
    // Validate spider name
    const validSpiders = ['checkers', 'shoprite', 'picknpay', 'all'];
    if (!validSpiders.includes(spider)) {
      return reject(new Error(`Invalid spider: ${spider}. Valid options are: ${validSpiders.join(', ')}`));
    }
    
    // Build command arguments
    const args = [
      PYTHON_SCRIPT,
      '--spider', spider
    ];
    
    if (options.query) {
      args.push('--query', options.query);
    }
    
    if (options.output) {
      args.push('--output', options.output);
    }
    
    if (options.format) {
      args.push('--format', options.format);
    }
    
    if (options.logLevel) {
      args.push('--log-level', options.logLevel);
    }
    
    logger.info(`Running Scrapy spider: ${spider} with options: ${JSON.stringify(options)} (using ${PYTHON_BIN})`);
    
    // Spawn Python process
    const pythonProcess = spawn(PYTHON_BIN, args);
    
    let stdout = '';
    let stderr = '';
    
    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.debug(`Scrapy output: ${output.trim()}`);
    });
    
    // Collect stderr
    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.error(`Scrapy error: ${error.trim()}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        logger.info(`Scrapy spider ${spider} completed successfully`);
        
        // Try to parse output file if provided
        if (options.output && fs.existsSync(options.output)) {
          try {
            const outputData = fs.readFileSync(options.output, 'utf8');
            const parsedData = JSON.parse(outputData);
            resolve({
              success: true,
              spider,
              data: parsedData,
              message: `Spider ${spider} completed successfully`
            });
          } catch (error) {
            logger.error(`Error parsing output file: ${error.message}`);
            resolve({
              success: true,
              spider,
              data: null,
              message: `Spider ${spider} completed successfully, but output file could not be parsed`
            });
          }
        } else {
          resolve({
            success: true,
            spider,
            data: null,
            message: `Spider ${spider} completed successfully`
          });
        }
      } else {
        logger.error(`Scrapy spider ${spider} failed with code ${code}`);
        reject(new Error(`Spider ${spider} failed with code ${code}: ${stderr}`));
      }
    });
    
    // Handle process error
    pythonProcess.on('error', (error) => {
      logger.error(`Error running Scrapy spider: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Scrape Checkers website
 * 
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Promise that resolves with the scrape result
 */
async function scrapeCheckersScrapy(query) {
  try {
    const result = await runSpider('checkers', { query });
    return {
      results: result.data || [],
      error: false
    };
  } catch (error) {
    logger.error(`Error scraping Checkers: ${error.message}`);
    return {
      results: [],
      error: true,
      message: error.message
    };
  }
}

/**
 * Scrape Shoprite website
 * 
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Promise that resolves with the scrape result
 */
async function scrapeShopriteScrappy(query) {
  try {
    const result = await runSpider('shoprite', { query });
    return {
      results: result.data || [],
      error: false
    };
  } catch (error) {
    logger.error(`Error scraping Shoprite: ${error.message}`);
    return {
      results: [],
      error: true,
      message: error.message
    };
  }
}

/**
 * Scrape Pick n Pay website
 * 
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Promise that resolves with the scrape result
 */
async function scrapePicknPayScrapy(query) {
  try {
    const result = await runSpider('picknpay', { query });
    return {
      results: result.data || [],
      error: false
    };
  } catch (error) {
    logger.error(`Error scraping Pick n Pay: ${error.message}`);
    return {
      results: [],
      error: true,
      message: error.message
    };
  }
}

module.exports = {
  runSpider,
  scrapeCheckersScrapy,
  scrapeShopriteScrappy,
  scrapePicknPayScrapy
}; 