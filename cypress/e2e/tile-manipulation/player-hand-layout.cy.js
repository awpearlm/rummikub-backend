/// <reference types="cypress" />

describe('Player Hand Layout', () => {
  beforeEach(() => {
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
    
    // Start a bot game for all tests
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    cy.get('#startBotGameBtn').click()
    
    // Game screen should be visible
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Wait for player's hand to be populated
    cy.get('#playerHand .tile', { timeout: 15000 }).should('have.length.at.least', 1)
  })

  it('should display player hand with correct width', () => {
    // Check that the player hand has an appropriate width for 10 tiles per row
    cy.get('#playerHand').should('have.css', 'display', 'grid')
    
    // Check the width of the player hand (should be around 720px)
    cy.get('#playerHand').invoke('outerWidth').should('be.gt', 650)
  })

  it('should correctly wrap tiles to the next row after 10 tiles', () => {
    // This test requires the player to have more than 10 tiles
    // We'll check that tiles properly wrap to the next row
    
    // First, ensure we have at least 11 tiles to check the wrapping
    cy.get('#playerHand .tile').its('length').then(tileCount => {
      cy.log(`Found ${tileCount} tiles in player hand`)
      
      if (tileCount > 10) {
        // Check the positions of the first tile
        cy.get('#playerHand .tile').eq(0).then($firstTile => {
          const firstTileTop = $firstTile[0].getBoundingClientRect().top
          
          // Find a tile in the second row
          cy.get('#playerHand .tile').each(($tile, index) => {
            if (index > 9) { // After 10 tiles
              const tileTop = $tile[0].getBoundingClientRect().top
              
              // Should be on a different row (greater top position)
              expect(tileTop).to.be.gt(firstTileTop + 10)
              
              // We only need to check one tile from the second row
              return false
            }
          })
        })
      } else {
        cy.log('Not enough tiles to check wrapping')
      }
    })
  })

  it('should maintain proper tile spacing and appearance', () => {
    // Check that the tiles have proper spacing and don't overlap
    cy.get('#playerHand .tile').then($tiles => {
      if ($tiles.length >= 2) {
        // Get positions of two adjacent tiles
        const firstTileRect = $tiles[0].getBoundingClientRect()
        const secondTileRect = $tiles[1].getBoundingClientRect()
        
        // Tiles should not overlap horizontally
        expect(secondTileRect.left).to.be.gt(firstTileRect.right - 5)
        
        cy.log(`First tile: left=${firstTileRect.left}, right=${firstTileRect.right}`)
        cy.log(`Second tile: left=${secondTileRect.left}, right=${secondTileRect.right}`)
      }
    })
    
    // Check that tiles maintain proper size
    cy.get('#playerHand .tile').first().invoke('outerWidth').should('be.gt', 30)
    cy.get('#playerHand .tile').first().invoke('outerHeight').should('be.gt', 30)
  })
})
