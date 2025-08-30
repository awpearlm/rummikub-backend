/// <reference types="cypress" />

describe('Game Creation and Joining', () => {
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
  
  it('should create a new game successfully', () => {
    // Click "Play with Friends" to show multiplayer options
    cy.get('#playWithFriendsBtn').should('be.visible').click()
    cy.get('#multiplayerOptions').should('not.have.class', 'hidden')
    
    // Create a new game
    cy.get('#createGameBtn').click()
    
    // Wait for settings modal to appear and click create
    cy.get('#gameSettingsModal', { timeout: 5000 }).should('be.visible')
    cy.get('#createGameWithSettingsBtn').should('be.visible').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Game ID should be displayed
    cy.get('#currentGameId').should('be.visible')
    cy.get('#currentGameId').invoke('text').should('match', /^[A-Z0-9]{6}$/)
    
    // Player should be listed in the players area
    cy.get('#playersList').should('be.visible')
    cy.get('#playersList').should('contain', 'testuser') // Username from testuser@example.com
  })
  
  it('should start a bot game successfully', () => {
    // Click "Play with Bot" button
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Start the bot game
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Game should be started and player hand should be visible
    cy.get('#playerHand .tile', { timeout: 20000 }).should('have.length.at.least', 1)
    
    // Check for players in the player list
    cy.get('#playersList', { timeout: 15000 }).should('be.visible')
    cy.get('#playersList').should('contain', 'testuser') // Username from testuser@example.com
    
    // Bot player should also be listed
    cy.get('#playersList').should('contain', 'Bot')
  })
  
  it('should join an existing game with a valid game code', () => {
    let gameId
    
    // First, create a game with testuser@example.com
    cy.get('#playWithFriendsBtn').click()
    cy.get('#multiplayerOptions').should('not.have.class', 'hidden')
    cy.get('#createGameBtn').click()
    
    // Wait for settings modal and create game
    cy.get('#gameSettingsModal', { timeout: 5000 }).should('be.visible')
    cy.get('#createGameWithSettingsBtn').should('be.visible').click()
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Get the game ID
    cy.get('#currentGameId').invoke('text').then(id => {
      gameId = id
      cy.log(`Created game with ID: ${gameId}`)
      
      // Clear session data and visit as second user
      cy.clearCookies()
      cy.clearLocalStorage()
      cy.visit('/')
      
      // Wait for redirect to login page
      cy.url({ timeout: 10000 }).should('include', 'login.html')
      
      // Login as second test user with correct selectors
      cy.get('#email', { timeout: 10000 }).should('be.visible')
      cy.get('#email').type('testuser2@example.com')
      cy.get('#password').type('password123')
      cy.get('#login-button').click()
      
      // Wait for login to complete
      cy.url({ timeout: 15000 }).should('include', 'index.html')
      cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
      
      // Join the game
      cy.get('#playWithFriendsBtn').click()
      cy.get('#multiplayerOptions').should('not.have.class', 'hidden')
      cy.get('#joinGameBtn').click()
      cy.get('#gameId').clear().type(gameId)
      cy.get('#joinGameSubmit').click()
      
      // Game screen should be visible
      cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
      
      // Both players should be listed
      cy.get('#playersList', { timeout: 15000 }).should('be.visible')
      cy.get('#playersList').should('contain', 'testuser2')
      cy.get('#playersList').should('contain', 'testuser')
    })
  })
})
