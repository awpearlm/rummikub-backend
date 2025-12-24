/**
 * Enhanced Socket Event Handlers for Player Reconnection Management
 * Implements enhanced disconnection event handlers with current vs non-current player logic,
 * disconnection reason classification, and reconnection attempt handling
 * Requirements: 1.1, 1.5, 2.1, 3.5, 4.1, 10.4
 */

class EnhancedSocketEventHandlers {
  constructor(io, games, players, playerConnectionManager, gamePauseController, notificationBroadcaster) {
    this.io = io;
    this.games = games;
    this.players = players;
    this.playerConnectionManager = playerConnectionManager;
    this.gamePauseController = gamePauseController;
    this.notificationBroadcaster = notificationBroadcaster;
    
    // Track disconnection reasons for analytics
    this.disconnectionReasons = new Map(); // socketId -> reason
    this.reconnectionAttempts = new Map(); // socketId -> attempts count
  }

  /**
   * Enhanced disconnection event handler
   * Requirements: 1.1, 1.5, 2.1
   * @param {Object} socket - Socket.IO socket
   * @param {string} reason - Disconnection reason
   */
  async handleEnhancedDisconnection(socket, reason) {
    try {
      console.log(`🔌 Enhanced disconnection handler - Socket: ${socket.id}, Reason: ${reason}`);
      
      const playerData = this.players.get(socket.id);
      if (!playerData) {
        console.log(`No player data found for socket ${socket.id}`);
        return;
      }

      const game = this.games.get(playerData.gameId);
      if (!game) {
        console.log(`No game found for player ${playerData.playerName}`);
        this.players.delete(socket.id);
        return;
      }

      // Classify disconnection reason
      const classifiedReason = this.classifyDisconnectionReason(reason, socket);
      console.log(`📊 Classified disconnection reason: ${classifiedReason}`);
      
      // Store reason for analytics
      this.disconnectionReasons.set(socket.id, {
        reason: classifiedReason,
        timestamp: new Date(),
        playerName: playerData.playerName,
        gameId: playerData.gameId
      });

      // Determine if this is the current player
      const currentPlayer = game.getCurrentPlayer();
      const isCurrentPlayer = currentPlayer?.id === socket.id;
      
      console.log(`🎯 Player ${playerData.playerName} disconnected - Current player: ${isCurrentPlayer ? 'YES' : 'NO'}`);

      // Handle disconnection through Player Connection Manager
      this.playerConnectionManager.handlePotentialDisconnection(socket, reason);

      if (isCurrentPlayer) {
        // Current player disconnection - requires game pause
        await this.handleCurrentPlayerDisconnection(socket, playerData, game, classifiedReason);
      } else {
        // Non-current player disconnection - game continues
        await this.handleNonCurrentPlayerDisconnection(socket, playerData, game, classifiedReason);
      }

      // Check for game cleanup scenarios
      await this.checkGameCleanupConditions(playerData.gameId, game);

    } catch (error) {
      console.error(`❌ Enhanced disconnection handler error:`, error.message);
    }
  }

  /**
   * Handle current player disconnection with pause logic
   * Requirements: 1.1
   * @param {Object} socket - Socket.IO socket
   * @param {Object} playerData - Player data
   * @param {Object} game - Game instance
   * @param {string} classifiedReason - Classified disconnection reason
   */
  async handleCurrentPlayerDisconnection(socket, playerData, game, classifiedReason) {
    try {
      console.log(`🔄 Handling current player disconnection for ${playerData.playerName}`);

      // Skip pause logic for bot games - terminate immediately
      if (game.isBotGame && !socket.id.startsWith('bot_')) {
        console.log(`Human player left bot game ${playerData.gameId}, terminating game`);
        this.games.delete(playerData.gameId);
        this.playerConnectionManager.removePlayer(socket.id);
        return;
      }

      // Skip pause logic if game is not started or already has a winner
      if (!game.started || game.winner) {
        console.log(`Game ${playerData.gameId} not started or already finished, skipping pause logic`);
        game.removePlayer(socket.id);
        this.players.delete(socket.id);
        this.playerConnectionManager.removePlayer(socket.id);
        return;
      }

      // Get connection metrics for grace period calculation
      const connectionStatus = this.playerConnectionManager.getPlayerStatus(socket.id);
      const connectionMetrics = {
        connectionQuality: connectionStatus?.connectionQuality || 'unknown',
        isMobile: connectionStatus?.isMobile || false,
        networkType: connectionStatus?.networkType || 'unknown',
        latency: connectionStatus?.latency || 0,
        packetLoss: 0,
        disconnectionReason: classifiedReason
      };

      // Preserve turn timer state
      const preservedState = {
        remainingTime: game.turnStartTime ? 
          Math.max(0, game.turnTimeLimit * 1000 - (Date.now() - game.turnStartTime)) : 
          game.turnTimeLimit * 1000,
        turnStartTime: game.turnStartTime,
        currentPlayerIndex: game.currentPlayerIndex
      };

      // Clear the current turn timer
      if (game.clearTurnTimer) {
        game.clearTurnTimer();
      }

      // Determine pause reason based on disconnection classification
      let pauseReason = 'CURRENT_PLAYER_DISCONNECT';
      if (classifiedReason === 'NETWORK_INSTABILITY') {
        pauseReason = 'NETWORK_INSTABILITY';
      } else if (classifiedReason === 'MULTIPLE_DISCONNECTS') {
        pauseReason = 'MULTIPLE_DISCONNECTS';
      }

      // Pause the game
      const pauseResult = await this.gamePauseController.pauseGame(
        playerData.gameId,
        pauseReason,
        socket.id,
        preservedState
      );

      if (pauseResult.success) {
        // Start grace period
        const gracePeriodResult = await this.gamePauseController.startGracePeriod(
          playerData.gameId,
          socket.id,
          connectionMetrics
        );

        console.log(`✅ Game ${playerData.gameId} paused with grace period: ${gracePeriodResult.duration}ms`);
      } else {
        console.warn(`⚠️ Failed to pause game ${playerData.gameId}: ${pauseResult.reason}`);
        // Fallback to moving to next turn
        if (game.nextTurn) {
          game.nextTurn();
        }
        this.io.to(playerData.gameId).emit('playerLeft', {
          playerName: playerData.playerName,
          gameState: game.getPublicGameState ? game.getPublicGameState() : {},
          message: 'Current player disconnected, moving to next turn'
        });
      }

    } catch (error) {
      console.error(`❌ Error handling current player disconnection:`, error.message);
      // Fallback behavior
      if (game.nextTurn) {
        game.nextTurn();
      }
      this.io.to(playerData.gameId).emit('playerLeft', {
        playerName: playerData.playerName,
        gameState: game.getPublicGameState ? game.getPublicGameState() : {},
        message: 'Current player disconnected, moving to next turn'
      });
    }
  }

  /**
   * Handle non-current player disconnection
   * Requirements: 1.5
   * @param {Object} socket - Socket.IO socket
   * @param {Object} playerData - Player data
   * @param {Object} game - Game instance
   * @param {string} classifiedReason - Classified disconnection reason
   */
  async handleNonCurrentPlayerDisconnection(socket, playerData, game, classifiedReason) {
    try {
      console.log(`📝 Handling non-current player disconnection for ${playerData.playerName}`);

      // Remove player from game first
      game.removePlayer(socket.id);

      // Update player status but don't pause the game
      this.io.to(playerData.gameId).emit('playerStatusUpdate', {
        playerId: socket.id,
        playerName: playerData.playerName,
        status: 'DISCONNECTED',
        reason: classifiedReason,
        message: `${playerData.playerName} disconnected`,
        gameState: game.getPublicGameState ? game.getPublicGameState() : {},
        timestamp: new Date()
      });

      // Broadcast notification about non-current player disconnection
      this.notificationBroadcaster.broadcastPlayerDisconnected(playerData.gameId, {
        playerName: playerData.playerName,
        playerId: socket.id,
        isCurrentPlayer: false,
        reason: classifiedReason,
        disconnectedAt: new Date()
      });

      // Clean up player data
      this.players.delete(socket.id);
      this.playerConnectionManager.removePlayer(socket.id);

      console.log(`✅ Non-current player ${playerData.playerName} disconnection handled`);

    } catch (error) {
      console.error(`❌ Error handling non-current player disconnection:`, error.message);
    }
  }

  /**
   * Enhanced reconnection attempt handler
   * Requirements: 2.1
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Reconnection data
   */
  async handleReconnectionAttempt(socket, data) {
    try {
      const { gameId, playerId, attemptNumber = 1 } = data;
      console.log(`🔄 Enhanced reconnection attempt #${attemptNumber}: ${playerId} to game ${gameId}`);

      // Track reconnection attempts
      const attemptKey = `${playerId}_${gameId}`;
      this.reconnectionAttempts.set(attemptKey, attemptNumber);

      const game = this.games.get(gameId);
      if (!game) {
        socket.emit('reconnectionFailed', { 
          reason: 'game_not_found',
          message: 'Game no longer exists',
          attemptNumber
        });
        return;
      }

      // Check if game is paused and waiting for this player
      const pauseStatus = await this.gamePauseController.getPauseStatus(gameId);
      
      if (pauseStatus && pauseStatus.isPaused && pauseStatus.gracePeriod.targetPlayerId === playerId) {
        // This is the player we're waiting for!
        console.log(`✅ Target player ${playerId} reconnecting to paused game ${gameId}`);
        
        await this.processSuccessfulReconnection(socket, gameId, playerId, game, pauseStatus, attemptNumber);
        
      } else if (pauseStatus && pauseStatus.isPaused) {
        // Game is paused but waiting for a different player
        socket.emit('reconnectionFailed', { 
          reason: 'waiting_for_other_player',
          message: `Game is paused waiting for ${pauseStatus.gracePeriod.targetPlayerName}`,
          waitingFor: pauseStatus.gracePeriod.targetPlayerName,
          attemptNumber
        });
        
      } else {
        // Game is not paused - check if player can rejoin normally
        const playerExists = game.players.find(p => p.id === playerId);
        
        if (playerExists) {
          // Player can rejoin the active game
          await this.processNormalReconnection(socket, gameId, playerId, game, attemptNumber);
        } else {
          socket.emit('reconnectionFailed', { 
            reason: 'player_not_in_game',
            message: 'You are not a player in this game',
            attemptNumber
          });
        }
      }

    } catch (error) {
      console.error(`❌ Enhanced reconnection attempt error:`, error.message);
      socket.emit('reconnectionFailed', { 
        reason: 'server_error',
        message: 'Server error during reconnection attempt',
        attemptNumber: data.attemptNumber || 1
      });
    }
  }

  /**
   * Process successful reconnection to paused game
   * @param {Object} socket - Socket.IO socket
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @param {Object} game - Game instance
   * @param {Object} pauseStatus - Current pause status
   * @param {number} attemptNumber - Reconnection attempt number
   */
  async processSuccessfulReconnection(socket, gameId, playerId, game, pauseStatus, attemptNumber) {
    try {
      // Register the reconnection
      this.playerConnectionManager.handleReconnection(socket, gameId, playerId);
      
      // Update player data
      this.players.set(socket.id, { 
        gameId, 
        playerName: playerId,
        reconnectedAt: new Date(),
        attemptNumber
      });
      socket.join(gameId);
      
      // Resume the game
      const resumeResult = await this.gamePauseController.resumeGame(gameId, playerId, {
        reconnectedAt: new Date(),
        socketId: socket.id,
        attemptNumber
      });
      
      if (resumeResult.success) {
        // Restore turn timer if needed
        if (pauseStatus.turnTimer && pauseStatus.turnTimer.remainingTime > 0) {
          game.turnStartTime = Date.now() - (game.turnTimeLimit * 1000 - pauseStatus.turnTimer.remainingTime);
          if (game.startTurnTimer) {
            game.startTurnTimer();
          }
        }
        
        // Send personalized game state to reconnected player
        socket.emit('reconnectionSuccessful', {
          gameState: game.getGameState ? game.getGameState(socket.id) : {},
          message: 'Successfully reconnected to the game!',
          pauseDuration: resumeResult.pauseDuration,
          attemptNumber
        });
        
        console.log(`✅ Player ${playerId} successfully reconnected to game ${gameId} after ${attemptNumber} attempts`);
        
        // Clear reconnection attempts tracking
        const attemptKey = `${playerId}_${gameId}`;
        this.reconnectionAttempts.delete(attemptKey);
        
      } else {
        socket.emit('reconnectionFailed', { 
          reason: 'resume_failed',
          message: 'Failed to resume game after reconnection',
          attemptNumber
        });
      }
      
    } catch (error) {
      console.error(`❌ Error processing successful reconnection:`, error.message);
      socket.emit('reconnectionFailed', { 
        reason: 'processing_error',
        message: 'Error processing reconnection',
        attemptNumber
      });
    }
  }

  /**
   * Process normal reconnection to active game
   * @param {Object} socket - Socket.IO socket
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @param {Object} game - Game instance
   * @param {number} attemptNumber - Reconnection attempt number
   */
  async processNormalReconnection(socket, gameId, playerId, game, attemptNumber) {
    try {
      // Register the reconnection
      this.playerConnectionManager.handleReconnection(socket, gameId, playerId);
      
      // Update player data
      this.players.set(socket.id, { 
        gameId, 
        playerName: playerId,
        reconnectedAt: new Date(),
        attemptNumber
      });
      socket.join(gameId);
      
      // Send current game state
      socket.emit('reconnectionSuccessful', {
        gameState: game.getGameState ? game.getGameState(socket.id) : {},
        message: 'Reconnected to active game!',
        attemptNumber
      });
      
      // Notify other players
      this.io.to(gameId).emit('playerReconnected', {
        playerId: socket.id,
        playerName: playerId,
        message: `${playerId} reconnected to the game`,
        attemptNumber
      });
      
      console.log(`✅ Player ${playerId} reconnected to active game ${gameId}`);
      
    } catch (error) {
      console.error(`❌ Error processing normal reconnection:`, error.message);
      socket.emit('reconnectionFailed', { 
        reason: 'processing_error',
        message: 'Error processing reconnection',
        attemptNumber
      });
    }
  }

  /**
   * Classify disconnection reason for better handling
   * Requirements: 2.1
   * @param {string} reason - Raw disconnection reason
   * @param {Object} socket - Socket.IO socket
   * @returns {string} - Classified reason
   */
  classifyDisconnectionReason(reason, socket) {
    // Get connection status for additional context
    const connectionStatus = this.playerConnectionManager.getPlayerStatus(socket.id);
    
    // Classify based on Socket.IO disconnect reasons
    switch (reason) {
      case 'transport close':
      case 'transport error':
        return connectionStatus?.connectionQuality === 'poor' ? 'NETWORK_INSTABILITY' : 'CONNECTION_LOST';
      
      case 'client namespace disconnect':
      case 'server namespace disconnect':
        return 'INTENTIONAL_DISCONNECT';
      
      case 'ping timeout':
        return 'NETWORK_TIMEOUT';
      
      case 'server shutting down':
        return 'SERVER_SHUTDOWN';
      
      default:
        // Check for mobile-specific patterns
        if (connectionStatus?.isMobile) {
          return 'MOBILE_INTERRUPTION';
        }
        
        return 'UNKNOWN_DISCONNECT';
    }
  }

  /**
   * Check game cleanup conditions after disconnection
   * Requirements: 10.4
   * @param {string} gameId - Game ID
   * @param {Object} game - Game instance
   */
  async checkGameCleanupConditions(gameId, game) {
    try {
      // Remove player from game
      const remainingPlayers = game.players.filter(p => this.players.has(p.id));
      
      if (remainingPlayers.length === 0) {
        // All players disconnected - handle game abandonment
        console.log(`🗑️ All players disconnected from game ${gameId}, initiating cleanup`);
        
        await this.gamePauseController.handleGameAbandonment(gameId, 'ALL_PLAYERS_DISCONNECT');
        this.games.delete(gameId);
        
        console.log(`✅ Game ${gameId} cleaned up due to total abandonment`);
        
      } else if (remainingPlayers.length === 1 && game.started && !game.winner) {
        // Only one player left in started game
        console.log(`⏸️ Only one player left in game ${gameId}`);
        
        const lastPlayer = remainingPlayers[0];
        this.io.to(gameId).emit('singlePlayerRemaining', {
          playerId: lastPlayer.id,
          playerName: lastPlayer.name,
          gameState: game.getGameState ? game.getGameState(lastPlayer.id) : {},
          message: 'You are the only player remaining. Waiting for others to reconnect or new players to join...'
        });
      }
      
    } catch (error) {
      console.error(`❌ Error checking game cleanup conditions:`, error.message);
    }
  }

  /**
   * Handle grace period expiration event
   * Requirements: 3.5, 4.1
   * @param {string} gameId - Game ID
   * @param {string} targetPlayerId - Player who was disconnected
   */
  async handleGracePeriodExpiration(gameId, targetPlayerId) {
    try {
      console.log(`⏰ Handling grace period expiration for game ${gameId}, player: ${targetPlayerId}`);
      
      const game = this.games.get(gameId);
      if (!game) {
        console.log(`⚠️ Game ${gameId} not found for grace period expiration`);
        return;
      }

      // Handle grace period expiration through Game Pause Controller
      const expirationResult = await this.gamePauseController.handleGracePeriodExpired(gameId);
      
      if (expirationResult.success) {
        // Emit grace period expired event to all players
        this.io.to(gameId).emit('gracePeriodExpired', {
          gameId,
          targetPlayerId,
          targetPlayerName: targetPlayerId, // TODO: Get actual player name
          expiredAt: expirationResult.expiredAt,
          continuationOptions: expirationResult.continuationOptions,
          message: `Grace period expired for ${targetPlayerId}. Please choose how to continue the game.`
        });

        // Emit continuation options to remaining players
        this.io.to(gameId).emit('continuationOptionsPresented', {
          gameId,
          targetPlayerId,
          targetPlayerName: targetPlayerId, // TODO: Get actual player name
          options: expirationResult.continuationOptions,
          descriptions: {
            skip_turn: 'Skip the disconnected player\'s turn and continue with the next player',
            add_bot: 'Replace the disconnected player with a bot player',
            end_game: 'End the game due to player disconnection'
          },
          votingInstructions: 'All remaining players must vote to decide how to continue'
        });

        console.log(`✅ Grace period expiration handled for game ${gameId}`);
      } else {
        console.warn(`⚠️ Failed to handle grace period expiration for game ${gameId}: ${expirationResult.reason}`);
      }

    } catch (error) {
      console.error(`❌ Error handling grace period expiration for game ${gameId}:`, error.message);
      
      // Fallback: emit error to players
      this.io.to(gameId).emit('gracePeriodError', {
        gameId,
        targetPlayerId,
        error: 'Failed to process grace period expiration',
        message: 'There was an error processing the grace period. The game may need to be restarted.'
      });
    }
  }

  /**
   * Handle continuation voting event
   * Requirements: 4.2, 4.3, 4.4, 4.5
   * @param {Object} socket - Socket.IO socket
   * @param {Object} voteData - Vote data
   */
  async handleContinuationVote(socket, voteData) {
    try {
      const { gameId, choice } = voteData;
      const playerData = this.players.get(socket.id);
      
      if (!playerData || playerData.gameId !== gameId) {
        socket.emit('voteError', {
          error: 'invalid_player',
          message: 'You are not a valid player in this game'
        });
        return;
      }

      console.log(`🗳️ Handling continuation vote from ${playerData.playerName} for game ${gameId}: ${choice}`);

      // Add the vote through Game Pause Controller
      const voteResult = await this.gamePauseController.addContinuationVote(
        gameId, 
        socket.id, 
        choice
      );

      if (voteResult.success) {
        // Emit vote confirmation to the voter
        socket.emit('voteConfirmed', {
          gameId,
          playerId: socket.id,
          playerName: playerData.playerName,
          choice,
          totalVotes: voteResult.totalVotes,
          totalPlayers: voteResult.totalPlayers,
          message: `Your vote for "${choice}" has been recorded`
        });

        // Broadcast voting progress to all players
        this.io.to(gameId).emit('votingProgress', {
          gameId,
          voterName: playerData.playerName,
          choice,
          totalVotes: voteResult.totalVotes,
          totalPlayers: voteResult.totalPlayers,
          votesNeeded: Math.max(0, voteResult.totalPlayers - voteResult.totalVotes),
          message: `${playerData.playerName} voted for "${choice}". ${voteResult.totalVotes}/${voteResult.totalPlayers} votes received.`
        });

        // If ready to process decision, handle it
        if (voteResult.readyToProcess) {
          await this.processContinuationDecision(gameId, voteResult.decision, voteResult.totalVotes);
        }

        console.log(`✅ Continuation vote processed for game ${gameId}`);
      } else {
        socket.emit('voteError', {
          error: 'vote_failed',
          message: 'Failed to record your vote. Please try again.'
        });
      }

    } catch (error) {
      console.error(`❌ Error handling continuation vote:`, error.message);
      
      socket.emit('voteError', {
        error: 'server_error',
        message: 'Server error while processing your vote'
      });
    }
  }

  /**
   * Process continuation decision and execute chosen action
   * Requirements: 4.2, 4.3, 4.4, 4.5
   * @param {string} gameId - Game ID
   * @param {string} decision - Chosen decision
   * @param {number} totalVotes - Total votes received
   */
  async processContinuationDecision(gameId, decision, totalVotes) {
    try {
      console.log(`🎯 Processing continuation decision for game ${gameId}: ${decision}`);

      const game = this.games.get(gameId);
      if (!game) {
        console.log(`⚠️ Game ${gameId} not found for continuation decision processing`);
        return;
      }

      // Process the decision through Game Pause Controller
      const decisionResult = await this.gamePauseController.processContinuationDecision(
        gameId, 
        decision, 
        [] // votes array - would be populated in real implementation
      );

      if (decisionResult.success) {
        // Emit decision result to all players
        this.io.to(gameId).emit('continuationDecisionMade', {
          gameId,
          decision,
          action: decisionResult.action,
          totalVotes,
          message: this.getContinuationDecisionMessage(decision, decisionResult.action),
          timestamp: new Date()
        });

        // Handle specific decision actions
        switch (decision) {
          case 'skip_turn':
            await this.handleSkipTurnDecision(gameId, game, decisionResult.action);
            break;
          case 'add_bot':
            await this.handleAddBotDecision(gameId, game, decisionResult.action);
            break;
          case 'end_game':
            await this.handleEndGameDecision(gameId, game, decisionResult.action);
            break;
        }

        console.log(`✅ Continuation decision processed successfully for game ${gameId}: ${decision}`);
      } else {
        // Emit error to all players
        this.io.to(gameId).emit('continuationDecisionError', {
          gameId,
          decision,
          error: 'Failed to process continuation decision',
          message: 'There was an error processing the continuation decision. Please try voting again.'
        });
      }

    } catch (error) {
      console.error(`❌ Error processing continuation decision for game ${gameId}:`, error.message);
      
      this.io.to(gameId).emit('continuationDecisionError', {
        gameId,
        decision,
        error: 'server_error',
        message: 'Server error while processing continuation decision'
      });
    }
  }

  /**
   * Handle skip turn decision execution
   * @param {string} gameId - Game ID
   * @param {Object} game - Game instance
   * @param {Object} actionResult - Action result from pause controller
   */
  async handleSkipTurnDecision(gameId, game, actionResult) {
    try {
      console.log(`⏭️ Executing skip turn decision for game ${gameId}`);

      // Move to next turn
      if (game.nextTurn) {
        game.nextTurn();
      }

      // Restart turn timer if available
      if (game.startTurnTimer) {
        game.startTurnTimer();
      }

      // Emit game resumed with skip turn
      this.io.to(gameId).emit('gameResumedWithSkip', {
        gameId,
        skippedPlayerId: actionResult.targetPlayerId,
        currentPlayer: game.getCurrentPlayer(),
        gameState: game.getPublicGameState ? game.getPublicGameState() : {},
        message: `Turn skipped. Game continues with ${game.getCurrentPlayer()?.name || 'next player'}.`
      });

      console.log(`✅ Skip turn decision executed for game ${gameId}`);

    } catch (error) {
      console.error(`❌ Error executing skip turn decision for game ${gameId}:`, error.message);
    }
  }

  /**
   * Handle add bot decision execution
   * @param {string} gameId - Game ID
   * @param {Object} game - Game instance
   * @param {Object} actionResult - Action result from pause controller
   */
  async handleAddBotDecision(gameId, game, actionResult) {
    try {
      console.log(`🤖 Executing add bot decision for game ${gameId}`);

      // Restart turn timer with preserved time if available
      if (game.startTurnTimer) {
        game.startTurnTimer();
      }

      // Emit game resumed with bot replacement
      this.io.to(gameId).emit('gameResumedWithBot', {
        gameId,
        replacedPlayerId: actionResult.targetPlayerId,
        botName: actionResult.botName,
        currentPlayer: game.getCurrentPlayer(),
        gameState: game.getPublicGameState ? game.getPublicGameState() : {},
        message: `${actionResult.targetPlayerId} has been replaced by ${actionResult.botName}. Game continues.`
      });

      console.log(`✅ Add bot decision executed for game ${gameId}`);

    } catch (error) {
      console.error(`❌ Error executing add bot decision for game ${gameId}:`, error.message);
    }
  }

  /**
   * Handle end game decision execution
   * @param {string} gameId - Game ID
   * @param {Object} game - Game instance
   * @param {Object} actionResult - Action result from pause controller
   */
  async handleEndGameDecision(gameId, game, actionResult) {
    try {
      console.log(`🏁 Executing end game decision for game ${gameId}`);

      // Mark game as ended
      if (game.endGame) {
        game.endGame(null); // No winner
      }

      // Emit game ended
      this.io.to(gameId).emit('gameEndedByDecision', {
        gameId,
        reason: 'player_disconnection',
        message: 'Game ended due to player disconnection and group decision.',
        finalGameState: game.getPublicGameState ? game.getPublicGameState() : {},
        endedAt: new Date()
      });

      // Clean up the game
      await this.cleanupEndedGame(gameId);

      console.log(`✅ End game decision executed for game ${gameId}`);

    } catch (error) {
      console.error(`❌ Error executing end game decision for game ${gameId}:`, error.message);
    }
  }

  /**
   * Handle game cleanup for abandoned games
   * Requirements: 10.4
   * @param {string} gameId - Game ID
   * @param {string} reason - Cleanup reason
   */
  async handleGameCleanup(gameId, reason = 'ABANDONED') {
    try {
      console.log(`🧹 Handling game cleanup for ${gameId} - Reason: ${reason}`);

      const game = this.games.get(gameId);
      if (!game) {
        console.log(`⚠️ Game ${gameId} not found for cleanup`);
        return;
      }

      // Handle abandonment through Game Pause Controller
      const abandonmentResult = await this.gamePauseController.handleGameAbandonment(gameId, reason);

      if (abandonmentResult.success) {
        // Notify any remaining connected players
        this.io.to(gameId).emit('gameAbandoned', {
          gameId,
          reason,
          abandonedAt: abandonmentResult.abandonedAt,
          message: 'Game has been abandoned due to all players disconnecting.',
          finalMessage: 'You will be redirected to the main menu.'
        });

        // Clean up the game from memory
        await this.cleanupEndedGame(gameId);

        console.log(`✅ Game cleanup completed for ${gameId}`);
      } else {
        console.warn(`⚠️ Failed to handle game abandonment for ${gameId}`);
      }

    } catch (error) {
      console.error(`❌ Error handling game cleanup for ${gameId}:`, error.message);
    }
  }

  /**
   * Clean up ended game resources
   * @param {string} gameId - Game ID
   */
  async cleanupEndedGame(gameId) {
    try {
      console.log(`🗑️ Cleaning up ended game resources for ${gameId}`);

      // Remove game from games map
      this.games.delete(gameId);

      // Remove all players associated with this game
      for (const [socketId, playerData] of this.players.entries()) {
        if (playerData.gameId === gameId) {
          this.players.delete(socketId);
          this.playerConnectionManager.removePlayer(socketId);
        }
      }

      // Clean up disconnection tracking for this game
      for (const [socketId, data] of this.disconnectionReasons.entries()) {
        if (data.gameId === gameId) {
          this.disconnectionReasons.delete(socketId);
        }
      }

      // Clean up reconnection attempts for this game
      for (const [attemptKey] of this.reconnectionAttempts.entries()) {
        if (attemptKey.includes(gameId)) {
          this.reconnectionAttempts.delete(attemptKey);
        }
      }

      console.log(`✅ Game resources cleaned up for ${gameId}`);

    } catch (error) {
      console.error(`❌ Error cleaning up game resources for ${gameId}:`, error.message);
    }
  }

  /**
   * Get continuation decision message
   * @param {string} decision - The decision made
   * @param {Object} actionResult - Action result
   * @returns {string} - Human-readable message
   */
  getContinuationDecisionMessage(decision, actionResult) {
    switch (decision) {
      case 'skip_turn':
        return `Players voted to skip the disconnected player's turn. Game continues with the next player.`;
      case 'add_bot':
        return `Players voted to replace the disconnected player with a bot. ${actionResult.botName || 'Bot player'} has joined the game.`;
      case 'end_game':
        return `Players voted to end the game due to the disconnection. The game has been concluded.`;
      default:
        return `Continuation decision "${decision}" has been processed.`;
    }
  }

  /**
   * Get disconnection analytics
   * Requirements: 10.4
   * @returns {Object} - Disconnection analytics data
   */
  getDisconnectionAnalytics() {
    const analytics = {
      totalDisconnections: this.disconnectionReasons.size,
      reasonBreakdown: {},
      recentDisconnections: [],
      reconnectionAttempts: this.reconnectionAttempts.size
    };
    
    // Count reasons
    for (const [socketId, data] of this.disconnectionReasons) {
      analytics.reasonBreakdown[data.reason] = (analytics.reasonBreakdown[data.reason] || 0) + 1;
      
      // Include recent disconnections (last hour)
      if (Date.now() - data.timestamp.getTime() < 3600000) {
        analytics.recentDisconnections.push({
          playerName: data.playerName,
          gameId: data.gameId,
          reason: data.reason,
          timestamp: data.timestamp
        });
      }
    }
    
    return analytics;
  }

  /**
   * Cleanup old disconnection data
   */
  cleanup() {
    const oneHourAgo = Date.now() - 3600000;
    
    // Clean up old disconnection reasons
    for (const [socketId, data] of this.disconnectionReasons) {
      if (data.timestamp.getTime() < oneHourAgo) {
        this.disconnectionReasons.delete(socketId);
      }
    }
    
    console.log(`🧹 Cleaned up old disconnection data`);
  }
}

module.exports = EnhancedSocketEventHandlers;