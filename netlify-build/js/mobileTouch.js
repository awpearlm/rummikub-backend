/**
 * Mobile Touch Interface Enhancement
 * Provides comprehensive touch event handling for mobile devices
 * while maintaining compatibility with existing drag-drop functionality
 */

class MobileTouchInterface {
    constructor() {
        this.touchStartTime = null;
        this.touchStartPos = null;
        this.touchThreshold = {
            tap: { maxDistance: 10, maxDuration: 200 },
            drag: { minDistance: 20, minDuration: 100 },
            longPress: { minDuration: 500, maxDistance: 15 }
        };
        this.touchActive = false;
        this.preventMouseEvents = false;
        this.touchIdentifier = null;
        
        this.init();
    }

    init() {
        // Detect if device supports touch
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (this.isTouchDevice) {
            this.setupTouchEventListeners();
            this.addMobileOptimizations();
        }
    }

    setupTouchEventListeners() {
        // Add touch event listeners to the document
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
        
        // Prevent mouse events when touch is active
        document.addEventListener('mousedown', this.preventMouseEvent.bind(this), true);
        document.addEventListener('mousemove', this.preventMouseEvent.bind(this), true);
        document.addEventListener('mouseup', this.preventMouseEvent.bind(this), true);
        document.addEventListener('click', this.preventMouseEvent.bind(this), true);
    }

    handleTouchStart(e) {
        // Only handle single touch for game interactions
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const target = touch.target;
        
        // Only handle touches on game elements
        if (!this.isGameElement(target)) return;
        
        this.touchActive = true;
        this.touchIdentifier = touch.identifier;
        this.touchStartTime = Date.now();
        this.touchStartPos = {
            x: touch.clientX,
            y: touch.clientY
        };
        
        // Prevent default to avoid mouse events and scrolling
        e.preventDefault();
        
        // Add visual feedback
        this.addTouchFeedback(target, 'touchstart');
        
        // Start long press timer
        this.longPressTimer = setTimeout(() => {
            if (this.touchActive && this.touchIdentifier === touch.identifier) {
                this.handleLongPress(target, touch);
            }
        }, this.touchThreshold.longPress.minDuration);
    }

    handleTouchMove(e) {
        if (!this.touchActive) return;
        
        // Find the touch with our identifier
        const touch = Array.from(e.touches).find(t => t.identifier === this.touchIdentifier);
        if (!touch) return;
        
        const currentPos = {
            x: touch.clientX,
            y: touch.clientY
        };
        
        const distance = this.calculateDistance(this.touchStartPos, currentPos);
        
        // Cancel long press if moved too far
        if (distance > this.touchThreshold.longPress.maxDistance) {
            this.cancelLongPress();
        }
        
        // If moved enough distance, start drag operation
        if (distance > this.touchThreshold.drag.minDistance) {
            this.handleDragMove(touch.target, this.touchStartPos, currentPos, e);
        }
        
        e.preventDefault();
    }

    handleTouchEnd(e) {
        if (!this.touchActive) return;
        
        // Find the touch with our identifier
        const touch = Array.from(e.changedTouches).find(t => t.identifier === this.touchIdentifier);
        if (!touch) return;
        
        const touchEndTime = Date.now();
        const touchEndPos = {
            x: touch.clientX,
            y: touch.clientY
        };
        
        const duration = touchEndTime - this.touchStartTime;
        const distance = this.calculateDistance(this.touchStartPos, touchEndPos);
        
        // Cancel long press timer
        this.cancelLongPress();
        
        // Determine gesture type and handle accordingly
        this.handleGesture(touch.target, duration, distance, this.touchStartPos, touchEndPos, e);
        
        // Clean up
        this.resetTouch();
        
        e.preventDefault();
    }

    handleTouchCancel(e) {
        this.cancelLongPress();
        this.resetTouch();
    }

    handleGesture(target, duration, distance, startPos, endPos, originalEvent) {
        if (duration <= this.touchThreshold.tap.maxDuration && 
            distance <= this.touchThreshold.tap.maxDistance) {
            // Tap gesture
            this.handleTap(target, startPos, originalEvent);
        } else if (distance >= this.touchThreshold.drag.minDistance && 
                   duration >= this.touchThreshold.drag.minDuration) {
            // Drag gesture
            this.handleDragEnd(target, startPos, endPos, originalEvent);
        }
        
        // Remove visual feedback
        this.removeTouchFeedback(target);
    }

    handleTap(target, position, originalEvent) {
        // Simulate click event for tap
        if (this.isGameElement(target)) {
            // Add tap feedback
            this.addTouchFeedback(target, 'tap');
            
            setTimeout(() => {
                this.removeTouchFeedback(target);
            }, 150);
            
            // Create and dispatch synthetic click event
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: position.x,
                clientY: position.y,
                button: 0
            });
            
            // Temporarily allow mouse events for this synthetic click
            this.preventMouseEvents = false;
            target.dispatchEvent(clickEvent);
            
            // Re-enable mouse event prevention after a short delay
            setTimeout(() => {
                this.preventMouseEvents = true;
            }, 50);
        }
    }

    handleDragMove(target, startPos, currentPos, originalEvent) {
        // Only handle drag for tiles
        if (!target.classList.contains('tile')) return;
        
        // Add dragging class for visual feedback
        target.classList.add('dragging');
        
        // Create synthetic drag events if needed
        if (target.draggable && !target.classList.contains('synthetic-drag-active')) {
            target.classList.add('synthetic-drag-active');
            this.startSyntheticDrag(target, startPos, originalEvent);
        }
    }

    handleDragEnd(target, startPos, endPos, originalEvent) {
        if (!target.classList.contains('tile')) return;
        
        // Remove dragging feedback
        target.classList.remove('dragging');
        target.classList.remove('synthetic-drag-active');
        
        // Find drop target at end position
        const dropTarget = this.findDropTarget(endPos);
        
        if (dropTarget && dropTarget !== target) {
            // Simulate drop operation
            this.simulateDrop(target, dropTarget, startPos, endPos);
        }
    }

    handleLongPress(target, touch) {
        if (!this.touchActive) return;
        
        // Add long press feedback
        this.addTouchFeedback(target, 'longpress');
        
        // Handle long press based on target type
        if (target.classList.contains('tile')) {
            // For tiles, long press could show context menu or additional options
            this.showTileContextMenu(target, { x: touch.clientX, y: touch.clientY });
        }
        
        // Provide haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    startSyntheticDrag(target, startPos, originalEvent) {
        // Create synthetic dragstart event
        const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            clientX: startPos.x,
            clientY: startPos.y
        });
        
        // Set up data transfer
        if (dragStartEvent.dataTransfer) {
            const tileIndex = target.dataset.tileIndex;
            const tileId = target.dataset.tileId;
            
            dragStartEvent.dataTransfer.setData('text/plain', tileIndex);
            dragStartEvent.dataTransfer.setData('application/tile-id', tileId);
            dragStartEvent.dataTransfer.setData('application/json', JSON.stringify({
                type: 'hand-tile',
                tileId: tileId,
                sourceIndex: tileIndex
            }));
        }
        
        target.dispatchEvent(dragStartEvent);
    }

    simulateDrop(sourceTarget, dropTarget, startPos, endPos) {
        // Create synthetic drop event
        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            clientX: endPos.x,
            clientY: endPos.y
        });
        
        // Set up data transfer with source tile information
        if (dropEvent.dataTransfer) {
            const tileIndex = sourceTarget.dataset.tileIndex;
            const tileId = sourceTarget.dataset.tileId;
            
            dropEvent.dataTransfer.setData('text/plain', tileIndex);
            dropEvent.dataTransfer.setData('application/tile-id', tileId);
            dropEvent.dataTransfer.setData('application/json', JSON.stringify({
                type: 'hand-tile',
                tileId: tileId,
                sourceIndex: tileIndex
            }));
        }
        
        // Dispatch drop event on target
        dropTarget.dispatchEvent(dropEvent);
        
        // Create synthetic dragend event on source
        const dragEndEvent = new DragEvent('dragend', {
            bubbles: true,
            cancelable: true,
            clientX: endPos.x,
            clientY: endPos.y
        });
        
        sourceTarget.dispatchEvent(dragEndEvent);
    }

    findDropTarget(position) {
        // Temporarily hide all dragging elements to get element underneath
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(el => el.style.pointerEvents = 'none');
        
        const elementBelow = document.elementFromPoint(position.x, position.y);
        
        // Restore pointer events
        draggingElements.forEach(el => el.style.pointerEvents = '');
        
        if (!elementBelow) return null;
        
        // Find the appropriate drop target
        if (elementBelow.classList.contains('tile')) {
            return elementBelow;
        } else if (elementBelow.classList.contains('empty-slot')) {
            return elementBelow;
        } else if (elementBelow.classList.contains('board-area') || 
                   elementBelow.closest('.board-area')) {
            return elementBelow.classList.contains('board-area') ? 
                   elementBelow : elementBelow.closest('.board-area');
        } else if (elementBelow.classList.contains('player-hand') || 
                   elementBelow.closest('.player-hand')) {
            return elementBelow.classList.contains('player-hand') ? 
                   elementBelow : elementBelow.closest('.player-hand');
        }
        
        return null;
    }

    showTileContextMenu(target, position) {
        // This could be extended to show a context menu for tiles
        // For now, just provide visual feedback
        console.log('Long press on tile:', target.dataset.tileId);
        
        // Could show options like:
        // - Select/Deselect
        // - Move to specific position
        // - Tile information
    }

    addTouchFeedback(target, type) {
        target.classList.add('touch-active');
        
        switch (type) {
            case 'touchstart':
                target.classList.add('touch-start');
                break;
            case 'tap':
                target.classList.add('touch-tap');
                break;
            case 'longpress':
                target.classList.add('touch-longpress');
                break;
        }
    }

    removeTouchFeedback(target) {
        target.classList.remove('touch-active', 'touch-start', 'touch-tap', 'touch-longpress');
    }

    addMobileOptimizations() {
        // Add mobile-specific CSS class to body
        document.body.classList.add('mobile-touch-enabled');
        
        // Optimize viewport for mobile gaming
        this.optimizeViewport();
        
        // Add orientation change handling
        this.setupOrientationHandling();
        
        // Prevent unwanted behaviors
        this.preventUnwantedBehaviors();
    }

    optimizeViewport() {
        // Ensure proper viewport meta tag
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
        }
        
        // Add safe area CSS variables support
        if (CSS.supports('padding: env(safe-area-inset-top)')) {
            document.body.classList.add('safe-area-supported');
        }
    }

    setupOrientationHandling() {
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        // Initial orientation setup
        this.handleOrientationChange();
    }

    handleOrientationChange() {
        const orientation = window.orientation || 0;
        const isLandscape = Math.abs(orientation) === 90;
        
        document.body.classList.toggle('landscape', isLandscape);
        document.body.classList.toggle('portrait', !isLandscape);
        
        // Encourage landscape for game screen
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen && gameScreen.classList.contains('active')) {
            if (!isLandscape && window.innerWidth < 768) {
                document.body.classList.add('encourage-landscape');
            } else {
                document.body.classList.remove('encourage-landscape');
            }
        }
    }

    preventUnwantedBehaviors() {
        // Prevent pull-to-refresh on mobile
        document.body.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.body.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Prevent context menu on long press for game elements
        document.addEventListener('contextmenu', (e) => {
            if (this.isGameElement(e.target)) {
                e.preventDefault();
            }
        });
    }

    preventMouseEvent(e) {
        if (this.preventMouseEvents && this.touchActive) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    isGameElement(element) {
        return element.classList.contains('tile') ||
               element.classList.contains('board-area') ||
               element.classList.contains('player-hand') ||
               element.classList.contains('empty-slot') ||
               element.classList.contains('btn') ||
               element.closest('.tile') ||
               element.closest('.board-area') ||
               element.closest('.player-hand') ||
               element.closest('.game-container');
    }

    calculateDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + 
            Math.pow(pos2.y - pos1.y, 2)
        );
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    resetTouch() {
        this.touchActive = false;
        this.touchIdentifier = null;
        this.touchStartTime = null;
        this.touchStartPos = null;
        this.preventMouseEvents = true;
        this.cancelLongPress();
    }
}

// Initialize mobile touch interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on a touch device
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        window.mobileTouchInterface = new MobileTouchInterface();
        console.log('Mobile touch interface initialized');
    }
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileTouchInterface;
}