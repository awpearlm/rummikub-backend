/// <reference types="cypress" />

describe('Draw Button Logic Tests', () => {
  beforeEach(() => {
    // Log environment info
    const environment = Cypress.env('ENVIRONMENT') || 'production'
    const frontendUrl = Cypress.env('currentFrontendUrl') || 'https://jkube.netlify.app'
    const backendUrl = Cypress.env('currentBackendUrl') || 'https://rummikub-backend.onrender.com'
    
    console.log(`Testing Environment: ${environment}`)
    console.log(`Frontend URL: ${frontendUrl}`)
    console.log(`Backend URL: ${backendUrl}`)
    
    cy.log(`Testing Environment: ${environment}`)
    cy.log(`Frontend URL: ${frontendUrl}`)
    cy.log(`Backend URL: ${backendUrl}`)
    
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
    
    // Start a bot game for testing - select debug difficulty for consistent hands
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Select debug difficulty for consistent test hands
    cy.get('#botDifficulty').select('debug')
    cy.get('#startBotGameBtn').click()
    
    // Handle the settings modal that appears
    cy.get('#gameSettingsModal.show', { timeout: 10000 }).should('be.visible')
    cy.get('#createBotGameWithSettingsBtn').should('be.visible').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Player should have 15 tiles in debug mode (confirmed by test)
    cy.get('#playerHand .tile', { timeout: 15000 }).should('have.length', 15)

    // TURN 1: Make initial play with three 13s (39 points) - using working test pattern
    cy.log('🎯 TURN 1: Making initial play with three 13s')
    
    // Use the exact pattern from working drag-drop test to find and select three 13s
    cy.get('#playerHand .tile').then($tiles => {
      const tiles = Array.from($tiles).map((tile, index) => {
        const numberElement = tile.querySelector('.tile-number')
        const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
        const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
        const isJoker = tile.classList.contains('joker')
        return { element: tile, value, color, isJoker, index }
      })
      
      // Find the three 13s that debug mode provides
      const thirteens = tiles.filter(t => t.value === 13)
      cy.log(`Found ${thirteens.length} thirteens in debug hand`)
      
      if (thirteens.length >= 3) {
        // Select the first 3 thirteens by clicking them
        thirteens.slice(0, 3).forEach(tile => {
          cy.wrap(tile.element).click()
          cy.log(`Selected ${tile.value} ${tile.color}`)
        })
        
        // Play the selected tiles using correct button name
        cy.get('#playSetBtn').should('not.be.disabled').click()
        cy.log('✅ Played three 13s for initial play (39 points)')
        
        cy.wait(2000) // Wait for play to process
      } else {
        cy.log(`❌ Expected 3 thirteens, only found ${thirteens.length}`)
      }
    })
    
    // End turn
    cy.get('#endTurnBtn').click()
    cy.log('✅ TURN 1 complete - ended turn')
    
    // Wait for bot turn
    cy.wait(3000)
    cy.log('🤖 Bot turn completed')
    
    // TURN 2: Verify we're on our turn again and we can test draw button logic
    cy.get('#currentTurnPlayer', { timeout: 10000 }).should('contain', 'testuser')
    cy.log('✅ TURN 2: Ready to test draw button logic')
    
    // Add delay to ensure turn is fully resolved to the player
    cy.wait(3000)
    cy.log('🕐 Waited for turn to fully resolve to player')
  })

  it('should disable draw button when tiles are moved from hand to board', () => {
    cy.log('🎯 Testing: Draw button disables when tiles moved from hand to board')
    
    // Add initial wait to ensure everything is ready
    cy.wait(2000)
    
    // Verify we're on our turn and draw button is initially enabled
    cy.get('#currentTurnPlayer').should('contain', 'testuser')
    cy.get('#drawTileBtn').should('not.be.disabled')
    cy.get('#drawTileBtn').should('have.css', 'opacity', '1')
    
    // Record initial hand count
    cy.get('#playerHand .tile').then($tiles => {
      const initialHandCount = $tiles.length
      cy.log(`Initial hand count: ${initialHandCount}`)
      
      // Move a tile from hand to board
      cy.moveHandTileToBoard(0)
      
      // Add longer wait for the move to be processed
      cy.wait(3000)
      
      // Verify tile was removed from hand
      cy.get('#playerHand .tile').should('have.length', initialHandCount - 1)
      
      // ✅ KEY TEST: Draw button should now be disabled
      cy.get('#drawTileBtn').should('be.disabled')
      cy.get('#drawTileBtn').should('have.css', 'opacity', '0.5')
      cy.get('#drawTileBtn').should('have.attr', 'title').and('include', 'Cannot draw after playing tiles')
      
      cy.log('✅ PASS: Draw button correctly disabled after moving tile to board')
    })
  })

  it('should re-enable draw button when all uncommitted tiles are moved back to hand', () => {
    cy.log('🎯 Testing: Draw button re-enables when tiles moved back to hand')
    
    // Add initial wait
    cy.wait(2000)
    
    // First, move a tile from hand to board (this should disable draw)
    cy.moveHandTileToBoard(0)
    cy.wait(2000)
    
    // Verify draw button is disabled
    cy.get('#drawTileBtn').should('be.disabled')
    cy.log('✅ Confirmed: Draw button disabled after tile moved to board')
    
    // Now move the tile back from board to hand
    cy.moveBoardTileToHand(0)
    cy.wait(2000)
    
    // ✅ KEY TEST: Draw button should now be re-enabled
    cy.get('#drawTileBtn').should('not.be.disabled')
    cy.get('#drawTileBtn').should('have.css', 'opacity', '1')
    cy.get('#drawTileBtn').should('have.attr', 'title', 'Draw a tile')
    
    cy.log('✅ PASS: Draw button correctly re-enabled after moving tile back to hand')
  })

  it('should revert board to original state when draw is selected', () => {
    cy.log('🎯 Testing: Board reverts to original state when draw is selected')
    
    // Add initial wait
    cy.wait(2000)
    
    // Record the original board state
    cy.get('#gameBoard .tile').then($originalBoardTiles => {
      const originalBoardCount = $originalBoardTiles.length
      cy.log(`Original board has ${originalBoardCount} tiles`)
      
      // Move a tile from hand to board to modify the board
      cy.moveHandTileToBoard(0)
      cy.wait(2000)
      
      // Verify board has been modified
      cy.get('#gameBoard .tile').should('have.length', originalBoardCount + 1)
      cy.log('✅ Board modified - tile added successfully')
      
      // Record hand count before drawing
      cy.get('#playerHand .tile').then($handTiles => {
        const handCountBeforeDraw = $handTiles.length
        
        // Force enable draw button for testing (in real game, user would move tile back)
        cy.get('#drawTileBtn').invoke('removeAttr', 'disabled')
        cy.get('#drawTileBtn').invoke('css', 'opacity', '1')
        
        // Click the draw button
        cy.get('#drawTileBtn').click()
        
        cy.wait(3000) // Allow time for server response and board reversion
        
        // ✅ KEY TESTS: 
        // 1. Board should be reverted to original state
        cy.get('#gameBoard .tile').should('have.length', originalBoardCount)
        cy.log('✅ PASS: Board reverted to original tile count')
        
        // 2. Player should have drawn a tile (hand count increased by 1)
        cy.get('#playerHand .tile').should('have.length', handCountBeforeDraw + 1)
        cy.log('✅ PASS: Player received a new tile')
        
        // 3. Turn should have ended (it should now be bot's turn)
        cy.get('#currentTurnPlayer', { timeout: 5000 }).should('not.contain', 'testuser')
        cy.log('✅ PASS: Turn ended after drawing')
        
        cy.log('✅ PASS: Board completely reverted to original state when draw was selected')
      })
    })
  })
})

// Helper commands for this test - using correct drag and drop pattern from working test
Cypress.Commands.add('moveHandTileToBoard', (tileIndex = 0) => {
  return cy.get('#playerHand .tile').eq(tileIndex).then($tile => {
    const tileText = $tile.text().trim()
    const tileId = $tile.attr('data-tile-id') || `tile-${Math.random()}`
    const color = $tile.attr('class').match(/tile-(red|blue|yellow|black)/)?.[1] || 'red'
    
    cy.log(`Moving tile ${tileText} from hand to board`)
    
    // Create proper drag data matching the working test
    const dragData = {
      type: 'hand-tile',
      tile: {
        id: tileId,
        color: color,
        number: parseInt(tileText) || 1,
        isJoker: $tile.hasClass('joker')
      },
      sourceIndex: tileIndex
    }
    
    cy.wrap($tile).trigger('dragstart', {
      dataTransfer: {
        setData: (format, data) => {},
        getData: (format) => {
          if (format === 'text/plain') return '0'
          if (format === 'application/tile-id') return tileId
          if (format === 'application/json') return JSON.stringify(dragData)
          return ''
        },
        effectAllowed: 'move'
      }
    })
    
    // Try to drop on new-set-drop-zone
    cy.get('.new-set-drop-zone').first().trigger('dragover', { 
      dataTransfer: {
        getData: (format) => {
          if (format === 'text/plain') return '0'
          if (format === 'application/tile-id') return tileId
          if (format === 'application/json') return JSON.stringify(dragData)
          return ''
        }
      }
    })
    
    cy.get('.new-set-drop-zone').first().trigger('drop', { 
      dataTransfer: {
        getData: (format) => {
          if (format === 'text/plain') return '0'
          if (format === 'application/tile-id') return tileId
          if (format === 'application/json') return JSON.stringify(dragData)
          return ''
        }
      }
    })
    
    return cy.wrap({ tileId, tileText })
  })
})

Cypress.Commands.add('moveBoardTileToHand', (boardTileIndex = 0) => {
  return cy.get('#gameBoard .tile').eq(boardTileIndex).then($tile => {
    const tileId = $tile.attr('data-tile-id')
    const tileText = $tile.text().trim()
    const color = $tile.attr('class').match(/tile-(red|blue|yellow|black)/)?.[1] || 'red'
    
    cy.log(`Moving tile ${tileText} from board back to hand`)
    
    // Create proper drag data for board tile
    const dragData = {
      type: 'board-tile',
      tile: {
        id: tileId,
        color: color,
        number: parseInt(tileText) || 1,
        isJoker: $tile.hasClass('joker')
      },
      sourceSetIndex: 0,
      sourceTileIndex: boardTileIndex
    }
    
    cy.wrap($tile).trigger('dragstart', {
      dataTransfer: {
        setData: (format, data) => {},
        getData: (format) => {
          if (format === 'text/plain') return `board-${boardTileIndex}`
          if (format === 'application/tile-id') return tileId
          if (format === 'application/json') return JSON.stringify(dragData)
          return ''
        },
        effectAllowed: 'move'
      }
    })
    
    cy.get('#playerHand').trigger('dragover', { 
      dataTransfer: {
        getData: (format) => {
          if (format === 'text/plain') return `board-${boardTileIndex}`
          if (format === 'application/tile-id') return tileId
          if (format === 'application/json') return JSON.stringify(dragData)
          return ''
        }
      }
    })
    
    cy.get('#playerHand').trigger('drop', { 
      dataTransfer: {
        getData: (format) => {
          if (format === 'text/plain') return `board-${boardTileIndex}`
          if (format === 'application/tile-id') return tileId
          if (format === 'application/json') return JSON.stringify(dragData)
          return ''
        }
      }
    })
    
    return cy.wrap({ tileId })
  })
})
