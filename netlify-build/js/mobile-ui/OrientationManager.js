/**
 * Orientation Manager
 * Handles screen orientation changes and transitions between portrait/landscape modes
 * Implements adaptive orientation management for different screens
 */

class OrientationManager {
    constructor() {
        this.currentOrientation = this.getCurrentOrientation();
        this.targetOrientation = 'auto';
        this.isLocked = false;
        this.screenOrientationRules = new Map();
        this.transitionCallbacks = new Set();
        
        this.init();
    }

    init() {
        this.setupScreenOrientationRules();
        this.setupEventListeners();
        this.applyInitialOrientation();
    }

    setupScreenOrientationRules() {
        // Define orientation requirements for each screen type
        this.screenOrientationRules.set('login', 'portrait');
        this.screenOrientationRules.set('lobby', 'portrait');
        this.screenOrientationRules.set('game-creation', 'landscape');
        this.screenOrientationRules.set('game', 'landscape');
    }

    setupEventListeners() {
        // Listen for orientation changes
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 100));
        
        // Listen for screen changes
        document.addEventListener('screenchange', this.handleScreenChange.bind(this));
        
        // Listen for visibility changes (app switching)
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    getCurrentOrientation() {
        // Use screen.orientation API if available, fallback to window.orientation
        if (screen && screen.orientation) {
            return screen.orientation.angle === 0 || screen.orientation.angle === 180 ? 'portrait' : 'landscape';
        } else if (window.orientation !== undefined) {
            return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
        } else {
            // Fallback to window dimensions - use a small threshold to handle edge cases
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // If dimensions are very close (within 10px), prefer portrait as default
            if (Math.abs(width - height) < 10) {
                return 'portrait';
            }
            
            return width > height ? 'landscape' : 'portrait';
        }
    }

    getRequiredOrientation(screenType) {
        return this.screenOrientationRules.get(screenType) || 'auto';
    }

    lockOrientation(orientation) {
        // Always update internal state first
        this.isLocked = true;
        this.targetOrientation = orientation;
        
        if (!this.isOrientationSupported()) {
            console.warn('Screen orientation API not supported');
            this.encourageOrientation(orientation);
            return Promise.resolve();
        }

        // Use the Screen Orientation API if available
        if (screen.orientation && screen.orientation.lock) {
            const orientationMap = {
                'portrait': 'portrait-primary',
                'landscape': 'landscape-primary'
            };
            
            return screen.orientation.lock(orientationMap[orientation] || orientation)
                .then(() => {
                    console.log(`Orientation locked to ${orientation}`);
                    this.updateOrientationClasses();
                })
                .catch(error => {
                    console.warn('Failed to lock orientation:', error);
                    // Fallback to CSS-based orientation encouragement
                    this.encourageOrientation(orientation);
                });
        } else {
            // Fallback for browsers without orientation lock support
            this.encourageOrientation(orientation);
            return Promise.resolve();
        }
    }

    unlockOrientation() {
        // Always update internal state first
        this.isLocked = false;
        this.targetOrientation = 'auto';
        
        if (!this.isOrientationSupported()) {
            this.removeOrientationEncouragement();
            return Promise.resolve();
        }

        if (screen.orientation && screen.orientation.unlock) {
            return screen.orientation.unlock()
                .then(() => {
                    console.log('Orientation unlocked');
                    this.removeOrientationEncouragement();
                    this.updateOrientationClasses();
                })
                .catch(error => {
                    console.warn('Failed to unlock orientation:', error);
                });
        } else {
            this.removeOrientationEncouragement();
            return Promise.resolve();
        }
    }

    encourageOrientation(orientation) {
        // Add CSS classes to encourage specific orientation
        document.body.classList.remove('encourage-portrait', 'encourage-landscape');
        document.body.classList.add(`encourage-${orientation}`);
        
        // Show orientation hint if needed
        this.showOrientationHint(orientation);
    }

    removeOrientationEncouragement() {
        document.body.classList.remove('encourage-portrait', 'encourage-landscape');
        this.hideOrientationHint();
    }

    showOrientationHint(orientation) {
        // Only show hint on mobile devices
        if (!this.isMobileDevice()) return;

        const currentOrientation = this.getCurrentOrientation();
        if (currentOrientation === orientation) return;

        let hintElement = document.getElementById('orientation-hint');
        if (!hintElement) {
            hintElement = this.createOrientationHint();
        }

        const icon = orientation === 'landscape' ? '📱→📱' : '📱↑📱';
        const message = orientation === 'landscape' 
            ? 'Please rotate your device to landscape mode for the best experience'
            : 'Please rotate your device to portrait mode';

        hintElement.innerHTML = `
            <div class="orientation-hint-content">
                <div class="orientation-hint-icon">${icon}</div>
                <div class="orientation-hint-message">${message}</div>
            </div>
        `;

        hintElement.classList.add('visible');
    }

    hideOrientationHint() {
        const hintElement = document.getElementById('orientation-hint');
        if (hintElement) {
            hintElement.classList.remove('visible');
        }
    }

    createOrientationHint() {
        const hintElement = document.createElement('div');
        hintElement.id = 'orientation-hint';
        hintElement.className = 'orientation-hint';
        hintElement.innerHTML = `
            <style>
                .orientation-hint {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: var(--z-mobile-overlay);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                }
                
                .orientation-hint.visible {
                    opacity: 1;
                    visibility: visible;
                }
                
                .orientation-hint-content {
                    background: white;
                    border-radius: 16px;
                    padding: 24px;
                    text-align: center;
                    max-width: 280px;
                    margin: 20px;
                }
                
                .orientation-hint-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }
                
                .orientation-hint-message {
                    font-size: 16px;
                    color: #333;
                    line-height: 1.4;
                }
            </style>
        `;
        
        document.body.appendChild(hintElement);
        return hintElement;
    }

    handleOrientationChange() {
        // Delay to allow for orientation change to complete
        setTimeout(() => {
            const newOrientation = this.getCurrentOrientation();
            const previousOrientation = this.currentOrientation;
            
            if (newOrientation !== previousOrientation) {
                this.currentOrientation = newOrientation;
                this.animateOrientationTransition(previousOrientation, newOrientation);
                this.updateOrientationClasses();
                this.checkOrientationCompliance();
                this.notifyOrientationChange(newOrientation, previousOrientation);
            }
        }, 100);
    }

    handleResize() {
        // Handle resize events that might indicate orientation change
        const newOrientation = this.getCurrentOrientation();
        if (newOrientation !== this.currentOrientation) {
            this.handleOrientationChange();
        }
    }

    handleScreenChange(event) {
        const screenType = event.detail?.screenType;
        if (screenType) {
            const requiredOrientation = this.getRequiredOrientation(screenType);
            
            if (requiredOrientation !== 'auto') {
                this.lockOrientation(requiredOrientation);
            } else {
                this.unlockOrientation();
            }
        }
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Re-check orientation when app becomes visible
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        }
    }

    animateOrientationTransition(fromOrientation, toOrientation) {
        return new Promise((resolve) => {
            const transitionElement = document.createElement('div');
            transitionElement.className = 'orientation-transition-overlay';
            transitionElement.innerHTML = `
                <style>
                    .orientation-transition-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: #000;
                        z-index: var(--z-mobile-overlay);
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    
                    .orientation-transition-overlay.active {
                        opacity: 1;
                    }
                </style>
            `;
            
            document.body.appendChild(transitionElement);
            
            // Trigger transition
            requestAnimationFrame(() => {
                transitionElement.classList.add('active');
                
                setTimeout(() => {
                    transitionElement.classList.remove('active');
                    
                    setTimeout(() => {
                        document.body.removeChild(transitionElement);
                        resolve();
                    }, 200);
                }, 100);
            });
        });
    }

    updateOrientationClasses() {
        document.body.classList.remove('mobile-portrait', 'mobile-landscape');
        document.body.classList.add(`mobile-${this.currentOrientation}`);
        
        // Update CSS custom property
        document.documentElement.style.setProperty('--current-orientation', this.currentOrientation);
    }

    checkOrientationCompliance() {
        const activeScreen = this.getActiveScreen();
        if (activeScreen) {
            const requiredOrientation = this.getRequiredOrientation(activeScreen);
            
            if (requiredOrientation !== 'auto' && requiredOrientation !== this.currentOrientation) {
                this.showOrientationHint(requiredOrientation);
            } else {
                this.hideOrientationHint();
            }
        }
    }

    getActiveScreen() {
        // Determine the currently active screen
        const screens = [
            { id: 'loginScreen', type: 'login' },
            { id: 'welcomeScreen', type: 'lobby' },
            { id: 'gameCreationScreen', type: 'game-creation' },
            { id: 'gameScreen', type: 'game' }
        ];
        
        for (const screen of screens) {
            const screenElement = document.getElementById(screen.id);
            
            if (screenElement && (screenElement.classList.contains('active') || 
                                 screenElement.style.display !== 'none')) {
                return screen.type;
            }
        }
        
        return null;
    }

    notifyOrientationChange(newOrientation, previousOrientation) {
        // Notify all registered callbacks
        this.transitionCallbacks.forEach(callback => {
            try {
                callback(newOrientation, previousOrientation);
            } catch (error) {
                console.error('Error in orientation change callback:', error);
            }
        });
        
        // Dispatch custom event
        const event = new CustomEvent('orientationchange', {
            detail: {
                orientation: newOrientation,
                previousOrientation: previousOrientation,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    addTransitionCallback(callback) {
        this.transitionCallbacks.add(callback);
    }

    removeTransitionCallback(callback) {
        this.transitionCallbacks.delete(callback);
    }

    isOrientationSupported() {
        return (typeof screen !== 'undefined' && screen && screen.orientation && screen.orientation.lock) || 
               (typeof window !== 'undefined' && 'orientation' in window);
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }

    applyInitialOrientation() {
        this.updateOrientationClasses();
        
        // Check if we need to apply orientation for current screen
        const activeScreen = this.getActiveScreen();
        if (activeScreen) {
            const requiredOrientation = this.getRequiredOrientation(activeScreen);
            if (requiredOrientation !== 'auto') {
                this.lockOrientation(requiredOrientation);
            }
        }
    }

    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API methods
    getCurrentState() {
        return {
            currentOrientation: this.currentOrientation,
            targetOrientation: this.targetOrientation,
            isLocked: this.isLocked,
            activeScreen: this.getActiveScreen(),
            isSupported: this.isOrientationSupported(),
            isMobile: this.isMobileDevice()
        };
    }

    destroy() {
        // Clean up event listeners
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('screenchange', this.handleScreenChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Unlock orientation
        this.unlockOrientation();
        
        // Remove orientation hint
        this.hideOrientationHint();
        const hintElement = document.getElementById('orientation-hint');
        if (hintElement) {
            hintElement.remove();
        }
        
        // Clear callbacks
        this.transitionCallbacks.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrientationManager;
} else if (typeof window !== 'undefined') {
    window.OrientationManager = OrientationManager;
}