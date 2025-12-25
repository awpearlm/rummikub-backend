/**
 * Smart Board Positioning System
 * Automatically positions and centers the game board view based on game events
 * Provides smooth animated transitions and turn-based positioning
 */

class SmartBoardPositioning {
    constructor(boardContainer, options = {}) {
        this.boardContainer = boardContainer;
        this.options = {
            animationDuration: 500,
            easing: 'ease-out',
            autoCenter: true,
            turnBasedPositioning: true,
            zoomLevels: {
                min: 0.5,
                max: 2.0,
                default: 1.0,
                optimal: 0.8
            },
            margins: {
                top: 20,
                right: 20,
                bottom: 20,
                left: 20
            },
            ...options
        };
        
        this.currentView = {
            x: 0,
            y: 0,
            zoom: this.options.zoomLevels.default,
            rotation: 0
        };
        
        this.targetView = { ...this.currentView };
        this.isAnimating = false;
        this.manualOverride = false;
        this.manualOverrideTimeout = null;
        
        // Board state tracking
        this.boardBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        this.lastPlacementPosition = null;
        this.currentPlayerAreas = [];
        
        // Animation system
        this.animationFrame = null;
        this.animationStartTime = null;
        this.animationStartView = null;
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    init() {
        // Setup container for positioning
        this.setupContainer();
        
        // Initialize view state
        this.resetToDefaultView();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Smart Board Positioning initialized');
    }

    setupContainer() {
        if (!this.boardContainer) {
            throw new Error('Board container is required');
        }
        
        // Ensure container has proper positioning
        const containerStyle = window.getComputedStyle(this.boardContainer);
        if (containerStyle.position === 'static') {
            this.boardContainer.style.position = 'relative';
        }
        
        // Setup transform origin
        this.boardContainer.style.transformOrigin = 'center center';
        
        // Get initial container dimensions
        this.updateContainerDimensions();
    }

    setupEventListeners() {
        // Listen for window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Listen for orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        // Listen for manual interactions (touch/mouse)
        this.setupManualInteractionListeners();
    }

    setupManualInteractionListeners() {
        let isManualInteraction = false;
        
        // Touch events
        this.boardContainer.addEventListener('touchstart', () => {
            isManualInteraction = true;
        });
        
        this.boardContainer.addEventListener('touchmove', (event) => {
            if (isManualInteraction && event.touches.length === 1) {
                this.handleManualPan(event);
            } else if (event.touches.length === 2) {
                this.handleManualZoom(event);
            }
        });
        
        this.boardContainer.addEventListener('touchend', () => {
            isManualInteraction = false;
            this.setManualOverride(true);
        });
        
        // Mouse events for desktop testing
        let isMouseDown = false;
        
        this.boardContainer.addEventListener('mousedown', () => {
            isMouseDown = true;
        });
        
        this.boardContainer.addEventListener('mousemove', (event) => {
            if (isMouseDown) {
                this.handleManualPan(event);
            }
        });
        
        this.boardContainer.addEventListener('mouseup', () => {
            isMouseDown = false;
            this.setManualOverride(true);
        });
        
        // Wheel event for zoom
        this.boardContainer.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.handleManualZoom(event);
            this.setManualOverride(true);
        });
    }

    // Core positioning methods
    centerOnTiles(tiles, options = {}) {
        if (!tiles || tiles.length === 0) return Promise.resolve();
        
        // Check manual override
        if (this.manualOverride && !options.forceOverride) {
            return Promise.resolve();
        }
        
        const bounds = this.calculateTilesBounds(tiles);
        return this.centerOnBounds(bounds, options);
    }

    centerOnPosition(x, y, options = {}) {
        // Validate input coordinates
        if (!isFinite(x) || !isFinite(y)) {
            return this.resetToDefaultView(options);
        }
        
        // Check manual override
        if (this.manualOverride && !options.forceOverride) {
            return Promise.resolve();
        }
        
        const targetView = {
            x: -x + this.containerDimensions.width / 2,
            y: -y + this.containerDimensions.height / 2,
            zoom: options.zoom || this.currentView.zoom,
            rotation: options.rotation || this.currentView.rotation
        };
        
        // Validate target view
        if (!isFinite(targetView.x) || !isFinite(targetView.y) || !isFinite(targetView.zoom)) {
            return this.resetToDefaultView(options);
        }
        
        return this.animateToView(targetView, options);
    }

    centerOnBounds(bounds, options = {}) {
        if (!bounds || !isFinite(bounds.minX) || !isFinite(bounds.minY) || 
            !isFinite(bounds.maxX) || !isFinite(bounds.maxY)) {
            // Return to default view for invalid bounds
            return this.resetToDefaultView(options);
        }
        
        // Check manual override
        if (this.manualOverride && !options.forceOverride) {
            return Promise.resolve();
        }
        
        // Calculate center of bounds
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // Validate center coordinates
        if (!isFinite(centerX) || !isFinite(centerY)) {
            return this.resetToDefaultView(options);
        }
        
        // Calculate optimal zoom to fit bounds
        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;
        
        // Ensure bounds have positive dimensions
        if (boundsWidth <= 0 || boundsHeight <= 0 || !isFinite(boundsWidth) || !isFinite(boundsHeight)) {
            return this.resetToDefaultView(options);
        }
        
        const containerWidth = this.containerDimensions.width - this.options.margins.left - this.options.margins.right;
        const containerHeight = this.containerDimensions.height - this.options.margins.top - this.options.margins.bottom;
        
        // Ensure container dimensions are valid
        if (containerWidth <= 0 || containerHeight <= 0) {
            return this.resetToDefaultView(options);
        }
        
        const zoomX = containerWidth / boundsWidth;
        const zoomY = containerHeight / boundsHeight;
        const optimalZoom = Math.min(zoomX, zoomY, this.options.zoomLevels.max);
        
        const targetView = {
            x: -centerX * optimalZoom + this.containerDimensions.width / 2,
            y: -centerY * optimalZoom + this.containerDimensions.height / 2,
            zoom: Math.max(optimalZoom, this.options.zoomLevels.min),
            rotation: options.rotation || this.currentView.rotation
        };
        
        // Validate target view
        if (!isFinite(targetView.x) || !isFinite(targetView.y) || !isFinite(targetView.zoom)) {
            return this.resetToDefaultView(options);
        }
        
        return this.animateToView(targetView, options);
    }

    centerOnPlayer(playerId, options = {}) {
        const playerAreas = this.getPlayerRelevantAreas(playerId);
        if (playerAreas.length === 0) {
            return this.resetToDefaultView(options);
        }
        
        const combinedBounds = this.combineBounds(playerAreas);
        return this.centerOnBounds(combinedBounds, options);
    }

    resetToDefaultView(options = {}) {
        const targetView = {
            x: 0,
            y: 0,
            zoom: this.options.zoomLevels.default,
            rotation: 0
        };
        
        return this.animateToView(targetView, options);
    }

    // Turn-based positioning
    handleTurnStart(playerId, gameState) {
        if (!this.options.turnBasedPositioning || this.manualOverride) {
            return Promise.resolve();
        }
        
        // Update current player areas
        this.updatePlayerAreas(playerId, gameState);
        
        // Center on player's relevant areas
        return this.centerOnPlayer(playerId, {
            reason: 'turnStart',
            playerId
        });
    }

    handleTilePlace(tiles, position, gameState) {
        if (!this.options.autoCenter) {
            return Promise.resolve();
        }
        
        // Store last placement position
        this.lastPlacementPosition = position;
        
        // Update board bounds
        this.updateBoardBounds(gameState);
        
        // If manual override is active, don't auto-center
        if (this.manualOverride) {
            return Promise.resolve();
        }
        
        // Center on the newly placed tiles
        return this.centerOnTiles(tiles, {
            reason: 'tilePlace',
            tiles,
            position
        });
    }

    handleBoardGrowth(gameState) {
        // Update board bounds
        this.updateBoardBounds(gameState);
        
        // Check if current zoom level is still optimal
        const currentBounds = this.calculateBoardBounds(gameState);
        const optimalZoom = this.calculateOptimalZoom(currentBounds);
        
        // If zoom needs significant adjustment and no manual override
        if (!this.manualOverride && Math.abs(this.currentView.zoom - optimalZoom) > 0.2) {
            return this.centerOnBounds(currentBounds, {
                reason: 'boardGrowth',
                zoom: optimalZoom
            });
        }
        
        return Promise.resolve();
    }

    // Animation system
    animateToView(targetView, options = {}) {
        // Validate target view
        if (!targetView || !isFinite(targetView.x) || !isFinite(targetView.y) || 
            !isFinite(targetView.zoom) || !isFinite(targetView.rotation)) {
            console.warn('Invalid target view provided to animateToView');
            return Promise.resolve();
        }
        
        // Check if animation is needed (views are identical)
        const deltaX = Math.abs(this.currentView.x - targetView.x);
        const deltaY = Math.abs(this.currentView.y - targetView.y);
        const deltaZoom = Math.abs(this.currentView.zoom - targetView.zoom);
        const deltaRotation = Math.abs(this.currentView.rotation - targetView.rotation);
        
        // If views are essentially identical, complete immediately
        if (deltaX < 0.1 && deltaY < 0.1 && deltaZoom < 0.001 && deltaRotation < 1.0) { // Increased rotation threshold
            this.currentView = { ...targetView };
            this.applyViewTransform();
            
            this.emit('positioningComplete', {
                finalView: { ...this.currentView },
                reason: options.reason
            });
            
            return Promise.resolve();
        }
        
        if (this.isAnimating) {
            this.cancelAnimation();
        }
        
        this.targetView = { ...targetView };
        this.animationStartView = { ...this.currentView };
        this.animationStartTime = performance.now();
        this.isAnimating = true;
        
        const duration = options.duration || this.options.animationDuration;
        const easing = options.easing || this.options.easing;
        
        return new Promise((resolve) => {
            const animate = (currentTime) => {
                const elapsed = currentTime - this.animationStartTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Apply easing function
                const easedProgress = this.applyEasing(progress, easing);
                
                // Validate eased progress
                if (!isFinite(easedProgress)) {
                    console.warn('Invalid eased progress, completing animation');
                    this.completeAnimation(resolve, options);
                    return;
                }
                
                // Interpolate view values
                this.currentView = this.interpolateViews(
                    this.animationStartView,
                    this.targetView,
                    easedProgress
                );
                
                // Validate interpolated view
                if (!isFinite(this.currentView.x) || !isFinite(this.currentView.y) || 
                    !isFinite(this.currentView.zoom) || !isFinite(this.currentView.rotation)) {
                    console.warn('Invalid interpolated view, completing animation');
                    this.completeAnimation(resolve, options);
                    return;
                }
                
                // Apply transform
                this.applyViewTransform();
                
                // Always emit progress event for non-identical views
                this.emit('positioningProgress', {
                    progress: easedProgress,
                    currentView: { ...this.currentView },
                    reason: options.reason
                });
                
                if (progress < 1) {
                    this.animationFrame = requestAnimationFrame(animate);
                } else {
                    this.completeAnimation(resolve, options);
                }
            };
            
            this.animationFrame = requestAnimationFrame(animate);
        });
    }

    completeAnimation(resolve, options) {
        this.isAnimating = false;
        this.animationFrame = null;
        this.animationStartTime = null;
        this.animationStartView = null;
        
        // Ensure final position is exact
        this.currentView = { ...this.targetView };
        this.applyViewTransform();
        
        // Emit completion event
        this.emit('positioningComplete', {
            finalView: { ...this.currentView },
            reason: options.reason
        });
        
        resolve();
    }

    cancelAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        this.isAnimating = false;
        this.animationStartTime = null;
        this.animationStartView = null;
    }

    applyViewTransform() {
        const transform = `translate(${this.currentView.x}px, ${this.currentView.y}px) ` +
                         `scale(${this.currentView.zoom}) ` +
                         `rotate(${this.currentView.rotation}deg)`;
        
        this.boardContainer.style.transform = transform;
    }

    // Easing functions
    applyEasing(progress, easingType) {
        switch (easingType) {
            case 'ease-in':
                return progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 2);
            case 'ease-in-out':
                return progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            case 'linear':
                return progress;
            default:
                return 1 - Math.pow(1 - progress, 2); // ease-out default
        }
    }

    interpolateViews(startView, endView, progress) {
        // Validate progress
        if (!isFinite(progress)) {
            progress = 1; // Complete animation if progress is invalid
        }
        
        progress = Math.max(0, Math.min(1, progress)); // Clamp to [0, 1]
        
        const result = {
            x: startView.x + (endView.x - startView.x) * progress,
            y: startView.y + (endView.y - startView.y) * progress,
            zoom: startView.zoom + (endView.zoom - startView.zoom) * progress,
            rotation: startView.rotation + (endView.rotation - startView.rotation) * progress
        };
        
        // Validate result
        if (!isFinite(result.x)) result.x = endView.x;
        if (!isFinite(result.y)) result.y = endView.y;
        if (!isFinite(result.zoom)) result.zoom = endView.zoom;
        if (!isFinite(result.rotation)) result.rotation = endView.rotation;
        
        return result;
    }

    // Manual interaction handling
    handleManualPan(event) {
        // This would implement manual panning logic
        // For now, just mark as manual override
        this.setManualOverride(true);
    }

    handleManualZoom(event) {
        // This would implement manual zoom logic
        // For now, just mark as manual override
        this.setManualOverride(true);
    }

    setManualOverride(active, duration = 10000) {
        this.manualOverride = active;
        
        if (this.manualOverrideTimeout) {
            clearTimeout(this.manualOverrideTimeout);
        }
        
        if (active && duration > 0) {
            this.manualOverrideTimeout = setTimeout(() => {
                this.manualOverride = false;
                this.emit('manualOverrideExpired');
            }, duration);
        }
        
        this.emit('manualOverrideChanged', { active });
    }

    // Calculation methods
    calculateTilesBounds(tiles) {
        if (!tiles || tiles.length === 0) return null;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let hasValidTile = false;
        
        tiles.forEach(tile => {
            const x = tile.x || tile.position?.x || 0;
            const y = tile.y || tile.position?.y || 0;
            const width = tile.width || 50;
            const height = tile.height || 70;
            
            // Only process tiles with finite coordinates
            if (isFinite(x) && isFinite(y) && isFinite(width) && isFinite(height)) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + width);
                maxY = Math.max(maxY, y + height);
                hasValidTile = true;
            }
        });
        
        // Return null if no valid tiles found
        if (!hasValidTile || !isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return null;
        }
        
        return { minX, minY, maxX, maxY };
    }

    calculateBoardBounds(gameState) {
        if (!gameState || !gameState.board || !Array.isArray(gameState.board)) {
            return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let hasValidTiles = false;
        
        // Calculate bounds from all tiles on board
        gameState.board.forEach((set, setIndex) => {
            if (Array.isArray(set)) {
                set.forEach((tile, tileIndex) => {
                    const x = setIndex * 60 + tileIndex * 52; // Approximate positioning
                    const y = setIndex * 80;
                    
                    if (isFinite(x) && isFinite(y)) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + 50);
                        maxY = Math.max(maxY, y + 70);
                        hasValidTiles = true;
                    }
                });
            }
        });
        
        // If no valid tiles found, return default bounds
        if (!hasValidTiles || !isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
        }
        
        // Add padding
        const padding = 50;
        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding
        };
    }

    calculateOptimalZoom(bounds) {
        if (!bounds) return this.options.zoomLevels.default;
        
        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;
        
        const containerWidth = this.containerDimensions.width - this.options.margins.left - this.options.margins.right;
        const containerHeight = this.containerDimensions.height - this.options.margins.top - this.options.margins.bottom;
        
        const zoomX = containerWidth / boundsWidth;
        const zoomY = containerHeight / boundsHeight;
        
        return Math.max(
            Math.min(zoomX, zoomY, this.options.zoomLevels.max),
            this.options.zoomLevels.min
        );
    }

    combineBounds(boundsArray) {
        if (!boundsArray || boundsArray.length === 0) return null;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        boundsArray.forEach(bounds => {
            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);
        });
        
        return { minX, minY, maxX, maxY };
    }

    // Player area management
    updatePlayerAreas(playerId, gameState) {
        // This would calculate areas relevant to the current player
        // For now, use the entire board
        this.currentPlayerAreas = [this.calculateBoardBounds(gameState)];
    }

    getPlayerRelevantAreas(playerId) {
        return this.currentPlayerAreas;
    }

    // State management
    updateBoardBounds(gameState) {
        this.boardBounds = this.calculateBoardBounds(gameState);
    }

    updateContainerDimensions() {
        const rect = this.boardContainer.getBoundingClientRect();
        this.containerDimensions = {
            width: rect.width,
            height: rect.height
        };
    }

    // Event handlers
    handleResize() {
        this.updateContainerDimensions();
        
        // Recalculate current view if needed
        if (!this.manualOverride && this.boardBounds) {
            this.centerOnBounds(this.boardBounds, {
                reason: 'resize',
                duration: 200
            });
        }
    }

    handleOrientationChange() {
        this.updateContainerDimensions();
        
        // Reset view after orientation change
        setTimeout(() => {
            if (!this.manualOverride && this.boardBounds) {
                this.centerOnBounds(this.boardBounds, {
                    reason: 'orientationChange',
                    duration: 300
                });
            }
        }, 200);
    }

    // Public API
    getCurrentView() {
        return { ...this.currentView };
    }

    getTargetView() {
        return { ...this.targetView };
    }

    isManualOverrideActive() {
        return this.manualOverride;
    }

    clearManualOverride() {
        this.setManualOverride(false);
    }

    setZoom(zoom, options = {}) {
        const clampedZoom = Math.max(
            Math.min(zoom, this.options.zoomLevels.max),
            this.options.zoomLevels.min
        );
        
        const targetView = {
            ...this.currentView,
            zoom: clampedZoom
        };
        
        return this.animateToView(targetView, options);
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
        // Cancel any ongoing animation
        this.cancelAnimation();
        
        // Clear timeouts
        if (this.manualOverrideTimeout) {
            clearTimeout(this.manualOverrideTimeout);
        }
        
        // Clear event listeners
        this.eventCallbacks.clear();
        
        // Reset container transform
        if (this.boardContainer) {
            this.boardContainer.style.transform = '';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartBoardPositioning;
} else if (typeof window !== 'undefined') {
    window.SmartBoardPositioning = SmartBoardPositioning;
}