/// <reference types="cypress" />

describe('Last Tile Duplication Bug - Direct Test', () => {
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

  it('should detect last tile duplication bug with visual debugging', () => {
    cy.log('🎯 DIRECT TEST: Last tile duplication bug detection')
    
    // STEP 1: Verify starting conditions (4 tiles: three 13s + one extra)
    cy.get('#playerHand .tile').should('have.length', 4)
    cy.log('✅ Starting with 4-tile hand')
    cy.wait(2000) // Visual pause
    
    // STEP 2: Make initial play with the three 13s
    cy.log('🎯 STEP 2: Making initial play with three 13s')
    
    // Clear any selections first (if any exist)
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
    
    cy.wait(2000) // Visual pause to see selections
    
    // Play the set
    cy.get('#playSetBtn').should('not.be.disabled').click()
    cy.log('✅ Played three 13s (39 points)')
    
    cy.wait(3000) // Wait for play to complete
    
    // Verify we now have 1 tile left
    cy.get('#playerHand .tile').should('have.length', 1)
    cy.log('✅ Now have exactly 1 tile left in hand')
    
    // STEP 3: End our turn
    cy.get('#endTurnBtn').should('be.visible').click()
    cy.log('🔄 Ending turn 1, waiting for bot...')
    
    cy.wait(5000) // Wait for bot turn
    
    // STEP 4: Wait for our turn 2
    cy.get('#currentTurnPlayer').should('contain', 'testuser')
    cy.log('✅ Back to our turn with 1 tile left')
    
    // STEP 5: THE CRITICAL TEST - Drag the last tile
    cy.log('🚨 CRITICAL TEST: Dragging the LAST tile in hand')
    cy.wait(2000) // Visual pause before the critical operation
    
    // Record initial state with detailed logging
    cy.get('#playerHand .tile').should('have.length', 1).then($handTiles => {
      const handTile = $handTiles[0]
      const tileText = handTile.textContent.trim()
      const tileId = handTile.getAttribute('data-tile-id') || 'unknown'
      const tileClasses = handTile.className
      
      cy.log(`🎯 LAST TILE INFO:`)
      cy.log(`  - Text: "${tileText}"`)
      cy.log(`  - ID: "${tileId}"`)
      cy.log(`  - Classes: "${tileClasses}"`)
      
      // Get initial board count
      cy.get('#gameBoard .tile').then($boardTiles => {
        const initialBoardCount = $boardTiles.length
        cy.log(`📋 BEFORE DRAG: Hand=1 tile, Board=${initialBoardCount} tiles`)
        
        cy.wait(3000) // Long pause to see initial state clearly
        
        // THE CRITICAL DRAG OPERATION
        cy.log('🚀 STARTING DRAG OF LAST TILE...')
        cy.log('👀 WATCH CAREFULLY: Does the tile disappear from hand or stay?')
        
        cy.wrap(handTile).should('be.visible')
        
        // Start drag
        cy.log('1️⃣ Triggering dragstart...')
        cy.wrap(handTile).trigger('dragstart', {
          dataTransfer: {
            setData: () => {},
            getData: () => tileId,
            effectAllowed: 'move'
          }
        })
        
        cy.wait(2000) // Pause after dragstart
        
        // Find drop zone and drop
        cy.get('.new-set-drop-zone').should('exist').then($dropZone => {
          cy.log('2️⃣ Dragging over drop zone...')
          cy.wrap($dropZone).trigger('dragover')
          
          cy.wait(1000)
          
          cy.log('3️⃣ DROPPING NOW...')
          cy.wrap($dropZone).trigger('drop', {
            dataTransfer: {
              getData: () => tileId
            }
          })
          
          cy.wait(4000) // Long pause to see the result
          
          // CRITICAL VERIFICATION
          cy.log('🔍 CHECKING FOR DUPLICATION BUG...')
          
          cy.get('#playerHand .tile').then($finalHandTiles => {
            const finalHandCount = $finalHandTiles.length
            
            cy.get('#gameBoard .tile').then($finalBoardTiles => {
              const finalBoardCount = $finalBoardTiles.length
              
              cy.log('📊 RESULTS:')
              cy.log(`  - Hand: 1 → ${finalHandCount} tiles`)
              cy.log(`  - Board: ${initialBoardCount} → ${finalBoardCount} tiles`)
              
              if (finalHandCount === 0 && finalBoardCount > initialBoardCount) {
                cy.log('✅ SUCCESS: Tile moved correctly (hand empty, board gained tile)')
              } else if (finalHandCount === 1 && finalBoardCount > initialBoardCount) {
                cy.log('🚨 DUPLICATION BUG DETECTED!')
                cy.log('🚨 Tile is BOTH in hand AND on board!')
                cy.log('🚨 This is the bug you reported!')
                
                // Log what tile is still in hand
                const remainingTile = $finalHandTiles[0]
                const remainingText = remainingTile.textContent.trim()
                cy.log(`🚨 Tile still in hand: "${remainingText}"`)
                
                // Intentionally fail the test to highlight the bug
                expect(finalHandCount, 'DUPLICATION BUG: Last tile should not remain in hand after successful drag-drop').to.equal(0)
                
              } else if (finalHandCount === 1 && finalBoardCount === initialBoardCount) {
                cy.log('❌ DRAG FAILED: Tile stayed in hand, nothing added to board')
                cy.log('❌ This means the drag-drop simulation is not working')
                
                // This is what you're observing - test should fail here
                throw new Error('DRAG OPERATION COMPLETELY FAILED: Tile did not move at all')
                
              } else {
                cy.log(`❓ UNEXPECTED STATE: Hand=${finalHandCount}, Board change=${finalBoardCount - initialBoardCount}`)
                throw new Error(`Unexpected result after drag operation`)
              }
              
              cy.wait(5000) // Final long pause to observe the final state
            })
          })
        })
      })
    })
  })
})
