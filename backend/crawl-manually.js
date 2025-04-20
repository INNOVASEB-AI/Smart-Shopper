/**
 * Manual crawler script to run scrapers and save to Firestore
 * 
 * This script can be run directly from the command line with Node.js
 * without needing to deploy Firebase Functions.
 * 
 * Usage: node crawl-manually.js
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

// Initialize Firebase Admin with service account credentials
// You need to download your service account key file from the Firebase console
// https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), 
    // If applicationDefault() doesn't work, use:
    // credential: admin.credential.cert(require('./path-to-your-service-account-key.json')),
    databaseURL: "https://smart-shopper-46f4c-default-rtdb.firebaseio.com/"
  });
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
  
  // Save to Firestore
  if (items.length > 0) {
    console.log("Saving to Firestore...");
    try {
      const batch = db.batch();
      items.forEach(({url, name, price, store}) => {
        const id = encodeURIComponent(`${store}|${url}`);
        const ref = db.collection("prices").doc(id);
        batch.set(ref, {
          url, 
          name, 
          price, 
          store, 
          updated: Date.now()
        }, {merge: true});
      });
      
      await batch.commit();
      console.log(`Successfully saved ${items.length} items to Firestore!`);
    } catch (error) {
      console.error("Error saving to Firestore:", error);
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
    process.exit(1);
  }); 