// security.js - Security utilities for input validation and sanitization

/**
 * Sanitizes user input to prevent XSS attacks
 * @param {string} input - The user input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (!input) return '';
  
  // Convert to string if not already
  const str = String(input);
  
  // Replace HTML special chars with entities
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export function isValidEmail(email) {
  if (!email) return false;
  
  // Basic email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid flag and message
 */
export function validatePassword(password) {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters' };
  }
  
  // Check for at least one number
  if (!/\d/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  return { isValid: true, message: 'Password is valid' };
}

/**
 * Validates search input
 * @param {string} searchTerm - Search term to validate
 * @returns {object} - Validation result with isValid flag and sanitized term
 */
export function validateSearchTerm(searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    return { isValid: false, sanitized: '' };
  }
  
  // Limit search term length
  let term = searchTerm.slice(0, 100);
  
  // Sanitize the search term
  const sanitized = sanitizeInput(term);
  
  return { isValid: true, sanitized };
}

/**
 * Rate limiter for form submissions
 */
export class RateLimiter {
  constructor(maxAttempts = 5, timeWindowMs = 60000) {
    this.attempts = {};
    this.maxAttempts = maxAttempts;
    this.timeWindowMs = timeWindowMs;
  }
  
  /**
   * Check if action is allowed
   * @param {string} actionKey - Unique key for the action (e.g. 'login', 'search')
   * @returns {boolean} - Whether action is allowed
   */
  isAllowed(actionKey) {
    const now = Date.now();
    
    // Initialize attempts for this action if not exists
    if (!this.attempts[actionKey]) {
      this.attempts[actionKey] = { count: 0, timestamp: now };
      return true;
    }
    
    // Reset attempts if time window has passed
    if (now - this.attempts[actionKey].timestamp > this.timeWindowMs) {
      this.attempts[actionKey] = { count: 1, timestamp: now };
      return true;
    }
    
    // Increment attempts
    this.attempts[actionKey].count++;
    
    // Check if exceeded max attempts
    return this.attempts[actionKey].count <= this.maxAttempts;
  }
  
  /**
   * Reset attempts for an action
   * @param {string} actionKey - Action key to reset
   */
  reset(actionKey) {
    if (this.attempts[actionKey]) {
      delete this.attempts[actionKey];
    }
  }
}

// Create and export a global rate limiter instance
export const rateLimiter = new RateLimiter(); 