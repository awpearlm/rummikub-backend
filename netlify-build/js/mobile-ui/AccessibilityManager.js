/**
 * Accessibility Manager
 * Comprehensive accessibility system for mobile UI
 * Implements screen reader support, high contrast mode, and touch target validation
 */

class AccessibilityManager {
    constructor() {
        this.isInitialized = false;
        this.features = {
            screenReader: true,
            highContrast: true,
            touchTargets: true,
            keyboardNavigation: true,
            focusManagement: true,
            announcements: true
        };
        
        this.state = {
            screenReaderActive: false,
            highContrastMode: false,
            reducedMotion: false,
            keyboardNavigation: false,
            currentFocus: null,
            announceQueue: []
        };
        
        this.observers = {
            mutation: null,
            intersection: null,
            resize: null
        };
        
        this.callbacks = {
            focusChange: new Set(),
            announcement: new Set(),
            stateChange: new Set()
        };
        
        this.touchTargetMinSize = 44; // WCAG AA minimum
        this.touchTargetComfortableSize = 48; // Recommended size
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        try {
            this.detectAccessibilityPreferences();
            this.setupScreenReaderSupport();
            this.setupHighContrastMode();
            this.setupTouchTargetValidation();
            this.setupKeyboardNavigation();
            this.setupFocusManagement();
            this.setupAnnouncementSystem();
            this.setupObservers();
            this.applyAccessibilityStyles();
            
            this.isInitialized = true;
            console.log('Accessibility Manager initialized');
            
        } catch (error) {
            console.error('Failed to initialize Accessibility Manager:', error);
            throw error;
        }
    }

    detectAccessibilityPreferences() {
        // Detect screen reader usage
        this.state.screenReaderActive = this.detectScreenReader();
        
        // Detect high contrast preference
        this.state.highContrastMode = window.matchMedia('(prefers-contrast: high)').matches;
        
        // Detect reduced motion preference
        this.state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Detect keyboard navigation
        this.state.keyboardNavigation = this.detectKeyboardNavigation();
        
        // Apply initial states
        this.applyAccessibilityStates();
        
        // Setup preference change listeners
        this.setupPreferenceListeners();
    }

    detectScreenReader() {
        // Multiple methods to detect screen reader usage
        const indicators = [
            // Check for screen reader specific APIs
            'speechSynthesis' in window,
            // Check for NVDA, JAWS, VoiceOver indicators
            navigator.userAgent.includes('NVDA') || 
            navigator.userAgent.includes('JAWS') ||
            navigator.userAgent.includes('VoiceOver'),
            // Check for accessibility tree access
            document.body.getAttribute('aria-hidden') !== null,
            // Check for high contrast mode (often used with screen readers)
            window.matchMedia('(prefers-contrast: high)').matches,
            // Check for reduced motion (often used with screen readers)
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ];
        
        // If any indicator is true, assume screen reader might be active
        return indicators.some(indicator => indicator);
    }

    detectKeyboardNavigation() {
        // Detect if user is navigating with keyboard
        let keyboardUsed = false;
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) {
                keyboardUsed = true;
                this.state.keyboardNavigation = true;
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        document.addEventListener('mousedown', () => {
            if (keyboardUsed) {
                keyboardUsed = false;
                this.state.keyboardNavigation = false;
                document.body.classList.remove('keyboard-navigation');
            }
        });
        
        return keyboardUsed;
    }

    setupPreferenceListeners() {
        // Listen for high contrast changes
        const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
        highContrastQuery.addListener((e) => {
            this.state.highContrastMode = e.matches;
            this.applyHighContrastMode();
            this.emit('stateChange', { highContrast: e.matches });
        });
        
        // Listen for reduced motion changes
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.addListener((e) => {
            this.state.reducedMotion = e.matches;
            this.applyReducedMotion();
            this.emit('stateChange', { reducedMotion: e.matches });
        });
        
        // Listen for color scheme changes
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeQuery.addListener((e) => {
            this.applyColorScheme(e.matches ? 'dark' : 'light');
            this.emit('stateChange', { darkMode: e.matches });
        });
    }

    setupScreenReaderSupport() {
        if (!this.features.screenReader) return;
        
        // Create live region for announcements
        this.createLiveRegion();
        
        // Enhance existing elements with ARIA attributes
        this.enhanceWithARIA();
        
        // Setup automatic ARIA labeling
        this.setupAutoARIA();
        
        // Setup landmark navigation
        this.setupLandmarks();
    }

    createLiveRegion() {
        // Create polite live region for general announcements
        const politeRegion = document.createElement('div');
        politeRegion.id = 'accessibility-live-region-polite';
        politeRegion.setAttribute('aria-live', 'polite');
        politeRegion.setAttribute('aria-atomic', 'true');
        politeRegion.className = 'sr-only';
        document.body.appendChild(politeRegion);
        
        // Create assertive live region for urgent announcements
        const assertiveRegion = document.createElement('div');
        assertiveRegion.id = 'accessibility-live-region-assertive';
        assertiveRegion.setAttribute('aria-live', 'assertive');
        assertiveRegion.setAttribute('aria-atomic', 'true');
        assertiveRegion.className = 'sr-only';
        document.body.appendChild(assertiveRegion);
        
        this.liveRegions = {
            polite: politeRegion,
            assertive: assertiveRegion
        };
    }

    enhanceWithARIA() {
        // Enhance buttons without proper labels
        const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
        buttons.forEach(button => {
            if (!button.textContent.trim()) {
                const icon = button.querySelector('i, svg, .icon');
                if (icon) {
                    const ariaLabel = this.generateButtonLabel(button, icon);
                    if (ariaLabel) {
                        button.setAttribute('aria-label', ariaLabel);
                    }
                }
            }
        });
        
        // Enhance form inputs
        const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
        inputs.forEach(input => {
            const label = this.findAssociatedLabel(input);
            if (!label && input.placeholder) {
                input.setAttribute('aria-label', input.placeholder);
            }
        });
        
        // Enhance interactive elements
        const interactiveElements = document.querySelectorAll('.interactive, .clickable, .touch-target');
        interactiveElements.forEach(element => {
            if (!element.getAttribute('role') && element.tagName !== 'BUTTON' && element.tagName !== 'A') {
                element.setAttribute('role', 'button');
                element.setAttribute('tabindex', '0');
            }
        });
    }

    generateButtonLabel(button, icon) {
        // Try to generate meaningful labels for icon buttons
        const iconClasses = icon.className.toLowerCase();
        const buttonClasses = button.className.toLowerCase();
        
        const labelMap = {
            'close': 'Close',
            'menu': 'Menu',
            'search': 'Search',
            'play': 'Play',
            'pause': 'Pause',
            'stop': 'Stop',
            'next': 'Next',
            'previous': 'Previous',
            'back': 'Back',
            'forward': 'Forward',
            'home': 'Home',
            'settings': 'Settings',
            'profile': 'Profile',
            'logout': 'Logout',
            'login': 'Login',
            'save': 'Save',
            'edit': 'Edit',
            'delete': 'Delete',
            'add': 'Add',
            'remove': 'Remove',
            'expand': 'Expand',
            'collapse': 'Collapse',
            'drawer': 'Open drawer',
            'hand': 'Show hand',
            'board': 'View board'
        };
        
        for (const [key, label] of Object.entries(labelMap)) {
            if (iconClasses.includes(key) || buttonClasses.includes(key)) {
                return label;
            }
        }
        
        return null;
    }

    findAssociatedLabel(input) {
        // Find label associated with input
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label;
        }
        
        // Check if input is inside a label
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel;
        
        return null;
    }

    setupAutoARIA() {
        // Automatically add ARIA attributes to new elements
        if ('MutationObserver' in window) {
            this.observers.mutation = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.enhanceNewElement(node);
                        }
                    });
                });
            });
            
            this.observers.mutation.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    enhanceNewElement(element) {
        // Enhance buttons
        if (element.tagName === 'BUTTON' || element.classList.contains('mobile-button')) {
            this.enhanceButton(element);
        }
        
        // Enhance interactive elements
        if (element.classList.contains('interactive') || element.classList.contains('touch-target')) {
            this.enhanceInteractiveElement(element);
        }
        
        // Enhance form elements
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
            this.enhanceFormElement(element);
        }
        
        // Enhance cards
        if (element.classList.contains('mobile-card') || element.classList.contains('responsive-card')) {
            this.enhanceCard(element);
        }
        
        // Check children
        const childButtons = element.querySelectorAll('button, .mobile-button');
        childButtons.forEach(button => this.enhanceButton(button));
        
        const childInteractive = element.querySelectorAll('.interactive, .touch-target');
        childInteractive.forEach(el => this.enhanceInteractiveElement(el));
    }

    enhanceButton(button) {
        if (!button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby')) {
            if (!button.textContent.trim()) {
                const icon = button.querySelector('i, svg, .icon');
                if (icon) {
                    const label = this.generateButtonLabel(button, icon);
                    if (label) {
                        button.setAttribute('aria-label', label);
                    }
                }
            }
        }
        
        // Ensure proper role
        if (!button.getAttribute('role') && button.tagName !== 'BUTTON') {
            button.setAttribute('role', 'button');
        }
        
        // Ensure keyboard accessibility
        if (!button.getAttribute('tabindex') && button.tagName !== 'BUTTON') {
            button.setAttribute('tabindex', '0');
        }
    }

    enhanceInteractiveElement(element) {
        if (!element.getAttribute('role')) {
            element.setAttribute('role', 'button');
        }
        
        if (!element.getAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }
        
        // Add keyboard event handlers if not present
        if (!element.hasAttribute('data-keyboard-enhanced')) {
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    element.click();
                }
            });
            element.setAttribute('data-keyboard-enhanced', 'true');
        }
    }

    enhanceFormElement(element) {
        if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
            const label = this.findAssociatedLabel(element);
            if (!label && element.placeholder) {
                element.setAttribute('aria-label', element.placeholder);
            }
        }
        
        // Add required indicator
        if (element.required && !element.getAttribute('aria-required')) {
            element.setAttribute('aria-required', 'true');
        }
        
        // Add invalid state
        if (element.validity && !element.validity.valid) {
            element.setAttribute('aria-invalid', 'true');
        }
    }

    enhanceCard(card) {
        if (card.classList.contains('interactive')) {
            if (!card.getAttribute('role')) {
                card.setAttribute('role', 'button');
            }
            
            if (!card.getAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
        }
    }

    setupLandmarks() {
        // Add landmark roles to common elements
        const header = document.querySelector('header, .header');
        if (header && !header.getAttribute('role')) {
            header.setAttribute('role', 'banner');
        }
        
        const nav = document.querySelector('nav, .nav, .navigation');
        if (nav && !nav.getAttribute('role')) {
            nav.setAttribute('role', 'navigation');
        }
        
        const main = document.querySelector('main, .main, .content');
        if (main && !main.getAttribute('role')) {
            main.setAttribute('role', 'main');
        }
        
        const footer = document.querySelector('footer, .footer');
        if (footer && !footer.getAttribute('role')) {
            footer.setAttribute('role', 'contentinfo');
        }
    }

    setupHighContrastMode() {
        if (!this.features.highContrast) return;
        
        this.applyHighContrastMode();
    }

    applyHighContrastMode() {
        if (this.state.highContrastMode) {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }
    }

    applyReducedMotion() {
        if (this.state.reducedMotion) {
            document.body.classList.add('reduced-motion');
        } else {
            document.body.classList.remove('reduced-motion');
        }
    }

    applyColorScheme(scheme) {
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(`${scheme}-mode`);
    }

    setupTouchTargetValidation() {
        if (!this.features.touchTargets) return;
        
        this.validateExistingTouchTargets();
        this.setupTouchTargetObserver();
    }

    validateExistingTouchTargets() {
        const interactiveElements = document.querySelectorAll(
            'button, a, input[type="button"], input[type="submit"], .touch-target, .mobile-button, .interactive'
        );
        
        interactiveElements.forEach(element => {
            this.validateTouchTarget(element);
        });
    }

    setupTouchTargetObserver() {
        if ('MutationObserver' in window) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.validateNewTouchTargets(node);
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    validateNewTouchTargets(element) {
        const interactiveSelectors = [
            'button', 'a', 'input[type="button"]', 'input[type="submit"]',
            '.touch-target', '.mobile-button', '.interactive'
        ];
        
        if (interactiveSelectors.some(selector => element.matches && element.matches(selector))) {
            this.validateTouchTarget(element);
        }
        
        const childElements = element.querySelectorAll && element.querySelectorAll(interactiveSelectors.join(', '));
        if (childElements) {
            childElements.forEach(child => this.validateTouchTarget(child));
        }
    }

    validateTouchTarget(element) {
        const rect = element.getBoundingClientRect();
        const minSize = this.touchTargetMinSize;
        
        if (rect.width < minSize || rect.height < minSize) {
            this.fixTouchTarget(element, rect);
        }
    }

    fixTouchTarget(element, rect) {
        const minSize = this.touchTargetMinSize;
        
        // Calculate needed padding
        const widthDiff = Math.max(0, minSize - rect.width);
        const heightDiff = Math.max(0, minSize - rect.height);
        
        const horizontalPadding = Math.ceil(widthDiff / 2);
        const verticalPadding = Math.ceil(heightDiff / 2);
        
        // Apply minimum size styles
        const currentPaddingTop = parseInt(getComputedStyle(element).paddingTop) || 0;
        const currentPaddingRight = parseInt(getComputedStyle(element).paddingRight) || 0;
        const currentPaddingBottom = parseInt(getComputedStyle(element).paddingBottom) || 0;
        const currentPaddingLeft = parseInt(getComputedStyle(element).paddingLeft) || 0;
        
        element.style.paddingTop = `${Math.max(currentPaddingTop, verticalPadding)}px`;
        element.style.paddingRight = `${Math.max(currentPaddingRight, horizontalPadding)}px`;
        element.style.paddingBottom = `${Math.max(currentPaddingBottom, verticalPadding)}px`;
        element.style.paddingLeft = `${Math.max(currentPaddingLeft, horizontalPadding)}px`;
        
        element.style.minWidth = `${minSize}px`;
        element.style.minHeight = `${minSize}px`;
        
        // Add accessibility class
        element.classList.add('accessibility-enhanced-touch-target');
        
        console.log(`Enhanced touch target: ${element.tagName}.${element.className} - Size: ${rect.width}x${rect.height} -> ${minSize}x${minSize}`);
    }

    setupKeyboardNavigation() {
        if (!this.features.keyboardNavigation) return;
        
        this.setupKeyboardEventHandlers();
        this.setupFocusTrapping();
        this.setupSkipLinks();
    }

    setupKeyboardEventHandlers() {
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });
        
        // Handle escape key for modals and overlays
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscapeKey(e);
            }
        });
    }

    handleGlobalKeydown(e) {
        // Handle arrow key navigation for custom components
        if (e.key.startsWith('Arrow')) {
            this.handleArrowKeyNavigation(e);
        }
        
        // Handle Enter and Space for custom interactive elements
        if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
            e.preventDefault();
            e.target.click();
        }
    }

    handleArrowKeyNavigation(e) {
        const currentElement = e.target;
        
        // Handle grid navigation
        if (currentElement.closest('.responsive-grid, .adaptive-grid')) {
            this.handleGridNavigation(e, currentElement);
        }
        
        // Handle tab navigation
        if (currentElement.closest('.nav-menu, .tab-list')) {
            this.handleTabNavigation(e, currentElement);
        }
    }

    handleGridNavigation(e, currentElement) {
        const grid = currentElement.closest('.responsive-grid, .adaptive-grid');
        const items = Array.from(grid.querySelectorAll('[tabindex="0"], button, a, input'));
        const currentIndex = items.indexOf(currentElement);
        
        if (currentIndex === -1) return;
        
        const gridColumns = this.getGridColumns(grid);
        let targetIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowRight':
                targetIndex = Math.min(currentIndex + 1, items.length - 1);
                break;
            case 'ArrowLeft':
                targetIndex = Math.max(currentIndex - 1, 0);
                break;
            case 'ArrowDown':
                targetIndex = Math.min(currentIndex + gridColumns, items.length - 1);
                break;
            case 'ArrowUp':
                targetIndex = Math.max(currentIndex - gridColumns, 0);
                break;
        }
        
        if (targetIndex !== currentIndex) {
            e.preventDefault();
            items[targetIndex].focus();
        }
    }

    getGridColumns(grid) {
        const computedStyle = getComputedStyle(grid);
        const gridTemplateColumns = computedStyle.gridTemplateColumns;
        
        if (gridTemplateColumns && gridTemplateColumns !== 'none') {
            return gridTemplateColumns.split(' ').length;
        }
        
        return 1;
    }

    handleTabNavigation(e, currentElement) {
        const container = currentElement.closest('.nav-menu, .tab-list');
        const items = Array.from(container.querySelectorAll('[tabindex="0"], button, a'));
        const currentIndex = items.indexOf(currentElement);
        
        if (currentIndex === -1) return;
        
        let targetIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                targetIndex = (currentIndex + 1) % items.length;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                targetIndex = (currentIndex - 1 + items.length) % items.length;
                break;
        }
        
        if (targetIndex !== currentIndex) {
            e.preventDefault();
            items[targetIndex].focus();
        }
    }

    handleEscapeKey(e) {
        // Close modals
        const modal = document.querySelector('.modal.active, .overlay.active');
        if (modal) {
            const closeButton = modal.querySelector('.close, [data-dismiss="modal"]');
            if (closeButton) {
                closeButton.click();
            }
        }
        
        // Collapse expanded drawers
        const expandedDrawer = document.querySelector('.hand-drawer.expanded');
        if (expandedDrawer) {
            const drawerComponent = window.handDrawerComponent;
            if (drawerComponent && drawerComponent.collapse) {
                drawerComponent.collapse();
            }
        }
    }

    setupFocusTrapping() {
        // Will be implemented when modals are created
        this.focusTraps = new Map();
    }

    setupSkipLinks() {
        // Create skip link for main content
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'skip-link sr-only-focusable';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: #000;
            color: #fff;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 1000;
            transition: top 0.3s;
        `;
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Ensure main content has proper ID
        let mainContent = document.getElementById('main-content');
        if (!mainContent) {
            mainContent = document.querySelector('main, .main, .content, .game-screen, .lobby-screen');
            if (mainContent) {
                mainContent.id = 'main-content';
            }
        }
    }

    setupFocusManagement() {
        if (!this.features.focusManagement) return;
        
        this.setupFocusTracking();
        this.setupFocusRestoration();
    }

    setupFocusTracking() {
        document.addEventListener('focusin', (e) => {
            this.state.currentFocus = e.target;
            this.emit('focusChange', { element: e.target, type: 'focusin' });
        });
        
        document.addEventListener('focusout', (e) => {
            this.emit('focusChange', { element: e.target, type: 'focusout' });
        });
    }

    setupFocusRestoration() {
        // Store focus before screen changes
        this.focusHistory = [];
        
        // Listen for screen changes
        document.addEventListener('screenchange', (e) => {
            if (this.state.currentFocus) {
                this.focusHistory.push({
                    element: this.state.currentFocus,
                    screen: e.detail.previousScreen,
                    timestamp: Date.now()
                });
            }
        });
    }

    setupAnnouncementSystem() {
        if (!this.features.announcements) return;
        
        this.announcementQueue = [];
        this.isAnnouncing = false;
    }

    setupObservers() {
        // Setup intersection observer for focus management
        if ('IntersectionObserver' in window) {
            this.observers.intersection = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting && entry.target === this.state.currentFocus) {
                        // Current focused element is no longer visible
                        this.handleFocusedElementHidden(entry.target);
                    }
                });
            });
        }
    }

    handleFocusedElementHidden(element) {
        // Find next focusable element
        const focusableElements = this.getFocusableElements();
        const nextElement = focusableElements.find(el => el !== element && this.isElementVisible(el));
        
        if (nextElement) {
            nextElement.focus();
        }
    }

    getFocusableElements() {
        const selector = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '[role="button"]:not([disabled])'
        ].join(', ');
        
        return Array.from(document.querySelectorAll(selector));
    }

    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && 
               rect.top >= 0 && rect.left >= 0 &&
               rect.bottom <= window.innerHeight && 
               rect.right <= window.innerWidth;
    }

    applyAccessibilityStates() {
        const body = document.body;
        
        // Apply state classes
        body.classList.toggle('screen-reader-active', this.state.screenReaderActive);
        body.classList.toggle('high-contrast', this.state.highContrastMode);
        body.classList.toggle('reduced-motion', this.state.reducedMotion);
        body.classList.toggle('keyboard-navigation', this.state.keyboardNavigation);
    }

    applyAccessibilityStyles() {
        const css = `
            /* Screen reader only content */
            .sr-only {
                position: absolute !important;
                width: 1px !important;
                height: 1px !important;
                padding: 0 !important;
                margin: -1px !important;
                overflow: hidden !important;
                clip: rect(0, 0, 0, 0) !important;
                white-space: nowrap !important;
                border: 0 !important;
            }
            
            .sr-only-focusable:focus {
                position: static !important;
                width: auto !important;
                height: auto !important;
                padding: inherit !important;
                margin: inherit !important;
                overflow: visible !important;
                clip: auto !important;
                white-space: normal !important;
            }
            
            /* High contrast mode styles */
            .high-contrast {
                --text-color: #000;
                --bg-color: #fff;
                --border-color: #000;
                --focus-color: #ff0;
                --link-color: #00f;
            }
            
            .high-contrast * {
                background-color: var(--bg-color) !important;
                color: var(--text-color) !important;
                border-color: var(--border-color) !important;
            }
            
            .high-contrast button,
            .high-contrast .mobile-button,
            .high-contrast .responsive-button {
                border: 2px solid var(--border-color) !important;
                background-color: var(--bg-color) !important;
                color: var(--text-color) !important;
            }
            
            .high-contrast a {
                color: var(--link-color) !important;
                text-decoration: underline !important;
            }
            
            .high-contrast :focus {
                outline: 3px solid var(--focus-color) !important;
                outline-offset: 2px !important;
            }
            
            /* Reduced motion styles */
            .reduced-motion *,
            .reduced-motion *::before,
            .reduced-motion *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
            
            /* Keyboard navigation styles */
            .keyboard-navigation :focus {
                outline: 2px solid #007AFF !important;
                outline-offset: 2px !important;
            }
            
            .keyboard-navigation .touch-target:focus {
                background-color: rgba(0, 122, 255, 0.1) !important;
            }
            
            /* Enhanced touch targets */
            .accessibility-enhanced-touch-target {
                position: relative;
            }
            
            .accessibility-enhanced-touch-target::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                min-width: 44px;
                min-height: 44px;
                pointer-events: none;
                border: 1px dashed transparent;
            }
            
            /* Debug mode for touch targets */
            .debug-touch-targets .accessibility-enhanced-touch-target::after {
                border-color: #ff0;
            }
            
            /* Skip link styles */
            .skip-link {
                position: absolute;
                top: -40px;
                left: 6px;
                background: #000;
                color: #fff;
                padding: 8px;
                text-decoration: none;
                border-radius: 4px;
                z-index: 1000;
                transition: top 0.3s;
            }
            
            .skip-link:focus {
                top: 6px;
            }
            
            /* Focus indicators for custom elements */
            [role="button"]:focus,
            .interactive:focus,
            .touch-target:focus {
                outline: 2px solid #007AFF;
                outline-offset: 2px;
            }
            
            /* Ensure sufficient color contrast */
            .mobile-button,
            .responsive-button {
                background-color: #007AFF;
                color: #fff;
                border: 1px solid #007AFF;
            }
            
            .mobile-button:hover,
            .responsive-button:hover {
                background-color: #0056CC;
                border-color: #0056CC;
            }
            
            .mobile-button:focus,
            .responsive-button:focus {
                box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.3);
            }
            
            /* Ensure form elements are accessible */
            .form-input:focus {
                outline: none;
                border-color: #007AFF;
                box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
            }
            
            .form-input:invalid {
                border-color: #FF3B30;
                box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.1);
            }
            
            /* Live region styles */
            #accessibility-live-region-polite,
            #accessibility-live-region-assertive {
                position: absolute !important;
                width: 1px !important;
                height: 1px !important;
                padding: 0 !important;
                margin: -1px !important;
                overflow: hidden !important;
                clip: rect(0, 0, 0, 0) !important;
                white-space: nowrap !important;
                border: 0 !important;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'accessibility-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    }

    // Public API methods
    announce(message, priority = 'polite') {
        if (!this.liveRegions) return;
        
        const region = this.liveRegions[priority] || this.liveRegions.polite;
        
        // Clear previous message
        region.textContent = '';
        
        // Add new message after a brief delay to ensure screen readers notice the change
        setTimeout(() => {
            region.textContent = message;
            this.emit('announcement', { message, priority });
        }, 100);
        
        // Clear message after it's been announced
        setTimeout(() => {
            region.textContent = '';
        }, 5000);
    }

    setHighContrastMode(enabled) {
        this.state.highContrastMode = enabled;
        this.applyHighContrastMode();
        this.emit('stateChange', { highContrast: enabled });
    }

    toggleHighContrastMode() {
        this.setHighContrastMode(!this.state.highContrastMode);
    }

    focusElement(element) {
        if (element && element.focus) {
            element.focus();
            this.state.currentFocus = element;
        }
    }

    restoreFocus() {
        const lastFocus = this.focusHistory[this.focusHistory.length - 1];
        if (lastFocus && lastFocus.element && this.isElementVisible(lastFocus.element)) {
            this.focusElement(lastFocus.element);
        }
    }

    validateAllTouchTargets() {
        this.validateExistingTouchTargets();
        return this.getTouchTargetReport();
    }

    getTouchTargetReport() {
        const interactiveElements = document.querySelectorAll(
            'button, a, input[type="button"], input[type="submit"], .touch-target, .mobile-button, .interactive'
        );
        
        const report = {
            total: interactiveElements.length,
            compliant: 0,
            nonCompliant: 0,
            elements: []
        };
        
        interactiveElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const isCompliant = rect.width >= this.touchTargetMinSize && rect.height >= this.touchTargetMinSize;
            
            if (isCompliant) {
                report.compliant++;
            } else {
                report.nonCompliant++;
            }
            
            report.elements.push({
                element,
                width: rect.width,
                height: rect.height,
                compliant: isCompliant
            });
        });
        
        return report;
    }

    getAccessibilityReport() {
        return {
            state: { ...this.state },
            features: { ...this.features },
            touchTargets: this.getTouchTargetReport(),
            ariaElements: document.querySelectorAll('[aria-label], [aria-labelledby], [role]').length,
            focusableElements: this.getFocusableElements().length
        };
    }

    // Event system
    on(eventName, callback) {
        if (!this.callbacks[eventName]) {
            this.callbacks[eventName] = new Set();
        }
        this.callbacks[eventName].add(callback);
        return () => this.callbacks[eventName].delete(callback);
    }

    emit(eventName, data = {}) {
        const callbacks = this.callbacks[eventName];
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in accessibility callback for ${eventName}:`, error);
                }
            });
        }
    }

    // Cleanup
    destroy() {
        // Remove observers
        if (this.observers.mutation) {
            this.observers.mutation.disconnect();
        }
        
        if (this.observers.intersection) {
            this.observers.intersection.disconnect();
        }
        
        // Remove live regions
        if (this.liveRegions) {
            Object.values(this.liveRegions).forEach(region => {
                if (region.parentNode) {
                    region.parentNode.removeChild(region);
                }
            });
        }
        
        // Remove styles
        const styleElement = document.getElementById('accessibility-styles');
        if (styleElement) {
            styleElement.remove();
        }
        
        // Clear callbacks
        Object.values(this.callbacks).forEach(callbackSet => {
            callbackSet.clear();
        });
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
} else if (typeof window !== 'undefined') {
    window.AccessibilityManager = AccessibilityManager;
}