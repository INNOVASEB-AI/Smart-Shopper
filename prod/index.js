/**
 * Smart Shopper SA - Production Backend API
 * 
 * This file provides the backend API for the deployed Smart Shopper SA application.
 * It serves product data from the database and handles search requests.
 */

const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors");
const { logger } = require("firebase-functions");

// Import the search functionality
const searchRouter = require("../backend/routes/api/search");

// Create Express app for the API
const express = require("express");
const app = express();

// Enable CORS for all routes
app.use(cors({ origin: true }));
app.use(express.json());

// Use the search router for /api/search endpoints
app.use('/api/search', searchRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Smart Shopper SA API'
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Smart Shopper SA API',
    version: '1.0.0',
    endpoints: {
      search: '/api/search',
      health: '/api/health',
      status: '/api/search/status'
    }
  });
});

// Export the API as a Firebase Function
exports.api = onRequest(app);

// Export individual endpoints for better performance
exports.search = onRequest(async (req, res) => {
  try {
    // Import search functionality
    const searchRouter = require("../backend/routes/api/search");
    
    // Handle the request
    await searchRouter(req, res);
  } catch (error) {
    logger.error('Search API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

exports.health = onRequest((req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Smart Shopper SA API'
  });
});
