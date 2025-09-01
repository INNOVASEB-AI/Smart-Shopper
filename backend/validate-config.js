#!/usr/bin/env node

/**
 * Configuration Validation Script for Smart Shopper SA
 * 
 * This script validates the current configuration and shows the status of all data sources
 */

const config = require('./config.js');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function validateConfiguration() {
  console.log('🔍 Smart Shopper SA - Configuration Validation\n');

  // =============================================================================
  // ENVIRONMENT CHECK
  // =============================================================================
  console.log('📋 Environment Variables:');
  
  const requiredVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_API_KEY',
    'USE_FIREBASE',
    'USE_DATABASE',
    'USE_FIRECRAWL'
  ];

  const optionalVars = [
    'FIRECRAWL_API_KEY',
    'PORT',
    'NODE_ENV',
    'ENABLE_PRICE_HISTORY'
  ];

  console.log('\n✅ Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    console.log(`  ${status} ${varName}: ${value || 'NOT SET'}`);
  });

  console.log('\n📝 Optional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅' : '⚠️';
    console.log(`  ${status} ${varName}: ${value || 'NOT SET'}`);
  });

  // =============================================================================
  // DATA SOURCE STATUS
  // =============================================================================
  console.log('\n📊 Data Source Status:');
  const dataSourceStatus = config.getDataSourceStatus();
  
  Object.entries(dataSourceStatus).forEach(([source, status]) => {
    const enabled = status.enabled ? '✅' : '❌';
    const configured = status.configured !== undefined ? (status.configured ? '✅' : '❌') : 'N/A';
    console.log(`  ${source.toUpperCase()}:`);
    console.log(`    Enabled: ${enabled}`);
    console.log(`    Configured: ${configured}`);
    if (status.path) {
      console.log(`    Path: ${status.path}`);
    }
  });

  // =============================================================================
  // FIREBASE CONNECTION TEST
  // =============================================================================
  if (config.dataSources.useFirebase && config.firebase.serviceAccount) {
    console.log('\n🔥 Testing Firebase Connection...');
    try {
      admin.initializeApp({
        credential: admin.credential.cert(config.firebase.serviceAccount)
      });
      
      const db = admin.firestore();
      const productsSnapshot = await db.collection('products').limit(1).get();
      console.log(`  ✅ Firebase connected successfully`);
      console.log(`  📊 Products collection: ${productsSnapshot.size} documents found`);
      
      const historySnapshot = await db.collection('price_history').limit(1).get();
      console.log(`  📈 Price history collection: ${historySnapshot.size} documents found`);
      
    } catch (error) {
      console.log(`  ❌ Firebase connection failed: ${error.message}`);
    }
  }

  // =============================================================================
  // DATABASE FILE CHECK
  // =============================================================================
  if (config.dataSources.useDatabase) {
    console.log('\n🗄️  Database File Check:');
    const dbPath = config.dataSources.databasePath;
    const dbExists = fs.existsSync(dbPath);
    const status = dbExists ? '✅' : '❌';
    console.log(`  ${status} Database file: ${dbPath}`);
    
    if (dbExists) {
      const stats = fs.statSync(dbPath);
      console.log(`  📏 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`  📅 Last modified: ${stats.mtime.toISOString()}`);
    }
  }

  // =============================================================================
  // JSON DATA FILE CHECK
  // =============================================================================
  if (config.dataSources.useJson) {
    console.log('\n📄 JSON Data File Check:');
    const jsonPath = config.dataSources.jsonDataPath;
    const jsonExists = fs.existsSync(jsonPath);
    const status = jsonExists ? '✅' : '❌';
    console.log(`  ${status} JSON file: ${jsonPath}`);
    
    if (jsonExists) {
      const stats = fs.statSync(jsonPath);
      console.log(`  📏 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`  📅 Last modified: ${stats.mtime.toISOString()}`);
    }
  }

  // =============================================================================
  // RETAILER CONFIGURATION
  // =============================================================================
  console.log('\n🏪 Retailer Configuration:');
  const enabledRetailers = config.getEnabledRetailers();
  enabledRetailers.forEach(retailer => {
    console.log(`  ✅ ${retailer.name}: ${retailer.url}`);
  });

  // =============================================================================
  // CONFIGURATION VALIDATION
  // =============================================================================
  console.log('\n🔍 Configuration Validation:');
  try {
    config.validateConfig();
    console.log('  ✅ Configuration is valid!');
  } catch (error) {
    console.log(`  ❌ Configuration validation failed: ${error.message}`);
  }

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('\n📋 Configuration Summary:');
  
  const totalDataSources = Object.values(dataSourceStatus).filter(s => s.enabled).length;
  const configuredDataSources = Object.values(dataSourceStatus).filter(s => s.enabled && s.configured !== false).length;
  
  console.log(`  📊 Data Sources: ${configuredDataSources}/${totalDataSources} configured`);
  console.log(`  🏪 Retailers: ${enabledRetailers.length} enabled`);
  console.log(`  📈 Price History: ${config.priceHistory.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`  🌍 Environment: ${config.app.environment}`);
  console.log(`  🚀 Port: ${config.app.port}`);

  // =============================================================================
  // RECOMMENDATIONS
  // =============================================================================
  console.log('\n💡 Recommendations:');
  
  if (!config.firecrawl.apiKey && config.dataSources.useFirecrawl) {
    console.log('  🔑 Add FIRECRAWL_API_KEY to enable web scraping');
  }
  
  if (!config.firebase.serviceAccount && config.dataSources.useFirebase) {
    console.log('  🔑 Add FIREBASE_SERVICE_ACCOUNT to enable Firestore operations');
  }
  
  if (config.app.environment === 'development') {
    console.log('  🛡️  Consider setting NODE_ENV=production for production deployment');
  }
  
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-jwt-secret-change-this-in-production') {
    console.log('  🔐 Set a secure JWT_SECRET for authentication');
  }

  console.log('\n✅ Configuration validation complete!');
}

// Run validation
validateConfiguration().catch(console.error); 