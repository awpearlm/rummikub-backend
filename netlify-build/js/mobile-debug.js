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
    
    setTimeout(() => {
        buttonsToMonitor.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('touchstart', () => {
                    updateDebugInfo('button', `${buttonId} touched`);
                }, { passive: true });
                
                button.addEventListener('touchend', () => {
                    updateDebugInfo('button', `${buttonId} touch ended`);
                }, { passive: true });
                
                button.addEventListener('click', () => {
                    updateDebugInfo('button', `${buttonId} clicked`);
                    updateDebugInfo('callback', `${buttonId} callback triggered`);
                }, { passive: true });
                
                console.log(`🔧 Monitoring ${buttonId}`);
            } else {
                console.warn(`🔧 Button ${buttonId} not found`);
            }
        });
    }, 2000);
    
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
    }
});