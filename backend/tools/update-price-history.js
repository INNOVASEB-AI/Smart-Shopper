/**
 * Update Price History
 * 
 * This script tracks price changes over time and stores price history in Firestore.
 * It compares current prices with previous prices and creates a price history timeline.
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../sa-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updatePriceHistory() {
  console.log('🔄 Updating price history...');
  
  try {
    // Get all current products
    const productsSnapshot = await db.collection('products').get();
    const currentProducts = {};
    
    productsSnapshot.docs.forEach(doc => {
      currentProducts[doc.id] = doc.data();
    });
    
    console.log(`Found ${Object.keys(currentProducts).length} current products`);
    
    // Get existing price history
    const historySnapshot = await db.collection('price_history').get();
    const existingHistory = {};
    
    historySnapshot.docs.forEach(doc => {
      existingHistory[doc.id] = doc.data();
    });
    
    console.log(`Found ${Object.keys(existingHistory).length} existing price history records`);
    
    const batch = db.batch();
    const now = new Date();
    let updatedCount = 0;
    let newHistoryCount = 0;
    
    // Process each current product
    for (const [productId, currentProduct] of Object.entries(currentProducts)) {
      const currentPrice = currentProduct.price;
      const existingRecord = existingHistory[productId];
      
      if (!currentPrice) {
        console.log(`Skipping ${productId} - no current price`);
        continue;
      }
      
      if (!existingRecord) {
        // First time seeing this product - create initial history
        const historyDoc = {
          product_id: productId,
          product_name: currentProduct.name || currentProduct.title,
          retailer: currentProduct.retailer,
          current_price: currentPrice,
          price_history: [{
            price: currentPrice,
            timestamp: now,
            change: 0,
            change_percentage: 0
          }],
          lowest_price: currentPrice,
          highest_price: currentPrice,
          price_changes: 0,
          last_updated: now,
          created_at: now
        };
        
        const docRef = db.collection('price_history').doc(productId);
        batch.set(docRef, historyDoc);
        newHistoryCount++;
        
      } else {
        // Product exists - check for price changes
        const lastPrice = existingRecord.current_price;
        const priceChanged = lastPrice !== currentPrice;
        
        if (priceChanged) {
          const priceChange = currentPrice - lastPrice;
          const changePercentage = lastPrice > 0 ? (priceChange / lastPrice) * 100 : 0;
          
          // Update price history
          const updatedHistory = {
            ...existingRecord,
            current_price: currentPrice,
            price_history: [
              ...(existingRecord.price_history || []),
              {
                price: currentPrice,
                timestamp: now,
                change: priceChange,
                change_percentage: changePercentage
              }
            ],
            lowest_price: Math.min(existingRecord.lowest_price || currentPrice, currentPrice),
            highest_price: Math.max(existingRecord.highest_price || currentPrice, currentPrice),
            price_changes: (existingRecord.price_changes || 0) + 1,
            last_updated: now
          };
          
          // Keep only last 30 price history entries to avoid bloat
          if (updatedHistory.price_history.length > 30) {
            updatedHistory.price_history = updatedHistory.price_history.slice(-30);
          }
          
          const docRef = db.collection('price_history').doc(productId);
          batch.update(docRef, updatedHistory);
          updatedCount++;
          
          console.log(`💰 Price change for ${currentProduct.name}: R${lastPrice} → R${currentPrice} (${changePercentage > 0 ? '+' : ''}${changePercentage.toFixed(1)}%)`);
        }
      }
    }
    
    // Commit all changes
    console.log(`Batch has ${batch._mutations ? batch._mutations.length : 0} mutations`);
    console.log(`Created ${newHistoryCount} new history records`);
    console.log(`Updated ${updatedCount} price changes`);
    
    if (newHistoryCount > 0 || updatedCount > 0) {
      try {
        await batch.commit();
        console.log(`✅ Successfully committed ${newHistoryCount + updatedCount} changes to Firestore`);
      } catch (error) {
        console.error('❌ Error committing batch:', error);
        throw error;
      }
    } else {
      console.log('✅ No changes to commit');
    }
    
    // Generate summary
    const summary = await generatePriceHistorySummary();
    console.log('\n📊 Price History Summary:');
    console.log(`Total products tracked: ${summary.totalProducts}`);
    console.log(`Products with price changes: ${summary.productsWithChanges}`);
    console.log(`Total price changes today: ${summary.totalChangesToday}`);
    console.log(`Average price change: ${summary.averageChangePercentage.toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error updating price history:', error);
    throw error;
  }
}

async function generatePriceHistorySummary() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const historySnapshot = await db.collection('price_history').get();
    const historyRecords = historySnapshot.docs.map(doc => doc.data());
    
    let totalProducts = historyRecords.length;
    let productsWithChanges = 0;
    let totalChangesToday = 0;
    let totalChangePercentage = 0;
    let changeCount = 0;
    
    historyRecords.forEach(record => {
      if (record.price_changes > 0) {
        productsWithChanges++;
      }
      
      // Count changes from today
      if (record.price_history && Array.isArray(record.price_history)) {
        const todayChanges = record.price_history.filter(entry => {
          const entryDate = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
          return entryDate >= today;
        });
        
        totalChangesToday += todayChanges.length;
        
        // Calculate average change percentage
        todayChanges.forEach(change => {
          if (change.change_percentage !== undefined) {
            totalChangePercentage += change.change_percentage;
            changeCount++;
          }
        });
      }
    });
    
    return {
      totalProducts,
      productsWithChanges,
      totalChangesToday,
      averageChangePercentage: changeCount > 0 ? totalChangePercentage / changeCount : 0
    };
    
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      totalProducts: 0,
      productsWithChanges: 0,
      totalChangesToday: 0,
      averageChangePercentage: 0
    };
  }
}

// Main execution
async function main() {
  try {
    await updatePriceHistory();
    console.log('\n🎉 Price history update completed successfully!');
  } catch (error) {
    console.error('Failed to update price history:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { updatePriceHistory, generatePriceHistorySummary }; 