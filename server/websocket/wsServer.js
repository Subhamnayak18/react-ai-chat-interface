
// websocket/wsServer.js - WebSocket server setup
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logging.js';
import { handleMessage } from './wsHandlers.js';

// Store for WebSocket clients with their IDs
export const wsClients = new Map();

// Setup WebSocket server
export function setupWebSocketServer(server) {
  // Create and attach WebSocket server
  const wss = new WebSocketServer({ server });
  
  // WebSocket connection handler
  wss.on('connection', handleConnection);
  
  logger.info("WebSocket server initialized");
  return wss;
}

// Handle new connections
function handleConnection(ws, req) {
  // Get client IP address
  const clientIp = req.socket.remoteAddress;
  
  // Generate a unique client ID
  const clientId = uuidv4();
  
  // Store client with metadata
  wsClients.set(ws, {
    id: clientId,
    ip: clientIp,
    connectedAt: new Date(),
    isAdmin: true, // By default, assuming all connections to admin panel are admin
    lastActivity: new Date()
  });
  
  logger.info(`WebSocket client connected: ID=${clientId} from ${clientIp}`);
  logger.debug(`Total WebSocket clients connected: ${wsClients.size}`);
  
  // Send welcome message with client ID
  try {
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId: clientId,
      message: 'Connected to Gemini API Admin Dashboard WebSocket',
      time: new Date().toISOString(),
      clientCount: wsClients.size
    }));
  } catch (error) {
    logger.error(`Failed to send welcome message to client ${clientId} (${clientIp}):`, error);
  }
  
  // Handle messages from clients
  ws.on('message', (data) => {
    try {
      // Update last activity timestamp
      const clientInfo = wsClients.get(ws);
      if (clientInfo) {
        clientInfo.lastActivity = new Date();
      }
      
      const message = JSON.parse(data);
      handleMessage(ws, message, clientIp, clientId);
    } catch (error) {
      logger.error(`Failed to process WebSocket message from client ${clientId} (${clientIp}):`, error);
      try {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          error: error.message
        }));
      } catch (sendError) {
        logger.error(`Failed to send error response to client ${clientId} (${clientIp}):`, sendError);
      }
    }
  });
  
  // Handle WebSocket close
  ws.on('close', (code, reason) => {
    const clientInfo = wsClients.get(ws) || { id: 'unknown' };
    logger.info(`WebSocket client ${clientInfo.id} (${clientIp}) disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    wsClients.delete(ws);
    logger.debug(`Remaining WebSocket clients: ${wsClients.size}`);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    const clientInfo = wsClients.get(ws) || { id: 'unknown' };
    logger.error(`WebSocket error with client ${clientInfo.id} (${clientIp}):`, error);
    // The 'close' event will be called after this automatically
  });
}

// Broadcast to all connected clients
export function broadcastToAll(message) {
  const sentCount = { total: 0, successful: 0, failed: 0 };
  
  wsClients.forEach((clientInfo, ws) => {
    sentCount.total++;
    
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({
          ...message,
          receivedAs: 'broadcast',
          timestamp: new Date().toISOString()
        }));
        sentCount.successful++;
      } catch (error) {
        logger.error(`Error broadcasting to client ${clientInfo.id}:`, error);
        sentCount.failed++;
      }
    } else {
      sentCount.failed++;
    }
  });
  
  if (sentCount.total > 0) {
    logger.debug(`Broadcast complete: ${sentCount.successful}/${sentCount.total} messages sent successfully`);
  } else {
    logger.debug('No clients to broadcast to');
  }
  
  return sentCount;
}

// Send message to a specific client by ID
export function sendToClient(clientId, message) {
  // Find the client with the given ID
  for (const [ws, clientInfo] of wsClients.entries()) {
    if (clientInfo.id === clientId) {
      // Check if the connection is open
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify({
            ...message,
            receivedAs: 'direct',
            timestamp: new Date().toISOString()
          }));
          logger.debug(`Message sent successfully to client ${clientId}`);
          return true;
        } catch (error) {
          logger.error(`Error sending message to client ${clientId}:`, error);
          return false;
        }
      } else {
        logger.warn(`Cannot send to client ${clientId}: Connection not open (state: ${ws.readyState})`);
        return false;
      }
    }
  }
  
  logger.warn(`Attempted to send message to unknown client ID: ${clientId}`);
  return false;
}

// Send to all clients except one
export function broadcastToOthers(excludeWs, message) {
  const excludeClientInfo = wsClients.get(excludeWs) || { id: 'unknown' };
  let sentCount = 0;
  
  wsClients.forEach((clientInfo, ws) => {
    if (ws !== excludeWs && ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({
          ...message,
          receivedAs: 'broadcast',
          timestamp: new Date().toISOString()
        }));
        sentCount++;
      } catch (error) {
        logger.error(`Error broadcasting to client ${clientInfo.id}:`, error);
      }
    }
  });
  
  logger.debug(`Broadcast to others complete: sent to ${sentCount} clients (excluding client ${excludeClientInfo.id})`);
  return sentCount;
}

// Get client information by WebSocket connection
export function getClientInfo(ws) {
  return wsClients.get(ws);
}

// Get client information by client ID
export function getClientInfoById(clientId) {
  for (const [ws, clientInfo] of wsClients.entries()) {
    if (clientInfo.id === clientId) {
      return { ...clientInfo, ws };
    }
  }
  return null;
}

// List all connected clients
export function listConnectedClients() {
  const clients = [];
  wsClients.forEach((info, ws) => {
    clients.push({
      id: info.id,
      ip: info.ip,
      connectedAt: info.connectedAt,
      lastActivity: info.lastActivity,
      isAdmin: info.isAdmin,
      connectionState: ws.readyState
    });
  });
  return clients;
}

// Close all WebSocket connections
export async function closeAllConnections() {
  logger.info(`Closing all ${wsClients.size} WebSocket connections...`);
  
  const closePromises = [];
  
  wsClients.forEach((clientInfo, client) => {
    closePromises.push(new Promise((resolve) => {
      try {
        client.close(1000, 'Server shutting down');
        logger.debug(`Closing connection for client ${clientInfo.id}`);
        setTimeout(resolve, 100); // Resolve after a short timeout
      } catch (error) {
        logger.error(`Error closing WebSocket connection for client ${clientInfo.id}:`, error);
        resolve();
      }
    }));
  });
  
  // Wait for all close operations to complete
  await Promise.all(closePromises);
  
  wsClients.clear();
  logger.info('All WebSocket connections closed');
}

// Clean up inactive connections (can be called periodically)
export function cleanupInactiveConnections(maxInactiveTime = 300000) { // Default: 5 minutes
  const now = new Date();
  let closedCount = 0;
  
  wsClients.forEach((clientInfo, ws) => {
    const inactiveDuration = now - clientInfo.lastActivity;
    
    if (inactiveDuration > maxInactiveTime) {
      try {
        logger.debug(`Closing inactive connection for client ${clientInfo.id} (inactive for ${inactiveDuration/1000}s)`);
        ws.close(1000, 'Connection closed due to inactivity');
        wsClients.delete(ws);
        closedCount++;
      } catch (error) {
        logger.error(`Error closing inactive connection for client ${clientInfo.id}:`, error);
      }
    }
  });
  
  if (closedCount > 0) {
    logger.info(`Cleaned up ${closedCount} inactive WebSocket connections`);
  }
  
  return closedCount;
}
