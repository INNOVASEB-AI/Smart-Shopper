#!/usr/bin/env python3
"""
PriceCheck Crawler

This module implements a retailer-specific crawler for PriceCheck.co.za,
inheriting from the BaseCrawler class.
"""

import os
import sys
import asyncio
import logging
import argparse
from typing import Dict, Any, Optional, List

# Import base crawler
from base_crawler import BaseCrawler

# Constants
PRICECHECK_SITEMAP_URL = "https://www.pricecheck.co.za/sitemap.xml"

class PriceCheckCrawler(BaseCrawler):
    """
    PriceCheck-specific crawler implementation
    """
    
    def __init__(
        self,
        output_dir: str = "./data",
        max_urls: int = 100,
        concurrency: int = 6
    ):
        """
        Initialize the PriceCheck crawler
        
        Args:
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
        """
        # Define a URL filter function for PriceCheck
        def pricecheck_url_filter(url: str) -> bool:
            """Filter for PriceCheck product URLs"""
            return "/offer/" in url or "/offers/" in url
        
        # Initialize the base crawler
        super().__init__(
            retailer_name="PriceCheck",
            sitemap_url=PRICECHECK_SITEMAP_URL,
            output_dir=output_dir,
            max_urls=max_urls,
            concurrency=concurrency,
            rate_limit=(1.0, 3.0),  # 1-3 seconds between requests
            url_filter=pricecheck_url_filter
        )
        
        self.logger.info("PriceCheck crawler initialized")
    
    async def process_result(self, result: Any, url: str) -> Optional[Dict[str, Any]]:
        """
        Process a PriceCheck product page and extract data
        
        Args:
            result: The crawl result from crawl4ai
            url: The URL that was crawled
            
        Returns:
            Extracted product data or None if extraction failed
        """
        # Initialize default product data structure
        product_data = {
            "url": url,
            "title": "",
            "description": "",
            "price": {
                "current": None,
                "currency": "ZAR",
                "original": None
            },
            "brand": "",
            "category": "",
            "images": [],
            "specifications": {},
            "merchants": []
        }
        
        try:
            # Get the page object
            page = result.page
            
            # Extract basic product info
            product_data["title"] = await page.evaluate('''() => {
                const titleEl = document.querySelector("h1.product-name");
                return titleEl ? titleEl.innerText.trim() : "";
            }''')
            
            # Extract description
            product_data["description"] = await page.evaluate('''() => {
                const descEl = document.querySelector(".description-content");
                return descEl ? descEl.innerText.trim() : "";
            }''')
            
            # Extract price
            price_result = await page.evaluate('''() => {
                const priceEl = document.querySelector(".product-price .amount");
                if (priceEl) {
                    const priceText = priceEl.innerText.trim();
                    // Remove currency symbol and parse to number
                    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
                    return price;
                }
                return null;
            }''')
            if price_result:
                product_data["price"]["current"] = price_result
            
            # Extract brand
            product_data["brand"] = await page.evaluate('''() => {
                const brandEl = document.querySelector(".brand-title a");
                return brandEl ? brandEl.innerText.trim() : "";
            }''')
            
            # Extract category
            product_data["category"] = await page.evaluate('''() => {
                const categoryEls = document.querySelectorAll(".breadcrumb li a");
                if (categoryEls && categoryEls.length > 1) {
                    return categoryEls[categoryEls.length - 2].innerText.trim();
                }
                return "";
            }''')
            
            # Extract images
            product_data["images"] = await page.evaluate('''() => {
                const imageEls = document.querySelectorAll(".thumb-container img");
                return Array.from(imageEls).map(img => img.src).filter(src => src);
            }''')
            
            # Extract specifications
            product_data["specifications"] = await page.evaluate('''() => {
                const specsRows = document.querySelectorAll(".specifications-table tr");
                const specs = {};
                specsRows.forEach(row => {
                    const name = row.querySelector("th")?.innerText.trim();
                    const value = row.querySelector("td")?.innerText.trim();
                    if (name && value) {
                        specs[name] = value;
                    }
                });
                return specs;
            }''')
            
            # Extract merchants
            product_data["merchants"] = await page.evaluate('''() => {
                const merchantRows = document.querySelectorAll(".merchant-offer");
                return Array.from(merchantRows).map(row => {
                    const nameEl = row.querySelector(".merchant-name");
                    const priceEl = row.querySelector(".price .amount");
                    const linkEl = row.querySelector(".merchant-link a");
                    
                    return {
                        name: nameEl ? nameEl.innerText.trim() : "",
                        price: priceEl ? parseFloat(priceEl.innerText.trim().replace(/[^0-9.]/g, "")) : null,
                        url: linkEl ? linkEl.href : ""
                    };
                });
            }''')
            
            # If no current price is set but we have merchant prices, use the lowest
            if product_data["price"]["current"] is None and product_data["merchants"]:
                valid_prices = [m["price"] for m in product_data["merchants"] if m["price"]]
                if valid_prices:
                    product_data["price"]["current"] = min(valid_prices)
            
            # Add retailer information
            product_data["retailer"] = "PriceCheck"
            
            # Skip if no title found (indicates not a valid product page)
            if not product_data["title"]:
                self.logger.warning(f"No product title found at {url}, skipping")
                return None
                
            return product_data
            
        except Exception as e:
            self.logger.error(f"Error extracting data from {url}: {str(e)}")
            return None

def main():
    """Parse command-line arguments and run the crawler"""
    parser = argparse.ArgumentParser(description="PriceCheck Crawler")
    parser.add_argument("--output-dir", default="./data", 
                        help="Directory to save crawled data")
    parser.add_argument("--max-urls", type=int, default=100, 
                        help="Maximum number of URLs to process")
    parser.add_argument("--concurrency", type=int, default=6,
                        help="Maximum number of concurrent browser sessions")
    parser.add_argument("--log-level", default="INFO", 
                        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                        help="Logging level")
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger("pricecheck_crawler").setLevel(getattr(logging, args.log_level))
    
    # Configure and run the crawler
    crawler = PriceCheckCrawler(
        output_dir=args.output_dir,
        max_urls=args.max_urls,
        concurrency=args.concurrency
    )
    
    # Run the crawler using asyncio
    summary = asyncio.run(crawler.run())
    
    # Print summary
    print("\nCrawl Summary:")
    print(f"Retailer: {summary['retailer']}")
    print(f"Start time: {summary['start_time']}")
    print(f"End time: {summary['end_time']}")
    print(f"Duration: {summary['duration_formatted']}")
    print(f"URLs processed: {summary['urls_processed']}")
    print(f"Successful: {summary['successful']}")
    print(f"Failed: {summary['failed']}")
    print(f"Products found: {summary['products_found']}")
    print(f"Results saved to: {crawler.run_dir}")

if __name__ == "__main__":
    main() 