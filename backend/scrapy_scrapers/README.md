# Smart Shopper ZA - Scrapy Integration

This module provides Scrapy-based web scrapers for Smart Shopper ZA. It offers improved robustness, scheduling, and data extraction capabilities compared to the original Node.js scrapers.

## Features

- Robust, production-ready web scraping with [Scrapy](https://scrapy.org/)
- Support for both static HTML sites and JavaScript-heavy sites (via Playwright)
- Automatic data validation and cleaning
- Direct database storage (SQLite, with PostgreSQL support coming soon)
- JSON export for backup and analysis
- API integration with the Node.js backend
- Configurable logging and error handling

## Spiders

The following spiders are available:

- `checkers` - Scrapes [Checkers](https://www.checkers.co.za/)
- `shoprite` - Scrapes [Shoprite](https://www.shoprite.co.za/)
- `picknpay` - Scrapes [Pick n Pay](https://www.pnp.co.za/) (uses Playwright for JavaScript rendering)

## Installation

1. Make sure you have Python 3.8+ installed
2. Install the required Python packages:

```bash
cd backend/scrapy_scrapers
pip install -r requirements.txt
```

3. For JavaScript-heavy sites, install Playwright:

```bash
playwright install chromium
```

## Usage

### From Python

```bash
cd backend/scrapy_scrapers
python run_spider.py --spider checkers --query "milk"
```

Available options:

- `--spider` or `-s`: Spider to run (`checkers`, `shoprite`, `picknpay`, or `all`)
- `--query` or `-q`: Search query
- `--output` or `-o`: Output file path
- `--format` or `-f`: Output format (`json`, `csv`, or `xml`)
- `--log-level` or `-l`: Log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`, or `CRITICAL`)

### From Node.js

```javascript
const { scrapeCheckersScrapy } = require('./scrapy_scrapers');

async function searchProducts() {
  const results = await scrapeCheckersScrapy('milk');
  console.log(results);
}

searchProducts();
```

## Configuration

The Scrapy settings can be configured in `smartshopper/settings.py`. Key settings include:

- `CONCURRENT_REQUESTS`: Maximum number of concurrent requests
- `DOWNLOAD_DELAY`: Delay between requests (in seconds)
- `HTTPCACHE_ENABLED`: Whether to cache HTTP responses
- `DATABASE_URL`: Database URL for storing scraped data
- `API_ENDPOINT`: API endpoint for posting data

## Environment Variables

- `USE_SCRAPY`: Set to `true` to use Scrapy instead of the original scrapers
- `DATABASE_URL`: Database URL for storing scraped data
- `API_ENDPOINT`: API endpoint for posting data
- `API_KEY`: API key for authentication
- `OUTPUT_DIR`: Directory for storing JSON output files

## Development

To add a new spider:

1. Create a new file in `smartshopper/spiders/`
2. Define a new spider class that inherits from `scrapy.Spider`
3. Implement the `parse` method to extract product data
4. Update `run_spider.py` to include the new spider

## License

This project is licensed under the MIT License. 