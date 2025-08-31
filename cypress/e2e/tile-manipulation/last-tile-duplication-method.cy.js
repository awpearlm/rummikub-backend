/// <reference types="cypress" />

describe('Last Tile Duplication Bug - Method Approach', () => {
  beforeEach(() => {
    // Log environment info
    const environment = Cypress.env('environment') || 'local';
    const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
    
    cy.log(`Testing Environment: ${environment}`);
    cy.log(`Frontend URL: ${frontendUrl}`);
    
    // Clear all state first
    cy.clearCookies()
    cy.clearLocalStorage()
    
    // Visit the site and login
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Start a bot game with special last tile test mode
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Select the special 'lastTile' mode from the Bot Difficulty dropdown
    cy.get('#botDifficulty').select('lastTile')
    cy.log('🔧 Selected Last Tile Test Mode - 4-tile hand for duplication testing')
    
    cy.get('#startBotGameBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile').should('have.length', 4)
  })

  it('should call game methods directly to test last tile duplication', () => {
    cy.log('🎯 Testing last tile duplication using direct method calls')
    
    // STEP 1: Verify starting conditions and make initial play
    cy.get('#playerHand .tile').should('have.length', 4)
    cy.log('✅ Starting with 4-tile hand')
    
    // Clear any selections first
    cy.get('#playerHand').then($hand => {
      const selectedTiles = $hand.find('.tile.selected')
      if (selectedTiles.length > 0) {
        cy.log(`Clearing ${selectedTiles.length} selected tiles`)
        selectedTiles.each((index, tile) => {
          cy.wrap(tile).click()
        })
      } else {
        cy.log('No tiles selected, proceeding with selection')
      }
    })
    
    // Find and select the three 13s
    cy.get('#playerHand .tile').each($tile => {
      const tileText = $tile.text().trim()
      if (tileText === '13') {
        cy.wrap($tile).click()
        cy.log(`Selected 13: ${tileText}`)
      }
    })
    
    cy.wait(2000)
    
    // Play the set
    cy.get('#playSetBtn').should('not.be.disabled').click()
    cy.log('✅ Played three 13s (39 points)')
    
    cy.wait(3000)
    
    // Verify we now have 1 tile left
    cy.get('#playerHand .tile').should('have.length', 1)
    cy.log('✅ Now have exactly 1 tile left in hand')
    
    // End our turn
    cy.get('#endTurnBtn').should('be.visible').click()
    cy.log('🔄 Ending turn 1, waiting for bot...')
    
    cy.wait(5000)
    
    // Wait for our turn 2
    cy.get('#currentTurnPlayer').should('contain', 'testuser')
    cy.log('✅ Back to our turn with 1 tile left')
    
    // STEP 2: Now test the critical last tile drag using direct method calls
    cy.log('🚨 CRITICAL TEST: Using direct game method calls for last tile')
    
    cy.window().then((win) => {
      // Get the game instance
      const game = win.game
      if (!game) {
        throw new Error('Game instance not found on window object')
      }
      
      cy.log('✅ Found game instance')
      
      // Get current game state
      const initialHandSize = game.gameState.playerHand.length
      const initialBoardSize = game.gameState.board.flat().length
      const lastTile = game.gameState.playerHand[0]
      
      cy.log(`📊 BEFORE: Hand=${initialHandSize} tiles, Board=${initialBoardSize} tiles`)
      cy.log(`🎯 Last tile: ${lastTile.number} ${lastTile.color} (ID: ${lastTile.id})`)
      
      cy.wait(3000) // Visual pause
      
      // Directly call the handleTileDrop method with the last tile
      cy.log('🚀 Calling handleTileDrop directly with last tile...')
      
      const dragData = {
        type: 'hand-tile',
        tile: lastTile,
        sourceIndex: 0
      }
      
      // Call the method directly
      game.handleTileDrop(dragData, -1) // -1 means new set
      
      cy.log('✅ Called handleTileDrop - checking results...')
      
      cy.wait(5000) // Wait for server response
      
      // Check the results
      cy.window().then((win) => {
        const finalHandSize = win.game.gameState.playerHand.length
        const finalBoardSize = win.game.gameState.board.flat().length
        
        cy.log(`📊 AFTER: Hand=${finalHandSize} tiles, Board=${finalBoardSize} tiles`)
        
        if (finalHandSize === 0 && finalBoardSize > initialBoardSize) {
          cy.log('✅ SUCCESS: Tile moved correctly (hand empty, board gained tile)')
        } else if (finalHandSize > 0 && finalBoardSize > initialBoardSize) {
          cy.log('🚨 DUPLICATION BUG DETECTED!')
          cy.log('🚨 Tile exists in BOTH hand AND board!')
          
          // Check what's still in hand
          const remainingTiles = win.game.gameState.playerHand
          cy.log(`🚨 Tiles still in hand: ${remainingTiles.map(t => `${t.number} ${t.color}`).join(', ')}`)
          
          // Check if the moved tile is still in hand
          const duplicatedTile = remainingTiles.find(t => t.id === lastTile.id)
          if (duplicatedTile) {
            cy.log('🚨 CONFIRMED: The exact same tile is duplicated!')
            cy.log(`🚨 Duplicated tile: ${duplicatedTile.number} ${duplicatedTile.color} (ID: ${duplicatedTile.id})`)
          }
          
          // Force test failure to highlight the bug
          expect(finalHandSize, 'DUPLICATION BUG: Last tile should not remain in hand after successful move').to.equal(0)
          
        } else if (finalHandSize === initialHandSize && finalBoardSize === initialBoardSize) {
          cy.log('❌ METHOD FAILED: No change detected - method call had no effect')
          throw new Error('METHOD CALL FAILED: handleTileDrop had no effect on game state')
        } else {
          cy.log(`❓ UNEXPECTED STATE: Hand ${initialHandSize}→${finalHandSize}, Board ${initialBoardSize}→${finalBoardSize}`)
          throw new Error(`Unexpected state after method call`)
        }
        
        cy.wait(5000) // Final pause to observe
      })
    })
  })
})
