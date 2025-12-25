/**
 * Mobile Haptic Feedback System
 * Provides tactile feedback for mobile game interactions
 * Enhances user experience with appropriate vibration patterns
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

class MobileHapticFeedback {
    constructor() {
        this.isInitialized = false;
        this.isSupported = 'vibrate' in navigator;
        this.isEnabled = true;
        
        // Haptic patterns for different game events
        this.patterns = {
            // Game events
            'game-start': [100, 50, 100, 50, 200],
            'game-won': [200, 100, 200, 100, 200, 100, 300],
            'game-lost': [500],
            'turn-start': [50],
            'turn-end': [25],
            
            // Tile interactions
            'tile-select': [10],
            'tile-deselect': [5],
            'tile-place': [30],
            'tile-invalid': [100, 50, 100],
            'tile-draw': [20],
            
            // UI interactions
            'button-tap': [5],
            'button-long-press': [50],
            'drawer-open': [15],
            'drawer-close': [10],
            'menu-open': [20],
            'menu-close': [15],
            
            // Board interactions
            'board-zoom': [8],
            'board-pan': [3],
            'board-reset': [40],
            'set-valid': [25, 10, 25],
            'set-invalid': [80, 40, 80],
            
            // Player interactions
            'player-join': [30],
            'player-leave': [50],
            'avatar-tap': [15],
            
            // Connection events
            'connected': [20, 10, 20],
            'disconnected': [100],
            'reconnecting': [30, 30, 30],
            
            // Notifications
            'notification-info': [25],
            'notification-warning': [50, 25, 50],
            'notification-error': [100, 50, 100],
            'notification-success': [40],
            
            // Timer events
            'timer-warning': [60],
            'timer-critical': [100, 50, 100, 50, 100],
            'time-up': [200, 100, 200],
            
            // Special effects
            'success': [40, 20, 40],
            'error': [100, 50, 100],
            'warning': [60],
            'subtle': [8],
            'emphasis': [50],
            'double-tap': [15, 15, 15],
            'long-press': [80]
        };
        
        // Intensity levels
        this.intensityLevels = {
            'subtle': 0.3,
            'light': 0.5,
            'medium': 0.7,
            'strong': 1.0
        };
        
        // Current settings
        this.settings = {
            enabled: true,
            intensity: 'medium',
            gameEvents: true,
            uiInteractions: true,
            notifications: true,
            timerEvents: true,
            customPatterns: true
        };
        
        // Pattern queue for complex sequences
        this.patternQueue = [];
        this.isPlaying = false;
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Load user settings
            this.loadSettings();
            
            // Test haptic support
            await this.testHapticSupport();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize pattern scaling
            this.initializePatternScaling();
            
            this.isInitialized = true;
            console.log('Mobile Haptic Feedback initialized successfully', {
                supported: this.isSupported,
                enabled: this.isEnabled
            });
            
        } catch (error) {
            console.error('Failed to initialize Mobile Haptic Feedback:', error);
            this.isSupported = false;
        }
    }

    loadSettings() {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('mobileHapticSettings');
        if (savedSettings) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                this.isEnabled = this.settings.enabled;
            } catch (error) {
                console.warn('Failed to load haptic settings:', error);
            }
        }
    }

    saveSettings() {
        // Save settings to localStorage
        try {
            localStorage.setItem('mobileHapticSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save haptic settings:', error);
        }
    }

    async testHapticSupport() {
        if (!this.isSupported) return;
        
        try {
            // Test basic vibration
            navigator.vibrate(1);
            console.log('Haptic feedback test successful');
        } catch (error) {
            console.warn('Haptic feedback test failed:', error);
            this.isSupported = false;
        }
    }

    setupEventListeners() {
        // Listen for page visibility changes to pause/resume haptics
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.pauseHaptics();
            } else {
                this.resumeHaptics();
            }
        });
        
        // Listen for battery status changes
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                this.handleBatteryStatus(battery);
                
                battery.addEventListener('levelchange', () => {
                    this.handleBatteryStatus(battery);
                });
                
                battery.addEventListener('chargingchange', () => {
                    this.handleBatteryStatus(battery);
                });
            });
        }
    }

    initializePatternScaling() {
        // Scale patterns based on intensity setting
        const intensityMultiplier = this.intensityLevels[this.settings.intensity] || 0.7;
        
        // Create scaled patterns
        this.scaledPatterns = new Map();
        Object.entries(this.patterns).forEach(([name, pattern]) => {
            const scaledPattern = pattern.map(duration => Math.round(duration * intensityMultiplier));
            this.scaledPatterns.set(name, scaledPattern);
        });
    }

    // Public API methods
    trigger(patternName, options = {}) {
        if (!this.canTriggerHaptic(patternName, options)) return false;
        
        const pattern = this.getPattern(patternName, options);
        if (!pattern) return false;
        
        return this.playPattern(pattern, options);
    }

    // Game event haptics
    gameStart() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('game-start');
    }

    gameWon() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('game-won');
    }

    gameLost() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('game-lost');
    }

    turnStart() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('turn-start');
    }

    turnEnd() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('turn-end');
    }

    // Tile interaction haptics
    tileSelect() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('tile-select');
    }

    tileDeselect() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('tile-deselect');
    }

    tilePlace() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('tile-place');
    }

    tileInvalid() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('tile-invalid');
    }

    tileDraw() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('tile-draw');
    }

    // UI interaction haptics
    buttonTap() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('button-tap');
    }

    buttonLongPress() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('button-long-press');
    }

    drawerOpen() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('drawer-open');
    }

    drawerClose() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('drawer-close');
    }

    menuOpen() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('menu-open');
    }

    menuClose() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('menu-close');
    }

    // Board interaction haptics
    boardZoom() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('board-zoom');
    }

    boardPan() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('board-pan');
    }

    boardReset() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('board-reset');
    }

    setValid() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('set-valid');
    }

    setInvalid() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('set-invalid');
    }

    // Player interaction haptics
    playerJoin() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('player-join');
    }

    playerLeave() {
        if (!this.settings.gameEvents) return false;
        return this.trigger('player-leave');
    }

    avatarTap() {
        if (!this.settings.uiInteractions) return false;
        return this.trigger('avatar-tap');
    }

    // Connection event haptics
    connected() {
        if (!this.settings.notifications) return false;
        return this.trigger('connected');
    }

    disconnected() {
        if (!this.settings.notifications) return false;
        return this.trigger('disconnected');
    }

    reconnecting() {
        if (!this.settings.notifications) return false;
        return this.trigger('reconnecting');
    }

    // Notification haptics
    notificationInfo() {
        if (!this.settings.notifications) return false;
        return this.trigger('notification-info');
    }

    notificationWarning() {
        if (!this.settings.notifications) return false;
        return this.trigger('notification-warning');
    }

    notificationError() {
        if (!this.settings.notifications) return false;
        return this.trigger('notification-error');
    }

    notificationSuccess() {
        if (!this.settings.notifications) return false;
        return this.trigger('notification-success');
    }

    // Timer event haptics
    timerWarning() {
        if (!this.settings.timerEvents) return false;
        return this.trigger('timer-warning');
    }

    timerCritical() {
        if (!this.settings.timerEvents) return false;
        return this.trigger('timer-critical');
    }

    timeUp() {
        if (!this.settings.timerEvents) return false;
        return this.trigger('time-up');
    }

    // Generic haptics
    success() {
        return this.trigger('success');
    }

    error() {
        return this.trigger('error');
    }

    warning() {
        return this.trigger('warning');
    }

    subtle() {
        return this.trigger('subtle');
    }

    emphasis() {
        return this.trigger('emphasis');
    }

    doubleTap() {
        return this.trigger('double-tap');
    }

    longPress() {
        return this.trigger('long-press');
    }

    // Custom pattern methods
    customPattern(pattern, options = {}) {
        if (!this.settings.customPatterns) return false;
        
        if (!Array.isArray(pattern)) {
            console.warn('Custom pattern must be an array');
            return false;
        }
        
        return this.playPattern(pattern, options);
    }

    sequence(patternNames, delay = 100) {
        if (!Array.isArray(patternNames)) return false;
        
        // Queue patterns with delays
        patternNames.forEach((patternName, index) => {
            setTimeout(() => {
                this.trigger(patternName);
            }, index * delay);
        });
        
        return true;
    }

    // Internal methods
    canTriggerHaptic(patternName, options = {}) {
        // Check if haptics are supported and enabled
        if (!this.isSupported || !this.isEnabled || !this.settings.enabled) {
            return false;
        }
        
        // Check if currently playing and not allowing interruption
        if (this.isPlaying && !options.interrupt) {
            return false;
        }
        
        // Check page visibility (don't vibrate when page is hidden)
        if (document.visibilityState === 'hidden' && !options.allowBackground) {
            return false;
        }
        
        return true;
    }

    getPattern(patternName, options = {}) {
        // Get scaled pattern
        let pattern = this.scaledPatterns.get(patternName);
        
        if (!pattern) {
            // Try original patterns
            pattern = this.patterns[patternName];
        }
        
        if (!pattern) {
            console.warn(`Haptic pattern '${patternName}' not found`);
            return null;
        }
        
        // Apply additional scaling if specified
        if (options.intensity) {
            const intensityMultiplier = this.intensityLevels[options.intensity] || 1.0;
            pattern = pattern.map(duration => Math.round(duration * intensityMultiplier));
        }
        
        // Apply duration scaling
        if (options.scale) {
            pattern = pattern.map(duration => Math.round(duration * options.scale));
        }
        
        return pattern;
    }

    playPattern(pattern, options = {}) {
        if (!pattern || pattern.length === 0) return false;
        
        try {
            // Stop current vibration if interrupting
            if (this.isPlaying && options.interrupt) {
                navigator.vibrate(0);
            }
            
            // Set playing state
            this.isPlaying = true;
            
            // Play pattern
            navigator.vibrate(pattern);
            
            // Calculate total duration
            const totalDuration = pattern.reduce((sum, duration, index) => {
                return sum + duration;
            }, 0);
            
            // Reset playing state after pattern completes
            setTimeout(() => {
                this.isPlaying = false;
                this.emit('patternComplete', { pattern, duration: totalDuration });
            }, totalDuration);
            
            // Emit pattern start event
            this.emit('patternStart', { pattern, duration: totalDuration });
            
            return true;
            
        } catch (error) {
            console.warn('Failed to play haptic pattern:', error);
            this.isPlaying = false;
            return false;
        }
    }

    // Control methods
    stop() {
        if (!this.isSupported) return false;
        
        try {
            navigator.vibrate(0);
            this.isPlaying = false;
            this.patternQueue = [];
            this.emit('stopped');
            return true;
        } catch (error) {
            console.warn('Failed to stop haptic feedback:', error);
            return false;
        }
    }

    pauseHaptics() {
        this.stop();
        this.emit('paused');
    }

    resumeHaptics() {
        this.emit('resumed');
    }

    // Settings methods
    enable() {
        this.isEnabled = true;
        this.settings.enabled = true;
        this.saveSettings();
        this.emit('enabled');
    }

    disable() {
        this.stop();
        this.isEnabled = false;
        this.settings.enabled = false;
        this.saveSettings();
        this.emit('disabled');
    }

    setIntensity(intensity) {
        if (!this.intensityLevels[intensity]) {
            console.warn(`Invalid intensity level: ${intensity}`);
            return false;
        }
        
        this.settings.intensity = intensity;
        this.saveSettings();
        this.initializePatternScaling();
        this.emit('intensityChanged', intensity);
        return true;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.isEnabled = this.settings.enabled;
        this.saveSettings();
        
        // Reinitialize pattern scaling if intensity changed
        if (newSettings.intensity) {
            this.initializePatternScaling();
        }
        
        this.emit('settingsUpdated', this.settings);
    }

    // Battery optimization
    handleBatteryStatus(battery) {
        const batteryLevel = battery.level;
        const isCharging = battery.charging;
        
        // Reduce haptic intensity on low battery
        if (batteryLevel < 0.2 && !isCharging) {
            // Switch to subtle intensity
            if (this.settings.intensity !== 'subtle') {
                this.setIntensity('subtle');
                this.emit('batteryOptimization', { level: batteryLevel, intensity: 'subtle' });
            }
        } else if (batteryLevel > 0.5 || isCharging) {
            // Restore normal intensity if it was reduced
            if (this.settings.intensity === 'subtle' && batteryLevel > 0.5) {
                this.setIntensity('medium');
                this.emit('batteryOptimization', { level: batteryLevel, intensity: 'medium' });
            }
        }
    }

    // Status methods
    isHapticSupported() {
        return this.isSupported;
    }

    isHapticEnabled() {
        return this.isEnabled && this.settings.enabled;
    }

    isCurrentlyPlaying() {
        return this.isPlaying;
    }

    getSettings() {
        return { ...this.settings };
    }

    getAvailablePatterns() {
        return Object.keys(this.patterns);
    }

    getAvailableIntensities() {
        return Object.keys(this.intensityLevels);
    }

    getCurrentIntensity() {
        return this.settings.intensity;
    }

    // Pattern management
    addCustomPattern(name, pattern) {
        if (!Array.isArray(pattern)) {
            console.warn('Pattern must be an array of durations');
            return false;
        }
        
        this.patterns[name] = pattern;
        
        // Add scaled version
        const intensityMultiplier = this.intensityLevels[this.settings.intensity] || 0.7;
        const scaledPattern = pattern.map(duration => Math.round(duration * intensityMultiplier));
        this.scaledPatterns.set(name, scaledPattern);
        
        this.emit('patternAdded', { name, pattern });
        return true;
    }

    removeCustomPattern(name) {
        if (this.patterns[name]) {
            delete this.patterns[name];
            this.scaledPatterns.delete(name);
            this.emit('patternRemoved', { name });
            return true;
        }
        return false;
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
                    console.error(`Error in haptic callback for ${eventName}:`, error);
                }
            });
        }
    }

    // Cleanup
    destroy() {
        // Stop any playing patterns
        this.stop();
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.pauseHaptics);
        
        // Clear callbacks
        this.eventCallbacks.clear();
        
        // Clear patterns
        this.scaledPatterns.clear();
        this.patternQueue = [];
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileHapticFeedback;
} else if (typeof window !== 'undefined') {
    window.MobileHapticFeedback = MobileHapticFeedback;
}