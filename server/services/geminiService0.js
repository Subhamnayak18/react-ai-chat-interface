// services/geminiService.js - Gemini API integration
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logging.js';
import { config } from '../config.js';

// Initialize Google Generative AI client
let genAI = null;

// Initialize the Gemini client
export function initializeGemini() {
  if (!config.geminiApiKey) {
    logger.warn('GEMINI_API_KEY not configured! API functionality will not work.');
    return null;
  }
  
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
  logger.success('Gemini API client initialized successfully');
  return genAI;
}

// Get or create Gemini client
export function getGeminiClient() {
  if (!genAI && config.geminiApiKey) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return genAI;
}

// Get a specific Gemini model
export function getGeminiModel(modelName) {
  const client = getGeminiClient();
  if (!client) return null;
  
  return client.getGenerativeModel({
    model: modelName,
    generationConfig: config.defaultGenerationOptions
  });
}

// Get available models
export function getAvailableModels() {
  // Since the SDK doesn't have a listModels method, we return a static list
  const models = [
    {
      name: "models/gemini-1.0-pro",
      displayName: "Gemini 1.0 Pro",
      inputTokenLimit: 30720,
      outputTokenLimit: 2048
    },
    {
      name: "models/gemini-1.5-flash",
      displayName: "Gemini 1.5 Flash",
      inputTokenLimit: 30720,
      outputTokenLimit: 2048
    },
    {
      name: "models/gemini-1.5-pro",
      displayName: "Gemini 1.5 Pro",
      inputTokenLimit: 1048576,
      outputTokenLimit: 8192
    },
    {
      name: "models/gemini-2.5-flash-preview-04-17",
      displayName: "Gemini 2.5 Flash (Preview)",
      inputTokenLimit: 307200,
      outputTokenLimit: 8192
    },
    {
      name: "models/gemini-pro",
      displayName: "Gemini Pro",
      inputTokenLimit: 30720,
      outputTokenLimit: 2048
    },
    {
      name: "models/gemini-pro-vision",
      displayName: "Gemini Pro Vision",
      inputTokenLimit: 12288,
      outputTokenLimit: 4096
    }
  ];

  return models;
}
