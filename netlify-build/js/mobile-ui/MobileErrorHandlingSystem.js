/**
 * Mobile Error Handling System
 * Provides comprehensive error handling for mobile-specific scenarios
 * Handles network issues, game errors, validation errors, and recovery
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

class MobileErrorHandlingSystem {
    constructor(mobileUISystem, notificationSystem, hapticSystem) {
        this.mobileUISystem = mobileUISystem;
        this.notificationSystem = notificationSystem;
        this.hapticSystem = hapticSystem;
        
        this.isInitialized = false;
        this.errorHistory = [];
        this.maxErrorHistory = 50;
        
        // Error categories
        this.errorCategories = {
            NETWORK: 'network',
            GAME: 'game',
            VALIDATION: 'validation',
            UI: 'ui',
            SYSTEM: 'system',
            PERMISSION: 'permission',
            STORAGE: 'storage',
            PERFORMANCE: 'performance'
        };
        
        // Error severity levels
        this.severityLevels = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };
        
        // Error handling strategies
        this.handlingStrategies = {
            RETRY: 'retry',
            FALLBACK: 'fallback',
            RECOVER: 'recover',
            NOTIFY: 'notify',
            IGNORE: 'ignore'
        };
        
        // Error configuration
        this.errorConfig = {
            [this.errorCategories.NETWORK]: {
                maxRetries: 3,
                retryDelay: 1000,
                strategy: this.handlingStrategies.RETRY,
                severity: this.severityLevels.HIGH,
                showNotification: true,
                triggerHaptic: true,
                logToConsole: true
            },
            [this.errorCategories.GAME]: {
                maxRetries: 1,
                retryDelay: 500,
                strategy: this.handlingStrategies.NOTIFY,
                severity: this.severityLevels.MEDIUM,
                showNotification: true,
                triggerHaptic: true,
                logToConsole: true
            },
            [this.errorCategories.VALIDATION]: {
                maxRetries: 0,
                retryDelay: 0,
                strategy: this.handlingStrategies.NOTIFY,
                severity: this.severityLevels.LOW,
                showNotification: true,
                triggerHaptic: true,
                logToConsole: false
            },
            [this.errorCategories.UI]: {
                maxRetries: 2,
                retryDelay: 200,
                strategy: this.handlingStrategies.RECOVER,
                severity: this.severityLevels.MEDIUM,
                showNotification: false,
                triggerHaptic: false,
                logToConsole: true
            },
            [this.errorCategories.SYSTEM]: {
                maxRetries: 0,
                retryDelay: 0,
                strategy: this.handlingStrategies.FALLBACK,
                severity: this.severityLevels.CRITICAL,
                showNotification: true,
                triggerHaptic: true,
                logToConsole: true
            },
            [this.errorCategories.PERMISSION]: {
                maxRetries: 0,
                retryDelay: 0,
                strategy: this.handlingStrategies.NOTIFY,
                severity: this.severityLevels.HIGH,
                showNotification: true,
                triggerHaptic: false,
                logToConsole: true
            },
            [this.errorCategories.STORAGE]: {
                maxRetries: 2,
                retryDelay: 100,
                strategy: this.handlingStrategies.FALLBACK,
                severity: this.severityLevels.MEDIUM,
                showNotification: true,
                triggerHaptic: false,
                logToConsole: true
            },
            [this.errorCategories.PERFORMANCE]: {
                maxRetries: 0,
                retryDelay: 0,
                strategy: this.handlingStrategies.RECOVER,
                severity: this.severityLevels.LOW,
                showNotification: false,
                triggerHaptic: false,
                logToConsole: true
            }
        };
        
        // Active error handlers
        this.activeHandlers = new Map();
        
        // Recovery strategies
        this.recoveryStrategies = new Map();
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup global error handlers
            this.setupGlobalErrorHandlers();
            
            // Setup recovery strategies
            this.setupRecoveryStrategies();
            
            // Setup error monitoring
            this.setupErrorMonitoring();
            
            // Setup network error handling
            this.setupNetworkErrorHandling();
            
            // Setup storage error handling
            this.setupStorageErrorHandling();
            
            this.isInitialized = true;
            console.log('Mobile Error Handling System initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Error Handling System:', error);
            throw error;
        }
    }

    setupGlobalErrorHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                category: this.errorCategories.SYSTEM,
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error,
                context: 'global'
            });
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                category: this.errorCategories.SYSTEM,
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason,
                context: 'promise'
            });
        });
        
        // Handle network errors
        window.addEventListener('offline', () => {
            this.handleNetworkError({
                type: 'offline',
                message: 'Device went offline'
            });
        });
        
        window.addEventListener('online', () => {
            this.handleNetworkRecovery();
        });
    }

    setupRecoveryStrategies() {
        // Network recovery
        this.recoveryStrategies.set(this.errorCategories.NETWORK, {
            checkConnection: () => navigator.onLine,
            reconnect: () => this.attemptReconnection(),
            fallbackMode: () => this.enableOfflineMode()
        });
        
        // Game recovery
        this.recoveryStrategies.set(this.errorCategories.GAME, {
            refreshGameState: () => this.refreshGameState(),
            rejoinGame: () => this.rejoinCurrentGame(),
            returnToLobby: () => this.returnToLobby()
        });
        
        // UI recovery
        this.recoveryStrategies.set(this.errorCategories.UI, {
            refreshScreen: () => this.refreshCurrentScreen(),
            resetOrientation: () => this.resetOrientation(),
            clearCache: () => this.clearUICache()
        });
        
        // Storage recovery
        this.recoveryStrategies.set(this.errorCategories.STORAGE, {
            clearStorage: () => this.clearCorruptedStorage(),
            useMemoryFallback: () => this.useMemoryStorage(),
            resetSettings: () => this.resetToDefaultSettings()
        });
    }

    setupErrorMonitoring() {
        // Monitor performance issues
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach(entry => {
                        if (entry.duration > 100) { // Long tasks
                            this.handleError({
                                category: this.errorCategories.PERFORMANCE,
                                message: `Long task detected: ${entry.duration}ms`,
                                context: 'performance',
                                severity: this.severityLevels.LOW
                            });
                        }
                    });
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('Performance monitoring not available:', error);
            }
        }
        
        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
                
                if (usageRatio > 0.9) {
                    this.handleError({
                        category: this.errorCategories.PERFORMANCE,
                        message: `High memory usage: ${Math.round(usageRatio * 100)}%`,
                        context: 'memory',
                        severity: this.severityLevels.HIGH
                    });
                }
            }, 30000); // Check every 30 seconds
        }
    }

    setupNetworkErrorHandling() {
        // Monitor connection quality
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            connection.addEventListener('change', () => {
                if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                    this.handleError({
                        category: this.errorCategories.NETWORK,
                        message: 'Slow network connection detected',
                        context: 'connection-quality',
                        severity: this.severityLevels.MEDIUM
                    });
                }
            });
        }
    }

    setupStorageErrorHandling() {
        // Test localStorage availability
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
        } catch (error) {
            this.handleError({
                category: this.errorCategories.STORAGE,
                message: 'localStorage not available',
                error: error,
                context: 'storage-test',
                severity: this.severityLevels.HIGH
            });
        }
    }

    // Public API methods
    handleError(errorInfo) {
        const error = this.normalizeError(errorInfo);
        
        // Add to error history
        this.addToErrorHistory(error);
        
        // Get error configuration
        const config = this.errorConfig[error.category] || this.errorConfig[this.errorCategories.SYSTEM];
        
        // Log error if configured
        if (config.logToConsole) {
            this.logError(error);
        }
        
        // Show notification if configured
        if (config.showNotification) {
            this.showErrorNotification(error);
        }
        
        // Trigger haptic feedback if configured
        if (config.triggerHaptic && this.hapticSystem) {
            this.triggerErrorHaptic(error);
        }
        
        // Execute handling strategy
        this.executeHandlingStrategy(error, config);
        
        // Emit error event
        this.emit('error', error);
        
        return error.id;
    }

    handleNetworkError(networkError) {
        return this.handleError({
            category: this.errorCategories.NETWORK,
            message: networkError.message || 'Network error occurred',
            type: networkError.type || 'unknown',
            context: 'network',
            severity: this.severityLevels.HIGH
        });
    }

    handleGameError(gameError) {
        return this.handleError({
            category: this.errorCategories.GAME,
            message: gameError.message || 'Game error occurred',
            type: gameError.type || 'unknown',
            context: 'game',
            severity: this.severityLevels.MEDIUM
        });
    }

    handleValidationError(validationError) {
        return this.handleError({
            category: this.errorCategories.VALIDATION,
            message: validationError.message || 'Validation error occurred',
            field: validationError.field,
            value: validationError.value,
            context: 'validation',
            severity: this.severityLevels.LOW
        });
    }

    handleUIError(uiError) {
        return this.handleError({
            category: this.errorCategories.UI,
            message: uiError.message || 'UI error occurred',
            component: uiError.component,
            action: uiError.action,
            context: 'ui',
            severity: this.severityLevels.MEDIUM
        });
    }

    handlePermissionError(permissionError) {
        return this.handleError({
            category: this.errorCategories.PERMISSION,
            message: permissionError.message || 'Permission error occurred',
            permission: permissionError.permission,
            context: 'permission',
            severity: this.severityLevels.HIGH
        });
    }

    handleStorageError(storageError) {
        return this.handleError({
            category: this.errorCategories.STORAGE,
            message: storageError.message || 'Storage error occurred',
            operation: storageError.operation,
            key: storageError.key,
            context: 'storage',
            severity: this.severityLevels.MEDIUM
        });
    }

    // Internal methods
    normalizeError(errorInfo) {
        const error = {
            id: this.generateErrorId(),
            timestamp: Date.now(),
            category: errorInfo.category || this.errorCategories.SYSTEM,
            message: errorInfo.message || 'Unknown error',
            severity: errorInfo.severity || this.severityLevels.MEDIUM,
            context: errorInfo.context || 'unknown',
            retryCount: 0,
            resolved: false,
            ...errorInfo
        };
        
        return error;
    }

    addToErrorHistory(error) {
        this.errorHistory.unshift(error);
        
        // Limit history size
        if (this.errorHistory.length > this.maxErrorHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.maxErrorHistory);
        }
    }

    logError(error) {
        const logLevel = this.getLogLevel(error.severity);
        const message = `[Mobile Error] ${error.category.toUpperCase()}: ${error.message}`;
        
        console[logLevel](message, {
            id: error.id,
            category: error.category,
            severity: error.severity,
            context: error.context,
            timestamp: new Date(error.timestamp).toISOString(),
            error: error.error
        });
    }

    getLogLevel(severity) {
        switch (severity) {
            case this.severityLevels.CRITICAL:
                return 'error';
            case this.severityLevels.HIGH:
                return 'error';
            case this.severityLevels.MEDIUM:
                return 'warn';
            case this.severityLevels.LOW:
                return 'info';
            default:
                return 'log';
        }
    }

    showErrorNotification(error) {
        if (!this.notificationSystem) return;
        
        const title = this.getErrorTitle(error);
        const message = this.getErrorMessage(error);
        const type = this.getNotificationType(error.severity);
        
        this.notificationSystem.show(title, message, type, {
            persistent: error.severity === this.severityLevels.CRITICAL
        });
    }

    getErrorTitle(error) {
        const titles = {
            [this.errorCategories.NETWORK]: 'Connection Issue',
            [this.errorCategories.GAME]: 'Game Error',
            [this.errorCategories.VALIDATION]: 'Invalid Input',
            [this.errorCategories.UI]: 'Display Issue',
            [this.errorCategories.SYSTEM]: 'System Error',
            [this.errorCategories.PERMISSION]: 'Permission Required',
            [this.errorCategories.STORAGE]: 'Storage Issue',
            [this.errorCategories.PERFORMANCE]: 'Performance Warning'
        };
        
        return titles[error.category] || 'Error';
    }

    getErrorMessage(error) {
        // Provide user-friendly error messages
        const friendlyMessages = {
            'Network error occurred': 'Please check your internet connection',
            'Game error occurred': 'Something went wrong with the game',
            'Validation error occurred': 'Please check your input',
            'UI error occurred': 'Display issue detected',
            'Permission error occurred': 'Permission is required for this feature',
            'Storage error occurred': 'Unable to save data',
            'Device went offline': 'You are now offline'
        };
        
        return friendlyMessages[error.message] || error.message;
    }

    getNotificationType(severity) {
        switch (severity) {
            case this.severityLevels.CRITICAL:
                return 'error';
            case this.severityLevels.HIGH:
                return 'error';
            case this.severityLevels.MEDIUM:
                return 'warning';
            case this.severityLevels.LOW:
                return 'info';
            default:
                return 'info';
        }
    }

    triggerErrorHaptic(error) {
        if (!this.hapticSystem) return;
        
        switch (error.severity) {
            case this.severityLevels.CRITICAL:
                this.hapticSystem.error();
                break;
            case this.severityLevels.HIGH:
                this.hapticSystem.error();
                break;
            case this.severityLevels.MEDIUM:
                this.hapticSystem.warning();
                break;
            case this.severityLevels.LOW:
                this.hapticSystem.subtle();
                break;
        }
    }

    executeHandlingStrategy(error, config) {
        switch (config.strategy) {
            case this.handlingStrategies.RETRY:
                this.executeRetryStrategy(error, config);
                break;
            case this.handlingStrategies.FALLBACK:
                this.executeFallbackStrategy(error);
                break;
            case this.handlingStrategies.RECOVER:
                this.executeRecoveryStrategy(error);
                break;
            case this.handlingStrategies.NOTIFY:
                // Already handled by notification system
                break;
            case this.handlingStrategies.IGNORE:
                // Do nothing
                break;
        }
    }

    executeRetryStrategy(error, config) {
        if (error.retryCount >= config.maxRetries) {
            // Max retries reached, try fallback
            this.executeFallbackStrategy(error);
            return;
        }
        
        error.retryCount++;
        
        setTimeout(() => {
            this.emit('retry', error);
        }, config.retryDelay * error.retryCount);
    }

    executeFallbackStrategy(error) {
        const recoveryStrategy = this.recoveryStrategies.get(error.category);
        if (recoveryStrategy) {
            // Try each recovery method
            Object.values(recoveryStrategy).forEach(method => {
                try {
                    method();
                } catch (recoveryError) {
                    console.warn('Recovery method failed:', recoveryError);
                }
            });
        }
        
        this.emit('fallback', error);
    }

    executeRecoveryStrategy(error) {
        const recoveryStrategy = this.recoveryStrategies.get(error.category);
        if (recoveryStrategy) {
            // Try the most appropriate recovery method
            try {
                if (error.context === 'performance' && recoveryStrategy.clearCache) {
                    recoveryStrategy.clearCache();
                } else if (error.context === 'ui' && recoveryStrategy.refreshScreen) {
                    recoveryStrategy.refreshScreen();
                } else {
                    // Try the first available method
                    const methods = Object.values(recoveryStrategy);
                    if (methods.length > 0) {
                        methods[0]();
                    }
                }
            } catch (recoveryError) {
                console.warn('Recovery strategy failed:', recoveryError);
            }
        }
        
        this.emit('recovery', error);
    }

    // Recovery methods
    attemptReconnection() {
        if (this.mobileUISystem && this.mobileUISystem.gameClient) {
            try {
                this.mobileUISystem.gameClient.socket.connect();
                return true;
            } catch (error) {
                console.warn('Reconnection attempt failed:', error);
                return false;
            }
        }
        return false;
    }

    enableOfflineMode() {
        // Enable offline mode functionality
        this.emit('offlineMode', true);
        
        if (this.notificationSystem) {
            this.notificationSystem.showInfo('Offline mode enabled');
        }
    }

    refreshGameState() {
        if (this.mobileUISystem && this.mobileUISystem.gameClient) {
            try {
                this.mobileUISystem.gameClient.socket.emit('getGameState');
                return true;
            } catch (error) {
                console.warn('Failed to refresh game state:', error);
                return false;
            }
        }
        return false;
    }

    rejoinCurrentGame() {
        // Attempt to rejoin the current game
        this.emit('rejoinGame');
    }

    returnToLobby() {
        if (this.mobileUISystem) {
            try {
                this.mobileUISystem.navigateToLobby();
                return true;
            } catch (error) {
                console.warn('Failed to return to lobby:', error);
                return false;
            }
        }
        return false;
    }

    refreshCurrentScreen() {
        if (this.mobileUISystem) {
            try {
                const currentScreen = this.mobileUISystem.getCurrentScreen();
                if (currentScreen && currentScreen.refresh) {
                    currentScreen.refresh();
                    return true;
                }
            } catch (error) {
                console.warn('Failed to refresh current screen:', error);
            }
        }
        return false;
    }

    resetOrientation() {
        if (this.mobileUISystem) {
            try {
                const orientationManager = this.mobileUISystem.getComponent('orientationManager');
                if (orientationManager && orientationManager.reset) {
                    orientationManager.reset();
                    return true;
                }
            } catch (error) {
                console.warn('Failed to reset orientation:', error);
            }
        }
        return false;
    }

    clearUICache() {
        // Clear UI-related caches
        try {
            // Clear any cached DOM elements or data
            this.emit('clearCache');
            return true;
        } catch (error) {
            console.warn('Failed to clear UI cache:', error);
            return false;
        }
    }

    clearCorruptedStorage() {
        try {
            // Clear potentially corrupted localStorage data
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('mobile')) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });
            
            return true;
        } catch (error) {
            console.warn('Failed to clear corrupted storage:', error);
            return false;
        }
    }

    useMemoryStorage() {
        // Fallback to memory-based storage
        this.emit('useMemoryStorage');
        return true;
    }

    resetToDefaultSettings() {
        try {
            // Reset mobile settings to defaults
            const defaultSettings = {
                notifications: true,
                haptics: true,
                sound: true
            };
            
            localStorage.setItem('mobileSettings', JSON.stringify(defaultSettings));
            return true;
        } catch (error) {
            console.warn('Failed to reset settings:', error);
            return false;
        }
    }

    handleNetworkRecovery() {
        // Handle network recovery
        if (this.notificationSystem) {
            this.notificationSystem.showSuccess('Connection restored');
        }
        
        if (this.hapticSystem) {
            this.hapticSystem.connected();
        }
        
        this.emit('networkRecovery');
    }

    // Utility methods
    generateErrorId() {
        return `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // Public API
    getErrorHistory() {
        return [...this.errorHistory];
    }

    getErrorById(errorId) {
        return this.errorHistory.find(error => error.id === errorId);
    }

    clearErrorHistory() {
        this.errorHistory = [];
        this.emit('historyCleared');
    }

    getErrorStats() {
        const stats = {
            total: this.errorHistory.length,
            byCategory: {},
            bySeverity: {},
            resolved: 0,
            unresolved: 0
        };
        
        this.errorHistory.forEach(error => {
            // By category
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
            
            // By severity
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
            
            // Resolution status
            if (error.resolved) {
                stats.resolved++;
            } else {
                stats.unresolved++;
            }
        });
        
        return stats;
    }

    markErrorResolved(errorId) {
        const error = this.getErrorById(errorId);
        if (error) {
            error.resolved = true;
            error.resolvedAt = Date.now();
            this.emit('errorResolved', error);
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
                    console.error(`Error in error handler callback for ${eventName}:`, error);
                }
            });
        }
    }

    // Cleanup
    destroy() {
        // Remove global error handlers
        window.removeEventListener('error', this.handleError);
        window.removeEventListener('unhandledrejection', this.handleError);
        window.removeEventListener('offline', this.handleNetworkError);
        window.removeEventListener('online', this.handleNetworkRecovery);
        
        // Clear active handlers
        this.activeHandlers.clear();
        
        // Clear recovery strategies
        this.recoveryStrategies.clear();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Clear error history
        this.errorHistory = [];
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileErrorHandlingSystem;
} else if (typeof window !== 'undefined') {
    window.MobileErrorHandlingSystem = MobileErrorHandlingSystem;
}