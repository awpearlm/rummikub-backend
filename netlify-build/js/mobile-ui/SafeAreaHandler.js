/**
 * Safe Area Handler
 * Manages safe area insets for various mobile devices including notches, home indicators, etc.
 * Provides consistent safe area handling across different device types
 */

class SafeAreaHandler {
    constructor() {
        this.safeAreaInsets = {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        };
        
        this.deviceInfo = {
            hasNotch: false,
            hasHomeIndicator: false,
            deviceType: 'unknown',
            orientation: 'portrait'
        };
        
        this.callbacks = new Set();
        this.isSupported = this.checkSafeAreaSupport();
        
        this.init();
    }

    init() {
        this.detectDeviceFeatures();
        this.setupSafeAreaVariables();
        this.setupEventListeners();
        this.applySafeAreaStyles();
        this.updateSafeAreaInsets();
    }

    checkSafeAreaSupport() {
        // Check if CSS env() function is supported for safe area insets
        return CSS.supports('padding: env(safe-area-inset-top)') ||
               CSS.supports('padding: constant(safe-area-inset-top)'); // iOS 11.0-11.2 fallback
    }

    detectDeviceFeatures() {
        const userAgent = navigator.userAgent;
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
        };
        
        // Detect iOS devices with notch
        if (/iPhone|iPad|iPod/.test(userAgent)) {
            this.deviceInfo.deviceType = 'ios';
            
            // iPhone X and newer models detection
            const iPhoneXModels = [
                { width: 375, height: 812 }, // iPhone X, XS, 11 Pro
                { width: 414, height: 896 }, // iPhone XR, XS Max, 11, 11 Pro Max
                { width: 390, height: 844 }, // iPhone 12, 12 Pro
                { width: 428, height: 926 }, // iPhone 12 Pro Max
                { width: 375, height: 667 }, // iPhone 6, 7, 8 (no notch but has home indicator on newer iOS)
                { width: 414, height: 736 }  // iPhone 6+, 7+, 8+ (no notch but has home indicator on newer iOS)
            ];
            
            const currentSize = { width: viewport.screenWidth, height: viewport.screenHeight };
            const hasNotchSize = iPhoneXModels.some(model => 
                (model.width === currentSize.width && model.height === currentSize.height) ||
                (model.height === currentSize.width && model.width === currentSize.height)
            );
            
            this.deviceInfo.hasNotch = hasNotchSize;
            this.deviceInfo.hasHomeIndicator = true; // Most modern iOS devices
        }
        
        // Detect Android devices with notch/cutout
        else if (/Android/.test(userAgent)) {
            this.deviceInfo.deviceType = 'android';
            
            // Android devices with display cutouts
            this.deviceInfo.hasNotch = this.detectAndroidNotch();
            this.deviceInfo.hasHomeIndicator = this.detectAndroidHomeIndicator();
        }
        
        // Update orientation
        this.updateOrientation();
    }

    detectAndroidNotch() {
        // Check for display cutout API
        if ('getDisplayMedia' in navigator && window.screen && window.screen.orientation) {
            return true; // Assume modern Android with potential cutout
        }
        
        // Fallback: check for common Android notch resolutions
        const viewport = {
            width: window.screen.width,
            height: window.screen.height
        };
        
        const androidNotchSizes = [
            { width: 360, height: 780 }, // Common Android notch size
            { width: 393, height: 851 }, // Pixel 5
            { width: 411, height: 869 }, // Pixel 4
            { width: 412, height: 915 }  // Samsung Galaxy S20
        ];
        
        return androidNotchSizes.some(size => 
            (size.width === viewport.width && size.height === viewport.height) ||
            (size.height === viewport.width && size.width === viewport.height)
        );
    }

    detectAndroidHomeIndicator() {
        // Android 10+ gesture navigation
        return /Android 1[0-9]|Android [2-9][0-9]/.test(navigator.userAgent);
    }

    setupSafeAreaVariables() {
        // Set up CSS custom properties for safe area insets
        const root = document.documentElement;
        
        if (this.isSupported) {
            // Use native safe area insets
            root.style.setProperty('--safe-area-top', 'env(safe-area-inset-top, 0px)');
            root.style.setProperty('--safe-area-right', 'env(safe-area-inset-right, 0px)');
            root.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom, 0px)');
            root.style.setProperty('--safe-area-left', 'env(safe-area-inset-left, 0px)');
            
            // Fallback for older iOS versions
            root.style.setProperty('--safe-area-top-fallback', 'constant(safe-area-inset-top, 0px)');
            root.style.setProperty('--safe-area-right-fallback', 'constant(safe-area-inset-right, 0px)');
            root.style.setProperty('--safe-area-bottom-fallback', 'constant(safe-area-inset-bottom, 0px)');
            root.style.setProperty('--safe-area-left-fallback', 'constant(safe-area-inset-left, 0px)');
        } else {
            // Fallback values for unsupported browsers
            this.setFallbackSafeAreaValues();
        }
    }

    setFallbackSafeAreaValues() {
        const root = document.documentElement;
        const orientation = this.deviceInfo.orientation;
        
        let topInset = 0;
        let bottomInset = 0;
        let leftInset = 0;
        let rightInset = 0;
        
        if (this.deviceInfo.deviceType === 'ios') {
            if (this.deviceInfo.hasNotch) {
                if (orientation === 'portrait') {
                    topInset = 44; // Status bar + notch
                    bottomInset = this.deviceInfo.hasHomeIndicator ? 34 : 0;
                } else {
                    leftInset = 44;
                    rightInset = 44;
                    bottomInset = this.deviceInfo.hasHomeIndicator ? 21 : 0;
                }
            } else if (this.deviceInfo.hasHomeIndicator) {
                topInset = 20; // Status bar
                bottomInset = orientation === 'portrait' ? 34 : 21;
            }
        } else if (this.deviceInfo.deviceType === 'android') {
            if (this.deviceInfo.hasNotch) {
                topInset = orientation === 'portrait' ? 24 : 0;
            }
            
            if (this.deviceInfo.hasHomeIndicator) {
                bottomInset = orientation === 'portrait' ? 16 : 0;
            }
        }
        
        root.style.setProperty('--safe-area-top', `${topInset}px`);
        root.style.setProperty('--safe-area-right', `${rightInset}px`);
        root.style.setProperty('--safe-area-bottom', `${bottomInset}px`);
        root.style.setProperty('--safe-area-left', `${leftInset}px`);
        
        // Update internal state
        this.safeAreaInsets = {
            top: topInset,
            right: rightInset,
            bottom: bottomInset,
            left: leftInset
        };
    }

    setupEventListeners() {
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        // Listen for resize events
        window.addEventListener('resize', this.debounce(() => {
            this.updateSafeAreaInsets();
        }, 100));
        
        // Listen for viewport changes (keyboard, etc.)
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', () => {
                this.handleViewportChange();
            });
        }
    }

    handleOrientationChange() {
        this.updateOrientation();
        this.updateSafeAreaInsets();
        this.notifyCallbacks('orientationchange');
    }

    handleViewportChange() {
        // Handle keyboard appearance/disappearance
        const visualViewport = window.visualViewport;
        const windowHeight = window.innerHeight;
        
        if (visualViewport && visualViewport.height < windowHeight * 0.75) {
            // Keyboard is likely visible
            document.body.classList.add('keyboard-visible');
            this.notifyCallbacks('keyboardshow');
        } else {
            // Keyboard is likely hidden
            document.body.classList.remove('keyboard-visible');
            this.notifyCallbacks('keyboardhide');
        }
    }

    updateOrientation() {
        const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        
        if (orientation !== this.deviceInfo.orientation) {
            this.deviceInfo.orientation = orientation;
            document.body.classList.remove('safe-area-portrait', 'safe-area-landscape');
            document.body.classList.add(`safe-area-${orientation}`);
        }
    }

    updateSafeAreaInsets() {
        if (!this.isSupported) {
            this.setFallbackSafeAreaValues();
            return;
        }
        
        // Try to get actual safe area values
        const computedStyle = getComputedStyle(document.documentElement);
        
        const getInsetValue = (property) => {
            const value = computedStyle.getPropertyValue(property).trim();
            return value ? parseInt(value, 10) || 0 : 0;
        };
        
        this.safeAreaInsets = {
            top: getInsetValue('--safe-area-top'),
            right: getInsetValue('--safe-area-right'),
            bottom: getInsetValue('--safe-area-bottom'),
            left: getInsetValue('--safe-area-left')
        };
        
        this.notifyCallbacks('safeareaupdated');
    }

    applySafeAreaStyles() {
        // Add safe area CSS classes
        document.body.classList.add('safe-area-enabled');
        
        if (this.deviceInfo.hasNotch) {
            document.body.classList.add('has-notch');
        }
        
        if (this.deviceInfo.hasHomeIndicator) {
            document.body.classList.add('has-home-indicator');
        }
        
        document.body.classList.add(`device-${this.deviceInfo.deviceType}`);
        document.body.classList.add(`safe-area-${this.deviceInfo.orientation}`);
        
        // Inject safe area CSS
        this.injectSafeAreaCSS();
    }

    injectSafeAreaCSS() {
        const css = `
            /* Safe Area Base Styles */
            .safe-area-container {
                padding-top: var(--safe-area-top);
                padding-right: var(--safe-area-right);
                padding-bottom: var(--safe-area-bottom);
                padding-left: var(--safe-area-left);
            }
            
            .safe-area-top {
                padding-top: var(--safe-area-top);
            }
            
            .safe-area-right {
                padding-right: var(--safe-area-right);
            }
            
            .safe-area-bottom {
                padding-bottom: var(--safe-area-bottom);
            }
            
            .safe-area-left {
                padding-left: var(--safe-area-left);
            }
            
            /* Safe Area Margins */
            .safe-area-margin {
                margin-top: var(--safe-area-top);
                margin-right: var(--safe-area-right);
                margin-bottom: var(--safe-area-bottom);
                margin-left: var(--safe-area-left);
            }
            
            .safe-area-margin-top {
                margin-top: var(--safe-area-top);
            }
            
            .safe-area-margin-bottom {
                margin-bottom: var(--safe-area-bottom);
            }
            
            /* Full Screen Containers */
            .safe-area-fullscreen {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                padding-top: var(--safe-area-top);
                padding-right: var(--safe-area-right);
                padding-bottom: var(--safe-area-bottom);
                padding-left: var(--safe-area-left);
            }
            
            /* Keyboard Adjustments */
            .keyboard-visible .safe-area-bottom {
                padding-bottom: 0;
            }
            
            /* Device-Specific Adjustments */
            .has-notch.safe-area-landscape .safe-area-top {
                padding-top: 0;
            }
            
            .has-notch.safe-area-landscape .safe-area-left,
            .has-notch.safe-area-landscape .safe-area-right {
                padding-left: var(--safe-area-left);
                padding-right: var(--safe-area-right);
            }
            
            /* Utility Classes */
            .ignore-safe-area {
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .ignore-safe-area-top {
                padding-top: 0 !important;
                margin-top: 0 !important;
            }
            
            .ignore-safe-area-bottom {
                padding-bottom: 0 !important;
                margin-bottom: 0 !important;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'safe-area-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    // Public API methods
    getSafeAreaInsets() {
        return { ...this.safeAreaInsets };
    }

    getDeviceInfo() {
        return { ...this.deviceInfo };
    }

    isDeviceSupported() {
        return this.isSupported;
    }

    addCallback(callback) {
        this.callbacks.add(callback);
    }

    removeCallback(callback) {
        this.callbacks.delete(callback);
    }

    notifyCallbacks(eventType) {
        this.callbacks.forEach(callback => {
            try {
                callback({
                    type: eventType,
                    safeAreaInsets: this.getSafeAreaInsets(),
                    deviceInfo: this.getDeviceInfo(),
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('Error in safe area callback:', error);
            }
        });
    }

    // Utility methods
    applySafeAreaToElement(element, sides = ['top', 'right', 'bottom', 'left']) {
        if (!element) return;
        
        sides.forEach(side => {
            element.style[`padding${side.charAt(0).toUpperCase() + side.slice(1)}`] = 
                `var(--safe-area-${side})`;
        });
    }

    removeSafeAreaFromElement(element, sides = ['top', 'right', 'bottom', 'left']) {
        if (!element) return;
        
        sides.forEach(side => {
            element.style[`padding${side.charAt(0).toUpperCase() + side.slice(1)}`] = '';
        });
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

    destroy() {
        // Remove event listeners
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        window.removeEventListener('resize', this.updateSafeAreaInsets);
        
        if ('visualViewport' in window) {
            window.visualViewport.removeEventListener('resize', this.handleViewportChange);
        }
        
        // Remove CSS
        const styleElement = document.getElementById('safe-area-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        // Clear callbacks
        this.callbacks.clear();
        
        // Remove CSS classes
        document.body.classList.remove(
            'safe-area-enabled',
            'has-notch',
            'has-home-indicator',
            'safe-area-portrait',
            'safe-area-landscape',
            `device-${this.deviceInfo.deviceType}`
        );
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SafeAreaHandler;
} else if (typeof window !== 'undefined') {
    window.SafeAreaHandler = SafeAreaHandler;
}