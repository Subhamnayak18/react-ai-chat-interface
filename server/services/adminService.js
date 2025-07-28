// services/adminService.js - Admin-specific services
import fs from 'fs';
import { logger } from '../utils/logging.js';
import { getDb, extendTokenLimit as dbExtendLimit, clearDatabase as dbClearDatabase } from '../db.js';
import { broadcastUpdate } from '../websocket/wsBroadcast.js';
import { config } from '../config.js';

// Serve admin dashboard
export async function serveAdminDashboard(c) {
  try {
    if (fs.existsSync(config.adminHtmlPath)) {
      const adminHtml = fs.readFileSync(config.adminHtmlPath, 'utf8');
      logger.debug('Admin dashboard served successfully');
      return c.html(adminHtml);
    } else {
      logger.error(`Admin dashboard file not found at path: ${config.adminHtmlPath}`);
      return c.text('Admin dashboard file not found', 404);
    }
  } catch (error) {
    logger.error('Failed to serve admin dashboard:', error);
    return c.text(`Error serving admin dashboard: ${error.message}`, 500);
  }
}

// Extend token limit
export async function extendTokenLimit(amountToExtend, maxAllowedExtension = config.maxExtensionAmount) {
  try {
    if (isNaN(amountToExtend) || amountToExtend <= 0) {
      throw new Error("Invalid extension amount");
    }
    
    if (amountToExtend > maxAllowedExtension) {
      throw new Error(`Extension amount exceeds the maximum allowed (${maxAllowedExtension} tokens)`);
    }
    
    // Extend token limit in database
    const result = await dbExtendLimit(amountToExtend, maxAllowedExtension);
    
    // Broadcast update to all WebSocket clients
    broadcastUpdate();
    
    logger.success(`Token limit extended by ${amountToExtend}. New limit: ${result.newLimit}`);
    
    return result;
  } catch (error) {
    logger.error('Failed to extend token limit:', error);
    throw error;
  }
}

// Clear database
export async function clearDatabase() {
  try {
    // Clear database
    await dbClearDatabase();
    
    // Broadcast update to all WebSocket clients
    broadcastUpdate();
    
    logger.success('Database cleared successfully');
    
    return true;
  } catch (error) {
    logger.error('Failed to clear database:', error);
    throw error;
  }
}

