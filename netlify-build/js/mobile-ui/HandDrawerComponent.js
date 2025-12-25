/**
 * Hand Drawer Component
 * Provides a sliding drawer interface for managing player tiles in mobile game view
 * Features smooth animations, touch controls, and responsive tile management
 */

class HandDrawerComponent {
    constructor(container) {
        this.container = container;
        this.isInitialized = false;
        this.isExpanded = false;
        this.isAnimating = false;
        this.tiles = [];
        this.selectedTiles = [];
        
        // Configuration
        this.config = {
            collapsedHeight: 80,
            expandedHeight: 240,
            animationDuration: 300,
            animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            tileSize: 48,
            tileGap: 8,
            tilesPerRow: 6,
            touchThreshold: 10,
            autoCollapseDelay: 2000
        };
        
        // Animation state
        this.animationState = {
            startHeight: 0,
            targetHeight: 0,
            startTime: 0,
            duration: 0,
            animationId: null
        };
        
        // Touch handling
        this.touchState = {
            startY: 0,
            currentY: 0,
            isDragging: false,
            startTime: 0
        };
        
        // Multi-touch support
        this.isMultiTouchActive = false;
        this.multiTouchTiles = new Set();
        
        // Auto-collapse timer
        this.autoCollapseTimer = null;
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Create drawer structure
            this.createDrawerStructure();
            
            // Setup touch handling
            this.setupTouchHandling();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Apply initial state
            this.applyInitialState();
            
            // Setup performance optimizations
            this.setupPerformanceOptimizations();
            
            this.isInitialized = true;
            console.log('Hand Drawer Component initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Hand Drawer Component:', error);
            throw error;
        }
    }

    createDrawerStructure() {
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create drawer handle
        this.createDrawerHandle();
        
        // Create tiles container
        this.createTilesContainer();
        
        // Create action bar
        this.createActionBar();
        
        // Apply initial classes
        this.container.classList.add('hand-drawer-component');
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Player hand tiles');
    }

    createDrawerHandle() {
        this.handleElement = document.createElement('div');
        this.handleElement.className = 'mobile-drawer-handle touch-target';
        this.handleElement.setAttribute('role', 'button');
        this.handleElement.setAttribute('aria-label', 'Expand hand drawer');
        this.handleElement.setAttribute('tabindex', '0');
        
        // Create handle indicator
        const handleIndicator = document.createElement('div');
        handleIndicator.className = 'mobile-drawer-handle-indicator';
        this.handleElement.appendChild(handleIndicator);
        
        // Create expand/collapse hint text
        const hintText = document.createElement('div');
        hintText.className = 'drawer-hint-text';
        hintText.textContent = 'Tap to expand';
        this.handleElement.appendChild(hintText);
        
        this.container.appendChild(this.handleElement);
    }

    createTilesContainer() {
        this.tilesContainer = document.createElement('div');
        this.tilesContainer.className = 'hand-drawer-tiles-container';
        this.tilesContainer.setAttribute('role', 'grid');
        this.tilesContainer.setAttribute('aria-label', 'Player tiles');
        
        // Create tiles grid
        this.tilesGrid = document.createElement('div');
        this.tilesGrid.className = 'hand-drawer-tiles-grid';
        this.tilesContainer.appendChild(this.tilesGrid);
        
        // Create empty state message
        this.emptyStateElement = document.createElement('div');
        this.emptyStateElement.className = 'hand-drawer-empty-state';
        this.emptyStateElement.innerHTML = `
            <div class="empty-state-icon">🎲</div>
            <div class="empty-state-text">No tiles in hand</div>
            <div class="empty-state-hint">Draw tiles to get started</div>
        `;
        this.tilesContainer.appendChild(this.emptyStateElement);
        
        this.container.appendChild(this.tilesContainer);
    }

    createActionBar() {
        this.actionBar = document.createElement('div');
        this.actionBar.className = 'mobile-game-action-bar';
        this.actionBar.setAttribute('role', 'toolbar');
        this.actionBar.setAttribute('aria-label', 'Game actions');
        
        // Create action buttons
        this.createActionButtons();
        
        this.container.appendChild(this.actionBar);
    }

    createActionButtons() {
        const actions = [
            {
                id: 'draw',
                label: 'Draw Tile',
                icon: '🎯',
                className: 'action-button-draw'
            },
            {
                id: 'sortColor',
                label: 'Sort by Color',
                icon: '🎨',
                className: 'action-button-sort-color'
            },
            {
                id: 'sortNumber',
                label: 'Sort by Number',
                icon: '🔢',
                className: 'action-button-sort-number'
            },
            {
                id: 'reset',
                label: 'Reset View',
                icon: '🔄',
                className: 'action-button-reset'
            }
        ];
        
        this.actionButtons = new Map();
        
        actions.forEach(action => {
            const button = document.createElement('button');
            button.className = `mobile-button action-button ${action.className} touch-target`;
            button.setAttribute('aria-label', action.label);
            button.setAttribute('data-action', action.id);
            
            // Create button content
            const icon = document.createElement('span');
            icon.className = 'action-button-icon';
            icon.textContent = action.icon;
            
            const label = document.createElement('span');
            label.className = 'action-button-label';
            label.textContent = action.label.split(' ')[0]; // First word only
            
            button.appendChild(icon);
            button.appendChild(label);
            
            this.actionButtons.set(action.id, button);
            this.actionBar.appendChild(button);
        });
    }

    setupTouchHandling() {
        // Handle touch events on the handle
        this.handleElement.addEventListener('touchstart', (event) => {
            this.handleTouchStart(event);
        }, { passive: false });
        
        this.handleElement.addEventListener('touchmove', (event) => {
            this.handleTouchMove(event);
        }, { passive: false });
        
        this.handleElement.addEventListener('touchend', (event) => {
            this.handleTouchEnd(event);
        }, { passive: false });
        
        // Handle click events as fallback
        this.handleElement.addEventListener('click', (event) => {
            if (!this.touchState.isDragging) {
                this.toggle();
            }
        });
        
        // Handle keyboard events
        this.handleElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.toggle();
            }
        });
    }

    handleTouchStart(event) {
        if (this.isAnimating) return;
        
        const touch = event.touches[0];
        this.touchState = {
            startY: touch.clientY,
            currentY: touch.clientY,
            isDragging: false,
            startTime: Date.now()
        };
        
        // Prevent default to avoid scrolling
        event.preventDefault();
    }

    handleTouchMove(event) {
        if (!this.touchState.startY) return;
        
        const touch = event.touches[0];
        this.touchState.currentY = touch.clientY;
        
        const deltaY = this.touchState.startY - this.touchState.currentY;
        const absDeltaY = Math.abs(deltaY);
        
        // Start dragging if threshold exceeded
        if (!this.touchState.isDragging && absDeltaY > this.config.touchThreshold) {
            this.touchState.isDragging = true;
            this.container.classList.add('dragging');
        }
        
        if (this.touchState.isDragging) {
            // Provide visual feedback during drag
            const progress = Math.max(0, Math.min(1, absDeltaY / 100));
            this.updateDragFeedback(progress, deltaY > 0);
        }
        
        event.preventDefault();
    }

    handleTouchEnd(event) {
        if (!this.touchState.startY) return;
        
        const deltaY = this.touchState.startY - this.touchState.currentY;
        const absDeltaY = Math.abs(deltaY);
        const duration = Date.now() - this.touchState.startTime;
        const velocity = absDeltaY / duration;
        
        // Determine action based on gesture
        if (this.touchState.isDragging) {
            // Swipe gesture
            if (velocity > 0.5 || absDeltaY > 50) {
                if (deltaY > 0) {
                    // Swipe up - expand
                    this.expand();
                } else {
                    // Swipe down - collapse
                    this.collapse();
                }
            } else {
                // Return to current state
                this.isExpanded ? this.expand() : this.collapse();
            }
        } else if (duration < 300 && absDeltaY < this.config.touchThreshold) {
            // Tap gesture
            this.toggle();
        }
        
        // Clean up
        this.container.classList.remove('dragging');
        this.clearDragFeedback();
        this.touchState = {
            startY: 0,
            currentY: 0,
            isDragging: false,
            startTime: 0
        };
    }

    updateDragFeedback(progress, isUpward) {
        const indicator = this.handleElement.querySelector('.mobile-drawer-handle-indicator');
        if (indicator) {
            const rotation = isUpward ? progress * 180 : -progress * 180;
            indicator.style.transform = `rotate(${rotation}deg)`;
            indicator.style.opacity = 0.5 + (progress * 0.5);
        }
    }

    clearDragFeedback() {
        const indicator = this.handleElement.querySelector('.mobile-drawer-handle-indicator');
        if (indicator) {
            indicator.style.transform = '';
            indicator.style.opacity = '';
        }
    }

    setupEventListeners() {
        // Action button events
        this.actionButtons.forEach((button, actionId) => {
            button.addEventListener('click', () => {
                this.handleActionClick(actionId);
            });
        });
        
        // Tile selection events
        this.tilesContainer.addEventListener('click', (event) => {
            const tileElement = event.target.closest('.hand-tile');
            if (tileElement) {
                this.handleTileClick(tileElement);
            }
        });
        
        // Multi-touch support for tile selection
        this.tilesContainer.addEventListener('touchstart', (event) => {
            this.handleMultiTouchStart(event);
        }, { passive: true });
        
        this.tilesContainer.addEventListener('touchend', (event) => {
            this.handleMultiTouchEnd(event);
        }, { passive: true });
        
        // Auto-collapse on outside click
        document.addEventListener('click', (event) => {
            if (this.isExpanded && !this.container.contains(event.target)) {
                this.scheduleAutoCollapse();
            }
        });
        
        // Prevent auto-collapse on drawer interaction
        this.container.addEventListener('click', () => {
            this.clearAutoCollapse();
        });
        
        // Handle resize for responsive grid layout
        window.addEventListener('resize', () => {
            if (this.tiles.length > 0) {
                this.updateGridLayout();
            }
        });
    }

    applyInitialState() {
        // Set initial collapsed state
        this.container.style.height = `${this.config.collapsedHeight}px`;
        this.container.classList.add('collapsed');
        this.container.classList.remove('expanded'); // Ensure expanded is not set
        
        // Hide tiles container initially
        this.tilesContainer.style.opacity = '0';
        this.tilesContainer.style.transform = 'translateY(20px)';
        
        // Update accessibility attributes
        this.updateAccessibilityAttributes();
        
        // Update empty state
        this.updateEmptyState();
    }

    setupPerformanceOptimizations() {
        // Enable hardware acceleration
        this.container.style.transform = 'translateZ(0)';
        this.container.style.willChange = 'height, transform';
        
        // Optimize tiles container
        this.tilesContainer.style.transform = 'translateZ(0)';
        this.tilesContainer.style.willChange = 'opacity, transform';
        
        // Optimize action bar
        this.actionBar.style.transform = 'translateZ(0)';
    }

    // Public API methods
    async expand() {
        if (this.isExpanded || this.isAnimating) return;
        
        this.isAnimating = true;
        this.clearAutoCollapse();
        
        try {
            // Update state
            this.isExpanded = true;
            this.container.classList.remove('collapsed');
            this.container.classList.add('expanded');
            
            // Animate height
            await this.animateHeight(this.config.collapsedHeight, this.config.expandedHeight);
            
            // Show tiles container
            await this.animateTilesContainer(true);
            
            // Update accessibility
            this.updateAccessibilityAttributes();
            
            // Emit event
            this.emit('expanded');
            
        } catch (error) {
            console.error('Error expanding drawer:', error);
        } finally {
            this.isAnimating = false;
        }
    }

    async collapse() {
        if (!this.isExpanded || this.isAnimating) return;
        
        this.isAnimating = true;
        this.clearAutoCollapse();
        
        try {
            // Hide tiles container first
            await this.animateTilesContainer(false);
            
            // Update state
            this.isExpanded = false;
            this.container.classList.remove('expanded');
            this.container.classList.add('collapsed');
            
            // Animate height
            await this.animateHeight(this.config.expandedHeight, this.config.collapsedHeight);
            
            // Update accessibility
            this.updateAccessibilityAttributes();
            
            // Emit event
            this.emit('collapsed');
            
        } catch (error) {
            console.error('Error collapsing drawer:', error);
        } finally {
            this.isAnimating = false;
        }
    }

    async toggle() {
        if (this.isAnimating) return;
        
        if (this.isExpanded) {
            await this.collapse();
        } else {
            await this.expand();
        }
    }

    animateHeight(startHeight, endHeight) {
        return new Promise((resolve) => {
            this.animationState = {
                startHeight,
                targetHeight: endHeight,
                startTime: performance.now(),
                duration: this.config.animationDuration,
                animationId: null
            };
            
            const animate = (currentTime) => {
                // Check if container still exists
                if (!this.container || !this.container.style) {
                    this.animationState.animationId = null;
                    resolve();
                    return;
                }
                
                const elapsed = currentTime - this.animationState.startTime;
                const progress = Math.min(elapsed / this.animationState.duration, 1);
                
                // Apply easing function
                const easedProgress = this.easeInOutCubic(progress);
                
                // Calculate current height
                const currentHeight = startHeight + (endHeight - startHeight) * easedProgress;
                
                // Apply height safely
                try {
                    this.container.style.height = `${currentHeight}px`;
                } catch (error) {
                    console.warn('Error applying animation height:', error);
                    this.animationState.animationId = null;
                    resolve();
                    return;
                }
                
                if (progress < 1) {
                    this.animationState.animationId = requestAnimationFrame(animate);
                } else {
                    this.animationState.animationId = null;
                    resolve();
                }
            };
            
            this.animationState.animationId = requestAnimationFrame(animate);
        });
    }

    animateTilesContainer(show) {
        return new Promise((resolve) => {
            const startOpacity = show ? 0 : 1;
            const endOpacity = show ? 1 : 0;
            const startTransform = show ? 'translateY(20px)' : 'translateY(0px)';
            const endTransform = show ? 'translateY(0px)' : 'translateY(20px)';
            
            const startTime = performance.now();
            const duration = this.config.animationDuration * 0.6; // Shorter duration for content
            
            const animate = (currentTime) => {
                // Check if tiles container still exists
                if (!this.tilesContainer || !this.tilesContainer.style) {
                    resolve();
                    return;
                }
                
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = this.easeInOutCubic(progress);
                
                const currentOpacity = startOpacity + (endOpacity - startOpacity) * easedProgress;
                const translateY = show ? 
                    20 - (20 * easedProgress) : 
                    20 * easedProgress;
                
                try {
                    this.tilesContainer.style.opacity = currentOpacity;
                    this.tilesContainer.style.transform = `translateY(${translateY}px)`;
                } catch (error) {
                    console.warn('Error applying tiles container animation:', error);
                    resolve();
                    return;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    updateAccessibilityAttributes() {
        const isExpanded = this.isExpanded;
        
        // Update handle attributes
        this.handleElement.setAttribute('aria-expanded', isExpanded.toString());
        this.handleElement.setAttribute('aria-label', 
            isExpanded ? 'Collapse hand drawer' : 'Expand hand drawer');
        
        // Update hint text
        const hintText = this.handleElement.querySelector('.drawer-hint-text');
        if (hintText) {
            hintText.textContent = isExpanded ? 'Tap to collapse' : 'Tap to expand';
        }
        
        // Update tiles container
        this.tilesContainer.setAttribute('aria-hidden', (!isExpanded).toString());
        
        // Update action bar
        this.actionBar.setAttribute('aria-hidden', (!isExpanded).toString());
    }

    scheduleAutoCollapse() {
        this.clearAutoCollapse();
        
        if (this.isExpanded) {
            this.autoCollapseTimer = setTimeout(() => {
                this.collapse();
            }, this.config.autoCollapseDelay);
        }
    }

    clearAutoCollapse() {
        if (this.autoCollapseTimer) {
            clearTimeout(this.autoCollapseTimer);
            this.autoCollapseTimer = null;
        }
    }

    handleActionClick(actionId) {
        // Clear selection when performing actions
        this.clearSelection();
        
        // Handle specific actions
        switch (actionId) {
            case 'draw':
                // Emit draw action event
                this.emit('actionClicked', { actionId });
                break;
                
            case 'sortColor':
                this.sortByColor();
                this.emit('actionClicked', { actionId });
                break;
                
            case 'sortNumber':
                this.sortByNumber();
                this.emit('actionClicked', { actionId });
                break;
                
            case 'reset':
                // Emit reset action event
                this.emit('actionClicked', { actionId });
                break;
                
            default:
                // Generic action
                this.emit('actionClicked', { actionId });
        }
        
        // Schedule auto-collapse for some actions
        if (['draw', 'reset'].includes(actionId)) {
            this.scheduleAutoCollapse();
        }
    }

    handleTileClick(tileElement) {
        const tileId = tileElement.getAttribute('data-tile-id');
        if (!tileId) return;
        
        const isSelected = tileElement.classList.contains('selected');
        
        if (isSelected) {
            this.deselectTile(tileId);
        } else {
            this.selectTile(tileId);
        }
        
        // Emit selection event
        this.emit('tileSelectionChanged', {
            tileId,
            isSelected: !isSelected,
            selectedTiles: [...this.selectedTiles]
        });
    }

    updateEmptyState() {
        const isEmpty = this.tiles.length === 0;
        this.emptyStateElement.style.display = isEmpty ? 'flex' : 'none';
        this.tilesGrid.style.display = isEmpty ? 'none' : 'grid';
    }

    // Tile management methods
    addTile(tile) {
        if (!tile || !tile.id) {
            console.warn('Invalid tile data provided to addTile');
            return false;
        }
        
        // Check if tile already exists
        const existingIndex = this.tiles.findIndex(t => t.id === tile.id);
        if (existingIndex !== -1) {
            console.warn(`Tile with id ${tile.id} already exists`);
            return false;
        }
        
        // Add tile to collection
        this.tiles.push({
            id: tile.id,
            color: tile.color || 'red',
            number: tile.number || 1,
            isJoker: tile.isJoker || false,
            ...tile
        });
        
        // Re-render tiles
        this.renderTiles();
        
        // Update empty state
        this.updateEmptyState();
        
        // Emit event
        this.emit('tileAdded', { tile });
        
        return true;
    }

    removeTile(tileId) {
        const tileIndex = this.tiles.findIndex(t => t.id === tileId);
        if (tileIndex === -1) {
            console.warn(`Tile with id ${tileId} not found`);
            return false;
        }
        
        // Remove from tiles array
        const removedTile = this.tiles.splice(tileIndex, 1)[0];
        
        // Remove from selection if selected
        this.selectedTiles = this.selectedTiles.filter(id => id !== tileId);
        
        // Re-render tiles
        this.renderTiles();
        
        // Update empty state
        this.updateEmptyState();
        
        // Emit event
        this.emit('tileRemoved', { tile: removedTile });
        
        return true;
    }

    selectTile(tileId) {
        // Check if tile exists
        const tile = this.tiles.find(t => t.id === tileId);
        if (!tile) {
            console.warn(`Tile with id ${tileId} not found`);
            return false;
        }
        
        // Check if already selected
        if (this.selectedTiles.includes(tileId)) {
            return false;
        }
        
        // Add to selection
        this.selectedTiles.push(tileId);
        
        // Update visual state
        this.updateTileSelection(tileId, true);
        
        // Emit event
        this.emit('tileSelected', { tileId, selectedTiles: [...this.selectedTiles] });
        
        return true;
    }

    deselectTile(tileId) {
        const selectionIndex = this.selectedTiles.indexOf(tileId);
        if (selectionIndex === -1) {
            return false;
        }
        
        // Remove from selection
        this.selectedTiles.splice(selectionIndex, 1);
        
        // Update visual state
        this.updateTileSelection(tileId, false);
        
        // Emit event
        this.emit('tileDeselected', { tileId, selectedTiles: [...this.selectedTiles] });
        
        return true;
    }

    clearSelection() {
        const previousSelection = [...this.selectedTiles];
        
        // Clear selection array
        this.selectedTiles = [];
        
        // Update visual state for all previously selected tiles
        previousSelection.forEach(tileId => {
            this.updateTileSelection(tileId, false);
        });
        
        // Emit event
        this.emit('selectionCleared', { previousSelection });
        
        return true;
    }

    sortByColor() {
        // Define color order
        const colorOrder = ['red', 'blue', 'yellow', 'black'];
        
        this.tiles.sort((a, b) => {
            // Jokers go to the end
            if (a.isJoker && !b.isJoker) return 1;
            if (!a.isJoker && b.isJoker) return -1;
            if (a.isJoker && b.isJoker) return 0;
            
            // Sort by color first
            const colorA = colorOrder.indexOf(a.color);
            const colorB = colorOrder.indexOf(b.color);
            
            if (colorA !== colorB) {
                return colorA - colorB;
            }
            
            // Then by number
            return a.number - b.number;
        });
        
        // Re-render tiles
        this.renderTiles();
        
        // Emit event
        this.emit('tilesSorted', { sortType: 'color' });
        
        return true;
    }

    sortByNumber() {
        this.tiles.sort((a, b) => {
            // Jokers go to the end
            if (a.isJoker && !b.isJoker) return 1;
            if (!a.isJoker && b.isJoker) return -1;
            if (a.isJoker && b.isJoker) return 0;
            
            // Sort by number first
            if (a.number !== b.number) {
                return a.number - b.number;
            }
            
            // Then by color
            const colorOrder = ['red', 'blue', 'yellow', 'black'];
            const colorA = colorOrder.indexOf(a.color);
            const colorB = colorOrder.indexOf(b.color);
            
            return colorA - colorB;
        });
        
        // Re-render tiles
        this.renderTiles();
        
        // Emit event
        this.emit('tilesSorted', { sortType: 'number' });
        
        return true;
    }

    shuffleTiles() {
        // Fisher-Yates shuffle algorithm
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
        
        // Re-render tiles
        this.renderTiles();
        
        // Emit event
        this.emit('tilesShuffled');
        
        return true;
    }

    renderTiles() {
        // Clear existing tiles
        this.tilesGrid.innerHTML = '';
        
        // Render each tile
        this.tiles.forEach(tile => {
            const tileElement = this.createTileElement(tile);
            this.tilesGrid.appendChild(tileElement);
        });
        
        // Update grid layout
        this.updateGridLayout();
    }

    createTileElement(tile) {
        const tileElement = document.createElement('div');
        tileElement.className = 'hand-tile touch-target';
        tileElement.setAttribute('data-tile-id', tile.id);
        tileElement.setAttribute('role', 'gridcell');
        tileElement.setAttribute('tabindex', '0');
        tileElement.setAttribute('aria-label', this.getTileAriaLabel(tile));
        
        // Add color class
        tileElement.classList.add(`tile-${tile.color}`);
        
        // Add joker class if applicable
        if (tile.isJoker) {
            tileElement.classList.add('tile-joker');
        }
        
        // Add selected class if selected
        if (this.selectedTiles.includes(tile.id)) {
            tileElement.classList.add('selected');
        }
        
        // Create tile content
        const tileContent = document.createElement('div');
        tileContent.className = 'hand-tile-content';
        
        if (tile.isJoker) {
            tileContent.innerHTML = '<span class="tile-joker-symbol">★</span>';
        } else {
            tileContent.textContent = tile.number.toString();
        }
        
        tileElement.appendChild(tileContent);
        
        // Add selection indicator
        const selectionIndicator = document.createElement('div');
        selectionIndicator.className = 'hand-tile-selection-indicator';
        tileElement.appendChild(selectionIndicator);
        
        // Add touch feedback
        this.addTileTouchFeedback(tileElement);
        
        return tileElement;
    }

    getTileAriaLabel(tile) {
        if (tile.isJoker) {
            return 'Joker tile';
        }
        return `${tile.color} ${tile.number}`;
    }

    addTileTouchFeedback(tileElement) {
        // Touch start
        tileElement.addEventListener('touchstart', (event) => {
            tileElement.classList.add('touch-active');
            event.preventDefault();
        }, { passive: false });
        
        // Touch end
        tileElement.addEventListener('touchend', (event) => {
            setTimeout(() => {
                tileElement.classList.remove('touch-active');
            }, 150);
        });
        
        // Touch cancel
        tileElement.addEventListener('touchcancel', (event) => {
            tileElement.classList.remove('touch-active');
        });
        
        // Mouse events for desktop testing
        tileElement.addEventListener('mousedown', () => {
            tileElement.classList.add('touch-active');
        });
        
        tileElement.addEventListener('mouseup', () => {
            setTimeout(() => {
                tileElement.classList.remove('touch-active');
            }, 150);
        });
        
        tileElement.addEventListener('mouseleave', () => {
            tileElement.classList.remove('touch-active');
        });
        
        // Keyboard support
        tileElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleTileClick(tileElement);
            }
        });
    }

    updateTileSelection(tileId, isSelected) {
        const tileElement = this.tilesGrid.querySelector(`[data-tile-id="${tileId}"]`);
        if (tileElement) {
            tileElement.classList.toggle('selected', isSelected);
            tileElement.setAttribute('aria-selected', isSelected.toString());
        }
    }

    updateGridLayout() {
        // Calculate optimal columns based on container width and tile count
        const containerWidth = this.tilesContainer.clientWidth - 32; // Account for padding
        const tileSize = this.config.tileSize;
        const gap = this.config.tileGap;
        
        const maxColumns = Math.floor((containerWidth + gap) / (tileSize + gap));
        const optimalColumns = Math.min(maxColumns, this.tiles.length, this.config.tilesPerRow);
        
        // Update CSS grid
        this.tilesGrid.style.gridTemplateColumns = `repeat(${optimalColumns}, 1fr)`;
        
        // Update tile sizes for responsive behavior
        const availableWidth = containerWidth - (gap * (optimalColumns - 1));
        const calculatedTileSize = Math.floor(availableWidth / optimalColumns);
        
        if (calculatedTileSize < tileSize) {
            this.tilesGrid.style.setProperty('--tile-size', `${calculatedTileSize}px`);
        } else {
            this.tilesGrid.style.removeProperty('--tile-size');
        }
    }

    // Multi-touch support methods
    handleMultiTouchStart(event) {
        if (event.touches.length > 1) {
            // Multi-touch detected
            this.isMultiTouchActive = true;
            this.multiTouchTiles = new Set();
            
            // Process each touch point
            Array.from(event.touches).forEach(touch => {
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                const tileElement = element?.closest('.hand-tile');
                
                if (tileElement) {
                    const tileId = tileElement.getAttribute('data-tile-id');
                    if (tileId) {
                        this.multiTouchTiles.add(tileId);
                        tileElement.classList.add('multi-touch-active');
                    }
                }
            });
        }
    }

    handleMultiTouchEnd(event) {
        if (this.isMultiTouchActive && event.touches.length === 0) {
            // Multi-touch ended, process selection
            this.multiTouchTiles.forEach(tileId => {
                const tileElement = this.tilesGrid.querySelector(`[data-tile-id="${tileId}"]`);
                if (tileElement) {
                    tileElement.classList.remove('multi-touch-active');
                    this.handleTileClick(tileElement);
                }
            });
            
            this.isMultiTouchActive = false;
            this.multiTouchTiles.clear();
        }
    }

    // Bulk operations
    addTiles(tiles) {
        if (!Array.isArray(tiles)) {
            console.warn('addTiles expects an array of tiles');
            return false;
        }
        
        let addedCount = 0;
        tiles.forEach(tile => {
            if (this.addTile(tile)) {
                addedCount++;
            }
        });
        
        // Single re-render after all tiles added
        if (addedCount > 0) {
            this.renderTiles();
            this.updateEmptyState();
        }
        
        return addedCount;
    }

    removeTiles(tileIds) {
        if (!Array.isArray(tileIds)) {
            console.warn('removeTiles expects an array of tile IDs');
            return false;
        }
        
        let removedCount = 0;
        tileIds.forEach(tileId => {
            if (this.removeTile(tileId)) {
                removedCount++;
            }
        });
        
        return removedCount;
    }

    clearAllTiles() {
        const tileCount = this.tiles.length;
        this.tiles = [];
        this.selectedTiles = [];
        
        this.renderTiles();
        this.updateEmptyState();
        
        this.emit('allTilesCleared', { clearedCount: tileCount });
        
        return tileCount;
    }

    // Utility methods
    getTileById(tileId) {
        return this.tiles.find(t => t.id === tileId) || null;
    }

    getTilesByColor(color) {
        return this.tiles.filter(t => t.color === color && !t.isJoker);
    }

    getTilesByNumber(number) {
        return this.tiles.filter(t => t.number === number && !t.isJoker);
    }

    getJokers() {
        return this.tiles.filter(t => t.isJoker);
    }

    getTileCount() {
        return this.tiles.length;
    }

    getSelectedTileCount() {
        return this.selectedTiles.length;
    }

    hasSelectedTiles() {
        return this.selectedTiles.length > 0;
    }

    // Getters
    getIsExpanded() {
        return this.isExpanded;
    }

    getTiles() {
        return [...this.tiles];
    }

    getSelectedTiles() {
        return [...this.selectedTiles];
    }

    getContainer() {
        return this.container;
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
        // Clear timers
        this.clearAutoCollapse();
        
        // Cancel animations
        if (this.animationState.animationId) {
            cancelAnimationFrame(this.animationState.animationId);
        }
        
        // Clear event listeners
        this.eventCallbacks.clear();
        
        // Clear references
        this.container = null;
        this.handleElement = null;
        this.tilesContainer = null;
        this.tilesGrid = null;
        this.emptyStateElement = null;
        this.actionBar = null;
        this.actionButtons.clear();
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandDrawerComponent;
} else if (typeof window !== 'undefined') {
    window.HandDrawerComponent = HandDrawerComponent;
}