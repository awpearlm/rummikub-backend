/**
 * Mobile Debug Helper
 * Provides debugging information for mobile touch events
 */

// Mobile debugging helper
function initMobileDebug() {
    if (!isMobileDevice()) return;
    
    console.log('🔧 Mobile Debug Mode Enabled');
    
    // Create debug overlay
    const debugOverlay = document.createElement('div');
    debugOverlay.id = 'mobile-debug-overlay';
    debugOverlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        max-width: 200px;
        pointer-events: none;
    `;
    debugOverlay.innerHTML = `
        <div>📱 Mobile Debug</div>
        <div id="debug-touch-info">Touch: None</div>
        <div id="debug-button-info">Button: None</div>
        <div id="debug-event-info">Event: None</div>
        <div id="debug-callback-info">Callback: None</div>
    `;
    document.body.appendChild(debugOverlay);
    
    // Track touch events globally
    let touchCount = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchCount++;
        updateDebugInfo('touch', `Start ${touchCount} (${e.touches.length} fingers)`);
        updateDebugInfo('event', `touchstart on ${e.target.tagName}${e.target.id ? '#' + e.target.id : ''}`);
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        updateDebugInfo('touch', `End ${touchCount}`);
        updateDebugInfo('event', `touchend on ${e.target.tagName}${e.target.id ? '#' + e.target.id : ''}`);
    }, { passive: true });
    
    document.addEventListener('click', (e) => {
        updateDebugInfo('event', `click on ${e.target.tagName}${e.target.id ? '#' + e.target.id : ''}`);
    }, { passive: true });
    
    // Monitor specific buttons
    const buttonsToMonitor = [
        'playWithFriendsBtn',
        'playWithBotBtn',
        'createGameBtn',
        'joinGameBtn'
    ];
    
    // Check for buttons multiple times to catch them when they're ready
    let checkAttempts = 0;
    const maxAttempts = 10;
    
    function checkForButtons() {
        checkAttempts++;
        console.log(`🔧 Checking for buttons (attempt ${checkAttempts}/${maxAttempts})`);
        
        buttonsToMonitor.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button && !button.hasAttribute('data-debug-monitored')) {
                // Mark as monitored to avoid duplicate listeners
                button.setAttribute('data-debug-monitored', 'true');
                
                button.addEventListener('touchstart', () => {
                    updateDebugInfo('button', `${buttonId} touched`);
                }, { passive: true });
                
                button.addEventListener('touchend', () => {
                    updateDebugInfo('button', `${buttonId} touch ended`);
                }, { passive: true });
                
                button.addEventListener('click', (e) => {
                    updateDebugInfo('button', `${buttonId} clicked`);
                    updateDebugInfo('callback', `${buttonId} callback triggered`);
                    console.log(`🔧 ${buttonId} click event fired:`, e);
                }, { passive: true });
                
                // Check if the button has any event listeners
                const hasClickHandler = button.onclick !== null || 
                                      button.getAttribute('onclick') !== null;
                
                console.log(`🔧 Monitoring ${buttonId} - has click handler: ${hasClickHandler}`);
                
                // Try to trigger the button's existing handlers when touched
                button.addEventListener('touchend', (e) => {
                    // Small delay to let the touch event complete
                    setTimeout(() => {
                        console.log(`🔧 Attempting to trigger ${buttonId} handlers`);
                        
                        // Try multiple ways to trigger the click
                        try {
                            // Method 1: Direct click()
                            button.click();
                            updateDebugInfo('callback', `${buttonId} click() called`);
                        } catch (error) {
                            console.error(`🔧 Error calling click() on ${buttonId}:`, error);
                        }
                        
                        try {
                            // Method 2: Dispatch click event
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            button.dispatchEvent(clickEvent);
                            updateDebugInfo('callback', `${buttonId} event dispatched`);
                        } catch (error) {
                            console.error(`🔧 Error dispatching click event on ${buttonId}:`, error);
                        }
                    }, 50);
                }, { passive: true });
                
            } else if (!button) {
                console.warn(`🔧 Button ${buttonId} not found on attempt ${checkAttempts}`);
            }
        });
        
        // Keep checking until we find all buttons or reach max attempts
        const foundButtons = buttonsToMonitor.filter(id => 
            document.getElementById(id)?.hasAttribute('data-debug-monitored')
        ).length;
        
        if (foundButtons < buttonsToMonitor.length && checkAttempts < maxAttempts) {
            setTimeout(checkForButtons, 1000);
        } else {
            console.log(`🔧 Button monitoring setup complete. Found ${foundButtons}/${buttonsToMonitor.length} buttons`);
        }
    }
    
    // Start checking for buttons
    setTimeout(checkForButtons, 1000);
    
    // Add a test button to verify touch is working
    const testButton = document.createElement('button');
    testButton.id = 'mobile-debug-test-btn';
    testButton.textContent = 'Test Touch';
    testButton.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: #007bff;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10001;
        touch-action: manipulation;
    `;
    testButton.addEventListener('click', () => {
        updateDebugInfo('callback', 'Test button works!');
        console.log('🔧 Test button clicked successfully');
    });
    document.body.appendChild(testButton);
    
    // Add a diagnostic button to check game state
    const diagnosticButton = document.createElement('button');
    diagnosticButton.id = 'mobile-diagnostic-btn';
    diagnosticButton.textContent = 'Check Game';
    diagnosticButton.style.cssText = `
        position: fixed;
        bottom: 60px;
        right: 10px;
        background: #28a745;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10001;
        touch-action: manipulation;
    `;
    diagnosticButton.addEventListener('click', () => {
        runComprehensiveDiagnostics();
    });
    document.body.appendChild(diagnosticButton);
    
    // Add method testing button
    const methodTestButton = document.createElement('button');
    methodTestButton.id = 'mobile-method-test-btn';
    methodTestButton.textContent = 'Test Methods';
    methodTestButton.style.cssText = `
        position: fixed;
        bottom: 110px;
        right: 10px;
        background: #17a2b8;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10001;
        touch-action: manipulation;
    `;
    methodTestButton.addEventListener('click', () => {
        testDirectMethodInvocation();
    });
    document.body.appendChild(methodTestButton);
    
    // Add real-time callback verification button
    const callbackTestButton = document.createElement('button');
    callbackTestButton.id = 'mobile-callback-test-btn';
    callbackTestButton.textContent = 'Test Callbacks';
    callbackTestButton.style.cssText = `
        position: fixed;
        bottom: 160px;
        right: 10px;
        background: #6f42c1;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10001;
        touch-action: manipulation;
    `;
    callbackTestButton.addEventListener('click', () => {
        testCallbackExecution();
    });
    document.body.appendChild(callbackTestButton);
}

function updateDebugInfo(type, message) {
    const element = document.getElementById(`debug-${type}-info`);
    if (element) {
        element.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)}: ${message}`;
    }
    console.log(`🔧 ${type}: ${message}`);
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
}

/**
 * Game Client Initialization Detection System
 * Monitors for RummikubClient instance and initializeEventListeners completion
 */
class GameClientDetector {
    constructor() {
        this.isGameClientReady = false;
        this.isEventListenersInitialized = false;
        this.gameClient = null;
        this.callbacks = [];
        this.checkAttempts = 0;
        this.maxAttempts = 30; // Increased for better detection
        this.checkInterval = 500; // Check every 500ms
        
        console.log('🔧 GameClientDetector initialized');
    }
    
    /**
     * Register a callback to be called when game client is fully ready
     */
    onGameClientReady(callback) {
        if (this.isGameClientReady && this.isEventListenersInitialized) {
            // Already ready, call immediately
            callback(this.gameClient);
        } else {
            // Store for later
            this.callbacks.push(callback);
        }
    }
    
    /**
     * Start monitoring for game client initialization
     */
    startMonitoring() {
        console.log('🔧 Starting game client monitoring...');
        this.checkForGameClient();
    }
    
    /**
     * Check for game client existence and initialization status
     */
    checkForGameClient() {
        this.checkAttempts++;
        console.log(`🔧 Checking for game client (attempt ${this.checkAttempts}/${this.maxAttempts})`);
        
        // Check for RummikubClient class definition
        const hasRummikubClass = typeof window.RummikubClient !== 'undefined';
        
        // Check for instantiated game client
        const gameClientInstance = window.gameClient || window.rummikubClient;
        
        // Check for global RummikubClient instance (common pattern)
        let globalInstance = null;
        if (hasRummikubClass && !gameClientInstance) {
            // Look for any RummikubClient instances in global scope
            for (let prop in window) {
                if (window[prop] instanceof window.RummikubClient) {
                    globalInstance = window[prop];
                    break;
                }
            }
        }
        
        const foundClient = gameClientInstance || globalInstance;
        
        console.log('🔧 Detection status:', {
            hasRummikubClass,
            hasGameClientInstance: !!gameClientInstance,
            hasGlobalInstance: !!globalInstance,
            foundClient: !!foundClient
        });
        
        if (foundClient) {
            this.gameClient = foundClient;
            this.isGameClientReady = true;
            
            // Check if initializeEventListeners has been called
            this.checkEventListenersInitialization();
        } else if (this.checkAttempts < this.maxAttempts) {
            // Continue checking
            setTimeout(() => this.checkForGameClient(), this.checkInterval);
        } else {
            console.warn('🔧 Game client not found after maximum attempts');
            this.handleDetectionFailure();
        }
    }
    
    /**
     * Check if initializeEventListeners has been called and completed
     */
    checkEventListenersInitialization() {
        console.log('🔧 Checking event listeners initialization...');
        
        // Method 1: Check if key buttons have event listeners attached
        const keyButtons = ['playWithFriendsBtn', 'playWithBotBtn', 'createGameBtn'];
        let buttonsWithListeners = 0;
        
        keyButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                // Check if button has click event listeners
                // This is a heuristic - we assume if buttons exist and have listeners, initialization is complete
                const hasListeners = this.hasEventListeners(button);
                if (hasListeners) {
                    buttonsWithListeners++;
                }
                console.log(`🔧 ${buttonId}: exists=${!!button}, hasListeners=${hasListeners}`);
            }
        });
        
        // Method 2: Check if selectGameMode method exists and is bound
        const hasSelectGameMode = this.gameClient && typeof this.gameClient.selectGameMode === 'function';
        
        // Method 3: Check if socket is connected (indicates full initialization)
        const hasConnectedSocket = this.gameClient && this.gameClient.socket && this.gameClient.socket.connected;
        
        console.log('🔧 Initialization check:', {
            buttonsWithListeners,
            totalButtons: keyButtons.length,
            hasSelectGameMode,
            hasConnectedSocket
        });
        
        // Consider initialized if we have most buttons with listeners OR selectGameMode exists
        const isInitialized = (buttonsWithListeners >= Math.floor(keyButtons.length * 0.6)) || hasSelectGameMode;
        
        if (isInitialized) {
            this.isEventListenersInitialized = true;
            this.onInitializationComplete();
        } else {
            // Wait a bit and check again
            setTimeout(() => this.checkEventListenersInitialization(), 1000);
        }
    }
    
    /**
     * Check if an element has event listeners (heuristic approach)
     */
    hasEventListeners(element) {
        // Check for onclick attribute
        if (element.onclick) return true;
        
        // Check for onclick attribute in HTML
        if (element.getAttribute('onclick')) return true;
        
        // Check for common event listener properties (browser-specific)
        if (element._listeners || element.eventListeners) return true;
        
        // Check if element has been processed by addSafeEventListener
        // (This is a heuristic based on the mobile touch styles we add)
        const hasTouch = element.style.touchAction === 'manipulation';
        if (hasTouch) return true;
        
        // For buttons, assume they have listeners if they're styled as interactive
        if (element.tagName === 'BUTTON' && !element.disabled) {
            return true; // Assume buttons are interactive
        }
        
        return false;
    }
    
    /**
     * Called when game client is fully initialized
     */
    onInitializationComplete() {
        console.log('🔧 Game client initialization complete!');
        updateDebugInfo('callback', 'Game client ready');
        
        // Call all registered callbacks
        this.callbacks.forEach(callback => {
            try {
                callback(this.gameClient);
            } catch (error) {
                console.error('🔧 Error in game client ready callback:', error);
            }
        });
        
        // Clear callbacks
        this.callbacks = [];
    }
    
    /**
     * Handle detection failure
     */
    handleDetectionFailure() {
        console.warn('🔧 Game client detection failed - implementing fallback strategy');
        updateDebugInfo('callback', 'Detection failed - using fallback');
        
        // Implement fallback: try to work with whatever we can find
        const fallbackClient = {
            selectGameMode: (mode) => {
                console.log(`🔧 Fallback: attempting to trigger ${mode} mode`);
                // Try to click the appropriate button as fallback
                const buttonId = mode === 'multiplayer' ? 'playWithFriendsBtn' : 'playWithBotBtn';
                const button = document.getElementById(buttonId);
                if (button) {
                    button.click();
                }
            }
        };
        
        // Call callbacks with fallback client
        this.callbacks.forEach(callback => {
            try {
                callback(fallbackClient);
            } catch (error) {
                console.error('🔧 Error in fallback callback:', error);
            }
        });
    }
    
    /**
     * Get current status for diagnostics
     */
    getStatus() {
        return {
            isGameClientReady: this.isGameClientReady,
            isEventListenersInitialized: this.isEventListenersInitialized,
            hasGameClient: !!this.gameClient,
            checkAttempts: this.checkAttempts,
            maxAttempts: this.maxAttempts
        };
    }
}

/**
 * Direct Game Client Method Invoker
 * Bypasses DOM event system for reliable mobile button execution
 */
class DirectGameClientInvoker {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.fallbackStrategies = [];
        this.setupFallbackStrategies();
        
        console.log('🔧 DirectGameClientInvoker initialized with client:', !!gameClient);
    }
    
    /**
     * Setup fallback strategies for different initialization states
     */
    setupFallbackStrategies() {
        // Strategy 1: Direct method call
        this.fallbackStrategies.push({
            name: 'direct_method',
            test: (client, method) => client && typeof client[method] === 'function',
            execute: (client, method, ...args) => {
                console.log(`🔧 Strategy 1: Direct method call - ${method}(${args.join(', ')})`);
                return client[method](...args);
            }
        });
        
        // Strategy 2: Button click simulation
        this.fallbackStrategies.push({
            name: 'button_click',
            test: () => true, // Always available as fallback
            execute: (client, method, ...args) => {
                console.log(`🔧 Strategy 2: Button click simulation - ${method}(${args.join(', ')})`);
                const buttonMap = {
                    'selectGameMode': {
                        'multiplayer': 'playWithFriendsBtn',
                        'bot': 'playWithBotBtn'
                    },
                    'createGame': 'createGameBtn',
                    'joinGame': 'joinGameBtn',
                    'startGame': 'startGameBtn',
                    'drawTile': 'drawTileBtn',
                    'endTurn': 'endTurnBtn'
                };
                
                let buttonId = null;
                if (method === 'selectGameMode' && args[0]) {
                    buttonId = buttonMap[method][args[0]];
                } else {
                    buttonId = buttonMap[method];
                }
                
                if (buttonId) {
                    const button = document.getElementById(buttonId);
                    if (button) {
                        button.click();
                        return true;
                    }
                }
                return false;
            }
        });
        
        // Strategy 3: Event dispatch
        this.fallbackStrategies.push({
            name: 'event_dispatch',
            test: () => true,
            execute: (client, method, ...args) => {
                console.log(`🔧 Strategy 3: Event dispatch - ${method}(${args.join(', ')})`);
                const buttonMap = {
                    'selectGameMode': {
                        'multiplayer': 'playWithFriendsBtn',
                        'bot': 'playWithBotBtn'
                    }
                };
                
                let buttonId = null;
                if (method === 'selectGameMode' && args[0]) {
                    buttonId = buttonMap[method][args[0]];
                }
                
                if (buttonId) {
                    const button = document.getElementById(buttonId);
                    if (button) {
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        button.dispatchEvent(clickEvent);
                        return true;
                    }
                }
                return false;
            }
        });
        
        // Strategy 4: Global function call
        this.fallbackStrategies.push({
            name: 'global_function',
            test: (client, method) => typeof window[method] === 'function',
            execute: (client, method, ...args) => {
                console.log(`🔧 Strategy 4: Global function call - window.${method}(${args.join(', ')})`);
                return window[method](...args);
            }
        });
    }
    
    /**
     * Invoke a game client method with fallback strategies
     */
    invokeMethod(methodName, ...args) {
        console.log(`🔧 Invoking ${methodName} with args:`, args);
        updateDebugInfo('callback', `Invoking ${methodName}`);
        
        let lastError = null;
        
        // Try each strategy in order
        for (const strategy of this.fallbackStrategies) {
            try {
                if (strategy.test(this.gameClient, methodName)) {
                    console.log(`🔧 Trying strategy: ${strategy.name}`);
                    const result = strategy.execute(this.gameClient, methodName, ...args);
                    
                    if (result !== false) { // false indicates strategy failed
                        console.log(`🔧 Strategy ${strategy.name} succeeded`);
                        updateDebugInfo('callback', `${methodName} via ${strategy.name}`);
                        return result;
                    }
                }
            } catch (error) {
                console.warn(`🔧 Strategy ${strategy.name} failed:`, error);
                lastError = error;
            }
        }
        
        // All strategies failed
        console.error(`🔧 All strategies failed for ${methodName}:`, lastError);
        updateDebugInfo('callback', `${methodName} failed`);
        throw new Error(`Failed to invoke ${methodName}: ${lastError?.message || 'All strategies failed'}`);
    }
    
    /**
     * Specific method for game mode selection
     */
    selectGameMode(mode) {
        console.log(`🔧 selectGameMode called with mode: ${mode}`);
        return this.invokeMethod('selectGameMode', mode);
    }
    
    /**
     * Specific method for creating a game
     */
    createGame() {
        console.log('🔧 createGame called');
        return this.invokeMethod('createGame');
    }
    
    /**
     * Specific method for joining a game
     */
    joinGame(gameId) {
        console.log(`🔧 joinGame called with gameId: ${gameId}`);
        return this.invokeMethod('joinGame', gameId);
    }
    
    /**
     * Test all available methods
     */
    testAllMethods() {
        const testMethods = [
            { method: 'selectGameMode', args: ['bot'] },
            { method: 'createGame', args: [] },
            { method: 'drawTile', args: [] }
        ];
        
        console.log('🔧 Testing all available methods...');
        const results = {};
        
        testMethods.forEach(({ method, args }) => {
            try {
                console.log(`🔧 Testing ${method}...`);
                // Don't actually execute, just test if strategies are available
                const availableStrategies = this.fallbackStrategies.filter(strategy => 
                    strategy.test(this.gameClient, method)
                );
                results[method] = {
                    available: availableStrategies.length > 0,
                    strategies: availableStrategies.map(s => s.name)
                };
            } catch (error) {
                results[method] = {
                    available: false,
                    error: error.message
                };
            }
        });
        
        console.log('🔧 Method test results:', results);
        return results;
    }
}

// Global invoker instance

// Global instances
let gameClientDetector = null;
let directGameClientInvoker = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only enable debug on mobile devices
    if (isMobileDevice()) {
        initMobileDebug();
        
        // Initialize game client detector
        gameClientDetector = new GameClientDetector();
        
        // Register callback for when game client is ready
        gameClientDetector.onGameClientReady((gameClient) => {
            console.log('🔧 Game client ready callback triggered');
            
            // Initialize direct invoker
            directGameClientInvoker = new DirectGameClientInvoker(gameClient);
            
            // Setup direct touch handlers for mobile buttons
            setupDirectTouchHandlers();
            
            // Test methods availability
            directGameClientInvoker.testAllMethods();
        });
        
        gameClientDetector.startMonitoring();
    }
});

/**
 * Comprehensive diagnostic system for game integration
 */
function runComprehensiveDiagnostics() {
    console.log('🔧 Running comprehensive diagnostics...');
    updateDebugInfo('callback', 'Running diagnostics...');
    
    const diagnostics = {
        timestamp: new Date().toISOString(),
        gameClientDetection: {},
        buttonAnalysis: {},
        eventListenerAnalysis: {},
        networkStatus: {},
        initializationTiming: {}
    };
    
    // 1. Game Client Detection
    diagnostics.gameClientDetection = {
        hasRummikubClass: typeof window.RummikubClient !== 'undefined',
        hasGameClientInstance: !!window.gameClient,
        hasRummikubClientInstance: !!window.rummikubClient,
        detectorStatus: gameClientDetector ? gameClientDetector.getStatus() : null,
        invokerAvailable: !!directGameClientInvoker
    };
    
    // 2. Button Analysis
    const buttonsToCheck = ['playWithFriendsBtn', 'playWithBotBtn', 'createGameBtn', 'joinGameBtn'];
    buttonsToCheck.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            diagnostics.buttonAnalysis[buttonId] = {
                exists: true,
                hasOnClick: !!button.onclick,
                hasOnClickAttr: !!button.getAttribute('onclick'),
                hasEventListeners: hasEventListenersDetailed(button),
                isDisabled: button.disabled,
                isVisible: button.offsetParent !== null,
                classList: Array.from(button.classList),
                computedStyle: {
                    display: window.getComputedStyle(button).display,
                    visibility: window.getComputedStyle(button).visibility,
                    pointerEvents: window.getComputedStyle(button).pointerEvents
                }
            };
        } else {
            diagnostics.buttonAnalysis[buttonId] = { exists: false };
        }
    });
    
    // 3. Event Listener Analysis
    diagnostics.eventListenerAnalysis = {
        addSafeEventListenerExists: typeof addSafeEventListener !== 'undefined',
        documentListeners: getDocumentListenerCount(),
        touchEventsSupported: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints || 0
    };
    
    // 4. Network Status
    const gameClient = window.gameClient || window.rummikubClient;
    if (gameClient && gameClient.socket) {
        diagnostics.networkStatus = {
            socketConnected: gameClient.socket.connected,
            socketId: gameClient.socket.id,
            socketTransport: gameClient.socket.io.engine.transport.name,
            socketReadyState: gameClient.socket.io.engine.readyState
        };
    } else {
        diagnostics.networkStatus = { noSocketFound: true };
    }
    
    // 5. Initialization Timing
    diagnostics.initializationTiming = {
        domContentLoaded: document.readyState,
        gameClientDetectorInitialized: !!gameClientDetector,
        directInvokerInitialized: !!directGameClientInvoker,
        pageLoadTime: performance.now()
    };
    
    // Log comprehensive results
    console.log('🔧 Comprehensive Diagnostics Results:', diagnostics);
    
    // Update debug display with summary
    const summary = createDiagnosticSummary(diagnostics);
    updateDebugInfo('callback', summary);
    
    // Store in sessionStorage for later analysis
    sessionStorage.setItem('mobileDiagnostics', JSON.stringify(diagnostics));
    
    return diagnostics;
}

/**
 * Test direct method invocation
 */
function testDirectMethodInvocation() {
    console.log('🔧 Testing direct method invocation...');
    updateDebugInfo('callback', 'Testing methods...');
    
    if (!directGameClientInvoker) {
        console.warn('🔧 Direct game client invoker not available');
        updateDebugInfo('callback', 'Invoker not ready');
        return;
    }
    
    // Test method availability
    const testResults = directGameClientInvoker.testAllMethods();
    console.log('🔧 Method test results:', testResults);
    
    // Test actual invocation (safe methods only)
    const safeTests = [
        {
            name: 'selectGameMode(bot)',
            test: () => {
                console.log('🔧 Testing selectGameMode with bot...');
                // Don't actually execute to avoid side effects
                return directGameClientInvoker.fallbackStrategies.some(strategy => 
                    strategy.test(directGameClientInvoker.gameClient, 'selectGameMode')
                );
            }
        }
    ];
    
    const invocationResults = {};
    safeTests.forEach(test => {
        try {
            invocationResults[test.name] = {
                available: test.test(),
                timestamp: Date.now()
            };
        } catch (error) {
            invocationResults[test.name] = {
                available: false,
                error: error.message
            };
        }
    });
    
    console.log('🔧 Invocation test results:', invocationResults);
    updateDebugInfo('callback', `Methods tested: ${Object.keys(invocationResults).length}`);
    
    return invocationResults;
}

/**
 * Test callback execution with real-time verification
 */
function testCallbackExecution() {
    console.log('🔧 Testing callback execution...');
    updateDebugInfo('callback', 'Testing callbacks...');
    
    const callbackTests = [];
    
    // Test 1: Direct button click simulation
    const testButton = document.getElementById('mobile-debug-test-btn');
    if (testButton) {
        let callbackExecuted = false;
        const originalHandler = testButton.onclick;
        
        testButton.onclick = () => {
            callbackExecuted = true;
            console.log('🔧 Test button callback executed successfully');
            if (originalHandler) originalHandler();
        };
        
        // Simulate click
        testButton.click();
        
        callbackTests.push({
            name: 'test_button_click',
            executed: callbackExecuted,
            timestamp: Date.now()
        });
    }
    
    // Test 2: Touch event simulation
    const playWithBotBtn = document.getElementById('playWithBotBtn');
    if (playWithBotBtn) {
        let touchCallbackExecuted = false;
        
        // Add temporary touch listener
        const tempTouchHandler = () => {
            touchCallbackExecuted = true;
            console.log('🔧 Touch callback executed successfully');
        };
        
        playWithBotBtn.addEventListener('touchend', tempTouchHandler, { once: true });
        
        // Simulate touch event
        const touchEvent = new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            touches: [],
            changedTouches: [new Touch({
                identifier: 1,
                target: playWithBotBtn,
                clientX: 100,
                clientY: 100
            })]
        });
        
        playWithBotBtn.dispatchEvent(touchEvent);
        
        callbackTests.push({
            name: 'touch_event_simulation',
            executed: touchCallbackExecuted,
            timestamp: Date.now()
        });
    }
    
    // Test 3: Game client method availability
    if (directGameClientInvoker) {
        const gameClient = directGameClientInvoker.gameClient;
        callbackTests.push({
            name: 'game_client_methods',
            executed: !!(gameClient && typeof gameClient.selectGameMode === 'function'),
            details: {
                hasSelectGameMode: !!(gameClient && typeof gameClient.selectGameMode === 'function'),
                hasCreateGame: !!(gameClient && typeof gameClient.createGame === 'function'),
                hasSocket: !!(gameClient && gameClient.socket)
            },
            timestamp: Date.now()
        });
    }
    
    console.log('🔧 Callback test results:', callbackTests);
    
    const successCount = callbackTests.filter(test => test.executed).length;
    updateDebugInfo('callback', `Callbacks: ${successCount}/${callbackTests.length} OK`);
    
    return callbackTests;
}

/**
 * Helper function to detect event listeners on an element
 */
function hasEventListenersDetailed(element) {
    const listeners = {
        onclick: !!element.onclick,
        onclickAttr: !!element.getAttribute('onclick'),
        touchAction: element.style.touchAction === 'manipulation',
        hasDataMonitored: element.hasAttribute('data-debug-monitored'),
        hasEventListenerProps: !!(element._listeners || element.eventListeners)
    };
    
    return listeners;
}

/**
 * Get approximate count of document event listeners
 */
function getDocumentListenerCount() {
    // This is approximate since we can't directly access all listeners
    let count = 0;
    
    // Check for common event types
    const eventTypes = ['click', 'touchstart', 'touchend', 'DOMContentLoaded'];
    eventTypes.forEach(eventType => {
        try {
            // This is a heuristic - we can't actually count listeners
            count += document.querySelectorAll(`[on${eventType}]`).length;
        } catch (e) {
            // Ignore errors
        }
    });
    
    return count;
}

/**
 * Create a summary of diagnostic results
 */
function createDiagnosticSummary(diagnostics) {
    const summary = [];
    
    if (diagnostics.gameClientDetection.detectorStatus?.isGameClientReady) {
        summary.push('✅ Game client ready');
    } else {
        summary.push('❌ Game client not ready');
    }
    
    const buttonCount = Object.keys(diagnostics.buttonAnalysis).length;
    const existingButtons = Object.values(diagnostics.buttonAnalysis).filter(b => b.exists).length;
    summary.push(`🔘 Buttons: ${existingButtons}/${buttonCount}`);
    
    if (diagnostics.networkStatus.socketConnected) {
        summary.push('🌐 Socket connected');
    } else {
        summary.push('🌐 Socket disconnected');
    }
    
    return summary.join(' | ');
}
function setupDirectTouchHandlers() {
    console.log('🔧 Setting up direct touch handlers...');
    
    const buttonConfigs = [
        {
            id: 'playWithFriendsBtn',
            action: () => directGameClientInvoker.selectGameMode('multiplayer'),
            label: 'Play with Friends'
        },
        {
            id: 'playWithBotBtn', 
            action: () => directGameClientInvoker.selectGameMode('bot'),
            label: 'Play with Bot'
        },
        {
            id: 'createGameBtn',
            action: () => directGameClientInvoker.createGame(),
            label: 'Create Game'
        }
    ];
    
    buttonConfigs.forEach(config => {
        const button = document.getElementById(config.id);
        if (button) {
            console.log(`🔧 Setting up direct handler for ${config.id}`);
            
            // Remove existing mobile debug listeners to avoid conflicts
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            // Add our direct touch handler
            newButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`🔧 Direct touch handler triggered for ${config.label}`);
                updateDebugInfo('button', `${config.label} touched`);
                
                try {
                    config.action();
                    updateDebugInfo('callback', `${config.label} executed`);
                } catch (error) {
                    console.error(`🔧 Error executing ${config.label}:`, error);
                    updateDebugInfo('callback', `${config.label} error: ${error.message}`);
                }
            }, { passive: false });
            
            // Also add click handler for desktop compatibility
            newButton.addEventListener('click', (e) => {
                console.log(`🔧 Click handler triggered for ${config.label}`);
                try {
                    config.action();
                } catch (error) {
                    console.error(`🔧 Error in click handler for ${config.label}:`, error);
                }
            });
            
            console.log(`🔧 Direct handlers set up for ${config.id}`);
        } else {
            console.warn(`🔧 Button ${config.id} not found for direct handler setup`);
        }
    });
}