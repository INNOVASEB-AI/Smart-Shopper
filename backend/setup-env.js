#!/usr/bin/env node

/**
 * Environment Setup Script for Smart Shopper SA
 * 
 * This script helps configure environment variables and validates the setup
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnvironment() {
  console.log('🔧 Smart Shopper SA - Environment Setup\n');
  console.log('This script will help you configure your environment variables.\n');

  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, 'config/env.example');

  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log('📋 Let\'s configure your environment variables:\n');

  // Read the example file
  const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
  let envContent = exampleContent;

  // Firebase Configuration
  console.log('🔥 FIREBASE CONFIGURATION');
  console.log('Get these values from: https://console.firebase.google.com/project/smart-shopper-46f4c\n');

  const firebaseProjectId = await question('Firebase Project ID (default: smart-shopper-46f4c): ') || 'smart-shopper-46f4c';
  envContent = envContent.replace('FIREBASE_PROJECT_ID=smart-shopper-46f4c', `FIREBASE_PROJECT_ID=${firebaseProjectId}`);

  const firebaseApiKey = await question('Firebase API Key (default: AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4): ') || 'AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4';
  envContent = envContent.replace('FIREBASE_API_KEY=AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4', `FIREBASE_API_KEY=${firebaseApiKey}`);

  console.log('\n📄 FIREBASE SERVICE ACCOUNT');
  console.log('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.log('2. Click "Generate new private key"');
  console.log('3. Copy the entire JSON content\n');

  const serviceAccountPath = await question('Path to service account JSON file (or paste JSON content): ');
  let serviceAccountJson = '';

  if (serviceAccountPath.endsWith('.json')) {
    // It's a file path
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
    } else {
      console.log('❌ File not found. Please provide a valid path.');
      rl.close();
      return;
    }
  } else {
    // It's JSON content
    serviceAccountJson = serviceAccountPath;
  }

  // Validate JSON
  try {
    JSON.parse(serviceAccountJson);
    envContent = envContent.replace('FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"smart-shopper-46f4c",...}', `FIREBASE_SERVICE_ACCOUNT=${JSON.stringify(serviceAccountJson)}`);
  } catch (error) {
    console.log('❌ Invalid JSON. Please provide valid service account JSON.');
    rl.close();
    return;
  }

  // Firecrawl Configuration
  console.log('\n🕷️  FIRECRAWL CONFIGURATION');
  console.log('Get your API key from: https://firecrawl.dev\n');

  const firecrawlApiKey = await question('Firecrawl API Key (optional, press Enter to skip): ');
  if (firecrawlApiKey) {
    envContent = envContent.replace('FIRECRAWL_API_KEY=your_firecrawl_api_key_here', `FIRECRAWL_API_KEY=${firecrawlApiKey}`);
  }

  // Data Source Configuration
  console.log('\n📊 DATA SOURCE CONFIGURATION');
  
  const useFirebase = await question('Enable Firebase/Firestore? (Y/n): ') || 'Y';
  envContent = envContent.replace('USE_FIREBASE=true', `USE_FIREBASE=${useFirebase.toLowerCase() === 'y'}`);

  const useDatabase = await question('Enable SQLite Database? (Y/n): ') || 'Y';
  envContent = envContent.replace('USE_DATABASE=true', `USE_DATABASE=${useDatabase.toLowerCase() === 'y'}`);

  const useFirecrawl = await question('Enable Firecrawl scraping? (Y/n): ') || 'Y';
  envContent = envContent.replace('USE_FIRECRAWL=true', `USE_FIRECRAWL=${useFirecrawl.toLowerCase() === 'y'}`);

  // Application Configuration
  console.log('\n⚙️  APPLICATION CONFIGURATION');
  
  const port = await question('Server port (default: 3001): ') || '3001';
  envContent = envContent.replace('PORT=3001', `PORT=${port}`);

  const environment = await question('Environment (development/production, default: development): ') || 'development';
  envContent = envContent.replace('NODE_ENV=development', `NODE_ENV=${environment}`);

  // Price History Configuration
  console.log('\n📈 PRICE HISTORY CONFIGURATION');
  
  const enablePriceHistory = await question('Enable price history tracking? (Y/n): ') || 'Y';
  envContent = envContent.replace('ENABLE_PRICE_HISTORY=true', `ENABLE_PRICE_HISTORY=${enablePriceHistory.toLowerCase() === 'y'}`);

  // Write the .env file
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Environment configuration saved to .env');

  // Validate configuration
  console.log('\n🔍 Validating configuration...');
  try {
    require('./config.js').validateConfig();
    console.log('✅ Configuration is valid!');
  } catch (error) {
    console.log('❌ Configuration validation failed:', error.message);
  }

  // Show next steps
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Review your .env file: cat .env');
  console.log('2. Test the configuration: node -e "console.log(require(\'./config.js\').getDataSourceStatus())"');
  console.log('3. Start the server: npm start');
  console.log('4. For automated updates, add GitHub secrets (see AUTOMATED_UPDATES_SETUP.md)');

  rl.close();
}

// Run the setup
setupEnvironment().catch(console.error); 