/**
 * Reconnection Integration Service
 * Wires together all components for complete end-to-end reconnection flow
 * Requirements: All requirements integration
 */

const PlayerConnectionManager = require('./playerConnectionManager');
const gamePauseController = require('./gamePauseController');
const reconnectionHandler = require('./reconnectionHandler');
const turnTimerManager = require('./turnTimerManager');
const NotificationBroadcaster = require('./notificationBroadcaster');
const analyticsLogger = require('./analyticsLogger');

class ReconnectionIntegrationService {
  constructor(io, games, players) {
    this.io = io;
    this.games = games;
    this.players = players;
    
    // Initialize core services
    this.playerConnectionManager = new PlayerConnectionManager();
    this.notificationBroadcaster = new NotificationBroadcaster(io);
    
    // Set up service dependencies
    gamePauseController.setNotificationBroadcaster(this.notificationBroadcaster);
    
    // Track active flows
    this.activeReconnectionFlows = new Map(); // playerId -> flow state
    
    console.log('🔗 Reconnection Integration Service initialized');
    
    // Set up event listeners for complete flow coordination
    this.setupEventListeners();
  }

  /**
   * Set up event listeners to coordinate the complete reconnection flow
   */
  setupEventListeners() {
    // Listen for connection events
    this.playerConnectionManager.on('connectionRegistered', this.handleConnectionRegistered.bind(this));
    this.playerConnectionManager.on('statusUpdated', this.handleStatusUpdated.bind(this));
    this.playerConnectionManager.on('disconnectionConfirmed', this.handleDisconnectionConfirmed.bind(this));
    this.playerConnectionManager.on('reconnectionSuccessful', this.handleReconnectionSuccessful.bind(this));
    this.playerConnectionManager.on('connectionQualityWarning', this.handleConnectionQualityWarning.bind(this));
    this.playerConnectionManager.on('networkTypeChanged', this.handleNetworkTypeChanged.bind(this));
    
    console.log('✅ Event listeners set up for reconnection flow coordination');
  }

  /**
   * Handle new connection registration
   * @param {Object} event - Connection registered event
   */
  async handleConnectionRegistered(event) {
    try {
      const { playerId, socketId, gameId, connectionInfo } = event;
      console.log(`🔗 Connection registered: ${playerId} in game ${gameId}`);
      
      // Update game state with player connection
      const game = this.games.get(gameId);
      if (game) {
        // Notify other players about the connection
        this.notificationBroadcaster.broadcastPlayerConnected(gameId, {
          playerName: playerId,
          playerId,
          connectionQuality: connectionInfo.connectionQuality,
          isMobile: connectionInfo.isMobile
        });
      }
      
    } catch (error) {
      console.error(`❌ Error handling connection registration:`, error.message);
    }
  }

  /**
   * Handle player status updates
   * @param {Object} event - Status updated event
   */
  async handleStatusUpdated(event) {
    try {
      const { playerId, oldStatus, newStatus, reason, connectionInfo } = event;
      console.log(`🔗 Status updated: ${playerId} ${oldStatus} -> ${newStatus} (${reason})`);
      
      // Broadcast status update to game players
      if (connectionInfo.gameId) {
        this.notificationBroadcaster.broadcastPlayerStatusUpdate(connectionInfo.gameId, {
          playerName: playerId,
          playerId,
          oldStatus,
          newStatus,
          reason,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error(`❌ Error handling status update:`, error.message);
    }
  }

  /**
   * Handle confirmed disconnection - start the complete reconnection flow
   * @param {Object} event - Disconnection confirmed event
   */
  async handleDisconnectionConfirmed(event) {
    try {
      const { playerId, reason, connectionInfo } = event;
      const gameId = connectionInfo.gameId;
      
      console.log(`🔗 Starting complete disconnection flow for ${playerId} in game ${gameId}`);
      
      // Check if this is the current player
      const game = this.games.get(gameId);
      if (!game) {
        console.log(`⚠️ Game ${gameId} not found for disconnected player ${playerId}`);
        return;
      }
      
      const currentPlayer = game.getCurrentPlayer();
      const isCurrentPlayer = currentPlayer?.name === playerId || currentPlayer?.id === playerId;
      
      if (isCurrentPlayer) {
        await this.handleCurrentPlayerDisconnectionFlow(playerId, gameId, reason, connectionInfo);
      } else {
        await this.handleNonCurrentPlayerDisconnectionFlow(playerId, gameId, reason, connectionInfo);
      }
      
    } catch (error) {
      console.error(`❌ Error handling disconnection confirmation:`, error.message);
    }
  }

  /**
   * Handle current player disconnection with complete flow
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   * @param {string} reason - Disconnection reason
   * @param {Object} connectionInfo - Connection information
   */
  async handleCurrentPlayerDisconnectionFlow(playerId, gameId, reason, connectionInfo) {
    try {
      console.log(`🔗 Current player disconnection flow: ${playerId} in game ${gameId}`);
      
      // Track the flow
      const flowState = {
        playerId,
        gameId,
        phase: 'disconnection_confirmed',
        startTime: new Date(),
        reason,
        connectionInfo
      };
      this.activeReconnectionFlows.set(playerId, flowState);
      
      // Step 1: Preserve timer state
      const game = this.games.get(gameId);
      if (game && game.turnStartTime) {
        const elapsed = Date.now() - game.turnStartTime;
        const remainingTime = Math.max(0, (game.turnTimeLimit * 1000) - elapsed);
        
        await turnTimerManager.preserveTimer(gameId, playerId, remainingTime, game.turnStartTime);
        flowState.timerPreserved = true;
        console.log(`⏰ Timer preserved for ${playerId}: ${remainingTime}ms remaining`);
      }
      
      // Step 2: Pause the game
      const pauseResult = await gamePauseController.pauseGame(gameId, 'CURRENT_PLAYER_DISCONNECT', playerId, {
        remainingTime: game?.turnStartTime ? Math.max(0, (game.turnTimeLimit * 1000) - (Date.now() - game.turnStartTime)) : null,
        turnStartTime: game?.turnStartTime,
        connectionInfo
      });
      
      if (pauseResult.success) {
        flowState.phase = 'game_paused';
        flowState.pausedAt = pauseResult.pausedAt;
        console.log(`⏸️ Game ${gameId} paused due to ${playerId} disconnection`);
      }
      
      // Step 3: Start grace period with adaptive duration
      const gracePeriodDuration = this.playerConnectionManager.getGracePeriodForPlayer(playerId);
      const gracePeriodResult = await gamePauseController.startGracePeriod(gameId, playerId, connectionInfo);
      
      if (gracePeriodResult.success) {
        flowState.phase = 'grace_period_active';
        flowState.gracePeriodStarted = gracePeriodResult.startTime;
        flowState.gracePeriodDuration = gracePeriodResult.duration;
        console.log(`⏳ Grace period started for ${playerId}: ${gracePeriodResult.duration}ms`);
      }
      
      // Update flow state
      this.activeReconnectionFlows.set(playerId, flowState);
      
    } catch (error) {
      console.error(`❌ Error in current player disconnection flow:`, error.message);
    }
  }

  /**
   * Handle non-current player disconnection flow
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   * @param {string} reason - Disconnection reason
   * @param {Object} connectionInfo - Connection information
   */
  async handleNonCurrentPlayerDisconnectionFlow(playerId, gameId, reason, connectionInfo) {
    try {
      console.log(`🔗 Non-current player disconnection flow: ${playerId} in game ${gameId}`);
      
      // For non-current players, just update status and continue game
      this.notificationBroadcaster.broadcastPlayerDisconnected(gameId, {
        playerName: playerId,
        playerId,
        reason,
        isCurrentPlayer: false,
        gameWillContinue: true
      });
      
      // Log the event for analytics
      analyticsLogger.logDisconnectionEvent({
        playerId,
        gameId,
        reason,
        isCurrentPlayer: false,
        gameAction: 'continue',
        isMobile: connectionInfo.isMobile,
        networkType: connectionInfo.networkType,
        connectionQuality: connectionInfo.connectionQuality
      });
      
    } catch (error) {
      console.error(`❌ Error in non-current player disconnection flow:`, error.message);
    }
  }

  /**
   * Handle successful reconnection - complete the restoration flow
   * @param {Object} event - Reconnection successful event
   */
  async handleReconnectionSuccessful(event) {
    try {
      const { playerId, gameId, connectionInfo } = event;
      console.log(`🔗 Starting reconnection restoration flow for ${playerId} in game ${gameId}`);
      
      // Get the active flow state
      const flowState = this.activeReconnectionFlows.get(playerId);
      if (!flowState) {
        console.log(`⚠️ No active flow state found for ${playerId}, creating new one`);
      }
      
      // Step 1: Attempt reconnection through reconnection handler
      const reconnectionResult = await reconnectionHandler.attemptReconnection(playerId, gameId, connectionInfo);
      
      if (!reconnectionResult.success) {
        console.log(`❌ Reconnection attempt failed for ${playerId}:`, reconnectionResult.reason);
        
        // Handle reconnection failure
        await this.handleReconnectionFailure(playerId, gameId, reconnectionResult);
        return;
      }
      
      console.log(`✅ Reconnection successful for ${playerId}`);
      
      // Step 2: If game was paused, resume it
      if (reconnectionResult.wasGameResumed) {
        console.log(`▶️ Game ${gameId} resumed due to ${playerId} reconnection`);
        
        // Step 3: Restore timer if it was preserved
        if (flowState?.timerPreserved) {
          const timerRestoreResult = await turnTimerManager.restoreTimer(gameId, playerId);
          if (timerRestoreResult.success) {
            console.log(`⏰ Timer restored for ${playerId}: ${timerRestoreResult.remainingTime}ms`);
          }
        }
      }
      
      // Step 4: Synchronize game state
      const game = this.games.get(gameId);
      if (game) {
        // Send complete game state to reconnected player
        const socket = this.getSocketForPlayer(playerId);
        if (socket) {
          socket.emit('gameStateSync', {
            gameState: this.getCompleteGameState(game),
            playerState: reconnectionResult.restoredState,
            reconnectionInfo: {
              reconnectedAt: reconnectionResult.reconnectedAt,
              wasGamePaused: reconnectionResult.wasGameResumed,
              gracePeriodWasActive: flowState?.phase === 'grace_period_active'
            }
          });
        }
      }
      
      // Step 5: Broadcast welcome back message
      this.notificationBroadcaster.broadcastWelcomeBack(gameId, {
        playerName: playerId,
        playerId,
        disconnectedDuration: flowState ? Date.now() - flowState.startTime.getTime() : 0,
        isCurrentPlayer: reconnectionResult.restoredState?.playerIndex === game?.currentPlayerIndex
      });
      
      // Clean up flow state
      this.activeReconnectionFlows.delete(playerId);
      
      console.log(`🎉 Complete reconnection flow finished for ${playerId}`);
      
    } catch (error) {
      console.error(`❌ Error in reconnection restoration flow:`, error.message);
    }
  }

  /**
   * Handle reconnection failure with fallback options
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   * @param {Object} reconnectionResult - Failed reconnection result
   */
  async handleReconnectionFailure(playerId, gameId, reconnectionResult) {
    try {
      console.log(`🔗 Handling reconnection failure for ${playerId}: ${reconnectionResult.reason}`);
      
      // Get the socket for the player if they're still connected
      const socket = this.getSocketForPlayer(playerId);
      if (socket) {
        socket.emit('reconnectionFailed', {
          reason: reconnectionResult.reason,
          fallbackOptions: reconnectionResult.fallbackOptions,
          canRetry: reconnectionResult.canRetry,
          retryDelay: reconnectionResult.retryDelay,
          error: reconnectionResult.error
        });
      }
      
      // If this was the current player and grace period is still active, continue waiting
      const flowState = this.activeReconnectionFlows.get(playerId);
      if (flowState && flowState.phase === 'grace_period_active') {
        console.log(`⏳ Grace period still active for ${playerId}, continuing to wait`);
        return;
      }
      
      // If grace period expired or other failure, handle continuation
      if (reconnectionResult.reason === 'grace_period_expired' || 
          reconnectionResult.reason === 'game_ended' ||
          !reconnectionResult.canRetry) {
        
        await this.handleGracePeriodExpiration(playerId, gameId);
      }
      
    } catch (error) {
      console.error(`❌ Error handling reconnection failure:`, error.message);
    }
  }

  /**
   * Handle grace period expiration and continuation options
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   */
  async handleGracePeriodExpiration(playerId, gameId) {
    try {
      console.log(`🔗 Handling grace period expiration for ${playerId} in game ${gameId}`);
      
      // Trigger grace period expiration handling
      const expirationResult = await gamePauseController.handleGracePeriodExpired(gameId);
      
      if (expirationResult.success) {
        console.log(`⏰ Grace period expired for ${gameId}, continuation options presented`);
        
        // Set up voting timeout (e.g., 60 seconds for players to vote)
        setTimeout(async () => {
          try {
            const votingStatus = await gamePauseController.getVotingStatus(gameId);
            if (votingStatus && !votingStatus.isComplete) {
              console.log(`⏰ Voting timeout for ${gameId}, processing with available votes`);
              
              const decision = gamePauseController.determineContinuationDecision(votingStatus.votes);
              await this.processContinuationDecision(gameId, decision, votingStatus.votes);
            }
          } catch (error) {
            console.error(`❌ Error handling voting timeout:`, error.message);
          }
        }, 60000); // 60 second voting timeout
      }
      
      // Clean up flow state
      this.activeReconnectionFlows.delete(playerId);
      
    } catch (error) {
      console.error(`❌ Error handling grace period expiration:`, error.message);
    }
  }

  /**
   * Process continuation decision and execute the chosen action
   * @param {string} gameId - Game ID
   * @param {string} decision - Continuation decision
   * @param {Array} votes - Player votes
   */
  async processContinuationDecision(gameId, decision, votes) {
    try {
      console.log(`🔗 Processing continuation decision for ${gameId}: ${decision}`);
      
      // Process the decision through game pause controller
      const decisionResult = await gamePauseController.processContinuationDecision(gameId, decision, votes);
      
      if (decisionResult.success) {
        // Handle timer based on decision
        await turnTimerManager.handleGracePeriodExpiration(gameId, decision);
        
        // Update game state based on decision
        const game = this.games.get(gameId);
        if (game) {
          switch (decision) {
            case 'skip_turn':
              // Move to next player
              game.nextTurn();
              break;
            case 'add_bot':
              // Bot replacement is handled by the game pause controller
              break;
            case 'end_game':
              // Game ending is handled by the game pause controller
              this.games.delete(gameId);
              break;
          }
        }
        
        console.log(`✅ Continuation decision processed: ${decision}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing continuation decision:`, error.message);
    }
  }

  /**
   * Handle connection quality warnings
   * @param {Object} event - Connection quality warning event
   */
  async handleConnectionQualityWarning(event) {
    try {
      const { playerId, quality, latency, packetLoss, recommendedActions } = event;
      console.log(`🔗 Connection quality warning for ${playerId}: ${quality}`);
      
      // Get connection info to find game
      const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
      if (connectionInfo && connectionInfo.gameId) {
        // Broadcast warning to game players
        this.notificationBroadcaster.broadcastConnectionQualityWarning(connectionInfo.gameId, {
          playerName: playerId,
          quality,
          latency,
          packetLoss,
          recommendedActions
        });
      }
      
    } catch (error) {
      console.error(`❌ Error handling connection quality warning:`, error.message);
    }
  }

  /**
   * Handle network type changes
   * @param {Object} event - Network type changed event
   */
  async handleNetworkTypeChanged(event) {
    try {
      const { playerId, oldNetworkType, newNetworkType } = event;
      console.log(`🔗 Network type changed for ${playerId}: ${oldNetworkType} -> ${newNetworkType}`);
      
      // If switching to cellular, provide proactive warning about potential instability
      if (newNetworkType === 'cellular' && oldNetworkType === 'wifi') {
        const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
        if (connectionInfo && connectionInfo.gameId) {
          this.notificationBroadcaster.broadcastNetworkTypeChange(connectionInfo.gameId, {
            playerName: playerId,
            oldNetworkType,
            newNetworkType,
            warning: 'Player switched to cellular network - connection may be less stable'
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ Error handling network type change:`, error.message);
    }
  }

  /**
   * Add a continuation vote and check for decision completion
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player casting vote
   * @param {string} choice - Vote choice
   */
  async addContinuationVote(gameId, playerId, choice) {
    try {
      console.log(`🔗 Adding continuation vote: ${playerId} votes ${choice} for game ${gameId}`);
      
      const voteResult = await gamePauseController.addContinuationVote(gameId, playerId, choice);
      
      if (voteResult.success && voteResult.readyToProcess) {
        // Process the decision immediately
        await this.processContinuationDecision(gameId, voteResult.decision, [{ playerId, choice }]);
      }
      
      return voteResult;
      
    } catch (error) {
      console.error(`❌ Error adding continuation vote:`, error.message);
      throw error;
    }
  }

  /**
   * Get socket for a player
   * @param {string} playerId - Player ID
   * @returns {Object|null} - Socket or null
   */
  getSocketForPlayer(playerId) {
    // Find socket by player ID in the players map
    for (const [socketId, playerData] of this.players) {
      if (playerData.playerName === playerId || playerData.playerId === playerId) {
        return this.io.sockets.sockets.get(socketId);
      }
    }
    return null;
  }

  /**
   * Get complete game state for synchronization
   * @param {Object} game - Game instance
   * @returns {Object} - Complete game state
   */
  getCompleteGameState(game) {
    return {
      id: game.id,
      players: game.players,
      currentPlayerIndex: game.currentPlayerIndex,
      board: game.board,
      started: game.started,
      winner: game.winner,
      timerEnabled: game.timerEnabled,
      turnTimeLimit: game.turnTimeLimit,
      turnStartTime: game.turnStartTime,
      isBotGame: game.isBotGame,
      chatMessages: game.chatMessages || [],
      gameLog: game.gameLog || []
    };
  }

  /**
   * Handle mobile-specific integration scenarios
   * @param {string} playerId - Player ID
   * @param {string} scenario - Mobile scenario type
   * @param {Object} data - Scenario data
   */
  async handleMobileScenario(playerId, scenario, data = {}) {
    try {
      console.log(`📱 Handling mobile scenario for ${playerId}: ${scenario}`);
      
      const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
      if (!connectionInfo) {
        console.log(`⚠️ No connection info found for ${playerId}`);
        return;
      }
      
      switch (scenario) {
        case 'app_backgrounding':
          // Handle app backgrounding with tolerance
          this.playerConnectionManager.handleMobileBackgrounding(playerId, 'app_backgrounded');
          break;
          
        case 'network_switch':
          // Handle network type switching
          this.playerConnectionManager.handleNetworkTypeChange(playerId, data.newNetworkType);
          break;
          
        case 'poor_signal':
          // Handle poor signal quality
          this.playerConnectionManager.updateConnectionMetrics(playerId, {
            latency: data.latency || 1000,
            packetLoss: data.packetLoss || 0.1,
            timestamp: Date.now()
          });
          break;
          
        default:
          console.log(`⚠️ Unknown mobile scenario: ${scenario}`);
      }
      
    } catch (error) {
      console.error(`❌ Error handling mobile scenario:`, error.message);
    }
  }

  /**
   * Get integration service status for monitoring
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      activeReconnectionFlows: this.activeReconnectionFlows.size,
      playerConnectionManager: this.playerConnectionManager.getStatus(),
      gamePauseController: {
        pausedGames: this.gamePauseController?.pausedGames?.size || 0,
        activeGracePeriods: this.gamePauseController?.gracePeriodTimers?.size || 0
      },
      turnTimerManager: turnTimerManager.getTimerStatistics(),
      timestamp: new Date()
    };
  }

  /**
   * Shutdown the integration service and clean up resources
   */
  shutdown() {
    console.log('🔧 Shutting down Reconnection Integration Service...');
    
    // Clear active flows
    this.activeReconnectionFlows.clear();
    
    // Shutdown individual services
    this.playerConnectionManager.removeAllListeners();
    gamePauseController.shutdown();
    turnTimerManager.shutdown();
    reconnectionHandler.cleanup();
    
    console.log('✅ Reconnection Integration Service shutdown complete');
  }
}

module.exports = ReconnectionIntegrationService;