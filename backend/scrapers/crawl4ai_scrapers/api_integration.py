"""
API Integration for Crawled Product Data

This module provides functions to integrate the crawled product data with the search API.
It allows searching the product database and returning results in a format compatible
with the existing API.
"""

import os
import sys
import asyncio
import logging
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

# Import database
from database import ProductDatabase

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("api_integration")

def normalize_product(product: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize product data to ensure consistent format across retailers
    
    Args:
        product: Raw product data
        
    Returns:
        Normalized product data with consistent field names and structure
    """
    normalized = {
        "id": product.get("id", product.get("product_id", str(hash(product.get("url", ""))))),
        "name": product.get("name", product.get("title", "")),
        "url": product.get("url", product.get("product_link", "")),
        "image": "",
        "price": None,
        "original_price": None,
        "currency": "ZAR",
        "description": "",
        "brand": "",
        "category": "",
        "retailer": product.get("retailer", "unknown"),
        "in_stock": True,
        "rating": None,
        "specifications": {},
        "merchants": [],
        "images": [],
        "timestamp": datetime.now().isoformat()
    }
    
    # Handle price field variations
    if "price" in product:
        if isinstance(product["price"], dict):
            normalized["price"] = product["price"].get("current")
            normalized["original_price"] = product["price"].get("original")
            normalized["currency"] = product["price"].get("currency", "ZAR")
        elif isinstance(product["price"], (int, float)):
            normalized["price"] = product["price"]
        elif isinstance(product["price"], str):
            try:
                # Try to parse price from string (e.g. "R 199.99")
                price_str = product["price"].replace("R", "").replace(",", "").strip()
                normalized["price"] = float(price_str)
            except (ValueError, TypeError):
                pass
    
    # Handle image field variations
    if "image" in product:
        normalized["image"] = product["image"]
    elif "images" in product and product["images"]:
        if isinstance(product["images"], list) and len(product["images"]) > 0:
            normalized["image"] = product["images"][0]
            normalized["images"] = product["images"]
    elif "main_image" in product:
        normalized["image"] = product["main_image"]
    
    # Copy remaining fields if they exist
    for field in ["description", "brand", "category", "in_stock", "rating", "specifications"]:
        if field in product:
            normalized[field] = product[field]
    
    # Handle merchants
    if "merchants" in product and isinstance(product["merchants"], list):
        normalized["merchants"] = product["merchants"]
    elif "store" in product:
        normalized["merchants"] = [{"name": product["store"], "price": normalized["price"]}]
    
    # Ensure merchants have consistent format
    if normalized["merchants"]:
        for merchant in normalized["merchants"]:
            if isinstance(merchant, dict):
                if "name" not in merchant:
                    merchant["name"] = merchant.get("store", "Unknown")
                if "price" not in merchant and normalized["price"]:
                    merchant["price"] = normalized["price"]
                if "url" not in merchant:
                    merchant["url"] = ""
    
    return normalized

class ProductSearchAPI:
    """
    API for searching products in the database
    """
    
    def __init__(self, db_path: str = "./data/products.db"):
        """
        Initialize the product search API
        
        Args:
            db_path: Path to the SQLite database file
        """
        self.db = ProductDatabase(db_path)
        logger.info(f"Initialized product search API with database: {db_path}")
    
    def search_products(
        self,
        query: str = None,
        retailer: str = None,
        category: str = None,
        brand: str = None,
        min_price: float = None,
        max_price: float = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search for products in the database
        
        Args:
            query: Search query string
            retailer: Filter by retailer
            category: Filter by category
            brand: Filter by brand
            min_price: Minimum price
            max_price: Maximum price
            limit: Maximum number of results to return
            offset: Offset for pagination
            
        Returns:
            Dictionary containing search results and metadata
        """
        try:
            # Search the database
            start_time = datetime.now()
            products, total_count = self.db.find_products(
                query=query,
                retailer=retailer,
                category=category,
                brand=brand,
                min_price=min_price,
                max_price=max_price,
                limit=limit,
                offset=offset
            )
            end_time = datetime.now()
            
            # Duration in milliseconds
            duration_ms = (end_time - start_time).total_seconds() * 1000
            
            # Normalize all products for consistent format
            normalized_products = [normalize_product(product) for product in products]
            
            # Group results by retailer
            results_by_retailer = {}
            for product in normalized_products:
                retailer_name = product.get("retailer", "unknown")
                if retailer_name not in results_by_retailer:
                    results_by_retailer[retailer_name] = []
                results_by_retailer[retailer_name].append(product)
            
            # Format response in a way compatible with the existing API
            response = {
                "query": query,
                "results": results_by_retailer,
                "totalProducts": total_count,
                "timestamp": datetime.now().isoformat(),
                "duration_ms": duration_ms,
                "from_database": True
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Error searching products: {str(e)}")
            return {
                "query": query,
                "results": {},
                "totalProducts": 0,
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }
    
    def get_product_details(self, product_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific product
        
        Args:
            product_id: ID of the product to retrieve
            
        Returns:
            Dictionary containing product details or error message
        """
        try:
            product = self.db.get_product_by_id(product_id)
            
            if product:
                # Normalize product data for consistent format
                normalized_product = normalize_product(product)
                
                return {
                    "product": normalized_product,
                    "timestamp": datetime.now().isoformat(),
                    "from_database": True
                }
            else:
                return {
                    "error": f"Product not found: {product_id}",
                    "timestamp": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error getting product details: {str(e)}")
            return {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_database_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the product database
        
        Returns:
            Dictionary containing database statistics
        """
        try:
            stats = self.db.get_database_stats()
            
            return {
                "stats": stats,
                "timestamp": datetime.now().isoformat()
            }
                
        except Exception as e:
            logger.error(f"Error getting database stats: {str(e)}")
            return {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Singleton instance for use in Node.js integration
_default_api = None

def get_default_api(db_path: str = "./data/products.db") -> ProductSearchAPI:
    """
    Get the default ProductSearchAPI instance
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        ProductSearchAPI instance
    """
    global _default_api
    if _default_api is None:
        _default_api = ProductSearchAPI(db_path)
    return _default_api

# Function to be called from Node.js
def search_products_nodejs(
    query: str = None,
    retailer: str = None,
    category: str = None,
    brand: str = None,
    min_price: float = None,
    max_price: float = None,
    limit: int = 100,
    offset: int = 0,
    db_path: str = "./data/products.db"
) -> str:
    """
    Search for products in the database, for use from Node.js
    
    This function is designed to be called from Node.js via Python child process,
    returning a JSON string that can be parsed on the JS side.
    
    Args:
        query: Search query string
        retailer: Filter by retailer
        category: Filter by category
        brand: Filter by brand
        min_price: Minimum price
        max_price: Maximum price
        limit: Maximum number of results to return
        offset: Offset for pagination
        db_path: Path to the SQLite database file
        
    Returns:
        JSON string containing search results and metadata
    """
    try:
        # Convert min_price and max_price to float if they're strings
        if isinstance(min_price, str) and min_price:
            min_price = float(min_price)
        if isinstance(max_price, str) and max_price:
            max_price = float(max_price)
        
        # Convert limit and offset to int if they're strings
        if isinstance(limit, str) and limit:
            limit = int(limit)
        if isinstance(offset, str) and offset:
            offset = int(offset)
        
        # Get API instance
        api = get_default_api(db_path)
        
        # Search products
        results = api.search_products(
            query=query,
            retailer=retailer,
            category=category,
            brand=brand,
            min_price=min_price,
            max_price=max_price,
            limit=limit,
            offset=offset
        )
        
        # Convert to JSON string
        return json.dumps(results)
        
    except Exception as e:
        logger.error(f"Error in search_products_nodejs: {str(e)}")
        return json.dumps({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

def get_product_details_nodejs(
    product_id: str,
    db_path: str = "./data/products.db"
) -> str:
    """
    Get detailed information about a specific product, for use from Node.js
    
    Args:
        product_id: ID of the product to retrieve
        db_path: Path to the SQLite database file
        
    Returns:
        JSON string containing product details or error message
    """
    try:
        # Get API instance
        api = get_default_api(db_path)
        
        # Get product details
        results = api.get_product_details(product_id)
        
        # Convert to JSON string
        return json.dumps(results)
        
    except Exception as e:
        logger.error(f"Error in get_product_details_nodejs: {str(e)}")
        return json.dumps({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

def get_database_stats_nodejs(
    db_path: str = "./data/products.db"
) -> str:
    """
    Get statistics about the product database, for use from Node.js
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        JSON string containing database statistics
    """
    try:
        # Get API instance
        api = get_default_api(db_path)
        
        # Get database stats
        results = api.get_database_stats()
        
        # Convert to JSON string
        return json.dumps(results)
        
    except Exception as e:
        logger.error(f"Error in get_database_stats_nodejs: {str(e)}")
        return json.dumps({
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })

# If executed as a script, provide command-line interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Product Search API")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Search command
    search_parser = subparsers.add_parser("search", help="Search for products")
    search_parser.add_argument("--query", help="Search query")
    search_parser.add_argument("--retailer", help="Filter by retailer")
    search_parser.add_argument("--category", help="Filter by category")
    search_parser.add_argument("--brand", help="Filter by brand")
    search_parser.add_argument("--min-price", type=float, help="Minimum price")
    search_parser.add_argument("--max-price", type=float, help="Maximum price")
    search_parser.add_argument("--limit", type=int, default=100, help="Maximum number of results")
    search_parser.add_argument("--offset", type=int, default=0, help="Offset for pagination")
    search_parser.add_argument("--db-path", default="./data/products.db", help="Path to database")
    
    # Product details command
    details_parser = subparsers.add_parser("details", help="Get product details")
    details_parser.add_argument("product_id", help="ID of the product to retrieve")
    details_parser.add_argument("--db-path", default="./data/products.db", help="Path to database")
    
    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Get database statistics")
    stats_parser.add_argument("--db-path", default="./data/products.db", help="Path to database")
    
    args = parser.parse_args()
    
    if args.command == "search":
        result = search_products_nodejs(
            query=args.query,
            retailer=args.retailer,
            category=args.category,
            brand=args.brand,
            min_price=args.min_price,
            max_price=args.max_price,
            limit=args.limit,
            offset=args.offset,
            db_path=args.db_path
        )
        print(result)
        
    elif args.command == "details":
        result = get_product_details_nodejs(
            product_id=args.product_id,
            db_path=args.db_path
        )
        print(result)
        
    elif args.command == "stats":
        result = get_database_stats_nodejs(
            db_path=args.db_path
        )
        print(result)
        
    else:
        parser.print_help() 