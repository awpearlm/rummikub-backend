/**
 * Memory Manager
 * Provides efficient tile rendering, texture optimization, and memory usage monitoring
 * Ensures optimal memory usage across all mobile UI components
 */

class MemoryManager {
    constructor() {
        this.isInitialized = false;
        
        // Memory monitoring
        this.memoryMetrics = {
            currentUsage: 0,
            peakUsage: 0,
            allocations: 0,
            deallocations: 0,
            gcCount: 0,
            lastGCTime: 0
        };
        
        // Tile rendering optimization
        this.tileCache = new Map();
        this.textureCache = new Map();
        this.renderingPool = [];
        this.maxCacheSize = 100;
        this.maxTextureSize = 50;
        
        // Asset optimization
        this.assetCache = new Map();
        this.preloadedAssets = new Set();
        this.compressionEnabled = true;
        
        // Memory thresholds (in MB)
        this.memoryThresholds = {
            warning: 100,
            critical: 150,
            emergency: 200
        };
        
        // Cleanup strategies
        this.cleanupStrategies = {
            aggressive: false,
            intervalMs: 30000, // 30 seconds
            idleThreshold: 5000 // 5 seconds of inactivity
        };
        
        // Object pools for reuse
        this.objectPools = {
            tiles: [],
            animations: [],
            events: []
        };
        
        // Weak references for cleanup
        this.weakReferences = new Set();
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        // Performance observer
        this.performanceObserver = null;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup memory monitoring
            this.setupMemoryMonitoring();
            
            // Setup tile rendering optimization
            this.setupTileRenderingOptimization();
            
            // Setup asset optimization
            this.setupAssetOptimization();
            
            // Setup automatic cleanup
            this.setupAutomaticCleanup();
            
            // Setup object pools
            this.setupObjectPools();
            
            // Setup performance observation
            this.setupPerformanceObservation();
            
            this.isInitialized = true;
            console.log('Memory Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Memory Manager:', error);
            throw error;
        }
    }

    setupMemoryMonitoring() {
        // Monitor memory usage if available
        if ('memory' in performance) {
            this.startMemoryMonitoring();
        } else {
            console.warn('Performance memory API not available, using fallback monitoring');
            this.startFallbackMonitoring();
        }
        
        // Setup garbage collection monitoring
        this.setupGCMonitoring();
    }

    startMemoryMonitoring() {
        const monitorMemory = () => {
            try {
                const memInfo = performance.memory;
                
                this.memoryMetrics.currentUsage = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
                this.memoryMetrics.peakUsage = Math.max(
                    this.memoryMetrics.peakUsage,
                    this.memoryMetrics.currentUsage
                );
                
                // Check thresholds
                this.checkMemoryThresholds();
                
                // Emit memory update
                this.emit('memoryUpdate', {
                    current: this.memoryMetrics.currentUsage,
                    peak: this.memoryMetrics.peakUsage,
                    limit: Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024)
                });
                
            } catch (error) {
                console.warn('Error monitoring memory:', error);
            }
        };
        
        // Monitor every 5 seconds
        setInterval(monitorMemory, 5000);
        monitorMemory(); // Initial check
    }

    startFallbackMonitoring() {
        // Estimate memory usage based on cached objects
        const estimateMemory = () => {
            let estimatedUsage = 0;
            
            // Estimate tile cache usage
            estimatedUsage += this.tileCache.size * 0.1; // ~0.1MB per tile
            
            // Estimate texture cache usage
            estimatedUsage += this.textureCache.size * 0.5; // ~0.5MB per texture
            
            // Estimate asset cache usage
            estimatedUsage += this.assetCache.size * 0.2; // ~0.2MB per asset
            
            this.memoryMetrics.currentUsage = Math.round(estimatedUsage);
            this.memoryMetrics.peakUsage = Math.max(
                this.memoryMetrics.peakUsage,
                this.memoryMetrics.currentUsage
            );
            
            this.checkMemoryThresholds();
        };
        
        setInterval(estimateMemory, 10000); // Every 10 seconds
    }

    setupGCMonitoring() {
        // Monitor for garbage collection events
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.entryType === 'measure' && entry.name.includes('gc')) {
                            this.memoryMetrics.gcCount++;
                            this.memoryMetrics.lastGCTime = entry.startTime;
                            
                            this.emit('garbageCollection', {
                                duration: entry.duration,
                                timestamp: entry.startTime
                            });
                        }
                    });
                });
                
                observer.observe({ entryTypes: ['measure'] });
                this.performanceObserver = observer;
                
            } catch (error) {
                console.warn('Could not setup GC monitoring:', error);
            }
        }
    }

    checkMemoryThresholds() {
        const current = this.memoryMetrics.currentUsage;
        
        if (current >= this.memoryThresholds.emergency) {
            this.handleEmergencyMemory();
        } else if (current >= this.memoryThresholds.critical) {
            this.handleCriticalMemory();
        } else if (current >= this.memoryThresholds.warning) {
            this.handleWarningMemory();
        }
    }

    handleWarningMemory() {
        console.warn(`Memory usage warning: ${this.memoryMetrics.currentUsage}MB`);
        
        // Start gentle cleanup
        this.performGentleCleanup();
        
        this.emit('memoryWarning', {
            usage: this.memoryMetrics.currentUsage,
            threshold: this.memoryThresholds.warning
        });
    }

    handleCriticalMemory() {
        console.warn(`Critical memory usage: ${this.memoryMetrics.currentUsage}MB`);
        
        // Perform aggressive cleanup
        this.performAggressiveCleanup();
        
        this.emit('memoryCritical', {
            usage: this.memoryMetrics.currentUsage,
            threshold: this.memoryThresholds.critical
        });
    }

    handleEmergencyMemory() {
        console.error(`Emergency memory usage: ${this.memoryMetrics.currentUsage}MB`);
        
        // Emergency cleanup
        this.performEmergencyCleanup();
        
        this.emit('memoryEmergency', {
            usage: this.memoryMetrics.currentUsage,
            threshold: this.memoryThresholds.emergency
        });
    }

    setupTileRenderingOptimization() {
        // Create tile rendering system
        this.setupTileCache();
        this.setupTextureCache();
        this.setupRenderingPool();
    }

    setupTileCache() {
        // Tile cache with LRU eviction
        this.tileCache = new Map();
        this.tileCacheOrder = [];
        
        this.cacheTile = (tileId, tileData) => {
            // Remove if already exists to update order
            if (this.tileCache.has(tileId)) {
                this.removeTileFromOrder(tileId);
            }
            
            // Add to cache
            this.tileCache.set(tileId, {
                data: tileData,
                lastAccessed: Date.now(),
                accessCount: 1
            });
            
            this.tileCacheOrder.push(tileId);
            
            // Evict if over limit
            if (this.tileCache.size > this.maxCacheSize) {
                this.evictOldestTile();
            }
        };
        
        this.getTileFromCache = (tileId) => {
            const cached = this.tileCache.get(tileId);
            if (cached) {
                cached.lastAccessed = Date.now();
                cached.accessCount++;
                
                // Move to end of order
                this.removeTileFromOrder(tileId);
                this.tileCacheOrder.push(tileId);
                
                return cached.data;
            }
            return null;
        };
    }

    setupTextureCache() {
        // Texture cache for tile graphics
        this.textureCache = new Map();
        this.textureCacheOrder = [];
        
        this.cacheTexture = (textureKey, textureData) => {
            if (this.textureCache.has(textureKey)) {
                this.removeTextureFromOrder(textureKey);
            }
            
            this.textureCache.set(textureKey, {
                data: textureData,
                size: this.estimateTextureSize(textureData),
                lastAccessed: Date.now()
            });
            
            this.textureCacheOrder.push(textureKey);
            
            // Evict if over limit
            if (this.textureCache.size > this.maxTextureSize) {
                this.evictOldestTexture();
            }
        };
        
        this.getTextureFromCache = (textureKey) => {
            const cached = this.textureCache.get(textureKey);
            if (cached) {
                cached.lastAccessed = Date.now();
                
                // Move to end of order
                this.removeTextureFromOrder(textureKey);
                this.textureCacheOrder.push(textureKey);
                
                return cached.data;
            }
            return null;
        };
    }

    setupRenderingPool() {
        // Object pool for tile rendering elements
        this.renderingPool = [];
        
        this.getTileElement = () => {
            if (this.renderingPool.length > 0) {
                return this.renderingPool.pop();
            }
            
            // Create new element
            const element = document.createElement('div');
            element.className = 'hand-tile pooled-element';
            return element;
        };
        
        this.returnTileElement = (element) => {
            // Clean element
            element.innerHTML = '';
            element.className = 'hand-tile pooled-element';
            element.removeAttribute('data-tile-id');
            element.removeAttribute('aria-label');
            
            // Return to pool
            if (this.renderingPool.length < 50) { // Limit pool size
                this.renderingPool.push(element);
            }
        };
    }

    setupAssetOptimization() {
        // Asset cache with compression
        this.assetCache = new Map();
        
        this.cacheAsset = (assetKey, assetData, compress = true) => {
            let processedData = assetData;
            
            if (compress && this.compressionEnabled) {
                processedData = this.compressAsset(assetData);
            }
            
            this.assetCache.set(assetKey, {
                data: processedData,
                compressed: compress,
                originalSize: this.estimateSize(assetData),
                compressedSize: this.estimateSize(processedData),
                lastAccessed: Date.now()
            });
            
            this.memoryMetrics.allocations++;
        };
        
        this.getAssetFromCache = (assetKey) => {
            const cached = this.assetCache.get(assetKey);
            if (cached) {
                cached.lastAccessed = Date.now();
                
                let data = cached.data;
                if (cached.compressed) {
                    data = this.decompressAsset(data);
                }
                
                return data;
            }
            return null;
        };
    }

    compressAsset(assetData) {
        // Simple compression for text-based assets
        if (typeof assetData === 'string') {
            try {
                // Use built-in compression if available
                if ('CompressionStream' in window) {
                    // This would require async handling in real implementation
                    return assetData; // Fallback for now
                }
                
                // Simple string compression
                return this.simpleStringCompress(assetData);
            } catch (error) {
                console.warn('Asset compression failed:', error);
                return assetData;
            }
        }
        
        return assetData;
    }

    decompressAsset(compressedData) {
        // Decompress asset data
        if (typeof compressedData === 'string' && compressedData.startsWith('COMPRESSED:')) {
            return this.simpleStringDecompress(compressedData);
        }
        
        return compressedData;
    }

    simpleStringCompress(str) {
        // Simple run-length encoding for demonstration
        let compressed = 'COMPRESSED:';
        let count = 1;
        let current = str[0];
        
        for (let i = 1; i < str.length; i++) {
            if (str[i] === current && count < 9) {
                count++;
            } else {
                compressed += count > 1 ? `${count}${current}` : current;
                current = str[i];
                count = 1;
            }
        }
        
        compressed += count > 1 ? `${count}${current}` : current;
        return compressed;
    }

    simpleStringDecompress(compressed) {
        // Decompress run-length encoded string
        const data = compressed.replace('COMPRESSED:', '');
        let result = '';
        
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            if (/\d/.test(char) && i + 1 < data.length) {
                const count = parseInt(char);
                const repeatChar = data[i + 1];
                result += repeatChar.repeat(count);
                i++; // Skip the repeated character
            } else {
                result += char;
            }
        }
        
        return result;
    }

    setupAutomaticCleanup() {
        // Regular cleanup interval
        setInterval(() => {
            this.performRoutineCleanup();
        }, this.cleanupStrategies.intervalMs);
        
        // Idle cleanup
        this.setupIdleCleanup();
        
        // Page visibility cleanup
        this.setupVisibilityCleanup();
    }

    setupIdleCleanup() {
        let lastActivity = Date.now();
        
        // Track user activity
        const activityEvents = ['touchstart', 'touchmove', 'click', 'keydown'];
        const updateActivity = () => {
            lastActivity = Date.now();
        };
        
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
        
        // Check for idle state
        setInterval(() => {
            const idleTime = Date.now() - lastActivity;
            if (idleTime > this.cleanupStrategies.idleThreshold) {
                this.performIdleCleanup();
            }
        }, 5000);
    }

    setupVisibilityCleanup() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // Page is hidden, perform cleanup
                this.performVisibilityCleanup();
            }
        });
    }

    setupObjectPools() {
        // Initialize object pools
        this.objectPools.tiles = [];
        this.objectPools.animations = [];
        this.objectPools.events = [];
        
        // Tile object pool
        this.getTileObject = () => {
            if (this.objectPools.tiles.length > 0) {
                return this.objectPools.tiles.pop();
            }
            
            return {
                id: null,
                color: null,
                number: null,
                isJoker: false,
                element: null
            };
        };
        
        this.returnTileObject = (tileObj) => {
            // Reset object
            tileObj.id = null;
            tileObj.color = null;
            tileObj.number = null;
            tileObj.isJoker = false;
            tileObj.element = null;
            
            // Return to pool
            if (this.objectPools.tiles.length < 100) {
                this.objectPools.tiles.push(tileObj);
            }
        };
        
        // Animation object pool
        this.getAnimationObject = () => {
            if (this.objectPools.animations.length > 0) {
                return this.objectPools.animations.pop();
            }
            
            return {
                element: null,
                startTime: 0,
                duration: 0,
                properties: {},
                callback: null
            };
        };
        
        this.returnAnimationObject = (animObj) => {
            // Reset object
            animObj.element = null;
            animObj.startTime = 0;
            animObj.duration = 0;
            animObj.properties = {};
            animObj.callback = null;
            
            // Return to pool
            if (this.objectPools.animations.length < 50) {
                this.objectPools.animations.push(animObj);
            }
        };
    }

    setupPerformanceObservation() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.entryType === 'memory') {
                            this.handleMemoryEntry(entry);
                        }
                    });
                });
                
                // Observe memory entries if supported
                try {
                    observer.observe({ entryTypes: ['memory'] });
                } catch (error) {
                    // Memory observation not supported
                }
                
            } catch (error) {
                console.warn('Could not setup performance observation:', error);
            }
        }
    }

    // Cleanup methods
    performRoutineCleanup() {
        // Clean up expired cache entries
        this.cleanupExpiredCacheEntries();
        
        // Clean up object pools
        this.cleanupObjectPools();
        
        // Clean up weak references
        this.cleanupWeakReferences();
    }

    performGentleCleanup() {
        // Remove least recently used items
        this.evictLRUItems(0.1); // Remove 10% of cached items
        
        // Clean up object pools
        this.cleanupObjectPools();
    }

    performAggressiveCleanup() {
        // Remove more cached items
        this.evictLRUItems(0.3); // Remove 30% of cached items
        
        // Clear texture cache partially
        this.clearTextureCache(0.5); // Clear 50% of textures
        
        // Force garbage collection if available
        this.forceGarbageCollection();
    }

    performEmergencyCleanup() {
        // Clear most caches
        this.clearTileCache();
        this.clearTextureCache();
        this.clearAssetCache(0.8); // Keep only 20% of assets
        
        // Clear object pools
        this.clearObjectPools();
        
        // Force garbage collection
        this.forceGarbageCollection();
        
        // Enable aggressive cleanup mode
        this.cleanupStrategies.aggressive = true;
        
        // Disable aggressive mode after 30 seconds
        setTimeout(() => {
            this.cleanupStrategies.aggressive = false;
        }, 30000);
    }

    performIdleCleanup() {
        // Gentle cleanup during idle time
        this.cleanupExpiredCacheEntries();
        this.evictLRUItems(0.05); // Remove 5% of items
    }

    performVisibilityCleanup() {
        // Cleanup when page is hidden
        this.cleanupExpiredCacheEntries();
        this.evictLRUItems(0.2); // Remove 20% of items
        this.clearTextureCache(0.3); // Clear 30% of textures
    }

    // Cache management methods
    evictOldestTile() {
        if (this.tileCacheOrder.length > 0) {
            const oldestTileId = this.tileCacheOrder.shift();
            this.tileCache.delete(oldestTileId);
            this.memoryMetrics.deallocations++;
        }
    }

    evictOldestTexture() {
        if (this.textureCacheOrder.length > 0) {
            const oldestTextureKey = this.textureCacheOrder.shift();
            this.textureCache.delete(oldestTextureKey);
            this.memoryMetrics.deallocations++;
        }
    }

    removeTileFromOrder(tileId) {
        const index = this.tileCacheOrder.indexOf(tileId);
        if (index > -1) {
            this.tileCacheOrder.splice(index, 1);
        }
    }

    removeTextureFromOrder(textureKey) {
        const index = this.textureCacheOrder.indexOf(textureKey);
        if (index > -1) {
            this.textureCacheOrder.splice(index, 1);
        }
    }

    evictLRUItems(percentage) {
        const tilesToRemove = Math.floor(this.tileCache.size * percentage);
        const texturesToRemove = Math.floor(this.textureCache.size * percentage);
        
        // Remove oldest tiles
        for (let i = 0; i < tilesToRemove; i++) {
            this.evictOldestTile();
        }
        
        // Remove oldest textures
        for (let i = 0; i < texturesToRemove; i++) {
            this.evictOldestTexture();
        }
    }

    clearTileCache() {
        const count = this.tileCache.size;
        this.tileCache.clear();
        this.tileCacheOrder = [];
        this.memoryMetrics.deallocations += count;
    }

    clearTextureCache(percentage = 1.0) {
        const toRemove = Math.floor(this.textureCache.size * percentage);
        
        for (let i = 0; i < toRemove; i++) {
            this.evictOldestTexture();
        }
    }

    clearAssetCache(percentage = 1.0) {
        const assets = Array.from(this.assetCache.keys());
        const toRemove = Math.floor(assets.length * percentage);
        
        // Remove oldest assets
        assets.slice(0, toRemove).forEach(key => {
            this.assetCache.delete(key);
            this.memoryMetrics.deallocations++;
        });
    }

    cleanupExpiredCacheEntries() {
        const now = Date.now();
        const maxAge = 300000; // 5 minutes
        
        // Clean tile cache
        for (const [tileId, cached] of this.tileCache) {
            if (now - cached.lastAccessed > maxAge) {
                this.tileCache.delete(tileId);
                this.removeTileFromOrder(tileId);
                this.memoryMetrics.deallocations++;
            }
        }
        
        // Clean texture cache
        for (const [textureKey, cached] of this.textureCache) {
            if (now - cached.lastAccessed > maxAge) {
                this.textureCache.delete(textureKey);
                this.removeTextureFromOrder(textureKey);
                this.memoryMetrics.deallocations++;
            }
        }
        
        // Clean asset cache
        for (const [assetKey, cached] of this.assetCache) {
            if (now - cached.lastAccessed > maxAge) {
                this.assetCache.delete(assetKey);
                this.memoryMetrics.deallocations++;
            }
        }
    }

    cleanupObjectPools() {
        // Limit pool sizes
        this.objectPools.tiles = this.objectPools.tiles.slice(0, 50);
        this.objectPools.animations = this.objectPools.animations.slice(0, 25);
        this.objectPools.events = this.objectPools.events.slice(0, 25);
    }

    clearObjectPools() {
        this.objectPools.tiles = [];
        this.objectPools.animations = [];
        this.objectPools.events = [];
    }

    cleanupWeakReferences() {
        // Clean up any weak references that are no longer valid
        const validReferences = new Set();
        
        for (const ref of this.weakReferences) {
            if (ref.deref()) {
                validReferences.add(ref);
            }
        }
        
        this.weakReferences = validReferences;
    }

    forceGarbageCollection() {
        // Force garbage collection if available
        if (window.gc) {
            try {
                window.gc();
                this.memoryMetrics.gcCount++;
                this.memoryMetrics.lastGCTime = Date.now();
            } catch (error) {
                console.warn('Could not force garbage collection:', error);
            }
        }
    }

    // Utility methods
    estimateSize(data) {
        if (typeof data === 'string') {
            return data.length * 2; // Rough estimate for UTF-16
        } else if (data instanceof ArrayBuffer) {
            return data.byteLength;
        } else if (typeof data === 'object') {
            return JSON.stringify(data).length * 2;
        }
        return 0;
    }

    estimateTextureSize(textureData) {
        // Estimate texture size based on type
        if (textureData instanceof ImageData) {
            return textureData.width * textureData.height * 4; // RGBA
        } else if (textureData instanceof HTMLCanvasElement) {
            return textureData.width * textureData.height * 4;
        }
        return this.estimateSize(textureData);
    }

    // Public API methods
    getMemoryMetrics() {
        return {
            ...this.memoryMetrics,
            cacheStats: {
                tiles: this.tileCache.size,
                textures: this.textureCache.size,
                assets: this.assetCache.size
            },
            poolStats: {
                tiles: this.objectPools.tiles.length,
                animations: this.objectPools.animations.length,
                events: this.objectPools.events.length
            }
        };
    }

    isMemoryOptimal() {
        return this.memoryMetrics.currentUsage < this.memoryThresholds.warning;
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
        // Clear all caches
        this.clearTileCache();
        this.clearTextureCache();
        this.clearAssetCache();
        
        // Clear object pools
        this.clearObjectPools();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Disconnect performance observer
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryManager;
} else if (typeof window !== 'undefined') {
    window.MemoryManager = MemoryManager;
}