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

// GBOT Tier 0 - Available models (Flash, Experimental, Preview)
export function getAvailableModels() {
  const models = [
    {
      id: "models/gemini-2.5-flash-preview-04-17",
      name: "models/gemini-2.5-flash-preview-04-17",
      displayName: "Gemini 2.5 Flash (Preview)",
      description: "Next-generation Flash model with enhanced capabilities",
      provider: "Google",
      category: "preview",
      tier: "tier0",
      contextWindow: 307200,
      maxOutputTokens: 8192,
      pricing: {
        inputCost: "Free",
        outputCost: "Free"
      },
      features: ["text-generation", "multi-turn-chat", "function-calling"],
      limitations: ["preview-model", "rate-limited"],
      status: "preview",
      badge: "Preview",
      performance: {
        speed: "very-fast",
        quality: "high",
        efficiency: "excellent"
      },
      releaseDate: "2024-04-17",
      isExperimental: false,
      isPreview: true
    },
    {
      id: "models/learnlm-2.0-flash-experimental",
      name: "models/learnlm-2.0-flash-experimental", 
      displayName: "LearnLM 2.0 Flash (Experimental)",
      description: "Specialized learning and educational model with flash architecture",
      provider: "Google",
      category: "experimental",
      tier: "tier0",
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      pricing: {
        inputCost: "Free",
        outputCost: "Free"
      },
      features: ["educational-content", "learning-optimization", "tutoring", "explanation"],
      limitations: ["experimental", "education-focused", "rate-limited"],
      status: "experimental",
      badge: "Experimental",
      performance: {
        speed: "fast",
        quality: "specialized",
        efficiency: "good"
      },
      releaseDate: "2024-12-01",
      isExperimental: true,
      isPreview: false,
      specialization: "education"
    },
    {
      id: "models/gemini-2.0-flash-thinking-exp-1219",
      name: "models/gemini-2.0-flash-thinking-exp-1219",
      displayName: "Gemini 2.0 Flash Thinking (Experimental)",
      description: "Advanced reasoning model with enhanced thinking capabilities",
      provider: "Google", 
      category: "experimental",
      tier: "tier0",
      contextWindow: 2097152,
      maxOutputTokens: 8192,
      pricing: {
        inputCost: "Free",
        outputCost: "Free"
      },
      features: ["advanced-reasoning", "step-by-step-thinking", "problem-solving", "chain-of-thought"],
      limitations: ["experimental", "thinking-focused", "rate-limited"],
      status: "experimental",
      badge: "Experimental",
      performance: {
        speed: "moderate",
        quality: "very-high",
        efficiency: "good"
      },
      releaseDate: "2024-12-19",
      isExperimental: true,
      isPreview: false,
      specialization: "reasoning"
    }
  ];

  logger.debug(`Returning ${models.length} GBOT Tier 0 models`);
  return models;
}

// Get model by ID
export function getModelById(modelId) {
  const models = getAvailableModels();
  return models.find(model => model.id === modelId || model.name === modelId);
}

// Get models by category
export function getModelsByCategory(category) {
  const models = getAvailableModels();
  if (category === 'all') return models;
  return models.filter(model => model.category === category);
}

// Get model categories for GBOT
export function getModelCategories() {
  return [
    {
      id: 'all',
      name: 'All Models',
      description: 'All available GBOT models',
      icon: 'view_list'
    },
    {
      id: 'preview', 
      name: 'Preview Models',
      description: 'Next-generation models in preview',
      icon: 'preview'
    },
    {
      id: 'experimental',
      name: 'Experimental Models', 
      description: 'Cutting-edge experimental models',
      icon: 'science'
    }
  ];
}
