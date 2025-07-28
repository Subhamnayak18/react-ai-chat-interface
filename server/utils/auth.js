// utils/auth.js - Authentication utilities
import { logger } from './logging.js';
import { config } from '../config.js';

// Verify admin access
export async function verifyAdminAccess(c) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    logger.warn('Admin access attempted without Authorization header');
    return false;
  }
  
  // Extract token from Bearer format
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    logger.warn('Admin access attempted with malformed Authorization header');
    return false;
  }
  
  const token = tokenMatch[1];
  
  // Verify token
  if (token !== config.adminAuthToken) {
    logger.warn('Admin access attempted with invalid token');
    return false;
  }
  
  logger.debug('Admin access granted');
  return true;
}

