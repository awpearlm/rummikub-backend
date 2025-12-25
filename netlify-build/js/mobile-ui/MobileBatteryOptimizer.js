/**
 * Mobile Battery Optimizer
 * Task 14.2: Add mobile-specific optimizations - Battery usage optimizations
 * 
 * Implements battery-aware features to optimize power consumption on mobile devices
 * Requirements: 12.3, 12.4
 */

class MobileBatteryOptimizer {
    constructor() {
        this.batteryAPI = null;
        this.batteryLevel = 1.0;
        this.isCharging = false;
        this.batteryOptimizations = new Map();
        this.optimizationLevel = 'normal'; // normal, power-saver, critical
        this.eventCallbacks = new Map();
        
        this.optimizationStrategies = {
            normal: {
                animationQuality: 'high',
                updateFrequency: 1000,
                backgroundSync: true,
                hapticFeedback: true,
                visualEffects: true
            },
            'power-saver': {
                animationQuality: 'medium',
                updateFrequency: 2000,
                backgroundSync: false,
                hapticFeedback: false,
                visualEffects: false
            },
            critical: {
                animationQuality: 'low',
                updateFrequency: 5000,
                backgroundSync: false,
                hapticFeedback: false,
                visualEffects: false
            }
        };
        
        this.init();
    }

    async init() {
        try {
            // Initialize Battery API if available
            if ('getBattery' in navigator) {
                this.batteryAPI = await navigator.getBattery();
                this.setupBatteryMonitoring();
            } else {
                console.warn('Battery API not supported - using fallback optimization');
                this.setupFallbackOptimization();
            }
            
            // Setup visibility change monitoring
            this.setupVisibilityMonitoring();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            console.log('Mobile Battery Optimizer initialized');
            
        } catch (error) {
            console.error('Failed to initialize Battery Optimizer:', error);
            this.setupFallbackOptimization();
        }
    }

    setupBatteryMonitoring() {
        if (!this.batteryAPI) return;
        
        // Initial battery state
        this.updateBatteryState();
        
        // Battery level change
        this.batteryAPI.addEventListener('levelchange', () => {
            this.updateBatteryState();
        });
        
        // Charging state change
        this.batteryAPI.addEventListener('chargingchange', () => {
            this.updateBatteryState();
        });
        
        // Charging time change
        this.batteryAPI.addEventListener('chargingtimechange', () => {
            this.updateBatteryState();
        });
        
        // Discharging time change
        this.batteryAPI.addEventListener('dischargingtimechange', () => {
            this.updateBatteryState();
        });
    }

    updateBatteryState() {
        if (!this.batteryAPI) return;
        
        const previousLevel = this.batteryLevel;
        const previousCharging = this.isCharging;
        
        this.batteryLevel = this.batteryAPI.level;
        this.isCharging = this.batteryAPI.charging;
        
        // Determine optimization level based on battery state
        const newOptimizationLevel = this.calculateOptimizationLevel();
        
        if (newOptimizationLevel !== this.optimizationLevel) {
            this.setOptimizationLevel(newOptimizationLevel);
        }
        
        // Emit battery state change event
        this.emit('batteryStateChanged', {
            level: this.batteryLevel,
            charging: this.isCharging,
            chargingTime: this.batteryAPI.chargingTime,
            dischargingTime: this.batteryAPI.dischargingTime,
            optimizationLevel: this.optimizationLevel
        });
        
        // Log significant battery changes
        if (Math.abs(this.batteryLevel - previousLevel) > 0.1 || this.isCharging !== previousCharging) {
            console.log(`Battery: ${Math.round(this.batteryLevel * 100)}% ${this.isCharging ? '(charging)' : '(discharging)'} - Optimization: ${this.optimizationLevel}`);
        }
    }

    calculateOptimizationLevel() {
        // Critical battery level (under 15%)
        if (this.batteryLevel < 0.15 && !this.isCharging) {
            return 'critical';
        }
        
        // Power saver mode (under 30% and not charging)
        if (this.batteryLevel < 0.30 && !this.isCharging) {
            return 'power-saver';
        }
        
        // Normal mode (above 30% or charging)
        return 'normal';
    }

    setOptimizationLevel(level) {
        const previousLevel = this.optimizationLevel;
        this.optimizationLevel = level;
        
        const strategy = this.optimizationStrategies[level];
        
        // Apply optimizations
        this.applyAnimationOptimizations(strategy.animationQuality);
        this.applyUpdateFrequencyOptimizations(strategy.updateFrequency);
        this.applyBackgroundSyncOptimizations(strategy.backgroundSync);
        this.applyHapticOptimizations(strategy.hapticFeedback);
        this.applyVisualEffectOptimizations(strategy.visualEffects);
        
        // Emit optimization level change
        this.emit('optimizationLevelChanged', {
            previousLevel: previousLevel,
            newLevel: level,
            strategy: strategy
        });
        
        // Show user notification for significant changes
        if (level === 'critical' && previousLevel !== 'critical') {
            this.showBatteryNotification('Critical battery level - enabling power saving mode');
        } else if (level === 'power-saver' && previousLevel === 'normal') {
            this.showBatteryNotification('Low battery - reducing power consumption');
        } else if (level === 'normal' && previousLevel !== 'normal') {
            this.showBatteryNotification('Battery level restored - full features enabled');
        }
    }

    applyAnimationOptimizations(quality) {
        const root = document.documentElement;
        
        // Remove previous animation quality classes
        root.classList.remove('animation-quality-high', 'animation-quality-medium', 'animation-quality-low');
        
        // Apply new animation quality
        root.classList.add(`animation-quality-${quality}`);
        
        // Update CSS custom properties
        const qualitySettings = {
            high: { duration: '1', easing: 'ease-out', effects: '1' },
            medium: { duration: '0.7', easing: 'ease', effects: '0.7' },
            low: { duration: '0.3', easing: 'linear', effects: '0.3' }
        };
        
        const settings = qualitySettings[quality];
        root.style.setProperty('--animation-duration-multiplier', settings.duration);
        root.style.setProperty('--animation-easing', settings.easing);
        root.style.setProperty('--visual-effects-opacity', settings.effects);
        
        this.batteryOptimizations.set('animationQuality', quality);
    }

    applyUpdateFrequencyOptimizations(frequency) {
        // Update real-time update intervals
        this.emit('updateFrequencyChanged', { frequency: frequency });
        
        // Store optimization
        this.batteryOptimizations.set('updateFrequency', frequency);
    }

    applyBackgroundSyncOptimizations(enabled) {
        // Control background synchronization
        this.emit('backgroundSyncChanged', { enabled: enabled });
        
        // Store optimization
        this.batteryOptimizations.set('backgroundSync', enabled);
    }

    applyHapticOptimizations(enabled) {
        // Control haptic feedback
        this.emit('hapticFeedbackChanged', { enabled: enabled });
        
        // Store optimization
        this.batteryOptimizations.set('hapticFeedback', enabled);
    }

    applyVisualEffectOptimizations(enabled) {
        const root = document.documentElement;
        
        // Toggle visual effects
        root.classList.toggle('visual-effects-disabled', !enabled);
        
        // Update CSS custom properties
        root.style.setProperty('--visual-effects-enabled', enabled ? '1' : '0');
        
        this.batteryOptimizations.set('visualEffects', enabled);
    }

    setupFallbackOptimization() {
        // Use time-based optimization when Battery API is not available
        const checkBatteryFallback = () => {
            const hour = new Date().getHours();
            
            // Assume lower battery during typical low-usage hours
            if (hour >= 22 || hour <= 6) {
                this.setOptimizationLevel('power-saver');
            } else {
                this.setOptimizationLevel('normal');
            }
        };
        
        // Check every 30 minutes
        setInterval(checkBatteryFallback, 30 * 60 * 1000);
        checkBatteryFallback(); // Initial check
    }

    setupVisibilityMonitoring() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // App is backgrounded - apply aggressive power saving
                this.applyBackgroundOptimizations();
            } else {
                // App is visible - restore normal optimizations
                this.restoreFromBackgroundOptimizations();
            }
        });
    }

    applyBackgroundOptimizations() {
        // Pause non-essential animations
        document.body.classList.add('app-backgrounded');
        
        // Reduce update frequencies
        this.emit('appBackgrounded', { 
            reduceUpdates: true,
            pauseAnimations: true 
        });
        
        console.log('Applied background power optimizations');
    }

    restoreFromBackgroundOptimizations() {
        // Restore animations
        document.body.classList.remove('app-backgrounded');
        
        // Restore update frequencies
        this.emit('appForegrounded', { 
            restoreUpdates: true,
            resumeAnimations: true 
        });
        
        console.log('Restored from background optimizations');
    }

    setupPerformanceMonitoring() {
        // Monitor frame rate and adjust optimizations accordingly
        let frameCount = 0;
        let lastFrameTime = performance.now();
        let lowFrameRateCount = 0;
        
        const monitorFrameRate = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastFrameTime;
            
            if (deltaTime > 0) {
                const fps = 1000 / deltaTime;
                frameCount++;
                
                // Track low frame rates
                if (fps < 45) {
                    lowFrameRateCount++;
                }
                
                // Check every 60 frames
                if (frameCount >= 60) {
                    const lowFrameRatePercentage = (lowFrameRateCount / frameCount) * 100;
                    
                    // If more than 20% of frames are low, apply performance optimizations
                    if (lowFrameRatePercentage > 20 && this.optimizationLevel === 'normal') {
                        console.log(`Low frame rate detected (${lowFrameRatePercentage.toFixed(1)}%) - applying performance optimizations`);
                        this.setOptimizationLevel('power-saver');
                    }
                    
                    // Reset counters
                    frameCount = 0;
                    lowFrameRateCount = 0;
                }
            }
            
            lastFrameTime = currentTime;
            requestAnimationFrame(monitorFrameRate);
        };
        
        requestAnimationFrame(monitorFrameRate);
    }

    showBatteryNotification(message) {
        // Emit notification event for UI to handle
        this.emit('batteryNotification', { 
            message: message,
            level: this.optimizationLevel,
            batteryLevel: Math.round(this.batteryLevel * 100)
        });
    }

    // Public API methods
    getBatteryLevel() {
        return this.batteryLevel;
    }

    isDeviceCharging() {
        return this.isCharging;
    }

    getOptimizationLevel() {
        return this.optimizationLevel;
    }

    getActiveOptimizations() {
        return new Map(this.batteryOptimizations);
    }

    forceOptimizationLevel(level) {
        if (this.optimizationStrategies[level]) {
            this.setOptimizationLevel(level);
            return true;
        }
        return false;
    }

    getBatteryInfo() {
        if (!this.batteryAPI) {
            return {
                supported: false,
                level: this.batteryLevel,
                charging: this.isCharging
            };
        }
        
        return {
            supported: true,
            level: this.batteryLevel,
            charging: this.isCharging,
            chargingTime: this.batteryAPI.chargingTime,
            dischargingTime: this.batteryAPI.dischargingTime
        };
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
                    console.error(`Error in battery optimizer callback for ${eventName}:`, error);
                }
            });
        }
    }

    destroy() {
        // Clean up event listeners
        if (this.batteryAPI) {
            this.batteryAPI.removeEventListener('levelchange', this.updateBatteryState);
            this.batteryAPI.removeEventListener('chargingchange', this.updateBatteryState);
            this.batteryAPI.removeEventListener('chargingtimechange', this.updateBatteryState);
            this.batteryAPI.removeEventListener('dischargingtimechange', this.updateBatteryState);
        }
        
        this.eventCallbacks.clear();
        this.batteryOptimizations.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileBatteryOptimizer;
} else if (typeof window !== 'undefined') {
    window.MobileBatteryOptimizer = MobileBatteryOptimizer;
}