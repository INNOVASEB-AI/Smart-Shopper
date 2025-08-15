"""
PriceCheck.co.za Scraper using crawl4ai
This script provides functionality to scrape product data from PriceCheck.co.za
"""

import asyncio
import json
import os
import sys
from typing import List, Dict, Any, Optional
from pathlib import Path
from urllib.parse import quote

# Add the parent directory to the path so we can import from the parent directory
sys.path.append(str(Path(__file__).parent.parent.parent))
from logger import logger

# Load crawl4ai
try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
    CRAWL4AI_AVAILABLE = True
except ImportError:
    logger.error("crawl4ai not available. Make sure to install it with 'pip install crawl4ai'")
    CRAWL4AI_AVAILABLE = False

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
    
    # Check if crawl4ai is available
    if not CRAWL4AI_AVAILABLE:
        scraper_logger.error("crawl4ai module not available. Cannot scrape PriceCheck.")
        return []
    
    # Encode the query for URL
    encoded_query = quote(query)
    search_url = f"https://www.pricecheck.co.za/search?search={encoded_query}"
    
    # Configure browser settings
    browser_config = BrowserConfig(
        headless=True,
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
        extra_headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0"
        }
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
                    
                    # Extract product ID and ensure URL is properly formatted
                    product_url = ""
                    if product.get("product_link"):
                        link = product["product_link"]
                        
                        # Ensure it's a full URL
                        if link.startswith("/"):
                            product_url = f"https://www.pricecheck.co.za{link}"
                        elif link.startswith("http"):
                            product_url = link
                        else:
                            product_url = f"https://www.pricecheck.co.za/{link}"
                        
                        # Extract ID from URL
                        parts = product_url.split("/")
                        if len(parts) > 1:
                            product["id"] = parts[-1]
                    
                    # If we didn't get a URL from product_link, create a fallback URL
                    if not product_url and product.get("name"):
                        encoded_name = quote(product["name"])
                        product_url = f"https://www.pricecheck.co.za/search?search={encoded_name}"
                    
                    # Set the URL field to ensure compatibility with the rest of the application
                    product["url"] = product_url
                    
                    # Rename fields to match the expected format
                    # Rename 'name' to 'title' if needed for compatibility
                    if "name" in product and "title" not in product:
                        product["title"] = product["name"]
                    
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
        print(json.dumps(results, indent=2))  # Print results as JSON
        print(f"Found {len(results)} products")
        if results:
            for i, product in enumerate(results[:5], 1):  # Print first 5 results
                print(f"{i}. {product.get('name')} - {product.get('price')} - {product.get('url')}")
    
    asyncio.run(main()) 