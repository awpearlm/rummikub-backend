/**
 * Mobile Network-Aware Features
 * Task 14.2: Add mobile-specific optimizations - Network-aware features for mobile data
 * 
 * Implements network-aware optimizations for mobile data usage and connection quality
 * Requirements: 12.3, 12.4
 */

class MobileNetworkAwareFeatures {
    constructor() {
        this.connectionInfo = null;
        this.networkType = 'unknown';
        this.effectiveType = 'unknown';
        this.downlink = 0;
        this.rtt = 0;
        this.saveData = false;
        
        this.networkOptimizations = new Map();
        this.dataUsageTracking = {
            totalBytes: 0,
            sessionBytes: 0,
            apiCalls: 0,
            imageLoads: 0,
            lastReset: Date.now()
        };
        
        this.optimizationStrategies = {
            'slow-2g': {
                imageQuality: 'low',
                updateFrequency: 10000,
                prefetchDisabled: true,
                compressionLevel: 'high',
                batchRequests: true
            },
            '2g': {
                imageQuality: 'low',
                updateFrequency: 5000,
                prefetchDisabled: true,
                compressionLevel: 'high',
                batchRequests: true
            },
            '3g': {
                imageQuality: 'medium',
                updateFrequency: 3000,
                prefetchDisabled: false,
                compressionLevel: 'medium',
                batchRequests: true
            },
            '4g': {
                imageQuality: 'high',
                updateFrequency: 1000,
                prefetchDisabled: false,
                compressionLevel: 'low',
                batchRequests: false
            }
        };
        
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        try {
            // Initialize Network Information API
            this.setupNetworkMonitoring();
            
            // Setup data usage monitoring
            this.setupDataUsageMonitoring();
            
            // Setup connection quality monitoring
            this.setupConnectionQualityMonitoring();
            
            // Setup save-data preference monitoring
            this.setupSaveDataMonitoring();
            
            // Initial network assessment
            this.assessNetworkConditions();
            
            console.log('Mobile Network-Aware Features initialized');
            
        } catch (error) {
            console.error('Failed to initialize Network-Aware Features:', error);
            this.setupFallbackNetworkDetection();
        }
    }

    setupNetworkMonitoring() {
        // Network Information API
        if ('connection' in navigator) {
            this.connectionInfo = navigator.connection;
            this.updateNetworkInfo();
            
            // Listen for network changes
            this.connectionInfo.addEventListener('change', () => {
                this.updateNetworkInfo();
            });
        }
        
        // Online/offline events
        window.addEventListener('online', () => {
            this.handleOnlineStatusChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatusChange(false);
        });
    }

    updateNetworkInfo() {
        if (!this.connectionInfo) return;
        
        const previousType = this.effectiveType;
        
        this.networkType = this.connectionInfo.type || 'unknown';
        this.effectiveType = this.connectionInfo.effectiveType || 'unknown';
        this.downlink = this.connectionInfo.downlink || 0;
        this.rtt = this.connectionInfo.rtt || 0;
        this.saveData = this.connectionInfo.saveData || false;
        
        // Apply optimizations based on network type
        if (previousType !== this.effectiveType) {
            this.applyNetworkOptimizations(this.effectiveType);
        }
        
        // Emit network change event
        this.emit('networkChanged', {
            type: this.networkType,
            effectiveType: this.effectiveType,
            downlink: this.downlink,
            rtt: this.rtt,
            saveData: this.saveData,
            quality: this.getNetworkQuality()
        });
        
        console.log(`Network: ${this.effectiveType} (${this.downlink}Mbps, ${this.rtt}ms RTT) ${this.saveData ? '[Save Data]' : ''}`);
    }

    getNetworkQuality() {
        if (this.effectiveType === 'slow-2g' || this.effectiveType === '2g') {
            return 'poor';
        } else if (this.effectiveType === '3g') {
            return 'fair';
        } else if (this.effectiveType === '4g') {
            return 'good';
        }
        return 'unknown';
    }

    applyNetworkOptimizations(effectiveType) {
        const strategy = this.optimizationStrategies[effectiveType] || this.optimizationStrategies['3g'];
        
        // Apply image quality optimizations
        this.applyImageQualityOptimizations(strategy.imageQuality);
        
        // Apply update frequency optimizations
        this.applyUpdateFrequencyOptimizations(strategy.updateFrequency);
        
        // Apply prefetch optimizations
        this.applyPrefetchOptimizations(strategy.prefetchDisabled);
        
        // Apply compression optimizations
        this.applyCompressionOptimizations(strategy.compressionLevel);
        
        // Apply request batching optimizations
        this.applyRequestBatchingOptimizations(strategy.batchRequests);
        
        // Store current optimizations
        this.networkOptimizations.set('currentStrategy', strategy);
        this.networkOptimizations.set('effectiveType', effectiveType);
        
        // Emit optimization change event
        this.emit('networkOptimizationsChanged', {
            effectiveType: effectiveType,
            strategy: strategy
        });
    }

    applyImageQualityOptimizations(quality) {
        const root = document.documentElement;
        
        // Remove previous image quality classes
        root.classList.remove('image-quality-low', 'image-quality-medium', 'image-quality-high');
        
        // Apply new image quality
        root.classList.add(`image-quality-${quality}`);
        
        // Update CSS custom properties for image optimization
        const qualitySettings = {
            low: { compression: '0.6', maxWidth: '400px', lazy: 'true' },
            medium: { compression: '0.8', maxWidth: '800px', lazy: 'true' },
            high: { compression: '0.9', maxWidth: '1200px', lazy: 'false' }
        };
        
        const settings = qualitySettings[quality];
        root.style.setProperty('--image-compression', settings.compression);
        root.style.setProperty('--image-max-width', settings.maxWidth);
        root.style.setProperty('--image-lazy-loading', settings.lazy);
        
        this.networkOptimizations.set('imageQuality', quality);
    }

    applyUpdateFrequencyOptimizations(frequency) {
        // Emit update frequency change for components to handle
        this.emit('updateFrequencyChanged', { 
            frequency: frequency,
            reason: 'network-optimization'
        });
        
        this.networkOptimizations.set('updateFrequency', frequency);
    }

    applyPrefetchOptimizations(disabled) {
        // Control resource prefetching
        const prefetchElements = document.querySelectorAll('link[rel="prefetch"], link[rel="preload"]');
        
        prefetchElements.forEach(element => {
            if (disabled) {
                element.disabled = true;
            } else {
                element.disabled = false;
            }
        });
        
        // Emit prefetch change event
        this.emit('prefetchChanged', { disabled: disabled });
        
        this.networkOptimizations.set('prefetchDisabled', disabled);
    }

    applyCompressionOptimizations(level) {
        // Set compression preferences for API requests
        this.emit('compressionLevelChanged', { 
            level: level,
            acceptEncoding: this.getAcceptEncodingHeader(level)
        });
        
        this.networkOptimizations.set('compressionLevel', level);
    }

    getAcceptEncodingHeader(level) {
        switch (level) {
            case 'high':
                return 'gzip, deflate, br';
            case 'medium':
                return 'gzip, deflate';
            case 'low':
                return 'gzip';
            default:
                return 'gzip, deflate, br';
        }
    }

    applyRequestBatchingOptimizations(enabled) {
        // Control request batching behavior
        this.emit('requestBatchingChanged', { enabled: enabled });
        
        this.networkOptimizations.set('batchRequests', enabled);
    }

    setupDataUsageMonitoring() {
        // Intercept fetch requests to monitor data usage
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const startTime = Date.now();
            
            try {
                const response = await originalFetch(...args);
                
                // Track successful API calls
                this.trackDataUsage(response, startTime);
                
                return response;
            } catch (error) {
                // Track failed requests
                this.trackFailedRequest(args[0], error);
                throw error;
            }
        };
        
        // Monitor image loading
        this.setupImageLoadMonitoring();
    }

    trackDataUsage(response, startTime) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Estimate data usage from response
        const contentLength = response.headers.get('content-length');
        const estimatedBytes = contentLength ? parseInt(contentLength) : this.estimateResponseSize(response);
        
        // Update tracking
        this.dataUsageTracking.totalBytes += estimatedBytes;
        this.dataUsageTracking.sessionBytes += estimatedBytes;
        this.dataUsageTracking.apiCalls++;
        
        // Emit data usage event
        this.emit('dataUsageTracked', {
            bytes: estimatedBytes,
            duration: duration,
            url: response.url,
            status: response.status,
            totalBytes: this.dataUsageTracking.totalBytes
        });
        
        // Check for excessive data usage
        this.checkDataUsageThresholds();
    }

    estimateResponseSize(response) {
        // Rough estimation based on response type and status
        if (response.status >= 400) return 1024; // Error responses are typically small
        
        const url = response.url.toLowerCase();
        if (url.includes('api/')) return 5120; // API responses ~5KB
        if (url.includes('.json')) return 2048; // JSON files ~2KB
        if (url.includes('.js')) return 10240; // JS files ~10KB
        if (url.includes('.css')) return 5120; // CSS files ~5KB
        
        return 3072; // Default estimate ~3KB
    }

    setupImageLoadMonitoring() {
        // Monitor image loading using MutationObserver
        const imageObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const images = node.tagName === 'IMG' ? [node] : node.querySelectorAll('img');
                        
                        images.forEach((img) => {
                            img.addEventListener('load', () => {
                                this.trackImageLoad(img);
                            });
                        });
                    }
                });
            });
        });
        
        imageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    trackImageLoad(img) {
        // Estimate image size based on dimensions and quality
        const estimatedBytes = this.estimateImageSize(img);
        
        this.dataUsageTracking.totalBytes += estimatedBytes;
        this.dataUsageTracking.sessionBytes += estimatedBytes;
        this.dataUsageTracking.imageLoads++;
        
        this.emit('imageLoadTracked', {
            bytes: estimatedBytes,
            src: img.src,
            width: img.naturalWidth,
            height: img.naturalHeight
        });
    }

    estimateImageSize(img) {
        const width = img.naturalWidth || img.width || 100;
        const height = img.naturalHeight || img.height || 100;
        const pixels = width * height;
        
        // Rough estimation: 3 bytes per pixel for JPEG, 4 for PNG
        const bytesPerPixel = img.src.toLowerCase().includes('.png') ? 4 : 3;
        const compressionRatio = 0.1; // Typical web compression
        
        return Math.round(pixels * bytesPerPixel * compressionRatio);
    }

    checkDataUsageThresholds() {
        const sessionMB = this.dataUsageTracking.sessionBytes / (1024 * 1024);
        
        // Warn at 10MB session usage
        if (sessionMB > 10 && sessionMB < 10.5) {
            this.emit('dataUsageWarning', {
                level: 'moderate',
                sessionMB: sessionMB,
                message: 'High data usage detected'
            });
        }
        
        // Alert at 25MB session usage
        if (sessionMB > 25 && sessionMB < 25.5) {
            this.emit('dataUsageWarning', {
                level: 'high',
                sessionMB: sessionMB,
                message: 'Very high data usage - consider enabling data saver mode'
            });
        }
    }

    setupConnectionQualityMonitoring() {
        // Monitor connection quality through timing
        let pingTimes = [];
        
        const measureConnectionQuality = async () => {
            try {
                const startTime = Date.now();
                
                // Use a small API endpoint or image for ping test
                await fetch('/favicon.ico', { 
                    method: 'HEAD',
                    cache: 'no-cache'
                });
                
                const pingTime = Date.now() - startTime;
                pingTimes.push(pingTime);
                
                // Keep only last 10 measurements
                if (pingTimes.length > 10) {
                    pingTimes = pingTimes.slice(-10);
                }
                
                // Calculate average ping
                const averagePing = pingTimes.reduce((sum, time) => sum + time, 0) / pingTimes.length;
                
                // Emit connection quality update
                this.emit('connectionQualityMeasured', {
                    currentPing: pingTime,
                    averagePing: averagePing,
                    quality: this.assessConnectionQuality(averagePing)
                });
                
            } catch (error) {
                console.warn('Connection quality measurement failed:', error);
            }
        };
        
        // Measure every 30 seconds
        setInterval(measureConnectionQuality, 30000);
        measureConnectionQuality(); // Initial measurement
    }

    assessConnectionQuality(averagePing) {
        if (averagePing < 100) return 'excellent';
        if (averagePing < 300) return 'good';
        if (averagePing < 600) return 'fair';
        return 'poor';
    }

    setupSaveDataMonitoring() {
        // Monitor save-data preference changes
        if (this.connectionInfo && 'saveData' in this.connectionInfo) {
            // Initial save-data state
            this.handleSaveDataChange(this.connectionInfo.saveData);
            
            // Note: saveData changes are handled in updateNetworkInfo
        }
    }

    handleSaveDataChange(saveData) {
        if (saveData) {
            // Apply aggressive data saving optimizations
            this.applyDataSaverMode();
        } else {
            // Restore normal data usage
            this.restoreNormalDataMode();
        }
        
        this.emit('saveDataChanged', { saveData: saveData });
    }

    applyDataSaverMode() {
        const root = document.documentElement;
        root.classList.add('data-saver-mode');
        
        // Apply most aggressive optimizations
        this.applyImageQualityOptimizations('low');
        this.applyUpdateFrequencyOptimizations(10000);
        this.applyPrefetchOptimizations(true);
        this.applyCompressionOptimizations('high');
        
        console.log('Data saver mode enabled');
    }

    restoreNormalDataMode() {
        const root = document.documentElement;
        root.classList.remove('data-saver-mode');
        
        // Restore optimizations based on current network
        this.applyNetworkOptimizations(this.effectiveType);
        
        console.log('Data saver mode disabled');
    }

    handleOnlineStatusChange(isOnline) {
        this.emit('onlineStatusChanged', { 
            isOnline: isOnline,
            timestamp: Date.now()
        });
        
        if (isOnline) {
            console.log('Connection restored');
            // Trigger any pending sync operations
            this.emit('connectionRestored');
        } else {
            console.log('Connection lost');
            // Enable offline mode
            this.emit('connectionLost');
        }
    }

    setupFallbackNetworkDetection() {
        // Fallback network detection using timing
        const detectNetworkSpeed = async () => {
            try {
                const startTime = Date.now();
                const response = await fetch('/favicon.ico?t=' + Date.now(), {
                    cache: 'no-cache'
                });
                const endTime = Date.now();
                
                const duration = endTime - startTime;
                const size = 1024; // Assume 1KB favicon
                const speed = (size * 8) / (duration / 1000); // bits per second
                
                // Estimate effective type based on speed
                let effectiveType = '3g';
                if (speed < 50000) effectiveType = 'slow-2g';
                else if (speed < 250000) effectiveType = '2g';
                else if (speed < 1000000) effectiveType = '3g';
                else effectiveType = '4g';
                
                this.effectiveType = effectiveType;
                this.applyNetworkOptimizations(effectiveType);
                
            } catch (error) {
                console.warn('Fallback network detection failed:', error);
            }
        };
        
        // Detect every 2 minutes
        setInterval(detectNetworkSpeed, 2 * 60 * 1000);
        detectNetworkSpeed(); // Initial detection
    }

    assessNetworkConditions() {
        const conditions = {
            type: this.networkType,
            effectiveType: this.effectiveType,
            quality: this.getNetworkQuality(),
            downlink: this.downlink,
            rtt: this.rtt,
            saveData: this.saveData,
            isOnline: navigator.onLine,
            optimizations: this.getActiveOptimizations()
        };
        
        this.emit('networkConditionsAssessed', conditions);
        
        return conditions;
    }

    // Public API methods
    getNetworkInfo() {
        return {
            type: this.networkType,
            effectiveType: this.effectiveType,
            downlink: this.downlink,
            rtt: this.rtt,
            saveData: this.saveData,
            quality: this.getNetworkQuality()
        };
    }

    getDataUsage() {
        return {
            ...this.dataUsageTracking,
            sessionMB: this.dataUsageTracking.sessionBytes / (1024 * 1024),
            totalMB: this.dataUsageTracking.totalBytes / (1024 * 1024)
        };
    }

    resetDataUsage() {
        this.dataUsageTracking.sessionBytes = 0;
        this.dataUsageTracking.apiCalls = 0;
        this.dataUsageTracking.imageLoads = 0;
        this.dataUsageTracking.lastReset = Date.now();
        
        this.emit('dataUsageReset');
    }

    getActiveOptimizations() {
        return new Map(this.networkOptimizations);
    }

    isDataSaverEnabled() {
        return this.saveData;
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
                    console.error(`Error in network-aware callback for ${eventName}:`, error);
                }
            });
        }
    }

    destroy() {
        // Clean up event listeners
        if (this.connectionInfo) {
            this.connectionInfo.removeEventListener('change', this.updateNetworkInfo);
        }
        
        window.removeEventListener('online', this.handleOnlineStatusChange);
        window.removeEventListener('offline', this.handleOnlineStatusChange);
        
        this.eventCallbacks.clear();
        this.networkOptimizations.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileNetworkAwareFeatures;
} else if (typeof window !== 'undefined') {
    window.MobileNetworkAwareFeatures = MobileNetworkAwareFeatures;
}