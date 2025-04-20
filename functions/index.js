/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const scrapers = require("../backend/scrapers");

admin.initializeApp();
const db = admin.firestore();

// HTTP‑triggered function to crawl all retailers and upsert into Firestore
exports.crawlNow = functions.https.onRequest(async (req, res) => {
  try {
    // Collect data from all scrapers using a sample query
    // Basic grocery item that all stores should have
    const searchQuery = "milk";

    // Define scrapers to use
    const retailerScrapers = [
      {retailer: "Checkers", func: scrapers.scrapeCheckers},
      {retailer: "Shoprite", func: scrapers.scrapeShoprite},
      {retailer: "Pick n Pay", func: scrapers.scrapePicknPay},
      {retailer: "Makro", func: scrapers.scrapeMakro},
      {retailer: "Woolworths", func: scrapers.scrapeWoolworths},
      {retailer: "PriceCheck", func: scrapers.scrapePriceCheck},
    ];

    // Run scrapers in parallel
    const scraperPromises = retailerScrapers.map((s) => s.func(searchQuery));
    const settledResults = await Promise.allSettled(scraperPromises);

    // Collect and process results
    const items = [];
    settledResults.forEach((result, index) => {
      const retailer = retailerScrapers[index].retailer;
      if (result.status === "fulfilled" &&
          !result.value.error &&
          result.value.results) {
        const transformedResults = result.value.results.map((item) => ({
          url: item.url || "",
          name: item.name || item.title || "",
          price: parseFloat(item.price) || 0,
          store: retailer,
        }));

        items.push(...transformedResults);
      }
    });

    // Save to Firestore
    const batch = db.batch();
    items.forEach(({url, name, price, store}) => {
      const id = encodeURIComponent(`${store}|${url}`);
      const ref = db.collection("prices").doc(id);
      batch.set(
          ref,
          {url, name, price, store, updated: Date.now()},
          {merge: true},
      );
    });
    await batch.commit();
    res.json({success: true, count: items.length});
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});
