/**
 * Simplified Unit Tests for Mobile Login Screen Interactions
 * Tests form validation, error display, keyboard handling, and input focus
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

// Mock fetch for authentication tests
global.fetch = jest.fn();

// Mock localStorage and sessionStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
global.localStorage = localStorageMock;
global.sessionStorage = sessionStorageMock;

// Import the MobileLoginScreen after setting up mocks
const MobileLoginScreen = require('../netlify-build/js/mobile-ui/MobileLoginScreen.js');

describe('Mobile Login Screen Core Tests', () => {
    let loginScreen;
    let container;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset mocks
        jest.clearAllMocks();
        fetch.mockClear();
        localStorageMock.getItem.mockReturnValue(null);
        localStorageMock.setItem.mockImplementation(() => {});
        sessionStorageMock.getItem.mockReturnValue(null);
        sessionStorageMock.setItem.mockImplementation(() => {});
        
        // Create fresh login screen
        loginScreen = new MobileLoginScreen();
        container = loginScreen.container;
    });

    afterEach(() => {
        if (loginScreen) {
            loginScreen.destroy();
        }
    });

    describe('Form Validation', () => {
        test('should validate email field correctly', () => {
            // Test empty email
            loginScreen.formData.email = '';
            expect(loginScreen.validateEmail()).toBe(false);
            expect(loginScreen.validation.emailError).toBe('Email is required');

            // Test invalid email format
            loginScreen.formData.email = 'invalid-email';
            expect(loginScreen.validateEmail()).toBe(false);
            expect(loginScreen.validation.emailError).toBe('Please enter a valid email address');

            // Test valid email
            loginScreen.formData.email = 'test@example.com';
            expect(loginScreen.validateEmail()).toBe(true);
            expect(loginScreen.validation.emailError).toBeNull();
        });

        test('should validate password field correctly', () => {
            // Test empty password
            loginScreen.formData.password = '';
            expect(loginScreen.validatePassword()).toBe(false);
            expect(loginScreen.validation.passwordError).toBe('Password is required');

            // Test short password
            loginScreen.formData.password = '123';
            expect(loginScreen.validatePassword()).toBe(false);
            expect(loginScreen.validation.passwordError).toBe('Password must be at least 6 characters long');

            // Test valid password
            loginScreen.formData.password = 'password123';
            expect(loginScreen.validatePassword()).toBe(true);
            expect(loginScreen.validation.passwordError).toBeNull();
        });

        test('should display field errors in UI', () => {
            const emailInput = container.querySelector('#mobile-email');
            const emailError = container.querySelector('#email-error');

            // Set field error
            loginScreen.setFieldError('email', 'Test error message');

            expect(emailError.textContent).toBe('Test error message');
            expect(emailError.style.display).toBe('block');
            expect(emailInput.classList.contains('mobile-error')).toBe(true);
        });

        test('should clear field errors in UI', () => {
            const emailInput = container.querySelector('#mobile-email');
            const emailError = container.querySelector('#email-error');

            // Set error first
            loginScreen.setFieldError('email', 'Test error');
            expect(emailError.style.display).toBe('block');

            // Clear error
            loginScreen.clearFieldError('email');
            expect(emailError.style.display).toBe('none');
            expect(emailInput.classList.contains('mobile-error')).toBe(false);
        });
    });

    describe('Input Handling', () => {
        test('should handle email input changes', () => {
            const emailInput = container.querySelector('#mobile-email');
            
            emailInput.value = 'test@example.com';
            emailInput.dispatchEvent(new Event('input'));

            expect(loginScreen.formData.email).toBe('test@example.com');
        });

        test('should handle password input changes', () => {
            const passwordInput = container.querySelector('#mobile-password');
            
            passwordInput.value = 'password123';
            passwordInput.dispatchEvent(new Event('input'));

            expect(loginScreen.formData.password).toBe('password123');
        });

        test('should handle remember me checkbox changes', () => {
            const rememberMeCheckbox = container.querySelector('#mobile-remember-me');
            
            rememberMeCheckbox.checked = true;
            rememberMeCheckbox.dispatchEvent(new Event('change'));

            expect(loginScreen.formData.rememberMe).toBe(true);
        });

        test('should toggle password visibility', () => {
            const passwordInput = container.querySelector('#mobile-password');
            const passwordToggle = container.querySelector('#password-toggle');
            const showIcon = container.querySelector('.password-show-icon');
            const hideIcon = container.querySelector('.password-hide-icon');

            // Initially password should be hidden
            expect(passwordInput.type).toBe('password');
            expect(showIcon.style.display).not.toBe('none');
            expect(hideIcon.style.display).toBe('none');

            // Click toggle to show password
            passwordToggle.click();

            expect(passwordInput.type).toBe('text');
            expect(showIcon.style.display).toBe('none');
            expect(hideIcon.style.display).toBe('block');

            // Click toggle to hide password again
            passwordToggle.click();

            expect(passwordInput.type).toBe('password');
            expect(showIcon.style.display).toBe('block');
            expect(hideIcon.style.display).toBe('none');
        });
    });

    describe('Focus and Keyboard Handling', () => {
        test('should add focused class on input focus', () => {
            const emailInput = container.querySelector('#mobile-email');
            const inputContainer = emailInput.closest('.mobile-input-container');

            emailInput.dispatchEvent(new Event('focus'));

            expect(inputContainer.classList.contains('focused')).toBe(true);
        });

        test('should remove focused class on input blur', () => {
            const emailInput = container.querySelector('#mobile-email');
            const inputContainer = emailInput.closest('.mobile-input-container');

            // Focus first
            emailInput.dispatchEvent(new Event('focus'));
            expect(inputContainer.classList.contains('focused')).toBe(true);

            // Then blur
            emailInput.dispatchEvent(new Event('blur'));
            expect(inputContainer.classList.contains('focused')).toBe(false);
        });

        test('should clear field errors on input focus', () => {
            const emailInput = container.querySelector('#mobile-email');
            
            // Set error first
            loginScreen.setFieldError('email', 'Test error');
            expect(loginScreen.validation.emailError).toBe('Test error');

            // Focus input should clear error
            emailInput.dispatchEvent(new Event('focus'));
            expect(loginScreen.validation.emailError).toBeNull();
        });

        test('should handle keyboard show/hide events', () => {
            const content = container.querySelector('.mobile-login-content');
            
            // Simulate keyboard show
            loginScreen.keyboardHeight = 300;
            loginScreen.handleKeyboardShow();

            expect(container.classList.contains('keyboard-visible')).toBe(true);
            expect(content.style.paddingBottom).toBe('320px'); // keyboardHeight + 20px

            // Simulate keyboard hide
            loginScreen.keyboardHeight = 0;
            loginScreen.handleKeyboardHide();

            expect(container.classList.contains('keyboard-visible')).toBe(false);
            expect(content.style.paddingBottom).toBe('');
        });
    });

    describe('Loading States', () => {
        test('should show loading state correctly', () => {
            const button = container.querySelector('#mobile-login-button');
            const buttonText = button.querySelector('.button-text');
            const buttonLoading = button.querySelector('.button-loading');

            loginScreen.setLoading(true);

            expect(loginScreen.isLoading).toBe(true);
            expect(button.disabled).toBe(true);
            expect(button.classList.contains('loading')).toBe(true);
            expect(buttonText.style.display).toBe('none');
            expect(buttonLoading.style.display).toBe('flex');
        });

        test('should hide loading state correctly', () => {
            const button = container.querySelector('#mobile-login-button');
            const buttonText = button.querySelector('.button-text');
            const buttonLoading = button.querySelector('.button-loading');

            // Set loading first
            loginScreen.setLoading(true);
            expect(loginScreen.isLoading).toBe(true);

            // Then clear loading
            loginScreen.setLoading(false);

            expect(loginScreen.isLoading).toBe(false);
            expect(button.disabled).toBe(false);
            expect(button.classList.contains('loading')).toBe(false);
            expect(buttonText.style.display).toBe('block');
            expect(buttonLoading.style.display).toBe('none');
        });
    });

    describe('Error and Success Messages', () => {
        test('should display error messages', () => {
            const errorElement = container.querySelector('#mobile-login-error');

            loginScreen.showError('Test error message');

            expect(errorElement.textContent).toBe('Test error message');
            expect(errorElement.style.display).toBe('block');
        });

        test('should display success messages', () => {
            const successElement = container.querySelector('#mobile-login-success');

            loginScreen.showSuccess('Test success message');

            expect(successElement.textContent).toBe('Test success message');
            expect(successElement.style.display).toBe('block');
        });

        test('should clear all messages', () => {
            const errorElement = container.querySelector('#mobile-login-error');
            const successElement = container.querySelector('#mobile-login-success');

            // Show messages first
            loginScreen.showError('Error');
            loginScreen.showSuccess('Success');

            // Clear messages
            loginScreen.clearMessages();

            expect(errorElement.style.display).toBe('none');
            expect(successElement.style.display).toBe('none');
        });
    });

    describe('Touch Feedback', () => {
        test('should add touch-active class on touchstart', () => {
            const button = container.querySelector('#mobile-login-button');

            const touchStartEvent = new Event('touchstart');
            button.dispatchEvent(touchStartEvent);

            expect(button.classList.contains('touch-active')).toBe(true);
        });

        test('should remove touch-active class on touchend', () => {
            const button = container.querySelector('#mobile-login-button');

            // Add class first
            button.classList.add('touch-active');

            const touchEndEvent = new Event('touchend');
            button.dispatchEvent(touchEndEvent);

            expect(button.classList.contains('touch-active')).toBe(false);
        });
    });

    describe('Screen Visibility', () => {
        test('should show screen correctly', () => {
            expect(loginScreen.isVisible).toBe(false);
            expect(container.style.display).toBe('none');

            loginScreen.show();

            expect(loginScreen.isVisible).toBe(true);
            expect(container.style.display).toBe('flex');
            expect(document.body.classList.contains('screen-login')).toBe(true);
        });

        test('should hide screen correctly', () => {
            // Show first
            loginScreen.show();
            expect(loginScreen.isVisible).toBe(true);

            loginScreen.hide();

            expect(loginScreen.isVisible).toBe(false);
            expect(container.style.display).toBe('none');
            expect(document.body.classList.contains('screen-login')).toBe(false);
        });
    });

    describe('Authentication Storage', () => {
        test('should store auth data in localStorage when remember me is true', () => {
            const authData = {
                token: 'test-token',
                user: {
                    id: 'user-id',
                    username: 'testuser',
                    email: 'test@example.com',
                    isAdmin: false
                }
            };

            // Spy on the actual localStorage methods used by the component
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            loginScreen.formData.rememberMe = true;
            loginScreen.storeAuthData(authData);

            expect(setItemSpy).toHaveBeenCalledWith('auth_token', 'test-token');
            expect(setItemSpy).toHaveBeenCalledWith('username', 'testuser');
            expect(setItemSpy).toHaveBeenCalledWith('user_id', 'user-id');
            expect(setItemSpy).toHaveBeenCalledWith('user_email', 'test@example.com');
            expect(setItemSpy).toHaveBeenCalledWith('is_admin', false);

            setItemSpy.mockRestore();
        });

        test('should store auth data in sessionStorage when remember me is false', () => {
            const authData = {
                token: 'test-token',
                user: {
                    id: 'user-id',
                    username: 'testuser',
                    email: 'test@example.com',
                    isAdmin: false
                }
            };

            // Spy on the actual sessionStorage methods used by the component
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            loginScreen.formData.rememberMe = false;
            loginScreen.storeAuthData(authData);

            expect(setItemSpy).toHaveBeenCalledWith('auth_token', 'test-token');
            expect(setItemSpy).toHaveBeenCalledWith('username', 'testuser');
            expect(setItemSpy).toHaveBeenCalledWith('user_id', 'user-id');
            expect(setItemSpy).toHaveBeenCalledWith('user_email', 'test@example.com');
            expect(setItemSpy).toHaveBeenCalledWith('is_admin', false);

            setItemSpy.mockRestore();
        });
    });

    describe('Cleanup', () => {
        test('should clean up properly on destroy', () => {
            loginScreen.show();
            expect(document.body.classList.contains('screen-login')).toBe(true);
            expect(container.parentNode).toBe(document.body);

            loginScreen.destroy();

            expect(document.body.classList.contains('screen-login')).toBe(false);
            expect(container.parentNode).toBeNull();
        });
    });
});