/**
 * Mobile Interface Activator
 * Automatically detects mobile devices and activates mobile UI interface
 * Hides desktop interface and shows mobile screens appropriately
 */

class MobileInterfaceActivator {
    constructor() {
        this.isMobile = false;
        this.isActivated = false;
        this.mobileUISystem = null;
        this.desktopElements = [];
        this.mobileElements = [];
        this.mobileInteractionRouter = null;
        this.mobileInterfaceToggle = null;
        
        this.init();
    }

    init() {
        // Detect mobile device
        this.isMobile = this.detectMobileDevice();
        
        // Check for manual override
        const forceMode = localStorage.getItem('force_mobile_interface');
        if (forceMode === 'true') {
            console.log('🔧 Force mobile interface enabled via localStorage');
            this.isMobile = true;
        }
        
        console.log('Mobile Interface Activator initialized:', {
            isMobile: this.isMobile,
            userAgent: navigator.userAgent,
            touchSupport: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints,
            forceMode: forceMode
        });
        
        if (this.isMobile) {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.activateMobileInterface();
                });
            } else {
                this.activateMobileInterface();
            }
        }
    }

    /**
     * Detect if the current device is mobile
     */
    detectMobileDevice() {
        // Method 1: User agent detection
        const mobileUserAgents = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const userAgentMatch = mobileUserAgents.test(navigator.userAgent);
        
        // Method 2: Touch support
        const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Method 3: Screen size (mobile-like dimensions)
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const isMobileScreen = (screenWidth <= 768 && screenHeight <= 1024) || 
                              (screenWidth <= 1024 && screenHeight <= 768);
        
        // Method 4: Viewport dimensions
        const viewportWidth = window.innerWidth;
        const isMobileViewport = viewportWidth <= 768;
        
        // Method 5: Device pixel ratio (high DPI mobile screens)
        const hasHighDPI = window.devicePixelRatio > 1;
        
        // Combine detection methods
        const mobileIndicators = [
            userAgentMatch,
            hasTouchSupport && isMobileScreen,
            isMobileViewport && hasTouchSupport,
            userAgentMatch && hasHighDPI
        ];
        
        const mobileScore = mobileIndicators.filter(Boolean).length;
        
        // Make detection more lenient - require only 1 indicator OR touch support
        const isMobile = mobileScore >= 1 || hasTouchSupport;
        
        console.log('Mobile detection analysis:', {
            userAgentMatch,
            hasTouchSupport,
            isMobileScreen,
            isMobileViewport,
            hasHighDPI,
            mobileScore,
            isMobile,
            screenDimensions: `${screenWidth}x${screenHeight}`,
            viewportDimensions: `${viewportWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio
        });
        
        return isMobile;
    }

    /**
     * Activate mobile interface and hide desktop interface
     */
    async activateMobileInterface() {
        if (this.isActivated) {
            console.log('Mobile interface already activated');
            return;
        }
        
        console.log('Activating mobile interface...');
        
        try {
            // Step 1: Initialize mobile UI system if not already done
            await this.initializeMobileUISystem();
            
            // Step 2: Hide desktop interface elements
            this.hideDesktopInterface();
            
            // Step 3: Show mobile interface elements
            this.showMobileInterface();
            
            // Step 4: Apply mobile-specific styles and optimizations
            this.applyMobileOptimizations();
            
            // Step 5: Set up mobile navigation
            this.setupMobileNavigation();
            
            // Step 6: Handle authentication state for mobile
            this.handleMobileAuthentication();
            
            // Step 7: Initialize mobile interface toggle
            this.initializeMobileInterfaceToggle();
            
            this.isActivated = true;
            console.log('Mobile interface activation complete');
            
            // Emit activation event
            this.emitActivationEvent();
            
        } catch (error) {
            console.error('Failed to activate mobile interface:', error);
            this.handleActivationFailure(error);
        }
    }

    /**
     * Force mobile interface activation (for debugging/manual override)
     */
    forceMobileActivation() {
        console.log('🔧 Forcing mobile interface activation...');
        
        // Set force flag
        localStorage.setItem('force_mobile_interface', 'true');
        
        // Override mobile detection
        this.isMobile = true;
        
        // Activate mobile interface
        if (!this.isActivated) {
            this.activateMobileInterface();
        } else {
            console.log('Mobile interface already activated');
        }
    }

    /**
     * Disable force mobile mode and switch back to auto-detection
     */
    disableForceMobile() {
        console.log('🔧 Disabling force mobile mode...');
        
        // Remove force flag
        localStorage.removeItem('force_mobile_interface');
        
        // Reload page to reset
        window.location.reload();
    }

    /**
     * Initialize mobile UI system
     */
    async initializeMobileUISystem() {
        // Check if mobile UI system is already initialized
        if (window.mobileUISystem && window.mobileUISystem.isReady()) {
            this.mobileUISystem = window.mobileUISystem;
            console.log('Using existing mobile UI system');
            return;
        }
        
        // Initialize new mobile UI system
        if (typeof MobileUISystem !== 'undefined') {
            this.mobileUISystem = new MobileUISystem();
            window.mobileUISystem = this.mobileUISystem;
            
            // Wait for initialization to complete
            await new Promise((resolve, reject) => {
                if (this.mobileUISystem.isReady()) {
                    resolve();
                } else {
                    this.mobileUISystem.on('initialized', resolve);
                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error('Mobile UI system initialization timeout')), 10000);
                }
            });
            
            console.log('Mobile UI system initialized successfully');
        } else {
            throw new Error('MobileUISystem class not available');
        }
    }

    /**
     * Hide desktop interface elements
     */
    hideDesktopInterface() {
        console.log('Hiding desktop interface elements...');
        
        // Desktop elements to hide
        const desktopSelectors = [
            '#welcomeScreen',
            '#gameScreen .game-container',
            '.profile-bubble',
            '.welcome-container',
            '.game-header-bar',
            '.game-layout',
            '.player-hand-section'
        ];
        
        desktopSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    // Store original display value for potential restoration
                    element.setAttribute('data-original-display', 
                        window.getComputedStyle(element).display);
                    element.style.display = 'none';
                    element.classList.add('desktop-hidden-for-mobile');
                    this.desktopElements.push(element);
                }
            });
        });
        
        // Add mobile-active class to body
        document.body.classList.add('mobile-interface-active');
        document.body.classList.add('mobile-device');
        
        console.log(`Hidden ${this.desktopElements.length} desktop elements`);
    }

    /**
     * Show mobile interface elements
     */
    showMobileInterface() {
        console.log('Showing mobile interface elements...');
        
        // For now, always show fallback interface until mobile UI system is working
        console.log('Forcing fallback mobile interface for debugging');
        this.showFallbackMobileInterface();
        return;
        
        // Determine which mobile screen to show based on authentication
        const isAuthenticated = this.isUserAuthenticated();
        
        if (isAuthenticated) {
            // Show mobile lobby screen
            this.showMobileLobbyScreen();
        } else {
            // Show mobile login screen
            this.showMobileLoginScreen();
        }
    }

    /**
     * Check if user is authenticated
     */
    isUserAuthenticated() {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const username = localStorage.getItem('username') || sessionStorage.getItem('username');
        
        return !!(token && username);
    }

    /**
     * Show mobile login screen
     */
    showMobileLoginScreen() {
        console.log('Showing mobile login screen...');
        
        if (this.mobileUISystem) {
            const loginScreen = this.mobileUISystem.getComponent('mobileLoginScreen');
            if (loginScreen) {
                loginScreen.show();
                this.mobileElements.push(loginScreen.container);
                
                // Set up login success handler
                loginScreen.on?.('loginSuccess', () => {
                    this.transitionToLobby();
                });
            } else {
                console.warn('Mobile login screen component not available - showing fallback');
                this.showFallbackMobileInterface();
            }
        } else {
            console.warn('Mobile UI System not available - showing fallback');
            this.showFallbackMobileInterface();
        }
    }

    /**
     * Show mobile lobby screen
     */
    showMobileLobbyScreen() {
        console.log('Showing mobile lobby screen...');
        
        if (this.mobileUISystem) {
            const lobbyScreen = this.mobileUISystem.getComponent('mobileLobbyScreen');
            if (lobbyScreen) {
                lobbyScreen.show();
                this.mobileElements.push(lobbyScreen.screenElement);
                
                // Set up navigation handlers
                this.setupLobbyNavigationHandlers(lobbyScreen);
            } else {
                console.warn('Mobile lobby screen component not available - showing fallback');
                this.showFallbackMobileInterface();
            }
        } else {
            console.warn('Mobile UI System not available - showing fallback');
            this.showFallbackMobileInterface();
        }
    }

    /**
     * Set up lobby navigation handlers
     */
    setupLobbyNavigationHandlers(lobbyScreen) {
        // Handle game creation navigation
        lobbyScreen.on?.('navigateToGameCreation', () => {
            this.transitionToGameCreation();
        });
        
        // Handle game joining
        lobbyScreen.on?.('joinGame', (gameId) => {
            this.transitionToGame(gameId);
        });
        
        // Handle logout
        lobbyScreen.on?.('logout', () => {
            this.transitionToLogin();
        });
    }

    /**
     * Apply mobile-specific optimizations
     */
    applyMobileOptimizations() {
        console.log('Applying mobile optimizations...');
        
        // Add mobile CSS classes
        document.body.classList.add('mobile-optimized');
        document.documentElement.classList.add('mobile-interface');
        
        // Set viewport meta tag if not already set
        this.ensureViewportMeta();
        
        // Apply mobile-specific CSS
        this.injectMobileCSS();
        
        // Optimize touch interactions
        this.optimizeTouchInteractions();
        
        // Handle orientation changes
        this.setupOrientationHandling();
    }

    /**
     * Ensure proper viewport meta tag
     */
    ensureViewportMeta() {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }
        
        // Set mobile-optimized viewport
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    }

    /**
     * Inject mobile-specific CSS
     */
    injectMobileCSS() {
        const mobileCSS = `
            /* Mobile Interface Activation Styles */
            .mobile-interface-active {
                overflow-x: hidden;
                -webkit-overflow-scrolling: touch;
            }
            
            .mobile-interface-active .desktop-hidden-for-mobile {
                display: none !important;
            }
            
            .mobile-interface {
                /* Prevent zoom on input focus */
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
            }
            
            .mobile-optimized {
                /* Optimize touch interactions */
                touch-action: manipulation;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            
            /* Mobile screen transitions */
            .mobile-screen {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                background: var(--background-color, #ffffff);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .mobile-screen.hidden {
                opacity: 0;
                transform: translateX(100%);
                pointer-events: none;
            }
            
            /* Screen transition animations */
            .transition-slide-left .mobile-screen.entering {
                transform: translateX(-100%);
                animation: slideInLeft 0.3s ease forwards;
            }
            
            .transition-slide-right .mobile-screen.entering {
                transform: translateX(100%);
                animation: slideInRight 0.3s ease forwards;
            }
            
            .transition-fade .mobile-screen.entering {
                opacity: 0;
                animation: fadeIn 0.3s ease forwards;
            }
            
            @keyframes slideInLeft {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* Fallback mobile interface */
            .mobile-fallback-interface {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                color: white;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
            }
            
            /* Mobile Lobby Header */
            .mobile-lobby-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: env(safe-area-inset-top, 20px) 20px 20px 20px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }

            .lobby-title h1 {
                color: white;
                font-size: 24px;
                font-weight: 700;
                margin: 0 0 4px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .lobby-title p {
                color: rgba(255, 255, 255, 0.8);
                font-size: 14px;
                margin: 0;
            }

            .user-info {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;
            }

            .username {
                color: white;
                font-weight: 600;
                font-size: 16px;
            }

            .connection-status {
                color: rgba(255, 255, 255, 0.8);
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            /* Mobile Lobby Content */
            .mobile-lobby-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: white;
                border-radius: 20px 20px 0 0;
                margin-top: 10px;
                overflow: hidden;
            }

            /* Lobby Tabs */
            .lobby-tabs {
                display: flex;
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
            }

            .tab-button {
                flex: 1;
                padding: 16px 12px;
                background: none;
                border: none;
                font-size: 14px;
                font-weight: 500;
                color: #6c757d;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                position: relative;
                transition: all 0.2s ease;
                min-height: 44px;
            }

            .tab-button.active {
                color: #667eea;
                background: white;
            }

            .tab-button i {
                font-size: 18px;
            }

            .invite-count {
                position: absolute;
                top: 8px;
                right: 8px;
                background: #dc3545;
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 10px;
                min-width: 16px;
                text-align: center;
            }

            /* Tab Content */
            .tab-content {
                flex: 1;
                padding: 20px;
                display: none;
                overflow-y: auto;
            }

            .tab-content.active {
                display: flex;
                flex-direction: column;
            }

            /* Games List */
            .games-list {
                flex: 1;
                margin-bottom: 20px;
            }

            .loading-games, .loading-players {
                text-align: center;
                padding: 40px 20px;
                color: #6c757d;
            }

            .loading-games i, .loading-players i {
                font-size: 24px;
                margin-bottom: 10px;
                display: block;
            }

            .no-games, .no-invites {
                text-align: center;
                padding: 40px 20px;
                color: #6c757d;
            }

            .no-games i, .no-invites i {
                font-size: 48px;
                margin-bottom: 16px;
                display: block;
                color: #dee2e6;
            }

            .no-games h3, .no-invites h3 {
                margin: 0 0 8px 0;
                color: #495057;
            }

            .no-games p, .no-invites p {
                margin: 0;
                font-size: 14px;
            }

            /* Mobile Game Cards */
            .mobile-game-card {
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .game-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .game-card-header h3 {
                margin: 0;
                font-size: 18px;
                color: #212529;
            }

            .game-status {
                background: #e9ecef;
                color: #495057;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
            }

            .game-card-info {
                margin-bottom: 12px;
            }

            .player-count {
                color: #6c757d;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .game-card-actions {
                display: flex;
                gap: 8px;
            }

            /* Lobby Actions */
            .lobby-actions {
                display: flex;
                gap: 12px;
                margin-top: auto;
            }

            .lobby-actions .btn {
                flex: 1;
                padding: 12px 16px;
                border: none;
                border-radius: 8px;
                font-weight: 500;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.2s ease;
                min-height: 44px;
                cursor: pointer;
            }

            .btn-primary {
                background: #667eea;
                color: white;
            }

            .btn-primary:hover {
                background: #5a6fd8;
            }

            .btn-secondary {
                background: #6c757d;
                color: white;
            }

            .btn-secondary:hover {
                background: #5a6268;
            }

            .btn-sm {
                padding: 8px 12px;
                font-size: 12px;
                min-height: 32px;
            }

            /* Mobile Debug Toggle */
            .mobile-debug-toggle {
                position: absolute;
                bottom: env(safe-area-inset-bottom, 20px);
                right: 20px;
                z-index: 1001;
            }

            .mobile-debug-toggle button {
                background: rgba(0,0,0,0.7);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
            }
            
            .mobile-fallback-interface h1 {
                font-size: 2rem;
                margin-bottom: 1rem;
                font-weight: 600;
            }
            
            .mobile-fallback-interface p {
                font-size: 1.1rem;
                margin-bottom: 2rem;
                opacity: 0.9;
                line-height: 1.5;
            }
            
            .mobile-fallback-interface .fallback-actions {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                width: 100%;
                max-width: 300px;
            }
            
            .mobile-fallback-interface button {
                padding: 12px 24px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            }
            
            .mobile-fallback-interface button:hover,
            .mobile-fallback-interface button:active {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.5);
                transform: translateY(-2px);
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'mobile-interface-activator-styles';
        styleElement.textContent = mobileCSS;
        document.head.appendChild(styleElement);
    }

    /**
     * Optimize touch interactions
     */
    optimizeTouchInteractions() {
        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Prevent pinch zoom
        document.addEventListener('touchmove', (event) => {
            if (event.touches.length > 1) {
                event.preventDefault();
            }
        }, { passive: false });
        
        // Optimize scrolling
        document.addEventListener('touchstart', (event) => {
            // Allow scrolling on scrollable elements
            const target = event.target;
            const scrollableParent = target.closest('.scrollable, .mobile-screen');
            if (!scrollableParent) {
                // Prevent default on non-scrollable areas
                event.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Set up orientation handling
     */
    setupOrientationHandling() {
        // Handle orientation changes
        const handleOrientationChange = () => {
            // Update viewport height for mobile browsers
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // Emit orientation change event
            if (this.mobileUISystem) {
                this.mobileUISystem.emit('orientationChanged', {
                    orientation: window.orientation || 0,
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }
        };
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', handleOrientationChange);
        window.addEventListener('resize', handleOrientationChange);
        
        // Initial call
        handleOrientationChange();
    }

    /**
     * Set up mobile navigation
     */
    setupMobileNavigation() {
        // Set up navigation controller if available
        if (this.mobileUISystem) {
            const navigationController = this.mobileUISystem.getComponent('navigationController');
            if (navigationController) {
                // Set up navigation event handlers
                navigationController.on?.('navigate', (event) => {
                    this.handleMobileNavigation(event);
                });
            }
        }
        
        // Initialize mobile interaction router
        this.initializeMobileInteractionRouter();
        
        // Set up global navigation events
        this.setupGlobalNavigationEvents();
    }

    /**
     * Initialize mobile interface toggle
     */
    initializeMobileInterfaceToggle() {
        if (typeof MobileInterfaceToggle !== 'undefined') {
            this.mobileInterfaceToggle = new MobileInterfaceToggle(this);
            console.log('Mobile Interface Toggle initialized');
        } else {
            console.warn('MobileInterfaceToggle not available');
        }
    }

    /**
     * Initialize mobile interaction router
     */
    initializeMobileInteractionRouter() {
        if (typeof MobileInteractionRouter !== 'undefined') {
            this.mobileInteractionRouter = new MobileInteractionRouter(this.mobileUISystem, this);
            console.log('Mobile Interaction Router initialized');
        } else {
            console.warn('MobileInteractionRouter not available');
        }
    }

    /**
     * Set up global navigation events
     */
    setupGlobalNavigationEvents() {
        // Listen for mobile UI system navigation events
        if (this.mobileUISystem) {
            this.mobileUISystem.on('navigateToLogin', () => {
                this.transitionToLogin();
            });
            
            this.mobileUISystem.on('navigateToLobby', () => {
                this.transitionToLobby();
            });
            
            this.mobileUISystem.on('navigateToGameCreation', () => {
                this.transitionToGameCreation();
            });
            
            this.mobileUISystem.on('navigateToGame', (gameId) => {
                this.transitionToGame(gameId);
            });
        }
    }

    /**
     * Handle mobile authentication
     */
    handleMobileAuthentication() {
        // Check authentication status periodically
        const checkAuth = () => {
            const wasAuthenticated = this.isUserAuthenticated();
            
            // If authentication status changed, update interface
            setTimeout(() => {
                const isAuthenticated = this.isUserAuthenticated();
                if (wasAuthenticated !== isAuthenticated) {
                    if (isAuthenticated) {
                        this.transitionToLobby();
                    } else {
                        this.transitionToLogin();
                    }
                }
            }, 1000);
        };
        
        // Check every 30 seconds
        setInterval(checkAuth, 30000);
        
        // Listen for storage changes (login/logout in other tabs)
        window.addEventListener('storage', (event) => {
            if (event.key === 'auth_token' || event.key === 'username') {
                checkAuth();
            }
        });
    }

    /**
     * Screen transition methods
     */
    transitionToLogin() {
        console.log('Transitioning to mobile login screen...');
        this.hideAllMobileScreens();
        this.showMobileLoginScreen();
    }

    transitionToLobby() {
        console.log('Transitioning to mobile lobby screen...');
        this.hideAllMobileScreens();
        this.showMobileLobbyScreen();
    }

    transitionToGameCreation() {
        console.log('Transitioning to mobile game creation screen...');
        this.hideAllMobileScreens();
        
        if (this.mobileUISystem) {
            const gameCreationScreen = this.mobileUISystem.getComponent('mobileGameCreationScreen');
            if (gameCreationScreen) {
                gameCreationScreen.show();
            }
        }
    }

    transitionToGame(gameId) {
        console.log('Transitioning to mobile game screen...', gameId);
        this.hideAllMobileScreens();
        
        if (this.mobileUISystem) {
            const gameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
            if (gameScreen) {
                gameScreen.show();
                if (gameId) {
                    gameScreen.loadGame?.(gameId);
                }
            }
        }
    }

    /**
     * Hide all mobile screens
     */
    hideAllMobileScreens() {
        if (this.mobileUISystem) {
            const screens = ['mobileLoginScreen', 'mobileLobbyScreen', 'mobileGameCreationScreen', 'mobileGameScreen'];
            screens.forEach(screenName => {
                const screen = this.mobileUISystem.getComponent(screenName);
                if (screen && screen.hide) {
                    screen.hide();
                }
            });
        }
    }

    /**
     * Handle mobile navigation events
     */
    handleMobileNavigation(event) {
        console.log('Handling mobile navigation:', event);
        
        switch (event.to) {
            case 'login':
                this.transitionToLogin();
                break;
            case 'lobby':
                this.transitionToLobby();
                break;
            case 'game-creation':
                this.transitionToGameCreation();
                break;
            case 'game':
                this.transitionToGame(event.gameId);
                break;
            default:
                console.warn('Unknown navigation target:', event.to);
        }
    }

    /**
     * Show fallback mobile interface if components are not available
     */
    showFallbackMobileInterface() {
        console.log('Showing fallback mobile interface...');
        
        // Create a proper mobile lobby interface as fallback
        const fallbackInterface = document.createElement('div');
        fallbackInterface.className = 'mobile-fallback-interface mobile-lobby-screen';
        fallbackInterface.innerHTML = `
            <div class="mobile-lobby-header">
                <div class="lobby-title">
                    <h1><i class="fas fa-chess-board"></i> J-kube Mobile</h1>
                    <p>Play Rummikub with friends</p>
                </div>
                <div class="user-info">
                    <span class="username">${localStorage.getItem('username') || 'Player'}</span>
                    <span class="connection-status">
                        <i class="fas fa-circle" style="color: #4CAF50;"></i> Online
                    </span>
                </div>
            </div>
            
            <div class="mobile-lobby-content">
                <div class="lobby-tabs">
                    <button class="tab-button active" data-tab="games">
                        <i class="fas fa-gamepad"></i> Games
                    </button>
                    <button class="tab-button" data-tab="players">
                        <i class="fas fa-users"></i> Players
                    </button>
                    <button class="tab-button" data-tab="invites">
                        <i class="fas fa-envelope"></i> Invites
                        <span class="invite-count">0</span>
                    </button>
                </div>
                
                <div class="tab-content active" id="games-tab">
                    <div class="games-list">
                        <div class="loading-games">
                            <i class="fas fa-spinner fa-spin"></i> Loading games...
                        </div>
                    </div>
                    <div class="lobby-actions">
                        <button id="mobile-create-game-btn" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Create Game
                        </button>
                        <button id="mobile-refresh-btn" class="btn btn-secondary">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                </div>
                
                <div class="tab-content" id="players-tab">
                    <div class="players-list">
                        <div class="loading-players">
                            <i class="fas fa-spinner fa-spin"></i> Loading players...
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="invites-tab">
                    <div class="invites-list">
                        <div class="no-invites">
                            <i class="fas fa-inbox"></i>
                            <h3>No Invitations</h3>
                            <p>You don't have any game invitations yet</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mobile-debug-toggle">
                <button onclick="window.mobileInterfaceActivator.switchToDesktop()">
                    💻 Desktop Mode
                </button>
            </div>
        `;
        
        document.body.appendChild(fallbackInterface);
        this.mobileElements.push(fallbackInterface);
        
        // Set up basic tab functionality
        this.setupFallbackTabNavigation(fallbackInterface);
        
        // Set up basic game functionality
        this.setupFallbackGameActions(fallbackInterface);
        
        // Load games list
        this.loadGamesForFallback(fallbackInterface);
    }

    /**
     * Set up tab navigation for fallback interface
     */
    setupFallbackTabNavigation(container) {
        const tabButtons = container.querySelectorAll('.tab-button');
        const tabContents = container.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}-tab`) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    /**
     * Set up game actions for fallback interface
     */
    setupFallbackGameActions(container) {
        const createGameBtn = container.querySelector('#mobile-create-game-btn');
        const refreshBtn = container.querySelector('#mobile-refresh-btn');
        
        if (createGameBtn) {
            createGameBtn.addEventListener('click', () => {
                // Use existing game creation functionality
                if (window.createGameBtn) {
                    window.createGameBtn.click();
                } else {
                    // Fallback to direct game creation
                    this.createGameFallback();
                }
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadGamesForFallback(container);
            });
        }
    }

    /**
     * Load games list for fallback interface
     */
    loadGamesForFallback(container) {
        const gamesContainer = container.querySelector('.games-list');
        if (!gamesContainer) return;
        
        // Show loading state
        gamesContainer.innerHTML = `
            <div class="loading-games">
                <i class="fas fa-spinner fa-spin"></i> Loading games...
            </div>
        `;
        
        // Try to use existing games loading functionality
        if (window.refreshGames && typeof window.refreshGames === 'function') {
            window.refreshGames().then(() => {
                // Copy games from desktop interface
                this.copyGamesFromDesktop(gamesContainer);
            }).catch(() => {
                this.showNoGamesMessage(gamesContainer);
            });
        } else {
            // Fallback to no games message
            setTimeout(() => {
                this.showNoGamesMessage(gamesContainer);
            }, 1000);
        }
    }

    /**
     * Copy games from desktop interface to mobile fallback
     */
    copyGamesFromDesktop(mobileContainer) {
        const desktopGamesList = document.querySelector('#gamesList');
        if (desktopGamesList) {
            const games = desktopGamesList.querySelectorAll('.game-item');
            if (games.length > 0) {
                mobileContainer.innerHTML = '';
                games.forEach(game => {
                    const mobileGame = this.createMobileGameCard(game);
                    mobileContainer.appendChild(mobileGame);
                });
            } else {
                this.showNoGamesMessage(mobileContainer);
            }
        } else {
            this.showNoGamesMessage(mobileContainer);
        }
    }

    /**
     * Create mobile game card from desktop game item
     */
    createMobileGameCard(desktopGame) {
        const gameCard = document.createElement('div');
        gameCard.className = 'mobile-game-card';
        
        const gameId = desktopGame.querySelector('.game-id')?.textContent || 'Unknown';
        const playerCount = desktopGame.querySelector('.player-count')?.textContent || '0/4';
        const status = desktopGame.querySelector('.game-status')?.textContent || 'Waiting';
        
        gameCard.innerHTML = `
            <div class="game-card-header">
                <h3>Game ${gameId}</h3>
                <span class="game-status">${status}</span>
            </div>
            <div class="game-card-info">
                <span class="player-count">
                    <i class="fas fa-users"></i> ${playerCount}
                </span>
            </div>
            <div class="game-card-actions">
                <button class="btn btn-primary btn-sm" onclick="window.joinGame?.('${gameId}')">
                    <i class="fas fa-sign-in-alt"></i> Join
                </button>
            </div>
        `;
        
        return gameCard;
    }

    /**
     * Show no games message
     */
    showNoGamesMessage(container) {
        container.innerHTML = `
            <div class="no-games">
                <i class="fas fa-gamepad"></i>
                <h3>No Games Available</h3>
                <p>Create a new game to get started!</p>
            </div>
        `;
    }

    /**
     * Create game fallback
     */
    createGameFallback() {
        // Try to use existing create game functionality
        if (window.showGameSettings && typeof window.showGameSettings === 'function') {
            window.showGameSettings();
        } else {
            alert('Game creation is not available. Please try refreshing the page.');
        }
    }

    /**
     * Handle activation failure
     */
    handleActivationFailure(error) {
        console.error('Mobile interface activation failed:', error);
        
        // Show error interface
        const errorInterface = document.createElement('div');
        errorInterface.className = 'mobile-fallback-interface';
        errorInterface.innerHTML = `
            <h1>⚠️ Mobile Interface Error</h1>
            <p>There was a problem loading the mobile interface.<br>
            Error: ${error.message}</p>
            <div class="fallback-actions">
                <button onclick="window.location.reload()">
                    🔄 Try Again
                </button>
                <button onclick="window.mobileInterfaceActivator.switchToDesktop()">
                    💻 Use Desktop Version
                </button>
            </div>
        `;
        
        document.body.appendChild(errorInterface);
    }

    /**
     * Switch to desktop interface
     */
    switchToDesktop() {
        console.log('Switching to desktop interface...');
        
        // Show desktop elements
        this.desktopElements.forEach(element => {
            const originalDisplay = element.getAttribute('data-original-display') || 'block';
            element.style.display = originalDisplay;
            element.classList.remove('desktop-hidden-for-mobile');
        });
        
        // Hide mobile elements
        this.mobileElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.display = 'none';
            }
        });
        
        // Remove mobile classes
        document.body.classList.remove('mobile-interface-active', 'mobile-device', 'mobile-optimized');
        document.documentElement.classList.remove('mobile-interface');
        
        // Hide mobile UI system
        if (this.mobileUISystem) {
            this.hideAllMobileScreens();
        }
        
        this.isActivated = false;
        console.log('Switched to desktop interface');
    }

    /**
     * Emit activation event
     */
    emitActivationEvent() {
        const event = new CustomEvent('mobileInterfaceActivated', {
            detail: {
                isMobile: this.isMobile,
                isActivated: this.isActivated,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
        
        // Also emit through mobile UI system if available
        if (this.mobileUISystem) {
            this.mobileUISystem.emit('interfaceActivated', {
                isMobile: this.isMobile,
                isActivated: this.isActivated
            });
        }
    }

    /**
     * Public API methods
     */
    isMobileDevice() {
        return this.isMobile;
    }

    isInterfaceActivated() {
        return this.isActivated;
    }

    getMobileUISystem() {
        return this.mobileUISystem;
    }

    /**
     * Force activation (for testing)
     */
    forceActivation() {
        this.isMobile = true;
        this.activateMobileInterface();
    }

    /**
     * Deactivate mobile interface
     */
    deactivate() {
        if (!this.isActivated) return;
        
        this.switchToDesktop();
        
        // Remove event listeners
        // (Implementation would remove specific listeners added during activation)
        
        console.log('Mobile interface deactivated');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileInterfaceActivator;
} else if (typeof window !== 'undefined') {
    window.MobileInterfaceActivator = MobileInterfaceActivator;
}