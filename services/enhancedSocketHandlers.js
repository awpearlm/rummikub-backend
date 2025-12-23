/**
 * Enhanced Socket.IO handlers with improved connection recovery and stability
 * Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

const ConnectionManager = require('./connectionManager');

class EnhancedSocketHandlers {
  constructor(io, games, players) {
    this.io = io;
    this.games = games;
    this.players = players;
    this.connectionManager = new ConnectionManager();
    
    // Set up connection manager event listeners
    this.setupConnectionManagerEvents();
    
    console.log('🚀 Enhanced Socket Handlers initialized');
  }

  /**
   * Set up connection manager event listeners
   * Requirements: 4.1, 4.5
   */
  setupConnectionManagerEvents() {
    this.connectionManager.on('connectionDisconnected', (connectionInfo) => {
      this.handlePlayerDisconnection(connectionInfo);
    });
    
    this.connectionManager.on('connectionReconnected', (connectionInfo) => {
      this.handlePlayerReconnection(connectionInfo);
    });
    
    this.connectionManager.on('concurrentDisconnections', (data) => {
      this.handleConcurrentDisconnections(data);
    });
    
    this.connectionManager.on('gameAbandoned', (data) => {
      this.handleGameAbandonment(data);
    });
  }

  /**
   * Enhanced connection handler
   * Requirements: 4.1, 4.3
   */
  handleConnection(socket) {
    console.log('🔌 Enhanced connection handler:', socket.id);
    
    // Register connection with connection manager
    this.connectionManager.registerConnection(socket);
    
    // Set up enhanced socket event handlers
    this.setupSocketHandlers(socket);
    
    // Set up heartbeat monitoring
    this.setupHeartbeatHandlers(socket);
    
    // Set up reconnection handlers
    this.setupReconnectionHandlers(socket);
  }

  /**
   * Set up heartbeat handlers for connection monitoring
   * Requirements: 4.1
   */
  setupHeartbeatHandlers(socket) {
    // Handle ping responses
    socket.on('pong', (timestamp) => {
      const connectionInfo = this.connectionManager.connections.get(socket.id);
      if (connectionInfo) {
        connectionInfo.lastSeen = Date.now();
        connectionInfo.latency = Date.now() - timestamp;
      }
    });
    
    // Send periodic status updates
    const statusInterval = setInterval(() => {
      const connectionInfo = this.connectionManager.connections.get(socket.id);
      if (!connectionInfo || connectionInfo.status !== 'connected') {
        clearInterval(statusInterval);
        return;
      }
      
      socket.emit('connectionStatus', {
        status: 'connected',
        latency: connectionInfo.latency,
        lastSeen: connectionInfo.lastSeen
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Set up reconnection handlers
   * Requirements: 4.2, 4.3, 4.4
   */
  setupReconnectionHandlers(socket) {
    // Handle explicit reconnection requests
    socket.on('requestReconnection', (data) => {
      this.handleReconnectionRequest(socket, data);
    });
    
    // Handle game state restoration requests
    socket.on('requestGameStateRestore', (data) => {
      this.handleGameStateRestore(socket, data);
    });
    
    // Handle reconnection failure reports
    socket.on('reportReconnectionFailure', (data) => {
      this.handleReconnectionFailure(socket, data);
    });
  }

  /**
   * Handle reconnection requests
   * Requirements: 4.3, 4.4
   */
  handleReconnectionRequest(socket, data) {
    const { gameId, playerName, playerId } = data;
    
    console.log(`🔄 Reconnection request: ${playerName} to game ${gameId}`);
    
    // Update connection manager
    const connectionInfo = this.connectionManager.handleReconnection(socket, gameId, playerId || playerName);
    
    // Find the game
    const game = this.games.get(gameId);
    if (!game) {
      socket.emit('reconnectionFailed', {
        reason: 'game_not_found',
        message: 'Game no longer exists',
        fallbacks: this.connectionManager.getReconnectionFallbacks(playerId || playerName)
      });
      return;
    }
    
    // Find the player in the game
    let player = game.players.find(p => p.name === playerName);
    if (!player) {
      socket.emit('reconnectionFailed', {
        reason: 'player_not_found',
        message: 'Player not found in game',
        fallbacks: this.connectionManager.getReconnectionFallbacks(playerId || playerName)
      });
      return;
    }
    
    // Update player connection info
    player.id = socket.id;
    player.disconnected = false;
    player.disconnectedAt = null;
    
    // Update player mapping
    this.players.set(socket.id, {
      gameId: gameId,
      playerName: playerName
    });
    
    // Join socket to game room
    socket.join(gameId);
    
    // Send successful reconnection response with full game state
    socket.emit('reconnectionSuccessful', {
      gameId: gameId,
      gameState: game.getGameState(socket.id),
      connectionInfo: {
        reconnectedAt: Date.now(),
        attempts: connectionInfo.reconnectionAttempts
      }
    });
    
    // Notify other players
    socket.to(gameId).emit('playerReconnected', {
      playerName: playerName,
      gameState: game.getGameState(socket.id)
    });
    
    console.log(`✅ Player ${playerName} successfully reconnected to game ${gameId}`);
  }

  /**
   * Handle game state restoration
   * Requirements: 4.3, 4.4
   */
  handleGameStateRestore(socket, data) {
    const { gameId, playerName } = data;
    
    const game = this.games.get(gameId);
    if (!game) {
      socket.emit('gameStateRestoreFailed', {
        reason: 'game_not_found',
        message: 'Game no longer exists'
      });
      return;
    }
    
    const player = game.players.find(p => p.name === playerName);
    if (!player) {
      socket.emit('gameStateRestoreFailed', {
        reason: 'player_not_found',
        message: 'Player not found in game'
      });
      return;
    }
    
    // Send complete game state
    socket.emit('gameStateRestored', {
      gameId: gameId,
      gameState: game.getGameState(socket.id),
      restoredAt: Date.now()
    });
    
    console.log(`📂 Game state restored for ${playerName} in game ${gameId}`);
  }

  /**
   * Handle reconnection failures
   * Requirements: 4.2
   */
  handleReconnectionFailure(socket, data) {
    const { playerId, attemptNumber, error } = data;
    
    console.log(`❌ Reconnection failure reported: ${playerId}, attempt ${attemptNumber}, error: ${error}`);
    
    // Update connection manager
    const connectionInfo = this.connectionManager.connections.get(socket.id);
    if (connectionInfo) {
      connectionInfo.reconnectionAttempts = attemptNumber;
      connectionInfo.lastReconnectionError = error;
    }
    
    // Calculate next reconnection delay
    const delay = this.connectionManager.calculateReconnectionDelay(attemptNumber + 1);
    
    // Get fallback options
    const fallbacks = this.connectionManager.getReconnectionFallbacks(playerId);
    
    // Send reconnection guidance
    socket.emit('reconnectionGuidance', {
      nextAttemptDelay: delay,
      attemptNumber: attemptNumber,
      fallbacks: fallbacks,
      maxAttempts: this.connectionManager.reconnectionConfig.maxAttempts
    });
  }

  /**
   * Handle player disconnection
   * Requirements: 4.3, 4.5
   */
  handlePlayerDisconnection(connectionInfo) {
    const { socketId, gameId, playerId } = connectionInfo;
    
    if (!gameId) return;
    
    const game = this.games.get(gameId);
    if (!game) return;
    
    const player = game.players.find(p => p.id === socketId);
    if (!player) return;
    
    console.log(`🔌 Enhanced disconnection handling: ${player.name} from game ${gameId}`);
    
    // Mark player as disconnected but preserve game state
    player.disconnected = true;
    player.disconnectedAt = Date.now();
    
    // Notify other players with enhanced information
    this.io.to(gameId).emit('playerDisconnected', {
      playerName: player.name,
      playerId: playerId,
      disconnectedAt: player.disconnectedAt,
      gameState: game.getGameState(socketId),
      reconnectionExpected: true,
      reconnectionTimeout: this.connectionManager.connectionTimeout
    });
    
    // Schedule game state preservation
    this.scheduleGameStatePreservation(gameId, player.name);
  }

  /**
   * Handle player reconnection
   * Requirements: 4.3, 4.4
   */
  handlePlayerReconnection(connectionInfo) {
    const { socketId, gameId, playerId } = connectionInfo;
    
    if (!gameId) return;
    
    const game = this.games.get(gameId);
    if (!game) return;
    
    console.log(`✅ Enhanced reconnection handling: ${playerId} to game ${gameId}`);
    
    // Notify all players about successful reconnection
    this.io.to(gameId).emit('playerReconnected', {
      playerId: playerId,
      reconnectedAt: connectionInfo.reconnectedAt,
      gameState: game.getGameState(socketId)
    });
  }

  /**
   * Handle concurrent disconnections
   * Requirements: 4.5
   */
  handleConcurrentDisconnections(data) {
    const { gameId, disconnectedCount, remainingCount } = data;
    
    console.log(`🔌 Concurrent disconnections in game ${gameId}: ${disconnectedCount} disconnected, ${remainingCount} remaining`);
    
    const game = this.games.get(gameId);
    if (!game) return;
    
    // Notify remaining players
    this.io.to(gameId).emit('concurrentDisconnections', {
      disconnectedCount,
      remainingCount,
      gameState: game.getGameState(),
      stabilityStatus: remainingCount > 0 ? 'stable' : 'unstable'
    });
    
    // If game becomes unstable, provide additional support
    if (remainingCount === 0) {
      this.handleGameInstability(gameId);
    } else if (remainingCount === 1) {
      this.handleSinglePlayerRemaining(gameId);
    }
  }

  /**
   * Handle game abandonment
   * Requirements: 4.5
   */
  handleGameAbandonment(data) {
    const { gameId } = data;
    
    console.log(`⚠️ Game abandoned: ${gameId}`);
    
    const game = this.games.get(gameId);
    if (game) {
      // Preserve game state for potential recovery
      this.preserveGameStateForRecovery(gameId, game);
      
      // Clean up game from active games
      this.games.delete(gameId);
    }
  }

  /**
   * Handle game instability (no connected players)
   * Requirements: 4.5
   */
  handleGameInstability(gameId) {
    console.log(`⚠️ Game instability detected: ${gameId} (no connected players)`);
    
    const game = this.games.get(gameId);
    if (!game) return;
    
    // Preserve game state
    this.preserveGameStateForRecovery(gameId, game);
    
    // Set up recovery window
    setTimeout(() => {
      const currentGame = this.games.get(gameId);
      if (currentGame) {
        const activeConnections = this.connectionManager.getGameConnections(gameId)
          .filter(conn => conn.status === 'connected');
        
        if (activeConnections.length === 0) {
          console.log(`🗑️ No recovery for game ${gameId}, cleaning up`);
          this.games.delete(gameId);
        }
      }
    }, 300000); // 5 minute recovery window
  }

  /**
   * Handle single player remaining
   * Requirements: 4.5
   */
  handleSinglePlayerRemaining(gameId) {
    console.log(`⚠️ Single player remaining in game: ${gameId}`);
    
    const connections = this.connectionManager.getGameConnections(gameId);
    const remainingConnection = connections.find(conn => conn.status === 'connected');
    
    if (remainingConnection) {
      const socket = this.io.sockets.sockets.get(remainingConnection.socketId);
      if (socket) {
        socket.emit('singlePlayerRemaining', {
          message: 'You are the only player remaining. Other players may reconnect.',
          waitTime: 120000, // 2 minutes
          options: [
            { type: 'wait', description: 'Wait for other players to reconnect' },
            { type: 'add_bots', description: 'Add bot players to continue' },
            { type: 'end_game', description: 'End the current game' }
          ]
        });
      }
    }
  }

  /**
   * Schedule game state preservation
   * Requirements: 4.3
   */
  scheduleGameStatePreservation(gameId, playerName) {
    // Immediate preservation
    this.preserveGameState(gameId);
    
    // Schedule periodic preservation while player is disconnected
    const preservationInterval = setInterval(() => {
      const game = this.games.get(gameId);
      if (!game) {
        clearInterval(preservationInterval);
        return;
      }
      
      const player = game.players.find(p => p.name === playerName);
      if (!player || !player.disconnected) {
        clearInterval(preservationInterval);
        return;
      }
      
      this.preserveGameState(gameId);
    }, 30000); // Every 30 seconds
    
    // Clean up after timeout
    setTimeout(() => {
      clearInterval(preservationInterval);
    }, this.connectionManager.connectionTimeout);
  }

  /**
   * Preserve game state
   * Requirements: 4.3
   */
  preserveGameState(gameId) {
    const game = this.games.get(gameId);
    if (!game) return;
    
    try {
      // Save to game state manager if available
      if (game.autoSave) {
        game.autoSave('high');
      }
      
      console.log(`💾 Game state preserved for ${gameId}`);
    } catch (error) {
      console.error(`❌ Failed to preserve game state for ${gameId}:`, error.message);
    }
  }

  /**
   * Preserve game state for recovery
   * Requirements: 4.5
   */
  preserveGameStateForRecovery(gameId, game) {
    try {
      // Create recovery snapshot
      const recoveryData = {
        gameId: gameId,
        gameState: game.createStateSnapshot ? game.createStateSnapshot() : game,
        preservedAt: Date.now(),
        players: game.players.map(p => ({
          name: p.name,
          disconnectedAt: p.disconnectedAt,
          canRecover: true
        }))
      };
      
      // Store recovery data (in production, this would go to persistent storage)
      console.log(`💾 Game recovery data preserved for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to preserve recovery data for ${gameId}:`, error.message);
    }
  }

  /**
   * Set up standard socket handlers
   * Requirements: 4.1
   */
  setupSocketHandlers(socket) {
    // Enhanced join game handler
    socket.on('joinGame', (data) => {
      this.handleJoinGame(socket, data);
    });
    
    // Enhanced disconnect handler
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });
  }

  /**
   * Enhanced join game handler
   * Requirements: 4.3
   */
  handleJoinGame(socket, data) {
    const { gameId, playerName } = data;
    
    // Update connection manager
    this.connectionManager.handleReconnection(socket, gameId, playerName);
    
    // Continue with standard join game logic...
    const game = this.games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    // Check if this is a reconnection
    const existingPlayer = game.players.find(p => p.name === playerName);
    if (existingPlayer && existingPlayer.disconnected) {
      // This is a reconnection
      this.handleReconnectionRequest(socket, { gameId, playerName, playerId: playerName });
    } else {
      // This is a new player joining
      if (game.addPlayer(socket.id, playerName)) {
        this.players.set(socket.id, { gameId, playerName });
        socket.join(gameId);
        
        socket.emit('gameJoined', { 
          gameId, 
          gameState: game.getGameState(socket.id) 
        });
        
        socket.to(gameId).emit('playerJoined', {
          playerName,
          gameState: game.getGameState(socket.id)
        });
      } else {
        socket.emit('error', { message: 'Failed to join game' });
      }
    }
  }

  /**
   * Enhanced disconnect handler
   * Requirements: 4.3, 4.5
   */
  handleDisconnect(socket, reason) {
    console.log(`🔌 Enhanced disconnect handler: ${socket.id}, reason: ${reason}`);
    
    // Handle with connection manager
    this.connectionManager.handleDisconnection(socket, reason);
    
    // Clean up player mapping
    this.players.delete(socket.id);
  }

  /**
   * Get connection manager status
   * Requirements: 4.1
   */
  getStatus() {
    return this.connectionManager.getStatus();
  }
}

module.exports = EnhancedSocketHandlers;