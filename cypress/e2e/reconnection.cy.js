/// <reference types="cypress" />

describe('Game Reconnection', () => {
  // Generate a unique player name for tests
  const getPlayerName = () => `TestPlayer_${Date.now().toString().slice(-5)}`
  let gameId

  it('should save game info to localStorage when creating a game', () => {
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
    
    const playerName = getPlayerName()
    
    // Create a new game
    cy.createGame(playerName).then(id => {
      gameId = id
      cy.log(`Game created with ID: ${gameId}`)
      
      // Verify that game info is saved to localStorage
      cy.hasStoredGame().should('be.true')
      
      // Check that the saved game has the correct info
      cy.getStoredGameInfo().should(info => {
        expect(info.gameId).to.equal(gameId)
        expect(info.playerName).to.equal(playerName)
        expect(info.timestamp).to.be.a('number')
      })
    })
  })

  it('should show connection lost overlay when connection is lost', () => {
    const playerName = getPlayerName()
    
    // Create a new game
    cy.createGame(playerName).then(() => {
      // Simulate connection loss
      cy.simulateConnectionLoss()
      
      // Verify the connection lost overlay appears
      cy.get('#connectionLostOverlay', { timeout: 10000 }).should('be.visible')
      
      // Connection status should show disconnected
      cy.get('#connectionStatus').should('have.class', 'disconnected')
    })
  })

  it('should display correct reconnection information when game data exists', () => {
    const playerName = getPlayerName()
    
    // Create a new game
    cy.createGame(playerName).then(id => {
      gameId = id
      cy.log(`Game created with ID: ${gameId}`)
      
      // Force the connection lost overlay to appear
      cy.forceConnectionLostOverlay()
      
      // Verify the connection lost overlay appears with correct info
      cy.get('#connectionLostOverlay').should('be.visible')
      cy.get('.reconnect-info').should('contain', gameId)
      cy.get('#manualReconnectBtn').should('contain', gameId)
    })
  })

  it('should reconnect to the game when clicking reconnect button', () => {
    const playerName = getPlayerName()
    
    // Create a new game
    cy.createGame(playerName).then(() => {
      // Force the connection lost overlay to appear
      cy.forceConnectionLostOverlay()
      
      // Click the reconnect button
      cy.get('#manualReconnectBtn').click()
      
      // Verify that we're reconnecting by checking the loading screen
      cy.get('#loadingScreen.active').should('be.visible')
      
      // After reconnection, we should see the game screen again
      cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    })
  })

  it('should clear game data from localStorage when leaving a game', () => {
    const playerName = getPlayerName()
    
    // Create a new game
    cy.createGame(playerName).then(() => {
      // Verify that game info is saved to localStorage
      cy.hasStoredGame().should('be.true')
      
      // Click leave game button (and confirm in the dialog)
      cy.window().then(win => {
        cy.stub(win, 'confirm').returns(true)
      })
      cy.get('#leaveGameBtn').click()
      
      // Verify that we're back at the welcome screen
      cy.get('#welcomeScreen.active', { timeout: 10000 }).should('be.visible')
      
      // Verify that game info is cleared from localStorage
      cy.hasStoredGame().should('be.false')
    })
  })
})
