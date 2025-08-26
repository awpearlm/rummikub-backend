// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Helper function to get current backend URL
Cypress.Commands.add('getBackendUrl', () => {
  return cy.wrap(Cypress.env('currentBackendUrl') || Cypress.config('baseUrl'))
})

// Helper function to get current frontend URL
Cypress.Commands.add('getFrontendUrl', () => {
  return cy.wrap(Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl'))
})

// Custom command to check if localStorage has a game saved
Cypress.Commands.add('hasStoredGame', () => {
  return cy.window().then(win => {
    const gameInfo = win.localStorage.getItem('rummikub_game_info')
    return gameInfo !== null
  })
})

// Custom command to create a new game
Cypress.Commands.add('createGame', (playerName) => {
  // Visit the frontend URL
  cy.getFrontendUrl().then(url => {
    cy.visit(url, { failOnStatusCode: false })
    cy.log(`Visiting frontend URL: ${url}`)
  })
  
  // Fill out the form and create game
  cy.get('#playerName').clear().type(playerName)
  cy.get('#playWithFriendsBtn').click()
  cy.get('#createGameBtn').click()
  
  // Wait for the game to be created and game screen to be visible
  cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
  
  // Player should be listed in the players area
  cy.get('#playersList', { timeout: 15000 }).should('be.visible')
  cy.get('#playersList').should('contain', playerName)
  
  // Get and return the game ID
  return cy.get('#currentGameId').invoke('text')
})

// Custom command to join a game
Cypress.Commands.add('joinGame', (playerName, gameId) => {
  // Visit the frontend URL
  cy.getFrontendUrl().then(url => {
    cy.visit(url, { failOnStatusCode: false })
    cy.log(`Visiting frontend URL: ${url}`)
  })
  
  // Fill out the form and join game
  cy.get('#playerName').clear().type(playerName)
  cy.get('#playWithFriendsBtn').click()
  cy.get('#joinGameBtn').click()
  cy.get('#gameId').clear().type(gameId)
  cy.get('#joinGameSubmit').click()
  
  // Wait for the game to be joined and game screen to be visible
  cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
})

// Custom command to simulate connection loss
Cypress.Commands.add('simulateConnectionLoss', () => {
  return cy.window().then(win => {
    // Store a reference to the original socket
    const originalSocket = win.game.socket
    
    // Disconnect the socket
    win.game.socket.disconnect()
    
    // Return the socket so we can reconnect later if needed
    return originalSocket
  })
})

// Custom command to simulate reconnection
Cypress.Commands.add('simulateReconnection', (socket) => {
  return cy.window().then(win => {
    // Reconnect the socket
    socket.connect()
  })
})

// Command to force the connection lost overlay to appear
Cypress.Commands.add('forceConnectionLostOverlay', () => {
  return cy.window().then(win => {
    win.game.showConnectionLostOverlay()
  })
})

// Command to get game info from localStorage
Cypress.Commands.add('getStoredGameInfo', () => {
  return cy.window().then(win => {
    const gameInfoStr = win.localStorage.getItem('rummikub_game_info')
    if (gameInfoStr) {
      return JSON.parse(gameInfoStr)
    }
    return null
  })
})

// Command to log the current environment configuration
Cypress.Commands.add('logEnvironmentInfo', () => {
  // Simple console.log for debugging - doesn't use cy.task()
  const environment = Cypress.env('environment') || 'local';
  const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
  const backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl');
  
  console.log(`Testing Environment: ${environment}`);
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log(`Backend URL: ${backendUrl}`);
  
  // Also log to the test interface
  cy.log(`Testing Environment: ${environment}`);
  cy.log(`Frontend URL: ${frontendUrl}`);
  cy.log(`Backend URL: ${backendUrl}`);
})
