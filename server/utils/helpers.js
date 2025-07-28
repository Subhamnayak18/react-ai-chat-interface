// utils/helpers.js - Helper functions
import { logger } from './logging.js';

// Parse an integer with validation
export function parseInteger(value, defaultValue = 0) {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Safe JSON parsing
export function safeJsonParse(str, defaultValue = {}) {
  try {
    return JSON.parse(str);
  } catch (error) {
    logger.warn('JSON parse failed:', error.message);
    return defaultValue;
  }
}

// Truncate text to a specified length
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Sanitize user input for logging
export function sanitizeForLog(input, maxLength = 500) {
  if (!input) return '';
  
  // Convert to string if not already
  const str = typeof input !== 'string' ? String(input) : input;
  
  // Truncate if needed
  const truncated = truncate(str, maxLength);
  
  // Replace newlines with spaces for more concise logs
  return truncated.replace(/\s+/g, ' ');
}

