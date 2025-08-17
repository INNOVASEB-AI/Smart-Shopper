const axios = require('axios');
const cheerio = require('cheerio');
const BROWSER_HEADERS = require('./browserHeaders');
const { logger } = require('../logger');
const config = require('../config');

// Collection of realistic user agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
];

// Helper function to get a random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Helper function to add delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to retry a function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let retries = 0;
  let currentDelay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw error; // Re-throw the error if we've exceeded max retries
      }
      
      // Add jitter to the delay to avoid thundering herd problem
      const jitter = Math.floor(Math.random() * 1000);
      const delayTime = currentDelay + jitter;
      
      logger.info(`Request failed, retrying in ${delayTime}ms... (Attempt ${retries}/${maxRetries})`);
      await delay(delayTime);
      
      // Exponential backoff
      currentDelay = currentDelay * 2;
    }
  }
}

/**
 * Generic HTTP scraper helper that uses axios and cheerio
 * 
 * @param {string} retailer - The retailer name
 * @param {string} searchUrl - The URL to scrape
 * @param {string} itemSelector - The CSS selector for product items
 * @param {Function} extractFn - Function to extract product details from a cheerio element
 * @returns {Promise<Array>} - Array of product objects
 */
async function scrapeWithCheerio(retailer, searchUrl, itemSelector, extractFn) {
  const results = [];
  const retailerLogger = logger.child({ retailer });
  
  try {
    retailerLogger.info(`Scraping ${retailer} at ${searchUrl}`);
    
    // Define the fetch function with a random user agent
    const fetchPage = async () => {
      // Add a randomized user agent for each request
      const headers = {
        ...BROWSER_HEADERS,
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      };
      
      // Add a slight delay to mimic human behavior (300-1000ms)
      await delay(300 + Math.floor(Math.random() * 700));
      
      // Make the request with a longer timeout
      return axios.get(searchUrl, { 
        headers, 
        timeout: config.timeouts.httpRequest,
        // Don't follow redirects automatically to avoid fingerprinting
        maxRedirects: 5
      });
    };
    
    // Perform the request with retry logic
    const response = await retryWithBackoff(fetchPage, 3, 2000);
    const $ = cheerio.load(response.data);
    
    // Check if we got the expected content
    if ($(itemSelector).length === 0) {
      retailerLogger.warn(`No items found matching selector "${itemSelector}". Might be blocked or empty results.`);
      
      // Check if we're seeing a CAPTCHA or access denied page
      const bodyText = $('body').text().toLowerCase();
      if (bodyText.includes('captcha') || 
          bodyText.includes('robot') || 
          bodyText.includes('access denied') ||
          bodyText.includes('blocked')) {
        retailerLogger.error(`Detected anti-bot protection on ${retailer}`);
        return { 
          results: [], 
          error: true, 
          message: "Anti-bot protection detected. Try again later." 
        };
      }
    }
    
    // Process the items
    $(itemSelector).each((index, element) => {
      try {
        const product = extractFn($, element, retailer);
        if (product) {
          results.push(product);
        }
      } catch (parseError) {
        retailerLogger.error(`Error parsing item: ${parseError.message}`);
      }
    });
    
    retailerLogger.info(`Found ${results.length} results from ${retailer}`);
    return { results, error: false };
  } catch (error) {
    retailerLogger.error(`Error scraping: ${error.message}`);
    if (error.response) {
      retailerLogger.error(`Status: ${error.response.status}`);
    }
    return { results: [], error: true, message: error.message };
  }
}

module.exports = { scrapeWithCheerio }; 