/**
 * Touch Manager
 * Centralized touch event handling with gesture recognition and conflict resolution
 * Provides comprehensive touch and gesture support for mobile UI
 */

class TouchManager {
    constructor() {
        this.touchTargets = new Map();
        this.activeTouches = new Map();
        this.gestureThresholds = {
            tap: { maxDistance: 10, maxDuration: 300 },
            drag: { minDistance: 15, minDuration: 100 },
            longPress: { minDuration: 500, maxDistance: 15 },
            swipe: { minDistance: 50, maxVelocity: 1000 },
            pinch: { minDistance: 20 }
        };
        
        this.preventMouseEvents = false;
        this.touchStartTime = null;
        this.longPressTimers = new Map();
        
        this.init();
    }

    init() {
        this.isTouchDevice = this.detectTouchDevice();
        
        if (this.isTouchDevice) {
            this.setupTouchEventListeners();
            this.setupMouseEventPrevention();
            this.addTouchOptimizations();
        }
    }

    detectTouchDevice() {
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 || 
               navigator.msMaxTouchPoints > 0;
    }

    setupTouchEventListeners() {
        const options = { passive: false, capture: true };
        
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), options);
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), options);
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), options);
        document.addEventListener('touchcancel', this.handleTouchCancel.bind(this), options);
    }

    setupMouseEventPrevention() {
        const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click'];
        
        mouseEvents.forEach(eventType => {
            document.addEventListener(eventType, this.preventMouseEvent.bind(this), {
                passive: false,
                capture: true
            });
        });
    }

    addTouchOptimizations() {
        // Add touch-specific CSS class
        document.body.classList.add('touch-enabled');
        
        // Prevent default touch behaviors
        this.preventUnwantedTouchBehaviors();
        
        // Add haptic feedback support
        this.setupHapticFeedback();
    }

    preventUnwantedTouchBehaviors() {
        // Prevent pull-to-refresh
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
        }, { passive: false });

        // Prevent context menu on long press for game elements
        document.addEventListener('contextmenu', (e) => {
            if (this.isRegisteredTouchTarget(e.target)) {
                e.preventDefault();
            }
        });
    }

    setupHapticFeedback() {
        this.hapticSupported = 'vibrate' in navigator;
    }

    registerTouchTarget(element, handlers) {
        if (!element || typeof handlers !== 'object') {
            console.warn('Invalid touch target registration');
            return;
        }

        const touchHandlers = {
            onTap: handlers.onTap || null,
            onDrag: handlers.onDrag || null,
            onDragStart: handlers.onDragStart || null,
            onDragEnd: handlers.onDragEnd || null,
            onLongPress: handlers.onLongPress || null,
            onSwipe: handlers.onSwipe || null,
            onPinch: handlers.onPinch || null,
            onTouchStart: handlers.onTouchStart || null,
            onTouchEnd: handlers.onTouchEnd || null
        };

        this.touchTargets.set(element, touchHandlers);
        
        // Add touch target class for styling
        element.classList.add('touch-target');
        
        // Ensure proper touch target size
        this.ensureTouchTargetSize(element);
    }

    unregisterTouchTarget(element) {
        if (this.touchTargets.has(element)) {
            this.touchTargets.delete(element);
            element.classList.remove('touch-target');
        }
    }

    ensureTouchTargetSize(element) {
        const rect = element.getBoundingClientRect();
        const minSize = 44; // Minimum touch target size in pixels
        
        if (rect.width < minSize || rect.height < minSize) {
            element.style.minWidth = `${minSize}px`;
            element.style.minHeight = `${minSize}px`;
        }
    }

    handleTouchStart(e) {
        this.preventMouseEvents = true;
        
        Array.from(e.changedTouches).forEach(touch => {
            const touchData = this.createTouchData(touch, e);
            this.activeTouches.set(touch.identifier, touchData);
            
            // Start long press timer
            this.startLongPressTimer(touch.identifier, touchData);
            
            // Handle touch start for registered targets
            const target = this.findTouchTarget(touch.target);
            if (target) {
                this.handleTouchTargetStart(target, touchData, e);
            }
        });
        
        // Prevent default for registered touch targets
        if (this.shouldPreventDefault(e.target)) {
            e.preventDefault();
        }
    }

    handleTouchMove(e) {
        Array.from(e.changedTouches).forEach(touch => {
            const touchData = this.activeTouches.get(touch.identifier);
            if (!touchData) return;
            
            // Update touch data
            this.updateTouchData(touchData, touch);
            
            // Cancel long press if moved too far
            const distance = this.calculateDistance(touchData.startPosition, touchData.currentPosition);
            if (distance > this.gestureThresholds.longPress.maxDistance) {
                this.cancelLongPressTimer(touch.identifier);
            }
            
            // Handle drag if threshold exceeded
            if (distance > this.gestureThresholds.drag.minDistance && !touchData.isDragging) {
                touchData.isDragging = true;
                this.handleDragStart(touchData, e);
            }
            
            if (touchData.isDragging) {
                this.handleDragMove(touchData, e);
            }
        });
        
        // Handle multi-touch gestures
        if (e.touches.length === 2) {
            this.handlePinchGesture(e);
        }
        
        if (this.shouldPreventDefault(e.target)) {
            e.preventDefault();
        }
    }

    handleTouchEnd(e) {
        Array.from(e.changedTouches).forEach(touch => {
            const touchData = this.activeTouches.get(touch.identifier);
            if (!touchData) return;
            
            // Update final touch data
            this.updateTouchData(touchData, touch);
            touchData.endTime = Date.now();
            
            // Cancel long press timer
            this.cancelLongPressTimer(touch.identifier);
            
            // Determine and handle gesture
            this.handleGestureEnd(touchData, e);
            
            // Clean up
            this.activeTouches.delete(touch.identifier);
        });
        
        // Re-enable mouse events after a delay
        setTimeout(() => {
            this.preventMouseEvents = false;
        }, 100);
        
        if (this.shouldPreventDefault(e.target)) {
            e.preventDefault();
        }
    }

    handleTouchCancel(e) {
        Array.from(e.changedTouches).forEach(touch => {
            const touchData = this.activeTouches.get(touch.identifier);
            if (touchData) {
                this.cancelLongPressTimer(touch.identifier);
                
                if (touchData.isDragging) {
                    this.handleDragCancel(touchData, e);
                }
                
                this.activeTouches.delete(touch.identifier);
            }
        });
    }

    createTouchData(touch, originalEvent) {
        return {
            identifier: touch.identifier,
            startPosition: { x: touch.clientX, y: touch.clientY },
            currentPosition: { x: touch.clientX, y: touch.clientY },
            startTime: Date.now(),
            endTime: null,
            target: touch.target,
            isDragging: false,
            originalEvent: originalEvent
        };
    }

    updateTouchData(touchData, touch) {
        touchData.currentPosition = { x: touch.clientX, y: touch.clientY };
    }

    startLongPressTimer(touchId, touchData) {
        const timer = setTimeout(() => {
            if (this.activeTouches.has(touchId)) {
                this.handleLongPress(touchData);
            }
        }, this.gestureThresholds.longPress.minDuration);
        
        this.longPressTimers.set(touchId, timer);
    }

    cancelLongPressTimer(touchId) {
        const timer = this.longPressTimers.get(touchId);
        if (timer) {
            clearTimeout(timer);
            this.longPressTimers.delete(touchId);
        }
    }

    handleGestureEnd(touchData, originalEvent) {
        const duration = touchData.endTime - touchData.startTime;
        const distance = this.calculateDistance(touchData.startPosition, touchData.currentPosition);
        
        if (touchData.isDragging) {
            this.handleDragEnd(touchData, originalEvent);
        } else if (this.isTapGesture(duration, distance)) {
            this.handleTap(touchData, originalEvent);
        } else if (this.isSwipeGesture(touchData, duration, distance)) {
            this.handleSwipe(touchData, originalEvent);
        }
    }

    isTapGesture(duration, distance) {
        return duration <= this.gestureThresholds.tap.maxDuration &&
               distance <= this.gestureThresholds.tap.maxDistance;
    }

    isSwipeGesture(touchData, duration, distance) {
        if (distance < this.gestureThresholds.swipe.minDistance) return false;
        
        const velocity = distance / duration;
        return velocity <= this.gestureThresholds.swipe.maxVelocity;
    }

    handleTap(touchData, originalEvent) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            const handlers = this.touchTargets.get(target);
            
            // Add visual feedback
            this.addTouchFeedback(target, 'tap');
            
            // Provide haptic feedback
            this.provideHapticFeedback('light');
            
            // Call handler
            if (handlers.onTap) {
                handlers.onTap(touchData, originalEvent);
            }
            
            // Simulate click event for compatibility
            this.simulateClickEvent(target, touchData.startPosition);
        }
    }

    handleDragStart(touchData, originalEvent) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            const handlers = this.touchTargets.get(target);
            
            // Add visual feedback
            this.addTouchFeedback(target, 'drag-start');
            
            // Provide haptic feedback
            this.provideHapticFeedback('medium');
            
            // Call handler
            if (handlers.onDragStart) {
                handlers.onDragStart(touchData, originalEvent);
            }
        }
    }

    handleDragMove(touchData, originalEvent) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            const handlers = this.touchTargets.get(target);
            
            if (handlers.onDrag) {
                handlers.onDrag(touchData, originalEvent);
            }
        }
    }

    handleDragEnd(touchData, originalEvent) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            const handlers = this.touchTargets.get(target);
            
            // Remove visual feedback
            this.removeTouchFeedback(target, 'drag-start');
            
            // Call handler
            if (handlers.onDragEnd) {
                handlers.onDragEnd(touchData, originalEvent);
            }
        }
    }

    handleDragCancel(touchData, originalEvent) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            // Remove visual feedback
            this.removeTouchFeedback(target, 'drag-start');
            
            // Reset any drag state
            target.classList.remove('dragging');
        }
    }

    handleLongPress(touchData) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            const handlers = this.touchTargets.get(target);
            
            // Add visual feedback
            this.addTouchFeedback(target, 'long-press');
            
            // Provide haptic feedback
            this.provideHapticFeedback('heavy');
            
            // Call handler
            if (handlers.onLongPress) {
                handlers.onLongPress(touchData);
            }
        }
    }

    handleSwipe(touchData, originalEvent) {
        const target = this.findTouchTarget(touchData.target);
        if (target) {
            const handlers = this.touchTargets.get(target);
            
            // Calculate swipe direction
            const deltaX = touchData.currentPosition.x - touchData.startPosition.x;
            const deltaY = touchData.currentPosition.y - touchData.startPosition.y;
            
            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }
            
            const swipeData = {
                ...touchData,
                direction,
                deltaX,
                deltaY,
                velocity: this.calculateDistance(touchData.startPosition, touchData.currentPosition) / 
                         (touchData.endTime - touchData.startTime)
            };
            
            // Call handler
            if (handlers.onSwipe) {
                handlers.onSwipe(swipeData, originalEvent);
            }
        }
    }

    handlePinchGesture(e) {
        if (e.touches.length !== 2) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        const distance = this.calculateDistance(
            { x: touch1.clientX, y: touch1.clientY },
            { x: touch2.clientX, y: touch2.clientY }
        );
        
        // Find common touch target
        const target1 = this.findTouchTarget(touch1.target);
        const target2 = this.findTouchTarget(touch2.target);
        
        if (target1 === target2 && target1) {
            const handlers = this.touchTargets.get(target1);
            
            if (handlers.onPinch) {
                const pinchData = {
                    distance,
                    center: {
                        x: (touch1.clientX + touch2.clientX) / 2,
                        y: (touch1.clientY + touch2.clientY) / 2
                    },
                    touch1: { x: touch1.clientX, y: touch1.clientY },
                    touch2: { x: touch2.clientX, y: touch2.clientY }
                };
                
                handlers.onPinch(pinchData, e);
            }
        }
    }

    handleTouchTargetStart(target, touchData, originalEvent) {
        const handlers = this.touchTargets.get(target);
        
        // Add visual feedback
        this.addTouchFeedback(target, 'touch-start');
        
        // Call handler
        if (handlers.onTouchStart) {
            handlers.onTouchStart(touchData, originalEvent);
        }
    }

    addTouchFeedback(element, type) {
        element.classList.add('touch-active', `touch-${type}`);
        
        // Remove feedback after animation
        setTimeout(() => {
            this.removeTouchFeedback(element, type);
        }, 150);
    }

    removeTouchFeedback(element, type) {
        element.classList.remove('touch-active', `touch-${type}`);
    }

    provideHapticFeedback(intensity = 'light') {
        if (!this.hapticSupported) return;
        
        const patterns = {
            light: 10,
            medium: 50,
            heavy: 100
        };
        
        navigator.vibrate(patterns[intensity] || patterns.light);
    }

    simulateClickEvent(target, position) {
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: position.x,
            clientY: position.y,
            button: 0
        });
        
        // Temporarily allow mouse events
        this.preventMouseEvents = false;
        target.dispatchEvent(clickEvent);
        
        // Re-enable prevention after a short delay
        setTimeout(() => {
            this.preventMouseEvents = true;
        }, 50);
    }

    findTouchTarget(element) {
        let current = element;
        
        while (current && current !== document.body) {
            if (this.touchTargets.has(current)) {
                return current;
            }
            current = current.parentElement;
        }
        
        return null;
    }

    isRegisteredTouchTarget(element) {
        return this.findTouchTarget(element) !== null;
    }

    shouldPreventDefault(target) {
        return this.isRegisteredTouchTarget(target);
    }

    preventMouseEvent(e) {
        if (this.preventMouseEvents) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    calculateDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + 
            Math.pow(pos2.y - pos1.y, 2)
        );
    }

    // Public API methods
    getActiveTouches() {
        return Array.from(this.activeTouches.values());
    }

    getTouchTargets() {
        return Array.from(this.touchTargets.keys());
    }

    isTouch() {
        return this.isTouchDevice;
    }

    destroy() {
        // Remove event listeners
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('touchcancel', this.handleTouchCancel);
        
        // Clear timers
        this.longPressTimers.forEach(timer => clearTimeout(timer));
        this.longPressTimers.clear();
        
        // Clear data
        this.touchTargets.clear();
        this.activeTouches.clear();
        
        // Remove CSS class
        document.body.classList.remove('touch-enabled');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchManager;
} else if (typeof window !== 'undefined') {
    window.TouchManager = TouchManager;
}