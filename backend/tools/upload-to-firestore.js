/**
 * Upload Product Data to Firestore
 * 
 * This script reads the product data from the SQLite database and uploads it to Firestore
 * so the deployed app can access real product data.
 */

const admin = require('firebase-admin');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../sa-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Path to the SQLite database
const dbPath = path.resolve(__dirname, '../scrapers/crawl4ai_scrapers/data/products.db');

async function uploadProductsToFirestore() {
  console.log('Starting upload to Firestore...');
  
  try {
    // Open SQLite database
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening SQLite database:', err.message);
        process.exit(1);
      }
      console.log('Connected to SQLite database');
    });

    // Get all products from SQLite
    const products = await new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM products ORDER BY updated_at DESC", [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    console.log(`Found ${products.length} products to upload`);

    // Upload products to Firestore
    const batch = db.batch();
    let uploadCount = 0;

    for (const product of products) {
      try {
        // Parse the JSON data
        const productData = JSON.parse(product.data);
        
        // Create a clean product document
        const firestoreProduct = {
          id: product.id,
          name: product.title || productData.title || '',
          title: product.title || productData.title || '',
          price: product.price || (productData.price?.current || productData.price),
          retailer: product.retailer || productData.retailer || 'Unknown',
          store: product.retailer || productData.retailer || 'Unknown',
          url: product.url || productData.url || '',
          imageUrl: productData.imageUrl || productData.image || '',
          brand: product.brand || productData.brand || '',
          category: product.category || productData.category || '',
          description: product.description || productData.description || '',
          created_at: new Date(product.created_at * 1000),
          updated_at: new Date(product.updated_at * 1000),
          // Store the original data for reference
          original_data: productData
        };

        // Create document reference
        const docRef = db.collection('products').doc(product.id);
        batch.set(docRef, firestoreProduct);
        
        uploadCount++;
        
        if (uploadCount % 10 === 0) {
          console.log(`Processed ${uploadCount} products...`);
        }
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error.message);
      }
    }

    // Commit the batch
    console.log('Committing batch to Firestore...');
    await batch.commit();
    
    console.log(`✅ Successfully uploaded ${uploadCount} products to Firestore!`);
    
    // Close SQLite database
    sqliteDb.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err.message);
      } else {
        console.log('SQLite database closed');
      }
    });

    // Get some stats
    const stats = await getFirestoreStats();
    console.log('\n📊 Firestore Stats:');
    console.log(`Total products: ${stats.totalProducts}`);
    console.log(`Retailers: ${Object.keys(stats.retailerCounts).join(', ')}`);
    console.log(`Last updated: ${stats.lastUpdated}`);

  } catch (error) {
    console.error('Error uploading to Firestore:', error);
    process.exit(1);
  }
}

async function getFirestoreStats() {
  try {
    const snapshot = await db.collection('products').get();
    const products = snapshot.docs.map(doc => doc.data());
    
    const retailerCounts = {};
    let lastUpdated = null;
    
    products.forEach(product => {
      const retailer = product.retailer || 'Unknown';
      retailerCounts[retailer] = (retailerCounts[retailer] || 0) + 1;
      
      // Handle Firestore timestamp objects
      const updatedAt = product.updated_at;
      if (updatedAt) {
        const timestamp = updatedAt.toDate ? updatedAt.toDate() : updatedAt;
        if (!lastUpdated || timestamp > lastUpdated) {
          lastUpdated = timestamp;
        }
      }
    });
    
    return {
      totalProducts: products.length,
      retailerCounts,
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : null
    };
  } catch (error) {
    console.error('Error getting Firestore stats:', error);
    return { totalProducts: 0, retailerCounts: {}, lastUpdated: null };
  }
}

async function clearFirestoreProducts() {
  console.log('Clearing existing products from Firestore...');
  
  try {
    const snapshot = await db.collection('products').get();
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Cleared ${snapshot.docs.length} existing products`);
  } catch (error) {
    console.error('Error clearing Firestore:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--clear')) {
    await clearFirestoreProducts();
  }
  
  await uploadProductsToFirestore();
  
  console.log('\n🎉 Upload complete! Your deployed app now has access to real product data.');
  console.log('🌐 Visit: https://smart-shopper-46f4c.web.app');
}

main().catch(console.error); 