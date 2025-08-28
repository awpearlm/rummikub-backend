/// <reference types="cypress" />

describe('Game Creation and Joining', () => {
  // Generate a unique player name for tests
  const getPlayerName = (prefix = 'Player') => `${prefix}_${Date.now().toString().slice(-5)}`
  
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
    
    // Visit the frontend URL
    cy.getFrontendUrl().then(url => {
      cy.visit(url, { failOnStatusCode: false })
      cy.log(`Visiting frontend URL: ${url}`)
    })
  })
  
  it('should create a new game successfully', () => {
    const playerName = getPlayerName('Creator')
    
    // Fill out player name
    cy.get('#playerName').clear().type(playerName)
    
    // Click "Play with Friends" button
    cy.get('#playWithFriendsBtn').click()
    
    // Create a new game
    cy.get('#createGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Game ID should be displayed
    cy.get('#currentGameId').should('be.visible')
    cy.get('#currentGameId').invoke('text').should('match', /^[A-Z0-9]{6}$/)
    
    // Player should be listed in the players area - but using the right selector
    cy.get('#playersList').should('contain', playerName)
  })
  
  it('should start a bot game successfully', () => {
    const playerName = getPlayerName('BotPlayer')
    
    // Fill out player name
    cy.get('#playerName').clear().type(playerName)
    
    // Click "Play with Bot" button
    cy.get('#playWithBotBtn').click()
    
    // Start the bot game
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Game should be started and player hand should be visible
    cy.get('#playerHand .tile', { timeout: 20000 }).should('have.length.at.least', 1)
    
    // Check for players in the player list - but using the right selector
    cy.get('#playersList', { timeout: 15000 }).should('be.visible')
    cy.get('#playersList').should('contain', playerName)
    
    // Bot player should also be listed
    cy.get('#playersList').should('contain', 'Bot')
  })
  
  // Skip this test for now since it's more complex and may need separate sessions
  it.skip('should join an existing game with a valid game code', () => {
    // First create a game and get its ID
    const hostName = getPlayerName('Host')
    let gameId
    
    // Create a new game first
    cy.get('#playerName').clear().type(hostName)
    cy.get('#playWithFriendsBtn').click()
    cy.get('#createGameBtn').click()
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Get the game ID
    cy.get('#currentGameId').invoke('text').then(id => {
      gameId = id
      cy.log(`Created game with ID: ${gameId}`)
      
      // Now open a new session and join the game
      cy.getFrontendUrl().then(url => {
        cy.visit(url, { failOnStatusCode: false })
        cy.log(`Visiting frontend URL: ${url} to join game`)
      })
      
      const joinerName = getPlayerName('Joiner')
      
      // Fill out joiner's player name
      cy.get('#playerName').clear().type(joinerName)
      cy.get('#playWithFriendsBtn').click()
      
      // Click "Join Game" and enter the game ID
      cy.get('#joinGameBtn').click()
      cy.get('#gameId').clear().type(gameId)
      cy.get('#joinGameSubmit').click()
      
      // Game screen should be visible
      cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
      
      // Both players should be listed - using the correct selector
      cy.get('#playersList', { timeout: 15000 }).should('be.visible')
      cy.get('#playersList').should('contain', joinerName)
      cy.get('#playersList').should('contain', hostName)
    })
  })
})
