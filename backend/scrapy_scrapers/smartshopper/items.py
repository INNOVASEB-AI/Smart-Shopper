"""
Item definitions for Smart Shopper ZA
"""

import scrapy


class ProductItem(scrapy.Item):
    """Product item definition"""
    id = scrapy.Field()
    name = scrapy.Field()
    price = scrapy.Field()
    original_price = scrapy.Field()
    currency = scrapy.Field()
    description = scrapy.Field()
    brand = scrapy.Field()
    category = scrapy.Field()
    url = scrapy.Field()
    image_url = scrapy.Field()
    retailer = scrapy.Field()
    in_stock = scrapy.Field()
    rating = scrapy.Field()
    review_count = scrapy.Field()
    sku = scrapy.Field()
    upc = scrapy.Field()
    weight = scrapy.Field()
    weight_unit = scrapy.Field()
    size = scrapy.Field()
    timestamp = scrapy.Field()
    extra = scrapy.Field()  # For any additional data 