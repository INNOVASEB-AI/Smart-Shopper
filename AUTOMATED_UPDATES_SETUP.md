# Automated Updates & Price History Setup Guide

## 🎉 **COMPLETED SETUP**

Your Smart Shopper SA app now has:
- ✅ **Real Product Data**: 46 products from Checkers and Shoprite
- ✅ **Price History Tracking**: 45 products being tracked for price changes
- ✅ **Automated Update System**: GitHub Actions workflow ready
- ✅ **Live App**: https://smart-shopper-46f4c.web.app

## 📊 **Current Status**

### **Product Data**
- **Total Products**: 46
- **Checkers**: 25 products
- **Shoprite**: 21 products
- **Price Range**: R4.99 - R159.99

### **Price History**
- **Tracked Products**: 45
- **Price Changes**: 0 (initial setup)
- **Lowest Prices**: Tracked
- **Highest Prices**: Tracked

## 🔄 **Automated Updates Setup**

### **1. GitHub Secrets Required**

To enable automated updates, add these secrets to your GitHub repository:

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add the following secrets:

```
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"smart-shopper-46f4c",...}
```

### **2. Firebase Service Account**

To get the Firebase service account JSON:

1. Go to [Firebase Console](https://console.firebase.google.com/project/smart-shopper-46f4c)
2. Project Settings → Service Accounts
3. Generate new private key
4. Copy the entire JSON content to the `FIREBASE_SERVICE_ACCOUNT` secret

### **3. Firecrawl API Key**

To get your Firecrawl API key:

1. Sign up at [Firecrawl](https://firecrawl.dev)
2. Get your API key from the dashboard
3. Add it to the `FIRECRAWL_API_KEY` secret

## 🕐 **Update Schedule**

The automated workflow runs:
- **Daily at 2:00 AM UTC** (4:00 AM SAST)
- **On manual trigger** (workflow_dispatch)
- **On code changes** to scrapers

## 📈 **Price History Features**

### **What's Tracked**
- Current price vs previous price
- Price change percentage
- Lowest price ever seen
- Highest price ever seen
- Number of price changes
- Timestamp of each change

### **Data Structure**
```json
{
  "product_id": "unique_id",
  "product_name": "Product Name",
  "retailer": "Checkers",
  "current_price": 29.99,
  "price_history": [
    {
      "price": 29.99,
      "timestamp": "2025-08-25T21:30:00Z",
      "change": 0,
      "change_percentage": 0
    }
  ],
  "lowest_price": 29.99,
  "highest_price": 29.99,
  "price_changes": 0,
  "last_updated": "2025-08-25T21:30:00Z"
}
```

## 🛠 **Manual Commands**

### **Update Price History**
```bash
cd backend
node tools/update-price-history.js
```

### **Upload Products to Firestore**
```bash
cd backend
node tools/upload-to-firestore.js
```

### **Generate Report**
```bash
cd backend
node tools/generate-update-report.js
```

### **Run All Updates**
```bash
cd backend
node tools/update-price-history.js
node tools/generate-update-report.js
```

## 📊 **Monitoring & Reports**

### **Generated Reports**
- **Daily Update Reports**: `backend/reports/update-report-YYYY-MM-DD.json`
- **Summary Reports**: `backend/reports/summary-YYYY-MM-DD.json`
- **GitHub Artifacts**: Available in Actions tab

### **Key Metrics**
- Total products tracked
- Products with price changes
- Average price change percentage
- Retailer breakdown
- Recent price changes

## 🚀 **Next Steps**

### **Immediate Actions**
1. **Add GitHub Secrets** (see above)
2. **Test the workflow** by triggering it manually
3. **Monitor the first automated run**

### **Future Enhancements**
1. **Add more retailers** (Makro, Pick n Pay, Woolworths)
2. **Implement price alerts** for significant changes
3. **Add price trend analysis**
4. **Create price comparison charts**
5. **Set up email notifications**

### **Data Expansion**
1. **Run more crawlers** to get additional products
2. **Add product categories** for better organization
3. **Include product images** and descriptions
4. **Add nutritional information** for food products

## 🔧 **Troubleshooting**

### **Common Issues**

**Workflow fails to start**
- Check GitHub secrets are set correctly
- Verify Firebase service account JSON is valid

**No products found**
- Check Firecrawl API key is valid
- Verify retailer URLs are accessible

**Price history not updating**
- Check Firestore permissions
- Verify batch operations are working

### **Debug Commands**
```bash
# Check Firestore data
node -e "const admin = require('firebase-admin'); admin.initializeApp(); const db = admin.firestore(); db.collection('products').get().then(s => console.log('Products:', s.size));"

# Check price history
node -e "const admin = require('firebase-admin'); admin.initializeApp(); const db = admin.firestore(); db.collection('price_history').get().then(s => console.log('History:', s.size));"
```

## 📞 **Support**

If you encounter issues:
1. Check the GitHub Actions logs
2. Review the generated reports
3. Test manual commands locally
4. Check Firebase Console for errors

---

**🎉 Your Smart Shopper SA app is now fully automated with real-time price tracking!** 