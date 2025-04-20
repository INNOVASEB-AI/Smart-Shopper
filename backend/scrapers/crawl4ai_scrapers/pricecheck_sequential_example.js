/**
 * PriceCheck Sequential Crawler Example
 * 
 * This example demonstrates how to use the PriceCheck sequential crawler
 * with Node.js by running the Python script and processing its output.
 * 
 * The crawler fetches product URLs from PriceCheck's sitemap and crawls them
 * sequentially using the same browser session for better efficiency.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../../../data/pricecheck_sequential');
const MAX_URLS = 20; // Limit number of URLs to crawl
const PYTHON_PATH = 'python'; // Use 'python3' if needed for your environment

/**
 * Run the PriceCheck sequential crawler
 * @param {Object} options - Crawler options
 * @param {string} options.outputDir - Directory to save crawled data
 * @param {number} options.maxUrls - Maximum number of URLs to crawl
 * @param {string} options.pythonPath - Path to Python executable
 * @returns {Promise<Object>} - Results of the crawler run
 */
async function runSequentialCrawler(options = {}) {
  const {
    outputDir = OUTPUT_DIR,
    maxUrls = MAX_URLS,
    pythonPath = PYTHON_PATH
  } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting PriceCheck sequential crawler...`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Max URLs: ${maxUrls}`);

  // Path to the Python script
  const scriptPath = path.join(__dirname, 'pricecheck_sequential_crawler.py');

  return new Promise((resolve, reject) => {
    // Spawn the Python process
    const crawler = spawn(pythonPath, [
      scriptPath,
      '--output-dir', outputDir,
      '--max-urls', maxUrls.toString()
    ]);

    let stdout = '';
    let stderr = '';

    // Collect stdout data
    crawler.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
    });

    // Collect stderr data
    crawler.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(error.trim());
    });

    // Handle process exit
    crawler.on('close', (code) => {
      if (code === 0) {
        console.log('Crawler completed successfully');
        
        // Find the most recent run directory
        const runDirs = fs.readdirSync(outputDir)
          .filter(dir => dir.startsWith('run_'))
          .map(dir => path.join(outputDir, dir));
        
        // Sort by creation time (newest first)
        runDirs.sort((a, b) => {
          return fs.statSync(b).ctime.getTime() - fs.statSync(a).ctime.getTime();
        });
        
        if (runDirs.length > 0) {
          const latestRunDir = runDirs[0];
          
          // Read summary.json if it exists
          const summaryPath = path.join(latestRunDir, 'summary.json');
          if (fs.existsSync(summaryPath)) {
            const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
            resolve({
              success: true,
              summary,
              outputDir: latestRunDir,
              stdout,
              stderr
            });
          } else {
            resolve({
              success: true,
              outputDir: latestRunDir,
              stdout,
              stderr
            });
          }
        } else {
          resolve({
            success: true,
            outputDir,
            stdout,
            stderr
          });
        }
      } else {
        console.error(`Crawler failed with exit code ${code}`);
        reject(new Error(`Crawler process exited with code ${code}: ${stderr}`));
      }
    });

    // Handle process error
    crawler.on('error', (error) => {
      console.error('Failed to start crawler process:', error);
      reject(error);
    });
  });
}

/**
 * Process crawler results
 * @param {Object} crawlerResult - Result from runSequentialCrawler
 */
function processCrawlerResults(crawlerResult) {
  if (!crawlerResult.success) {
    console.error('Crawler failed');
    return;
  }

  console.log('\n--- Crawler Results ---');
  
  if (crawlerResult.summary) {
    const { summary } = crawlerResult;
    console.log(`URLs processed: ${summary.urls_processed}`);
    console.log(`Successful: ${summary.successful}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Duration: ${summary.duration_seconds} seconds`);
  }

  console.log(`Output directory: ${crawlerResult.outputDir}`);
  
  // List product files
  const productFiles = fs.readdirSync(crawlerResult.outputDir)
    .filter(file => file.startsWith('product_') && file.endsWith('.json'));
  
  console.log(`\nFound ${productFiles.length} product files:`);
  
  // Display information about the first few products
  const MAX_DISPLAY = 5;
  for (let i = 0; i < Math.min(productFiles.length, MAX_DISPLAY); i++) {
    const productPath = path.join(crawlerResult.outputDir, productFiles[i]);
    const productData = JSON.parse(fs.readFileSync(productPath, 'utf8'));
    
    console.log(`\nProduct ${i+1}:`);
    console.log(`  Title: ${productData.title || 'N/A'}`);
    console.log(`  URL: ${productData.url || 'N/A'}`);
    
    if (productData.price && productData.price.current) {
      console.log(`  Price: R${productData.price.current}`);
    } else {
      console.log('  Price: N/A');
    }
    
    if (productData.merchants && productData.merchants.length > 0) {
      console.log(`  Merchants: ${productData.merchants.length}`);
    }
  }
  
  if (productFiles.length > MAX_DISPLAY) {
    console.log(`\n... and ${productFiles.length - MAX_DISPLAY} more products`);
  }
}

/**
 * Main function to run the example
 */
async function main() {
  try {
    // Run the crawler with default settings
    const result = await runSequentialCrawler();
    
    // Process and display results
    processCrawlerResults(result);
    
    console.log('\nCrawler example completed successfully');
  } catch (error) {
    console.error('Error running crawler:', error);
  }
}

// Run the example if this script is executed directly
if (require.main === module) {
  main();
} else {
  // Export functions for use in other modules
  module.exports = {
    runSequentialCrawler,
    processCrawlerResults
  };
} 