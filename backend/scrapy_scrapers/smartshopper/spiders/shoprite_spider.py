"""
Shoprite spider for Smart Shopper ZA
"""

import scrapy
import json
import logging
from ..items import ProductItem

logger = logging.getLogger(__name__)


class ShopriteSpider(scrapy.Spider):
    """Spider for Shoprite website"""
    
    name = "shoprite"
    allowed_domains = ["shoprite.co.za"]
    
    def __init__(self, query=None, *args, **kwargs):
        super(ShopriteSpider, self).__init__(*args, **kwargs)
        self.query = query or "milk"  # Default query if none provided
        
    def start_requests(self):
        """Generate start requests based on query"""
        search_url = f"https://www.shoprite.co.za/search?q={self.query}"
        yield scrapy.Request(url=search_url, callback=self.parse)
        
    def parse(self, response):
        """Parse search results page"""
        # Find all product frames
        product_frames = response.css('.product-frame')
        
        if not product_frames:
            logger.warning("No product frames found on page")
            
        for product in product_frames:
            # Extract product data from data-product-ga attribute
            product_ga = product.css('::attr(data-product-ga)').get()
            
            if not product_ga:
                continue
                
            try:
                product_json = json.loads(product_ga)
                
                # Extract product details
                name = product_json.get('name')
                price = product_json.get('price')
                product_id = product_json.get('id')
                image_url = product_json.get('product_image_url')
                
                # Extract product URL
                product_link = product.css('a.product-listening-click::attr(href)').get()
                product_url = ''
                
                if product_link:
                    # Ensure it's a full URL
                    if product_link.startswith('/'):
                        product_url = f"https://www.shoprite.co.za{product_link}"
                    elif product_link.startswith('http'):
                        product_url = product_link
                
                # If we still don't have a URL, create one based on the product ID
                if not product_url and product_id:
                    product_url = f"https://www.shoprite.co.za/p/{product_id}"
                
                # Create product item
                if name and price and product_id:
                    item = ProductItem(
                        id=product_id,
                        name=name,
                        price=price,
                        retailer="Shoprite",
                        url=product_url,
                        image_url=image_url
                    )
                    
                    # Follow product link to get more details
                    if product_url:
                        yield scrapy.Request(
                            url=product_url,
                            callback=self.parse_product,
                            meta={'item': item}
                        )
                    else:
                        yield item
                        
            except json.JSONDecodeError:
                logger.error(f"Error decoding product JSON: {product_ga}")
                continue
                
        # Check for next page
        next_page = response.css('a.pagination-next::attr(href)').get()
        if next_page:
            yield response.follow(next_page, self.parse)
            
    def parse_product(self, response):
        """Parse product detail page"""
        item = response.meta['item']
        
        # Extract additional details
        description = response.css('.product-details-description::text').get()
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
                
        # Set currency
        item['currency'] = 'ZAR'
        
        yield item 