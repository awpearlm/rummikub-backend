/// <reference types="cypress" />

describe('Reconnection Edge Cases', () => {
  // Generate a unique player name for tests
  const getPlayerName = () => `TestPlayer_${Date.now().toString().slice(-5)}`
  
  before(() => {
    // Log environment information at the beginning of the test suite
    cy.logEnvironmentInfo()
  })
  
  it('should handle expired game information gracefully', () => {
    const playerName = getPlayerName()
    
    // Create a test with artificially expired game info
    cy.getFrontendUrl().then(url => {
      cy.visit(url)
      cy.log(`Visiting frontend URL: ${url}`)
    })
    
    cy.window().then(win => {
      // Insert expired game info (over 2 hours old)
      const twoHoursAndOneMinute = 2 * 60 * 60 * 1000 + 60000
      const expiredTimestamp = Date.now() - twoHoursAndOneMinute
      
      const expiredGameInfo = {
        gameId: 'ABCDEF',
        playerName: playerName,
        timestamp: expiredTimestamp
      }
      
      win.localStorage.setItem('rummikub_game_info', JSON.stringify(expiredGameInfo))
      
      // Refresh the page
      cy.reload()
      
      // Force the connection lost overlay
      cy.forceConnectionLostOverlay()
      
      // The reconnect info should indicate no valid game is available
      cy.get('.reconnect-info').should('contain', 'don\'t have any saved games')
      cy.get('#manualReconnectBtn').should('contain', 'Refresh Page')
      
      // Clicking should simply reload the page
      cy.get('#manualReconnectBtn').click()
      
      // We should be back at the welcome screen
      cy.get('#welcomeScreen.active', { timeout: 10000 }).should('be.visible')
    })
  })
  
  it('should handle non-existent game ID gracefully', () => {
    const playerName = getPlayerName()
    
    // Inject game info with a non-existent game ID
    cy.getFrontendUrl().then(url => {
      cy.visit(url)
      cy.log(`Visiting frontend URL: ${url}`)
    })
    
    cy.window().then(win => {
      // Create game info with a random game ID that doesn't exist
      const fakeGameInfo = {
        gameId: 'NONEXISTENT',
        playerName: playerName,
        timestamp: Date.now()
      }
      
      win.localStorage.setItem('rummikub_game_info', JSON.stringify(fakeGameInfo))
      
      // Force the connection lost overlay
      cy.forceConnectionLostOverlay()
      
      // Click the reconnect button
      cy.get('#manualReconnectBtn').click()
      
      // Should show loading screen first
      cy.get('#loadingScreen.active').should('be.visible')
      
      // After a failed reconnection attempt, it should show an error
      // (Note: This depends on how your game handles non-existent games)
      // For now, we'll just verify we're not stuck in the loading screen forever
      cy.get('#loadingScreen.active', { timeout: 20000 }).should('not.exist')
    })
  })
  
  it('should handle reconnection after game has ended', () => {
    const playerName = getPlayerName()
    
    // Create a bot game which we can end quickly
    cy.getFrontendUrl().then(url => {
      cy.visit(url)
      cy.log(`Visiting frontend URL: ${url}`)
    })
    
    cy.get('#playerName').clear().type(playerName)
    cy.get('#playWithBotBtn').click()
    cy.get('#startBotGameBtn').click()
    
    // Wait for the game to be created
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Store the game ID
    cy.get('#currentGameId').invoke('text').as('gameId')
    
    // Manually trigger game ended event
    cy.window().then(win => {
      // Store the socket ID
      const socketId = win.game.socket.id
      
      // Simulate a game won event
      win.game.socket.onevent({
        data: [{
          gameState: win.game.gameState,
          winner: { id: socketId, name: playerName }
        }],
        type: 'gameWon'
      })
      
      // Verify victory screen is shown
      cy.get('#victoryOverlay', { timeout: 10000 }).should('be.visible')
      
      // Verify game info is cleared from localStorage
      cy.hasStoredGame().should('be.false')
    })
  })
})
