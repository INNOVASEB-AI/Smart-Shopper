#!/usr/bin/env python3
"""
PriceCheck Simple Crawler

This module implements a simplified PriceCheck crawler using SimpleBaseCrawler.
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
PRICECHECK_SITEMAP_URL = "https://www.pricecheck.co.za/sitemap.xml"

class PriceCheckCrawler(SimpleBaseCrawler):
    """
    PriceCheck-specific crawler implementation
    """
    
    def __init__(
        self,
        output_dir: str = "./data",
        max_urls: int = 100,
        concurrency: int = 6,
        db=None
    ):
        """
        Initialize the PriceCheck crawler
        
        Args:
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
            db: Optional database instance
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
            url_filter=pricecheck_url_filter,
            db=db
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
            # Extract data from the HTML content
            html = result.html if hasattr(result, 'html') else str(result)
            
            # Use BeautifulSoup for easier parsing
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract title
            title_selectors = [
                "h1.product-name", ".product-title", "h1",
                "[data-testid='product-title']", ".product-info h1"
            ]
            for selector in title_selectors:
                title_elem = soup.select_one(selector)
                if title_elem and title_elem.get_text(strip=True):
                    product_data["title"] = title_elem.get_text(strip=True)
                    break
            
            # Extract description
            desc_selectors = [
                ".description-content", ".product-description", ".description"
            ]
            for selector in desc_selectors:
                desc_elem = soup.select_one(selector)
                if desc_elem and desc_elem.get_text(strip=True):
                    product_data["description"] = desc_elem.get_text(strip=True)
                    break
            
            # Extract price from merchant listings
            price_selectors = [
                ".price", ".merchant-price", ".offer-price",
                "[data-testid='price']", ".price-display"
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
            
            # Extract brand
            brand_selectors = [
                ".brand", ".product-brand", "[data-testid='brand']"
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
            self.logger.error(f"Error processing PriceCheck product at {url}: {str(e)}")
            return None

# Test function for the crawler
async def main():
    """Test the PriceCheck crawler"""
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Test PriceCheck Crawler")
    parser.add_argument("--max-urls", type=int, default=10, help="Maximum URLs to crawl")
    parser.add_argument("--concurrency", type=int, default=3, help="Concurrent browser sessions")
    parser.add_argument("--output-dir", default="./data/pricecheck_test", help="Output directory")
    
    args = parser.parse_args()
    
    # Initialize crawler
    crawler = PriceCheckCrawler(
        output_dir=args.output_dir,
        max_urls=args.max_urls,
        concurrency=args.concurrency
    )
    
    try:
        # Start crawler
        await crawler.crawl()
        print(f"Crawl completed. Results saved to: {crawler.base_dir}")
        
    except KeyboardInterrupt:
        print("\nCrawl interrupted by user")
    except Exception as e:
        print(f"Crawl failed: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main()) 