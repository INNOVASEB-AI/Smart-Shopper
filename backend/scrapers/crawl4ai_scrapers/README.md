# Crawl4AI Scrapers for Smart Shopper ZA

This directory contains scrapers implemented using [crawl4ai](https://github.com/unclecode/crawl4ai), an open-source web crawling and scraping library optimized for LLMs and structured data extraction.

## Features

- **Advanced Browser Automation**: Uses Playwright through crawl4ai for more reliable scraping
- **Bot Detection Avoidance**: Stealth mode to bypass anti-scraping measures
- **Structured Data Extraction**: Schema-based extraction of product data
- **Easy to Extend**: Add more retailers by following the pattern in existing scrapers

## Setup

Before you can use these scrapers, you need to set up the Python environment:

1. Make sure you have Python 3.8+ installed
2. Run the setup script:

```bash
cd backend/scrapers/crawl4ai_scrapers
chmod +x setup.sh  # Make sure the script is executable
./setup.sh
```

This will create a Python virtual environment, install all necessary dependencies, and set up crawl4ai.

## Available Scrapers

Currently, the following scrapers are implemented:

- **PriceCheck**: Scrapes product data from PriceCheck.co.za

## Adding New Scrapers

To add a new retailer scraper:

1. Create a new Python file in this directory (e.g., `scrape_takealot.py`)
2. Follow the pattern in `scrape_pricecheck.py`
3. Update the schema in the new file to match the HTML structure of the retailer's website
4. Export the scraper function in `index.js`
5. Import the new scraper in the main `backend/scrapers/index.js` file

## Testing

Each scraper can be tested individually:

```bash
# Activate the virtual environment first
source venv/bin/activate

# Test the Python script directly
python scrape_pricecheck.py "coffee"

# Or test through the Node.js interface
cd ..  # Go back to the scrapers directory
node crawl4ai_scrapers/test_pricecheck.js "coffee"
```

## Integration with the Main Application

The scrapers are integrated into the main application through the search API. When a user searches for products, the new PriceCheck scraper will run alongside the existing scrapers.

## Troubleshooting

- **"Module not found" errors**: Make sure you've run the setup script and activated the virtual environment
- **Browser launch failures**: Try updating Playwright with `python -m playwright install --with-deps`
- **Scraper returning empty results**: The website structure might have changed; check the selectors in the scraper's schema

## Why Crawl4AI?

Crawl4AI provides several advantages over traditional scraping approaches:

1. Better handling of modern websites with JavaScript and anti-bot measures
2. Structured data extraction using CSS selectors
3. Active development and community support
4. Intelligent handling of content loading (scrolling, waiting for elements)
5. Memory-adaptive concurrency that prevents crashes on large datasets 