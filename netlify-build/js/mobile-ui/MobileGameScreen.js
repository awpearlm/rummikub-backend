/**
 * Mobile Game Screen Component
 * Provides the core gameplay interface in landscape orientation with three-tier layout
 * Handles player avatars, game board, and sliding hand drawer
 */

class MobileGameScreen {
    constructor() {
        this.isInitialized = false;
        this.isVisible = false;
        this.currentGameState = null;
        this.currentPlayer = null;
        this.isMyTurn = false;
        
        // Layout configuration
        this.layoutConfig = {
            orientation: 'landscape',
            avatarHeight: 60,
            drawerCollapsedHeight: 80,
            drawerExpandedHeight: 240,
            boardPadding: 16,
            safeAreaHandling: true
        };
        
        // Component references
        this.components = {
            container: null,
            topBar: null,
            gameArea: null,
            bottomDrawer: null,
            playerAvatarSystem: null,
            gameBoard: null,
            handDrawer: null
        };
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Create the main container structure
            this.createLayoutStructure();
            
            // Setup responsive sizing
            this.setupResponsiveSizing();
            
            // Setup safe area handling
            this.setupSafeAreaHandling();
            
            // Initialize player avatar system
            this.initializePlayerAvatarSystem();
            
            // Initialize hand drawer component
            this.initializeHandDrawerComponent();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Apply landscape optimizations
            this.applyLandscapeOptimizations();
            
            this.isInitialized = true;
            console.log('Mobile Game Screen initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Game Screen:', error);
            throw error;
        }
    }

    createLayoutStructure() {
        // Create main container
        this.components.container = document.createElement('div');
        this.components.container.className = 'mobile-game-screen safe-area-container';
        this.components.container.id = 'mobileGameScreen';
        
        // Create three-tier layout structure
        this.createTopBar();
        this.createGameArea();
        this.createBottomDrawer();
        
        // Assemble the layout
        this.components.container.appendChild(this.components.topBar);
        this.components.container.appendChild(this.components.gameArea);
        this.components.container.appendChild(this.components.bottomDrawer);
        
        // Initially hide the screen
        this.components.container.style.display = 'none';
        
        // Add to document body
        document.body.appendChild(this.components.container);
    }

    createTopBar() {
        this.components.topBar = document.createElement('div');
        this.components.topBar.className = 'mobile-game-top-bar';
        
        // Create player avatars container
        const avatarsContainer = document.createElement('div');
        avatarsContainer.className = 'mobile-game-avatars-container';
        avatarsContainer.id = 'playerAvatarsContainer';
        
        // Create system controls container
        const systemControls = document.createElement('div');
        systemControls.className = 'mobile-game-system-controls';
        
        // Add menu button
        const menuButton = document.createElement('button');
        menuButton.className = 'mobile-button mobile-game-menu-button touch-target';
        menuButton.innerHTML = '☰';
        menuButton.setAttribute('aria-label', 'Game menu');
        systemControls.appendChild(menuButton);
        
        // Add exit button
        const exitButton = document.createElement('button');
        exitButton.className = 'mobile-button mobile-game-exit-button touch-target';
        exitButton.innerHTML = '✕';
        exitButton.setAttribute('aria-label', 'Exit game');
        systemControls.appendChild(exitButton);
        
        this.components.topBar.appendChild(avatarsContainer);
        this.components.topBar.appendChild(systemControls);
    }

    createGameArea() {
        this.components.gameArea = document.createElement('div');
        this.components.gameArea.className = 'mobile-game-area';
        
        // Create game board container
        const boardContainer = document.createElement('div');
        boardContainer.className = 'mobile-game-board-container';
        boardContainer.id = 'mobileGameBoard';
        
        // Create board overlay for UI elements
        const boardOverlay = document.createElement('div');
        boardOverlay.className = 'mobile-game-board-overlay';
        
        this.components.gameArea.appendChild(boardContainer);
        this.components.gameArea.appendChild(boardOverlay);
        
        // Store reference to board container
        this.components.gameBoard = boardContainer;
    }

    createBottomDrawer() {
        this.components.bottomDrawer = document.createElement('div');
        this.components.bottomDrawer.className = 'mobile-game-bottom-drawer';
        
        // Create hand drawer container
        const handDrawerContainer = document.createElement('div');
        handDrawerContainer.className = 'mobile-hand-drawer-container';
        handDrawerContainer.id = 'mobileHandDrawer';
        
        this.components.bottomDrawer.appendChild(handDrawerContainer);
        
        // Store reference to hand drawer container
        this.components.handDrawer = handDrawerContainer;
    }

    setupResponsiveSizing() {
        // Calculate responsive dimensions based on viewport
        this.updateResponsiveDimensions();
        
        // Update on resize
        window.addEventListener('resize', () => {
            this.updateResponsiveDimensions();
        });
        
        // Update on orientation change
        window.addEventListener('orientationchange', () => {
            // Delay to allow orientation change to complete
            setTimeout(() => {
                this.updateResponsiveDimensions();
            }, 100);
        });
    }

    updateResponsiveDimensions() {
        if (!this.components.container) return;
        
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Calculate layout dimensions
        const dimensions = this.calculateLayoutDimensions(viewport);
        
        // Apply dimensions to layout
        this.applyLayoutDimensions(dimensions);
        
        // Update CSS custom properties
        this.updateCSSCustomProperties(dimensions);
    }

    calculateLayoutDimensions(viewport) {
        const safeAreaTop = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--safe-area-top').replace('px', '')) || 0;
        const safeAreaBottom = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--safe-area-bottom').replace('px', '')) || 0;
        
        const availableHeight = viewport.height - safeAreaTop - safeAreaBottom;
        
        return {
            viewport,
            safeAreaTop,
            safeAreaBottom,
            availableHeight,
            topBarHeight: this.layoutConfig.avatarHeight,
            drawerCollapsedHeight: this.layoutConfig.drawerCollapsedHeight,
            drawerExpandedHeight: this.layoutConfig.drawerExpandedHeight,
            gameAreaHeight: availableHeight - this.layoutConfig.avatarHeight - this.layoutConfig.drawerCollapsedHeight,
            boardPadding: this.layoutConfig.boardPadding
        };
    }

    applyLayoutDimensions(dimensions) {
        // Apply top bar dimensions
        if (this.components.topBar) {
            this.components.topBar.style.height = `${dimensions.topBarHeight}px`;
        }
        
        // Apply game area dimensions
        if (this.components.gameArea) {
            this.components.gameArea.style.height = `${dimensions.gameAreaHeight}px`;
            this.components.gameArea.style.padding = `${dimensions.boardPadding}px`;
        }
        
        // Apply bottom drawer dimensions
        if (this.components.bottomDrawer) {
            this.components.bottomDrawer.style.height = `${dimensions.drawerCollapsedHeight}px`;
        }
    }

    updateCSSCustomProperties(dimensions) {
        const root = document.documentElement;
        
        root.style.setProperty('--mobile-game-viewport-width', `${dimensions.viewport.width}px`);
        root.style.setProperty('--mobile-game-viewport-height', `${dimensions.viewport.height}px`);
        root.style.setProperty('--mobile-game-available-height', `${dimensions.availableHeight}px`);
        root.style.setProperty('--mobile-game-top-bar-height', `${dimensions.topBarHeight}px`);
        root.style.setProperty('--mobile-game-area-height', `${dimensions.gameAreaHeight}px`);
        root.style.setProperty('--mobile-game-drawer-collapsed-height', `${dimensions.drawerCollapsedHeight}px`);
        root.style.setProperty('--mobile-game-drawer-expanded-height', `${dimensions.drawerExpandedHeight}px`);
        root.style.setProperty('--mobile-game-board-padding', `${dimensions.boardPadding}px`);
    }

    setupSafeAreaHandling() {
        if (!this.layoutConfig.safeAreaHandling) return;
        
        // Apply safe area classes
        this.components.container.classList.add('safe-area-container');
        
        // Monitor safe area changes
        const observer = new ResizeObserver(() => {
            this.updateResponsiveDimensions();
        });
        
        observer.observe(this.components.container);
    }

    initializeHandDrawerComponent() {
        if (this.components.handDrawer && typeof HandDrawerComponent !== 'undefined') {
            this.components.handDrawerComponent = new HandDrawerComponent(this.components.handDrawer);
            
            // Initialize game integration if HandDrawerGameIntegration is available
            if (typeof HandDrawerGameIntegration !== 'undefined') {
                // Try to get game instance from global scope or window
                const gameInstance = window.rummikubClient || window.game || null;
                
                if (gameInstance) {
                    this.components.handDrawerIntegration = new HandDrawerGameIntegration(
                        this.components.handDrawerComponent,
                        gameInstance
                    );
                    
                    // Listen for integration events
                    this.components.handDrawerIntegration.on('actionHandled', (data) => {
                        this.emit('handDrawerActionHandled', data);
                    });
                    
                    this.components.handDrawerIntegration.on('tileSelectionChanged', (data) => {
                        this.emit('handDrawerTileSelectionChanged', data);
                    });
                    
                    this.components.handDrawerIntegration.on('boardResetRequested', () => {
                        this.emit('boardResetRequested');
                    });
                } else {
                    console.warn('Game instance not found - hand drawer will work in standalone mode');
                }
            }
            
            // Listen for hand drawer events
            this.components.handDrawerComponent.on('expanded', () => {
                this.emit('handDrawerExpanded');
            });
            
            this.components.handDrawerComponent.on('collapsed', () => {
                this.emit('handDrawerCollapsed');
            });
            
            this.components.handDrawerComponent.on('actionClicked', (data) => {
                this.emit('handDrawerActionClicked', data);
            });
            
            this.components.handDrawerComponent.on('tileSelectionChanged', (data) => {
                this.emit('handDrawerTileSelectionChanged', data);
            });
        }
    }

    initializePlayerAvatarSystem() {
        const avatarsContainer = this.components.topBar.querySelector('.mobile-game-avatars-container');
        if (avatarsContainer) {
            this.components.playerAvatarSystem = new PlayerAvatarSystem(avatarsContainer);
            
            // Listen for avatar system events
            this.components.playerAvatarSystem.on('avatarClicked', (data) => {
                this.emit('playerAvatarClicked', data);
            });
            
            this.components.playerAvatarSystem.on('turnChanged', (data) => {
                this.emit('playerTurnChanged', data);
            });
            
            this.components.playerAvatarSystem.on('connectionStatusChanged', (data) => {
                this.emit('playerConnectionChanged', data);
            });
        }
    }

    setupEventListeners() {
        // Menu button event
        const menuButton = this.components.topBar.querySelector('.mobile-game-menu-button');
        if (menuButton) {
            menuButton.addEventListener('click', () => {
                this.showGameMenu();
            });
        }
        
        // Exit button event
        const exitButton = this.components.topBar.querySelector('.mobile-game-exit-button');
        if (exitButton) {
            exitButton.addEventListener('click', () => {
                this.exitGame();
            });
        }
        
        // Listen for orientation changes
        document.addEventListener('screenchange', (event) => {
            if (event.detail.screenType === 'game') {
                this.handleScreenActivation();
            }
        });
    }

    applyLandscapeOptimizations() {
        // Force landscape orientation when screen is active
        if (this.isVisible) {
            this.forceLandscapeOrientation();
        }
        
        // Apply landscape-specific styles
        this.components.container.classList.add('mobile-landscape');
        
        // Optimize for touch interactions
        this.optimizeTouchInteractions();
        
        // Apply performance optimizations
        this.applyPerformanceOptimizations();
    }

    forceLandscapeOrientation() {
        // Request landscape orientation if supported
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(error => {
                console.warn('Could not lock orientation to landscape:', error);
            });
        }
        
        // Apply CSS orientation lock as fallback
        document.body.classList.add('force-landscape');
    }

    optimizeTouchInteractions() {
        // Optimize touch targets
        const touchTargets = this.components.container.querySelectorAll('.touch-target');
        touchTargets.forEach(target => {
            target.style.minWidth = '44px';
            target.style.minHeight = '44px';
        });
        
        // Add touch feedback
        this.components.container.addEventListener('touchstart', (event) => {
            const target = event.target.closest('.touch-feedback');
            if (target) {
                target.classList.add('touch-active');
            }
        });
        
        this.components.container.addEventListener('touchend', (event) => {
            const target = event.target.closest('.touch-feedback');
            if (target) {
                setTimeout(() => {
                    target.classList.remove('touch-active');
                }, 150);
            }
        });
    }

    applyPerformanceOptimizations() {
        // Enable hardware acceleration
        this.components.container.style.transform = 'translateZ(0)';
        this.components.gameArea.style.transform = 'translateZ(0)';
        
        // Optimize will-change properties
        this.components.bottomDrawer.style.willChange = 'transform, height';
        
        // Optimize scrolling
        this.components.gameArea.style.webkitOverflowScrolling = 'touch';
    }

    // Public API methods
    show() {
        if (this.isVisible) return;
        
        this.components.container.style.display = 'flex';
        this.isVisible = true;
        
        // Apply landscape orientation
        this.forceLandscapeOrientation();
        
        // Update dimensions
        this.updateResponsiveDimensions();
        
        // Emit show event
        this.emit('show');
    }

    hide() {
        if (!this.isVisible) return;
        
        this.components.container.style.display = 'none';
        this.isVisible = false;
        
        // Release orientation lock
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        document.body.classList.remove('force-landscape');
        
        // Emit hide event
        this.emit('hide');
    }

    isShown() {
        return this.isVisible;
    }

    getContainer() {
        return this.components.container;
    }

    getTopBar() {
        return this.components.topBar;
    }

    getGameArea() {
        return this.components.gameArea;
    }

    getBottomDrawer() {
        return this.components.bottomDrawer;
    }

    getGameBoard() {
        return this.components.gameBoard;
    }

    getHandDrawer() {
        return this.components.handDrawer;
    }

    // Hand drawer management methods
    expandHandDrawer() {
        if (this.components.handDrawerComponent) {
            return this.components.handDrawerComponent.expand();
        }
        return Promise.resolve();
    }

    collapseHandDrawer() {
        if (this.components.handDrawerComponent) {
            return this.components.handDrawerComponent.collapse();
        }
        return Promise.resolve();
    }

    isHandDrawerExpanded() {
        if (this.components.handDrawerComponent) {
            return this.components.handDrawerComponent.getIsExpanded();
        }
        return false;
    }

    getHandDrawerComponent() {
        return this.components.handDrawerComponent;
    }

    getHandDrawerIntegration() {
        return this.components.handDrawerIntegration;
    }

    // Game integration methods
    syncHandDrawerWithGame() {
        if (this.components.handDrawerIntegration) {
            this.components.handDrawerIntegration.syncFromGame();
        }
    }

    updateHandDrawerActionStates() {
        if (this.components.handDrawerIntegration) {
            this.components.handDrawerIntegration.updateActionButtonStates();
        }
    }

    // Player management methods
    addPlayer(playerData) {
        if (this.components.playerAvatarSystem) {
            return this.components.playerAvatarSystem.addPlayer(playerData);
        }
        return false;
    }

    removePlayer(playerId) {
        if (this.components.playerAvatarSystem) {
            return this.components.playerAvatarSystem.removePlayer(playerId);
        }
        return false;
    }

    updatePlayer(playerData) {
        if (this.components.playerAvatarSystem) {
            return this.components.playerAvatarSystem.updatePlayer(playerData);
        }
        return false;
    }

    setCurrentTurnPlayer(playerId) {
        if (this.components.playerAvatarSystem) {
            this.components.playerAvatarSystem.setCurrentTurn(playerId);
        }
    }

    setPlayerConnected(playerId, isConnected) {
        if (this.components.playerAvatarSystem) {
            this.components.playerAvatarSystem.setPlayerConnected(playerId, isConnected);
        }
    }

    updatePlayerStats(playerId, stats) {
        if (this.components.playerAvatarSystem) {
            this.components.playerAvatarSystem.updatePlayerStats(playerId, stats);
        }
    }

    getPlayer(playerId) {
        if (this.components.playerAvatarSystem) {
            return this.components.playerAvatarSystem.getPlayer(playerId);
        }
        return null;
    }

    getAllPlayers() {
        if (this.components.playerAvatarSystem) {
            return this.components.playerAvatarSystem.getAllPlayers();
        }
        return [];
    }

    clearAllPlayers() {
        if (this.components.playerAvatarSystem) {
            this.components.playerAvatarSystem.clear();
        }
    }
    updateGameState(gameState) {
        this.currentGameState = gameState;
        this.emit('gameStateUpdated', { gameState });
    }

    setCurrentPlayer(player) {
        this.currentPlayer = player;
        this.emit('currentPlayerChanged', { player });
    }

    setIsMyTurn(isMyTurn) {
        this.isMyTurn = isMyTurn;
        this.components.container.classList.toggle('my-turn', isMyTurn);
        this.emit('turnChanged', { isMyTurn });
    }

    // UI interaction methods
    showGameMenu() {
        // Implementation for game menu
        this.emit('gameMenuRequested');
    }

    exitGame() {
        // Implementation for exit game
        this.emit('exitGameRequested');
    }

    toggleHandDrawer() {
        if (this.components.handDrawerComponent) {
            this.components.handDrawerComponent.toggle();
        } else {
            // Fallback for when component is not available
            this.emit('handDrawerToggleRequested');
        }
    }

    handleScreenActivation() {
        if (!this.isVisible) {
            this.show();
        }
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
        // Clean up hand drawer integration
        if (this.components.handDrawerIntegration) {
            this.components.handDrawerIntegration.destroy();
            this.components.handDrawerIntegration = null;
        }
        
        // Clean up hand drawer component
        if (this.components.handDrawerComponent) {
            this.components.handDrawerComponent.destroy();
            this.components.handDrawerComponent = null;
        }
        
        // Remove event listeners
        this.eventCallbacks.clear();
        
        // Remove from DOM
        if (this.components.container && this.components.container.parentNode) {
            this.components.container.parentNode.removeChild(this.components.container);
        }
        
        // Clear component references
        Object.keys(this.components).forEach(key => {
            this.components[key] = null;
        });
        
        // Release orientation lock
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        
        this.isInitialized = false;
        this.isVisible = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileGameScreen;
} else if (typeof window !== 'undefined') {
    window.MobileGameScreen = MobileGameScreen;
}