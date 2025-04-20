/**
 * Test script for the sequential crawler
 * Usage: node test_sequential_crawler.js [options]
 * 
 * Available options:
 *   --start            Start a new sequential crawl
 *   --status           Get the status of a running crawl
 *   --results          Get results from a completed crawl
 *   --max-urls=50      Maximum number of URLs to crawl (default: 50)
 *   --output-dir=DIR   Directory to save results in (optional)
 */

const { 
  startSequentialCrawl, 
  getSequentialCrawlStatus, 
  getSequentialCrawlResults 
} = require('./sequential_crawler');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

// Parse command line flags and options
args.forEach(arg => {
  if (arg === '--start') {
    options.start = true;
  } else if (arg === '--status') {
    options.status = true;
  } else if (arg === '--results') {
    options.results = true;
  } else if (arg.startsWith('--max-urls=')) {
    options.maxUrls = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--output-dir=')) {
    options.outputDir = arg.split('=')[1];
  } else if (arg.startsWith('--category=')) {
    options.category = arg.split('=')[1];
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10);
  }
});

// If no operation specified, show help
if (!options.start && !options.status && !options.results) {
  console.log(`
  Test script for the sequential crawler
  Usage: node test_sequential_crawler.js [options]
  
  Available options:
    --start            Start a new sequential crawl
    --status           Get the status of a running crawl
    --results          Get results from a completed crawl
    --max-urls=50      Maximum number of URLs to crawl (default: 50)
    --output-dir=DIR   Directory to save results in (optional)
    --category=CAT     Category to filter results by (optional, with --results)
    --limit=100        Maximum number of results to return (optional, with --results)
  `);
  process.exit(0);
}

// Execute the requested operation
async function main() {
  try {
    // Start a new crawl
    if (options.start) {
      console.log('Starting sequential crawler with options:', {
        maxUrls: options.maxUrls,
        outputDir: options.outputDir,
        detached: false // Run in foreground for test script
      });
      
      const result = await startSequentialCrawl({
        maxUrls: options.maxUrls,
        outputDir: options.outputDir,
        detached: false
      });
      
      console.log('Crawler started:', result);
    }
    
    // Get crawl status
    if (options.status) {
      console.log('Getting crawler status...');
      
      const status = await getSequentialCrawlStatus({
        outputDir: options.outputDir
      });
      
      console.log('Crawler status:', status);
    }
    
    // Get crawl results
    if (options.results) {
      console.log('Getting crawler results...');
      
      const results = await getSequentialCrawlResults({
        category: options.category,
        limit: options.limit || 10,
        outputDir: options.outputDir
      });
      
      console.log(`Found ${results.count} results:`);
      
      if (results.results && results.results.length > 0) {
        // Only show basic info for each result to avoid overwhelming output
        results.results.forEach((result, index) => {
          console.log(`[${index + 1}] ${result.url} (${result.filePath})`);
          
          if (result.data && Array.isArray(result.data)) {
            console.log(`  - Contains ${result.data.length} data items`);
          } else if (result.data) {
            console.log('  - Contains structured data');
          } else if (result.markdown) {
            console.log(`  - Contains markdown (${result.markdown.length} chars)`);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 