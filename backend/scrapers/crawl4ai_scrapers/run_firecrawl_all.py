#!/usr/bin/env python3
"""
Run Firecrawl for all retailers in sequence
"""

import os
import sys
import json
import logging
from typing import List, Dict, Any
from datetime import datetime

from firecrawl_integration import run_once, RETAILER_BASE_URLS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('firecrawl_all')

def run_all_retailers(limit: int = 200, db_path: str = './data/products.db') -> Dict[str, Any]:
    """
    Run Firecrawl for all configured retailers
    
    Args:
        limit: Maximum number of products per retailer
        db_path: Path to the SQLite database
        
    Returns:
        Dictionary with results for each retailer
    """
    results = {}
    retailers = list(RETAILER_BASE_URLS.keys())
    
    logger.info(f"Starting Firecrawl for {len(retailers)} retailers: {', '.join(retailers)}")
    
    for retailer in retailers:
        try:
            logger.info(f"Processing {retailer}...")
            result = run_once(retailer, limit, db_path)
            results[retailer] = result
            logger.info(f"Completed {retailer}: {result.get('products_extracted', 0)} products extracted")
        except Exception as e:
            logger.error(f"Failed to process {retailer}: {e}")
            results[retailer] = {'error': str(e)}
    
    # Summary
    total_products = sum(
        result.get('products_extracted', 0) 
        for result in results.values() 
        if isinstance(result, dict) and 'products_extracted' in result
    )
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'total_retailers': len(retailers),
        'total_products': total_products,
        'results': results
    }
    
    logger.info(f"Crawl completed: {total_products} total products from {len(retailers)} retailers")
    return summary

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Run Firecrawl for all retailers')
    parser.add_argument('--limit', type=int, default=200, help='Maximum products per retailer')
    parser.add_argument('--db-path', default='./data/products.db', help='Database path')
    parser.add_argument('--output', help='Output file for results (optional)')
    
    args = parser.parse_args()
    
    try:
        results = run_all_retailers(args.limit, args.db_path)
        
        # Print results as JSON
        print(json.dumps(results, indent=2))
        
        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            logger.info(f"Results saved to {args.output}")
            
    except Exception as e:
        logger.error(f"Failed to run Firecrawl: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main() 