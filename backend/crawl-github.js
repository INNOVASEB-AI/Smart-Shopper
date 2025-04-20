/**
 * GitHub Actions crawler script
 * 
 * This script is designed to be run as a GitHub Action
 * to automatically crawl retailers and update Firestore.
 */

const admin = require('firebase-admin');
const {
  scrapeCheckers,
  scrapeShoprite,
  scrapePicknPay,
  scrapeMakro,
  scrapeWoolworths,
  scrapePriceCheck,
} = require('./scrapers');

// Initialize Firebase Admin with service account credentials from GitHub secret
try {
  // The service account file is created by the GitHub Actions workflow
  // and provided through the GOOGLE_APPLICATION_CREDENTIALS env variable
  admin.initializeApp({
    credential: admin.credential.cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
    projectId: "smart-shopper-46f4c"
  });
  console.log("Firebase initialized successfully!");
} catch (error) {
  console.error("Firebase initialization error:", error.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Run all scrapers and save results to Firestore
 */
async function crawlAllRetailers() {
  console.log("Starting crawler for all retailers...");
  
  // Use multiple search terms to get a variety of products
  const searchTerms = [
    "milk", 
    "bread", 
    "eggs", 
    "chicken",
    "rice"
  ];
  
  // Select a random search term
  const searchQuery = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  // Define retailers and their corresponding scraper functions
  const retailerScrapers = [
    {retailer: "Checkers", func: scrapeCheckers},
    {retailer: "Shoprite", func: scrapeShoprite},
    {retailer: "Pick n Pay", func: scrapePicknPay},
    {retailer: "Makro", func: scrapeMakro},
    {retailer: "Woolworths", func: scrapeWoolworths},
    {retailer: "PriceCheck", func: scrapePriceCheck},
  ];
  
  // Run scrapers in parallel
  console.log(`Scraping retailers with query: "${searchQuery}"`);
  const scraperPromises = retailerScrapers.map(s => s.func(searchQuery));
  const settledResults = await Promise.allSettled(scraperPromises);
  
  // Collect and process results
  const items = [];
  settledResults.forEach((result, index) => {
    const retailer = retailerScrapers[index].retailer;
    console.log(`Results for ${retailer}: ${result.status}`);
    
    if (result.status === "fulfilled" && !result.value.error && result.value.results) {
      console.log(`  Found ${result.value.results.length} items from ${retailer}`);
      
      const transformedResults = result.value.results.map(item => ({
        url: item.url || "",
        name: item.name || item.title || "",
        price: parseFloat(item.price) || 0,
        store: retailer,
        crawled: new Date().toISOString(),
      }));
      
      items.push(...transformedResults);
    } else if (result.status === "rejected") {
      console.error(`  Error scraping ${retailer}:`, result.reason);
    } else if (result.value?.error) {
      console.error(`  Error scraping ${retailer}:`, result.value.message || "Unknown error");
    }
  });
  
  console.log(`Total items found: ${items.length}`);
  
  // Save to Firestore
  if (items.length > 0) {
    console.log("Saving to Firestore...");
    try {
      // Use batches of 500 items (Firestore batch limit)
      const batchSize = 500;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = db.batch();
        const currentBatch = items.slice(i, i + batchSize);
        
        currentBatch.forEach(({url, name, price, store, crawled}) => {
          const id = encodeURIComponent(`${store}|${url}`);
          const ref = db.collection("prices").doc(id);
          batch.set(ref, {
            url, 
            name, 
            price, 
            store, 
            updated: Date.now(),
            crawled
          }, {merge: true});
        });
        
        await batch.commit();
        console.log(`Batch ${Math.floor(i/batchSize) + 1} committed: ${currentBatch.length} items`);
      }
      
      console.log(`Successfully saved ${items.length} items to Firestore!`);
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      throw error; // Let the GitHub Action know there was an error
    }
  }
  
  return items;
}

// Execute the crawler function
crawlAllRetailers()
  .then((items) => {
    console.log(`Crawl process completed! Found ${items.length} items.`);
    
    // GitHub Actions logs the time and date of the run, so we can add more info
    console.log(`Run completed at: ${new Date().toISOString()}`);
    console.log(`Next scheduled run: In 24 hours (see GitHub workflow file for exact time)`);
    
    process.exit(0);
  })
  .catch(error => {
    console.error("Error during crawl process:", error);
    process.exit(1);
  });