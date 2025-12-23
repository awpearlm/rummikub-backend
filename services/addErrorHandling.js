/**
 * Add Error Handling to Existing Server
 * This file can be required in server.js to add comprehensive error handling
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

const ErrorHandlerIntegration = require('./errorHandlerIntegration');

/**
 * Add comprehensive error handling to an existing server setup
 * @param {Object} io - Socket.IO server instance
 * @param {Map} games - Games map
 * @param {Map} players - Players map
 * @returns {Object} Error handling utilities
 */
function addErrorHandling(io, games, players) {
  console.log('🛡️ Adding comprehensive error handling to server...');
  
  // Initialize error handler integration
  const errorIntegration = new ErrorHandlerIntegration(io, games, players);
  
  // Set up global error handlers
  errorIntegration.setupGlobalErrorHandlers();
  
  // Enhance existing socket connection handler
  const originalConnectionHandler = io._events.connection;
  
  // Wrap the connection handler with error handling
  io.removeAllListeners('connection');
  io.on('connection', (socket) => {
    console.log('🔌 Enhanced connection with error handling:', socket.id);
    
    // Set up error handling for this socket
    setupSocketErrorHandling(socket, errorIntegration);
    
    // Call original connection handler if it exists
    if (originalConnectionHandler) {
      try {
        if (Array.isArray(originalConnectionHandler)) {
          originalConnectionHandler.forEach(handler => handler(socket));
        } else {
          originalConnectionHandler(socket);
        }
      } catch (error) {
        console.error('❌ Error in original connection handler:', error.message);
        errorIntegration.socketErrorHandler.handleConnectionError(socket, error);
      }
    }
  });
  
  // Enhance existing games with error handling
  enhanceExistingGames(games, errorIntegration);
  
  // Set up periodic error monitoring
  setupErrorMonitoring(errorIntegration);
  
  console.log('✅ Comprehensive error handling added successfully');
  
  return {
    errorIntegration,
    getErrorStats: () => errorIntegration.getErrorStatistics(),
    clearErrorLogs: () => errorIntegration.clearAllErrorLogs(),
    handleGameError: (gameId, error, context) => {
      const game = games.get(gameId);
      if (game) {
        return errorIntegration.validateGameStateBeforeOperation(game, context?.operation || 'unknown');
      }
    }
  };
}

/**
 * Set up error handling for individual socket connections
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} errorIntegration - Error integration instance
 */
function setupSocketErrorHandling(socket, errorIntegration) {
  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`🚨 Socket error for ${socket.id}:`, error.message);
    errorIntegration.socketErrorHandler.handleConnectionError(socket, error);
  });
  
  // Handle disconnect with error context
  const originalDisconnect = socket.disconnect;
  socket.disconnect = function(reason) {
    console.log(`🔌 Socket ${socket.id} disconnecting: ${reason}`);
    
    // Update activity before disconnect
    errorIntegration.updatePlayerActivity(socket.id);
    
    // Call original disconnect
    return originalDisconnect.call(this, reason);
  };
  
  // Wrap emit to catch serialization errors
  const originalEmit = socket.emit;
  socket.emit = function(event, data) {
    try {
      return originalEmit.call(this, event, data);
    } catch (error) {
      console.error(`❌ Error emitting ${event} to ${socket.id}:`, error.message);
      
      // Send a simplified error message instead
      try {
        originalEmit.call(this, 'serverError', {
          message: 'There was a problem sending data. Please refresh the page.',
          canRetry: true,
          errorId: `emit_error_${Date.now()}`
        });
      } catch (fallbackError) {
        console.error(`❌ Failed to send fallback error message:`, fallbackError.message);
      }
    }
  };
}

/**
 * Enhance existing games with error handling
 * @param {Map} games - Games map
 * @param {Object} errorIntegration - Error integration instance
 */
function enhanceExistingGames(games, errorIntegration) {
  // Wrap the games Map methods to add error handling
  const originalSet = games.set;
  games.set = function(gameId, game) {
    try {
      // Validate game state before storing
      const validation = errorIntegration.validateGameStateBeforeOperation(game, 'store_game');
      
      if (!validation.valid) {
        console.error(`❌ Cannot store corrupted game ${gameId}`);
        return this;
      }
      
      // Wrap game methods with error handling
      wrapGameMethods(game, errorIntegration);
      
      return originalSet.call(this, gameId, game);
    } catch (error) {
      console.error(`❌ Error storing game ${gameId}:`, error.message);
      errorIntegration.handleDatabaseError(error, 'store_game', gameId);
      throw error;
    }
  };
  
  const originalGet = games.get;
  games.get = function(gameId) {
    try {
      const game = originalGet.call(this, gameId);
      
      if (game) {
        // Validate game state when retrieving
        const validation = errorIntegration.validateGameStateBeforeOperation(game, 'retrieve_game');
        
        if (!validation.valid) {
          console.warn(`⚠️ Retrieved corrupted game ${gameId}, attempting recovery`);
          // Game state will be updated by the validation if recovery succeeds
        }
      }
      
      return game;
    } catch (error) {
      console.error(`❌ Error retrieving game ${gameId}:`, error.message);
      errorIntegration.handleDatabaseError(error, 'retrieve_game', gameId);
      return null;
    }
  };
}

/**
 * Wrap game methods with error handling
 * @param {Object} game - Game instance
 * @param {Object} errorIntegration - Error integration instance
 */
function wrapGameMethods(game, errorIntegration) {
  // List of critical game methods to wrap
  const methodsToWrap = [
    'startGame', 'addPlayer', 'removePlayer', 'playSet', 'playMultipleSets',
    'drawTile', 'nextTurn', 'updateBoard', 'validateBoardState', 'makeBotMove'
  ];
  
  methodsToWrap.forEach(methodName => {
    if (typeof game[methodName] === 'function') {
      const originalMethod = game[methodName];
      game[methodName] = errorIntegration.wrapGameMethod(game, methodName, originalMethod);
    }
  });
  
  // Add error handling to auto-save
  if (typeof game.autoSave === 'function') {
    const originalAutoSave = game.autoSave;
    game.autoSave = async function(priority = 'normal') {
      try {
        return await originalAutoSave.call(this, priority);
      } catch (error) {
        console.error(`❌ Auto-save failed for game ${this.id}:`, error.message);
        errorIntegration.handleDatabaseError(error, 'auto_save', this.id);
      }
    };
  }
}

/**
 * Set up periodic error monitoring
 * @param {Object} errorIntegration - Error integration instance
 */
function setupErrorMonitoring(errorIntegration) {
  // Log error statistics every 5 minutes
  setInterval(() => {
    const stats = errorIntegration.getErrorStatistics();
    
    if (stats.general.totalErrors > 0 || stats.socket.totalErrors > 0) {
      console.log('📊 Error Statistics:', {
        totalErrors: stats.general.totalErrors + (stats.socket.totalErrors || 0),
        recentErrors: stats.general.recentErrors?.length || 0,
        memoryUsage: stats.general.memoryUsage
      });
    }
  }, 300000); // 5 minutes
  
  // Clean up old error logs every hour
  setInterval(() => {
    const cleared = errorIntegration.clearAllErrorLogs();
    if (cleared > 0) {
      console.log(`🧹 Cleaned up ${cleared} old error log entries`);
    }
  }, 3600000); // 1 hour
}

module.exports = addErrorHandling;