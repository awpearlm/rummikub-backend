/**
 * Mobile Interface Fix and Diagnostic Tool
 * This script provides comprehensive fixes and diagnostics for mobile interface issues
 */

class MobileInterfaceFix {
    constructor() {
        this.fixes = [];
        this.diagnostics = {};
    }

    /**
     * Run comprehensive diagnostic and apply fixes
     */
    async runComprehensiveFix() {
        console.log('🔧 Starting comprehensive mobile interface fix...');
        
        // Step 1: Diagnose current state
        await this.diagnoseCurrentState();
        
        // Step 2: Apply fixes based on diagnosis
        await this.applyFixes();
        
        // Step 3: Verify fixes
        await this.verifyFixes();
        
        // Step 4: Report results
        this.reportResults();
        
        return this.diagnostics;
    }

    /**
     * Diagnose current mobile interface state
     */
    async diagnoseCurrentState() {
        console.log('🔍 Diagnosing mobile interface state...');
        
        this.diagnostics = {
            timestamp: new Date().toISOString(),
            mobileDetection: this.diagnoseMobileDetection(),
            interfaceActivation: this.diagnoseInterfaceActivation(),
            apiEndpoints: await this.diagnoseAPIEndpoints(),
            cssLoading: this.diagnoseCSSLoading(),
            jsLoading: this.diagnoseJSLoading(),
            domElements: this.diagnoseDOMElements(),
            debugMode: this.diagnoseDebugMode()
        };
    }

    /**
     * Diagnose mobile device detection
     */
    diagnoseMobileDetection() {
        const userAgent = navigator.userAgent;
        const mobileUserAgents = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const userAgentMatch = mobileUserAgents.test(userAgent);
        const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const screenWidth = window.screen.width;
        const viewportWidth = window.innerWidth;
        const isMobileViewport = viewportWidth <= 768;
        
        const isMobile = userAgentMatch || hasTouchSupport || isMobileViewport;
        
        return {
            userAgent,
            userAgentMatch,
            hasTouchSupport,
            screenWidth,
            viewportWidth,
            isMobileViewport,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            devicePixelRatio: window.devicePixelRatio,
            isMobile,
            status: isMobile ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Diagnose interface activation
     */
    diagnoseInterfaceActivation() {
        const bodyClasses = Array.from(document.body.classList);
        const htmlClasses = Array.from(document.documentElement.classList);
        const mobileScreens = document.querySelectorAll('.mobile-screen, .mobile-lobby-screen, .mobile-fallback-interface');
        const desktopHidden = document.querySelectorAll('.desktop-hidden-for-mobile');
        const mobileActivator = window.mobileInterfaceActivator;
        
        const hasMobileClasses = bodyClasses.includes('mobile-interface-active') || 
                                bodyClasses.includes('mobile-device');
        const hasMobileScreens = mobileScreens.length > 0;
        const hasDesktopHidden = desktopHidden.length > 0;
        
        let visibleMobileScreens = 0;
        mobileScreens.forEach(screen => {
            const styles = window.getComputedStyle(screen);
            if (styles.display !== 'none' && styles.visibility !== 'hidden') {
                visibleMobileScreens++;
            }
        });
        
        return {
            bodyClasses,
            htmlClasses,
            hasMobileClasses,
            mobileScreensCount: mobileScreens.length,
            visibleMobileScreens,
            desktopHiddenCount: desktopHidden.length,
            hasMobileActivator: !!mobileActivator,
            activatorStatus: mobileActivator ? {
                isMobile: mobileActivator.isMobile,
                isActivated: mobileActivator.isActivated,
                hasMobileUISystem: !!mobileActivator.mobileUISystem
            } : null,
            status: (hasMobileClasses && hasMobileScreens && visibleMobileScreens > 0) ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Diagnose API endpoints
     */
    async diagnoseAPIEndpoints() {
        const endpoints = ['/api/games', '/api/players/online', '/api/invitations'];
        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token') || 'test-token'}`,
                        'Accept': 'application/json'
                    }
                });
                
                const contentType = response.headers.get('content-type') || '';
                const isJSON = contentType.includes('application/json');
                const isHTML = contentType.includes('text/html');
                
                results[endpoint] = {
                    status: response.status,
                    ok: response.ok,
                    contentType,
                    isJSON,
                    isHTML,
                    error: isHTML ? 'Server returned HTML instead of JSON' : null,
                    diagnosis: response.ok && isJSON ? 'PASS' : 'FAIL'
                };
                
            } catch (error) {
                results[endpoint] = {
                    status: 'ERROR',
                    error: error.message,
                    diagnosis: 'FAIL'
                };
            }
        }
        
        const allPassing = Object.values(results).every(r => r.diagnosis === 'PASS');
        
        return {
            endpoints: results,
            status: allPassing ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Diagnose CSS loading
     */
    diagnoseCSSLoading() {
        const requiredCSS = [
            'mobile-foundation.css',
            'mobile-design-system.css',
            'mobile-lobby.css',
            'mobile-login.css'
        ];
        
        const loadedCSS = Array.from(document.styleSheets).map(sheet => {
            try {
                return sheet.href ? sheet.href.split('/').pop() : 'inline';
            } catch (e) {
                return 'unknown';
            }
        });
        
        const missingCSS = requiredCSS.filter(css => 
            !loadedCSS.some(loaded => loaded.includes(css.replace('.css', '')))
        );
        
        return {
            requiredCSS,
            loadedCSS,
            missingCSS,
            status: missingCSS.length === 0 ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Diagnose JavaScript loading
     */
    diagnoseJSLoading() {
        const requiredClasses = [
            'MobileInterfaceActivator',
            'MobileLobbyScreen',
            'MobileLoginScreen',
            'MobileUISystem'
        ];
        
        const loadedClasses = requiredClasses.filter(className => 
            typeof window[className] !== 'undefined'
        );
        
        const missingClasses = requiredClasses.filter(className => 
            typeof window[className] === 'undefined'
        );
        
        return {
            requiredClasses,
            loadedClasses,
            missingClasses,
            status: missingClasses.length === 0 ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Diagnose DOM elements
     */
    diagnoseDOMElements() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const gameScreen = document.getElementById('gameScreen');
        const mobileScreens = document.querySelectorAll('.mobile-screen');
        
        return {
            hasWelcomeScreen: !!welcomeScreen,
            hasGameScreen: !!gameScreen,
            welcomeScreenVisible: welcomeScreen ? window.getComputedStyle(welcomeScreen).display !== 'none' : false,
            gameScreenVisible: gameScreen ? window.getComputedStyle(gameScreen).display !== 'none' : false,
            mobileScreensCount: mobileScreens.length,
            status: mobileScreens.length > 0 ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Diagnose debug mode
     */
    diagnoseDebugMode() {
        const debugOverlay = document.getElementById('mobile-debug-overlay');
        const debugButtons = document.querySelectorAll('[id*="debug"], [id*="test"]');
        
        return {
            hasDebugOverlay: !!debugOverlay,
            debugOverlayVisible: debugOverlay ? window.getComputedStyle(debugOverlay).display !== 'none' : false,
            debugButtonsCount: debugButtons.length,
            debugButtonsVisible: Array.from(debugButtons).filter(btn => 
                window.getComputedStyle(btn).display !== 'none'
            ).length,
            status: 'INFO' // Debug mode status is informational
        };
    }

    /**
     * Apply fixes based on diagnosis
     */
    async applyFixes() {
        console.log('🔧 Applying fixes...');
        
        // Fix 1: Force mobile interface activation if needed
        if (this.diagnostics.interfaceActivation.status === 'FAIL') {
            this.applyMobileInterfaceActivationFix();
        }
        
        // Fix 2: Handle API endpoint failures
        if (this.diagnostics.apiEndpoints.status === 'FAIL') {
            this.applyAPIEndpointFix();
        }
        
        // Fix 3: Ensure proper CSS loading
        if (this.diagnostics.cssLoading.status === 'FAIL') {
            this.applyCSSLoadingFix();
        }
        
        // Fix 4: Hide debug elements
        if (this.diagnostics.debugMode.debugButtonsVisible > 0) {
            this.applyDebugHidingFix();
        }
        
        // Fix 5: Ensure mobile screens are visible
        this.applyMobileScreenVisibilityFix();
    }

    /**
     * Apply mobile interface activation fix
     */
    applyMobileInterfaceActivationFix() {
        console.log('🔧 Applying mobile interface activation fix...');
        
        // Force mobile detection
        if (window.mobileInterfaceActivator) {
            window.mobileInterfaceActivator.forceMobileActivation();
            this.fixes.push('Forced mobile interface activation');
        } else {
            // Create and initialize mobile interface activator
            if (typeof MobileInterfaceActivator !== 'undefined') {
                window.mobileInterfaceActivator = new MobileInterfaceActivator();
                window.mobileInterfaceActivator.forceActivation();
                this.fixes.push('Created and activated mobile interface');
            } else {
                this.fixes.push('ERROR: MobileInterfaceActivator class not available');
            }
        }
    }

    /**
     * Apply API endpoint fix
     */
    applyAPIEndpointFix() {
        console.log('🔧 Applying API endpoint fix...');
        
        // Enable demo mode for mobile lobby if it exists
        const mobileLobbyScreen = window.mobileLobbyScreen || 
                                 (window.mobileUISystem && window.mobileUISystem.getComponent('mobileLobbyScreen'));
        
        if (mobileLobbyScreen && typeof mobileLobbyScreen.loadMockData === 'function') {
            mobileLobbyScreen.loadMockData();
            this.fixes.push('Enabled demo mode with mock data');
        } else {
            this.fixes.push('WARNING: Could not enable demo mode - mobile lobby not available');
        }
    }

    /**
     * Apply CSS loading fix
     */
    applyCSSLoadingFix() {
        console.log('🔧 Applying CSS loading fix...');
        
        // Inject critical mobile CSS if missing
        const criticalCSS = `
            .mobile-interface-active .desktop-hidden-for-mobile {
                display: none !important;
                visibility: hidden !important;
            }
            
            .mobile-screen, .mobile-lobby-screen {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                display: flex !important;
                flex-direction: column;
            }
            
            .mobile-lobby-screen {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'mobile-interface-critical-css';
        styleElement.textContent = criticalCSS;
        document.head.appendChild(styleElement);
        
        this.fixes.push('Injected critical mobile CSS');
    }

    /**
     * Apply debug hiding fix
     */
    applyDebugHidingFix() {
        console.log('🔧 Applying debug hiding fix...');
        
        const debugElements = document.querySelectorAll('[id*="debug"], [id*="test"], .mobile-debug-overlay');
        debugElements.forEach(element => {
            element.style.display = 'none';
        });
        
        this.fixes.push(`Hidden ${debugElements.length} debug elements`);
    }

    /**
     * Apply mobile screen visibility fix
     */
    applyMobileScreenVisibilityFix() {
        console.log('🔧 Applying mobile screen visibility fix...');
        
        // Ensure mobile screens are visible
        const mobileScreens = document.querySelectorAll('.mobile-screen, .mobile-lobby-screen, .mobile-fallback-interface');
        let fixedScreens = 0;
        
        mobileScreens.forEach(screen => {
            const styles = window.getComputedStyle(screen);
            if (styles.display === 'none' || styles.visibility === 'hidden') {
                screen.style.display = 'flex';
                screen.style.visibility = 'visible';
                screen.style.opacity = '1';
                fixedScreens++;
            }
        });
        
        if (fixedScreens > 0) {
            this.fixes.push(`Made ${fixedScreens} mobile screens visible`);
        }
        
        // Hide desktop elements
        const desktopElements = document.querySelectorAll('#welcomeScreen, #gameScreen, .welcome-container');
        let hiddenElements = 0;
        
        desktopElements.forEach(element => {
            if (window.getComputedStyle(element).display !== 'none') {
                element.style.display = 'none';
                element.classList.add('desktop-hidden-for-mobile');
                hiddenElements++;
            }
        });
        
        if (hiddenElements > 0) {
            this.fixes.push(`Hidden ${hiddenElements} desktop elements`);
        }
        
        // Add mobile classes to body
        document.body.classList.add('mobile-interface-active', 'mobile-device');
        this.fixes.push('Added mobile classes to body');
    }

    /**
     * Verify fixes
     */
    async verifyFixes() {
        console.log('✅ Verifying fixes...');
        
        // Re-run diagnostics to verify fixes
        const newDiagnostics = {
            mobileDetection: this.diagnoseMobileDetection(),
            interfaceActivation: this.diagnoseInterfaceActivation(),
            domElements: this.diagnoseDOMElements()
        };
        
        this.diagnostics.verification = newDiagnostics;
    }

    /**
     * Report results
     */
    reportResults() {
        console.log('📊 Mobile Interface Fix Results:');
        console.log('================================');
        
        console.log('🔍 Diagnostics:');
        Object.entries(this.diagnostics).forEach(([key, value]) => {
            if (key !== 'verification' && value.status) {
                const icon = value.status === 'PASS' ? '✅' : value.status === 'FAIL' ? '❌' : 'ℹ️';
                console.log(`  ${icon} ${key}: ${value.status}`);
            }
        });
        
        console.log('\n🔧 Applied Fixes:');
        this.fixes.forEach(fix => {
            console.log(`  ✓ ${fix}`);
        });
        
        if (this.diagnostics.verification) {
            console.log('\n✅ Verification Results:');
            Object.entries(this.diagnostics.verification).forEach(([key, value]) => {
                if (value.status) {
                    const icon = value.status === 'PASS' ? '✅' : '❌';
                    console.log(`  ${icon} ${key}: ${value.status}`);
                }
            });
        }
        
        console.log('\n📱 Mobile Interface Status:', 
            this.diagnostics.verification?.interfaceActivation?.status === 'PASS' ? 
            '✅ WORKING' : '❌ NEEDS ATTENTION');
    }

    /**
     * Create a visual status display
     */
    createVisualStatusDisplay() {
        const statusDisplay = document.createElement('div');
        statusDisplay.id = 'mobile-interface-status';
        statusDisplay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-width: 300px;
            backdrop-filter: blur(10px);
        `;
        
        const status = this.diagnostics.verification?.interfaceActivation?.status === 'PASS' ? 
                      '✅ WORKING' : '❌ NEEDS ATTENTION';
        
        statusDisplay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px;">📱 Mobile Interface Status</div>
            <div style="margin-bottom: 5px;">Status: ${status}</div>
            <div style="margin-bottom: 5px;">Fixes Applied: ${this.fixes.length}</div>
            <div style="font-size: 10px; opacity: 0.7;">Click to hide</div>
        `;
        
        statusDisplay.addEventListener('click', () => {
            statusDisplay.remove();
        });
        
        document.body.appendChild(statusDisplay);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (statusDisplay.parentNode) {
                statusDisplay.remove();
            }
        }, 10000);
    }
}

// Global function to run the fix
window.fixMobileInterface = async function() {
    const fixer = new MobileInterfaceFix();
    const results = await fixer.runComprehensiveFix();
    fixer.createVisualStatusDisplay();
    return results;
};

// Auto-run fix if mobile device is detected and interface is not working
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        const fixer = new MobileInterfaceFix();
        const diagnostics = await fixer.diagnoseCurrentState();
        
        // Auto-fix if mobile device but interface not activated
        if (diagnostics.mobileDetection.isMobile && 
            diagnostics.interfaceActivation.status === 'FAIL') {
            console.log('🔧 Auto-fixing mobile interface...');
            await fixer.runComprehensiveFix();
            fixer.createVisualStatusDisplay();
        }
    }, 2000);
});

console.log('🔧 Mobile Interface Fix loaded. Run fixMobileInterface() to diagnose and fix issues.');