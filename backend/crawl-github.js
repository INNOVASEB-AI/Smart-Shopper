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

// Helper function to add delay between operations
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      
      console.log(`Attempt ${retries} failed, retrying in ${currentDelay}ms...`);
      await delay(currentDelay);
      
      // Exponential backoff with jitter
      currentDelay = currentDelay * 2 + Math.floor(Math.random() * 1000);
    }
  }
}

/**
 * Run all scrapers and save results to Firestore
 */
async function crawlAllRetailers() {
  console.log("Starting crawler for all retailers...");
  
  // Test Firestore connection
  try {
    const testRef = db.collection("test").doc("connection-test");
    await testRef.set({ timestamp: Date.now() });
    const testDoc = await testRef.get();
    if (testDoc.exists) {
      console.log("Firestore connection successful! Data was written and read back.");
    } else {
      console.error("Firestore connection might have issues: Write succeeded but read failed.");
    }
  } catch (error) {
    console.error("Firestore connection test failed:", error);
    throw error; // Stop the process if we can't connect to Firestore
  }
  
  // Use multiple search terms to get a variety of products
  const searchTerms = [
    "milk", 
    "bread", 
    "eggs", 
    "chicken",
    "rice"
  ];
  
  // Define retailers and their corresponding scraper functions
  const retailerScrapers = [
    {retailer: "Checkers", func: scrapeCheckers},
    {retailer: "Shoprite", func: scrapeShoprite},
    {retailer: "Pick n Pay", func: scrapePicknPay},
    {retailer: "Makro", func: scrapeMakro},
    {retailer: "Woolworths", func: scrapeWoolworths},
    // {retailer: "PriceCheck", func: scrapePriceCheck}, // Disabled: consistently 403s in CI
  ];
  
  const results = [];
  
  // Iterate all search terms; for each term, run all retailers in sequence with delays
  for (const searchQuery of searchTerms) {
    // Run scrapers with delay between them to avoid getting blocked
    console.log(`Scraping retailers with query: "${searchQuery}"`);
    
    // Run each scraper with a delay between them
    for (const {retailer, func} of retailerScrapers) {
      try {
        console.log(`Starting scraper for ${retailer} (term: ${searchQuery})...`);
        
        if (retailer === "PriceCheck") {
          console.log(`Using PriceCheck function: ${func.name}`);
        }
        
        const result = await retryWithBackoff(async () => {
          return await func(searchQuery);
        });
        
        results.push({ status: "fulfilled", retailer, value: result });
        console.log(`Completed scraper for ${retailer} (term: ${searchQuery})`);
        
        console.log(`Waiting 15 seconds before starting the next retailer scraper...`);
        await delay(15000);
      } catch (error) {
        console.error(`Error scraping ${retailer} (term: ${searchQuery}):`, error.message || error);
        results.push({ status: "rejected", retailer, reason: error });
      }
    }
    // Short pause between terms to reduce load
    console.log('Waiting 20 seconds before the next search term...');
    await delay(20000);
  }
  
  // Collect and process results
  const items = [];
  
  results.forEach(({status, retailer, value, reason}) => {
    console.log(`Results for ${retailer}: ${status}`);
    
    if (status === "fulfilled" && value && !value.error && value.results) {
      const resultCount = value.results?.length || 0;
      console.log(`  Found ${resultCount} items from ${retailer}`);
      
      if (resultCount > 0) {
        const transformedResults = value.results.map(item => ({
          url: item.url || "",
          name: item.name || item.title || "",
          price: parseFloat(item.price) || 0,
          store: retailer,
          crawled: new Date().toISOString(),
        })).filter(item => item.url && item.name && item.price > 0); // Filter out incomplete items
        
        items.push(...transformedResults);
        console.log(`  Processed ${transformedResults.length} valid items from ${retailer}`);
      }
    } else if (status === "rejected") {
      console.error(`  Error scraping ${retailer}:`, reason?.message || "Unknown error");
    } else if (value?.error) {
      console.error(`  Error scraping ${retailer}:`, value.message || "Unknown error");
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
      
      // Verify data was saved by reading back one item
      if (items.length > 0) {
        try {
          const firstItem = items[0];
          const id = encodeURIComponent(`${firstItem.store}|${firstItem.url}`);
          console.log(`Verifying saved data by reading document ID: ${id}`);
          const docRef = db.collection("prices").doc(id);
          const docSnap = await docRef.get();
          
          if (docSnap.exists) {
            console.log("Verification successful! Data was saved correctly:");
            console.log(JSON.stringify(docSnap.data(), null, 2));
          } else {
            console.error("Verification failed! Document does not exist after saving.");
          }
        } catch (verifyError) {
          console.error("Error verifying saved data:", verifyError);
        }
      }
      
      console.log(`Successfully saved ${items.length} items to Firestore!`);
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      throw error; // Let the GitHub Action know there was an error
    }
  } else {
    console.warn("No valid items found to save to Firestore!");
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