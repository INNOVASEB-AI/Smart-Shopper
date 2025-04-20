"""
PriceCheck.co.za Scraper using crawl4ai
This script provides functionality to scrape product data from PriceCheck.co.za
"""

import asyncio
import json
import os
import sys
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
from pathlib import Path
from urllib.parse import quote

# Add the parent directory to the path so we can import from the parent directory
sys.path.append(str(Path(__file__).parent.parent.parent))
from logger import logger

# Load crawl4ai
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

# Load environment variables from .env file
load_dotenv()

# Configuration for PriceCheck scraper
PRICECHECK_SCHEMA = {
    "name": "PriceCheck Products",
    "baseSelector": ".product-card",
    "fields": [
        {
            "name": "name",
            "selector": ".product-info h3.prod-title",
            "type": "text"
        },
        {
            "name": "price",
            "selector": ".price",
            "type": "text"
        },
        {
            "name": "image",
            "selector": ".image img",
            "type": "attribute",
            "attribute": "src"
        },
        {
            "name": "product_link",
            "selector": "a.product-card-link",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "store",
            "selector": ".shop-logo img",
            "type": "attribute",
            "attribute": "alt"
        },
        {
            "name": "rating",
            "selector": ".rating-value",
            "type": "text"
        }
    ]
}

async def scrape_pricecheck(query: str) -> List[Dict[str, Any]]:
    """
    Scrape PriceCheck website for products matching the given query
    
    Args:
        query (str): Search query for products
        
    Returns:
        List[Dict[str, Any]]: List of product information dictionaries
    """
    # Set up logger
    scraper_logger = logger.child({"retailer": "PriceCheck"})
    scraper_logger.info(f"Scraping PriceCheck for query: {query}")
    
    # Encode the query for URL
    encoded_query = quote(query)
    search_url = f"https://www.pricecheck.co.za/search?search={encoded_query}"
    
    # Configure browser settings
    browser_config = BrowserConfig(
        headless=True,  # Run in headless mode (no visible browser)
        stealth_mode=True,  # Use stealth mode to avoid detection
        verbose=True,  # Show verbose logging
        timeout=60000  # Increase timeout for potentially slow pages
    )
    
    # Configure the extraction strategy
    extraction_strategy = JsonCssExtractionStrategy(
        schema=PRICECHECK_SCHEMA,
        verbose=True
    )
    
    # Configure the crawler run settings
    run_config = CrawlerRunConfig(
        extraction_strategy=extraction_strategy,
        cache_mode=CacheMode.BYPASS,  # Don't use cache to get fresh results
        wait_for_selector=".product-card",  # Wait for products to load
        wait_for_timeout=10000,  # Wait up to 10 seconds for content to load
        # Custom JavaScript to scroll through the page to load all products
        js_code=["""
            (async () => {
                // Scroll to bottom to trigger lazy loading
                for (let i = 0; i < 5; i++) {
                    window.scrollTo(0, document.body.scrollHeight);
                    await new Promise(r => setTimeout(r, 1000));
                }
                return true;
            })();
        """]
    )
    
    try:
        # Initialize the crawler and perform the crawl
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(
                url=search_url,
                config=run_config
            )
            
            # Parse the extracted content as JSON
            if result.extracted_content:
                products = json.loads(result.extracted_content)
                
                # Process the products
                processed_products = []
                for product in products:
                    # Clean up the price text
                    if product.get("price"):
                        price_text = product["price"]
                        # Extract numeric value from price (e.g., "R 1,299.00" -> "1299.00")
                        price_numeric = ''.join(c for c in price_text if c.isdigit() or c == '.')
                        if price_numeric:
                            try:
                                product["price"] = float(price_numeric)
                            except ValueError:
                                product["price"] = None
                    
                    # Add retailer information
                    product["retailer"] = "PriceCheck"
                    
                    # Extract product ID from product_link if available
                    if product.get("product_link"):
                        # ID is usually in the URL path
                        parts = product["product_link"].split("/")
                        if len(parts) > 1:
                            product["id"] = parts[-1]
                    
                    processed_products.append(product)
                
                scraper_logger.info(f"Found {len(processed_products)} products from PriceCheck")
                return processed_products
            else:
                scraper_logger.warning("No products extracted from PriceCheck")
                return []
                
    except Exception as e:
        scraper_logger.error(f"Error scraping PriceCheck: {str(e)}")
        return []

# Example usage when run directly
if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else "coffee"
    
    async def main():
        results = await scrape_pricecheck(query)
        print(f"Found {len(results)} products")
        for i, product in enumerate(results[:5], 1):  # Print first 5 results
            print(f"{i}. {product.get('name')} - {product.get('price')}")
    
    asyncio.run(main()) 