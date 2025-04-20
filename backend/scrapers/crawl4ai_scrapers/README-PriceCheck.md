# PriceCheck Sequential Crawler

This folder contains a sequential crawler for PriceCheck.co.za that fetches product data from URLs extracted from the site's sitemap. The crawler processes URLs sequentially within the same browser session for better efficiency.

## Implementation Details

The crawler consists of:

1. **Python Script**: `pricecheck_sequential_crawler.py` - The main crawler implementation that:
   - Fetches and parses the PriceCheck sitemap
   - Extracts product URLs
   - Uses crawl4ai to crawl these URLs sequentially
   - Saves product data as JSON files

2. **Node.js Example**: `pricecheck_sequential_example.js` - A JavaScript wrapper that:
   - Demonstrates how to invoke the Python crawler from Node.js
   - Processes and displays the crawler results
   - Can be integrated into larger applications

## Requirements

### Python Dependencies

- Python 3.8+
- requests
- beautifulsoup4
- lxml
- selenium
- webdriver-manager
- crawl4ai

### Node.js Dependencies (for the example)

- Node.js 14+
- fs (built-in)
- path (built-in)
- child_process (built-in)

## Usage

### Running the Python Script Directly

```bash
python pricecheck_sequential_crawler.py \
  --output-dir /path/to/output/directory \
  --max-urls 50
```

### Options

- `--output-dir`: Directory to save the crawled data (default: `./data/pricecheck_sequential`)
- `--max-urls`: Maximum number of URLs to crawl (default: 100, use 0 for unlimited)
- `--log-level`: Logging level (default: INFO)

### Running via Node.js

```bash
node pricecheck_sequential_example.js
```

The Node.js example uses default settings (20 URLs) but can be modified or imported into other modules:

```javascript
const { runSequentialCrawler } = require('./pricecheck_sequential_example');

async function customCrawl() {
  const result = await runSequentialCrawler({
    outputDir: './custom/output/path',
    maxUrls: 50,
    pythonPath: 'python3'  // Use python3 if needed
  });
  
  // Process results
  console.log(`Crawler processed ${result.summary.urls_processed} URLs`);
}
```

## Output Structure

The crawler creates a structured output directory:

```
/output-dir/
  ├── run_YYYYMMDD_HHMMSS/      # Timestamped run folder
  │   ├── product_1.json        # Individual product data
  │   ├── product_2.json
  │   ├── ...
  │   ├── summary.json          # Run summary statistics
  │   └── crawler.log           # Detailed log file
  └── ...                       # Previous runs
```

### Product Data Format

Each product JSON file contains:

```json
{
  "url": "https://www.pricecheck.co.za/...",
  "title": "Product Title",
  "description": "Product description...",
  "price": {
    "current": 1299.99,
    "original": 1499.99
  },
  "brand": "Brand Name",
  "category": "Category Path",
  "images": ["https://...", ...],
  "specifications": {
    "spec1": "value1",
    "spec2": "value2"
  },
  "merchants": [
    {
      "name": "Merchant Name",
      "price": 1299.99,
      "url": "https://..."
    },
    ...
  ],
  "crawl_time": "2023-06-29T12:34:56"
}
```

## Notes

- The crawler handles rate limiting by using controlled sequential requests
- It maintains the same browser session for efficiency
- Error handling and logging are built-in
- Each run is isolated in its own directory with timestamped naming

## Integration with Crawl4ai

This crawler demonstrates how to use crawl4ai for sequential crawling. The key implementation details include:

1. Using a single browser session for all requests
2. Managing cookies and session state between requests
3. Implementing error recovery and retry logic
4. Extracting structured data from each product page 