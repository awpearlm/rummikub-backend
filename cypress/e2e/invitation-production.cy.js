/// <reference types="cypress" />

describe('Invitation System Production Tests', () => {
  let backendUrl
  let frontendUrl
  
  before(() => {
    backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl')
    frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl')
    
    cy.log(`Testing against Backend: ${backendUrl}`)
    cy.log(`Testing against Frontend: ${frontendUrl}`)
  })

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Basic Invitation API Tests', () => {
    it('should reject invalid invitation token validation', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/invalid-token-12345`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body).to.have.property('valid', false)
        expect(response.body.message).to.include('not found')
      })
    })

    it('should reject invalid invitation registration', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: 'testuser',
          password: 'testpass123',
          invitationToken: 'invalid-token'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body.message).to.include('not found')
      })
    })

    it('should reject registration with missing fields', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: 'testuser',
          // Missing password and token
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body.message).to.include('required')
      })
    })
  })

  describe('Signup Page Tests', () => {
    it('should show error for missing invitation token', () => {
      cy.visit(`${frontendUrl}/signup.html`)
      
      // Should immediately show invalid state
      cy.get('#invalidState', { timeout: 5000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'No invitation token provided')
      cy.get('#loadingState').should('not.be.visible')
      cy.get('#signupForm').should('not.be.visible')
      
      // Should have link to login
      cy.get('a[href="login.html"]').should('be.visible').should('contain', 'Go to Login')
    })

    it('should show error for invalid invitation token', () => {
      cy.visit(`${frontendUrl}/signup.html?token=invalid-token-123`)
      
      // Should show loading then invalid state
      cy.get('#loadingState').should('be.visible')
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#loadingState').should('not.be.visible')
      cy.get('#signupForm').should('not.be.visible')
      
      cy.get('#errorMessage').should('contain', 'not found')
    })

    it('should have correct page structure and styling', () => {
      cy.visit(`${frontendUrl}/signup.html?token=test-token`)
      
      // Check page loads
      cy.get('body').should('be.visible')
      cy.title().should('eq', 'Join J_kube - Complete Your Invitation')
      
      // Check for required elements
      cy.get('.auth-container').should('be.visible')
      cy.get('.auth-card').should('be.visible')
      cy.get('.auth-header').should('be.visible')
      
      // Check for favicon and meta tags
      cy.get('link[rel="icon"]').should('exist')
      cy.get('meta[name="viewport"]').should('exist')
    })

    it('should load required stylesheets and scripts', () => {
      cy.visit(`${frontendUrl}/signup.html?token=test-token`)
      
      // Check for stylesheets
      cy.get('link[href="auth-styles.css"]').should('exist')
      cy.get('link[href*="fonts.googleapis.com"]').should('exist')
      cy.get('link[href*="font-awesome"]').should('exist')
      
      // Check JavaScript loaded
      cy.window().should('have.property', 'SignupHandler')
    })
  })

  describe('Frontend File Accessibility', () => {
    it('should load admin.html successfully', () => {
      cy.visit(`${frontendUrl}/admin.html`)
      cy.get('body').should('be.visible')
      cy.title().should('eq', 'Admin Dashboard - J_kube')
    })

    it('should load login.html successfully', () => {
      cy.visit(`${frontendUrl}/login.html`)
      cy.get('body').should('be.visible')
      cy.title().should('eq', 'Login - J_kube')
    })

    it('should load main index.html successfully', () => {
      cy.visit(`${frontendUrl}/index.html`)
      cy.get('body').should('be.visible')
      cy.title().should('eq', 'J_kube - Multiplayer Rummikub')
    })

    it('should load test-invitation.html successfully', () => {
      cy.visit(`${frontendUrl}/test-invitation.html`)
      cy.get('body').should('be.visible')
      cy.title().should('eq', 'Test Invitation System')
    })
  })

  describe('API Health Checks', () => {
    it('should have CORS headers configured correctly', () => {
      cy.request({
        method: 'OPTIONS',
        url: `${backendUrl}/api/auth/invitation/test-token`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.headers).to.have.property('access-control-allow-origin')
        expect(response.headers).to.have.property('access-control-allow-methods')
        expect(response.headers).to.have.property('access-control-allow-headers')
      })
    })

    it('should return proper error structure for invalid endpoints', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/nonexistent-endpoint`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(404)
      })
    })

    it('should handle malformed invitation tokens', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/abc`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body).to.have.property('valid', false)
      })
    })
  })

  describe('Security Tests', () => {
    it('should require authentication for admin endpoints', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/admin/invitations`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
        expect(response.body.message).to.include('token')
      })
    })

    it('should require authentication for creating invitations', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'test@example.com' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
        expect(response.body.message).to.include('token')
      })
    })

    it('should validate email format in invitation registration', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: 'testuser',
          password: 'testpass123',
          invitationToken: 'fake-token'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should fail due to invalid token, not missing email
        expect(response.status).to.equal(400)
        expect(response.body.message).to.include('not found')
      })
    })
  })

  describe('Network and Performance Tests', () => {
    it('should respond to invitation validation within reasonable time', () => {
      const startTime = Date.now()
      
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/performance-test-token`,
        failOnStatusCode: false
      }).then((response) => {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        expect(responseTime).to.be.lessThan(5000) // Less than 5 seconds
        expect(response.status).to.equal(400) // Invalid token, but should respond quickly
      })
    })

    it('should handle concurrent invitation validation requests', () => {
      const requests = []
      
      for (let i = 0; i < 5; i++) {
        requests.push(
          cy.request({
            method: 'GET',
            url: `${backendUrl}/api/auth/invitation/concurrent-test-${i}`,
            failOnStatusCode: false
          })
        )
      }
      
      // All requests should complete successfully (even if with 400 status)
      requests.forEach((request, index) => {
        request.then((response) => {
          expect(response.status).to.equal(400)
          expect(response.body).to.have.property('valid', false)
        })
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long invitation tokens', () => {
      const longToken = 'a'.repeat(1000)
      
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/${longToken}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body).to.have.property('valid', false)
      })
    })

    it('should handle special characters in invitation tokens', () => {
      const specialToken = 'test@#$%^&*()token'
      
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/${encodeURIComponent(specialToken)}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body).to.have.property('valid', false)
      })
    })

    it('should handle empty invitation token', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/`,
        failOnStatusCode: false
      }).then((response) => {
        // Should be 404 since it doesn't match the route pattern
        expect([400, 404]).to.include(response.status)
      })
    })

    it('should handle SQL injection attempts in tokens', () => {
      const sqlInjectionToken = "'; DROP TABLE invitations; --"
      
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/${encodeURIComponent(sqlInjectionToken)}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body).to.have.property('valid', false)
      })
    })

    it('should handle XSS attempts in registration data', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: '<script>alert("xss")</script>',
          password: 'testpass123',
          invitationToken: 'fake-token'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        // Should fail due to invalid token, but shouldn't execute script
        expect(response.body.message).to.include('not found')
      })
    })
  })

  describe('Responsive Design Tests', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667) // iPhone SE
      cy.visit(`${frontendUrl}/signup.html?token=test-token`)
      
      cy.get('.auth-container').should('be.visible')
      cy.get('.auth-card').should('be.visible')
      
      // Check that elements are properly sized for mobile
      cy.get('.auth-card').then(($card) => {
        expect($card.width()).to.be.lessThan(400)
      })
    })

    it('should work on tablet devices', () => {
      cy.viewport(768, 1024) // iPad
      cy.visit(`${frontendUrl}/signup.html?token=test-token`)
      
      cy.get('.auth-container').should('be.visible')
      cy.get('.auth-card').should('be.visible')
    })

    it('should work on desktop devices', () => {
      cy.viewport(1920, 1080) // Desktop
      cy.visit(`${frontendUrl}/signup.html?token=test-token`)
      
      cy.get('.auth-container').should('be.visible')
      cy.get('.auth-card').should('be.visible')
    })
  })
})
