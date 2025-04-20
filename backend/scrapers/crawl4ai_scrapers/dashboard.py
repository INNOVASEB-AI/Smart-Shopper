#!/usr/bin/env python3
"""
Crawler Monitoring Dashboard

This module provides a command-line dashboard for monitoring the status of crawlers.
It displays real-time statistics and performance metrics to help tune crawler parameters.
"""

import os
import sys
import json
import time
import curses
import argparse
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

# Configure logging to file for this module
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("dashboard.log"),
    ]
)
logger = logging.getLogger("crawler_dashboard")

class CrawlerDashboard:
    """
    Command-line interface for monitoring crawler status and performance
    """
    
    def __init__(self, data_dir: str = "./data"):
        """
        Initialize the dashboard
        
        Args:
            data_dir: Directory where crawler results are stored
        """
        self.data_dir = data_dir
        self.retailers = self._discover_retailers()
        self.selected_retailer = 0 if self.retailers else -1
        self.current_tab = 0  # 0: Summary, 1: Details, 2: Performance, 3: History
        self.tabs = ["Summary", "Details", "Performance", "History"]
        self.refresh_interval = 5  # seconds
        self.last_refresh = 0
        self.statistics = {}
        self.running = False
        
    def _discover_retailers(self) -> List[str]:
        """
        Discover available retailers by scanning the data directory
        
        Returns:
            List of retailer names
        """
        retailers = []
        try:
            # List all directories in the data directory
            if os.path.exists(self.data_dir):
                for item in os.listdir(self.data_dir):
                    item_path = os.path.join(self.data_dir, item)
                    if os.path.isdir(item_path) and not item.startswith('.'):
                        retailers.append(item)
        except Exception as e:
            logger.error(f"Error discovering retailers: {str(e)}")
        
        return sorted(retailers)
    
    def _load_retailer_statistics(self, retailer: str) -> Dict[str, Any]:
        """
        Load statistics for a specific retailer
        
        Args:
            retailer: Name of the retailer
            
        Returns:
            Dictionary containing retailer statistics
        """
        stats = {
            "name": retailer,
            "runs": [],
            "total_products": 0,
            "last_run": None,
            "performance": {
                "success_rate": 0,
                "avg_duration": 0,
                "memory_peak": 0,
                "rate_limited_count": 0
            }
        }
        
        try:
            retailer_dir = os.path.join(self.data_dir, retailer)
            if not os.path.exists(retailer_dir):
                return stats
            
            # Check for last_run.json
            last_run_path = os.path.join(retailer_dir, "last_run.json")
            if os.path.exists(last_run_path):
                with open(last_run_path, "r") as f:
                    last_run_data = json.load(f)
                    stats["last_run"] = last_run_data
            
            # Find and load run directories
            run_dirs = []
            for item in os.listdir(retailer_dir):
                item_path = os.path.join(retailer_dir, item)
                if os.path.isdir(item_path) and item.startswith('run_'):
                    run_dirs.append(item_path)
            
            run_dirs.sort(reverse=True)  # Most recent first
            
            # Load stats from up to 10 most recent runs
            for run_dir in run_dirs[:10]:
                summary_path = os.path.join(run_dir, "summary.json")
                if os.path.exists(summary_path):
                    with open(summary_path, "r") as f:
                        summary_data = json.load(f)
                        stats["runs"].append(summary_data)
                
                # Count product files
                product_count = len([f for f in os.listdir(run_dir) 
                                   if f.endswith('.json') and f != 'summary.json'])
                stats["total_products"] += product_count
            
            # Calculate performance metrics
            if stats["runs"]:
                success_rates = []
                durations = []
                rate_limiteds = []
                
                for run in stats["runs"]:
                    if "successful" in run and "urls_processed" in run and run["urls_processed"] > 0:
                        success_rates.append(run["successful"] / run["urls_processed"])
                    
                    if "duration_seconds" in run:
                        durations.append(run["duration_seconds"])
                    
                    if "rate_limited" in run:
                        rate_limiteds.append(run["rate_limited"])
                
                if success_rates:
                    stats["performance"]["success_rate"] = sum(success_rates) / len(success_rates)
                
                if durations:
                    stats["performance"]["avg_duration"] = sum(durations) / len(durations)
                
                if rate_limiteds:
                    stats["performance"]["rate_limited_count"] = sum(rate_limiteds)
                
                # Check for memory peak in monitor log
                monitor_log = os.path.join(run_dirs[0], "crawler_monitor.log")
                if os.path.exists(monitor_log):
                    try:
                        with open(monitor_log, "r") as f:
                            log_content = f.read()
                            memory_peaks = [float(line.split("Memory usage:")[1].split("%")[0].strip()) 
                                         for line in log_content.split("\n") 
                                         if "Memory usage:" in line]
                            if memory_peaks:
                                stats["performance"]["memory_peak"] = max(memory_peaks)
                    except Exception as e:
                        logger.error(f"Error parsing memory peak: {str(e)}")
            
        except Exception as e:
            logger.error(f"Error loading statistics for {retailer}: {str(e)}")
        
        return stats
    
    def _refresh_statistics(self):
        """Refresh statistics for all retailers"""
        for retailer in self.retailers:
            self.statistics[retailer] = self._load_retailer_statistics(retailer)
        self.last_refresh = time.time()
    
    def _draw_summary(self, stdscr, height, width):
        """Draw the summary tab"""
        stdscr.addstr(4, 2, f"Data Directory: {self.data_dir}")
        stdscr.addstr(5, 2, f"Retailers: {len(self.retailers)}")
        stdscr.addstr(6, 2, f"Last Refresh: {datetime.fromtimestamp(self.last_refresh).strftime('%H:%M:%S')}")
        
        # Draw retailer summary table
        headers = ["Retailer", "Last Run", "Success Rate", "Products", "Duration"]
        col_widths = [20, 20, 15, 10, 15]
        
        # Draw table headers
        y = 8
        x = 2
        for i, header in enumerate(headers):
            stdscr.addstr(y, x, header, curses.A_BOLD)
            x += col_widths[i]
        
        # Draw table rows
        y = 9
        for retailer in self.retailers:
            if retailer in self.statistics:
                stats = self.statistics[retailer]
                
                # Highlight selected retailer
                attr = curses.A_REVERSE if self.retailers.index(retailer) == self.selected_retailer else 0
                
                x = 2
                stdscr.addstr(y, x, retailer[:col_widths[0]-1], attr)
                x += col_widths[0]
                
                # Last run time
                last_run = "Never"
                if stats["last_run"] and "timestamp" in stats["last_run"]:
                    try:
                        last_run_time = datetime.fromisoformat(stats["last_run"]["timestamp"])
                        last_run = last_run_time.strftime("%Y-%m-%d %H:%M")
                    except (ValueError, TypeError):
                        pass
                stdscr.addstr(y, x, last_run[:col_widths[1]-1], attr)
                x += col_widths[1]
                
                # Success rate
                success_rate = f"{stats['performance']['success_rate']*100:.1f}%" if stats['performance']['success_rate'] > 0 else "N/A"
                stdscr.addstr(y, x, success_rate, attr)
                x += col_widths[2]
                
                # Products
                stdscr.addstr(y, x, str(stats['total_products']), attr)
                x += col_widths[3]
                
                # Duration
                duration = f"{stats['performance']['avg_duration']:.1f}s" if stats['performance']['avg_duration'] > 0 else "N/A"
                stdscr.addstr(y, x, duration, attr)
                
                y += 1
                if y >= height - 3:
                    break
    
    def _draw_details(self, stdscr, height, width):
        """Draw the details tab for the selected retailer"""
        if self.selected_retailer < 0 or self.selected_retailer >= len(self.retailers):
            stdscr.addstr(4, 2, "No retailer selected")
            return
        
        retailer = self.retailers[self.selected_retailer]
        if retailer not in self.statistics:
            stdscr.addstr(4, 2, f"No statistics available for {retailer}")
            return
        
        stats = self.statistics[retailer]
        
        # Display basic info
        stdscr.addstr(4, 2, f"Retailer: {retailer}", curses.A_BOLD)
        stdscr.addstr(5, 2, f"Total Products: {stats['total_products']}")
        
        # Last run info
        y = 7
        if stats["last_run"]:
            stdscr.addstr(y, 2, "Last Run:", curses.A_BOLD)
            y += 1
            for key, value in stats["last_run"].items():
                if key == "stats" and isinstance(value, dict):
                    for stat_key, stat_value in value.items():
                        if y < height - 3:
                            stdscr.addstr(y, 4, f"{stat_key}: {stat_value}")
                            y += 1
                elif y < height - 3:
                    stdscr.addstr(y, 4, f"{key}: {value}")
                    y += 1
        else:
            stdscr.addstr(y, 2, "No runs found")
    
    def _draw_performance(self, stdscr, height, width):
        """Draw the performance tab for the selected retailer"""
        if self.selected_retailer < 0 or self.selected_retailer >= len(self.retailers):
            stdscr.addstr(4, 2, "No retailer selected")
            return
        
        retailer = self.retailers[self.selected_retailer]
        if retailer not in self.statistics:
            stdscr.addstr(4, 2, f"No statistics available for {retailer}")
            return
        
        stats = self.statistics[retailer]
        
        # Display performance metrics
        stdscr.addstr(4, 2, f"Performance for {retailer}", curses.A_BOLD)
        
        perf = stats["performance"]
        y = 6
        stdscr.addstr(y, 2, f"Success Rate: {perf['success_rate']*100:.1f}%")
        y += 1
        stdscr.addstr(y, 2, f"Average Duration: {perf['avg_duration']:.1f} seconds")
        y += 1
        stdscr.addstr(y, 2, f"Memory Peak: {perf['memory_peak']:.1f}%")
        y += 1
        stdscr.addstr(y, 2, f"Rate Limited Count: {perf['rate_limited_count']}")
        
        # Draw tuning recommendations
        y += 2
        stdscr.addstr(y, 2, "Tuning Recommendations:", curses.A_BOLD)
        y += 1
        
        if perf["rate_limited_count"] > 10:
            stdscr.addstr(y, 4, "- Increase rate limit delay (high rate limiting detected)")
            y += 1
        
        if perf["success_rate"] < 0.8:
            stdscr.addstr(y, 4, "- Success rate is low, check extraction selectors")
            y += 1
        
        if perf["memory_peak"] > 80:
            stdscr.addstr(y, 4, "- Reduce max_session_permit (high memory usage)")
            y += 1
        
        if perf["avg_duration"] > 300:
            stdscr.addstr(y, 4, "- Crawl duration is high, increase concurrency")
            y += 1
    
    def _draw_history(self, stdscr, height, width):
        """Draw the history tab for the selected retailer"""
        if self.selected_retailer < 0 or self.selected_retailer >= len(self.retailers):
            stdscr.addstr(4, 2, "No retailer selected")
            return
        
        retailer = self.retailers[self.selected_retailer]
        if retailer not in self.statistics:
            stdscr.addstr(4, 2, f"No statistics available for {retailer}")
            return
        
        stats = self.statistics[retailer]
        
        # Display run history
        stdscr.addstr(4, 2, f"Run History for {retailer}", curses.A_BOLD)
        
        headers = ["Start Time", "Duration", "URLs", "Success", "Failed", "Products"]
        col_widths = [20, 12, 6, 8, 8, 8]
        
        # Draw table headers
        y = 6
        x = 2
        for i, header in enumerate(headers):
            stdscr.addstr(y, x, header, curses.A_BOLD)
            x += col_widths[i]
        
        # Draw table rows
        y = 7
        for run in stats["runs"]:
            x = 2
            
            # Start time
            start_time = "Unknown"
            if "start_time" in run:
                start_time = run["start_time"]
            stdscr.addstr(y, x, start_time[:col_widths[0]-1])
            x += col_widths[0]
            
            # Duration
            duration = "Unknown"
            if "duration_formatted" in run:
                duration = run["duration_formatted"]
            elif "duration_seconds" in run:
                duration = f"{run['duration_seconds']:.1f}s"
            stdscr.addstr(y, x, duration[:col_widths[1]-1])
            x += col_widths[1]
            
            # URLs processed
            urls = str(run.get("urls_processed", "?"))
            stdscr.addstr(y, x, urls[:col_widths[2]-1])
            x += col_widths[2]
            
            # Success
            success = str(run.get("successful", "?"))
            stdscr.addstr(y, x, success[:col_widths[3]-1])
            x += col_widths[3]
            
            # Failed
            failed = str(run.get("failed", "?"))
            stdscr.addstr(y, x, failed[:col_widths[4]-1])
            x += col_widths[4]
            
            # Products found
            products = str(run.get("products_found", "?"))
            stdscr.addstr(y, x, products[:col_widths[5]-1])
            
            y += 1
            if y >= height - 3:
                break
    
    def _draw_interface(self, stdscr):
        """Draw the dashboard interface"""
        # Clear screen
        stdscr.clear()
        
        # Get terminal size
        height, width = stdscr.getmaxyx()
        
        # Draw title bar
        stdscr.addstr(0, 0, "Crawler Monitoring Dashboard".center(width), curses.A_REVERSE)
        
        # Draw tabs
        tab_width = width // len(self.tabs)
        for i, tab in enumerate(self.tabs):
            if i == self.current_tab:
                stdscr.addstr(2, i * tab_width, tab.center(tab_width), curses.A_REVERSE)
            else:
                stdscr.addstr(2, i * tab_width, tab.center(tab_width))
        
        # Draw content for current tab
        if self.current_tab == 0:
            self._draw_summary(stdscr, height, width)
        elif self.current_tab == 1:
            self._draw_details(stdscr, height, width)
        elif self.current_tab == 2:
            self._draw_performance(stdscr, height, width)
        elif self.current_tab == 3:
            self._draw_history(stdscr, height, width)
        
        # Draw status bar
        status = " [Q] Quit | [Tab] Switch Tab | [R] Refresh | [↑/↓] Select Retailer "
        stdscr.addstr(height-1, 0, status.ljust(width)[:width-1], curses.A_REVERSE)
        
        # Refresh the screen
        stdscr.refresh()
    
    def _handle_input(self, key):
        """Handle user input"""
        if key == ord('q') or key == ord('Q'):
            self.running = False
        elif key == ord('\t'):
            self.current_tab = (self.current_tab + 1) % len(self.tabs)
        elif key == ord('r') or key == ord('R'):
            self._refresh_statistics()
        elif key == curses.KEY_UP and self.retailers:
            self.selected_retailer = (self.selected_retailer - 1) % len(self.retailers)
        elif key == curses.KEY_DOWN and self.retailers:
            self.selected_retailer = (self.selected_retailer + 1) % len(self.retailers)
    
    def run(self, stdscr):
        """Run the dashboard interface"""
        # Initialize curses
        curses.curs_set(0)  # Hide cursor
        stdscr.timeout(100)  # Set non-blocking input timeout
        
        # Initialize dashboard
        self._refresh_statistics()
        self.running = True
        
        # Main loop
        while self.running:
            # Handle auto-refresh
            current_time = time.time()
            if current_time - self.last_refresh > self.refresh_interval:
                self._refresh_statistics()
            
            # Draw interface
            self._draw_interface(stdscr)
            
            # Handle input
            key = stdscr.getch()
            if key != -1:
                self._handle_input(key)

def main():
    """Main function for the dashboard"""
    parser = argparse.ArgumentParser(description="Crawler Monitoring Dashboard")
    parser.add_argument("--data-dir", default="./data", help="Directory containing crawler data")
    args = parser.parse_args()
    
    # Wrap the dashboard in curses
    dashboard = CrawlerDashboard(data_dir=args.data_dir)
    curses.wrapper(dashboard.run)

if __name__ == "__main__":
    main() 