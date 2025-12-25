/**
 * Mobile UI System
 * Main controller that orchestrates all mobile UI components
 * Provides the foundation for the complete mobile interface system
 */

class MobileUISystem {
    constructor() {
        this.components = new Map();
        this.isInitialized = false;
        this.currentScreen = null;
        this.screenHistory = [];
        
        this.config = {
            enableOrientationManagement: true,
            enableTouchHandling: true,
            enableGestureRecognition: true,
            enableSafeAreaHandling: true,
            enablePerformanceOptimizations: true
        };
        
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Initialize core components
            await this.initializeComponents();
            
            // Setup event system
            this.setupEventSystem();
            
            // Apply mobile optimizations
            this.applyMobileOptimizations();
            
            // Setup screen management
            this.setupScreenManagement();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('Mobile UI System initialized successfully');
            this.emit('initialized', { timestamp: Date.now() });
            
        } catch (error) {
            console.error('Failed to initialize Mobile UI System:', error);
            throw error;
        }
    }

    async initializeComponents() {
        // Initialize Orientation Manager
        if (this.config.enableOrientationManagement) {
            this.components.set('orientationManager', new OrientationManager());
        }
        
        // Initialize Touch Manager
        if (this.config.enableTouchHandling) {
            this.components.set('touchManager', new TouchManager());
        }
        
        // Initialize Gesture Recognizer
        if (this.config.enableGestureRecognition) {
            this.components.set('gestureRecognizer', new GestureRecognizer());
        }
        
        // Initialize Safe Area Handler
        if (this.config.enableSafeAreaHandling) {
            this.components.set('safeAreaHandler', new SafeAreaHandler());
        }
        
        // Initialize Responsive Layout Manager
        if (typeof ResponsiveLayoutManager !== 'undefined') {
            this.components.set('responsiveLayoutManager', new ResponsiveLayoutManager());
        }
        
        // Initialize Accessibility Manager
        if (typeof AccessibilityManager !== 'undefined') {
            this.components.set('accessibilityManager', new AccessibilityManager());
        }
        
        // Initialize Animation Performance Manager
        if (typeof AnimationPerformanceManager !== 'undefined') {
            this.components.set('animationPerformanceManager', new AnimationPerformanceManager());
        }
        
        // Initialize Memory Manager
        if (typeof MemoryManager !== 'undefined') {
            this.components.set('memoryManager', new MemoryManager());
        }
        
        // Initialize Mobile Login Screen
        if (typeof MobileLoginScreen !== 'undefined') {
            this.components.set('mobileLoginScreen', new MobileLoginScreen());
        }
        
        // Initialize Mobile Lobby Screen
        if (typeof MobileLobbyScreen !== 'undefined') {
            this.components.set('mobileLobbyScreen', new MobileLobbyScreen());
        }
        
        // Initialize Mobile Game Creation Screen
        if (typeof MobileGameCreationScreen !== 'undefined') {
            this.components.set('mobileGameCreationScreen', new MobileGameCreationScreen());
        }
        
        // Initialize Mobile Game Screen
        if (typeof MobileGameScreen !== 'undefined') {
            this.components.set('mobileGameScreen', new MobileGameScreen());
        }
        
        // Initialize Mobile Navigation Controller
        if (typeof MobileNavigationController !== 'undefined') {
            this.components.set('navigationController', new MobileNavigationController());
            
            // Register screens with navigation controller
            const navigationController = this.components.get('navigationController');
            const loginScreen = this.components.get('mobileLoginScreen');
            const lobbyScreen = this.components.get('mobileLobbyScreen');
            const gameCreationScreen = this.components.get('mobileGameCreationScreen');
            const gameScreen = this.components.get('mobileGameScreen');
            
            if (navigationController && loginScreen) {
                navigationController.registerScreen('login', loginScreen);
            }
            
            if (navigationController && lobbyScreen) {
                navigationController.registerScreen('lobby', lobbyScreen);
            }
            
            if (navigationController && gameCreationScreen) {
                navigationController.registerScreen('game-creation', gameCreationScreen);
            }
            
            if (navigationController && gameScreen) {
                navigationController.registerScreen('game', gameScreen);
            }
        }
        
        // Initialize mobile-specific systems
        this.initializeMobileSystems();
        
        // Initialize game integration components
        this.initializeGameIntegration();
        
        // Wait for all components to be ready
        await this.waitForComponentsReady();
    }

    initializeMobileSystems() {
        // Initialize Mobile Notification System
        if (typeof MobileNotificationSystem !== 'undefined') {
            this.components.set('notificationSystem', new MobileNotificationSystem());
            console.log('Mobile Notification System initialized');
        }
        
        // Initialize Mobile Haptic Feedback System
        if (typeof MobileHapticFeedback !== 'undefined') {
            this.components.set('hapticSystem', new MobileHapticFeedback());
            console.log('Mobile Haptic Feedback System initialized');
        }
        
        // Initialize Mobile Error Handling System
        if (typeof MobileErrorHandlingSystem !== 'undefined') {
            const notificationSystem = this.components.get('notificationSystem');
            const hapticSystem = this.components.get('hapticSystem');
            this.components.set('errorHandlingSystem', new MobileErrorHandlingSystem(this, notificationSystem, hapticSystem));
            console.log('Mobile Error Handling System initialized');
        }
    }

    initializeGameIntegration() {
        // Initialize game integration if game client is available
        if (typeof window !== 'undefined' && (window.socket || window.gameClient)) {
            const gameClient = window.gameClient || { socket: window.socket };
            
            // Initialize Mobile Game Integration
            if (typeof MobileGameIntegration !== 'undefined') {
                this.components.set('mobileGameIntegration', new MobileGameIntegration(this, gameClient));
                console.log('Mobile Game Integration initialized');
            }
            
            // Initialize Mobile Networking Integration
            if (typeof MobileNetworkingIntegration !== 'undefined' && gameClient.socket) {
                this.components.set('mobileNetworkingIntegration', new MobileNetworkingIntegration(gameClient.socket, this));
                console.log('Mobile Networking Integration initialized');
            }
            
            // Initialize Cross-Platform Compatibility
            if (typeof CrossPlatformCompatibility !== 'undefined') {
                const gameIntegration = this.components.get('mobileGameIntegration');
                if (gameIntegration) {
                    this.components.set('crossPlatformCompatibility', new CrossPlatformCompatibility(this, gameIntegration));
                    console.log('Cross-Platform Compatibility initialized');
                }
            }
            
            // Setup integration event handlers
            this.setupGameIntegrationEventHandlers();
        } else {
            console.warn('Game client not found - mobile UI will work in standalone mode');
        }
    }

    setupGameIntegrationEventHandlers() {
        const gameIntegration = this.components.get('mobileGameIntegration');
        const networkingIntegration = this.components.get('mobileNetworkingIntegration');
        const crossPlatformCompatibility = this.components.get('crossPlatformCompatibility');
        
        // Game integration events
        if (gameIntegration) {
            gameIntegration.on('gameStateChanged', (data) => {
                this.emit('gameStateChanged', data);
            });
            
            gameIntegration.on('gameWon', (data) => {
                this.emit('gameWon', data);
            });
            
            gameIntegration.on('turnChanged', (data) => {
                this.emit('turnChanged', data);
            });
            
            gameIntegration.on('connectionStatusChanged', (data) => {
                this.emit('connectionStatusChanged', data);
            });
        }
        
        // Networking integration events
        if (networkingIntegration) {
            networkingIntegration.on('networkQualityChanged', (quality) => {
                this.emit('networkQualityChanged', quality);
                
                // Adjust UI based on network quality
                this.adjustUIForNetworkQuality(quality);
            });
            
            networkingIntegration.on('connectionRestored', () => {
                this.emit('connectionRestored');
            });
            
            networkingIntegration.on('offline', () => {
                this.emit('offline');
            });
        }
        
        // Cross-platform compatibility events
        if (crossPlatformCompatibility) {
            crossPlatformCompatibility.on('crossPlatformModeChanged', (data) => {
                this.emit('crossPlatformModeChanged', data);
                
                // Adjust UI for cross-platform mode
                this.adjustUIForCrossPlatform(data.enabled);
            });
            
            crossPlatformCompatibility.on('performanceOptimized', (optimizations) => {
                this.emit('performanceOptimized', optimizations);
            });
        }
    }

    adjustUIForNetworkQuality(quality) {
        // Adjust UI based on network quality
        const animationManager = this.components.get('animationPerformanceManager');
        if (animationManager) {
            switch (quality) {
                case 'poor':
                    animationManager.setQualityLevel('low');
                    break;
                case 'fair':
                    animationManager.setQualityLevel('medium');
                    break;
                case 'good':
                    animationManager.setQualityLevel('high');
                    break;
            }
        }
        
        // Update UI classes
        document.body.classList.remove('network-poor', 'network-fair', 'network-good');
        document.body.classList.add(`network-${quality}`);
    }

    adjustUIForCrossPlatform(enabled) {
        // Adjust UI for cross-platform mode
        document.body.classList.toggle('cross-platform-mode', enabled);
        
        // Notify all components
        this.components.forEach(component => {
            if (component.setCrossPlatformMode) {
                component.setCrossPlatformMode(enabled);
            }
        });
    }

    async waitForComponentsReady() {
        // Give components time to initialize
        return new Promise(resolve => {
            setTimeout(resolve, 100);
        });
    }

    setupEventSystem() {
        // Setup inter-component communication
        this.setupComponentCommunication();
        
        // Setup global event listeners
        this.setupGlobalEventListeners();
    }

    setupComponentCommunication() {
        const orientationManager = this.components.get('orientationManager');
        const touchManager = this.components.get('touchManager');
        const gestureRecognizer = this.components.get('gestureRecognizer');
        const safeAreaHandler = this.components.get('safeAreaHandler');
        const responsiveLayoutManager = this.components.get('responsiveLayoutManager');
        const accessibilityManager = this.components.get('accessibilityManager');
        const animationPerformanceManager = this.components.get('animationPerformanceManager');
        const memoryManager = this.components.get('memoryManager');
        
        // Connect orientation changes to safe area updates
        if (orientationManager && safeAreaHandler) {
            orientationManager.addTransitionCallback((newOrientation, previousOrientation) => {
                safeAreaHandler.handleOrientationChange();
                this.emit('orientationChanged', { newOrientation, previousOrientation });
            });
        }
        
        // Connect orientation changes to responsive layout updates
        if (orientationManager && responsiveLayoutManager) {
            orientationManager.addTransitionCallback((newOrientation, previousOrientation) => {
                // Responsive layout manager will handle this automatically through its own listeners
                this.emit('orientationChanged', { newOrientation, previousOrientation });
            });
        }
        
        // Connect responsive layout changes to other components
        if (responsiveLayoutManager) {
            responsiveLayoutManager.onBreakpointChange((event) => {
                this.emit('breakpointChanged', event);
                
                // Notify accessibility manager of layout changes
                if (accessibilityManager) {
                    accessibilityManager.announce(`Layout changed to ${event.newBreakpoint} breakpoint`, 'polite');
                }
            });
            
            responsiveLayoutManager.onLayoutUpdate((event) => {
                this.emit('layoutUpdated', event);
            });
        }
        
        // Connect accessibility manager to other components
        if (accessibilityManager) {
            // Listen for screen changes to announce them
            this.on('screenChanged', (event) => {
                const screenNames = {
                    'login': 'Login screen',
                    'lobby': 'Game lobby',
                    'game-creation': 'Game creation',
                    'game': 'Game screen'
                };
                
                const screenName = screenNames[event.newScreen] || event.newScreen;
                accessibilityManager.announce(`Navigated to ${screenName}`, 'polite');
            });
        }
        
        // Connect performance managers
        if (animationPerformanceManager && memoryManager) {
            // Monitor performance and memory together
            animationPerformanceManager.on('frameDrop', (event) => {
                // Check if memory pressure is causing frame drops
                if (!memoryManager.isMemoryOptimal()) {
                    memoryManager.performGentleCleanup();
                }
            });
            
            memoryManager.on('memoryCritical', (event) => {
                // Reduce animation quality when memory is critical
                animationPerformanceManager.reduceAnimationQuality();
            });
        }
        
        // Connect touch events to gesture recognition
        if (touchManager && gestureRecognizer) {
            // This would be implemented when touch events need gesture recognition
            // For now, they operate independently
        }
        
        // Connect safe area changes to layout updates
        if (safeAreaHandler) {
            safeAreaHandler.addCallback((event) => {
                this.emit('safeAreaChanged', event);
            });
        }
    }

    setupGlobalEventListeners() {
        // Listen for screen visibility changes
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Listen for window focus changes
        window.addEventListener('focus', () => {
            this.handleWindowFocus();
        });
        
        window.addEventListener('blur', () => {
            this.handleWindowBlur();
        });
        
        // Listen for network changes
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                this.handleNetworkChange();
            });
        }
    }

    applyMobileOptimizations() {
        // Add mobile UI system class to body
        document.body.classList.add('mobile-ui-system');
        
        // Apply performance optimizations
        if (this.config.enablePerformanceOptimizations) {
            this.applyPerformanceOptimizations();
        }
        
        // Setup CSS custom properties
        this.setupCSSCustomProperties();
        
        // Apply mobile-specific styles
        this.applyMobileStyles();
    }

    applyPerformanceOptimizations() {
        // Enable hardware acceleration for animations
        document.body.style.transform = 'translateZ(0)';
        
        // Optimize scrolling
        document.body.style.webkitOverflowScrolling = 'touch';
        
        // Prevent text size adjustment on orientation change
        document.body.style.webkitTextSizeAdjust = '100%';
        document.body.style.textSizeAdjust = '100%';
        
        // Optimize touch action
        document.body.style.touchAction = 'manipulation';
    }

    setupCSSCustomProperties() {
        const root = document.documentElement;
        
        // Set system information as CSS custom properties
        root.style.setProperty('--mobile-ui-initialized', '1');
        root.style.setProperty('--viewport-width', `${window.innerWidth}px`);
        root.style.setProperty('--viewport-height', `${window.innerHeight}px`);
        
        // Update on resize
        window.addEventListener('resize', () => {
            root.style.setProperty('--viewport-width', `${window.innerWidth}px`);
            root.style.setProperty('--viewport-height', `${window.innerHeight}px`);
        });
    }

    applyMobileStyles() {
        // Inject mobile UI system styles
        const css = `
            .mobile-ui-system {
                /* Prevent text selection on UI elements */
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                
                /* Prevent callout on touch and hold */
                -webkit-touch-callout: none;
                
                /* Prevent tap highlight */
                -webkit-tap-highlight-color: transparent;
                
                /* Optimize font rendering */
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                
                /* Prevent zoom on double tap */
                touch-action: manipulation;
            }
            
            .mobile-ui-system * {
                /* Ensure all elements use border-box sizing */
                box-sizing: border-box;
            }
            
            /* Mobile-specific input styles */
            .mobile-ui-system input,
            .mobile-ui-system textarea,
            .mobile-ui-system select {
                /* Prevent zoom on focus for iOS */
                font-size: 16px;
            }
            
            /* Smooth scrolling for mobile */
            .mobile-ui-system .scrollable {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
            }
            
            /* Hardware acceleration for animations */
            .mobile-ui-system .animated {
                transform: translateZ(0);
                will-change: transform;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'mobile-ui-system-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    setupScreenManagement() {
        // Detect initial screen
        this.currentScreen = this.detectCurrentScreen();
        
        // Setup screen change detection
        this.setupScreenChangeDetection();
        
        // Apply screen-specific optimizations
        this.applyScreenOptimizations(this.currentScreen);
    }

    detectCurrentScreen() {
        // Check for active screens
        const screens = [
            { id: 'welcomeScreen', type: 'lobby' },
            { id: 'gameScreen', type: 'game' },
            { id: 'loginScreen', type: 'login' },
            { id: 'gameCreationScreen', type: 'game-creation' }
        ];
        
        for (const screen of screens) {
            const element = document.getElementById(screen.id);
            if (element && element.classList.contains('active')) {
                return screen.type;
            }
        }
        
        // Default to lobby if no specific screen is detected
        return 'lobby';
    }

    setupScreenChangeDetection() {
        // Use MutationObserver to detect screen changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('screen') && target.classList.contains('active')) {
                        const newScreen = this.getScreenTypeFromElement(target);
                        if (newScreen && newScreen !== this.currentScreen) {
                            this.handleScreenChange(newScreen);
                        }
                    }
                }
            });
        });
        
        // Observe all screen elements
        const screenElements = document.querySelectorAll('.screen');
        screenElements.forEach(element => {
            observer.observe(element, { attributes: true, attributeFilter: ['class'] });
        });
    }

    getScreenTypeFromElement(element) {
        const screenMap = {
            'welcomeScreen': 'lobby',
            'gameScreen': 'game',
            'loginScreen': 'login',
            'gameCreationScreen': 'game-creation'
        };
        
        return screenMap[element.id] || null;
    }

    handleScreenChange(newScreen) {
        const previousScreen = this.currentScreen;
        
        // Update screen history
        if (previousScreen) {
            this.screenHistory.push(previousScreen);
        }
        
        this.currentScreen = newScreen;
        
        // Apply screen-specific optimizations
        this.applyScreenOptimizations(newScreen);
        
        // Notify orientation manager
        const orientationManager = this.components.get('orientationManager');
        if (orientationManager) {
            const event = new CustomEvent('screenchange', {
                detail: { screenType: newScreen, previousScreen }
            });
            document.dispatchEvent(event);
        }
        
        // Emit screen change event
        this.emit('screenChanged', { newScreen, previousScreen });
    }

    applyScreenOptimizations(screenType) {
        // Remove previous screen classes
        document.body.classList.remove('screen-login', 'screen-lobby', 'screen-game-creation', 'screen-game');
        
        // Add current screen class
        document.body.classList.add(`screen-${screenType}`);
        
        // Apply screen-specific optimizations
        switch (screenType) {
            case 'login':
                this.optimizeForLogin();
                break;
            case 'lobby':
                this.optimizeForLobby();
                break;
            case 'game-creation':
                this.optimizeForGameCreation();
                break;
            case 'game':
                this.optimizeForGame();
                break;
        }
    }

    optimizeForLogin() {
        // Portrait orientation optimization
        // Keyboard handling optimization
        // Form input optimization
    }

    optimizeForLobby() {
        // Portrait orientation optimization
        // List scrolling optimization
        // Pull-to-refresh optimization
    }

    optimizeForGameCreation() {
        // Landscape orientation optimization
        // Form handling optimization
    }

    optimizeForGame() {
        // Landscape orientation optimization
        // Touch interaction optimization
        // Performance optimization for game elements
    }

    // Event handling methods
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.emit('appVisible');
        } else {
            this.emit('appHidden');
        }
    }

    handleWindowFocus() {
        this.emit('appFocused');
    }

    handleWindowBlur() {
        this.emit('appBlurred');
    }

    handleNetworkChange() {
        const connection = navigator.connection;
        this.emit('networkChanged', {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt
        });
    }

    // Public API methods
    getComponent(name) {
        return this.components.get(name);
    }

    getCurrentScreen() {
        return this.currentScreen;
    }

    getScreenHistory() {
        return [...this.screenHistory];
    }

    isReady() {
        return this.isInitialized;
    }

    // Navigation methods
    showLoginScreen() {
        const loginScreen = this.components.get('mobileLoginScreen');
        if (loginScreen) {
            loginScreen.show();
        }
    }

    hideLoginScreen() {
        const loginScreen = this.components.get('mobileLoginScreen');
        if (loginScreen) {
            loginScreen.hide();
        }
    }

    showLobbyScreen() {
        const lobbyScreen = this.components.get('mobileLobbyScreen');
        if (lobbyScreen) {
            lobbyScreen.show();
        }
    }

    hideLobbyScreen() {
        const lobbyScreen = this.components.get('mobileLobbyScreen');
        if (lobbyScreen) {
            lobbyScreen.hide();
        }
    }

    showGameCreationScreen() {
        const gameCreationScreen = this.components.get('mobileGameCreationScreen');
        if (gameCreationScreen) {
            gameCreationScreen.show();
        }
    }

    hideGameCreationScreen() {
        const gameCreationScreen = this.components.get('mobileGameCreationScreen');
        if (gameCreationScreen) {
            gameCreationScreen.hide();
        }
    }

    showGameScreen() {
        const gameScreen = this.components.get('mobileGameScreen');
        if (gameScreen) {
            gameScreen.show();
        }
    }

    hideGameScreen() {
        const gameScreen = this.components.get('mobileGameScreen');
        if (gameScreen) {
            gameScreen.hide();
        }
    }

    navigateToLogin() {
        this.hideLobbyScreen();
        this.showLoginScreen();
    }

    navigateToLobby() {
        this.hideLoginScreen();
        this.hideGameCreationScreen();
        this.showLobbyScreen();
    }

    navigateToGameCreation() {
        this.hideLobbyScreen();
        this.hideLoginScreen();
        this.hideGameScreen();
        this.showGameCreationScreen();
    }

    navigateToGame() {
        this.hideLobbyScreen();
        this.hideLoginScreen();
        this.hideGameCreationScreen();
        this.showGameScreen();
    }

    // Game integration methods
    getGameIntegration() {
        return this.components.get('mobileGameIntegration');
    }

    getNetworkingIntegration() {
        return this.components.get('mobileNetworkingIntegration');
    }

    getCrossPlatformCompatibility() {
        return this.components.get('crossPlatformCompatibility');
    }

    // Game state methods
    getCurrentGameState() {
        const gameIntegration = this.getGameIntegration();
        return gameIntegration ? gameIntegration.getCurrentGameState() : null;
    }

    getCurrentPlayer() {
        const gameIntegration = this.getGameIntegration();
        return gameIntegration ? gameIntegration.getCurrentPlayer() : null;
    }

    isPlayerTurn() {
        const gameIntegration = this.getGameIntegration();
        return gameIntegration ? gameIntegration.isPlayerTurn() : false;
    }

    // Connection methods
    isConnected() {
        const networkingIntegration = this.getNetworkingIntegration();
        return networkingIntegration ? networkingIntegration.isConnected() : false;
    }

    getConnectionState() {
        const networkingIntegration = this.getNetworkingIntegration();
        return networkingIntegration ? networkingIntegration.getConnectionState() : null;
    }

    getNetworkQuality() {
        const networkingIntegration = this.getNetworkingIntegration();
        return networkingIntegration ? networkingIntegration.getNetworkQuality() : 'unknown';
    }

    // Cross-platform methods
    isCrossPlatformGame() {
        const crossPlatformCompatibility = this.getCrossPlatformCompatibility();
        return crossPlatformCompatibility ? crossPlatformCompatibility.isCrossPlatformGame() : false;
    }

    getPlatformMix() {
        const crossPlatformCompatibility = this.getCrossPlatformCompatibility();
        return crossPlatformCompatibility ? crossPlatformCompatibility.getPlatformMix() : 'unknown';
    }

    // Game action methods
    sendGameAction(action, data) {
        const networkingIntegration = this.getNetworkingIntegration();
        if (networkingIntegration) {
            return networkingIntegration.sendAction(action, data);
        }
        return false;
    }

    joinGame(gameId, playerName) {
        const gameIntegration = this.getGameIntegration();
        if (gameIntegration) {
            gameIntegration.handleGameJoinRequest({ gameId, playerName });
            return true;
        }
        return false;
    }

    createGame(gameSettings) {
        const gameIntegration = this.getGameIntegration();
        if (gameIntegration) {
            gameIntegration.handleGameCreateRequest({ gameSettings });
            return true;
        }
        return false;
    }

    startGame() {
        const gameIntegration = this.getGameIntegration();
        if (gameIntegration) {
            gameIntegration.handleGameStartRequest();
            return true;
        }
        return false;
    }

    exitGame() {
        const gameIntegration = this.getGameIntegration();
        if (gameIntegration) {
            gameIntegration.handleExitGameRequest();
            return true;
        }
        return false;
    }

    // Player management methods
    setPlayerName(playerName) {
        const gameIntegration = this.getGameIntegration();
        if (gameIntegration) {
            gameIntegration.setPlayerName(playerName);
        }
    }

    getPlayerName() {
        const gameIntegration = this.getGameIntegration();
        if (gameIntegration) {
            const integrationState = gameIntegration.getIntegrationState();
            return integrationState.playerName;
        }
        return null;
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

    // Configuration methods
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig() {
        return { ...this.config };
    }

    // Cleanup
    destroy() {
        // Destroy all components
        this.components.forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
        
        // Clear components
        this.components.clear();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Remove styles
        const styleElement = document.getElementById('mobile-ui-system-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        // Remove CSS classes
        document.body.classList.remove('mobile-ui-system');
        
        // Mark as not initialized
        this.isInitialized = false;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on touch devices or mobile browsers
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     ('ontouchstart' in window) ||
                     (navigator.maxTouchPoints > 0);
    
    if (isMobile) {
        window.mobileUISystem = new MobileUISystem();
        console.log('Mobile UI System auto-initialized');
        
        // Enhance existing desktop buttons for mobile
        enhanceDesktopButtonsForMobile();
    }
});

// Function to enhance desktop buttons for mobile touch
function enhanceDesktopButtonsForMobile() {
    // Wait for the main game to initialize
    setTimeout(() => {
        const buttonsToEnhance = [
            'playWithFriendsBtn',
            'playWithBotBtn',
            'createGameBtn',
            'joinGameBtn',
            'startBotGameBtn'
        ];
        
        buttonsToEnhance.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                // Just ensure mobile-friendly styling - touch events handled by safe-events.js
                button.style.touchAction = 'manipulation';
                button.style.webkitTouchCallout = 'none';
                button.style.webkitUserSelect = 'none';
                button.style.userSelect = 'none';
                button.style.webkitTapHighlightColor = 'transparent';
                
                console.log(`Enhanced ${buttonId} for mobile touch`);
            }
        });
        
    }, 1000); // Wait 1 second for the main game to initialize
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileUISystem;
} else if (typeof window !== 'undefined') {
    window.MobileUISystem = MobileUISystem;
}