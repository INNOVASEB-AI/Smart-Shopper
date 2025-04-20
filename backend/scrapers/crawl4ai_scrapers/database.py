"""
Database Module for Smart Shopper ZA

This module provides functionality for storing and retrieving crawled product data
in a database. It implements a simple file-based database using JSON for storage,
with indexing for fast retrieval.

For production usage, consider replacing this with a proper database solution like
MongoDB, Firebase/Firestore, or a relational database.
"""

import os
import json
import time
import logging
import shutil
from typing import Dict, List, Any, Optional, Tuple, Set
from datetime import datetime
import sqlite3
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("product_database")

class ProductDatabase:
    """
    Product database for storing and indexing crawled product data
    
    This implementation uses SQLite for storage and indexing.
    """
    
    def __init__(self, db_path: str = "./data/products.db"):
        """
        Initialize the product database
        
        Args:
            db_path: Path to the SQLite database file
        """
        self.db_path = db_path
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Initialize database
        self._initialize_db()
        
        logger.info(f"Initialized product database at {db_path}")
    
    def _initialize_db(self):
        """Initialize the database schema if it doesn't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create products table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            retailer TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            price REAL,
            brand TEXT,
            category TEXT,
            url TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_retailer ON products(retailer)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_title ON products(title)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_brand ON products(brand)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_category ON products(category)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_price ON products(price)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_updated_at ON products(updated_at)')
        
        # Create product_search table for full-text search
        cursor.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS product_search
        USING fts5(id, title, description, brand, category, tokenize='porter')
        ''')
        
        conn.commit()
        conn.close()
    
    def upsert_product(self, product_data: Dict[str, Any]) -> bool:
        """
        Insert or update a product in the database
        
        Args:
            product_data: Product data dictionary
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Extract key fields
            url = product_data.get("url", "")
            if not url:
                logger.warning("Product data missing URL, skipping")
                return False
                
            # Generate ID from URL if not provided
            product_id = product_data.get("id", "")
            if not product_id:
                # Extract ID from URL
                url_parts = url.split("/")
                product_id = url_parts[-1] if url_parts else ""
                if not product_id:
                    logger.warning(f"Could not extract product ID from URL: {url}")
                    product_id = str(int(time.time() * 1000))  # Use timestamp as fallback
            
            # Extract other key fields
            retailer = product_data.get("retailer", "")
            title = product_data.get("title", "")
            description = product_data.get("description", "")
            brand = product_data.get("brand", "")
            category = product_data.get("category", "")
            
            # Extract price (handles different price formats)
            price = None
            price_data = product_data.get("price", {})
            if isinstance(price_data, dict):
                price = price_data.get("current")
            elif isinstance(price_data, (int, float)):
                price = price_data
                
            # Convert data to JSON string
            data_json = json.dumps(product_data)
            
            # Get current timestamp
            now = int(time.time())
            
            # Connect to database
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if product already exists
            cursor.execute("SELECT id, updated_at FROM products WHERE id = ?", (product_id,))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing product
                cursor.execute('''
                UPDATE products SET
                    retailer = ?,
                    title = ?,
                    description = ?,
                    price = ?,
                    brand = ?,
                    category = ?,
                    url = ?,
                    data = ?,
                    updated_at = ?
                WHERE id = ?
                ''', (retailer, title, description, price, brand, category, url, data_json, now, product_id))
                
                logger.debug(f"Updated product {product_id} ({title}) in database")
            else:
                # Insert new product
                cursor.execute('''
                INSERT INTO products (
                    id, retailer, title, description, price, brand, 
                    category, url, data, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (product_id, retailer, title, description, price, brand, 
                     category, url, data_json, now, now))
                
                logger.debug(f"Inserted product {product_id} ({title}) into database")
            
            # Update search index
            cursor.execute("DELETE FROM product_search WHERE id = ?", (product_id,))
            cursor.execute('''
            INSERT INTO product_search (id, title, description, brand, category)
            VALUES (?, ?, ?, ?, ?)
            ''', (product_id, title, description, brand, category))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            logger.error(f"Error upserting product: {str(e)}")
            return False
    
    def bulk_upsert_products(self, products: List[Dict[str, Any]]) -> Tuple[int, int]:
        """
        Insert or update multiple products in the database
        
        Args:
            products: List of product data dictionaries
            
        Returns:
            Tuple of (success_count, failure_count)
        """
        success_count = 0
        failure_count = 0
        
        # Connect to database
        conn = sqlite3.connect(self.db_path)
        conn.isolation_level = None  # Enable autocommit mode
        cursor = conn.cursor()
        
        try:
            # Begin transaction
            cursor.execute("BEGIN TRANSACTION")
            
            for product_data in products:
                try:
                    # Extract key fields
                    url = product_data.get("url", "")
                    if not url:
                        logger.warning("Product data missing URL, skipping")
                        failure_count += 1
                        continue
                        
                    # Generate ID from URL if not provided
                    product_id = product_data.get("id", "")
                    if not product_id:
                        # Extract ID from URL
                        url_parts = url.split("/")
                        product_id = url_parts[-1] if url_parts else ""
                        if not product_id:
                            logger.warning(f"Could not extract product ID from URL: {url}")
                            product_id = str(int(time.time() * 1000))  # Use timestamp as fallback
                    
                    # Extract other key fields
                    retailer = product_data.get("retailer", "")
                    title = product_data.get("title", "")
                    description = product_data.get("description", "")
                    brand = product_data.get("brand", "")
                    category = product_data.get("category", "")
                    
                    # Extract price (handles different price formats)
                    price = None
                    price_data = product_data.get("price", {})
                    if isinstance(price_data, dict):
                        price = price_data.get("current")
                    elif isinstance(price_data, (int, float)):
                        price = price_data
                        
                    # Convert data to JSON string
                    data_json = json.dumps(product_data)
                    
                    # Get current timestamp
                    now = int(time.time())
                    
                    # Check if product already exists
                    cursor.execute("SELECT id, updated_at FROM products WHERE id = ?", (product_id,))
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Update existing product
                        cursor.execute('''
                        UPDATE products SET
                            retailer = ?,
                            title = ?,
                            description = ?,
                            price = ?,
                            brand = ?,
                            category = ?,
                            url = ?,
                            data = ?,
                            updated_at = ?
                        WHERE id = ?
                        ''', (retailer, title, description, price, brand, category, url, data_json, now, product_id))
                    else:
                        # Insert new product
                        cursor.execute('''
                        INSERT INTO products (
                            id, retailer, title, description, price, brand, 
                            category, url, data, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (product_id, retailer, title, description, price, brand, 
                             category, url, data_json, now, now))
                    
                    # Update search index
                    cursor.execute("DELETE FROM product_search WHERE id = ?", (product_id,))
                    cursor.execute('''
                    INSERT INTO product_search (id, title, description, brand, category)
                    VALUES (?, ?, ?, ?, ?)
                    ''', (product_id, title, description, brand, category))
                    
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"Error processing product: {str(e)}")
                    failure_count += 1
            
            # Commit transaction
            cursor.execute("COMMIT")
            
        except Exception as e:
            # Rollback on error
            cursor.execute("ROLLBACK")
            logger.error(f"Error in bulk upsert: {str(e)}")
            
        finally:
            conn.close()
            
        logger.info(f"Bulk upsert completed: {success_count} successful, {failure_count} failed")
        return success_count, failure_count
    
    def find_products(
        self, 
        query: str = None,
        retailer: str = None,
        category: str = None,
        brand: str = None,
        min_price: float = None,
        max_price: float = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Find products based on search criteria
        
        Args:
            query: Full-text search query
            retailer: Filter by retailer
            category: Filter by category
            brand: Filter by brand
            min_price: Minimum price
            max_price: Maximum price
            limit: Maximum number of results to return
            offset: Offset for pagination
            
        Returns:
            Tuple of (list of products, total count)
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable row factory to get dict-like rows
            cursor = conn.cursor()
            
            params = []
            where_clauses = []
            
            # Build full-text search query
            if query:
                fts_query = query.replace('"', '""')  # Escape quotes for SQLite FTS
                cursor.execute('''
                SELECT id FROM product_search
                WHERE product_search MATCH ?
                ''', (fts_query,))
                
                # Get matching IDs
                matching_ids = [row['id'] for row in cursor.fetchall()]
                
                if matching_ids:
                    # Add to where clauses
                    placeholders = ','.join(['?'] * len(matching_ids))
                    where_clauses.append(f"id IN ({placeholders})")
                    params.extend(matching_ids)
                else:
                    # No matches for search query
                    return [], 0
            
            # Add filters
            if retailer:
                where_clauses.append("retailer = ?")
                params.append(retailer)
                
            if category:
                where_clauses.append("category = ?")
                params.append(category)
                
            if brand:
                where_clauses.append("brand = ?")
                params.append(brand)
                
            if min_price is not None:
                where_clauses.append("price >= ?")
                params.append(min_price)
                
            if max_price is not None:
                where_clauses.append("price <= ?")
                params.append(max_price)
            
            # Build where clause
            where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
            
            # Get total count
            count_sql = f"SELECT COUNT(*) as count FROM products WHERE {where_sql}"
            cursor.execute(count_sql, params)
            total_count = cursor.fetchone()['count']
            
            # Get products with limit and offset
            sql = f"""
            SELECT data FROM products 
            WHERE {where_sql}
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
            """
            
            cursor.execute(sql, params + [limit, offset])
            
            # Parse JSON data for each product
            products = []
            for row in cursor.fetchall():
                try:
                    product = json.loads(row['data'])
                    products.append(product)
                except json.JSONDecodeError:
                    logger.warning(f"Error decoding JSON data for product")
            
            conn.close()
            return products, total_count
            
        except Exception as e:
            logger.error(f"Error finding products: {str(e)}")
            return [], 0
    
    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a product by its ID
        
        Args:
            product_id: The product ID
            
        Returns:
            Product data dictionary or None if not found
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable row factory to get dict-like rows
            cursor = conn.cursor()
            
            cursor.execute("SELECT data FROM products WHERE id = ?", (product_id,))
            row = cursor.fetchone()
            
            if row:
                try:
                    product = json.loads(row['data'])
                    return product
                except json.JSONDecodeError:
                    logger.warning(f"Error decoding JSON data for product {product_id}")
            
            conn.close()
            return None
            
        except Exception as e:
            logger.error(f"Error getting product {product_id}: {str(e)}")
            return None
    
    def get_product_count_by_retailer(self) -> Dict[str, int]:
        """
        Get the number of products for each retailer
        
        Returns:
            Dictionary mapping retailer names to product counts
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
            SELECT retailer, COUNT(*) as count 
            FROM products 
            GROUP BY retailer
            """)
            
            results = {}
            for row in cursor.fetchall():
                results[row[0]] = row[1]
            
            conn.close()
            return results
            
        except Exception as e:
            logger.error(f"Error getting product counts: {str(e)}")
            return {}
    
    def get_database_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the database
        
        Returns:
            Dictionary containing database statistics
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get total product count
            cursor.execute("SELECT COUNT(*) FROM products")
            total_count = cursor.fetchone()[0]
            
            # Get count by retailer
            retailer_counts = self.get_product_count_by_retailer()
            
            # Get count by category
            cursor.execute("""
            SELECT category, COUNT(*) as count 
            FROM products 
            WHERE category != ''
            GROUP BY category
            ORDER BY count DESC
            LIMIT 10
            """)
            
            top_categories = {}
            for row in cursor.fetchall():
                top_categories[row[0]] = row[1]
            
            # Get count by brand
            cursor.execute("""
            SELECT brand, COUNT(*) as count 
            FROM products 
            WHERE brand != ''
            GROUP BY brand
            ORDER BY count DESC
            LIMIT 10
            """)
            
            top_brands = {}
            for row in cursor.fetchall():
                top_brands[row[0]] = row[1]
            
            # Get database file size
            db_size = os.path.getsize(self.db_path)
            
            # Get last updated timestamp
            cursor.execute("SELECT MAX(updated_at) FROM products")
            last_updated = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "total_products": total_count,
                "retailer_counts": retailer_counts,
                "top_categories": top_categories,
                "top_brands": top_brands,
                "db_size_bytes": db_size,
                "db_size_mb": round(db_size / (1024 * 1024), 2),
                "last_updated": datetime.fromtimestamp(last_updated).isoformat() if last_updated else None
            }
            
        except Exception as e:
            logger.error(f"Error getting database stats: {str(e)}")
            return {
                "error": str(e)
            }
    
    def delete_product(self, product_id: str) -> bool:
        """
        Delete a product from the database
        
        Args:
            product_id: The product ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Delete from products table
            cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
            
            # Delete from search index
            cursor.execute("DELETE FROM product_search WHERE id = ?", (product_id,))
            
            conn.commit()
            conn.close()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            logger.error(f"Error deleting product {product_id}: {str(e)}")
            return False
    
    def clear_retailer_data(self, retailer: str) -> int:
        """
        Delete all products for a specific retailer
        
        Args:
            retailer: The retailer name
            
        Returns:
            Number of products deleted
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get IDs to delete from search index
            cursor.execute("SELECT id FROM products WHERE retailer = ?", (retailer,))
            product_ids = [row[0] for row in cursor.fetchall()]
            
            # Delete from products table
            cursor.execute("DELETE FROM products WHERE retailer = ?", (retailer,))
            deleted_count = cursor.rowcount
            
            # Delete from search index
            if product_ids:
                placeholders = ','.join(['?'] * len(product_ids))
                cursor.execute(f"DELETE FROM product_search WHERE id IN ({placeholders})", product_ids)
            
            conn.commit()
            conn.close()
            
            logger.info(f"Deleted {deleted_count} products for retailer {retailer}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error clearing data for retailer {retailer}: {str(e)}")
            return 0
    
    def backup_database(self, backup_path: str = None) -> Optional[str]:
        """
        Create a backup of the database
        
        Args:
            backup_path: Path to save the backup (defaults to db_path + timestamp)
            
        Returns:
            Path to the backup file or None if backup failed
        """
        try:
            # Generate backup path if not provided
            if not backup_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                db_dir = os.path.dirname(self.db_path)
                db_name = os.path.basename(self.db_path)
                backup_name = f"{os.path.splitext(db_name)[0]}_{timestamp}.db"
                backup_path = os.path.join(db_dir, "backups", backup_name)
            
            # Ensure backup directory exists
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            
            # Close current connections
            # Note: This requires that no other code is using the database during backup
            
            # Copy the database file
            shutil.copy2(self.db_path, backup_path)
            
            logger.info(f"Database backed up to {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Error backing up database: {str(e)}")
            return None


# Example usage
if __name__ == "__main__":
    # This is just for testing
    db = ProductDatabase("./test_products.db")
    
    # Test product
    test_product = {
        "url": "https://www.example.com/product/123",
        "retailer": "TestRetailer",
        "title": "Test Product",
        "description": "This is a test product",
        "price": {
            "current": 99.99,
            "currency": "ZAR"
        },
        "brand": "TestBrand",
        "category": "TestCategory"
    }
    
    # Insert test product
    db.upsert_product(test_product)
    
    # Search for products
    products, count = db.find_products(query="test")
    print(f"Found {count} products for query 'test'")
    for product in products:
        print(f"  - {product.get('title')} (R{product.get('price', {}).get('current')})")
    
    # Get database stats
    stats = db.get_database_stats()
    print("\nDatabase Stats:")
    for key, value in stats.items():
        print(f"  {key}: {value}") 