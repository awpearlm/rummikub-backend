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
        console.log('🔧 Running diagnostics...');
        
        // Check if game client exists
        const hasGameClient = typeof window.gameClient !== 'undefined' || typeof window.RummikubClient !== 'undefined';
        console.log('🔧 Game client exists:', hasGameClient);
        
        // Check if buttons exist and have handlers
        const buttonsToCheck = ['playWithFriendsBtn', 'playWithBotBtn'];
        buttonsToCheck.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                const hasOnClick = button.onclick !== null;
                const hasOnClickAttr = button.getAttribute('onclick') !== null;
                const hasEventListeners = button._listeners || button.eventListeners;
                
                console.log(`🔧 ${buttonId}:`, {
                    exists: true,
                    hasOnClick,
                    hasOnClickAttr,
                    hasEventListeners: !!hasEventListeners,
                    classList: Array.from(button.classList),
                    style: button.style.cssText
                });
            } else {
                console.log(`🔧 ${buttonId}: not found`);
            }
        });
        
        // Check if addSafeEventListener function exists
        console.log('🔧 addSafeEventListener exists:', typeof addSafeEventListener !== 'undefined');
        
        updateDebugInfo('callback', 'Diagnostics logged');
    });
    document.body.appendChild(diagnosticButton);
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only enable debug on mobile devices
    if (isMobileDevice()) {
        initMobileDebug();
        
        // Also try to hook into the game client when it's ready
        let gameCheckAttempts = 0;
        const maxGameCheckAttempts = 20;
        
        function checkForGameClient() {
            gameCheckAttempts++;
            console.log(`🔧 Checking for game client (attempt ${gameCheckAttempts}/${maxGameCheckAttempts})`);
            
            // Check if RummikubClient exists
            if (typeof window.RummikubClient !== 'undefined' || window.gameClient) {
                console.log('🔧 Game client found! Setting up direct button handlers...');
                
                // Try to hook into the game's selectGameMode function
                const gameClient = window.gameClient || window.rummikubClient;
                if (gameClient && typeof gameClient.selectGameMode === 'function') {
                    console.log('🔧 Found selectGameMode function');
                    
                    // Add direct touch handlers to buttons
                    const playWithFriendsBtn = document.getElementById('playWithFriendsBtn');
                    const playWithBotBtn = document.getElementById('playWithBotBtn');
                    
                    if (playWithFriendsBtn) {
                        playWithFriendsBtn.addEventListener('touchend', (e) => {
                            e.preventDefault();
                            console.log('🔧 Direct touch handler: calling selectGameMode("multiplayer")');
                            gameClient.selectGameMode('multiplayer');
                            updateDebugInfo('callback', 'Direct multiplayer call');
                        }, { passive: false });
                    }
                    
                    if (playWithBotBtn) {
                        playWithBotBtn.addEventListener('touchend', (e) => {
                            e.preventDefault();
                            console.log('🔧 Direct touch handler: calling selectGameMode("bot")');
                            gameClient.selectGameMode('bot');
                            updateDebugInfo('callback', 'Direct bot call');
                        }, { passive: false });
                    }
                }
                
                return; // Stop checking
            }
            
            // Keep checking if we haven't found it yet
            if (gameCheckAttempts < maxGameCheckAttempts) {
                setTimeout(checkForGameClient, 500);
            } else {
                console.log('🔧 Game client not found after maximum attempts');
            }
        }
        
        // Start checking for game client after a short delay
        setTimeout(checkForGameClient, 2000);
    }
});