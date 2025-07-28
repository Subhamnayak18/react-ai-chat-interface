// services/chatService.js - Non-streaming chat service
import { logger } from '../utils/logging.js';
import { getGeminiClient } from './geminiService.js';
import { addChatEntry, getTokenUsage } from '../db.js';
import { extractGeminiTokenCount, simpleTokenEstimate } from '../tokenUtils.js';
import { broadcastUpdate } from '../websocket/wsBroadcast.js';
import { config } from '../config.js';

// Handle non-streaming chat request
export async function handleNonStreamingChat(c) {
  const body = await c.req.json();
  const userMessage = body.message;
  const modelName = body.model || config.defaultModel;
  const options = body.options || {};
  
  logger.debug(`Chat request: Model=${modelName}`);
  
  if (!userMessage) {
    logger.warn('No message provided in request');
    return c.json({ error: 'No message provided' }, 400);
  }

  // Simple input token estimation (for logging purposes only)
  const inputTokenEstimate = simpleTokenEstimate(userMessage);
  
  logger.info(`User Query (est. ~${inputTokenEstimate} tokens): ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`);

  try {
    const client = getGeminiClient();
    
    // Get the Gemini model
    let model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options.temperature || config.defaultGenerationOptions.temperature,
        maxOutputTokens: options.maxTokens || config.defaultGenerationOptions.maxTokens,
        topK: options.topK || config.defaultGenerationOptions.topK,
        topP: options.topP || config.defaultGenerationOptions.topP,
      }
    });

    logger.debug(`Using model: ${modelName}`);

    // Generate content
    logger.debug("Sending request to Gemini API...");
    let result;
    try {
      result = await model.generateContent(userMessage);
    } catch (err) {
      // Check for quota exceeded error and fallback to gemini-1.5-flash
      if (err.message && err.message.includes('429 Too Many Requests') && modelName === 'gemini-1.5-pro') {
        logger.warn('Quota exceeded for gemini-1.5-pro, falling back to gemini-1.5-flash');
        model = client.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            temperature: options.temperature || config.defaultGenerationOptions.temperature,
            maxOutputTokens: options.maxTokens || config.defaultGenerationOptions.maxTokens,
            topK: options.topK || config.defaultGenerationOptions.topK,
            topP: options.topP || config.defaultGenerationOptions.topP,
          }
        });
        result = await model.generateContent(userMessage);
      } else {
        throw err;
      }
    }

    const response = result.response.text();
    logger.debug("Received response from Gemini API");
    
    logger.info(`Response received (length: ${response.length})`);
    
    // Extract Gemini's token count
    const geminiTokenCount = extractGeminiTokenCount(result);
    
    // Save the chat entry to the database
    logger.debug("Saving chat entry to database...");
    const dbEntry = await addChatEntry(
      userMessage, 
      response, 
      geminiTokenCount, 
      modelName, 
      options
    );
    logger.debug(`Chat entry saved with ID: ${dbEntry.chatId}`);
    
    // Get updated token usage
    const usage = await getTokenUsage();
    logger.debug(`Total tokens used: ${usage.total_tokens_used}/${usage.total_limit}`);
    
    // Broadcast updates to all WebSocket clients
    broadcastUpdate();
    
    // Check if this request pushed us over the limit
    if (usage.total_tokens_used >= usage.total_limit) {
      // If we just exceeded the limit, return a warning but still provide the response
      const responseData = { 
        response,
        warning: 'Token limit exceeded after this request',
        exceeded: true,
        usage: {
          geminiTokenCount,
          totalTokensUsed: usage.total_tokens_used,
          limit: usage.total_limit,
          remaining: 0,
          tokensAdded: dbEntry.tokensAdded
        },
        message: `You've used ${usage.total_tokens_used} out of ${usage.total_limit} tokens.`
      };
      return c.json(responseData);
    }
    
    const responseData = { 
      response,
      usage: {
        geminiTokenCount,
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
        tokensAdded: dbEntry.tokensAdded
      }
    };
    return c.json(responseData);
  } catch (error) {
    logger.error('Failed to process chat request: ' + error.message + '\n' + error.stack);
    return c.json({ 
      error: 'Failed to generate response', 
      details: error.message,
      stack: error.stack 
    }, 500);
  }
}
