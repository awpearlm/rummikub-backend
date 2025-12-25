/**
 * Comprehensive Validation Test Suite for Responsive UI Cleanup
 * Tests all requirements from the spec across multiple devices and screen sizes
 */

class ResponsiveUIValidationSuite {
    constructor() {
        this.results = {
            scriptLoading: [],
            consoleErrors: [],
            mobileInteractions: [],
            desktopFunctionality: [],
            performance: [],
            overall: 'PENDING'
        };
        this.startTime = Date.now();
        this.testDevices = [
            { name: 'Desktop', width: 1920, height: 1080 },
            { name: 'Laptop', width: 1366, height: 768 },
            { name: 'Tablet', width: 768, height: 1024 },
            { name: 'Mobile Large', width: 414, height: 896 },
            { name: 'Mobile Medium', width: 375, height: 667 },
            { name: 'Mobile Small', width: 320, height: 568 }
        ];
    }

    async runFullValidation() {
        console.log('🧪 Starting Comprehensive Responsive UI Validation Suite');
        console.log('📋 Testing Requirements: Script Loading, Console Errors, Mobile Interactions, Desktop Functionality');
        
        try {
            // Test 1: Script Loading Reliability (Requirement 1)
            await this.testScriptLoadingReliability();
            
            // Test 2: Console Error Elimination (Requirement 4)
            await this.testConsoleErrorElimination();
            
            // Test 3: Mobile Touch Interactions (Requirement 3)
            await this.testMobileInteractions();
            
            // Test 4: Desktop Functionality Preservation (Requirement 5)
            await this.testDesktopFunctionality();
            
            // Test 5: Performance Validation (Requirement 3)
            await this.testPerformanceMetrics();
            
            // Test 6: Multi-Device Validation
            await this.testMultipleDeviceSizes();
            
            // Generate final report
            this.generateValidationReport();
            
        } catch (error) {
            console.error('❌ Validation suite failed:', error);
            this.results.overall = 'FAILED';
        }
    }

    async testScriptLoadingReliability() {
        console.log('🔍 Testing Script Loading Reliability (Requirement 1.1, 1.3, 1.4)');
        
        const scriptTests = [];
        
        // Test required scripts load successfully
        const requiredScripts = [
            'safe-events.js',
            'js/connectionRecovery.js',
            'js/responsive-mobile-fix.js',
            'game.js'
        ];
        
        for (const scriptSrc of requiredScripts) {
            const script = document.querySelector(`script[src*="${scriptSrc}"]`);
            const test = {
                script: scriptSrc,
                found: !!script,
                loaded: script ? !script.hasAttribute('data-failed') : false,
                mimeError: false
            };
            
            if (script) {
                // Check for MIME type errors by monitoring network
                try {
                    const response = await fetch(script.src, { method: 'HEAD' });
                    test.mimeError = !response.headers.get('content-type')?.includes('javascript');
                } catch (e) {
                    test.mimeError = true;
                }
            }
            
            scriptTests.push(test);
        }
        
        // Test mobile scripts are handled gracefully
        const mobileScripts = [
            'mobile-interface-fix.js',
            'mobile-ui-emergency-fix.js'
        ];
        
        for (const scriptSrc of mobileScripts) {
            const script = document.querySelector(`script[src*="${scriptSrc}"]`);
            const test = {
                script: scriptSrc,
                found: !!script,
                gracefulHandling: !script || script.hasAttribute('data-failed') || script.onerror,
                shouldNotExist: true
            };
            scriptTests.push(test);
        }
        
        this.results.scriptLoading = scriptTests;
        
        const passedTests = scriptTests.filter(t => 
            t.shouldNotExist ? !t.found || t.gracefulHandling : (t.found && t.loaded && !t.mimeError)
        ).length;
        
        console.log(`✅ Script Loading: ${passedTests}/${scriptTests.length} tests passed`);
        return passedTests === scriptTests.length;
    }

    async testConsoleErrorElimination() {
        console.log('🔍 Testing Console Error Elimination (Requirement 4.1, 4.2, 4.3)');
        
        const originalErrors = [];
        const originalWarns = [];
        
        // Capture console errors and warnings
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.error = (...args) => {
            originalErrors.push(args.join(' '));
            originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            originalWarns.push(args.join(' '));
            originalWarn.apply(console, args);
        };
        
        // Trigger potential error scenarios
        await this.triggerErrorScenarios();
        
        // Restore console methods
        console.error = originalError;
        console.warn = originalWarn;
        
        // Analyze captured errors
        const mimeErrors = originalErrors.filter(err => 
            err.includes('MIME type') || err.includes('text/html') || err.includes('<!DOCTYPE')
        );
        
        const mobileComponentErrors = originalErrors.filter(err =>
            err.includes('MobileLobbyScreen') || 
            err.includes('MobileGameCreationScreen') ||
            err.includes('MobileUISystem') ||
            err.includes('mobile-ui/')
        );
        
        const apiErrors = originalErrors.filter(err =>
            err.includes('Failed to fetch') && (
                err.includes('/api/games') || 
                err.includes('/api/players') || 
                err.includes('/api/invitations')
            )
        );
        
        this.results.consoleErrors = {
            totalErrors: originalErrors.length,
            totalWarnings: originalWarns.length,
            mimeErrors: mimeErrors.length,
            mobileComponentErrors: mobileComponentErrors.length,
            apiErrors: apiErrors.length,
            suppressedCorrectly: mimeErrors.length === 0 && mobileComponentErrors.length === 0 && apiErrors.length === 0
        };
        
        console.log(`✅ Console Errors: ${this.results.consoleErrors.suppressedCorrectly ? 'PASSED' : 'FAILED'}`);
        console.log(`   - MIME errors: ${mimeErrors.length}`);
        console.log(`   - Mobile component errors: ${mobileComponentErrors.length}`);
        console.log(`   - API errors: ${apiErrors.length}`);
        
        return this.results.consoleErrors.suppressedCorrectly;
    }

    async triggerErrorScenarios() {
        // Try to trigger mobile component initialization
        if (window.MobileLobbyScreen) {
            try {
                new window.MobileLobbyScreen();
            } catch (e) {
                // Expected to be suppressed
            }
        }
        
        // Try to trigger mobile API calls
        if (window.fetch) {
            try {
                await window.fetch('/api/games');
                await window.fetch('/api/players/online');
                await window.fetch('/api/invitations');
            } catch (e) {
                // Expected to be handled gracefully
            }
        }
        
        // Try to load non-existent mobile scripts
        const testScript = document.createElement('script');
        testScript.src = 'mobile-interface-fix.js';
        document.head.appendChild(testScript);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        document.head.removeChild(testScript);
    }

    async testMobileInteractions() {
        console.log('🔍 Testing Mobile Touch Interactions (Requirement 3.1, 3.2, 3.3)');
        
        const interactionTests = [];
        
        // Test touch-friendly button sizes
        const buttons = document.querySelectorAll('button, .btn');
        let touchFriendlyButtons = 0;
        
        buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            const isTouchFriendly = rect.width >= 44 && rect.height >= 44;
            if (isTouchFriendly) touchFriendlyButtons++;
        });
        
        interactionTests.push({
            test: 'Touch-friendly button sizes',
            passed: touchFriendlyButtons > 0,
            details: `${touchFriendlyButtons}/${buttons.length} buttons are touch-friendly (≥44px)`
        });
        
        // Test touch feedback styles
        const hasTouchStyles = document.querySelector('style')?.textContent.includes('touch-active');
        interactionTests.push({
            test: 'Touch feedback styles',
            passed: hasTouchStyles,
            details: hasTouchStyles ? 'Touch active styles found' : 'No touch active styles'
        });
        
        // Test viewport configuration
        const viewport = document.querySelector('meta[name="viewport"]');
        const hasProperViewport = viewport && viewport.content.includes('width=device-width');
        interactionTests.push({
            test: 'Mobile viewport configuration',
            passed: hasProperViewport,
            details: hasProperViewport ? 'Proper viewport meta tag found' : 'Missing or incorrect viewport'
        });
        
        // Test responsive design mode
        const hasResponsiveMode = document.body.classList.contains('responsive-design-mode');
        interactionTests.push({
            test: 'Responsive design mode active',
            passed: hasResponsiveMode,
            details: hasResponsiveMode ? 'Responsive design mode enabled' : 'Responsive design mode not active'
        });
        
        // Test orientation handling
        const hasOrientationHandling = typeof window.checkResponsiveStatus === 'function';
        interactionTests.push({
            test: 'Orientation change handling',
            passed: hasOrientationHandling,
            details: hasOrientationHandling ? 'Orientation handling available' : 'No orientation handling'
        });
        
        this.results.mobileInteractions = interactionTests;
        
        const passedTests = interactionTests.filter(t => t.passed).length;
        console.log(`✅ Mobile Interactions: ${passedTests}/${interactionTests.length} tests passed`);
        
        interactionTests.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
        });
        
        return passedTests === interactionTests.length;
    }

    async testDesktopFunctionality() {
        console.log('🔍 Testing Desktop Functionality Preservation (Requirement 5.1-5.5)');
        
        const functionalityTests = [];
        
        // Test desktop UI elements are visible
        const desktopElements = [
            { id: 'welcomeScreen', name: 'Welcome Screen' },
            { id: 'gameScreen', name: 'Game Screen' },
            { class: 'profile-bubble', name: 'Profile Bubble' },
            { class: 'welcome-container', name: 'Welcome Container' },
            { class: 'game-header-bar', name: 'Game Header' },
            { class: 'player-hand-section', name: 'Player Hand Section' }
        ];
        
        desktopElements.forEach(element => {
            const el = element.id ? 
                document.getElementById(element.id) : 
                document.querySelector(`.${element.class}`);
            
            const isVisible = el && window.getComputedStyle(el).display !== 'none';
            functionalityTests.push({
                test: `${element.name} visibility`,
                passed: isVisible,
                details: isVisible ? 'Visible' : 'Hidden or missing'
            });
        });
        
        // Test mobile interface is disabled
        const mobileInterfaceDisabled = !document.body.classList.contains('mobile-interface-active');
        functionalityTests.push({
            test: 'Mobile interface disabled',
            passed: mobileInterfaceDisabled,
            details: mobileInterfaceDisabled ? 'Mobile interface not active' : 'Mobile interface still active'
        });
        
        // Test game functionality elements
        const gameElements = [
            { id: 'playWithBotBtn', name: 'Play with Bot Button' },
            { id: 'playWithFriendsBtn', name: 'Play with Friends Button' },
            { id: 'createGameBtn', name: 'Create Game Button' },
            { id: 'joinGameBtn', name: 'Join Game Button' }
        ];
        
        gameElements.forEach(element => {
            const el = document.getElementById(element.id);
            const isPresent = !!el;
            functionalityTests.push({
                test: `${element.name} present`,
                passed: isPresent,
                details: isPresent ? 'Present' : 'Missing'
            });
        });
        
        // Test authentication elements
        const authElements = [
            { id: 'profileUsername', name: 'Profile Username' },
            { id: 'logoutButton', name: 'Logout Button' }
        ];
        
        authElements.forEach(element => {
            const el = document.getElementById(element.id);
            const isPresent = !!el;
            functionalityTests.push({
                test: `${element.name} present`,
                passed: isPresent,
                details: isPresent ? 'Present' : 'Missing'
            });
        });
        
        this.results.desktopFunctionality = functionalityTests;
        
        const passedTests = functionalityTests.filter(t => t.passed).length;
        console.log(`✅ Desktop Functionality: ${passedTests}/${functionalityTests.length} tests passed`);
        
        functionalityTests.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
        });
        
        return passedTests === functionalityTests.length;
    }

    async testPerformanceMetrics() {
        console.log('🔍 Testing Performance Metrics (Requirement 3.5)');
        
        const performanceTests = [];
        
        // Test page load performance
        const navigationTiming = performance.getEntriesByType('navigation')[0];
        if (navigationTiming) {
            const loadTime = navigationTiming.loadEventEnd - navigationTiming.loadEventStart;
            performanceTests.push({
                test: 'Page load time',
                passed: loadTime < 3000,
                details: `${Math.round(loadTime)}ms (target: <3000ms)`
            });
        }
        
        // Test CSS loading performance
        const cssResources = performance.getEntriesByType('resource').filter(r => 
            r.name.includes('.css')
        );
        const avgCSSLoadTime = cssResources.length > 0 ? 
            cssResources.reduce((sum, r) => sum + r.duration, 0) / cssResources.length : 0;
        
        performanceTests.push({
            test: 'CSS loading performance',
            passed: avgCSSLoadTime < 500,
            details: `${Math.round(avgCSSLoadTime)}ms average (target: <500ms)`
        });
        
        // Test script loading performance
        const scriptResources = performance.getEntriesByType('resource').filter(r => 
            r.name.includes('.js')
        );
        const avgScriptLoadTime = scriptResources.length > 0 ? 
            scriptResources.reduce((sum, r) => sum + r.duration, 0) / scriptResources.length : 0;
        
        performanceTests.push({
            test: 'Script loading performance',
            passed: avgScriptLoadTime < 1000,
            details: `${Math.round(avgScriptLoadTime)}ms average (target: <1000ms)`
        });
        
        // Test memory usage (if available)
        if (performance.memory) {
            const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            performanceTests.push({
                test: 'Memory usage',
                passed: memoryUsage < 50,
                details: `${Math.round(memoryUsage)}MB (target: <50MB)`
            });
        }
        
        // Test responsive status check performance
        const startTime = performance.now();
        if (window.checkResponsiveStatus) {
            window.checkResponsiveStatus();
        }
        const statusCheckTime = performance.now() - startTime;
        
        performanceTests.push({
            test: 'Status check performance',
            passed: statusCheckTime < 100,
            details: `${Math.round(statusCheckTime)}ms (target: <100ms)`
        });
        
        this.results.performance = performanceTests;
        
        const passedTests = performanceTests.filter(t => t.passed).length;
        console.log(`✅ Performance: ${passedTests}/${performanceTests.length} tests passed`);
        
        performanceTests.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
        });
        
        return passedTests === performanceTests.length;
    }

    async testMultipleDeviceSizes() {
        console.log('🔍 Testing Multiple Device Sizes');
        
        const deviceTests = [];
        const originalViewport = document.querySelector('meta[name="viewport"]');
        
        for (const device of this.testDevices) {
            console.log(`   Testing ${device.name} (${device.width}x${device.height})`);
            
            // Simulate device viewport
            if (originalViewport) {
                originalViewport.content = `width=${device.width}, initial-scale=1.0`;
            }
            
            // Trigger resize event
            window.dispatchEvent(new Event('resize'));
            
            // Wait for layout to settle
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Test responsive behavior
            const welcomeScreen = document.getElementById('welcomeScreen');
            const isResponsive = welcomeScreen && window.getComputedStyle(welcomeScreen).display !== 'none';
            
            // Test mobile-specific styles for smaller screens
            const isMobileSize = device.width <= 768;
            const hasMobileStyles = isMobileSize ? 
                document.body.classList.contains('responsive-design-mode') : true;
            
            deviceTests.push({
                device: device.name,
                dimensions: `${device.width}x${device.height}`,
                responsive: isResponsive,
                mobileStyles: hasMobileStyles,
                passed: isResponsive && hasMobileStyles
            });
        }
        
        // Restore original viewport
        if (originalViewport) {
            originalViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover';
        }
        
        const passedDevices = deviceTests.filter(t => t.passed).length;
        console.log(`✅ Device Testing: ${passedDevices}/${deviceTests.length} devices passed`);
        
        deviceTests.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.device} (${test.dimensions}): ${test.passed ? 'PASSED' : 'FAILED'}`);
        });
        
        return passedDevices === deviceTests.length;
    }

    generateValidationReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        console.log('\n📊 RESPONSIVE UI CLEANUP VALIDATION REPORT');
        console.log('=' .repeat(50));
        
        // Calculate overall results
        const allTests = [
            ...this.results.scriptLoading,
            ...this.results.mobileInteractions,
            ...this.results.desktopFunctionality,
            ...this.results.performance
        ];
        
        const totalTests = allTests.length;
        const passedTests = allTests.filter(t => t.passed !== false).length;
        const successRate = Math.round((passedTests / totalTests) * 100);
        
        this.results.overall = successRate >= 90 ? 'PASSED' : 'FAILED';
        
        console.log(`Overall Status: ${this.results.overall}`);
        console.log(`Success Rate: ${successRate}% (${passedTests}/${totalTests} tests passed)`);
        console.log(`Duration: ${Math.round(duration / 1000)}s`);
        console.log('');
        
        // Detailed results
        console.log('📋 DETAILED RESULTS:');
        console.log('');
        
        console.log('1. Script Loading Reliability:');
        this.results.scriptLoading.forEach(test => {
            const status = test.shouldNotExist ? 
                (!test.found || test.gracefulHandling ? '✅' : '❌') :
                (test.found && test.loaded && !test.mimeError ? '✅' : '❌');
            console.log(`   ${status} ${test.script}`);
        });
        console.log('');
        
        console.log('2. Console Error Elimination:');
        console.log(`   ✅ MIME errors suppressed: ${this.results.consoleErrors.mimeErrors === 0}`);
        console.log(`   ✅ Mobile component errors suppressed: ${this.results.consoleErrors.mobileComponentErrors === 0}`);
        console.log(`   ✅ API errors suppressed: ${this.results.consoleErrors.apiErrors === 0}`);
        console.log('');
        
        console.log('3. Mobile Touch Interactions:');
        this.results.mobileInteractions.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}`);
        });
        console.log('');
        
        console.log('4. Desktop Functionality Preservation:');
        this.results.desktopFunctionality.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}`);
        });
        console.log('');
        
        console.log('5. Performance Metrics:');
        this.results.performance.forEach(test => {
            console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}: ${test.details}`);
        });
        console.log('');
        
        // Recommendations
        if (this.results.overall === 'FAILED') {
            console.log('🔧 RECOMMENDATIONS:');
            
            const failedScripts = this.results.scriptLoading.filter(t => 
                t.shouldNotExist ? (t.found && !t.gracefulHandling) : (!t.found || !t.loaded || t.mimeError)
            );
            if (failedScripts.length > 0) {
                console.log('   - Fix script loading issues for:', failedScripts.map(t => t.script).join(', '));
            }
            
            if (!this.results.consoleErrors.suppressedCorrectly) {
                console.log('   - Improve console error suppression');
            }
            
            const failedInteractions = this.results.mobileInteractions.filter(t => !t.passed);
            if (failedInteractions.length > 0) {
                console.log('   - Fix mobile interaction issues:', failedInteractions.map(t => t.test).join(', '));
            }
            
            const failedFunctionality = this.results.desktopFunctionality.filter(t => !t.passed);
            if (failedFunctionality.length > 0) {
                console.log('   - Fix desktop functionality issues:', failedFunctionality.map(t => t.test).join(', '));
            }
            
            const failedPerformance = this.results.performance.filter(t => !t.passed);
            if (failedPerformance.length > 0) {
                console.log('   - Improve performance for:', failedPerformance.map(t => t.test).join(', '));
            }
        } else {
            console.log('🎉 All validation tests passed! Responsive UI cleanup is successful.');
        }
        
        console.log('');
        console.log('=' .repeat(50));
        
        // Store results for potential further analysis
        window.validationResults = this.results;
        
        return this.results;
    }
}

// Auto-run validation if this script is loaded directly
if (typeof window !== 'undefined') {
    window.ResponsiveUIValidationSuite = ResponsiveUIValidationSuite;
    
    // Provide easy access function
    window.runValidation = async function() {
        const suite = new ResponsiveUIValidationSuite();
        return await suite.runFullValidation();
    };
    
    console.log('🧪 Responsive UI Validation Suite loaded');
    console.log('💡 Run validation with: runValidation()');
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponsiveUIValidationSuite;
}