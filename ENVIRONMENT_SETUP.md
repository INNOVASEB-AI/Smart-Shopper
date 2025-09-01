# Environment Setup Guide - Smart Shopper SA

## 🎯 **Quick Start**

### **1. Run the Setup Script**
```bash
cd backend
npm run setup
```

This interactive script will guide you through configuring all environment variables.

### **2. Validate Configuration**
```bash
npm run validate
```

This will check your configuration and show the status of all data sources.

## 🔧 **Manual Configuration**

If you prefer to configure manually, follow these steps:

### **Step 1: Create Environment File**
```bash
cd backend
cp config/env.example .env
```

### **Step 2: Configure Firebase**

1. **Get Firebase Configuration**:
   - Go to [Firebase Console](https://console.firebase.google.com/project/smart-shopper-46f4c)
   - Project Settings → General → Your apps
   - Copy the configuration values

2. **Get Service Account Key**:
   - Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

3. **Update .env**:
```env
FIREBASE_PROJECT_ID=smart-shopper-46f4c
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=smart-shopper-46f4c.firebaseapp.com
FIREBASE_STORAGE_BUCKET=smart-shopper-46f4c.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=227443313787
FIREBASE_APP_ID=1:227443313787:web:f7d0fb52c88e14254966de
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"smart-shopper-46f4c",...}
```

### **Step 3: Configure Firecrawl (Optional)**

1. **Get Firecrawl API Key**:
   - Sign up at [Firecrawl](https://firecrawl.dev)
   - Get your API key from the dashboard

2. **Update .env**:
```env
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### **Step 4: Configure Data Sources**

```env
# Enable/disable data sources
USE_FIREBASE=true
USE_DATABASE=true
USE_JSON=false
USE_FIRECRAWL=true

# Database path
DATABASE_PATH=./scrapers/crawl4ai_scrapers/data/products.db

# Price history
ENABLE_PRICE_HISTORY=true
```

## 📊 **Data Source Configuration**

### **Firebase/Firestore** ✅ **RECOMMENDED**
- **Primary data source** for production
- **Real-time updates** and synchronization
- **Scalable** and reliable
- **Requires**: Firebase project setup

### **SQLite Database** ✅ **ENABLED**
- **Local data storage** for development
- **Fast queries** and indexing
- **Backup data source**
- **Requires**: Database file path

### **JSON Files** ❌ **DISABLED**
- **Fallback data source**
- **Static data** from crawlers
- **Development only**
- **Requires**: JSON file path

### **Firecrawl** ⚠️ **OPTIONAL**
- **Web scraping** for new data
- **Automated updates**
- **Requires**: API key and rate limits

## 🔍 **Configuration Validation**

### **Run Validation**
```bash
npm run validate
```

### **Expected Output**
```
🔍 Smart Shopper SA - Configuration Validation

📋 Environment Variables:
✅ Required Variables:
  ✅ FIREBASE_PROJECT_ID: smart-shopper-46f4c
  ✅ FIREBASE_API_KEY: AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4
  ✅ USE_FIREBASE: true
  ✅ USE_DATABASE: true
  ✅ USE_FIRECRAWL: true

📊 Data Source Status:
  FIREBASE:
    Enabled: ✅
    Configured: ✅
  DATABASE:
    Enabled: ✅
    Path: /path/to/database.db
  JSON:
    Enabled: ❌
  FIRECRAWL:
    Enabled: ✅
    Configured: ✅

🔥 Testing Firebase Connection...
  ✅ Firebase connected successfully
  📊 Products collection: 46 documents found
  📈 Price history collection: 45 documents found

✅ Configuration is valid!
```

## 🚀 **Available Scripts**

### **Setup & Configuration**
```bash
npm run setup          # Interactive environment setup
npm run validate       # Validate configuration
```

### **Data Management**
```bash
npm run upload-firestore    # Upload products to Firestore
npm run update-history      # Update price history
npm run generate-report     # Generate update report
```

### **Development**
```bash
npm start              # Start production server
npm run dev            # Start development server
npm test               # Run tests
```

## 🔐 **Security Best Practices**

### **Environment Variables**
- ✅ **Never commit** `.env` files to version control
- ✅ **Use strong secrets** for production
- ✅ **Rotate API keys** regularly
- ✅ **Limit access** to service accounts

### **Firebase Security**
- ✅ **Enable App Check** for additional security
- ✅ **Configure Firestore rules** properly
- ✅ **Use service accounts** for backend operations
- ✅ **Monitor usage** and costs

### **API Security**
- ✅ **Rate limiting** to prevent abuse
- ✅ **Input validation** for all endpoints
- ✅ **CORS configuration** for allowed origins
- ✅ **Error handling** without exposing internals

## 🛠 **Troubleshooting**

### **Common Issues**

**Firebase Connection Failed**
```bash
# Check service account
npm run validate

# Verify Firebase project
firebase projects:list
```

**Database Not Found**
```bash
# Check database path
ls -la ./scrapers/crawl4ai_scrapers/data/

# Create database if missing
mkdir -p ./scrapers/crawl4ai_scrapers/data/
```

**Environment Variables Not Loading**
```bash
# Check .env file exists
ls -la .env

# Verify dotenv is installed
npm list dotenv
```

**Configuration Validation Fails**
```bash
# Check required variables
npm run validate

# Review error messages
cat .env | grep -E "(FIREBASE|FIRECRAWL)"
```

### **Debug Commands**
```bash
# Check environment variables
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# Test Firebase connection
node -e "const admin = require('firebase-admin'); admin.initializeApp(); console.log('Connected')"

# Check database
node -e "const sqlite3 = require('sqlite3'); new sqlite3.Database('./scrapers/crawl4ai_scrapers/data/products.db')"
```

## 📋 **Environment Variables Reference**

### **Required Variables**
| Variable | Description | Example |
|----------|-------------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project ID | `smart-shopper-46f4c` |
| `FIREBASE_API_KEY` | Firebase web API key | `AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4` |
| `USE_FIREBASE` | Enable Firebase | `true` |
| `USE_DATABASE` | Enable SQLite | `true` |
| `USE_FIRECRAWL` | Enable Firecrawl | `true` |

### **Optional Variables**
| Variable | Description | Default |
|----------|-------------|---------|
| `FIRECRAWL_API_KEY` | Firecrawl API key | `undefined` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `ENABLE_PRICE_HISTORY` | Price tracking | `true` |
| `JWT_SECRET` | JWT secret | `your-jwt-secret-change-this-in-production` |

### **Advanced Variables**
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database path | `./scrapers/crawl4ai_scrapers/data/products.db` |
| `MAX_PRODUCTS_PER_RETAILER` | Max products per crawl | `200` |
| `CRAWL_DELAY` | Delay between requests | `1` |
| `PRICE_CHANGE_THRESHOLD` | Price change alert % | `5.0` |

## 🎉 **Next Steps**

After configuring your environment:

1. **Test the setup**: `npm run validate`
2. **Start the server**: `npm start`
3. **Upload data**: `npm run upload-firestore`
4. **Enable automation**: See `AUTOMATED_UPDATES_SETUP.md`

---

**✅ Your Smart Shopper SA app is now properly configured with all data sources!** 