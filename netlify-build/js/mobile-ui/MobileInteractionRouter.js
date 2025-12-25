/**
 * Mobile Interaction Router
 * Routes mobile UI interactions to appropriate mobile components
 * Ensures mobile lobby, game creation, and game screens work properly
 * Implements proper screen transitions for mobile workflow
 */

class MobileInteractionRouter {
    constructor(mobileUISystem, mobileInterfaceActivator) {
        this.mobileUISystem = mobileUISystem;
        this.mobileInterfaceActivator = mobileInterfaceActivator;
        this.isActive = false;
        this.routingTable = new Map();
        this.transitionQueue = [];
        this.isTransitioning = false;
        
        this.init();
    }

    init() {
        console.log('Mobile Interaction Router initializing...');
        
        // Set up routing table
        this.setupRoutingTable();
        
        // Set up mobile component event handlers
        this.setupMobileComponentHandlers();
        
        // Set up desktop button interception
        this.setupDesktopButtonInterception();
        
        // Set up screen transition management
        this.setupTransitionManagement();
        
        this.isActive = true;
        console.log('Mobile Interaction Router initialized');
    }

    /**
     * Set up routing table for mobile interactions
     */
    setupRoutingTable() {
        // Login screen routes
        this.routingTable.set('login.success', {
            target: 'lobby',
            transition: 'slide-left',
            handler: this.handleLoginSuccess.bind(this)
        });
        
        this.routingTable.set('login.back', {
            target: 'lobby',
            transition: 'slide-right',
            handler: this.handleLoginBack.bind(this)
        });
        
        // Lobby screen routes
        this.routingTable.set('lobby.createGame', {
            target: 'game-creation',
            transition: 'slide-left',
            handler: this.handleLobbyCreateGame.bind(this)
        });
        
        this.routingTable.set('lobby.joinGame', {
            target: 'game',
            transition: 'slide-left',
            handler: this.handleLobbyJoinGame.bind(this)
        });
        
        this.routingTable.set('lobby.logout', {
            target: 'login',
            transition: 'slide-right',
            handler: this.handleLobbyLogout.bind(this)
        });
        
        // Game creation screen routes
        this.routingTable.set('game-creation.create', {
            target: 'game',
            transition: 'slide-left',
            handler: this.handleGameCreationCreate.bind(this)
        });
        
        this.routingTable.set('game-creation.back', {
            target: 'lobby',
            transition: 'slide-right',
            handler: this.handleGameCreationBack.bind(this)
        });
        
        // Game screen routes
        this.routingTable.set('game.leave', {
            target: 'lobby',
            transition: 'slide-right',
            handler: this.handleGameLeave.bind(this)
        });
        
        this.routingTable.set('game.end', {
            target: 'lobby',
            transition: 'fade',
            handler: this.handleGameEnd.bind(this)
        });
        
        console.log('Routing table set up with', this.routingTable.size, 'routes');
    }

    /**
     * Set up mobile component event handlers
     */
    setupMobileComponentHandlers() {
        if (!this.mobileUISystem) {
            console.warn('Mobile UI System not available for component handlers');
            return;
        }
        
        // Login screen handlers
        const loginScreen = this.mobileUISystem.getComponent('mobileLoginScreen');
        if (loginScreen) {
            this.setupLoginScreenHandlers(loginScreen);
        }
        
        // Lobby screen handlers
        const lobbyScreen = this.mobileUISystem.getComponent('mobileLobbyScreen');
        if (lobbyScreen) {
            this.setupLobbyScreenHandlers(lobbyScreen);
        }
        
        // Game creation screen handlers
        const gameCreationScreen = this.mobileUISystem.getComponent('mobileGameCreationScreen');
        if (gameCreationScreen) {
            this.setupGameCreationScreenHandlers(gameCreationScreen);
        }
        
        // Game screen handlers
        const gameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (gameScreen) {
            this.setupGameScreenHandlers(gameScreen);
        }
        
        // Navigation controller handlers
        const navigationController = this.mobileUISystem.getComponent('navigationController');
        if (navigationController) {
            this.setupNavigationControllerHandlers(navigationController);
        }
    }

    /**
     * Set up login screen handlers
     */
    setupLoginScreenHandlers(loginScreen) {
        console.log('Setting up login screen handlers...');
        
        // Handle successful login
        if (loginScreen.on) {
            loginScreen.on('loginSuccess', (data) => {
                console.log('Login success event received:', data);
                this.route('login.success', data);
            });
            
            loginScreen.on('backToGame', () => {
                console.log('Back to game event received');
                this.route('login.back');
            });
        }
        
        // Set up direct DOM event handlers as fallback
        this.setupLoginScreenDOMHandlers(loginScreen);
    }

    /**
     * Set up login screen DOM handlers
     */
    setupLoginScreenDOMHandlers(loginScreen) {
        if (!loginScreen.container) return;
        
        // Handle form submission
        const form = loginScreen.container.querySelector('#mobile-login-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Mobile login form submitted');
                // The form handler will trigger the loginSuccess event
            });
        }
        
        // Handle back button
        const backButton = loginScreen.container.querySelector('#back-to-game');
        if (backButton) {
            backButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile login back button clicked');
                this.route('login.back');
            });
        }
    }

    /**
     * Set up lobby screen handlers
     */
    setupLobbyScreenHandlers(lobbyScreen) {
        console.log('Setting up lobby screen handlers...');
        
        if (lobbyScreen.on) {
            lobbyScreen.on('navigateToGameCreation', () => {
                console.log('Navigate to game creation event received');
                this.route('lobby.createGame');
            });
            
            lobbyScreen.on('joinGame', (gameId) => {
                console.log('Join game event received:', gameId);
                this.route('lobby.joinGame', { gameId });
            });
            
            lobbyScreen.on('logout', () => {
                console.log('Logout event received');
                this.route('lobby.logout');
            });
        }
        
        // Set up direct DOM event handlers
        this.setupLobbyScreenDOMHandlers(lobbyScreen);
    }

    /**
     * Set up lobby screen DOM handlers
     */
    setupLobbyScreenDOMHandlers(lobbyScreen) {
        if (!lobbyScreen.screenElement) return;
        
        // Handle floating action button (create game)
        const fab = lobbyScreen.screenElement.querySelector('#mobile-create-game-fab');
        if (fab) {
            fab.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile lobby FAB clicked');
                this.route('lobby.createGame');
            });
        }
        
        // Handle logout button
        const logoutBtn = lobbyScreen.screenElement.querySelector('#mobile-lobby-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile lobby logout clicked');
                this.route('lobby.logout');
            });
        }
        
        // Handle game card clicks (delegated)
        const gamesList = lobbyScreen.screenElement.querySelector('#mobile-games-list');
        if (gamesList) {
            gamesList.addEventListener('click', (e) => {
                const gameCard = e.target.closest('.game-card');
                if (gameCard) {
                    const gameId = gameCard.dataset.gameId;
                    console.log('Mobile game card clicked:', gameId);
                    this.route('lobby.joinGame', { gameId });
                }
            });
        }
    }

    /**
     * Set up game creation screen handlers
     */
    setupGameCreationScreenHandlers(gameCreationScreen) {
        console.log('Setting up game creation screen handlers...');
        
        if (gameCreationScreen.on) {
            gameCreationScreen.on('gameCreated', (gameData) => {
                console.log('Game created event received:', gameData);
                this.route('game-creation.create', gameData);
            });
            
            gameCreationScreen.on('back', () => {
                console.log('Game creation back event received');
                this.route('game-creation.back');
            });
        }
        
        // Set up DOM handlers
        this.setupGameCreationScreenDOMHandlers(gameCreationScreen);
    }

    /**
     * Set up game creation screen DOM handlers
     */
    setupGameCreationScreenDOMHandlers(gameCreationScreen) {
        if (!gameCreationScreen.container) return;
        
        // Handle create game button
        const createBtn = gameCreationScreen.container.querySelector('.create-game-btn, #create-game-btn');
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile game creation create button clicked');
                // Trigger game creation process
                if (gameCreationScreen.createGame) {
                    gameCreationScreen.createGame();
                } else {
                    this.route('game-creation.create');
                }
            });
        }
        
        // Handle back button
        const backBtn = gameCreationScreen.container.querySelector('.back-btn, #back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile game creation back button clicked');
                this.route('game-creation.back');
            });
        }
    }

    /**
     * Set up game screen handlers
     */
    setupGameScreenHandlers(gameScreen) {
        console.log('Setting up game screen handlers...');
        
        if (gameScreen.on) {
            gameScreen.on('leaveGame', () => {
                console.log('Leave game event received');
                this.route('game.leave');
            });
            
            gameScreen.on('gameEnded', (result) => {
                console.log('Game ended event received:', result);
                this.route('game.end', result);
            });
        }
        
        // Set up DOM handlers
        this.setupGameScreenDOMHandlers(gameScreen);
    }

    /**
     * Set up game screen DOM handlers
     */
    setupGameScreenDOMHandlers(gameScreen) {
        if (!gameScreen.container) return;
        
        // Handle leave game button
        const leaveBtn = gameScreen.container.querySelector('.leave-game-btn, #leave-game-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile game leave button clicked');
                this.route('game.leave');
            });
        }
    }

    /**
     * Set up navigation controller handlers
     */
    setupNavigationControllerHandlers(navigationController) {
        console.log('Setting up navigation controller handlers...');
        
        if (navigationController.on) {
            navigationController.on('navigate', (event) => {
                console.log('Navigation controller navigate event:', event);
                this.handleNavigationControllerEvent(event);
            });
        }
    }

    /**
     * Set up desktop button interception for mobile
     */
    setupDesktopButtonInterception() {
        console.log('Setting up desktop button interception...');
        
        // Only intercept if mobile interface is active
        if (!this.mobileInterfaceActivator || !this.mobileInterfaceActivator.isInterfaceActivated()) {
            return;
        }
        
        // Intercept desktop buttons and route to mobile components
        const desktopButtonMappings = [
            {
                selector: '#playWithFriendsBtn',
                route: 'desktop.playWithFriends',
                handler: this.handleDesktopPlayWithFriends.bind(this)
            },
            {
                selector: '#playWithBotBtn',
                route: 'desktop.playWithBot',
                handler: this.handleDesktopPlayWithBot.bind(this)
            },
            {
                selector: '#createGameBtn',
                route: 'desktop.createGame',
                handler: this.handleDesktopCreateGame.bind(this)
            },
            {
                selector: '#joinGameBtn',
                route: 'desktop.joinGame',
                handler: this.handleDesktopJoinGame.bind(this)
            }
        ];
        
        desktopButtonMappings.forEach(mapping => {
            const button = document.querySelector(mapping.selector);
            if (button) {
                // Add mobile touch handler
                button.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`Desktop button intercepted: ${mapping.selector}`);
                    mapping.handler();
                }, { passive: false });
                
                // Also intercept click events
                button.addEventListener('click', (e) => {
                    if (this.mobileInterfaceActivator.isInterfaceActivated()) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Desktop button click intercepted: ${mapping.selector}`);
                        mapping.handler();
                    }
                }, true); // Use capture phase
            }
        });
    }

    /**
     * Set up screen transition management
     */
    setupTransitionManagement() {
        // Set up transition queue processing
        this.processTransitionQueue();
        
        // Set up transition event listeners
        document.addEventListener('transitionend', (e) => {
            if (e.target.classList.contains('mobile-screen')) {
                this.handleTransitionEnd(e);
            }
        });
    }

    /**
     * Route an interaction to the appropriate handler
     */
    route(routeName, data = {}) {
        console.log(`Routing: ${routeName}`, data);
        
        const route = this.routingTable.get(routeName);
        if (!route) {
            console.warn(`No route found for: ${routeName}`);
            return false;
        }
        
        // Add to transition queue
        this.transitionQueue.push({
            routeName,
            route,
            data,
            timestamp: Date.now()
        });
        
        // Process queue
        this.processTransitionQueue();
        
        return true;
    }

    /**
     * Process transition queue
     */
    processTransitionQueue() {
        if (this.isTransitioning || this.transitionQueue.length === 0) {
            return;
        }
        
        const transition = this.transitionQueue.shift();
        this.executeTransition(transition);
    }

    /**
     * Execute a transition
     */
    async executeTransition(transition) {
        this.isTransitioning = true;
        
        try {
            console.log(`Executing transition: ${transition.routeName} -> ${transition.route.target}`);
            
            // Call the route handler
            if (transition.route.handler) {
                await transition.route.handler(transition.data);
            }
            
            // Perform screen transition
            await this.performScreenTransition(transition.route.target, transition.route.transition);
            
        } catch (error) {
            console.error(`Error executing transition ${transition.routeName}:`, error);
        } finally {
            this.isTransitioning = false;
            
            // Process next transition in queue
            setTimeout(() => {
                this.processTransitionQueue();
            }, 100);
        }
    }

    /**
     * Perform screen transition
     */
    async performScreenTransition(targetScreen, transitionType = 'slide-left') {
        console.log(`Performing screen transition to: ${targetScreen} (${transitionType})`);
        
        // Use mobile interface activator for screen transitions
        if (this.mobileInterfaceActivator) {
            switch (targetScreen) {
                case 'login':
                    this.mobileInterfaceActivator.transitionToLogin();
                    break;
                case 'lobby':
                    this.mobileInterfaceActivator.transitionToLobby();
                    break;
                case 'game-creation':
                    this.mobileInterfaceActivator.transitionToGameCreation();
                    break;
                case 'game':
                    this.mobileInterfaceActivator.transitionToGame();
                    break;
                default:
                    console.warn(`Unknown target screen: ${targetScreen}`);
            }
        }
        
        // Add transition animation class
        document.body.classList.add(`transition-${transitionType}`);
        
        // Remove transition class after animation
        setTimeout(() => {
            document.body.classList.remove(`transition-${transitionType}`);
        }, 300);
    }

    /**
     * Route handlers
     */
    async handleLoginSuccess(data) {
        console.log('Handling login success:', data);
        
        // Store authentication data if provided
        if (data && data.token) {
            localStorage.setItem('auth_token', data.token);
            if (data.user) {
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('user_id', data.user.id);
            }
        }
        
        // Navigate to lobby
        return Promise.resolve();
    }

    async handleLoginBack() {
        console.log('Handling login back');
        return Promise.resolve();
    }

    async handleLobbyCreateGame() {
        console.log('Handling lobby create game');
        return Promise.resolve();
    }

    async handleLobbyJoinGame(data) {
        console.log('Handling lobby join game:', data);
        
        // Store game ID for game screen
        if (data && data.gameId) {
            sessionStorage.setItem('current_game_id', data.gameId);
        }
        
        return Promise.resolve();
    }

    async handleLobbyLogout() {
        console.log('Handling lobby logout');
        
        // Clear authentication data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('username');
        localStorage.removeItem('user_id');
        sessionStorage.clear();
        
        return Promise.resolve();
    }

    async handleGameCreationCreate(data) {
        console.log('Handling game creation create:', data);
        
        // Store game data for game screen
        if (data && data.gameId) {
            sessionStorage.setItem('current_game_id', data.gameId);
        }
        
        return Promise.resolve();
    }

    async handleGameCreationBack() {
        console.log('Handling game creation back');
        return Promise.resolve();
    }

    async handleGameLeave() {
        console.log('Handling game leave');
        
        // Clear game data
        sessionStorage.removeItem('current_game_id');
        
        return Promise.resolve();
    }

    async handleGameEnd(data) {
        console.log('Handling game end:', data);
        
        // Clear game data
        sessionStorage.removeItem('current_game_id');
        
        return Promise.resolve();
    }

    /**
     * Desktop button handlers
     */
    handleDesktopPlayWithFriends() {
        console.log('Desktop play with friends intercepted - routing to mobile lobby');
        this.route('lobby.createGame');
    }

    handleDesktopPlayWithBot() {
        console.log('Desktop play with bot intercepted - routing to mobile game creation');
        // For bot games, go directly to game creation with bot settings
        this.route('lobby.createGame');
    }

    handleDesktopCreateGame() {
        console.log('Desktop create game intercepted - routing to mobile game creation');
        this.route('lobby.createGame');
    }

    handleDesktopJoinGame() {
        console.log('Desktop join game intercepted - staying in mobile lobby');
        // Stay in lobby but focus on join functionality
        // The lobby screen should handle game joining
    }

    /**
     * Navigation controller event handler
     */
    handleNavigationControllerEvent(event) {
        const routeMap = {
            'login': 'login.success',
            'lobby': 'game.leave', // Coming from game to lobby
            'game-creation': 'lobby.createGame',
            'game': 'game-creation.create'
        };
        
        const routeName = routeMap[event.to];
        if (routeName) {
            this.route(routeName, event.data);
        }
    }

    /**
     * Handle transition end
     */
    handleTransitionEnd(event) {
        console.log('Transition ended:', event.target.id);
        
        // Clean up transition classes
        event.target.classList.remove('transitioning');
        
        // Emit transition complete event
        if (this.mobileUISystem) {
            this.mobileUISystem.emit('transitionComplete', {
                target: event.target.id,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Public API methods
     */
    isRouterActive() {
        return this.isActive;
    }

    getRoutingTable() {
        return new Map(this.routingTable);
    }

    addRoute(routeName, routeConfig) {
        this.routingTable.set(routeName, routeConfig);
        console.log(`Added route: ${routeName}`);
    }

    removeRoute(routeName) {
        const removed = this.routingTable.delete(routeName);
        if (removed) {
            console.log(`Removed route: ${routeName}`);
        }
        return removed;
    }

    /**
     * Force route (for testing)
     */
    forceRoute(routeName, data = {}) {
        console.log(`Force routing: ${routeName}`);
        return this.route(routeName, data);
    }

    /**
     * Get current transition status
     */
    getTransitionStatus() {
        return {
            isTransitioning: this.isTransitioning,
            queueLength: this.transitionQueue.length,
            isActive: this.isActive
        };
    }

    /**
     * Deactivate router
     */
    deactivate() {
        this.isActive = false;
        this.transitionQueue = [];
        this.isTransitioning = false;
        console.log('Mobile Interaction Router deactivated');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileInteractionRouter;
} else if (typeof window !== 'undefined') {
    window.MobileInteractionRouter = MobileInteractionRouter;
}