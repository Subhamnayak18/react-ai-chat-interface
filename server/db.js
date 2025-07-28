
// db.js
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { simpleTokenEstimate } from './tokenUtils.js';

let db = null;

export async function initializeDatabase() {
  console.log("Initializing database...");
  try {
    // Make sure directory exists and is writable
    const dbPath = './chat_history.db';
    console.log(`Using database path: ${dbPath}`);
    
    // Open database and create tables if they don't exist
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    console.log("Database connection established");
    
    // Create tables if they don't exist
    await db.exec(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_tokens_used INTEGER DEFAULT 0,
      total_limit INTEGER DEFAULT 100000
    );
    
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_input TEXT NOT NULL,
      response TEXT NOT NULL,
      gemini_token_count INTEGER,
      tiktoken_estimate INTEGER,
      model TEXT NOT NULL,
      temperature REAL,
      max_tokens INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS token_comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      gemini_tokens INTEGER,
      tiktoken_estimate INTEGER,
      difference INTEGER,
      percentage_diff REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chat_history(id)
    );
    `);
    
    console.log("Database tables created/verified");
    
    // Initialize usage stats if not exists
    const stats = await db.get('SELECT * FROM usage_stats LIMIT 1');
    // Correcting the default limit log based on your stated 10,000 initial limit
    const initialLimit = 10000; 
    if (!stats) {
      await db.run('INSERT INTO usage_stats (total_tokens_used, total_limit) VALUES (0, ?)', [initialLimit]);
      console.log(`Usage stats initialized to 0/${initialLimit}`);
    } else {
      console.log(`Usage stats found: ${stats.total_tokens_used}/${stats.total_limit}`);
    }
    
    return db;
  } catch (error) {
    console.error("Database initialization failed with error:", error);
    throw error;
  }
}

export async function getDb() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

// Updated to work with the new simplified approach
export async function addChatEntry(userInput, response, geminiTokenCount, model, options = {}) {
  console.log("Adding chat entry to database...");
  try {
    const database = await getDb();
    
    // Use Gemini's count if available, otherwise use simple estimation
    const tokenCount = geminiTokenCount || simpleTokenEstimate(userInput + response);
    
    // Add entry to chat history
    const result = await database.run(
      `INSERT INTO chat_history 
      (user_input, response, gemini_token_count, tiktoken_estimate, model, temperature, max_tokens) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userInput, 
        response, 
        tokenCount, // Store token count in gemini_token_count
        null,       // No longer using tiktoken
        model, 
        options?.temperature || 0.7, 
        options?.maxTokens || 1024
      ]
    );
    
    const chatId = result.lastID;
    console.log(`Chat entry added with ID: ${chatId}`);
    
    // Update token usage
    await database.run(
      'UPDATE usage_stats SET total_tokens_used = total_tokens_used + ?',
      [tokenCount]
    );
    
    console.log(`Added ${tokenCount} tokens to usage total`);
    
    // We're not using the global.broadcastUpdate anymore
    // If you have a broadcastUpdate function imported, you could use it here
    
    return {
      chatId,
      tokensAdded: tokenCount
    };
  } catch (error) {
    console.error("Error adding chat entry:", error);
    throw error;
  }
}

export async function getTokenUsage() {
  try {
    const database = await getDb();
    const stats = await database.get('SELECT * FROM usage_stats LIMIT 1');
    // Return default 10000 limit if stats not found, aligning with stated initial limit
    return stats || { total_tokens_used: 0, total_limit: 10000 }; 
  } catch (error) {
    console.error("Error getting token usage:", error);
    throw error;
  }
}

export async function isTokenLimitExceeded() {
  try {
    const stats = await getTokenUsage();
    return stats.total_tokens_used >= stats.total_limit;
  } catch (error) {
    console.error("Error checking token limit:", error);
    throw error;
  }
}

export async function getRecentChats(limit = 10) {
  try {
    const database = await getDb();
    const chats = await database.all(`
    SELECT 
      ch.*
    FROM chat_history ch
    ORDER BY ch.timestamp DESC
    LIMIT ?
    `, [limit]);
    
    return chats;
  } catch (error) {
    console.error("Error getting recent chats:", error);
    throw error;
  }
}

export async function getTokenComparison() {
  // Simplified version since we're not using token comparisons anymore
  return [{ avg_percentage_diff: 0, avg_difference: 0, total_comparisons: 0 }];
}

export async function updateTokenLimit(newLimit) {
  try {
    if (isNaN(newLimit) || newLimit <= 0) {
      throw new Error("Invalid token limit value");
    }
    
    const database = await getDb();
    await database.run('UPDATE usage_stats SET total_limit = ?', [newLimit]);
    
    console.log(`Token limit updated to ${newLimit}`);
    
    return await getTokenUsage();
  } catch (error) {
    console.error("Error updating token limit:", error);
    throw error;
  }
}

export async function extendTokenLimit(amountToAdd, maxAllowedExtension = 20000) {
  try {
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      throw new Error("Invalid extension amount");
    }
    
    if (amountToAdd > maxAllowedExtension) {
      throw new Error(`Extension amount exceeds the maximum allowed (${maxAllowedExtension} tokens)`);
    }
    
    const database = await getDb();
    const currentStats = await database.get('SELECT total_limit FROM usage_stats LIMIT 1');
    
    if (!currentStats) {
      throw new Error("Usage stats not found in database");
    }
    
    const newLimit = currentStats.total_limit + amountToAdd;
    await database.run('UPDATE usage_stats SET total_limit = ?', [newLimit]);
    
    console.log(`Token limit extended by ${amountToAdd} tokens. New limit: ${newLimit}`);
    
    const updatedStats = await getTokenUsage();
    return {
      success: true,
      previousLimit: currentStats.total_limit,
      newLimit: updatedStats.total_limit,
      amountAdded: amountToAdd,
      currentUsage: updatedStats.total_tokens_used
    };
  } catch (error) {
    console.error("Error extending token limit:", error);
    throw error;
  }
}

export async function clearDatabase() {
  try {
    const database = await getDb();
    
    // Begin transaction for atomic operation
    await database.run('BEGIN TRANSACTION');
    
    // Clear chat history and related tables
    await database.run('DELETE FROM token_comparisons');
    await database.run('DELETE FROM chat_history');
    
    // Reset token usage to 0 but keep the limit
    await database.run('UPDATE usage_stats SET total_tokens_used = 0');
    
    // Reset auto-increment counters
    await database.run('DELETE FROM sqlite_sequence WHERE name IN ("chat_history", "token_comparisons")');
    
    // Commit transaction
    await database.run('COMMIT');
    
    console.log("Database cleared successfully");
    
    return true;
  } catch (error) {
    console.error("Error clearing database:", error);
    
    // Try to rollback transaction if error occurs
    try {
      const database = await getDb();
      await database.run('ROLLBACK');
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
    
    throw error;
  }
}
