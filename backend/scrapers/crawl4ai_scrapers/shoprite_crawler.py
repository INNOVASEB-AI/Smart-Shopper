#!/usr/bin/env python3
"""
Shoprite Crawler

This module implements a retailer-specific crawler for Shoprite.co.za,
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
SHOPRITE_SITEMAP_URL = "https://www.shoprite.co.za/sitemap.xml"

class ShopriteCrawler(SimpleBaseCrawler):
    """
    Shoprite-specific crawler implementation
    """
    
    def __init__(
        self,
        output_dir: str = "./data",
        max_urls: int = 100,
        concurrency: int = 6,
        db=None
    ):
        """
        Initialize the Shoprite crawler
        
        Args:
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
            db: Optional database instance
        """
        # Define a URL filter function for Shoprite
        def shoprite_url_filter(url: str) -> bool:
            """Filter for Shoprite product URLs"""
            return "/p/" in url or "/products/" in url
        
        # Initialize the base crawler
        super().__init__(
            retailer_name="Shoprite",
            sitemap_url=SHOPRITE_SITEMAP_URL,
            output_dir=output_dir,
            max_urls=max_urls,
            concurrency=concurrency,
            rate_limit=(1.5, 3.5),  # Conservative rate limits
            url_filter=shoprite_url_filter,
            db=db
        )
        
        self.logger.info("Shoprite crawler initialized")
    
    async def process_result(self, result: Any, url: str) -> Optional[Dict[str, Any]]:
        """
        Process a Shoprite product page and extract data
        
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
            # Extract data from the HTML content
            html = result.html if hasattr(result, 'html') else str(result)
            
            # Use BeautifulSoup for easier parsing
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract title
            title_selectors = [
                "h1.product-title", ".product-name", "h1",
                "[data-testid='product-title']", ".product-details h1"
            ]
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem and title_elem.get_text(strip=True):
                    product_data["title"] = title_elem.get_text(strip=True)
                    break
            
            # Extract price
            price_selectors = [
                ".price", ".product-price", ".current-price",
                "[data-testid='price']", "[data-testid='current-price']",
                ".price-current", ".product-price-current"
            ]
            for selector in price_selectors:
                price_elem = soup.select_one(selector)
                if price_elem:
                    price_text = price_elem.get_text(strip=True)
                    if price_text:
                        # Extract numeric price (handle R formats)
                        import re
                        price_match = re.search(r'R\s*(\d+\.?\d*)', price_text)
                        if price_match:
                            product_data["price"]["current"] = float(price_match.group(1))
                            break
            
            # Extract description
            desc_selectors = [
                ".product-description", ".description",
                "[data-testid='product-description']", ".product-info"
            ]
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem and desc_elem.get_text(strip=True):
                    product_data["description"] = desc_elem.get_text(strip=True)
                    break
            
            # Extract brand
            brand_selectors = [
                ".brand", ".product-brand",
                "[data-testid='brand']", ".product-brand-name"
            ]
            for selector in brand_selectors:
                brand_elem = soup.select_one(selector)
                if brand_elem and brand_elem.get_text(strip=True):
                    product_data["brand"] = brand_elem.get_text(strip=True)
                    break
            
            # Extract category from breadcrumbs
            breadcrumb_selectors = [
                ".breadcrumb a", ".breadcrumbs a", ".breadcrumb-item a"
            ]
            for selector in breadcrumb_selectors:
                breadcrumbs = soup.select(selector)
                if breadcrumbs:
                    product_data["category"] = breadcrumbs[-1].get_text(strip=True)
                    break
            
            # Extract images
            img_selectors = [
                ".product-image img", ".gallery img", ".product-photos img"
            ]
            for selector in img_selectors:
                images = soup.select(selector)
                if images:
                    product_data["images"] = [
                        img.get('src') or img.get('data-src') 
                        for img in images 
                        if img.get('src') or img.get('data-src')
                    ]
                    break
            
            # Check if product has meaningful data
            if product_data["title"] and (product_data["price"]["current"] or product_data["description"]):
                self.logger.debug(f"Extracted product: {product_data['title']} - R{product_data['price']['current']}")
                return product_data
            else:
                self.logger.debug(f"Insufficient product data for URL: {url}")
                return None
                
        except Exception as e:
            self.logger.error(f"Error processing Shoprite product at {url}: {str(e)}")
            return None

# Test function for the crawler
async def main():
    """Test the Shoprite crawler"""
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Test Shoprite Crawler")
    parser.add_argument("--max-urls", type=int, default=10, help="Maximum URLs to crawl")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent browser sessions")
    parser.add_argument("--output-dir", default="./data/shoprite_test", help="Output directory")
    
    args = parser.parse_args()
    
    # Initialize crawler
    crawler = ShopriteCrawler(
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