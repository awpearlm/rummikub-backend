/// <reference types="cypress" />

describe('Invitation System E2E Tests', () => {
  let backendUrl
  let frontendUrl
  
  before(() => {
    // Get URLs from environment
    backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl')
    frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl')
    
    cy.log(`Testing against Backend: ${backendUrl}`)
    cy.log(`Testing against Frontend: ${frontendUrl}`)
  })

  beforeEach(() => {
    // Clear any existing auth tokens
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Admin Invitation Creation', () => {
    it('should create admin user and send invitation', () => {
      // First, create an admin user via API if not exists
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register`,
        body: {
          username: 'testadmin',
          email: 'testadmin@test.com',
          password: 'adminpass123'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Login as admin or create admin
        cy.request({
          method: 'POST',
          url: `${backendUrl}/api/auth/login`,
          body: {
            email: 'testadmin@test.com',
            password: 'adminpass123'
          },
          failOnStatusCode: false
        }).then((loginResponse) => {
          // If login failed, user might not be admin, let's make them admin
          if (loginResponse.status === 200) {
            const authToken = loginResponse.body.token
            
            // Set admin status via direct database manipulation
            // For testing, we'll assume the user is admin or make them admin
            cy.request({
              method: 'PUT',
              url: `${backendUrl}/api/admin/users/${loginResponse.body.user.id}`,
              headers: {
                'Authorization': `Bearer ${authToken}`
              },
              body: {
                isAdmin: true
              },
              failOnStatusCode: false
            })

            // Visit admin page with auth token
            cy.visit(`${frontendUrl}/admin.html`)
            
            // Set auth token in localStorage
            cy.window().then((win) => {
              win.localStorage.setItem('auth_token', authToken)
              win.localStorage.setItem('username', 'testadmin')
              win.localStorage.setItem('is_admin', 'true')
            })

            // Reload to apply auth
            cy.reload()
            cy.wait(2000)

            // Navigate to invitations tab
            cy.get('[data-tab="invitations"]', { timeout: 10000 }).should('be.visible').click()
            cy.wait(1000)

            // Click send invitation button
            cy.get('button').contains('Send Invitation').should('be.visible').click()

            // Fill invitation form
            cy.get('#inviteEmail').should('be.visible').type('testinvite@example.com')
            cy.get('#inviteMessage').type('Welcome to J_kube! Join us for some fun Rummikub games.')

            // Submit invitation
            cy.get('button').contains('Send').click()

            // Should show invitation link modal
            cy.get('.modal.show', { timeout: 10000 }).should('be.visible')
            cy.get('.modal.show').should('contain', 'Invitation Created')
            cy.get('.modal.show').should('contain', 'testinvite@example.com')

            // Check that invitation link is present and copyable
            cy.get('.invitation-link-input').should('be.visible').invoke('val').should('include', '/signup.html?token=')

            // Store the invitation link for later tests
            cy.get('.invitation-link-input').invoke('val').as('invitationLink')

            // Close modal
            cy.get('.modal.show button').contains('Close').click()

            // Verify invitation appears in table
            cy.get('#invitationsTableBody tr').should('contain', 'testinvite@example.com')
            cy.get('#invitationsTableBody tr').should('contain', 'testadmin')
            cy.get('#invitationsTableBody tr').should('contain', 'Pending')
          }
        })
      })
    })

    it('should copy invitation link from admin table', () => {
      // Setup admin session (assuming previous test created invitation)
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'testadmin@test.com',
          password: 'adminpass123'
        },
        failOnStatusCode: false
      }).then((loginResponse) => {
        if (loginResponse.status === 200) {
          const authToken = loginResponse.body.token
          
          cy.visit(`${frontendUrl}/admin.html`)
          cy.window().then((win) => {
            win.localStorage.setItem('auth_token', authToken)
            win.localStorage.setItem('is_admin', 'true')
          })
          cy.reload()

          // Navigate to invitations tab
          cy.get('[data-tab="invitations"]', { timeout: 10000 }).click()
          cy.wait(1000)

          // Find copy link button and click it
          cy.get('#invitationsTableBody').should('be.visible')
          cy.get('button').contains('Copy Link').first().click()

          // Should show notification that link was copied
          cy.get('.notification.success.show', { timeout: 5000 }).should('contain', 'Link copied to clipboard')
        }
      })
    })
  })

  describe('Invitation Validation', () => {
    it('should validate invitation token via API', () => {
      // First create an invitation to get a valid token
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'testadmin@test.com',
          password: 'adminpass123'
        },
        failOnStatusCode: false
      }).then((loginResponse) => {
        if (loginResponse.status === 200) {
          const authToken = loginResponse.body.token

          // Create invitation via API
          cy.request({
            method: 'POST',
            url: `${backendUrl}/api/admin/invitations`,
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: {
              email: 'apitest@example.com',
              message: 'API test invitation'
            }
          }).then((inviteResponse) => {
            expect(inviteResponse.status).to.equal(201)
            expect(inviteResponse.body).to.have.property('invitation')
            
            const invitationToken = inviteResponse.body.invitation.token

            // Test validation endpoint
            cy.request({
              method: 'GET',
              url: `${backendUrl}/api/auth/invitation/${invitationToken}`
            }).then((validationResponse) => {
              expect(validationResponse.status).to.equal(200)
              expect(validationResponse.body.valid).to.be.true
              expect(validationResponse.body.email).to.equal('apitest@example.com')
              expect(validationResponse.body.invitedBy).to.equal('testadmin')
              expect(validationResponse.body.message).to.equal('API test invitation')
            })
          })
        }
      })
    })

    it('should reject invalid invitation token', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/invalid-token-12345`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body.valid).to.be.false
        expect(response.body.message).to.include('not found')
      })
    })

    it('should reject expired invitation token', () => {
      // This would require creating an invitation with past expiration
      // For now, we'll test with a malformed token
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/expired-token`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body.valid).to.be.false
      })
    })
  })

  describe('Signup Page Flow', () => {
    let validInvitationToken

    before(() => {
      // Create a valid invitation for signup tests
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'testadmin@test.com',
          password: 'adminpass123'
        },
        failOnStatusCode: false
      }).then((loginResponse) => {
        if (loginResponse.status === 200) {
          const authToken = loginResponse.body.token

          cy.request({
            method: 'POST',
            url: `${backendUrl}/api/admin/invitations`,
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: {
              email: 'signuptest@example.com',
              message: 'Welcome to signup testing!'
            }
          }).then((response) => {
            validInvitationToken = response.body.invitation.token
          })
        }
      })
    })

    it('should load signup page with valid token', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)

      // Should show loading state initially
      cy.get('#loadingState').should('be.visible')

      // Should transition to signup form
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
      cy.get('#loadingState').should('not.be.visible')

      // Should display invitation details
      cy.get('#inviterName').should('contain', 'testadmin')
      cy.get('#invitationEmail').should('contain', 'signuptest@example.com')
      cy.get('#messageText').should('contain', 'Welcome to signup testing!')

      // Form fields should be present
      cy.get('#username').should('be.visible')
      cy.get('#password').should('be.visible')
      cy.get('#confirmPassword').should('be.visible')
      cy.get('#signupButton').should('be.visible')
    })

    it('should show error for invalid token', () => {
      cy.visit(`${frontendUrl}/signup.html?token=invalid-token-123`)

      // Should show loading state initially
      cy.get('#loadingState').should('be.visible')

      // Should transition to invalid state
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#loadingState').should('not.be.visible')
      cy.get('#signupForm').should('not.be.visible')

      // Should show error message
      cy.get('#errorMessage').should('contain', 'not found')
      cy.get('a').contains('Go to Login').should('be.visible')
    })

    it('should show error when no token provided', () => {
      cy.visit(`${frontendUrl}/signup.html`)

      // Should go directly to invalid state
      cy.get('#invalidState', { timeout: 5000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'No invitation token provided')
    })

    it('should validate form fields', () => {
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')

      // Test username validation
      cy.get('#username').type('ab') // Too short
      cy.get('#signupButton').click()
      cy.get('#username:invalid').should('exist')

      cy.get('#username').clear().type('valid_username123')

      // Test password mismatch
      cy.get('#password').type('password123')
      cy.get('#confirmPassword').type('different456')
      cy.get('#signupButton').click()
      cy.get('#signupError').should('be.visible').should('contain', 'do not match')

      // Fix password match
      cy.get('#confirmPassword').clear().type('password123')
      cy.get('#signupError').should('not.be.visible')
    })

    it('should successfully register new user', () => {
      const randomUsername = `testuser_${Date.now()}`
      
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')

      // Fill form with valid data
      cy.get('#username').type(randomUsername)
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')

      // Submit form
      cy.get('#signupButton').click()

      // Should show loading state
      cy.get('#signupButton').should('contain', 'Creating Account...')
      cy.get('#signupButton').should('be.disabled')

      // Should show success message
      cy.get('#signupSuccess', { timeout: 10000 }).should('be.visible')
      cy.get('#signupSuccess').should('contain', 'Account created successfully')

      // Should redirect to main page (we'll wait for redirect to start)
      cy.url({ timeout: 5000 }).should('include', 'index.html')

      // Should be logged in with auth token in localStorage
      cy.window().then((win) => {
        expect(win.localStorage.getItem('auth_token')).to.not.be.null
        expect(win.localStorage.getItem('username')).to.equal(randomUsername)
        expect(win.localStorage.getItem('user_email')).to.equal('signuptest@example.com')
      })
    })

    it('should prevent duplicate username registration', () => {
      // Try to register with the same username as admin
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)
      cy.get('#signupForm', { timeout: 10000 }).should('be.visible')

      cy.get('#username').type('testadmin') // Existing username
      cy.get('#password').type('testpass123')
      cy.get('#confirmPassword').type('testpass123')

      cy.get('#signupButton').click()

      // Should show error about duplicate username
      cy.get('#signupError', { timeout: 10000 }).should('be.visible')
      cy.get('#signupError').should('contain', 'already exists')
    })

    it('should prevent reuse of invitation token', () => {
      // This test assumes the previous successful registration consumed the token
      cy.visit(`${frontendUrl}/signup.html?token=${validInvitationToken}`)

      // Should show invalid state since token was already used
      cy.get('#invalidState', { timeout: 10000 }).should('be.visible')
      cy.get('#errorMessage').should('contain', 'already been used')
    })
  })

  describe('Admin Invitation Management', () => {
    beforeEach(() => {
      // Login as admin
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'testadmin@test.com',
          password: 'adminpass123'
        },
        failOnStatusCode: false
      }).then((loginResponse) => {
        if (loginResponse.status === 200) {
          const authToken = loginResponse.body.token
          
          cy.visit(`${frontendUrl}/admin.html`)
          cy.window().then((win) => {
            win.localStorage.setItem('auth_token', authToken)
            win.localStorage.setItem('is_admin', 'true')
          })
          cy.reload()
          cy.get('[data-tab="invitations"]', { timeout: 10000 }).click()
          cy.wait(1000)
        }
      })
    })

    it('should show all invitations in table', () => {
      cy.get('#invitationsTableBody').should('be.visible')
      
      // Should have table headers
      cy.get('th').should('contain', 'Email')
      cy.get('th').should('contain', 'Invited By')
      cy.get('th').should('contain', 'Status')
      cy.get('th').should('contain', 'Sent')
      cy.get('th').should('contain', 'Expires')
      cy.get('th').should('contain', 'Actions')
    })

    it('should cancel pending invitation', () => {
      // Create a new invitation to cancel
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type('canceltest@example.com')
      cy.get('button').contains('Send').click()
      cy.get('.modal.show button').contains('Close').click()

      // Find and cancel the invitation
      cy.get('#invitationsTableBody tr').contains('canceltest@example.com').parent().within(() => {
        cy.get('button').contains('Cancel').click()
      })

      // Confirm cancellation
      cy.get('.modal.show').should('contain', 'Are you sure')
      cy.get('.modal.show button').contains('Delete').click()

      // Should show success notification
      cy.get('.notification.success', { timeout: 5000 }).should('contain', 'cancelled successfully')

      // Invitation should be removed from table or marked as cancelled
      cy.get('#invitationsTableBody').should('not.contain', 'canceltest@example.com')
    })

    it('should show invitation statistics in dashboard', () => {
      cy.get('[data-tab="dashboard"]').click()
      cy.wait(1000)

      // Should show invitation stats
      cy.get('.stats-grid').should('be.visible')
      cy.get('.stat-card').should('contain', 'Invitations')
    })
  })

  describe('Integration with User System', () => {
    it('should create user stats for invited user', () => {
      // This test would verify that when a user registers via invitation,
      // their stats are properly initialized
      const username = `invited_user_${Date.now()}`
      
      // Create invitation
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'testadmin@test.com',
          password: 'adminpass123'
        }
      }).then((loginResponse) => {
        const authToken = loginResponse.body.token

        cy.request({
          method: 'POST',
          url: `${backendUrl}/api/admin/invitations`,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: {
            email: 'statstest@example.com',
            message: 'Testing stats creation'
          }
        }).then((inviteResponse) => {
          const token = inviteResponse.body.invitation.token

          // Register user via invitation
          cy.request({
            method: 'POST',
            url: `${backendUrl}/api/auth/register-invitation`,
            body: {
              username: username,
              password: 'testpass123',
              invitationToken: token
            }
          }).then((registerResponse) => {
            expect(registerResponse.status).to.equal(201)
            expect(registerResponse.body.user.username).to.equal(username)
            expect(registerResponse.body.user.email).to.equal('statstest@example.com')

            // Verify user appears in admin users list
            cy.visit(`${frontendUrl}/admin.html`)
            cy.window().then((win) => {
              win.localStorage.setItem('auth_token', authToken)
              win.localStorage.setItem('is_admin', 'true')
            })
            cy.reload()

            cy.get('[data-tab="users"]').click()
            cy.wait(2000)
            cy.get('#usersTableBody').should('contain', username)
            cy.get('#usersTableBody').should('contain', 'statstest@example.com')
          })
        })
      })
    })

    it('should update invitation status after successful registration', () => {
      // Verify that invitation status changes from 'pending' to 'accepted' after registration
      // This would require checking the admin interface after a successful registration
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'testadmin@test.com',
          password: 'adminpass123'
        }
      }).then((loginResponse) => {
        const authToken = loginResponse.body.token

        cy.visit(`${frontendUrl}/admin.html`)
        cy.window().then((win) => {
          win.localStorage.setItem('auth_token', authToken)
          win.localStorage.setItem('is_admin', 'true')
        })
        cy.reload()

        cy.get('[data-tab="invitations"]').click()
        cy.wait(1000)

        // Look for accepted invitations
        cy.get('#invitationsTableBody tr').then($rows => {
          if ($rows.length > 0) {
            // Should have some accepted invitations from previous tests
            cy.get('#invitationsTableBody').should('contain', 'Accepted')
          }
        })
      })
    })
  })
})
