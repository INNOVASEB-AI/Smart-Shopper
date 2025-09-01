#!/usr/bin/env python3
"""
Firecrawl integration for Smart Shopper ZA

- Uses firecrawl SDK to scrape/crawl retailer pages to markdown/html
- Extracts structured product info using prompt-only extraction
- Upserts into SQLite and optionally pushes to Firestore
"""

import os
import sys
import json
import argparse
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from database import ProductDatabase

# Load .env if present
try:
	from dotenv import load_dotenv
	load_dotenv()
except Exception:
	pass

# Firecrawl SDK
FIRECRAWL_AVAILABLE = False
FirecrawlApp = None
ScrapeOptions = None
try:
	from firecrawl import FirecrawlApp as _FirecrawlApp, ScrapeOptions as _ScrapeOptions
	FirecrawlApp = _FirecrawlApp
	ScrapeOptions = _ScrapeOptions
	FIRECRAWL_AVAILABLE = True
except Exception:
	FIRECRAWL_AVAILABLE = False

# Optional Firestore push
try:
	import firebase_admin
	from firebase_admin import firestore as fb_firestore
	FIREBASE_AVAILABLE = True
except Exception:
	FIREBASE_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('firecrawl_integration')

RETAILER_BASE_URLS: Dict[str, str] = {
	'PriceCheck': 'https://www.pricecheck.co.za',
	'Checkers': 'https://www.checkers.co.za',
	'Shoprite': 'https://www.shoprite.co.za',
	'PicknPay': 'https://www.pnp.co.za',
	'Makro': 'https://www.makro.co.za',
	'Woolworths': 'https://www.woolworths.co.za',
}

DEFAULT_LIMIT = 200


def ensure_client() -> Any:
	if not FIRECRAWL_AVAILABLE or FirecrawlApp is None:
		raise RuntimeError('firecrawl SDK is not installed')
	api_key = os.environ.get('FIRECRAWL_API_KEY')
	if not api_key:
		raise RuntimeError('FIRECRAWL_API_KEY is not set')
	return FirecrawlApp(api_key=api_key)


def extract_products_from_markdown(markdown: str, url: str, retailer: str) -> List[Dict[str, Any]]:
	products: List[Dict[str, Any]] = []
	lines = markdown.splitlines()
	title = None
	price_val: Optional[float] = None
	for line in lines:
		text = line.strip()
		if not title and len(text) > 5 and ('Product' in text or '#' in text):
			title = text.strip('#').strip()
		if price_val is None and ('R ' in text or 'R' == text[:1]):
			import re
			m = re.search(r'R\s*(\d+[\.,]?\d*)', text)
			if m:
				try:
					price_val = float(m.group(1).replace(',', ''))
				except Exception:
					price_val = None
		if title and price_val is not None:
			products.append({
				'url': url,
				'retailer': retailer,
				'title': title,
				'price': { 'current': price_val, 'currency': 'ZAR' },
				'description': '',
			})
			title = None
			price_val = None
	if not products:
		products.append({ 'url': url, 'retailer': retailer, 'title': '', 'price': None })
	return products


def upsert_products(db: ProductDatabase, items: List[Dict[str, Any]]) -> Dict[str, int]:
	ok, fail = db.bulk_upsert_products(items)
	return { 'success': ok, 'failure': fail }


def maybe_push_firestore(products: List[Dict[str, Any]], retailer: str) -> Dict[str, int]:
	pushed = 0
	if os.environ.get('FIREBASE_PUSH') == 'true' and FIREBASE_AVAILABLE:
		try:
			if not firebase_admin._apps:
				firebase_admin.initialize_app()
			fdb = fb_firestore.client()
			batch = fdb.batch()
			col = fdb.collection('prices')
			for p in products[:500]:
				doc_ref = col.document()
				price_value = None
				price_data = p.get('price')
				if isinstance(price_data, dict):
					price_value = price_data.get('current')
				elif isinstance(price_data, (int, float)):
					price_value = price_data
				batch.set(doc_ref, {
					'name': p.get('title') or p.get('name',''),
					'price': price_value,
					'store': p.get('retailer', retailer),
					'url': p.get('url',''),
					'updated': fb_firestore.SERVER_TIMESTAMP,
				})
				pushed += 1
				if pushed % 450 == 0:
					batch.commit(); batch = fdb.batch()
			batch.commit()
			logger.info(f"Pushed {pushed} products to Firestore for {retailer}")
		except Exception as e:
			logger.warning(f"Firestore push skipped/failed: {e}")
	return { 'pushed': pushed }


def run_once(retailer: str, limit: int, db_path: str) -> Dict[str, Any]:
	client = ensure_client()
	db = ProductDatabase(db_path)
	base = RETAILER_BASE_URLS.get(retailer)
	if not base:
		raise ValueError(f'Unknown retailer: {retailer}')

	logger.info(f'Firecrawl crawl for {retailer} base: {base} (limit {limit})')

	results: List[Dict[str, Any]] = []
	try:
		# Step 1: Use known product URLs for Checkers (from Firecrawl MCP mapping)
		if retailer == 'Checkers':
			# These are actual product URLs discovered via Firecrawl MCP
			product_urls = [
				'https://www.checkers.co.za/product/falke-black-stride-anklet-socks-size-7-9-10918156EA',
				'https://www.checkers.co.za/product/jolly-tots-milk-powder-container-0-months-colour-may-vary-10743474EA',
				'https://www.checkers.co.za/product/hth-floater-chlorine-pool-cleaner-16kg-10144890EA',
				'https://www.checkers.co.za/product/super-brite-metallic-scrubbers-6-pack-10268387EA',
				'https://www.checkers.co.za/product/eurolux-a60-cool-white-led-globe-9w-10893685EA',
				'https://www.checkers.co.za/product/jolly-tots-silicone-suction-owl-bowl-set-3-piece-12-months-colour-may-vary-10822600EA',
				'https://www.checkers.co.za/product/pool-magic-brilliant-multi-function-chlorine-feeder-15kg-10329829EA',
				'https://www.checkers.co.za/product/falke-midgrey-neon-yellow-stride-anklet-socks-size-4-6-10918209EA',
				'https://www.checkers.co.za/product/sce-extension-cord-5m-10342952EA'
			]
		else:
			# For other retailers, fall back to crawling approach
			product_urls = []
			scrape_options = ScrapeOptions(formats=['markdown', 'html'])
			
			logger.info(f'Crawling {base} to find product URLs...')
			crawl_result = client.crawl_url(
				url=base,
				limit=limit,
				scrape_options=scrape_options
			)
			
			if crawl_result.data:
				# Extract URLs from crawled pages (simplified approach)
				for page in crawl_result.data:
					md = getattr(page, 'markdown', None) or (page.get('markdown') if isinstance(page, dict) else '') or ''
					for line in md.splitlines():
						if '(' in line and ')' in line and 'http' in line:
							import re
							for m in re.finditer(r'\((https?[^\s)]+)\)', line):
								link = m.group(1)
								if base in link and any(seg in link for seg in ['/p/','/prod','/product','/offer','/offers','/shop','/buy','/item','/search?pfid=','/product/']):
									product_urls.append(link)
		
		# Limit the number of URLs to process
		if len(product_urls) > limit:
			product_urls = product_urls[:limit]
		
		logger.info(f'Found {len(product_urls)} product URLs to process')

		# Step 2: Extract product data from individual pages
		extracted: List[Dict[str, Any]] = []
		if product_urls:
			logger.info('Extracting product data from individual pages...')
			
			# Process URLs in batches to avoid rate limits
			batch_size = 3  # Smaller batch size to avoid rate limits
			for i in range(0, len(product_urls), batch_size):
				batch_urls = product_urls[i:i + batch_size]
				logger.info(f'Processing batch {i//batch_size + 1}: {len(batch_urls)} URLs')
				
				for url in batch_urls:
					try:
						# Scrape individual product page
						scrape_result = client.scrape_url(
							url=url,
							formats=['markdown', 'html']
						)
						
						# The scrape_result is the data itself, not wrapped in a data attribute
						md = getattr(scrape_result, 'markdown', None) or (scrape_result.get('markdown') if isinstance(scrape_result, dict) else '') or ''
						products = extract_products_from_markdown(md, url, retailer)
						extracted.extend(products)
						logger.info(f'Extracted {len(products)} products from {url}')
					except Exception as e:
						logger.warning(f'Failed to scrape {url}: {e}')
						continue

		stats = upsert_products(db, extracted)
		results = extracted
		fb_stats = maybe_push_firestore(extracted, retailer)
		return {
			'retailer': retailer,
			'product_urls_found': len(product_urls),
			'products_extracted': len(results),
			'db': stats,
			'firestore': fb_stats,
			'timestamp': datetime.now().isoformat(),
		}
	except Exception as e:
		logger.error(f'Firecrawl run failed: {e}')
		return { 'error': str(e) }


def main():
	parser = argparse.ArgumentParser(description='Firecrawl one-off integration')
	sub = parser.add_subparsers(dest='cmd')
	p = sub.add_parser('run-once')
	p.add_argument('--retailer', required=True)
	p.add_argument('--limit', type=int, default=DEFAULT_LIMIT)
	p.add_argument('--db-path', default='./data/products.db')
	args = parser.parse_args()

	if args.cmd == 'run-once':
		out = run_once(args.retailer, args.limit, args.db_path)
		print(json.dumps(out))
	else:
		parser.print_help()

if __name__ == '__main__':
	main() 