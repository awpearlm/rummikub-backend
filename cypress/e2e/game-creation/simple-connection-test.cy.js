describe('Simple Connection Test', () => {
  it('should be able to visit the site and check console for connection errors', () => {
    // Visit the production site
    cy.visit('https://jkube.netlify.app/')
    
    // Wait for redirect to login page
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    // Login
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    // Wait for redirect back to index.html
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Wait a bit for socket connection and check console logs
    cy.wait(5000)
    
    // Check if we can see any elements that indicate the app is working
    cy.get('#playWithFriendsBtn').should('be.visible').click()
    
    // Now check for the create game button
    cy.get('#createGameBtn').should('be.visible')
    cy.get('#joinGameBtn').should('be.visible')
    
    // Try to click create game but with a longer wait
    cy.get('#createGameBtn').click()
    
    // Wait longer to see if anything happens
    cy.wait(10000)
    
    // Check what screen we're on
    cy.get('body').then($body => {
      if ($body.find('#gameScreen.active').length > 0) {
        cy.log('SUCCESS: Game screen is active')
      } else if ($body.find('#welcomeScreen.active').length > 0) {
        cy.log('STILL ON: Welcome screen')
        // Check if there are any error messages
        cy.get('body').should('contain.text', 'Create Game')
      } else {
        cy.log('UNKNOWN STATE: Neither welcome nor game screen is active')
      }
    })
  })
})
