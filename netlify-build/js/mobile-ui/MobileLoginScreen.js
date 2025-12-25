/**
 * Mobile Login Screen Component
 * Portrait-optimized login interface with touch-friendly interactions
 * Implements keyboard-aware layout adjustments and form validation
 */

class MobileLoginScreen {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.isLoading = false;
        this.formData = {
            email: '',
            password: '',
            rememberMe: false
        };
        this.validation = {
            emailError: null,
            passwordError: null
        };
        this.keyboardHeight = 0;
        this.originalViewportHeight = window.innerHeight;
        
        this.init();
    }

    init() {
        this.createLoginScreen();
        this.setupEventListeners();
        this.setupKeyboardHandling();
        this.setupFormValidation();
    }

    createLoginScreen() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'mobile-login-screen';
        this.container.className = 'mobile-screen mobile-login-screen safe-area-container';
        
        this.container.innerHTML = `
            <div class="mobile-login-content">
                <!-- Header Section -->
                <div class="mobile-login-header">
                    <div class="mobile-login-logo">
                        <h1 class="mobile-title">J-kube</h1>
                        <p class="mobile-subtitle">Welcome back!</p>
                    </div>
                </div>
                
                <!-- Form Section -->
                <div class="mobile-login-form">
                    <form id="mobile-login-form" novalidate>
                        <!-- Email Input -->
                        <div class="mobile-form-group">
                            <label for="mobile-email" class="mobile-form-label">Email</label>
                            <div class="mobile-input-container">
                                <input 
                                    type="email" 
                                    id="mobile-email" 
                                    class="mobile-input touch-target-comfortable" 
                                    placeholder="Enter your email"
                                    autocomplete="email"
                                    autocapitalize="none"
                                    autocorrect="off"
                                    spellcheck="false"
                                    required
                                >
                                <div class="mobile-input-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                    </svg>
                                </div>
                            </div>
                            <div class="mobile-form-error" id="email-error"></div>
                        </div>
                        
                        <!-- Password Input -->
                        <div class="mobile-form-group">
                            <label for="mobile-password" class="mobile-form-label">Password</label>
                            <div class="mobile-input-container">
                                <input 
                                    type="password" 
                                    id="mobile-password" 
                                    class="mobile-input touch-target-comfortable" 
                                    placeholder="Enter your password"
                                    autocomplete="current-password"
                                    required
                                >
                                <button 
                                    type="button" 
                                    class="mobile-password-toggle touch-target" 
                                    id="password-toggle"
                                    aria-label="Toggle password visibility"
                                >
                                    <svg class="password-show-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                    <svg class="password-hide-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                        <line x1="1" y1="1" x2="23" y2="23"></line>
                                    </svg>
                                </button>
                            </div>
                            <div class="mobile-form-error" id="password-error"></div>
                        </div>
                        
                        <!-- Remember Me -->
                        <div class="mobile-form-group mobile-checkbox-group">
                            <label class="mobile-checkbox-label touch-target">
                                <input type="checkbox" id="mobile-remember-me" class="mobile-checkbox">
                                <span class="mobile-checkbox-custom"></span>
                                <span class="mobile-checkbox-text">Remember me</span>
                            </label>
                        </div>
                        
                        <!-- Submit Button -->
                        <button 
                            type="submit" 
                            id="mobile-login-button" 
                            class="mobile-button mobile-button-primary touch-target-large mobile-loading-button"
                        >
                            <span class="button-text">Sign In</span>
                            <span class="button-loading" style="display: none;">
                                <svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                                        <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                                        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                                    </circle>
                                </svg>
                                Signing in...
                            </span>
                        </button>
                    </form>
                    
                    <!-- Error/Success Messages -->
                    <div class="mobile-message-container">
                        <div id="mobile-login-error" class="mobile-message mobile-message-error" style="display: none;"></div>
                        <div id="mobile-login-success" class="mobile-message mobile-message-success" style="display: none;"></div>
                    </div>
                </div>
                
                <!-- Footer Section -->
                <div class="mobile-login-footer">
                    <div class="mobile-login-links">
                        <a href="#" class="mobile-link" id="forgot-password-link">Forgot password?</a>
                        <a href="#" class="mobile-link" id="signup-link">Create account</a>
                    </div>
                    <div class="mobile-login-back">
                        <button class="mobile-button mobile-button-secondary touch-target" id="back-to-game">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            Back to Game
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to DOM but keep hidden initially
        this.container.style.display = 'none';
        document.body.appendChild(this.container);
    }

    setupEventListeners() {
        const form = this.container.querySelector('#mobile-login-form');
        const emailInput = this.container.querySelector('#mobile-email');
        const passwordInput = this.container.querySelector('#mobile-password');
        const passwordToggle = this.container.querySelector('#password-toggle');
        const rememberMeCheckbox = this.container.querySelector('#mobile-remember-me');
        const backButton = this.container.querySelector('#back-to-game');
        const forgotPasswordLink = this.container.querySelector('#forgot-password-link');
        const signupLink = this.container.querySelector('#signup-link');

        // Form submission
        form.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Input events for real-time validation
        emailInput.addEventListener('input', this.handleEmailInput.bind(this));
        emailInput.addEventListener('blur', this.validateEmail.bind(this));
        passwordInput.addEventListener('input', this.handlePasswordInput.bind(this));
        passwordInput.addEventListener('blur', this.validatePassword.bind(this));
        
        // Password visibility toggle
        passwordToggle.addEventListener('click', this.togglePasswordVisibility.bind(this));
        
        // Remember me checkbox
        rememberMeCheckbox.addEventListener('change', this.handleRememberMeChange.bind(this));
        
        // Navigation buttons
        backButton.addEventListener('click', this.handleBackToGame.bind(this));
        forgotPasswordLink.addEventListener('click', this.handleForgotPassword.bind(this));
        signupLink.addEventListener('click', this.handleSignup.bind(this));
        
        // Touch feedback for interactive elements
        this.setupTouchFeedback();
    }

    setupTouchFeedback() {
        const touchElements = this.container.querySelectorAll('.touch-target, .mobile-button, .mobile-link');
        
        touchElements.forEach(element => {
            element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
            element.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: true });
        });
    }

    setupKeyboardHandling() {
        // Handle virtual keyboard appearance/disappearance
        const handleViewportChange = () => {
            const currentHeight = window.innerHeight;
            const heightDifference = this.originalViewportHeight - currentHeight;
            
            if (heightDifference > 150) { // Keyboard is likely visible
                this.keyboardHeight = heightDifference;
                this.handleKeyboardShow();
            } else { // Keyboard is likely hidden
                this.keyboardHeight = 0;
                this.handleKeyboardHide();
            }
        };

        // Listen for viewport changes
        window.addEventListener('resize', handleViewportChange);
        
        // Visual viewport API support (better keyboard detection)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                const keyboardHeight = window.innerHeight - window.visualViewport.height;
                
                if (keyboardHeight > 150) {
                    this.keyboardHeight = keyboardHeight;
                    this.handleKeyboardShow();
                } else {
                    this.keyboardHeight = 0;
                    this.handleKeyboardHide();
                }
            });
        }
        
        // Handle input focus for keyboard optimization
        const inputs = this.container.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('focus', this.handleInputFocus.bind(this));
            input.addEventListener('blur', this.handleInputBlur.bind(this));
        });
    }

    setupFormValidation() {
        // Set up real-time validation patterns
        this.validationRules = {
            email: {
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address'
            },
            password: {
                required: true,
                minLength: 6,
                message: 'Password must be at least 6 characters long'
            }
        };
    }

    // Event Handlers
    handleFormSubmit(event) {
        event.preventDefault();
        
        if (this.isLoading) return;
        
        // Validate all fields
        const isEmailValid = this.validateEmail();
        const isPasswordValid = this.validatePassword();
        
        if (!isEmailValid || !isPasswordValid) {
            this.showError('Please fix the errors above');
            return;
        }
        
        // Proceed with login
        this.performLogin();
    }

    handleEmailInput(event) {
        this.formData.email = event.target.value;
        this.clearFieldError('email');
    }

    handlePasswordInput(event) {
        this.formData.password = event.target.value;
        this.clearFieldError('password');
    }

    handleRememberMeChange(event) {
        this.formData.rememberMe = event.target.checked;
    }

    togglePasswordVisibility() {
        const passwordInput = this.container.querySelector('#mobile-password');
        const showIcon = this.container.querySelector('.password-show-icon');
        const hideIcon = this.container.querySelector('.password-hide-icon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            showIcon.style.display = 'none';
            hideIcon.style.display = 'block';
        } else {
            passwordInput.type = 'password';
            showIcon.style.display = 'block';
            hideIcon.style.display = 'none';
        }
    }

    handleTouchStart(event) {
        event.currentTarget.classList.add('touch-active');
    }

    handleTouchEnd(event) {
        event.currentTarget.classList.remove('touch-active');
    }

    handleKeyboardShow() {
        this.container.classList.add('keyboard-visible');
        
        // Adjust layout for keyboard
        const content = this.container.querySelector('.mobile-login-content');
        content.style.paddingBottom = `${this.keyboardHeight + 20}px`;
        
        // Scroll focused input into view
        const focusedInput = this.container.querySelector('input:focus');
        if (focusedInput) {
            setTimeout(() => {
                focusedInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    handleKeyboardHide() {
        this.container.classList.remove('keyboard-visible');
        
        // Reset layout
        const content = this.container.querySelector('.mobile-login-content');
        content.style.paddingBottom = '';
    }

    handleInputFocus(event) {
        const inputContainer = event.target.closest('.mobile-input-container');
        if (inputContainer) {
            inputContainer.classList.add('focused');
        }
        
        // Clear any existing errors when user starts typing
        this.clearFieldError(event.target.id.replace('mobile-', ''));
    }

    handleInputBlur(event) {
        const inputContainer = event.target.closest('.mobile-input-container');
        if (inputContainer) {
            inputContainer.classList.remove('focused');
        }
    }

    handleBackToGame() {
        this.hide();
        // Navigate back to main game screen
        if (window.mobileUISystem) {
            window.mobileUISystem.emit('navigateToLobby');
        }
    }

    handleForgotPassword() {
        // Implement forgot password functionality
        this.showMessage('Forgot password functionality coming soon!', 'info');
    }

    handleSignup() {
        // Navigate to signup screen
        this.showMessage('Signup functionality coming soon!', 'info');
    }

    // Validation Methods
    validateEmail() {
        const email = this.formData.email.trim();
        const rules = this.validationRules.email;
        
        if (rules.required && !email) {
            this.setFieldError('email', 'Email is required');
            return false;
        }
        
        if (email && !rules.pattern.test(email)) {
            this.setFieldError('email', rules.message);
            return false;
        }
        
        this.clearFieldError('email');
        return true;
    }

    validatePassword() {
        const password = this.formData.password;
        const rules = this.validationRules.password;
        
        if (rules.required && !password) {
            this.setFieldError('password', 'Password is required');
            return false;
        }
        
        if (password && password.length < rules.minLength) {
            this.setFieldError('password', rules.message);
            return false;
        }
        
        this.clearFieldError('password');
        return true;
    }

    setFieldError(field, message) {
        this.validation[`${field}Error`] = message;
        const errorElement = this.container.querySelector(`#${field}-error`);
        const inputElement = this.container.querySelector(`#mobile-${field}`);
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        if (inputElement) {
            inputElement.classList.add('mobile-error');
        }
    }

    clearFieldError(field) {
        this.validation[`${field}Error`] = null;
        const errorElement = this.container.querySelector(`#${field}-error`);
        const inputElement = this.container.querySelector(`#mobile-${field}`);
        
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        if (inputElement) {
            inputElement.classList.remove('mobile-error');
        }
    }

    // Authentication Methods
    async performLogin() {
        this.setLoading(true);
        this.clearMessages();
        
        try {
            // Determine backend URL
            const backendUrl = this.getBackendUrl();
            
            const response = await fetch(`${backendUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.formData.email,
                    password: this.formData.password
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            
            // Store authentication data
            this.storeAuthData(data);
            
            // Show success message
            this.showSuccess('Login successful! Redirecting...');
            
            // Navigate to lobby after short delay
            setTimeout(() => {
                this.navigateToLobby();
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'Login failed. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    getBackendUrl() {
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:3000';
        } else {
            return 'https://rummikub-backend.onrender.com';
        }
    }

    storeAuthData(data) {
        if (this.formData.rememberMe) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('username', data.user.username);
            localStorage.setItem('user_id', data.user.id);
            localStorage.setItem('user_email', data.user.email);
            localStorage.setItem('is_admin', data.user.isAdmin);
        } else {
            // Use sessionStorage for temporary storage
            sessionStorage.setItem('auth_token', data.token);
            sessionStorage.setItem('username', data.user.username);
            sessionStorage.setItem('user_id', data.user.id);
            sessionStorage.setItem('user_email', data.user.email);
            sessionStorage.setItem('is_admin', data.user.isAdmin);
        }
    }

    navigateToLobby() {
        this.hide();
        
        // Emit navigation event
        if (window.mobileUISystem) {
            window.mobileUISystem.emit('navigateToLobby');
        }
        
        // Fallback navigation
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 100);
    }

    // UI State Methods
    setLoading(loading) {
        this.isLoading = loading;
        const button = this.container.querySelector('#mobile-login-button');
        const buttonText = button.querySelector('.button-text');
        const buttonLoading = button.querySelector('.button-loading');
        
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            buttonText.style.display = 'none';
            buttonLoading.style.display = 'flex';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            buttonText.style.display = 'block';
            buttonLoading.style.display = 'none';
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type = 'info') {
        const errorElement = this.container.querySelector('#mobile-login-error');
        const successElement = this.container.querySelector('#mobile-login-success');
        
        // Hide all messages first
        errorElement.style.display = 'none';
        successElement.style.display = 'none';
        
        // Show appropriate message
        if (type === 'error') {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else if (type === 'success') {
            successElement.textContent = message;
            successElement.style.display = 'block';
        }
        
        // Auto-hide info messages
        if (type === 'info') {
            setTimeout(() => {
                this.clearMessages();
            }, 3000);
        }
    }

    clearMessages() {
        const errorElement = this.container.querySelector('#mobile-login-error');
        const successElement = this.container.querySelector('#mobile-login-success');
        
        if (errorElement) errorElement.style.display = 'none';
        if (successElement) successElement.style.display = 'none';
    }

    // Public API Methods
    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.container.style.display = 'flex';
        
        // Trigger orientation management
        if (window.mobileUISystem) {
            const orientationManager = window.mobileUISystem.getComponent('orientationManager');
            if (orientationManager) {
                orientationManager.lockOrientation('portrait');
            }
        }
        
        // Focus first input after animation
        setTimeout(() => {
            const emailInput = this.container.querySelector('#mobile-email');
            if (emailInput) {
                emailInput.focus();
            }
        }, 300);
        
        // Add screen class to body
        document.body.classList.add('screen-login');
    }

    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.container.style.display = 'none';
        
        // Clear form data
        this.resetForm();
        
        // Remove screen class from body
        document.body.classList.remove('screen-login');
    }

    resetForm() {
        const form = this.container.querySelector('#mobile-login-form');
        form.reset();
        
        this.formData = {
            email: '',
            password: '',
            rememberMe: false
        };
        
        this.clearMessages();
        this.clearFieldError('email');
        this.clearFieldError('password');
        this.setLoading(false);
    }

    isCurrentlyVisible() {
        return this.isVisible;
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // Remove screen class from body
        document.body.classList.remove('screen-login');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileLoginScreen;
} else if (typeof window !== 'undefined') {
    window.MobileLoginScreen = MobileLoginScreen;
}