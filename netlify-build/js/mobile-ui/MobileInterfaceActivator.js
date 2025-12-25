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
        
        console.log('Mobile Interface Activator initialized:', {
            isMobile: this.isMobile,
            userAgent: navigator.userAgent,
            touchSupport: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints
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
        const isMobile = mobileScore >= 2; // Require at least 2 indicators
        
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
                console.warn('Mobile login screen component not available');
                this.showFallbackMobileInterface();
            }
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
                console.warn('Mobile lobby screen component not available');
                this.showFallbackMobileInterface();
            }
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
                align-items: center;
                justify-content: center;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                padding: 20px;
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
        
        const fallbackInterface = document.createElement('div');
        fallbackInterface.className = 'mobile-fallback-interface';
        fallbackInterface.innerHTML = `
            <h1>🎮 J-kube Mobile</h1>
            <p>Welcome to the mobile version of J-kube!<br>
            The mobile interface is loading...</p>
            <div class="fallback-actions">
                <button onclick="window.location.reload()">
                    🔄 Reload Page
                </button>
                <button onclick="window.mobileInterfaceActivator.switchToDesktop()">
                    💻 Use Desktop Version
                </button>
            </div>
        `;
        
        document.body.appendChild(fallbackInterface);
        this.mobileElements.push(fallbackInterface);
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