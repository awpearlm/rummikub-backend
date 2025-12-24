/**
 * Reconnection Handler for Rummikub Player Reconnection Management
 * Implements Requirements 3.3, 3.4, 8.4, 8.5
 * 
 * Manages the reconnection process, state validation, and seamless game restoration.
 */

const Game = require('../models/Game');
const gamePauseController = require('./gamePauseController');
const analyticsLogger = require('./analyticsLogger');

class ReconnectionHandler {
  constructor() {
    this.reconnectionAttempts = new Map(); // playerId -> attempt info
    this.stateValidationCache = new Map(); // gameId -> validation results
    
    console.log('🔄 Reconnection Handler initialized');
  }

  /**
   * Attempt to reconnect player to existing game
   * Requirements: 3.3, 3.4
   * @param {string} playerId - Player attempting to reconnect
   * @param {string} gameId - Game ID to reconnect to
   * @param {Object} connectionInfo - Connection information
   * @returns {Promise<Object>} - Reconnection result
   */
  async attemptReconnection(playerId, gameId, connectionInfo = {}) {
    try {
      console.log(`🔄 Attempting reconnection: ${playerId} to game ${gameId}`);
      
      // Track reconnection attempt
      this.trackReconnectionAttempt(playerId, gameId);
      
      // Find the game
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        console.log(`❌ Game ${gameId} not found for reconnection`);
        return {
          success: false,
          reason: 'game_not_found',
          fallbackOptions: ['create_new_game', 'join_different_game']
        };
      }

      // Check if player was part of this game
      const playerExists = this.validatePlayerInGame(gameDoc, playerId);
      if (!playerExists) {
        console.log(`❌ Player ${playerId} was not part of game ${gameId}`);
        return {
          success: false,
          reason: 'player_not_in_game',
          fallbackOptions: ['join_as_spectator', 'create_new_game']
        };
      }

      // Validate game state integrity
      const stateValidation = await this.validateGameStateIntegrity(gameDoc);
      if (!stateValidation.isValid) {
        console.log(`❌ Game state validation failed for ${gameId}:`, stateValidation.errors);
        return {
          success: false,
          reason: 'invalid_game_state',
          errors: stateValidation.errors,
          fallbackOptions: await this.generateFallbackOptions(gameDoc, stateValidation)
        };
      }

      // Check if game is still active
      if (gameDoc.endTime) {
        console.log(`❌ Game ${gameId} has already ended`);
        return {
          success: false,
          reason: 'game_ended',
          gameResult: {
            winner: gameDoc.winner,
            endTime: gameDoc.endTime,
            duration: gameDoc.duration
          },
          fallbackOptions: ['view_game_results', 'create_new_game']
        };
      }

      // Restore player state
      const restorationResult = await this.restorePlayerState(playerId, gameDoc, connectionInfo);
      if (!restorationResult.success) {
        console.log(`❌ Failed to restore player state for ${playerId}:`, restorationResult.reason);
        return {
          success: false,
          reason: 'state_restoration_failed',
          details: restorationResult,
          fallbackOptions: await this.generateStateRestorationFallbacks(gameDoc, playerId)
        };
      }

      // Update player status to reconnecting
      gameDoc.updatePlayerStatus(playerId, 'RECONNECTING', connectionInfo);

      // If game was paused due to this player, resume it
      let resumeResult = null;
      if (gameDoc.isPaused && gameDoc.pausedBy === playerId) {
        console.log(`🔄 Resuming game ${gameId} due to player ${playerId} reconnection`);
        resumeResult = await gamePauseController.resumeGame(gameId, playerId, restorationResult.restoredState);
      }

      // Synchronize player with current game state
      const synchronizationResult = await this.synchronizeGameState(playerId, gameDoc);

      // Update player status to connected
      gameDoc.updatePlayerStatus(playerId, 'CONNECTED', connectionInfo);
      
      // Save the updated game state
      await gameDoc.save();

      // Clear reconnection attempt tracking
      this.clearReconnectionAttempt(playerId);

      // Log successful reconnection for analytics
      const reconnectionTime = attemptInfo ? Date.now() - attemptInfo.lastAttempt.getTime() : 0;
      analyticsLogger.logReconnectionEvent({
        playerId,
        gameId,
        success: true,
        attemptNumber: attemptInfo?.attempts || 1,
        reconnectionTime,
        disconnectionDuration: reconnectionTime,
        wasPaused: gameDoc.isPaused,
        wasResumed: resumeResult?.success || false,
        gracePeriodActive: gameDoc.gracePeriod.isActive,
        gracePeriodRemaining: gameDoc.getGracePeriodTimeRemaining(),
        stateRestorationSuccess: restorationResult.success,
        dataIntegrityValid: stateValidation.isValid,
        fallbackUsed: false,
        metadata: {
          restorationResult,
          synchronizationResult,
          resumeResult
        }
      });

      console.log(`✅ Player ${playerId} successfully reconnected to game ${gameId}`);

      return {
        success: true,
        playerId,
        gameId,
        reconnectedAt: new Date(),
        restoredState: restorationResult.restoredState,
        gameState: synchronizationResult.gameState,
        wasGameResumed: resumeResult?.success || false,
        reconnectionAttempts: this.getReconnectionAttemptCount(playerId),
        message: 'Successfully reconnected to game'
      };

    } catch (error) {
      console.error(`❌ Reconnection attempt failed for ${playerId} to game ${gameId}:`, error.message);
      
      // Handle reconnection failure
      const failureResult = await this.handleReconnectionFailure(playerId, gameId, error.message);
      
      return {
        success: false,
        reason: 'reconnection_error',
        error: error.message,
        fallbackOptions: failureResult.fallbackOptions,
        canRetry: failureResult.canRetry,
        retryDelay: failureResult.retryDelay
      };
    }
  }

  /**
   * Validate and restore player's game state
   * Requirements: 8.4, 8.5
   * @param {string} playerId - Player ID
   * @param {Object} gameDoc - Game document
   * @param {Object} connectionInfo - Connection information
   * @returns {Promise<Object>} - Restoration result
   */
  async restorePlayerState(playerId, gameDoc, connectionInfo = {}) {
    try {
      console.log(`🔄 Restoring player state for ${playerId} in game ${gameDoc.gameId}`);

      // Find player in game
      const playerIndex = gameDoc.players.findIndex(p => 
        (p.name === playerId || p.userId?.toString() === playerId)
      );

      if (playerIndex === -1) {
        return {
          success: false,
          reason: 'player_not_found_in_game'
        };
      }

      const player = gameDoc.players[playerIndex];

      // Validate player data integrity
      const playerValidation = this.validatePlayerData(player, gameDoc);
      if (!playerValidation.isValid) {
        console.log(`❌ Player data validation failed:`, playerValidation.errors);
        return {
          success: false,
          reason: 'invalid_player_data',
          errors: playerValidation.errors
        };
      }

      // Restore player's hand (if stored in game state)
      let playerHand = null;
      if (gameDoc.gameState && gameDoc.gameState.playerHands) {
        playerHand = gameDoc.gameState.playerHands[playerIndex];
      }

      // Restore turn timer if this is the current player
      let timerState = null;
      if (gameDoc.gameState.currentPlayerIndex === playerIndex && gameDoc.turnTimer.remainingTime !== null) {
        timerState = {
          remainingTime: gameDoc.turnTimer.remainingTime,
          originalDuration: gameDoc.turnTimer.originalDuration,
          wasPaused: gameDoc.turnTimer.pausedAt !== null
        };
      }

      // Restore board position and view state
      const boardState = {
        board: gameDoc.gameState.board || [],
        lastMove: gameDoc.gameState.lastMove || null,
        validMoves: gameDoc.gameState.validMoves || []
      };

      // Restore game progress information
      const gameProgress = {
        currentPlayerIndex: gameDoc.gameState.currentPlayerIndex,
        turnNumber: gameDoc.gameState.turnNumber || 0,
        gamePhase: gameDoc.gameState.gamePhase || 'playing',
        scores: gameDoc.players.map(p => ({ name: p.name, score: p.score }))
      };

      const restoredState = {
        playerId,
        playerIndex,
        playerData: player,
        playerHand,
        timerState,
        boardState,
        gameProgress,
        connectionInfo,
        restoredAt: new Date()
      };

      console.log(`✅ Player state restored for ${playerId}`);

      return {
        success: true,
        restoredState
      };

    } catch (error) {
      console.error(`❌ Failed to restore player state for ${playerId}:`, error.message);
      return {
        success: false,
        reason: 'restoration_error',
        error: error.message
      };
    }
  }

  /**
   * Synchronize player with current game state
   * Requirements: 3.4, 8.4
   * @param {string} playerId - Player ID
   * @param {Object} gameDoc - Current game document
   * @returns {Promise<Object>} - Synchronization result
   */
  async synchronizeGameState(playerId, gameDoc) {
    try {
      console.log(`🔄 Synchronizing game state for ${playerId} in game ${gameDoc.gameId}`);

      // Prepare complete game state for synchronization
      const gameState = {
        gameId: gameDoc.gameId,
        players: gameDoc.players.map(p => ({
          name: p.name,
          score: p.score,
          isBot: p.isBot,
          isWinner: p.isWinner,
          isCurrentPlayer: gameDoc.players.indexOf(p) === gameDoc.gameState.currentPlayerIndex
        })),
        currentPlayerIndex: gameDoc.gameState.currentPlayerIndex,
        board: gameDoc.gameState.board || [],
        gamePhase: gameDoc.gameState.gamePhase || 'playing',
        turnNumber: gameDoc.gameState.turnNumber || 0,
        isPaused: gameDoc.isPaused,
        pauseInfo: gameDoc.isPaused ? {
          reason: gameDoc.pauseReason,
          pausedAt: gameDoc.pausedAt,
          pausedBy: gameDoc.pausedBy
        } : null,
        gracePeriod: gameDoc.gracePeriod.isActive ? {
          isActive: true,
          targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
          timeRemaining: gameDoc.getGracePeriodTimeRemaining(),
          startTime: gameDoc.gracePeriod.startTime,
          duration: gameDoc.gracePeriod.duration
        } : null,
        continuationOptions: gameDoc.continuationOptions.presented ? {
          options: gameDoc.continuationOptions.options,
          votes: gameDoc.continuationOptions.votes,
          presentedAt: gameDoc.continuationOptions.presentedAt
        } : null,
        playerStatuses: gameDoc.playerStatuses.map(ps => ({
          playerId: ps.playerId,
          status: ps.status,
          lastSeen: ps.lastSeen,
          connectionQuality: ps.connectionMetrics?.connectionQuality
        })),
        lastActivity: gameDoc.lifecycle.lastActivity,
        synchronizedAt: new Date()
      };

      // Validate synchronization data
      const syncValidation = this.validateSynchronizationData(gameState);
      if (!syncValidation.isValid) {
        console.log(`❌ Synchronization data validation failed:`, syncValidation.errors);
        throw new Error(`Synchronization validation failed: ${syncValidation.errors.join(', ')}`);
      }

      console.log(`✅ Game state synchronized for ${playerId}`);

      return {
        success: true,
        gameState,
        synchronizedAt: new Date()
      };

    } catch (error) {
      console.error(`❌ Failed to synchronize game state for ${playerId}:`, error.message);
      return {
        success: false,
        reason: 'synchronization_error',
        error: error.message
      };
    }
  }

  /**
   * Handle failed reconnection attempts
   * Requirements: 3.3, 3.4
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   * @param {string} reason - Failure reason
   * @returns {Promise<Object>} - Failure handling result
   */
  async handleReconnectionFailure(playerId, gameId, reason) {
    try {
      console.log(`❌ Handling reconnection failure: ${playerId} to game ${gameId} - ${reason}`);

      // Track the failure
      const attemptInfo = this.getReconnectionAttemptInfo(playerId);
      if (attemptInfo) {
        attemptInfo.failures.push({
          reason,
          timestamp: new Date(),
          gameId
        });
      }

      // Determine if retry is possible
      const canRetry = this.canRetryReconnection(playerId, reason);
      const retryDelay = this.calculateRetryDelay(playerId);

      // Generate fallback options based on failure reason
      let fallbackOptions = [];
      
      switch (reason) {
        case 'game_not_found':
          fallbackOptions = ['create_new_game', 'join_different_game', 'browse_active_games'];
          break;
        case 'player_not_in_game':
          fallbackOptions = ['join_as_spectator', 'create_new_game', 'verify_game_code'];
          break;
        case 'invalid_game_state':
          fallbackOptions = ['reset_game_state', 'create_new_game', 'contact_support'];
          break;
        case 'game_ended':
          fallbackOptions = ['view_game_results', 'create_new_game', 'join_different_game'];
          break;
        case 'state_restoration_failed':
          fallbackOptions = ['reset_player_state', 'join_as_new_player', 'create_new_game'];
          break;
        case 'network_error':
          fallbackOptions = ['retry_connection', 'check_network', 'try_different_server'];
          break;
        default:
          fallbackOptions = ['retry_reconnection', 'create_new_game', 'contact_support'];
      }

      // Log the failure for analytics
      try {
        const gameDoc = await Game.findOne({ gameId });
        if (gameDoc) {
          gameDoc.reconnectionEvents.push({
            eventType: 'RECONNECT',
            playerId: playerId,
            reason: `failure_${reason}`,
            metadata: {
              attemptNumber: attemptInfo?.attempts || 0,
              canRetry,
              retryDelay,
              fallbackOptions
            }
          });
          await gameDoc.save();
        }
        
        // Also log to analytics logger
        analyticsLogger.logReconnectionEvent({
          playerId,
          gameId,
          success: false,
          attemptNumber: attemptInfo?.attempts || 1,
          reconnectionTime: 0,
          disconnectionDuration: attemptInfo ? Date.now() - attemptInfo.firstAttempt.getTime() : 0,
          reason,
          stateRestorationSuccess: false,
          dataIntegrityValid: false,
          fallbackUsed: true,
          metadata: {
            canRetry,
            retryDelay,
            fallbackOptions,
            failureReason: reason
          }
        });
        
      } catch (logError) {
        console.error(`❌ Failed to log reconnection failure:`, logError.message);
      }

      console.log(`✅ Reconnection failure handled for ${playerId}`);

      return {
        success: true,
        playerId,
        gameId,
        reason,
        canRetry,
        retryDelay,
        fallbackOptions,
        attemptCount: attemptInfo?.attempts || 0,
        handledAt: new Date()
      };

    } catch (error) {
      console.error(`❌ Failed to handle reconnection failure for ${playerId}:`, error.message);
      return {
        success: false,
        reason: 'failure_handling_error',
        error: error.message,
        fallbackOptions: ['create_new_game', 'contact_support']
      };
    }
  }

  /**
   * Validate that player was part of the game
   * @param {Object} gameDoc - Game document
   * @param {string} playerId - Player ID
   * @returns {boolean} - True if player exists in game
   */
  validatePlayerInGame(gameDoc, playerId) {
    return gameDoc.players.some(p => 
      p.name === playerId || p.userId?.toString() === playerId
    );
  }

  /**
   * Validate game state integrity
   * Requirements: 8.4, 8.5
   * @param {Object} gameDoc - Game document
   * @returns {Promise<Object>} - Validation result
   */
  async validateGameStateIntegrity(gameDoc) {
    const errors = [];
    
    try {
      // Check if game document has required fields
      if (!gameDoc.gameId || typeof gameDoc.gameId !== 'string') {
        errors.push('Missing or invalid game ID');
      }

      if (!gameDoc.players || !Array.isArray(gameDoc.players) || gameDoc.players.length === 0) {
        errors.push('No players in game');
      }

      // Validate game state structure
      if (!gameDoc.gameState || typeof gameDoc.gameState !== 'object') {
        errors.push('Missing or invalid game state');
      } else {
        if (gameDoc.gameState.currentPlayerIndex === undefined || 
            gameDoc.gameState.currentPlayerIndex === null ||
            typeof gameDoc.gameState.currentPlayerIndex !== 'number') {
          errors.push('Missing or invalid current player index');
        }

        if (gameDoc.players && Array.isArray(gameDoc.players) && 
            typeof gameDoc.gameState.currentPlayerIndex === 'number' &&
            gameDoc.gameState.currentPlayerIndex >= gameDoc.players.length) {
          errors.push('Current player index out of bounds');
        }

        if (gameDoc.gameState.board !== null && 
            gameDoc.gameState.board !== undefined &&
            !Array.isArray(gameDoc.gameState.board)) {
          errors.push('Invalid board state');
        }
      }

      // Validate player statuses consistency
      if (gameDoc.playerStatuses && Array.isArray(gameDoc.playerStatuses)) {
        for (const status of gameDoc.playerStatuses) {
          if (!status.playerId || typeof status.playerId !== 'string' || status.playerId === '') {
            errors.push('Player status missing or invalid player ID');
          }
          
          if (gameDoc.players && Array.isArray(gameDoc.players)) {
            const playerExists = this.validatePlayerInGame(gameDoc, status.playerId);
            if (!playerExists) {
              errors.push(`Player status exists for non-existent player: ${status.playerId}`);
            }
          }
        }
      }

      // Validate pause state consistency
      if (gameDoc.isPaused === true || gameDoc.isPaused === 'true') {
        if (!gameDoc.pauseReason || typeof gameDoc.pauseReason !== 'string') {
          errors.push('Paused game missing pause reason');
        }
        if (!gameDoc.pausedBy || typeof gameDoc.pausedBy !== 'string') {
          errors.push('Paused game missing pausedBy field');
        }
      }

      // Validate grace period consistency
      if (gameDoc.gracePeriod && (gameDoc.gracePeriod.isActive === true || gameDoc.gracePeriod.isActive === 'true')) {
        if (!gameDoc.gracePeriod.startTime || (typeof gameDoc.gracePeriod.startTime !== 'object' && typeof gameDoc.gracePeriod.startTime !== 'string')) {
          errors.push('Active grace period missing or invalid start time');
        }
        if (!gameDoc.gracePeriod.targetPlayerId || 
            typeof gameDoc.gracePeriod.targetPlayerId !== 'string' || 
            gameDoc.gracePeriod.targetPlayerId === '') {
          errors.push('Active grace period missing target player');
        }
        if (typeof gameDoc.gracePeriod.duration !== 'number' || gameDoc.gracePeriod.duration <= 0) {
          errors.push('Invalid grace period duration');
        }
      }

      // Cache validation result
      const validationResult = {
        isValid: errors.length === 0,
        errors,
        validatedAt: new Date(),
        gameId: gameDoc.gameId || 'unknown'
      };

      this.stateValidationCache.set(gameDoc.gameId || 'unknown', validationResult);

      return validationResult;

    } catch (error) {
      console.error(`❌ Game state validation error:`, error.message);
      return {
        isValid: false,
        errors: [...errors, `Validation error: ${error.message}`],
        validatedAt: new Date(),
        gameId: gameDoc.gameId || 'unknown'
      };
    }
  }

  /**
   * Validate player data integrity
   * @param {Object} player - Player object
   * @param {Object} gameDoc - Game document
   * @returns {Object} - Validation result
   */
  validatePlayerData(player, gameDoc) {
    const errors = [];

    if (!player.name && !player.userId) {
      errors.push('Player missing both name and userId');
    }

    if (player.score === undefined || player.score === null) {
      errors.push('Player missing score');
    }

    if (typeof player.score !== 'number' || player.score < 0) {
      errors.push('Invalid player score');
    }

    if (player.isBot === undefined) {
      errors.push('Player missing isBot flag');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate synchronization data
   * @param {Object} gameState - Game state to validate
   * @returns {Object} - Validation result
   */
  validateSynchronizationData(gameState) {
    const errors = [];

    if (!gameState.gameId) {
      errors.push('Missing game ID in synchronization data');
    }

    if (!Array.isArray(gameState.players)) {
      errors.push('Invalid players array in synchronization data');
    }

    if (gameState.currentPlayerIndex === undefined || gameState.currentPlayerIndex === null) {
      errors.push('Missing current player index in synchronization data');
    }

    if (!Array.isArray(gameState.board)) {
      errors.push('Invalid board state in synchronization data');
    }

    if (!Array.isArray(gameState.playerStatuses)) {
      errors.push('Invalid player statuses in synchronization data');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate fallback options based on validation errors
   * @param {Object} gameDoc - Game document
   * @param {Object} stateValidation - Validation result
   * @returns {Promise<Array>} - Fallback options
   */
  async generateFallbackOptions(gameDoc, stateValidation) {
    const options = [];

    if (stateValidation.errors.some(e => e.toLowerCase().includes('game state'))) {
      options.push('reset_game_state');
    }

    if (stateValidation.errors.some(e => e.toLowerCase().includes('current player') || e.toLowerCase().includes('index'))) {
      options.push('reset_current_player');
    }

    if (stateValidation.errors.some(e => e.toLowerCase().includes('player status'))) {
      options.push('reset_player_statuses');
    }

    // Always provide these as last resort
    options.push('create_new_game', 'contact_support');

    return options;
  }

  /**
   * Generate state restoration fallback options
   * @param {Object} gameDoc - Game document
   * @param {string} playerId - Player ID
   * @returns {Promise<Array>} - Fallback options
   */
  async generateStateRestorationFallbacks(gameDoc, playerId) {
    const options = [];

    // Check if player can join as spectator
    if (!gameDoc.endTime) {
      options.push('join_as_spectator');
    }

    // Check if player can reset their state
    options.push('reset_player_state');

    // Check if game can be reset
    if (gameDoc.gameState.turnNumber <= 1) {
      options.push('reset_game');
    }

    // Always provide these options
    options.push('create_new_game', 'join_different_game');

    return options;
  }

  /**
   * Track reconnection attempt
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   */
  trackReconnectionAttempt(playerId, gameId) {
    let attemptInfo = this.reconnectionAttempts.get(playerId);
    
    if (!attemptInfo) {
      attemptInfo = {
        playerId,
        attempts: 0,
        firstAttempt: new Date(),
        lastAttempt: null,
        failures: [],
        gameIds: new Set()
      };
      this.reconnectionAttempts.set(playerId, attemptInfo);
    }

    attemptInfo.attempts++;
    attemptInfo.lastAttempt = new Date();
    attemptInfo.gameIds.add(gameId);

    console.log(`📊 Reconnection attempt #${attemptInfo.attempts} for ${playerId} to game ${gameId}`);
  }

  /**
   * Get reconnection attempt information
   * @param {string} playerId - Player ID
   * @returns {Object|null} - Attempt information
   */
  getReconnectionAttemptInfo(playerId) {
    return this.reconnectionAttempts.get(playerId);
  }

  /**
   * Get reconnection attempt count
   * @param {string} playerId - Player ID
   * @returns {number} - Number of attempts
   */
  getReconnectionAttemptCount(playerId) {
    const attemptInfo = this.reconnectionAttempts.get(playerId);
    return attemptInfo ? attemptInfo.attempts : 0;
  }

  /**
   * Clear reconnection attempt tracking
   * @param {string} playerId - Player ID
   */
  clearReconnectionAttempt(playerId) {
    this.reconnectionAttempts.delete(playerId);
    console.log(`🧹 Cleared reconnection attempt tracking for ${playerId}`);
  }

  /**
   * Determine if reconnection can be retried
   * @param {string} playerId - Player ID
   * @param {string} reason - Failure reason
   * @returns {boolean} - True if retry is possible
   */
  canRetryReconnection(playerId, reason) {
    const attemptInfo = this.getReconnectionAttemptInfo(playerId);
    const maxAttempts = 5;
    
    // Check attempt count
    if (attemptInfo && attemptInfo.attempts >= maxAttempts) {
      return false;
    }

    // Check failure reason
    const nonRetryableReasons = [
      'game_not_found',
      'player_not_in_game',
      'game_ended'
    ];

    return !nonRetryableReasons.includes(reason);
  }

  /**
   * Calculate retry delay based on attempt count
   * @param {string} playerId - Player ID
   * @returns {number} - Delay in milliseconds
   */
  calculateRetryDelay(playerId) {
    const attemptInfo = this.getReconnectionAttemptInfo(playerId);
    const baseDelay = 2000; // 2 seconds
    const maxDelay = 30000; // 30 seconds
    
    if (!attemptInfo) {
      return baseDelay;
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attemptInfo.attempts - 1);
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Handle concurrent disconnections independently
   * Requirements: 7.4, 10.4
   * @param {Array} disconnectionEvents - Array of disconnection events
   * @returns {Promise<Object>} - Concurrent handling result
   */
  async handleConcurrentDisconnections(disconnectionEvents) {
    try {
      console.log(`🔄 Handling ${disconnectionEvents.length} concurrent disconnections`);
      
      // Track concurrent disconnection event
      const concurrentEventId = `concurrent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Process each disconnection independently
      const disconnectionPromises = disconnectionEvents.map(async (event, index) => {
        try {
          const { playerId, gameId, reason, timestamp } = event;
          
          console.log(`🔄 Processing concurrent disconnection ${index + 1}/${disconnectionEvents.length}: ${playerId} from game ${gameId}`);
          
          // Find the game
          const gameDoc = await Game.findOne({ gameId });
          if (!gameDoc) {
            return {
              playerId,
              gameId,
              success: false,
              reason: 'game_not_found',
              processedAt: new Date()
            };
          }
          
          // Update player status to disconnected
          gameDoc.updatePlayerStatus(playerId, 'DISCONNECTED', {
            reason: reason,
            concurrentEventId: concurrentEventId,
            concurrentIndex: index
          });
          
          // Log the concurrent disconnection event
          gameDoc.reconnectionEvents.push({
            eventType: 'DISCONNECT',
            playerId: playerId,
            reason: `concurrent_${reason}`,
            metadata: {
              concurrentEventId,
              concurrentIndex: index,
              totalConcurrentEvents: disconnectionEvents.length,
              timestamp: timestamp || new Date()
            }
          });
          
          // Save the game state
          await gameDoc.save();
          
          return {
            playerId,
            gameId,
            success: true,
            reason: reason,
            concurrentEventId,
            processedAt: new Date()
          };
          
        } catch (error) {
          console.error(`❌ Failed to process concurrent disconnection for ${event.playerId}:`, error.message);
          return {
            playerId: event.playerId,
            gameId: event.gameId,
            success: false,
            reason: 'processing_error',
            error: error.message,
            processedAt: new Date()
          };
        }
      });
      
      // Wait for all disconnections to be processed
      const results = await Promise.allSettled(disconnectionPromises);
      
      // Analyze results
      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            playerId: disconnectionEvents[index].playerId,
            gameId: disconnectionEvents[index].gameId,
            success: false,
            reason: 'promise_rejected',
            error: result.reason?.message || 'Unknown error',
            processedAt: new Date()
          };
        }
      });
      
      const successfulProcessing = processedResults.filter(r => r.success);
      const failedProcessing = processedResults.filter(r => !r.success);
      
      console.log(`✅ Concurrent disconnections processed: ${successfulProcessing.length} successful, ${failedProcessing.length} failed`);
      
      // Check for game abandonment after processing all disconnections
      const abandonmentResults = await this.checkForGameAbandonment(disconnectionEvents);
      
      return {
        success: true,
        concurrentEventId,
        totalEvents: disconnectionEvents.length,
        successfulProcessing: successfulProcessing.length,
        failedProcessing: failedProcessing.length,
        results: processedResults,
        abandonmentResults,
        processedAt: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Failed to handle concurrent disconnections:`, error.message);
      return {
        success: false,
        reason: 'concurrent_handling_error',
        error: error.message,
        totalEvents: disconnectionEvents.length,
        processedAt: new Date()
      };
    }
  }

  /**
   * Check for game abandonment after concurrent disconnections
   * Requirements: 7.4, 10.4
   * @param {Array} disconnectionEvents - Array of disconnection events
   * @returns {Promise<Array>} - Abandonment check results
   */
  async checkForGameAbandonment(disconnectionEvents) {
    try {
      // Group disconnection events by game
      const gameGroups = new Map();
      
      disconnectionEvents.forEach(event => {
        if (!gameGroups.has(event.gameId)) {
          gameGroups.set(event.gameId, []);
        }
        gameGroups.get(event.gameId).push(event);
      });
      
      const abandonmentResults = [];
      
      // Check each game for potential abandonment
      for (const [gameId, events] of gameGroups) {
        try {
          const gameDoc = await Game.findOne({ gameId });
          if (!gameDoc) {
            abandonmentResults.push({
              gameId,
              isAbandoned: false,
              reason: 'game_not_found',
              checkedAt: new Date()
            });
            continue;
          }
          
          // Count connected players (excluding bots)
          const humanPlayers = gameDoc.players.filter(p => !p.isBot);
          const connectedHumanPlayers = gameDoc.playerStatuses.filter(ps => 
            ps.status === 'CONNECTED' || ps.status === 'RECONNECTING'
          );
          
          // Check if all human players are disconnected
          const allHumansDisconnected = humanPlayers.length > 0 && connectedHumanPlayers.length === 0;
          
          if (allHumansDisconnected) {
            console.log(`🚫 Game ${gameId} abandoned - all human players disconnected`);
            
            // Use the game pause controller to handle abandonment
            const gamePauseController = require('./gamePauseController');
            const abandonmentResult = await gamePauseController.handleGameAbandonment(
              gameId, 
              'ALL_PLAYERS_DISCONNECT'
            );
            
            abandonmentResults.push({
              gameId,
              isAbandoned: true,
              reason: 'all_players_disconnected',
              humanPlayers: humanPlayers.length,
              connectedPlayers: connectedHumanPlayers.length,
              abandonmentResult,
              checkedAt: new Date()
            });
          } else {
            abandonmentResults.push({
              gameId,
              isAbandoned: false,
              reason: 'players_still_connected',
              humanPlayers: humanPlayers.length,
              connectedPlayers: connectedHumanPlayers.length,
              checkedAt: new Date()
            });
          }
          
        } catch (error) {
          console.error(`❌ Failed to check abandonment for game ${gameId}:`, error.message);
          abandonmentResults.push({
            gameId,
            isAbandoned: false,
            reason: 'abandonment_check_error',
            error: error.message,
            checkedAt: new Date()
          });
        }
      }
      
      return abandonmentResults;
      
    } catch (error) {
      console.error(`❌ Failed to check for game abandonment:`, error.message);
      return [{
        isAbandoned: false,
        reason: 'abandonment_check_failed',
        error: error.message,
        checkedAt: new Date()
      }];
    }
  }

  /**
   * Detect if multiple disconnections are happening simultaneously
   * Requirements: 7.4
   * @param {Array} recentDisconnections - Recent disconnection events
   * @param {number} timeWindow - Time window in milliseconds to consider "concurrent"
   * @returns {Object} - Concurrency detection result
   */
  detectConcurrentDisconnections(recentDisconnections, timeWindow = 5000) {
    try {
      if (!Array.isArray(recentDisconnections) || recentDisconnections.length < 2) {
        return {
          isConcurrent: false,
          reason: 'insufficient_events',
          eventCount: recentDisconnections?.length || 0
        };
      }
      
      // Sort by timestamp
      const sortedEvents = recentDisconnections
        .filter(event => event.timestamp)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      if (sortedEvents.length < 2) {
        return {
          isConcurrent: false,
          reason: 'insufficient_timestamped_events',
          eventCount: sortedEvents.length
        };
      }
      
      // Check if events fall within the time window
      const firstEventTime = new Date(sortedEvents[0].timestamp);
      const lastEventTime = new Date(sortedEvents[sortedEvents.length - 1].timestamp);
      const timeDifference = lastEventTime - firstEventTime;
      
      const isConcurrent = timeDifference <= timeWindow;
      
      // Group by game to detect game-specific concurrent disconnections
      const gameGroups = new Map();
      sortedEvents.forEach(event => {
        if (!gameGroups.has(event.gameId)) {
          gameGroups.set(event.gameId, []);
        }
        gameGroups.get(event.gameId).push(event);
      });
      
      const gamesConcurrentDisconnections = [];
      for (const [gameId, events] of gameGroups) {
        if (events.length >= 2) {
          const gameFirstEvent = new Date(events[0].timestamp);
          const gameLastEvent = new Date(events[events.length - 1].timestamp);
          const gameTimeDifference = gameLastEvent - gameFirstEvent;
          
          gamesConcurrentDisconnections.push({
            gameId,
            eventCount: events.length,
            timeDifference: gameTimeDifference,
            isConcurrent: gameTimeDifference <= timeWindow,
            events: events.map(e => ({
              playerId: e.playerId,
              timestamp: e.timestamp,
              reason: e.reason
            }))
          });
        }
      }
      
      return {
        isConcurrent,
        overallTimeDifference: timeDifference,
        timeWindow,
        totalEvents: sortedEvents.length,
        affectedGames: gameGroups.size,
        gamesConcurrentDisconnections,
        detectedAt: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Failed to detect concurrent disconnections:`, error.message);
      return {
        isConcurrent: false,
        reason: 'detection_error',
        error: error.message,
        detectedAt: new Date()
      };
    }
  }

  /**
   * Handle network partition scenarios where multiple players lose connection
   * Requirements: 7.4
   * @param {string} gameId - Game ID
   * @param {Array} affectedPlayerIds - Players affected by network partition
   * @param {Object} partitionInfo - Information about the network partition
   * @returns {Promise<Object>} - Partition handling result
   */
  async handleNetworkPartition(gameId, affectedPlayerIds, partitionInfo = {}) {
    try {
      console.log(`🌐 Handling network partition for game ${gameId} affecting ${affectedPlayerIds.length} players`);
      
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        return {
          success: false,
          reason: 'game_not_found',
          gameId,
          affectedPlayers: affectedPlayerIds.length
        };
      }
      
      // Create disconnection events for all affected players
      const disconnectionEvents = affectedPlayerIds.map(playerId => ({
        playerId,
        gameId,
        reason: 'network_partition',
        timestamp: new Date(),
        partitionInfo
      }));
      
      // Handle as concurrent disconnections
      const concurrentResult = await this.handleConcurrentDisconnections(disconnectionEvents);
      
      // Log the network partition event
      gameDoc.reconnectionEvents.push({
        eventType: 'DISCONNECT',
        playerId: 'system',
        reason: 'network_partition',
        metadata: {
          affectedPlayers: affectedPlayerIds,
          partitionInfo,
          concurrentResult: {
            concurrentEventId: concurrentResult.concurrentEventId,
            successfulProcessing: concurrentResult.successfulProcessing,
            failedProcessing: concurrentResult.failedProcessing
          }
        }
      });
      
      await gameDoc.save();
      
      console.log(`✅ Network partition handled for game ${gameId}`);
      
      return {
        success: true,
        gameId,
        affectedPlayers: affectedPlayerIds.length,
        partitionInfo,
        concurrentResult,
        handledAt: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Failed to handle network partition for game ${gameId}:`, error.message);
      return {
        success: false,
        reason: 'partition_handling_error',
        error: error.message,
        gameId,
        affectedPlayers: affectedPlayerIds.length,
        handledAt: new Date()
      };
    }
  }

  /**
   * Clean up reconnection handler resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Reconnection Handler...');
    
    this.reconnectionAttempts.clear();
    this.stateValidationCache.clear();
    
    console.log('✅ Reconnection Handler cleanup complete');
  }

  /**
   * Get status information for monitoring
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      activeReconnectionAttempts: this.reconnectionAttempts.size,
      cachedValidations: this.stateValidationCache.size,
      totalAttempts: Array.from(this.reconnectionAttempts.values())
        .reduce((sum, info) => sum + info.attempts, 0)
    };
  }
}

// Export singleton instance
const reconnectionHandler = new ReconnectionHandler();

module.exports = reconnectionHandler;