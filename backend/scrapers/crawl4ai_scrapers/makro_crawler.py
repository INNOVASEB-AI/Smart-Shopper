#!/usr/bin/env python3
"""
Makro Crawler

This module implements a retailer-specific crawler for makro.co.za,
inheriting from the BaseCrawler class.
"""

import os
import sys
import asyncio
import logging
import argparse
from typing import Dict, Any, Optional, List

# Import base crawler
from simple_base_crawler import SimpleBaseCrawler

# Constants
MAKRO_SITEMAP_URL = "https://www.makro.co.za/sitemap.xml"

class MakroCrawler(SimpleBaseCrawler):
    """
    Makro-specific crawler implementation
    """
    
    def __init__(
        self,
        output_dir: str = "./data",
        max_urls: int = 100,
        concurrency: int = 4
    ):
        """
        Initialize the Makro crawler
        
        Args:
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
        """
        # Define a URL filter function for Makro
        def makro_url_filter(url: str) -> bool:
            """Filter for Makro product URLs"""
            return "/p/" in url or "/product/" in url
        
        # Initialize the base crawler with more conservative settings for Makro
        super().__init__(
            retailer_name="Makro",
            sitemap_url=MAKRO_SITEMAP_URL,
            output_dir=output_dir,
            max_urls=max_urls,
            concurrency=concurrency,
            rate_limit=(2.0, 4.0),  # More conservative rate limits as specified in config
            url_filter=makro_url_filter
        )
        
        self.logger.info("Makro crawler initialized")
    
    async def process_result(self, result: Any, url: str) -> Optional[Dict[str, Any]]:
        """
        Process a Makro product page and extract data
        
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
            "in_stock": True
        }
        
        try:
            # Get the page object
            page = result.page
            
            # Extract basic product info - adjust selectors for Makro
            product_data["title"] = await page.evaluate('''() => {
                const titleEl = document.querySelector("h1.product-title, .product-name, h1") || 
                               document.querySelector(".makro-product-title, [data-testid='product-title']");
                return titleEl ? titleEl.innerText.trim() : "";
            }''')
            
            # Extract description
            product_data["description"] = await page.evaluate('''() => {
                const descEl = document.querySelector(".product-description, .description") ||
                              document.querySelector(".makro-product-description, [data-testid='product-description']");
                return descEl ? descEl.innerText.trim() : "";
            }''')
            
            # Extract price - try multiple selectors
            price_text = await page.evaluate('''() => {
                const priceEl = document.querySelector(".price, .product-price, .current-price") ||
                               document.querySelector(".makro-price, [data-testid='price'], [data-testid='current-price']");
                return priceEl ? priceEl.innerText.trim() : "";
            }''')
            
            if price_text:
                # Extract numeric price (handle R formats)
                import re
                price_match = re.search(r'R\s*(\d+\.?\d*)', price_text)
                if price_match:
                    product_data["price"]["current"] = float(price_match.group(1))
            
            # Extract brand
            product_data["brand"] = await page.evaluate('''() => {
                const brandEl = document.querySelector(".brand, .product-brand") ||
                               document.querySelector(".makro-brand, [data-testid='brand']");
                return brandEl ? brandEl.innerText.trim() : "";
            }''')
            
            # Extract category
            product_data["category"] = await page.evaluate('''() => {
                const breadcrumbs = document.querySelectorAll(".breadcrumb a, .breadcrumbs a");
                if (breadcrumbs.length > 0) {
                    return breadcrumbs[breadcrumbs.length - 1].innerText.trim();
                }
                const categoryEl = document.querySelector(".category, .product-category");
                return categoryEl ? categoryEl.innerText.trim() : "";
            }''')
            
            # Extract images
            image_urls = await page.evaluate('''() => {
                const images = Array.from(document.querySelectorAll(".product-image img, .gallery img"));
                return images.map(img => img.src || img.getAttribute("data-src")).filter(Boolean);
            }''')
            product_data["images"] = image_urls
            
            # Check if product has meaningful data
            if product_data["title"] and (product_data["price"]["current"] or product_data["description"]):
                self.logger.debug(f"Extracted product: {product_data['title']} - R{product_data['price']['current']}")
                return product_data
            else:
                self.logger.debug(f"Insufficient product data for URL: {url}")
                return None
                
        except Exception as e:
            self.logger.error(f"Error processing Makro product at {url}: {str(e)}")
            return None

# Test function for the crawler
async def main():
    """Test the Makro crawler"""
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Test Makro Crawler")
    parser.add_argument("--max-urls", type=int, default=10, help="Maximum URLs to crawl")
    parser.add_argument("--concurrency", type=int, default=2, help="Concurrent browser sessions")
    parser.add_argument("--output-dir", default="./data/makro_test", help="Output directory")
    
    args = parser.parse_args()
    
    # Initialize crawler
    crawler = MakroCrawler(
        output_dir=args.output_dir,
        max_urls=args.max_urls,
        concurrency=args.concurrency
    )
    
    try:
        # Start crawler
        await crawler.crawl()
        print(f"Crawl completed. Results saved to: {crawler.run_dir}")
        
    except KeyboardInterrupt:
        print("\nCrawl interrupted by user")
    except Exception as e:
        print(f"Crawl failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main()) 