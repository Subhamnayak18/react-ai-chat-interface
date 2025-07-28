// routes/adminRoutes.js - Admin-specific routes
import fs from 'fs';
import { logger } from '../utils/logging.js';
import { verifyAdminAccess } from '../utils/auth.js';
import { serveAdminDashboard, extendTokenLimit, clearDatabase } from '../services/adminService.js';
import { config } from '../config.js';

export function setupAdminRoutes(app) {
  logger.info("Setting up admin routes...");

  // Serve admin dashboard
  app.get('/admin', async (c) => {
    logger.debug('Admin dashboard requested');
    return await serveAdminDashboard(c);
  });

  // Extend token limit endpoint
  app.post('/api/admin/extend-limit', async (c) => {
    logger.debug('Token limit extension requested');
    
    // To implement authentication later:
    // const authorized = await verifyAdminAccess(c);
    // if (!authorized) {
    //   return c.json({ error: 'Unauthorized access' }, 401);
    // }
    
    try {
      const body = await c.req.json();
      const amountToExtend = parseInt(body.amount);
      logger.debug(`Amount to extend: ${amountToExtend}`);
      
      if (!amountToExtend || isNaN(amountToExtend) || amountToExtend <= 0) {
        logger.warn('Invalid extension amount provided');
        return c.json({ error: 'Invalid or negative extension amount provided' }, 400);
      }
      
      if (amountToExtend > config.maxExtensionAmount) {
        logger.warn('Extension amount exceeds maximum allowed');
        return c.json({ error: `Extension amount exceeds the maximum allowed (${config.maxExtensionAmount} tokens)` }, 400);
      }

      // Extend token limit
      const result = await extendTokenLimit(amountToExtend, config.maxExtensionAmount);
      
      return c.json({
        success: true,
        message: `Token limit extended by ${amountToExtend}.`,
        previousLimit: result.previousLimit,
        newLimit: result.newLimit,
        currentUsage: result.currentUsage
      });
    } catch (error) {
      logger.error('Failed to extend token limit:', error);
      return c.json({ 
        error: 'Failed to extend token limit', 
        details: error.message 
      }, 500);
    }
  });
  
  // Clear database endpoint
  app.post('/api/admin/clear-database', async (c) => {
    logger.debug('Database clear requested');
    
    // To implement authentication later:
    // const authorized = await verifyAdminAccess(c);
    // if (!authorized) {
    //   return c.json({ error: 'Unauthorized access' }, 401);
    // }
    
    try {
      await clearDatabase();
      
      logger.success('Database cleared successfully');
      return c.json({
        success: true,
        message: 'Database cleared successfully'
      });
    } catch (error) {
      logger.error('Failed to clear database:', error);
      return c.json({ 
        error: 'Failed to clear database', 
        details: error.message 
      }, 500);
    }
  });
}

