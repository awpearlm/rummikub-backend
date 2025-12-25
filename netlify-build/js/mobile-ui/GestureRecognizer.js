/**
 * Gesture Recognizer
 * Advanced gesture recognition system for mobile touch interactions
 * Provides sophisticated gesture detection and classification
 */

class GestureRecognizer {
    constructor() {
        this.gestures = new Map();
        this.activeGestures = new Set();
        this.gestureHistory = [];
        this.maxHistoryLength = 10;
        
        this.thresholds = {
            tap: {
                maxDistance: 10,
                maxDuration: 300,
                minDuration: 50
            },
            doubleTap: {
                maxDistance: 20,
                maxInterval: 400,
                maxDuration: 300
            },
            drag: {
                minDistance: 15,
                minDuration: 100
            },
            swipe: {
                minDistance: 50,
                maxDuration: 1000,
                minVelocity: 0.3
            },
            longPress: {
                minDuration: 500,
                maxDistance: 15
            },
            pinch: {
                minDistanceChange: 20,
                minDuration: 100
            },
            rotate: {
                minAngleChange: 15,
                minDuration: 100
            }
        };
        
        this.init();
    }

    init() {
        this.setupGestureDefinitions();
    }

    setupGestureDefinitions() {
        // Define standard gesture patterns
        this.defineGesture('tap', this.recognizeTap.bind(this));
        this.defineGesture('doubleTap', this.recognizeDoubleTap.bind(this));
        this.defineGesture('drag', this.recognizeDrag.bind(this));
        this.defineGesture('swipe', this.recognizeSwipe.bind(this));
        this.defineGesture('longPress', this.recognizeLongPress.bind(this));
        this.defineGesture('pinch', this.recognizePinch.bind(this));
        this.defineGesture('rotate', this.recognizeRotate.bind(this));
    }

    defineGesture(name, recognizer) {
        this.gestures.set(name, {
            name,
            recognizer,
            enabled: true
        });
    }

    recognizeTap(touchData) {
        if (!touchData.endTime) return null;
        
        const duration = touchData.endTime - touchData.startTime;
        const distance = this.calculateDistance(touchData.startPosition, touchData.currentPosition);
        
        if (duration >= this.thresholds.tap.minDuration &&
            duration <= this.thresholds.tap.maxDuration &&
            distance <= this.thresholds.tap.maxDistance) {
            
            return {
                type: 'tap',
                position: touchData.startPosition,
                duration,
                distance,
                timestamp: touchData.endTime,
                confidence: this.calculateTapConfidence(duration, distance)
            };
        }
        
        return null;
    }

    recognizeDoubleTap(touchData) {
        const tapGesture = this.recognizeTap(touchData);
        if (!tapGesture) return null;
        
        // Check for previous tap in history
        const recentTap = this.findRecentGesture('tap', this.thresholds.doubleTap.maxInterval);
        
        if (recentTap) {
            const distance = this.calculateDistance(recentTap.position, tapGesture.position);
            const interval = tapGesture.timestamp - recentTap.timestamp;
            
            if (distance <= this.thresholds.doubleTap.maxDistance &&
                interval <= this.thresholds.doubleTap.maxInterval) {
                
                return {
                    type: 'doubleTap',
                    position: tapGesture.position,
                    interval,
                    distance,
                    timestamp: tapGesture.timestamp,
                    confidence: this.calculateDoubleTapConfidence(interval, distance)
                };
            }
        }
        
        return null;
    }

    recognizeDrag(touchData) {
        if (!touchData.isDragging) return null;
        
        const duration = (touchData.endTime || Date.now()) - touchData.startTime;
        const distance = this.calculateDistance(touchData.startPosition, touchData.currentPosition);
        
        if (duration >= this.thresholds.drag.minDuration &&
            distance >= this.thresholds.drag.minDistance) {
            
            const deltaX = touchData.currentPosition.x - touchData.startPosition.x;
            const deltaY = touchData.currentPosition.y - touchData.startPosition.y;
            
            return {
                type: 'drag',
                startPosition: touchData.startPosition,
                currentPosition: touchData.currentPosition,
                deltaX,
                deltaY,
                distance,
                duration,
                velocity: distance / duration,
                angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
                timestamp: touchData.endTime || Date.now(),
                confidence: this.calculateDragConfidence(distance, duration)
            };
        }
        
        return null;
    }

    recognizeSwipe(touchData) {
        if (!touchData.endTime) return null;
        
        const duration = touchData.endTime - touchData.startTime;
        const distance = this.calculateDistance(touchData.startPosition, touchData.currentPosition);
        const velocity = distance / duration;
        
        if (distance >= this.thresholds.swipe.minDistance &&
            duration <= this.thresholds.swipe.maxDuration &&
            velocity >= this.thresholds.swipe.minVelocity) {
            
            const deltaX = touchData.currentPosition.x - touchData.startPosition.x;
            const deltaY = touchData.currentPosition.y - touchData.startPosition.y;
            
            // Determine primary direction
            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }
            
            return {
                type: 'swipe',
                direction,
                startPosition: touchData.startPosition,
                endPosition: touchData.currentPosition,
                deltaX,
                deltaY,
                distance,
                duration,
                velocity,
                angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
                timestamp: touchData.endTime,
                confidence: this.calculateSwipeConfidence(velocity, distance, duration)
            };
        }
        
        return null;
    }

    recognizeLongPress(touchData) {
        const duration = (touchData.endTime || Date.now()) - touchData.startTime;
        const distance = this.calculateDistance(touchData.startPosition, touchData.currentPosition);
        
        if (duration >= this.thresholds.longPress.minDuration &&
            distance <= this.thresholds.longPress.maxDistance) {
            
            return {
                type: 'longPress',
                position: touchData.startPosition,
                duration,
                distance,
                timestamp: touchData.endTime || Date.now(),
                confidence: this.calculateLongPressConfidence(duration, distance)
            };
        }
        
        return null;
    }

    recognizePinch(touchDataArray) {
        if (!Array.isArray(touchDataArray) || touchDataArray.length !== 2) return null;
        
        const [touch1, touch2] = touchDataArray;
        
        const startDistance = this.calculateDistance(touch1.startPosition, touch2.startPosition);
        const currentDistance = this.calculateDistance(touch1.currentPosition, touch2.currentPosition);
        const distanceChange = Math.abs(currentDistance - startDistance);
        
        const duration = Math.max(
            (touch1.endTime || Date.now()) - touch1.startTime,
            (touch2.endTime || Date.now()) - touch2.startTime
        );
        
        if (distanceChange >= this.thresholds.pinch.minDistanceChange &&
            duration >= this.thresholds.pinch.minDuration) {
            
            const scale = currentDistance / startDistance;
            const center = {
                x: (touch1.currentPosition.x + touch2.currentPosition.x) / 2,
                y: (touch1.currentPosition.y + touch2.currentPosition.y) / 2
            };
            
            return {
                type: 'pinch',
                scale,
                startDistance,
                currentDistance,
                distanceChange,
                center,
                duration,
                direction: scale > 1 ? 'out' : 'in',
                timestamp: Math.max(touch1.endTime || 0, touch2.endTime || 0) || Date.now(),
                confidence: this.calculatePinchConfidence(distanceChange, duration)
            };
        }
        
        return null;
    }

    recognizeRotate(touchDataArray) {
        if (!Array.isArray(touchDataArray) || touchDataArray.length !== 2) return null;
        
        const [touch1, touch2] = touchDataArray;
        
        const startAngle = this.calculateAngle(touch1.startPosition, touch2.startPosition);
        const currentAngle = this.calculateAngle(touch1.currentPosition, touch2.currentPosition);
        const angleChange = Math.abs(currentAngle - startAngle);
        
        const duration = Math.max(
            (touch1.endTime || Date.now()) - touch1.startTime,
            (touch2.endTime || Date.now()) - touch2.startTime
        );
        
        if (angleChange >= this.thresholds.rotate.minAngleChange &&
            duration >= this.thresholds.rotate.minDuration) {
            
            const center = {
                x: (touch1.currentPosition.x + touch2.currentPosition.x) / 2,
                y: (touch1.currentPosition.y + touch2.currentPosition.y) / 2
            };
            
            return {
                type: 'rotate',
                startAngle,
                currentAngle,
                angleChange,
                rotation: currentAngle - startAngle,
                center,
                duration,
                direction: (currentAngle - startAngle) > 0 ? 'clockwise' : 'counterclockwise',
                timestamp: Math.max(touch1.endTime || 0, touch2.endTime || 0) || Date.now(),
                confidence: this.calculateRotateConfidence(angleChange, duration)
            };
        }
        
        return null;
    }

    // Confidence calculation methods
    calculateTapConfidence(duration, distance) {
        const durationScore = 1 - (duration / this.thresholds.tap.maxDuration);
        const distanceScore = 1 - (distance / this.thresholds.tap.maxDistance);
        return (durationScore + distanceScore) / 2;
    }

    calculateDoubleTapConfidence(interval, distance) {
        const intervalScore = 1 - (interval / this.thresholds.doubleTap.maxInterval);
        const distanceScore = 1 - (distance / this.thresholds.doubleTap.maxDistance);
        return (intervalScore + distanceScore) / 2;
    }

    calculateDragConfidence(distance, duration) {
        const distanceScore = Math.min(distance / (this.thresholds.drag.minDistance * 2), 1);
        const durationScore = Math.min(duration / (this.thresholds.drag.minDuration * 2), 1);
        return (distanceScore + durationScore) / 2;
    }

    calculateSwipeConfidence(velocity, distance, duration) {
        const velocityScore = Math.min(velocity / (this.thresholds.swipe.minVelocity * 2), 1);
        const distanceScore = Math.min(distance / (this.thresholds.swipe.minDistance * 2), 1);
        const durationScore = 1 - (duration / this.thresholds.swipe.maxDuration);
        return (velocityScore + distanceScore + durationScore) / 3;
    }

    calculateLongPressConfidence(duration, distance) {
        const durationScore = Math.min(duration / (this.thresholds.longPress.minDuration * 2), 1);
        const distanceScore = 1 - (distance / this.thresholds.longPress.maxDistance);
        return (durationScore + distanceScore) / 2;
    }

    calculatePinchConfidence(distanceChange, duration) {
        const distanceScore = Math.min(distanceChange / (this.thresholds.pinch.minDistanceChange * 2), 1);
        const durationScore = Math.min(duration / (this.thresholds.pinch.minDuration * 2), 1);
        return (distanceScore + durationScore) / 2;
    }

    calculateRotateConfidence(angleChange, duration) {
        const angleScore = Math.min(angleChange / (this.thresholds.rotate.minAngleChange * 2), 1);
        const durationScore = Math.min(duration / (this.thresholds.rotate.minDuration * 2), 1);
        return (angleScore + durationScore) / 2;
    }

    // Utility methods
    calculateDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + 
            Math.pow(pos2.y - pos1.y, 2)
        );
    }

    calculateAngle(pos1, pos2) {
        return Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x) * 180 / Math.PI;
    }

    findRecentGesture(type, maxAge) {
        const now = Date.now();
        
        for (let i = this.gestureHistory.length - 1; i >= 0; i--) {
            const gesture = this.gestureHistory[i];
            
            if (gesture.type === type && (now - gesture.timestamp) <= maxAge) {
                return gesture;
            }
        }
        
        return null;
    }

    addToHistory(gesture) {
        this.gestureHistory.push(gesture);
        
        // Limit history size
        if (this.gestureHistory.length > this.maxHistoryLength) {
            this.gestureHistory.shift();
        }
    }

    // Public API methods
    recognizeGesture(touchData) {
        const recognizedGestures = [];
        
        // Single touch gestures
        if (!Array.isArray(touchData)) {
            for (const [name, gestureConfig] of this.gestures) {
                if (!gestureConfig.enabled) continue;
                
                // Skip multi-touch gestures for single touch
                if (name === 'pinch' || name === 'rotate') continue;
                
                const gesture = gestureConfig.recognizer(touchData);
                if (gesture) {
                    recognizedGestures.push(gesture);
                }
            }
        } else {
            // Multi-touch gestures
            if (touchData.length === 2) {
                const pinchGesture = this.recognizePinch(touchData);
                if (pinchGesture) recognizedGestures.push(pinchGesture);
                
                const rotateGesture = this.recognizeRotate(touchData);
                if (rotateGesture) recognizedGestures.push(rotateGesture);
            }
        }
        
        // Resolve conflicts and return best gesture
        const bestGesture = this.resolveTouchConflicts(recognizedGestures);
        
        if (bestGesture) {
            this.addToHistory(bestGesture);
        }
        
        return bestGesture;
    }

    resolveTouchConflicts(gestures) {
        if (gestures.length === 0) return null;
        if (gestures.length === 1) return gestures[0];
        
        // Priority order for gesture resolution
        const priority = ['doubleTap', 'longPress', 'swipe', 'drag', 'tap', 'pinch', 'rotate'];
        
        // Sort by priority and confidence
        gestures.sort((a, b) => {
            const aPriority = priority.indexOf(a.type);
            const bPriority = priority.indexOf(b.type);
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            return b.confidence - a.confidence;
        });
        
        return gestures[0];
    }

    enableGesture(name) {
        const gesture = this.gestures.get(name);
        if (gesture) {
            gesture.enabled = true;
        }
    }

    disableGesture(name) {
        const gesture = this.gestures.get(name);
        if (gesture) {
            gesture.enabled = false;
        }
    }

    setThreshold(gestureName, property, value) {
        if (this.thresholds[gestureName] && this.thresholds[gestureName][property] !== undefined) {
            this.thresholds[gestureName][property] = value;
        }
    }

    getThreshold(gestureName, property) {
        return this.thresholds[gestureName]?.[property];
    }

    clearHistory() {
        this.gestureHistory = [];
    }

    getHistory() {
        return [...this.gestureHistory];
    }

    getEnabledGestures() {
        return Array.from(this.gestures.entries())
            .filter(([name, config]) => config.enabled)
            .map(([name]) => name);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GestureRecognizer;
} else if (typeof window !== 'undefined') {
    window.GestureRecognizer = GestureRecognizer;
}