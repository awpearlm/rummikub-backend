/**
 * Cross-Platform Compatibility Layer
 * Ensures seamless interaction between mobile and desktop players
 * Handles platform-specific differences and maintains game state consistency
 * Requirements: 15.3, 15.4, 15.5
 */

class CrossPlatformCompatibility {
    constructor(mobileUISystem, gameIntegration) {
        this.mobileUISystem = mobileUISystem;
        this.gameIntegration = gameIntegration;
        
        this.isInitialized = false;
        this.compatibilityState = {
            isCrossPlatformGame: false,
            mobilePlayerCount: 0,
            desktopPlayerCount: 0,
            platformMix: 'unknown',
            syncMode: 'standard'
        };
        
        // Platform detection
        this.platformInfo = {
            isMobile: this.detectMobileDevice(),
            userAgent: navigator.userAgent,
            touchSupport: 'ontouchstart' in window,
            screenSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            orientation: this.getOrientation()
        };
        
        // Compatibility features
        this.compatibilityFeatures = {
            stateSync: true,
            inputNormalization: true,
            timingAdjustment: true,
            visualConsistency: true,
            performanceOptimization: true
        };
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup platform detection and reporting
            this.setupPlatformDetection();
            
            // Setup cross-platform state synchronization
            this.setupStateSynchronization();
            
            // Setup input normalization
            this.setupInputNormalization();
            
            // Setup timing adjustments
            this.setupTimingAdjustments();
            
            // Setup visual consistency
            this.setupVisualConsistency();
            
            // Setup performance optimization
            this.setupPerformanceOptimization();
            
            // Setup cross-platform event handling
            this.setupCrossPlatformEventHandling();
            
            this.isInitialized = true;
            console.log('Cross-Platform Compatibility initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Cross-Platform Compatibility:', error);
            throw error;
        }
    }

    setupPlatformDetection() {
        // Report platform information to server
        this.reportPlatformInfo();
        
        // Listen for game state changes to detect cross-platform games
        this.gameIntegration.on('gameStateChanged', (gameState) => {
            this.analyzePlatformMix(gameState);
        });
        
        // Monitor orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateOrientationInfo();
            }, 100);
        });
        
        // Monitor screen size changes
        window.addEventListener('resize', () => {
            this.updateScreenSizeInfo();
        });
    }

    setupStateSynchronization() {
        if (!this.compatibilityFeatures.stateSync) return;
        
        // Enhanced state synchronization for cross-platform games
        this.gameIntegration.on('gameStateChanged', (gameState) => {
            this.synchronizeGameState(gameState);
        });
        
        // Handle mobile-specific state updates
        this.mobileUISystem.on('screenChanged', (data) => {
            this.synchronizeScreenState(data);
        });
        
        // Handle orientation changes
        this.mobileUISystem.on('orientationChanged', (data) => {
            this.synchronizeOrientationState(data);
        });
    }

    setupInputNormalization() {
        if (!this.compatibilityFeatures.inputNormalization) return;
        
        // Normalize touch inputs to be compatible with mouse inputs
        this.setupTouchToMouseNormalization();
        
        // Normalize gesture inputs
        this.setupGestureNormalization();
        
        // Handle input timing differences
        this.setupInputTimingNormalization();
    }

    setupTimingAdjustments() {
        if (!this.compatibilityFeatures.timingAdjustment) return;
        
        // Adjust animation timing for cross-platform consistency
        this.setupAnimationTimingAdjustments();
        
        // Adjust network timing for mobile devices
        this.setupNetworkTimingAdjustments();
        
        // Handle turn timer adjustments
        this.setupTurnTimerAdjustments();
    }

    setupVisualConsistency() {
        if (!this.compatibilityFeatures.visualConsistency) return;
        
        // Ensure visual elements appear consistently across platforms
        this.setupVisualElementConsistency();
        
        // Handle different screen densities
        this.setupScreenDensityHandling();
        
        // Ensure color consistency
        this.setupColorConsistency();
    }

    setupPerformanceOptimization() {
        if (!this.compatibilityFeatures.performanceOptimization) return;
        
        // Optimize performance for cross-platform games
        this.setupCrossPlatformPerformanceOptimization();
        
        // Handle different device capabilities
        this.setupDeviceCapabilityHandling();
        
        // Optimize network usage
        this.setupNetworkOptimization();
    }

    setupCrossPlatformEventHandling() {
        // Handle events that need cross-platform coordination
        this.gameIntegration.on('playerJoined', (data) => {
            this.handleCrossPlatformPlayerJoined(data);
        });
        
        this.gameIntegration.on('playerLeft', (data) => {
            this.handleCrossPlatformPlayerLeft(data);
        });
        
        this.gameIntegration.on('turnChanged', (data) => {
            this.handleCrossPlatformTurnChanged(data);
        });
    }

    // Platform detection methods
    detectMobileDevice() {
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return mobileRegex.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }

    getOrientation() {
        if (screen.orientation) {
            return screen.orientation.type;
        } else if (window.orientation !== undefined) {
            return Math.abs(window.orientation) === 90 ? 'landscape' : 'portrait';
        } else {
            return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        }
    }

    reportPlatformInfo() {
        // Send platform information to server for cross-platform optimization
        const platformData = {
            platform: this.platformInfo.isMobile ? 'mobile' : 'desktop',
            userAgent: this.platformInfo.userAgent,
            touchSupport: this.platformInfo.touchSupport,
            screenSize: this.platformInfo.screenSize,
            orientation: this.platformInfo.orientation,
            timestamp: Date.now()
        };
        
        // Send to server if connected
        if (this.gameIntegration.socket && this.gameIntegration.socket.connected) {
            this.gameIntegration.socket.emit('platformInfo', platformData);
        }
        
        console.log('Cross-Platform: Reported platform info', platformData);
    }

    updateOrientationInfo() {
        this.platformInfo.orientation = this.getOrientation();
        this.reportPlatformInfo();
        
        // Emit orientation change for cross-platform coordination
        this.emit('orientationChanged', {
            orientation: this.platformInfo.orientation,
            isMobile: this.platformInfo.isMobile
        });
    }

    updateScreenSizeInfo() {
        this.platformInfo.screenSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        this.reportPlatformInfo();
    }

    // Platform mix analysis
    analyzePlatformMix(gameState) {
        if (!gameState.players) return;
        
        let mobileCount = 0;
        let desktopCount = 0;
        
        gameState.players.forEach(player => {
            if (player.platform === 'mobile' || player.isMobile) {
                mobileCount++;
            } else {
                desktopCount++;
            }
        });
        
        const wasCrossPlatform = this.compatibilityState.isCrossPlatformGame;
        const isCrossPlatform = mobileCount > 0 && desktopCount > 0;
        
        this.compatibilityState.mobilePlayerCount = mobileCount;
        this.compatibilityState.desktopPlayerCount = desktopCount;
        this.compatibilityState.isCrossPlatformGame = isCrossPlatform;
        
        // Determine platform mix
        if (mobileCount === 0) {
            this.compatibilityState.platformMix = 'desktop-only';
        } else if (desktopCount === 0) {
            this.compatibilityState.platformMix = 'mobile-only';
        } else {
            this.compatibilityState.platformMix = 'mixed';
        }
        
        // Handle cross-platform mode changes
        if (isCrossPlatform !== wasCrossPlatform) {
            this.handleCrossPlatformModeChange(isCrossPlatform);
        }
        
        console.log('Cross-Platform: Platform mix analyzed', {
            mobile: mobileCount,
            desktop: desktopCount,
            isCrossPlatform,
            platformMix: this.compatibilityState.platformMix
        });
    }

    handleCrossPlatformModeChange(isCrossPlatform) {
        if (isCrossPlatform) {
            console.log('Cross-Platform: Enabling cross-platform mode');
            this.enableCrossPlatformMode();
        } else {
            console.log('Cross-Platform: Disabling cross-platform mode');
            this.disableCrossPlatformMode();
        }
        
        // Emit mode change event
        this.emit('crossPlatformModeChanged', {
            enabled: isCrossPlatform,
            platformMix: this.compatibilityState.platformMix
        });
    }

    enableCrossPlatformMode() {
        // Enable enhanced synchronization
        this.compatibilityState.syncMode = 'enhanced';
        
        // Apply cross-platform optimizations
        this.applyCrossPlatformOptimizations();
        
        // Show cross-platform indicator
        this.showCrossPlatformIndicator();
        
        // Adjust mobile UI for cross-platform compatibility
        this.adjustMobileUIForCrossPlatform();
    }

    disableCrossPlatformMode() {
        // Return to standard synchronization
        this.compatibilityState.syncMode = 'standard';
        
        // Remove cross-platform optimizations
        this.removeCrossPlatformOptimizations();
        
        // Hide cross-platform indicator
        this.hideCrossPlatformIndicator();
        
        // Reset mobile UI to standard mode
        this.resetMobileUIFromCrossPlatform();
    }

    // State synchronization methods
    synchronizeGameState(gameState) {
        if (!this.compatibilityState.isCrossPlatformGame) return;
        
        // Enhanced synchronization for cross-platform games
        this.synchronizeWithEnhancedMode(gameState);
    }

    synchronizeWithEnhancedMode(gameState) {
        // Ensure all platforms have consistent game state
        const syncData = {
            gameState,
            platformInfo: this.platformInfo,
            timestamp: Date.now(),
            syncMode: 'enhanced'
        };
        
        // Apply platform-specific adjustments
        this.applyPlatformSpecificAdjustments(syncData);
        
        // Emit synchronized state
        this.emit('gameStateSynchronized', syncData);
    }

    synchronizeScreenState(screenData) {
        if (!this.compatibilityState.isCrossPlatformGame) return;
        
        // Notify other platforms about screen changes
        const syncData = {
            screen: screenData.newScreen,
            platform: 'mobile',
            orientation: this.platformInfo.orientation,
            timestamp: Date.now()
        };
        
        // Send to server for cross-platform coordination
        if (this.gameIntegration.socket && this.gameIntegration.socket.connected) {
            this.gameIntegration.socket.emit('screenStateSync', syncData);
        }
    }

    synchronizeOrientationState(orientationData) {
        if (!this.compatibilityState.isCrossPlatformGame) return;
        
        // Notify other platforms about orientation changes
        const syncData = {
            orientation: orientationData.newOrientation,
            previousOrientation: orientationData.previousOrientation,
            platform: 'mobile',
            timestamp: Date.now()
        };
        
        // Send to server for cross-platform coordination
        if (this.gameIntegration.socket && this.gameIntegration.socket.connected) {
            this.gameIntegration.socket.emit('orientationStateSync', syncData);
        }
    }

    // Input normalization methods
    setupTouchToMouseNormalization() {
        // Convert touch events to mouse-compatible events for cross-platform consistency
        const gameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (!gameScreen) return;
        
        const gameArea = gameScreen.getGameArea();
        if (!gameArea) return;
        
        // Touch start -> mouse down
        gameArea.addEventListener('touchstart', (e) => {
            if (this.compatibilityState.isCrossPlatformGame) {
                this.normalizeTouchToMouse(e, 'mousedown');
            }
        });
        
        // Touch move -> mouse move
        gameArea.addEventListener('touchmove', (e) => {
            if (this.compatibilityState.isCrossPlatformGame) {
                this.normalizeTouchToMouse(e, 'mousemove');
            }
        });
        
        // Touch end -> mouse up
        gameArea.addEventListener('touchend', (e) => {
            if (this.compatibilityState.isCrossPlatformGame) {
                this.normalizeTouchToMouse(e, 'mouseup');
            }
        });
    }

    normalizeTouchToMouse(touchEvent, mouseEventType) {
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        if (!touch) return;
        
        // Create normalized mouse event data
        const normalizedEvent = {
            type: mouseEventType,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pageX: touch.pageX,
            pageY: touch.pageY,
            screenX: touch.screenX,
            screenY: touch.screenY,
            button: 0, // Left button
            buttons: 1,
            platform: 'mobile',
            normalized: true,
            originalEvent: touchEvent
        };
        
        // Emit normalized event for cross-platform handling
        this.emit('normalizedInput', normalizedEvent);
    }

    setupGestureNormalization() {
        // Normalize mobile gestures to desktop-compatible actions
        const gestureRecognizer = this.mobileUISystem.getComponent('gestureRecognizer');
        if (!gestureRecognizer) return;
        
        // Listen for gesture events and normalize them
        gestureRecognizer.on('gesture', (gestureData) => {
            if (this.compatibilityState.isCrossPlatformGame) {
                this.normalizeGesture(gestureData);
            }
        });
    }

    normalizeGesture(gestureData) {
        let normalizedAction = null;
        
        switch (gestureData.type) {
            case 'tap':
                normalizedAction = {
                    type: 'click',
                    position: gestureData.position,
                    platform: 'mobile'
                };
                break;
                
            case 'drag':
                normalizedAction = {
                    type: 'drag',
                    startPosition: gestureData.startPosition,
                    endPosition: gestureData.endPosition,
                    platform: 'mobile'
                };
                break;
                
            case 'pinch':
                normalizedAction = {
                    type: 'zoom',
                    scale: gestureData.scale,
                    center: gestureData.center,
                    platform: 'mobile'
                };
                break;
        }
        
        if (normalizedAction) {
            this.emit('normalizedGesture', normalizedAction);
        }
    }

    setupInputTimingNormalization() {
        // Adjust input timing for cross-platform consistency
        this.inputTimingAdjustment = {
            touchDelay: 0, // No delay for touch
            mouseDelay: 16, // Small delay to match touch responsiveness
            gestureDelay: 32 // Slightly longer for complex gestures
        };
    }

    // Timing adjustment methods
    setupAnimationTimingAdjustments() {
        // Ensure animations are synchronized across platforms
        const animationManager = this.mobileUISystem.getComponent('animationPerformanceManager');
        if (!animationManager) return;
        
        // Adjust animation timing for cross-platform consistency
        if (this.compatibilityState.isCrossPlatformGame) {
            animationManager.setCrossPlatformMode(true);
        }
    }

    setupNetworkTimingAdjustments() {
        // Adjust network timing for mobile devices in cross-platform games
        const networkingIntegration = this.mobileUISystem.getComponent('mobileNetworkingIntegration');
        if (!networkingIntegration) return;
        
        // Apply mobile-specific timing adjustments
        networkingIntegration.on('networkQualityChanged', (quality) => {
            if (this.compatibilityState.isCrossPlatformGame) {
                this.adjustTimingForNetworkQuality(quality);
            }
        });
    }

    setupTurnTimerAdjustments() {
        // Adjust turn timers for mobile devices
        this.gameIntegration.on('timerUpdate', (data) => {
            if (this.compatibilityState.isCrossPlatformGame) {
                this.adjustTurnTimerForMobile(data);
            }
        });
    }

    adjustTimingForNetworkQuality(quality) {
        const adjustments = {
            poor: { delay: 500, timeout: 10000 },
            fair: { delay: 200, timeout: 5000 },
            good: { delay: 100, timeout: 3000 }
        };
        
        const adjustment = adjustments[quality] || adjustments.fair;
        
        // Apply timing adjustments
        this.emit('timingAdjusted', adjustment);
    }

    adjustTurnTimerForMobile(timerData) {
        // Add small buffer for mobile devices
        const mobileBuffer = 2000; // 2 seconds
        
        const adjustedTimer = {
            ...timerData,
            remainingTime: timerData.remainingTime + (this.platformInfo.isMobile ? mobileBuffer : 0),
            mobileAdjusted: this.platformInfo.isMobile
        };
        
        this.emit('timerAdjusted', adjustedTimer);
    }

    // Visual consistency methods
    setupVisualElementConsistency() {
        // Ensure visual elements appear consistently across platforms
        this.applyVisualConsistencyStyles();
    }

    applyVisualConsistencyStyles() {
        const css = `
            .cross-platform-mode {
                /* Ensure consistent sizing across platforms */
                --tile-size: 40px;
                --avatar-size: 48px;
                --button-height: 44px;
                
                /* Consistent colors */
                --primary-color: #3b82f6;
                --success-color: #10b981;
                --warning-color: #f59e0b;
                --error-color: #ef4444;
                
                /* Consistent typography */
                --font-size-small: 12px;
                --font-size-medium: 14px;
                --font-size-large: 16px;
                
                /* Consistent spacing */
                --spacing-small: 8px;
                --spacing-medium: 16px;
                --spacing-large: 24px;
            }
            
            .cross-platform-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(59, 130, 246, 0.9);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'cross-platform-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    setupScreenDensityHandling() {
        // Handle different screen densities
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Apply density-specific adjustments
        document.documentElement.style.setProperty('--pixel-ratio', pixelRatio);
        
        // Adjust for high-density screens
        if (pixelRatio > 2) {
            document.documentElement.classList.add('high-density');
        }
    }

    setupColorConsistency() {
        // Ensure colors appear consistently across different screens
        const colorProfile = this.detectColorProfile();
        
        // Apply color profile adjustments
        document.documentElement.setAttribute('data-color-profile', colorProfile);
    }

    detectColorProfile() {
        // Simple color profile detection
        if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
            return 'p3';
        } else if (window.matchMedia && window.matchMedia('(color-gamut: srgb)').matches) {
            return 'srgb';
        } else {
            return 'standard';
        }
    }

    // Performance optimization methods
    setupCrossPlatformPerformanceOptimization() {
        // Optimize performance for cross-platform games
        this.performanceOptimizations = {
            reducedAnimations: false,
            simplifiedEffects: false,
            loweredFrameRate: false
        };
        
        // Monitor performance and adjust
        this.monitorCrossPlatformPerformance();
    }

    monitorCrossPlatformPerformance() {
        // Monitor frame rate and adjust performance
        let frameCount = 0;
        let lastTime = performance.now();
        
        const checkPerformance = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = frameCount;
                frameCount = 0;
                lastTime = currentTime;
                
                // Adjust performance based on FPS
                if (fps < 30 && this.compatibilityState.isCrossPlatformGame) {
                    this.applyPerformanceOptimizations();
                } else if (fps > 50) {
                    this.removePerformanceOptimizations();
                }
            }
            
            requestAnimationFrame(checkPerformance);
        };
        
        requestAnimationFrame(checkPerformance);
    }

    applyPerformanceOptimizations() {
        if (this.performanceOptimizations.reducedAnimations) return;
        
        console.log('Cross-Platform: Applying performance optimizations');
        
        // Reduce animations
        this.performanceOptimizations.reducedAnimations = true;
        document.documentElement.classList.add('reduced-animations');
        
        // Simplify effects
        this.performanceOptimizations.simplifiedEffects = true;
        document.documentElement.classList.add('simplified-effects');
        
        // Emit performance optimization event
        this.emit('performanceOptimized', this.performanceOptimizations);
    }

    removePerformanceOptimizations() {
        if (!this.performanceOptimizations.reducedAnimations) return;
        
        console.log('Cross-Platform: Removing performance optimizations');
        
        // Restore animations
        this.performanceOptimizations.reducedAnimations = false;
        document.documentElement.classList.remove('reduced-animations');
        
        // Restore effects
        this.performanceOptimizations.simplifiedEffects = false;
        document.documentElement.classList.remove('simplified-effects');
        
        // Emit performance restoration event
        this.emit('performanceRestored', this.performanceOptimizations);
    }

    // Cross-platform event handlers
    handleCrossPlatformPlayerJoined(data) {
        // Handle player joining in cross-platform context
        console.log('Cross-Platform: Player joined', data);
        
        // Update platform mix
        if (data.gameState) {
            this.analyzePlatformMix(data.gameState);
        }
    }

    handleCrossPlatformPlayerLeft(data) {
        // Handle player leaving in cross-platform context
        console.log('Cross-Platform: Player left', data);
        
        // Update platform mix
        if (data.gameState) {
            this.analyzePlatformMix(data.gameState);
        }
    }

    handleCrossPlatformTurnChanged(data) {
        // Handle turn changes in cross-platform context
        if (this.compatibilityState.isCrossPlatformGame) {
            // Apply cross-platform turn adjustments
            this.applyCrossPlatformTurnAdjustments(data);
        }
    }

    // UI adjustment methods
    applyCrossPlatformOptimizations() {
        // Apply visual optimizations for cross-platform games
        document.body.classList.add('cross-platform-mode');
        
        // Adjust mobile UI components
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            mobileGameScreen.getContainer().classList.add('cross-platform-mode');
        }
    }

    removeCrossPlatformOptimizations() {
        // Remove cross-platform optimizations
        document.body.classList.remove('cross-platform-mode');
        
        // Reset mobile UI components
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            mobileGameScreen.getContainer().classList.remove('cross-platform-mode');
        }
    }

    showCrossPlatformIndicator() {
        // Show indicator that this is a cross-platform game
        const indicator = document.createElement('div');
        indicator.id = 'cross-platform-indicator';
        indicator.className = 'cross-platform-indicator';
        indicator.textContent = 'Cross-Platform';
        
        document.body.appendChild(indicator);
    }

    hideCrossPlatformIndicator() {
        // Hide cross-platform indicator
        const indicator = document.getElementById('cross-platform-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    adjustMobileUIForCrossPlatform() {
        // Adjust mobile UI for better cross-platform compatibility
        console.log('Cross-Platform: Adjusting mobile UI for cross-platform mode');
        
        // Apply cross-platform specific styles and behaviors
        this.emit('mobileUIAdjusted', { mode: 'cross-platform' });
    }

    resetMobileUIFromCrossPlatform() {
        // Reset mobile UI from cross-platform mode
        console.log('Cross-Platform: Resetting mobile UI from cross-platform mode');
        
        // Remove cross-platform specific styles and behaviors
        this.emit('mobileUIReset', { mode: 'standard' });
    }

    applyCrossPlatformTurnAdjustments(turnData) {
        // Apply turn-specific adjustments for cross-platform games
        const adjustedTurnData = {
            ...turnData,
            crossPlatformMode: true,
            platformMix: this.compatibilityState.platformMix
        };
        
        this.emit('turnAdjusted', adjustedTurnData);
    }

    applyPlatformSpecificAdjustments(syncData) {
        // Apply platform-specific adjustments to sync data
        if (this.platformInfo.isMobile) {
            // Mobile-specific adjustments
            syncData.mobileOptimizations = {
                reducedAnimations: this.performanceOptimizations.reducedAnimations,
                touchOptimized: true,
                orientationAware: true
            };
        }
        
        return syncData;
    }

    // Public API
    getCompatibilityState() {
        return { ...this.compatibilityState };
    }

    getPlatformInfo() {
        return { ...this.platformInfo };
    }

    isCrossPlatformGame() {
        return this.compatibilityState.isCrossPlatformGame;
    }

    getPlatformMix() {
        return this.compatibilityState.platformMix;
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

    // Cleanup
    destroy() {
        // Remove event listeners
        window.removeEventListener('orientationchange', this.updateOrientationInfo);
        window.removeEventListener('resize', this.updateScreenSizeInfo);
        
        // Remove styles
        const styleElement = document.getElementById('cross-platform-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        // Remove indicator
        this.hideCrossPlatformIndicator();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Reset state
        this.compatibilityState = {
            isCrossPlatformGame: false,
            mobilePlayerCount: 0,
            desktopPlayerCount: 0,
            platformMix: 'unknown',
            syncMode: 'standard'
        };
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrossPlatformCompatibility;
} else if (typeof window !== 'undefined') {
    window.CrossPlatformCompatibility = CrossPlatformCompatibility;
}