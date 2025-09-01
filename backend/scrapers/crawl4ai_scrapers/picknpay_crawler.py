#!/usr/bin/env python3
"""
Pick n Pay Crawler

This module implements a retailer-specific crawler for pnp.co.za,
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
PICKNPAY_SITEMAP_URL = "https://www.pnp.co.za/sitemap.xml"

class PicknPayCrawler(SimpleBaseCrawler):
    """
    Pick n Pay-specific crawler implementation
    """
    
    def __init__(
        self,
        output_dir: str = "./data",
        max_urls: int = 100,
        concurrency: int = 6
    ):
        """
        Initialize the Pick n Pay crawler
        
        Args:
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
        """
        # Define a URL filter function for Pick n Pay
        def picknpay_url_filter(url: str) -> bool:
            """Filter for Pick n Pay product URLs"""
            return "/prodid/" in url or "/products/" in url
        
        # Initialize the base crawler
        super().__init__(
            retailer_name="PicknPay",
            sitemap_url=PICKNPAY_SITEMAP_URL,
            output_dir=output_dir,
            max_urls=max_urls,
            concurrency=concurrency,
            rate_limit=(1.0, 3.0),  # Faster rate limits as specified in config
            url_filter=picknpay_url_filter
        )
        
        self.logger.info("Pick n Pay crawler initialized")
    
    async def process_result(self, result: Any, url: str) -> Optional[Dict[str, Any]]:
        """
        Process a Pick n Pay product page and extract data
        
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
            
            # Extract basic product info - adjust selectors for Pick n Pay
            product_data["title"] = await page.evaluate('''() => {
                const titleEl = document.querySelector("h1.product-title, .product-name, h1") || 
                               document.querySelector(".pnp-product-title, [data-cy='product-title']");
                return titleEl ? titleEl.innerText.trim() : "";
            }''')
            
            # Extract description
            product_data["description"] = await page.evaluate('''() => {
                const descEl = document.querySelector(".product-description, .description") ||
                              document.querySelector(".pnp-product-description, [data-cy='product-description']");
                return descEl ? descEl.innerText.trim() : "";
            }''')
            
            # Extract price - try multiple selectors
            price_text = await page.evaluate('''() => {
                const priceEl = document.querySelector(".price, .product-price, .current-price") ||
                               document.querySelector(".pnp-price, [data-cy='price'], [data-cy='current-price']");
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
                               document.querySelector(".pnp-brand, [data-cy='brand']");
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
            self.logger.error(f"Error processing Pick n Pay product at {url}: {str(e)}")
            return None

# Test function for the crawler
async def main():
    """Test the Pick n Pay crawler"""
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Test Pick n Pay Crawler")
    parser.add_argument("--max-urls", type=int, default=10, help="Maximum URLs to crawl")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent browser sessions")
    parser.add_argument("--output-dir", default="./data/picknpay_test", help="Output directory")
    
    args = parser.parse_args()
    
    # Initialize crawler
    crawler = PicknPayCrawler(
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