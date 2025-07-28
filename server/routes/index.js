// routes/index.js - Route aggregator
import { logger } from '../utils/logging.js';
import { setupApiRoutes } from './apiRoutes.js';
import { setupChatRoutes } from './chatRoutes.js';
import { setupAdminRoutes } from './adminRoutes.js';

export function setupRoutes(app) {
  logger.info("Setting up routes...");
  
  // Setup basic API routes
  setupApiRoutes(app);
  
  // Setup chat-related routes
  setupChatRoutes(app);
  
  // Setup admin routes
  setupAdminRoutes(app);
  
  // Log all registered routes
  logRegisteredRoutes(app);
}

function logRegisteredRoutes(app) {
  logger.info("Registered routes:");
  const routes = [];
  
  app.routes.forEach(route => {
    logger.info(`- ${route.method} ${route.path}`);
  });
}

