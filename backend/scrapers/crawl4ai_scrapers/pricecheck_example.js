/**
 * Example usage of the PriceCheck.co.za Sequential Crawler
 * 
 * This script demonstrates how to use the SequentialCrawler class
 * to crawl product information from PriceCheck.co.za
 */

const SequentialCrawler = require('./sequential_crawler');
const path = require('path');

// Create a custom output directory
const outputDir = path.join(process.cwd(), 'data', 'pricecheck_crawler_example');

// Create a new crawler instance with custom options
const crawler = new SequentialCrawler({
  // Default Python executable is 'python', use 'python3' if needed on your system
  pythonPath: 'python',
  
  // Custom output directory
  outputDir: outputDir,
  
  // Limit to 10 URLs for this example
  maxUrls: 10
});

// Log event handler
crawler.on('log', (log) => {
  console.log(`[${log.type.toUpperCase()}] ${log.message}`);
});

// Error event handler
crawler.on('error', (error) => {
  console.error('Crawler error:', error.message);
});

// Completion event handler
crawler.on('complete', (result) => {
  console.log(`Crawler finished. Success: ${result.success}. ${result.message}`);
  
  // After completion, get the results
  crawler.getResults(5)
    .then(results => {
      console.log(`Retrieved ${results.length} results:`);
      
      results.forEach((result, index) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`File: ${result.file}`);
        console.log(`Timestamp: ${result.timestamp}`);
        console.log('Data:', JSON.stringify(result.data, null, 2).substring(0, 200) + '...');
      });
    })
    .catch(err => {
      console.error('Error getting results:', err);
    });
});

// Start the crawler
async function runCrawler() {
  try {
    console.log('Starting PriceCheck.co.za crawler...');
    
    // Start the crawler
    const started = await crawler.start();
    
    if (started) {
      console.log('Crawler started successfully');
      console.log(`Results will be saved to: ${outputDir}`);
      
      // You can check the status while it's running
      setInterval(() => {
        if (crawler.isRunning) {
          const status = crawler.getStatus();
          console.log(`Crawler running for ${status.runDuration.toFixed(1)} seconds`);
        }
      }, 5000);
      
      // Example of stopping the crawler after 60 seconds (optional)
      // setTimeout(async () => {
      //   console.log('Stopping crawler after 60 seconds...');
      //   await crawler.stop();
      //   console.log('Crawler stopped');
      // }, 60000);
    } else {
      console.error('Failed to start crawler');
    }
  } catch (error) {
    console.error('Error running crawler:', error);
  }
}

// Run the crawler
runCrawler().catch(err => {
  console.error('Unhandled error:', err);
}); 