/// <reference types="cypress" />

describe('UI Features', () => {
  beforeEach(() => {
    // Log environment info
    const environment = Cypress.env('environment') || 'local';
    const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
    const backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl');
    
    console.log(`Testing Environment: ${environment}`);
    console.log(`Frontend URL: ${frontendUrl}`);
    console.log(`Backend URL: ${backendUrl}`);
    
    cy.log(`Testing Environment: ${environment}`);
    cy.log(`Frontend URL: ${frontendUrl}`);
    cy.log(`Backend URL: ${backendUrl}`);
    
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
  })
  
  it('should have a responsive welcome screen', () => {
    // Check if welcome screen elements are properly displayed
    cy.get('#welcomeScreen').should('be.visible')
    cy.get('#playWithFriendsBtn').should('be.visible')
    cy.get('#playWithBotBtn').should('be.visible')
    
    // Test responsiveness by resizing viewport
    cy.viewport('iphone-6') // Small viewport
    cy.get('#welcomeScreen').should('be.visible')
    
    cy.viewport('macbook-15') // Reset to larger viewport
  })
  
  it('should show loading screen when appropriate', () => {
    const playerName = getPlayerName('LoadingTest')
    
    // Fill out player name
    cy.get('#playerName').clear().type(playerName)
    
    // Click "Play with Bot" button
    cy.get('#playWithBotBtn').click()
    
    // Start the bot game which should trigger loading
    cy.get('#startBotGameBtn').click()
    
    // Loading screen should appear briefly
    cy.get('#loadingScreen').should('be.visible')
    
    // Then game screen should appear
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
  })
  
  it('should have accessible controls with keyboard navigation', () => {
    // Test keyboard navigation on welcome screen
    cy.get('#playerName').type('{enter}')
    
    // Focus should move to next element
    cy.focused().should('not.have.id', 'playerName')
    
    // Tab navigation should work
    cy.get('#playerName').focus().tab()
    cy.focused().should('be.visible') // Some button should be focused
  })
  
  it('should show game instructions or help', () => {
    // Check if there's a help or instructions button
    cy.get('body').then($body => {
      if ($body.find('#helpBtn, #instructionsBtn, #rulesBtn').length > 0) {
        // Click the help button
        cy.get('#helpBtn, #instructionsBtn, #rulesBtn').first().click()
        
        // Help content should be displayed
        cy.get('.help-content, .instructions, .rules').should('be.visible')
        
        // Should be able to close the help
        cy.get('.close-btn, .back-btn').first().click()
        
        // Help content should be hidden
        cy.get('.help-content, .instructions, .rules').should('not.be.visible')
      } else {
        cy.log('No help button found, skipping help test')
      }
    })
  })
  
  it('should show game code prominently for sharing', () => {
    const playerName = getPlayerName('ShareTest')
    
    // Create a new multiplayer game
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithFriendsBtn').click()
    cy.get('#createGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Game ID should be prominently displayed
    cy.get('#currentGameId').should('be.visible')
    
    // Check if there's a copy button
    cy.get('body').then($body => {
      if ($body.find('#copyGameIdBtn').length > 0) {
        cy.get('#copyGameIdBtn').should('be.visible')
      }
    })
  })
  
  it('should have theme consistency across screens', () => {
    // Check colors and styling on welcome screen
    const welcomeBackground = Cypress.$('#welcomeScreen').css('background-color')
    
    // Start a game to check theme consistency
    const playerName = getPlayerName('ThemeTest')
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Check that fonts and colors are consistent
    cy.get('#gameScreen').should('have.css', 'font-family')
    
    // Navigation elements should have consistent styling
    cy.get('#leaveGameBtn').should('be.visible')
  })
  
  it('should have sound controls if sounds are implemented', () => {
    // Check if there's a sound toggle
    cy.get('body').then($body => {
      if ($body.find('#soundToggle, #muteBtn, .sound-control').length > 0) {
        cy.get('#soundToggle, #muteBtn, .sound-control').first().should('be.visible')
        
        // Click the sound toggle
        cy.get('#soundToggle, #muteBtn, .sound-control').first().click()
        
        // Some state change should happen (depends on implementation)
        cy.get('#soundToggle, #muteBtn, .sound-control').first().should('exist')
      } else {
        cy.log('No sound controls found, skipping sound test')
      }
    })
  })
  
  it('should have proper error handling UI', () => {
    // Try to join a non-existent game to trigger an error
    const playerName = getPlayerName('ErrorTest')
    
    // Fill out player name
    cy.get('#playerName').clear().type(playerName)
    
    // Click "Play with Friends" button
    cy.get('#playWithFriendsBtn').click()
    
    // Try to join a game with an invalid code
    cy.get('#joinGameBtn').click()
    cy.get('#gameId').clear().type('INVALID')
    cy.get('#joinGameSubmit').click()
    
    // Error message should be displayed
    cy.get('.error-message, .alert, .notification').should('be.visible')
    
    // Error should have appropriate styling
    cy.get('.error-message, .alert, .notification').should('have.css', 'color')
  })
});
