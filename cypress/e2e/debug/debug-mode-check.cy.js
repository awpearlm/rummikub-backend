/// <reference types="cypress" />

describe('Debug Mode Verification', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
  })
  
  it('should verify debug mode is working correctly', () => {
    cy.log('🔍 Testing debug mode step by step')
    
    // Start bot game
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Check what difficulty options are available
    cy.get('#botDifficulty option').then($options => {
      const options = Array.from($options).map(opt => opt.value)
      cy.log('Available difficulty options:', JSON.stringify(options))
      
      if (options.includes('debug')) {
        cy.log('✅ Debug option is available in dropdown')
      } else {
        cy.log('❌ Debug option NOT found in dropdown')
      }
    })
    
    // Select debug mode explicitly
    cy.get('#botDifficulty').select('debug')
    
    // Verify the selection
    cy.get('#botDifficulty').should('have.value', 'debug')
    cy.log('✅ Debug mode selected in dropdown')
    
    // Start the game
    cy.get('#startBotGameBtn').click()
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Check hand size - debug mode gives 15 tiles
    cy.get('#playerHand .tile').then($tiles => {
      cy.log(`Hand contains ${$tiles.length} tiles`)
      
      if ($tiles.length === 15) {
        cy.log('✅ Got 15 tiles - debug mode is working!')
      } else if ($tiles.length === 14) {
        cy.log('❌ Got 14 tiles - debug mode is NOT working (normal mode)')
      } else {
        cy.log(`❌ Got ${$tiles.length} tiles - unexpected count`)
      }
      
      // Log what tiles we actually got
      const tiles = Array.from($tiles).map(tile => {
        const numberElement = tile.querySelector('.tile-number')
        const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
        const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
        const isJoker = tile.classList.contains('joker')
        return { value, color, isJoker }
      })
      
      cy.log('Actual hand:', JSON.stringify(tiles))
      
      // Check for debug hand signatures
      const thirteens = tiles.filter(t => t.value === 13)
      const sevens = tiles.filter(t => t.value === 7)
      const jokers = tiles.filter(t => t.isJoker)
      
      cy.log(`Hand analysis: ${thirteens.length} thirteens, ${sevens.length} sevens, ${jokers.length} jokers`)
      
      if (thirteens.length === 3 && sevens.length === 3 && jokers.length === 1) {
        cy.log('✅ Debug hand signature detected - debug mode is working!')
      } else {
        cy.log('❌ Debug hand signature NOT found - debug mode is broken')
      }
    })
  })
})
