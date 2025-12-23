/**
 * Robust Error Handling System for Rummikub Stability
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

const EventEmitter = require('events');

class RobustErrorHandler extends EventEmitter {
  constructor() {
    super();
    
    // Error tracking and logging
    this.errorLog = [];
    this.errorCounts = new Map();
    this.userMessages = new Map();
    
    // Configuration
    this.config = {
      maxLogSize: 1000,
      debugMode: process.env.NODE_ENV === 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    };
    
    console.log('🛡️ Robust Error Handler initialized');
  }

  /**
   * Generate user-friendly error messages with specific guidance
   * Requirements: 6.1, 6.2
   */
  generateUserMessage(errorType, errorDetails = {}) {
    const userMessages = {
      'connection_error': {
        message: 'Unable to connect to the game server. Please check your internet connection and try again.',
        guidance: 'You can also try refreshing the page or switching to a different network.',
        canRetry: true
      },
      'database_error': {
        message: 'There was a problem saving your game data. Please try again in a moment.',
        guidance: 'Your progress has been preserved locally and you can continue playing.',
        canRetry: true
      },
      'game_not_found': {
        message: 'The game you\'re trying to join no longer exists.',
        guidance: 'Please create a new game or ask your friends for a new game link.',
        canRetry: false,
        alternativeAction: 'create a new game'
      },
      'player_not_found': {
        message: 'Your player information could not be found in this game.',
        guidance: 'Please try rejoining the game or create a new game with your friends.',
        canRetry: true,
        alternativeAction: 'rejoin the game'
      },
      'invalid_move': {
        message: 'That move is not allowed according to the game rules.',
        guidance: 'Please check that your tiles form valid sets or runs, and try a different move.',
        canRetry: true
      },
      'game_state_corrupted': {
        message: 'The game encountered an error, but we\'ve recovered your progress.',
        guidance: 'You can continue playing normally. If you notice any issues, please refresh the page.',
        canRetry: false
      },
      'reconnection_failed': {
        message: 'Unable to reconnect to your game automatically.',
        guidance: 'Please try refreshing the page or clicking the reconnect button.',
        canRetry: true,
        alternativeAction: 'create a new game if the problem persists'
      },
      'server_error': {
        message: 'The server encountered an unexpected error.',
        guidance: 'Please try again in a moment. Your game progress has been saved.',
        canRetry: true
      },
      'validation_error': {
        message: 'The information you provided is not valid.',
        guidance: 'Please check your input and try again.',
        canRetry: true
      },
      'timeout_error': {
        message: 'The operation took too long to complete.',
        guidance: 'Please check your internet connection and try again.',
        canRetry: true
      },
      'permission_error': {
        message: 'You don\'t have permission to perform this action.',
        guidance: 'Please make sure you\'re logged in and try again.',
        canRetry: false
      },
      'rate_limit_error': {
        message: 'You\'re making requests too quickly.',
        guidance: 'Please wait a moment and try again.',
        canRetry: true
      }
    };

    const messageTemplate = userMessages[errorType] || {
      message: 'An unexpected error occurred.',
      guidance: 'Please try again or refresh the page.',
      canRetry: true
    };

    let message = messageTemplate.message;
    
    // Add specific guidance
    if (messageTemplate.guidance) {
      message += ` ${messageTemplate.guidance}`;
    }
    
    // Add contextual information from error details
    if (errorDetails.canRetry !== undefined) {
      messageTemplate.canRetry = errorDetails.canRetry;
    }
    
    if (errorDetails.alternativeAction) {
      message += ` Alternatively, you can ${errorDetails.alternativeAction}.`;
    } else if (messageTemplate.alternativeAction) {
      message += ` Alternatively, you can ${messageTemplate.alternativeAction}.`;
    }
    
    if (errorDetails.contactSupport) {
      message += ' If this problem continues, please contact support.';
    }

    return {
      message,
      canRetry: messageTemplate.canRetry,
      errorType,
      timestamp: Date.now()
    };
  }

  /**
   * Generate detailed debug logs for developers
   * Requirements: 6.2
   */
  generateDebugLog(errorType, errorDetails = {}, stackTrace = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'ERROR',
      type: errorType,
      message: errorDetails.message || 'Unknown error',
      details: {
        ...errorDetails,
        userAgent: errorDetails.userAgent || 'unknown',
        url: errorDetails.url || 'unknown',
        sessionId: errorDetails.sessionId || 'unknown',
        userId: errorDetails.userId || 'unknown',
        gameId: errorDetails.gameId || 'unknown'
      },
      stackTrace: stackTrace,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage()
      }
    };

    // Add to error log
    this.errorLog.push(logEntry);
    
    // Maintain log size limit
    if (this.errorLog.length > this.config.maxLogSize) {
      this.errorLog.shift();
    }
    
    // Update error counts for monitoring
    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);

    return logEntry;
  }

  /**
   * Handle errors with comprehensive logging and user feedback
   * Requirements: 6.1, 6.2
   */
  handleError(errorType, errorDetails = {}, stackTrace = null) {
    // Generate user-friendly message
    const userMessage = this.generateUserMessage(errorType, errorDetails);
    
    // Generate detailed debug log
    const debugLog = this.generateDebugLog(errorType, errorDetails, stackTrace);
    
    // Store user message for retrieval
    const errorId = `${errorType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.userMessages.set(errorId, userMessage);
    
    // Log to console based on environment
    if (this.config.debugMode) {
      console.error('🚨 Error Details:', debugLog);
    } else {
      console.error(`🚨 ${errorType}: ${userMessage.message}`);
    }
    
    // Emit event for external handlers
    this.emit('error', {
      errorId,
      errorType,
      userMessage,
      debugLog
    });

    return {
      errorId,
      userMessage: userMessage.message,
      canRetry: userMessage.canRetry,
      debugLog: this.config.debugMode ? debugLog : null
    };
  }

  /**
   * Detect game state corruption
   * Requirements: 6.3, 6.5
   */
  detectGameStateCorruption(gameState) {
    const issues = [];
    
    try {
      // Check for missing required fields
      if (!gameState) {
        issues.push({
          type: 'missing_game_state',
          severity: 'critical',
          description: 'Game state is null or undefined'
        });
        return issues;
      }
      
      if (!gameState.id) {
        issues.push({
          type: 'missing_game_id',
          severity: 'critical',
          description: 'Game ID is missing'
        });
      }
      
      if (typeof gameState.started !== 'boolean') {
        issues.push({
          type: 'invalid_started_flag',
          severity: 'high',
          description: 'Game started flag is not a boolean'
        });
      }
      
      // Check players array
      if (!Array.isArray(gameState.players)) {
        issues.push({
          type: 'invalid_players_array',
          severity: 'critical',
          description: 'Players is not an array'
        });
      } else {
        // Check for duplicate player names
        const playerNames = gameState.players.map(p => p && p.name).filter(Boolean);
        if (playerNames.length !== new Set(playerNames).size) {
          issues.push({
            type: 'duplicate_player_names',
            severity: 'high',
            description: 'Multiple players have the same name'
          });
        }
        
        // Check individual player data
        gameState.players.forEach((player, index) => {
          if (!player) {
            issues.push({
              type: 'null_player',
              severity: 'high',
              description: `Player at index ${index} is null or undefined`
            });
            return;
          }
          
          if (!player.name) {
            issues.push({
              type: 'missing_player_name',
              severity: 'medium',
              description: `Player at index ${index} has no name`
            });
          }
          
          if (!Array.isArray(player.hand)) {
            issues.push({
              type: 'invalid_player_hand',
              severity: 'high',
              description: `Player ${player.name || index} has invalid hand data`
            });
          }
        });
      }
      
      // Check current player index
      if (Array.isArray(gameState.players)) {
        if (gameState.currentPlayerIndex < 0 || gameState.currentPlayerIndex >= gameState.players.length) {
          issues.push({
            type: 'invalid_current_player_index',
            severity: 'high',
            description: 'Current player index is out of bounds'
          });
        }
      }
      
      // Check deck structure
      if (!Array.isArray(gameState.deck)) {
        issues.push({
          type: 'invalid_deck_structure',
          severity: 'high',
          description: 'Deck is not an array'
        });
      }
      
      // Check board structure
      if (!Array.isArray(gameState.board)) {
        issues.push({
          type: 'invalid_board_structure',
          severity: 'medium',
          description: 'Board is not an array'
        });
      }
      
      // Check for impossible tile counts (Rummikub has 106 tiles total)
      if (Array.isArray(gameState.players) && Array.isArray(gameState.deck)) {
        const totalTiles = gameState.players.reduce((sum, player) => {
          if (player && Array.isArray(player.hand)) {
            return sum + player.hand.length;
          }
          return sum;
        }, 0) + gameState.deck.length;
        
        if (totalTiles > 106) {
          issues.push({
            type: 'too_many_tiles',
            severity: 'critical',
            description: `Total tiles (${totalTiles}) exceeds maximum (106)`
          });
        }
      }
      
    } catch (error) {
      issues.push({
        type: 'corruption_detection_error',
        severity: 'critical',
        description: `Error during corruption detection: ${error.message}`
      });
    }
    
    return issues;
  }

  /**
   * Attempt to recover from game state corruption
   * Requirements: 6.3, 6.5
   */
  attemptGameStateRecovery(gameState, corruptionIssues) {
    const recoveryActions = [];
    let recoveredState = { ...gameState };
    
    try {
      corruptionIssues.forEach(issue => {
        switch (issue.type) {
          case 'missing_game_id':
            recoveredState.id = `recovered_${Date.now()}`;
            recoveryActions.push('Generated new game ID');
            break;
            
          case 'invalid_started_flag':
            recoveredState.started = false;
            recoveryActions.push('Reset game started flag to false');
            break;
            
          case 'invalid_players_array':
            recoveredState.players = [];
            recoveryActions.push('Reset players array');
            break;
            
          case 'invalid_current_player_index':
            recoveredState.currentPlayerIndex = 0;
            recoveryActions.push('Reset current player index to 0');
            break;
            
          case 'invalid_deck_structure':
            recoveredState.deck = [];
            recoveryActions.push('Reset deck array');
            break;
            
          case 'invalid_board_structure':
            recoveredState.board = [];
            recoveryActions.push('Reset board array');
            break;
            
          case 'too_many_tiles':
            // Reset tile distribution
            recoveredState.deck = [];
            if (Array.isArray(recoveredState.players)) {
              recoveredState.players.forEach(player => {
                if (player && player.hand) {
                  player.hand = [];
                }
              });
            }
            recoveryActions.push('Reset tile distribution');
            break;
            
          case 'missing_player_name':
            if (Array.isArray(recoveredState.players)) {
              recoveredState.players.forEach((player, index) => {
                if (player && !player.name) {
                  player.name = `Player${index + 1}`;
                  recoveryActions.push(`Generated name for player ${index + 1}`);
                }
              });
            }
            break;
            
          case 'invalid_player_hand':
            if (Array.isArray(recoveredState.players)) {
              recoveredState.players.forEach((player, index) => {
                if (player && !Array.isArray(player.hand)) {
                  player.hand = [];
                  recoveryActions.push(`Reset hand for player ${index + 1}`);
                }
              });
            }
            break;
            
          case 'null_player':
            if (Array.isArray(recoveredState.players)) {
              recoveredState.players = recoveredState.players.filter(p => p !== null && p !== undefined);
              recoveryActions.push('Removed null players');
            }
            break;
        }
      });
      
      // Verify recovery was successful
      const remainingIssues = this.detectGameStateCorruption(recoveredState);
      const criticalIssues = remainingIssues.filter(issue => issue.severity === 'critical');
      
      const recoveryResult = {
        success: criticalIssues.length === 0,
        recoveredState: recoveredState,
        actions: recoveryActions,
        remainingIssues: remainingIssues,
        timestamp: Date.now()
      };
      
      // Log recovery attempt
      this.handleError('game_state_recovery', {
        originalIssues: corruptionIssues.length,
        recoveryActions: recoveryActions.length,
        remainingIssues: remainingIssues.length,
        success: recoveryResult.success
      });
      
      return recoveryResult;
      
    } catch (error) {
      // Recovery failed
      const failureResult = {
        success: false,
        recoveredState: gameState, // Return original state
        actions: recoveryActions,
        remainingIssues: corruptionIssues,
        error: error.message,
        timestamp: Date.now()
      };
      
      this.handleError('game_state_recovery_failed', {
        error: error.message,
        originalIssues: corruptionIssues.length,
        partialActions: recoveryActions.length
      });
      
      return failureResult;
    }
  }

  /**
   * Handle game state corruption with detection and recovery
   * Requirements: 6.3, 6.5
   */
  handleGameStateCorruption(gameState) {
    // Detect corruption
    const issues = this.detectGameStateCorruption(gameState);
    
    if (issues.length === 0) {
      return {
        corrupted: false,
        gameState: gameState
      };
    }
    
    // Log corruption detection
    this.handleError('game_state_corrupted', {
      issueCount: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      gameId: gameState ? gameState.id : 'unknown'
    });
    
    // Attempt recovery
    const recoveryResult = this.attemptGameStateRecovery(gameState, issues);
    
    return {
      corrupted: true,
      issues: issues,
      recovery: recoveryResult,
      gameState: recoveryResult.recoveredState
    };
  }

  /**
   * Get error statistics for monitoring
   * Requirements: 6.2
   */
  getErrorStatistics() {
    const stats = {
      totalErrors: this.errorLog.length,
      errorsByType: Object.fromEntries(this.errorCounts),
      recentErrors: this.errorLog.slice(-10),
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    };
    
    return stats;
  }

  /**
   * Clear error logs (for maintenance)
   * Requirements: 6.2
   */
  clearErrorLogs() {
    const clearedCount = this.errorLog.length;
    this.errorLog = [];
    this.errorCounts.clear();
    this.userMessages.clear();
    
    console.log(`🧹 Cleared ${clearedCount} error log entries`);
    return clearedCount;
  }

  /**
   * Get user message by error ID
   * Requirements: 6.1
   */
  getUserMessage(errorId) {
    return this.userMessages.get(errorId);
  }
}

module.exports = RobustErrorHandler;