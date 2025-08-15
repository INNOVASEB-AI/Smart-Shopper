"""
Pick n Pay spider for Smart Shopper ZA
"""

import scrapy
import logging
import json
from scrapy_playwright.page import PageMethod
from ..items import ProductItem

logger = logging.getLogger(__name__)


class PicknPaySpider(scrapy.Spider):
    """Spider for Pick n Pay website using Playwright"""
    
    name = "picknpay"
    allowed_domains = ["pnp.co.za"]
    
    # This spider requires Playwright
    custom_settings = {
        'DOWNLOAD_HANDLERS': {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        'TWISTED_REACTOR': "twisted.internet.asyncioreactor.AsyncioSelectorReactor",
        'PLAYWRIGHT_BROWSER_TYPE': 'chromium',
        'PLAYWRIGHT_LAUNCH_OPTIONS': {
            'headless': True,
            'timeout': 30000,  # 30 seconds
        },
        # Slow down the crawl to avoid being blocked
        'DOWNLOAD_DELAY': 2.5,
    }
    
    def __init__(self, query=None, *args, **kwargs):
        super(PicknPaySpider, self).__init__(*args, **kwargs)
        self.query = query or "milk"  # Default query if none provided
        
    def start_requests(self):
        """Generate start requests based on query"""
        search_url = f"https://www.pnp.co.za/search/{self.query}"
        
        yield scrapy.Request(
            url=search_url,
            callback=self.parse,
            meta={
                "playwright": True,
                "playwright_include_page": True,
                "playwright_page_methods": [
                    # Wait for product grid to load
                    PageMethod("wait_for_selector", "div.product-grid-item", timeout=30000),
                    # Scroll down to load more products
                    PageMethod("evaluate", "window.scrollBy(0, document.body.scrollHeight)"),
                    # Wait a bit for any lazy-loaded content
                    PageMethod("wait_for_timeout", 2000),
                ]
            }
        )
        
    async def parse(self, response):
        """Parse search results page"""
        page = response.meta["playwright_page"]
        
        try:
            # Find all product items
            product_items = response.css('div.product-grid-item')
            
            if not product_items:
                logger.warning("No product items found on page")
                
            for product in product_items:
                # Extract product details
                name = product.css('.product-name::text').get()
                if not name:
                    continue
                    
                name = name.strip()
                
                # Extract price
                price_text = product.css('.product-price::text').get()
                if not price_text:
                    continue
                    
                # Clean up price string
                price_text = price_text.replace('R', '').replace(',', '.').strip()
                try:
                    price = float(price_text)
                except ValueError:
                    logger.warning(f"Could not parse price: {price_text}")
                    continue
                
                # Extract product URL
                product_url = product.css('a.product-link::attr(href)').get()
                if product_url:
                    if not product_url.startswith('http'):
                        product_url = f"https://www.pnp.co.za{product_url}"
                else:
                    continue
                
                # Extract product ID from URL
                product_id = product_url.split('/')[-1] if '/' in product_url else None
                if not product_id:
                    product_id = f"pnp_{hash(product_url)}"
                
                # Extract image URL
                image_url = product.css('.product-image img::attr(src)').get()
                
                # Create product item
                item = ProductItem(
                    id=product_id,
                    name=name,
                    price=price,
                    retailer="Pick n Pay",
                    url=product_url,
                    image_url=image_url,
                    currency="ZAR"
                )
                
                # Follow product link to get more details
                yield scrapy.Request(
                    url=product_url,
                    callback=self.parse_product,
                    meta={
                        "item": item,
                        "playwright": True,
                        "playwright_include_page": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_selector", ".product-detail", timeout=30000),
                        ]
                    }
                )
                
            # Check for next page
            next_page = response.css('a.pagination-next::attr(href)').get()
            if next_page:
                yield response.follow(
                    next_page,
                    callback=self.parse,
                    meta={
                        "playwright": True,
                        "playwright_include_page": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_selector", "div.product-grid-item", timeout=30000),
                            PageMethod("evaluate", "window.scrollBy(0, document.body.scrollHeight)"),
                            PageMethod("wait_for_timeout", 2000),
                        ]
                    }
                )
                
        finally:
            # Close the page to free resources
            await page.close()
            
    async def parse_product(self, response):
        """Parse product detail page"""
        page = response.meta["playwright_page"]
        
        try:
            item = response.meta['item']
            
            # Extract additional details
            description = response.css('.product-description::text').get()
            if description:
                item['description'] = description.strip()
                
            # Extract brand
            brand = response.css('.product-brand::text').get()
            if brand:
                item['brand'] = brand.strip()
                
            # Extract category
            breadcrumbs = response.css('.breadcrumb-item a::text').getall()
            if breadcrumbs and len(breadcrumbs) > 1:
                item['category'] = breadcrumbs[-2].strip()
                
            # Extract original price if on sale
            original_price = response.css('.original-price::text').get()
            if original_price:
                # Clean up price string
                original_price = original_price.replace('R', '').replace(',', '.').strip()
                try:
                    item['original_price'] = float(original_price)
                except ValueError:
                    pass
                    
            # Extract weight/size information
            size_text = response.css('.product-size::text').get()
            if size_text:
                item['size'] = size_text.strip()
                
            yield item
            
        finally:
            # Close the page to free resources
            await page.close() 