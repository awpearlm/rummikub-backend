/**
 * Mobile Offline Capability
 * Task 14.2: Add mobile-specific optimizations - Create offline capability where appropriate
 * 
 * Implements offline functionality for mobile devices including caching, sync, and offline UI
 * Requirements: 12.3, 12.4
 */

class MobileOfflineCapability {
    constructor() {
        this.isOnline = navigator.onLine;
        this.serviceWorker = null;
        this.offlineStorage = null;
        this.syncQueue = [];
        this.offlineData = new Map();
        this.cacheStrategies = new Map();
        
        this.config = {
            enableServiceWorker: true,
            enableOfflineStorage: true,
            enableBackgroundSync: true,
            maxOfflineStorage: 50 * 1024 * 1024, // 50MB
            syncRetryAttempts: 3,
            syncRetryDelay: 5000
        };
        
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        try {
            // Initialize offline storage
            await this.initializeOfflineStorage();
            
            // Register service worker
            if (this.config.enableServiceWorker) {
                await this.registerServiceWorker();
            }
            
            // Setup online/offline monitoring
            this.setupOnlineOfflineMonitoring();
            
            // Setup sync queue management
            this.setupSyncQueueManagement();
            
            // Initialize cache strategies
            this.initializeCacheStrategies();
            
            // Setup offline UI components
            this.setupOfflineUI();
            
            console.log('Mobile Offline Capability initialized');
            
        } catch (error) {
            console.error('Failed to initialize Offline Capability:', error);
            this.setupFallbackOfflineMode();
        }
    }

    async initializeOfflineStorage() {
        // Initialize IndexedDB for offline storage
        if ('indexedDB' in window) {
            this.offlineStorage = await this.openIndexedDB();
        } else {
            // Fallback to localStorage
            this.offlineStorage = this.createLocalStorageWrapper();
        }
        
        console.log('Offline storage initialized');
    }

    openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MobileOfflineDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                const db = request.result;
                resolve({
                    db: db,
                    get: (store, key) => this.indexedDBGet(db, store, key),
                    set: (store, key, value) => this.indexedDBSet(db, store, key, value),
                    delete: (store, key) => this.indexedDBDelete(db, store, key),
                    clear: (store) => this.indexedDBClear(db, store),
                    getAll: (store) => this.indexedDBGetAll(db, store)
                });
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('gameData')) {
                    db.createObjectStore('gameData', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('userActions')) {
                    db.createObjectStore('userActions', { keyPath: 'id', autoIncrement: true });
                }
                
                if (!db.objectStoreNames.contains('cachedResponses')) {
                    db.createObjectStore('cachedResponses', { keyPath: 'url' });
                }
                
                if (!db.objectStoreNames.contains('offlineQueue')) {
                    db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async indexedDBGet(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async indexedDBSet(db, storeName, key, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const data = typeof key === 'object' ? key : { id: key, ...value };
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async indexedDBDelete(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async indexedDBClear(db, storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async indexedDBGetAll(db, storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    createLocalStorageWrapper() {
        return {
            get: async (store, key) => {
                const data = localStorage.getItem(`${store}_${key}`);
                return data ? JSON.parse(data) : null;
            },
            set: async (store, key, value) => {
                localStorage.setItem(`${store}_${key}`, JSON.stringify(value));
            },
            delete: async (store, key) => {
                localStorage.removeItem(`${store}_${key}`);
            },
            clear: async (store) => {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith(`${store}_`)) {
                        localStorage.removeItem(key);
                    }
                });
            },
            getAll: async (store) => {
                const keys = Object.keys(localStorage);
                const results = [];
                keys.forEach(key => {
                    if (key.startsWith(`${store}_`)) {
                        const data = localStorage.getItem(key);
                        results.push(JSON.parse(data));
                    }
                });
                return results;
            }
        };
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                this.serviceWorker = registration;
                
                // Listen for service worker messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
                console.log('Service Worker registered successfully');
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'CACHE_UPDATED':
                this.emit('cacheUpdated', data);
                break;
            case 'OFFLINE_READY':
                this.emit('offlineReady', data);
                break;
            case 'SYNC_COMPLETED':
                this.handleSyncCompleted(data);
                break;
        }
    }

    setupOnlineOfflineMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.handleOnlineStatusChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleOnlineStatusChange(false);
        });
        
        // Initial status check
        this.handleOnlineStatusChange(navigator.onLine);
    }

    handleOnlineStatusChange(isOnline) {
        const wasOnline = this.isOnline;
        this.isOnline = isOnline;
        
        if (isOnline && !wasOnline) {
            // Coming back online
            this.handleComingOnline();
        } else if (!isOnline && wasOnline) {
            // Going offline
            this.handleGoingOffline();
        }
        
        this.emit('onlineStatusChanged', { 
            isOnline: isOnline,
            wasOnline: wasOnline
        });
    }

    async handleComingOnline() {
        console.log('Device came online - syncing offline data');
        
        // Hide offline indicator
        this.hideOfflineIndicator();
        
        // Process sync queue
        await this.processSyncQueue();
        
        // Update cached data
        await this.updateCachedData();
        
        this.emit('cameOnline');
    }

    handleGoingOffline() {
        console.log('Device went offline - enabling offline mode');
        
        // Show offline indicator
        this.showOfflineIndicator();
        
        // Prepare offline data
        this.prepareOfflineData();
        
        this.emit('wentOffline');
    }

    setupSyncQueueManagement() {
        // Load existing sync queue from storage
        this.loadSyncQueue();
        
        // Setup periodic sync attempts
        setInterval(() => {
            if (this.isOnline && this.syncQueue.length > 0) {
                this.processSyncQueue();
            }
        }, this.config.syncRetryDelay);
    }

    async loadSyncQueue() {
        try {
            const queueData = await this.offlineStorage.getAll('offlineQueue');
            this.syncQueue = queueData || [];
            
            console.log(`Loaded ${this.syncQueue.length} items from sync queue`);
            
        } catch (error) {
            console.error('Failed to load sync queue:', error);
            this.syncQueue = [];
        }
    }

    async addToSyncQueue(action) {
        const queueItem = {
            id: Date.now() + Math.random(),
            action: action,
            timestamp: Date.now(),
            attempts: 0,
            maxAttempts: this.config.syncRetryAttempts
        };
        
        this.syncQueue.push(queueItem);
        
        // Persist to storage
        await this.offlineStorage.set('offlineQueue', queueItem.id, queueItem);
        
        // Try to sync immediately if online
        if (this.isOnline) {
            this.processSyncQueue();
        }
        
        this.emit('syncQueueUpdated', { 
            queueLength: this.syncQueue.length,
            added: queueItem
        });
    }

    async processSyncQueue() {
        if (!this.isOnline || this.syncQueue.length === 0) return;
        
        console.log(`Processing sync queue (${this.syncQueue.length} items)`);
        
        const itemsToRemove = [];
        
        for (const item of this.syncQueue) {
            try {
                await this.executeSyncAction(item.action);
                
                // Success - remove from queue
                itemsToRemove.push(item);
                await this.offlineStorage.delete('offlineQueue', item.id);
                
                this.emit('syncItemCompleted', { item: item });
                
            } catch (error) {
                console.error('Sync action failed:', error);
                
                item.attempts++;
                
                if (item.attempts >= item.maxAttempts) {
                    // Max attempts reached - remove from queue
                    itemsToRemove.push(item);
                    await this.offlineStorage.delete('offlineQueue', item.id);
                    
                    this.emit('syncItemFailed', { 
                        item: item, 
                        error: error 
                    });
                } else {
                    // Update attempts count
                    await this.offlineStorage.set('offlineQueue', item.id, item);
                }
            }
        }
        
        // Remove completed/failed items from queue
        this.syncQueue = this.syncQueue.filter(item => !itemsToRemove.includes(item));
        
        this.emit('syncQueueProcessed', { 
            processed: itemsToRemove.length,
            remaining: this.syncQueue.length
        });
    }

    async executeSyncAction(action) {
        switch (action.type) {
            case 'api_call':
                return await this.syncApiCall(action);
            case 'game_move':
                return await this.syncGameMove(action);
            case 'user_preference':
                return await this.syncUserPreference(action);
            default:
                throw new Error(`Unknown sync action type: ${action.type}`);
        }
    }

    async syncApiCall(action) {
        const response = await fetch(action.url, {
            method: action.method || 'POST',
            headers: action.headers || {},
            body: action.body ? JSON.stringify(action.body) : undefined
        });
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }
        
        return await response.json();
    }

    async syncGameMove(action) {
        // Sync game move to server
        const response = await fetch('/api/game/move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(action.moveData)
        });
        
        if (!response.ok) {
            throw new Error(`Game move sync failed: ${response.status}`);
        }
        
        return await response.json();
    }

    async syncUserPreference(action) {
        // Sync user preference to server
        const response = await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(action.preferences)
        });
        
        if (!response.ok) {
            throw new Error(`User preference sync failed: ${response.status}`);
        }
        
        return await response.json();
    }

    initializeCacheStrategies() {
        // Define caching strategies for different types of content
        this.cacheStrategies.set('api_responses', {
            strategy: 'cache_first',
            maxAge: 5 * 60 * 1000, // 5 minutes
            maxEntries: 100
        });
        
        this.cacheStrategies.set('game_data', {
            strategy: 'network_first',
            maxAge: 30 * 1000, // 30 seconds
            maxEntries: 50
        });
        
        this.cacheStrategies.set('static_assets', {
            strategy: 'cache_first',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            maxEntries: 200
        });
        
        this.cacheStrategies.set('user_data', {
            strategy: 'network_first',
            maxAge: 60 * 1000, // 1 minute
            maxEntries: 20
        });
    }

    async cacheResponse(url, response, strategy = 'api_responses') {
        const cacheConfig = this.cacheStrategies.get(strategy);
        if (!cacheConfig) return;
        
        const cacheData = {
            url: url,
            response: response,
            timestamp: Date.now(),
            strategy: strategy
        };
        
        await this.offlineStorage.set('cachedResponses', url, cacheData);
        
        // Clean up old cache entries
        await this.cleanupCache(strategy);
    }

    async getCachedResponse(url, strategy = 'api_responses') {
        const cacheConfig = this.cacheStrategies.get(strategy);
        if (!cacheConfig) return null;
        
        const cacheData = await this.offlineStorage.get('cachedResponses', url);
        if (!cacheData) return null;
        
        // Check if cache is still valid
        const age = Date.now() - cacheData.timestamp;
        if (age > cacheConfig.maxAge) {
            // Cache expired
            await this.offlineStorage.delete('cachedResponses', url);
            return null;
        }
        
        return cacheData.response;
    }

    async cleanupCache(strategy) {
        const cacheConfig = this.cacheStrategies.get(strategy);
        if (!cacheConfig) return;
        
        const allCached = await this.offlineStorage.getAll('cachedResponses');
        const strategyCached = allCached.filter(item => item.strategy === strategy);
        
        // Remove expired entries
        const now = Date.now();
        const expiredEntries = strategyCached.filter(item => 
            now - item.timestamp > cacheConfig.maxAge
        );
        
        for (const entry of expiredEntries) {
            await this.offlineStorage.delete('cachedResponses', entry.url);
        }
        
        // Remove excess entries (keep most recent)
        const validEntries = strategyCached.filter(item => 
            now - item.timestamp <= cacheConfig.maxAge
        );
        
        if (validEntries.length > cacheConfig.maxEntries) {
            validEntries.sort((a, b) => b.timestamp - a.timestamp);
            const entriesToRemove = validEntries.slice(cacheConfig.maxEntries);
            
            for (const entry of entriesToRemove) {
                await this.offlineStorage.delete('cachedResponses', entry.url);
            }
        }
    }

    setupOfflineUI() {
        // Create offline indicator
        this.createOfflineIndicator();
        
        // Setup offline message handling
        this.setupOfflineMessageHandling();
    }

    createOfflineIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator hidden';
        indicator.innerHTML = `
            <div class="offline-content">
                <i class="fas fa-wifi-slash"></i>
                <span class="offline-text">You're offline</span>
                <span class="offline-subtext">Changes will sync when connection is restored</span>
            </div>
        `;
        
        // Add styles
        const styles = `
            .offline-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #f59e0b;
                color: white;
                padding: 8px 16px;
                text-align: center;
                z-index: 10000;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
            }
            
            .offline-indicator:not(.hidden) {
                transform: translateY(0);
            }
            
            .offline-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .offline-text {
                font-weight: 600;
            }
            
            .offline-subtext {
                font-size: 0.875rem;
                opacity: 0.9;
            }
            
            @media (max-width: 768px) {
                .offline-subtext {
                    display: none;
                }
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
        
        document.body.appendChild(indicator);
        this.offlineIndicator = indicator;
    }

    showOfflineIndicator() {
        if (this.offlineIndicator) {
            this.offlineIndicator.classList.remove('hidden');
        }
    }

    hideOfflineIndicator() {
        if (this.offlineIndicator) {
            this.offlineIndicator.classList.add('hidden');
        }
    }

    setupOfflineMessageHandling() {
        // Intercept form submissions when offline
        document.addEventListener('submit', (event) => {
            if (!this.isOnline) {
                event.preventDefault();
                this.handleOfflineFormSubmission(event.target);
            }
        });
        
        // Intercept API calls when offline
        this.interceptOfflineApiCalls();
    }

    handleOfflineFormSubmission(form) {
        // Extract form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Add to sync queue
        this.addToSyncQueue({
            type: 'api_call',
            url: form.action,
            method: form.method || 'POST',
            body: data,
            timestamp: Date.now()
        });
        
        // Show offline message
        this.showOfflineMessage('Your changes have been saved and will sync when you\'re back online.');
    }

    interceptOfflineApiCalls() {
        // This would typically be handled by the service worker
        // For now, we'll provide a method for components to use
        window.offlineCapableApiCall = async (url, options = {}) => {
            if (this.isOnline) {
                // Online - make normal API call
                return await fetch(url, options);
            } else {
                // Offline - check cache first, then queue for sync
                const cachedResponse = await this.getCachedResponse(url);
                
                if (cachedResponse && options.method === 'GET') {
                    return new Response(JSON.stringify(cachedResponse), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                // Queue for sync if it's a mutation
                if (options.method !== 'GET') {
                    await this.addToSyncQueue({
                        type: 'api_call',
                        url: url,
                        method: options.method,
                        headers: options.headers,
                        body: options.body,
                        timestamp: Date.now()
                    });
                }
                
                throw new Error('Offline - request queued for sync');
            }
        };
    }

    showOfflineMessage(message) {
        // Create temporary message
        const messageEl = document.createElement('div');
        messageEl.className = 'offline-message';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #374151;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            max-width: 90%;
            text-align: center;
        `;
        
        document.body.appendChild(messageEl);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    async prepareOfflineData() {
        // Cache essential data for offline use
        try {
            // Cache user data
            const userData = {
                username: localStorage.getItem('username'),
                userId: localStorage.getItem('user_id'),
                preferences: JSON.parse(localStorage.getItem('user_preferences') || '{}')
            };
            
            await this.offlineStorage.set('gameData', 'user', userData);
            
            // Cache recent game data if available
            if (window.currentGameState) {
                await this.offlineStorage.set('gameData', 'currentGame', window.currentGameState);
            }
            
            console.log('Offline data prepared');
            
        } catch (error) {
            console.error('Failed to prepare offline data:', error);
        }
    }

    async updateCachedData() {
        // Update cached data when coming back online
        try {
            // This would typically fetch fresh data and update caches
            console.log('Updating cached data after coming online');
            
        } catch (error) {
            console.error('Failed to update cached data:', error);
        }
    }

    setupFallbackOfflineMode() {
        // Basic offline mode without advanced features
        console.log('Using fallback offline mode');
        
        this.setupOnlineOfflineMonitoring();
        this.setupOfflineUI();
    }

    // Public API methods
    isOffline() {
        return !this.isOnline;
    }

    getSyncQueueLength() {
        return this.syncQueue.length;
    }

    async clearOfflineData() {
        await this.offlineStorage.clear('gameData');
        await this.offlineStorage.clear('cachedResponses');
        await this.offlineStorage.clear('offlineQueue');
        
        this.syncQueue = [];
        this.offlineData.clear();
        
        this.emit('offlineDataCleared');
    }

    async getOfflineStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return await navigator.storage.estimate();
        }
        
        return { usage: 0, quota: 0 };
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
                    console.error(`Error in offline capability callback for ${eventName}:`, error);
                }
            });
        }
    }

    destroy() {
        // Clean up event listeners
        window.removeEventListener('online', this.handleOnlineStatusChange);
        window.removeEventListener('offline', this.handleOnlineStatusChange);
        
        // Remove offline indicator
        if (this.offlineIndicator && this.offlineIndicator.parentNode) {
            this.offlineIndicator.parentNode.removeChild(this.offlineIndicator);
        }
        
        this.eventCallbacks.clear();
        this.syncQueue = [];
        this.offlineData.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileOfflineCapability;
} else if (typeof window !== 'undefined') {
    window.MobileOfflineCapability = MobileOfflineCapability;
}