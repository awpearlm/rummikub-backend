/**
 * Adaptive Layout Components
 * Collection of responsive components that adapt to different screen sizes and devices
 */

/**
 * Base class for adaptive components
 */
class AdaptiveComponent {
    constructor() {
        this.isInitialized = false;
        this.currentBreakpoint = null;
        this.deviceInfo = null;
    }

    init(deviceInfo, breakpoint) {
        this.deviceInfo = deviceInfo;
        this.currentBreakpoint = breakpoint;
        this.isInitialized = true;
    }

    apply(deviceInfo, breakpoint) {
        this.deviceInfo = deviceInfo;
        this.currentBreakpoint = breakpoint;
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        this.currentBreakpoint = newBreakpoint;
        this.deviceInfo = deviceInfo;
    }

    onOrientationChange(newOrientation, previousOrientation, deviceInfo) {
        this.deviceInfo = deviceInfo;
    }

    destroy() {
        // Override in subclasses
    }
}

/**
 * Adaptive Container Component
 * Manages responsive container layouts with proper spacing and max-widths
 */
class AdaptiveContainer extends AdaptiveComponent {
    constructor() {
        super();
        this.containers = new Set();
        this.observer = null;
    }

    init(deviceInfo, breakpoint) {
        super.init(deviceInfo, breakpoint);
        this.setupContainerObserver();
        this.applyContainerStyles();
    }

    setupContainerObserver() {
        if ('MutationObserver' in window) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewElements(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Process existing containers
        this.processExistingContainers();
    }

    processExistingContainers() {
        const containers = document.querySelectorAll('.adaptive-container, .mobile-container');
        containers.forEach(container => this.enhanceContainer(container));
    }

    processNewElements(element) {
        if (element.classList && (element.classList.contains('adaptive-container') || element.classList.contains('mobile-container'))) {
            this.enhanceContainer(element);
        }

        // Check children
        const containers = element.querySelectorAll && element.querySelectorAll('.adaptive-container, .mobile-container');
        if (containers) {
            containers.forEach(container => this.enhanceContainer(container));
        }
    }

    enhanceContainer(container) {
        if (this.containers.has(container)) return;

        this.containers.add(container);
        this.applyContainerLayout(container);
    }

    applyContainerLayout(container) {
        const containerType = this.getContainerType(container);
        const spacing = this.getOptimalSpacing();
        const maxWidth = this.getOptimalMaxWidth(containerType);

        // Apply responsive styles
        container.style.setProperty('--container-padding', `${spacing}px`);
        container.style.setProperty('--container-max-width', maxWidth);
        container.style.setProperty('--container-margin', 'auto');

        // Add responsive classes
        container.classList.add('adaptive-enhanced');
        container.classList.add(`container-${this.currentBreakpoint}`);
    }

    getContainerType(container) {
        if (container.classList.contains('container-fluid')) return 'fluid';
        if (container.classList.contains('container-narrow')) return 'narrow';
        if (container.classList.contains('container-wide')) return 'wide';
        return 'default';
    }

    getOptimalSpacing() {
        const baseSpacing = 16;
        const scaleFactor = {
            xsmall: 0.75,  // 12px
            small: 1.0,    // 16px
            medium: 1.0,   // 16px
            large: 1.25,   // 20px
            xlarge: 1.5    // 24px
        };

        return Math.round(baseSpacing * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    getOptimalMaxWidth(containerType) {
        const maxWidths = {
            fluid: '100%',
            narrow: {
                xsmall: '100%',
                small: '100%',
                medium: '600px',
                large: '800px',
                xlarge: '900px'
            },
            wide: {
                xsmall: '100%',
                small: '100%',
                medium: '100%',
                large: '1200px',
                xlarge: '1400px'
            },
            default: {
                xsmall: '100%',
                small: '100%',
                medium: '768px',
                large: '1024px',
                xlarge: '1200px'
            }
        };

        const widthConfig = maxWidths[containerType];
        if (typeof widthConfig === 'string') return widthConfig;
        return widthConfig[this.currentBreakpoint] || '100%';
    }

    applyContainerStyles() {
        const css = `
            .adaptive-container,
            .mobile-container {
                width: 100%;
                padding-left: var(--container-padding, 16px);
                padding-right: var(--container-padding, 16px);
                margin-left: var(--container-margin, auto);
                margin-right: var(--container-margin, auto);
                max-width: var(--container-max-width, 100%);
                box-sizing: border-box;
            }

            .container-fluid {
                max-width: 100% !important;
            }

            /* Breakpoint-specific adjustments */
            .container-xsmall { --container-padding: 12px; }
            .container-small { --container-padding: 16px; }
            .container-medium { --container-padding: 16px; }
            .container-large { --container-padding: 20px; }
            .container-xlarge { --container-padding: 24px; }
        `;

        this.injectStyles('adaptive-container-styles', css);
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        super.onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo);

        // Update all containers
        this.containers.forEach(container => {
            container.classList.remove(`container-${previousBreakpoint}`);
            container.classList.add(`container-${newBreakpoint}`);
            this.applyContainerLayout(container);
        });
    }

    injectStyles(id, css) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.containers.clear();
    }
}

/**
 * Adaptive Grid Component
 * Manages responsive grid layouts with automatic column adjustments
 */
class AdaptiveGrid extends AdaptiveComponent {
    constructor() {
        super();
        this.grids = new Set();
        this.observer = null;
    }

    init(deviceInfo, breakpoint) {
        super.init(deviceInfo, breakpoint);
        this.setupGridObserver();
        this.applyGridStyles();
    }

    setupGridObserver() {
        if ('MutationObserver' in window) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewGrids(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        this.processExistingGrids();
    }

    processExistingGrids() {
        const grids = document.querySelectorAll('.adaptive-grid, .mobile-grid');
        grids.forEach(grid => this.enhanceGrid(grid));
    }

    processNewGrids(element) {
        if (element.classList && (element.classList.contains('adaptive-grid') || element.classList.contains('mobile-grid'))) {
            this.enhanceGrid(element);
        }

        const grids = element.querySelectorAll && element.querySelectorAll('.adaptive-grid, .mobile-grid');
        if (grids) {
            grids.forEach(grid => this.enhanceGrid(grid));
        }
    }

    enhanceGrid(grid) {
        if (this.grids.has(grid)) return;

        this.grids.add(grid);
        this.applyGridLayout(grid);
    }

    applyGridLayout(grid) {
        const columns = this.getOptimalColumns(grid);
        const gap = this.getOptimalGap();
        const minItemWidth = this.getMinItemWidth(grid);

        // Apply CSS Grid properties
        grid.style.setProperty('--grid-columns', columns);
        grid.style.setProperty('--grid-gap', `${gap}px`);
        grid.style.setProperty('--grid-min-width', `${minItemWidth}px`);

        // Add responsive classes
        grid.classList.add('adaptive-enhanced');
        grid.classList.add(`grid-${this.currentBreakpoint}`);
    }

    getOptimalColumns(grid) {
        // Check for explicit column configuration
        const explicitCols = grid.dataset.columns;
        if (explicitCols) {
            const colConfig = JSON.parse(explicitCols);
            return colConfig[this.currentBreakpoint] || colConfig.default || 'auto-fit';
        }

        // Default column configuration based on breakpoint
        const defaultColumns = {
            xsmall: '1',
            small: '2',
            medium: '3',
            large: '4',
            xlarge: '5'
        };

        return defaultColumns[this.currentBreakpoint] || 'auto-fit';
    }

    getOptimalGap() {
        const baseGap = 16;
        const scaleFactor = {
            xsmall: 0.5,   // 8px
            small: 0.75,   // 12px
            medium: 1.0,   // 16px
            large: 1.25,   // 20px
            xlarge: 1.5    // 24px
        };

        return Math.round(baseGap * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    getMinItemWidth(grid) {
        const baseWidth = 200;
        const scaleFactor = {
            xsmall: 0.75,  // 150px
            small: 1.0,    // 200px
            medium: 1.0,   // 200px
            large: 1.25,   // 250px
            xlarge: 1.5    // 300px
        };

        return Math.round(baseWidth * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    applyGridStyles() {
        const css = `
            .adaptive-grid,
            .mobile-grid {
                display: grid;
                grid-template-columns: repeat(var(--grid-columns, auto-fit), minmax(var(--grid-min-width, 200px), 1fr));
                gap: var(--grid-gap, 16px);
                width: 100%;
            }

            .adaptive-grid.grid-auto,
            .mobile-grid.grid-auto {
                grid-template-columns: repeat(auto-fit, minmax(var(--grid-min-width, 200px), 1fr));
            }

            .adaptive-grid.grid-fixed,
            .mobile-grid.grid-fixed {
                grid-template-columns: repeat(var(--grid-columns, 3), 1fr);
            }

            /* Breakpoint-specific adjustments */
            .grid-xsmall { --grid-columns: 1; --grid-gap: 8px; --grid-min-width: 150px; }
            .grid-small { --grid-columns: 2; --grid-gap: 12px; --grid-min-width: 200px; }
            .grid-medium { --grid-columns: 3; --grid-gap: 16px; --grid-min-width: 200px; }
            .grid-large { --grid-columns: 4; --grid-gap: 20px; --grid-min-width: 250px; }
            .grid-xlarge { --grid-columns: 5; --grid-gap: 24px; --grid-min-width: 300px; }
        `;

        this.injectStyles('adaptive-grid-styles', css);
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        super.onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo);

        this.grids.forEach(grid => {
            grid.classList.remove(`grid-${previousBreakpoint}`);
            grid.classList.add(`grid-${newBreakpoint}`);
            this.applyGridLayout(grid);
        });
    }

    injectStyles(id, css) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.grids.clear();
    }
}

/**
 * Adaptive Flexbox Component
 * Manages responsive flexbox layouts with automatic wrapping and spacing
 */
class AdaptiveFlexbox extends AdaptiveComponent {
    constructor() {
        super();
        this.flexContainers = new Set();
        this.observer = null;
    }

    init(deviceInfo, breakpoint) {
        super.init(deviceInfo, breakpoint);
        this.setupFlexObserver();
        this.applyFlexStyles();
    }

    setupFlexObserver() {
        if ('MutationObserver' in window) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewFlexContainers(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        this.processExistingFlexContainers();
    }

    processExistingFlexContainers() {
        const containers = document.querySelectorAll('.adaptive-flex, .mobile-flex');
        containers.forEach(container => this.enhanceFlexContainer(container));
    }

    processNewFlexContainers(element) {
        if (element.classList && (element.classList.contains('adaptive-flex') || element.classList.contains('mobile-flex'))) {
            this.enhanceFlexContainer(element);
        }

        const containers = element.querySelectorAll && element.querySelectorAll('.adaptive-flex, .mobile-flex');
        if (containers) {
            containers.forEach(container => this.enhanceFlexContainer(container));
        }
    }

    enhanceFlexContainer(container) {
        if (this.flexContainers.has(container)) return;

        this.flexContainers.add(container);
        this.applyFlexLayout(container);
    }

    applyFlexLayout(container) {
        const direction = this.getOptimalDirection(container);
        const wrap = this.getOptimalWrap(container);
        const gap = this.getOptimalGap();
        const justify = this.getOptimalJustify(container);
        const align = this.getOptimalAlign(container);

        // Apply flexbox properties
        container.style.setProperty('--flex-direction', direction);
        container.style.setProperty('--flex-wrap', wrap);
        container.style.setProperty('--flex-gap', `${gap}px`);
        container.style.setProperty('--flex-justify', justify);
        container.style.setProperty('--flex-align', align);

        // Add responsive classes
        container.classList.add('adaptive-enhanced');
        container.classList.add(`flex-${this.currentBreakpoint}`);
    }

    getOptimalDirection(container) {
        // Check for explicit direction configuration
        const explicitDirection = container.dataset.direction;
        if (explicitDirection) {
            const dirConfig = JSON.parse(explicitDirection);
            return dirConfig[this.currentBreakpoint] || dirConfig.default || 'row';
        }

        // Default direction based on breakpoint and device
        if (this.deviceInfo.isPhone && this.currentBreakpoint === 'xsmall') {
            return 'column'; // Stack on small phones
        }

        return container.classList.contains('mobile-flex-column') ? 'column' : 'row';
    }

    getOptimalWrap(container) {
        if (container.classList.contains('flex-nowrap')) return 'nowrap';
        return 'wrap';
    }

    getOptimalGap() {
        const baseGap = 16;
        const scaleFactor = {
            xsmall: 0.5,   // 8px
            small: 0.75,   // 12px
            medium: 1.0,   // 16px
            large: 1.25,   // 20px
            xlarge: 1.5    // 24px
        };

        return Math.round(baseGap * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    getOptimalJustify(container) {
        if (container.classList.contains('mobile-flex-center')) return 'center';
        if (container.classList.contains('flex-end')) return 'flex-end';
        if (container.classList.contains('space-between')) return 'space-between';
        if (container.classList.contains('space-around')) return 'space-around';
        return 'flex-start';
    }

    getOptimalAlign(container) {
        if (container.classList.contains('mobile-flex-center')) return 'center';
        if (container.classList.contains('align-end')) return 'flex-end';
        if (container.classList.contains('align-stretch')) return 'stretch';
        return 'flex-start';
    }

    applyFlexStyles() {
        const css = `
            .adaptive-flex,
            .mobile-flex {
                display: flex;
                flex-direction: var(--flex-direction, row);
                flex-wrap: var(--flex-wrap, wrap);
                gap: var(--flex-gap, 16px);
                justify-content: var(--flex-justify, flex-start);
                align-items: var(--flex-align, flex-start);
            }

            /* Responsive flex items */
            .adaptive-flex > *,
            .mobile-flex > * {
                flex: 1 1 auto;
                min-width: 0; /* Prevent flex items from overflowing */
            }

            .flex-item-fixed {
                flex: 0 0 auto;
            }

            .flex-item-grow {
                flex: 1 1 0;
            }

            /* Breakpoint-specific adjustments */
            .flex-xsmall { 
                --flex-direction: column; 
                --flex-gap: 8px; 
            }
            .flex-small { 
                --flex-gap: 12px; 
            }
            .flex-medium { 
                --flex-gap: 16px; 
            }
            .flex-large { 
                --flex-gap: 20px; 
            }
            .flex-xlarge { 
                --flex-gap: 24px; 
            }

            /* Force column on small screens for certain containers */
            @media (max-width: 480px) {
                .adaptive-flex.force-column-small,
                .mobile-flex.force-column-small {
                    flex-direction: column;
                }
            }
        `;

        this.injectStyles('adaptive-flex-styles', css);
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        super.onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo);

        this.flexContainers.forEach(container => {
            container.classList.remove(`flex-${previousBreakpoint}`);
            container.classList.add(`flex-${newBreakpoint}`);
            this.applyFlexLayout(container);
        });
    }

    injectStyles(id, css) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.flexContainers.clear();
    }
}

/**
 * Adaptive Typography Component
 * Manages responsive typography with optimal font sizes and line heights
 */
class AdaptiveTypography extends AdaptiveComponent {
    constructor() {
        super();
        this.typographyElements = new Set();
        this.observer = null;
    }

    init(deviceInfo, breakpoint) {
        super.init(deviceInfo, breakpoint);
        this.setupTypographyObserver();
        this.applyTypographyStyles();
    }

    setupTypographyObserver() {
        if ('MutationObserver' in window) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewTypography(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        this.processExistingTypography();
    }

    processExistingTypography() {
        const elements = document.querySelectorAll('.mobile-title, .mobile-subtitle, .mobile-body, .mobile-caption, .adaptive-text');
        elements.forEach(element => this.enhanceTypography(element));
    }

    processNewTypography(element) {
        const typographyClasses = ['mobile-title', 'mobile-subtitle', 'mobile-body', 'mobile-caption', 'adaptive-text'];
        
        if (element.classList && typographyClasses.some(cls => element.classList.contains(cls))) {
            this.enhanceTypography(element);
        }

        const elements = element.querySelectorAll && element.querySelectorAll(typographyClasses.map(cls => `.${cls}`).join(', '));
        if (elements) {
            elements.forEach(el => this.enhanceTypography(el));
        }
    }

    enhanceTypography(element) {
        if (this.typographyElements.has(element)) return;

        this.typographyElements.add(element);
        this.applyTypographyLayout(element);
    }

    applyTypographyLayout(element) {
        const fontSize = this.getOptimalFontSize(element);
        const lineHeight = this.getOptimalLineHeight(element);
        const letterSpacing = this.getOptimalLetterSpacing(element);

        // Apply typography properties
        element.style.setProperty('--adaptive-font-size', `${fontSize}px`);
        element.style.setProperty('--adaptive-line-height', lineHeight);
        element.style.setProperty('--adaptive-letter-spacing', `${letterSpacing}em`);

        // Add responsive classes
        element.classList.add('adaptive-enhanced');
        element.classList.add(`text-${this.currentBreakpoint}`);
    }

    getOptimalFontSize(element) {
        const baseSizes = {
            'mobile-title': 28,
            'mobile-subtitle': 20,
            'mobile-body': 16,
            'mobile-caption': 14,
            'adaptive-text': 16
        };

        const elementType = this.getElementType(element);
        const baseSize = baseSizes[elementType] || 16;

        const scaleFactor = {
            xsmall: 0.9,
            small: 1.0,
            medium: 1.0,
            large: 1.1,
            xlarge: 1.2
        };

        return Math.round(baseSize * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    getOptimalLineHeight(element) {
        const baseLineHeights = {
            'mobile-title': 1.2,
            'mobile-subtitle': 1.3,
            'mobile-body': 1.5,
            'mobile-caption': 1.4,
            'adaptive-text': 1.5
        };

        const elementType = this.getElementType(element);
        return baseLineHeights[elementType] || 1.5;
    }

    getOptimalLetterSpacing(element) {
        const baseLetterSpacing = {
            'mobile-title': -0.02,
            'mobile-subtitle': -0.01,
            'mobile-body': 0,
            'mobile-caption': 0.01,
            'adaptive-text': 0
        };

        const elementType = this.getElementType(element);
        return baseLetterSpacing[elementType] || 0;
    }

    getElementType(element) {
        const classes = ['mobile-title', 'mobile-subtitle', 'mobile-body', 'mobile-caption', 'adaptive-text'];
        return classes.find(cls => element.classList.contains(cls)) || 'adaptive-text';
    }

    applyTypographyStyles() {
        const css = `
            .mobile-title,
            .mobile-subtitle,
            .mobile-body,
            .mobile-caption,
            .adaptive-text {
                font-size: var(--adaptive-font-size);
                line-height: var(--adaptive-line-height);
                letter-spacing: var(--adaptive-letter-spacing);
            }

            /* Ensure readability on mobile */
            .mobile-title { font-weight: 700; margin-bottom: 0.5em; }
            .mobile-subtitle { font-weight: 600; margin-bottom: 0.4em; }
            .mobile-body { font-weight: 400; margin-bottom: 0.75em; }
            .mobile-caption { font-weight: 400; color: #666; margin-bottom: 0.5em; }

            /* Responsive text scaling */
            .text-xsmall { font-size: calc(var(--adaptive-font-size) * 0.9); }
            .text-small { font-size: var(--adaptive-font-size); }
            .text-medium { font-size: var(--adaptive-font-size); }
            .text-large { font-size: calc(var(--adaptive-font-size) * 1.1); }
            .text-xlarge { font-size: calc(var(--adaptive-font-size) * 1.2); }

            /* Accessibility improvements */
            @media (prefers-reduced-motion: reduce) {
                .mobile-title,
                .mobile-subtitle,
                .mobile-body,
                .mobile-caption,
                .adaptive-text {
                    transition: none;
                }
            }
        `;

        this.injectStyles('adaptive-typography-styles', css);
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        super.onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo);

        this.typographyElements.forEach(element => {
            element.classList.remove(`text-${previousBreakpoint}`);
            element.classList.add(`text-${newBreakpoint}`);
            this.applyTypographyLayout(element);
        });
    }

    injectStyles(id, css) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.typographyElements.clear();
    }
}

/**
 * Adaptive Spacing Component
 * Manages responsive spacing with consistent margins and padding
 */
class AdaptiveSpacing extends AdaptiveComponent {
    constructor() {
        super();
        this.spacingElements = new Set();
        this.observer = null;
    }

    init(deviceInfo, breakpoint) {
        super.init(deviceInfo, breakpoint);
        this.setupSpacingObserver();
        this.applySpacingStyles();
    }

    setupSpacingObserver() {
        if ('MutationObserver' in window) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewSpacing(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        this.processExistingSpacing();
    }

    processExistingSpacing() {
        const elements = document.querySelectorAll('[class*="spacing-"], [class*="margin-"], [class*="padding-"]');
        elements.forEach(element => this.enhanceSpacing(element));
    }

    processNewSpacing(element) {
        if (element.className && (element.className.includes('spacing-') || element.className.includes('margin-') || element.className.includes('padding-'))) {
            this.enhanceSpacing(element);
        }

        const elements = element.querySelectorAll && element.querySelectorAll('[class*="spacing-"], [class*="margin-"], [class*="padding-"]');
        if (elements) {
            elements.forEach(el => this.enhanceSpacing(el));
        }
    }

    enhanceSpacing(element) {
        if (this.spacingElements.has(element)) return;

        this.spacingElements.add(element);
        this.applySpacingLayout(element);
    }

    applySpacingLayout(element) {
        const spacingValue = this.getOptimalSpacing();
        
        // Apply spacing properties
        element.style.setProperty('--adaptive-spacing', `${spacingValue}px`);
        element.style.setProperty('--adaptive-spacing-small', `${Math.round(spacingValue * 0.5)}px`);
        element.style.setProperty('--adaptive-spacing-large', `${Math.round(spacingValue * 1.5)}px`);

        // Add responsive classes
        element.classList.add('adaptive-enhanced');
        element.classList.add(`spacing-${this.currentBreakpoint}`);
    }

    getOptimalSpacing() {
        const baseSpacing = 16;
        const scaleFactor = {
            xsmall: 0.75,  // 12px
            small: 1.0,    // 16px
            medium: 1.0,   // 16px
            large: 1.25,   // 20px
            xlarge: 1.5    // 24px
        };

        return Math.round(baseSpacing * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    applySpacingStyles() {
        const css = `
            /* Adaptive spacing utilities */
            .spacing-xs { margin: var(--adaptive-spacing-small); }
            .spacing-sm { margin: var(--adaptive-spacing); }
            .spacing-md { margin: var(--adaptive-spacing); }
            .spacing-lg { margin: var(--adaptive-spacing-large); }

            .margin-xs { margin: var(--adaptive-spacing-small); }
            .margin-sm { margin: var(--adaptive-spacing); }
            .margin-md { margin: var(--adaptive-spacing); }
            .margin-lg { margin: var(--adaptive-spacing-large); }

            .padding-xs { padding: var(--adaptive-spacing-small); }
            .padding-sm { padding: var(--adaptive-spacing); }
            .padding-md { padding: var(--adaptive-spacing); }
            .padding-lg { padding: var(--adaptive-spacing-large); }

            /* Directional spacing */
            .margin-top-sm { margin-top: var(--adaptive-spacing); }
            .margin-bottom-sm { margin-bottom: var(--adaptive-spacing); }
            .margin-left-sm { margin-left: var(--adaptive-spacing); }
            .margin-right-sm { margin-right: var(--adaptive-spacing); }

            .padding-top-sm { padding-top: var(--adaptive-spacing); }
            .padding-bottom-sm { padding-bottom: var(--adaptive-spacing); }
            .padding-left-sm { padding-left: var(--adaptive-spacing); }
            .padding-right-sm { padding-right: var(--adaptive-spacing); }

            /* Breakpoint-specific spacing */
            .spacing-xsmall { --adaptive-spacing: 12px; }
            .spacing-small { --adaptive-spacing: 16px; }
            .spacing-medium { --adaptive-spacing: 16px; }
            .spacing-large { --adaptive-spacing: 20px; }
            .spacing-xlarge { --adaptive-spacing: 24px; }
        `;

        this.injectStyles('adaptive-spacing-styles', css);
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        super.onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo);

        this.spacingElements.forEach(element => {
            element.classList.remove(`spacing-${previousBreakpoint}`);
            element.classList.add(`spacing-${newBreakpoint}`);
            this.applySpacingLayout(element);
        });
    }

    injectStyles(id, css) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.spacingElements.clear();
    }
}

/**
 * Adaptive Touch Targets Component
 * Ensures all interactive elements meet touch target size requirements
 */
class AdaptiveTouchTargets extends AdaptiveComponent {
    constructor() {
        super();
        this.touchTargets = new Set();
        this.observer = null;
    }

    init(deviceInfo, breakpoint) {
        super.init(deviceInfo, breakpoint);
        this.setupTouchTargetObserver();
        this.applyTouchTargetStyles();
    }

    setupTouchTargetObserver() {
        if ('MutationObserver' in window) {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNewTouchTargets(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        this.processExistingTouchTargets();
    }

    processExistingTouchTargets() {
        const selectors = [
            'button', 'a', 'input[type="button"]', 'input[type="submit"]', 
            '.touch-target', '.mobile-button', '.interactive', '[role="button"]'
        ];
        
        const elements = document.querySelectorAll(selectors.join(', '));
        elements.forEach(element => this.enhanceTouchTarget(element));
    }

    processNewTouchTargets(element) {
        const interactiveElements = ['BUTTON', 'A', 'INPUT'];
        const interactiveClasses = ['touch-target', 'mobile-button', 'interactive'];
        
        if (interactiveElements.includes(element.tagName) || 
            (element.classList && interactiveClasses.some(cls => element.classList.contains(cls))) ||
            element.getAttribute('role') === 'button') {
            this.enhanceTouchTarget(element);
        }

        const selectors = [
            'button', 'a', 'input[type="button"]', 'input[type="submit"]', 
            '.touch-target', '.mobile-button', '.interactive', '[role="button"]'
        ];
        
        const elements = element.querySelectorAll && element.querySelectorAll(selectors.join(', '));
        if (elements) {
            elements.forEach(el => this.enhanceTouchTarget(el));
        }
    }

    enhanceTouchTarget(element) {
        if (this.touchTargets.has(element)) return;

        this.touchTargets.add(element);
        this.applyTouchTargetLayout(element);
    }

    applyTouchTargetLayout(element) {
        const minSize = this.getOptimalTouchTargetSize();
        const padding = this.getOptimalTouchPadding();

        // Apply touch target properties
        element.style.setProperty('--touch-target-min-size', `${minSize}px`);
        element.style.setProperty('--touch-target-padding', `${padding}px`);

        // Add responsive classes
        element.classList.add('adaptive-enhanced');
        element.classList.add(`touch-${this.currentBreakpoint}`);
        element.classList.add('adaptive-touch-target');
    }

    getOptimalTouchTargetSize() {
        // Base on device type and breakpoint
        if (this.deviceInfo.isPhone) {
            return this.currentBreakpoint === 'xsmall' ? 48 : 44;
        } else if (this.deviceInfo.isTablet) {
            return 40;
        } else if (this.deviceInfo.hasTouch) {
            return 36;
        } else {
            return 32; // Desktop without touch
        }
    }

    getOptimalTouchPadding() {
        const basePadding = 12;
        const scaleFactor = {
            xsmall: 1.0,   // 12px
            small: 1.0,    // 12px
            medium: 0.83,  // 10px
            large: 0.67,   // 8px
            xlarge: 0.67   // 8px
        };

        return Math.round(basePadding * (scaleFactor[this.currentBreakpoint] || 1.0));
    }

    applyTouchTargetStyles() {
        const css = `
            .adaptive-touch-target {
                min-width: var(--touch-target-min-size);
                min-height: var(--touch-target-min-size);
                padding: var(--touch-target-padding);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                position: relative;
                cursor: pointer;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }

            /* Touch feedback */
            .adaptive-touch-target::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.1);
                border-radius: inherit;
                opacity: 0;
                transition: opacity 0.15s ease-out;
                pointer-events: none;
            }

            .adaptive-touch-target:active::before {
                opacity: 1;
            }

            /* Breakpoint-specific touch targets */
            .touch-xsmall { --touch-target-min-size: 48px; --touch-target-padding: 12px; }
            .touch-small { --touch-target-min-size: 44px; --touch-target-padding: 12px; }
            .touch-medium { --touch-target-min-size: 40px; --touch-target-padding: 10px; }
            .touch-large { --touch-target-min-size: 36px; --touch-target-padding: 8px; }
            .touch-xlarge { --touch-target-min-size: 32px; --touch-target-padding: 8px; }

            /* Accessibility enhancements */
            .adaptive-touch-target:focus-visible {
                outline: 2px solid #007AFF;
                outline-offset: 2px;
            }

            /* Disabled state */
            .adaptive-touch-target:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .adaptive-touch-target:disabled::before {
                display: none;
            }
        `;

        this.injectStyles('adaptive-touch-targets-styles', css);
    }

    onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo) {
        super.onBreakpointChange(newBreakpoint, previousBreakpoint, deviceInfo);

        this.touchTargets.forEach(element => {
            element.classList.remove(`touch-${previousBreakpoint}`);
            element.classList.add(`touch-${newBreakpoint}`);
            this.applyTouchTargetLayout(element);
        });
    }

    injectStyles(id, css) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = css;
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.touchTargets.clear();
    }
}

// Export all components
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AdaptiveComponent,
        AdaptiveContainer,
        AdaptiveGrid,
        AdaptiveFlexbox,
        AdaptiveTypography,
        AdaptiveSpacing,
        AdaptiveTouchTargets
    };
} else if (typeof window !== 'undefined') {
    window.AdaptiveComponent = AdaptiveComponent;
    window.AdaptiveContainer = AdaptiveContainer;
    window.AdaptiveGrid = AdaptiveGrid;
    window.AdaptiveFlexbox = AdaptiveFlexbox;
    window.AdaptiveTypography = AdaptiveTypography;
    window.AdaptiveSpacing = AdaptiveSpacing;
    window.AdaptiveTouchTargets = AdaptiveTouchTargets;
}