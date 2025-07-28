// services/streamService.js - Streaming response handling
import { ReadableStream } from 'stream/web';
import { logger } from '../utils/logging.js';
import { getGeminiClient } from './geminiService.js';
import { addChatEntry, getTokenUsage } from '../db.js';
import { extractGeminiTokenCount, simpleTokenEstimate } from '../tokenUtils.js';
import { broadcastUpdate } from '../websocket/wsBroadcast.js';
import { config } from '../config.js';

// Handle streaming chat request
export async function handleStreamingChat(c) {
  const body = await c.req.json();
  const userMessage = body.message;
  const modelName = body.model || config.defaultModel;
  const options = body.options || {};
  const format = body.format || 'json'; // 'json' or 'text'
  
  logger.debug(`Streaming request: Model=${modelName}, Format=${format}`);
  
  if (!userMessage) {
    logger.warn('No message provided in request');
    return c.json({ error: 'No message provided' }, 400);
  }

  // Simple input token estimation (for logging purposes only)
  const inputTokenEstimate = simpleTokenEstimate(userMessage);
  
  logger.info(`User Query (est. ~${inputTokenEstimate} tokens): ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`);

  try {
    // Create a stream to pass to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const client = getGeminiClient();
          
          // Get the Gemini model
          const model = client.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: options.temperature || config.defaultGenerationOptions.temperature,
              maxOutputTokens: options.maxTokens || config.defaultGenerationOptions.maxTokens,
              topK: options.topK || config.defaultGenerationOptions.topK,
              topP: options.topP || config.defaultGenerationOptions.topP,
            }
          });

          logger.debug(`Using model: ${modelName}`);

          // Generate content stream
          const result = await model.generateContentStream([userMessage]);
          
          // To collect the full response for saving to the database
          let fullResponse = '';
          
          logger.debug("Starting response stream...");
          
          // Process the stream
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              fullResponse += text;
              
              if (format === 'json') {
                // Send each chunk as a JSON object
                const jsonChunk = JSON.stringify({ 
                  chunk: text,
                  done: false
                });
                controller.enqueue(new TextEncoder().encode(jsonChunk + '\n'));
              } else {
                // Send raw text
                controller.enqueue(new TextEncoder().encode(text));
              }
            }
          }
          
          logger.debug("Response stream completed");
          
          // Get final response to extract metadata
          const finalResponse = await result.response;
          
          // Extract Gemini's token count
          const geminiTokenCount = extractGeminiTokenCount(finalResponse);
          
          logger.info(`Response complete. Gemini reported tokens: ${geminiTokenCount || 'Not available'}`);
          
          // Save the chat entry to the database
          logger.debug("Saving chat entry to database...");
          const dbEntry = await addChatEntry(
            userMessage, 
            fullResponse, 
            geminiTokenCount, 
            modelName, 
            options
          );
          logger.debug(`Chat entry saved with ID: ${dbEntry.chatId}`);
          
          // Get updated token usage after logging
          const usage = await getTokenUsage();
          logger.debug(`Total tokens used: ${usage.total_tokens_used}/${usage.total_limit}`);
          
          // Check if this request pushed us over the limit
          const isOverLimit = usage.total_tokens_used >= usage.total_limit;
          
          // Send completion message if using JSON format
          if (format === 'json') {
            const jsonChunk = JSON.stringify({ 
              chunk: '',
              done: true,
              usage: {
                geminiTokenCount,
                totalTokensUsed: usage.total_tokens_used,
                limit: usage.total_limit,
                remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
                tokensAdded: dbEntry.tokensAdded,
                limitExceeded: isOverLimit,
              },
              warning: isOverLimit ? `Token limit exceeded after this request. You've used ${usage.total_tokens_used} out of ${usage.total_limit} tokens.` : null
            });
            controller.enqueue(new TextEncoder().encode(jsonChunk + '\n'));
          }
          
          controller.close();
          
          // Broadcast updates to all WebSocket clients
          broadcastUpdate();
        } catch (error) {
          logger.error("Error in stream generation:", error);
          
          if (format === 'json') {
            // Send error as JSON
            const jsonError = JSON.stringify({ 
              error: error.message,
              done: true
            });
            controller.enqueue(new TextEncoder().encode(jsonError + '\n'));
          }
          
          controller.error(error);
        }
      }
    });

    const headers = {
      'Cache-Control': 'no-cache',
    };
    
    // Set the appropriate Content-Type based on the format
    if (format === 'json') {
      headers['Content-Type'] = 'application/x-ndjson';
    } else {
      headers['Content-Type'] = 'text/plain';
    }

    logger.debug('Streaming response started');
    return new Response(stream, { headers });
  } catch (error) {
    logger.error('Failed to process streaming chat request:', error);
    return c.json({ 
      error: 'Failed to generate response', 
      details: error.message 
    }, 500);
  }
}
