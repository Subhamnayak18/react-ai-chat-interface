// routes/apiRoutes.js - Basic API routes
import { logger } from '../utils/logging.js';
import { getTokenUsage, getRecentChats, getTokenComparison, getDb } from '../db.js';
import { 
  getAvailableModels, 
  getModelById, 
  getModelsByCategory, 
  getModelCategories 
} from '../services/geminiService.js';
import { config } from '../config.js';

export function setupApiRoutes(app) {
  logger.info("Setting up API routes...");

  // Health check endpoint
  app.get('/api/health', (c) => {
    logger.debug('Health check called');
    const response = { 
      status: 'ok', 
      message: 'GBOT Server is running',
      product: 'GBOT',
      tier: 'Tier 0',
      version: '1.0.0',
      geminiApiKeyConfigured: !!config.geminiApiKey,
      timestamp: new Date().toISOString()
    };
    return c.json(response);
  });

  // GBOT Models endpoints
  app.get('/api/models', async (c) => {
    logger.debug('GBOT models list requested');
    try {
      const models = getAvailableModels();
      
      const response = {
        success: true,
        product: 'GBOT',
        tier: 'tier0',
        models,
        count: models.length,
        categories: getModelCategories(),
        meta: {
          totalModels: models.length,
          previewModels: models.filter(m => m.isPreview).length,
          experimentalModels: models.filter(m => m.isExperimental).length,
          lastUpdated: new Date().toISOString()
        }
      };
      
      logger.debug(`Returned ${models.length} GBOT models`);
      return c.json(response);
    } catch (error) {
      logger.error('Failed to get GBOT models:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve models',
        details: error.message
      }, 500);
    }
  });

  // Get specific model by ID
  app.get('/api/models/:modelId', async (c) => {
    const modelId = c.req.param('modelId');
    logger.debug(`Model details requested for: ${modelId}`);
    
    try {
      const model = getModelById(modelId);
      
      if (!model) {
        return c.json({
          success: false,
          error: 'Model not found',
          message: `Model '${modelId}' is not available in GBOT Tier 0`
        }, 404);
      }
      
      return c.json({
        success: true,
        model,
        product: 'GBOT',
        tier: 'tier0'
      });
    } catch (error) {
      logger.error(`Failed to get model ${modelId}:`, error);
      return c.json({
        success: false,
        error: 'Failed to retrieve model',
        details: error.message
      }, 500);
    }
  });

  // Get models by category
  app.get('/api/models/category/:category', async (c) => {
    const category = c.req.param('category');
    logger.debug(`Models requested for category: ${category}`);
    
    try {
      const models = getModelsByCategory(category);
      
      return c.json({
        success: true,
        category,
        models,
        count: models.length,
        product: 'GBOT',
        tier: 'tier0'
      });
    } catch (error) {
      logger.error(`Failed to get models for category ${category}:`, error);
      return c.json({
        success: false,
        error: 'Failed to retrieve models by category',
        details: error.message
      }, 500);
    }
  });

  // Get model categories
  app.get('/api/models/meta/categories', async (c) => {
    logger.debug('Model categories requested');
    
    try {
      const categories = getModelCategories();
      
      return c.json({
        success: true,
        categories,
        count: categories.length,
        product: 'GBOT',
        tier: 'tier0'
      });
    } catch (error) {
      logger.error('Failed to get model categories:', error);
      return c.json({
        success: false,
        error: 'Failed to retrieve categories',
        details: error.message
      }, 500);
    }
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
        tokenComparisonsCount: comparisonCount?.count || 0,
        product: 'GBOT',
        tier: 'tier0'
      };
      
      return c.json(response);
    } catch (error) {
      logger.error('Database debug failed:', error);
      return c.json({
        databaseInitialized: false,
        error: 'Database debug failed',
        message: error.message,
        product: 'GBOT',
        tier: 'tier0'
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
          message: `You've used ${usage.total_tokens_used} out of ${usage.total_limit} tokens.`,
          product: 'GBOT',
          tier: 'tier0',
          upgradeMessage: 'Upgrade to GBOX for 10x more tokens!'
        };
        return c.json(response, 200);
      }
      
      const response = {
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
        exceeded: false,
        product: 'GBOT',
        tier: 'tier0'
      };
      return c.json(response);
    } catch (error) {
      logger.error('Failed to get token usage:', error);
      return c.json({ 
        error: 'Failed to get token usage', 
        details: error.message,
        product: 'GBOT',
        tier: 'tier0'
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
        count: chats.length,
        product: 'GBOT',
        tier: 'tier0'
      });
    } catch (error) {
      logger.error('Failed to get chat history:', error);
      return c.json({ 
        error: 'Failed to get chat history', 
        details: error.message,
        product: 'GBOT',
        tier: 'tier0'
      }, 500);
    }
  });

  // Get token comparison stats endpoint
  app.get('/api/token-comparison', async (c) => {
    logger.debug('Token comparison stats requested');
    try {
      const stats = await getTokenComparison();
      const response = stats[0] || { message: "No comparison data available" };
      response.product = 'GBOT';
      response.tier = 'tier0';
      return c.json(response);
    } catch (error) {
      logger.error('Failed to get token comparison:', error);
      return c.json({ 
        error: 'Failed to get token comparison', 
        details: error.message,
        product: 'GBOT',
        tier: 'tier0'
      }, 500);
    }
  });
}
