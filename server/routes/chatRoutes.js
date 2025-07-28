// routes/chatRoutes.js - Chat-related endpoints
import { logger } from '../utils/logging.js';
import { handleNonStreamingChat } from '../services/chatService.js';
import { handleStreamingChat } from '../services/streamService.js';
import { isTokenLimitExceeded, getTokenUsage } from '../db.js';
import { config } from '../config.js';

export function setupChatRoutes(app) {
  logger.info("Setting up chat routes...");

  // Standard chat endpoint (non-streaming)
  app.post('/api/chat', async (c) => {
    logger.debug('New chat request received');
    
    // Check for API key configuration
    if (!config.geminiApiKey) {
      logger.error('GEMINI_API_KEY not configured on server');
      return c.json({ error: 'GEMINI_API_KEY not configured on server' }, 500);
    }
    
    // Check token limit before processing
    const tokenLimitExceeded = await isTokenLimitExceeded();
    if (tokenLimitExceeded) {
      const usage = await getTokenUsage();
      logger.warn(`Token limit exceeded: ${usage.total_tokens_used}/${usage.total_limit}`);
      return c.json({ 
        error: 'Token limit exceeded', 
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        exceeded: true,
        message: `You've used ${usage.total_tokens_used} out of ${usage.total_limit} tokens.`
      }, 200);
    }

    // Process non-streaming chat
    return await handleNonStreamingChat(c);
  });

  // Streaming chat endpoint
  app.post('/api/stream', async (c) => {
    logger.debug('New streaming chat request received');
    
    // Check for API key configuration
    if (!config.geminiApiKey) {
      logger.error('GEMINI_API_KEY not configured on server');
      return c.json({ error: 'GEMINI_API_KEY not configured on server' }, 500);
    }
    
    // Check token limit before processing
    const tokenLimitExceeded = await isTokenLimitExceeded();
    if (tokenLimitExceeded) {
      const usage = await getTokenUsage();
      logger.warn(`Token limit exceeded: ${usage.total_tokens_used}/${usage.total_limit}`);
      return c.json({ 
        error: 'Token limit exceeded', 
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        exceeded: true,
        message: `You've used ${usage.total_tokens_used} out of ${usage.total_limit} tokens.`
      }, 200);
    }
    
    // Process streaming chat
    return await handleStreamingChat(c);
  });
  
  // Keep the existing /api/chat/complete endpoint for backward compatibility
  // but mark it as deprecated
  app.post('/api/chat/complete', async (c) => {
    logger.debug('Deprecated /api/chat/complete endpoint called');
    logger.warn('The /api/chat/complete endpoint is deprecated. Please use /api/chat instead.');
    
    return await handleNonStreamingChat(c);
  });
}