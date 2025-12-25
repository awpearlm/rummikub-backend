// Safe Events Helper Functions
function addSafeEventListener(elementId, eventType, callback) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, callback);
        
        // For mobile compatibility, also add touch events for click events
        if (eventType === 'click') {
            // Ensure the element is properly styled for touch
            element.style.touchAction = 'manipulation';
            element.style.webkitTouchCallout = 'none';
            element.style.webkitUserSelect = 'none';
            element.style.userSelect = 'none';
            element.style.webkitTapHighlightColor = 'transparent';
            
            // Add comprehensive touch handling
            let touchStartTime = 0;
            let touchStartX = 0;
            let touchStartY = 0;
            let touchHandled = false;
            
            element.addEventListener('touchstart', (e) => {
                touchStartTime = Date.now();
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchHandled = false;
                
                // Add visual feedback
                element.classList.add('touch-active');
                console.log(`🔧 Touch start on ${elementId}`);
            }, { passive: true });
            
            element.addEventListener('touchend', (e) => {
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const moveDistance = Math.sqrt(
                    Math.pow(touchEndX - touchStartX, 2) + 
                    Math.pow(touchEndY - touchStartY, 2)
                );
                
                // Remove visual feedback
                element.classList.remove('touch-active');
                
                // Only trigger if it's a tap (short duration, minimal movement)
                if (!touchHandled && touchDuration < 500 && moveDistance < 20) {
                    touchHandled = true;
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log(`🔧 Touch triggered callback for ${elementId}`);
                    
                    // Create a synthetic click event and trigger the callback
                    const syntheticEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: touchEndX,
                        clientY: touchEndY
                    });
                    
                    // Call the callback directly
                    try {
                        callback(syntheticEvent);
                    } catch (error) {
                        console.error(`Error in touch callback for ${elementId}:`, error);
                    }
                }
            }, { passive: false });
            
            element.addEventListener('touchcancel', () => {
                element.classList.remove('touch-active');
                touchHandled = true;
            });
        }
        
        return true;
    } else {
        console.warn(`⚠️ Element not found: ${elementId}`);
        return false;
    }
}

// Function to safely get element by ID with null check
function safeGetElementById(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`⚠️ Element not found: ${elementId}`);
    }
    return element;
}

// Add mobile touch feedback styles
document.addEventListener('DOMContentLoaded', () => {
    const mobileStyles = `
        .touch-active {
            transform: scale(0.95) !important;
            opacity: 0.8 !important;
            transition: all 0.1s ease !important;
        }
        
        /* Ensure buttons are touch-friendly on mobile */
        @media (max-width: 768px) {
            .btn {
                min-height: 48px !important;
                padding: 12px 20px !important;
                font-size: 16px !important;
                touch-action: manipulation !important;
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            
            .btn-mode {
                min-height: 60px !important;
                padding: 16px 24px !important;
            }
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'mobile-touch-feedback-styles';
    styleElement.textContent = mobileStyles;
    document.head.appendChild(styleElement);
});
