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
    
    // Login with existing test user
    cy.visit('/')
    cy.get('#loginEmailInput', { timeout: 10000 }).should('be.visible')
    cy.get('#loginEmailInput').type('testuser@example.com')
    cy.get('#loginPasswordInput').type('password123')
    cy.get('#loginSubmitBtn').click()
    
    // Wait for login to complete and welcome screen to show
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
  })
  
  it('should create a new game successfully', () => {
    // Click "Play with Friends" button
    cy.get('#playWithFriendsBtn').click()
    
    // Create a new game
    cy.get('#createGameBtn').click()
    
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
    cy.get('#createGameBtn').click()
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Get the game ID
    cy.get('#currentGameId').invoke('text').then(id => {
      gameId = id
      cy.log(`Created game with ID: ${gameId}`)
      
      // Now logout and login as second test user
      cy.visit('/')
      cy.get('#loginEmailInput', { timeout: 10000 }).should('be.visible')
      cy.get('#loginEmailInput').type('testuser2@example.com')
      cy.get('#loginPasswordInput').type('password123')
      cy.get('#loginSubmitBtn').click()
      
      // Wait for login to complete
      cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
      
      // Join the game
      cy.get('#playWithFriendsBtn').click()
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
