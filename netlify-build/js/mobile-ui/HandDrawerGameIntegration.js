/**
 * Hand Drawer Game Integration
 * Connects the HandDrawer component to existing game logic and actions
 * Provides accessibility features and touch target compliance
 */

class HandDrawerGameIntegration {
    constructor(handDrawerComponent, gameInstance) {
        this.handDrawer = handDrawerComponent;
        this.game = gameInstance;
        this.isInitialized = false;
        
        // Action handlers mapping
        this.actionHandlers = new Map();
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup action handlers
            this.setupActionHandlers();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup accessibility features
            this.setupAccessibilityFeatures();
            
            // Validate touch targets
            this.validateTouchTargets();
            
            this.isInitialized = true;
            console.log('Hand Drawer Game Integration initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Hand Drawer Game Integration:', error);
            throw error;
        }
    }

    setupActionHandlers() {
        // Map drawer actions to game methods
        this.actionHandlers.set('draw', this.handleDrawAction.bind(this));
        this.actionHandlers.set('sortColor', this.handleSortColorAction.bind(this));
        this.actionHandlers.set('sortNumber', this.handleSortNumberAction.bind(this));
        this.actionHandlers.set('reset', this.handleResetAction.bind(this));
    }

    setupEventListeners() {
        // Listen to hand drawer events
        this.handDrawer.on('actionClicked', (data) => {
            this.handleActionClicked(data);
        });
        
        this.handDrawer.on('tileSelectionChanged', (data) => {
            this.handleTileSelectionChanged(data);
        });
        
        this.handDrawer.on('expanded', () => {
            this.handleDrawerExpanded();
        });
        
        this.handDrawer.on('collapsed', () => {
            this.handleDrawerCollapsed();
        });
        
        // Listen to game events if available
        if (this.game && typeof this.game.on === 'function') {
            this.game.on('gameStateUpdated', (data) => {
                this.handleGameStateUpdated(data);
            });
            
            this.game.on('playerHandUpdated', (data) => {
                this.handlePlayerHandUpdated(data);
            });
            
            this.game.on('turnChanged', (data) => {
                this.handleTurnChanged(data);
            });
        }
    }

    setupAccessibilityFeatures() {
        // Ensure all action buttons have proper accessibility attributes
        const actionButtons = this.handDrawer.actionButtons;
        
        if (actionButtons) {
            actionButtons.forEach((button, actionId) => {
                // Ensure proper ARIA labels
                if (!button.getAttribute('aria-label')) {
                    const labels = {
                        'draw': 'Draw a tile from the deck',
                        'sortColor': 'Sort tiles by color',
                        'sortNumber': 'Sort tiles by number',
                        'reset': 'Reset board view to center'
                    };
                    button.setAttribute('aria-label', labels[actionId] || `${actionId} action`);
                }
                
                // Ensure proper role
                if (!button.getAttribute('role')) {
                    button.setAttribute('role', 'button');
                }
                
                // Ensure keyboard accessibility
                if (!button.getAttribute('tabindex')) {
                    button.setAttribute('tabindex', '0');
                }
                
                // Add keyboard event listeners if not present
                this.ensureKeyboardAccessibility(button, actionId);
            });
        }
    }

    ensureKeyboardAccessibility(button, actionId) {
        // Check if keyboard listeners are already attached
        if (button.hasAttribute('data-keyboard-accessible')) return;
        
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleActionClicked({ actionId });
            }
        });
        
        button.setAttribute('data-keyboard-accessible', 'true');
    }

    validateTouchTargets() {
        // Validate that all interactive elements meet minimum touch target size (44px)
        const minTouchSize = 44;
        const actionButtons = this.handDrawer.actionButtons;
        
        if (actionButtons) {
            actionButtons.forEach((button, actionId) => {
                const rect = button.getBoundingClientRect();
                
                if (rect.width < minTouchSize || rect.height < minTouchSize) {
                    console.warn(`Action button '${actionId}' does not meet minimum touch target size (${rect.width}x${rect.height} < ${minTouchSize}px)`);
                    
                    // Apply minimum size
                    button.style.minWidth = `${minTouchSize}px`;
                    button.style.minHeight = `${minTouchSize}px`;
                }
            });
        }
        
        // Validate drawer handle
        const handle = this.handDrawer.handleElement;
        if (handle) {
            const rect = handle.getBoundingClientRect();
            if (rect.width < minTouchSize || rect.height < minTouchSize) {
                console.warn(`Drawer handle does not meet minimum touch target size (${rect.width}x${rect.height} < ${minTouchSize}px)`);
                
                // Apply minimum size
                handle.style.minWidth = `${minTouchSize}px`;
                handle.style.minHeight = `${minTouchSize}px`;
            }
        }
    }

    // Action handlers
    async handleDrawAction() {
        try {
            // Check if it's the player's turn
            if (this.game && typeof this.game.isMyTurn === 'function' && !this.game.isMyTurn()) {
                this.showNotification("It's not your turn!", 'error');
                return false;
            }
            
            // Check if there are tiles left in the deck
            if (this.game && this.game.gameState && this.game.gameState.deckSize === 0) {
                this.showNotification("No tiles left in the deck!", 'warning');
                return false;
            }
            
            // Call the game's draw tile method
            if (this.game && typeof this.game.drawTile === 'function') {
                this.game.drawTile();
                
                // Auto-collapse drawer after drawing
                setTimeout(() => {
                    this.handDrawer.collapse();
                }, 1000);
                
                return true;
            } else {
                console.warn('Game drawTile method not available');
                return false;
            }
        } catch (error) {
            console.error('Error handling draw action:', error);
            this.showNotification('Failed to draw tile', 'error');
            return false;
        }
    }

    async handleSortColorAction() {
        try {
            // Call the game's sort by color method
            if (this.game && typeof this.game.sortHandByColor === 'function') {
                this.game.sortHandByColor();
                
                // Update hand drawer tiles to match game state
                this.syncHandDrawerWithGameState();
                
                return true;
            } else {
                // Fallback to hand drawer's internal sorting
                this.handDrawer.sortByColor();
                this.showNotification('Hand sorted by color', 'info');
                return true;
            }
        } catch (error) {
            console.error('Error handling sort by color action:', error);
            this.showNotification('Failed to sort by color', 'error');
            return false;
        }
    }

    async handleSortNumberAction() {
        try {
            // Call the game's sort by number method
            if (this.game && typeof this.game.sortHandByNumber === 'function') {
                this.game.sortHandByNumber();
                
                // Update hand drawer tiles to match game state
                this.syncHandDrawerWithGameState();
                
                return true;
            } else {
                // Fallback to hand drawer's internal sorting
                this.handDrawer.sortByNumber();
                this.showNotification('Hand sorted by number', 'info');
                return true;
            }
        } catch (error) {
            console.error('Error handling sort by number action:', error);
            this.showNotification('Failed to sort by number', 'error');
            return false;
        }
    }

    async handleResetAction() {
        try {
            // Reset board view if game has this functionality
            if (this.game && typeof this.game.resetBoardView === 'function') {
                this.game.resetBoardView();
            } else if (this.game && typeof this.game.centerBoard === 'function') {
                this.game.centerBoard();
            } else {
                // Emit event for board reset
                this.emit('boardResetRequested');
            }
            
            // Clear tile selection
            this.handDrawer.clearSelection();
            
            this.showNotification('Board view reset', 'info');
            return true;
        } catch (error) {
            console.error('Error handling reset action:', error);
            this.showNotification('Failed to reset board view', 'error');
            return false;
        }
    }

    // Event handlers
    handleActionClicked(data) {
        const { actionId } = data;
        const handler = this.actionHandlers.get(actionId);
        
        if (handler) {
            handler();
        } else {
            console.warn(`No handler found for action: ${actionId}`);
        }
        
        // Emit integration event
        this.emit('actionHandled', { actionId, success: !!handler });
    }

    handleTileSelectionChanged(data) {
        const { tileId, isSelected, selectedTiles } = data;
        
        // Update game selection if available
        if (this.game && typeof this.game.updateTileSelection === 'function') {
            this.game.updateTileSelection(tileId, isSelected);
        }
        
        // Emit integration event
        this.emit('tileSelectionChanged', data);
    }

    handleDrawerExpanded() {
        // Update action button states based on game state
        this.updateActionButtonStates();
        
        // Emit integration event
        this.emit('drawerExpanded');
    }

    handleDrawerCollapsed() {
        // Clear any temporary states
        this.handDrawer.clearSelection();
        
        // Emit integration event
        this.emit('drawerCollapsed');
    }

    handleGameStateUpdated(data) {
        // Sync hand drawer with updated game state
        this.syncHandDrawerWithGameState();
        
        // Update action button states
        this.updateActionButtonStates();
    }

    handlePlayerHandUpdated(data) {
        // Sync hand drawer tiles with player hand
        this.syncHandDrawerWithGameState();
    }

    handleTurnChanged(data) {
        // Update action button states based on turn
        this.updateActionButtonStates();
        
        // Auto-collapse drawer if it's not the player's turn
        if (data && !data.isMyTurn && this.handDrawer.getIsExpanded()) {
            setTimeout(() => {
                this.handDrawer.collapse();
            }, 500);
        }
    }

    // Utility methods
    syncHandDrawerWithGameState() {
        if (!this.game || !this.game.gameState || !this.game.gameState.playerHand) {
            return;
        }
        
        // Clear existing tiles
        this.handDrawer.clearAllTiles();
        
        // Add tiles from game state
        const tiles = this.game.gameState.playerHand.map(tile => ({
            id: tile.id || `${tile.color}_${tile.number}_${Math.random()}`,
            color: tile.color,
            number: tile.number,
            isJoker: tile.isJoker || false
        }));
        
        this.handDrawer.addTiles(tiles);
    }

    updateActionButtonStates() {
        const actionButtons = this.handDrawer.actionButtons;
        if (!actionButtons) return;
        
        // Update draw button state
        const drawButton = actionButtons.get('draw');
        if (drawButton) {
            const canDraw = this.canDrawTile();
            drawButton.disabled = !canDraw;
            drawButton.classList.toggle('disabled', !canDraw);
            
            // Update aria-label based on state
            if (canDraw) {
                drawButton.setAttribute('aria-label', 'Draw a tile from the deck');
            } else {
                drawButton.setAttribute('aria-label', 'Cannot draw tile right now');
            }
        }
        
        // Update sort button states
        const sortColorButton = actionButtons.get('sortColor');
        const sortNumberButton = actionButtons.get('sortNumber');
        const hasTiles = this.handDrawer.getTileCount() > 0;
        
        if (sortColorButton) {
            sortColorButton.disabled = !hasTiles;
            sortColorButton.classList.toggle('disabled', !hasTiles);
        }
        
        if (sortNumberButton) {
            sortNumberButton.disabled = !hasTiles;
            sortNumberButton.classList.toggle('disabled', !hasTiles);
        }
        
        // Update reset button state
        const resetButton = actionButtons.get('reset');
        if (resetButton) {
            // Reset is generally always available
            resetButton.disabled = false;
            resetButton.classList.remove('disabled');
        }
    }

    canDrawTile() {
        if (!this.game) return false;
        
        // Check if it's the player's turn
        if (typeof this.game.isMyTurn === 'function' && !this.game.isMyTurn()) {
            return false;
        }
        
        // Check if there are tiles left in the deck
        if (this.game.gameState && this.game.gameState.deckSize === 0) {
            return false;
        }
        
        // Check if player has already played tiles this turn
        if (this.game.hasPlayedTilesThisTurn) {
            return false;
        }
        
        // Check if tiles are selected (usually prevents drawing)
        if (this.handDrawer.hasSelectedTiles()) {
            return false;
        }
        
        return true;
    }

    showNotification(message, type = 'info') {
        // Use game's notification system if available
        if (this.game && typeof this.game.showNotification === 'function') {
            this.game.showNotification(message, type);
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Public API methods
    getHandDrawer() {
        return this.handDrawer;
    }

    getGame() {
        return this.game;
    }

    isInitialized() {
        return this.isInitialized;
    }

    // Manual sync methods
    syncFromGame() {
        this.syncHandDrawerWithGameState();
        this.updateActionButtonStates();
    }

    syncToGame() {
        // Sync hand drawer state back to game if needed
        const selectedTiles = this.handDrawer.getSelectedTiles();
        
        if (this.game && typeof this.game.setSelectedTiles === 'function') {
            this.game.setSelectedTiles(selectedTiles);
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
        // Clear event listeners
        this.eventCallbacks.clear();
        
        // Clear action handlers
        this.actionHandlers.clear();
        
        // Clear references
        this.handDrawer = null;
        this.game = null;
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandDrawerGameIntegration;
} else if (typeof window !== 'undefined') {
    window.HandDrawerGameIntegration = HandDrawerGameIntegration;
}