/**
 * Mobile Optimization Manager
 * Task 14.2: Add mobile-specific optimizations - Integration component
 * 
 * Coordinates battery, network, and offline optimizations for optimal mobile experience
 * Requirements: 12.3, 12.4
 */

class MobileOptimizationManager {
    constructor() {
        this.batteryOptimizer = null;
        this.networkAwareFeatures = null;
        this.offlineCapability = null;
        
        this.isInitialized = false;
        this.optimizationState = {
            batteryLevel: 'normal',
            networkQuality: 'unknown',
            isOnline: true,
            dataUsage: 0,
            optimizationsActive: new Set()
        };
        
        this.eventCallbacks = new Map();
        this.performanceMetrics = {
            batteryOptimizations: 0,
            networkOptimizations: 0,
            offlineEvents: 0,
            dataBytesSaved: 0,
            performanceGains: []
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Mobile Optimization Manager...');
            
            // Initialize battery optimizer
            if (typeof MobileBatteryOptimizer !== 'undefined') {
                this.batteryOptimizer = new MobileBatteryOptimizer();
                this.setupBatteryOptimizationHandlers();
            }
            
            // Initialize network-aware features
            if (typeof MobileNetworkAwareFeatures !== 'undefined') {
                this.networkAwareFeatures = new MobileNetworkAwareFeatures();
                this.setupNetworkOptimizationHandlers();
            }
            
            // Initialize offline capability
            if (typeof MobileOfflineCapability !== 'undefined') {
                this.offlineCapability = new MobileOfflineCapability();
                this.setupOfflineCapabilityHandlers();
            }
            
            // Setup coordination between optimizers
            this.setupOptimizationCoordination();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Apply initial optimizations
            this.applyInitialOptimizations();
            
            this.isInitialized = true;
            console.log('Mobile Optimization Manager initialized successfully');
            
            this.emit('initialized', {
                batteryOptimizer: !!this.batteryOptimizer,
                networkAwareFeatures: !!this.networkAwareFeatures,
                offlineCapability: !!this.offlineCapability
            });
            
        } catch (error) {
            console.error('Failed to initialize Mobile Optimization Manager:', error);
            this.setupFallbackOptimizations();
        }
    }

    setupBatteryOptimizationHandlers() {
        if (!this.batteryOptimizer) return;
        
        // Battery state changes
        this.batteryOptimizer.on('batteryStateChanged', (data) => {
            this.optimizationState.batteryLevel = data.optimizationLevel;
            this.coordinateOptimizations('battery', data);
            this.performanceMetrics.batteryOptimizations++;
            
            this.emit('batteryOptimizationApplied', data);
        });
        
        // Optimization level changes
        this.batteryOptimizer.on('optimizationLevelChanged', (data) => {
            this.handleBatteryOptimizationChange(data);
        });
        
        // Battery notifications
        this.batteryOptimizer.on('batteryNotification', (data) => {
            this.showOptimizationNotification(data.message, 'battery');
        });
        
        // App backgrounding
        this.batteryOptimizer.on('appBackgrounded', (data) => {
            this.handleAppBackgrounding(data);
        });
        
        this.batteryOptimizer.on('appForegrounded', (data) => {
            this.handleAppForegrounding(data);
        });
    }

    setupNetworkOptimizationHandlers() {
        if (!this.networkAwareFeatures) return;
        
        // Network changes
        this.networkAwareFeatures.on('networkChanged', (data) => {
            this.optimizationState.networkQuality = data.quality;
            this.coordinateOptimizations('network', data);
            this.performanceMetrics.networkOptimizations++;
            
            this.emit('networkOptimizationApplied', data);
        });
        
        // Data usage tracking
        this.networkAwareFeatures.on('dataUsageTracked', (data) => {
            this.optimizationState.dataUsage += data.bytes;
            this.trackDataUsage(data);
        });
        
        // Data usage warnings
        this.networkAwareFeatures.on('dataUsageWarning', (data) => {
            this.handleDataUsageWarning(data);
        });
        
        // Connection quality changes
        this.networkAwareFeatures.on('connectionQualityMeasured', (data) => {
            this.handleConnectionQualityChange(data);
        });
        
        // Save data mode changes
        this.networkAwareFeatures.on('saveDataChanged', (data) => {
            this.handleSaveDataModeChange(data);
        });
    }

    setupOfflineCapabilityHandlers() {
        if (!this.offlineCapability) return;
        
        // Online/offline status changes
        this.offlineCapability.on('onlineStatusChanged', (data) => {
            this.optimizationState.isOnline = data.isOnline;
            this.coordinateOptimizations('offline', data);
            this.performanceMetrics.offlineEvents++;
            
            this.emit('offlineOptimizationApplied', data);
        });
        
        // Sync queue updates
        this.offlineCapability.on('syncQueueUpdated', (data) => {
            this.updateSyncQueueIndicator(data.queueLength);
        });
        
        // Offline data events
        this.offlineCapability.on('cameOnline', () => {
            this.handleCameOnline();
        });
        
        this.offlineCapability.on('wentOffline', () => {
            this.handleWentOffline();
        });
    }

    setupOptimizationCoordination() {
        // Coordinate optimizations between different systems
        this.coordinationRules = {
            // When battery is critical, override network optimizations
            batteryCritical: {
                priority: 1,
                overrides: ['network', 'offline'],
                optimizations: {
                    disableBackgroundSync: true,
                    reduceUpdateFrequency: 30000,
                    disableAnimations: true,
                    enableAggressiveCaching: true
                }
            },
            
            // When network is poor, coordinate with battery optimizations
            networkPoor: {
                priority: 2,
                coordinates: ['battery'],
                optimizations: {
                    enableDataSaver: true,
                    reduceImageQuality: true,
                    batchRequests: true,
                    enableCompression: true
                }
            },
            
            // When offline, coordinate with both battery and network
            offline: {
                priority: 3,
                coordinates: ['battery', 'network'],
                optimizations: {
                    enableOfflineMode: true,
                    pauseNonEssentialUpdates: true,
                    showOfflineIndicator: true,
                    queueActions: true
                }
            }
        };
    }

    coordinateOptimizations(source, data) {
        const currentState = this.optimizationState;
        
        // Determine which coordination rule to apply
        let activeRule = null;
        
        if (currentState.batteryLevel === 'critical') {
            activeRule = this.coordinationRules.batteryCritical;
        } else if (currentState.networkQuality === 'poor') {
            activeRule = this.coordinationRules.networkPoor;
        } else if (!currentState.isOnline) {
            activeRule = this.coordinationRules.offline;
        }
        
        if (activeRule) {
            this.applyCoordinatedOptimizations(activeRule, source, data);
        }
    }

    applyCoordinatedOptimizations(rule, source, data) {
        console.log(`Applying coordinated optimizations: ${rule.priority} priority from ${source}`);
        
        // Apply optimizations from the rule
        Object.entries(rule.optimizations).forEach(([optimization, value]) => {
            this.applySpecificOptimization(optimization, value, source);
        });
        
        // Track active optimizations
        Object.keys(rule.optimizations).forEach(opt => {
            this.optimizationState.optimizationsActive.add(opt);
        });
        
        this.emit('coordinatedOptimizationApplied', {
            rule: rule,
            source: source,
            data: data,
            activeOptimizations: Array.from(this.optimizationState.optimizationsActive)
        });
    }

    applySpecificOptimization(optimization, value, source) {
        switch (optimization) {
            case 'disableBackgroundSync':
                if (value && this.offlineCapability) {
                    // Disable background sync
                    this.emit('backgroundSyncDisabled', { source });
                }
                break;
                
            case 'reduceUpdateFrequency':
                this.emit('updateFrequencyChanged', { 
                    frequency: value, 
                    source: source 
                });
                break;
                
            case 'disableAnimations':
                if (value) {
                    document.body.classList.add('reduce-motion');
                } else {
                    document.body.classList.remove('reduce-motion');
                }
                break;
                
            case 'enableAggressiveCaching':
                if (value && this.offlineCapability) {
                    // Enable aggressive caching
                    this.emit('aggressiveCachingEnabled', { source });
                }
                break;
                
            case 'enableDataSaver':
                if (value) {
                    document.body.classList.add('data-saver-mode');
                } else {
                    document.body.classList.remove('data-saver-mode');
                }
                break;
                
            case 'reduceImageQuality':
                if (value) {
                    document.body.classList.add('image-quality-low');
                    document.body.classList.remove('image-quality-medium', 'image-quality-high');
                }
                break;
                
            case 'enableOfflineMode':
                if (value) {
                    document.body.classList.add('offline-mode');
                } else {
                    document.body.classList.remove('offline-mode');
                }
                break;
        }
    }

    setupPerformanceMonitoring() {
        // Monitor performance impact of optimizations
        let lastFrameTime = performance.now();
        let frameCount = 0;
        let performanceSamples = [];
        
        const monitorPerformance = () => {
            const currentTime = performance.now();
            const frameDuration = currentTime - lastFrameTime;
            
            performanceSamples.push(frameDuration);
            frameCount++;
            
            // Analyze performance every 60 frames
            if (frameCount >= 60) {
                const averageFrameTime = performanceSamples.reduce((sum, time) => sum + time, 0) / performanceSamples.length;
                const fps = 1000 / averageFrameTime;
                
                this.performanceMetrics.performanceGains.push({
                    timestamp: currentTime,
                    fps: fps,
                    averageFrameTime: averageFrameTime,
                    optimizationsActive: Array.from(this.optimizationState.optimizationsActive)
                });
                
                // Keep only last 10 samples
                if (this.performanceMetrics.performanceGains.length > 10) {
                    this.performanceMetrics.performanceGains = this.performanceMetrics.performanceGains.slice(-10);
                }
                
                // Reset counters
                frameCount = 0;
                performanceSamples = [];
                
                this.emit('performanceMetricsUpdated', {
                    fps: fps,
                    optimizationsActive: this.optimizationState.optimizationsActive.size
                });
            }
            
            lastFrameTime = currentTime;
            requestAnimationFrame(monitorPerformance);
        };
        
        requestAnimationFrame(monitorPerformance);
    }

    applyInitialOptimizations() {
        // Apply CSS for mobile optimizations
        this.loadOptimizationCSS();
        
        // Set initial optimization classes
        document.body.classList.add('mobile-optimizations-enabled');
        
        // Apply initial battery level class
        if (this.batteryOptimizer) {
            const batteryInfo = this.batteryOptimizer.getBatteryInfo();
            this.updateBatteryLevelClass(batteryInfo.level);
        }
        
        // Apply initial network quality class
        if (this.networkAwareFeatures) {
            const networkInfo = this.networkAwareFeatures.getNetworkInfo();
            this.updateNetworkQualityClass(networkInfo.quality);
        }
    }

    loadOptimizationCSS() {
        // Check if CSS is already loaded
        if (document.querySelector('#mobile-optimizations-css')) return;
        
        const link = document.createElement('link');
        link.id = 'mobile-optimizations-css';
        link.rel = 'stylesheet';
        link.href = '/css/mobile-optimizations.css';
        document.head.appendChild(link);
    }

    updateBatteryLevelClass(level) {
        const root = document.documentElement;
        
        // Remove previous battery classes
        root.classList.remove('battery-critical', 'battery-low', 'battery-normal');
        
        // Add current battery class
        if (level < 0.15) {
            root.classList.add('battery-critical');
        } else if (level < 0.30) {
            root.classList.add('battery-low');
        } else {
            root.classList.add('battery-normal');
        }
        
        // Update data attribute for debugging
        root.setAttribute('data-battery-level', Math.round(level * 100) + '%');
    }

    updateNetworkQualityClass(quality) {
        const root = document.documentElement;
        
        // Remove previous network classes
        root.classList.remove('network-poor', 'network-fair', 'network-good', 'network-unknown');
        
        // Add current network class
        root.classList.add(`network-${quality}`);
        
        // Update data attribute for debugging
        root.setAttribute('data-network-quality', quality);
    }

    // Event handlers
    handleBatteryOptimizationChange(data) {
        this.updateBatteryLevelClass(this.batteryOptimizer.getBatteryLevel());
        
        // Update optimization level indicator
        document.documentElement.setAttribute('data-optimization-level', data.newLevel);
        
        // Calculate estimated battery savings
        const savings = this.calculateBatterySavings(data.previousLevel, data.newLevel);
        if (savings > 0) {
            this.performanceMetrics.dataBytesSaved += savings;
        }
    }

    handleDataUsageWarning(data) {
        this.showOptimizationNotification(data.message, 'network', data.level);
        
        // Apply automatic data saving if usage is very high
        if (data.level === 'high') {
            this.applySpecificOptimization('enableDataSaver', true, 'auto');
        }
    }

    handleConnectionQualityChange(data) {
        this.updateNetworkQualityClass(data.quality);
        
        // Apply quality-based optimizations
        if (data.quality === 'poor' && data.averagePing > 1000) {
            this.applySpecificOptimization('reduceUpdateFrequency', 10000, 'network');
        }
    }

    handleSaveDataModeChange(data) {
        if (data.saveData) {
            this.applySpecificOptimization('enableDataSaver', true, 'user-preference');
        } else {
            this.applySpecificOptimization('enableDataSaver', false, 'user-preference');
        }
    }

    handleAppBackgrounding(data) {
        // Apply aggressive power saving when app is backgrounded
        this.applySpecificOptimization('disableAnimations', true, 'background');
        this.applySpecificOptimization('reduceUpdateFrequency', 30000, 'background');
        
        this.emit('appBackgroundOptimizationsApplied', data);
    }

    handleAppForegrounding(data) {
        // Restore normal optimizations when app is foregrounded
        this.applySpecificOptimization('disableAnimations', false, 'foreground');
        
        // Restore update frequency based on current conditions
        const frequency = this.calculateOptimalUpdateFrequency();
        this.applySpecificOptimization('reduceUpdateFrequency', frequency, 'foreground');
        
        this.emit('appForegroundOptimizationsApplied', data);
    }

    handleCameOnline() {
        this.applySpecificOptimization('enableOfflineMode', false, 'online');
        this.showOptimizationNotification('Connection restored - syncing data', 'offline');
    }

    handleWentOffline() {
        this.applySpecificOptimization('enableOfflineMode', true, 'offline');
        this.showOptimizationNotification('You\'re offline - changes will sync when connection is restored', 'offline');
    }

    updateSyncQueueIndicator(queueLength) {
        let indicator = document.querySelector('.sync-queue-indicator');
        
        if (queueLength > 0) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'sync-queue-indicator';
                document.body.appendChild(indicator);
            }
            
            indicator.innerHTML = `
                <i class="fas fa-sync-alt sync-spinner"></i>
                <span>${queueLength} pending</span>
            `;
            indicator.classList.add('visible');
        } else if (indicator) {
            indicator.classList.remove('visible');
        }
    }

    showOptimizationNotification(message, type, level = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `optimization-notification ${type} ${level}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type, level)};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10003;
            max-width: 300px;
            font-size: 0.875rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
    }

    getNotificationIcon(type) {
        const icons = {
            battery: 'battery-half',
            network: 'wifi',
            offline: 'wifi-slash',
            performance: 'tachometer-alt'
        };
        return icons[type] || 'info-circle';
    }

    getNotificationColor(type, level) {
        const colors = {
            battery: {
                info: '#3b82f6',
                moderate: '#f59e0b',
                high: '#ef4444'
            },
            network: {
                info: '#10b981',
                moderate: '#f59e0b',
                high: '#ef4444'
            },
            offline: {
                info: '#6b7280',
                moderate: '#f59e0b',
                high: '#ef4444'
            },
            performance: {
                info: '#8b5cf6',
                moderate: '#f59e0b',
                high: '#ef4444'
            }
        };
        
        return colors[type]?.[level] || '#6b7280';
    }

    calculateOptimalUpdateFrequency() {
        const state = this.optimizationState;
        
        // Base frequency
        let frequency = 1000;
        
        // Adjust for battery level
        if (state.batteryLevel === 'critical') {
            frequency = 30000;
        } else if (state.batteryLevel === 'power-saver') {
            frequency = 5000;
        }
        
        // Adjust for network quality
        if (state.networkQuality === 'poor') {
            frequency = Math.max(frequency, 10000);
        } else if (state.networkQuality === 'fair') {
            frequency = Math.max(frequency, 3000);
        }
        
        return frequency;
    }

    calculateBatterySavings(previousLevel, newLevel) {
        // Rough estimation of battery savings in mAh equivalent
        const savingsMap = {
            'normal': 0,
            'power-saver': 50,
            'critical': 150
        };
        
        const previousConsumption = savingsMap[previousLevel] || 0;
        const newConsumption = savingsMap[newLevel] || 0;
        
        return Math.max(0, previousConsumption - newConsumption);
    }

    setupFallbackOptimizations() {
        console.log('Setting up fallback optimizations');
        
        // Basic optimizations without advanced features
        this.loadOptimizationCSS();
        document.body.classList.add('mobile-optimizations-enabled', 'fallback-mode');
        
        // Basic battery optimization based on time
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 6) {
            document.body.classList.add('battery-low');
        }
        
        // Basic network optimization based on connection
        if (!navigator.onLine) {
            document.body.classList.add('offline-mode');
        }
    }

    // Public API methods
    getOptimizationState() {
        return {
            ...this.optimizationState,
            activeOptimizations: Array.from(this.optimizationState.optimizationsActive)
        };
    }

    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    forceOptimizationLevel(level) {
        if (this.batteryOptimizer) {
            return this.batteryOptimizer.forceOptimizationLevel(level);
        }
        return false;
    }

    resetOptimizations() {
        // Clear all optimization classes
        const root = document.documentElement;
        root.classList.remove(
            'battery-critical', 'battery-low', 'battery-normal',
            'network-poor', 'network-fair', 'network-good',
            'data-saver-mode', 'offline-mode', 'reduce-motion'
        );
        
        // Clear active optimizations
        this.optimizationState.optimizationsActive.clear();
        
        // Reapply initial optimizations
        this.applyInitialOptimizations();
        
        this.emit('optimizationsReset');
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
                    console.error(`Error in optimization manager callback for ${eventName}:`, error);
                }
            });
        }
    }

    destroy() {
        // Destroy sub-components
        if (this.batteryOptimizer) {
            this.batteryOptimizer.destroy();
        }
        
        if (this.networkAwareFeatures) {
            this.networkAwareFeatures.destroy();
        }
        
        if (this.offlineCapability) {
            this.offlineCapability.destroy();
        }
        
        // Remove CSS
        const cssLink = document.querySelector('#mobile-optimizations-css');
        if (cssLink) {
            cssLink.remove();
        }
        
        // Remove optimization classes
        document.body.classList.remove('mobile-optimizations-enabled', 'fallback-mode');
        
        // Clear callbacks
        this.eventCallbacks.clear();
        this.optimizationState.optimizationsActive.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileOptimizationManager;
} else if (typeof window !== 'undefined') {
    window.MobileOptimizationManager = MobileOptimizationManager;
}