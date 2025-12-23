/**
 * Socket.IO Error Handler Integration
 * Implements Requirements 6.1, 6.2, 6.4
 */

const RobustErrorHandler = require('./errorHandler');

class SocketErrorHandler {
  constructor(io) {
    this.io = io;
    this.errorHandler = new RobustErrorHandler();
    
    // Set up error handler event listeners
    this.setupErrorHandlerEvents();
    
    console.log('🔌 Socket Error Handler initialized');
  }

  /**
   * Set up error handler event listeners
   * Requirements: 6.1, 6.2
   */
  setupErrorHandlerEvents() {
    this.errorHandler.on('error', (errorData) => {
      // Emit error statistics to admin clients if needed
      this.io.emit('errorStatistics', this.errorHandler.getErrorStatistics());
    });
  }

  /**
   * Handle socket connection errors
   * Requirements: 6.1, 6.4
   */
  handleConnectionError(socket, error, context = {}) {
    const errorDetails = {
      message: error.message,
      socketId: socket.id,
      userAgent: socket.handshake.headers['user-agent'],
      ipAddress: socket.handshake.address,
      sessionId: context.sessionId,
      userId: context.userId,
      gameId: context.gameId,
      canRetry: true,
      alternativeAction: 'refresh the page'
    };

    const result = this.errorHandler.handleError('connection_error', errorDetails, error.stack);
    
    // Send user-friendly error to client
    socket.emit('connectionError', {
      message: result.userMessage,
      canRetry: result.canRetry,
      errorId: result.errorId
    });

    return result;
  }

  /**
   * Handle game-related errors
   * Requirements: 6.1, 6.3
   */
  handleGameError(socket, errorType, error, gameContext = {}) {
    const errorDetails = {
      message: error.message || error,
      socketId: socket.id,
      gameId: gameContext.gameId,
      playerName: gameContext.playerName,
      userId: gameContext.userId,
      sessionId: gameContext.sessionId,
      gameState: gameContext.gameState ? 'present' : 'missing'
    };

    // Handle game state corruption specifically
    if (errorType === 'game_state_corrupted' && gameContext.gameState) {
      const corruptionResult = this.errorHandler.handleGameStateCorruption(gameContext.gameState);
      
      if (corruptionResult.corrupted) {
        // Send corruption recovery information
        socket.emit('gameStateCorrupted', {
          message: 'The game encountered an error, but we\'ve recovered your progress.',
          recovered: corruptionResult.recovery.success,
          canContinue: corruptionResult.recovery.success,
          recoveryActions: corruptionResult.recovery.actions
        });

        // If recovery was successful, send updated game state
        if (corruptionResult.recovery.success) {
          socket.emit('gameStateRestored', {
            gameState: corruptionResult.gameState,
            message: 'Your game has been restored and you can continue playing.'
          });
        }

        return corruptionResult;
      }
    }

    const result = this.errorHandler.handleError(errorType, errorDetails, error.stack);
    
    // Send appropriate error message to client
    socket.emit('gameError', {
      type: errorType,
      message: result.userMessage,
      canRetry: result.canRetry,
      errorId: result.errorId
    });

    // Notify other players in the game if necessary
    if (gameContext.gameId && ['game_state_corrupted', 'player_disconnected'].includes(errorType)) {
      socket.to(gameContext.gameId).emit('gameIssue', {
        type: errorType,
        affectedPlayer: gameContext.playerName,
        message: `${gameContext.playerName} experienced a game issue, but it has been resolved.`
      });
    }

    return result;
  }

  /**
   * Handle database errors
   * Requirements: 6.1, 6.2
   */
  handleDatabaseError(socket, error, context = {}) {
    const errorDetails = {
      message: error.message,
      operation: context.operation || 'unknown',
      collection: context.collection || 'unknown',
      socketId: socket.id,
      userId: context.userId,
      gameId: context.gameId,
      canRetry: true,
      contactSupport: error.name === 'MongoNetworkError'
    };

    const result = this.errorHandler.handleError('database_error', errorDetails, error.stack);
    
    socket.emit('databaseError', {
      message: result.userMessage,
      canRetry: result.canRetry,
      errorId: result.errorId,
      localBackup: true // Indicate that local state is preserved
    });

    return result;
  }

  /**
   * Handle validation errors
   * Requirements: 6.1
   */
  handleValidationError(socket, validationErrors, context = {}) {
    const errorDetails = {
      message: 'Validation failed',
      validationErrors: validationErrors,
      socketId: socket.id,
      userId: context.userId,
      gameId: context.gameId,
      operation: context.operation
    };

    const result = this.errorHandler.handleError('validation_error', errorDetails);
    
    socket.emit('validationError', {
      message: result.userMessage,
      errors: validationErrors,
      canRetry: result.canRetry,
      errorId: result.errorId
    });

    return result;
  }

  /**
   * Handle timeout errors
   * Requirements: 6.1, 6.4
   */
  handleTimeoutError(socket, operation, timeout, context = {}) {
    const errorDetails = {
      message: `Operation '${operation}' timed out after ${timeout}ms`,
      operation: operation,
      timeout: timeout,
      socketId: socket.id,
      userId: context.userId,
      gameId: context.gameId,
      canRetry: true
    };

    const result = this.errorHandler.handleError('timeout_error', errorDetails);
    
    socket.emit('timeoutError', {
      message: result.userMessage,
      operation: operation,
      canRetry: result.canRetry,
      errorId: result.errorId
    });

    return result;
  }

  /**
   * Handle reconnection failures
   * Requirements: 6.1, 6.4
   */
  handleReconnectionFailure(socket, attemptNumber, error, context = {}) {
    const errorDetails = {
      message: error.message || 'Reconnection failed',
      attemptNumber: attemptNumber,
      socketId: socket.id,
      userId: context.userId,
      gameId: context.gameId,
      playerName: context.playerName,
      canRetry: attemptNumber < 5,
      alternativeAction: attemptNumber >= 5 ? 'create a new game' : 'try again'
    };

    const result = this.errorHandler.handleError('reconnection_failed', errorDetails, error.stack);
    
    socket.emit('reconnectionFailed', {
      message: result.userMessage,
      attemptNumber: attemptNumber,
      canRetry: result.canRetry,
      errorId: result.errorId,
      fallbackOptions: this.getReconnectionFallbacks(attemptNumber)
    });

    return result;
  }

  /**
   * Get reconnection fallback options
   * Requirements: 6.4
   */
  getReconnectionFallbacks(attemptNumber) {
    const fallbacks = [
      {
        type: 'manual_retry',
        title: 'Try Again',
        description: 'Attempt to reconnect manually',
        available: true
      },
      {
        type: 'refresh_page',
        title: 'Refresh Page',
        description: 'Refresh the browser page to restart the connection',
        available: true
      }
    ];

    if (attemptNumber >= 3) {
      fallbacks.push({
        type: 'check_connection',
        title: 'Check Connection',
        description: 'Verify your internet connection is stable',
        available: true
      });
    }

    if (attemptNumber >= 5) {
      fallbacks.push({
        type: 'new_game',
        title: 'Create New Game',
        description: 'Start a new game with the same players',
        available: true
      });
    }

    return fallbacks;
  }

  /**
   * Handle general socket errors
   * Requirements: 6.1, 6.2
   */
  handleSocketError(socket, error, context = {}) {
    const errorType = this.categorizeError(error);
    
    switch (errorType) {
      case 'connection':
        return this.handleConnectionError(socket, error, context);
      case 'database':
        return this.handleDatabaseError(socket, error, context);
      case 'validation':
        return this.handleValidationError(socket, error.validationErrors || [error.message], context);
      case 'timeout':
        return this.handleTimeoutError(socket, context.operation || 'unknown', context.timeout || 30000, context);
      case 'game':
        return this.handleGameError(socket, 'server_error', error, context);
      default:
        return this.handleGenericError(socket, error, context);
    }
  }

  /**
   * Categorize errors for appropriate handling
   * Requirements: 6.2
   */
  categorizeError(error) {
    if (error.name === 'MongoError' || error.name === 'MongoNetworkError') {
      return 'database';
    }
    
    if (error.name === 'ValidationError') {
      return 'validation';
    }
    
    if (error.message && error.message.includes('timeout')) {
      return 'timeout';
    }
    
    if (error.message && (error.message.includes('connection') || error.message.includes('ECONNREFUSED'))) {
      return 'connection';
    }
    
    if (error.message && error.message.includes('game')) {
      return 'game';
    }
    
    return 'generic';
  }

  /**
   * Handle generic errors
   * Requirements: 6.1, 6.2
   */
  handleGenericError(socket, error, context = {}) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      socketId: socket.id,
      userId: context.userId,
      gameId: context.gameId,
      canRetry: true
    };

    const result = this.errorHandler.handleError('server_error', errorDetails, error.stack);
    
    socket.emit('serverError', {
      message: result.userMessage,
      canRetry: result.canRetry,
      errorId: result.errorId
    });

    return result;
  }

  /**
   * Get error statistics
   * Requirements: 6.2
   */
  getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }

  /**
   * Clear error logs
   * Requirements: 6.2
   */
  clearErrorLogs() {
    return this.errorHandler.clearErrorLogs();
  }
}

module.exports = SocketErrorHandler;