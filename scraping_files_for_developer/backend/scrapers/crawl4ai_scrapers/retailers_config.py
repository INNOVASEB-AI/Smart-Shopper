"""
Retailers Configuration

This module defines configuration for all supported retailers in the Smart Shopper ZA application.
It contains information needed for crawling each retailer's website.
"""

from typing import Dict, Any, List, Callable

# Define retailer configurations
RETAILERS = [
    {
        "name": "PriceCheck",
        "sitemap": "https://www.pricecheck.co.za/sitemap.xml",
        "module": "pricecheck_crawler",
        "class": "PriceCheckCrawler",
        "url_patterns": ["/offer/", "/offers/"],
        "rate_limit": (1.0, 3.0),
        "concurrency": 6,
    },
    {
        "name": "Checkers",
        "sitemap": "https://www.checkers.co.za/sitemap.xml",
        "module": "checkers_crawler",
        "class": "CheckersCrawler",
        "url_patterns": ["/p/", "/products/"],
        "rate_limit": (1.5, 3.5),
        "concurrency": 5,
    },
    {
        "name": "Shoprite",
        "sitemap": "https://www.shoprite.co.za/sitemap.xml",
        "module": "shoprite_crawler",  # To be implemented
        "class": "ShopriteCrawler",
        "url_patterns": ["/p/", "/products/"],
        "rate_limit": (1.5, 3.5),
        "concurrency": 5,
    },
    {
        "name": "PicknPay",
        "sitemap": "https://www.pnp.co.za/sitemap.xml",
        "module": "picknpay_crawler",  # To be implemented
        "class": "PicknPayCrawler",
        "url_patterns": ["/prodid/", "/products/"],
        "rate_limit": (1.0, 3.0),
        "concurrency": 6,
    },
    {
        "name": "Makro",
        "sitemap": "https://www.makro.co.za/sitemap.xml",
        "module": "makro_crawler",  # To be implemented
        "class": "MakroCrawler",
        "url_patterns": ["/p/", "/product/"],
        "rate_limit": (2.0, 4.0),  # More conservative
        "concurrency": 4,
    },
    {
        "name": "Woolworths",
        "sitemap": "https://www.woolworths.co.za/sitemap.xml",
        "module": "woolworths_crawler",  # To be implemented
        "class": "WoolworthsCrawler",
        "url_patterns": ["/prod/", "/product/"],
        "rate_limit": (2.0, 4.0),  # More conservative
        "concurrency": 4,
    }
]

def get_retailer_config(retailer_name: str) -> Dict[str, Any]:
    """
    Get configuration for a specific retailer
    
    Args:
        retailer_name: Name of the retailer
        
    Returns:
        Dictionary containing retailer configuration
    """
    for retailer in RETAILERS:
        if retailer["name"].lower() == retailer_name.lower():
            return retailer
    
    raise ValueError(f"Retailer '{retailer_name}' is not supported")

def get_all_retailer_names() -> List[str]:
    """Get a list of all supported retailer names"""
    return [retailer["name"] for retailer in RETAILERS]

def create_url_filter(retailer: Dict[str, Any]) -> Callable[[str], bool]:
    """
    Create a URL filter function for a given retailer
    
    Args:
        retailer: Retailer configuration dictionary
        
    Returns:
        Function that filters URLs based on retailer's URL patterns
    """
    patterns = retailer.get("url_patterns", [])
    
    def url_filter(url: str) -> bool:
        """Check if URL matches any of the retailer's URL patterns"""
        return any(pattern in url for pattern in patterns)
    
    return url_filter 