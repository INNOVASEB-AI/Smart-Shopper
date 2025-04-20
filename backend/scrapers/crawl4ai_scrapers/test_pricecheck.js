/**
 * Test script for the PriceCheck scraper
 * Usage: node test_pricecheck.js [search-query]
 */

const { scrapePriceCheck } = require('./index');

// Get the search query from command line arguments or use a default
const query = process.argv[2] || 'coffee';

console.log(`Testing PriceCheck scraper with query: ${query}`);

// Run the scraper and display results
scrapePriceCheck(query)
  .then(results => {
    console.log(`Found ${results.length} products on PriceCheck for "${query}"`);
    
    // Display the first 5 results
    const sampleSize = Math.min(5, results.length);
    console.log(`\nShowing first ${sampleSize} results:`);
    
    for (let i = 0; i < sampleSize; i++) {
      const product = results[i];
      console.log(`\n[${i+1}] ${product.name || 'Unknown Product'}`);
      console.log(`  Price: R${product.price || 'Not available'}`);
      console.log(`  Store: ${product.store || 'Unknown'}`);
      console.log(`  Link: ${product.product_link || 'No link available'}`);
    }
    
    console.log('\nComplete results:', JSON.stringify(results, null, 2));
  })
  .catch(error => {
    console.error('Error testing PriceCheck scraper:', error);
  }); 