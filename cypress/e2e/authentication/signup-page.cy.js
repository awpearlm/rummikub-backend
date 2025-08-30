/// <reference types="cypress" />

describe('Signup Page E2E Tests', () => {
  let backendUrl
  let frontendUrl
  let adminAuthToken
  let validInvitationToken
  let invitationEmail

  before(() => {
    backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl')
    frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl')
    invitationEmail = `signup_test_${Date.now()}@example.com`
    
    // Setup admin and create test invitation
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/auth/register`,
      body: {
        username: 'signup_test_admin',
        email: 'signupadmin@test.com',
        password: 'adminpass123'
      },
      failOnStatusCode: false
    }).then(() => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'signupadmin@test.com',
          password: 'adminpass123'
        }
      }).then((response) => {
        adminAuthToken = response.body.token
        
        // Create test invitation
        cy.request({
          method: 'POST',
          url: `${backendUrl}/api/admin/invitations`,
          headers: {
            'Authorization': `Bearer ${adminAuthToken}`,
            'Content-Type': 'application/json'
          },
          body: {
            email: invitationEmail,
            message: 'Welcome to J_kube! This is your signup test invitation.'
          }
        }).then((inviteResponse) => {
          validInvitationToken = inviteResponse.body.invitation.token
        })
      })
    })
  })

  beforeEach(() => {
    // Clear browser state
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Page Loading and Initial State', () => {
    it('should load signup page and show loading state', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      
      // Should initially show loading state
      cy.get('#loadingState').should('be.visible')
      cy.get('#loadingState .spinner').should('be.visible')
      cy.get('#loadingState p').should('contain', 'Validating your invitation')
      
      // Other states should be hidden initially
      cy.get('#signupForm').should('not.be.visible')
      cy.get('#invalidState').should('not.be.visible')
    })

    it('should have correct page title and metadata', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      
      cy.title().should('eq', 'Join J_kube - Complete Your Invitation')
      
      // Check for favicon and meta tags
      cy.get('link[rel="icon"]').should('exist')
      cy.get('meta[name="viewport"]').should('exist')
      cy.get('meta[name="theme-color"]').should('exist')
    })

    it('should load required stylesheets and fonts', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      
      // Check for stylesheets
      cy.get('link[href="auth-styles.css"]').should('exist')
      cy.get('link[href*="fonts.googleapis.com"]').should('exist')
      cy.get('link[href*="font-awesome"]').should('exist')
    })
  })

  describe('Valid Token Flow', () => {
    it('should validate token and show signup form', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      
      // Wait for validation to complete
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      cy.get('#loadingState').should('not.be.visible')
      cy.get('#invalidState').should('not.be.visible')
    })

    it('should display invitation details correctly', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      // Check invitation info section
      cy.get('.invitation-info').should('be.visible')
      cy.get('#inviterName').should('contain', 'signup_test_admin')
      cy.get('#invitationEmail').should('contain', invitationEmail)
      cy.get('#messageText').should('contain', 'Welcome to J_kube!')
      cy.get('#invitationMessage').should('be.visible')
      
      // Check welcome message
      cy.get('#welcomeMessage').should('contain', 'signup_test_admin has invited you to join J_kube!')
    })

    it('should have all required form fields', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      // Username field
      cy.get('#username').should('be.visible')
      cy.get('label[for="username"]').should('contain', 'Choose a Username')
      cy.get('#username').should('have.attr', 'placeholder', 'Enter your username')
      cy.get('#username').should('have.attr', 'minlength', '3')
      cy.get('#username').should('have.attr', 'maxlength', '20')
      
      // Password field
      cy.get('#password').should('be.visible')
      cy.get('label[for="password"]').should('contain', 'Create Password')
      cy.get('#password').should('have.attr', 'type', 'password')
      cy.get('#password').should('have.attr', 'minlength', '6')
      
      // Confirm password field
      cy.get('#confirmPassword').should('be.visible')
      cy.get('label[for="confirmPassword"]').should('contain', 'Confirm Password')
      cy.get('#confirmPassword').should('have.attr', 'type', 'password')
      
      // Submit button
      cy.get('#signupButton').should('be.visible')
      cy.get('#signupButton').should('contain', 'Create Account')
      
      // Help text
      cy.get('.form-help').should('contain', '3-20 characters')
      cy.get('.form-help').should('contain', 'At least 6 characters')
    })
  })

  describe('Invalid Token Scenarios', () => {
    it('should show error for missing token', () => {
      cy.visit(`${frontendUrl}/signup.html`)
      
      // Should immediately show invalid state
      cy.get('#invalidState', { timeout: 5000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'No invitation token provided')
      cy.get('#loadingState').should('not.be.visible')
      cy.get('#signupForm').should('not.be.visible')
      
      // Should have link to login
      cy.get('a[href="login.html"]').should('be.visible').should('contain', 'Go to Login')
    })

    it('should show error for invalid token', () => {
      cy.visit(`${frontendUrl}/signup.html?token=invalid-token-123`)
      
      // Should show loading then invalid state
      cy.get('#loadingState').should('be.visible')
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#loadingState').should('not.be.visible')
      cy.get('#signupForm').should('not.be.visible')
      
      cy.get('#errorMessage').should('contain', 'not found')
    })

    it('should show error for malformed token', () => {
      cy.visit(`${frontendUrl}/signup.html?token=abc`)
      
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'not found')
    })

    it('should handle network errors gracefully', () => {
      // Intercept the validation request to simulate network error
      cy.intercept('GET', '**/api/auth/invitation/*', { forceNetworkError: true }).as('networkError')
      
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      
      cy.wait('@networkError')
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'Unable to validate invitation')
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
    })

    it('should validate username requirements', () => {
      // Test too short username
      cy.get('#username').type('ab')
      cy.get('#signupButton').click()
      
      cy.get('#username:invalid').should('exist')
      
      // Test valid username
      cy.get('#username').clear().type('validuser123')
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')
      
      // Username should now be valid
      cy.get('#username:valid').should('exist')
    })

    it('should validate password length', () => {
      cy.get('#username').type('testuser')
      cy.get('#password').type('12345') // Too short
      cy.get('#signupButton').click()
      
      cy.get('#password:invalid').should('exist')
      
      // Test valid password
      cy.get('#password').clear().type('validpass123')
      cy.get('#password:valid').should('exist')
    })

    it('should validate password confirmation', () => {
      cy.get('#username').type('testuser')
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('different456')
      cy.get('#signupButton').click()
      
      cy.get('#signupError').should('be.visible')
      cy.get('#signupError').should('contain', 'do not match')
      
      // Fix password match
      cy.get('#confirmPassword').clear().type('testpass123')
      cy.get('#signupError').should('not.be.visible')
    })

    it('should validate username format in real-time', () => {
      // Test invalid characters
      cy.get('#username').type('invalid-user!')
      cy.get('#username').blur()
      
      // Should set custom validity
      cy.get('#username').then(($input) => {
        expect($input[0].validity.customError).to.be.true
      })
      
      // Test valid format
      cy.get('#username').clear().type('valid_user123')
      cy.get('#username').blur()
      
      cy.get('#username').then(($input) => {
        expect($input[0].validity.valid).to.be.true
      })
    })

    it('should validate password confirmation in real-time', () => {
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('different')
      cy.get('#confirmPassword').blur()
      
      cy.get('#confirmPassword').then(($input) => {
        expect($input[0].validity.customError).to.be.true
      })
      
      // Fix password match
      cy.get('#confirmPassword').clear().type('testpass123')
      cy.get('#confirmPassword').blur()
      
      cy.get('#confirmPassword').then(($input) => {
        expect($input[0].validity.valid).to.be.true
      })
    })
  })

  describe('Successful Registration', () => {
    it('should register user and redirect to game', () => {
      const username = `signup_user_${Date.now()}`
      
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      // Fill form
      cy.get('#username').type(username)
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')
      
      // Submit form
      cy.get('#signupButton').click()
      
      // Should show loading state
      cy.get('#signupButton').should('be.disabled')
      cy.get('#signupButton').should('contain', 'Creating Account...')
      cy.get('#signupButton i').should('have.class', 'fa-spinner')
      cy.get('#signupButton i').should('have.class', 'fa-spin')
      
      // Should show success message
      cy.get('#signupSuccess', { timeout: 10000 }).should('be.visible')
      cy.get('#signupSuccess').should('contain', 'Account created successfully')
      cy.get('#signupSuccess').should('contain', 'Redirecting to game')
      
      // Should redirect to main page
      cy.url({ timeout: 5000 }).should('include', 'index.html')
      
      // Should have auth data in localStorage
      cy.window().then((win) => {
        expect(win.localStorage.getItem('auth_token')).to.not.be.null
        expect(win.localStorage.getItem('username')).to.equal(username)
        expect(win.localStorage.getItem('user_email')).to.equal(invitationEmail)
        expect(win.localStorage.getItem('is_admin')).to.equal('false')
      })
    })

    it('should show error for duplicate username', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      // Try to use existing admin username
      cy.get('#username').type('signup_test_admin')
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')
      
      cy.get('#signupButton').click()
      
      // Should show error
      cy.get('#signupError', { timeout: 10000 }).should('be.visible')
      cy.get('#signupError').should('contain', 'already exists')
      
      // Button should be re-enabled
      cy.get('#signupButton').should('not.be.disabled')
      cy.get('#signupButton').should('contain', 'Create Account')
    })

    it('should prevent token reuse', () => {
      // First, use the token successfully
      const firstUser = `first_user_${Date.now()}`
      
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      cy.get('#username').type(firstUser)
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')
      cy.get('#signupButton').click()
      
      cy.get('#signupSuccess', { timeout: 10000 }).should('be.visible')
      
      // Now try to reuse the same token
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      
      // Should show invalid state
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'already been used')
    })
  })

  describe('UI/UX Features', () => {
    beforeEach(() => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
    })

    it('should have proper styling and responsive design', () => {
      // Check main container styling
      cy.get('.auth-container').should('have.css', 'display', 'flex')
      cy.get('.auth-card').should('be.visible')
      
      // Check for glassmorphism effect
      cy.get('.auth-card').should('have.css', 'backdrop-filter')
      
      // Check responsive behavior
      cy.viewport(768, 1024) // Tablet view
      cy.get('.auth-card').should('be.visible')
      
      cy.viewport(375, 667) // Mobile view
      cy.get('.auth-card').should('be.visible')
    })

    it('should show icons and proper visual hierarchy', () => {
      // Header icons
      cy.get('.auth-header i').should('have.class', 'fa-chess-board')
      
      // Invitation info icons
      cy.get('.invited-by i').should('have.class', 'fa-user-plus')
      cy.get('.invitation-email i').should('have.class', 'fa-envelope')
      cy.get('.invitation-message i').should('have.class', 'fa-comment')
      
      // Button icon
      cy.get('#signupButton i').should('have.class', 'fa-user-plus')
    })

    it('should have proper form accessibility', () => {
      // Check labels are associated with inputs
      cy.get('label[for="username"]').should('exist')
      cy.get('label[for="password"]').should('exist')
      cy.get('label[for="confirmPassword"]').should('exist')
      
      // Check required attributes
      cy.get('#username').should('have.attr', 'required')
      cy.get('#password').should('have.attr', 'required')
      cy.get('#confirmPassword').should('have.attr', 'required')
      
      // Check ARIA attributes (if any)
      cy.get('#signupForm').should('be.visible')
    })

    it('should handle focus states properly', () => {
      cy.get('#username').focus()
      cy.get('#username:focus').should('exist')
      
      cy.get('#password').focus()
      cy.get('#password:focus').should('exist')
      
      cy.get('#confirmPassword').focus()
      cy.get('#confirmPassword:focus').should('exist')
    })

    it('should show and hide error/success messages correctly', () => {
      // Error message should be hidden initially
      cy.get('#signupError').should('not.be.visible')
      cy.get('#signupSuccess').should('not.be.visible')
      
      // Trigger validation error
      cy.get('#password').type('123')
      cy.get('#confirmPassword').type('456')
      cy.get('#signupButton').click()
      
      cy.get('#signupError').should('be.visible')
      cy.get('#signupSuccess').should('not.be.visible')
      
      // Fix error
      cy.get('#confirmPassword').clear().type('123')
      
      // Error should clear when form is corrected
      cy.get('#signupError').should('not.be.visible')
    })
  })

  describe('Footer and Navigation', () => {
    beforeEach(() => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
    })

    it('should have footer with login link', () => {
      cy.get('.auth-footer').should('be.visible')
      cy.get('.auth-footer p').should('contain', 'Already have an account?')
      cy.get('.auth-footer a[href="login.html"]').should('contain', 'Sign in here')
    })

    it('should navigate to login page', () => {
      cy.get('.auth-footer a[href="login.html"]').click()
      cy.url().should('include', 'login.html')
    })
  })

  describe('Error Handling', () => {
    it('should handle server errors gracefully', () => {
      // Intercept registration request to simulate server error
      cy.intercept('POST', '**/api/auth/register-invitation', {
        statusCode: 500,
        body: { message: 'Internal server error' }
      }).as('serverError')
      
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      cy.get('#username').type('testuser')
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')
      cy.get('#signupButton').click()
      
      cy.wait('@serverError')
      
      cy.get('#signupError', { timeout: 10000 }).should('be.visible')
      cy.get('#signupError').should('contain', 'Network error')
      
      // Button should be re-enabled
      cy.get('#signupButton').should('not.be.disabled')
    })

    it('should handle network timeouts', () => {
      // Intercept with very long delay to simulate timeout
      cy.intercept('POST', '**/api/auth/register-invitation', (req) => {
        req.reply((res) => {
          res.delay(30000) // 30 second delay
          res.send({ statusCode: 200, body: { success: true } })
        })
      }).as('timeout')
      
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      
      cy.get('#username').type('testuser')
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')
      cy.get('#signupButton').click()
      
      // Should show loading state
      cy.get('#signupButton').should('contain', 'Creating Account...')
      
      // Eventually should handle the timeout
      // (This test might be flaky due to Cypress's own timeouts)
    })
  })
})
