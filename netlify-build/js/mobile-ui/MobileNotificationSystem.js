/**
 * Mobile Notification System
 * Provides mobile-optimized notifications for game events
 * Handles different notification types and user preferences
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

class MobileNotificationSystem {
    constructor() {
        this.isInitialized = false;
        this.notifications = new Map();
        this.notificationQueue = [];
        this.maxNotifications = 3;
        this.defaultDuration = 4000;
        
        // Notification settings
        this.settings = {
            enabled: true,
            sound: true,
            vibration: true,
            showOnLockScreen: false,
            priority: 'normal'
        };
        
        // Notification types configuration
        this.notificationTypes = {
            'game-start': {
                icon: '🎮',
                color: '#3b82f6',
                sound: 'game-start',
                vibration: [100, 50, 100],
                priority: 'high'
            },
            'turn': {
                icon: '⏰',
                color: '#10b981',
                sound: 'turn',
                vibration: [50],
                priority: 'high'
            },
            'game-won': {
                icon: '🏆',
                color: '#f59e0b',
                sound: 'victory',
                vibration: [200, 100, 200, 100, 200],
                priority: 'high'
            },
            'game-lost': {
                icon: '😔',
                color: '#ef4444',
                sound: 'defeat',
                vibration: [300],
                priority: 'normal'
            },
            'player-joined': {
                icon: '👋',
                color: '#8b5cf6',
                sound: 'join',
                vibration: [75],
                priority: 'normal'
            },
            'player-left': {
                icon: '👋',
                color: '#f97316',
                sound: 'leave',
                vibration: [75],
                priority: 'normal'
            },
            'connection': {
                icon: '📶',
                color: '#06b6d4',
                sound: 'connection',
                vibration: [50],
                priority: 'normal'
            },
            'error': {
                icon: '⚠️',
                color: '#ef4444',
                sound: 'error',
                vibration: [200, 100, 200],
                priority: 'high'
            },
            'warning': {
                icon: '⚠️',
                color: '#f59e0b',
                sound: 'warning',
                vibration: [150],
                priority: 'normal'
            },
            'info': {
                icon: 'ℹ️',
                color: '#3b82f6',
                sound: 'info',
                vibration: [50],
                priority: 'low'
            },
            'success': {
                icon: '✅',
                color: '#10b981',
                sound: 'success',
                vibration: [100],
                priority: 'normal'
            }
        };
        
        // Sound system
        this.soundSystem = {
            supported: 'Audio' in window,
            sounds: new Map(),
            volume: 0.7,
            muted: false
        };
        
        // Vibration system
        this.vibrationSystem = {
            supported: 'vibrate' in navigator,
            enabled: true
        };
        
        // Permission system
        this.permissions = {
            notifications: 'default',
            sound: 'granted',
            vibration: 'granted'
        };
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Load user settings
            this.loadSettings();
            
            // Initialize sound system
            this.initializeSoundSystem();
            
            // Initialize vibration system
            this.initializeVibrationSystem();
            
            // Request permissions
            await this.requestPermissions();
            
            // Setup notification container
            this.setupNotificationContainer();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Mobile Notification System initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Notification System:', error);
            throw error;
        }
    }

    loadSettings() {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('mobileNotificationSettings');
        if (savedSettings) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            } catch (error) {
                console.warn('Failed to load notification settings:', error);
            }
        }
    }

    saveSettings() {
        // Save settings to localStorage
        try {
            localStorage.setItem('mobileNotificationSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save notification settings:', error);
        }
    }

    initializeSoundSystem() {
        if (!this.soundSystem.supported) {
            console.warn('Audio not supported - sound notifications disabled');
            return;
        }
        
        // Initialize sound files
        const soundFiles = {
            'game-start': '/sounds/game-start.mp3',
            'turn': '/sounds/turn.mp3',
            'victory': '/sounds/victory.mp3',
            'defeat': '/sounds/defeat.mp3',
            'join': '/sounds/join.mp3',
            'leave': '/sounds/leave.mp3',
            'connection': '/sounds/connection.mp3',
            'error': '/sounds/error.mp3',
            'warning': '/sounds/warning.mp3',
            'info': '/sounds/info.mp3',
            'success': '/sounds/success.mp3'
        };
        
        // Preload sound files
        Object.entries(soundFiles).forEach(([name, url]) => {
            try {
                const audio = new Audio(url);
                audio.volume = this.soundSystem.volume;
                audio.preload = 'auto';
                this.soundSystem.sounds.set(name, audio);
            } catch (error) {
                console.warn(`Failed to load sound ${name}:`, error);
            }
        });
    }

    initializeVibrationSystem() {
        if (!this.vibrationSystem.supported) {
            console.warn('Vibration not supported - haptic feedback disabled');
            return;
        }
        
        // Test vibration support
        try {
            navigator.vibrate(1);
            console.log('Vibration system initialized');
        } catch (error) {
            console.warn('Vibration test failed:', error);
            this.vibrationSystem.supported = false;
        }
    }

    async requestPermissions() {
        // Request notification permission
        if ('Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                this.permissions.notifications = permission;
                console.log('Notification permission:', permission);
            } catch (error) {
                console.warn('Failed to request notification permission:', error);
            }
        }
        
        // Check other permissions (sound and vibration are usually granted by default)
        this.permissions.sound = 'granted';
        this.permissions.vibration = this.vibrationSystem.supported ? 'granted' : 'denied';
    }

    setupNotificationContainer() {
        // Create notification container
        this.container = document.createElement('div');
        this.container.id = 'mobile-notification-container';
        this.container.className = 'mobile-notification-container';
        
        // Add styles
        const css = `
            .mobile-notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
                max-width: 320px;
                width: calc(100vw - 40px);
            }
            
            .mobile-notification {
                background: rgba(0, 0, 0, 0.9);
                color: white;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                pointer-events: auto;
                transform: translateX(100%);
                transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                opacity: 0;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .mobile-notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .mobile-notification.hide {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .mobile-notification-icon {
                font-size: 24px;
                flex-shrink: 0;
                margin-top: 2px;
            }
            
            .mobile-notification-content {
                flex: 1;
                min-width: 0;
            }
            
            .mobile-notification-title {
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 4px;
                line-height: 1.2;
            }
            
            .mobile-notification-message {
                font-size: 14px;
                opacity: 0.9;
                line-height: 1.3;
                word-wrap: break-word;
            }
            
            .mobile-notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.7;
                flex-shrink: 0;
            }
            
            .mobile-notification-close:hover {
                opacity: 1;
            }
            
            .mobile-notification-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 0 0 12px 12px;
                transition: width linear;
            }
            
            .mobile-notification.priority-high {
                border-left: 4px solid #ef4444;
            }
            
            .mobile-notification.priority-normal {
                border-left: 4px solid #3b82f6;
            }
            
            .mobile-notification.priority-low {
                border-left: 4px solid #6b7280;
            }
            
            @media (max-width: 480px) {
                .mobile-notification-container {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    width: auto;
                    max-width: none;
                }
                
                .mobile-notification {
                    margin-bottom: 8px;
                    padding: 12px;
                }
                
                .mobile-notification-title {
                    font-size: 15px;
                }
                
                .mobile-notification-message {
                    font-size: 13px;
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'mobile-notification-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
        
        // Add container to document
        document.body.appendChild(this.container);
    }

    setupEventListeners() {
        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handlePageVisible();
            } else {
                this.handlePageHidden();
            }
        });
        
        // Listen for focus/blur events
        window.addEventListener('focus', () => {
            this.handleWindowFocus();
        });
        
        window.addEventListener('blur', () => {
            this.handleWindowBlur();
        });
    }

    // Public API methods
    show(title, message, type = 'info', options = {}) {
        if (!this.settings.enabled) return null;
        
        const notificationConfig = this.notificationTypes[type] || this.notificationTypes.info;
        const notificationOptions = {
            duration: this.defaultDuration,
            persistent: false,
            sound: this.settings.sound,
            vibration: this.settings.vibration,
            ...options
        };
        
        // Create notification object
        const notification = {
            id: this.generateNotificationId(),
            title,
            message,
            type,
            config: notificationConfig,
            options: notificationOptions,
            timestamp: Date.now(),
            element: null,
            timeoutId: null,
            progressInterval: null
        };
        
        // Add to queue if too many notifications
        if (this.notifications.size >= this.maxNotifications) {
            this.notificationQueue.push(notification);
            return notification.id;
        }
        
        // Show notification
        this.showNotification(notification);
        
        return notification.id;
    }

    showGameStart(message = 'The game has begun!') {
        return this.show('Game Started', message, 'game-start', { persistent: false });
    }

    showTurn(message = 'It\'s your turn!') {
        return this.show('Your Turn', message, 'turn', { persistent: false });
    }

    showGameWon(message = 'Congratulations! You won!') {
        return this.show('Victory!', message, 'game-won', { persistent: true });
    }

    showGameLost(message = 'Better luck next time!') {
        return this.show('Game Over', message, 'game-lost', { persistent: true });
    }

    showPlayerJoined(playerName) {
        return this.show('Player Joined', `${playerName} joined the game`, 'player-joined');
    }

    showPlayerLeft(playerName) {
        return this.show('Player Left', `${playerName} left the game`, 'player-left');
    }

    showConnectionStatus(status, message) {
        const titles = {
            connected: 'Connected',
            disconnected: 'Disconnected',
            reconnecting: 'Reconnecting',
            failed: 'Connection Failed'
        };
        
        return this.show(titles[status] || 'Connection', message, 'connection');
    }

    showError(message) {
        return this.show('Error', message, 'error', { persistent: true });
    }

    showWarning(message) {
        return this.show('Warning', message, 'warning');
    }

    showInfo(message) {
        return this.show('Info', message, 'info');
    }

    showSuccess(message) {
        return this.show('Success', message, 'success');
    }

    hide(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            this.hideNotification(notification);
        }
    }

    hideAll() {
        this.notifications.forEach(notification => {
            this.hideNotification(notification);
        });
    }

    // Internal methods
    showNotification(notification) {
        // Create notification element
        notification.element = this.createNotificationElement(notification);
        
        // Add to container
        this.container.appendChild(notification.element);
        
        // Add to active notifications
        this.notifications.set(notification.id, notification);
        
        // Trigger show animation
        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });
        
        // Play sound
        if (notification.options.sound) {
            this.playSound(notification.config.sound);
        }
        
        // Trigger vibration
        if (notification.options.vibration) {
            this.triggerVibration(notification.config.vibration);
        }
        
        // Show browser notification if page is hidden
        if (document.visibilityState === 'hidden') {
            this.showBrowserNotification(notification);
        }
        
        // Setup auto-hide
        if (!notification.options.persistent) {
            this.setupAutoHide(notification);
        }
        
        console.log('Mobile Notification shown:', notification.title);
    }

    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `mobile-notification priority-${notification.config.priority}`;
        element.style.borderLeftColor = notification.config.color;
        
        element.innerHTML = `
            <div class="mobile-notification-icon">${notification.config.icon}</div>
            <div class="mobile-notification-content">
                <div class="mobile-notification-title">${this.escapeHtml(notification.title)}</div>
                <div class="mobile-notification-message">${this.escapeHtml(notification.message)}</div>
            </div>
            <button class="mobile-notification-close" aria-label="Close notification">&times;</button>
            ${!notification.options.persistent ? '<div class="mobile-notification-progress"></div>' : ''}
        `;
        
        // Setup close button
        const closeButton = element.querySelector('.mobile-notification-close');
        closeButton.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // Setup tap to dismiss
        element.addEventListener('click', (e) => {
            if (e.target !== closeButton) {
                this.hideNotification(notification);
            }
        });
        
        return element;
    }

    setupAutoHide(notification) {
        const duration = notification.options.duration;
        const progressBar = notification.element.querySelector('.mobile-notification-progress');
        
        if (progressBar) {
            // Animate progress bar
            progressBar.style.width = '100%';
            progressBar.style.transitionDuration = `${duration}ms`;
            
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }
        
        // Setup timeout
        notification.timeoutId = setTimeout(() => {
            this.hideNotification(notification);
        }, duration);
    }

    hideNotification(notification) {
        if (!notification.element) return;
        
        // Clear timeout
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
            notification.timeoutId = null;
        }
        
        // Clear progress interval
        if (notification.progressInterval) {
            clearInterval(notification.progressInterval);
            notification.progressInterval = null;
        }
        
        // Trigger hide animation
        notification.element.classList.add('hide');
        notification.element.classList.remove('show');
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.element && notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            
            // Remove from active notifications
            this.notifications.delete(notification.id);
            
            // Show next notification from queue
            this.showNextFromQueue();
            
        }, 300); // Match CSS transition duration
        
        console.log('Mobile Notification hidden:', notification.title);
    }

    showNextFromQueue() {
        if (this.notificationQueue.length > 0 && this.notifications.size < this.maxNotifications) {
            const nextNotification = this.notificationQueue.shift();
            this.showNotification(nextNotification);
        }
    }

    playSound(soundName) {
        if (!this.settings.sound || this.soundSystem.muted || !this.soundSystem.supported) return;
        
        const audio = this.soundSystem.sounds.get(soundName);
        if (audio) {
            try {
                audio.currentTime = 0;
                audio.volume = this.soundSystem.volume;
                audio.play().catch(error => {
                    console.warn('Failed to play notification sound:', error);
                });
            } catch (error) {
                console.warn('Error playing notification sound:', error);
            }
        }
    }

    triggerVibration(pattern) {
        if (!this.settings.vibration || !this.vibrationSystem.supported || !this.vibrationSystem.enabled) return;
        
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.warn('Failed to trigger vibration:', error);
        }
    }

    showBrowserNotification(notification) {
        if (this.permissions.notifications !== 'granted' || !this.settings.showOnLockScreen) return;
        
        try {
            const browserNotification = new Notification(notification.title, {
                body: notification.message,
                icon: '/icons/notification-icon.png',
                badge: '/icons/notification-badge.png',
                tag: notification.id,
                requireInteraction: notification.options.persistent,
                silent: !this.settings.sound
            });
            
            // Auto-close browser notification
            if (!notification.options.persistent) {
                setTimeout(() => {
                    browserNotification.close();
                }, notification.options.duration);
            }
            
            // Handle click
            browserNotification.addEventListener('click', () => {
                window.focus();
                browserNotification.close();
            });
            
        } catch (error) {
            console.warn('Failed to show browser notification:', error);
        }
    }

    // Event handlers
    handlePageVisible() {
        // Resume notifications when page becomes visible
        console.log('Mobile Notifications: Page visible - resuming notifications');
    }

    handlePageHidden() {
        // Prepare for background notifications
        console.log('Mobile Notifications: Page hidden - enabling background notifications');
    }

    handleWindowFocus() {
        // Clear any browser notifications when window gains focus
        this.clearBrowserNotifications();
    }

    handleWindowBlur() {
        // Prepare for showing browser notifications
    }

    clearBrowserNotifications() {
        // Close any active browser notifications
        this.notifications.forEach(notification => {
            try {
                // Browser notifications are automatically managed
            } catch (error) {
                console.warn('Error clearing browser notifications:', error);
            }
        });
    }

    // Utility methods
    generateNotificationId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Settings management
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        
        // Apply settings changes
        if (newSettings.hasOwnProperty('sound')) {
            this.soundSystem.muted = !newSettings.sound;
        }
        
        if (newSettings.hasOwnProperty('vibration')) {
            this.vibrationSystem.enabled = newSettings.vibration;
        }
    }

    getSettings() {
        return { ...this.settings };
    }

    // Volume control
    setVolume(volume) {
        this.soundSystem.volume = Math.max(0, Math.min(1, volume));
        
        // Update all audio elements
        this.soundSystem.sounds.forEach(audio => {
            audio.volume = this.soundSystem.volume;
        });
    }

    getVolume() {
        return this.soundSystem.volume;
    }

    mute() {
        this.soundSystem.muted = true;
        this.settings.sound = false;
        this.saveSettings();
    }

    unmute() {
        this.soundSystem.muted = false;
        this.settings.sound = true;
        this.saveSettings();
    }

    isMuted() {
        return this.soundSystem.muted;
    }

    // Status methods
    getActiveNotifications() {
        return Array.from(this.notifications.values()).map(notification => ({
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            timestamp: notification.timestamp
        }));
    }

    getQueuedNotifications() {
        return this.notificationQueue.map(notification => ({
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            timestamp: notification.timestamp
        }));
    }

    isSupported() {
        return {
            notifications: 'Notification' in window,
            sound: this.soundSystem.supported,
            vibration: this.vibrationSystem.supported
        };
    }

    getPermissions() {
        return { ...this.permissions };
    }

    // Cleanup
    destroy() {
        // Hide all notifications
        this.hideAll();
        
        // Clear queue
        this.notificationQueue = [];
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handlePageVisible);
        window.removeEventListener('focus', this.handleWindowFocus);
        window.removeEventListener('blur', this.handleWindowBlur);
        
        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // Remove styles
        const styleElement = document.getElementById('mobile-notification-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        // Clear sound system
        this.soundSystem.sounds.clear();
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileNotificationSystem;
} else if (typeof window !== 'undefined') {
    window.MobileNotificationSystem = MobileNotificationSystem;
}