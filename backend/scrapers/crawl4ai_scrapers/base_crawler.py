#!/usr/bin/env python3
"""
Base Crawler for Smart Shopper ZA

This module provides a base crawler class that all retailer-specific crawlers will inherit from.
It implements the MemoryAdaptiveDispatcher and batch processing as recommended.
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
from urllib.parse import urljoin

# Import crawl4ai components
from crawl4ai import (
    Crawl4AI, 
    AsyncWebCrawler, 
    BrowserConfig, 
    CrawlerRunConfig, 
    CacheMode, 
    DisplayMode
)
from crawl4ai.async_dispatcher import MemoryAdaptiveDispatcher
from crawl4ai import RateLimiter, CrawlerMonitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

class BaseCrawler:
    """
    Base crawler class for Smart Shopper ZA
    
    This class provides common functionality for all retailer-specific crawlers:
    - Sitemap parsing
    - Memory-adaptive dispatching
    - Batch processing
    - Error handling and retry logic
    - Results storage
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
        custom_dispatcher: Optional[Any] = None
    ):
        """
        Initialize the base crawler
        
        Args:
            retailer_name: Name of the retailer (e.g., "PriceCheck", "Checkers")
            sitemap_url: URL to the retailer's sitemap.xml
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
            concurrency: Maximum number of concurrent browser sessions
            rate_limit: Tuple of (min_delay, max_delay) in seconds between requests
            url_filter: Optional function to filter URLs from sitemap
            custom_dispatcher: Optional custom dispatcher to override the default
        """
        self.retailer_name = retailer_name
        self.sitemap_url = sitemap_url
        self.output_dir = output_dir
        self.max_urls = max_urls
        self.concurrency = concurrency
        self.rate_limit = rate_limit
        self.url_filter = url_filter or (lambda url: True)  # Default to accept all URLs
        
        # Set up logger
        self.logger = self._setup_logging()
        
        # Create output directories
        self.base_dir = os.path.join(output_dir, retailer_name.lower())
        self.run_dir = self._create_run_dir()
        
        # Initialize statistics
        self.stats = {
            "retailer": retailer_name,
            "start_time": datetime.now(),
            "end_time": None,
            "urls_processed": 0,
            "successful": 0,
            "failed": 0,
            "products_found": 0,
            "retry_count": 0,
            "rate_limited": 0
        }
        
        # Initialize crawl4ai client
        self.crawler = Crawl4AI()
        
        # Set up rate limiter with more robust settings
        self.rate_limiter = RateLimiter(
            base_delay=rate_limit,  # Random pause between min and max seconds
            max_delay=120.0,  # Increased from 60s to 120s for severe rate limiting
            max_retries=5,    # Increased from 3 to 5 retries 
            backoff_factor=2.0,  # Exponential backoff for retries
            rate_limit_codes=[429, 503, 403, 520, 521, 522]  # Extended list of status codes
        )
        
        self.monitor = CrawlerMonitor(
            max_visible_rows=20,
            display_mode=DisplayMode.DETAILED,  # Changed from AGGREGATED to DETAILED
            log_to_file=True,
            log_file_path=os.path.join(self.run_dir, "crawler_monitor.log")
        )
        
        # Use custom dispatcher if provided, otherwise create a memory-adaptive one
        if custom_dispatcher:
            self.dispatcher = custom_dispatcher
        else:
            self.dispatcher = MemoryAdaptiveDispatcher(
                memory_threshold_percent=80.0,
                check_interval=1.0,
                max_session_permit=concurrency,
                rate_limiter=self.rate_limiter,
                monitor=self.monitor,
                retry_queue_size=100  # Allow queuing of failed requests
            )
        
        # Configure browser
        self.browser_config = BrowserConfig(
            headless=True,
            stealth_mode=True,
            ignore_https_errors=True,
            default_navigation_timeout=30000
        )
        
        # Configure run settings
        self.run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,  # Will be overridden in crawl_products method
            stream=False,
            check_robots_txt=True,  # Respect robots.txt
            wait_for_timeout=10000
        )
    
    def _setup_logging(self) -> logging.Logger:
        """Set up logging for the crawler"""
        logger = logging.getLogger(f"{self.retailer_name.lower()}_crawler")
        logger.setLevel(logging.INFO)
        return logger
    
    def _create_run_dir(self) -> str:
        """Create a timestamped directory for this crawl run"""
        # Create base output directory if it doesn't exist
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
        
        # Create run directory with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_dir = os.path.join(self.base_dir, f"run_{timestamp}")
        os.makedirs(run_dir)
        return run_dir
    
    async def fetch_sitemap(self) -> List[str]:
        """
        Fetch and parse the retailer's sitemap to extract product URLs
        
        Returns:
            List of product URLs from the sitemap
        """
        product_urls = []
        
        try:
            self.logger.info(f"Fetching sitemap from {self.sitemap_url}")
            
            # Fetch the sitemap
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
            response = requests.get(self.sitemap_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Parse the XML
            root = ET.fromstring(response.content)
            
            # Extract URLs from sitemap using namespaces
            # The namespace might be different across retailers
            urls = []
            
            # Try with namespace
            namespaces = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            url_elements = root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url")
            
            if url_elements:
                for url_elem in url_elements:
                    loc_elem = url_elem.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
                    if loc_elem is not None and loc_elem.text:
                        urls.append(loc_elem.text)
            else:
                # Try without namespace
                url_elements = root.findall(".//url")
                for url_elem in url_elements:
                    loc_elem = url_elem.find("loc")
                    if loc_elem is not None and loc_elem.text:
                        urls.append(loc_elem.text)
            
            # Apply URL filter
            filtered_urls = [url for url in urls if self.url_filter(url)]
            
            self.logger.info(f"Found {len(filtered_urls)} URLs after filtering from {len(urls)} total URLs")
            
            # Limit URLs if max_urls is specified
            if self.max_urls > 0 and len(filtered_urls) > self.max_urls:
                product_urls = filtered_urls[:self.max_urls]
                self.logger.info(f"Limited to {len(product_urls)} URLs")
            else:
                product_urls = filtered_urls
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error fetching sitemap: {str(e)}")
        except ET.ParseError as e:
            self.logger.error(f"Error parsing sitemap XML: {str(e)}")
        
        return product_urls
    
    async def process_result(self, result: Any, url: str) -> Optional[Dict[str, Any]]:
        """
        Process a single crawl result
        
        This method should be overridden by retailer-specific crawlers
        to implement their own data extraction logic.
        
        Args:
            result: The crawl result from crawl4ai
            url: The URL that was crawled
            
        Returns:
            Extracted product data or None if extraction failed
        """
        raise NotImplementedError("Subclasses must implement process_result")
    
    async def crawl_products(self, urls: List[str]) -> List[Dict[str, Any]]:
        """
        Crawl a list of product URLs and extract data
        
        Args:
            urls: List of URLs to crawl
            
        Returns:
            List of extracted product data
        """
        results = []
        
        if not urls:
            self.logger.warning("No URLs to crawl")
            return results
        
        try:
            # Determine if we should use cache based on the age of the run directory
            use_cache = False
            try:
                # Check if this is a fresh run or an incremental update
                is_incremental = os.path.exists(os.path.join(self.base_dir, "last_run.json"))
                use_cache = is_incremental
            except Exception:
                pass
            
            # Update run config with appropriate cache mode
            self.run_config.cache_mode = CacheMode.ENABLED if use_cache else CacheMode.BYPASS
            self.logger.info(f"Cache mode: {'ENABLED' if use_cache else 'BYPASS'}")
            
            async with AsyncWebCrawler(config=self.browser_config) as crawler:
                # Create a back-off queue for failed URLs
                retry_urls = []
                
                crawl_results = await crawler.arun_many(
                    urls=urls,
                    config=self.run_config,
                    dispatcher=self.dispatcher
                )
                
                self.stats["urls_processed"] = len(crawl_results)
                
                for result in crawl_results:
                    if result.success:
                        try:
                            # Process the successful result
                            processed_data = await self.process_result(result, result.url)
                            
                            if processed_data:
                                results.append(processed_data)
                                self.stats["successful"] += 1
                                self.stats["products_found"] += 1
                                
                                # Save to JSON file
                                self._save_product_data(processed_data)
                            else:
                                self.logger.warning(f"No data extracted from {result.url}")
                                self.stats["failed"] += 1
                                retry_urls.append(result.url)
                                
                        except Exception as e:
                            self.logger.error(f"Error processing result for {result.url}: {str(e)}")
                            self.stats["failed"] += 1
                            retry_urls.append(result.url)
                    else:
                        status_code = getattr(result, 'status_code', None)
                        is_rate_limited = status_code in self.rate_limiter.rate_limit_codes
                        
                        if is_rate_limited:
                            self.stats["rate_limited"] += 1
                            self.logger.warning(f"Rate limited on {result.url}: {result.error_message}")
                        else:
                            self.logger.error(f"Failed to crawl {result.url}: {result.error_message}")
                        
                        self.stats["failed"] += 1
                        retry_urls.append(result.url)
                
                # Retry failed URLs with exponential backoff
                if retry_urls and self.stats["retry_count"] < 3:  # Limit retries to prevent infinite loops
                    self.stats["retry_count"] += 1
                    self.logger.info(f"Retrying {len(retry_urls)} failed URLs (attempt {self.stats['retry_count']})")
                    
                    # Use increased delays for retries
                    original_rate_limit = self.rate_limiter.base_delay
                    try:
                        # Increase delay for retries
                        backoff_factor = self.stats["retry_count"] + 1
                        new_min_delay = original_rate_limit[0] * backoff_factor
                        new_max_delay = original_rate_limit[1] * backoff_factor
                        self.rate_limiter.base_delay = (new_min_delay, new_max_delay)
                        
                        # Wait for a moment before retrying
                        await asyncio.sleep(5 * self.stats["retry_count"])
                        
                        # Recursively call with retry URLs
                        retry_results = await self.crawl_products(retry_urls)
                        results.extend(retry_results)
                    finally:
                        # Restore original rate limit
                        self.rate_limiter.base_delay = original_rate_limit
        
        except Exception as e:
            self.logger.error(f"Error in batch crawl: {str(e)}")
        
        self.logger.info(
            f"Completed batch crawl: {self.stats['successful']} successful, "
            f"{self.stats['failed']} failed, {self.stats['rate_limited']} rate limited"
        )
        
        # Save last run information for incremental crawls
        try:
            last_run_info = {
                "timestamp": datetime.now().isoformat(),
                "stats": self.stats
            }
            with open(os.path.join(self.base_dir, "last_run.json"), "w") as f:
                json.dump(last_run_info, f, indent=2)
        except Exception as e:
            self.logger.error(f"Error saving last run info: {str(e)}")
        
        return results
    
    def _save_product_data(self, product_data: Dict[str, Any]) -> str:
        """
        Save product data to a JSON file
        
        Args:
            product_data: The product data to save
            
        Returns:
            Path to the saved file
        """
        try:
            # Create a unique filename based on product ID or URL
            product_id = product_data.get("id", "unknown")
            if product_id == "unknown" and "url" in product_data:
                # Extract ID from URL
                url_parts = product_data["url"].split("/")
                product_id = url_parts[-1] if url_parts else "unknown"
                
            filename = f"product_{product_id}.json"
            filepath = os.path.join(self.run_dir, filename)
            
            # Save to JSON file
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(product_data, f, indent=2)
                
            self.logger.info(f"Saved product data to {filename}")
            return filepath
        except Exception as e:
            self.logger.error(f"Error saving product data: {str(e)}")
            return ""
    
    async def run(self) -> Dict[str, Any]:
        """
        Run the crawler to process product URLs
        
        Returns:
            Dictionary containing crawl statistics
        """
        # Fetch URLs from sitemap
        urls = await self.fetch_sitemap()
        
        if not urls:
            self.logger.error("No URLs found to crawl. Exiting.")
            return self.get_summary()
        
        # Crawl products
        await self.crawl_products(urls)
        
        # Update and save final statistics
        return self.get_summary()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get crawl summary statistics"""
        self.stats["end_time"] = datetime.now()
        duration = (self.stats["end_time"] - self.stats["start_time"]).total_seconds()
        
        # Create a summary with human-readable times
        summary = {
            "retailer": self.retailer_name,
            "start_time": self.stats["start_time"].strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": self.stats["end_time"].strftime("%Y-%m-%d %H:%M:%S"),
            "duration_seconds": duration,
            "duration_formatted": f"{duration/60:.1f} minutes" if duration > 60 else f"{duration:.1f} seconds",
            "urls_processed": self.stats["urls_processed"],
            "successful": self.stats["successful"],
            "failed": self.stats["failed"],
            "products_found": self.stats["products_found"],
        }
        
        # Save summary to file
        summary_path = os.path.join(self.run_dir, "summary.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
            
        return summary

# Example usage
if __name__ == "__main__":
    # This is a base class and should not be run directly
    print("This is a base class and should not be run directly.")
    print("Please create a retailer-specific crawler that inherits from BaseCrawler.") 