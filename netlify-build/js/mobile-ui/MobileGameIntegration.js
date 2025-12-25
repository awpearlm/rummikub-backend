/**
 * Mobile Game Integration
 * Connects mobile UI components to existing game logic and networking system
 * Ensures cross-platform compatibility between mobile and desktop players
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

class MobileGameIntegration {
    constructor(mobileUISystem, gameClient) {
        this.mobileUISystem = mobileUISystem;
        this.gameClient = gameClient;
        this.socket = gameClient.socket;
        
        this.isInitialized = false;
        this.currentGameState = null;
        this.currentPlayer = null;
        this.isMyTurn = false;
        
        // Integration state
        this.integrationState = {
            connected: false,
            gameId: null,
            playerId: null,
            playerName: null,
            gameStarted: false,
            crossPlatformMode: false
        };
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup socket event handlers for mobile UI
            this.setupSocketEventHandlers();
            
            // Setup mobile UI event handlers
            this.setupMobileUIEventHandlers();
            
            // Setup game state synchronization
            this.setupGameStateSynchronization();
            
            // Setup cross-platform compatibility
            this.setupCrossPlatformCompatibility();
            
            // Initialize mobile-specific game features
            this.initializeMobileGameFeatures();
            
            this.isInitialized = true;
            console.log('Mobile Game Integration initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Game Integration:', error);
            throw error;
        }
    }

    setupSocketEventHandlers() {
        // Game state updates
        this.socket.on('gameStateUpdate', (data) => {
            this.handleGameStateUpdate(data);
        });
        
        this.socket.on('gameStarted', (data) => {
            this.handleGameStarted(data);
        });
        
        this.socket.on('gameWon', (data) => {
            this.handleGameWon(data);
        });
        
        // Turn management
        this.socket.on('turnEnded', (data) => {
            this.handleTurnEnded(data);
        });
        
        this.socket.on('timerUpdate', (data) => {
            this.handleTimerUpdate(data);
        });
        
        // Tile and board updates
        this.socket.on('setPlayed', (data) => {
            this.handleSetPlayed(data);
        });
        
        this.socket.on('tileDrawn', (data) => {
            this.handleTileDrawn(data);
        });
        
        this.socket.on('boardUpdated', (data) => {
            this.handleBoardUpdated(data);
        });
        
        // Player management
        this.socket.on('playerJoined', (data) => {
            this.handlePlayerJoined(data);
        });
        
        this.socket.on('playerLeft', (data) => {
            this.handlePlayerLeft(data);
        });
        
        // Bot game events
        this.socket.on('botMove', (data) => {
            this.handleBotMove(data);
        });
        
        // Error handling
        this.socket.on('error', (data) => {
            this.handleGameError(data);
        });
        
        // Connection events
        this.socket.on('connect', () => {
            this.handleSocketConnect();
        });
        
        this.socket.on('disconnect', (reason) => {
            this.handleSocketDisconnect(reason);
        });
        
        // Reconnection events
        this.socket.on('reconnect', () => {
            this.handleSocketReconnect();
        });
    }

    setupMobileUIEventHandlers() {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        const mobileLobbyScreen = this.mobileUISystem.getComponent('mobileLobbyScreen');
        const mobileGameCreationScreen = this.mobileUISystem.getComponent('mobileGameCreationScreen');
        
        // Game screen events
        if (mobileGameScreen) {
            mobileGameScreen.on('handDrawerActionClicked', (data) => {
                this.handleMobileGameAction(data);
            });
            
            mobileGameScreen.on('playerAvatarClicked', (data) => {
                this.handlePlayerAvatarClick(data);
            });
            
            mobileGameScreen.on('exitGameRequested', () => {
                this.handleExitGameRequest();
            });
            
            mobileGameScreen.on('gameMenuRequested', () => {
                this.handleGameMenuRequest();
            });
            
            mobileGameScreen.on('boardResetRequested', () => {
                this.handleBoardResetRequest();
            });
        }
        
        // Lobby screen events
        if (mobileLobbyScreen) {
            mobileLobbyScreen.on('gameJoinRequested', (data) => {
                this.handleGameJoinRequest(data);
            });
            
            mobileLobbyScreen.on('gameCreateRequested', (data) => {
                this.handleGameCreateRequest(data);
            });
            
            mobileLobbyScreen.on('playerInviteRequested', (data) => {
                this.handlePlayerInviteRequest(data);
            });
        }
        
        // Game creation screen events
        if (mobileGameCreationScreen) {
            mobileGameCreationScreen.on('gameCreated', (data) => {
                this.handleMobileGameCreated(data);
            });
            
            mobileGameCreationScreen.on('gameStartRequested', () => {
                this.handleGameStartRequest();
            });
        }
    }

    setupGameStateSynchronization() {
        // Sync mobile UI with game state changes
        this.on('gameStateChanged', (gameState) => {
            this.syncMobileUIWithGameState(gameState);
        });
        
        // Sync player state changes
        this.on('playerStateChanged', (playerState) => {
            this.syncMobileUIWithPlayerState(playerState);
        });
        
        // Sync turn state changes
        this.on('turnStateChanged', (turnState) => {
            this.syncMobileUIWithTurnState(turnState);
        });
    }

    setupCrossPlatformCompatibility() {
        // Detect if we're in a cross-platform game
        this.on('gameStateChanged', (gameState) => {
            this.detectCrossPlatformMode(gameState);
        });
        
        // Handle cross-platform specific features
        this.on('crossPlatformModeChanged', (isCrossPlatform) => {
            this.handleCrossPlatformModeChange(isCrossPlatform);
        });
    }

    initializeMobileGameFeatures() {
        // Get mobile systems from the UI system
        const notificationSystem = this.mobileUISystem.getComponent('notificationSystem');
        const hapticSystem = this.mobileUISystem.getComponent('hapticSystem');
        const errorHandlingSystem = this.mobileUISystem.getComponent('errorHandlingSystem');
        
        // Store references for easy access
        this.notificationSystem = notificationSystem;
        this.hapticSystem = hapticSystem;
        this.errorHandlingSystem = errorHandlingSystem;
        
        // Setup error handling integration
        if (errorHandlingSystem) {
            this.setupErrorHandlingIntegration();
        }
    }

    setupErrorHandlingIntegration() {
        // Setup error handling for game-specific errors
        this.errorHandlingSystem.on('retry', (error) => {
            if (error.category === 'network') {
                this.handleNetworkRetry(error);
            } else if (error.category === 'game') {
                this.handleGameRetry(error);
            }
        });
        
        this.errorHandlingSystem.on('fallback', (error) => {
            if (error.category === 'network') {
                this.handleNetworkFallback(error);
            } else if (error.category === 'game') {
                this.handleGameFallback(error);
            }
        });
        
        this.errorHandlingSystem.on('recovery', (error) => {
            this.handleErrorRecovery(error);
        });
    }

    handleNetworkRetry(error) {
        // Retry network operations
        if (this.socket && !this.socket.connected) {
            this.socket.connect();
        }
    }

    handleGameRetry(error) {
        // Retry game operations
        if (this.integrationState.gameId) {
            this.socket.emit('getGameState', { gameId: this.integrationState.gameId });
        }
    }

    handleNetworkFallback(error) {
        // Enable offline mode or show offline message
        this.showMobileNotification('Offline Mode', 'Playing in offline mode', 'warning');
    }

    handleGameFallback(error) {
        // Return to lobby or show game error
        this.mobileUISystem.navigateToLobby();
    }

    // Socket event handlers
    handleGameStateUpdate(data) {
        const gameState = data.gameState;
        this.currentGameState = gameState;
        
        // Update integration state
        this.integrationState.gameId = gameState.id;
        this.integrationState.gameStarted = gameState.started;
        
        // Find current player
        this.currentPlayer = gameState.players.find(p => p.id === this.socket.id);
        this.isMyTurn = gameState.currentPlayerIndex !== undefined && 
                       gameState.players[gameState.currentPlayerIndex]?.id === this.socket.id;
        
        // Emit game state change event
        this.emit('gameStateChanged', gameState);
        
        console.log('Mobile UI: Game state updated', {
            gameId: gameState.id,
            players: gameState.players.length,
            isMyTurn: this.isMyTurn,
            started: gameState.started
        });
    }

    handleGameStarted(data) {
        const gameState = data.gameState;
        this.integrationState.gameStarted = true;
        
        // Navigate to game screen if not already there
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen && !mobileGameScreen.isShown()) {
            this.mobileUISystem.navigateToGame();
        }
        
        // Sync game state
        this.handleGameStateUpdate(data);
        
        // Show game started notification
        this.showMobileNotification('Game Started!', 'The game has begun. Good luck!', 'success');
        
        console.log('Mobile UI: Game started');
    }

    handleGameWon(data) {
        const winner = data.winner;
        const gameState = data.gameState;
        
        // Update game state
        this.currentGameState = gameState;
        
        // Show win/lose notification
        const isWinner = winner.id === this.socket.id;
        const message = isWinner ? 'Congratulations! You won!' : `${winner.name} won the game!`;
        const type = isWinner ? 'success' : 'info';
        
        this.showMobileNotification('Game Over', message, type);
        
        // Trigger haptic feedback
        if (isWinner) {
            this.triggerHapticFeedback('success');
        }
        
        // Emit game won event
        this.emit('gameWon', { winner, gameState, isWinner });
        
        console.log('Mobile UI: Game won', { winner: winner.name, isWinner });
    }

    handleTurnEnded(data) {
        const gameState = data.gameState;
        const currentPlayerId = data.currentPlayerId;
        const isMyTurn = data.isYourTurn;
        
        // Update state
        this.currentGameState = gameState;
        this.isMyTurn = isMyTurn;
        
        // Update mobile UI
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            mobileGameScreen.setIsMyTurn(isMyTurn);
            mobileGameScreen.setCurrentTurnPlayer(currentPlayerId);
        }
        
        // Show turn notification
        if (isMyTurn) {
            this.showMobileNotification('Your Turn', 'It\'s your turn to play!', 'info');
            this.triggerHapticFeedback('turn');
        }
        
        // Emit turn state change
        this.emit('turnStateChanged', { isMyTurn, currentPlayerId, gameState });
        
        console.log('Mobile UI: Turn ended', { isMyTurn, currentPlayerId });
    }

    handleTimerUpdate(data) {
        const remainingTime = data.remainingTime;
        const currentPlayerId = data.currentPlayerId;
        
        // Update timer display in mobile UI
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            // Timer display would be implemented in the game screen
            this.emit('timerUpdate', { remainingTime, currentPlayerId });
        }
        
        // Show low time warning
        if (remainingTime <= 10 && currentPlayerId === this.socket.id) {
            this.showMobileNotification('Time Warning', `${remainingTime} seconds left!`, 'warning');
            this.triggerHapticFeedback('warning');
        }
    }

    handleSetPlayed(data) {
        const gameState = data.gameState;
        
        // Update game state
        this.handleGameStateUpdate({ gameState });
        
        // Show success feedback
        this.triggerHapticFeedback('success');
        
        console.log('Mobile UI: Set played successfully');
    }

    handleTileDrawn(data) {
        const gameState = data.gameState;
        const currentPlayerId = data.currentPlayerId;
        const isMyTurn = data.isYourTurn;
        
        // Update game state
        this.currentGameState = gameState;
        this.isMyTurn = isMyTurn;
        
        // Update mobile UI
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            mobileGameScreen.setIsMyTurn(isMyTurn);
            mobileGameScreen.setCurrentTurnPlayer(currentPlayerId);
            mobileGameScreen.syncHandDrawerWithGame();
        }
        
        // Show tile drawn feedback
        this.triggerHapticFeedback('draw');
        
        console.log('Mobile UI: Tile drawn, turn ended');
    }

    handleBoardUpdated(data) {
        const gameState = data.gameState;
        
        // Update game state
        this.handleGameStateUpdate({ gameState });
        
        console.log('Mobile UI: Board updated');
    }

    handlePlayerJoined(data) {
        const playerName = data.playerName;
        const gameState = data.gameState;
        
        // Update game state
        this.handleGameStateUpdate({ gameState });
        
        // Show player joined notification
        this.showMobileNotification('Player Joined', `${playerName} joined the game`, 'info');
        
        console.log('Mobile UI: Player joined', { playerName });
    }

    handlePlayerLeft(data) {
        const playerName = data.playerName;
        const gameState = data.gameState;
        
        // Update game state
        this.handleGameStateUpdate({ gameState });
        
        // Show player left notification
        this.showMobileNotification('Player Left', `${playerName} left the game`, 'warning');
        
        console.log('Mobile UI: Player left', { playerName });
    }

    handleBotMove(data) {
        const gameState = data.gameState;
        const moveDescription = data.moveDescription;
        
        // Update game state
        this.handleGameStateUpdate({ gameState });
        
        // Show bot move notification
        this.showMobileNotification('Bot Move', `Bot ${moveDescription}`, 'info');
        
        console.log('Mobile UI: Bot move', { moveDescription });
    }

    handleGameError(data) {
        const message = data.message;
        
        // Use comprehensive error handling system
        if (this.errorHandlingSystem) {
            this.errorHandlingSystem.handleGameError({
                message: message,
                type: data.type || 'unknown',
                gameId: this.integrationState.gameId,
                context: 'socket-event'
            });
        } else {
            // Fallback to basic error handling
            this.showMobileNotification('Game Error', message, 'error');
            this.triggerHapticFeedback('error');
        }
        
        console.error('Mobile UI: Game error', { message });
    }

    handleSocketConnect() {
        this.integrationState.connected = true;
        
        // Update connection status in mobile UI
        this.updateMobileConnectionStatus('connected');
        
        console.log('Mobile UI: Socket connected');
    }

    handleSocketDisconnect(reason) {
        this.integrationState.connected = false;
        
        // Use comprehensive error handling system for network errors
        if (this.errorHandlingSystem) {
            this.errorHandlingSystem.handleNetworkError({
                message: 'Connection lost',
                type: 'disconnect',
                reason: reason,
                context: 'socket-disconnect'
            });
        } else {
            // Fallback to basic error handling
            this.updateMobileConnectionStatus('disconnected');
            this.showMobileNotification('Connection Lost', 'Attempting to reconnect...', 'warning');
        }
        
        console.log('Mobile UI: Socket disconnected', { reason });
    }

    handleSocketReconnect() {
        this.integrationState.connected = true;
        
        // Update connection status in mobile UI
        this.updateMobileConnectionStatus('connected');
        
        // Show reconnection notification
        if (this.notificationSystem) {
            this.notificationSystem.showConnectionStatus('connected', 'Connection restored!');
        } else {
            this.showMobileNotification('Reconnected', 'Connection restored!', 'success');
        }
        
        // Request current game state
        if (this.integrationState.gameId) {
            this.socket.emit('getGameState', { gameId: this.integrationState.gameId });
        }
        
        console.log('Mobile UI: Socket reconnected');
    }

    // Mobile UI event handlers
    handleMobileGameAction(data) {
        const action = data.action;
        const actionData = data.data;
        
        switch (action) {
            case 'drawTile':
                this.socket.emit('drawTile');
                break;
                
            case 'endTurn':
                this.socket.emit('endTurn');
                break;
                
            case 'playSet':
                this.socket.emit('playSet', actionData);
                break;
                
            case 'sortTiles':
                // Handle tile sorting locally
                this.handleTileSorting(actionData);
                break;
                
            case 'resetBoard':
                this.socket.emit('restoreBoard');
                break;
                
            default:
                console.warn('Unknown mobile game action:', action);
        }
    }

    handlePlayerAvatarClick(data) {
        const playerId = data.playerId;
        
        // Show player details or stats
        this.showPlayerDetails(playerId);
    }

    handleExitGameRequest() {
        // Confirm exit and navigate to lobby
        if (confirm('Are you sure you want to exit the game?')) {
            this.mobileUISystem.navigateToLobby();
        }
    }

    handleGameMenuRequest() {
        // Show mobile game menu
        this.showMobileGameMenu();
    }

    handleBoardResetRequest() {
        // Request board reset from server
        this.socket.emit('requestUndoTurn');
    }

    handleGameJoinRequest(data) {
        const gameId = data.gameId;
        const playerName = this.integrationState.playerName || 'Mobile Player';
        
        // Join game via socket
        this.socket.emit('joinGame', { gameId, playerName });
    }

    handleGameCreateRequest(data) {
        const gameSettings = data.gameSettings;
        const playerName = this.integrationState.playerName || 'Mobile Player';
        
        // Create game via socket
        if (gameSettings.isBotGame) {
            this.socket.emit('createBotGame', {
                playerName,
                difficulty: gameSettings.botDifficulty,
                botCount: gameSettings.botCount
            });
        } else {
            this.socket.emit('createGame', {
                playerName,
                timerEnabled: gameSettings.timerEnabled,
                isDebugMode: gameSettings.isDebugMode
            });
        }
    }

    handlePlayerInviteRequest(data) {
        const playerId = data.playerId;
        
        // Send player invitation
        this.socket.emit('sendInvitation', { playerId });
    }

    handleMobileGameCreated(data) {
        const gameId = data.gameId;
        
        // Update integration state
        this.integrationState.gameId = gameId;
        
        // Navigate to game screen
        this.mobileUISystem.navigateToGame();
    }

    handleGameStartRequest() {
        // Start the game
        this.socket.emit('startGame');
    }

    // Game state synchronization
    syncMobileUIWithGameState(gameState) {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (!mobileGameScreen) return;
        
        // Update game state
        mobileGameScreen.updateGameState(gameState);
        
        // Update players
        mobileGameScreen.clearAllPlayers();
        gameState.players.forEach(player => {
            mobileGameScreen.addPlayer({
                id: player.id,
                name: player.name,
                handSize: player.handSize,
                hasPlayedInitial: player.hasPlayedInitial,
                score: player.score,
                isBot: player.isBot
            });
        });
        
        // Update current turn
        if (gameState.currentPlayerIndex !== undefined) {
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            if (currentPlayer) {
                mobileGameScreen.setCurrentTurnPlayer(currentPlayer.id);
            }
        }
        
        // Update hand drawer if it's the current player
        if (this.currentPlayer && gameState.playerHand) {
            const handDrawerIntegration = mobileGameScreen.getHandDrawerIntegration();
            if (handDrawerIntegration) {
                handDrawerIntegration.updateTiles(gameState.playerHand);
            }
        }
        
        // Update board if mobile board component exists
        this.updateMobileBoard(gameState.board);
    }

    syncMobileUIWithPlayerState(playerState) {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (!mobileGameScreen) return;
        
        // Update player information
        mobileGameScreen.updatePlayer(playerState);
    }

    syncMobileUIWithTurnState(turnState) {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (!mobileGameScreen) return;
        
        // Update turn state
        mobileGameScreen.setIsMyTurn(turnState.isMyTurn);
        mobileGameScreen.setCurrentTurnPlayer(turnState.currentPlayerId);
        
        // Update action button states
        mobileGameScreen.updateHandDrawerActionStates();
    }

    // Cross-platform compatibility
    detectCrossPlatformMode(gameState) {
        // Detect if there are both mobile and desktop players
        const hasMobilePlayers = gameState.players.some(p => p.isMobile);
        const hasDesktopPlayers = gameState.players.some(p => !p.isMobile);
        
        const isCrossPlatform = hasMobilePlayers && hasDesktopPlayers;
        
        if (isCrossPlatform !== this.integrationState.crossPlatformMode) {
            this.integrationState.crossPlatformMode = isCrossPlatform;
            this.emit('crossPlatformModeChanged', isCrossPlatform);
        }
    }

    handleCrossPlatformModeChange(isCrossPlatform) {
        if (isCrossPlatform) {
            console.log('Mobile UI: Cross-platform mode enabled');
            
            // Apply cross-platform optimizations
            this.applyCrossPlatformOptimizations();
            
            // Show cross-platform notification
            this.showMobileNotification('Cross-Platform Game', 'Playing with desktop players', 'info');
        } else {
            console.log('Mobile UI: Cross-platform mode disabled');
        }
    }

    applyCrossPlatformOptimizations() {
        // Ensure mobile UI is compatible with desktop players
        // This might include:
        // - Synchronizing animation timing
        // - Ensuring consistent game state updates
        // - Handling different input methods gracefully
        
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            // Add cross-platform class for styling
            mobileGameScreen.getContainer().classList.add('cross-platform-mode');
        }
    }

    // Mobile-specific features
    showMobileNotification(title, message, type = 'info') {
        // Use comprehensive notification system if available
        if (this.notificationSystem) {
            this.notificationSystem.show(title, message, type);
        } else {
            // Fallback to basic notification
            this.createBasicNotification(title, message, type);
        }
    }

    triggerHapticFeedback(type) {
        // Use comprehensive haptic system if available
        if (this.hapticSystem) {
            this.hapticSystem.trigger(type);
        } else {
            // Fallback to basic haptic feedback
            this.createBasicHapticFeedback(type);
        }
    }

    createBasicNotification(title, message, type = 'info') {
        // Create and show basic mobile notification (fallback)
        const notification = document.createElement('div');
        notification.className = `mobile-notification mobile-notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        // Close button handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    createBasicHapticFeedback(type) {
        // Basic haptic feedback patterns (fallback)
        if (!('vibrate' in navigator)) return;
        
        const patterns = {
            success: [100, 50, 100],
            error: [200, 100, 200],
            warning: [150],
            turn: [50],
            draw: [25]
        };
        
        const pattern = patterns[type] || [50];
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.warn('Haptic feedback failed:', error);
        }
    }

    // Utility methods
    generateErrorId() {
        return `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    updateMobileConnectionStatus(status) {
        // Update connection status in mobile UI components
        const mobileLobbyScreen = this.mobileUISystem.getComponent('mobileLobbyScreen');
        if (mobileLobbyScreen && mobileLobbyScreen.updateConnectionStatus) {
            mobileLobbyScreen.updateConnectionStatus(status);
        }
    }

    updateMobileBoard(boardState) {
        // Update mobile board component if it exists
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            const gameBoard = mobileGameScreen.getGameBoard();
            if (gameBoard && typeof MobileGameBoard !== 'undefined') {
                // Update board through mobile game board component
                this.emit('boardStateChanged', boardState);
            }
        }
    }

    handleTileSorting(sortData) {
        // Handle tile sorting locally for mobile UI
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            const handDrawerIntegration = mobileGameScreen.getHandDrawerIntegration();
            if (handDrawerIntegration) {
                handDrawerIntegration.sortTiles(sortData.sortType);
            }
        }
    }

    showPlayerDetails(playerId) {
        // Show player details modal
        const player = this.currentGameState?.players.find(p => p.id === playerId);
        if (player) {
            this.showMobileNotification('Player Info', 
                `${player.name} - ${player.handSize} tiles`, 'info');
        }
    }

    showMobileGameMenu() {
        // Show mobile game menu
        const menu = document.createElement('div');
        menu.className = 'mobile-game-menu';
        menu.innerHTML = `
            <div class="menu-content">
                <h3>Game Menu</h3>
                <button class="menu-item" data-action="settings">Settings</button>
                <button class="menu-item" data-action="help">Help</button>
                <button class="menu-item" data-action="exit">Exit Game</button>
                <button class="menu-close">Close</button>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Handle menu actions
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'exit') {
                this.handleExitGameRequest();
            }
            
            // Close menu
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        });
    }

    // Public API
    getIntegrationState() {
        return { ...this.integrationState };
    }

    getCurrentGameState() {
        return this.currentGameState;
    }

    getCurrentPlayer() {
        return this.currentPlayer;
    }

    isPlayerTurn() {
        return this.isMyTurn;
    }

    setPlayerName(playerName) {
        this.integrationState.playerName = playerName;
    }

    // Event system
    on(eventName, callback) {
        if (!this.eventCallbacks.has(eventName)) {
            this.eventCallbacks.set(eventName, new Set());
        }
        this.eventCallbacks.get(eventName).add(callback);
    }

    off(eventName, callback) {
        const callbacks = this.eventCallbacks.get(eventName);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(eventName, data = {}) {
        const callbacks = this.eventCallbacks.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event callback for ${eventName}:`, error);
                }
            });
        }
    }

    // Cleanup
    destroy() {
        // Remove socket event listeners
        this.socket.removeAllListeners();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Reset state
        this.integrationState = {
            connected: false,
            gameId: null,
            playerId: null,
            playerName: null,
            gameStarted: false,
            crossPlatformMode: false
        };
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileGameIntegration;
} else if (typeof window !== 'undefined') {
    window.MobileGameIntegration = MobileGameIntegration;
}