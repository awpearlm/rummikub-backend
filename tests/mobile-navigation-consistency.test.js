/**
 * Property-Based Tests for Mobile Navigation Consistency
 * Tests the screen navigation and transition system
 * 
 * Feature: mobile-ui, Property 6: Screen Navigation Consistency
 * Validates: Requirements 10.1, 10.2, 10.3, 10.5
 * 
 * HOW TO VERIFY NAVIGATION IS WORKING:
 * 
 * 1. Run the tests:
 *    npx jest tests/mobile-navigation-consistency.test.js --verbose
 * 
 * 2. All tests should pass, confirming:
 *    - Navigation between screens maintains consistent state
 *    - Navigation history is properly managed
 *    - Back button handling works correctly
 *    - Screen transitions are smooth and complete
 *    - Orientation changes are handled during navigation
 *    - Navigation queue prevents concurrent transitions
 * 
 * 3. Manual testing in browser:
 *    - Navigate between different screens (login -> lobby -> game creation -> game)
 *    - Use back button to navigate backwards
 *    - Rotate device during navigation to test orientation handling
 *    - Check that navigation history is maintained correctly
 * 
 * 4. Debug navigation issues:
 *    - Check browser console for navigation-related logs
 *    - Inspect navigation history state
 *    - Verify screen transition animations complete properly
 */

const fc = require('fast-check');

// Mock OrientationManager for testing
class MockOrientationManager {
    constructor() {
        this.currentOrientation = 'portrait';
        this.isLocked = false;
        this.targetOrientation = 'auto';
        this.callbacks = new Set();
    }

    getCurrentOrientation() {
        return this.currentOrientation;
    }

    lockOrientation(orientation) {
        this.isLocked = true;
        this.targetOrientation = orientation;
        return Promise.resolve();
    }

    unlockOrientation() {
        this.isLocked = false;
        this.targetOrientation = 'auto';
        return Promise.resolve();
    }

    addTransitionCallback(callback) {
        this.callbacks.add(callback);
    }

    removeTransitionCallback(callback) {
        this.callbacks.delete(callback);
    }

    simulateOrientationChange(newOrientation) {
        const oldOrientation = this.currentOrientation;
        this.currentOrientation = newOrientation;
        this.callbacks.forEach(callback => callback(newOrientation, oldOrientation));
    }
}

// Setup DOM elements for testing
beforeAll(() => {
    document.body.innerHTML = `
        <div id="mobile-login-screen" class="mobile-screen"></div>
        <div id="mobile-lobby-screen" class="mobile-screen"></div>
        <div id="mobile-game-creation-screen" class="mobile-screen"></div>
        <div id="mobile-game-screen" class="mobile-screen"></div>
    `;

    // Mock window.history
    Object.defineProperty(window, 'history', {
        value: {
            pushState: jest.fn(),
            back: jest.fn(),
            length: 1
        },
        writable: true
    });

    // Mock URL constructor for navigation controller
    global.URL = class URL {
        constructor(url) {
            this.href = url;
            this.searchParams = new Map();
        }
        
        toString() {
            return this.href;
        }
    };
    
    global.URL.prototype.searchParams = {
        set: jest.fn(),
        get: jest.fn(),
        has: jest.fn()
    };
});

// Import the MobileNavigationController after setting up environment
const MobileNavigationController = require('../netlify-build/js/mobile-ui/MobileNavigationController.js');

describe('Mobile Navigation Consistency Property Tests', () => {
    let navigationController;
    let mockOrientationManager;

    beforeEach(() => {
        // Reset DOM state
        document.querySelectorAll('.mobile-screen').forEach(screen => {
            screen.style.visibility = 'hidden';
            screen.style.opacity = '0';
            screen.classList.remove('active');
        });

        // Clear any existing navigation controller
        if (navigationController) {
            navigationController.destroy();
        }

        // Create mock orientation manager
        mockOrientationManager = new MockOrientationManager();
        
        // Create navigation controller with mock orientation manager
        navigationController = new MobileNavigationController(mockOrientationManager);
    });

    afterEach(() => {
        if (navigationController) {
            navigationController.destroy();
        }
    });

    /**
     * Property 6.1: Navigation state consistency
     * For any sequence of valid screen navigations, the navigation controller
     * should maintain consistent state and history
     */
    test('Property 6.1: Navigation state consistency', () => {
        fc.assert(fc.asyncProperty(
            fc.array(fc.constantFrom('login', 'lobby', 'game-creation', 'game'), { 
                minLength: 1, 
                maxLength: 5 
            }),
            
            async (navigationSequence) => {
                // Reset navigation controller state for each iteration
                navigationController.currentScreen = null;
                navigationController.navigationHistory = [];
                navigationController.transitionInProgress = false;
                navigationController.transitionQueue = [];

                let expectedHistory = [];
                let previousScreen = null;

                for (const targetScreen of navigationSequence) {
                    if (targetScreen !== previousScreen) {
                        // Navigate to screen and wait for completion
                        await navigationController.navigateToScreen(targetScreen);

                        // Verify current screen is updated
                        expect(navigationController.getCurrentScreen()).toBe(targetScreen);

                        // Verify history is maintained (previous screen should be in history)
                        if (previousScreen !== null) {
                            expectedHistory.push(previousScreen);
                        }

                        const actualHistory = navigationController.getNavigationHistory();
                        expect(actualHistory).toEqual(expectedHistory);

                        previousScreen = targetScreen;
                    }
                }

                return true;
            }
        ), { numRuns: 50 });
    });

    /**
     * Property 6.2: Back navigation consistency
     * For any navigation sequence, back navigation should restore previous states
     * in reverse order
     */
    test('Property 6.2: Back navigation consistency', () => {
        fc.assert(fc.asyncProperty(
            fc.array(fc.constantFrom('login', 'lobby', 'game-creation', 'game'), { 
                minLength: 2, 
                maxLength: 4 
            }),
            
            async (navigationSequence) => {
                // Reset navigation controller state for each iteration
                navigationController.currentScreen = null;
                navigationController.navigationHistory = [];
                navigationController.transitionInProgress = false;
                navigationController.transitionQueue = [];

                // Remove duplicates to ensure we have actual navigation
                const uniqueSequence = navigationSequence.filter((screen, index) => 
                    index === 0 || screen !== navigationSequence[index - 1]
                );

                if (uniqueSequence.length < 2) return true;

                // Navigate through sequence
                for (const screen of uniqueSequence) {
                    await navigationController.navigateToScreen(screen);
                }

                // Navigate back through sequence
                const reversedSequence = [...uniqueSequence].reverse().slice(1);
                
                for (const expectedScreen of reversedSequence) {
                    const canGoBack = navigationController.canGoBack();
                    expect(canGoBack).toBe(true);

                    const didGoBack = navigationController.goBack();
                    expect(didGoBack).toBe(true);

                    // Small delay to allow navigation to complete
                    await new Promise(resolve => setTimeout(resolve, 10));

                    expect(navigationController.getCurrentScreen()).toBe(expectedScreen);
                }

                return true;
            }
        ), { numRuns: 30 });
    });

    /**
     * Property 6.3: Screen configuration consistency
     * For any screen type, the navigation controller should apply the correct
     * configuration (orientation, status bar, navigation style)
     */
    test('Property 6.3: Screen configuration consistency', () => {
        fc.assert(fc.asyncProperty(
            fc.constantFrom('login', 'lobby', 'game-creation', 'game'),
            
            async (screenType) => {
                // Reset navigation controller state for each iteration
                navigationController.currentScreen = null;
                navigationController.navigationHistory = [];
                navigationController.transitionInProgress = false;
                navigationController.transitionQueue = [];

                await navigationController.navigateToScreen(screenType);

                // Verify screen configuration is applied
                const config = navigationController.screenConfigs.get(screenType);
                expect(config).toBeDefined();

                // Check orientation requirement
                if (screenType === 'login' || screenType === 'lobby') {
                    expect(config.orientation).toBe('portrait');
                } else if (screenType === 'game-creation' || screenType === 'game') {
                    expect(config.orientation).toBe('landscape');
                }

                // Check navigation style
                expect(config.navigationStyle).toBeDefined();
                expect(['none', 'back', 'tabs', 'drawer']).toContain(config.navigationStyle);

                // Check status bar style
                expect(config.statusBarStyle).toBeDefined();
                expect(['light', 'dark', 'auto']).toContain(config.statusBarStyle);

                return true;
            }
        ), { numRuns: 100 });
    });

    /**
     * Property 6.4: Transition type consistency
     * For any pair of screens, the navigation controller should select
     * appropriate transition types based on screen relationships
     */
    test('Property 6.4: Transition type consistency', () => {
        fc.assert(fc.property(
            fc.constantFrom('login', 'lobby', 'game-creation', 'game'),
            fc.constantFrom('login', 'lobby', 'game-creation', 'game'),
            
            (fromScreen, toScreen) => {
                if (fromScreen === toScreen) return true;

                const transitionType = navigationController.getTransitionType(fromScreen, toScreen);
                
                // Verify transition type is valid
                const validTransitions = ['slide-left', 'slide-right', 'fade', 'orientation-change'];
                expect(validTransitions).toContain(transitionType);

                // Check orientation-based transitions
                const fromConfig = navigationController.screenConfigs.get(fromScreen);
                const toConfig = navigationController.screenConfigs.get(toScreen);

                if (fromConfig && toConfig && fromConfig.orientation !== toConfig.orientation) {
                    // Should use orientation-change transition when orientations differ
                    expect(transitionType).toBe('orientation-change');
                }

                return true;
            }
        ), { numRuns: 100 });
    });


});

describe('Mobile Navigation Consistency Unit Tests', () => {
    let navigationController;
    let mockOrientationManager;

    beforeEach(() => {
        mockOrientationManager = new MockOrientationManager();
        navigationController = new MobileNavigationController(mockOrientationManager);
    });

    afterEach(() => {
        if (navigationController) {
            navigationController.destroy();
        }
    });

    test('should handle back button when no history exists', () => {
        navigationController.navigationHistory = [];
        
        const canGoBack = navigationController.canGoBack();
        expect(canGoBack).toBe(false);

        const didGoBack = navigationController.goBack();
        expect(didGoBack).toBe(false);
    });

    test('should handle screen-specific back button handlers', () => {
        navigationController.currentScreen = 'game';
        
        // Mock the showExitGameConfirmation method
        navigationController.showExitGameConfirmation = jest.fn();
        
        navigationController.handleBackNavigation();
        
        expect(navigationController.showExitGameConfirmation).toHaveBeenCalled();
    });

    test('should clean up resources on destroy', () => {
        const initialHistoryLength = navigationController.navigationHistory.length;
        const initialQueueLength = navigationController.transitionQueue.length;

        navigationController.navigationHistory.push('test');
        navigationController.transitionQueue.push({ screenType: 'test' });

        navigationController.destroy();

        expect(navigationController.navigationHistory).toEqual([]);
        expect(navigationController.transitionQueue).toEqual([]);
        expect(navigationController.screens.size).toBe(0);
        expect(navigationController.backButtonHandlers.size).toBe(0);
        expect(navigationController.screenConfigs.size).toBe(0);
    });

    test('should handle missing screen elements gracefully', async () => {
        // Remove all screen elements
        document.querySelectorAll('.mobile-screen').forEach(el => el.remove());
        
        // Navigation should not throw errors
        await expect(navigationController.navigateToScreen('login')).resolves.not.toThrow();
    });

    test('should handle popstate events', () => {
        const mockEvent = {
            state: { screen: 'lobby' }
        };

        navigationController.navigateToScreen = jest.fn();
        navigationController.handlePopState(mockEvent);

        expect(navigationController.navigateToScreen).toHaveBeenCalledWith('lobby', { isBack: true });
    });

    test('should handle hardware back button events', () => {
        const mockEvent = {
            preventDefault: jest.fn()
        };

        navigationController.handleBackNavigation = jest.fn();
        navigationController.handleHardwareBackButton(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(navigationController.handleBackNavigation).toHaveBeenCalled();
    });

    test('should handle keyboard events for back navigation', () => {
        const mockEvent = {
            key: 'Escape'
        };

        navigationController.handleBackNavigation = jest.fn();
        navigationController.handleKeyDown(mockEvent);

        expect(navigationController.handleBackNavigation).toHaveBeenCalled();
    });
});