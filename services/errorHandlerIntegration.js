/**
 * Error Handler Integration for Existing Server
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

const SocketErrorHandler = require('./socketErrorHandler');
const RobustErrorHandler = require('./errorHandler');

class ErrorHandlerIntegration {
  constructor(io, games, players) {
    this.io = io;
    this.games = games;
    this.players = players;
    
    // Initialize error handlers
    this.socketErrorHandler = new SocketErrorHandler(io);
    this.errorHandler = new RobustErrorHandler();
    
    console.log('🛡️ Error Handler Integration initialized');
  }

  /**
   * Wrap socket event handlers with error handling
   * Requirements: 6.1, 6.2
   */
  wrapSocketHandler(eventName, originalHandler) {
    return async (socket, data) => {
      try {
        // Add activity tracking for connection stability
        this.updatePlayerActivity(socket.id);
        
        // Execute original handler
        await originalHandler(socket, data);
        
      } catch (error) {
        console.error(`❌ Error in ${eventName} handler:`, error.message);
        
        // Get player context
        const playerInfo = this.players.get(socket.id);
        const context = {
          eventName,
          socketId: socket.id,
          userId: playerInfo?.playerName,
          gameId: playerInfo?.gameId,
          sessionId: socket.handshake.sessionID,
          operation: eventName
        };
        
        // Handle the error appropriately
        this.socketErrorHandler.handleSocketError(socket, error, context);
      }
    };
  }

  /**
   * Wrap game methods with error handling and corruption detection
   * Requirements: 6.3, 6.5
   */
  wrapGameMethod(game, methodName, originalMethod) {
    return (...args) => {
      try {
        // Take a snapshot of game state before operation
        const preOperationState = this.createGameStateSnapshot(game);
        
        // Execute original method
        const result = originalMethod.apply(game, args);
        
        // Check for game state corruption after operation
        const corruptionResult = this.errorHandler.handleGameStateCorruption(game);
        
        if (corruptionResult.corrupted) {
          console.warn(`🚨 Game state corruption detected in ${methodName} for game ${game.id}`);
          
          // If recovery was successful, update the game
          if (corruptionResult.recovery.success) {
            Object.assign(game, corruptionResult.gameState);
            console.log(`✅ Game state recovered for game ${game.id}`);
            
            // Notify players about the recovery
            this.io.to(game.id).emit('gameStateRecovered', {
              message: 'The game encountered an issue but has been automatically fixed.',
              recoveryActions: corruptionResult.recovery.actions
            });
          } else {
            // Recovery failed - restore from snapshot
            console.error(`❌ Game state recovery failed for game ${game.id}, restoring from snapshot`);
            this.restoreGameStateFromSnapshot(game, preOperationState);
            
            // Notify players about the issue
            this.io.to(game.id).emit('gameStateIssue', {
              message: 'The game encountered an issue. The previous state has been restored.',
              canContinue: true
            });
          }
        }
        
        return result;
        
      } catch (error) {
        console.error(`❌ Error in game method ${methodName} for game ${game.id}:`, error.message);
        
        // Handle game-specific errors
        const context = {
          gameId: game.id,
          methodName,
          gameState: game
        };
        
        // Create a mock socket for error handling (we'll broadcast to all players)
        const mockSocket = {
          id: 'game-method-error',
          emit: (event, data) => {
            this.io.to(game.id).emit(event, data);
          },
          to: (room) => ({
            emit: (event, data) => {
              this.io.to(room).emit(event, data);
            }
          })
        };
        
        this.socketErrorHandler.handleGameError(mockSocket, 'server_error', error, context);
        
        // Return a safe default or throw depending on the method
        if (methodName.includes('get') || methodName.includes('validate')) {
          return null; // Safe default for getter methods
        }
        
        throw error; // Re-throw for critical methods
      }
    };
  }

  /**
   * Create a snapshot of game state for recovery
   * Requirements: 6.3, 6.5
   */
  createGameStateSnapshot(game) {
    try {
      return {
        id: game.id,
        players: game.players ? game.players.map(p => ({
          id: p.id,
          name: p.name,
          hand: p.hand ? [...p.hand] : [],
          hasPlayedInitial: p.hasPlayedInitial,
          score: p.score,
          isBot: p.isBot
        })) : [],
        currentPlayerIndex: game.currentPlayerIndex,
        board: game.board ? game.board.map(set => [...set]) : [],
        deck: game.deck ? [...game.deck] : [],
        started: game.started,
        winner: game.winner,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`❌ Failed to create game state snapshot:`, error.message);
      return null;
    }
  }

  /**
   * Restore game state from snapshot
   * Requirements: 6.3, 6.5
   */
  restoreGameStateFromSnapshot(game, snapshot) {
    if (!snapshot) {
      console.error(`❌ Cannot restore game state: no snapshot available`);
      return false;
    }
    
    try {
      // Restore core game state
      game.id = snapshot.id;
      game.players = snapshot.players;
      game.currentPlayerIndex = snapshot.currentPlayerIndex;
      game.board = snapshot.board;
      game.deck = snapshot.deck;
      game.started = snapshot.started;
      game.winner = snapshot.winner;
      
      console.log(`✅ Game state restored from snapshot for game ${game.id}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to restore game state from snapshot:`, error.message);
      return false;
    }
  }

  /**
   * Update player activity for connection monitoring
   * Requirements: 6.4
   */
  updatePlayerActivity(socketId) {
    const playerInfo = this.players.get(socketId);
    if (playerInfo && playerInfo.gameId) {
      const game = this.games.get(playerInfo.gameId);
      if (game) {
        game.lastPlayerActivity = Date.now();
      }
    }
  }

  /**
   * Handle database errors in game operations
   * Requirements: 6.1, 6.2
   */
  handleDatabaseError(error, operation, gameId = null) {
    const context = {
      operation,
      gameId,
      collection: 'games'
    };
    
    const result = this.errorHandler.handleError('database_error', context, error.stack);
    
    // Broadcast to affected game if gameId is provided
    if (gameId) {
      this.io.to(gameId).emit('databaseError', {
        message: result.userMessage,
        canRetry: result.canRetry,
        errorId: result.errorId
      });
    }
    
    return result;
  }

  /**
   * Handle connection recovery errors
   * Requirements: 6.1, 6.4
   */
  handleConnectionRecoveryError(socket, error, attemptNumber = 1) {
    const playerInfo = this.players.get(socket.id);
    const context = {
      socketId: socket.id,
      userId: playerInfo?.playerName,
      gameId: playerInfo?.gameId,
      playerName: playerInfo?.playerName
    };
    
    return this.socketErrorHandler.handleReconnectionFailure(socket, attemptNumber, error, context);
  }

  /**
   * Validate and handle game state before critical operations
   * Requirements: 6.3, 6.5
   */
  validateGameStateBeforeOperation(game, operationName) {
    const corruptionResult = this.errorHandler.handleGameStateCorruption(game);
    
    if (corruptionResult.corrupted) {
      console.warn(`🚨 Game state corruption detected before ${operationName} in game ${game.id}`);
      
      if (corruptionResult.recovery.success) {
        // Apply recovered state
        Object.assign(game, corruptionResult.gameState);
        console.log(`✅ Game state recovered before ${operationName} in game ${game.id}`);
        return { valid: true, recovered: true };
      } else {
        console.error(`❌ Game state recovery failed before ${operationName} in game ${game.id}`);
        return { valid: false, recovered: false, issues: corruptionResult.issues };
      }
    }
    
    return { valid: true, recovered: false };
  }

  /**
   * Get comprehensive error statistics
   * Requirements: 6.2
   */
  getErrorStatistics() {
    return {
      socket: this.socketErrorHandler.getErrorStatistics(),
      general: this.errorHandler.getErrorStatistics(),
      timestamp: Date.now()
    };
  }

  /**
   * Clear all error logs
   * Requirements: 6.2
   */
  clearAllErrorLogs() {
    const socketCleared = this.socketErrorHandler.clearErrorLogs();
    const generalCleared = this.errorHandler.clearErrorLogs();
    
    console.log(`🧹 Cleared ${socketCleared + generalCleared} total error log entries`);
    return socketCleared + generalCleared;
  }

  /**
   * Set up global error handlers for the server
   * Requirements: 6.1, 6.2
   */
  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception:', error);
      
      this.errorHandler.handleError('server_error', {
        message: error.message,
        type: 'uncaught_exception',
        stack: error.stack
      }, error.stack);
      
      // Don't exit in production - try to continue
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      
      this.errorHandler.handleError('server_error', {
        message: reason?.message || 'Unhandled promise rejection',
        type: 'unhandled_rejection',
        reason: reason
      }, reason?.stack);
    });
    
    console.log('🛡️ Global error handlers set up');
  }
}

module.exports = ErrorHandlerIntegration;