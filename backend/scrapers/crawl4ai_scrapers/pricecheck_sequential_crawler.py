#!/usr/bin/env python3
"""
PriceCheck Sequential Crawler

This script implements a sequential crawler for PriceCheck.co.za using the crawl4ai library.
It fetches the sitemap, extracts product URLs, and processes them sequentially using
a single browser session to extract product data such as prices, specs, and merchant information.

Usage:
    python pricecheck_sequential_crawler.py [--output-dir DIR] [--max-urls N] [--log-level LEVEL]

Arguments:
    --output-dir DIR    Directory to save crawled data (default: ./pricecheck_data)
    --max-urls N        Maximum number of URLs to process (default: 100)
    --log-level LEVEL   Logging level (default: INFO)
"""

import os
import sys
import json
import time
import logging
import argparse
import requests
from datetime import datetime
from bs4 import BeautifulSoup
from lxml import etree
from urllib.parse import urljoin
import random
from typing import List, Dict, Any, Optional, Tuple

# Import crawl4ai
try:
    from crawl4ai import Crawl4AI, DispatcherConfig, CacheMode
except ImportError:
    print("Error: crawl4ai package not found. Please install it with: pip install crawl4ai")
    sys.exit(1)

# Constants
PRICECHECK_SITEMAP_URL = "https://www.pricecheck.co.za/sitemap.xml"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
BROWSER_CONFIG = {
    "headless": True,
    "ignore_https_errors": True,
    "default_navigation_timeout": 30000,
}

class PriceCheckSequentialCrawler:
    """
    A class for sequentially crawling PriceCheck.co.za product pages using crawl4ai
    """
    
    def __init__(self, output_dir: str = "./pricecheck_data", max_urls: int = 100):
        """
        Initialize the PriceCheck crawler
        
        Args:
            output_dir: Directory to save crawled data
            max_urls: Maximum number of URLs to process
        """
        self.output_dir = output_dir
        self.max_urls = max_urls
        self.logger = self._setup_logging()
        self.run_dir = self._create_run_dir()
        
        # Initialize statistics
        self.stats = {
            "start_time": datetime.now(),
            "end_time": None,
            "urls_processed": 0,
            "successful": 0,
            "failed": 0,
            "products_found": 0
        }
        
        # Initialize crawl4ai client
        self.crawler = Crawl4AI()
        
    def _setup_logging(self) -> logging.Logger:
        """Set up logging for the crawler"""
        logger = logging.getLogger("pricecheck_crawler")
        logger.setLevel(logging.INFO)
        
        # Create console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)
        
        # Create formatter
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        ch.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(ch)
        
        return logger
    
    def _create_run_dir(self) -> str:
        """Create a timestamped directory for this crawl run"""
        # Create base output directory if it doesn't exist
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
        
        # Create run directory with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_dir = os.path.join(self.output_dir, f"run_{timestamp}")
        os.makedirs(run_dir)
        self.logger.info(f"Created run directory: {run_dir}")
        
        return run_dir
    
    def fetch_sitemap(self) -> List[str]:
        """
        Fetch and parse the PriceCheck sitemap to extract product URLs
        
        Returns:
            List of product URLs from the sitemap
        """
        product_urls = []
        
        try:
            self.logger.info(f"Fetching sitemap from {PRICECHECK_SITEMAP_URL}")
            
            # Fetch the sitemap
            headers = {"User-Agent": USER_AGENT}
            response = requests.get(PRICECHECK_SITEMAP_URL, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Parse the XML
            sitemap_xml = etree.fromstring(response.content)
            
            # Extract URLs from sitemap using namespaces
            namespaces = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            urls = sitemap_xml.xpath("//sm:url/sm:loc", namespaces=namespaces)
            
            # Filter for product URLs (those containing "/offer/" or "/offers/")
            for url_elem in urls:
                url = url_elem.text
                if "/offer/" in url or "/offers/" in url:
                    product_urls.append(url)
            
            self.logger.info(f"Found {len(product_urls)} product URLs in sitemap")
            
            # Shuffle URLs to get a random sample if we're limiting
            if self.max_urls < len(product_urls):
                random.shuffle(product_urls)
                product_urls = product_urls[:self.max_urls]
                self.logger.info(f"Limited to {len(product_urls)} random product URLs")
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error fetching sitemap: {str(e)}")
            product_urls = []
        except etree.XMLSyntaxError as e:
            self.logger.error(f"Error parsing sitemap XML: {str(e)}")
            product_urls = []
        
        return product_urls
    
    async def extract_product_data(self, page, url: str) -> Dict[str, Any]:
        """
        Extract product data from a PriceCheck product page
        
        Args:
            page: The crawl4ai page object
            url: The URL of the product page
            
        Returns:
            Dictionary containing extracted product data
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
            
            return product_data
        
        except Exception as e:
            self.logger.error(f"Error extracting data from {url}: {str(e)}")
            return product_data
    
    async def run(self):
        """
        Run the crawler to process product URLs and extract data
        """
        # Fetch URLs from sitemap
        product_urls = self.fetch_sitemap()
        
        if not product_urls:
            self.logger.error("No product URLs found. Exiting.")
            return
        
        self.logger.info(f"Starting sequential crawl of {len(product_urls)} product URLs")
        
        # Determine if this is an incremental crawl
        use_cache = False
        try:
            last_run_file = os.path.join(self.output_dir, "last_run.json")
            if os.path.exists(last_run_file):
                with open(last_run_file, "r") as f:
                    last_run_data = json.load(f)
                    last_run_time = datetime.fromisoformat(last_run_data.get("timestamp", ""))
                    time_diff = (datetime.now() - last_run_time).total_seconds() / 3600
                    # If last run was less than 24 hours ago, use cache
                    use_cache = time_diff < 24
                    self.logger.info(
                        f"Found previous run from {last_run_time.strftime('%Y-%m-%d %H:%M:%S')} "
                        f"({time_diff:.1f} hours ago). Cache mode: {'ENABLED' if use_cache else 'BYPASS'}"
                    )
        except Exception as e:
            self.logger.warning(f"Error checking last run time: {str(e)}. Using cache mode: BYPASS")
            use_cache = False
        
        # Configure crawler with appropriate cache mode
        browser_config = BROWSER_CONFIG.copy()
        crawler_config = CRAWLER_CONFIG.copy()
        crawler_config.cache_mode = CacheMode.ENABLED if use_cache else CacheMode.BYPASS
        crawler_config.check_robots_txt = True  # Always respect robots.txt
        
        # Configure crawler dispatcher
        config = DispatcherConfig(
            browser_config=browser_config,
            max_concurrent_browsers=1,  # Use only one browser for sequential crawling
            browser_idle_timeout=300,
            default_user_agent=USER_AGENT
        )
        
        # Create a browser instance
        async with self.crawler.create_dispatcher(config) as dispatcher:
            browser = await dispatcher.get_browser()
            
            for idx, url in enumerate(product_urls):
                self.stats["urls_processed"] += 1
                
                try:
                    self.logger.info(f"Processing URL {idx+1}/{len(product_urls)}: {url}")
                    
                    # Create a new page in the browser
                    page = await browser.new_page()
                    
                    try:
                        # Navigate to the URL
                        await page.goto(url, wait_until="networkidle2")
                        
                        # Extract product data
                        product_data = await self.extract_product_data(page, url)
                        
                        # Save product data if we have a title (indicates successful extraction)
                        if product_data["title"]:
                            self.stats["successful"] += 1
                            self.stats["products_found"] += 1
                            
                            # Create a unique filename for this product
                            product_id = url.split("/")[-1] if "/" in url else str(idx)
                            filename = f"product_{product_id}.json"
                            filepath = os.path.join(self.run_dir, filename)
                            
                            # Save to JSON file
                            with open(filepath, "w", encoding="utf-8") as f:
                                json.dump(product_data, f, indent=2)
                                
                            self.logger.info(f"Saved product data to {filename}")
                        else:
                            self.logger.warning(f"No product data found at {url}")
                            self.stats["failed"] += 1
                    
                    except Exception as e:
                        self.logger.error(f"Error processing {url}: {str(e)}")
                        self.stats["failed"] += 1
                    
                    finally:
                        # Close the page to free resources
                        await page.close()
                        
                        # Add a small delay between requests to avoid rate limiting
                        await page.wait_for_timeout(random.randint(1000, 3000))
                
                except Exception as e:
                    self.logger.error(f"Unhandled error processing {url}: {str(e)}")
                    self.stats["failed"] += 1
        
        # Update and save final statistics
        self.stats["end_time"] = datetime.now()
        duration = (self.stats["end_time"] - self.stats["start_time"]).total_seconds()
        
        # Create a summary with human-readable times
        summary = {
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
        
        self.logger.info(f"Crawl completed in {summary['duration_formatted']}")
        self.logger.info(f"URLs processed: {summary['urls_processed']}")
        self.logger.info(f"Successful: {summary['successful']}")
        self.logger.info(f"Failed: {summary['failed']}")
        self.logger.info(f"Products found: {summary['products_found']}")
        self.logger.info(f"Results saved to {self.run_dir}")
        
        return summary

def main():
    """Parse command-line arguments and run the crawler"""
    parser = argparse.ArgumentParser(description="PriceCheck Sequential Crawler")
    parser.add_argument("--output-dir", default="./pricecheck_data", 
                        help="Directory to save crawled data")
    parser.add_argument("--max-urls", type=int, default=100, 
                        help="Maximum number of URLs to process")
    parser.add_argument("--log-level", default="INFO", 
                        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                        help="Logging level")
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger("pricecheck_crawler").setLevel(getattr(logging, args.log_level))
    
    # Configure and run the crawler
    crawler = PriceCheckSequentialCrawler(
        output_dir=args.output_dir,
        max_urls=args.max_urls
    )
    
    # Run the crawler using asyncio
    import asyncio
    summary = asyncio.run(crawler.run())
    
    # Print summary
    print("\nCrawl Summary:")
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