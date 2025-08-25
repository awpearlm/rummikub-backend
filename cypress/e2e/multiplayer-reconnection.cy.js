/// <reference types="cypress" />

describe('Multiplayer Game Reconnection', () => {
  // Generate a unique player name for tests
  const getPlayerName = (prefix = 'Player') => `${prefix}_${Date.now().toString().slice(-5)}`
  let gameId

  before(() => {
    // Log environment information at the beginning of the test suite
    cy.logEnvironmentInfo()
  })

  it('should maintain game state across reconnection with multiple players', () => {
    // First browser: Create a game
    const hostName = getPlayerName('Host')
    
    // Create a new game
    cy.createGame(hostName).then(id => {
      gameId = id
      cy.log(`Created game with ID: ${gameId}`)
      
      // Save the host's game window
      cy.window().then(hostWindow => {
        
        // Second browser: Join the game
        cy.getFrontendUrl().then(url => {
          cy.visit(url, { timeout: 15000 })
          cy.log(`Visiting frontend URL: ${url}`)
        })
        
        // Join the game
        const joinerName = getPlayerName('Joiner')
        cy.get('#playerName').clear().type(joinerName)
        cy.get('#playWithFriendsBtn').click()
        cy.get('#joinGameBtn').click()
        cy.get('#gameId').clear().type(gameId)
        cy.get('#joinGameSubmit').click()
        
        // Wait for the game to be joined and game screen to be visible
        cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
        
        // Start the game
        cy.get('#startGameBtn').click()
        
        // Verify game has started
        cy.get('#playerHand .tile', { timeout: 15000 }).should('exist')
        
        // Now simulate disconnection for the host
        cy.window().then(() => {
          // Disconnect host's socket
          hostWindow.game.socket.disconnect()
          
          // Verify host shows disconnection indicator
          cy.wrap(hostWindow.document.querySelector('#connectionStatus'))
            .should('have.class', 'disconnected')
          
          // Force show the connection lost overlay for the host
          hostWindow.game.showConnectionLostOverlay()
          
          // Verify the connection lost overlay shows correct game ID
          cy.wrap(hostWindow.document.querySelector('.reconnect-info'))
            .should('contain', gameId)
          
          // Click the reconnect button for the host
          cy.wrap(hostWindow.document.querySelector('#manualReconnectBtn')).click()
          
          // Verify host reconnects and restores game state
          cy.wrap(hostWindow.document.querySelector('#gameScreen'), { timeout: 15000 })
            .should('have.class', 'active')
          
          // Verify host still has tiles after reconnection
          cy.wrap(hostWindow.document.querySelector('#playerHand'), { timeout: 15000 })
            .find('.tile')
            .should('exist')
          
          // Verify game ID is maintained
          cy.wrap(hostWindow.document.querySelector('#currentGameId'))
            .should('contain', gameId)
        })
      })
    })
  })
})
