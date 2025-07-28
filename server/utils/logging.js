// utils/logging.js - Logging utilities
import { config } from '../config.js';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  HTTP: 2,
  SUCCESS: 3,
  WARN: 4,
  ERROR: 5,
  FATAL: 6
};

// Get minimum log level from config
const MIN_LOG_LEVEL = LOG_LEVELS[config.logLevel] || LOG_LEVELS.INFO;

// ANSI color codes for terminal output
const COLORS = {
  RESET: "\x1b[0m",
  DEBUG: "\x1b[90m",   // Grey
  INFO: "\x1b[37m",    // White
  HTTP: "\x1b[36m",    // Cyan
  SUCCESS: "\x1b[32m", // Green
  WARN: "\x1b[33m",    // Yellow
  ERROR: "\x1b[31m",   // Red
  FATAL: "\x1b[35m"    // Magenta
};

// Format the current timestamp for log entries
function getTimestamp() {
  return new Date().toISOString();
}

// Core logging function
function log(level, message, ...args) {
  if (LOG_LEVELS[level] >= MIN_LOG_LEVEL) {
    const timestamp = getTimestamp();
    const color = COLORS[level] || COLORS.RESET;
    
    // Format the log message
    let formattedMsg = `${color}[${timestamp}] [${level}] ${message}${COLORS.RESET}`;
    
    // If there are additional arguments that are objects, stringify them nicely
    if (args.length > 0) {
      args = args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return `[Error stringify: ${e.message}]`;
          }
        }
        return arg;
      });
      console.log(formattedMsg, ...args);
    } else {
      console.log(formattedMsg);
    }
  }
}

export const logger = {
  debug: (message, ...args) => log('DEBUG', message, ...args),
  info: (message, ...args) => log('INFO', message, ...args),
  http: (message, ...args) => log('HTTP', message, ...args),
  success: (message, ...args) => log('SUCCESS', message, ...args),
  warn: (message, ...args) => log('WARN', message, ...args),
  error: (message, ...args) => log('ERROR', message, ...args),
  fatal: (message, ...args) => log('FATAL', message, ...args),
  
  // Set the log level
  setLogLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      config.logLevel = level;
    } else {
      console.warn(`Invalid log level: ${level}. Using default: INFO`);
      config.logLevel = 'INFO';
    }
  }
};

