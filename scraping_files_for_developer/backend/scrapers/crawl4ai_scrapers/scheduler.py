#!/usr/bin/env python3
"""
Scheduler for Smart Shopper ZA Crawlers

This module provides functionality for scheduling and managing crawl jobs.
It handles running crawlers for different retailers on a regular schedule and
saving the results to the database.
"""

import os
import sys
import asyncio
import logging
import time
import json
import importlib
import argparse
import signal
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Set, Callable
from pathlib import Path
import threading
import queue

# Import database
from database import ProductDatabase

# Import retailers configuration
from retailers_config import RETAILERS, get_retailer_config, get_all_retailer_names

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("scheduler")

class CrawlJob:
    """
    Represents a scheduled crawl job for a specific retailer
    """
    
    def __init__(
        self,
        retailer_name: str,
        interval_hours: int = 24,
        max_urls: int = 500,
        concurrency: int = None,
        enabled: bool = True
    ):
        """
        Initialize a crawl job
        
        Args:
            retailer_name: Name of the retailer to crawl
            interval_hours: Number of hours between crawls
            max_urls: Maximum number of URLs to crawl
            concurrency: Maximum number of concurrent browser sessions
            enabled: Whether the job is enabled
        """
        self.retailer_name = retailer_name
        self.interval_hours = interval_hours
        self.max_urls = max_urls
        self.enabled = enabled
        
        # Get retailer configuration
        self.retailer_config = get_retailer_config(retailer_name)
        
        # Set concurrency from config if not specified
        self.concurrency = concurrency or self.retailer_config.get("concurrency", 6)
        
        # Set rate limit from config
        self.rate_limit = self.retailer_config.get("rate_limit", (1.0, 3.0))
        
        # Job state
        self.last_run = None
        self.next_run = datetime.now()
        self.running = False
        self.status = "idle"
        self.stats = {}
    
    def is_due(self) -> bool:
        """
        Check if the job is due to run
        
        Returns:
            True if the job is due, False otherwise
        """
        return (
            self.enabled and
            not self.running and
            datetime.now() >= self.next_run
        )
    
    async def run(self, output_dir: str, db: ProductDatabase) -> Dict[str, Any]:
        """
        Run the job
        
        Args:
            output_dir: Directory to save crawled data
            db: Product database to store crawled data
            
        Returns:
            Dictionary containing job results
        """
        self.running = True
        self.status = "running"
        self.last_run = datetime.now()
        self.next_run = self.last_run + timedelta(hours=self.interval_hours)
        
        logger.info(f"Starting crawl job for {self.retailer_name}")
        
        try:
            # Import the retailer-specific crawler module
            module_name = self.retailer_config.get("module")
            class_name = self.retailer_config.get("class")
            
            crawler_module = importlib.import_module(module_name)
            crawler_class = getattr(crawler_module, class_name)
            
            # Initialize the crawler
            crawler = crawler_class(
                output_dir=output_dir,
                max_urls=self.max_urls,
                concurrency=self.concurrency
            )
            
            # Run the crawler
            summary = await crawler.run()
            
            # Store crawled data in database
            if hasattr(crawler, "run_dir") and os.path.exists(crawler.run_dir):
                crawled_products = self._load_crawled_products(crawler.run_dir)
                success_count, failure_count = db.bulk_upsert_products(crawled_products)
                
                logger.info(f"Stored {success_count} products from {self.retailer_name} in database")
                
                # Add database stats to summary
                summary["database_success"] = success_count
                summary["database_failure"] = failure_count
            else:
                logger.warning(f"No crawled data found for {self.retailer_name}")
            
            self.stats = summary
            self.status = "completed"
            return summary
        
        except Exception as e:
            error_msg = f"Error running crawl job for {self.retailer_name}: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            
            self.stats = {
                "error": error_msg,
                "traceback": traceback.format_exc()
            }
            self.status = "failed"
            return self.stats
        
        finally:
            self.running = False
    
    def _load_crawled_products(self, run_dir: str) -> List[Dict[str, Any]]:
        """
        Load crawled products from JSON files in the run directory
        
        Args:
            run_dir: Directory containing crawled product JSON files
            
        Returns:
            List of product data dictionaries
        """
        products = []
        
        try:
            # Find all JSON files in the run directory
            json_files = [f for f in os.listdir(run_dir) if f.endswith(".json") and f != "summary.json"]
            
            # Load each product JSON file
            for filename in json_files:
                try:
                    with open(os.path.join(run_dir, filename), "r", encoding="utf-8") as f:
                        product_data = json.load(f)
                        
                        # Ensure product has retailer info
                        if "retailer" not in product_data:
                            product_data["retailer"] = self.retailer_name
                        
                        products.append(product_data)
                except Exception as e:
                    logger.error(f"Error loading product from {filename}: {str(e)}")
            
            logger.info(f"Loaded {len(products)} products from {run_dir}")
            
        except Exception as e:
            logger.error(f"Error loading crawled products from {run_dir}: {str(e)}")
        
        return products
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert job to dictionary
        
        Returns:
            Dictionary representation of the job
        """
        return {
            "retailer_name": self.retailer_name,
            "interval_hours": self.interval_hours,
            "max_urls": self.max_urls,
            "concurrency": self.concurrency,
            "enabled": self.enabled,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "running": self.running,
            "status": self.status,
            "stats": self.stats
        }


class CrawlScheduler:
    """
    Scheduler for running crawl jobs
    """
    
    def __init__(
        self,
        output_dir: str = "./data",
        db_path: str = "./data/products.db",
        check_interval: int = 60  # seconds
    ):
        """
        Initialize the scheduler
        
        Args:
            output_dir: Directory to save crawled data
            db_path: Path to the product database
            check_interval: Number of seconds between checks for due jobs
        """
        self.output_dir = output_dir
        self.check_interval = check_interval
        self.running = False
        self.jobs = {}  # retailer_name -> CrawlJob
        
        # Initialize database
        self.db = ProductDatabase(db_path)
        
        # Job queue
        self.job_queue = queue.Queue()
        
        # Worker thread
        self.worker_thread = None
        
        # Synchronization
        self._lock = threading.Lock()
        
        logger.info(f"Initialized scheduler with output directory: {output_dir}")
    
    def add_job(
        self,
        retailer_name: str,
        interval_hours: int = 24,
        max_urls: int = 500,
        concurrency: int = None,
        enabled: bool = True
    ) -> CrawlJob:
        """
        Add a new crawl job to the scheduler
        
        Args:
            retailer_name: Name of the retailer to crawl
            interval_hours: Number of hours between crawls
            max_urls: Maximum number of URLs to crawl
            concurrency: Maximum number of concurrent browser sessions
            enabled: Whether the job is enabled
            
        Returns:
            The created job
        """
        with self._lock:
            job = CrawlJob(
                retailer_name=retailer_name,
                interval_hours=interval_hours,
                max_urls=max_urls,
                concurrency=concurrency,
                enabled=enabled
            )
            
            self.jobs[retailer_name] = job
            logger.info(f"Added job for {retailer_name} with interval {interval_hours} hours")
            
            return job
    
    def remove_job(self, retailer_name: str) -> bool:
        """
        Remove a job from the scheduler
        
        Args:
            retailer_name: Name of the retailer
            
        Returns:
            True if the job was removed, False if it wasn't found
        """
        with self._lock:
            if retailer_name in self.jobs:
                del self.jobs[retailer_name]
                logger.info(f"Removed job for {retailer_name}")
                return True
            return False
    
    def get_job(self, retailer_name: str) -> Optional[CrawlJob]:
        """
        Get a job by retailer name
        
        Args:
            retailer_name: Name of the retailer
            
        Returns:
            The job or None if not found
        """
        return self.jobs.get(retailer_name)
    
    def get_all_jobs(self) -> Dict[str, CrawlJob]:
        """
        Get all jobs
        
        Returns:
            Dictionary mapping retailer names to jobs
        """
        return self.jobs.copy()
    
    def start(self) -> bool:
        """
        Start the scheduler
        
        Returns:
            True if the scheduler was started, False if it was already running
        """
        if self.running:
            logger.warning("Scheduler is already running")
            return False
        
        self.running = True
        
        # Start worker thread
        self.worker_thread = threading.Thread(target=self._worker_loop)
        self.worker_thread.daemon = True
        self.worker_thread.start()
        
        # Start checker thread
        threading.Thread(target=self._checker_loop).start()
        
        logger.info("Started scheduler")
        return True
    
    def stop(self) -> bool:
        """
        Stop the scheduler
        
        Returns:
            True if the scheduler was stopped, False if it wasn't running
        """
        if not self.running:
            logger.warning("Scheduler is not running")
            return False
        
        self.running = False
        
        # Add a None job to signal worker to exit
        self.job_queue.put(None)
        
        if self.worker_thread:
            self.worker_thread.join(timeout=60)
        
        logger.info("Stopped scheduler")
        return True
    
    def run_job_now(self, retailer_name: str) -> bool:
        """
        Run a job now, regardless of its schedule
        
        Args:
            retailer_name: Name of the retailer
            
        Returns:
            True if the job was queued, False if it wasn't found or is already running
        """
        job = self.get_job(retailer_name)
        
        if job is None:
            logger.warning(f"Job for {retailer_name} not found")
            return False
        
        if job.running:
            logger.warning(f"Job for {retailer_name} is already running")
            return False
        
        # Queue the job
        self.job_queue.put(job)
        logger.info(f"Queued job for {retailer_name} to run now")
        
        return True
    
    def _checker_loop(self):
        """Check for due jobs and queue them"""
        logger.info("Started job checker loop")
        
        while self.running:
            try:
                # Check all jobs
                with self._lock:
                    for job in self.jobs.values():
                        if job.is_due():
                            # Queue the job
                            self.job_queue.put(job)
                            logger.info(f"Queued due job for {job.retailer_name}")
                
                # Wait for next check
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error(f"Error in checker loop: {str(e)}")
                time.sleep(10)  # Wait a bit before trying again
    
    def _worker_loop(self):
        """Process jobs from the queue"""
        logger.info("Started job worker loop")
        
        while self.running:
            try:
                # Get next job from queue
                job = self.job_queue.get()
                
                # None is a signal to exit
                if job is None:
                    break
                
                # Run the job
                logger.info(f"Processing job for {job.retailer_name}")
                
                # Run the job in event loop
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    result = loop.run_until_complete(job.run(self.output_dir, self.db))
                    logger.info(f"Job for {job.retailer_name} completed with result: {result}")
                finally:
                    loop.close()
                
            except Exception as e:
                logger.error(f"Error in worker loop: {str(e)}")
            
            finally:
                # Mark job as done
                if 'job' in locals() and job is not None:
                    self.job_queue.task_done()
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert scheduler to dictionary
        
        Returns:
            Dictionary representation of the scheduler
        """
        return {
            "output_dir": self.output_dir,
            "check_interval": self.check_interval,
            "running": self.running,
            "jobs": {name: job.to_dict() for name, job in self.jobs.items()},
            "job_queue_size": self.job_queue.qsize()
        }

def create_default_scheduler(
    output_dir: str = "./data",
    db_path: str = "./data/products.db"
) -> CrawlScheduler:
    """
    Create a scheduler with default jobs for all configured retailers
    
    Args:
        output_dir: Directory to save crawled data
        db_path: Path to the product database
        
    Returns:
        Configured scheduler instance
    """
    scheduler = CrawlScheduler(output_dir=output_dir, db_path=db_path)
    
    # Add a job for each retailer
    for retailer in RETAILERS:
        # Skip retailers that don't have a crawler module/class
        module_name = retailer.get("module")
        class_name = retailer.get("class")
        
        try:
            # Try importing the module/class
            crawler_module = importlib.import_module(module_name)
            crawler_class = getattr(crawler_module, class_name)
            
            # Add job if module/class exists
            scheduler.add_job(
                retailer_name=retailer["name"],
                interval_hours=24,  # Daily
                max_urls=1000,      # Reasonable default
                concurrency=retailer.get("concurrency", 6),
                enabled=True
            )
            
        except (ImportError, AttributeError):
            logger.warning(f"Crawler module/class not found for retailer {retailer['name']}")
    
    return scheduler

async def run_one_time_crawl(
    retailer_name: str,
    output_dir: str = "./data",
    db_path: str = "./data/products.db",
    max_urls: int = 500
) -> Dict[str, Any]:
    """
    Run a one-time crawl for a specific retailer
    
    Args:
        retailer_name: Name of the retailer to crawl
        output_dir: Directory to save crawled data
        db_path: Path to the product database
        max_urls: Maximum number of URLs to crawl
        
    Returns:
        Dictionary containing crawl results
    """
    # Get retailer configuration
    retailer_config = get_retailer_config(retailer_name)
    
    # Initialize database
    db = ProductDatabase(db_path)
    
    # Import the retailer-specific crawler module
    module_name = retailer_config.get("module")
    class_name = retailer_config.get("class")
    
    try:
        crawler_module = importlib.import_module(module_name)
        crawler_class = getattr(crawler_module, class_name)
        
        # Initialize the crawler
        crawler = crawler_class(
            output_dir=output_dir,
            max_urls=max_urls,
            concurrency=retailer_config.get("concurrency", 6)
        )
        
        # Run the crawler
        summary = await crawler.run()
        
        # Store crawled data in database
        if hasattr(crawler, "run_dir") and os.path.exists(crawler.run_dir):
            # Find all JSON files in the run directory
            json_files = [f for f in os.listdir(crawler.run_dir) if f.endswith(".json") and f != "summary.json"]
            
            # Load each product JSON file
            products = []
            for filename in json_files:
                try:
                    with open(os.path.join(crawler.run_dir, filename), "r", encoding="utf-8") as f:
                        product_data = json.load(f)
                        
                        # Ensure product has retailer info
                        if "retailer" not in product_data:
                            product_data["retailer"] = retailer_name
                        
                        products.append(product_data)
                except Exception as e:
                    logger.error(f"Error loading product from {filename}: {str(e)}")
            
            # Store products in database
            success_count, failure_count = db.bulk_upsert_products(products)
            
            logger.info(f"Stored {success_count} products from {retailer_name} in database")
            
            # Add database stats to summary
            summary["database_success"] = success_count
            summary["database_failure"] = failure_count
        else:
            logger.warning(f"No crawled data found for {retailer_name}")
        
        return summary
        
    except (ImportError, AttributeError) as e:
        error_msg = f"Crawler module/class not found for retailer {retailer_name}: {str(e)}"
        logger.error(error_msg)
        return {"error": error_msg}
    
    except Exception as e:
        error_msg = f"Error running crawl for {retailer_name}: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        return {
            "error": error_msg,
            "traceback": traceback.format_exc()
        }

def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(description="Smart Shopper ZA Crawl Scheduler")
    
    # Command subparsers
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Run a one-time crawl
    run_parser = subparsers.add_parser("run", help="Run a one-time crawl for a retailer")
    run_parser.add_argument("retailer", help="Retailer to crawl")
    run_parser.add_argument("--output-dir", default="./data", help="Directory to save crawled data")
    run_parser.add_argument("--db-path", default="./data/products.db", help="Path to the product database")
    run_parser.add_argument("--max-urls", type=int, default=500, help="Maximum number of URLs to crawl")
    
    # Start the scheduler
    start_parser = subparsers.add_parser("start", help="Start the scheduler")
    start_parser.add_argument("--output-dir", default="./data", help="Directory to save crawled data")
    start_parser.add_argument("--db-path", default="./data/products.db", help="Path to the product database")
    
    # List available retailers
    list_parser = subparsers.add_parser("list", help="List available retailers")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Handle commands
    if args.command == "run":
        # Run a one-time crawl
        try:
            asyncio.run(run_one_time_crawl(
                retailer_name=args.retailer,
                output_dir=args.output_dir,
                db_path=args.db_path,
                max_urls=args.max_urls
            ))
        except KeyboardInterrupt:
            logger.info("Crawl interrupted by user")
    
    elif args.command == "start":
        # Start the scheduler
        scheduler = create_default_scheduler(
            output_dir=args.output_dir,
            db_path=args.db_path
        )
        
        # Handle SIGINT (Ctrl+C)
        def signal_handler(sig, frame):
            logger.info("Received SIGINT, stopping scheduler...")
            scheduler.stop()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        
        # Start the scheduler
        scheduler.start()
        
        # Keep the main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Scheduler interrupted by user")
            scheduler.stop()
    
    elif args.command == "list":
        # List available retailers
        print("Available retailers:")
        for name in get_all_retailer_names():
            print(f"  - {name}")
    
    else:
        # Show help if no command specified
        parser.print_help()

if __name__ == "__main__":
    main() 