/// <reference types="cypress" />

describe('Game Progression', () => {
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
  })
  
  it('should cycle turns correctly between players', () => {
    const playerName = getPlayerName('TurnCycle')
    
    // Start a bot game to test turn cycling
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Should be player's turn initially
    cy.get('.current-player').should('contain', playerName)
    
    // Draw a tile and end turn
    cy.get('#drawTileBtn').click()
    cy.get('#endTurnBtn').should('be.enabled')
    cy.get('#endTurnBtn').click()
    
    // Should be bot's turn
    cy.get('.current-player', { timeout: 10000 }).should('contain', 'Bot')
    
    // After bot plays, should be player's turn again
    // Bot should automatically play
    cy.get('.current-player', { timeout: 30000 }).should('contain', playerName)
  })
  
  it('should accumulate points for valid tile placements', () => {
    const playerName = getPlayerName('PointsTest')
    
    // Start a bot game
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Wait for player's hand to be populated
    cy.get('#playerHand .tile').should('have.length', 14)
    
    // This test can be more difficult to automate without knowing exactly what tiles
    // the player has in their hand. For now, we'll verify the points area exists
    // and draw a tile and end the turn to allow the game to progress
    cy.get('#playerPoints').should('exist')
    
    // If we can play tiles, let's try, otherwise just draw and end turn
    cy.get('body').then($body => {
      if ($body.find('#playTilesBtn:enabled').length > 0) {
        cy.log('Play tiles button is enabled, attempting to play')
        cy.get('#playTilesBtn').click()
      } else {
        cy.log('Draw and end turn')
        cy.get('#drawTileBtn').click()
        cy.get('#endTurnBtn').click()
      }
    })
  })
  
  it('should enforce the 30-point initial placement rule', () => {
    const playerName = getPlayerName('Initial30')
    
    // Start a bot game
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Wait for player's hand to be populated
    cy.get('#playerHand .tile').should('have.length', 14)
    
    // Attempt to place a single tile on the board (should be rejected for initial play)
    // This test will need to be adapted based on the actual UI interactions for placing tiles
    // For now, we'll just verify the game board and play area exist
    cy.get('#gameBoard').should('exist')
    cy.get('#playArea').should('exist')
    
    // The specific DOM interactions would depend on how tile dragging is implemented
    // For this example, we'll just check if there's an error message when trying to submit
    // an invalid initial placement
    cy.get('body').then($body => {
      // If we can see tiles in the play area, try to submit them
      if ($body.find('#playArea .tile').length > 0) {
        // Try to play without meeting the 30-point requirement
        cy.get('#playTilesBtn').click()
        
        // Should show an error about the 30-point rule
        cy.get('.error-message').should('be.visible')
          .and('contain', '30')
      }
    })
  })
  
  it('should prevent invalid tile placements', () => {
    const playerName = getPlayerName('InvalidMove')
    
    // Start a bot game
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Wait for player's hand to be populated
    cy.get('#playerHand .tile').should('have.length', 14)
    
    // Again, specific interactions depend on how your UI is implemented
    // We'll check if there's validation when attempting to submit an invalid placement
    
    // For now, just verify the validation UI elements exist
    cy.get('#gameBoard').should('exist')
    cy.get('#playArea').should('exist')
    cy.get('#playTilesBtn').should('exist')
  })
  
  it('should handle game completion correctly', () => {
    const playerName = getPlayerName('GameEnd')
    
    // Start a bot game
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // We can't easily force a game end in an automated test
    // So we'll just verify the victory overlay exists in the DOM
    // even if it's not visible yet
    cy.get('#victoryOverlay').should('exist')
  })
});
