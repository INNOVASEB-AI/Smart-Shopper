"""
Item pipelines for Smart Shopper ZA
"""

import os
import json
import time
import logging
import sqlite3
import requests
from datetime import datetime
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem

logger = logging.getLogger(__name__)


class ProductValidationPipeline:
    """Pipeline for validating product items"""
    
    def process_item(self, item, spider):
        """Validate required fields"""
        adapter = ItemAdapter(item)
        
        # Check required fields
        required_fields = ['name', 'price', 'url', 'retailer']
        missing_fields = [field for field in required_fields if not adapter.get(field)]
        
        if missing_fields:
            raise DropItem(f"Missing required fields: {', '.join(missing_fields)}")
            
        # Generate ID if not present
        if not adapter.get('id'):
            url = adapter.get('url', '')
            # Extract ID from URL or generate timestamp-based ID
            url_parts = url.split('/')
            item_id = url_parts[-1] if url_parts and url_parts[-1] else str(int(time.time() * 1000))
            adapter['id'] = item_id
            
        # Add timestamp if not present
        if not adapter.get('timestamp'):
            adapter['timestamp'] = datetime.now().isoformat()
            
        # Ensure price is a float
        try:
            if isinstance(adapter.get('price'), str):
                # Remove currency symbols and commas
                price_str = adapter.get('price')
                price_str = price_str.replace('R', '').replace(',', '').strip()
                adapter['price'] = float(price_str)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert price to float: {adapter.get('price')}")
            
        return item


class DuplicatesPipeline:
    """Pipeline for filtering duplicate items"""
    
    def __init__(self):
        self.ids_seen = set()
        
    def process_item(self, item, spider):
        """Drop items with duplicate IDs"""
        adapter = ItemAdapter(item)
        item_id = adapter.get('id')
        
        if item_id in self.ids_seen:
            raise DropItem(f"Duplicate item found: {item_id}")
        else:
            self.ids_seen.add(item_id)
            return item


class SQLitePipeline:
    """Pipeline for storing items in SQLite database"""
    
    def __init__(self, db_url):
        self.db_url = db_url
        
    @classmethod
    def from_crawler(cls, crawler):
        """Get database URL from settings"""
        return cls(
            db_url=crawler.settings.get('DATABASE_URL', 'sqlite:///./data/products.db')
        )
        
    def open_spider(self, spider):
        """Initialize database connection"""
        # Extract path from SQLite URL
        if self.db_url.startswith('sqlite:///'):
            db_path = self.db_url[10:]
            # Ensure directory exists
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
            self.conn = sqlite3.connect(db_path)
        else:
            # For now, only support SQLite
            # Later we'll add PostgreSQL support
            logger.warning(f"Unsupported database URL: {self.db_url}, falling back to SQLite")
            db_path = './data/products.db'
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
            self.conn = sqlite3.connect(db_path)
            
        self.cursor = self.conn.cursor()
        
        # Create tables if they don't exist
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            retailer TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            brand TEXT,
            category TEXT,
            url TEXT NOT NULL,
            image_url TEXT,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        ''')
        
        # Create indexes
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_retailer ON products(retailer)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_name ON products(name)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_brand ON products(brand)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_category ON products(category)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_price ON products(price)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_updated_at ON products(updated_at)')
        
        # Create product_search table for full-text search
        self.cursor.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS product_search
        USING fts5(id, name, description, brand, category, tokenize='porter')
        ''')
        
        self.conn.commit()
        
    def close_spider(self, spider):
        """Close database connection"""
        self.conn.close()
        
    def process_item(self, item, spider):
        """Store item in database"""
        adapter = ItemAdapter(item)
        
        # Extract key fields
        item_id = adapter.get('id')
        retailer = adapter.get('retailer')
        name = adapter.get('name')
        description = adapter.get('description', '')
        price = adapter.get('price')
        brand = adapter.get('brand', '')
        category = adapter.get('category', '')
        url = adapter.get('url')
        image_url = adapter.get('image_url', '')
        
        # Convert item to JSON string
        data_json = json.dumps(dict(item))
        
        # Get current timestamp
        now = int(time.time())
        
        # Check if product already exists
        self.cursor.execute("SELECT id, updated_at FROM products WHERE id = ?", (item_id,))
        existing = self.cursor.fetchone()
        
        if existing:
            # Update existing product
            self.cursor.execute('''
            UPDATE products SET
                retailer = ?,
                name = ?,
                description = ?,
                price = ?,
                brand = ?,
                category = ?,
                url = ?,
                image_url = ?,
                data = ?,
                updated_at = ?
            WHERE id = ?
            ''', (retailer, name, description, price, brand, category, url, image_url, data_json, now, item_id))
            
            logger.debug(f"Updated product {item_id} ({name}) in database")
        else:
            # Insert new product
            self.cursor.execute('''
            INSERT INTO products (
                id, retailer, name, description, price, brand, 
                category, url, image_url, data, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (item_id, retailer, name, description, price, brand, 
                 category, url, image_url, data_json, now, now))
            
            logger.debug(f"Inserted product {item_id} ({name}) into database")
        
        # Update search index
        self.cursor.execute("DELETE FROM product_search WHERE id = ?", (item_id,))
        self.cursor.execute('''
        INSERT INTO product_search (id, name, description, brand, category)
        VALUES (?, ?, ?, ?, ?)
        ''', (item_id, name, description, brand, category))
        
        self.conn.commit()
        return item


class JsonExportPipeline:
    """Pipeline for exporting items to JSON files"""
    
    def __init__(self, output_dir):
        self.output_dir = output_dir
        self.items = []
        
    @classmethod
    def from_crawler(cls, crawler):
        """Get output directory from settings"""
        return cls(
            output_dir=crawler.settings.get('OUTPUT_DIR', './data/crawl_output')
        )
        
    def open_spider(self, spider):
        """Initialize output directory"""
        os.makedirs(self.output_dir, exist_ok=True)
        
    def close_spider(self, spider):
        """Export items to JSON file when spider closes"""
        if not self.items:
            return
            
        # Generate filename with timestamp and spider name
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{spider.name}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        # Write items to file
        with open(filepath, 'w') as f:
            json.dump(self.items, f, indent=2)
            
        logger.info(f"Exported {len(self.items)} items to {filepath}")
        
    def process_item(self, item, spider):
        """Add item to export list"""
        self.items.append(dict(item))
        return item


class ApiPostPipeline:
    """Pipeline for posting items to API endpoint"""
    
    def __init__(self, api_endpoint, api_key, batch_size=100):
        self.api_endpoint = api_endpoint
        self.api_key = api_key
        self.batch_size = batch_size
        self.items = []
        
    @classmethod
    def from_crawler(cls, crawler):
        """Get API endpoint and key from settings"""
        return cls(
            api_endpoint=crawler.settings.get('API_ENDPOINT', 'http://localhost:3001/api/products/batch'),
            api_key=crawler.settings.get('API_KEY', ''),
            batch_size=crawler.settings.getint('API_BATCH_SIZE', 100)
        )
        
    def close_spider(self, spider):
        """Post remaining items to API when spider closes"""
        if self.items:
            self._post_items()
            
    def process_item(self, item, spider):
        """Add item to batch and post if batch size is reached"""
        self.items.append(dict(item))
        
        if len(self.items) >= self.batch_size:
            self._post_items()
            
        return item
        
    def _post_items(self):
        """Post items to API endpoint"""
        if not self.items:
            return
            
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            
            # Add API key if provided
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'
                
            # Post items to API
            response = requests.post(
                self.api_endpoint,
                json={'products': self.items},
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully posted {len(self.items)} items to API")
            else:
                logger.error(f"Failed to post items to API: {response.status_code} {response.text}")
                
        except Exception as e:
            logger.error(f"Error posting items to API: {str(e)}")
            
        # Clear items list
        self.items = [] 