/**
 * Property-Based Tests for Mobile UI Orientation Management
 * Tests the adaptive orientation management system
 * 
 * Feature: mobile-ui, Property 1: Adaptive Orientation Management
 * Validates: Requirements 1.1, 1.2, 1.5, 1.6
 * 
 * HOW TO VERIFY ORIENTATION IS WORKING:
 * 
 * 1. Run the tests:
 *    npx jest tests/mobile-ui-orientation-management.test.js --verbose
 * 
 * 2. All tests should pass, confirming:
 *    - Screen-specific orientation requirements (login/lobby = portrait, game = landscape)
 *    - Orientation lock/unlock behavior works correctly
 *    - Safe area CSS classes are applied properly
 *    - Transition callbacks are triggered on orientation changes
 *    - Missing screen elements are handled gracefully
 *    - Resource cleanup works on destroy
 * 
 * 3. Manual testing in browser:
 *    - Open the app on a mobile device or use browser dev tools mobile simulation
 *    - Navigate between screens and rotate device to see orientation changes
 *    - Check that CSS classes like 'mobile-portrait' and 'mobile-landscape' are applied to <body>
 *    - Verify orientation hints appear when device orientation doesn't match screen requirements
 * 
 * 4. Debug orientation detection:
 *    - Check browser console for orientation-related logs
 *    - Inspect document.body.classList for mobile orientation classes
 *    - Check CSS custom property --current-orientation value
 */

const fc = require('fast-check');

// Setup DOM elements for testing
beforeAll(() => {
    document.body.innerHTML = `
        <div id="loginScreen" class="screen"></div>
        <div id="welcomeScreen" class="screen"></div>
        <div id="gameCreationScreen" class="screen"></div>
        <div id="gameScreen" class="screen"></div>
    `;
});

// Import the OrientationManager after setting up environment
const OrientationManager = require('../netlify-build/js/mobile-ui/OrientationManager.js');

describe('Mobile UI Orientation Management Property Tests', () => {
    let orientationManager;

    beforeEach(() => {
        // Reset DOM state
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Reset window properties
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            value: 375
        });
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            value: 812
        });
        
        // Clear any existing orientation manager
        if (orientationManager) {
            orientationManager.destroy();
        }
        
        orientationManager = new OrientationManager();
    });

    afterEach(() => {
        if (orientationManager) {
            orientationManager.destroy();
        }
    });



    test('Property 1.1: Screen-specific orientation requirements', () => {
        fc.assert(fc.property(
            fc.constantFrom('login', 'lobby', 'game-creation', 'game'),
            
            (screenType) => {
                const requiredOrientation = orientationManager.getRequiredOrientation(screenType);
                
                // Portrait screens: login, lobby
                if (screenType === 'login' || screenType === 'lobby') {
                    expect(requiredOrientation).toBe('portrait');
                }
                
                // Landscape screens: game-creation, game
                if (screenType === 'game-creation' || screenType === 'game') {
                    expect(requiredOrientation).toBe('landscape');
                }
                
                return true;
            }
        ), { numRuns: 100 });
    });



    test('Property 1.3: Orientation lock behavior', () => {
        fc.assert(fc.property(
            fc.constantFrom('portrait', 'landscape'),
            
            (targetOrientation) => {
                // Create a fresh orientation manager for each test
                const testOrientationManager = new OrientationManager();
                
                try {
                    // Lock orientation (synchronous in test environment)
                    testOrientationManager.lockOrientation(targetOrientation);
                    
                    const lockedState = testOrientationManager.getCurrentState();
                    
                    // System should be in locked state
                    expect(lockedState.isLocked).toBe(true);
                    expect(lockedState.targetOrientation).toBe(targetOrientation);
                    
                    // Unlock orientation
                    testOrientationManager.unlockOrientation();
                    
                    const unlockedState = testOrientationManager.getCurrentState();
                    
                    // System should be unlocked
                    expect(unlockedState.isLocked).toBe(false);
                    expect(unlockedState.targetOrientation).toBe('auto');
                    
                    return true;
                } finally {
                    testOrientationManager.destroy();
                }
            }
        ), { numRuns: 20 });
    });

    test('Property 1.4: Safe area integration', () => {
        fc.assert(fc.property(
            fc.constantFrom('portrait', 'landscape'),
            fc.record({
                width: fc.integer({ min: 320, max: 1024 }),
                height: fc.integer({ min: 568, max: 1366 })
            }),
            
            (orientation, dimensions) => {
                // Set up orientation
                Object.defineProperty(window, 'innerWidth', {
                    writable: true,
                    value: orientation === 'landscape' ? 
                        Math.max(dimensions.width, dimensions.height) : 
                        Math.min(dimensions.width, dimensions.height)
                });
                Object.defineProperty(window, 'innerHeight', {
                    writable: true,
                    value: orientation === 'landscape' ? 
                        Math.min(dimensions.width, dimensions.height) : 
                        Math.max(dimensions.width, dimensions.height)
                });
                
                const testOrientationManager = new OrientationManager();
                
                try {
                    // Trigger orientation update
                    testOrientationManager.handleOrientationChange();
                    
                    // Check that orientation classes are applied
                    const actualOrientation = testOrientationManager.getCurrentOrientation();
                    const hasCorrectClass = document.body.classList.contains(`mobile-${actualOrientation}`);
                    expect(hasCorrectClass).toBe(true);
                    
                    // Check that CSS custom property is set
                    const cssOrientation = document.documentElement.style.getPropertyValue('--current-orientation');
                    expect(cssOrientation).toBe(actualOrientation);
                    
                    return true;
                } finally {
                    testOrientationManager.destroy();
                }
            }
        ), { numRuns: 100 });
    });

    test('Property 1.5: Transition callback system', () => {
        fc.assert(fc.property(
            fc.constantFrom('portrait', 'landscape'),
            fc.constantFrom('portrait', 'landscape'),
            
            (fromOrientation, toOrientation) => {
                if (fromOrientation === toOrientation) return true; // Skip same orientation
                
                let callbackCalled = false;
                let callbackData = null;
                
                // Add transition callback
                orientationManager.addTransitionCallback((newOrientation, previousOrientation) => {
                    callbackCalled = true;
                    callbackData = { newOrientation, previousOrientation };
                });
                
                // Simulate orientation change
                orientationManager.currentOrientation = fromOrientation;
                orientationManager.notifyOrientationChange(toOrientation, fromOrientation);
                
                // Callback should have been called with correct data
                expect(callbackCalled).toBe(true);
                expect(callbackData.newOrientation).toBe(toOrientation);
                expect(callbackData.previousOrientation).toBe(fromOrientation);
                
                return true;
            }
        ), { numRuns: 100 });
    });


});

// Additional unit tests for specific edge cases
describe('Mobile UI Orientation Management Unit Tests', () => {
    let orientationManager;

    beforeEach(() => {
        orientationManager = new OrientationManager();
    });

    afterEach(() => {
        if (orientationManager) {
            orientationManager.destroy();
        }
    });

    test('should handle missing screen elements gracefully', () => {
        // Remove all screen elements
        document.querySelectorAll('.screen').forEach(el => el.remove());
        
        const activeScreen = orientationManager.getActiveScreen();
        expect(activeScreen).toBeNull();
    });

    test('should handle orientation change events', (done) => {
        const timeout = setTimeout(() => {
            done('Orientation change callback was not called within timeout');
        }, 1000);
        
        orientationManager.addTransitionCallback((newOrientation, previousOrientation) => {
            clearTimeout(timeout);
            expect(newOrientation).toBeDefined();
            expect(previousOrientation).toBeDefined();
            done();
        });
        
        // Simulate orientation change by directly calling the notification method
        orientationManager.notifyOrientationChange('landscape', 'portrait');
    });

    test('should clean up resources on destroy', () => {
        const initialCallbackCount = orientationManager.transitionCallbacks.size;
        
        orientationManager.addTransitionCallback(() => {});
        expect(orientationManager.transitionCallbacks.size).toBe(initialCallbackCount + 1);
        
        orientationManager.destroy();
        expect(orientationManager.transitionCallbacks.size).toBe(0);
    });

    test('should handle orientation lock and unlock', async () => {
        const testManager = new OrientationManager();
        
        try {
            // Test lock
            await testManager.lockOrientation('landscape');
            const lockedState = testManager.getCurrentState();
            expect(lockedState.isLocked).toBe(true);
            expect(lockedState.targetOrientation).toBe('landscape');
            
            // Test unlock
            await testManager.unlockOrientation();
            const unlockedState = testManager.getCurrentState();
            expect(unlockedState.isLocked).toBe(false);
            expect(unlockedState.targetOrientation).toBe('auto');
        } finally {
            testManager.destroy();
        }
    });
});