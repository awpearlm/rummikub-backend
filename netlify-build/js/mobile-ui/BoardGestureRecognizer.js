/**
 * Board Gesture Recognizer
 * Specialized gesture recognition for mobile game board interactions
 * Handles tap, drag, and pinch gestures with game-specific logic
 */

class BoardGestureRecognizer {
    constructor(boardContainer, options = {}) {
        this.boardContainer = boardContainer;
        this.options = {
            tapThreshold: 10, // Maximum movement for tap gesture (pixels)
            tapTimeout: 300, // Maximum duration for tap gesture (ms)
            dragThreshold: 15, // Minimum movement to start drag (pixels)
            pinchThreshold: 10, // Minimum distance change for pinch (pixels)
            doubleTapTimeout: 300, // Maximum time between taps for double tap (ms)
            longPressTimeout: 500, // Duration for long press (ms)
            enablePinchZoom: true,
            enableDoubleTap: true,
            enableLongPress: true,
            ...options
        };
        
        // Gesture state tracking
        this.activeGestures = new Map();
        this.gestureHistory = [];
        this.lastTapTime = 0;
        this.lastTapPosition = null;
        
        // Touch tracking
        this.activeTouches = new Map();
        this.touchStartPositions = new Map();
        this.touchStartTime = null;
        
        // Gesture recognition state
        this.currentGesture = null;
        this.gestureStartTime = null;
        this.gestureStartPosition = null;
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    init() {
        // Setup touch event listeners
        this.setupTouchListeners();
        
        // Setup mouse event listeners for desktop testing
        this.setupMouseListeners();
        
        // Setup pointer event listeners if supported
        this.setupPointerListeners();
        
        console.log('Board Gesture Recognizer initialized');
    }

    setupTouchListeners() {
        this.boardContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.boardContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.boardContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.boardContainer.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
    }

    setupMouseListeners() {
        this.boardContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.boardContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.boardContainer.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.boardContainer.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    setupPointerListeners() {
        if (window.PointerEvent) {
            this.boardContainer.addEventListener('pointerdown', this.handlePointerDown.bind(this));
            this.boardContainer.addEventListener('pointermove', this.handlePointerMove.bind(this));
            this.boardContainer.addEventListener('pointerup', this.handlePointerUp.bind(this));
            this.boardContainer.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
        }
    }

    // Touch event handlers
    handleTouchStart(event) {
        event.preventDefault(); // Prevent default touch behaviors
        
        const touches = Array.from(event.touches);
        const timestamp = Date.now();
        
        // Update active touches
        touches.forEach(touch => {
            this.activeTouches.set(touch.identifier, {
                id: touch.identifier,
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                startTime: timestamp
            });
            this.touchStartPositions.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                time: timestamp
            });
        });
        
        // Determine gesture type based on number of touches
        if (touches.length === 1) {
            this.startSingleTouchGesture(touches[0], timestamp);
        } else if (touches.length === 2) {
            this.startTwoTouchGesture(touches, timestamp);
        }
        
        this.emit('touchStart', {
            touches: touches.map(this.touchToGestureData.bind(this)),
            timestamp
        });
    }

    handleTouchMove(event) {
        event.preventDefault();
        
        const touches = Array.from(event.touches);
        const timestamp = Date.now();
        
        // Update active touches
        touches.forEach(touch => {
            const activeTouch = this.activeTouches.get(touch.identifier);
            if (activeTouch) {
                activeTouch.currentX = touch.clientX;
                activeTouch.currentY = touch.clientY;
            }
        });
        
        // Process gesture based on current state
        if (touches.length === 1) {
            this.processSingleTouchMove(touches[0], timestamp);
        } else if (touches.length === 2) {
            this.processTwoTouchMove(touches, timestamp);
        }
        
        this.emit('touchMove', {
            touches: touches.map(this.touchToGestureData.bind(this)),
            timestamp
        });
    }

    handleTouchEnd(event) {
        const touches = Array.from(event.changedTouches);
        const timestamp = Date.now();
        
        // Process ended touches
        touches.forEach(touch => {
            const activeTouch = this.activeTouches.get(touch.identifier);
            if (activeTouch) {
                this.processTouchEnd(touch, activeTouch, timestamp);
                this.activeTouches.delete(touch.identifier);
                this.touchStartPositions.delete(touch.identifier);
            }
        });
        
        // Reset gesture state if no more touches
        if (this.activeTouches.size === 0) {
            this.resetGestureState();
        }
        
        this.emit('touchEnd', {
            touches: touches.map(this.touchToGestureData.bind(this)),
            timestamp
        });
    }

    handleTouchCancel(event) {
        const touches = Array.from(event.changedTouches);
        
        // Clean up cancelled touches
        touches.forEach(touch => {
            this.activeTouches.delete(touch.identifier);
            this.touchStartPositions.delete(touch.identifier);
        });
        
        // Cancel current gesture
        if (this.currentGesture) {
            this.emit('gestureCancel', {
                gesture: this.currentGesture,
                reason: 'touchCancel'
            });
        }
        
        this.resetGestureState();
        
        this.emit('touchCancel', {
            touches: touches.map(this.touchToGestureData.bind(this))
        });
    }

    // Mouse event handlers (for desktop testing)
    handleMouseDown(event) {
        const touch = {
            identifier: 'mouse',
            clientX: event.clientX,
            clientY: event.clientY
        };
        
        this.handleTouchStart({
            preventDefault: () => event.preventDefault(),
            touches: [touch]
        });
    }

    handleMouseMove(event) {
        if (this.activeTouches.has('mouse')) {
            const touch = {
                identifier: 'mouse',
                clientX: event.clientX,
                clientY: event.clientY
            };
            
            this.handleTouchMove({
                preventDefault: () => event.preventDefault(),
                touches: [touch]
            });
        }
    }

    handleMouseUp(event) {
        if (this.activeTouches.has('mouse')) {
            const touch = {
                identifier: 'mouse',
                clientX: event.clientX,
                clientY: event.clientY
            };
            
            this.handleTouchEnd({
                changedTouches: [touch]
            });
        }
    }

    handleWheel(event) {
        if (this.options.enablePinchZoom) {
            event.preventDefault();
            
            const delta = event.deltaY;
            const scale = delta > 0 ? 0.9 : 1.1;
            
            this.emit('pinchZoom', {
                centerX: event.clientX,
                centerY: event.clientY,
                scale: scale,
                delta: delta,
                source: 'wheel'
            });
        }
    }

    // Pointer event handlers
    handlePointerDown(event) {
        // Convert pointer event to touch-like event
        const touch = {
            identifier: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY
        };
        
        this.handleTouchStart({
            preventDefault: () => event.preventDefault(),
            touches: [touch]
        });
    }

    handlePointerMove(event) {
        if (this.activeTouches.has(event.pointerId)) {
            const touch = {
                identifier: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY
            };
            
            this.handleTouchMove({
                preventDefault: () => event.preventDefault(),
                touches: [touch]
            });
        }
    }

    handlePointerUp(event) {
        if (this.activeTouches.has(event.pointerId)) {
            const touch = {
                identifier: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY
            };
            
            this.handleTouchEnd({
                changedTouches: [touch]
            });
        }
    }

    handlePointerCancel(event) {
        if (this.activeTouches.has(event.pointerId)) {
            const touch = {
                identifier: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY
            };
            
            this.handleTouchCancel({
                changedTouches: [touch]
            });
        }
    }

    // Gesture recognition logic
    startSingleTouchGesture(touch, timestamp) {
        this.currentGesture = {
            type: 'unknown',
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
            startTime: timestamp,
            touchId: touch.identifier
        };
        
        this.gestureStartTime = timestamp;
        this.gestureStartPosition = { x: touch.clientX, y: touch.clientY };
        
        // Start long press timer if enabled
        if (this.options.enableLongPress) {
            this.startLongPressTimer(touch, timestamp);
        }
    }

    startTwoTouchGesture(touches, timestamp) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const distance = this.calculateDistance(touch1, touch2);
        
        this.currentGesture = {
            type: 'pinch',
            centerX: centerX,
            centerY: centerY,
            startDistance: distance,
            currentDistance: distance,
            startTime: timestamp,
            touches: [touch1.identifier, touch2.identifier]
        };
        
        this.gestureStartTime = timestamp;
        this.gestureStartPosition = { x: centerX, y: centerY };
    }

    processSingleTouchMove(touch, timestamp) {
        if (!this.currentGesture) return;
        
        const deltaX = touch.clientX - this.currentGesture.startX;
        const deltaY = touch.clientY - this.currentGesture.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        this.currentGesture.currentX = touch.clientX;
        this.currentGesture.currentY = touch.clientY;
        
        // Determine gesture type based on movement
        if (this.currentGesture.type === 'unknown') {
            if (distance > this.options.dragThreshold) {
                this.currentGesture.type = 'drag';
                this.cancelLongPressTimer();
                
                this.emit('dragStart', {
                    startX: this.currentGesture.startX,
                    startY: this.currentGesture.startY,
                    currentX: touch.clientX,
                    currentY: touch.clientY,
                    deltaX: deltaX,
                    deltaY: deltaY,
                    distance: distance,
                    timestamp: timestamp
                });
            }
        } else if (this.currentGesture.type === 'drag') {
            this.emit('dragMove', {
                startX: this.currentGesture.startX,
                startY: this.currentGesture.startY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                deltaX: deltaX,
                deltaY: deltaY,
                distance: distance,
                timestamp: timestamp
            });
        }
    }

    processTwoTouchMove(touches, timestamp) {
        if (!this.currentGesture || this.currentGesture.type !== 'pinch') return;
        
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const distance = this.calculateDistance(touch1, touch2);
        
        const scale = distance / this.currentGesture.startDistance;
        const deltaDistance = distance - this.currentGesture.currentDistance;
        
        this.currentGesture.centerX = centerX;
        this.currentGesture.centerY = centerY;
        this.currentGesture.currentDistance = distance;
        
        // Only emit pinch events if significant change
        if (Math.abs(deltaDistance) > this.options.pinchThreshold) {
            this.emit('pinchZoom', {
                centerX: centerX,
                centerY: centerY,
                scale: scale,
                startDistance: this.currentGesture.startDistance,
                currentDistance: distance,
                deltaDistance: deltaDistance,
                timestamp: timestamp,
                source: 'touch'
            });
        }
    }

    processTouchEnd(touch, activeTouch, timestamp) {
        if (!this.currentGesture) return;
        
        const duration = timestamp - activeTouch.startTime;
        const deltaX = touch.clientX - activeTouch.startX;
        const deltaY = touch.clientY - activeTouch.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Process gesture completion based on type
        if (this.currentGesture.type === 'unknown' || this.currentGesture.type === 'tap') {
            this.processTapGesture(touch, activeTouch, duration, distance, timestamp);
        } else if (this.currentGesture.type === 'drag') {
            this.processDragEnd(touch, activeTouch, duration, distance, timestamp);
        } else if (this.currentGesture.type === 'pinch') {
            this.processPinchEnd(timestamp);
        }
    }

    processTapGesture(touch, activeTouch, duration, distance, timestamp) {
        // Check if it's a valid tap
        if (distance <= this.options.tapThreshold && duration <= this.options.tapTimeout) {
            // Check for double tap
            if (this.options.enableDoubleTap && this.isDoubleTap(touch, timestamp)) {
                this.emit('doubleTap', {
                    x: touch.clientX,
                    y: touch.clientY,
                    timestamp: timestamp
                });
            } else {
                this.emit('tap', {
                    x: touch.clientX,
                    y: touch.clientY,
                    duration: duration,
                    timestamp: timestamp
                });
                
                // Store for potential double tap
                this.lastTapTime = timestamp;
                this.lastTapPosition = { x: touch.clientX, y: touch.clientY };
            }
        }
        
        this.cancelLongPressTimer();
    }

    processDragEnd(touch, activeTouch, duration, distance, timestamp) {
        const deltaX = touch.clientX - activeTouch.startX;
        const deltaY = touch.clientY - activeTouch.startY;
        
        this.emit('dragEnd', {
            startX: activeTouch.startX,
            startY: activeTouch.startY,
            endX: touch.clientX,
            endY: touch.clientY,
            deltaX: deltaX,
            deltaY: deltaY,
            distance: distance,
            duration: duration,
            timestamp: timestamp
        });
    }

    processPinchEnd(timestamp) {
        if (this.currentGesture && this.currentGesture.type === 'pinch') {
            const duration = timestamp - this.currentGesture.startTime;
            const finalScale = this.currentGesture.currentDistance / this.currentGesture.startDistance;
            
            this.emit('pinchEnd', {
                centerX: this.currentGesture.centerX,
                centerY: this.currentGesture.centerY,
                finalScale: finalScale,
                startDistance: this.currentGesture.startDistance,
                endDistance: this.currentGesture.currentDistance,
                duration: duration,
                timestamp: timestamp
            });
        }
    }

    // Long press handling
    startLongPressTimer(touch, timestamp) {
        this.cancelLongPressTimer();
        
        this.longPressTimer = setTimeout(() => {
            if (this.currentGesture && this.currentGesture.type === 'unknown') {
                this.currentGesture.type = 'longPress';
                
                this.emit('longPress', {
                    x: touch.clientX,
                    y: touch.clientY,
                    duration: this.options.longPressTimeout,
                    timestamp: Date.now()
                });
            }
        }, this.options.longPressTimeout);
    }

    cancelLongPressTimer() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    // Utility methods
    isDoubleTap(touch, timestamp) {
        if (!this.lastTapTime || !this.lastTapPosition) return false;
        
        const timeDelta = timestamp - this.lastTapTime;
        const distance = this.calculateDistance(
            { clientX: touch.clientX, clientY: touch.clientY },
            { clientX: this.lastTapPosition.x, clientY: this.lastTapPosition.y }
        );
        
        return timeDelta <= this.options.doubleTapTimeout && distance <= this.options.tapThreshold;
    }

    calculateDistance(touch1, touch2) {
        const deltaX = touch2.clientX - touch1.clientX;
        const deltaY = touch2.clientY - touch1.clientY;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    touchToGestureData(touch) {
        const activeTouch = this.activeTouches.get(touch.identifier);
        return {
            id: touch.identifier,
            x: touch.clientX,
            y: touch.clientY,
            startX: activeTouch ? activeTouch.startX : touch.clientX,
            startY: activeTouch ? activeTouch.startY : touch.clientY,
            deltaX: activeTouch ? touch.clientX - activeTouch.startX : 0,
            deltaY: activeTouch ? touch.clientY - activeTouch.startY : 0
        };
    }

    resetGestureState() {
        this.currentGesture = null;
        this.gestureStartTime = null;
        this.gestureStartPosition = null;
        this.cancelLongPressTimer();
    }

    // Public API methods
    getCurrentGesture() {
        return this.currentGesture ? { ...this.currentGesture } : null;
    }

    getActiveTouches() {
        return Array.from(this.activeTouches.values());
    }

    isGestureActive() {
        return this.currentGesture !== null;
    }

    setOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    getOptions() {
        return { ...this.options };
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
                    console.error(`Error in gesture callback for ${eventName}:`, error);
                }
            });
        }
    }

    // Cleanup
    destroy() {
        // Cancel any active timers
        this.cancelLongPressTimer();
        
        // Clear active touches
        this.activeTouches.clear();
        this.touchStartPositions.clear();
        
        // Reset gesture state
        this.resetGestureState();
        
        // Clear event callbacks
        this.eventCallbacks.clear();
        
        // Remove event listeners
        if (this.boardContainer) {
            // Touch events
            this.boardContainer.removeEventListener('touchstart', this.handleTouchStart);
            this.boardContainer.removeEventListener('touchmove', this.handleTouchMove);
            this.boardContainer.removeEventListener('touchend', this.handleTouchEnd);
            this.boardContainer.removeEventListener('touchcancel', this.handleTouchCancel);
            
            // Mouse events
            this.boardContainer.removeEventListener('mousedown', this.handleMouseDown);
            this.boardContainer.removeEventListener('mousemove', this.handleMouseMove);
            this.boardContainer.removeEventListener('mouseup', this.handleMouseUp);
            this.boardContainer.removeEventListener('wheel', this.handleWheel);
            
            // Pointer events
            if (window.PointerEvent) {
                this.boardContainer.removeEventListener('pointerdown', this.handlePointerDown);
                this.boardContainer.removeEventListener('pointermove', this.handlePointerMove);
                this.boardContainer.removeEventListener('pointerup', this.handlePointerUp);
                this.boardContainer.removeEventListener('pointercancel', this.handlePointerCancel);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoardGestureRecognizer;
} else if (typeof window !== 'undefined') {
    window.BoardGestureRecognizer = BoardGestureRecognizer;
}