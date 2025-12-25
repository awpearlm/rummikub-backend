/**
 * Mobile Networking Integration
 * Handles mobile-specific networking concerns and multiplayer connectivity
 * Ensures reliable connection management for mobile devices
 * Requirements: 15.2, 15.3, 15.4, 15.5
 */

class MobileNetworkingIntegration {
    constructor(socket, mobileUISystem) {
        this.socket = socket;
        this.mobileUISystem = mobileUISystem;
        
        this.isInitialized = false;
        this.connectionState = {
            isConnected: false,
            isReconnecting: false,
            reconnectAttempts: 0,
            maxReconnectAttempts: 10,
            reconnectDelay: 1000,
            lastPingTime: null,
            latency: null,
            networkQuality: 'unknown'
        };
        
        // Mobile-specific networking features
        this.mobileFeatures = {
            backgroundSync: true,
            offlineQueue: true,
            adaptiveQuality: true,
            batteryOptimization: true
        };
        
        // Offline action queue
        this.offlineQueue = [];
        
        // Network quality monitoring
        this.networkMonitor = null;
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup socket connection management
            this.setupSocketConnectionManagement();
            
            // Setup mobile-specific networking features
            this.setupMobileNetworkingFeatures();
            
            // Setup network quality monitoring
            this.setupNetworkQualityMonitoring();
            
            // Setup offline handling
            this.setupOfflineHandling();
            
            // Setup background sync
            this.setupBackgroundSync();
            
            // Setup battery optimization
            this.setupBatteryOptimization();
            
            this.isInitialized = true;
            console.log('Mobile Networking Integration initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Networking Integration:', error);
            throw error;
        }
    }

    setupSocketConnectionManagement() {
        // Enhanced connection event handling for mobile
        this.socket.on('connect', () => {
            this.handleConnect();
        });
        
        this.socket.on('disconnect', (reason) => {
            this.handleDisconnect(reason);
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            this.handleReconnect(attemptNumber);
        });
        
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            this.handleReconnectAttempt(attemptNumber);
        });
        
        this.socket.on('reconnect_error', (error) => {
            this.handleReconnectError(error);
        });
        
        this.socket.on('reconnect_failed', () => {
            this.handleReconnectFailed();
        });
        
        // Setup ping/pong for latency monitoring
        this.socket.on('ping', (timestamp) => {
            this.handlePing(timestamp);
        });
        
        this.socket.on('pong', (timestamp) => {
            this.handlePong(timestamp);
        });
        
        // Setup mobile-specific socket configuration
        this.configureMobileSocket();
    }

    configureMobileSocket() {
        // Configure socket.io for mobile optimization
        this.socket.io.opts.timeout = 10000; // 10 second timeout
        this.socket.io.opts.forceNew = false; // Reuse connections
        this.socket.io.opts.transports = ['websocket', 'polling']; // Fallback transports
        
        // Mobile-specific transport configuration
        if (this.isMobileDevice()) {
            // Prefer polling on mobile for better reliability
            this.socket.io.opts.transports = ['polling', 'websocket'];
            
            // Increase timeout for mobile networks
            this.socket.io.opts.timeout = 15000;
        }
    }

    setupMobileNetworkingFeatures() {
        // Setup adaptive quality based on network conditions
        if (this.mobileFeatures.adaptiveQuality) {
            this.setupAdaptiveQuality();
        }
        
        // Setup offline queue for actions
        if (this.mobileFeatures.offlineQueue) {
            this.setupOfflineQueue();
        }
    }

    setupNetworkQualityMonitoring() {
        // Monitor network connection quality
        if ('connection' in navigator) {
            this.networkMonitor = navigator.connection;
            
            // Listen for network changes
            this.networkMonitor.addEventListener('change', () => {
                this.handleNetworkChange();
            });
            
            // Initial network quality assessment
            this.assessNetworkQuality();
        }
        
        // Setup periodic latency monitoring
        this.startLatencyMonitoring();
    }

    setupOfflineHandling() {
        // Handle online/offline events
        window.addEventListener('online', () => {
            this.handleOnline();
        });
        
        window.addEventListener('offline', () => {
            this.handleOffline();
        });
        
        // Check initial online status
        if (!navigator.onLine) {
            this.handleOffline();
        }
    }

    setupBackgroundSync() {
        if (!this.mobileFeatures.backgroundSync) return;
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handleAppVisible();
            } else {
                this.handleAppHidden();
            }
        });
        
        // Handle app focus/blur
        window.addEventListener('focus', () => {
            this.handleAppFocus();
        });
        
        window.addEventListener('blur', () => {
            this.handleAppBlur();
        });
    }

    setupBatteryOptimization() {
        if (!this.mobileFeatures.batteryOptimization) return;
        
        // Monitor battery status if available
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                this.handleBatteryStatus(battery);
                
                // Listen for battery changes
                battery.addEventListener('levelchange', () => {
                    this.handleBatteryStatus(battery);
                });
                
                battery.addEventListener('chargingchange', () => {
                    this.handleBatteryStatus(battery);
                });
            });
        }
    }

    setupAdaptiveQuality() {
        // Adjust quality based on network conditions
        this.on('networkQualityChanged', (quality) => {
            this.adjustQualityForNetwork(quality);
        });
    }

    setupOfflineQueue() {
        // Queue actions when offline
        this.offlineQueue = [];
        
        // Process queue when coming back online
        this.on('connectionRestored', () => {
            this.processOfflineQueue();
        });
    }

    startLatencyMonitoring() {
        // Send periodic pings to measure latency
        setInterval(() => {
            if (this.connectionState.isConnected) {
                this.measureLatency();
            }
        }, 30000); // Every 30 seconds
    }

    // Connection event handlers
    handleConnect() {
        this.connectionState.isConnected = true;
        this.connectionState.isReconnecting = false;
        this.connectionState.reconnectAttempts = 0;
        
        // Update UI
        this.updateConnectionStatus('connected');
        
        // Process offline queue
        this.processOfflineQueue();
        
        // Emit connection restored event
        this.emit('connectionRestored');
        
        console.log('Mobile Networking: Connected to server');
    }

    handleDisconnect(reason) {
        this.connectionState.isConnected = false;
        
        // Update UI
        this.updateConnectionStatus('disconnected');
        
        // Show mobile-friendly disconnect message
        this.showConnectionMessage('Connection lost', 'Attempting to reconnect...', 'warning');
        
        // Start reconnection process if not intentional
        if (reason !== 'io client disconnect') {
            this.startReconnectionProcess();
        }
        
        console.log('Mobile Networking: Disconnected from server', { reason });
    }

    handleReconnect(attemptNumber) {
        this.connectionState.isReconnecting = false;
        this.connectionState.reconnectAttempts = attemptNumber;
        
        // Update UI
        this.updateConnectionStatus('connected');
        
        // Show reconnection success
        this.showConnectionMessage('Reconnected', 'Connection restored!', 'success');
        
        console.log('Mobile Networking: Reconnected after', attemptNumber, 'attempts');
    }

    handleReconnectAttempt(attemptNumber) {
        this.connectionState.isReconnecting = true;
        this.connectionState.reconnectAttempts = attemptNumber;
        
        // Update UI with attempt number
        this.updateConnectionStatus('reconnecting');
        this.showConnectionMessage('Reconnecting', `Attempt ${attemptNumber}...`, 'info');
        
        console.log('Mobile Networking: Reconnection attempt', attemptNumber);
    }

    handleReconnectError(error) {
        console.error('Mobile Networking: Reconnection error', error);
        
        // Show error message
        this.showConnectionMessage('Connection Error', 'Retrying...', 'error');
    }

    handleReconnectFailed() {
        this.connectionState.isReconnecting = false;
        
        // Update UI
        this.updateConnectionStatus('failed');
        
        // Show failure message with manual retry option
        this.showConnectionMessage('Connection Failed', 'Tap to retry', 'error', () => {
            this.manualReconnect();
        });
        
        console.error('Mobile Networking: Reconnection failed');
    }

    handlePing(timestamp) {
        this.connectionState.lastPingTime = timestamp;
        
        // Send pong response
        this.socket.emit('pong', timestamp);
    }

    handlePong(timestamp) {
        if (this.connectionState.lastPingTime === timestamp) {
            // Calculate latency
            this.connectionState.latency = Date.now() - timestamp;
            
            // Update network quality based on latency
            this.updateNetworkQualityFromLatency(this.connectionState.latency);
            
            console.log('Mobile Networking: Latency', this.connectionState.latency, 'ms');
        }
    }

    // Network quality monitoring
    handleNetworkChange() {
        if (!this.networkMonitor) return;
        
        const connection = this.networkMonitor;
        const networkInfo = {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
        };
        
        // Assess network quality
        this.assessNetworkQuality(networkInfo);
        
        // Emit network change event
        this.emit('networkChanged', networkInfo);
        
        console.log('Mobile Networking: Network changed', networkInfo);
    }

    assessNetworkQuality(networkInfo = null) {
        if (!networkInfo && this.networkMonitor) {
            networkInfo = {
                effectiveType: this.networkMonitor.effectiveType,
                downlink: this.networkMonitor.downlink,
                rtt: this.networkMonitor.rtt,
                saveData: this.networkMonitor.saveData
            };
        }
        
        let quality = 'unknown';
        
        if (networkInfo) {
            // Determine quality based on effective type and metrics
            switch (networkInfo.effectiveType) {
                case 'slow-2g':
                    quality = 'poor';
                    break;
                case '2g':
                    quality = 'poor';
                    break;
                case '3g':
                    quality = 'fair';
                    break;
                case '4g':
                    quality = 'good';
                    break;
                default:
                    // Use RTT and downlink for assessment
                    if (networkInfo.rtt > 1000 || networkInfo.downlink < 0.5) {
                        quality = 'poor';
                    } else if (networkInfo.rtt > 500 || networkInfo.downlink < 2) {
                        quality = 'fair';
                    } else {
                        quality = 'good';
                    }
            }
        }
        
        if (quality !== this.connectionState.networkQuality) {
            this.connectionState.networkQuality = quality;
            this.emit('networkQualityChanged', quality);
        }
    }

    updateNetworkQualityFromLatency(latency) {
        let quality = 'good';
        
        if (latency > 500) {
            quality = 'poor';
        } else if (latency > 200) {
            quality = 'fair';
        }
        
        if (quality !== this.connectionState.networkQuality) {
            this.connectionState.networkQuality = quality;
            this.emit('networkQualityChanged', quality);
        }
    }

    measureLatency() {
        const timestamp = Date.now();
        this.connectionState.lastPingTime = timestamp;
        this.socket.emit('ping', timestamp);
    }

    // Offline handling
    handleOnline() {
        console.log('Mobile Networking: Device came online');
        
        // Attempt to reconnect if not connected
        if (!this.connectionState.isConnected) {
            this.socket.connect();
        }
        
        // Show online message
        this.showConnectionMessage('Online', 'Connection restored', 'success');
        
        // Emit online event
        this.emit('online');
    }

    handleOffline() {
        console.log('Mobile Networking: Device went offline');
        
        // Update connection state
        this.connectionState.isConnected = false;
        
        // Update UI
        this.updateConnectionStatus('offline');
        
        // Show offline message
        this.showConnectionMessage('Offline', 'No internet connection', 'error');
        
        // Emit offline event
        this.emit('offline');
    }

    // Background sync handling
    handleAppVisible() {
        console.log('Mobile Networking: App became visible');
        
        // Reconnect if needed
        if (!this.connectionState.isConnected && navigator.onLine) {
            this.socket.connect();
        }
        
        // Resume normal operation
        this.resumeNormalOperation();
        
        // Emit app visible event
        this.emit('appVisible');
    }

    handleAppHidden() {
        console.log('Mobile Networking: App hidden');
        
        // Reduce activity to save battery
        this.reduceBackgroundActivity();
        
        // Emit app hidden event
        this.emit('appHidden');
    }

    handleAppFocus() {
        console.log('Mobile Networking: App focused');
        
        // Resume full activity
        this.resumeNormalOperation();
        
        // Emit app focus event
        this.emit('appFocused');
    }

    handleAppBlur() {
        console.log('Mobile Networking: App blurred');
        
        // Reduce activity
        this.reduceBackgroundActivity();
        
        // Emit app blur event
        this.emit('appBlurred');
    }

    // Battery optimization
    handleBatteryStatus(battery) {
        const batteryInfo = {
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
        };
        
        // Adjust behavior based on battery level
        if (battery.level < 0.2 && !battery.charging) {
            // Low battery - enable power saving mode
            this.enablePowerSavingMode();
        } else if (battery.level > 0.5 || battery.charging) {
            // Good battery - disable power saving mode
            this.disablePowerSavingMode();
        }
        
        // Emit battery status event
        this.emit('batteryStatusChanged', batteryInfo);
        
        console.log('Mobile Networking: Battery status', batteryInfo);
    }

    // Quality adjustment
    adjustQualityForNetwork(quality) {
        console.log('Mobile Networking: Adjusting quality for', quality, 'network');
        
        switch (quality) {
            case 'poor':
                // Reduce update frequency, disable animations
                this.applyLowQualitySettings();
                break;
            case 'fair':
                // Moderate quality settings
                this.applyMediumQualitySettings();
                break;
            case 'good':
                // Full quality settings
                this.applyHighQualitySettings();
                break;
        }
        
        // Notify mobile UI system
        this.mobileUISystem.emit('networkQualityChanged', quality);
    }

    applyLowQualitySettings() {
        // Reduce animation quality
        const animationManager = this.mobileUISystem.getComponent('animationPerformanceManager');
        if (animationManager) {
            animationManager.setQualityLevel('low');
        }
        
        // Increase update intervals
        this.setUpdateInterval('slow');
        
        // Show quality indicator
        this.showConnectionMessage('Slow Connection', 'Reduced quality mode', 'warning');
    }

    applyMediumQualitySettings() {
        // Medium animation quality
        const animationManager = this.mobileUISystem.getComponent('animationPerformanceManager');
        if (animationManager) {
            animationManager.setQualityLevel('medium');
        }
        
        // Normal update intervals
        this.setUpdateInterval('normal');
    }

    applyHighQualitySettings() {
        // High animation quality
        const animationManager = this.mobileUISystem.getComponent('animationPerformanceManager');
        if (animationManager) {
            animationManager.setQualityLevel('high');
        }
        
        // Fast update intervals
        this.setUpdateInterval('fast');
    }

    // Offline queue management
    queueAction(action, data) {
        if (!this.mobileFeatures.offlineQueue) return false;
        
        this.offlineQueue.push({
            action,
            data,
            timestamp: Date.now()
        });
        
        console.log('Mobile Networking: Queued offline action', action);
        return true;
    }

    processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        console.log('Mobile Networking: Processing', this.offlineQueue.length, 'offline actions');
        
        // Process queued actions
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        
        queue.forEach(item => {
            try {
                // Emit the queued action
                this.socket.emit(item.action, item.data);
            } catch (error) {
                console.error('Mobile Networking: Error processing offline action', error);
                // Re-queue failed actions
                this.offlineQueue.push(item);
            }
        });
        
        if (this.offlineQueue.length > 0) {
            console.log('Mobile Networking:', this.offlineQueue.length, 'actions re-queued');
        }
    }

    // Power management
    enablePowerSavingMode() {
        console.log('Mobile Networking: Enabling power saving mode');
        
        // Reduce update frequency
        this.setUpdateInterval('slow');
        
        // Reduce animation quality
        const animationManager = this.mobileUISystem.getComponent('animationPerformanceManager');
        if (animationManager) {
            animationManager.enablePowerSaving();
        }
        
        // Show power saving indicator
        this.showConnectionMessage('Power Saving', 'Low battery mode enabled', 'info');
        
        // Emit power saving event
        this.emit('powerSavingEnabled');
    }

    disablePowerSavingMode() {
        console.log('Mobile Networking: Disabling power saving mode');
        
        // Restore normal update frequency
        this.setUpdateInterval('normal');
        
        // Restore animation quality
        const animationManager = this.mobileUISystem.getComponent('animationPerformanceManager');
        if (animationManager) {
            animationManager.disablePowerSaving();
        }
        
        // Emit power saving event
        this.emit('powerSavingDisabled');
    }

    reduceBackgroundActivity() {
        // Reduce network activity when app is in background
        this.setUpdateInterval('slow');
        
        // Pause non-essential features
        this.emit('backgroundMode', true);
    }

    resumeNormalOperation() {
        // Resume normal network activity
        this.setUpdateInterval('normal');
        
        // Resume all features
        this.emit('backgroundMode', false);
    }

    // Utility methods
    setUpdateInterval(speed) {
        const intervals = {
            slow: 10000,   // 10 seconds
            normal: 5000,  // 5 seconds
            fast: 2000     // 2 seconds
        };
        
        const interval = intervals[speed] || intervals.normal;
        
        // Emit update interval change
        this.emit('updateIntervalChanged', interval);
    }

    startReconnectionProcess() {
        if (this.connectionState.isReconnecting) return;
        
        this.connectionState.isReconnecting = true;
        
        // Use exponential backoff for reconnection
        const delay = Math.min(
            this.connectionState.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts),
            30000 // Max 30 seconds
        );
        
        setTimeout(() => {
            if (this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
                this.socket.connect();
            } else {
                this.handleReconnectFailed();
            }
        }, delay);
    }

    manualReconnect() {
        // Reset reconnection state
        this.connectionState.reconnectAttempts = 0;
        this.connectionState.isReconnecting = false;
        
        // Attempt to reconnect
        this.socket.connect();
        
        // Show attempting message
        this.showConnectionMessage('Reconnecting', 'Attempting to reconnect...', 'info');
    }

    updateConnectionStatus(status) {
        // Update connection status in mobile UI
        const statusMap = {
            connected: { color: '#10b981', icon: 'fas fa-circle' },
            disconnected: { color: '#ef4444', icon: 'fas fa-circle' },
            reconnecting: { color: '#f59e0b', icon: 'fas fa-spinner fa-spin' },
            offline: { color: '#6b7280', icon: 'fas fa-circle' },
            failed: { color: '#ef4444', icon: 'fas fa-exclamation-triangle' }
        };
        
        const statusInfo = statusMap[status] || statusMap.disconnected;
        
        // Emit status change event
        this.emit('connectionStatusChanged', { status, ...statusInfo });
    }

    showConnectionMessage(title, message, type, onClick = null) {
        // Create mobile-friendly connection message
        const notification = document.createElement('div');
        notification.className = `mobile-connection-notification mobile-notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;
        
        if (onClick) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', onClick);
        }
        
        // Add to document
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds (unless it's an error with click handler)
        if (type !== 'error' || !onClick) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }

    // Public API
    getConnectionState() {
        return { ...this.connectionState };
    }

    isConnected() {
        return this.connectionState.isConnected;
    }

    getLatency() {
        return this.connectionState.latency;
    }

    getNetworkQuality() {
        return this.connectionState.networkQuality;
    }

    // Send action with offline queue support
    sendAction(action, data) {
        if (this.connectionState.isConnected) {
            this.socket.emit(action, data);
            return true;
        } else {
            return this.queueAction(action, data);
        }
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
        // Clear intervals and timeouts
        if (this.latencyInterval) {
            clearInterval(this.latencyInterval);
        }
        
        // Remove event listeners
        if (this.networkMonitor) {
            this.networkMonitor.removeEventListener('change', this.handleNetworkChange);
        }
        
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        document.removeEventListener('visibilitychange', this.handleAppVisible);
        window.removeEventListener('focus', this.handleAppFocus);
        window.removeEventListener('blur', this.handleAppBlur);
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Clear offline queue
        this.offlineQueue = [];
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileNetworkingIntegration;
} else if (typeof window !== 'undefined') {
    window.MobileNetworkingIntegration = MobileNetworkingIntegration;
}