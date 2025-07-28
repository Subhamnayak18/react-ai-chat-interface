// websocket/wsHandlers.js - WebSocket message handlers
import { logger } from '../utils/logging.js';
import { getTokenUsage, getRecentChats, getDb } from '../db.js';
import { broadcastToAll, broadcastToOthers, sendToClient, getClientInfo } from './wsBroadcast.js';
import { config } from '../config.js';

// Handle incoming WebSocket messages
export async function handleMessage(ws, message, clientIp, clientId) {
  logger.debug(`WebSocket message received from client ${clientId} (${clientIp}): ${message.type}`);
  
  switch (message.type) {
    case 'requestUpdate':
      await handleRequestUpdate(ws, clientIp, clientId);
      break;
    
    case 'extendLimit':
      await handleExtendLimit(ws, message, clientIp, clientId);
      break;
    
    case 'clearDatabase':
      await handleClearDatabase(ws, clientIp, clientId);
      break;
    
    case 'ping':
      handlePing(ws, clientId);
      break;
      
    case 'getClients':
      handleGetClients(ws, clientId);
      break;
    
    default:
      logger.warn(`Unknown WebSocket message type from client ${clientId}: ${message.type}`);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Unknown message type'
      }));
  }
}

// Handle request for data update
async function handleRequestUpdate(ws, clientIp, clientId) {
  logger.debug(`Client ${clientId} (${clientIp}) requested data update`);
  
  try {
    const usage = await getTokenUsage();
    const chats = await getRecentChats(20);
    
    ws.send(JSON.stringify({
      type: 'update',
      usage: {
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
        exceeded: usage.total_tokens_used >= usage.total_limit
      },
      chats: chats,
      timestamp: new Date().toISOString(),
      requestedBy: clientId
    }));
    
    logger.debug(`Update data sent to client ${clientId}`);
  } catch (error) {
    logger.error(`Failed to send update to client ${clientId}:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to retrieve update data',
      error: error.message
    }));
  }
}

// Handle token limit extension request
async function handleExtendLimit(ws, message, clientIp, clientId) {
  logger.debug(`Client ${clientId} (${clientIp}) requested token limit extension: ${message.amount} tokens`);
  const amountToExtend = parseInt(message.amount);
  
  if (!amountToExtend || isNaN(amountToExtend) || amountToExtend <= 0) {
    logger.warn(`Client ${clientId} provided invalid extension amount`);
    ws.send(JSON.stringify({ 
      type: 'extendLimitResponse', 
      success: false, 
      error: 'Invalid or negative extension amount provided',
      clientId: clientId
    }));
    return;
  }
  
  if (amountToExtend > config.maxExtensionAmount) {
    logger.warn(`Client ${clientId} provided extension amount exceeding maximum (${amountToExtend} > ${config.maxExtensionAmount})`);
    ws.send(JSON.stringify({ 
      type: 'extendLimitResponse', 
      success: false, 
      error: `Extension amount exceeds the maximum allowed (${config.maxExtensionAmount} tokens)`,
      clientId: clientId
    }));
    return;
  }
  
  try {
    const db = await getDb();
    const currentStats = await db.get('SELECT total_limit FROM usage_stats LIMIT 1');
    const currentLimit = currentStats ? currentStats.total_limit : config.defaultTokenLimit;
    
    const newLimit = currentLimit + amountToExtend;
    await db.run('UPDATE usage_stats SET total_limit = ?', [newLimit]);
    
    const usage = await getTokenUsage();
    logger.success(`Token limit extended by ${amountToExtend} via WebSocket from client ${clientId}. New limit: ${usage.total_limit}`);
    
    // Send response to the client who made the request
    ws.send(JSON.stringify({
      type: 'extendLimitResponse',
      success: true,
      message: `Token limit extended by ${amountToExtend}.`,
      previousLimit: currentLimit,
      newLimit: usage.total_limit,
      currentUsage: usage.total_tokens_used,
      requestedBy: clientId,
      timestamp: new Date().toISOString()
    }));
    
    // Broadcast update to all other clients
    broadcastToOthers(ws, {
      type: 'update',
      usage: {
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
        exceeded: usage.total_tokens_used >= usage.total_limit
      },
      message: `Token limit extended by ${amountToExtend} tokens by administrator (Client ID: ${clientId}).`,
      initiatedBy: clientId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to extend token limit via WebSocket for client ${clientId}:`, error);
    ws.send(JSON.stringify({
      type: 'extendLimitResponse',
      success: false,
      error: `Failed to extend token limit: ${error.message}`,
      clientId: clientId
    }));
  }
}

// Handle database clear request
async function handleClearDatabase(ws, clientIp, clientId) {
  logger.debug(`Client ${clientId} (${clientIp}) requested database clear`);
  
  try {
    const db = await getDb();
    
    // Begin transaction for atomic operation
    await db.run('BEGIN TRANSACTION');
    
    // Clear chat history and related tables
    await db.run('DELETE FROM chat_history');
    
    // Reset token usage to 0 but keep the limit
    await db.run('UPDATE usage_stats SET total_tokens_used = 0');
    
    // Reset auto-increment counters
    await db.run('DELETE FROM sqlite_sequence WHERE name="chat_history"');
    
    // Commit transaction
    await db.run('COMMIT');
    
    logger.success(`Database cleared by client ${clientId}`);
    
    // Get updated token usage
    const usage = await getTokenUsage();
    
    // Send response to the client who made the request
    ws.send(JSON.stringify({
      type: 'clearDatabaseResponse',
      success: true,
      message: 'Database cleared successfully',
      usage: {
        totalTokensUsed: 0,
        limit: usage.total_limit,
        remaining: usage.total_limit,
        exceeded: false
      },
      requestedBy: clientId,
      timestamp: new Date().toISOString()
    }));
    
    // Broadcast update to all other clients
    broadcastToOthers(ws, {
      type: 'update',
      usage: {
        totalTokensUsed: 0,
        limit: usage.total_limit,
        remaining: usage.total_limit,
        exceeded: false
      },
      chats: [],
      message: `Database has been cleared by administrator (Client ID: ${clientId})`,
      initiatedBy: clientId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to clear database via WebSocket for client ${clientId}:`, error);
    
    // Try to rollback transaction if error occurs
    try {
      const database = await getDb();
      await database.run('ROLLBACK');
    } catch (rollbackError) {
      logger.error("Rollback failed:", rollbackError);
    }
    
    ws.send(JSON.stringify({
      type: 'clearDatabaseResponse',
      success: false,
      error: `Failed to clear database: ${error.message}`,
      clientId: clientId
    }));
  }
}

// Handle ping message
function handlePing(ws, clientId) {
  ws.send(JSON.stringify({
    type: 'pong',
    clientId: clientId,
    timestamp: new Date().toISOString()
  }));
}

// Handle request for connected clients (admin feature)
function handleGetClients(ws, clientId) {
  try {
    // Import needed here to avoid circular dependency
    const { listConnectedClients } = require('./wsServer.js');
    const clients = listConnectedClients();
    
    // Only send minimal client info for security
    const clientList = clients.map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      isActive: client.connectionState === 1 // 1 = OPEN in WebSocket
    }));
    
    ws.send(JSON.stringify({
      type: 'clientList',
      clients: clientList,
      count: clientList.length,
      requestedBy: clientId,
      timestamp: new Date().toISOString()
    }));
    
    logger.debug(`Client list sent to client ${clientId} (${clientList.length} clients)`);
  } catch (error) {
    logger.error(`Error retrieving client list for client ${clientId}:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to retrieve client list',
      error: error.message
    }));
  }
}
