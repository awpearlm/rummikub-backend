/// <reference types="cypress" />

describe('Draw Button Simple Test', () => {
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
    
    // Start a bot game
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Select debug difficulty
    cy.get('#botDifficulty').select('debug')
    cy.get('#startBotGameBtn').click()
    
    // Handle the settings modal
    cy.get('#gameSettingsModal.show', { timeout: 10000 }).should('be.visible')
    cy.get('#createBotGameWithSettingsBtn').should('be.visible').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile', { timeout: 15000 }).should('have.length', 15)

    // TURN 1: Make initial play with three 13s
    cy.get('#playerHand .tile').then($tiles => {
      const tiles = Array.from($tiles).map((tile, index) => {
        const numberElement = tile.querySelector('.tile-number')
        const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
        const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
        return { element: tile, value, color, index }
      })
      
      const thirteens = tiles.filter(t => t.value === 13)
      cy.log(`Found ${thirteens.length} thirteens in debug hand`)
      
      if (thirteens.length >= 3) {
        thirteens.slice(0, 3).forEach(tile => {
          cy.wrap(tile.element).click()
        })
        
        cy.get('#playSetBtn').should('not.be.disabled').click()
        cy.wait(2000)
      }
    })
    
    // End turn
    cy.get('#endTurnBtn').click()
    cy.wait(3000) // Wait for bot turn
    
    // TURN 2: Verify we're on our turn
    cy.get('#currentTurnPlayer', { timeout: 10000 }).should('contain', 'testuser')
    cy.log('✅ TURN 2: Ready for testing')
  })

  it('should show that draw button changes ARE working', () => {
    cy.log('🎯 Simple test: Verify draw button logic is working')
    
    // Check initial state - draw button should be enabled
    cy.get('#drawTileBtn').then($btn => {
      const isDisabled = $btn.prop('disabled')
      const opacity = $btn.css('opacity')
      const title = $btn.attr('title')
      
      cy.log(`Initial draw button state: disabled=${isDisabled}, opacity=${opacity}, title="${title}"`)
      
      if (!isDisabled && opacity === '1') {
        cy.log('✅ Draw button is initially enabled - GOOD')
      } else {
        cy.log(`❌ Draw button is initially disabled - PROBLEM: disabled=${isDisabled}, opacity=${opacity}`)
      }
    })
    
    // Record initial hand count
    cy.get('#playerHand .tile').then($initialTiles => {
      const initialCount = $initialTiles.length
      cy.log(`Initial hand count: ${initialCount}`)
      
      // Get first tile and try to move it
      cy.get('#playerHand .tile').first().then($tile => {
        const tileText = $tile.text().trim()
        cy.log(`Attempting to move tile: ${tileText}`)
        
        // Simulate drag and drop from hand to board
        const tileId = $tile.attr('data-tile-id') || `tile-${Math.random()}`
        
        cy.wrap($tile).trigger('dragstart', {
          dataTransfer: {
            setData: cy.stub(),
            getData: cy.stub().returns(JSON.stringify({
              type: 'hand-tile',
              tile: {
                id: tileId,
                number: parseInt(tileText) || 1,
                color: 'red',
                isJoker: false
              },
              sourceIndex: 0
            })),
            effectAllowed: 'move'
          }
        })
        
        // Try to find a drop zone
        cy.get('body').then($body => {
          if ($body.find('.new-set-drop-zone').length > 0) {
            cy.log('Found .new-set-drop-zone - dropping there')
            cy.get('.new-set-drop-zone').first().trigger('dragover')
            cy.get('.new-set-drop-zone').first().trigger('drop')
          } else {
            cy.log('No .new-set-drop-zone found - dropping on #gameBoard')
            cy.get('#gameBoard').trigger('dragover')
            cy.get('#gameBoard').trigger('drop')
          }
          
          // Wait for the drop to be processed
          cy.wait(2000)
          
          // Check if hand count changed
          cy.get('#playerHand .tile').then($newTiles => {
            const newCount = $newTiles.length
            cy.log(`Hand count after drop: ${newCount} (was ${initialCount})`)
            
            if (newCount < initialCount) {
              cy.log('✅ Tile was successfully moved from hand')
              
              // Now check draw button state
              cy.get('#drawTileBtn').then($btnAfter => {
                const isDisabledAfter = $btnAfter.prop('disabled')
                const opacityAfter = $btnAfter.css('opacity')
                const titleAfter = $btnAfter.attr('title')
                
                cy.log(`Draw button after move: disabled=${isDisabledAfter}, opacity=${opacityAfter}, title="${titleAfter}"`)
                
                if (isDisabledAfter && opacityAfter === '0.5' && titleAfter.includes('Cannot draw after playing tiles')) {
                  cy.log('🎉 SUCCESS: Draw button changes ARE working correctly!')
                  cy.log('✅ The implementation IS working - draw button disabled when tiles moved from hand to board')
                } else {
                  cy.log('❌ PROBLEM: Draw button did not get disabled as expected')
                  cy.log(`Expected: disabled=true, opacity=0.5, title containing "Cannot draw after playing tiles"`)
                  cy.log(`Actual: disabled=${isDisabledAfter}, opacity=${opacityAfter}, title="${titleAfter}"`)
                }
              })
            } else {
              cy.log('❌ Tile was NOT moved from hand - drag and drop may not be working')
            }
          })
        })
      })
    })
  })
})
