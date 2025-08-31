/// <reference types="cypress" />

describe('Last Tile Duplication Bug - Event Monitoring', () => {
  beforeEach(() => {
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
    cy.get('#botDifficulty').select('lastTile')
    cy.get('#startBotGameBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile').should('have.length', 4)
  })

  it('should monitor all events during last tile drag-drop to find duplication source', () => {
    cy.log('🎯 Event monitoring test for last tile duplication')
    
    // Set up to our critical state (1 tile left)
    cy.setupLastTileState()
    
    // Now monitor and perform the critical drag-drop
    cy.window().then((win) => {
      const game = win.game
      
      // Set up event monitoring
      const events = []
      const originalEmit = game.socket.emit
      const originalOn = game.socket.on
      
      // Monitor socket emissions
      game.socket.emit = function(event, ...args) {
        events.push({
          type: 'EMIT',
          event: event,
          args: args,
          timestamp: Date.now()
        })
        cy.log(`📡 EMIT: ${event}`, args)
        return originalEmit.apply(this, arguments)
      }
      
      // Monitor socket receptions
      const monitorSocketEvent = (eventName) => {
        game.socket.on(eventName, (...args) => {
          events.push({
            type: 'RECEIVE',
            event: eventName,
            args: args,
            timestamp: Date.now()
          })
          cy.log(`📨 RECEIVE: ${eventName}`, args)
        })
      }
      
      // Monitor key events
      ['gameStateUpdate', 'invalidMove', 'error', 'boardUpdated'].forEach(monitorSocketEvent)
      
      // Get initial state
      const initialHand = [...game.gameState.playerHand]
      const initialBoard = JSON.parse(JSON.stringify(game.gameState.board))
      const lastTile = initialHand[0]
      
      cy.log(`🎯 MONITORING: Last tile ${lastTile.number} ${lastTile.color} (${lastTile.id})`)
      cy.log(`📊 Initial: Hand=${initialHand.length}, Board=${initialBoard.flat().length}`)
      
      // Wait and then perform the drag-drop WITH real DOM events
      cy.wait(3000).then(() => {
        cy.log('🚀 Starting monitored drag-drop sequence...')
        
        // Get the actual tile element
        cy.get('#playerHand .tile').first().then($tile => {
          const tileElement = $tile[0]
          const tileId = tileElement.dataset.tileId
          
          cy.log(`🎯 Dragging tile element: ID=${tileId}`)
          
          // Create proper drag data
          const dragData = {
            type: 'hand-tile',
            tile: lastTile,
            sourceIndex: 0
          }
          
          // Step 1: Trigger dragstart
          cy.log('1️⃣ Triggering dragstart...')
          const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
          })
          
          // Set the data properly
          dragStartEvent.dataTransfer.setData('text/plain', '0')
          dragStartEvent.dataTransfer.setData('application/tile-id', tileId)
          dragStartEvent.dataTransfer.setData('application/json', JSON.stringify(dragData))
          
          tileElement.dispatchEvent(dragStartEvent)
          
          cy.wait(2000).then(() => {
            cy.log('2️⃣ Finding drop zone...')
            
            // Step 2: Find and trigger drop
            cy.get('.new-set-drop-zone').should('exist').then($dropZone => {
              const dropElement = $dropZone[0]
              
              cy.log('3️⃣ Triggering dragover...')
              const dragOverEvent = new DragEvent('dragover', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dragStartEvent.dataTransfer
              })
              
              dropElement.dispatchEvent(dragOverEvent)
              
              cy.wait(1000).then(() => {
                cy.log('4️⃣ Triggering drop...')
                
                const dropEvent = new DragEvent('drop', {
                  bubbles: true,
                  cancelable: true,
                  dataTransfer: dragStartEvent.dataTransfer
                })
                
                dropElement.dispatchEvent(dropEvent)
                
                cy.wait(1000).then(() => {
                  cy.log('5️⃣ Triggering dragend...')
                  
                  const dragEndEvent = new DragEvent('dragend', {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dragStartEvent.dataTransfer
                  })
                  
                  tileElement.dispatchEvent(dragEndEvent)
                  
                  // Wait for server response and check results
                  cy.wait(5000).then(() => {
                    cy.log('🔍 ANALYZING RESULTS...')
                    
                    const finalHand = game.gameState.playerHand
                    const finalBoard = game.gameState.board
                    
                    cy.log(`📊 Final: Hand=${finalHand.length}, Board=${finalBoard.flat().length}`)
                    
                    // Log all events that occurred
                    cy.log('📋 EVENT SEQUENCE:')
                    events.forEach((evt, i) => {
                      cy.log(`  ${i+1}. ${evt.type}: ${evt.event}`)
                    })
                    
                    // Check for duplication
                    if (finalHand.length === 0) {
                      cy.log('✅ SUCCESS: No duplication detected')
                    } else if (finalHand.length === 1) {
                      const remainingTile = finalHand[0]
                      if (remainingTile.id === lastTile.id) {
                        cy.log('🚨 DUPLICATION DETECTED!')
                        cy.log(`🚨 Same tile still in hand: ${remainingTile.number} ${remainingTile.color}`)
                        
                        // Check if it's also on board
                        const boardTileIds = finalBoard.flat().map(t => t.id)
                        if (boardTileIds.includes(lastTile.id)) {
                          cy.log('🚨 CONFIRMED: Tile exists on BOTH hand AND board!')
                          
                          // This is the bug - force failure to document it
                          expect(finalHand.length, 'DUPLICATION BUG: Same tile exists in hand and board').to.equal(0)
                        } else {
                          cy.log('❌ Drop failed: Tile stayed in hand, not on board')
                        }
                      } else {
                        cy.log('❓ Different tile in hand than expected')
                      }
                    }
                    
                    cy.wait(3000) // Final observation time
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})

// Helper command to set up the state with 1 tile left
Cypress.Commands.add('setupLastTileState', () => {
  cy.log('🔧 Setting up last tile state...')
  
  // Clear selections
  cy.get('#playerHand').then($hand => {
    const selectedTiles = $hand.find('.tile.selected')
    if (selectedTiles.length > 0) {
      selectedTiles.each((index, tile) => {
        cy.wrap(tile).click()
      })
    }
  })
  
  // Select three 13s
  cy.get('#playerHand .tile').each($tile => {
    const tileText = $tile.text().trim()
    if (tileText === '13') {
      cy.wrap($tile).click()
    }
  })
  
  cy.wait(1000)
  
  // Play the set
  cy.get('#playSetBtn').should('not.be.disabled').click()
  cy.wait(2000)
  
  // Verify 1 tile left
  cy.get('#playerHand .tile').should('have.length', 1)
  
  // End turn
  cy.get('#endTurnBtn').click()
  cy.wait(5000)
  
  // Wait for our turn
  cy.get('#currentTurnPlayer').should('contain', 'testuser')
  cy.get('#playerHand .tile').should('have.length', 1)
  
  cy.log('✅ Ready: 1 tile in hand, our turn')
})
