/**
 * API routes for sequential crawler operations
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../../logger');
const { 
  startSequentialCrawl, 
  getSequentialCrawlStatus, 
  getSequentialCrawlResults 
} = require('../../scrapers/crawl4ai_scrapers/sequential_crawler');

/**
 * @route POST /api/crawler/start
 * @description Start a sequential crawl of PriceCheck.co.za using the sitemap
 * @access Public
 */
router.post('/start', async (req, res) => {
  try {
    const { maxUrls, outputDir, detached = true } = req.body;
    
    logger.info(`Received request to start sequential crawler with maxUrls=${maxUrls}, outputDir=${outputDir}, detached=${detached}`);
    
    const result = await startSequentialCrawl({
      maxUrls: parseInt(maxUrls || '50', 10),
      outputDir,
      detached
    });
    
    return res.json({
      status: 'success',
      message: 'Sequential crawler started',
      ...result
    });
  } catch (error) {
    logger.error(`Error starting sequential crawler: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route GET /api/crawler/status
 * @description Get the status of a sequential crawl
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const { outputDir } = req.query;
    
    logger.info(`Received request to get crawler status with outputDir=${outputDir}`);
    
    const status = await getSequentialCrawlStatus({
      outputDir
    });
    
    return res.json({
      status: 'success',
      ...status
    });
  } catch (error) {
    logger.error(`Error getting crawler status: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route GET /api/crawler/results
 * @description Get results from a sequential crawl
 * @access Public
 */
router.get('/results', async (req, res) => {
  try {
    const { category, limit, outputDir } = req.query;
    
    logger.info(`Received request to get crawler results with category=${category}, limit=${limit}, outputDir=${outputDir}`);
    
    const results = await getSequentialCrawlResults({
      category,
      limit: parseInt(limit || '100', 10),
      outputDir
    });
    
    return res.json({
      status: 'success',
      ...results
    });
  } catch (error) {
    logger.error(`Error getting crawler results: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router; 