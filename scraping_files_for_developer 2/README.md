# Smart Shopper ZA - Scraping Infrastructure

This directory contains all the scraping files for the Smart Shopper ZA application. The scraping system is designed to crawl South African retail websites to collect product pricing and availability data.

## 🎯 **Priority Files for Improvements**

### **Most Critical (Focus Here First)**
1. **`backend/scrapers/crawl4ai_scrapers/sequential_crawler.py`** - Advanced sequential crawler using crawl4ai
2. **`backend/scrapers/crawl4ai_scrapers/base_crawler.py`** - Base crawler class for all retailers
3. **`backend/scrapers/crawl4ai_scrapers/retailers_config.py`** - Configuration system for retailers
4. **`backend/scrapers/crawl4ai_scrapers/database.py`** - Data storage and management

### **Secondary Priority**
5. Individual retailer scrapers (scrapeCheckers.js, scrapeShoprite.js, etc.)
6. Helper files (httpScraperHelper.js, puppeteerScraperHelper.js)
7. API integration files

## 📁 **File Structure**

```
scraping_files_for_developer/
├── README.md                                    # This file
├── backend/
│   ├── scrapers/
│   │   ├── index.js                            # Main scraper exports
│   │   ├── scrapeCheckers.js                   # Checkers scraper
│   │   ├── scrapeShoprite.js                   # Shoprite scraper
│   │   ├── scrapePicknPay.js                   # Pick n Pay scraper
│   │   ├── scrapeMakro.js                      # Makro scraper
│   │   ├── scrapeWoolworths.js                 # Woolworths scraper
│   │   ├── httpScraperHelper.js                # HTTP scraping utilities
│   │   ├── puppeteerScraperHelper.js           # Puppeteer browser automation
│   │   ├── browserManager.js                   # Browser session management
│   │   ├── browserHeaders.js                   # Browser headers configuration
│   │   └── crawl4ai_scrapers/                  # Advanced crawl4ai scrapers
│   │       ├── sequential_crawler.py           # 🎯 MAIN CRAWLER
│   │       ├── sequential_crawler.js           # Node.js interface
│   │       ├── base_crawler.py                 # 🎯 Base crawler class
│   │       ├── pricecheck_crawler.py           # PriceCheck specific crawler
│   │       ├── checkers_crawler.py             # Checkers crawler
│   │       ├── retailers_config.py             # 🎯 Retailer configurations
│   │       ├── database.py                     # 🎯 Database operations
│   │       ├── scheduler.py                    # Crawling scheduler
│   │       ├── requirements.txt                # Python dependencies
│   │       ├── README.md                       # Setup instructions
│   │       └── SEQUENTIAL_CRAWLER.md           # Detailed documentation
│   └── routes/
│       └── api/
│           ├── crawler.js                      # Crawler API endpoints
│           └── search.js                       # Search API integration
```

## 🚀 **Key Areas for Improvement**

### **1. Success Rate Improvements**
- **Anti-detection mechanisms**: Enhance stealth mode and rate limiting
- **Error handling**: Better retry logic and fallback strategies
- **Proxy rotation**: Implement proxy pools to avoid IP blocking
- **User agent rotation**: Randomize browser fingerprints

### **2. Performance Optimizations**
- **Concurrent crawling**: Implement parallel processing while respecting rate limits
- **Caching**: Cache successful requests and avoid re-scraping unchanged content
- **Resource management**: Better memory and CPU usage optimization
- **Database indexing**: Optimize data storage and retrieval

### **3. Data Quality Enhancements**
- **Data validation**: Ensure scraped data is accurate and complete
- **Price history tracking**: Track price changes over time
- **Product matching**: Better product identification across retailers
- **Category classification**: Improve product categorization

### **4. Scalability**
- **Distributed crawling**: Support for multiple crawler instances
- **Queue management**: Implement job queues for large-scale crawling
- **Monitoring**: Real-time crawler health monitoring
- **Alerting**: Notifications for crawler failures or data anomalies

## 🛠 **Current Technology Stack**

- **Node.js**: Main application and basic scrapers
- **Python**: Advanced crawl4ai scrapers
- **Puppeteer**: Browser automation for JavaScript-heavy sites
- **crawl4ai**: Advanced web crawling library
- **Firestore**: Data storage (referenced in database.py)

## 📋 **Setup Instructions**

1. **Install Node.js dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Install Python dependencies**:
   ```bash
   cd backend/scrapers/crawl4ai_scrapers
   pip install -r requirements.txt
   python -m crawl4ai.cli.setup
   ```

3. **Configure retailers**:
   Edit `backend/scrapers/crawl4ai_scrapers/retailers_config.py` to add new retailers or modify existing ones.

## 🎯 **Success Metrics to Track**

- **Success rate**: Percentage of successful scrapes vs. failures
- **Data completeness**: Percentage of products with complete information
- **Crawl speed**: Products scraped per minute
- **Error rates**: Types and frequency of errors
- **Blocking incidents**: How often scrapers get blocked

## 💡 **Development Tips**

1. **Start with the sequential crawler**: It's the most sophisticated and has the best foundation
2. **Test with small batches**: Always test with limited URLs first
3. **Monitor rate limits**: Respect each retailer's terms of service
4. **Use logging**: The system has comprehensive logging - use it for debugging
5. **Incremental improvements**: Focus on one retailer or one aspect at a time

## 🔧 **Common Issues to Address**

- **CAPTCHA challenges**: Implement CAPTCHA solving or avoidance
- **Dynamic content**: Handle JavaScript-rendered content better
- **Site structure changes**: Make scrapers more resilient to HTML changes
- **Session management**: Better handling of login sessions and cookies
- **Data consistency**: Ensure consistent data format across all scrapers

Good luck with the improvements! The foundation is solid, and there's plenty of room for optimization and enhancement. 