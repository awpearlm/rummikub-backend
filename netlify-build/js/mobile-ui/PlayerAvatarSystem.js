/**
 * Player Avatar System Component
 * Manages compact circular player avatars with turn indicators and status updates
 * Provides visual representation of players in the mobile game interface
 */

class PlayerAvatarSystem {
    constructor(container) {
        this.container = container;
        this.avatars = new Map();
        this.currentTurnPlayerId = null;
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            avatarSize: 44,
            maxAvatars: 6,
            animationDuration: 300,
            turnIndicatorSize: 3,
            colors: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
                '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
            ]
        };
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup container
            this.setupContainer();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Player Avatar System initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Player Avatar System:', error);
            throw error;
        }
    }

    setupContainer() {
        if (!this.container) {
            throw new Error('Container element is required for Player Avatar System');
        }
        
        // Add avatar system class
        this.container.classList.add('player-avatar-system');
        
        // Ensure proper styling
        this.container.style.display = 'flex';
        this.container.style.gap = '12px';
        this.container.style.alignItems = 'center';
        this.container.style.flexWrap = 'wrap';
    }

    setupEventListeners() {
        // Handle container clicks for avatar interactions
        this.container.addEventListener('click', (event) => {
            const avatarElement = event.target.closest('.player-avatar');
            if (avatarElement) {
                const playerId = avatarElement.dataset.playerId;
                if (playerId) {
                    this.handleAvatarClick(playerId, event);
                }
            }
        });
        
        // Handle touch events for mobile
        this.container.addEventListener('touchstart', (event) => {
            const avatarElement = event.target.closest('.player-avatar');
            if (avatarElement) {
                avatarElement.classList.add('touch-active');
            }
        });
        
        this.container.addEventListener('touchend', (event) => {
            const avatarElement = event.target.closest('.player-avatar');
            if (avatarElement) {
                setTimeout(() => {
                    avatarElement.classList.remove('touch-active');
                }, 150);
            }
        });
    }

    // Player management methods
    addPlayer(playerData) {
        const { playerId, playerName, isConnected = true, tileCount = 0, score = 0 } = playerData;
        
        // Validate player data
        if (!playerId || typeof playerId !== 'string' || playerId.trim().length === 0) {
            console.warn('Invalid player ID provided');
            return false;
        }
        
        if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
            console.warn('Invalid player name provided');
            return false;
        }
        
        if (this.avatars.has(playerId)) {
            console.warn(`Player ${playerId} already exists, updating instead`);
            return this.updatePlayer(playerData);
        }
        
        if (this.avatars.size >= this.config.maxAvatars) {
            console.warn('Maximum number of avatars reached');
            return false;
        }
        
        // Create avatar data
        const avatarData = {
            playerId,
            playerName,
            initial: this.getPlayerInitial(playerName),
            isConnected,
            tileCount,
            score,
            color: this.getPlayerColor(this.avatars.size),
            isCurrentTurn: false,
            element: null
        };
        
        // Create avatar element
        const avatarElement = this.createAvatarElement(avatarData);
        avatarData.element = avatarElement;
        
        // Add to container
        this.container.appendChild(avatarElement);
        
        // Store avatar data
        this.avatars.set(playerId, avatarData);
        
        // Emit event
        this.emit('playerAdded', { playerId, playerData: avatarData });
        
        return true;
    }

    removePlayer(playerId) {
        const avatarData = this.avatars.get(playerId);
        if (!avatarData) {
            console.warn(`Player ${playerId} not found`);
            return false;
        }
        
        // Remove element from DOM
        if (avatarData.element && avatarData.element.parentNode) {
            avatarData.element.parentNode.removeChild(avatarData.element);
        }
        
        // Remove from avatars map
        this.avatars.delete(playerId);
        
        // If this was the current turn player, clear turn indicator
        if (this.currentTurnPlayerId === playerId) {
            this.currentTurnPlayerId = null;
        }
        
        // Emit event
        this.emit('playerRemoved', { playerId });
        
        return true;
    }

    updatePlayer(playerData) {
        const { playerId } = playerData;
        const avatarData = this.avatars.get(playerId);
        
        if (!avatarData) {
            console.warn(`Player ${playerId} not found for update`);
            return false;
        }
        
        // Update avatar data
        Object.assign(avatarData, playerData);
        
        // Update visual representation
        this.updateAvatarElement(avatarData);
        
        // Emit event
        this.emit('playerUpdated', { playerId, playerData: avatarData });
        
        return true;
    }

    createAvatarElement(avatarData) {
        const { playerId, playerName, initial, color, isConnected, tileCount, score } = avatarData;
        
        // Create main avatar container
        const avatar = document.createElement('div');
        avatar.className = 'player-avatar touch-target touch-feedback';
        avatar.dataset.playerId = playerId;
        avatar.setAttribute('aria-label', `Player ${playerName}`);
        avatar.setAttribute('role', 'button');
        avatar.setAttribute('tabindex', '0');
        
        // Create avatar circle
        const circle = document.createElement('div');
        circle.className = 'player-avatar-circle';
        circle.style.backgroundColor = color;
        circle.textContent = initial;
        
        // Create turn indicator ring
        const turnIndicator = document.createElement('div');
        turnIndicator.className = 'player-avatar-turn-indicator';
        
        // Create connection status indicator
        const connectionStatus = document.createElement('div');
        connectionStatus.className = 'player-avatar-connection-status';
        connectionStatus.classList.toggle('connected', isConnected);
        
        // Create info tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'player-avatar-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-name">${playerName}</div>
            <div class="tooltip-stats">Tiles: ${tileCount} | Score: ${score}</div>
        `;
        
        // Assemble avatar
        avatar.appendChild(circle);
        avatar.appendChild(turnIndicator);
        avatar.appendChild(connectionStatus);
        avatar.appendChild(tooltip);
        
        return avatar;
    }

    updateAvatarElement(avatarData) {
        const { element, playerName, isConnected, tileCount, score, isCurrentTurn } = avatarData;
        
        if (!element) return;
        
        // Update connection status
        const connectionStatus = element.querySelector('.player-avatar-connection-status');
        if (connectionStatus) {
            connectionStatus.classList.toggle('connected', isConnected);
        }
        
        // Update turn indicator
        element.classList.toggle('current-turn', isCurrentTurn);
        
        // Update tooltip
        const tooltip = element.querySelector('.player-avatar-tooltip');
        if (tooltip) {
            tooltip.innerHTML = `
                <div class="tooltip-name">${playerName}</div>
                <div class="tooltip-stats">Tiles: ${tileCount} | Score: ${score}</div>
            `;
        }
        
        // Update opacity based on connection status
        element.style.opacity = isConnected ? '1' : '0.6';
        
        // Update aria-label
        element.setAttribute('aria-label', 
            `Player ${playerName}${isCurrentTurn ? ' (current turn)' : ''}${!isConnected ? ' (disconnected)' : ''}`
        );
    }

    // Turn management methods
    setCurrentTurn(playerId) {
        // Clear previous turn indicator
        if (this.currentTurnPlayerId) {
            const previousPlayer = this.avatars.get(this.currentTurnPlayerId);
            if (previousPlayer) {
                previousPlayer.isCurrentTurn = false;
                this.updateAvatarElement(previousPlayer);
            }
        }
        
        // Set new turn indicator
        const currentPlayer = this.avatars.get(playerId);
        if (currentPlayer) {
            currentPlayer.isCurrentTurn = true;
            this.updateAvatarElement(currentPlayer);
            this.currentTurnPlayerId = playerId;
            
            // Animate turn transition
            this.animateTurnTransition(currentPlayer.element);
            
            // Emit event
            this.emit('turnChanged', { playerId, playerData: currentPlayer });
        } else {
            console.warn(`Player ${playerId} not found for turn assignment`);
        }
    }

    clearCurrentTurn() {
        if (this.currentTurnPlayerId) {
            const currentPlayer = this.avatars.get(this.currentTurnPlayerId);
            if (currentPlayer) {
                currentPlayer.isCurrentTurn = false;
                this.updateAvatarElement(currentPlayer);
            }
            this.currentTurnPlayerId = null;
        }
    }

    getCurrentTurnPlayer() {
        return this.currentTurnPlayerId ? this.avatars.get(this.currentTurnPlayerId) : null;
    }

    // Connection status methods
    setPlayerConnected(playerId, isConnected) {
        const avatarData = this.avatars.get(playerId);
        if (avatarData) {
            avatarData.isConnected = isConnected;
            this.updateAvatarElement(avatarData);
            
            // Emit event
            this.emit('connectionStatusChanged', { playerId, isConnected });
        }
    }

    // Player stats methods
    updatePlayerStats(playerId, stats) {
        const { tileCount, score } = stats;
        const avatarData = this.avatars.get(playerId);
        
        if (avatarData) {
            if (tileCount !== undefined) avatarData.tileCount = tileCount;
            if (score !== undefined) avatarData.score = score;
            
            this.updateAvatarElement(avatarData);
            
            // Emit event
            this.emit('playerStatsUpdated', { playerId, stats: { tileCount: avatarData.tileCount, score: avatarData.score } });
        }
    }

    // Animation methods
    animateTurnTransition(avatarElement) {
        if (!avatarElement) return;
        
        // Add animation class
        avatarElement.classList.add('turn-transition');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            avatarElement.classList.remove('turn-transition');
        }, this.config.animationDuration);
    }

    // Utility methods
    getPlayerInitial(playerName) {
        if (!playerName || typeof playerName !== 'string') return '?';
        
        // Trim whitespace and check if empty
        const trimmed = playerName.trim();
        if (trimmed.length === 0) return '?';
        
        return trimmed.charAt(0).toUpperCase();
    }

    getPlayerColor(index) {
        return this.config.colors[index % this.config.colors.length];
    }

    // Event handling methods
    handleAvatarClick(playerId, event) {
        const avatarData = this.avatars.get(playerId);
        if (!avatarData) return;
        
        // Show/hide tooltip
        this.togglePlayerTooltip(avatarData.element);
        
        // Emit click event
        this.emit('avatarClicked', { playerId, playerData: avatarData, event });
    }

    togglePlayerTooltip(avatarElement) {
        if (!avatarElement) return;
        
        const tooltip = avatarElement.querySelector('.player-avatar-tooltip');
        if (tooltip) {
            const isVisible = tooltip.classList.contains('visible');
            
            // Hide all other tooltips
            this.hideAllTooltips();
            
            // Toggle current tooltip
            if (!isVisible) {
                tooltip.classList.add('visible');
                
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    tooltip.classList.remove('visible');
                }, 3000);
            }
        }
    }

    hideAllTooltips() {
        const tooltips = this.container.querySelectorAll('.player-avatar-tooltip');
        tooltips.forEach(tooltip => {
            tooltip.classList.remove('visible');
        });
    }

    // Public API methods
    getPlayer(playerId) {
        return this.avatars.get(playerId);
    }

    getAllPlayers() {
        return Array.from(this.avatars.values());
    }

    getPlayerCount() {
        return this.avatars.size;
    }

    clear() {
        // Remove all avatars
        this.avatars.forEach((avatarData, playerId) => {
            this.removePlayer(playerId);
        });
        
        this.currentTurnPlayerId = null;
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
        // Clear all avatars
        this.clear();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Remove container class
        if (this.container) {
            this.container.classList.remove('player-avatar-system');
        }
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerAvatarSystem;
} else if (typeof window !== 'undefined') {
    window.PlayerAvatarSystem = PlayerAvatarSystem;
}