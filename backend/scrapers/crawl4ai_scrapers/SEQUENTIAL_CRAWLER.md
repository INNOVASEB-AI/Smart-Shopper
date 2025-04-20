# Sequential Crawler for PriceCheck.co.za

This module provides a sequential web crawler for PriceCheck.co.za that maintains a single browser session while crawling URLs from the sitemap. It uses the `crawl4ai` library's advanced features to handle browser automation, content extraction, and rate limiting.

## Features

- **Sitemap-based Crawling**: Automatically extracts URLs from the PriceCheck.co.za sitemap
- **Sequential Processing**: Crawls URLs one by one using a persistent browser session
- **Intelligent Content Extraction**: Uses different extraction schemas based on page type
- **Anti-Detection Mechanisms**: Employs stealth mode and rate limiting to avoid being blocked
- **Progress Monitoring**: Real-time monitoring of crawl progress
- **Result Storage**: Saves structured data in an organized directory structure
- **REST API**: Exposes crawler operations through a REST API

## Architecture

The sequential crawler consists of the following components:

1. **Python Crawler** (`sequential_crawler.py`): The core crawler implementation that handles:
   - Sitemap parsing
   - URL classification
   - Browser automation
   - Content extraction
   - Rate limiting
   - Result storage

2. **Node.js Interface** (`sequential_crawler.js`): A wrapper around the Python crawler that provides:
   - Starting crawl operations
   - Checking crawl status
   - Retrieving crawl results

3. **REST API** (`routes/api/crawler.js`): A set of API endpoints that expose the crawler functionality:
   - POST `/api/crawler/start`: Start a new crawl
   - GET `/api/crawler/status`: Check crawl status
   - GET `/api/crawler/results`: Retrieve crawl results

## Setup

1. Install Python dependencies:
   ```bash
   cd backend/scrapers/crawl4ai_scrapers
   pip install -r requirements.txt
   ```

2. Set up crawl4ai browser automation:
   ```bash
   python -m crawl4ai.cli.setup
   ```

## Usage

### Command Line

You can run the sequential crawler directly from the command line:

```bash
# Run with default settings (50 URLs)
python sequential_crawler.py

# Run with custom settings
python sequential_crawler.py --max-urls 100 --output-dir ./custom_results
```

### Node.js

You can use the Node.js interface in your application:

```javascript
const { 
  startSequentialCrawl, 
  getSequentialCrawlStatus, 
  getSequentialCrawlResults 
} = require('./sequential_crawler');

// Start a crawl
const result = await startSequentialCrawl({
  maxUrls: 100,
  outputDir: './custom_results',
  detached: true  // Run in background
});

// Check status
const status = await getSequentialCrawlStatus({
  outputDir: './custom_results'
});

// Get results
const results = await getSequentialCrawlResults({
  category: 'electronics',
  limit: 10,
  outputDir: './custom_results'
});
```

### REST API

You can use the REST API to control the crawler from your application:

```
# Start a crawl
POST /api/crawler/start
{
  "maxUrls": 100,
  "outputDir": "./custom_results",
  "detached": true
}

# Check status
GET /api/crawler/status?outputDir=./custom_results

# Get results
GET /api/crawler/results?limit=10&category=electronics&outputDir=./custom_results
```

## Configuration

### Browser Options

The crawler uses a headless browser with the following configuration:

```javascript
browser_config = BrowserConfig(
    headless=True,
    stealth_mode=True,
    verbose=False,
    timeout=60000,
    use_persistent_context=True
)
```

### Rate Limiter

To avoid being blocked, the crawler uses a rate limiter:

```javascript
rate_limiter = RateLimiter(
    base_delay=(2.0, 5.0),  // Random delay between 2-5 seconds
    max_delay=30.0,         // Maximum delay on rate-limit errors
    max_retries=3,          // Maximum number of retries
    rate_limit_codes=[429, 503, 403]  // Status codes to consider as rate-limiting
)
```

### Dispatchers

The crawler uses a `SemaphoreDispatcher` with `max_session_permit=1` to ensure sequential processing:

```javascript
dispatcher = SemaphoreDispatcher(
    max_session_permit=1,  // Only one request at a time
    rate_limiter=rate_limiter,
    monitor=monitor
)
```

## Extraction Schemas

The crawler uses different extraction schemas based on the page type:

### Product Pages

For product pages (URLs containing `/offers/`), the crawler uses a detailed schema to extract:

- Title
- Price
- Description
- Image URL
- Specifications
- Store listings with prices

### Category Pages

For category pages, the crawler extracts:

- Product name
- Price
- Image URL
- Product link

### General Pages

For general pages, the crawler extracts the raw markdown content.

## Data Storage

The crawler stores results in a directory structure that mirrors the URL path:

```
data/
  pricecheck_results/
    offers/
      product1.json
      product2.json
    category1/
      subcategory/
        product3.json
    category2/
      product4.json
```

Each JSON file contains:

- URL
- Crawl timestamp
- Success status
- Extracted data or markdown content

## Error Handling

The crawler includes robust error handling for:

- Network errors
- Timeouts
- Rate limiting
- Content extraction failures

## Testing

You can test the sequential crawler using the included test script:

```bash
# Start a test crawl
node test_sequential_crawler.js --start --max-urls=10

# Check status
node test_sequential_crawler.js --status

# Get results
node test_sequential_crawler.js --results --limit=5
``` 