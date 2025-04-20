const winston = require('winston');
const config = require('./config');

// Define log formats
const formats = {
  console: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  file: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
};

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  transports: [
    new winston.transports.Console({
      format: formats.console,
    }),
    // Optional: Add file transport for persistent logs
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: formats.file,
    }),
    new winston.transports.File({
      filename: 'combined.log',
      format: formats.file,
    }),
  ],
});

// Add convenience methods for scraper-specific logs
const createScraperLogger = (retailer) => {
  return {
    debug: (message) => logger.debug(`[${retailer}] ${message}`),
    info: (message) => logger.info(`[${retailer}] ${message}`),
    warn: (message) => logger.warn(`[${retailer}] ${message}`),
    error: (message, error) => {
      if (error) {
        logger.error(`[${retailer}] ${message}`, { error: error.message, stack: error.stack });
      } else {
        logger.error(`[${retailer}] ${message}`);
      }
    },
  };
};

module.exports = {
  logger,
  createScraperLogger,
};
