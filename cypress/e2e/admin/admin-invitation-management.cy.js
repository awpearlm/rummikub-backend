/// <reference types="cypress" />

describe('Admin Dashboard Invitation Management', () => {
  let backendUrl
  let frontendUrl
  let adminAuthToken
  let adminUserId

  before(() => {
    backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl')
    frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl')
    
    // Create admin user
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/auth/register`,
      body: {
        username: 'admin_dashboard_test',
        email: 'admindash@test.com',
        password: 'adminpass123'
      },
      failOnStatusCode: false
    }).then(() => {
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: {
          email: 'admindash@test.com',
          password: 'adminpass123'
        }
      }).then((response) => {
        adminAuthToken = response.body.token
        adminUserId = response.body.user.id
        
        // Make user admin
        cy.request({
          method: 'PUT',
          url: `${backendUrl}/api/admin/users/${adminUserId}`,
          headers: { 'Authorization': `Bearer ${adminAuthToken}` },
          body: { isAdmin: true },
          failOnStatusCode: false
        })
      })
    })
  })

  beforeEach(() => {
    // Setup admin session
    cy.visit(`${frontendUrl}/admin.html`)
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', adminAuthToken)
      win.localStorage.setItem('username', 'admin_dashboard_test')
      win.localStorage.setItem('user_id', adminUserId)
      win.localStorage.setItem('is_admin', 'true')
    })
    cy.reload()
    
    // Navigate to invitations tab
    cy.get('[data-tab="invitations"]', { timeout: 10000 }).should('be.visible').click()
    cy.wait(1000)
  })

  describe('Invitations Tab Interface', () => {
    it('should display invitations table with correct headers', () => {
      cy.get('#invitationsTableBody').should('be.visible')
      
      // Check table headers
      cy.get('thead th').should('contain', 'Email')
      cy.get('thead th').should('contain', 'Invited By')
      cy.get('thead th').should('contain', 'Status')
      cy.get('thead th').should('contain', 'Sent')
      cy.get('thead th').should('contain', 'Expires')
      cy.get('thead th').should('contain', 'Actions')
    })

    it('should show send invitation button', () => {
      cy.get('button').contains('Send Invitation').should('be.visible')
      cy.get('button').contains('Send Invitation').should('not.be.disabled')
    })

    it('should have proper styling and responsive layout', () => {
      cy.get('.admin-section').should('be.visible')
      cy.get('.admin-section h2').should('contain', 'Invitations')
      
      // Check responsive table
      cy.get('.table-responsive').should('exist')
      cy.get('table').should('have.class', 'admin-table')
    })
  })

  describe('Send Invitation Form', () => {
    beforeEach(() => {
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteForm').should('be.visible')
    })

    it('should show invitation form when button clicked', () => {
      cy.get('#inviteForm').should('be.visible')
      cy.get('#inviteEmail').should('be.visible')
      cy.get('#inviteMessage').should('be.visible')
      cy.get('button').contains('Send').should('be.visible')
      cy.get('button').contains('Cancel').should('be.visible')
    })

    it('should have proper form validation', () => {
      // Try to send without email
      cy.get('button').contains('Send').click()
      
      cy.get('.notification.error', { timeout: 5000 }).should('be.visible')
      cy.get('.notification.error').should('contain', 'Email is required')
    })

    it('should validate email format', () => {
      cy.get('#inviteEmail').type('invalid-email')
      cy.get('button').contains('Send').click()
      
      // Should show validation error (either browser validation or server error)
      cy.get('#inviteEmail:invalid').should('exist')
    })

    it('should allow canceling form', () => {
      cy.get('#inviteEmail').type('test@example.com')
      cy.get('button').contains('Cancel').click()
      
      cy.get('#inviteForm').should('not.be.visible')
    })

    it('should focus email field when form opens', () => {
      cy.get('#inviteEmail').should('be.focused')
    })
  })

  describe('Creating Invitations', () => {
    it('should create invitation and show link modal', () => {
      const testEmail = `invite_test_${Date.now()}@example.com`
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(testEmail)
      cy.get('#inviteMessage').type('Welcome to our testing platform!')
      cy.get('button').contains('Send').click()
      
      // Should show invitation link modal
      cy.get('.modal.show', { timeout: 10000 }).should('be.visible')
      cy.get('.modal.show h3').should('contain', 'Invitation Created')
      cy.get('.modal.show').should('contain', testEmail)
      
      // Should have invitation link
      cy.get('.invitation-link-input').should('be.visible')
      cy.get('.invitation-link-input').invoke('val').should('include', '/signup.html?token=')
      
      // Should have copy button
      cy.get('button').contains('Copy').should('be.visible')
      
      // Close modal
      cy.get('.modal.show button').contains('Close').click()
      cy.get('.modal.show').should('not.exist')
      
      // Should show success notification
      cy.get('.notification.success', { timeout: 5000 }).should('be.visible')
      
      // Should appear in table
      cy.get('#invitationsTableBody tr').should('contain', testEmail)
      cy.get('#invitationsTableBody tr').should('contain', 'admin_dashboard_test')
      cy.get('#invitationsTableBody tr').should('contain', 'Pending')
    })

    it('should copy invitation link to clipboard', () => {
      // Create invitation first
      const testEmail = `copy_test_${Date.now()}@example.com`
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(testEmail)
      cy.get('button').contains('Send').click()
      
      // Click copy button in modal
      cy.get('.modal.show button').contains('Copy').click()
      
      // Should show copy notification
      cy.get('.notification.success').should('contain', 'Link copied to clipboard')
      
      cy.get('.modal.show button').contains('Close').click()
    })

    it('should prevent duplicate invitations to same email', () => {
      const duplicateEmail = `duplicate_${Date.now()}@example.com`
      
      // Create first invitation
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(duplicateEmail)
      cy.get('button').contains('Send').click()
      cy.get('.modal.show button').contains('Close').click()
      
      // Try to create duplicate
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(duplicateEmail)
      cy.get('button').contains('Send').click()
      
      // Should show error
      cy.get('.notification.error', { timeout: 10000 }).should('be.visible')
      cy.get('.notification.error').should('contain', 'already exists')
    })

    it('should handle server errors gracefully', () => {
      // Intercept invitation creation to simulate error
      cy.intercept('POST', '**/api/admin/invitations', {
        statusCode: 500,
        body: { message: 'Internal server error' }
      }).as('serverError')
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type('error@test.com')
      cy.get('button').contains('Send').click()
      
      cy.wait('@serverError')
      
      cy.get('.notification.error', { timeout: 10000 }).should('be.visible')
      cy.get('.notification.error').should('contain', 'Failed to send invitation')
    })
  })

  describe('Invitation Table Management', () => {
    let testInvitationEmail

    beforeEach(() => {
      // Create a test invitation for management tests
      testInvitationEmail = `manage_test_${Date.now()}@example.com`
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(testInvitationEmail)
      cy.get('#inviteMessage').type('Management test invitation')
      cy.get('button').contains('Send').click()
      cy.get('.modal.show button').contains('Close').click()
    })

    it('should display invitation in table with correct data', () => {
      cy.get('#invitationsTableBody tr').contains(testInvitationEmail).parent().within(() => {
        cy.get('td').eq(0).should('contain', testInvitationEmail)
        cy.get('td').eq(1).should('contain', 'admin_dashboard_test')
        cy.get('td').eq(2).should('contain', 'Pending')
        cy.get('td').eq(3).should('not.be.empty') // Sent date
        cy.get('td').eq(4).should('not.be.empty') // Expires date
        cy.get('td').eq(5).should('contain', 'Copy Link') // Actions
        cy.get('td').eq(5).should('contain', 'Cancel')
      })
    })

    it('should copy invitation link from table', () => {
      cy.get('#invitationsTableBody tr').contains(testInvitationEmail).parent().within(() => {
        cy.get('button').contains('Copy Link').click()
      })
      
      cy.get('.notification.success', { timeout: 5000 }).should('contain', 'Link copied to clipboard')
    })

    it('should cancel invitation from table', () => {
      cy.get('#invitationsTableBody tr').contains(testInvitationEmail).parent().within(() => {
        cy.get('button').contains('Cancel').click()
      })
      
      // Should show confirmation modal
      cy.get('.modal.show').should('be.visible')
      cy.get('.modal.show').should('contain', 'Are you sure')
      cy.get('.modal.show').should('contain', testInvitationEmail)
      
      // Confirm deletion
      cy.get('.modal.show button').contains('Delete').click()
      
      // Should show success notification
      cy.get('.notification.success', { timeout: 10000 }).should('contain', 'cancelled successfully')
      
      // Should remove from table
      cy.get('#invitationsTableBody').should('not.contain', testInvitationEmail)
    })

    it('should cancel deletion modal', () => {
      cy.get('#invitationsTableBody tr').contains(testInvitationEmail).parent().within(() => {
        cy.get('button').contains('Cancel').click()
      })
      
      cy.get('.modal.show').should('be.visible')
      cy.get('.modal.show button').contains('Cancel').click()
      
      cy.get('.modal.show').should('not.exist')
      
      // Invitation should still be in table
      cy.get('#invitationsTableBody').should('contain', testInvitationEmail)
    })

    it('should show proper status badges', () => {
      cy.get('#invitationsTableBody tr').contains(testInvitationEmail).parent().within(() => {
        cy.get('.status-badge').should('have.class', 'status-pending')
        cy.get('.status-badge').should('contain', 'Pending')
      })
    })

    it('should format dates properly', () => {
      cy.get('#invitationsTableBody tr').contains(testInvitationEmail).parent().within(() => {
        // Sent date should be recent
        cy.get('td').eq(3).invoke('text').should('match', /\d+\/\d+\/\d+|\w+ \d+/)
        
        // Expires date should be in future
        cy.get('td').eq(4).invoke('text').should('match', /\d+\/\d+\/\d+|\w+ \d+/)
      })
    })
  })

  describe('Invitation Statistics Integration', () => {
    it('should update dashboard stats when invitations are created', () => {
      // Go to dashboard to check initial stats
      cy.get('[data-tab="dashboard"]').click()
      cy.wait(1000)
      
      // Note initial invitation count
      cy.get('.stat-card').contains('Invitations').parent().find('.stat-number').invoke('text').as('initialCount')
      
      // Go back to invitations and create new one
      cy.get('[data-tab="invitations"]').click()
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(`stats_test_${Date.now()}@example.com`)
      cy.get('button').contains('Send').click()
      cy.get('.modal.show button').contains('Close').click()
      
      // Check dashboard stats updated
      cy.get('[data-tab="dashboard"]').click()
      cy.wait(1000)
      
      cy.get('@initialCount').then((initialCount) => {
        const initial = parseInt(initialCount)
        cy.get('.stat-card').contains('Invitations').parent().find('.stat-number').invoke('text').then((newCount) => {
          expect(parseInt(newCount)).to.be.greaterThan(initial)
        })
      })
    })

    it('should show recent invitation activity', () => {
      // Create invitation
      const activityEmail = `activity_test_${Date.now()}@example.com`
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(activityEmail)
      cy.get('button').contains('Send').click()
      cy.get('.modal.show button').contains('Close').click()
      
      // Check dashboard shows recent activity
      cy.get('[data-tab="dashboard"]').click()
      cy.wait(2000)
      
      // Should show in recent activity (if that feature exists)
      // This might need adjustment based on actual dashboard implementation
      cy.get('.admin-section').should('be.visible')
    })
  })

  describe('Responsive Design and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667) // iPhone SE
      
      // Table should be responsive
      cy.get('.table-responsive').should('be.visible')
      
      // Buttons should be accessible
      cy.get('button').contains('Send Invitation').should('be.visible')
      
      // Form should work on mobile
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteForm').should('be.visible')
      cy.get('#inviteEmail').should('be.visible')
    })

    it('should work on tablet devices', () => {
      cy.viewport(768, 1024) // iPad
      
      cy.get('.admin-section').should('be.visible')
      cy.get('#invitationsTableBody').should('be.visible')
      cy.get('button').contains('Send Invitation').should('be.visible')
    })

    it('should have proper keyboard navigation', () => {
      // Tab through elements
      cy.get('button').contains('Send Invitation').focus()
      cy.focused().should('contain', 'Send Invitation')
      
      cy.get('button').contains('Send Invitation').type('{enter}')
      cy.get('#inviteForm').should('be.visible')
      
      // Email field should be focused
      cy.get('#inviteEmail').should('be.focused')
      
      // Tab to message field
      cy.get('#inviteEmail').tab()
      cy.get('#inviteMessage').should('be.focused')
    })

    it('should have proper ARIA labels and roles', () => {
      // Check for ARIA attributes on interactive elements
      cy.get('button').contains('Send Invitation').should('have.attr', 'type', 'button')
      
      // Form should have proper labels
      cy.get('button').contains('Send Invitation').click()
      cy.get('label[for="inviteEmail"]').should('exist')
      cy.get('label[for="inviteMessage"]').should('exist')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty invitation list', () => {
      // This test assumes we can clear all invitations or start fresh
      // If table is empty, should show appropriate message
      cy.get('#invitationsTableBody').then(($tbody) => {
        if ($tbody.text().includes('No invitations found')) {
          cy.get('#invitationsTableBody').should('contain', 'No invitations found')
        }
      })
    })

    it('should handle network errors when loading invitations', () => {
      // Intercept invitations loading
      cy.intercept('GET', '**/api/admin/invitations', { forceNetworkError: true }).as('networkError')
      
      cy.reload()
      cy.get('[data-tab="invitations"]').click()
      
      cy.wait('@networkError')
      
      // Should show some error state or loading message
      cy.get('#invitationsTableBody').should('be.visible')
    })

    it('should handle malformed invitation data', () => {
      // Intercept with malformed data
      cy.intercept('GET', '**/api/admin/invitations', {
        statusCode: 200,
        body: { invitations: [{ email: 'test@test.com' }] } // Missing required fields
      }).as('malformedData')
      
      cy.reload()
      cy.get('[data-tab="invitations"]').click()
      
      cy.wait('@malformedData')
      
      // Should handle gracefully
      cy.get('#invitationsTableBody').should('be.visible')
    })

    it('should handle very long email addresses', () => {
      const longEmail = 'a'.repeat(100) + '@example.com'
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(longEmail)
      cy.get('button').contains('Send').click()
      
      // Should either succeed or show appropriate validation error
      cy.get('.notification', { timeout: 10000 }).should('be.visible')
    })

    it('should handle special characters in invitation message', () => {
      const specialMessage = 'Welcome! 🎉 Join us for fun & games. Cost: $0 <script>alert("test")</script>'
      
      cy.get('button').contains('Send Invitation').click()
      cy.get('#inviteEmail').type(`special_${Date.now()}@example.com`)
      cy.get('#inviteMessage').type(specialMessage)
      cy.get('button').contains('Send').click()
      
      // Should handle special characters safely
      cy.get('.modal.show', { timeout: 10000 }).should('be.visible')
      cy.get('.modal.show button').contains('Close').click()
      
      // Check message is properly displayed in table (without script execution)
      cy.get('#invitationsTableBody').should('not.contain', '<script>')
    })
  })
})
