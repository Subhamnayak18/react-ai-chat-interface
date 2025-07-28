// index.js - Entry point and server initialization
import http from 'http';
import { Hono } from 'hono';
import { config } from './config.js';
import { initializeDatabase } from './db.js';
import { setupMiddleware } from './middleware.js';
import { setupRoutes } from './routes/index.js';
import { setupWebSocketServer } from './websocket/wsServer.js';
import { logger } from './utils/logging.js';
import { serve } from '@hono/node-server';

// Initialize Hono app
const app = new Hono();

// Setup middleware (CORS, etc.)
setupMiddleware(app);

// Setup API routes
setupRoutes(app);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.success('[DB] Database initialized successfully');
    
    // Start the server using @hono/node-server
    serve({
      fetch: app.fetch,
      port: config.port
    }, (info) => {
      logger.success(`Server running at http://localhost:${info.port}`);
      logger.info(`Admin dashboard: http://localhost:${info.port}/admin`);
    });
    
    // Setup WebSocket server
    // Note: With @hono/node-server, you might need to access the server instance differently if needed for WebSocket
    
    // Setup graceful shutdown
    // Adjust as needed for the new server setup
  } catch (err) {
    logger.fatal('Server initialization failed:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
function setupGracefulShutdown(server) {
  // Graceful shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));
}

async function gracefulShutdown(server, signal) {
  logger.warn(`${signal} received, shutting down gracefully`);
  
  try {
    // Close HTTP server
    server.close();
    
    // Close database
    const { getDb } = await import('./db.js');
    const db = await getDb();
    await db.close();
    logger.info('[DB] Database connection closed');
    
    // Close WebSocket connections
    const { closeAllConnections } = await import('./websocket/wsServer.js');
    await closeAllConnections();
    
    logger.success('Graceful shutdown completed');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  
  process.exit(0);
}

// Start the server
startServer();
