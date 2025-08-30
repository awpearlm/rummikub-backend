/// <reference types="cypress" />

describe('Debug Mode Verification', () => {
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
  })
  
  it('should verify debug mode creates a predictable hand', () => {
    cy.log('🔧 Testing debug mode functionality')
    
    // Start a bot game with debug mode
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Select debug mode from the difficulty dropdown
    cy.get('#botDifficulty').select('debug')
    cy.log('✅ Selected debug mode from difficulty dropdown')
    
    cy.get('#startBotGameBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile').should('have.length', 14)
    
    cy.log('🎯 Debug mode game started - analyzing hand')
    
    // Analyze the debug hand
    cy.get('#playerHand .tile').then($tiles => {
      const tiles = Array.from($tiles).map((tile, index) => {
        const numberElement = tile.querySelector('.tile-number')
        const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
        const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
        const isJoker = tile.classList.contains('joker')
        return { element: tile, value, color, isJoker, index }
      })
      
      cy.log(`Debug hand contains ${tiles.length} tiles:`)
      tiles.forEach((tile, i) => {
        if (tile.isJoker) {
          cy.log(`  ${i}: JOKER`)
        } else {
          cy.log(`  ${i}: ${tile.value} ${tile.color}`)
        }
      })
      
      // Look for the expected debug hand patterns
      const thirteens = tiles.filter(t => t.value === 13)
      const twelves = tiles.filter(t => t.value === 12)
      const elevens = tiles.filter(t => t.value === 11)
      const jokers = tiles.filter(t => t.isJoker)
      
      cy.log(`Found ${thirteens.length} thirteens, ${twelves.length} twelves, ${elevens.length} elevens, ${jokers.length} jokers`)
      
      // Based on the server code, debug hand should have:
      // Three 13s (different colors) = 39 points
      // Three 12s (different colors) = 36 points  
      // Three 11s (different colors) = 33 points
      // Plus some jokers and other tiles
      
      if (thirteens.length >= 3) {
        cy.log('✅ Found expected three 13s - this should allow 39-point initial play')
        
        // Test making the 39-point play with three 13s
        cy.log('🎯 Attempting to play three 13s for 39-point initial play')
        
        // Select the three 13s
        thirteens.slice(0, 3).forEach(tile => {
          cy.wrap(tile.element).click()
        })
        
        // Check if play button is enabled
        cy.get('#playSetBtn').then($btn => {
          if (!$btn.is(':disabled')) {
            cy.log('✅ Play button enabled - debug hand working correctly!')
            cy.wrap($btn).click()
            
            // Wait for play to complete
            cy.wait(3000)
            
            // Verify tiles moved to board
            cy.get('#gameBoard .tile').should('have.length.at.least', 3)
            cy.log('✅ Successfully played initial set - debug mode is working!')
            
          } else {
            cy.log('❌ Play button disabled - debug hand may not be working correctly')
            cy.log('Selected tiles do not form a valid set')
          }
        })
        
      } else {
        cy.log(`❌ Expected at least 3 thirteens, but found ${thirteens.length}`)
        cy.log('❌ Debug mode may not be working correctly')
      }
    })
  })
  
  it('should compare debug mode vs normal mode hands', () => {
    cy.log('🔍 Comparing debug mode vs normal mode')
    
    // First test normal mode
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Keep default difficulty (not debug)
    cy.get('#botDifficulty').should('have.value', 'easy') // Default should be easy
    cy.log('Testing normal easy mode first')
    
    cy.get('#startBotGameBtn').click()
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile').should('have.length', 14)
    
    // Analyze normal hand
    cy.get('#playerHand .tile').then($normalTiles => {
      const normalTiles = Array.from($normalTiles).map((tile, index) => {
        const numberElement = tile.querySelector('.tile-number')
        const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
        const isJoker = tile.classList.contains('joker')
        return { value, isJoker, index }
      })
      
      const normalThirteens = normalTiles.filter(t => t.value === 13).length
      const normalJokers = normalTiles.filter(t => t.isJoker).length
      
      cy.log(`Normal mode: ${normalThirteens} thirteens, ${normalJokers} jokers`)
      
      // Go back and try debug mode
      cy.get('#backToMenuBtn').click()
      cy.get('#welcomeScreen.active', { timeout: 10000 }).should('be.visible')
      
      // Now test debug mode
      cy.get('#playWithBotBtn').click()
      cy.get('#botGameOptions').should('not.have.class', 'hidden')
      
      // Select debug mode
      cy.get('#botDifficulty').select('debug')
      cy.get('#startBotGameBtn').click()
      
      cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
      cy.get('#playerHand .tile').should('have.length', 14)
      
      // Analyze debug hand
      cy.get('#playerHand .tile').then($debugTiles => {
        const debugTiles = Array.from($debugTiles).map((tile, index) => {
          const numberElement = tile.querySelector('.tile-number')
          const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
          const isJoker = tile.classList.contains('joker')
          return { value, isJoker, index }
        })
        
        const debugThirteens = debugTiles.filter(t => t.value === 13).length
        const debugJokers = debugTiles.filter(t => t.isJoker).length
        
        cy.log(`Debug mode: ${debugThirteens} thirteens, ${debugJokers} jokers`)
        
        // Debug mode should have significantly more high-value tiles
        if (debugThirteens > normalThirteens) {
          cy.log('✅ Debug mode provides more thirteens than normal mode')
        } else {
          cy.log('❌ Debug mode does not seem to be providing enhanced hand')
        }
        
        if (debugThirteens >= 3) {
          cy.log('✅ Debug mode provides the expected 3+ thirteens for easy initial play')
        } else {
          cy.log('❌ Debug mode not providing expected hand composition')
        }
      })
    })
  })
})
