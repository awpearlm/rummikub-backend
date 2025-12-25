/**
 * Mobile Interface Toggle
 * Provides option to switch between mobile and desktop interfaces
 * Adds fallback to desktop interface if mobile components fail
 * Ensures cross-compatibility between mobile and desktop modes
 */

class MobileInterfaceToggle {
    constructor(mobileInterfaceActivator) {
        this.mobileInterfaceActivator = mobileInterfaceActivator;
        this.currentMode = 'auto'; // 'auto', 'mobile', 'desktop'
        this.userPreference = null;
        this.fallbackActive = false;
        this.toggleButton = null;
        this.errorCount = 0;
        this.maxErrors = 3;
        
        this.init();
    }

    init() {
        console.log('Mobile Interface Toggle initializing...');
        
        // Load user preference
        this.loadUserPreference();
        
        // Set up error monitoring
        this.setupErrorMonitoring();
        
        // Create toggle UI
        this.createToggleUI();
        
        // Set up fallback mechanisms
        this.setupFallbackMechanisms();
        
        // Apply initial mode
        this.applyMode();
        
        console.log('Mobile Interface Toggle initialized');
    }

    /**
     * Load user preference from storage
     */
    loadUserPreference() {
        const stored = localStorage.getItem('mobile_interface_preference');
        if (stored && ['auto', 'mobile', 'desktop'].includes(stored)) {
            this.userPreference = stored;
            this.currentMode = stored;
            console.log('Loaded user preference:', this.userPreference);
        } else {
            this.userPreference = 'auto';
            this.currentMode = 'auto';
        }
    }

    /**
     * Save user preference to storage
     */
    saveUserPreference() {
        localStorage.setItem('mobile_interface_preference', this.userPreference);
        console.log('Saved user preference:', this.userPreference);
    }

    /**
     * Set up error monitoring for fallback triggers
     */
    setupErrorMonitoring() {
        // Monitor mobile UI system errors
        window.addEventListener('error', (event) => {
            if (this.isMobileUIError(event)) {
                this.handleMobileUIError(event);
            }
        });
        
        // Monitor unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (this.isMobileUIError(event)) {
                this.handleMobileUIError(event);
            }
        });
        
        // Monitor mobile UI system events
        if (this.mobileInterfaceActivator && this.mobileInterfaceActivator.mobileUISystem) {
            this.mobileInterfaceActivator.mobileUISystem.on('error', (error) => {
                this.handleMobileUIError({ error, source: 'mobileUISystem' });
            });
        }
        
        // Set up periodic health check
        this.setupHealthCheck();
    }

    /**
     * Check if an error is related to mobile UI
     */
    isMobileUIError(event) {
        const errorSources = [
            'MobileUISystem',
            'MobileLoginScreen',
            'MobileLobbyScreen',
            'MobileGameCreationScreen',
            'MobileGameScreen',
            'MobileInterfaceActivator',
            'MobileInteractionRouter',
            'mobile-ui'
        ];
        
        const errorMessage = event.message || event.reason?.message || '';
        const errorStack = event.error?.stack || event.reason?.stack || '';
        const errorFilename = event.filename || '';
        
        return errorSources.some(source => 
            errorMessage.includes(source) || 
            errorStack.includes(source) || 
            errorFilename.includes(source)
        );
    }

    /**
     * Handle mobile UI errors
     */
    handleMobileUIError(event) {
        this.errorCount++;
        console.warn(`Mobile UI error detected (${this.errorCount}/${this.maxErrors}):`, event);
        
        // Store error for debugging
        const errorInfo = {
            timestamp: Date.now(),
            message: event.message || event.reason?.message || 'Unknown error',
            stack: event.error?.stack || event.reason?.stack || '',
            source: event.source || 'unknown',
            count: this.errorCount
        };
        
        const errors = JSON.parse(localStorage.getItem('mobile_ui_errors') || '[]');
        errors.push(errorInfo);
        // Keep only last 10 errors
        if (errors.length > 10) {
            errors.splice(0, errors.length - 10);
        }
        localStorage.setItem('mobile_ui_errors', JSON.stringify(errors));
        
        // Trigger fallback if too many errors
        if (this.errorCount >= this.maxErrors && !this.fallbackActive) {
            console.error('Too many mobile UI errors, triggering fallback to desktop');
            this.triggerFallback('Too many errors occurred in mobile interface');
        }
    }

    /**
     * Set up periodic health check
     */
    setupHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Perform health check on mobile UI components
     */
    performHealthCheck() {
        if (this.currentMode !== 'mobile' || this.fallbackActive) {
            return;
        }
        
        const healthChecks = [
            this.checkMobileUISystemHealth(),
            this.checkMobileScreensHealth(),
            this.checkMobileInteractionHealth()
        ];
        
        const failedChecks = healthChecks.filter(check => !check.healthy);
        
        if (failedChecks.length > 0) {
            console.warn('Mobile UI health check failed:', failedChecks);
            
            // If critical components are failing, trigger fallback
            const criticalFailures = failedChecks.filter(check => check.critical);
            if (criticalFailures.length > 0) {
                this.triggerFallback('Critical mobile UI components are not functioning');
            }
        }
    }

    /**
     * Check mobile UI system health
     */
    checkMobileUISystemHealth() {
        const mobileUISystem = this.mobileInterfaceActivator?.mobileUISystem;
        
        return {
            name: 'MobileUISystem',
            healthy: !!(mobileUISystem && mobileUISystem.isReady && mobileUISystem.isReady()),
            critical: true,
            details: {
                exists: !!mobileUISystem,
                isReady: mobileUISystem?.isReady?.() || false,
                componentCount: mobileUISystem?.components?.size || 0
            }
        };
    }

    /**
     * Check mobile screens health
     */
    checkMobileScreensHealth() {
        const mobileUISystem = this.mobileInterfaceActivator?.mobileUISystem;
        const screens = ['mobileLoginScreen', 'mobileLobbyScreen', 'mobileGameCreationScreen', 'mobileGameScreen'];
        
        let healthyScreens = 0;
        const screenDetails = {};
        
        screens.forEach(screenName => {
            const screen = mobileUISystem?.getComponent?.(screenName);
            const isHealthy = !!(screen && (screen.container || screen.screenElement));
            if (isHealthy) healthyScreens++;
            screenDetails[screenName] = isHealthy;
        });
        
        return {
            name: 'MobileScreens',
            healthy: healthyScreens >= 2, // At least 2 screens should be working
            critical: false,
            details: {
                healthyScreens,
                totalScreens: screens.length,
                screens: screenDetails
            }
        };
    }

    /**
     * Check mobile interaction health
     */
    checkMobileInteractionHealth() {
        const router = this.mobileInterfaceActivator?.mobileInteractionRouter;
        
        return {
            name: 'MobileInteraction',
            healthy: !!(router && router.isRouterActive && router.isRouterActive()),
            critical: false,
            details: {
                exists: !!router,
                isActive: router?.isRouterActive?.() || false,
                routeCount: router?.getRoutingTable?.()?.size || 0
            }
        };
    }

    /**
     * Create toggle UI
     */
    createToggleUI() {
        // Create toggle button
        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'mobile-interface-toggle';
        this.toggleButton.className = 'mobile-interface-toggle-btn';
        this.toggleButton.innerHTML = this.getToggleButtonContent();
        this.toggleButton.title = 'Switch interface mode';
        
        // Style the button
        this.toggleButton.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 80px;
            justify-content: center;
        `;
        
        // Add hover effects
        this.toggleButton.addEventListener('mouseenter', () => {
            this.toggleButton.style.background = 'rgba(0, 0, 0, 0.9)';
            this.toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            this.toggleButton.style.transform = 'translateY(-2px)';
        });
        
        this.toggleButton.addEventListener('mouseleave', () => {
            this.toggleButton.style.background = 'rgba(0, 0, 0, 0.7)';
            this.toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            this.toggleButton.style.transform = 'translateY(0)';
        });
        
        // Add click handler
        this.toggleButton.addEventListener('click', () => {
            this.showToggleMenu();
        });
        
        // Add to page
        document.body.appendChild(this.toggleButton);
        
        // Update button visibility based on current mode
        this.updateToggleButtonVisibility();
    }

    /**
     * Get toggle button content based on current mode
     */
    getToggleButtonContent() {
        const icons = {
            'auto': '🔄',
            'mobile': '📱',
            'desktop': '💻'
        };
        
        const labels = {
            'auto': 'Auto',
            'mobile': 'Mobile',
            'desktop': 'Desktop'
        };
        
        return `${icons[this.currentMode]} ${labels[this.currentMode]}`;
    }

    /**
     * Update toggle button visibility
     */
    updateToggleButtonVisibility() {
        if (!this.toggleButton) return;
        
        // Show toggle button on mobile devices or when fallback is active
        const shouldShow = this.mobileInterfaceActivator?.isMobileDevice() || 
                          this.fallbackActive || 
                          this.currentMode !== 'auto';
        
        this.toggleButton.style.display = shouldShow ? 'flex' : 'none';
    }

    /**
     * Show toggle menu
     */
    showToggleMenu() {
        // Create menu overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-toggle-menu-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10001;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
        `;
        
        // Create menu
        const menu = document.createElement('div');
        menu.className = 'mobile-toggle-menu';
        menu.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 300px;
            width: 90%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        menu.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #333;">
                Interface Mode
            </h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.4;">
                Choose how you want to use the interface:
            </p>
            <div class="toggle-options">
                ${this.createToggleOption('auto', '🔄', 'Auto', 'Automatically detect device type')}
                ${this.createToggleOption('mobile', '📱', 'Mobile', 'Always use mobile interface')}
                ${this.createToggleOption('desktop', '💻', 'Desktop', 'Always use desktop interface')}
            </div>
            ${this.fallbackActive ? `
                <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px;">
                    <div style="font-size: 12px; color: #856404; font-weight: 500;">⚠️ Fallback Mode Active</div>
                    <div style="font-size: 11px; color: #856404; margin-top: 2px;">Mobile interface encountered errors</div>
                </div>
            ` : ''}
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Cancel
                </button>
                <button class="debug-btn" style="padding: 8px 16px; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    Debug Info
                </button>
            </div>
        `;
        
        overlay.appendChild(menu);
        document.body.appendChild(overlay);
        
        // Add event listeners
        this.setupToggleMenuEvents(overlay, menu);
    }

    /**
     * Create toggle option HTML
     */
    createToggleOption(mode, icon, label, description) {
        const isSelected = this.currentMode === mode;
        const isDisabled = this.fallbackActive && mode === 'mobile';
        
        return `
            <div class="toggle-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                 data-mode="${mode}"
                 style="
                     display: flex;
                     align-items: center;
                     padding: 12px;
                     border: 2px solid ${isSelected ? '#007bff' : '#e9ecef'};
                     border-radius: 8px;
                     margin-bottom: 10px;
                     cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                     background: ${isSelected ? '#f8f9ff' : 'white'};
                     opacity: ${isDisabled ? '0.5' : '1'};
                     transition: all 0.2s ease;
                 ">
                <div style="font-size: 20px; margin-right: 12px;">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 12px; color: #666;">${description}</div>
                </div>
                ${isSelected ? '<div style="color: #007bff; font-size: 16px;">✓</div>' : ''}
            </div>
        `;
    }

    /**
     * Set up toggle menu events
     */
    setupToggleMenuEvents(overlay, menu) {
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeToggleMenu(overlay);
            }
        });
        
        // Cancel button
        const cancelBtn = menu.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => {
            this.closeToggleMenu(overlay);
        });
        
        // Debug button
        const debugBtn = menu.querySelector('.debug-btn');
        debugBtn.addEventListener('click', () => {
            this.showDebugInfo();
            this.closeToggleMenu(overlay);
        });
        
        // Toggle options
        const options = menu.querySelectorAll('.toggle-option:not(.disabled)');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const mode = option.dataset.mode;
                this.setMode(mode);
                this.closeToggleMenu(overlay);
            });
            
            // Hover effects
            option.addEventListener('mouseenter', () => {
                if (!option.classList.contains('selected') && !option.classList.contains('disabled')) {
                    option.style.borderColor = '#007bff';
                    option.style.background = '#f8f9ff';
                }
            });
            
            option.addEventListener('mouseleave', () => {
                if (!option.classList.contains('selected')) {
                    option.style.borderColor = '#e9ecef';
                    option.style.background = 'white';
                }
            });
        });
    }

    /**
     * Close toggle menu
     */
    closeToggleMenu(overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        }, 200);
    }

    /**
     * Set interface mode
     */
    setMode(mode) {
        console.log(`Setting interface mode to: ${mode}`);
        
        const previousMode = this.currentMode;
        this.currentMode = mode;
        this.userPreference = mode;
        
        // Save preference
        this.saveUserPreference();
        
        // Update toggle button
        this.toggleButton.innerHTML = this.getToggleButtonContent();
        this.updateToggleButtonVisibility();
        
        // Apply mode
        this.applyMode();
        
        // Show notification
        this.showModeChangeNotification(previousMode, mode);
    }

    /**
     * Apply current mode
     */
    applyMode() {
        console.log(`Applying interface mode: ${this.currentMode}`);
        
        switch (this.currentMode) {
            case 'auto':
                this.applyAutoMode();
                break;
            case 'mobile':
                this.applyMobileMode();
                break;
            case 'desktop':
                this.applyDesktopMode();
                break;
        }
    }

    /**
     * Apply auto mode (device detection)
     */
    applyAutoMode() {
        if (this.mobileInterfaceActivator?.isMobileDevice()) {
            this.activateMobileInterface();
        } else {
            this.activateDesktopInterface();
        }
    }

    /**
     * Apply mobile mode (force mobile)
     */
    applyMobileMode() {
        if (this.fallbackActive) {
            console.warn('Cannot activate mobile mode - fallback is active');
            this.showFallbackWarning();
            return;
        }
        
        this.activateMobileInterface();
    }

    /**
     * Apply desktop mode (force desktop)
     */
    applyDesktopMode() {
        this.activateDesktopInterface();
    }

    /**
     * Activate mobile interface
     */
    activateMobileInterface() {
        console.log('Activating mobile interface...');
        
        if (this.mobileInterfaceActivator) {
            if (!this.mobileInterfaceActivator.isInterfaceActivated()) {
                this.mobileInterfaceActivator.forceActivation();
            }
        } else {
            console.error('Mobile interface activator not available');
            this.triggerFallback('Mobile interface activator not available');
        }
    }

    /**
     * Activate desktop interface
     */
    activateDesktopInterface() {
        console.log('Activating desktop interface...');
        
        if (this.mobileInterfaceActivator && this.mobileInterfaceActivator.isInterfaceActivated()) {
            this.mobileInterfaceActivator.switchToDesktop();
        }
        
        // Clear fallback if active
        if (this.fallbackActive) {
            this.clearFallback();
        }
    }

    /**
     * Set up fallback mechanisms
     */
    setupFallbackMechanisms() {
        // Set up automatic fallback triggers
        this.setupAutomaticFallbacks();
        
        // Set up manual fallback options
        this.setupManualFallbacks();
    }

    /**
     * Set up automatic fallback triggers
     */
    setupAutomaticFallbacks() {
        // Fallback on mobile UI initialization failure
        if (this.mobileInterfaceActivator) {
            // Monitor for activation failures
            setTimeout(() => {
                if (this.currentMode === 'mobile' && 
                    !this.mobileInterfaceActivator.isInterfaceActivated() && 
                    !this.fallbackActive) {
                    console.warn('Mobile interface failed to activate, triggering fallback');
                    this.triggerFallback('Mobile interface failed to activate');
                }
            }, 5000); // Wait 5 seconds for activation
        }
    }

    /**
     * Set up manual fallback options
     */
    setupManualFallbacks() {
        // Add fallback button to mobile screens
        this.addFallbackButtonsToMobileScreens();
        
        // Add keyboard shortcut for fallback
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D for desktop fallback
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.triggerFallback('Manual fallback triggered');
            }
        });
    }

    /**
     * Add fallback buttons to mobile screens
     */
    addFallbackButtonsToMobileScreens() {
        // This would be called after mobile screens are created
        setTimeout(() => {
            const mobileScreens = document.querySelectorAll('.mobile-screen');
            mobileScreens.forEach(screen => {
                if (!screen.querySelector('.fallback-btn')) {
                    this.addFallbackButtonToScreen(screen);
                }
            });
        }, 2000);
    }

    /**
     * Add fallback button to a specific screen
     */
    addFallbackButtonToScreen(screen) {
        const fallbackBtn = document.createElement('button');
        fallbackBtn.className = 'fallback-btn';
        fallbackBtn.innerHTML = '💻 Desktop Mode';
        fallbackBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 12px;
            cursor: pointer;
            z-index: 1001;
        `;
        
        fallbackBtn.addEventListener('click', () => {
            this.triggerFallback('Manual fallback from mobile screen');
        });
        
        screen.appendChild(fallbackBtn);
    }

    /**
     * Trigger fallback to desktop interface
     */
    triggerFallback(reason) {
        console.warn('Triggering fallback to desktop interface:', reason);
        
        this.fallbackActive = true;
        
        // Switch to desktop mode
        this.activateDesktopInterface();
        
        // Update current mode but keep user preference
        const originalPreference = this.userPreference;
        this.currentMode = 'desktop';
        
        // Update toggle button
        this.toggleButton.innerHTML = this.getToggleButtonContent();
        this.updateToggleButtonVisibility();
        
        // Restore user preference (don't save fallback as preference)
        this.userPreference = originalPreference;
        
        // Show fallback notification
        this.showFallbackNotification(reason);
        
        // Store fallback info
        const fallbackInfo = {
            timestamp: Date.now(),
            reason,
            errorCount: this.errorCount,
            userPreference: originalPreference
        };
        localStorage.setItem('mobile_ui_fallback', JSON.stringify(fallbackInfo));
    }

    /**
     * Clear fallback state
     */
    clearFallback() {
        console.log('Clearing fallback state');
        
        this.fallbackActive = false;
        this.errorCount = 0;
        
        // Remove fallback info
        localStorage.removeItem('mobile_ui_fallback');
        
        // Update toggle button
        this.updateToggleButtonVisibility();
    }

    /**
     * Show mode change notification
     */
    showModeChangeNotification(previousMode, newMode) {
        const notification = document.createElement('div');
        notification.className = 'mode-change-notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        const modeLabels = {
            'auto': 'Auto',
            'mobile': 'Mobile',
            'desktop': 'Desktop'
        };
        
        notification.textContent = `Switched to ${modeLabels[newMode]} mode`;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Show fallback notification
     */
    showFallbackNotification(reason) {
        const notification = document.createElement('div');
        notification.className = 'fallback-notification';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            opacity: 0;
            transition: opacity 0.3s ease;
            max-width: 300px;
            text-align: center;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 4px;">⚠️ Fallback Mode</div>
            <div style="font-size: 12px; opacity: 0.9;">${reason}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    /**
     * Show fallback warning
     */
    showFallbackWarning() {
        const warning = document.createElement('div');
        warning.className = 'fallback-warning';
        warning.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #ffc107;
            color: #212529;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            opacity: 0;
            transition: opacity 0.3s ease;
            max-width: 300px;
            text-align: center;
        `;
        
        warning.innerHTML = `
            <div>⚠️ Mobile mode unavailable</div>
            <div style="font-size: 12px; margin-top: 4px;">Fallback mode is active</div>
        `;
        
        document.body.appendChild(warning);
        
        // Show warning
        setTimeout(() => {
            warning.style.opacity = '1';
        }, 100);
        
        // Hide and remove warning
        setTimeout(() => {
            warning.style.opacity = '0';
            setTimeout(() => {
                if (warning.parentNode) {
                    document.body.removeChild(warning);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Show debug info
     */
    showDebugInfo() {
        const debugInfo = this.collectDebugInfo();
        
        const debugWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes');
        debugWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Mobile Interface Debug Info</title>
                <style>
                    body { font-family: monospace; padding: 20px; background: #f5f5f5; }
                    .section { background: white; margin: 10px 0; padding: 15px; border-radius: 5px; }
                    .section h3 { margin-top: 0; color: #333; }
                    pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
                    .error { color: #dc3545; }
                    .warning { color: #ffc107; }
                    .success { color: #28a745; }
                </style>
            </head>
            <body>
                <h1>Mobile Interface Debug Info</h1>
                <div class="section">
                    <h3>Current Status</h3>
                    <pre>${JSON.stringify(debugInfo.status, null, 2)}</pre>
                </div>
                <div class="section">
                    <h3>Health Checks</h3>
                    <pre>${JSON.stringify(debugInfo.healthChecks, null, 2)}</pre>
                </div>
                <div class="section">
                    <h3>Recent Errors</h3>
                    <pre>${JSON.stringify(debugInfo.errors, null, 2)}</pre>
                </div>
                <div class="section">
                    <h3>Configuration</h3>
                    <pre>${JSON.stringify(debugInfo.config, null, 2)}</pre>
                </div>
                <div class="section">
                    <h3>Browser Info</h3>
                    <pre>${JSON.stringify(debugInfo.browser, null, 2)}</pre>
                </div>
            </body>
            </html>
        `);
        debugWindow.document.close();
    }

    /**
     * Collect debug information
     */
    collectDebugInfo() {
        return {
            status: {
                currentMode: this.currentMode,
                userPreference: this.userPreference,
                fallbackActive: this.fallbackActive,
                errorCount: this.errorCount,
                isMobileDevice: this.mobileInterfaceActivator?.isMobileDevice(),
                isInterfaceActivated: this.mobileInterfaceActivator?.isInterfaceActivated(),
                timestamp: new Date().toISOString()
            },
            healthChecks: [
                this.checkMobileUISystemHealth(),
                this.checkMobileScreensHealth(),
                this.checkMobileInteractionHealth()
            ],
            errors: JSON.parse(localStorage.getItem('mobile_ui_errors') || '[]'),
            config: {
                maxErrors: this.maxErrors,
                userAgent: navigator.userAgent,
                touchSupport: 'ontouchstart' in window,
                maxTouchPoints: navigator.maxTouchPoints,
                screenDimensions: `${window.screen.width}x${window.screen.height}`,
                viewportDimensions: `${window.innerWidth}x${window.innerHeight}`
            },
            browser: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            }
        };
    }

    /**
     * Public API methods
     */
    getCurrentMode() {
        return this.currentMode;
    }

    getUserPreference() {
        return this.userPreference;
    }

    isFallbackActive() {
        return this.fallbackActive;
    }

    getErrorCount() {
        return this.errorCount;
    }

    /**
     * Force fallback (for testing)
     */
    forceFallback(reason = 'Manual force fallback') {
        this.triggerFallback(reason);
    }

    /**
     * Reset error count
     */
    resetErrorCount() {
        this.errorCount = 0;
        localStorage.removeItem('mobile_ui_errors');
        console.log('Error count reset');
    }

    /**
     * Destroy toggle system
     */
    destroy() {
        if (this.toggleButton && this.toggleButton.parentNode) {
            this.toggleButton.parentNode.removeChild(this.toggleButton);
        }
        
        // Clear intervals and listeners would go here
        
        console.log('Mobile Interface Toggle destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileInterfaceToggle;
} else if (typeof window !== 'undefined') {
    window.MobileInterfaceToggle = MobileInterfaceToggle;
}