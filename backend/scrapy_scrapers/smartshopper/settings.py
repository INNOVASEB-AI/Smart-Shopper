"""
Scrapy settings for Smart Shopper ZA
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BOT_NAME = 'smartshopper'

SPIDER_MODULES = ['smartshopper.spiders']
NEWSPIDER_MODULE = 'smartshopper.spiders'

# Crawl responsibly by identifying yourself on the user agent
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

# Enable rotating user agents
RANDOM_UA_PER_PROXY = True
RANDOM_UA_TYPE = 'random'

# Obey robots.txt rules (set to False if retailers block bots)
ROBOTSTXT_OBEY = True

# Configure maximum concurrent requests
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 4

# Configure a delay for requests to avoid overloading servers
DOWNLOAD_DELAY = 1.5
RANDOMIZE_DOWNLOAD_DELAY = True

# Disable cookies (enabled by default)
COOKIES_ENABLED = False

# Configure item pipelines
ITEM_PIPELINES = {
    'smartshopper.pipelines.ProductValidationPipeline': 100,
    'smartshopper.pipelines.DuplicatesPipeline': 200,
    'smartshopper.pipelines.SQLitePipeline': 300,
    'smartshopper.pipelines.JsonExportPipeline': 400,
    'smartshopper.pipelines.ApiPostPipeline': 500,
}

# Enable and configure HTTP caching
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 86400  # 24 hours
HTTPCACHE_DIR = 'httpcache'
HTTPCACHE_IGNORE_HTTP_CODES = [503, 504, 403]

# Configure retry middleware
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429, 403]

# Enable Playwright for JavaScript-heavy sites
PLAYWRIGHT_BROWSER_TYPE = 'chromium'
PLAYWRIGHT_LAUNCH_OPTIONS = {
    'headless': True,
    'timeout': 30000,  # 30 seconds
}

# Logging configuration
LOG_LEVEL = 'INFO'
LOG_FILE = 'scrapy.log'

# Database settings
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./data/products.db')

# API endpoint for posting data
API_ENDPOINT = os.getenv('API_ENDPOINT', 'http://localhost:3001/api/products/batch')
API_KEY = os.getenv('API_KEY', '')

# Output directory for JSON files
OUTPUT_DIR = os.getenv('OUTPUT_DIR', './data/crawl_output')

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True) 