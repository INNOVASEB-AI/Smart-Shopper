#!/usr/bin/env python
"""
Main entry point for running Smart Shopper ZA spiders
"""

import os
import sys
import argparse
import logging
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
from dotenv import load_dotenv

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import spiders
from smartshopper.spiders.checkers_spider import CheckersSpider
from smartshopper.spiders.shoprite_spider import ShopriteSpider
from smartshopper.spiders.picknpay_spider import PicknPaySpider

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("scrapy.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def parse_args():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(description='Run Smart Shopper ZA spiders')
    
    parser.add_argument('--spider', '-s', type=str, required=True,
                        choices=['checkers', 'shoprite', 'picknpay', 'all'],
                        help='Spider to run')
    
    parser.add_argument('--query', '-q', type=str, default=None,
                        help='Search query')
    
    parser.add_argument('--output', '-o', type=str, default=None,
                        help='Output file path')
    
    parser.add_argument('--format', '-f', type=str, default='json',
                        choices=['json', 'csv', 'xml'],
                        help='Output format')
    
    parser.add_argument('--log-level', '-l', type=str, default='INFO',
                        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                        help='Log level')
    
    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_args()
    
    # Configure settings
    settings = get_project_settings()
    settings.set('LOG_LEVEL', args.log_level)
    
    # Create crawler process
    process = CrawlerProcess(settings)
    
    # Prepare output file path
    output_file = args.output
    
    # Prepare spider-specific settings
    spider_kwargs = {}
    if args.query:
        spider_kwargs['query'] = args.query
    
    # Add spiders to process
    if args.spider == 'all' or args.spider == 'checkers':
        process.crawl(CheckersSpider, **spider_kwargs)
        
    if args.spider == 'all' or args.spider == 'shoprite':
        process.crawl(ShopriteSpider, **spider_kwargs)
        
    if args.spider == 'all' or args.spider == 'picknpay':
        process.crawl(PicknPaySpider, **spider_kwargs)
    
    # Start crawling
    logger.info(f"Starting {args.spider} spider(s) with query: {args.query or 'default'}")
    process.start()
    logger.info("Crawling completed")


if __name__ == '__main__':
    main() 