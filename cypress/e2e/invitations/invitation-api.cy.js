/// <reference types="cypress" />

describe('Invitation API Endpoints', () => {
  let backendUrl
  let adminAuthToken
  let testInvitationToken

  before(() => {
    backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl')
    
    // Setup admin user and get auth token
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/auth/register`,
      body: {
        username: 'api_test_admin',
        email: 'apitest@test.com',
        password: 'apitest123'
      },
      failOnStatusCode: false
    }).then(() => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'apitest@test.com',
          password: 'apitest123'
        }
      }).then((response) => {
        adminAuthToken = response.body.token
        
        // Make user admin (this would normally be done via database)
        cy.request({
          method: 'PUT',
          url: `${backendUrl}/api/admin/users/${response.body.user.id}`,
          headers: { 'Authorization': `Bearer ${adminAuthToken}` },
          body: { isAdmin: true },
          failOnStatusCode: false
        })
      })
    })
  })

  describe('POST /api/admin/invitations', () => {
    it('should create invitation with valid admin token', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: {
          email: 'newinvite@test.com',
          message: 'Welcome to our platform!'
        }
      }).then((response) => {
        expect(response.status).to.equal(201)
        expect(response.body).to.have.property('invitation')
        expect(response.body.invitation).to.have.property('token')
        expect(response.body.invitation).to.have.property('email', 'newinvite@test.com')
        expect(response.body.invitation).to.have.property('message', 'Welcome to our platform!')
        expect(response.body.invitation).to.have.property('status', 'pending')
        expect(response.body.invitation).to.have.property('expiresAt')
        
        // Store token for later tests
        testInvitationToken = response.body.invitation.token
        
        // Verify token is a valid format (should be a long random string)
        expect(testInvitationToken).to.match(/^[a-f0-9]{64}$/)
        
        // Verify expiration is set to 7 days from now
        const expiresAt = new Date(response.body.invitation.expiresAt)
        const now = new Date()
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        expect(expiresAt.getTime()).to.be.closeTo(sevenDaysFromNow.getTime(), 60000) // Within 1 minute
      })
    })

    it('should reject invitation creation without auth token', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: { 'Content-Type': 'application/json' },
        body: { email: 'unauthorized@test.com' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
        expect(response.body.message).to.include('token')
      })
    })

    it('should reject invitation creation with invalid email', () => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: { email: 'invalid-email' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body.message).to.include('email')
      })
    })

    it('should prevent duplicate invitations to same email', () => {
      const duplicateEmail = 'duplicate@test.com'
      
      // Create first invitation
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: { email: duplicateEmail }
      }).then((response) => {
        expect(response.status).to.equal(201)
        
        // Try to create duplicate
        cy.request({
          method: 'POST',
          url: `${backendUrl}/api/admin/invitations`,
          headers: {
            'Authorization': `Bearer ${adminAuthToken}`,
            'Content-Type': 'application/json'
          },
          body: { email: duplicateEmail },
          failOnStatusCode: false
        }).then((duplicateResponse) => {
          expect(duplicateResponse.status).to.equal(400)
          expect(duplicateResponse.body.message).to.include('already exists')
        })
      })
    })
  })

  describe('GET /api/admin/invitations', () => {
    it('should list all invitations for admin', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/admin/invitations`,
        headers: { 'Authorization': `Bearer ${adminAuthToken}` }
      }).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.body).to.have.property('invitations')
        expect(response.body.invitations).to.be.an('array')
        
        if (response.body.invitations.length > 0) {
          const invitation = response.body.invitations[0]
          expect(invitation).to.have.property('email')
          expect(invitation).to.have.property('status')
          expect(invitation).to.have.property('sentAt')
          expect(invitation).to.have.property('expiresAt')
          expect(invitation).to.have.property('invitedBy')
        }
      })
    })

    it('should reject invitation list request without auth', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/admin/invitations`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
      })
    })
  })

  describe('GET /api/auth/invitation/:token', () => {
    it('should validate existing invitation token', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/${testInvitationToken}`
      }).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.body).to.have.property('valid', true)
        expect(response.body).to.have.property('email', 'newinvite@test.com')
        expect(response.body).to.have.property('invitedBy', 'api_test_admin')
        expect(response.body).to.have.property('message', 'Welcome to our platform!')
      })
    })

    it('should reject invalid invitation token', () => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}/api/auth/invitation/invalid-token-123`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(400)
        expect(response.body).to.have.property('valid', false)
        expect(response.body.message).to.include('not found')
      })
    })

    it('should reject malformed invitation token', () => {
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

  describe('POST /api/auth/register-invitation', () => {
    let validToken

    beforeEach(() => {
      // Create a fresh invitation for each test
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: {
          email: `register_test_${Date.now()}@test.com`,
          message: 'Registration test invitation'
        }
      }).then((response) => {
        validToken = response.body.invitation.token
      })
    })

    it('should register user with valid invitation token', () => {
      const username = `testuser_${Date.now()}`
      
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: username,
          password: 'testpass123',
          invitationToken: validToken
        }
      }).then((response) => {
        expect(response.status).to.equal(201)
        expect(response.body).to.have.property('user')
        expect(response.body).to.have.property('token')
        expect(response.body.user).to.have.property('username', username)
        expect(response.body.user).to.have.property('email')
        expect(response.body.user).to.have.property('id')
        
        // Verify JWT token is valid
        expect(response.body.token).to.be.a('string')
        expect(response.body.token.split('.')).to.have.length(3) // JWT format
      })
    })

    it('should reject registration with invalid token', () => {
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

    it('should reject registration with duplicate username', () => {
      const duplicateUsername = 'duplicate_user'
      
      // Register first user
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: duplicateUsername,
          password: 'testpass123',
          invitationToken: validToken
        }
      }).then(() => {
        // Create another invitation
        cy.request({
          method: 'POST',
          url: `${backendUrl}/api/admin/invitations`,
          headers: {
            'Authorization': `Bearer ${adminAuthToken}`,
            'Content-Type': 'application/json'
          },
          body: { email: `another_${Date.now()}@test.com` }
        }).then((inviteResponse) => {
          // Try to register with same username
          cy.request({
            method: 'POST',
            url: `${backendUrl}/api/auth/register-invitation`,
            headers: { 'Content-Type': 'application/json' },
            body: {
              username: duplicateUsername,
              password: 'testpass123',
              invitationToken: inviteResponse.body.invitation.token
            },
            failOnStatusCode: false
          }).then((duplicateResponse) => {
            expect(duplicateResponse.status).to.equal(400)
            expect(duplicateResponse.body.message).to.include('already exists')
          })
        })
      })
    })

    it('should prevent reuse of invitation token', () => {
      const username1 = `firstuser_${Date.now()}`
      const username2 = `seconduser_${Date.now()}`
      
      // Register first user
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/register-invitation`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          username: username1,
          password: 'testpass123',
          invitationToken: validToken
        }
      }).then((response) => {
        expect(response.status).to.equal(201)
        
        // Try to reuse same token
        cy.request({
          method: 'POST',
          url: `${backendUrl}/api/auth/register-invitation`,
          headers: { 'Content-Type': 'application/json' },
          body: {
            username: username2,
            password: 'testpass123',
            invitationToken: validToken
          },
          failOnStatusCode: false
        }).then((reuseResponse) => {
          expect(reuseResponse.status).to.equal(400)
          expect(reuseResponse.body.message).to.include('already been used')
        })
      })
    })
  })

  describe('DELETE /api/admin/invitations/:id', () => {
    it('should cancel pending invitation', () => {
      // Create invitation to cancel
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/admin/invitations`,
        headers: {
          'Authorization': `Bearer ${adminAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: { email: 'tocancel@test.com' }
      }).then((createResponse) => {
        const invitationId = createResponse.body.invitation._id
        
        // Cancel the invitation
        cy.request({
          method: 'DELETE',
          url: `${backendUrl}/api/admin/invitations/${invitationId}`,
          headers: { 'Authorization': `Bearer ${adminAuthToken}` }
        }).then((deleteResponse) => {
          expect(deleteResponse.status).to.equal(200)
          expect(deleteResponse.body.message).to.include('deleted')
        })
        
        // Verify invitation is cancelled/deleted
        cy.request({
          method: 'GET',
          url: `${backendUrl}/api/admin/invitations`,
          headers: { 'Authorization': `Bearer ${adminAuthToken}` }
        }).then((listResponse) => {
          const cancelledInvitation = listResponse.body.invitations.find(
            inv => inv._id === invitationId
          )
          expect(cancelledInvitation).to.be.undefined
        })
      })
    })

    it('should reject cancellation without auth', () => {
      cy.request({
        method: 'DELETE',
        url: `${backendUrl}/api/admin/invitations/fake-id`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(401)
      })
    })

    it('should handle cancellation of non-existent invitation', () => {
      cy.request({
        method: 'DELETE',
        url: `${backendUrl}/api/admin/invitations/507f1f77bcf86cd799439011`, // Valid MongoDB ObjectId format
        headers: { 'Authorization': `Bearer ${adminAuthToken}` },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.equal(404)
        expect(response.body.message).to.include('not found')
      })
    })
  })

  describe('Invitation Expiration', () => {
    it('should reject expired invitation token', function() {
      // This test would require manipulating invitation expiration
      // For now, we'll create a conceptual test structure
      
      // In a real test, you might:
      // 1. Create invitation with past expiration date (via direct DB manipulation)
      // 2. Try to validate/use the expired token
      // 3. Verify it's rejected
      
      // Since we can't easily manipulate time in this test environment,
      // we'll skip this test for now
      this.skip()
    })
  })
})
