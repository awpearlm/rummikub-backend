/**
 * Game Pause Controller
 * Manages game pause state, grace periods, continuation decisions, and game lifecycle
 * Requirements: 1.1, 1.4, 3.1, 3.5, 4.2, 4.3, 4.4, 4.5, 7.3
 */

const Game = require('../models/Game');
const analyticsLogger = require('./analyticsLogger');

class GamePauseController {
  constructor() {
    this.gracePeriodTimers = new Map(); // gameId -> timer
    this.pausedGames = new Map(); // gameId -> pause info
    this.notificationBroadcaster = null; // Will be set by server
  }

  /**
   * Set the notification broadcaster instance
   * @param {NotificationBroadcaster} broadcaster - The notification broadcaster
   */
  setNotificationBroadcaster(broadcaster) {
    this.notificationBroadcaster = broadcaster;
  }

  /**
   * Pause game with specific reason and affected player
   * Requirements: 1.1, 1.4
   * @param {string} gameId - The game ID
   * @param {string} reason - Pause reason
   * @param {string} playerId - Player who caused the pause
   * @param {Object} preservedState - State to preserve (timer, etc.)
   * @returns {Promise<Object>} - Pause result
   */
  async pauseGame(gameId, reason, playerId, preservedState = {}) {
    try {
      console.log(`⏸️  Pausing game ${gameId} - Reason: ${reason}, Player: ${playerId}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Check if game is already paused
      if (gameDoc.isPaused) {
        console.log(`⚠️  Game ${gameId} is already paused`);
        return { success: false, reason: 'already_paused' };
      }

      // Pause the game using the model method
      gameDoc.pauseGame(reason, playerId, preservedState);
      
      // Save to database
      await gameDoc.save();

      // Store pause info in memory for quick access
      this.pausedGames.set(gameId, {
        reason,
        playerId,
        pausedAt: new Date(),
        preservedState
      });

      // Log pause event for analytics
      analyticsLogger.logPauseEvent({
        gameId,
        pauseType: 'start',
        reason,
        playerId,
        currentPlayerIndex: gameDoc.gameState.currentPlayerIndex,
        turnNumber: gameDoc.gameState.turnNumber || 0,
        playerCount: gameDoc.players.length,
        timerRemaining: preservedState.remainingTime || 0,
        metadata: {
          preservedState: Object.keys(preservedState)
        }
      });

      console.log(`✅ Game ${gameId} paused successfully`);
      
      // Broadcast pause notification
      if (this.notificationBroadcaster) {
        this.notificationBroadcaster.broadcastGamePaused(gameId, {
          reason,
          playerName: playerId, // TODO: Get actual player name
          playerId,
          pausedAt: gameDoc.pausedAt
        });
      }
      
      return {
        success: true,
        pausedAt: gameDoc.pausedAt,
        reason: gameDoc.pauseReason,
        playerId: gameDoc.pausedBy
      };

    } catch (error) {
      console.error(`❌ Failed to pause game ${gameId}:`, error.message);
      throw new Error(`Game pause failed: ${error.message}`);
    }
  }

  /**
   * Resume game after successful reconnection
   * Requirements: 1.1, 1.4
   * @param {string} gameId - The game ID
   * @param {string} playerId - Player who reconnected
   * @param {Object} restoredState - State to restore
   * @returns {Promise<Object>} - Resume result
   */
  async resumeGame(gameId, playerId, restoredState = {}) {
    try {
      console.log(`▶️  Resuming game ${gameId} - Player: ${playerId}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Check if game is actually paused
      if (!gameDoc.isPaused) {
        console.log(`⚠️  Game ${gameId} is not paused`);
        return { success: false, reason: 'not_paused' };
      }

      // Clear any active grace period timer
      this.clearGracePeriodTimer(gameId);

      // Resume the game using the model method
      gameDoc.resumeGame(playerId, restoredState);
      
      // Save to database
      await gameDoc.save();

      // Remove from paused games memory
      this.pausedGames.delete(gameId);

      // Log pause end event for analytics
      const pauseDuration = new Date() - new Date(gameDoc.pausedAt);
      analyticsLogger.logPauseEvent({
        gameId,
        pauseType: 'end',
        reason: 'resumed',
        playerId,
        duration: pauseDuration,
        currentPlayerIndex: gameDoc.gameState.currentPlayerIndex,
        turnNumber: gameDoc.gameState.turnNumber || 0,
        playerCount: gameDoc.players.length,
        metadata: {
          restoredState: Object.keys(restoredState)
        }
      });

      console.log(`✅ Game ${gameId} resumed successfully`);
      
      // Broadcast resume notification
      if (this.notificationBroadcaster) {
        const pauseDuration = new Date() - new Date(gameDoc.pausedAt);
        this.notificationBroadcaster.broadcastGameResumed(gameId, {
          playerName: playerId, // TODO: Get actual player name
          playerId,
          resumedAt: new Date(),
          pauseDuration
        });
        
        // Also send welcome back message
        this.notificationBroadcaster.broadcastWelcomeBack(gameId, {
          playerName: playerId, // TODO: Get actual player name
          playerId,
          disconnectedDuration: pauseDuration,
          isCurrentPlayer: true // TODO: Check if this is the current player
        });
      }
      
      return {
        success: true,
        resumedAt: new Date(),
        playerId,
        restoredState
      };

    } catch (error) {
      console.error(`❌ Failed to resume game ${gameId}:`, error.message);
      throw new Error(`Game resume failed: ${error.message}`);
    }
  }

  /**
   * Start grace period for disconnected player
   * Requirements: 3.1, 3.5, 7.3
   * @param {string} gameId - The game ID
   * @param {string} playerId - Disconnected player ID
   * @param {Object} connectionMetrics - Connection quality metrics
   * @returns {Promise<Object>} - Grace period result
   */
  async startGracePeriod(gameId, playerId, connectionMetrics = {}) {
    try {
      console.log(`⏳ Starting grace period for game ${gameId}, player: ${playerId}`);
      
      // Determine grace period duration based on connection quality
      const duration = this.calculateGracePeriodDuration(connectionMetrics);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Start grace period using model method
      gameDoc.startGracePeriod(playerId, duration);
      
      // Save to database
      await gameDoc.save();

      // Set up grace period timer
      this.setGracePeriodTimer(gameId, duration);

      // Log grace period start event for analytics
      analyticsLogger.logGracePeriodEvent({
        gameId,
        gracePeriodType: 'start',
        targetPlayerId: playerId,
        duration,
        connectionQuality: connectionMetrics.connectionQuality || 'unknown',
        isMobile: connectionMetrics.isMobile || false,
        networkType: connectionMetrics.networkType || 'unknown',
        isExtended: duration > 180000, // Extended if more than 3 minutes
        metadata: {
          connectionMetrics
        }
      });

      console.log(`✅ Grace period started for game ${gameId} - Duration: ${duration}ms`);
      
      // Start grace period notifications
      if (this.notificationBroadcaster) {
        this.notificationBroadcaster.startGracePeriodUpdates(gameId, {
          targetPlayerName: playerId, // TODO: Get actual player name
          targetPlayerId: playerId,
          duration,
          startTime: gameDoc.gracePeriod.startTime
        });
      }
      
      return {
        success: true,
        duration,
        startTime: gameDoc.gracePeriod.startTime,
        targetPlayerId: playerId
      };

    } catch (error) {
      console.error(`❌ Failed to start grace period for game ${gameId}:`, error.message);
      throw new Error(`Grace period start failed: ${error.message}`);
    }
  }

  /**
   * Handle grace period expiration
   * Requirements: 3.5, 4.1
   * @param {string} gameId - The game ID
   * @returns {Promise<Object>} - Expiration result
   */
  async handleGracePeriodExpired(gameId) {
    try {
      console.log(`⏰ Grace period expired for game ${gameId}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Check if grace period is actually active
      if (!gameDoc.gracePeriod.isActive) {
        console.log(`⚠️  Grace period not active for game ${gameId}`);
        return { success: false, reason: 'grace_period_not_active' };
      }

      // Present continuation options
      gameDoc.presentContinuationOptions();
      
      // Log the expiration event
      gameDoc.reconnectionEvents.push({
        eventType: 'GRACE_PERIOD_EXPIRE',
        playerId: gameDoc.gracePeriod.targetPlayerId,
        metadata: { 
          duration: gameDoc.gracePeriod.duration,
          startTime: gameDoc.gracePeriod.startTime
        }
      });

      // Save to database
      await gameDoc.save();

      // Clear the timer
      this.clearGracePeriodTimer(gameId);

      // Log grace period expiration event for analytics
      analyticsLogger.logGracePeriodEvent({
        gameId,
        gracePeriodType: 'expired',
        targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
        duration: gameDoc.gracePeriod.duration,
        timeRemaining: 0,
        outcome: 'expired',
        metadata: {
          gracePeriodStartTime: gameDoc.gracePeriod.startTime
        }
      });

      console.log(`✅ Grace period expired for game ${gameId}, continuation options presented`);
      
      // Broadcast grace period expiration and continuation options
      if (this.notificationBroadcaster) {
        this.notificationBroadcaster.broadcastGracePeriodExpired(gameId, {
          targetPlayerName: gameDoc.gracePeriod.targetPlayerId, // TODO: Get actual player name
          targetPlayerId: gameDoc.gracePeriod.targetPlayerId
        });
        
        this.notificationBroadcaster.broadcastContinuationOptions(gameId, {
          options: gameDoc.continuationOptions.options,
          targetPlayerName: gameDoc.gracePeriod.targetPlayerId, // TODO: Get actual player name
          targetPlayerId: gameDoc.gracePeriod.targetPlayerId
        });
      }
      
      return {
        success: true,
        expiredAt: new Date(),
        targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
        continuationOptions: gameDoc.continuationOptions.options
      };

    } catch (error) {
      console.error(`❌ Failed to handle grace period expiration for game ${gameId}:`, error.message);
      throw new Error(`Grace period expiration handling failed: ${error.message}`);
    }
  }

  /**
   * Add a vote for continuation decision
   * Requirements: 4.2, 4.3, 4.4, 4.5
   * @param {string} gameId - The game ID
   * @param {string} playerId - Player casting the vote
   * @param {string} choice - The vote choice ('skip_turn', 'add_bot', 'end_game')
   * @returns {Promise<Object>} - Vote result
   */
  async addContinuationVote(gameId, playerId, choice) {
    try {
      console.log(`🗳️ Adding continuation vote from ${playerId} for game ${gameId}: ${choice}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Check if continuation options are presented
      if (!gameDoc.continuationOptions.presented) {
        throw new Error('Continuation options not available');
      }

      // Validate choice
      const validChoices = ['skip_turn', 'add_bot', 'end_game'];
      if (!validChoices.includes(choice)) {
        throw new Error(`Invalid choice: ${choice}`);
      }

      // Add the vote using the model method
      gameDoc.addContinuationVote(playerId, choice);
      
      // Save to database
      await gameDoc.save();

      // Check if we have enough votes to make a decision
      const totalPlayers = gameDoc.players.filter(p => !p.isBot).length;
      const totalVotes = gameDoc.continuationOptions.votes.length;
      
      // For now, we'll process the decision immediately with the first vote
      // In a real implementation, you might want to wait for majority or all votes
      const decision = this.determineContinuationDecision(gameDoc.continuationOptions.votes);
      
      console.log(`✅ Vote added for game ${gameId}. Decision: ${decision}`);
      
      // Broadcast voting progress
      if (this.notificationBroadcaster) {
        this.notificationBroadcaster.broadcastVotingProgress(gameId, {
          voterName: playerId, // TODO: Get actual player name
          choice,
          totalVotes,
          totalPlayers,
          voteCounts: this.getVoteCounts(gameDoc.continuationOptions.votes)
        });
      }
      
      return {
        success: true,
        playerId,
        choice,
        totalVotes,
        totalPlayers,
        decision: decision,
        readyToProcess: totalVotes >= 1 // Process immediately for now
      };

    } catch (error) {
      console.error(`❌ Failed to add continuation vote for game ${gameId}:`, error.message);
      throw new Error(`Continuation vote failed: ${error.message}`);
    }
  }

  /**
   * Get vote counts by option
   * @param {Array} votes - Array of vote objects
   * @returns {Object} - Vote counts by option
   */
  getVoteCounts(votes) {
    const voteCounts = {
      skip_turn: 0,
      add_bot: 0,
      end_game: 0
    };
    
    votes.forEach(vote => {
      if (voteCounts.hasOwnProperty(vote.choice)) {
        voteCounts[vote.choice]++;
      }
    });
    
    return voteCounts;
  }

  /**
   * Determine the continuation decision based on votes
   * @param {Array} votes - Array of vote objects
   * @returns {string} - The decided choice
   */
  determineContinuationDecision(votes) {
    if (votes.length === 0) {
      return 'skip_turn'; // Default decision
    }
    
    // Count votes for each option
    const voteCounts = {
      skip_turn: 0,
      add_bot: 0,
      end_game: 0
    };
    
    votes.forEach(vote => {
      if (voteCounts.hasOwnProperty(vote.choice)) {
        voteCounts[vote.choice]++;
      }
    });
    
    // Find the option with the most votes
    let maxVotes = 0;
    let decision = 'skip_turn';
    
    for (const [choice, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        decision = choice;
      }
    }
    
    return decision;
  }

  /**
   * Process continuation decision from remaining players
   * Requirements: 4.2, 4.3, 4.4, 4.5
   * @param {string} gameId - The game ID
   * @param {string} decision - The chosen decision ('skip_turn', 'add_bot', 'end_game')
   * @param {Array} votes - Array of player votes
   * @returns {Promise<Object>} - Decision result
   */
  async processContinuationDecision(gameId, decision, votes = []) {
    try {
      console.log(`🗳️  Processing continuation decision for game ${gameId}: ${decision}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        throw new Error(`Game ${gameId} not found`);
      }

      // Validate decision
      const validDecisions = ['skip_turn', 'add_bot', 'end_game'];
      if (!validDecisions.includes(decision)) {
        throw new Error(`Invalid continuation decision: ${decision}`);
      }

      // Log the decision event
      gameDoc.reconnectionEvents.push({
        eventType: 'CONTINUATION_DECISION',
        playerId: 'system',
        metadata: { 
          decision,
          votes: votes.length,
          targetPlayerId: gameDoc.gracePeriod.targetPlayerId
        }
      });

      let result = { success: true, decision, action: null };

      // Execute the decision
      switch (decision) {
        case 'skip_turn':
          result.action = await this.executeSkipTurn(gameDoc);
          break;
        case 'add_bot':
          result.action = await this.executeAddBot(gameDoc);
          break;
        case 'end_game':
          result.action = await this.executeEndGame(gameDoc);
          break;
      }

      // Clear continuation options and grace period
      gameDoc.continuationOptions.presented = false;
      gameDoc.gracePeriod.isActive = false;
      
      // Resume the game if not ended
      if (decision !== 'end_game') {
        gameDoc.resumeGame('system', { continuationDecision: decision });
      }

      // Save to database
      await gameDoc.save();

      // Log continuation decision event for analytics
      analyticsLogger.logContinuationEvent({
        gameId,
        decision,
        targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
        totalVotes: votes.length,
        totalPlayers: gameDoc.players.filter(p => !p.isBot).length,
        voteCounts: this.getVoteCounts(votes),
        turnNumber: gameDoc.gameState.turnNumber || 0,
        playerCount: gameDoc.players.length,
        remainingPlayers: gameDoc.players.filter(p => !p.isBot && p.isActive !== false).length,
        gameEnded: decision === 'end_game',
        botAdded: decision === 'add_bot',
        turnSkipped: decision === 'skip_turn',
        metadata: {
          actionResult: result.action
        }
      });

      console.log(`✅ Continuation decision processed for game ${gameId}: ${decision}`);
      
      // Broadcast continuation decision
      if (this.notificationBroadcaster) {
        this.notificationBroadcaster.broadcastContinuationDecision(gameId, {
          decision,
          targetPlayerName: gameDoc.gracePeriod.targetPlayerId, // TODO: Get actual player name
          actionResult: result.action,
          votes
        });
      }
      
      return result;

    } catch (error) {
      console.error(`❌ Failed to process continuation decision for game ${gameId}:`, error.message);
      throw new Error(`Continuation decision processing failed: ${error.message}`);
    }
  }

  /**
   * Handle complete game abandonment (all players disconnect)
   * Requirements: 10.4
   * @param {string} gameId - The game ID
   * @param {string} reason - Abandonment reason
   * @returns {Promise<Object>} - Abandonment result
   */
  async handleGameAbandonment(gameId, reason = 'ALL_PLAYERS_DISCONNECT') {
    try {
      console.log(`🚫 Handling game abandonment for ${gameId} - Reason: ${reason}`);
      
      // Find the game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) {
        console.log(`⚠️  Game ${gameId} not found for abandonment`);
        return { success: false, reason: 'game_not_found' };
      }

      // Log the abandonment event
      gameDoc.reconnectionEvents.push({
        eventType: 'CONTINUATION_DECISION',
        playerId: 'system',
        metadata: { 
          action: 'game_abandoned',
          reason,
          abandonedAt: new Date()
        }
      });

      // Mark game as ended
      gameDoc.endGame(null); // No winner
      gameDoc.lifecycle.endTime = new Date();
      
      // Save final state
      await gameDoc.save();

      // Clean up memory references
      this.cleanupAbandonedGame(gameId);

      console.log(`✅ Game ${gameId} abandoned and cleaned up`);
      
      return {
        success: true,
        abandonedAt: new Date(),
        reason
      };

    } catch (error) {
      console.error(`❌ Failed to handle game abandonment for ${gameId}:`, error.message);
      throw new Error(`Game abandonment handling failed: ${error.message}`);
    }
  }

  /**
   * Clean up and remove abandoned games from active game list
   * Requirements: 10.4
   * @param {string} gameId - The game ID
   */
  cleanupAbandonedGame(gameId) {
    try {
      console.log(`🧹 Cleaning up abandoned game ${gameId}`);
      
      // Clear any active timers
      this.clearGracePeriodTimer(gameId);
      
      // Remove from memory maps
      this.pausedGames.delete(gameId);
      
      console.log(`✅ Abandoned game ${gameId} cleaned up`);
      
    } catch (error) {
      console.error(`❌ Failed to cleanup abandoned game ${gameId}:`, error.message);
    }
  }

  /**
   * Calculate grace period duration based on connection quality
   * Requirements: 7.3
   * @param {Object} connectionMetrics - Connection quality metrics
   * @returns {number} - Duration in milliseconds
   */
  calculateGracePeriodDuration(connectionMetrics = {}) {
    const defaultDuration = 180000; // 3 minutes
    const extendedDuration = 300000; // 5 minutes
    
    // Check for unstable connection indicators
    const isUnstableConnection = 
      connectionMetrics.connectionQuality === 'poor' ||
      connectionMetrics.packetLoss > 5 ||
      connectionMetrics.latency > 500 ||
      connectionMetrics.networkType === 'cellular';
    
    // Check for mobile device indicators
    const isMobileDevice = 
      connectionMetrics.isMobile ||
      connectionMetrics.networkType === 'cellular';
    
    // Check for multiple disconnection history (if available)
    const hasDisconnectionHistory = 
      connectionMetrics.disconnectionCount > 2 ||
      connectionMetrics.reconnectionAttempts > 1;
    
    // Determine duration based on multiple factors
    if (isUnstableConnection || (isMobileDevice && hasDisconnectionHistory)) {
      console.log(`🔄 Extended grace period due to unstable connection or mobile with history`);
      return extendedDuration;
    } else if (isMobileDevice || connectionMetrics.connectionQuality === 'fair') {
      // Intermediate duration for mobile or fair connections
      const intermediateDuration = 240000; // 4 minutes
      console.log(`📱 Intermediate grace period for mobile or fair connection`);
      return intermediateDuration;
    }
    
    return defaultDuration;
  }

  /**
   * Set up grace period timer
   * @param {string} gameId - The game ID
   * @param {number} duration - Duration in milliseconds
   */
  setGracePeriodTimer(gameId, duration) {
    // Clear any existing timer
    this.clearGracePeriodTimer(gameId);
    
    // Set new timer
    const timer = setTimeout(async () => {
      try {
        await this.handleGracePeriodExpired(gameId);
      } catch (error) {
        console.error(`❌ Grace period timer error for game ${gameId}:`, error.message);
      }
    }, duration);
    
    this.gracePeriodTimers.set(gameId, timer);
    console.log(`⏰ Grace period timer set for game ${gameId} - ${duration}ms`);
    
    // Set up periodic updates every 30 seconds
    const updateInterval = setInterval(async () => {
      try {
        const gameDoc = await Game.findOne({ gameId });
        if (!gameDoc || !gameDoc.gracePeriod.isActive) {
          clearInterval(updateInterval);
          return;
        }
        
        const timeRemaining = gameDoc.getGracePeriodTimeRemaining();
        if (timeRemaining <= 0) {
          clearInterval(updateInterval);
          return;
        }
        
        // Emit periodic update (this would be handled by socket.io in real implementation)
        console.log(`⏳ Grace period update for game ${gameId}: ${Math.round(timeRemaining / 1000)}s remaining`);
        
      } catch (error) {
        console.error(`❌ Grace period update error for game ${gameId}:`, error.message);
        clearInterval(updateInterval);
      }
    }, 30000); // Update every 30 seconds
    
    // Store update interval reference
    this.gracePeriodTimers.set(`${gameId}_updates`, updateInterval);
  }

  /**
   * Clear grace period timer
   * @param {string} gameId - The game ID
   */
  clearGracePeriodTimer(gameId) {
    const timer = this.gracePeriodTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.gracePeriodTimers.delete(gameId);
      console.log(`⏰ Grace period timer cleared for game ${gameId}`);
    }
    
    // Clear update interval as well
    const updateInterval = this.gracePeriodTimers.get(`${gameId}_updates`);
    if (updateInterval) {
      clearInterval(updateInterval);
      this.gracePeriodTimers.delete(`${gameId}_updates`);
      console.log(`⏰ Grace period update interval cleared for game ${gameId}`);
    }
  }

  /**
   * Execute skip turn decision
   * @param {Object} gameDoc - Game document
   * @returns {Promise<Object>} - Action result
   */
  async executeSkipTurn(gameDoc) {
    console.log(`⏭️  Executing skip turn for game ${gameDoc.gameId}`);
    
    // Mark disconnected player as inactive
    const targetPlayerId = gameDoc.gracePeriod.targetPlayerId;
    const playerStatus = gameDoc.getPlayerStatus(targetPlayerId);
    if (playerStatus) {
      playerStatus.status = 'ABANDONED';
    }
    
    return {
      type: 'skip_turn',
      targetPlayerId,
      message: 'Turn skipped, moving to next player'
    };
  }

  /**
   * Execute add bot decision
   * @param {Object} gameDoc - Game document
   * @returns {Promise<Object>} - Action result
   */
  async executeAddBot(gameDoc) {
    console.log(`🤖 Executing add bot for game ${gameDoc.gameId}`);
    
    const targetPlayerId = gameDoc.gracePeriod.targetPlayerId;
    
    // Find the disconnected player and mark as replaced by bot
    const playerIndex = gameDoc.players.findIndex(p => 
      (p.name === targetPlayerId || p.userId === targetPlayerId)
    );
    
    if (playerIndex !== -1) {
      gameDoc.players[playerIndex].isBot = true;
      gameDoc.players[playerIndex].name = `Bot_${Math.random().toString(36).substring(2, 5)}`;
    }
    
    return {
      type: 'add_bot',
      targetPlayerId,
      botName: gameDoc.players[playerIndex]?.name,
      message: 'Bot player added to replace disconnected player'
    };
  }

  /**
   * Execute end game decision
   * @param {Object} gameDoc - Game document
   * @returns {Promise<Object>} - Action result
   */
  async executeEndGame(gameDoc) {
    console.log(`🏁 Executing end game for game ${gameDoc.gameId}`);
    
    // End the game gracefully
    gameDoc.endGame(null); // No winner
    gameDoc.lifecycle.endTime = new Date();
    
    return {
      type: 'end_game',
      message: 'Game ended due to player disconnection'
    };
  }

  /**
   * Get grace period time remaining for a game
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Grace period info with time remaining
   */
  async getGracePeriodStatus(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc || !gameDoc.gracePeriod.isActive) {
        return null;
      }
      
      const timeRemaining = gameDoc.getGracePeriodTimeRemaining();
      const isExpired = timeRemaining <= 0;
      
      return {
        isActive: gameDoc.gracePeriod.isActive && !isExpired,
        targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
        startTime: gameDoc.gracePeriod.startTime,
        duration: gameDoc.gracePeriod.duration,
        timeRemaining: Math.max(0, timeRemaining),
        isExpired,
        formattedTimeRemaining: this.formatTimeRemaining(timeRemaining)
      };
      
    } catch (error) {
      console.error(`❌ Failed to get grace period status for game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Format time remaining in a human-readable format
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} - Formatted time string
   */
  formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0:00';
    
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get pause status for a game
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Pause status or null
   */
  async getPauseStatus(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) return null;
      
      return {
        isPaused: gameDoc.isPaused,
        pauseReason: gameDoc.pauseReason,
        pausedAt: gameDoc.pausedAt,
        pausedBy: gameDoc.pausedBy,
        gracePeriod: {
          isActive: gameDoc.gracePeriod.isActive,
          startTime: gameDoc.gracePeriod.startTime,
          duration: gameDoc.gracePeriod.duration,
          targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
          timeRemaining: gameDoc.getGracePeriodTimeRemaining()
        },
        continuationOptions: gameDoc.continuationOptions
      };
      
    } catch (error) {
      console.error(`❌ Failed to get pause status for game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if a game is paused
   * @param {string} gameId - The game ID
   * @returns {Promise<boolean>} - True if paused
   */
  async isGamePaused(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId }, { isPaused: 1 });
      return gameDoc ? gameDoc.isPaused : false;
    } catch (error) {
      console.error(`❌ Failed to check pause status for game ${gameId}:`, error.message);
      return false;
    }
  }

  /**
   * Get voting status for continuation options
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Voting status or null
   */
  async getVotingStatus(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc || !gameDoc.continuationOptions.presented) {
        return null;
      }
      
      const totalPlayers = gameDoc.players.filter(p => !p.isBot).length;
      const votes = gameDoc.continuationOptions.votes;
      const voteCounts = {
        skip_turn: 0,
        add_bot: 0,
        end_game: 0
      };
      
      votes.forEach(vote => {
        if (voteCounts.hasOwnProperty(vote.choice)) {
          voteCounts[vote.choice]++;
        }
      });
      
      return {
        gameId,
        totalPlayers,
        totalVotes: votes.length,
        votes: votes,
        voteCounts,
        options: gameDoc.continuationOptions.options,
        presentedAt: gameDoc.continuationOptions.presentedAt,
        targetPlayerId: gameDoc.gracePeriod.targetPlayerId,
        isComplete: votes.length >= totalPlayers,
        leadingChoice: this.determineContinuationDecision(votes)
      };
      
    } catch (error) {
      console.error(`❌ Failed to get voting status for game ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Handle voting timeout (auto-decide if no votes received)
   * @param {string} gameId - The game ID
   * @returns {Promise<Object>} - Timeout result
   */
  async handleVotingTimeout(gameId) {
    try {
      console.log(`⏰ Voting timeout for game ${gameId}, using default decision`);
      
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc || !gameDoc.continuationOptions.presented) {
        return { success: false, reason: 'no_voting_in_progress' };
      }
      
      // Use default decision (skip_turn) if no votes
      const votes = gameDoc.continuationOptions.votes;
      const decision = votes.length > 0 ? 
        this.determineContinuationDecision(votes) : 
        'skip_turn';
      
      // Process the decision
      const result = await this.processContinuationDecision(gameId, decision, votes);
      
      console.log(`✅ Voting timeout handled for game ${gameId} with decision: ${decision}`);
      
      return {
        success: true,
        decision,
        reason: 'voting_timeout',
        result
      };
      
    } catch (error) {
      console.error(`❌ Failed to handle voting timeout for game ${gameId}:`, error.message);
      throw new Error(`Voting timeout handling failed: ${error.message}`);
    }
  }

  /**
   * Get all paused games
   * @returns {Promise<Array>} - Array of paused game IDs
   */
  async getPausedGames() {
    try {
      const pausedGames = await Game.find({ isPaused: true }, { gameId: 1 });
      return pausedGames.map(game => game.gameId);
    } catch (error) {
      console.error(`❌ Failed to get paused games:`, error.message);
      return [];
    }
  }

  /**
   * Shutdown the controller and clean up resources
   */
  shutdown() {
    console.log('🔧 Shutting down Game Pause Controller...');
    
    // Clear all grace period timers
    for (const [gameId, timer] of this.gracePeriodTimers) {
      clearTimeout(timer);
    }
    this.gracePeriodTimers.clear();
    
    // Clear memory maps
    this.pausedGames.clear();
    
    console.log('✅ Game Pause Controller shutdown complete');
  }
}

// Export singleton instance
const gamePauseController = new GamePauseController();

module.exports = gamePauseController;