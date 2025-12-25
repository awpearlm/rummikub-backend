/**
 * Responsive Layout Manager
 * Manages adaptive layout components for different screen sizes and device types
 * Implements breakpoint-based layout adjustments and device-specific optimizations
 */

class ResponsiveLayoutManager {
    constructor() {
        this.breakpoints = {
            small: 480,      // < 480px width (small phones)
            medium: 768,     // 480px - 768px width (large phones)
            large: 1024,     // 768px - 1024px width (tablets)
            xlarge: 1200     // > 1024px width (desktop)
        };
        
        this.currentBreakpoint = null;
        this.deviceInfo = null;
        this.layoutComponents = new Map();
        this.resizeObserver = null;
        this.mediaQueries = new Map();
        
        this.callbacks = {
            breakpointChange: new Set(),
            layoutUpdate: new Set(),
            deviceChange: new Set()
        };
        
        this.init();
    }

    init() {
        this.detectDevice();
        this.setupBreakpoints();
        this.setupResizeObserver();
        this.registerLayoutComponents();
        this.applyInitialLayout();
        
        console.log('Responsive Layout Manager initialized');
    }

    detectDevice() {
        const userAgent = navigator.userAgent;
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            ratio: window.devicePixelRatio || 1
        };
        
        this.deviceInfo = {
            // Device type detection
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
            isTablet: /iPad|Android(?=.*Mobile)/i.test(userAgent) && viewport.width >= 768,
            isPhone: /iPhone|Android.*Mobile/i.test(userAgent) && viewport.width < 768,
            isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
            
            // Screen characteristics
            viewport,
            orientation: viewport.width > viewport.height ? 'landscape' : 'portrait',
            
            // Capabilities
            hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            hasHover: window.matchMedia('(hover: hover)').matches,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            prefersHighContrast: window.matchMedia('(prefers-contrast: high)').matches,
            
            // Performance indicators
            connectionType: navigator.connection?.effectiveType || 'unknown',
            memoryLimit: navigator.deviceMemory || 'unknown',
            
            // Safe area support
            hasSafeArea: CSS.supports('padding-top: env(safe-area-inset-top)')
        };
        
        // Determine current breakpoint
        this.currentBreakpoint = this.getBreakpointForWidth(viewport.width);
        
        console.log('Device detected:', this.deviceInfo);
    }

    getBreakpointForWidth(width) {
        if (width < this.breakpoints.small) return 'xsmall';
        if (width < this.breakpoints.medium) return 'small';
        if (width < this.breakpoints.large) return 'medium';
        if (width < this.breakpoints.xlarge) return 'large';
        return 'xlarge';
    }

    setupBreakpoints() {
        // Create media queries for each breakpoint
        const queries = {
            xsmall: `(max-width: ${this.breakpoints.small - 1}px)`,
            small: `(min-width: ${this.breakpoints.small}px) and (max-width: ${this.breakpoints.medium - 1}px)`,
            medium: `(min-width: ${this.breakpoints.medium}px) and (max-width: ${this.breakpoints.large - 1}px)`,
            large: `(min-width: ${this.breakpoints.large}px) and (max-width: ${this.breakpoints.xlarge - 1}px)`,
            xlarge: `(min-width: ${this.breakpoints.xlarge}px)`
        };
        
        // Setup media query listeners
        Object.entries(queries).forEach(([breakpoint, query]) => {
            const mediaQuery = window.matchMedia(query);
            this.mediaQueries.set(breakpoint, mediaQuery);
            
            mediaQuery.addListener((e) => {
                if (e.matches) {
                    this.handleBreakpointChange(breakpoint);
                }
            });
        });
        
        // Setup orientation change listener
        const orientationQuery = window.matchMedia('(orientation: landscape)');
        orientationQuery.addListener(() => {
            this.handleOrientationChange();
        });
    }

    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.target === document.body) {
                        this.handleViewportResize(entry.contentRect);
                    }
                }
            });
            
            this.resizeObserver.observe(document.body);
        } else {
            // Fallback to resize event
            window.addEventListener('resize', () => {
                this.handleViewportResize({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            });
        }
    }

    registerLayoutComponents() {
        // Register built-in adaptive components if available
        if (typeof AdaptiveContainer !== 'undefined') {
            this.registerComponent('container', new AdaptiveContainer());
        }
        if (typeof AdaptiveGrid !== 'undefined') {
            this.registerComponent('grid', new AdaptiveGrid());
        }
        if (typeof AdaptiveFlexbox !== 'undefined') {
            this.registerComponent('flexbox', new AdaptiveFlexbox());
        }
        if (typeof AdaptiveTypography !== 'undefined') {
            this.registerComponent('typography', new AdaptiveTypography());
        }
        if (typeof AdaptiveSpacing !== 'undefined') {
            this.registerComponent('spacing', new AdaptiveSpacing());
        }
        if (typeof AdaptiveTouchTargets !== 'undefined') {
            this.registerComponent('touchTargets', new AdaptiveTouchTargets());
        }
    }

    registerComponent(name, component) {
        this.layoutComponents.set(name, component);
        
        // Initialize component with current device info
        if (component.init) {
            component.init(this.deviceInfo, this.currentBreakpoint);
        }
    }

    applyInitialLayout() {
        // Apply device-specific CSS classes
        this.applyDeviceClasses();
        
        // Apply breakpoint-specific styles
        this.applyBreakpointStyles();
        
        // Initialize all layout components
        this.layoutComponents.forEach((component, name) => {
            if (component.apply) {
                component.apply(this.deviceInfo, this.currentBreakpoint);
            }
        });
        
        // Set CSS custom properties
        this.updateCSSProperties();
    }

    applyDeviceClasses() {
        const body = document.body;
        
        // Clear existing device classes
        body.classList.remove(
            'device-mobile', 'device-tablet', 'device-phone', 'device-desktop',
            'has-touch', 'has-hover', 'prefers-reduced-motion', 'prefers-high-contrast',
            'has-safe-area', 'orientation-portrait', 'orientation-landscape'
        );
        
        // Apply current device classes
        if (this.deviceInfo.isMobile) body.classList.add('device-mobile');
        if (this.deviceInfo.isTablet) body.classList.add('device-tablet');
        if (this.deviceInfo.isPhone) body.classList.add('device-phone');
        if (this.deviceInfo.isDesktop) body.classList.add('device-desktop');
        if (this.deviceInfo.hasTouch) body.classList.add('has-touch');
        if (this.deviceInfo.hasHover) body.classList.add('has-hover');
        if (this.deviceInfo.prefersReducedMotion) body.classList.add('prefers-reduced-motion');
        if (this.deviceInfo.prefersHighContrast) body.classList.add('prefers-high-contrast');
        if (this.deviceInfo.hasSafeArea) body.classList.add('has-safe-area');
        
        body.classList.add(`orientation-${this.deviceInfo.orientation}`);
    }

    applyBreakpointStyles() {
        const body = document.body;
        
        // Clear existing breakpoint classes
        body.classList.remove('bp-xsmall', 'bp-small', 'bp-medium', 'bp-large', 'bp-xlarge');
        
        // Apply current breakpoint class
        body.classList.add(`bp-${this.currentBreakpoint}`);
    }

    updateCSSProperties() {
        const root = document.documentElement;
        
        // Viewport properties
        root.style.setProperty('--viewport-width', `${this.deviceInfo.viewport.width}px`);
        root.style.setProperty('--viewport-height', `${this.deviceInfo.viewport.height}px`);
        root.style.setProperty('--device-pixel-ratio', this.deviceInfo.viewport.ratio);
        
        // Breakpoint properties
        root.style.setProperty('--current-breakpoint', this.currentBreakpoint);
        root.style.setProperty('--is-mobile', this.deviceInfo.isMobile ? '1' : '0');
        root.style.setProperty('--is-tablet', this.deviceInfo.isTablet ? '1' : '0');
        root.style.setProperty('--is-phone', this.deviceInfo.isPhone ? '1' : '0');
        root.style.setProperty('--has-touch', this.deviceInfo.hasTouch ? '1' : '0');
        root.style.setProperty('--has-hover', this.deviceInfo.hasHover ? '1' : '0');
        
        // Orientation properties
        root.style.setProperty('--orientation', this.deviceInfo.orientation);
        root.style.setProperty('--is-portrait', this.deviceInfo.orientation === 'portrait' ? '1' : '0');
        root.style.setProperty('--is-landscape', this.deviceInfo.orientation === 'landscape' ? '1' : '0');
    }

    handleBreakpointChange(newBreakpoint) {
        if (newBreakpoint === this.currentBreakpoint) return;
        
        const previousBreakpoint = this.currentBreakpoint;
        this.currentBreakpoint = newBreakpoint;
        
        console.log(`Breakpoint changed: ${previousBreakpoint} -> ${newBreakpoint}`);
        
        // Update device info
        this.deviceInfo.viewport.width = window.innerWidth;
        this.deviceInfo.viewport.height = window.innerHeight;
        
        // Apply new breakpoint styles
        this.applyBreakpointStyles();
        
        // Update CSS properties
        this.updateCSSProperties();
        
        // Update all layout components
        this.layoutComponents.forEach((component) => {
            if (component.onBreakpointChange) {
                component.onBreakpointChange(newBreakpoint, previousBreakpoint, this.deviceInfo);
            }
        });
        
        // Notify callbacks
        this.callbacks.breakpointChange.forEach(callback => {
            callback({ newBreakpoint, previousBreakpoint, deviceInfo: this.deviceInfo });
        });
    }

    handleOrientationChange() {
        const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
        const previousOrientation = this.deviceInfo.orientation;
        
        if (newOrientation === previousOrientation) return;
        
        console.log(`Orientation changed: ${previousOrientation} -> ${newOrientation}`);
        
        // Update device info
        this.deviceInfo.orientation = newOrientation;
        this.deviceInfo.viewport.width = window.innerWidth;
        this.deviceInfo.viewport.height = window.innerHeight;
        
        // Update device classes
        this.applyDeviceClasses();
        
        // Update CSS properties
        this.updateCSSProperties();
        
        // Update all layout components
        this.layoutComponents.forEach((component) => {
            if (component.onOrientationChange) {
                component.onOrientationChange(newOrientation, previousOrientation, this.deviceInfo);
            }
        });
    }

    handleViewportResize(rect) {
        const newBreakpoint = this.getBreakpointForWidth(rect.width);
        
        // Update device info
        this.deviceInfo.viewport.width = rect.width;
        this.deviceInfo.viewport.height = rect.height;
        
        // Update CSS properties
        this.updateCSSProperties();
        
        // Check if breakpoint changed
        if (newBreakpoint !== this.currentBreakpoint) {
            this.handleBreakpointChange(newBreakpoint);
        }
        
        // Notify layout update callbacks
        this.callbacks.layoutUpdate.forEach(callback => {
            callback({ viewport: rect, breakpoint: this.currentBreakpoint, deviceInfo: this.deviceInfo });
        });
    }

    // Public API methods
    getCurrentBreakpoint() {
        return this.currentBreakpoint;
    }

    getDeviceInfo() {
        return { ...this.deviceInfo };
    }

    isBreakpoint(breakpoint) {
        return this.currentBreakpoint === breakpoint;
    }

    isBreakpointOrLarger(breakpoint) {
        const order = ['xsmall', 'small', 'medium', 'large', 'xlarge'];
        const currentIndex = order.indexOf(this.currentBreakpoint);
        const targetIndex = order.indexOf(breakpoint);
        return currentIndex >= targetIndex;
    }

    isBreakpointOrSmaller(breakpoint) {
        const order = ['xsmall', 'small', 'medium', 'large', 'xlarge'];
        const currentIndex = order.indexOf(this.currentBreakpoint);
        const targetIndex = order.indexOf(breakpoint);
        return currentIndex <= targetIndex;
    }

    isMobile() {
        return this.deviceInfo.isMobile;
    }

    isTablet() {
        return this.deviceInfo.isTablet;
    }

    isPhone() {
        return this.deviceInfo.isPhone;
    }

    hasTouch() {
        return this.deviceInfo.hasTouch;
    }

    hasHover() {
        return this.deviceInfo.hasHover;
    }

    getOrientation() {
        return this.deviceInfo.orientation;
    }

    isPortrait() {
        return this.deviceInfo.orientation === 'portrait';
    }

    isLandscape() {
        return this.deviceInfo.orientation === 'landscape';
    }

    // Event system
    onBreakpointChange(callback) {
        this.callbacks.breakpointChange.add(callback);
        return () => this.callbacks.breakpointChange.delete(callback);
    }

    onLayoutUpdate(callback) {
        this.callbacks.layoutUpdate.add(callback);
        return () => this.callbacks.layoutUpdate.delete(callback);
    }

    onDeviceChange(callback) {
        this.callbacks.deviceChange.add(callback);
        return () => this.callbacks.deviceChange.delete(callback);
    }

    // Component management
    getComponent(name) {
        return this.layoutComponents.get(name);
    }

    addComponent(name, component) {
        this.registerComponent(name, component);
    }

    removeComponent(name) {
        const component = this.layoutComponents.get(name);
        if (component && component.destroy) {
            component.destroy();
        }
        this.layoutComponents.delete(name);
    }

    // Utility methods
    getOptimalTouchTargetSize() {
        // Return optimal touch target size based on device
        if (this.deviceInfo.isPhone) {
            return this.currentBreakpoint === 'xsmall' ? 48 : 44;
        } else if (this.deviceInfo.isTablet) {
            return 40;
        } else {
            return 32; // Desktop with touch
        }
    }

    getOptimalFontSize(baseSize = 16) {
        // Adjust font size based on device and breakpoint
        const scaleFactor = {
            xsmall: 0.9,
            small: 1.0,
            medium: 1.0,
            large: 1.1,
            xlarge: 1.1
        };
        
        return Math.round(baseSize * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    getOptimalSpacing(baseSpacing = 16) {
        // Adjust spacing based on device and breakpoint
        const scaleFactor = {
            xsmall: 0.75,
            small: 1.0,
            medium: 1.0,
            large: 1.25,
            xlarge: 1.5
        };
        
        return Math.round(baseSpacing * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    // Cleanup
    destroy() {
        // Remove resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Remove media query listeners
        this.mediaQueries.forEach((mediaQuery) => {
            mediaQuery.removeListener();
        });
        
        // Destroy all components
        this.layoutComponents.forEach((component) => {
            if (component.destroy) {
                component.destroy();
            }
        });
        
        // Clear collections
        this.layoutComponents.clear();
        this.mediaQueries.clear();
        this.callbacks.breakpointChange.clear();
        this.callbacks.layoutUpdate.clear();
        this.callbacks.deviceChange.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponsiveLayoutManager;
} else if (typeof window !== 'undefined') {
    window.ResponsiveLayoutManager = ResponsiveLayoutManager;
}