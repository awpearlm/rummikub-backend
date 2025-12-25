/**
 * Integration Tests for Mobile Login Authentication Flow
 * Tests the complete authentication flow including API integration and navigation
 * 
 * Requirements: 2.3, 2.4, 10.1
 */

// Mock fetch for API calls
global.fetch = jest.fn();

// Import components
const MobileLoginScreen = require('../netlify-build/js/mobile-ui/MobileLoginScreen.js');
const MobileNavigationController = require('../netlify-build/js/mobile-ui/MobileNavigationController.js');

describe('Mobile Login Authentication Flow Integration', () => {
    let loginScreen;
    let navigationController;

    beforeAll(() => {
        // Suppress console errors for navigation in tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        // Restore console.error
        console.error.mockRestore();
    });

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset mocks
        jest.clearAllMocks();
        fetch.mockClear();
        
        // Clear storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Create components
        loginScreen = new MobileLoginScreen();
        navigationController = new MobileNavigationController();
        
        // Register login screen with navigation controller
        navigationController.registerScreen('login', loginScreen);
    });

    afterEach(() => {
        if (loginScreen) {
            loginScreen.destroy();
        }
        if (navigationController) {
            navigationController.destroy();
        }
    });

    describe('Authentication API Integration', () => {
        test('should successfully authenticate with valid credentials', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token-123',
                    user: {
                        id: 'user-123',
                        username: 'testuser',
                        email: 'test@example.com',
                        isAdmin: false
                    }
                })
            });

            // Set valid form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: true
            };

            // Mock navigation to prevent actual redirect
            const navigateToLobbySpy = jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Mock setTimeout to execute immediately
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((fn) => fn());

            // Perform login
            await loginScreen.performLogin();

            // Verify API was called with correct data
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/auth/login'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: 'test@example.com',
                        password: 'password123'
                    })
                })
            );

            // Verify authentication data was stored
            expect(localStorage.getItem('auth_token')).toBe('jwt-token-123');
            expect(localStorage.getItem('username')).toBe('testuser');
            expect(localStorage.getItem('user_id')).toBe('user-123');
            expect(localStorage.getItem('user_email')).toBe('test@example.com');
            expect(localStorage.getItem('is_admin')).toBe('false');

            // Verify navigation was called
            expect(navigateToLobbySpy).toHaveBeenCalled();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });

        test('should handle authentication failure correctly', async () => {
            // Mock failed API response
            fetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({
                    message: 'Invalid credentials'
                })
            });

            // Set form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'wrongpassword',
                rememberMe: false
            };

            // Spy on error display
            const showErrorSpy = jest.spyOn(loginScreen, 'showError');

            // Perform login
            await loginScreen.performLogin();

            // Verify error was displayed
            expect(showErrorSpy).toHaveBeenCalledWith('Invalid credentials');

            // Verify no authentication data was stored
            expect(localStorage.getItem('auth_token')).toBeNull();
            expect(sessionStorage.getItem('auth_token')).toBeNull();
        });

        test('should handle network errors gracefully', async () => {
            // Mock network error
            fetch.mockRejectedValueOnce(new Error('Network error'));

            // Set form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            };

            // Spy on error display
            const showErrorSpy = jest.spyOn(loginScreen, 'showError');

            // Perform login
            await loginScreen.performLogin();

            // Verify error was displayed
            expect(showErrorSpy).toHaveBeenCalledWith('Network error');
        });
    });

    describe('Navigation Integration', () => {
        test('should navigate to lobby after successful login', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token-123',
                    user: {
                        id: 'user-123',
                        username: 'testuser',
                        email: 'test@example.com',
                        isAdmin: false
                    }
                })
            });

            // Set form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            };

            // Mock navigation to prevent actual redirect
            const navigateToLobbySpy = jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Mock setTimeout to execute immediately
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((fn) => fn());

            // Perform login
            await loginScreen.performLogin();

            // Verify navigation was called
            expect(navigateToLobbySpy).toHaveBeenCalled();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });

        test('should detect authenticated user and show lobby', () => {
            // Set up authenticated state
            localStorage.setItem('auth_token', 'existing-token');

            // Mock the redirectToMainGame method to prevent actual navigation
            const mockRedirectToMainGame = jest.fn();

            // Create new navigation controller with mocked redirect
            const newNavigationController = new MobileNavigationController();
            newNavigationController.redirectToMainGame = mockRedirectToMainGame;
            
            // Manually call detectInitialScreen since constructor already ran
            newNavigationController.detectInitialScreen();

            // Should detect authentication and set current screen to lobby
            expect(newNavigationController.getCurrentScreen()).toBe('lobby');

            newNavigationController.destroy();
        });

        test('should show login screen for unauthenticated user', () => {
            // Ensure no authentication data
            localStorage.clear();
            sessionStorage.clear();

            // Mock the showLoginScreen method
            const mockShowLoginScreen = jest.fn();

            // Create new navigation controller with mocked show login
            const newNavigationController = new MobileNavigationController();
            newNavigationController.showLoginScreen = mockShowLoginScreen;
            
            // Manually call detectInitialScreen since constructor already ran
            newNavigationController.detectInitialScreen();

            // Should show login screen
            expect(newNavigationController.getCurrentScreen()).toBe('login');

            newNavigationController.destroy();
        });
    });

    describe('Loading States and Error Handling', () => {
        test('should show loading state during authentication', async () => {
            // Mock delayed API response
            let resolvePromise;
            const delayedPromise = new Promise(resolve => {
                resolvePromise = resolve;
            });

            fetch.mockReturnValueOnce(delayedPromise);

            // Set form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            };

            // Start login process
            const loginPromise = loginScreen.performLogin();

            // Verify loading state is active
            expect(loginScreen.isLoading).toBe(true);

            // Resolve the API call
            resolvePromise({
                ok: true,
                json: async () => ({
                    token: 'jwt-token-123',
                    user: {
                        id: 'user-123',
                        username: 'testuser',
                        email: 'test@example.com',
                        isAdmin: false
                    }
                })
            });

            // Wait for login to complete
            await loginPromise;

            // Verify loading state is cleared
            expect(loginScreen.isLoading).toBe(false);
        });

        test('should clear loading state on error', async () => {
            // Mock failed API response
            fetch.mockRejectedValueOnce(new Error('Network error'));

            // Set form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            };

            // Perform login
            await loginScreen.performLogin();

            // Verify loading state is cleared even on error
            expect(loginScreen.isLoading).toBe(false);
        });
    });

    describe('Form Validation Integration', () => {
        test('should prevent API call with invalid form data', async () => {
            // Set invalid form data
            loginScreen.formData = {
                email: 'invalid-email',
                password: '123', // Too short
                rememberMe: false
            };

            // Mock form submission
            const form = loginScreen.container.querySelector('#mobile-login-form');
            const submitEvent = new Event('submit');
            
            // Prevent default and handle form submission
            submitEvent.preventDefault = jest.fn();
            form.dispatchEvent(submitEvent);

            // Verify API was not called
            expect(fetch).not.toHaveBeenCalled();

            // Verify validation errors are shown
            expect(loginScreen.validation.emailError).toBeTruthy();
            expect(loginScreen.validation.passwordError).toBeTruthy();
        });
    });

    describe('Session Management', () => {
        test('should store auth data in localStorage when remember me is checked', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token-123',
                    user: {
                        id: 'user-123',
                        username: 'testuser',
                        email: 'test@example.com',
                        isAdmin: false
                    }
                })
            });

            // Set form data with remember me checked
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: true
            };

            // Mock navigation
            jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Mock setTimeout to execute immediately
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((fn) => fn());

            // Perform login
            await loginScreen.performLogin();

            // Verify data is in localStorage
            expect(localStorage.getItem('auth_token')).toBe('jwt-token-123');
            expect(sessionStorage.getItem('auth_token')).toBeNull();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });

        test('should store auth data in sessionStorage when remember me is not checked', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token-123',
                    user: {
                        id: 'user-123',
                        username: 'testuser',
                        email: 'test@example.com',
                        isAdmin: false
                    }
                })
            });

            // Set form data with remember me unchecked
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            };

            // Mock navigation
            jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Mock setTimeout to execute immediately
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((fn) => fn());

            // Perform login
            await loginScreen.performLogin();

            // Verify data is in sessionStorage
            expect(sessionStorage.getItem('auth_token')).toBe('jwt-token-123');
            expect(localStorage.getItem('auth_token')).toBeNull();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });
    });
});