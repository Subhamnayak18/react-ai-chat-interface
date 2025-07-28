
// tokenUtils.js - Token counting and estimation utilities
import { logger } from './utils/logging.js';

// Simple token estimation method (roughly 4 characters per token)
export function simpleTokenEstimate(text) {
  if (!text) return 0;
  // Simple approximation: 1 token ~ 4 characters
  return Math.ceil(text.length / 4);
}

// Extract token count from Gemini API response
export function extractGeminiTokenCount(apiResponse) {
  try {
    // Check for null/undefined response
    if (!apiResponse) {
      logger.debug("No API response provided for token extraction");
      return null;
    }
    
    // Try different possible paths for token information based on Gemini API structure
    let tokenCount = null;
    
    // First check if we have usageMetadata directly
    if (apiResponse.usageMetadata) {
      tokenCount = apiResponse.usageMetadata.totalTokenCount || 
                  (apiResponse.usageMetadata.promptTokenCount + apiResponse.usageMetadata.candidatesTokenCount);
    }
    
    // Next check candidates array
    if (!tokenCount && apiResponse.candidates && apiResponse.candidates.length > 0) {
      const candidate = apiResponse.candidates[0];
      if (candidate.usageMetadata) {
        tokenCount = candidate.usageMetadata.totalTokenCount || 
                    (candidate.usageMetadata.promptTokenCount + candidate.usageMetadata.candidatesTokenCount);
      }
    }
    
    // Check response property if present
    if (!tokenCount && apiResponse.response && apiResponse.response.usageMetadata) {
      tokenCount = apiResponse.response.usageMetadata.totalTokenCount || 
                  (apiResponse.response.usageMetadata.promptTokenCount + apiResponse.response.usageMetadata.candidatesTokenCount);
    }
    
    // Log the result
    if (tokenCount) {
      logger.debug(`Extracted token count from Gemini API: ${tokenCount}`);
    } else {
      logger.debug("Could not extract token count from API response, will use estimation");
    }
    
    return tokenCount;
  } catch (error) {
    logger.warn("Error extracting token count from Gemini API:", error);
    return null;
  }
}

// Estimate combined tokens for input and output when Gemini doesn't provide counts
export function estimateCombinedTokens(input, output) {
  const inputTokens = simpleTokenEstimate(input);
  const outputTokens = simpleTokenEstimate(output);
  const totalTokens = inputTokens + outputTokens;
  
  logger.debug(`Token estimation: input=${inputTokens}, output=${outputTokens}, total=${totalTokens}`);
  return totalTokens;
}
