// middleware.js - Setting up CORS and other middleware
import { cors } from 'hono/cors';
import { logger } from './utils/logging.js';

export function setupMiddleware(app) {
  logger.info("Setting up middleware...");
  
  // Enable CORS for all routes with detailed config
  app.use('/*', cors({
    origin: '*', // Allow all origins for development - CONSIDER RESTRICTING FOR PRODUCTION
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }));
  
  // Request logging middleware
  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.http(`${c.req.method} ${c.req.path} ${c.res.status} - ${ms}ms`);
  });
  
  // Error handling middleware
  app.onError((err, c) => {
    logger.error('Route error:', err);
    return c.json({ 
      error: 'Internal Server Error', 
      message: err.message 
    }, 500);
  });
}

