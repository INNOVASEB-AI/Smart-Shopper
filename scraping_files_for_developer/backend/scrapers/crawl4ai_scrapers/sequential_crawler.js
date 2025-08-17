/**
 * Node.js interface for the Sequential Crawler for PriceCheck.co.za
 * This module provides a class-based interface to interact with the Python sequential crawler.
 */

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

/**
 * SequentialCrawler class for crawling PriceCheck.co.za sequentially
 * using the same browser session to process multiple URLs from sitemap.xml
 */
class SequentialCrawler extends EventEmitter {
  /**
   * Creates a new SequentialCrawler instance
   * @param {Object} options - Configuration options
   * @param {string} [options.pythonPath='python'] - Path to the Python executable
   * @param {string} [options.scriptPath=path.join(__dirname, 'sequential_crawler.py')] - Path to the Python crawler script
   * @param {string} [options.outputDir='./data/pricecheck_results'] - Directory to save crawl results
   * @param {number} [options.maxUrls=50] - Maximum number of URLs to crawl
   */
  constructor(options = {}) {
    super();
    
    this.pythonPath = options.pythonPath || 'python';
    this.scriptPath = options.scriptPath || path.join(__dirname, 'sequential_crawler.py');
    this.outputDir = options.outputDir || path.join(process.cwd(), 'data', 'pricecheck_results');
    this.maxUrls = options.maxUrls || 50;
    
    this.process = null;
    this.isRunning = false;
    this.logs = [];
    this.lastStartTime = null;
  }

  /**
   * Start the sequential crawler process
   * @returns {Promise<boolean>} True if crawler started successfully
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Crawler is already running');
    }

    try {
      // Ensure output directory exists
      await fsPromises.mkdir(this.outputDir, { recursive: true });
      
      // Clear previous logs
      this.logs = [];
      
      // Record start time
      this.lastStartTime = new Date();
      
      // Spawn the Python process
      this.process = spawn(this.pythonPath, [
        this.scriptPath,
        '--max-urls', this.maxUrls.toString(),
        '--output-dir', this.outputDir
      ]);
      
      // Set running state
      this.isRunning = true;
      
      // Handle process output
      this.process.stdout.on('data', (data) => {
        const logEntry = data.toString().trim();
        this.logs.push({ timestamp: new Date(), type: 'info', message: logEntry });
        this.emit('log', { type: 'info', message: logEntry });
      });
      
      // Handle process errors
      this.process.stderr.on('data', (data) => {
        const logEntry = data.toString().trim();
        this.logs.push({ timestamp: new Date(), type: 'error', message: logEntry });
        this.emit('log', { type: 'error', message: logEntry });
      });
      
      // Handle process exit
      this.process.on('close', (code) => {
        this.isRunning = false;
        
        if (code === 0) {
          this.emit('complete', { success: true, message: 'Crawler completed successfully' });
        } else {
          this.emit('complete', { success: false, message: `Crawler process exited with code ${code}` });
        }
        
        this.process = null;
      });
      
      // Handle process errors
      this.process.on('error', (err) => {
        this.logs.push({ timestamp: new Date(), type: 'error', message: err.message });
        this.emit('error', err);
        this.isRunning = false;
        this.process = null;
      });
      
      return true;
    } catch (error) {
      this.logs.push({ timestamp: new Date(), type: 'error', message: error.message });
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop the crawler process if it's running
   * @returns {Promise<boolean>} True if crawler was stopped successfully
   */
  async stop() {
    if (!this.isRunning || !this.process) {
      return false;
    }
    
    return new Promise((resolve) => {
      this.process.on('close', () => {
        this.isRunning = false;
        this.process = null;
        resolve(true);
      });
      
      // Send SIGTERM signal to gracefully terminate the process
      this.process.kill('SIGTERM');
      
      // If the process doesn't exit within 5 seconds, force kill it
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Get the current status of the crawler
   * @returns {Object} Object containing status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      logs: this.logs,
      outputDir: this.outputDir,
      lastStartTime: this.lastStartTime,
      runDuration: this.lastStartTime ? (new Date() - this.lastStartTime) / 1000 : 0
    };
  }

  /**
   * Get the most recent crawler results
   * @param {number} [limit=10] - Maximum number of result files to return
   * @returns {Promise<Array>} Array of result objects
   */
  async getResults(limit = 10) {
    try {
      // Check if the output directory exists
      try {
        await fsPromises.access(this.outputDir);
      } catch (error) {
        return [];
      }
      
      // Find all JSON files in the output directory recursively
      const jsonFiles = await this.findJsonFiles(this.outputDir);
      
      // Sort files by modification time (most recent first)
      const fileStats = await Promise.all(
        jsonFiles.map(async (file) => {
          const stats = await fsPromises.stat(file);
          return { file, mtime: stats.mtime };
        })
      );
      
      fileStats.sort((a, b) => b.mtime - a.mtime);
      
      // Read the content of the most recent files
      const results = [];
      for (let i = 0; i < Math.min(fileStats.length, limit); i++) {
        try {
          const fileContent = await fsPromises.readFile(fileStats[i].file, 'utf-8');
          const data = JSON.parse(fileContent);
          results.push({
            file: fileStats[i].file,
            timestamp: fileStats[i].mtime,
            data
          });
        } catch (error) {
          console.error(`Error reading file ${fileStats[i].file}:`, error);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error getting results:', error);
      return [];
    }
  }

  /**
   * Find all JSON files in a directory recursively
   * @private
   * @param {string} dir - Directory path
   * @returns {Promise<Array<string>>} Array of file paths
   */
  async findJsonFiles(dir) {
    const files = await fsPromises.readdir(dir);
    const jsonFiles = [];
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fsPromises.stat(filePath);
      
      if (stats.isDirectory()) {
        const nestedJsonFiles = await this.findJsonFiles(filePath);
        jsonFiles.push(...nestedJsonFiles);
      } else if (path.extname(file) === '.json') {
        jsonFiles.push(filePath);
      }
    }
    
    return jsonFiles;
  }
}

module.exports = SequentialCrawler; 