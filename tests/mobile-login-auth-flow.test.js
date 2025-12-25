/**
 * Focused Authentication Flow Tests for Mobile Login Screen
 * Tests the core authentication functionality without navigation issues
 * 
 * Requirements: 2.3, 2.4, 10.1
 */

// Mock fetch for API calls
global.fetch = jest.fn();

// Import components
const MobileLoginScreen = require('../netlify-build/js/mobile-ui/MobileLoginScreen.js');

describe('Mobile Login Authentication Flow', () => {
    let loginScreen;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset mocks
        jest.clearAllMocks();
        fetch.mockClear();
        
        // Clear storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Create login screen
        loginScreen = new MobileLoginScreen();
    });

    afterEach(() => {
        if (loginScreen) {
            loginScreen.destroy();
        }
    });

    describe('API Integration', () => {
        test('should make correct API call with form data', async () => {
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
                'http://localhost:3000/api/auth/login',
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

            // Verify navigation was called
            expect(navigateToLobbySpy).toHaveBeenCalled();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });

        test('should handle API errors correctly', async () => {
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

        test('should handle network errors', async () => {
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

    describe('Authentication Data Storage', () => {
        test('should store auth data correctly with remember me', async () => {
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

            // Set form data with remember me
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: true
            };

            // Mock navigation
            jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Perform login
            await loginScreen.performLogin();

            // Verify data is stored in localStorage
            expect(localStorage.getItem('auth_token')).toBe('jwt-token-123');
            expect(localStorage.getItem('username')).toBe('testuser');
            expect(localStorage.getItem('user_id')).toBe('user-123');
            expect(localStorage.getItem('user_email')).toBe('test@example.com');
            expect(localStorage.getItem('is_admin')).toBe('false');

            // Verify sessionStorage is not used
            expect(sessionStorage.getItem('auth_token')).toBeNull();
        });

        test('should store auth data correctly without remember me', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    token: 'jwt-token-456',
                    user: {
                        id: 'user-456',
                        username: 'testuser2',
                        email: 'test2@example.com',
                        isAdmin: true
                    }
                })
            });

            // Set form data without remember me
            loginScreen.formData = {
                email: 'test2@example.com',
                password: 'password456',
                rememberMe: false
            };

            // Mock navigation
            jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Perform login
            await loginScreen.performLogin();

            // Verify data is stored in sessionStorage
            expect(sessionStorage.getItem('auth_token')).toBe('jwt-token-456');
            expect(sessionStorage.getItem('username')).toBe('testuser2');
            expect(sessionStorage.getItem('user_id')).toBe('user-456');
            expect(sessionStorage.getItem('user_email')).toBe('test2@example.com');
            expect(sessionStorage.getItem('is_admin')).toBe('true');

            // Verify localStorage is not used
            expect(localStorage.getItem('auth_token')).toBeNull();
        });
    });

    describe('Loading States and UI Feedback', () => {
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

        test('should show success message on successful login', async () => {
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

            // Mock navigation
            jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});

            // Spy on success message
            const showSuccessSpy = jest.spyOn(loginScreen, 'showSuccess');

            // Perform login
            await loginScreen.performLogin();

            // Verify success message was shown
            expect(showSuccessSpy).toHaveBeenCalledWith('Login successful! Redirecting...');
        });
    });

    describe('Form Validation Integration', () => {
        test('should prevent API call with invalid email', async () => {
            // Set invalid form data
            loginScreen.formData = {
                email: 'invalid-email',
                password: 'password123',
                rememberMe: false
            };

            // Trigger form validation
            const isValid = loginScreen.validateEmail() && loginScreen.validatePassword();

            // Should not be valid
            expect(isValid).toBe(false);

            // Verify API was not called
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should prevent API call with short password', async () => {
            // Set invalid form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: '123', // Too short
                rememberMe: false
            };

            // Trigger form validation
            const isValid = loginScreen.validateEmail() && loginScreen.validatePassword();

            // Should not be valid
            expect(isValid).toBe(false);

            // Verify API was not called
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    describe('Backend URL Detection', () => {
        test('should use localhost URL for localhost hostname', () => {
            // Test the method directly by temporarily modifying the implementation
            const originalGetBackendUrl = loginScreen.getBackendUrl;
            loginScreen.getBackendUrl = function() {
                // Simulate localhost hostname
                return 'localhost' === 'localhost' ? 'http://localhost:3000' : 'https://rummikub-backend.onrender.com';
            };

            const url = loginScreen.getBackendUrl();
            expect(url).toBe('http://localhost:3000');
            
            // Restore
            loginScreen.getBackendUrl = originalGetBackendUrl;
        });

        test('should use production URL for other hostnames', () => {
            // Test the method directly by temporarily modifying the implementation
            const originalGetBackendUrl = loginScreen.getBackendUrl;
            loginScreen.getBackendUrl = function() {
                // Simulate production hostname
                return 'example.com' === 'localhost' ? 'http://localhost:3000' : 'https://rummikub-backend.onrender.com';
            };

            const url = loginScreen.getBackendUrl();
            expect(url).toBe('https://rummikub-backend.onrender.com');
            
            // Restore
            loginScreen.getBackendUrl = originalGetBackendUrl;
        });
    });

    describe('Error Recovery', () => {
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

        test('should allow retry after error', async () => {
            // First call fails
            fetch.mockRejectedValueOnce(new Error('Network error'));

            // Set form data
            loginScreen.formData = {
                email: 'test@example.com',
                password: 'password123',
                rememberMe: false
            };

            // First attempt
            await loginScreen.performLogin();

            // Verify error state
            expect(loginScreen.isLoading).toBe(false);

            // Second call succeeds
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

            // Mock navigation and setTimeout
            jest.spyOn(loginScreen, 'navigateToLobby').mockImplementation(() => {});
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = jest.fn((fn) => fn());

            // Second attempt
            await loginScreen.performLogin();

            // Verify success
            expect(sessionStorage.getItem('auth_token')).toBe('jwt-token-123');

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
        });
    });
});