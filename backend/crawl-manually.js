/**
 * Manual crawler script to run scrapers and save to Firestore
 * 
 * This script can be run directly from the command line with Node.js
 * without needing to deploy Firebase Functions.
 * 
 * Usage: node crawl-manually.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const {
  scrapeCheckers,
  scrapeShoprite,
  scrapePicknPay,
  scrapeMakro,
  scrapeWoolworths,
  scrapePriceCheck,
} = require('./scrapers');

// Check if using Firebase emulator
const useEmulator = process.env.USE_FIREBASE_EMULATOR === 'true';
console.log(`Firebase emulator mode: ${useEmulator ? 'ENABLED' : 'DISABLED'}`);

// Configure Firebase and Firestore
try {
  admin.initializeApp({
    credential: admin.credential.cert(require('./sa-key.json')),
    projectId: "smart-shopper-46f4c"
  });
  console.log("Firebase initialized successfully!");
} catch (error) {
  console.error("Firebase initialization error:", error.message);
  console.error("Full error:", error);
  process.exit(1);
}

const db = admin.firestore();

// Connect to emulator if enabled
if (useEmulator) {
  console.log("Connecting to Firebase emulator at localhost:8080");
  db.settings({
    host: "localhost:8080",
    ssl: false
  });
}

// Test Firestore connection
async function testFirestoreConnection() {
  try {
    console.log("Testing Firestore connection...");
    const testRef = db.collection("test").doc("connection-test");
    await testRef.set({ timestamp: Date.now() });
    
    // Verify the write
    const doc = await testRef.get();
    if (doc.exists) {
      console.log("Firestore connection successful! Data was written and read back.");
      return true;
    } else {
      console.error("Firestore connection might have issues: Write succeeded but read failed.");
      return false;
    }
  } catch (error) {
    console.error("Firestore connection test failed:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
}

/**
 * Run all scrapers and save results to Firestore
 */
async function crawlAllRetailers() {
  console.log("Starting crawler for all retailers...");
  
  // First, test the Firestore connection
  const isFirestoreConnected = await testFirestoreConnection();
  if (!isFirestoreConnected) {
    console.error("Cannot proceed with crawl: Firestore connection failed");
    return [];
  }
  
  // Use a common search term that most retailers should have
  const searchQuery = "milk";
  
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
      }));
      
      items.push(...transformedResults);
    } else if (result.status === "rejected") {
      console.error(`  Error scraping ${retailer}:`, result.reason);
    } else if (result.value?.error) {
      console.error(`  Error scraping ${retailer}:`, result.value.message || "Unknown error");
    }
  });
  
  console.log(`Total items found: ${items.length}`);
  
  // Save results to local file as backup
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFile = `./crawler-data-${timestamp}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(items, null, 2));
    console.log(`Backup saved to ${backupFile}`);
  } catch (backupError) {
    console.error("Failed to save backup file:", backupError);
  }
  
  // Save to Firestore
  if (items.length > 0) {
    console.log("Saving to Firestore...");
    try {
      // Create smaller batches to avoid potential limitations
      const BATCH_SIZE = 200; // Firestore has a limit of 500 operations per batch
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      let totalCount = 0;
      
      console.log(`Creating batches for ${items.length} items...`);
      
      for (const item of items) {
        const {url, name, price, store} = item;
        
        // Make sure URL is valid for document ID
        if (!url) {
          console.warn(`Skipping item with empty URL: ${name} from ${store}`);
          continue;
        }
        
        try {
          const id = encodeURIComponent(`${store}|${url}`);
          const ref = db.collection("prices").doc(id);
          
          currentBatch.set(ref, {
            url, 
            name, 
            price, 
            store, 
            updated: Date.now()
          }, {merge: true});
          
          batchCount++;
          totalCount++;
          
          if (batchCount >= BATCH_SIZE) {
            // Add current batch to list and start a new one
            batches.push(currentBatch);
            currentBatch = db.batch();
            console.log(`Batch ${batches.length} created with ${batchCount} operations`);
            batchCount = 0;
          }
        } catch (encodeError) {
          console.error(`Error encoding URL for item ${name}:`, encodeError);
        }
      }
      
      // Add the last batch if it has operations
      if (batchCount > 0) {
        batches.push(currentBatch);
        console.log(`Final batch ${batches.length} created with ${batchCount} operations`);
      }
      
      // Commit all batches in sequence
      console.log(`Committing ${batches.length} batches with total ${totalCount} operations...`);
      
      for (let i = 0; i < batches.length; i++) {
        console.log(`Committing batch ${i+1}/${batches.length}...`);
        try {
          await batches[i].commit();
          console.log(`Batch ${i+1} committed successfully!`);
        } catch (batchError) {
          console.error(`Error committing batch ${i+1}:`, batchError);
          console.error("Error details:", JSON.stringify(batchError, null, 2));
        }
      }
      
      console.log(`Finished Firestore write operations. Attempted to save ${totalCount} items.`);
      
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
          console.error("Error details:", JSON.stringify(verifyError, null, 2));
        }
      }
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
    }
  }
  
  return items;
}

// Execute the crawler function
crawlAllRetailers()
  .then(() => {
    console.log("Crawl process completed!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Error during crawl process:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    process.exit(1);
  }); 