/**
 * Enhanced Connection Manager for Rummikub Stability
 * Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

const EventEmitter = require('events');

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    
    // Connection state tracking
    this.connections = new Map(); // socketId -> connection info
    this.playerConnections = new Map(); // playerId -> socketId mapping
    this.gameConnections = new Map(); // gameId -> Set of socketIds
    
    // Reconnection configuration with exponential backoff
    this.reconnectionConfig = {
      maxAttempts: 10,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterFactor: 0.1 // Add randomness to prevent thundering herd
    };
    
    // Connection monitoring
    this.heartbeatInterval = 25000; // 25 seconds
    this.connectionTimeout = 60000; // 60 seconds
    this.cleanupInterval = 300000; // 5 minutes
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    console.log('🔌 Enhanced Connection Manager initialized');
  }

  /**
   * Register a new connection
   * Requirements: 4.1, 4.3
   */
  registerConnection(socket, gameId = null, playerId = null) {
    const connectionInfo = {
      socketId: socket.id,
      playerId: playerId,
      gameId: gameId,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      status: 'connected',
      reconnectionAttempts: 0,
      userAgent: socket.handshake.headers['user-agent'] || 'unknown',
      ipAddress: socket.handshake.address || 'unknown'
    };
    
    this.connections.set(socket.id, connectionInfo);
    
    if (playerId) {
      this.playerConnections.set(playerId, socket.id);
    }
    
    if (gameId) {
      if (!this.gameConnections.has(gameId)) {
        this.gameConnections.set(gameId, new Set());
      }
      this.gameConnections.get(gameId).add(socket.id);
    }
    
    console.log(`🔌 Connection registered: ${socket.id} (player: ${playerId}, game: ${gameId})`);
    
    // Set up heartbeat monitoring
    this.setupHeartbeat(socket);
    
    this.emit('connectionRegistered', connectionInfo);
    return connectionInfo;
  }

  /**
   * Handle connection disconnection
   * Requirements: 4.3, 4.4, 4.5
   */
  handleDisconnection(socket, reason = 'unknown') {
    const connectionInfo = this.connections.get(socket.id);
    if (!connectionInfo) return;
    
    console.log(`🔌 Connection disconnected: ${socket.id} (reason: ${reason})`);
    
    // Update connection status
    connectionInfo.status = 'disconnected';
    connectionInfo.disconnectedAt = Date.now();
    connectionInfo.disconnectionReason = reason;
    
    // Remove from active game connections but keep connection info for potential reconnection
    if (connectionInfo.gameId) {
      const gameConnections = this.gameConnections.get(connectionInfo.gameId);
      if (gameConnections) {
        gameConnections.delete(socket.id);
      }
    }
    
    // Don't immediately remove player connection mapping - allow for reconnection
    // The cleanup process will handle this after timeout
    
    this.emit('connectionDisconnected', connectionInfo);
    
    // Schedule cleanup if no reconnection occurs
    setTimeout(() => {
      this.cleanupStaleConnection(socket.id);
    }, this.connectionTimeout);
  }

  /**
   * Handle connection reconnection
   * Requirements: 4.3, 4.4
   */
  handleReconnection(socket, gameId, playerId) {
    console.log(`🔄 Attempting reconnection: socket ${socket.id}, player ${playerId}, game ${gameId}`);
    
    // Find existing connection info for this player
    const existingSocketId = this.playerConnections.get(playerId);
    let existingConnectionInfo = null;
    
    if (existingSocketId) {
      existingConnectionInfo = this.connections.get(existingSocketId);
    }
    
    if (existingConnectionInfo && existingConnectionInfo.status === 'disconnected') {
      // This is a reconnection - update the existing connection info
      console.log(`✅ Reconnection successful: ${playerId} (old socket: ${existingSocketId}, new socket: ${socket.id})`);
      
      // Update connection info with new socket
      existingConnectionInfo.socketId = socket.id;
      existingConnectionInfo.status = 'connected';
      existingConnectionInfo.reconnectedAt = Date.now();
      existingConnectionInfo.lastSeen = Date.now();
      existingConnectionInfo.reconnectionAttempts = 0;
      delete existingConnectionInfo.disconnectedAt;
      delete existingConnectionInfo.disconnectionReason;
      
      // Update mappings
      this.connections.delete(existingSocketId);
      this.connections.set(socket.id, existingConnectionInfo);
      this.playerConnections.set(playerId, socket.id);
      
      // Re-add to game connections
      if (gameId) {
        if (!this.gameConnections.has(gameId)) {
          this.gameConnections.set(gameId, new Set());
        }
        this.gameConnections.get(gameId).add(socket.id);
      }
      
      // Set up heartbeat monitoring for new socket
      this.setupHeartbeat(socket);
      
      this.emit('connectionReconnected', existingConnectionInfo);
      return existingConnectionInfo;
    } else {
      // This is a new connection, not a reconnection
      return this.registerConnection(socket, gameId, playerId);
    }
  }

  /**
   * Set up heartbeat monitoring for a socket
   * Requirements: 4.1
   */
  setupHeartbeat(socket) {
    const heartbeatTimer = setInterval(() => {
      const connectionInfo = this.connections.get(socket.id);
      if (!connectionInfo || connectionInfo.status !== 'connected') {
        clearInterval(heartbeatTimer);
        return;
      }
      
      // Send ping and wait for pong
      const pingTime = Date.now();
      socket.emit('ping', pingTime);
      
      // Set timeout for pong response
      const pongTimeout = setTimeout(() => {
        console.warn(`⚠️ No pong received from ${socket.id}, considering disconnected`);
        this.handleDisconnection(socket, 'heartbeat_timeout');
        clearInterval(heartbeatTimer);
      }, 5000); // 5 second timeout for pong
      
      // Listen for pong response
      const pongHandler = (pongTime) => {
        if (pongTime === pingTime) {
          clearTimeout(pongTimeout);
          connectionInfo.lastSeen = Date.now();
          connectionInfo.latency = Date.now() - pingTime;
          socket.off('pong', pongHandler);
        }
      };
      
      socket.once('pong', pongHandler);
      
    }, this.heartbeatInterval);
    
    // Store timer reference for cleanup
    const connectionInfo = this.connections.get(socket.id);
    if (connectionInfo) {
      connectionInfo.heartbeatTimer = heartbeatTimer;
    }
  }

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   * Requirements: 4.2
   */
  calculateReconnectionDelay(attemptNumber) {
    const baseDelay = this.reconnectionConfig.baseDelay;
    const maxDelay = this.reconnectionConfig.maxDelay;
    const backoffMultiplier = this.reconnectionConfig.backoffMultiplier;
    const jitterFactor = this.reconnectionConfig.jitterFactor;
    
    // Calculate exponential backoff delay
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1),
      maxDelay
    );
    
    // Add jitter to prevent thundering herd problem
    const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(exponentialDelay + jitter, baseDelay);
    
    return Math.round(finalDelay);
  }

  /**
   * Get reconnection fallback options for a player
   * Requirements: 4.2
   */
  getReconnectionFallbacks(playerId) {
    const socketId = this.playerConnections.get(playerId);
    const connectionInfo = socketId ? this.connections.get(socketId) : null;
    
    const fallbacks = [];
    
    // Always provide manual reconnection option
    fallbacks.push({
      type: 'manual_reconnect',
      description: 'Try reconnecting manually',
      available: true,
      action: 'refresh_connection'
    });
    
    // Local state preservation (if recent disconnection)
    if (connectionInfo && connectionInfo.disconnectedAt) {
      const timeSinceDisconnection = Date.now() - connectionInfo.disconnectedAt;
      if (timeSinceDisconnection < 300000) { // 5 minutes
        fallbacks.push({
          type: 'local_state',
          description: 'Game state preserved locally',
          available: true,
          action: 'restore_local_state'
        });
      }
    }
    
    // Alternative connection method
    fallbacks.push({
      type: 'alternative_transport',
      description: 'Try different connection method',
      available: true,
      action: 'switch_transport'
    });
    
    // Create new game option (if many failures)
    if (connectionInfo && connectionInfo.reconnectionAttempts >= 5) {
      fallbacks.push({
        type: 'new_game',
        description: 'Create a new game with same players',
        available: true,
        action: 'create_new_game'
      });
    }
    
    return fallbacks;
  }

  /**
   * Get connection status for monitoring
   * Requirements: 4.1
   */
  getConnectionStatus(socketId) {
    const connectionInfo = this.connections.get(socketId);
    if (!connectionInfo) {
      return { status: 'unknown' };
    }
    
    return {
      status: connectionInfo.status,
      connectedAt: connectionInfo.connectedAt,
      lastSeen: connectionInfo.lastSeen,
      latency: connectionInfo.latency || null,
      reconnectionAttempts: connectionInfo.reconnectionAttempts,
      gameId: connectionInfo.gameId,
      playerId: connectionInfo.playerId
    };
  }

  /**
   * Get all connections for a game
   * Requirements: 4.5
   */
  getGameConnections(gameId) {
    const socketIds = this.gameConnections.get(gameId);
    if (!socketIds) return [];
    
    return Array.from(socketIds).map(socketId => {
      const connectionInfo = this.connections.get(socketId);
      return connectionInfo ? {
        socketId,
        playerId: connectionInfo.playerId,
        status: connectionInfo.status,
        lastSeen: connectionInfo.lastSeen
      } : null;
    }).filter(Boolean);
  }

  /**
   * Handle concurrent disconnections for a game
   * Requirements: 4.5
   */
  handleConcurrentDisconnections(gameId, disconnectedSockets) {
    console.log(`🔌 Handling concurrent disconnections for game ${gameId}: ${disconnectedSockets.length} players`);
    
    const gameConnections = this.getGameConnections(gameId);
    const remainingConnections = gameConnections.filter(conn => 
      conn.status === 'connected' && !disconnectedSockets.includes(conn.socketId)
    );
    
    // Emit event with disconnection info
    this.emit('concurrentDisconnections', {
      gameId,
      disconnectedCount: disconnectedSockets.length,
      remainingCount: remainingConnections.length,
      disconnectedSockets,
      remainingConnections
    });
    
    // If no players remain connected, mark game for cleanup
    if (remainingConnections.length === 0) {
      console.log(`⚠️ All players disconnected from game ${gameId}, scheduling cleanup`);
      this.emit('gameAbandoned', { gameId });
    }
    
    return {
      disconnectedCount: disconnectedSockets.length,
      remainingCount: remainingConnections.length,
      gameAbandoned: remainingConnections.length === 0
    };
  }

  /**
   * Clean up stale connections
   * Requirements: 4.1
   */
  cleanupStaleConnection(socketId) {
    const connectionInfo = this.connections.get(socketId);
    if (!connectionInfo) return;
    
    // Only cleanup if still disconnected and timeout exceeded
    if (connectionInfo.status === 'disconnected' && 
        connectionInfo.disconnectedAt && 
        (Date.now() - connectionInfo.disconnectedAt) > this.connectionTimeout) {
      
      console.log(`🧹 Cleaning up stale connection: ${socketId}`);
      
      // Clear heartbeat timer if exists
      if (connectionInfo.heartbeatTimer) {
        clearInterval(connectionInfo.heartbeatTimer);
      }
      
      // Remove from all mappings
      this.connections.delete(socketId);
      
      if (connectionInfo.playerId) {
        this.playerConnections.delete(connectionInfo.playerId);
      }
      
      if (connectionInfo.gameId) {
        const gameConnections = this.gameConnections.get(connectionInfo.gameId);
        if (gameConnections) {
          gameConnections.delete(socketId);
          if (gameConnections.size === 0) {
            this.gameConnections.delete(connectionInfo.gameId);
          }
        }
      }
      
      this.emit('connectionCleaned', connectionInfo);
    }
  }

  /**
   * Start periodic cleanup of stale connections
   * Requirements: 4.1
   */
  startPeriodicCleanup() {
    setInterval(() => {
      const now = Date.now();
      const staleConnections = [];
      
      for (const [socketId, connectionInfo] of this.connections) {
        if (connectionInfo.status === 'disconnected' && 
            connectionInfo.disconnectedAt && 
            (now - connectionInfo.disconnectedAt) > this.connectionTimeout) {
          staleConnections.push(socketId);
        }
      }
      
      staleConnections.forEach(socketId => {
        this.cleanupStaleConnection(socketId);
      });
      
      if (staleConnections.length > 0) {
        console.log(`🧹 Periodic cleanup removed ${staleConnections.length} stale connections`);
      }
      
    }, this.cleanupInterval);
  }

  /**
   * Get comprehensive status for monitoring
   * Requirements: 4.1
   */
  getStatus() {
    const totalConnections = this.connections.size;
    const connectedCount = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected').length;
    const disconnectedCount = totalConnections - connectedCount;
    
    return {
      totalConnections,
      connectedCount,
      disconnectedCount,
      activeGames: this.gameConnections.size,
      totalPlayers: this.playerConnections.size,
      config: this.reconnectionConfig
    };
  }
}

module.exports = ConnectionManager;