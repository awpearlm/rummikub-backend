/**
 * Turn Timer Manager
 * Handles timer preservation, restoration, and synchronization across pause/resume cycles
 * Requirements: 1.2, 5.1, 5.2, 5.3, 5.4, 5.5
 */

const Game = require('../models/Game');

class TurnTimerManager {
  constructor() {
    this.activeTimers = new Map(); // gameId -> timer info
    this.preservedTimers = new Map(); // gameId -> preserved timer state
    this.config = {
      defaultTurnDuration: 120000, // 2 minutes in milliseconds
      timerSyncInterval: 1000, // 1 second
      preservationAccuracy: 100 // milliseconds accuracy for preservation
    };
    
    console.log('⏰ Turn Timer Manager initialized');
  }

  /**
   * Preserve current timer state when pausing
   * Requirements: 1.2, 5.1
   * @param {string} gameId - The game ID
   * @param {string} playerId - Player whose turn is being preserved
   * @param {number} remainingTime - Remaining time in milliseconds
   * @param {Date} turnStartTime - When the turn started
   * @returns {Promise<Object>} - Preservation result
   */
  async preserveTimer(gameId, playerId, remainingTime, turnStartTime = null) {
    try {
      console.log(`⏰ Preserving timer for game ${gameId}, player: ${playerId}, remaining: ${remainingTime}ms`);
      
      // Validate inputs
      if (typeof remainingTime !== 'number' || remainingTime < 0) {
        throw new Error(`Invalid remaining time: ${remainingTime}`);
      }

      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Calculate precise remaining time if turn start time is provided
      let preciseRemainingTime = remainingTime;
      if (turnStartTime) {
        const elapsed = Date.now() - new Date(turnStartTime).getTime();
        const originalDuration = gameDoc.turnTimer.originalDuration || this.config.defaultTurnDuration;
        preciseRemainingTime = Math.max(0, originalDuration - elapsed);
      }

      // Create preserved timer state
      const preservedState = {
        gameId,
        playerId,
        remainingTime: preciseRemainingTime,
        originalDuration: gameDoc.turnTimer.originalDuration || this.config.defaultTurnDuration,
        pausedAt: new Date(),
        turnStartTime: turnStartTime ? new Date(turnStartTime) : null,
        preservedAt: new Date()
      };

      // Update game document with preserved timer state
      gameDoc.turnTimer.remainingTime = preciseRemainingTime;
      gameDoc.turnTimer.pausedAt = new Date();
      if (!gameDoc.turnTimer.originalDuration) {
        gameDoc.turnTimer.originalDuration = this.config.defaultTurnDuration;
      }

      // Save to database
      await gameDoc.save();

      // Store in memory for quick access
      this.preservedTimers.set(gameId, preservedState);

      // Clear any active timer for this game
      this.clearActiveTimer(gameId);

      console.log(`✅ Timer preserved for game ${gameId} - Remaining: ${preciseRemainingTime}ms`);
      
      return {
        success: true,
        gameId,
        playerId,
        remainingTime: preciseRemainingTime,
        originalDuration: preservedState.originalDuration,
        pausedAt: preservedState.pausedAt,
        preservationAccuracy: this.config.preservationAccuracy
      };

    } catch (error) {
      console.error(`❌ Failed to preserve timer for game ${gameId}:`, error.message);
      throw new Error(`Timer preservation failed: ${error.message}`);
    }
  }

  /**
   * Restore timer state when resuming
   * Requirements: 1.2, 5.2
   * @param {string} gameId - The game ID
   * @param {string} playerId - Player whose turn is being restored
   * @param {number} preservedTime - Previously preserved time in milliseconds
   * @returns {Promise<Object>} - Restoration result
   */
  async restoreTimer(gameId, playerId, preservedTime = null) {
    try {
      console.log(`⏰ Restoring timer for game ${gameId}, player: ${playerId}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Get preserved timer state
      let restoredTime = preservedTime;
      let originalDuration = this.config.defaultTurnDuration;

      // Try to get from memory first
      const preservedState = this.preservedTimers.get(gameId);
      if (preservedState) {
        restoredTime = preservedState.remainingTime;
        originalDuration = preservedState.originalDuration;
        console.log(`📋 Using preserved state from memory: ${restoredTime}ms`);
      } 
      // Fall back to database state
      else if (gameDoc.turnTimer.remainingTime !== null) {
        restoredTime = gameDoc.turnTimer.remainingTime;
        originalDuration = gameDoc.turnTimer.originalDuration || this.config.defaultTurnDuration;
        console.log(`💾 Using preserved state from database: ${restoredTime}ms`);
      }
      // Default to full duration if no preserved state
      else if (restoredTime === null) {
        restoredTime = originalDuration;
        console.log(`🔄 No preserved state found, using full duration: ${restoredTime}ms`);
      }

      // Validate restored time
      if (typeof restoredTime !== 'number' || restoredTime < 0) {
        console.warn(`⚠️ Invalid restored time ${restoredTime}, using default`);
        restoredTime = originalDuration;
      }

      // Update game document
      gameDoc.turnTimer.remainingTime = restoredTime;
      gameDoc.turnTimer.pausedAt = null;
      gameDoc.turnTimer.originalDuration = originalDuration;

      // Save to database
      await gameDoc.save();

      // Create active timer state
      const timerState = {
        gameId,
        playerId,
        remainingTime: restoredTime,
        originalDuration,
        startTime: new Date(),
        restoredAt: new Date(),
        isActive: true
      };

      // Store active timer
      this.activeTimers.set(gameId, timerState);

      // Clean up preserved state
      this.preservedTimers.delete(gameId);

      console.log(`✅ Timer restored for game ${gameId} - Remaining: ${restoredTime}ms`);
      
      return {
        success: true,
        gameId,
        playerId,
        remainingTime: restoredTime,
        originalDuration,
        restoredAt: timerState.restoredAt,
        isActive: true
      };

    } catch (error) {
      console.error(`❌ Failed to restore timer for game ${gameId}:`, error.message);
      throw new Error(`Timer restoration failed: ${error.message}`);
    }
  }

  /**
   * Reset timer for next player if current player is skipped
   * Requirements: 5.4
   * @param {string} gameId - The game ID
   * @param {string} nextPlayerId - Next player ID
   * @param {number} duration - Timer duration in milliseconds (optional)
   * @returns {Promise<Object>} - Reset result
   */
  async resetTimerForNextPlayer(gameId, nextPlayerId, duration = null) {
    try {
      console.log(`🔄 Resetting timer for next player in game ${gameId}: ${nextPlayerId}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Determine timer duration
      const timerDuration = duration || 
        gameDoc.turnTimer.originalDuration || 
        this.config.defaultTurnDuration;

      // Update game document with fresh timer
      gameDoc.turnTimer.remainingTime = timerDuration;
      gameDoc.turnTimer.pausedAt = null;
      gameDoc.turnTimer.originalDuration = timerDuration;

      // Save to database
      await gameDoc.save();

      // Clear any preserved state for this game
      this.preservedTimers.delete(gameId);

      // Create new active timer state
      const timerState = {
        gameId,
        playerId: nextPlayerId,
        remainingTime: timerDuration,
        originalDuration: timerDuration,
        startTime: new Date(),
        resetAt: new Date(),
        isActive: true,
        isReset: true
      };

      // Store active timer
      this.activeTimers.set(gameId, timerState);

      console.log(`✅ Timer reset for game ${gameId}, next player: ${nextPlayerId} - Duration: ${timerDuration}ms`);
      
      return {
        success: true,
        gameId,
        nextPlayerId,
        duration: timerDuration,
        resetAt: timerState.resetAt,
        isActive: true
      };

    } catch (error) {
      console.error(`❌ Failed to reset timer for game ${gameId}:`, error.message);
      throw new Error(`Timer reset failed: ${error.message}`);
    }
  }

  /**
   * Get current timer state for a game
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Timer state or null
   */
  async getTimerState(gameId) {
    try {
      // Check active timers first
      const activeTimer = this.activeTimers.get(gameId);
      if (activeTimer) {
        // Calculate current remaining time
        const elapsed = Date.now() - activeTimer.startTime.getTime();
        const currentRemaining = Math.max(0, activeTimer.remainingTime - elapsed);
        
        return {
          ...activeTimer,
          currentRemainingTime: currentRemaining,
          elapsedTime: elapsed,
          isExpired: currentRemaining <= 0
        };
      }

      // Check preserved timers
      const preservedTimer = this.preservedTimers.get(gameId);
      if (preservedTimer) {
        return {
          ...preservedTimer,
          currentRemainingTime: preservedTimer.remainingTime,
          isPreserved: true,
          isActive: false
        };
      }

      // Check database
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        return null;
      }

      return {
        gameId,
        remainingTime: gameDoc.turnTimer.remainingTime,
        originalDuration: gameDoc.turnTimer.originalDuration,
        pausedAt: gameDoc.turnTimer.pausedAt,
        isActive: false,
        isPaused: gameDoc.turnTimer.pausedAt !== null,
        fromDatabase: true
      };

    } catch (error) {
      console.error(`❌ Failed to get timer state for game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if timer is currently preserved for a game
   * @param {string} gameId - The game ID
   * @returns {boolean} - True if timer is preserved
   */
  isTimerPreserved(gameId) {
    return this.preservedTimers.has(gameId);
  }

  /**
   * Check if timer is currently active for a game
   * @param {string} gameId - The game ID
   * @returns {boolean} - True if timer is active
   */
  isTimerActive(gameId) {
    const activeTimer = this.activeTimers.get(gameId);
    return !!(activeTimer && activeTimer.isActive);
  }

  /**
   * Get preserved timer state for a game
   * @param {string} gameId - The game ID
   * @returns {Object|null} - Preserved timer state or null
   */
  getPreservedTimerState(gameId) {
    return this.preservedTimers.get(gameId) || null;
  }

  /**
   * Clear active timer for a game
   * @param {string} gameId - The game ID
   */
  clearActiveTimer(gameId) {
    const activeTimer = this.activeTimers.get(gameId);
    if (activeTimer) {
      activeTimer.isActive = false;
      this.activeTimers.delete(gameId);
      console.log(`🧹 Active timer cleared for game ${gameId}`);
    }
  }

  /**
   * Clear preserved timer state for a game
   * @param {string} gameId - The game ID
   */
  clearPreservedTimer(gameId) {
    const preservedTimer = this.preservedTimers.get(gameId);
    if (preservedTimer) {
      this.preservedTimers.delete(gameId);
      console.log(`🧹 Preserved timer cleared for game ${gameId}`);
    }
  }

  /**
   * Clear all timer state for a game
   * @param {string} gameId - The game ID
   */
  clearAllTimerState(gameId) {
    this.clearActiveTimer(gameId);
    this.clearPreservedTimer(gameId);
    console.log(`🧹 All timer state cleared for game ${gameId}`);
  }

  /**
   * Get timer statistics for monitoring
   * @returns {Object} - Timer statistics
   */
  getTimerStatistics() {
    return {
      activeTimers: this.activeTimers.size,
      preservedTimers: this.preservedTimers.size,
      totalGames: this.activeTimers.size + this.preservedTimers.size,
      config: this.config,
      timestamp: new Date()
    };
  }

  /**
   * Validate timer state consistency
   * @param {string} gameId - The game ID
   * @returns {Promise<Object>} - Validation result
   */
  async validateTimerState(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        return { valid: false, reason: 'game_not_found' };
      }

      const activeTimer = this.activeTimers.get(gameId);
      const preservedTimer = this.preservedTimers.get(gameId);
      const dbTimer = gameDoc.turnTimer;

      // Check for consistency issues
      const issues = [];

      // Both active and preserved should not exist simultaneously
      if (activeTimer && preservedTimer) {
        issues.push('Both active and preserved timers exist');
      }

      // Database state should match memory state
      if (preservedTimer && dbTimer.remainingTime !== preservedTimer.remainingTime) {
        issues.push('Database and preserved timer mismatch');
      }

      // Active timer should not exist if game is paused
      if (activeTimer && gameDoc.isPaused) {
        issues.push('Active timer exists while game is paused');
      }

      // Preserved timer should exist if game is paused with timer
      if (gameDoc.isPaused && dbTimer.remainingTime !== null && !preservedTimer) {
        issues.push('Game paused with timer but no preserved state');
      }

      return {
        valid: issues.length === 0,
        issues,
        state: {
          hasActiveTimer: !!activeTimer,
          hasPreservedTimer: !!preservedTimer,
          gameIsPaused: gameDoc.isPaused,
          dbRemainingTime: dbTimer.remainingTime,
          dbPausedAt: dbTimer.pausedAt
        }
      };

    } catch (error) {
      console.error(`❌ Failed to validate timer state for game ${gameId}:`, error.message);
      return { valid: false, reason: 'validation_error', error: error.message };
    }
  }

  /**
   * Pause timer during grace period countdown
   * Requirements: 5.3
   * @param {string} gameId - The game ID
   * @param {number} gracePeriodDuration - Grace period duration in milliseconds
   * @returns {Promise<Object>} - Pause result
   */
  async pauseTimerForGracePeriod(gameId, gracePeriodDuration) {
    try {
      console.log(`⏸️ Pausing timer for grace period in game ${gameId} - Duration: ${gracePeriodDuration}ms`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Get current timer state
      const activeTimer = this.activeTimers.get(gameId);
      let currentRemainingTime = gameDoc.turnTimer.remainingTime;

      // If there's an active timer, calculate current remaining time
      if (activeTimer && activeTimer.isActive) {
        const elapsed = Date.now() - activeTimer.startTime.getTime();
        currentRemainingTime = Math.max(0, activeTimer.remainingTime - elapsed);
      }

      // Preserve the current timer state
      if (currentRemainingTime !== null && currentRemainingTime >= 0) {
        const preservedState = {
          gameId,
          playerId: activeTimer ? activeTimer.playerId : 'unknown',
          remainingTime: currentRemainingTime,
          originalDuration: gameDoc.turnTimer.originalDuration || this.config.defaultTurnDuration,
          pausedAt: new Date(),
          pausedForGracePeriod: true,
          gracePeriodDuration,
          preservedAt: new Date()
        };

        // Update database
        gameDoc.turnTimer.remainingTime = currentRemainingTime;
        gameDoc.turnTimer.pausedAt = new Date();
        await gameDoc.save();

        // Store preserved state
        this.preservedTimers.set(gameId, preservedState);

        // Clear active timer
        this.clearActiveTimer(gameId);

        console.log(`✅ Timer paused for grace period in game ${gameId} - Remaining: ${currentRemainingTime}ms`);
        
        return {
          success: true,
          gameId,
          remainingTime: currentRemainingTime,
          gracePeriodDuration,
          pausedAt: preservedState.pausedAt
        };
      } else {
        console.log(`⚠️ No active timer to pause for grace period in game ${gameId}`);
        return {
          success: false,
          reason: 'no_active_timer',
          gameId
        };
      }

    } catch (error) {
      console.error(`❌ Failed to pause timer for grace period in game ${gameId}:`, error.message);
      throw new Error(`Grace period timer pause failed: ${error.message}`);
    }
  }

  /**
   * Continue timer for bot replacement scenarios
   * Requirements: 5.5
   * @param {string} gameId - The game ID
   * @param {string} botPlayerId - Bot player ID
   * @param {number} preservedTime - Previously preserved time (optional)
   * @returns {Promise<Object>} - Continuation result
   */
  async continueTimerForBot(gameId, botPlayerId, preservedTime = null) {
    try {
      console.log(`🤖 Continuing timer for bot replacement in game ${gameId}: ${botPlayerId}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Get preserved timer state
      let restoredTime = preservedTime;
      let originalDuration = this.config.defaultTurnDuration;

      // Try to get from preserved state
      const preservedState = this.preservedTimers.get(gameId);
      if (preservedState) {
        restoredTime = preservedState.remainingTime;
        originalDuration = preservedState.originalDuration;
        console.log(`📋 Using preserved state for bot: ${restoredTime}ms`);
      } 
      // Fall back to database state
      else if (gameDoc.turnTimer.remainingTime !== null) {
        restoredTime = gameDoc.turnTimer.remainingTime;
        originalDuration = gameDoc.turnTimer.originalDuration || this.config.defaultTurnDuration;
        console.log(`💾 Using database state for bot: ${restoredTime}ms`);
      }
      // Default to full duration if no preserved state
      else if (restoredTime === null) {
        restoredTime = originalDuration;
        console.log(`🔄 No preserved state found for bot, using full duration: ${restoredTime}ms`);
      }

      // Validate restored time
      if (typeof restoredTime !== 'number' || restoredTime < 0) {
        console.warn(`⚠️ Invalid restored time ${restoredTime} for bot, using default`);
        restoredTime = originalDuration;
      }

      // Update game document
      gameDoc.turnTimer.remainingTime = restoredTime;
      gameDoc.turnTimer.pausedAt = null;
      gameDoc.turnTimer.originalDuration = originalDuration;
      await gameDoc.save();

      // Create active timer state for bot
      const timerState = {
        gameId,
        playerId: botPlayerId,
        remainingTime: restoredTime,
        originalDuration,
        startTime: new Date(),
        restoredAt: new Date(),
        isActive: true,
        isBot: true,
        continuedFromPreserved: !!preservedState
      };

      // Store active timer
      this.activeTimers.set(gameId, timerState);

      // Clean up preserved state
      this.preservedTimers.delete(gameId);

      console.log(`✅ Timer continued for bot in game ${gameId} - Remaining: ${restoredTime}ms`);
      
      return {
        success: true,
        gameId,
        botPlayerId,
        remainingTime: restoredTime,
        originalDuration,
        restoredAt: timerState.restoredAt,
        isActive: true,
        continuedFromPreserved: timerState.continuedFromPreserved
      };

    } catch (error) {
      console.error(`❌ Failed to continue timer for bot in game ${gameId}:`, error.message);
      throw new Error(`Bot timer continuation failed: ${error.message}`);
    }
  }

  /**
   * Synchronize timer across all clients
   * Requirements: 5.3, 5.5
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Synchronization data or null
   */
  async synchronizeTimer(gameId) {
    try {
      // Get current timer state
      const timerState = await this.getTimerState(gameId);
      if (!timerState) {
        return null;
      }

      // Find the game document for additional context
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        return null;
      }

      // Prepare synchronization data
      const syncData = {
        gameId,
        timestamp: new Date(),
        timerState: {
          remainingTime: timerState.currentRemainingTime || timerState.remainingTime,
          originalDuration: timerState.originalDuration,
          isActive: timerState.isActive,
          isPaused: timerState.isPaused || gameDoc.isPaused,
          playerId: timerState.playerId
        },
        gameState: {
          isPaused: gameDoc.isPaused,
          pauseReason: gameDoc.pauseReason,
          gracePeriodActive: gameDoc.gracePeriod.isActive,
          gracePeriodRemaining: gameDoc.gracePeriod.isActive ? 
            gameDoc.getGracePeriodTimeRemaining() : 0
        }
      };

      console.log(`🔄 Timer synchronized for game ${gameId} - Remaining: ${syncData.timerState.remainingTime}ms`);
      
      return syncData;

    } catch (error) {
      console.error(`❌ Failed to synchronize timer for game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if timer should remain paused during grace period
   * Requirements: 5.3
   * @param {string} gameId - The game ID
   * @returns {Promise<boolean>} - True if timer should remain paused
   */
  async shouldTimerRemainPaused(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        return false;
      }

      // Timer should remain paused if:
      // 1. Game is paused
      // 2. Grace period is active
      // 3. Timer is explicitly preserved
      const shouldPause = gameDoc.isPaused || 
                         gameDoc.gracePeriod.isActive || 
                         this.isTimerPreserved(gameId);

      return shouldPause;

    } catch (error) {
      console.error(`❌ Failed to check timer pause status for game ${gameId}:`, error.message);
      return true; // Default to paused on error for safety
    }
  }

  /**
   * Get grace period timer behavior status
   * Requirements: 5.3
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Grace period timer status
   */
  async getGracePeriodTimerStatus(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        return null;
      }

      const timerState = await this.getTimerState(gameId);
      const shouldRemainPaused = await this.shouldTimerRemainPaused(gameId);

      return {
        gameId,
        gracePeriodActive: gameDoc.gracePeriod.isActive,
        gracePeriodRemaining: gameDoc.gracePeriod.isActive ? 
          gameDoc.getGracePeriodTimeRemaining() : 0,
        timerPaused: shouldRemainPaused,
        timerPreserved: this.isTimerPreserved(gameId),
        timerActive: this.isTimerActive(gameId),
        preservedTime: timerState ? timerState.remainingTime : null,
        targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ Failed to get grace period timer status for game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Handle timer behavior when grace period expires
   * Requirements: 5.3
   * @param {string} gameId - The game ID
   * @param {string} continuationDecision - The continuation decision ('skip_turn', 'add_bot', 'end_game')
   * @returns {Promise<Object>} - Expiration handling result
   */
  async handleGracePeriodExpiration(gameId, continuationDecision) {
    try {
      console.log(`⏰ Handling grace period expiration for game ${gameId} - Decision: ${continuationDecision}`);
      
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      let result = { success: true, gameId, decision: continuationDecision };

      switch (continuationDecision) {
        case 'skip_turn':
          // Reset timer for next player
          const nextPlayerIndex = (gameDoc.gameState.currentPlayerIndex + 1) % gameDoc.players.length;
          const nextPlayer = gameDoc.players[nextPlayerIndex];
          const nextPlayerId = nextPlayer.name || nextPlayer.userId;
          
          result.action = await this.resetTimerForNextPlayer(gameId, nextPlayerId);
          break;

        case 'add_bot':
          // Continue timer for bot player
          const botPlayerId = `Bot_${Math.random().toString(36).substring(2, 5)}`;
          result.action = await this.continueTimerForBot(gameId, botPlayerId);
          break;

        case 'end_game':
          // Clear all timer state
          this.clearAllTimerState(gameId);
          result.action = { type: 'timer_cleared', message: 'All timer state cleared for ended game' };
          break;

        default:
          throw new Error(`Unknown continuation decision: ${continuationDecision}`);
      }

      console.log(`✅ Grace period expiration handled for game ${gameId} - Decision: ${continuationDecision}`);
      
      return result;

    } catch (error) {
      console.error(`❌ Failed to handle grace period expiration for game ${gameId}:`, error.message);
      throw new Error(`Grace period expiration handling failed: ${error.message}`);
    }
  }

  /**
   * Shutdown the timer manager and clean up resources
   */
  shutdown() {
    console.log('🔧 Shutting down Turn Timer Manager...');
    
    // Clear all active timers
    this.activeTimers.clear();
    
    // Clear all preserved timers
    this.preservedTimers.clear();
    
    console.log('✅ Turn Timer Manager shutdown complete');
  }
}

// Export singleton instance
const turnTimerManager = new TurnTimerManager();

module.exports = turnTimerManager;