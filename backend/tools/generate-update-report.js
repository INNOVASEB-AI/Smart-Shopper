/**
 * Generate Update Report
 * 
 * This script generates detailed reports about the automated updates
 * for monitoring and analysis purposes.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../sa-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function generateUpdateReport() {
  console.log('📊 Generating update report...');
  
  try {
    const now = new Date();
    const report = {
      timestamp: now.toISOString(),
      summary: {},
      products: {},
      price_changes: {},
      retailers: {},
      errors: []
    };
    
    // Get product statistics
    const productsSnapshot = await db.collection('products').get();
    const products = productsSnapshot.docs.map(doc => doc.data());
    
    report.summary.total_products = products.length;
    report.summary.last_updated = now.toISOString();
    
    // Analyze by retailer
    const retailerStats = {};
    products.forEach(product => {
      const retailer = product.retailer || 'Unknown';
      if (!retailerStats[retailer]) {
        retailerStats[retailer] = {
          count: 0,
          total_value: 0,
          avg_price: 0,
          price_range: { min: Infinity, max: 0 }
        };
      }
      
      retailerStats[retailer].count++;
      if (product.price) {
        retailerStats[retailer].total_value += product.price;
        retailerStats[retailer].price_range.min = Math.min(retailerStats[retailer].price_range.min, product.price);
        retailerStats[retailer].price_range.max = Math.max(retailerStats[retailer].price_range.max, product.price);
      }
    });
    
    // Calculate averages
    Object.keys(retailerStats).forEach(retailer => {
      const stats = retailerStats[retailer];
      stats.avg_price = stats.count > 0 ? stats.total_value / stats.count : 0;
      if (stats.price_range.min === Infinity) {
        stats.price_range.min = 0;
      }
    });
    
    report.retailers = retailerStats;
    
    // Get price history statistics
    const historySnapshot = await db.collection('price_history').get();
    const historyRecords = historySnapshot.docs.map(doc => doc.data());
    
    report.summary.total_tracked_products = historyRecords.length;
    
    // Analyze price changes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let totalPriceChanges = 0;
    let totalPriceIncrease = 0;
    let totalPriceDecrease = 0;
    let productsWithChanges = 0;
    
    historyRecords.forEach(record => {
      if (record.price_changes > 0) {
        productsWithChanges++;
        totalPriceChanges += record.price_changes;
        
        // Check today's changes
        const todayChanges = record.price_history.filter(entry => {
          const entryDate = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
          return entryDate >= today;
        });
        
        todayChanges.forEach(change => {
          if (change.change > 0) {
            totalPriceIncrease += change.change;
          } else if (change.change < 0) {
            totalPriceDecrease += Math.abs(change.change);
          }
        });
      }
    });
    
    report.price_changes = {
      total_changes: totalPriceChanges,
      products_with_changes: productsWithChanges,
      today_increases: totalPriceIncrease,
      today_decreases: totalPriceDecrease,
      net_change: totalPriceIncrease - totalPriceDecrease
    };
    
    // Sample of recent products
    const recentProducts = products
      .sort((a, b) => {
        const aDate = a.updated_at?.toDate ? a.updated_at.toDate() : new Date(a.updated_at);
        const bDate = b.updated_at?.toDate ? b.updated_at.toDate() : new Date(b.updated_at);
        return bDate - aDate;
      })
      .slice(0, 10)
      .map(product => ({
        id: product.id,
        name: product.name || product.title,
        retailer: product.retailer,
        price: product.price,
        category: product.category
      }));
    
    report.products.recent = recentProducts;
    
    // Sample of price changes
    const recentPriceChanges = historyRecords
      .filter(record => record.price_changes > 0)
      .sort((a, b) => {
        const aDate = a.last_updated?.toDate ? a.last_updated.toDate() : new Date(a.last_updated);
        const bDate = b.last_updated?.toDate ? b.last_updated.toDate() : new Date(b.last_updated);
        return bDate - aDate;
      })
      .slice(0, 10)
      .map(record => ({
        product_id: record.product_id,
        product_name: record.product_name,
        retailer: record.retailer,
        current_price: record.current_price,
        price_changes: record.price_changes,
        lowest_price: record.lowest_price,
        highest_price: record.highest_price
      }));
    
    report.price_changes.recent = recentPriceChanges;
    
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Save detailed report
    const reportFile = path.join(reportsDir, `update-report-${now.toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Save summary report
    const summaryReport = {
      timestamp: report.timestamp,
      summary: report.summary,
      retailers: report.retailers,
      price_changes: report.price_changes
    };
    
    const summaryFile = path.join(reportsDir, `summary-${now.toISOString().split('T')[0]}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summaryReport, null, 2));
    
    console.log('📊 Report generated successfully!');
    console.log(`📁 Detailed report: ${reportFile}`);
    console.log(`📁 Summary report: ${summaryFile}`);
    
    // Print summary to console
    console.log('\n📈 Update Summary:');
    console.log(`Total products: ${report.summary.total_products}`);
    console.log(`Tracked products: ${report.summary.total_tracked_products}`);
    console.log(`Products with price changes: ${report.price_changes.products_with_changes}`);
    console.log(`Total price changes: ${report.price_changes.total_changes}`);
    
    console.log('\n🏪 Retailer Breakdown:');
    Object.entries(report.retailers).forEach(([retailer, stats]) => {
      console.log(`  ${retailer}: ${stats.count} products, avg R${stats.avg_price.toFixed(2)}`);
    });
    
    return report;
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await generateUpdateReport();
    console.log('\n🎉 Report generation completed successfully!');
  } catch (error) {
    console.error('Failed to generate report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateUpdateReport }; 