/**
 * Enhanced Client-Side Connection Recovery
 * Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

class ConnectionRecoveryManager {
  constructor(socket, gameManager) {
    this.socket = socket;
    this.gameManager = gameManager;
    
    // Connection state
    this.connectionState = 'disconnected';
    this.reconnectionAttempts = 0;
    this.maxReconnectionAttempts = 10;
    this.reconnectionTimer = null;
    this.heartbeatTimer = null;
    
    // Exponential backoff configuration
    this.reconnectionConfig = {
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitterFactor: 0.1
    };
    
    // State preservation
    this.preservedGameState = null;
    this.preservedPlayerData = null;
    this.lastKnownGameId = null;
    this.lastKnownPlayerName = null;
    
    // Connection monitoring
    this.connectionMetrics = {
      latency: null,
      lastSeen: null,
      connectionQuality: 'unknown'
    };
    
    this.setupEventListeners();
    console.log('🔌 Connection Recovery Manager initialized');
  }

  /**
   * Set up enhanced event listeners
   * Requirements: 4.1, 4.3
   */
  setupEventListeners() {
    // Enhanced connection events
    this.socket.on('connect', () => this.handleConnect());
    this.socket.on('disconnect', (reason) => this.handleDisconnect(reason));
    this.socket.on('connect_error', (error) => this.handleConnectError(error));
    
    // Reconnection events with enhanced handling
    this.socket.on('reconnect_attempt', (attemptNumber) => this.handleReconnectAttempt(attemptNumber));
    this.socket.on('reconnect', (attemptNumber) => this.handleReconnect(attemptNumber));
    this.socket.on('reconnect_error', (error) => this.handleReconnectError(error));
    this.socket.on('reconnect_failed', () => this.handleReconnectFailed());
    
    // Enhanced server events
    this.socket.on('reconnectionSuccessful', (data) => this.handleReconnectionSuccessful(data));
    this.socket.on('reconnectionFailed', (data) => this.handleReconnectionFailed(data));
    this.socket.on('reconnectionGuidance', (data) => this.handleReconnectionGuidance(data));
    this.socket.on('gameStateRestored', (data) => this.handleGameStateRestored(data));
    
    // Connection monitoring events
    this.socket.on('ping', (timestamp) => this.handlePing(timestamp));
    this.socket.on('connectionStatus', (data) => this.handleConnectionStatus(data));
    
    // Player events
    this.socket.on('playerDisconnected', (data) => this.handlePlayerDisconnected(data));
    this.socket.on('playerReconnected', (data) => this.handlePlayerReconnected(data));
    this.socket.on('concurrentDisconnections', (data) => this.handleConcurrentDisconnections(data));
    this.socket.on('singlePlayerRemaining', (data) => this.handleSinglePlayerRemaining(data));
  }

  /**
   * Handle reconnection attempt
   * Requirements: 4.2
   */
  handleReconnectAttempt(attemptNumber) {
    console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    this.updateReconnectionStatus(`Attempting to reconnect... (${attemptNumber})`);
  }

  /**
   * Handle reconnection error
   * Requirements: 4.2
   */
  handleReconnectError(error) {
    console.error('❌ Reconnection error:', error);
    this.updateReconnectionStatus(`Reconnection failed: ${error.message}`);
  }

  /**
   * Handle reconnection failed
   * Requirements: 4.2
   */
  handleReconnectFailed() {
    console.error('❌ All reconnection attempts failed');
    this.handleMaxReconnectionAttemptsReached();
  }

  /**
   * Handle reconnection guidance from server
   * Requirements: 4.2
   */
  handleReconnectionGuidance(data) {
    console.log('🔧 Reconnection guidance received:', data);
    
    const { guidance, actions } = data;
    
    // Show guidance to user
    this.showNotification(guidance, 'info');
    
    // Execute recommended actions
    if (actions && actions.length > 0) {
      actions.forEach(action => {
        this.executeFallbackAction(action);
      });
    }
  }

  /**
   * Handle game state restored event
   * Requirements: 4.3, 4.4
   */
  handleGameStateRestored(data) {
    console.log('✅ Game state restored:', data);
    
    const { gameId, gameState, message } = data;
    
    // Update game manager with restored state
    if (this.gameManager) {
      this.gameManager.gameId = gameId;
      this.gameManager.gameState = gameState;
      this.gameManager.updateGameDisplay();
    }
    
    // Clear preserved state since we've successfully restored
    this.clearPreservedState();
    
    // Show success message
    this.showNotification(message || 'Game state restored successfully', 'success');
  }

  /**
   * Handle successful connection
   * Requirements: 4.1, 4.3
   */
  handleConnect() {
    console.log('✅ Enhanced connection established:', this.socket.id);
    
    this.connectionState = 'connected';
    this.reconnectionAttempts = 0;
    this.clearReconnectionTimer();
    
    // Update UI
    this.updateConnectionStatus('connected');
    this.hideConnectionLostOverlay();
    this.showNotification('Connected to server', 'success');
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
    
    // Attempt to restore game state if we have preserved data
    if (this.preservedGameState && this.lastKnownGameId && this.lastKnownPlayerName) {
      this.attemptGameStateRestore();
    }
  }

  /**
   * Handle disconnection with enhanced logic
   * Requirements: 4.3, 4.5
   */
  handleDisconnect(reason) {
    console.log('🔌 Enhanced disconnect handler:', reason);
    
    this.connectionState = 'disconnected';
    this.stopHeartbeatMonitoring();
    
    // Preserve current game state
    this.preserveCurrentGameState();
    
    // Update UI
    this.updateConnectionStatus('disconnected');
    this.showNotification(`Connection lost: ${reason}. Attempting to reconnect...`, 'error');
    
    // Start enhanced reconnection process
    this.startEnhancedReconnection(reason);
    
    // Show connection lost overlay after delay with appropriate context
    setTimeout(() => {
      if (this.connectionState !== 'connected') {
        this.updateConnectionLostOverlay({
          status: 'Attempting to reconnect automatically...',
          hasActiveGame: this.hasPreservedGameState()
        });
        this.showConnectionLostOverlay();
      }
    }, 5000);
  }

  /**
   * Handle connection errors
   * Requirements: 4.2
   */
  handleConnectError(error) {
    console.error('❌ Enhanced connection error:', error);
    
    this.connectionState = 'error';
    this.updateConnectionStatus('error');
    
    // Report error to server for analysis
    if (this.socket.connected) {
      this.socket.emit('reportConnectionError', {
        error: error.message,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });
    }
  }

  /**
   * Start enhanced reconnection process
   * Requirements: 4.2, 4.3
   */
  startEnhancedReconnection(reason) {
    if (this.reconnectionTimer) return; // Already attempting
    
    console.log('🔄 Starting enhanced reconnection process');
    
    this.connectionState = 'reconnecting';
    this.updateConnectionStatus('reconnecting');
    
    const attemptReconnection = () => {
      if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
        this.handleMaxReconnectionAttemptsReached();
        return;
      }
      
      this.reconnectionAttempts++;
      console.log(`🔄 Enhanced reconnection attempt ${this.reconnectionAttempts}`);
      
      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateReconnectionDelay(this.reconnectionAttempts);
      
      // Update UI with attempt info
      this.updateReconnectionStatus(`Reconnection attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}...`);
      
      // Report attempt to server
      if (this.socket.connected) {
        this.socket.emit('reportReconnectionFailure', {
          playerId: this.lastKnownPlayerName,
          attemptNumber: this.reconnectionAttempts,
          error: reason
        });
      }
      
      // Attempt reconnection
      this.socket.connect();
      
      // Schedule next attempt if this one fails
      this.reconnectionTimer = setTimeout(() => {
        if (this.connectionState !== 'connected') {
          attemptReconnection();
        }
      }, delay);
    };
    
    // Start first attempt immediately
    attemptReconnection();
  }

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   * Requirements: 4.2
   */
  calculateReconnectionDelay(attemptNumber) {
    const baseDelay = this.reconnectionConfig.baseDelay;
    const maxDelay = this.reconnectionConfig.maxDelay;
    const backoffMultiplier = this.reconnectionConfig.backoffMultiplier;
    const jitterFactor = this.reconnectionConfig.jitterFactor;
    
    // Calculate exponential backoff delay
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1),
      maxDelay
    );
    
    // Add jitter to prevent thundering herd problem
    const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(exponentialDelay + jitter, baseDelay);
    
    return Math.round(finalDelay);
  }

  /**
   * Handle successful reconnection
   * Requirements: 4.3, 4.4
   */
  handleReconnect(attemptNumber) {
    console.log(`✅ Enhanced reconnection successful after ${attemptNumber} attempts`);
    
    this.connectionState = 'connected';
    this.reconnectionAttempts = 0;
    this.clearReconnectionTimer();
    
    // Update UI
    this.updateConnectionStatus('connected');
    this.hideConnectionLostOverlay();
    this.showNotification('Reconnected successfully! Resuming game...', 'success');
    
    // Request explicit reconnection to game if we have preserved data
    if (this.lastKnownGameId && this.lastKnownPlayerName) {
      this.requestGameReconnection();
    }
  }

  /**
   * Request game reconnection
   * Requirements: 4.3, 4.4
   */
  requestGameReconnection() {
    console.log(`🔄 Requesting game reconnection: ${this.lastKnownPlayerName} to ${this.lastKnownGameId}`);
    
    this.socket.emit('requestReconnection', {
      gameId: this.lastKnownGameId,
      playerName: this.lastKnownPlayerName,
      playerId: this.lastKnownPlayerName,
      preservedState: this.preservedGameState
    });
  }

  /**
   * Handle successful game reconnection
   * Requirements: 4.3, 4.4
   */
  handleReconnectionSuccessful(data) {
    console.log('✅ Game reconnection successful:', data);
    
    const { gameId, gameState, connectionInfo } = data;
    
    // Restore game state
    this.gameManager.gameId = gameId;
    this.gameManager.gameState = gameState;
    this.gameManager.playerName = this.lastKnownPlayerName;
    
    // Update UI with restored state
    this.gameManager.updateGameDisplay();
    
    // Clear preserved state
    this.clearPreservedState();
    
    // Show success message
    this.showNotification(`Reconnected to game! Welcome back, ${this.lastKnownPlayerName}`, 'success');
    
    // Log reconnection metrics
    console.log(`📊 Reconnection metrics: ${connectionInfo.attempts} attempts, ${Date.now() - connectionInfo.reconnectedAt}ms ago`);
  }

  /**
   * Handle failed game reconnection
   * Requirements: 4.2
   */
  handleReconnectionFailed(data) {
    console.error('❌ Game reconnection failed:', data);
    
    const { reason, message, fallbacks } = data;
    
    // Show error message
    this.showNotification(`Reconnection failed: ${message}`, 'error');
    
    // Present fallback options to user
    this.presentFallbackOptions(fallbacks);
  }

  /**
   * Present fallback options to user (simplified)
   * Requirements: 4.2
   */
  presentFallbackOptions(fallbacks) {
    console.log('🔧 Presenting fallback options:', fallbacks);
    
    // Update the connection lost overlay with failure context
    this.updateConnectionLostOverlay({
      status: 'Automatic reconnection failed. Please try manual reconnection.',
      hasActiveGame: this.hasPreservedGameState()
    });
    
    // Show the overlay
    this.showConnectionLostOverlay();
  }

  /**
   * Update connection lost overlay with current context
   */
  updateConnectionLostOverlay(context = {}) {
    const overlay = document.getElementById('connectionLostOverlay');
    const reconnectionStatus = document.getElementById('reconnectionStatus');
    const reconnectInfo = overlay?.querySelector('.reconnect-info');
    const manualReconnectBtn = document.getElementById('manualReconnectBtn');
    
    if (!overlay || !reconnectionStatus || !manualReconnectBtn) return;
    
    // Check if user has an active game
    const hasActiveGame = this.hasPreservedGameState() || context.hasActiveGame;
    
    if (hasActiveGame) {
      // User has an active game - show reconnection options
      reconnectionStatus.textContent = context.status || 'Attempting to reconnect automatically...';
      if (reconnectInfo) {
        reconnectInfo.textContent = 'If you have an active game, clicking the button below will attempt to restore your game session.';
      }
      manualReconnectBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reconnect to Game';
      manualReconnectBtn.onclick = () => this.attemptGameReconnection();
    } else {
      // No active game - show refresh option
      reconnectionStatus.textContent = context.status || 'Connection lost. Please refresh to continue.';
      if (reconnectInfo) {
        reconnectInfo.textContent = 'You don\'t have any saved games. Clicking the button below will refresh the page.';
      }
      manualReconnectBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Page';
      manualReconnectBtn.onclick = () => window.location.reload();
    }
  }

  /**
   * Create fallback UI (only used if existing overlay is not available)
   */
  createFallbackUI(fallbacks) {
    // Create fallback options UI
    const fallbackContainer = document.createElement('div');
    fallbackContainer.className = 'fallback-options';
    fallbackContainer.innerHTML = `
      <div class="fallback-header">
        <h3>Connection Recovery Options</h3>
        <p>We couldn't restore your connection automatically. Please choose an option:</p>
      </div>
      <div class="fallback-buttons">
        ${fallbacks.map(fallback => `
          <button class="fallback-btn" data-action="${fallback.action}" ${!fallback.available ? 'disabled' : ''}>
            <strong>${fallback.type.replace('_', ' ').toUpperCase()}</strong>
            <span>${fallback.description}</span>
          </button>
        `).join('')}
      </div>
    `;
    
    // Add event listeners
    fallbackContainer.querySelectorAll('.fallback-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.executeFallbackAction(action);
        fallbackContainer.remove();
      });
    });
    
    // Show in overlay
    const overlay = document.querySelector('.connection-lost-overlay') || this.createConnectionLostOverlay();
    overlay.appendChild(fallbackContainer);
  }

  /**
   * Execute fallback action
   * Requirements: 4.2
   */
  executeFallbackAction(action) {
    console.log('🔧 Executing fallback action:', action);
    
    switch (action) {
      case 'refresh_connection':
        this.forceReconnection();
        break;
      case 'restore_local_state':
        this.restoreFromLocalState();
        break;
      case 'switch_transport':
        this.switchConnectionTransport();
        break;
      case 'create_new_game':
        this.createNewGame();
        break;
      default:
        console.warn('Unknown fallback action:', action);
    }
  }

  /**
   * Create new game (fallback action)
   * Requirements: 4.2
   */
  createNewGame() {
    console.log('🎮 Creating new game as fallback');
    
    // Clear any preserved state
    this.clearPreservedState();
    
    // Redirect to game creation
    window.location.href = '/';
    
    this.showNotification('Starting a new game...', 'info');
  }

  /**
   * Attempt game state restore
   * Requirements: 4.3, 4.4
   */
  attemptGameStateRestore() {
    console.log('🔄 Attempting to restore game state');
    
    if (this.lastKnownGameId && this.lastKnownPlayerName) {
      this.requestGameReconnection();
    } else {
      console.warn('⚠️ No preserved game state to restore');
    }
  }

  /**
   * Force reconnection
   * Requirements: 4.2
   */
  forceReconnection() {
    console.log('🔄 Forcing reconnection');
    
    this.reconnectionAttempts = 0;
    this.socket.disconnect();
    
    setTimeout(() => {
      this.socket.connect();
    }, 1000);
  }

  /**
   * Switch connection transport
   * Requirements: 4.2
   */
  switchConnectionTransport() {
    console.log('🔄 Switching connection transport');
    
    // Switch between websocket and polling
    const currentTransports = this.socket.io.opts.transports;
    const newTransports = currentTransports[0] === 'websocket' ? ['polling', 'websocket'] : ['websocket', 'polling'];
    
    this.socket.io.opts.transports = newTransports;
    this.forceReconnection();
    
    this.showNotification(`Switched to ${newTransports[0]} transport, reconnecting...`, 'info');
  }

  /**
   * Preserve current game state
   * Requirements: 4.3
   */
  preserveCurrentGameState() {
    if (this.gameManager.gameState) {
      this.preservedGameState = JSON.parse(JSON.stringify(this.gameManager.gameState));
      this.lastKnownGameId = this.gameManager.gameId;
      this.lastKnownPlayerName = this.gameManager.playerName;
      
      // Also save to localStorage
      localStorage.setItem('rummikub_preserved_state', JSON.stringify({
        gameState: this.preservedGameState,
        gameId: this.lastKnownGameId,
        playerName: this.lastKnownPlayerName,
        preservedAt: Date.now()
      }));
      
      console.log('💾 Game state preserved for recovery');
    }
  }

  /**
   * Check if there's preserved game state
   */
  hasPreservedGameState() {
    const gameInfo = localStorage.getItem('gameInfo');
    const preservedState = localStorage.getItem('rummikub_preserved_state');
    return (gameInfo && gameInfo !== 'null') || (preservedState && preservedState !== 'null');
  }

  /**
   * Get preserved game info
   */
  getPreservedGameInfo() {
    const gameInfo = localStorage.getItem('gameInfo');
    if (gameInfo && gameInfo !== 'null') {
      try {
        return JSON.parse(gameInfo);
      } catch (e) {
        console.warn('Failed to parse gameInfo from localStorage');
      }
    }
    
    const preservedState = localStorage.getItem('rummikub_preserved_state');
    if (preservedState && preservedState !== 'null') {
      try {
        return JSON.parse(preservedState);
      } catch (e) {
        console.warn('Failed to parse preserved state from localStorage');
      }
    }
    
    return null;
  }

  /**
   * Attempt game reconnection
   */
  attemptGameReconnection() {
    if (this.hasPreservedGameState()) {
      // Try to reconnect to the preserved game
      const gameInfo = this.getPreservedGameInfo();
      if (gameInfo && gameInfo.gameId) {
        this.socket.emit('rejoin_game', gameInfo);
        this.showNotification('Attempting to reconnect to your game...', 'info');
      }
    } else {
      // No preserved game, just refresh
      window.location.reload();
    }
  }

  /**
   * Restore from local state
   * Requirements: 4.3
   */
  restoreFromLocalState() {
    try {
      const preserved = localStorage.getItem('rummikub_preserved_state');
      if (preserved) {
        const data = JSON.parse(preserved);
        const timeSincePreserved = Date.now() - data.preservedAt;
        
        // Only restore if preserved recently (within 10 minutes)
        if (timeSincePreserved < 600000) {
          this.preservedGameState = data.gameState;
          this.lastKnownGameId = data.gameId;
          this.lastKnownPlayerName = data.playerName;
          
          this.showNotification('Game state restored from local storage', 'success');
          this.requestGameReconnection();
        } else {
          this.showNotification('Preserved game state is too old to restore', 'warning');
        }
      }
    } catch (error) {
      console.error('Failed to restore from local state:', error);
      this.showNotification('Failed to restore from local storage', 'error');
    }
  }

  /**
   * Clear preserved state
   * Requirements: 4.3
   */
  clearPreservedState() {
    this.preservedGameState = null;
    this.preservedPlayerData = null;
    localStorage.removeItem('rummikub_preserved_state');
    console.log('🧹 Preserved state cleared');
  }

  /**
   * Start heartbeat monitoring
   * Requirements: 4.1
   */
  startHeartbeatMonitoring() {
    this.stopHeartbeatMonitoring();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket.connected) {
        const pingTime = Date.now();
        this.socket.emit('ping', pingTime);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat monitoring
   * Requirements: 4.1
   */
  stopHeartbeatMonitoring() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle ping from server
   * Requirements: 4.1
   */
  handlePing(timestamp) {
    // Respond with pong
    this.socket.emit('pong', timestamp);
  }

  /**
   * Handle connection status updates
   * Requirements: 4.1
   */
  handleConnectionStatus(data) {
    this.connectionMetrics = {
      ...this.connectionMetrics,
      ...data
    };
    
    // Update connection quality indicator
    this.updateConnectionQuality(data.latency);
  }

  /**
   * Update connection quality indicator
   * Requirements: 4.1
   */
  updateConnectionQuality(latency) {
    let quality = 'unknown';
    
    if (latency !== null) {
      if (latency < 100) quality = 'excellent';
      else if (latency < 200) quality = 'good';
      else if (latency < 500) quality = 'fair';
      else quality = 'poor';
    }
    
    this.connectionMetrics.connectionQuality = quality;
    
    // Update UI indicator if it exists
    const indicator = document.querySelector('.connection-quality');
    if (indicator) {
      indicator.className = `connection-quality ${quality}`;
      indicator.textContent = `${latency}ms`;
    }
  }

  /**
   * Handle player disconnected event
   * Requirements: 4.5
   */
  handlePlayerDisconnected(data) {
    console.log('🔌 Player disconnected:', data);
    
    const { playerName, playerId, gameId, reason } = data;
    
    // Update UI to show player as disconnected
    this.showNotification(`${playerName} disconnected (${reason})`, 'warning');
    
    // Update player list if available
    if (this.gameManager && this.gameManager.updatePlayerStatus) {
      this.gameManager.updatePlayerStatus(playerId, 'disconnected');
    }
  }

  /**
   * Handle player reconnected event
   * Requirements: 4.5
   */
  handlePlayerReconnected(data) {
    console.log('🔌 Player reconnected:', data);
    
    const { playerName, playerId, gameId } = data;
    
    // Update UI to show player as reconnected
    this.showNotification(`${playerName} reconnected`, 'success');
    
    // Update player list if available
    if (this.gameManager && this.gameManager.updatePlayerStatus) {
      this.gameManager.updatePlayerStatus(playerId, 'connected');
    }
  }

  /**
   * Handle concurrent disconnections
   * Requirements: 4.5
   */
  handleConcurrentDisconnections(data) {
    console.log('🔌 Concurrent disconnections detected:', data);
    
    const { disconnectedCount, remainingCount, stabilityStatus } = data;
    
    if (stabilityStatus === 'unstable') {
      this.showNotification('Game stability compromised - all players disconnected', 'warning');
    } else {
      this.showNotification(`${disconnectedCount} players disconnected, ${remainingCount} remaining`, 'info');
    }
  }

  /**
   * Handle single player remaining
   * Requirements: 4.5
   */
  handleSinglePlayerRemaining(data) {
    console.log('⚠️ Single player remaining:', data);
    
    const { message, waitTime, options } = data;
    
    // Show options to user
    this.showSinglePlayerOptions(message, options, waitTime);
  }

  /**
   * Show single player options
   * Requirements: 4.5
   */
  showSinglePlayerOptions(message, options, waitTime) {
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'single-player-options';
    optionsContainer.innerHTML = `
      <div class="single-player-header">
        <h3>You're the only player remaining</h3>
        <p>${message}</p>
        <p>Waiting ${Math.round(waitTime / 1000)} seconds for other players...</p>
      </div>
      <div class="single-player-buttons">
        ${options.map(option => `
          <button class="single-player-btn" data-type="${option.type}">
            ${option.description}
          </button>
        `).join('')}
      </div>
    `;
    
    // Add event listeners
    optionsContainer.querySelectorAll('.single-player-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        this.handleSinglePlayerAction(type);
        optionsContainer.remove();
      });
    });
    
    // Show in overlay
    const overlay = document.querySelector('.connection-lost-overlay') || this.createConnectionLostOverlay();
    overlay.appendChild(optionsContainer);
    
    // Auto-remove after wait time
    setTimeout(() => {
      if (optionsContainer.parentNode) {
        optionsContainer.remove();
      }
    }, waitTime);
  }

  /**
   * Handle single player action
   * Requirements: 4.5
   */
  handleSinglePlayerAction(type) {
    console.log('🎮 Single player action:', type);
    
    switch (type) {
      case 'wait':
        this.showNotification('Waiting for other players to reconnect...', 'info');
        break;
      case 'add_bots':
        this.socket.emit('addBotsToGame', { gameId: this.lastKnownGameId });
        break;
      case 'end_game':
        this.socket.emit('endGame', { gameId: this.lastKnownGameId });
        break;
    }
  }

  /**
   * Utility methods for UI updates
   */
  updateConnectionStatus(status) {
    // Implementation depends on existing UI structure
    console.log('🔌 Connection status:', status);
  }

  updateReconnectionStatus(message) {
    // Implementation depends on existing UI structure
    console.log('🔄 Reconnection status:', message);
  }

  showNotification(message, type) {
    // Implementation depends on existing notification system
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
  }

  showConnectionLostOverlay() {
    const overlay = document.getElementById('connectionLostOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      console.log('🔌 Showing connection lost overlay');
    }
  }

  hideConnectionLostOverlay() {
    const overlay = document.getElementById('connectionLostOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      console.log('🔌 Hiding connection lost overlay');
    }
  }

  createConnectionLostOverlay() {
    // Return existing overlay if available
    const existingOverlay = document.getElementById('connectionLostOverlay');
    if (existingOverlay) {
      return existingOverlay;
    }
    
    // Only create new overlay if none exists (shouldn't happen in normal flow)
    console.warn('⚠️ Creating new connection lost overlay - existing overlay not found');
    const overlay = document.createElement('div');
    overlay.id = 'connectionLostOverlay';
    overlay.className = 'connection-lost-overlay';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
    return overlay;
  }

  clearReconnectionTimer() {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
  }

  /**
   * Handle max reconnection attempts reached
   * Requirements: 4.2
   */
  handleMaxReconnectionAttemptsReached() {
    console.error('❌ Maximum reconnection attempts reached');
    
    this.connectionState = 'failed';
    this.updateConnectionStatus('failed');
    
    // Show final fallback options
    const fallbacks = [
      {
        type: 'manual_refresh',
        description: 'Refresh the page manually',
        action: 'refresh_page',
        available: true
      },
      {
        type: 'new_session',
        description: 'Start a new game session',
        action: 'new_session',
        available: true
      }
    ];
    
    this.presentFallbackOptions(fallbacks);
  }

  /**
   * Get current status for debugging
   * Requirements: 4.1
   */
  getStatus() {
    return {
      connectionState: this.connectionState,
      reconnectionAttempts: this.reconnectionAttempts,
      hasPreservedState: !!this.preservedGameState,
      lastKnownGameId: this.lastKnownGameId,
      lastKnownPlayerName: this.lastKnownPlayerName,
      connectionMetrics: this.connectionMetrics
    };
  }
}

// Export for use in main game file
window.ConnectionRecoveryManager = ConnectionRecoveryManager;