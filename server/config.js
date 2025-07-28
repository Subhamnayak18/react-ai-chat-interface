// config.js - Central configuration
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration object
export const config = {
  // Server
  port: process.env.PORT || 5000,
  environment: process.env.NODE_ENV || 'development',
  
  // Paths
  adminHtmlPath: path.join(__dirname, 'admin.html'),
  
  // API Keys
  geminiApiKey: process.env.GEMINI_API_KEY,
  
  // Gemini Models
  defaultModel: process.env.DEFAULT_MODEL || 'gemini-1.5-flash',
  
  // Token limits
  defaultTokenLimit: 100000,
  maxExtensionAmount: 20000,
  
  // Default generation options
  defaultGenerationOptions: {
    temperature: 0.7,
    maxTokens: 4096,
    topK: 40,
    topP: 0.95,
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'INFO',
  
  // Authentication
  adminAuthToken: process.env.ADMIN_AUTH_TOKEN || 'admin-secret-token',
  
  // Database
  dbPath: './chat_history.db',
};

