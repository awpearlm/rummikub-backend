/// <reference types="cypress" />

describe('Game Logic Integration Tests', () => {
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
    })
    
    // Start a bot game for all tests
    const playerName = getPlayerName('IntegTest')
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Wait for player's hand to be populated
    cy.get('#playerHand .tile', { timeout: 15000 }).should('have.length.at.least', 1)
  })

  it('should correctly implement game UI with player hand and draw button behaviors', () => {
    // 1. Check player hand layout first
    cy.get('#playerHand').should('have.css', 'display', 'grid')
    cy.get('#playerHand').invoke('outerWidth').should('be.gt', 650)
    
    // 2. Test draw button behavior with tile selection
    cy.get('#drawTileBtn').should('not.be.disabled')
    
    // Select a tile - draw button should become disabled
    cy.get('#playerHand .tile').first().click()
    cy.get('#drawTileBtn').should('be.disabled')
    
    // Deselect the tile - draw button should be enabled again
    cy.get('#playerHand .tile.selected').click()
    cy.get('#drawTileBtn').should('not.be.disabled')
    
    // 3. Test complete game flow with drawing
    cy.get('#drawTileBtn').click()
    
    // After drawing, draw button should be disabled
    cy.get('#drawTileBtn').should('be.disabled')
    
    // In a real game, you would play tiles to the board which would enable the End Turn button
    // Since we can't easily test that in this context (it requires valid sets), we'll skip testing the End Turn button click
    // and just verify that the turn ends automatically after the bot plays
    
    // Wait for bot's turn to complete and return to player's turn
    cy.get('#currentTurnPlayer', { timeout: 15000 }).invoke('text').should('not.contain', 'Bot')
    
    // On new turn, draw button should be enabled again
    cy.get('#drawTileBtn').should('not.be.disabled')
  })
})
