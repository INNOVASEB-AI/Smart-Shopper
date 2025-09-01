#!/usr/bin/env python3
"""
API Integration Script for Smart Shopper ZA Database

This script provides a command-line interface to the database functions
for testing and debugging the data pipeline.

Usage:
    python api_integration.py search --query "milk" --limit 10
    python api_integration.py details <product_id>
    python api_integration.py stats
"""

import argparse
import json
import sys
import os
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import ProductDatabase

def search_products(args):
    """Search for products in the database"""
    try:
        db = ProductDatabase(args.db_path)
        
        # Build search options
        search_options = {}
        if args.query:
            search_options['query'] = args.query
        if args.retailer:
            search_options['retailer'] = args.retailer
        if args.category:
            search_options['category'] = args.category
        if args.brand:
            search_options['brand'] = args.brand
        if args.min_price:
            search_options['min_price'] = float(args.min_price)
        if args.max_price:
            search_options['max_price'] = float(args.max_price)
        if args.limit:
            search_options['limit'] = int(args.limit)
        if args.offset:
            search_options['offset'] = int(args.offset)
        
        # Search the database
        products, total_count = db.find_products(**search_options)
        
        # Format results for API response
        results = {
            'query': args.query or '*',
            'totalProducts': total_count,
            'limit': search_options.get('limit', 100),
            'offset': search_options.get('offset', 0),
            'results': {}
        }
        
        # Group products by retailer
        for product in products:
            retailer = product.get('retailer', 'Unknown')
            if retailer not in results['results']:
                results['results'][retailer] = []
            
            # Format product for API response
            formatted_product = {
                'id': product.get('id', ''),
                'name': product.get('title', ''),
                'price': product.get('price', {}).get('current') if isinstance(product.get('price'), dict) else product.get('price'),
                'retailer': retailer,
                'store': retailer,
                'url': product.get('url', ''),
                'imageUrl': product.get('imageUrl', ''),
                'brand': product.get('brand', ''),
                'category': product.get('category', '')
            }
            
            results['results'][retailer].append(formatted_product)
        
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'query': args.query or '*',
            'totalProducts': 0,
            'results': {}
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

def get_product_details(args):
    """Get details for a specific product"""
    try:
        db = ProductDatabase(args.db_path)
        product = db.get_product_by_id(args.product_id)
        
        if product:
            # Format product for API response
            formatted_product = {
                'id': product.get('id', ''),
                'name': product.get('title', ''),
                'price': product.get('price', {}).get('current') if isinstance(product.get('price'), dict) else product.get('price'),
                'retailer': product.get('retailer', ''),
                'store': product.get('retailer', ''),
                'url': product.get('url', ''),
                'imageUrl': product.get('imageUrl', ''),
                'brand': product.get('brand', ''),
                'category': product.get('category', ''),
                'description': product.get('description', ''),
                'data': product  # Include full product data
            }
            
            print(json.dumps(formatted_product, indent=2))
        else:
            error_result = {
                'error': f'Product with ID {args.product_id} not found',
                'product_id': args.product_id
            }
            print(json.dumps(error_result, indent=2))
            sys.exit(1)
            
    except Exception as e:
        error_result = {
            'error': str(e),
            'product_id': args.product_id
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

def get_database_stats(args):
    """Get database statistics"""
    try:
        db = ProductDatabase(args.db_path)
        stats = db.get_database_stats()
        
        # Format stats for API response
        formatted_stats = {
            'totalProducts': stats.get('total_products', 0),
            'retailerCounts': stats.get('retailer_counts', {}),
            'lastUpdated': stats.get('last_updated'),
            'databasePath': args.db_path,
            'databaseSize': stats.get('database_size', 'Unknown')
        }
        
        print(json.dumps(formatted_stats, indent=2))
        
    except Exception as e:
        error_result = {
            'error': str(e),
            'databasePath': args.db_path
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

def main():
    # Create the main parser
    parser = argparse.ArgumentParser(description='Smart Shopper ZA Database API Integration')
    parser.add_argument('--db-path', default='./data/products.db', help='Path to the SQLite database file')
    
    # Create subparsers for commands
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Search command
    search_parser = subparsers.add_parser('search', help='Search for products')
    search_parser.add_argument('--query', help='Search query')
    search_parser.add_argument('--retailer', help='Filter by retailer')
    search_parser.add_argument('--category', help='Filter by category')
    search_parser.add_argument('--brand', help='Filter by brand')
    search_parser.add_argument('--min-price', help='Minimum price')
    search_parser.add_argument('--max-price', help='Maximum price')
    search_parser.add_argument('--limit', type=int, default=100, help='Maximum number of results')
    search_parser.add_argument('--offset', type=int, default=0, help='Offset for pagination')
    
    # Details command
    details_parser = subparsers.add_parser('details', help='Get product details')
    details_parser.add_argument('product_id', help='Product ID')
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Get database statistics')
    
    # Parse arguments
    args = parser.parse_args()
    
    if args.command == 'search':
        search_products(args)
    elif args.command == 'details':
        get_product_details(args)
    elif args.command == 'stats':
        get_database_stats(args)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == '__main__':
    main() 