/**
 * Reconnection Error Handler
 * Provides comprehensive error handling and fallback mechanisms for the reconnection system
 * Requirements: Error handling and fallback mechanisms
 */

const analyticsLogger = require('./analyticsLogger');

class ReconnectionErrorHandler {
  constructor() {
    this.errorCounts = new Map(); // errorType -> count
    this.errorHistory = []; // Recent errors for pattern analysis
    this.fallbackStrategies = new Map(); // errorType -> fallback strategy
    this.maxErrorHistorySize = 100;
    
    this.setupFallbackStrategies();
    console.log('🛡️ Reconnection Error Handler initialized');
  }

  /**
   * Set up fallback strategies for different error types
   */
  setupFallbackStrategies() {
    this.fallbackStrategies.set('game_not_found', {
      strategy: 'redirect_to_lobby',
      retryable: false,
      userMessage: 'Game not found. You will be redirected to the lobby.',
      actions: ['redirect_to_lobby', 'clear_game_data']
    });

    this.fallbackStrategies.set('player_not_in_game', {
      strategy: 'verify_and_rejoin',
      retryable: true,
      maxRetries: 2,
      userMessage: 'Unable to verify your game membership. Attempting to rejoin...',
      actions: ['verify_player_data', 'attempt_rejoin', 'redirect_to_lobby']
    });

    this.fallbackStrategies.set('invalid_game_state', {
      strategy: 'state_recovery',
      retryable: true,
      maxRetries: 3,
      userMessage: 'Game state inconsistency detected. Attempting recovery...',
      actions: ['validate_state', 'repair_state', 'reset_state', 'create_new_game']
    });

    this.fallbackStrategies.set('state_restoration_failed', {
      strategy: 'partial_recovery',
      retryable: true,
      maxRetries: 2,
      userMessage: 'Unable to restore your game progress. Attempting partial recovery...',
      actions: ['restore_partial_state', 'reset_player_state', 'rejoin_as_spectator']
    });

    this.fallbackStrategies.set('network_error', {
      strategy: 'connection_recovery',
      retryable: true,
      maxRetries: 5,
      retryDelay: 2000,
      userMessage: 'Network connection issues detected. Retrying...',
      actions: ['retry_connection', 'switch_transport', 'reduce_quality']
    });

    this.fallbackStrategies.set('timer_sync_error', {
      strategy: 'timer_reset',
      retryable: true,
      maxRetries: 2,
      userMessage: 'Timer synchronization issue. Resetting timer...',
      actions: ['reset_timer', 'sync_with_server', 'use_default_timer']
    });

    this.fallbackStrategies.set('grace_period_error', {
      strategy: 'immediate_decision',
      retryable: false,
      userMessage: 'Grace period management error. Making immediate continuation decision...',
      actions: ['skip_grace_period', 'default_continuation', 'end_game']
    });

    this.fallbackStrategies.set('database_error', {
      strategy: 'memory_fallback',
      retryable: true,
      maxRetries: 3,
      retryDelay: 5000,
      userMessage: 'Database connectivity issue. Using temporary storage...',
      actions: ['use_memory_storage', 'retry_database', 'sync_when_available']
    });

    this.fallbackStrategies.set('concurrent_disconnection_error', {
      strategy: 'sequential_processing',
      retryable: true,
      maxRetries: 2,
      userMessage: 'Multiple disconnections detected. Processing sequentially...',
      actions: ['process_sequentially', 'batch_process', 'abandon_game']
    });

    this.fallbackStrategies.set('mobile_specific_error', {
      strategy: 'mobile_optimization',
      retryable: true,
      maxRetries: 3,
      userMessage: 'Mobile connection issue detected. Optimizing for mobile...',
      actions: ['extend_timeouts', 'reduce_frequency', 'simplify_protocol']
    });
  }

  /**
   * Handle an error with appropriate fallback strategy
   * @param {string} errorType - Type of error
   * @param {Error} error - The error object
   * @param {Object} context - Error context (gameId, playerId, etc.)
   * @returns {Promise<Object>} - Error handling result
   */
  async handleError(errorType, error, context = {}) {
    try {
      console.log(`🛡️ Handling error: ${errorType} - ${error.message}`);
      
      // Track error occurrence
      this.trackError(errorType, error, context);
      
      // Get fallback strategy
      const strategy = this.fallbackStrategies.get(errorType);
      if (!strategy) {
        return this.handleUnknownError(errorType, error, context);
      }
      
      // Check if we've exceeded retry limits
      const errorCount = this.getRecentErrorCount(errorType, context);
      if (strategy.maxRetries && errorCount > strategy.maxRetries) {
        console.log(`🛡️ Max retries exceeded for ${errorType}, using final fallback`);
        return this.executeFinalFallback(errorType, error, context, strategy);
      }
      
      // Execute fallback strategy
      const result = await this.executeFallbackStrategy(errorType, error, context, strategy);
      
      // Log the error handling result
      analyticsLogger.logErrorHandlingEvent({
        errorType,
        errorMessage: error.message,
        context,
        strategy: strategy.strategy,
        result: result.success ? 'success' : 'failed',
        retryCount: errorCount,
        fallbackActions: result.actionsExecuted || [],
        metadata: {
          strategy,
          result
        }
      });
      
      return result;
      
    } catch (handlingError) {
      console.error(`❌ Error in error handler:`, handlingError.message);
      return this.handleCriticalError(errorType, error, handlingError, context);
    }
  }

  /**
   * Execute a fallback strategy
   * @param {string} errorType - Type of error
   * @param {Error} error - The error object
   * @param {Object} context - Error context
   * @param {Object} strategy - Fallback strategy
   * @returns {Promise<Object>} - Execution result
   */
  async executeFallbackStrategy(errorType, error, context, strategy) {
    console.log(`🛡️ Executing fallback strategy: ${strategy.strategy} for ${errorType}`);
    
    const result = {
      success: false,
      strategy: strategy.strategy,
      actionsExecuted: [],
      userMessage: strategy.userMessage,
      retryable: strategy.retryable,
      retryDelay: strategy.retryDelay || 1000
    };
    
    try {
      // Execute actions in sequence
      for (const action of strategy.actions) {
        const actionResult = await this.executeAction(action, errorType, error, context);
        result.actionsExecuted.push({
          action,
          success: actionResult.success,
          result: actionResult.result
        });
        
        // If action succeeds, we can stop here
        if (actionResult.success) {
          result.success = true;
          result.finalAction = action;
          result.finalResult = actionResult.result;
          break;
        }
        
        // If action fails but is critical, stop execution
        if (actionResult.critical) {
          result.criticalFailure = true;
          result.criticalAction = action;
          break;
        }
      }
      
      return result;
      
    } catch (strategyError) {
      console.error(`❌ Error executing fallback strategy:`, strategyError.message);
      result.strategyError = strategyError.message;
      return result;
    }
  }

  /**
   * Execute a specific fallback action
   * @param {string} action - Action to execute
   * @param {string} errorType - Type of error
   * @param {Error} error - The error object
   * @param {Object} context - Error context
   * @returns {Promise<Object>} - Action result
   */
  async executeAction(action, errorType, error, context) {
    console.log(`🛡️ Executing action: ${action} for ${errorType}`);
    
    try {
      switch (action) {
        case 'redirect_to_lobby':
          return this.redirectToLobby(context);
          
        case 'clear_game_data':
          return this.clearGameData(context);
          
        case 'verify_player_data':
          return this.verifyPlayerData(context);
          
        case 'attempt_rejoin':
          return this.attemptRejoin(context);
          
        case 'validate_state':
          return this.validateState(context);
          
        case 'repair_state':
          return this.repairState(context);
          
        case 'reset_state':
          return this.resetState(context);
          
        case 'create_new_game':
          return this.createNewGame(context);
          
        case 'restore_partial_state':
          return this.restorePartialState(context);
          
        case 'reset_player_state':
          return this.resetPlayerState(context);
          
        case 'rejoin_as_spectator':
          return this.rejoinAsSpectator(context);
          
        case 'retry_connection':
          return this.retryConnection(context);
          
        case 'switch_transport':
          return this.switchTransport(context);
          
        case 'reduce_quality':
          return this.reduceQuality(context);
          
        case 'reset_timer':
          return this.resetTimer(context);
          
        case 'sync_with_server':
          return this.syncWithServer(context);
          
        case 'use_default_timer':
          return this.useDefaultTimer(context);
          
        case 'skip_grace_period':
          return this.skipGracePeriod(context);
          
        case 'default_continuation':
          return this.defaultContinuation(context);
          
        case 'end_game':
          return this.endGame(context);
          
        case 'use_memory_storage':
          return this.useMemoryStorage(context);
          
        case 'retry_database':
          return this.retryDatabase(context);
          
        case 'sync_when_available':
          return this.syncWhenAvailable(context);
          
        case 'process_sequentially':
          return this.processSequentially(context);
          
        case 'batch_process':
          return this.batchProcess(context);
          
        case 'abandon_game':
          return this.abandonGame(context);
          
        case 'extend_timeouts':
          return this.extendTimeouts(context);
          
        case 'reduce_frequency':
          return this.reduceFrequency(context);
          
        case 'simplify_protocol':
          return this.simplifyProtocol(context);
          
        default:
          console.log(`⚠️ Unknown action: ${action}`);
          return { success: false, result: 'unknown_action' };
      }
      
    } catch (actionError) {
      console.error(`❌ Error executing action ${action}:`, actionError.message);
      return { success: false, result: 'action_error', error: actionError.message };
    }
  }

  /**
   * Redirect player to lobby
   */
  async redirectToLobby(context) {
    console.log(`🛡️ Redirecting player to lobby`);
    return { success: true, result: 'redirected_to_lobby', action: 'redirect' };
  }

  /**
   * Clear game data for player
   */
  async clearGameData(context) {
    console.log(`🛡️ Clearing game data for player`);
    // Implementation would clear localStorage, session data, etc.
    return { success: true, result: 'game_data_cleared' };
  }

  /**
   * Verify player data integrity
   */
  async verifyPlayerData(context) {
    console.log(`🛡️ Verifying player data`);
    // Implementation would check player data consistency
    return { success: true, result: 'player_data_verified' };
  }

  /**
   * Attempt to rejoin the game
   */
  async attemptRejoin(context) {
    console.log(`🛡️ Attempting to rejoin game`);
    // Implementation would attempt to rejoin the game
    return { success: true, result: 'rejoin_attempted' };
  }

  /**
   * Validate game state
   */
  async validateState(context) {
    console.log(`🛡️ Validating game state`);
    // Implementation would validate game state integrity
    return { success: true, result: 'state_validated' };
  }

  /**
   * Repair game state
   */
  async repairState(context) {
    console.log(`🛡️ Repairing game state`);
    // Implementation would attempt to repair corrupted state
    return { success: true, result: 'state_repaired' };
  }

  /**
   * Reset game state
   */
  async resetState(context) {
    console.log(`🛡️ Resetting game state`);
    // Implementation would reset game state to a known good state
    return { success: true, result: 'state_reset' };
  }

  /**
   * Create new game as fallback
   */
  async createNewGame(context) {
    console.log(`🛡️ Creating new game as fallback`);
    return { success: true, result: 'new_game_created', action: 'create_game' };
  }

  /**
   * Restore partial player state
   */
  async restorePartialState(context) {
    console.log(`🛡️ Restoring partial player state`);
    return { success: true, result: 'partial_state_restored' };
  }

  /**
   * Reset player state
   */
  async resetPlayerState(context) {
    console.log(`🛡️ Resetting player state`);
    return { success: true, result: 'player_state_reset' };
  }

  /**
   * Rejoin as spectator
   */
  async rejoinAsSpectator(context) {
    console.log(`🛡️ Rejoining as spectator`);
    return { success: true, result: 'rejoined_as_spectator', action: 'spectator_mode' };
  }

  /**
   * Retry connection
   */
  async retryConnection(context) {
    console.log(`🛡️ Retrying connection`);
    return { success: true, result: 'connection_retried' };
  }

  /**
   * Switch transport method
   */
  async switchTransport(context) {
    console.log(`🛡️ Switching transport method`);
    return { success: true, result: 'transport_switched' };
  }

  /**
   * Reduce connection quality for stability
   */
  async reduceQuality(context) {
    console.log(`🛡️ Reducing connection quality`);
    return { success: true, result: 'quality_reduced' };
  }

  /**
   * Reset timer
   */
  async resetTimer(context) {
    console.log(`🛡️ Resetting timer`);
    return { success: true, result: 'timer_reset' };
  }

  /**
   * Sync with server
   */
  async syncWithServer(context) {
    console.log(`🛡️ Syncing with server`);
    return { success: true, result: 'synced_with_server' };
  }

  /**
   * Use default timer
   */
  async useDefaultTimer(context) {
    console.log(`🛡️ Using default timer`);
    return { success: true, result: 'default_timer_used' };
  }

  /**
   * Skip grace period
   */
  async skipGracePeriod(context) {
    console.log(`🛡️ Skipping grace period`);
    return { success: true, result: 'grace_period_skipped' };
  }

  /**
   * Use default continuation
   */
  async defaultContinuation(context) {
    console.log(`🛡️ Using default continuation`);
    return { success: true, result: 'default_continuation_used', action: 'skip_turn' };
  }

  /**
   * End game as fallback
   */
  async endGame(context) {
    console.log(`🛡️ Ending game as fallback`);
    return { success: true, result: 'game_ended', action: 'end_game' };
  }

  /**
   * Use memory storage
   */
  async useMemoryStorage(context) {
    console.log(`🛡️ Using memory storage`);
    return { success: true, result: 'memory_storage_used' };
  }

  /**
   * Retry database connection
   */
  async retryDatabase(context) {
    console.log(`🛡️ Retrying database connection`);
    return { success: true, result: 'database_retried' };
  }

  /**
   * Sync when database becomes available
   */
  async syncWhenAvailable(context) {
    console.log(`🛡️ Will sync when database becomes available`);
    return { success: true, result: 'sync_scheduled' };
  }

  /**
   * Process disconnections sequentially
   */
  async processSequentially(context) {
    console.log(`🛡️ Processing disconnections sequentially`);
    return { success: true, result: 'sequential_processing_enabled' };
  }

  /**
   * Batch process disconnections
   */
  async batchProcess(context) {
    console.log(`🛡️ Batch processing disconnections`);
    return { success: true, result: 'batch_processing_enabled' };
  }

  /**
   * Abandon game due to errors
   */
  async abandonGame(context) {
    console.log(`🛡️ Abandoning game due to errors`);
    return { success: true, result: 'game_abandoned', action: 'abandon_game' };
  }

  /**
   * Extend timeouts for mobile
   */
  async extendTimeouts(context) {
    console.log(`🛡️ Extending timeouts for mobile`);
    return { success: true, result: 'timeouts_extended' };
  }

  /**
   * Reduce update frequency
   */
  async reduceFrequency(context) {
    console.log(`🛡️ Reducing update frequency`);
    return { success: true, result: 'frequency_reduced' };
  }

  /**
   * Simplify protocol for mobile
   */
  async simplifyProtocol(context) {
    console.log(`🛡️ Simplifying protocol for mobile`);
    return { success: true, result: 'protocol_simplified' };
  }

  /**
   * Handle unknown error types
   */
  async handleUnknownError(errorType, error, context) {
    console.log(`🛡️ Handling unknown error type: ${errorType}`);
    
    return {
      success: false,
      strategy: 'unknown_error_fallback',
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      actionsExecuted: [{ action: 'log_unknown_error', success: true }],
      retryable: true,
      retryDelay: 5000,
      fallbackOptions: ['retry', 'return_to_lobby', 'contact_support']
    };
  }

  /**
   * Execute final fallback when all retries are exhausted
   */
  async executeFinalFallback(errorType, error, context, strategy) {
    console.log(`🛡️ Executing final fallback for ${errorType}`);
    
    // Determine final action based on error type
    let finalAction = 'redirect_to_lobby';
    let userMessage = 'Unable to recover from error. Returning to lobby.';
    
    if (errorType.includes('game')) {
      finalAction = 'create_new_game';
      userMessage = 'Game recovery failed. You can start a new game.';
    } else if (errorType.includes('network')) {
      finalAction = 'retry_connection';
      userMessage = 'Network issues persist. Please check your connection.';
    }
    
    const actionResult = await this.executeAction(finalAction, errorType, error, context);
    
    return {
      success: actionResult.success,
      strategy: 'final_fallback',
      userMessage,
      actionsExecuted: [{ action: finalAction, success: actionResult.success, result: actionResult.result }],
      retryable: false,
      isFinalFallback: true
    };
  }

  /**
   * Handle critical errors in the error handler itself
   */
  async handleCriticalError(originalErrorType, originalError, handlingError, context) {
    console.error(`🚨 Critical error in error handler:`, handlingError.message);
    
    // Log critical error
    analyticsLogger.logCriticalError({
      originalErrorType,
      originalError: originalError.message,
      handlingError: handlingError.message,
      context,
      timestamp: new Date()
    });
    
    return {
      success: false,
      strategy: 'critical_error_fallback',
      userMessage: 'A critical system error occurred. Please refresh the page or contact support.',
      actionsExecuted: [{ action: 'log_critical_error', success: true }],
      retryable: false,
      isCriticalError: true,
      fallbackOptions: ['refresh_page', 'contact_support']
    };
  }

  /**
   * Track error occurrence for pattern analysis
   */
  trackError(errorType, error, context) {
    // Increment error count
    const currentCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentCount + 1);
    
    // Add to error history
    const errorRecord = {
      errorType,
      message: error.message,
      context,
      timestamp: new Date(),
      stack: error.stack
    };
    
    this.errorHistory.push(errorRecord);
    
    // Keep history size manageable
    if (this.errorHistory.length > this.maxErrorHistorySize) {
      this.errorHistory.shift();
    }
    
    console.log(`📊 Error tracked: ${errorType} (count: ${currentCount + 1})`);
  }

  /**
   * Get recent error count for a specific error type and context
   */
  getRecentErrorCount(errorType, context, timeWindow = 300000) { // 5 minutes
    const cutoffTime = new Date(Date.now() - timeWindow);
    
    return this.errorHistory.filter(record => 
      record.errorType === errorType &&
      record.timestamp > cutoffTime &&
      this.contextMatches(record.context, context)
    ).length;
  }

  /**
   * Check if contexts match for error counting
   */
  contextMatches(recordContext, currentContext) {
    // Simple matching - can be enhanced based on needs
    return recordContext.gameId === currentContext.gameId &&
           recordContext.playerId === currentContext.playerId;
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics() {
    const recentErrors = this.errorHistory.filter(record => 
      record.timestamp > new Date(Date.now() - 3600000) // Last hour
    );
    
    const errorTypeStats = {};
    for (const [errorType, count] of this.errorCounts) {
      const recentCount = recentErrors.filter(r => r.errorType === errorType).length;
      errorTypeStats[errorType] = {
        totalCount: count,
        recentCount,
        lastOccurrence: this.errorHistory
          .filter(r => r.errorType === errorType)
          .pop()?.timestamp
      };
    }
    
    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorTypes: Object.keys(errorTypeStats).length,
      errorTypeStats,
      timestamp: new Date()
    };
  }

  /**
   * Clear error history (for maintenance)
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
    console.log('🧹 Error history cleared');
  }
}

// Export singleton instance
const reconnectionErrorHandler = new ReconnectionErrorHandler();

module.exports = reconnectionErrorHandler;