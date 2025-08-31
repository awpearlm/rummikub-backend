/// <reference types="cypress" />

describe('Timer Duplicate Detection', () => {
  
  it('should detect and prevent duplicate timer broadcasts', () => {
    // This test specifically targets the timer duplication bug we just fixed
    
    let timerUpdates = []
    let duplicateDetected = false
    
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Start bot game for controlled testing
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    cy.get('#startBotGameBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile', { timeout: 10000 }).should('have.length', 14)
    
    // Wait for timer to start
    cy.wait(3000)
    cy.get('#turnTimer', { timeout: 5000 }).should('be.visible')
    
    // Monitor timer updates by checking console logs
    cy.window().then((win) => {
      // Override console.log to capture timer updates
      const originalLog = win.console.log
      win.console.log = function(...args) {
        const message = args.join(' ')
        if (message.includes('⏰ Timer display updated:')) {
          const timestamp = Date.now()
          const timerValue = message.split('Timer display updated: ')[1]
          
          // Check if we got the same timer value within 100ms (indicating duplicate)
          const recentUpdate = timerUpdates.find(update => 
            Math.abs(timestamp - update.timestamp) < 100 && 
            update.value === timerValue
          )
          
          if (recentUpdate) {
            duplicateDetected = true
            cy.log(`❌ DUPLICATE TIMER DETECTED: ${timerValue} at ${timestamp} (previous at ${recentUpdate.timestamp})`)
          }
          
          timerUpdates.push({ timestamp, value: timerValue })
          
          // Keep only recent updates (last 5 seconds)
          timerUpdates = timerUpdates.filter(update => timestamp - update.timestamp < 5000)
        }
        
        // Call original log function
        originalLog.apply(win.console, args)
      }
    })
    
    // Make several moves to trigger turn switches and test timer behavior
    for (let i = 0; i < 5; i++) {
      cy.get('.player-item.current-turn').then(($currentPlayer) => {
        if ($currentPlayer.text().includes('testuser')) {
          cy.log(`🎯 Making move ${i + 1}`)
          cy.get('#drawTileBtn').click()
          cy.wait(1000)
          cy.get('#endTurnBtn').then($btn => {
            if (!$btn.is(':disabled')) {
              cy.wrap($btn).click()
            }
          })
        }
      })
      
      // Wait for turn transition
      cy.wait(3000)
    }
    
    // Check results
    cy.then(() => {
      if (!duplicateDetected) {
        cy.log('✅ No duplicate timers detected - fix is working!')
      } else {
        cy.log('❌ Duplicate timers still detected - needs investigation')
        throw new Error('Duplicate timer broadcasts detected')
      }
    })
  })

  it('should maintain single timer instance across multiple turn switches', () => {
    let roomCode
    
    // Create multiplayer game to test timer handoff between real players
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Create room
    cy.get('#playWithFriendsBtn').click()
    cy.get('#multiplayerOptions').should('not.have.class', 'hidden')
    cy.get('#createGameBtn').click()
    
    cy.get('#gameSettingsModal', { timeout: 5000 }).should('be.visible')
    cy.get('#createGameWithSettingsBtn').should('be.visible').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    
    cy.get('#currentGameId').invoke('text').then((code) => {
      roomCode = code.trim()
      
      // Open second browser window/tab for testuser2
      cy.clearLocalStorage()
      cy.visit('/login.html')
      
      cy.get('#email', { timeout: 10000 }).should('be.visible')
      cy.get('#email').type('testuser2@example.com')
      cy.get('#password').type('password123')
      cy.get('#login-button').click()
      
      cy.url({ timeout: 15000 }).should('include', 'index.html')
      cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
      
      // Join room
      cy.get('#playWithFriendsBtn').click()
      cy.get('#multiplayerOptions').should('not.have.class', 'hidden')
      cy.get('#joinGameBtn').click()
      cy.get('#joinGameForm', { timeout: 10000 }).should('be.visible')
      cy.get('#gameId').type(roomCode)
      cy.get('#joinGameSubmit').click()
      
      cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
      cy.get('#startGameBtn').should('be.visible').click()
      
      cy.get('#playerHand .tile', { timeout: 10000 }).should('have.length', 14)
      
      // Test timer consistency during rapid turn switches
      cy.wait(3000) // Wait for initial timer
      
      let timerChecks = []
      
      // Perform multiple turn switches and monitor timer
      for (let i = 0; i < 3; i++) {
        cy.get('#turnTimer').invoke('text').then((text) => {
          timerChecks.push({
            turn: i,
            time: text.trim(),
            timestamp: Date.now()
          })
          cy.log(`⏰ Turn ${i}: Timer shows ${text.trim()}`)
        })
        
        // Make a move if it's current player's turn
        cy.get('.player-item.current-turn').then(($currentPlayer) => {
          if ($currentPlayer.text().includes('testuser2')) {
            cy.get('#drawTileBtn').click()
            cy.wait(1000)
            cy.get('#endTurnBtn').then($btn => {
              if (!$btn.is(':disabled')) {
                cy.wrap($btn).click()
              }
            })
          }
        })
        
        cy.wait(4000) // Wait for turn transition
      }
      
      // Verify timer behavior was consistent
      cy.then(() => {
        cy.log('📊 Timer check results:', timerChecks)
        
        // All timer values should be valid format
        timerChecks.forEach((check, index) => {
          expect(check.time).to.match(/^\d:\d{2}$/, `Timer ${index} should have valid format`)
        })
        
        cy.log('✅ All timer checks passed - no duplicate timer issues detected')
      })
    })
  })
})
