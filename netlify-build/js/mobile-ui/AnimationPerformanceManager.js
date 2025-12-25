/**
 * Animation Performance Manager
 * Provides 60fps animation constraints, GPU acceleration, and touch response optimization
 * Ensures smooth performance across all mobile UI animations and interactions
 */

class AnimationPerformanceManager {
    constructor() {
        this.isInitialized = false;
        this.frameRate = 60;
        this.targetFrameTime = 1000 / this.frameRate; // 16.67ms
        this.touchResponseThreshold = 16; // 16ms for immediate feedback
        
        // Performance monitoring
        this.performanceMetrics = {
            frameDrops: 0,
            averageFrameTime: 0,
            touchResponseTimes: [],
            animationCount: 0,
            gpuAcceleratedElements: new Set()
        };
        
        // Animation queue management
        this.animationQueue = new Map();
        this.activeAnimations = new Set();
        this.animationId = 0;
        
        // Touch response tracking
        this.touchStartTimes = new Map();
        this.touchResponseCallbacks = new Map();
        
        // GPU acceleration tracking
        this.acceleratedElements = new WeakSet();
        
        // Performance optimization settings
        this.config = {
            enableGPUAcceleration: true,
            enableFrameRateMonitoring: true,
            enableTouchOptimization: true,
            enableAnimationBatching: true,
            maxConcurrentAnimations: 10,
            frameDropThreshold: 3,
            memoryOptimizationEnabled: true
        };
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Setup GPU acceleration
            this.setupGPUAcceleration();
            
            // Setup touch optimization
            this.setupTouchOptimization();
            
            // Setup animation batching
            this.setupAnimationBatching();
            
            // Setup memory optimization
            this.setupMemoryOptimization();
            
            this.isInitialized = true;
            console.log('Animation Performance Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Animation Performance Manager:', error);
            throw error;
        }
    }

    setupPerformanceMonitoring() {
        if (!this.config.enableFrameRateMonitoring) return;
        
        let lastFrameTime = performance.now();
        let frameCount = 0;
        let totalFrameTime = 0;
        
        const monitorFrame = (currentTime) => {
            const frameTime = currentTime - lastFrameTime;
            lastFrameTime = currentTime;
            
            // Track frame drops
            if (frameTime > this.targetFrameTime * 1.5) {
                this.performanceMetrics.frameDrops++;
                this.handleFrameDrop(frameTime);
            }
            
            // Calculate average frame time
            totalFrameTime += frameTime;
            frameCount++;
            
            if (frameCount >= 60) { // Update every second
                this.performanceMetrics.averageFrameTime = totalFrameTime / frameCount;
                this.emit('performanceUpdate', {
                    averageFrameTime: this.performanceMetrics.averageFrameTime,
                    frameDrops: this.performanceMetrics.frameDrops,
                    fps: 1000 / this.performanceMetrics.averageFrameTime
                });
                
                // Reset counters
                frameCount = 0;
                totalFrameTime = 0;
            }
            
            requestAnimationFrame(monitorFrame);
        };
        
        requestAnimationFrame(monitorFrame);
    }

    setupGPUAcceleration() {
        if (!this.config.enableGPUAcceleration) return;
        
        // Apply global GPU acceleration optimizations
        this.applyGlobalGPUOptimizations();
        
        // Setup automatic GPU acceleration for animated elements
        this.setupAutomaticGPUAcceleration();
    }

    applyGlobalGPUOptimizations() {
        // Create global GPU acceleration styles
        const css = `
            /* GPU acceleration for mobile UI elements */
            .mobile-ui-system .gpu-accelerated {
                transform: translateZ(0);
                will-change: transform;
                backface-visibility: hidden;
                perspective: 1000px;
            }
            
            .mobile-ui-system .animation-optimized {
                transform: translateZ(0);
                will-change: transform, opacity;
                backface-visibility: hidden;
            }
            
            .mobile-ui-system .touch-optimized {
                transform: translateZ(0);
                will-change: transform;
                touch-action: manipulation;
            }
            
            /* Smooth scrolling optimization */
            .mobile-ui-system .smooth-scroll {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
                transform: translateZ(0);
            }
            
            /* Animation performance classes */
            .mobile-ui-system .animate-transform {
                will-change: transform;
            }
            
            .mobile-ui-system .animate-opacity {
                will-change: opacity;
            }
            
            .mobile-ui-system .animate-height {
                will-change: height;
            }
            
            /* Remove will-change after animation */
            .mobile-ui-system .animation-complete {
                will-change: auto;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'animation-performance-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    setupAutomaticGPUAcceleration() {
        // Observe for elements that need GPU acceleration
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkForGPUAcceleration(node);
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    checkForGPUAcceleration(element) {
        // Check if element needs GPU acceleration
        const needsAcceleration = 
            element.classList.contains('animated') ||
            element.classList.contains('hand-drawer-component') ||
            element.classList.contains('mobile-game-board') ||
            element.classList.contains('player-avatar') ||
            element.classList.contains('mobile-screen');
        
        if (needsAcceleration && !this.acceleratedElements.has(element)) {
            this.enableGPUAcceleration(element);
        }
    }

    enableGPUAcceleration(element) {
        if (this.acceleratedElements.has(element)) return;
        
        element.classList.add('gpu-accelerated');
        this.acceleratedElements.add(element);
        this.performanceMetrics.gpuAcceleratedElements.add(element);
        
        // Apply specific optimizations based on element type
        if (element.classList.contains('hand-drawer-component')) {
            this.optimizeHandDrawer(element);
        } else if (element.classList.contains('mobile-game-board')) {
            this.optimizeGameBoard(element);
        } else if (element.classList.contains('player-avatar')) {
            this.optimizePlayerAvatar(element);
        }
    }

    optimizeHandDrawer(element) {
        // Specific optimizations for hand drawer
        element.style.transform = 'translateZ(0)';
        element.style.willChange = 'height, transform';
        
        // Optimize tiles container
        const tilesContainer = element.querySelector('.hand-drawer-tiles-container');
        if (tilesContainer) {
            tilesContainer.style.transform = 'translateZ(0)';
            tilesContainer.style.willChange = 'opacity, transform';
        }
        
        // Optimize individual tiles
        const tiles = element.querySelectorAll('.hand-tile');
        tiles.forEach(tile => {
            tile.style.transform = 'translateZ(0)';
            tile.style.willChange = 'transform';
        });
    }

    optimizeGameBoard(element) {
        // Specific optimizations for game board
        element.style.transform = 'translateZ(0)';
        element.style.willChange = 'transform';
        
        // Optimize board canvas
        const canvas = element.querySelector('canvas');
        if (canvas) {
            canvas.style.transform = 'translateZ(0)';
        }
    }

    optimizePlayerAvatar(element) {
        // Specific optimizations for player avatars
        element.style.transform = 'translateZ(0)';
        element.style.willChange = 'transform, opacity';
        element.style.backfaceVisibility = 'hidden';
    }

    setupTouchOptimization() {
        if (!this.config.enableTouchOptimization) return;
        
        // Global touch event optimization
        document.addEventListener('touchstart', (event) => {
            this.handleTouchStart(event);
        }, { passive: true });
        
        document.addEventListener('touchend', (event) => {
            this.handleTouchEnd(event);
        }, { passive: true });
        
        // Optimize touch targets
        this.optimizeTouchTargets();
    }

    handleTouchStart(event) {
        const touchId = event.changedTouches[0].identifier;
        const startTime = performance.now();
        
        this.touchStartTimes.set(touchId, startTime);
        
        // Find the target element
        const target = event.target.closest('.touch-target, .mobile-button, .hand-tile');
        if (target) {
            // Apply immediate visual feedback
            this.applyTouchFeedback(target);
            
            // Track touch response time
            const responseTime = performance.now() - startTime;
            this.performanceMetrics.touchResponseTimes.push(responseTime);
            
            // Keep only last 100 measurements
            if (this.performanceMetrics.touchResponseTimes.length > 100) {
                this.performanceMetrics.touchResponseTimes.shift();
            }
            
            // Check if response time exceeds threshold
            if (responseTime > this.touchResponseThreshold) {
                this.handleSlowTouchResponse(target, responseTime);
            }
        }
    }

    handleTouchEnd(event) {
        const touchId = event.changedTouches[0].identifier;
        const startTime = this.touchStartTimes.get(touchId);
        
        if (startTime) {
            const totalTime = performance.now() - startTime;
            this.touchStartTimes.delete(touchId);
            
            // Remove visual feedback
            const target = event.target.closest('.touch-target, .mobile-button, .hand-tile');
            if (target) {
                this.removeTouchFeedback(target);
            }
        }
    }

    applyTouchFeedback(element) {
        element.classList.add('touch-active');
        
        // Ensure GPU acceleration for touch feedback
        if (!this.acceleratedElements.has(element)) {
            this.enableGPUAcceleration(element);
        }
    }

    removeTouchFeedback(element) {
        // Delay removal to ensure smooth animation
        setTimeout(() => {
            element.classList.remove('touch-active');
        }, 150);
    }

    handleSlowTouchResponse(element, responseTime) {
        console.warn(`Slow touch response detected: ${responseTime}ms on element:`, element);
        
        // Apply additional optimizations
        this.enableGPUAcceleration(element);
        
        // Emit performance warning
        this.emit('slowTouchResponse', {
            element,
            responseTime,
            threshold: this.touchResponseThreshold
        });
    }

    optimizeTouchTargets() {
        // Find all touch targets and optimize them
        const touchTargets = document.querySelectorAll('.touch-target, .mobile-button, .hand-tile');
        
        touchTargets.forEach(target => {
            // Ensure minimum touch target size
            this.ensureMinimumTouchSize(target);
            
            // Apply touch optimizations
            target.style.touchAction = 'manipulation';
            target.classList.add('touch-optimized');
        });
    }

    ensureMinimumTouchSize(element) {
        const computedStyle = window.getComputedStyle(element);
        const width = parseInt(computedStyle.width);
        const height = parseInt(computedStyle.height);
        
        const minSize = 44; // 44px minimum for accessibility
        
        if (width < minSize || height < minSize) {
            // Add padding to reach minimum size
            const paddingX = Math.max(0, (minSize - width) / 2);
            const paddingY = Math.max(0, (minSize - height) / 2);
            
            element.style.paddingLeft = `${paddingX}px`;
            element.style.paddingRight = `${paddingX}px`;
            element.style.paddingTop = `${paddingY}px`;
            element.style.paddingBottom = `${paddingY}px`;
        }
    }

    setupAnimationBatching() {
        if (!this.config.enableAnimationBatching) return;
        
        // Setup animation frame batching
        this.setupAnimationFrameBatching();
        
        // Setup animation queue management
        this.setupAnimationQueueManagement();
    }

    setupAnimationFrameBatching() {
        let batchedAnimations = [];
        let batchScheduled = false;
        
        this.batchAnimation = (animationFn) => {
            batchedAnimations.push(animationFn);
            
            if (!batchScheduled) {
                batchScheduled = true;
                requestAnimationFrame(() => {
                    // Execute all batched animations
                    batchedAnimations.forEach(fn => {
                        try {
                            fn();
                        } catch (error) {
                            console.error('Error in batched animation:', error);
                        }
                    });
                    
                    // Reset batch
                    batchedAnimations = [];
                    batchScheduled = false;
                });
            }
        };
    }

    setupAnimationQueueManagement() {
        // Limit concurrent animations to prevent performance issues
        this.processAnimationQueue = () => {
            if (this.activeAnimations.size >= this.config.maxConcurrentAnimations) {
                return; // Wait for some animations to complete
            }
            
            // Start queued animations
            for (const [id, animation] of this.animationQueue) {
                if (this.activeAnimations.size >= this.config.maxConcurrentAnimations) {
                    break;
                }
                
                this.startAnimation(id, animation);
                this.animationQueue.delete(id);
            }
        };
        
        // Process queue regularly
        setInterval(this.processAnimationQueue.bind(this), 16); // ~60fps
    }

    setupMemoryOptimization() {
        if (!this.config.memoryOptimizationEnabled) return;
        
        // Setup memory monitoring
        this.setupMemoryMonitoring();
        
        // Setup automatic cleanup
        this.setupAutomaticCleanup();
    }

    setupMemoryMonitoring() {
        // Monitor memory usage if available
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                const memoryUsage = {
                    used: memInfo.usedJSHeapSize,
                    total: memInfo.totalJSHeapSize,
                    limit: memInfo.jsHeapSizeLimit
                };
                
                // Check if memory usage is high
                const usagePercent = (memoryUsage.used / memoryUsage.limit) * 100;
                
                if (usagePercent > 80) {
                    this.handleHighMemoryUsage(memoryUsage);
                }
                
                this.emit('memoryUpdate', memoryUsage);
            }, 5000); // Check every 5 seconds
        }
    }

    setupAutomaticCleanup() {
        // Clean up completed animations
        setInterval(() => {
            this.cleanupCompletedAnimations();
        }, 1000);
        
        // Clean up old performance metrics
        setInterval(() => {
            this.cleanupPerformanceMetrics();
        }, 30000); // Every 30 seconds
    }

    handleHighMemoryUsage(memoryUsage) {
        console.warn('High memory usage detected:', memoryUsage);
        
        // Trigger cleanup
        this.cleanupCompletedAnimations();
        this.cleanupPerformanceMetrics();
        
        // Reduce animation quality temporarily
        this.reduceAnimationQuality();
        
        this.emit('highMemoryUsage', memoryUsage);
    }

    reduceAnimationQuality() {
        // Temporarily disable some GPU acceleration
        document.body.classList.add('reduced-animation-quality');
        
        // Restore after a delay
        setTimeout(() => {
            document.body.classList.remove('reduced-animation-quality');
        }, 10000);
    }

    // Public API methods
    createOptimizedAnimation(element, properties, options = {}) {
        const animationId = ++this.animationId;
        
        const animation = {
            element,
            properties,
            options: {
                duration: 300,
                easing: 'ease-out',
                ...options
            },
            startTime: null,
            animationFrame: null
        };
        
        // Enable GPU acceleration for the element
        this.enableGPUAcceleration(element);
        
        // Add to queue or start immediately
        if (this.activeAnimations.size < this.config.maxConcurrentAnimations) {
            this.startAnimation(animationId, animation);
        } else {
            this.animationQueue.set(animationId, animation);
        }
        
        return animationId;
    }

    startAnimation(id, animation) {
        this.activeAnimations.add(id);
        this.performanceMetrics.animationCount++;
        
        const { element, properties, options } = animation;
        
        // Apply will-change for optimization
        const willChangeProperties = Object.keys(properties).join(', ');
        element.style.willChange = willChangeProperties;
        
        // Start the animation
        animation.startTime = performance.now();
        
        const animate = (currentTime) => {
            if (!animation.startTime) {
                animation.startTime = currentTime;
            }
            
            const elapsed = currentTime - animation.startTime;
            const progress = Math.min(elapsed / options.duration, 1);
            
            // Apply easing
            const easedProgress = this.applyEasing(progress, options.easing);
            
            // Update properties
            this.updateAnimationProperties(element, properties, easedProgress);
            
            if (progress < 1) {
                animation.animationFrame = requestAnimationFrame(animate);
            } else {
                this.completeAnimation(id, animation);
            }
        };
        
        animation.animationFrame = requestAnimationFrame(animate);
    }

    updateAnimationProperties(element, properties, progress) {
        Object.entries(properties).forEach(([property, value]) => {
            if (typeof value === 'object' && value.from !== undefined && value.to !== undefined) {
                const currentValue = value.from + (value.to - value.from) * progress;
                
                if (property === 'transform') {
                    element.style.transform = value.template.replace('{{value}}', currentValue);
                } else {
                    element.style[property] = `${currentValue}${value.unit || ''}`;
                }
            }
        });
    }

    completeAnimation(id, animation) {
        // Clean up animation frame
        if (animation.animationFrame) {
            cancelAnimationFrame(animation.animationFrame);
        }
        
        // Remove will-change
        animation.element.style.willChange = 'auto';
        animation.element.classList.add('animation-complete');
        
        // Remove from active animations
        this.activeAnimations.delete(id);
        
        // Process queue
        this.processAnimationQueue();
        
        // Emit completion event
        this.emit('animationComplete', { id, element: animation.element });
    }

    applyEasing(progress, easing) {
        switch (easing) {
            case 'ease-in':
                return progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 2);
            case 'ease-in-out':
                return progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            default:
                return progress;
        }
    }

    handleFrameDrop(frameTime) {
        console.warn(`Frame drop detected: ${frameTime.toFixed(2)}ms`);
        
        // Reduce animation quality temporarily if too many frame drops
        if (this.performanceMetrics.frameDrops > this.config.frameDropThreshold) {
            this.reduceAnimationQuality();
            this.performanceMetrics.frameDrops = 0; // Reset counter
        }
        
        this.emit('frameDrop', { frameTime });
    }

    cleanupCompletedAnimations() {
        // Remove animation-complete class from elements
        const completedElements = document.querySelectorAll('.animation-complete');
        completedElements.forEach(element => {
            element.classList.remove('animation-complete');
        });
    }

    cleanupPerformanceMetrics() {
        // Keep only recent touch response times
        if (this.performanceMetrics.touchResponseTimes.length > 50) {
            this.performanceMetrics.touchResponseTimes = 
                this.performanceMetrics.touchResponseTimes.slice(-50);
        }
    }

    // Performance monitoring methods
    getPerformanceMetrics() {
        const avgTouchResponse = this.performanceMetrics.touchResponseTimes.length > 0
            ? this.performanceMetrics.touchResponseTimes.reduce((a, b) => a + b, 0) / 
              this.performanceMetrics.touchResponseTimes.length
            : 0;
        
        return {
            ...this.performanceMetrics,
            averageTouchResponseTime: avgTouchResponse,
            activeAnimations: this.activeAnimations.size,
            queuedAnimations: this.animationQueue.size
        };
    }

    isPerformanceOptimal() {
        const metrics = this.getPerformanceMetrics();
        
        return (
            metrics.averageFrameTime <= this.targetFrameTime * 1.2 &&
            metrics.averageTouchResponseTime <= this.touchResponseThreshold &&
            metrics.frameDrops < this.config.frameDropThreshold
        );
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
        // Cancel all active animations
        this.activeAnimations.forEach(id => {
            const animation = this.animationQueue.get(id);
            if (animation && animation.animationFrame) {
                cancelAnimationFrame(animation.animationFrame);
            }
        });
        
        // Clear collections
        this.activeAnimations.clear();
        this.animationQueue.clear();
        this.touchStartTimes.clear();
        this.touchResponseCallbacks.clear();
        this.eventCallbacks.clear();
        
        // Remove styles
        const styleElement = document.getElementById('animation-performance-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimationPerformanceManager;
} else if (typeof window !== 'undefined') {
    window.AnimationPerformanceManager = AnimationPerformanceManager;
}