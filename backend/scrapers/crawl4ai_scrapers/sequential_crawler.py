#!/usr/bin/env python3
import os
import sys
import json
import time
import logging
import argparse
import asyncio
import random
from datetime import datetime
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set

import aiohttp
import crawl4ai
from crawl4ai import Schema, Field, PaginationType, PageType
from bs4 import BeautifulSoup

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("pricecheck_crawler")

# Default settings
DEFAULT_RESULTS_DIR = os.path.join("data", "pricecheck_results")
DEFAULT_MAX_URLS = 50
BASE_URL = "https://www.pricecheck.co.za"
SITEMAP_URL = "https://www.pricecheck.co.za/sitemap.xml"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"

# Schema for product pages
class ProductPageSchema(Schema):
    """Schema for extracting data from product pages."""
    page_type = PageType.PRODUCT
    
    # Product information
    product_id = Field(
        css="meta[property='product:retailer_item_id']",
        attribute="content",
        default=None
    )
    title = Field(
        css="h1.product-name",
        type=str,
        default=""
    )
    price = Field(
        css=".currency.retailer-currency",
        type=str,
        default=""
    )
    description = Field(
        css="div.product-description",
        type=str,
        default=""
    )
    rating = Field(
        css=".rating-value",
        type=float,
        default=None
    )
    
    # Product images
    main_image = Field(
        css="img.js_image_zoom",
        attribute="src",
        default=None
    )
    
    # Brand information
    brand = Field(
        css=".brand-title a",
        type=str,
        default=None
    )
    
    # Basic specifications
    specs = Field(
        css="#tab-features table tr",
        default=[],
        many=True,
        children={
            "label": Field(css="td:nth-child(1)", type=str),
            "value": Field(css="td:nth-child(2)", type=str)
        }
    )
    
    # Variants
    variants = Field(
        css=".variant-container .variant-item",
        default=[],
        many=True,
        children={
            "name": Field(css=".variant-name", type=str),
            "price": Field(css=".variant-price", type=str)
        }
    )
    
    # Seller offers
    offers = Field(
        css=".result-item",
        default=[],
        many=True,
        children={
            "seller": Field(css=".merchant", type=str),
            "price": Field(css=".currency", type=str),
            "url": Field(css=".compare-button a", attribute="href")
        }
    )

# Schema for category pages
class CategoryPageSchema(Schema):
    """Schema for extracting data from category pages."""
    page_type = PageType.CATEGORY
    
    # Category information
    category_name = Field(
        css="h1.products-heading",
        type=str,
        default=""
    )
    
    # Product listings
    products = Field(
        css=".product-box",
        default=[],
        many=True,
        children={
            "title": Field(css=".product-title", type=str),
            "url": Field(css=".product-title a", attribute="href"),
            "price": Field(css=".currency", type=str),
            "image": Field(css=".product-image img", attribute="src")
        }
    )
    
    # Pagination
    next_page_url = Field(
        css="ul.pagination li.active + li a",
        attribute="href",
        default=None
    )

async def fetch_sitemap(url: str) -> Optional[str]:
    """Fetch the sitemap XML from the given URL."""
    try:
        async with aiohttp.ClientSession() as session:
            logger.info(f"Fetching sitemap from: {url}")
            headers = {"User-Agent": USER_AGENT}
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    return await response.text()
                else:
                    logger.error(f"Failed to fetch sitemap: {response.status}")
                    return None
    except Exception as e:
        logger.error(f"Error fetching sitemap: {e}")
        return None

def extract_urls_from_sitemap(sitemap_xml: str, max_urls: int = DEFAULT_MAX_URLS) -> List[str]:
    """Extract URLs from the sitemap XML content."""
    try:
        # Parse the XML
        root = ET.fromstring(sitemap_xml)
        
        # Find all URL elements and extract the location (URL)
        urls = []
        for url_element in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url"):
            loc_element = url_element.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            if loc_element is not None and loc_element.text:
                urls.append(loc_element.text)
                
                # Check if we've reached the maximum number of URLs
                if len(urls) >= max_urls:
                    break
        
        # Shuffle the URLs to get a more diverse set
        random.shuffle(urls)
        
        logger.info(f"Extracted {len(urls)} URLs from sitemap")
        return urls
    except Exception as e:
        logger.error(f"Error extracting URLs from sitemap: {e}")
        return []

def save_results(results: Dict[str, Any], output_dir: str) -> str:
    """Save crawl results to a JSON file."""
    try:
        # Create directories based on URL path
        url_path = urlparse(results.get("url", "unknown")).path
        category_parts = url_path.strip("/").split("/")
        
        # Create a directory structure
        save_dir = output_dir
        for part in category_parts[:-1]:  # Exclude the last part (filename)
            if part:
                save_dir = os.path.join(save_dir, part)
                
        # Create the directory if it doesn't exist
        os.makedirs(save_dir, exist_ok=True)
        
        # Generate a filename based on the last part of the path and current timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        last_part = category_parts[-1] if category_parts else "unknown"
        filename = f"{last_part}_{timestamp}.json"
        
        # Save the results to a file
        file_path = os.path.join(save_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Saved results to {file_path}")
        return file_path
    except Exception as e:
        logger.error(f"Error saving results: {e}")
        return ""

async def crawl_page(url: str, browser: crawl4ai.Browser) -> Optional[Dict[str, Any]]:
    """Crawl a single page and extract data based on its type."""
    try:
        logger.info(f"Crawling URL: {url}")
        
        # Visit the page
        await browser.visit(url)
        
        # Wait for the page to load
        await browser.wait_for_navigation()
        
        # Wait for content to load
        await asyncio.sleep(2)
        
        # Determine the page type and use the appropriate schema
        page_html = await browser.get_html()
        soup = BeautifulSoup(page_html, "html.parser")
        
        # Check if it's a product page
        is_product_page = bool(soup.select(".product-info") or soup.select(".product-page"))
        
        # Choose schema based on page type
        schema = ProductPageSchema() if is_product_page else CategoryPageSchema()
        
        # Extract data using the schema
        data = await schema.extract(browser)
        
        # Add URL and timestamp to the results
        data["url"] = url
        data["crawled_at"] = datetime.now().isoformat()
        data["page_type"] = "product" if is_product_page else "category"
        
        return data
    except Exception as e:
        logger.error(f"Error crawling {url}: {e}")
        return None

async def crawl_sequentially(urls: List[str], output_dir: str) -> Tuple[int, int]:
    """Crawl URLs sequentially using a single browser session."""
    success_count = 0
    fail_count = 0
    
    try:
        # Create a single browser instance
        browser = await crawl4ai.create_browser(
            headless=True,
            default_timeout=30000,
            user_agent=USER_AGENT
        )
        
        try:
            # Process each URL sequentially
            for url in urls:
                try:
                    # Crawl the page
                    results = await crawl_page(url, browser)
                    
                    if results:
                        # Save the results
                        save_results(results, output_dir)
                        success_count += 1
                    else:
                        fail_count += 1
                        
                    # Add a small delay between requests to avoid overloading the server
                    await asyncio.sleep(random.uniform(1.0, 3.0))
                    
                except Exception as e:
                    logger.error(f"Error processing URL {url}: {e}")
                    fail_count += 1
        finally:
            # Close the browser when done
            await browser.close()
    
    except Exception as e:
        logger.error(f"Error creating browser: {e}")
        
    return success_count, fail_count

async def main_async(max_urls: int = DEFAULT_MAX_URLS, output_dir: str = DEFAULT_RESULTS_DIR):
    """Main function to run the crawler asynchronously."""
    try:
        # Create the output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Fetch the sitemap
        sitemap_xml = await fetch_sitemap(SITEMAP_URL)
        if not sitemap_xml:
            logger.error("Failed to fetch sitemap")
            return
        
        # Extract URLs from the sitemap
        urls = extract_urls_from_sitemap(sitemap_xml, max_urls)
        if not urls:
            logger.error("No URLs found in sitemap")
            return
        
        logger.info(f"Starting sequential crawl of {len(urls)} URLs")
        
        # Crawl the URLs sequentially
        start_time = time.time()
        success_count, fail_count = await crawl_sequentially(urls, output_dir)
        end_time = time.time()
        
        # Log results
        elapsed_time = end_time - start_time
        logger.info(f"Crawl completed in {elapsed_time:.2f} seconds")
        logger.info(f"Successfully crawled: {success_count} pages")
        logger.info(f"Failed: {fail_count} pages")
        logger.info(f"Results saved to: {os.path.abspath(output_dir)}")
        
    except Exception as e:
        logger.error(f"Error in main function: {e}")

def main():
    """Command-line entry point."""
    parser = argparse.ArgumentParser(description="Sequential crawler for PriceCheck.co.za")
    parser.add_argument("--max-urls", type=int, default=DEFAULT_MAX_URLS,
                        help=f"Maximum number of URLs to crawl (default: {DEFAULT_MAX_URLS})")
    parser.add_argument("--output-dir", type=str, default=DEFAULT_RESULTS_DIR,
                        help=f"Directory to save results (default: {DEFAULT_RESULTS_DIR})")
    
    args = parser.parse_args()
    
    # Run the async main function
    asyncio.run(main_async(args.max_urls, args.output_dir))

if __name__ == "__main__":
    main() 