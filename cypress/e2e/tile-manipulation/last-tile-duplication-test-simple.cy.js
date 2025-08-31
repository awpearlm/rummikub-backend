/// <reference types="cypress" />

describe('Last Tile Duplication Bug Test', () => {
  beforeEach(() => {
    // Log environment info
    const environment = Cypress.env('environment') || 'local';
    const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
    const backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl');
    
    cy.log(`Testing Environment: ${environment}`);
    cy.log(`Frontend URL: ${frontendUrl}`);
    cy.log(`Backend URL: ${backendUrl}`);
    
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

  it('should test last tile duplication bug specifically', () => {
    cy.log('🎯 Testing the specific last tile duplication bug')
    
    // Step 1: Verify we have exactly 4 tiles: three 13s + one extra
    cy.get('#playerHand .tile').should('have.length', 4)
    cy.log('✅ Confirmed 4-tile hand for last tile test')
    
    // Step 2: Make initial play with three 13s (39 points - well over 30)
    cy.makeInitialPlayWith13sFromSmallHand().then((success) => {
      if (!success) {
        throw new Error('Failed to make initial play with three 13s from 4-tile hand')
      }
      
      cy.log('✅ Initial play successful - now ending turn to move to turn 2')
      
      // Step 3: End turn to advance to turn 2
      cy.wait(2000)
      cy.get('#endTurnBtn').should('be.visible').click()
      cy.log('🔄 Ended turn 1, waiting for bot turn and turn 2...')
      
      // Wait for bot's turn and then our turn 2
      cy.wait(5000)
      
      // Step 4: Verify we're back on our turn with exactly 1 tile left
      cy.get('#currentTurnPlayer').should('contain', 'testuser')
      cy.get('#playerHand .tile').should('have.length', 1)
      cy.log('✅ Turn 2 started - testing last tile drag duplication with 1 tile remaining')
      
      // Step 5: Test last tile duplication bug
      cy.testLastTileDuplication()
    })
  })
})

// Helper function to make initial play from 4-tile hand (three 13s + one extra)
Cypress.Commands.add('makeInitialPlayWith13sFromSmallHand', () => {
  cy.log('🎯 Making initial play from 4-tile hand: three 13s + one extra')
  
  return cy.get('#playerHand .tile').then($tiles => {
    if ($tiles.length !== 4) {
      cy.log(`❌ Expected 4 tiles, got ${$tiles.length}`)
      return cy.wrap(false)
    }
    
    const tiles = Array.from($tiles).map((tile, index) => {
      const numberElement = tile.querySelector('.tile-number')
      const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
      const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
      const isJoker = tile.classList.contains('joker')
      return { element: tile, value, color, isJoker, index }
    })
    
    const thirteens = tiles.filter(t => t.value === 13)
    const nonThirteens = tiles.filter(t => t.value !== 13)
    
    cy.log(`Found ${thirteens.length} thirteens and ${nonThirteens.length} other tiles`)
    
    if (thirteens.length !== 3) {
      cy.log(`❌ Expected exactly 3 thirteens, got ${thirteens.length}`)
      return cy.wrap(false)
    }
    
    // Clear any existing selections
    cy.get('#playerHand').then($hand => {
      const selectedTiles = $hand.find('.tile.selected')
      if (selectedTiles.length > 0) {
        cy.log(`Clearing ${selectedTiles.length} selected tiles`)
        selectedTiles.each((index, tile) => {
          cy.wrap(tile).click()
        })
      }
    })
    
    // Select all three 13s
    thirteens.forEach(tile => {
      cy.wrap(tile.element).click()
    })
    
    cy.log('🎯 Selected three 13s for 39-point initial play')
    
    return cy.get('#playSetBtn').then($btn => {
      if (!$btn.is(':disabled')) {
        cy.log('✅ Playing three 13s (39 points)')
        cy.wrap($btn).click()
        cy.wait(2000)
        
        // Verify the play was successful and we have 1 tile left
        return cy.get('#playerHand .tile').then($remainingTiles => {
          if ($remainingTiles.length === 1) {
            cy.log('✅ Initial play successful - 1 tile remaining for duplication test')
            return cy.wrap(true)
          } else {
            cy.log(`❌ Expected 1 tile remaining, got ${$remainingTiles.length}`)
            return cy.wrap(false)
          }
        })
      } else {
        cy.log('❌ Play Set button is disabled - invalid set')
        return cy.wrap(false)
      }
    })
  })
})

// Helper function to test last tile duplication
Cypress.Commands.add('testLastTileDuplication', () => {
  cy.log('🔍 Testing last tile duplication bug')
  
  // Step 1: Verify current hand size
  cy.get('#playerHand .tile').then($initialTiles => {
    const initialHandSize = $initialTiles.length
    cy.log(`Current hand size: ${initialHandSize} tiles`)
    
    if (initialHandSize === 0) {
      throw new Error('Hand is already empty - cannot test last tile duplication')
    }
    
    // Step 2: If more than 1 tile, make moves until only 1 tile remains
    if (initialHandSize > 1) {
      cy.log(`Need to reduce hand from ${initialHandSize} tiles to 1 tile`)
      cy.reduceHandToOneTile(initialHandSize)
    }
    
    // Step 3: Now test the last tile duplication
    cy.testDuplicationWithLastTile()
  })
})

// Helper function to reduce hand to one tile
Cypress.Commands.add('reduceHandToOneTile', (currentSize) => {
  cy.log(`🎯 Reducing hand from ${currentSize} tiles to 1 tile`)
  
  for (let i = currentSize; i > 1; i--) {
    cy.log(`Attempting to place tile ${currentSize - i + 1}`)
    
    // Try to place a tile on the board
    cy.get('#playerHand .tile').first().then($tile => {
      const tileId = $tile.attr('data-tile-id') || `tile-${Math.random()}`
      
      // Create drag data for the tile
      const dragData = {
        type: 'hand-tile',
        tile: {
          id: tileId,
          color: $tile.attr('class').match(/tile-(red|blue|yellow|black)/)?.[1] || 'red',
          number: parseInt($tile.text().trim()) || 1,
          isJoker: $tile.hasClass('joker')
        },
        sourceIndex: 0
      }
      
      // Try to drop on board (new set)
      cy.wrap($tile).trigger('dragstart', {
        dataTransfer: {
          setData: () => {},
          getData: (format) => {
            if (format === 'text/plain') return '0'
            if (format === 'application/tile-id') return tileId
            if (format === 'application/json') return JSON.stringify(dragData)
            return ''
          },
          effectAllowed: 'move'
        }
      })
      
      // Drop on the new-set-drop-zone or board
      cy.get('.new-set-drop-zone, #gameBoard').first().then($dropZone => {
        cy.wrap($dropZone).trigger('dragover', { 
          dataTransfer: {
            getData: (format) => {
              if (format === 'text/plain') return '0'
              if (format === 'application/tile-id') return tileId
              if (format === 'application/json') return JSON.stringify(dragData)
              return ''
            }
          }
        })
        
        cy.wrap($dropZone).trigger('drop', { 
          dataTransfer: {
            getData: (format) => {
              if (format === 'text/plain') return '0'
              if (format === 'application/tile-id') return tileId
              if (format === 'application/json') return JSON.stringify(dragData)
              return ''
            }
          }
        })
      })
      
      cy.wait(1000)
    })
    
    // Verify hand size decreased
    cy.get('#playerHand .tile').should('have.length', i - 1)
  }
  
  cy.log('✅ Successfully reduced hand to 1 tile')
})

// Helper function to test duplication with the last tile
Cypress.Commands.add('testDuplicationWithLastTile', () => {
  cy.log('🔍 CRITICAL TEST: Testing duplication with last tile in hand')
  
  // Step 1: Verify we have exactly 1 tile in hand
  cy.get('#playerHand .tile').should('have.length', 1)
  cy.log('✅ Confirmed: Exactly 1 tile in hand')
  
  // Step 2: Get initial board state
  cy.get('#gameBoard .tile').then($initialBoardTiles => {
    const initialBoardSize = $initialBoardTiles.length
    cy.log(`Initial board has ${initialBoardSize} tiles`)
    
    // Step 3: Drag the last tile to the board
    cy.get('#playerHand .tile').first().then($lastTile => {
      const tileText = $lastTile.text().trim()
      const tileId = $lastTile.attr('data-tile-id') || `last-tile-${Math.random()}`
      
      cy.log(`🎯 Dragging LAST tile: ${tileText} (ID: ${tileId})`)
      
      const dragData = {
        type: 'hand-tile',
        tile: {
          id: tileId,
          color: $lastTile.attr('class').match(/tile-(red|blue|yellow|black)/)?.[1] || 'red',
          number: parseInt(tileText) || 1,
          isJoker: $lastTile.hasClass('joker')
        },
        sourceIndex: 0
      }
      
      // Perform the drag operation
      cy.wrap($lastTile).trigger('dragstart', {
        dataTransfer: {
          setData: () => {},
          getData: (format) => {
            if (format === 'text/plain') return '0'
            if (format === 'application/tile-id') return tileId
            if (format === 'application/json') return JSON.stringify(dragData)
            return ''
          },
          effectAllowed: 'move'
        }
      })
      
      // Drop on board
      cy.get('.new-set-drop-zone, #gameBoard').first().then($dropZone => {
        cy.wrap($dropZone).trigger('dragover', { 
          dataTransfer: {
            getData: (format) => {
              if (format === 'text/plain') return '0'
              if (format === 'application/tile-id') return tileId
              if (format === 'application/json') return JSON.stringify(dragData)
              return ''
            }
          }
        })
        
        cy.wrap($dropZone).trigger('drop', { 
          dataTransfer: {
            getData: (format) => {
              if (format === 'text/plain') return '0'
              if (format === 'application/tile-id') return tileId
              if (format === 'application/json') return JSON.stringify(dragData)
              return ''
            }
          }
        })
      })
      
      cy.wait(2000)
      
      // Step 4: CRITICAL VERIFICATION - Check for duplication bug
      cy.log('🔍 CRITICAL: Verifying no duplication occurred')
      
      // Check hand size - should be 0 (tile should be gone from hand)
      cy.get('#playerHand .tile').then($finalHandTiles => {
        const finalHandSize = $finalHandTiles.length
        cy.log(`Final hand size: ${finalHandSize}`)
        
        if (finalHandSize === 0) {
          cy.log('✅ PASS: Tile properly removed from hand')
        } else if (finalHandSize === 1) {
          cy.log('❌ FAIL: DUPLICATION BUG DETECTED - Tile still in hand after drag!')
          
          // Additional verification - check if the same tile exists on board AND in hand
          cy.get('#gameBoard .tile').then($finalBoardTiles => {
            const finalBoardSize = $finalBoardTiles.length
            cy.log(`Final board size: ${finalBoardSize} (was ${initialBoardSize})`)
            
            if (finalBoardSize > initialBoardSize) {
              cy.log('❌ CRITICAL BUG: Tile duplicated - exists on both board AND in hand!')
              
              // Force test failure with detailed error
              expect(finalHandSize, 'DUPLICATION BUG: Last tile should be removed from hand after drag-drop').to.equal(0)
            }
          })
        } else {
          cy.log(`⚠️ Unexpected hand size: ${finalHandSize}`)
        }
      })
      
      // Step 5: Verify board received the tile
      cy.get('#gameBoard .tile').then($finalBoardTiles => {
        const finalBoardSize = $finalBoardTiles.length
        
        if (finalBoardSize > initialBoardSize) {
          cy.log('✅ PASS: Tile properly added to board')
        } else {
          cy.log('❌ FAIL: Tile not added to board - drag operation failed')
        }
      })
    })
  })
})
