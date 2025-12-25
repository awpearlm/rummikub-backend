/**
 * Mobile Game Board Component
 * Touch-optimized game board for mobile devices with drag and drop support
 * Provides visual feedback for tile placement and validation
 */

class MobileGameBoard {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            touchEnabled: true,
            dragDropEnabled: true,
            visualFeedback: true,
            minTouchTarget: 44, // Minimum touch target size in pixels
            animationDuration: 250,
            ...options
        };
        
        this.isInitialized = false;
        this.boardState = [];
        this.dragState = null;
        this.validPlacementAreas = [];
        
        // Touch and gesture handling
        this.touchManager = null;
        this.gestureRecognizer = null;
        this.boardGestureRecognizer = null;
        
        // Smart positioning system
        this.smartPositioning = null;
        
        // Visual feedback elements
        this.placementPreview = null;
        this.validAreaHighlights = [];
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup container
            this.setupContainer();
            
            // Initialize touch handling
            this.initializeTouchHandling();
            
            // Setup drag and drop
            this.setupDragAndDrop();
            
            // Create visual feedback elements
            this.createVisualFeedbackElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize smart positioning
            this.initializeSmartPositioning();
            
            // Initialize board gesture recognition
            this.initializeBoardGestureRecognition();
            
            this.isInitialized = true;
            console.log('Mobile Game Board initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Game Board:', error);
            throw error;
        }
    }

    setupContainer() {
        if (!this.container) {
            throw new Error('Container element is required');
        }
        
        // Add mobile game board classes
        this.container.classList.add('mobile-game-board', 'touch-enabled');
        
        // Set up container properties
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';
        this.container.style.touchAction = 'none'; // Prevent default touch behaviors
        
        // Create board canvas
        this.boardCanvas = document.createElement('div');
        this.boardCanvas.className = 'mobile-board-canvas';
        this.boardCanvas.style.position = 'absolute';
        this.boardCanvas.style.top = '0';
        this.boardCanvas.style.left = '0';
        this.boardCanvas.style.width = '100%';
        this.boardCanvas.style.height = '100%';
        this.boardCanvas.style.transformOrigin = 'center center';
        
        this.container.appendChild(this.boardCanvas);
        
        // Create overlay for UI elements
        this.boardOverlay = document.createElement('div');
        this.boardOverlay.className = 'mobile-board-overlay';
        this.boardOverlay.style.position = 'absolute';
        this.boardOverlay.style.top = '0';
        this.boardOverlay.style.left = '0';
        this.boardOverlay.style.width = '100%';
        this.boardOverlay.style.height = '100%';
        this.boardOverlay.style.pointerEvents = 'none';
        
        this.container.appendChild(this.boardOverlay);
    }

    initializeTouchHandling() {
        // Initialize touch manager if available
        if (typeof TouchManager !== 'undefined') {
            this.touchManager = new TouchManager();
            
            // Register touch targets
            this.touchManager.registerTouchTarget(this.container, {
                onTouchStart: this.handleTouchStart.bind(this),
                onTouchMove: this.handleTouchMove.bind(this),
                onTouchEnd: this.handleTouchEnd.bind(this),
                onTouchCancel: this.handleTouchCancel.bind(this)
            });
        }
        
        // Initialize gesture recognizer if available
        if (typeof GestureRecognizer !== 'undefined') {
            this.gestureRecognizer = new GestureRecognizer();
        }
    }

    initializeSmartPositioning() {
        // Initialize smart positioning system if available
        if (typeof SmartBoardPositioning !== 'undefined') {
            this.smartPositioning = new SmartBoardPositioning(this.boardCanvas, {
                animationDuration: this.options.animationDuration,
                autoCenter: true,
                turnBasedPositioning: true
            });
            
            // Listen for positioning events
            this.smartPositioning.on('positioningComplete', (data) => {
                this.emit('boardPositioned', data);
            });
            
            this.smartPositioning.on('manualOverrideChanged', (data) => {
                this.emit('manualOverrideChanged', data);
            });
        }
    }

    initializeBoardGestureRecognition() {
        // Initialize board-specific gesture recognizer if available
        if (typeof BoardGestureRecognizer !== 'undefined') {
            this.boardGestureRecognizer = new BoardGestureRecognizer(this.container, {
                tapThreshold: 10,
                dragThreshold: 15,
                enablePinchZoom: true,
                enableDoubleTap: true,
                enableLongPress: true
            });
            
            // Setup gesture event handlers
            this.setupGestureHandlers();
        }
    }

    setupGestureHandlers() {
        if (!this.boardGestureRecognizer) return;
        
        // Tap gesture - select tiles or trigger actions
        this.boardGestureRecognizer.on('tap', (data) => {
            this.handleTapGesture(data);
        });
        
        // Double tap - zoom to fit or reset view
        this.boardGestureRecognizer.on('doubleTap', (data) => {
            this.handleDoubleTapGesture(data);
        });
        
        // Long press - show context menu or tile details
        this.boardGestureRecognizer.on('longPress', (data) => {
            this.handleLongPressGesture(data);
        });
        
        // Drag gestures - move tiles or pan board
        this.boardGestureRecognizer.on('dragStart', (data) => {
            this.handleDragStartGesture(data);
        });
        
        this.boardGestureRecognizer.on('dragMove', (data) => {
            this.handleDragMoveGesture(data);
        });
        
        this.boardGestureRecognizer.on('dragEnd', (data) => {
            this.handleDragEndGesture(data);
        });
        
        // Pinch zoom gestures
        this.boardGestureRecognizer.on('pinchZoom', (data) => {
            this.handlePinchZoomGesture(data);
        });
        
        this.boardGestureRecognizer.on('pinchEnd', (data) => {
            this.handlePinchEndGesture(data);
        });
    }

    setupDragAndDrop() {
        if (!this.options.dragDropEnabled) return;
        
        // Setup drag and drop event listeners
        this.container.addEventListener('dragover', this.handleDragOver.bind(this));
        this.container.addEventListener('drop', this.handleDrop.bind(this));
        this.container.addEventListener('dragenter', this.handleDragEnter.bind(this));
        this.container.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    createVisualFeedbackElements() {
        // Create placement preview element
        this.placementPreview = document.createElement('div');
        this.placementPreview.className = 'mobile-board-placement-preview';
        this.placementPreview.style.position = 'absolute';
        this.placementPreview.style.display = 'none';
        this.placementPreview.style.pointerEvents = 'none';
        this.placementPreview.style.zIndex = '1000';
        this.boardOverlay.appendChild(this.placementPreview);
        
        // Create valid area highlight container
        this.validAreaContainer = document.createElement('div');
        this.validAreaContainer.className = 'mobile-board-valid-areas';
        this.validAreaContainer.style.position = 'absolute';
        this.validAreaContainer.style.top = '0';
        this.validAreaContainer.style.left = '0';
        this.validAreaContainer.style.width = '100%';
        this.validAreaContainer.style.height = '100%';
        this.validAreaContainer.style.pointerEvents = 'none';
        this.validAreaContainer.style.zIndex = '999';
        this.boardOverlay.appendChild(this.validAreaContainer);
    }

    setupEventListeners() {
        // Listen for window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Listen for orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }

    // Touch event handlers
    handleTouchStart(event) {
        if (!this.options.touchEnabled) return;
        
        const touch = event.touches[0];
        const target = this.getTileElementAt(touch.clientX, touch.clientY);
        
        if (target) {
            this.startTileDrag(target, touch);
        }
        
        this.emit('touchStart', {
            touch,
            target,
            boardPosition: this.screenToBoard(touch.clientX, touch.clientY)
        });
    }

    // Gesture event handlers
    handleTapGesture(data) {
        const boardPosition = this.screenToBoard(data.x, data.y);
        const tileElement = this.getTileElementAt(data.x, data.y);
        
        if (tileElement) {
            // Tap on tile - select/deselect
            const tileData = this.getTileData(tileElement);
            this.emit('tileSelected', {
                tile: tileData,
                element: tileElement,
                position: boardPosition,
                gestureData: data
            });
        } else {
            // Tap on empty board area
            this.emit('boardTapped', {
                position: boardPosition,
                gestureData: data
            });
        }
    }

    handleDoubleTapGesture(data) {
        const boardPosition = this.screenToBoard(data.x, data.y);
        const tileElement = this.getTileElementAt(data.x, data.y);
        
        if (tileElement) {
            // Double tap on tile - show details or quick action
            const tileData = this.getTileData(tileElement);
            this.emit('tileDoubleTapped', {
                tile: tileData,
                element: tileElement,
                position: boardPosition,
                gestureData: data
            });
        } else {
            // Double tap on empty area - reset view or zoom to fit
            if (this.smartPositioning) {
                this.smartPositioning.resetToDefaultView({
                    reason: 'doubleTap',
                    position: boardPosition
                });
            }
            
            this.emit('boardDoubleTapped', {
                position: boardPosition,
                gestureData: data
            });
        }
    }

    handleLongPressGesture(data) {
        const boardPosition = this.screenToBoard(data.x, data.y);
        const tileElement = this.getTileElementAt(data.x, data.y);
        
        if (tileElement) {
            // Long press on tile - show context menu
            const tileData = this.getTileData(tileElement);
            this.emit('tileLongPressed', {
                tile: tileData,
                element: tileElement,
                position: boardPosition,
                gestureData: data
            });
        } else {
            // Long press on empty area - show board context menu
            this.emit('boardLongPressed', {
                position: boardPosition,
                gestureData: data
            });
        }
    }

    handleDragStartGesture(data) {
        const boardPosition = this.screenToBoard(data.startX, data.startY);
        const tileElement = this.getTileElementAt(data.startX, data.startY);
        
        if (tileElement) {
            // Start tile drag
            const tileData = this.getTileData(tileElement);
            this.dragState = {
                type: 'tile',
                tiles: [tileData],
                startPosition: { x: data.startX, y: data.startY },
                currentPosition: { x: data.currentX, y: data.currentY },
                element: tileElement,
                startTime: data.timestamp
            };
            
            // Add visual feedback
            tileElement.classList.add('dragging');
            
            // Show valid placement areas
            this.showValidPlacementAreas([tileData]);
            
            this.emit('tileDragStart', {
                tiles: [tileData],
                position: boardPosition,
                gestureData: data
            });
        } else {
            // Start board pan
            this.dragState = {
                type: 'pan',
                startPosition: { x: data.startX, y: data.startY },
                currentPosition: { x: data.currentX, y: data.currentY },
                startTime: data.timestamp
            };
            
            // Notify smart positioning of manual interaction
            if (this.smartPositioning) {
                this.smartPositioning.setManualOverride(true);
            }
            
            this.emit('boardPanStart', {
                position: boardPosition,
                gestureData: data
            });
        }
    }

    handleDragMoveGesture(data) {
        if (!this.dragState) return;
        
        this.dragState.currentPosition = { x: data.currentX, y: data.currentY };
        
        if (this.dragState.type === 'tile') {
            // Update tile drag
            const deltaX = data.currentX - data.startX;
            const deltaY = data.currentY - data.startY;
            
            if (this.dragState.element) {
                this.dragState.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            }
            
            // Update placement preview
            const boardPosition = this.screenToBoard(data.currentX, data.currentY);
            const isValid = this.isValidDropPosition(boardPosition, this.dragState.tiles);
            
            this.updatePlacementPreview(boardPosition, this.dragState.tiles, isValid);
            
            this.emit('tileDragMove', {
                tiles: this.dragState.tiles,
                position: boardPosition,
                isValid,
                gestureData: data
            });
        } else if (this.dragState.type === 'pan') {
            // Update board pan
            const deltaX = data.currentX - data.startX;
            const deltaY = data.currentY - data.startY;
            
            // Apply pan to board canvas
            if (this.smartPositioning) {
                const currentView = this.smartPositioning.getCurrentView();
                const newView = {
                    ...currentView,
                    x: currentView.x + deltaX,
                    y: currentView.y + deltaY
                };
                
                // Apply transform directly for smooth panning
                this.boardCanvas.style.transform = 
                    `translate(${newView.x}px, ${newView.y}px) scale(${newView.zoom})`;
            }
            
            this.emit('boardPanMove', {
                delta: { x: deltaX, y: deltaY },
                gestureData: data
            });
        }
    }

    handleDragEndGesture(data) {
        if (!this.dragState) return;
        
        if (this.dragState.type === 'tile') {
            // Complete tile drag
            const boardPosition = this.screenToBoard(data.endX, data.endY);
            const isValid = this.isValidDropPosition(boardPosition, this.dragState.tiles);
            
            if (isValid) {
                // Place tiles at the drop position
                this.placeTiles(this.dragState.tiles, boardPosition);
                
                this.emit('tileDragComplete', {
                    tiles: this.dragState.tiles,
                    position: boardPosition,
                    success: true,
                    gestureData: data
                });
            } else {
                // Return tile to original position
                this.returnTileToOriginalPosition();
                
                this.emit('tileDragComplete', {
                    tiles: this.dragState.tiles,
                    position: boardPosition,
                    success: false,
                    gestureData: data
                });
            }
        } else if (this.dragState.type === 'pan') {
            // Complete board pan
            const deltaX = data.endX - data.startX;
            const deltaY = data.endY - data.startY;
            
            // Update smart positioning with final pan position
            if (this.smartPositioning) {
                const currentView = this.smartPositioning.getCurrentView();
                const newView = {
                    ...currentView,
                    x: currentView.x + deltaX,
                    y: currentView.y + deltaY
                };
                
                // Update positioning system
                this.smartPositioning.currentView = newView;
                this.smartPositioning.applyViewTransform();
            }
            
            this.emit('boardPanComplete', {
                delta: { x: deltaX, y: deltaY },
                gestureData: data
            });
        }
        
        this.clearDragState();
        this.clearVisualFeedback();
    }

    handlePinchZoomGesture(data) {
        if (!this.smartPositioning) return;
        
        // Calculate new zoom level
        const currentView = this.smartPositioning.getCurrentView();
        const newZoom = currentView.zoom * data.scale;
        
        // Apply zoom with center point
        const boardCenter = this.screenToBoard(data.centerX, data.centerY);
        
        // Update view with zoom
        const newView = {
            ...currentView,
            zoom: Math.max(0.5, Math.min(2.0, newZoom))
        };
        
        // Adjust position to zoom around center point
        const zoomFactor = newView.zoom / currentView.zoom;
        newView.x = data.centerX - (data.centerX - currentView.x) * zoomFactor;
        newView.y = data.centerY - (data.centerY - currentView.y) * zoomFactor;
        
        // Apply transform immediately for smooth zooming
        this.boardCanvas.style.transform = 
            `translate(${newView.x}px, ${newView.y}px) scale(${newView.zoom})`;
        
        // Update positioning system
        this.smartPositioning.currentView = newView;
        this.smartPositioning.setManualOverride(true);
        
        this.emit('boardZoom', {
            zoom: newView.zoom,
            center: boardCenter,
            gestureData: data
        });
    }

    handlePinchEndGesture(data) {
        // Finalize zoom operation
        if (this.smartPositioning) {
            // Ensure final view is applied
            this.smartPositioning.applyViewTransform();
        }
        
        this.emit('boardZoomComplete', {
            finalScale: data.finalScale,
            center: { x: data.centerX, y: data.centerY },
            gestureData: data
        });
    }

    handleTouchMove(event) {
        if (!this.options.touchEnabled) return;
        
        event.preventDefault(); // Prevent scrolling
        
        const touch = event.touches[0];
        
        if (this.dragState) {
            this.updateTileDrag(touch);
        }
        
        this.emit('touchMove', {
            touch,
            boardPosition: this.screenToBoard(touch.clientX, touch.clientY)
        });
    }

    handleTouchEnd(event) {
        if (!this.options.touchEnabled) return;
        
        const touch = event.changedTouches[0];
        
        if (this.dragState) {
            this.completeTileDrag(touch);
        }
        
        this.emit('touchEnd', {
            touch,
            boardPosition: this.screenToBoard(touch.clientX, touch.clientY)
        });
    }

    handleTouchCancel(event) {
        if (this.dragState) {
            this.cancelTileDrag();
        }
        
        this.emit('touchCancel', { event });
    }

    // Drag and drop handlers
    handleDragOver(event) {
        event.preventDefault();
        
        const boardPosition = this.screenToBoard(event.clientX, event.clientY);
        const isValidDrop = this.isValidDropPosition(boardPosition, this.dragState?.tiles);
        
        event.dataTransfer.dropEffect = isValidDrop ? 'move' : 'none';
        
        // Update visual feedback
        this.updatePlacementPreview(boardPosition, this.dragState?.tiles, isValidDrop);
    }

    handleDrop(event) {
        event.preventDefault();
        
        const boardPosition = this.screenToBoard(event.clientX, event.clientY);
        const dragData = this.parseDragData(event.dataTransfer);
        
        if (dragData && this.isValidDropPosition(boardPosition, dragData.tiles)) {
            this.placeTiles(dragData.tiles, boardPosition);
        }
        
        this.clearVisualFeedback();
    }

    handleDragEnter(event) {
        event.preventDefault();
        
        // Show valid placement areas
        if (this.dragState?.tiles) {
            this.showValidPlacementAreas(this.dragState.tiles);
        }
    }

    handleDragLeave(event) {
        // Only clear if leaving the board entirely
        if (!this.container.contains(event.relatedTarget)) {
            this.clearVisualFeedback();
        }
    }

    // Tile drag operations
    startTileDrag(tileElement, touch) {
        const tileData = this.getTileData(tileElement);
        if (!tileData) return;
        
        this.dragState = {
            tiles: [tileData],
            startPosition: { x: touch.clientX, y: touch.clientY },
            currentPosition: { x: touch.clientX, y: touch.clientY },
            element: tileElement,
            startTime: Date.now()
        };
        
        // Add visual feedback
        tileElement.classList.add('dragging');
        
        // Show valid placement areas
        this.showValidPlacementAreas([tileData]);
        
        this.emit('tileDragStart', {
            tiles: [tileData],
            position: this.screenToBoard(touch.clientX, touch.clientY)
        });
    }

    updateTileDrag(touch) {
        if (!this.dragState) return;
        
        this.dragState.currentPosition = { x: touch.clientX, y: touch.clientY };
        
        // Update tile element position
        const deltaX = touch.clientX - this.dragState.startPosition.x;
        const deltaY = touch.clientY - this.dragState.startPosition.y;
        
        this.dragState.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        // Update placement preview
        const boardPosition = this.screenToBoard(touch.clientX, touch.clientY);
        const isValid = this.isValidDropPosition(boardPosition, this.dragState.tiles);
        
        this.updatePlacementPreview(boardPosition, this.dragState.tiles, isValid);
        
        this.emit('tileDragMove', {
            tiles: this.dragState.tiles,
            position: boardPosition,
            isValid
        });
    }

    completeTileDrag(touch) {
        if (!this.dragState) return;
        
        const boardPosition = this.screenToBoard(touch.clientX, touch.clientY);
        const isValid = this.isValidDropPosition(boardPosition, this.dragState.tiles);
        
        if (isValid) {
            // Place tiles at the drop position
            this.placeTiles(this.dragState.tiles, boardPosition);
            
            this.emit('tileDragComplete', {
                tiles: this.dragState.tiles,
                position: boardPosition,
                success: true
            });
        } else {
            // Return tile to original position
            this.returnTileToOriginalPosition();
            
            this.emit('tileDragComplete', {
                tiles: this.dragState.tiles,
                position: boardPosition,
                success: false
            });
        }
        
        this.clearDragState();
        this.clearVisualFeedback();
    }

    cancelTileDrag() {
        if (!this.dragState) return;
        
        this.returnTileToOriginalPosition();
        this.clearDragState();
        this.clearVisualFeedback();
        
        this.emit('tileDragCancel', {
            tiles: this.dragState?.tiles
        });
    }

    returnTileToOriginalPosition() {
        if (this.dragState?.element) {
            // Animate return to original position
            this.dragState.element.style.transition = `transform ${this.options.animationDuration}ms ease-out`;
            this.dragState.element.style.transform = '';
            
            // Remove transition after animation
            setTimeout(() => {
                if (this.dragState?.element) {
                    this.dragState.element.style.transition = '';
                    this.dragState.element.classList.remove('dragging');
                }
            }, this.options.animationDuration);
        }
    }

    clearDragState() {
        if (this.dragState?.element) {
            this.dragState.element.classList.remove('dragging');
            this.dragState.element.style.transform = '';
            this.dragState.element.style.transition = '';
        }
        
        this.dragState = null;
    }

    // Visual feedback methods
    showValidPlacementAreas(tiles) {
        if (!this.options.visualFeedback) return;
        
        this.clearValidAreaHighlights();
        
        const validAreas = this.getValidPlacementAreas(tiles);
        
        validAreas.forEach(area => {
            const highlight = this.createValidAreaHighlight(area);
            this.validAreaHighlights.push(highlight);
            this.validAreaContainer.appendChild(highlight);
        });
        
        this.validPlacementAreas = validAreas;
    }

    createValidAreaHighlight(area) {
        const highlight = document.createElement('div');
        highlight.className = 'mobile-board-valid-area-highlight';
        
        const boardRect = this.boardToScreen(area.x, area.y, area.width, area.height);
        
        highlight.style.position = 'absolute';
        highlight.style.left = `${boardRect.x}px`;
        highlight.style.top = `${boardRect.y}px`;
        highlight.style.width = `${boardRect.width}px`;
        highlight.style.height = `${boardRect.height}px`;
        highlight.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        highlight.style.border = '2px dashed #00ff00';
        highlight.style.borderRadius = '4px';
        highlight.style.pointerEvents = 'none';
        
        return highlight;
    }

    updatePlacementPreview(boardPosition, tiles, isValid) {
        if (!this.options.visualFeedback || !this.placementPreview) return;
        
        if (!tiles || tiles.length === 0) {
            this.placementPreview.style.display = 'none';
            return;
        }
        
        const screenPosition = this.boardToScreen(boardPosition.x, boardPosition.y);
        
        this.placementPreview.style.display = 'block';
        this.placementPreview.style.left = `${screenPosition.x}px`;
        this.placementPreview.style.top = `${screenPosition.y}px`;
        this.placementPreview.className = `mobile-board-placement-preview ${isValid ? 'valid' : 'invalid'}`;
        
        // Update preview content
        this.placementPreview.innerHTML = this.renderTilePreview(tiles);
    }

    renderTilePreview(tiles) {
        return tiles.map(tile => {
            return `<div class="tile-preview" style="
                display: inline-block;
                width: 30px;
                height: 40px;
                background: ${tile.isJoker ? '#ff6b6b' : '#4ecdc4'};
                border: 1px solid #333;
                border-radius: 4px;
                margin: 2px;
                text-align: center;
                line-height: 40px;
                font-size: 12px;
                color: ${tile.color || '#333'};
            ">${tile.isJoker ? 'J' : tile.number}</div>`;
        }).join('');
    }

    clearValidAreaHighlights() {
        this.validAreaHighlights.forEach(highlight => {
            if (highlight.parentNode) {
                highlight.parentNode.removeChild(highlight);
            }
        });
        this.validAreaHighlights = [];
        this.validPlacementAreas = [];
    }

    clearVisualFeedback() {
        this.clearValidAreaHighlights();
        
        if (this.placementPreview) {
            this.placementPreview.style.display = 'none';
        }
    }

    // Coordinate transformation methods
    screenToBoard(screenX, screenY) {
        const rect = this.container.getBoundingClientRect();
        const relativeX = screenX - rect.left;
        const relativeY = screenY - rect.top;
        
        // Convert to board coordinates (this would depend on your board coordinate system)
        return {
            x: Math.floor(relativeX / 50), // Assuming 50px grid
            y: Math.floor(relativeY / 50)
        };
    }

    boardToScreen(boardX, boardY, width = 50, height = 50) {
        const rect = this.container.getBoundingClientRect();
        
        return {
            x: boardX * 50, // Assuming 50px grid
            y: boardY * 50,
            width: width,
            height: height
        };
    }

    // Game logic integration methods
    placeTiles(tiles, position) {
        // Validate placement
        if (!this.isValidDropPosition(position, tiles)) {
            console.warn('Invalid tile placement attempted');
            return false;
        }
        
        // Update board state
        this.updateBoardState(tiles, position);
        
        // Render tiles on board
        this.renderTilesOnBoard(tiles, position);
        
        // Emit placement event
        this.emit('tilesPlaced', {
            tiles,
            position,
            boardState: this.boardState
        });
        
        // Trigger smart positioning for new placement
        if (this.smartPositioning) {
            this.smartPositioning.handleTilePlace(tiles, position, { board: this.boardState });
        }
        
        return true;
    }

    updateBoardState(tiles, position) {
        // This would integrate with your game's board state management
        // For now, we'll maintain a simple internal state
        
        if (!this.boardState[position.y]) {
            this.boardState[position.y] = [];
        }
        
        tiles.forEach((tile, index) => {
            this.boardState[position.y][position.x + index] = tile;
        });
    }

    renderTilesOnBoard(tiles, position) {
        tiles.forEach((tile, index) => {
            const tileElement = this.createTileElement(tile);
            const screenPos = this.boardToScreen(position.x + index, position.y);
            
            tileElement.style.position = 'absolute';
            tileElement.style.left = `${screenPos.x}px`;
            tileElement.style.top = `${screenPos.y}px`;
            
            this.boardCanvas.appendChild(tileElement);
        });
    }

    createTileElement(tile) {
        const element = document.createElement('div');
        element.className = 'mobile-board-tile touch-target';
        element.dataset.tileId = tile.id;
        
        element.style.width = '48px';
        element.style.height = '64px';
        element.style.backgroundColor = tile.isJoker ? '#ff6b6b' : '#4ecdc4';
        element.style.border = '2px solid #333';
        element.style.borderRadius = '6px';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.fontSize = '16px';
        element.style.fontWeight = 'bold';
        element.style.color = tile.color || '#333';
        element.style.cursor = 'pointer';
        element.style.userSelect = 'none';
        
        element.textContent = tile.isJoker ? 'J' : tile.number;
        
        // Make draggable
        element.draggable = true;
        element.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('application/json', JSON.stringify({
                tiles: [tile],
                source: 'board'
            }));
        });
        
        return element;
    }

    // Validation methods
    isValidDropPosition(position, tiles) {
        if (!position || !tiles || tiles.length === 0) {
            return false;
        }
        
        // Check if position is within valid placement areas
        return this.validPlacementAreas.some(area => {
            return position.x >= area.x && 
                   position.x < area.x + area.width &&
                   position.y >= area.y && 
                   position.y < area.y + area.height;
        });
    }

    getValidPlacementAreas(tiles) {
        // This would integrate with your game's validation logic
        // For now, return some example valid areas
        
        const areas = [];
        
        // Add areas around existing tiles
        for (let y = 0; y < this.boardState.length; y++) {
            for (let x = 0; x < (this.boardState[y] || []).length; x++) {
                if (this.boardState[y][x]) {
                    // Add adjacent areas
                    areas.push(
                        { x: x - 1, y: y, width: 1, height: 1 },
                        { x: x + 1, y: y, width: 1, height: 1 },
                        { x: x, y: y - 1, width: 1, height: 1 },
                        { x: x, y: y + 1, width: 1, height: 1 }
                    );
                }
            }
        }
        
        // If no tiles on board, allow placement in center
        if (areas.length === 0) {
            areas.push({ x: 5, y: 5, width: 5, height: 5 });
        }
        
        // Remove duplicates and invalid areas
        return areas.filter((area, index, self) => {
            return area.x >= 0 && area.y >= 0 &&
                   index === self.findIndex(a => a.x === area.x && a.y === area.y);
        });
    }

    // Utility methods
    getTileElementAt(screenX, screenY) {
        const elements = document.elementsFromPoint(screenX, screenY);
        return elements.find(el => el.classList.contains('mobile-board-tile'));
    }

    getTileData(element) {
        const tileId = element.dataset.tileId;
        if (!tileId) return null;
        
        // This would integrate with your game's tile data
        // For now, return mock data
        return {
            id: tileId,
            number: parseInt(element.textContent) || 0,
            color: element.style.color || '#333',
            isJoker: element.textContent === 'J'
        };
    }

    parseDragData(dataTransfer) {
        try {
            const data = dataTransfer.getData('application/json');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to parse drag data:', error);
            return null;
        }
    }

    handleResize() {
        // Update dimensions and recalculate positions
        this.updateResponsiveDimensions();
        this.emit('resize');
    }

    updateResponsiveDimensions() {
        // This would update board scaling and positioning
        // based on container size changes
        const rect = this.container.getBoundingClientRect();
        
        this.emit('dimensionsUpdated', {
            width: rect.width,
            height: rect.height
        });
    }

    // Public API methods
    setBoardState(boardState) {
        this.boardState = boardState || [];
        this.renderBoard();
    }

    getBoardState() {
        return this.boardState;
    }

    renderBoard() {
        // Clear existing tiles
        this.boardCanvas.innerHTML = '';
        
        // Render all tiles from board state
        for (let y = 0; y < this.boardState.length; y++) {
            for (let x = 0; x < (this.boardState[y] || []).length; x++) {
                const tile = this.boardState[y][x];
                if (tile) {
                    this.renderTilesOnBoard([tile], { x, y });
                }
            }
        }
    }

    clearBoard() {
        this.boardState = [];
        this.boardCanvas.innerHTML = '';
        this.clearVisualFeedback();
    }

    // Smart positioning methods
    centerOnTiles(tiles, options = {}) {
        if (this.smartPositioning) {
            return this.smartPositioning.centerOnTiles(tiles, options);
        }
        return Promise.resolve();
    }

    centerOnPosition(x, y, options = {}) {
        if (this.smartPositioning) {
            return this.smartPositioning.centerOnPosition(x, y, options);
        }
        return Promise.resolve();
    }

    resetBoardView(options = {}) {
        if (this.smartPositioning) {
            return this.smartPositioning.resetToDefaultView(options);
        }
        return Promise.resolve();
    }

    handleTurnStart(playerId, gameState) {
        if (this.smartPositioning) {
            return this.smartPositioning.handleTurnStart(playerId, gameState);
        }
        return Promise.resolve();
    }

    setZoom(zoom, options = {}) {
        if (this.smartPositioning) {
            return this.smartPositioning.setZoom(zoom, options);
        }
        return Promise.resolve();
    }

    getCurrentView() {
        if (this.smartPositioning) {
            return this.smartPositioning.getCurrentView();
        }
        return { x: 0, y: 0, zoom: 1, rotation: 0 };
    }

    clearManualOverride() {
        if (this.smartPositioning) {
            this.smartPositioning.clearManualOverride();
        }
    }

    // Gesture recognition methods
    getCurrentGesture() {
        if (this.boardGestureRecognizer) {
            return this.boardGestureRecognizer.getCurrentGesture();
        }
        return null;
    }

    getActiveTouches() {
        if (this.boardGestureRecognizer) {
            return this.boardGestureRecognizer.getActiveTouches();
        }
        return [];
    }

    isGestureActive() {
        if (this.boardGestureRecognizer) {
            return this.boardGestureRecognizer.isGestureActive();
        }
        return false;
    }

    setGestureOptions(options) {
        if (this.boardGestureRecognizer) {
            this.boardGestureRecognizer.setOptions(options);
        }
    }

    getGestureOptions() {
        if (this.boardGestureRecognizer) {
            return this.boardGestureRecognizer.getOptions();
        }
        return {};
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
        // Clean up board gesture recognizer
        if (this.boardGestureRecognizer) {
            this.boardGestureRecognizer.destroy();
            this.boardGestureRecognizer = null;
        }
        
        // Clean up smart positioning
        if (this.smartPositioning) {
            this.smartPositioning.destroy();
            this.smartPositioning = null;
        }
        
        // Clean up touch manager
        if (this.touchManager) {
            this.touchManager.unregisterTouchTarget(this.container);
            this.touchManager = null;
        }
        
        // Clear visual feedback
        this.clearVisualFeedback();
        
        // Clear event listeners
        this.eventCallbacks.clear();
        
        // Clear drag state
        this.clearDragState();
        
        // Remove container content
        if (this.container) {
            this.container.innerHTML = '';
            this.container.classList.remove('mobile-game-board', 'touch-enabled');
        }
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileGameBoard;
} else if (typeof window !== 'undefined') {
    window.MobileGameBoard = MobileGameBoard;
}