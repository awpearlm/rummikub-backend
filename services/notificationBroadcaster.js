/**
 * Notification Broadcaster
 * Handles broadcasting of pause/resume notifications, welcome back messages, and grace period updates
 * Requirements: 1.3, 6.3, 9.1, 9.2, 9.3, 9.4, 9.5
 */

class NotificationBroadcaster {
  constructor(io) {
    this.io = io;
    this.gracePeriodUpdateIntervals = new Map(); // gameId -> interval
  }

  /**
   * Broadcast game pause notification to all players
   * Requirements: 1.3, 9.1
   * @param {string} gameId - The game ID
   * @param {Object} pauseInfo - Pause information
   * @param {string} pauseInfo.reason - Pause reason
   * @param {string} pauseInfo.playerName - Name of player who caused pause
   * @param {string} pauseInfo.playerId - ID of player who caused pause
   * @param {Date} pauseInfo.pausedAt - When the game was paused
   */
  broadcastGamePaused(gameId, pauseInfo) {
    try {
      console.log(`📢 Broadcasting game pause for ${gameId} - Player: ${pauseInfo.playerName}`);
      
      const notification = {
        type: 'game_paused',
        gameId,
        message: this.formatPauseMessage(pauseInfo.reason, pauseInfo.playerName),
        reason: pauseInfo.reason,
        playerName: pauseInfo.playerName,
        playerId: pauseInfo.playerId,
        pausedAt: pauseInfo.pausedAt,
        timestamp: new Date()
      };

      // Broadcast to all players in the game room
      this.io.to(gameId).emit('gamePaused', notification);
      
      console.log(`✅ Game pause notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast game pause for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast game resume notification to all players
   * Requirements: 1.3, 9.2
   * @param {string} gameId - The game ID
   * @param {Object} resumeInfo - Resume information
   * @param {string} resumeInfo.playerName - Name of player who reconnected
   * @param {string} resumeInfo.playerId - ID of player who reconnected
   * @param {Date} resumeInfo.resumedAt - When the game was resumed
   * @param {number} resumeInfo.pauseDuration - How long the game was paused (ms)
   */
  broadcastGameResumed(gameId, resumeInfo) {
    try {
      console.log(`📢 Broadcasting game resume for ${gameId} - Player: ${resumeInfo.playerName}`);
      
      const notification = {
        type: 'game_resumed',
        gameId,
        message: `Game resumed! ${resumeInfo.playerName} has reconnected.`,
        playerName: resumeInfo.playerName,
        playerId: resumeInfo.playerId,
        resumedAt: resumeInfo.resumedAt,
        pauseDuration: resumeInfo.pauseDuration,
        formattedPauseDuration: this.formatDuration(resumeInfo.pauseDuration),
        timestamp: new Date()
      };

      // Broadcast to all players in the game room
      this.io.to(gameId).emit('gameResumed', notification);
      
      console.log(`✅ Game resume notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast game resume for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast welcome back message for reconnected player
   * Requirements: 6.3, 9.2
   * @param {string} gameId - The game ID
   * @param {Object} playerInfo - Player information
   * @param {string} playerInfo.playerName - Name of reconnected player
   * @param {string} playerInfo.playerId - ID of reconnected player
   * @param {number} playerInfo.disconnectedDuration - How long they were disconnected (ms)
   * @param {boolean} playerInfo.isCurrentPlayer - Whether this is the current player
   */
  broadcastWelcomeBack(gameId, playerInfo) {
    try {
      console.log(`📢 Broadcasting welcome back for ${gameId} - Player: ${playerInfo.playerName}`);
      
      const notification = {
        type: 'player_welcome_back',
        gameId,
        message: this.formatWelcomeBackMessage(playerInfo),
        playerName: playerInfo.playerName,
        playerId: playerInfo.playerId,
        disconnectedDuration: playerInfo.disconnectedDuration,
        formattedDisconnectedDuration: this.formatDuration(playerInfo.disconnectedDuration),
        isCurrentPlayer: playerInfo.isCurrentPlayer,
        timestamp: new Date()
      };

      // Broadcast to all players in the game room
      this.io.to(gameId).emit('playerWelcomeBack', notification);
      
      console.log(`✅ Welcome back notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast welcome back for ${gameId}:`, error.message);
    }
  }

  /**
   * Start periodic grace period updates
   * Requirements: 9.3
   * @param {string} gameId - The game ID
   * @param {Object} gracePeriodInfo - Grace period information
   * @param {string} gracePeriodInfo.targetPlayerName - Name of disconnected player
   * @param {string} gracePeriodInfo.targetPlayerId - ID of disconnected player
   * @param {number} gracePeriodInfo.duration - Total grace period duration (ms)
   * @param {Date} gracePeriodInfo.startTime - When grace period started
   */
  startGracePeriodUpdates(gameId, gracePeriodInfo) {
    try {
      console.log(`📢 Starting grace period updates for ${gameId} - Player: ${gracePeriodInfo.targetPlayerName}`);
      
      // Clear any existing interval
      this.stopGracePeriodUpdates(gameId);
      
      // Send initial grace period notification
      this.broadcastGracePeriodStart(gameId, gracePeriodInfo);
      
      // Set up periodic updates every 30 seconds
      const updateInterval = setInterval(() => {
        const timeRemaining = this.calculateTimeRemaining(gracePeriodInfo.startTime, gracePeriodInfo.duration);
        
        if (timeRemaining <= 0) {
          // Grace period expired, stop updates
          this.stopGracePeriodUpdates(gameId);
          return;
        }
        
        this.broadcastGracePeriodUpdate(gameId, {
          ...gracePeriodInfo,
          timeRemaining,
          formattedTimeRemaining: this.formatTimeRemaining(timeRemaining)
        });
        
      }, 30000); // Update every 30 seconds
      
      this.gracePeriodUpdateIntervals.set(gameId, updateInterval);
      
      console.log(`✅ Grace period updates started for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to start grace period updates for ${gameId}:`, error.message);
    }
  }

  /**
   * Stop periodic grace period updates
   * @param {string} gameId - The game ID
   */
  stopGracePeriodUpdates(gameId) {
    const interval = this.gracePeriodUpdateIntervals.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.gracePeriodUpdateIntervals.delete(gameId);
      console.log(`⏰ Grace period updates stopped for ${gameId}`);
    }
  }

  /**
   * Broadcast grace period start notification
   * Requirements: 9.3
   * @param {string} gameId - The game ID
   * @param {Object} gracePeriodInfo - Grace period information
   */
  broadcastGracePeriodStart(gameId, gracePeriodInfo) {
    try {
      const timeRemaining = this.calculateTimeRemaining(gracePeriodInfo.startTime, gracePeriodInfo.duration);
      
      const notification = {
        type: 'grace_period_start',
        gameId,
        message: `Waiting for ${gracePeriodInfo.targetPlayerName} to reconnect...`,
        targetPlayerName: gracePeriodInfo.targetPlayerName,
        targetPlayerId: gracePeriodInfo.targetPlayerId,
        duration: gracePeriodInfo.duration,
        timeRemaining,
        formattedTimeRemaining: this.formatTimeRemaining(timeRemaining),
        startTime: gracePeriodInfo.startTime,
        timestamp: new Date()
      };

      this.io.to(gameId).emit('gracePeriodStart', notification);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast grace period start for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast grace period update notification
   * Requirements: 9.3
   * @param {string} gameId - The game ID
   * @param {Object} updateInfo - Update information
   */
  broadcastGracePeriodUpdate(gameId, updateInfo) {
    try {
      const notification = {
        type: 'grace_period_update',
        gameId,
        message: `Still waiting for ${updateInfo.targetPlayerName} - ${updateInfo.formattedTimeRemaining} remaining`,
        targetPlayerName: updateInfo.targetPlayerName,
        targetPlayerId: updateInfo.targetPlayerId,
        timeRemaining: updateInfo.timeRemaining,
        formattedTimeRemaining: updateInfo.formattedTimeRemaining,
        timestamp: new Date()
      };

      this.io.to(gameId).emit('gracePeriodUpdate', notification);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast grace period update for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast grace period expiration notification
   * Requirements: 9.3
   * @param {string} gameId - The game ID
   * @param {Object} expirationInfo - Expiration information
   * @param {string} expirationInfo.targetPlayerName - Name of disconnected player
   * @param {string} expirationInfo.targetPlayerId - ID of disconnected player
   */
  broadcastGracePeriodExpired(gameId, expirationInfo) {
    try {
      console.log(`📢 Broadcasting grace period expiration for ${gameId} - Player: ${expirationInfo.targetPlayerName}`);
      
      // Stop periodic updates
      this.stopGracePeriodUpdates(gameId);
      
      const notification = {
        type: 'grace_period_expired',
        gameId,
        message: `Grace period expired for ${expirationInfo.targetPlayerName}. Please choose how to continue.`,
        targetPlayerName: expirationInfo.targetPlayerName,
        targetPlayerId: expirationInfo.targetPlayerId,
        timestamp: new Date()
      };

      this.io.to(gameId).emit('gracePeriodExpired', notification);
      
      console.log(`✅ Grace period expiration notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast grace period expiration for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast continuation options to players
   * Requirements: 9.4, 9.5
   * @param {string} gameId - The game ID
   * @param {Object} optionsInfo - Options information
   * @param {Array} optionsInfo.options - Available continuation options
   * @param {string} optionsInfo.targetPlayerName - Name of disconnected player
   * @param {string} optionsInfo.targetPlayerId - ID of disconnected player
   */
  broadcastContinuationOptions(gameId, optionsInfo) {
    try {
      console.log(`📢 Broadcasting continuation options for ${gameId} - Player: ${optionsInfo.targetPlayerName}`);
      
      const notification = {
        type: 'continuation_options',
        gameId,
        message: `Choose how to continue without ${optionsInfo.targetPlayerName}:`,
        targetPlayerName: optionsInfo.targetPlayerName,
        targetPlayerId: optionsInfo.targetPlayerId,
        options: this.formatContinuationOptions(optionsInfo.options),
        timestamp: new Date()
      };

      this.io.to(gameId).emit('continuationOptions', notification);
      
      console.log(`✅ Continuation options notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast continuation options for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast voting progress update
   * Requirements: 9.5
   * @param {string} gameId - The game ID
   * @param {Object} votingInfo - Voting information
   * @param {string} votingInfo.voterName - Name of player who voted
   * @param {string} votingInfo.choice - The vote choice
   * @param {number} votingInfo.totalVotes - Total votes cast
   * @param {number} votingInfo.totalPlayers - Total players who can vote
   * @param {Object} votingInfo.voteCounts - Vote counts by option
   */
  broadcastVotingProgress(gameId, votingInfo) {
    try {
      console.log(`📢 Broadcasting voting progress for ${gameId} - Voter: ${votingInfo.voterName}, Choice: ${votingInfo.choice}`);
      
      const notification = {
        type: 'voting_progress',
        gameId,
        message: `${votingInfo.voterName} voted to ${this.formatChoiceText(votingInfo.choice)}. (${votingInfo.totalVotes}/${votingInfo.totalPlayers} votes)`,
        voterName: votingInfo.voterName,
        choice: votingInfo.choice,
        choiceText: this.formatChoiceText(votingInfo.choice),
        totalVotes: votingInfo.totalVotes,
        totalPlayers: votingInfo.totalPlayers,
        voteCounts: votingInfo.voteCounts,
        isComplete: votingInfo.totalVotes >= votingInfo.totalPlayers,
        timestamp: new Date()
      };

      this.io.to(gameId).emit('votingProgress', notification);
      
      console.log(`✅ Voting progress notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast voting progress for ${gameId}:`, error.message);
    }
  }

  /**
   * Broadcast continuation decision result
   * Requirements: 9.5
   * @param {string} gameId - The game ID
   * @param {Object} decisionInfo - Decision information
   * @param {string} decisionInfo.decision - The chosen decision
   * @param {string} decisionInfo.targetPlayerName - Name of disconnected player
   * @param {Object} decisionInfo.actionResult - Result of the executed action
   * @param {Array} decisionInfo.votes - All votes cast
   */
  broadcastContinuationDecision(gameId, decisionInfo) {
    try {
      console.log(`📢 Broadcasting continuation decision for ${gameId} - Decision: ${decisionInfo.decision}`);
      
      const notification = {
        type: 'continuation_decision',
        gameId,
        message: this.formatDecisionMessage(decisionInfo.decision, decisionInfo.targetPlayerName, decisionInfo.actionResult),
        decision: decisionInfo.decision,
        decisionText: this.formatChoiceText(decisionInfo.decision),
        targetPlayerName: decisionInfo.targetPlayerName,
        actionResult: decisionInfo.actionResult,
        votes: decisionInfo.votes,
        timestamp: new Date()
      };

      this.io.to(gameId).emit('continuationDecision', notification);
      
      console.log(`✅ Continuation decision notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast continuation decision for ${gameId}:`, error.message);
    }
  }

  /**
   * Format pause message based on reason
   * @param {string} reason - Pause reason
   * @param {string} playerName - Player name
   * @returns {string} - Formatted message
   */
  formatPauseMessage(reason, playerName) {
    switch (reason) {
      case 'CURRENT_PLAYER_DISCONNECT':
        return `Game paused - ${playerName} disconnected during their turn`;
      case 'MULTIPLE_DISCONNECTS':
        return `Game paused - Multiple players disconnected including ${playerName}`;
      case 'NETWORK_INSTABILITY':
        return `Game paused - Network instability detected for ${playerName}`;
      case 'ALL_PLAYERS_DISCONNECT':
        return `Game paused - All players disconnected including ${playerName}`;
      default:
        return `Game paused - ${playerName} disconnected`;
    }
  }

  /**
   * Format welcome back message
   * @param {Object} playerInfo - Player information
   * @returns {string} - Formatted message
   */
  formatWelcomeBackMessage(playerInfo) {
    const durationText = this.formatDuration(playerInfo.disconnectedDuration);
    const baseMessage = `Welcome back, ${playerInfo.playerName}! You were away for ${durationText}.`;
    
    if (playerInfo.isCurrentPlayer) {
      return `${baseMessage} It's your turn!`;
    } else {
      return `${baseMessage} The game continues.`;
    }
  }

  /**
   * Format continuation options with clear descriptions
   * Requirements: 9.4
   * @param {Array} options - Array of option strings
   * @returns {Array} - Array of formatted option objects
   */
  formatContinuationOptions(options) {
    const optionDescriptions = {
      'skip_turn': {
        id: 'skip_turn',
        title: 'Skip Turn',
        description: 'Skip the disconnected player\'s turn and continue with the next player',
        icon: '⏭️'
      },
      'add_bot': {
        id: 'add_bot',
        title: 'Add Bot Player',
        description: 'Replace the disconnected player with an AI bot to continue the game',
        icon: '🤖'
      },
      'end_game': {
        id: 'end_game',
        title: 'End Game',
        description: 'End the game now and record the current standings',
        icon: '🏁'
      }
    };

    return options.map(option => optionDescriptions[option] || {
      id: option,
      title: option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `Choose ${option.replace('_', ' ')}`,
      icon: '❓'
    });
  }

  /**
   * Format choice text for display
   * @param {string} choice - The choice string
   * @returns {string} - Formatted choice text
   */
  formatChoiceText(choice) {
    switch (choice) {
      case 'skip_turn':
        return 'skip turn';
      case 'add_bot':
        return 'add bot player';
      case 'end_game':
        return 'end game';
      default:
        return choice.replace('_', ' ');
    }
  }

  /**
   * Format decision message
   * @param {string} decision - The decision
   * @param {string} playerName - Target player name
   * @param {Object} actionResult - Action result
   * @returns {string} - Formatted message
   */
  formatDecisionMessage(decision, playerName, actionResult) {
    switch (decision) {
      case 'skip_turn':
        return `${playerName}'s turn has been skipped. Moving to the next player.`;
      case 'add_bot':
        return `${playerName} has been replaced by ${actionResult.botName || 'a bot player'}. Game continues.`;
      case 'end_game':
        return `Game ended due to ${playerName}'s disconnection. Final scores recorded.`;
      default:
        return `Decision made: ${this.formatChoiceText(decision)}`;
    }
  }

  /**
   * Calculate time remaining from start time and duration
   * @param {Date} startTime - Start time
   * @param {number} duration - Duration in milliseconds
   * @returns {number} - Time remaining in milliseconds
   */
  calculateTimeRemaining(startTime, duration) {
    const elapsed = Date.now() - new Date(startTime).getTime();
    return Math.max(0, duration - elapsed);
  }

  /**
   * Format time remaining in MM:SS format
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
   * Format duration in human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} - Formatted duration string
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) return 'less than a second';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    
    if (totalSeconds < 60) {
      return `${totalSeconds} second${totalSeconds !== 1 ? 's' : ''}`;
    }
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes < 60) {
      if (seconds === 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
      }
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Broadcast player disconnection notification
   * Requirements: 1.5, 2.1
   * @param {string} gameId - The game ID
   * @param {Object} disconnectionInfo - Disconnection information
   * @param {string} disconnectionInfo.playerName - Name of disconnected player
   * @param {string} disconnectionInfo.playerId - ID of disconnected player
   * @param {boolean} disconnectionInfo.isCurrentPlayer - Whether this was the current player
   * @param {string} disconnectionInfo.reason - Disconnection reason
   * @param {Date} disconnectionInfo.disconnectedAt - When the player disconnected
   */
  broadcastPlayerDisconnected(gameId, disconnectionInfo) {
    try {
      console.log(`📢 Broadcasting player disconnection for ${gameId} - Player: ${disconnectionInfo.playerName}`);
      
      const notification = {
        type: 'player_disconnected',
        gameId,
        message: this.formatDisconnectionMessage(disconnectionInfo),
        playerName: disconnectionInfo.playerName,
        playerId: disconnectionInfo.playerId,
        isCurrentPlayer: disconnectionInfo.isCurrentPlayer,
        reason: disconnectionInfo.reason,
        disconnectedAt: disconnectionInfo.disconnectedAt,
        timestamp: new Date()
      };

      // Broadcast to all players in the game room
      this.io.to(gameId).emit('playerDisconnected', notification);
      
      console.log(`✅ Player disconnection notification sent for ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Failed to broadcast player disconnection for ${gameId}:`, error.message);
    }
  }

  /**
   * Format disconnection message based on player status and reason
   * @param {Object} disconnectionInfo - Disconnection information
   * @returns {string} - Formatted message
   */
  formatDisconnectionMessage(disconnectionInfo) {
    const { playerName, isCurrentPlayer, reason } = disconnectionInfo;
    
    let baseMessage = `${playerName} disconnected`;
    
    if (isCurrentPlayer) {
      baseMessage += ' during their turn';
    }
    
    switch (reason) {
      case 'NETWORK_INSTABILITY':
        return `${baseMessage} due to network issues`;
      case 'MOBILE_INTERRUPTION':
        return `${baseMessage} (mobile app interrupted)`;
      case 'NETWORK_TIMEOUT':
        return `${baseMessage} (connection timeout)`;
      case 'INTENTIONAL_DISCONNECT':
        return `${baseMessage} (left the game)`;
      default:
        return baseMessage;
    }
  }

  /**
   * Cleanup all intervals and resources
   */
  shutdown() {
    console.log('🔧 Shutting down Notification Broadcaster...');
    
    // Clear all grace period update intervals
    for (const [gameId, interval] of this.gracePeriodUpdateIntervals) {
      clearInterval(interval);
    }
    this.gracePeriodUpdateIntervals.clear();
    
    console.log('✅ Notification Broadcaster shutdown complete');
  }
}

module.exports = NotificationBroadcaster;