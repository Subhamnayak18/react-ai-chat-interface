
// websocket/wsBroadcast.js - WebSocket broadcasting utilities
import { logger } from '../utils/logging.js';
import { wsClients } from './wsServer.js';
import { getTokenUsage, getRecentChats } from '../db.js';

// Broadcast update to all clients
export async function broadcastUpdate() {
  const clientCount = wsClients.size;
  if (clientCount === 0) {
    logger.debug('No WebSocket clients connected, skipping broadcast');
    return;
  }
  
  try {
    logger.debug(`Broadcasting updates to ${clientCount} WebSocket clients...`);
    
    // Gather all the data we need to send
    const usage = await getTokenUsage();
    const chats = await getRecentChats(20);
    
    // Create the update message
    const updateData = {
      type: 'update',
      usage: {
        totalTokensUsed: usage.total_tokens_used,
        limit: usage.total_limit,
        remaining: Math.max(0, usage.total_limit - usage.total_tokens_used),
        exceeded: usage.total_tokens_used >= usage.total_limit
      },
      chats: chats,
      timestamp: new Date().toISOString(),
      source: 'system'
    };
    
    // Use broadcastToAll function from this file
    broadcastToAll(updateData);
    
    logger.debug(`Update broadcast initiated`);
  } catch (error) {
    logger.error('Failed to broadcast WebSocket updates:', error);
  }
}

// Broadcast to all clients 
export function broadcastToAll(data) {
  const message = JSON.stringify(data);
  let activeSent = 0;
  let closedClients = 0;
  
  wsClients.forEach((clientInfo, client) => {
    if (client.readyState === client.OPEN) {
      try {
        client.send(message);
        activeSent++;
      } catch (error) {
        logger.error(`Failed to send update to client ${clientInfo.id}:`, error);
      }
    } else if (client.readyState === client.CLOSED || client.readyState === client.CLOSING) {
      closedClients++;
    }
  });
  
  logger.debug(`Broadcast complete: Sent to ${activeSent} clients, ${closedClients} closed connections detected`);
  
  // Clean up any closed connections if needed
  if (closedClients > 0) {
    cleanupClosedConnections();
  }
  
  return { sent: activeSent, closed: closedClients };
}

// Broadcast to all clients except one
export function broadcastToOthers(excludeWs, data) {
  const excludeClientInfo = wsClients.get(excludeWs) || { id: 'unknown' };
  const message = JSON.stringify(data);
  let sent = 0;
  
  wsClients.forEach((clientInfo, client) => {
    if (client !== excludeWs && client.readyState === client.OPEN) {
      try {
        client.send(message);
        sent++;
      } catch (error) {
        logger.error(`Failed to send update to client ${clientInfo.id}:`, error);
      }
    }
  });
  
  logger.debug(`Broadcasted update to ${sent} other clients (excluding client ${excludeClientInfo.id})`);
  return sent;
}

// Send message to a specific client by ID
export function sendToClient(clientId, data) {
  const message = JSON.stringify(data);
  
  for (const [client, clientInfo] of wsClients.entries()) {
    if (clientInfo.id === clientId && client.readyState === client.OPEN) {
      try {
        client.send(message);
        logger.debug(`Sent message to client ${clientId}`);
        return true;
      } catch (error) {
        logger.error(`Failed to send message to client ${clientId}:`, error);
        return false;
      }
    }
  }
  
  logger.warn(`Could not find client with ID ${clientId} to send message`);
  return false;
}

// Get client information
export function getClientInfo(ws) {
  return wsClients.get(ws);
}

// Clean up closed WebSocket connections
function cleanupClosedConnections() {
  const initialSize = wsClients.size;
  const toDelete = [];
  
  // Find closed connections
  wsClients.forEach((clientInfo, client) => {
    if (client.readyState === client.CLOSED || client.readyState === client.CLOSING) {
      toDelete.push(client);
    }
  });
  
  // Delete them
  toDelete.forEach(client => {
    wsClients.delete(client);
  });
  
  const removedCount = initialSize - wsClients.size;
  if (removedCount > 0) {
    logger.debug(`Cleaned up ${removedCount} closed WebSocket connections. ${wsClients.size} active connections remain.`);
  }
  
  return removedCount;
}
