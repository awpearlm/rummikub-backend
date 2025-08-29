describe('Debug Game Creation Process', () => {
  it('should debug the complete game creation flow', () => {
    // Clear all state first
    cy.clearCookies()
    cy.clearLocalStorage()
    
    // Visit the site - this will redirect to login.html if not authenticated
    cy.visit('/')
    
    // Wait for redirect to login page and login
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    // Use the correct selectors from login.html
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    // Wait for redirect back to index.html and welcome screen
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Click "Play with Friends" to show multiplayer options
    cy.get('#playWithFriendsBtn').should('be.visible').click()
    
    // Now the multiplayer options should be visible
    cy.get('#multiplayerOptions').should('not.have.class', 'hidden')
    cy.get('#createGameBtn').should('be.visible')
    
    // Click create game
    cy.get('#createGameBtn').click()
    
    // Check if game settings modal appears
    cy.get('#gameSettingsModal', { timeout: 5000 }).should('be.visible')
    
    // If modal appears, click the create button
    cy.get('#createGameWithSettingsBtn').should('be.visible').click()
    
    // Now wait for either game screen or some other response
    cy.wait(10000)
    
    // Check what screen we're on
    cy.get('body').then($body => {
      if ($body.find('#gameScreen.active').length > 0) {
        cy.log('SUCCESS: Game screen is active')
        cy.get('#gameScreen.active').should('be.visible')
      } else if ($body.find('#welcomeScreen.active').length > 0) {
        cy.log('STILL ON: Welcome screen - checking for errors')
        // Check if there are any error messages or notifications
        cy.get('.toast-container').then($toasts => {
          if ($toasts.find('.toast').length > 0) {
            cy.log('Found toast notifications')
          } else {
            cy.log('No toast notifications found')
          }
        })
      } else {
        cy.log('UNKNOWN STATE: Neither welcome nor game screen is active')
      }
    })
  })
})
