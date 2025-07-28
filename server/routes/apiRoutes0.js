// routes/apiRoutes.js - Basic API routes
import { logger } from '../utils/logging.js';
import { getTokenUsage, getRecentChats, getTokenComparison, getDb } from '../db.js';
import { getAvailableModels } from '../services/geminiService.js';
import { config } from '../config.js';

export function setupApiRoutes(app) {
  logger.info("Setting up API routes...");

  // Health check endpoint
  app.get('/api/health', (c) => {
    logger.debug('Health check called');
    const response = { 
      status: 'ok', 
      message: 'Server is running',
      geminiApiKeyConfigured: !!config.geminiApiKey,
      timestamp: new Date().toISOString()
    };
    return c.json(response);
  });

  // Database status debug endpoint
  app.get('/api/debug/database', async (c) => {
    logger.debug('Database debug info requested');
    try {
      const db = await getDb();
      
      // Check if tables exist
      const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
      
      // Get usage stats
      const usageStats = await db.get('SELECT * FROM usage_stats LIMIT 1');
      
      // Count records in chat history
      const chatCount = await db.get('SELECT COUNT(*) as count FROM chat_history');
      
      // Count records in token comparisons
      const comparisonCount = await db.get('SELECT COUNT(*) as count FROM token_comparisons');
      
      const response = {
        databaseInitialized: true,
        tables: tables.map(t => t.name),
        usageStats,
        chatHistoryCount: chatCount?.count || 0,
        tokenComparisonsCount: comparisonCount?.count || 0
      };
      
      return c.json(response);
    } catch (error) {
      logger.error('Database debug failed:', error);
      return c.json({
        databaseInitialized: false,
        error: 'Database debug failed',
        message: error.message,
      }, 500);
    }
  });

  // Get token usage endpoint
  app.get('/api/usage', async (c) => {
    logger.debug('Token usage requested');
    try {
      const usage = await getTokenUsage();
      
      // Check if token limit is exceeded but still return 200 status code
      if (usage.total_tokens_used >= usage.total_limit) {
        const response = {
          error: 'Token limit exceeded', 
          totalTokensUsed: usage.total_tokens_used,
          limit: usage.total_limit,
          remaining: 0,
          exceeded: true,
          message: `You've used ${usage.total_tokens_used} out of ${usage.total_limit} tokens.`
        };
        return c.json(response, 200);
      }
      
      const response = {
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
        exceeded: false
      };
      return c.json(response);
    } catch (error) {
      logger.error('Failed to get token usage:', error);
      return c.json({ 
        error: 'Failed to get token usage', 
        details: error.message 
      }, 500);
    }
  });

  // Get recent chat history endpoint
  app.get('/api/chats', async (c) => {
    logger.debug('Chat history requested');
    try {
      const limit = c.req.query('limit') ? parseInt(c.req.query('limit')) : 10;
      const chats = await getRecentChats(limit);
      
      return c.json({
        chats,
        count: chats.length
      });
    } catch (error) {
      logger.error('Failed to get chat history:', error);
      return c.json({ 
        error: 'Failed to get chat history', 
        details: error.message 
      }, 500);
    }
  });

  // Get token comparison stats endpoint
  app.get('/api/token-comparison', async (c) => {
    logger.debug('Token comparison stats requested');
    try {
      const stats = await getTokenComparison();
      return c.json(stats[0] || { message: "No comparison data available" });
    } catch (error) {
      logger.error('Failed to get token comparison:', error);
      return c.json({ 
        error: 'Failed to get token comparison', 
        details: error.message 
      }, 500);
    }
  });

  // Models endpoint to list available models
  app.get('/api/models', async (c) => {
    logger.debug('Available models requested');
    const models = await getAvailableModels();
    
    return c.json({ 
      models: models,
      count: models.length
    });
  });
}
