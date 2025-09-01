#!/usr/bin/env python3
"""
Simple Base Crawler for Smart Shopper ZA

This module provides a simplified base crawler class that works with the current crawl4ai API.
All retailer-specific crawlers can inherit from this.
"""

import os
import sys
import json
import logging
import asyncio
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable, Tuple
from urllib.parse import urljoin, urlparse
import random

# Import crawl4ai components
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

class SimpleBaseCrawler:
    """
    Simplified base crawler class for Smart Shopper ZA
    
    This class provides common functionality for all retailer-specific crawlers:
    - Sitemap parsing
    - URL filtering and seeding
    - Database storage
    - Error handling and retry logic
    """
    
    def __init__(
        self,
        retailer_name: str,
        sitemap_url: str,
        output_dir: str = "./data",
        max_urls: int = 100,
        concurrency: int = 6,
        rate_limit: Tuple[float, float] = (1.0, 3.0),
        url_filter: Optional[Callable[[str], bool]] = None,
        db=None
    ):
        """
        Initialize the simplified base crawler
        
        Args:
            retailer_name: Name of the retailer (e.g., "PriceCheck", "Checkers")
            sitemap_url: URL to the retailer's sitemap.xml
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
            rate_limit: Tuple of (min_delay, max_delay) in seconds between requests
            url_filter: Optional function to filter URLs from sitemap
            db: Optional database instance for storing products
        """
        self.retailer_name = retailer_name
        self.sitemap_url = sitemap_url
        self.output_dir = output_dir
        self.max_urls = max_urls
        self.concurrency = concurrency
        self.rate_limit = rate_limit
        self.url_filter = url_filter or (lambda url: True)
        self.db = db
        
        # Set up logger
        self.logger = logging.getLogger(f"crawler.{retailer_name.lower()}")
        
        # Create output directories
        self.base_dir = os.path.join(output_dir, retailer_name.lower())
        os.makedirs(self.base_dir, exist_ok=True)
        
        # Initialize statistics
        self.stats = {
            "retailer": retailer_name,
            "start_time": datetime.now(),
            "end_time": None,
            "urls_processed": 0,
            "successful": 0,
            "failed": 0,
            "products_found": 0,
            "products_saved": 0
        }
        
        self.logger.info(f"Initialized {retailer_name} crawler")
    
    async def get_sitemap_urls(self) -> List[str]:
        """
        Fetch and parse URLs from the retailer's sitemap
        
        Returns:
            List of URLs found in the sitemap
        """
        try:
            self.logger.info(f"Fetching sitemap from {self.sitemap_url}")
            
            # Fetch sitemap content
            response = requests.get(self.sitemap_url, timeout=30)
            response.raise_for_status()
            
            # Parse XML
            root = ET.fromstring(response.content)
            
            # Extract URLs (handle both sitemap index and URL lists)
            urls = []
            
            # Handle sitemap namespace variations
            namespaces = {
                'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'
            }
            
            # Try to find URLs
            for url_elem in root.findall('.//sitemap:url/sitemap:loc', namespaces):
                if url_elem.text:
                    urls.append(url_elem.text.strip())
            
            # Also try without namespace in case it's not declared properly
            for url_elem in root.findall('.//loc'):
                if url_elem.text and url_elem.text.strip() not in urls:
                    urls.append(url_elem.text.strip())
            
            # Filter URLs using the provided filter function
            filtered_urls = [url for url in urls if self.url_filter(url)]
            
            self.logger.info(f"Found {len(urls)} total URLs, {len(filtered_urls)} after filtering")
            
            # Limit to max_urls
            if len(filtered_urls) > self.max_urls:
                filtered_urls = filtered_urls[:self.max_urls]
                self.logger.info(f"Limited to first {self.max_urls} URLs")
            
            return filtered_urls
            
        except Exception as e:
            self.logger.error(f"Error fetching sitemap: {str(e)}")
            return []
    
    async def get_seed_urls(self, seed_keywords: List[str]) -> List[str]:
        """
        Generate seed URLs based on keywords (for retailers that support search)
        
        Args:
            seed_keywords: List of keywords to search for
            
        Returns:
            List of search URLs
        """
        # This method should be overridden by child classes that support keyword-based URLs
        # Default implementation returns empty list
        return []
    
    async def process_result(self, result: Any, url: str) -> Optional[Dict[str, Any]]:
        """
        Process a crawl result and extract product data
        
        This method should be overridden by retailer-specific implementations
        
        Args:
            result: The crawl result from crawl4ai
            url: The URL that was crawled
            
        Returns:
            Extracted product data or None if extraction failed
        """
        raise NotImplementedError("Subclasses must implement process_result method")
    
    async def save_product(self, product_data: Dict[str, Any]) -> bool:
        """
        Save product data to database
        
        Args:
            product_data: Product data dictionary
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            if self.db:
                # Save to database
                success = await self.db.save_product(
                    retailer=self.retailer_name,
                    url=product_data.get("url", ""),
                    name=product_data.get("title", ""),
                    price=product_data.get("price", {}).get("current"),
                    data=product_data
                )
                if success:
                    self.stats["products_saved"] += 1
                return success
            else:
                # Save to JSON file as fallback
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{self.retailer_name.lower()}_products_{timestamp}.json"
                filepath = os.path.join(self.base_dir, filename)
                
                # Load existing data or create new
                products = []
                if os.path.exists(filepath):
                    with open(filepath, 'r') as f:
                        products = json.load(f)
                
                products.append(product_data)
                
                # Save updated data
                with open(filepath, 'w') as f:
                    json.dump(products, f, indent=2, default=str)
                
                self.stats["products_saved"] += 1
                return True
                
        except Exception as e:
            self.logger.error(f"Error saving product: {str(e)}")
            return False
    
    async def crawl_url(self, crawler: AsyncWebCrawler, url: str) -> Optional[Dict[str, Any]]:
        """
        Crawl a single URL and extract product data
        
        Args:
            crawler: AsyncWebCrawler instance
            url: URL to crawl
            
        Returns:
            Product data or None
        """
        try:
            self.stats["urls_processed"] += 1
            
            # Add random delay for rate limiting
            delay = random.uniform(self.rate_limit[0], self.rate_limit[1])
            await asyncio.sleep(delay)
            
            # Crawl the URL
            result = await crawler.arun(url=url)
            
            # Process the result
            product_data = await self.process_result(result, url)
            
            if product_data:
                self.stats["successful"] += 1
                self.stats["products_found"] += 1
                
                # Save product data
                await self.save_product(product_data)
                
                self.logger.debug(f"Successfully processed: {product_data.get('title', 'Unknown')}")
                return product_data
            else:
                self.logger.debug(f"No product data extracted from: {url}")
                return None
                
        except Exception as e:
            self.stats["failed"] += 1
            self.logger.error(f"Error crawling {url}: {str(e)}")
            return None
    
    async def crawl(self, seed_keywords: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Start the crawling process
        
        Args:
            seed_keywords: Optional list of keywords for seeded crawling
            
        Returns:
            Crawl statistics and results
        """
        self.logger.info(f"Starting {self.retailer_name} crawler")
        self.stats["start_time"] = datetime.now()
        
        # Browser configuration
        browser_config = BrowserConfig(
            headless=True,
            viewport_width=1920,
            viewport_height=1080
        )
        
        async with AsyncWebCrawler(config=browser_config) as crawler:
            # Get URLs to crawl
            urls = []
            
            # Try to get seed URLs first if keywords provided
            if seed_keywords:
                seed_urls = await self.get_seed_urls(seed_keywords)
                urls.extend(seed_urls)
                self.logger.info(f"Added {len(seed_urls)} seed URLs")
            
            # Get sitemap URLs if we need more
            if len(urls) < self.max_urls:
                sitemap_urls = await self.get_sitemap_urls()
                # Add sitemap URLs that aren't already in the list
                for url in sitemap_urls:
                    if url not in urls:
                        urls.append(url)
                        if len(urls) >= self.max_urls:
                            break
            
            self.logger.info(f"Starting to crawl {len(urls)} URLs")
            
            # Process URLs with limited concurrency
            semaphore = asyncio.Semaphore(self.concurrency)
            
            async def crawl_with_semaphore(url):
                async with semaphore:
                    return await self.crawl_url(crawler, url)
            
            # Create tasks for all URLs
            tasks = [crawl_with_semaphore(url) for url in urls]
            
            # Execute tasks
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter successful results
            products = [r for r in results if isinstance(r, dict) and r is not None]
        
        # Finalize statistics
        self.stats["end_time"] = datetime.now()
        duration = (self.stats["end_time"] - self.stats["start_time"]).total_seconds()
        
        self.logger.info(f"Crawl completed in {duration:.1f}s")
        self.logger.info(f"URLs processed: {self.stats['urls_processed']}")
        self.logger.info(f"Successful: {self.stats['successful']}")
        self.logger.info(f"Failed: {self.stats['failed']}")
        self.logger.info(f"Products found: {self.stats['products_found']}")
        self.logger.info(f"Products saved: {self.stats['products_saved']}")
        
        return {
            "stats": self.stats,
            "products": products,
            "database_success": self.stats['products_saved'] > 0
        } 