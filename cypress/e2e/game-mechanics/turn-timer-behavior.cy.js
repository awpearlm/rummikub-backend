/// <reference types="cypress" />

describe('Turn Timer Behavior', () => {
  
  beforeEach(() => {
    // Clear any previous state
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('should properly handle timer behavior during turn switches with bot player', () => {
    let timerValue1, timerValue2, timerValue3

    cy.log('🎮 Testing timer behavior with bot opponent')
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')
    
    // Start bot game to test timer functionality
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    cy.get('#startBotGameBtn').click()
    
    // Handle the new settings modal
    cy.get('#gameSettingsModal.show', { timeout: 5000 }).should('be.visible')
    // Ensure timer is enabled for testing
    cy.get('#settingsEnableTimer').check()
    cy.get('#createBotGameWithSettingsBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile', { timeout: 10000 }).should('have.length', 14)
    
    // Wait for turn notification to complete and timer to start
    cy.wait(3000)
    
    // === TEST 1: Verify timer exists and counts down ===
    cy.log('⏰ Test 1: Verifying timer countdown')
    cy.get('#turnTimer', { timeout: 5000 }).should('be.visible')
    
    cy.get('#turnTimer').invoke('text').then((text) => {
      timerValue1 = text.trim()
      cy.log(`⏰ Initial timer value: ${timerValue1}`)
      expect(timerValue1).to.match(/^\d:\d{2}$/)
      
      // Wait 3 seconds and verify timer decreases
      cy.wait(3000)
      cy.get('#turnTimer').invoke('text').then((text) => {
        timerValue2 = text.trim()
        cy.log(`⏰ Timer after 3 seconds: ${timerValue2}`)
        
        const seconds1 = convertTimerToSeconds(timerValue1)
        const seconds2 = convertTimerToSeconds(timerValue2)
        
        expect(seconds2).to.be.lessThan(seconds1)
        expect(seconds1 - seconds2).to.be.within(2, 4) // Should be ~3 seconds difference
        cy.log(`✅ Timer counting down properly: ${seconds1}s → ${seconds2}s`)
      })
    })
    
    // === TEST 2: Verify timer resets on turn switch ===
    cy.log('🎮 Test 2: Testing timer reset on turn switch')
    
    // Make a move to trigger turn switch (only if it's player's turn)
    cy.get('.player-item.current-turn').then(($currentPlayer) => {
      if ($currentPlayer.text().includes('testuser')) {
        cy.log('🎯 Making move as testuser to trigger turn switch')
        cy.get('#drawTileBtn').should('be.visible').click()
        cy.wait(1000)
        
        cy.get('#endTurnBtn').then($btn => {
          if (!$btn.is(':disabled')) {
            cy.wrap($btn).click()
          }
        })
        
        // Wait for turn transition (bot move + turn switch back)
        cy.wait(5000)
        
        // Verify timer reset when turn comes back to player
        cy.get('#turnTimer').invoke('text').then((text) => {
          timerValue3 = text.trim()
          cy.log(`⏰ Timer after turn switch: ${timerValue3}`)
          
          const seconds3 = convertTimerToSeconds(timerValue3)
          const seconds2 = convertTimerToSeconds(timerValue2)
          
          // Timer should be reset to a higher value
          expect(seconds3).to.be.greaterThan(seconds2)
          expect(seconds3).to.be.greaterThan(110) // Should be close to 120
          cy.log(`✅ Timer properly reset: ${seconds2}s → ${seconds3}s`)
        })
      } else {
        cy.log('🤖 Bot has first turn, waiting for bot to play')
        // Wait for bot to play and turn to switch to player
        cy.wait(5000)
        
        cy.get('#turnTimer').invoke('text').then((text) => {
          timerValue3 = text.trim()
          cy.log(`⏰ Timer when turn switches to player: ${timerValue3}`)
          expect(timerValue3).to.match(/^\d:\d{2}$/)
        })
      }
    })
  })

  it('should detect duplicate timer issues through console monitoring', () => {
    let timerUpdates = []
    let duplicateDetected = false
    let rapidUpdatesDetected = false

    cy.log('🔍 Testing for duplicate timer broadcasts')
    
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')

    // Start bot game
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    cy.get('#startBotGameBtn').click()
    
    // Handle the new settings modal
    cy.get('#gameSettingsModal.show', { timeout: 5000 }).should('be.visible')
    // Ensure timer is enabled for testing
    cy.get('#settingsEnableTimer').check()
    cy.get('#createBotGameWithSettingsBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile', { timeout: 10000 }).should('have.length', 14)

    // Monitor console for timer-related logs
    cy.window().then((win) => {
      const originalLog = win.console.log
      win.console.log = function(...args) {
        const message = args.join(' ')
        if (message.includes('⏰ Timer display updated:') || message.includes('⏰ Timer update from server:')) {
          const timestamp = Date.now()
          const timerValue = message.split(': ')[1]
          
          // Check for rapid successive updates (potential duplicates)
          const recentUpdates = timerUpdates.filter(update => 
            Math.abs(timestamp - update.timestamp) < 500
          )
          
          if (recentUpdates.length > 2) {
            rapidUpdatesDetected = true
            cy.log(`⚠️ Rapid timer updates detected: ${recentUpdates.length} updates in 500ms`)
          }
          
          // Check for exact duplicates within 200ms
          const exactDuplicate = timerUpdates.find(update => 
            Math.abs(timestamp - update.timestamp) < 200 && 
            update.value === timerValue
          )
          
          if (exactDuplicate) {
            duplicateDetected = true
            cy.log(`❌ DUPLICATE TIMER: ${timerValue} at ${timestamp} (duplicate of ${exactDuplicate.timestamp})`)
          }
          
          timerUpdates.push({ timestamp, value: timerValue, message })
          
          // Keep only recent updates (last 10 seconds)
          timerUpdates = timerUpdates.filter(update => timestamp - update.timestamp < 10000)
        }
        
        originalLog.apply(win.console, args)
      }
    })
    
    // Wait for timer to start and run for a while
    cy.wait(3000)
    cy.get('#turnTimer', { timeout: 5000 }).should('be.visible')
    
    // Make several moves to trigger turn switches
    for (let i = 0; i < 3; i++) {
      cy.get('.player-item.current-turn').then(($currentPlayer) => {
        if ($currentPlayer.text().includes('testuser')) {
          cy.log(`🎯 Making move ${i + 1} to test timer behavior`)
          cy.get('#drawTileBtn').click()
          cy.wait(1000)
          cy.get('#endTurnBtn').then($btn => {
            if (!$btn.is(':disabled')) {
              cy.wrap($btn).click()
            }
          })
        }
      })
      
      // Wait for turn cycle (player → bot → player)
      cy.wait(4000)
    }
    
    // Analyze results
    cy.then(() => {
      cy.log(`📊 Timer monitoring results:`)
      cy.log(`- Total timer updates captured: ${timerUpdates.length}`)
      cy.log(`- Duplicate timers detected: ${duplicateDetected}`)
      cy.log(`- Rapid updates detected: ${rapidUpdatesDetected}`)
      
      if (duplicateDetected) {
        cy.log('❌ DUPLICATE TIMER ISSUE DETECTED - Fix needed!')
        throw new Error('Duplicate timer broadcasts detected')
      }
      
      if (rapidUpdatesDetected) {
        cy.log('⚠️ Rapid timer updates detected - potential performance issue')
      }
      
      if (!duplicateDetected && !rapidUpdatesDetected) {
        cy.log('✅ Timer behavior is clean - no duplicates or rapid updates!')
      }
    })
  })

  it('should maintain consistent timer format throughout game', () => {
    cy.log('� Testing timer format consistency')
    
    cy.visit('/')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#email').type('testuser@example.com')
    cy.get('#password').type('password123')
    cy.get('#login-button').click()
    
    cy.url({ timeout: 15000 }).should('include', 'index.html')
    cy.get('#welcomeScreen.active', { timeout: 15000 }).should('be.visible')

    // Start bot game
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    cy.get('#startBotGameBtn').click()
    
    // Handle the new settings modal
    cy.get('#gameSettingsModal.show', { timeout: 5000 }).should('be.visible')
    // Ensure timer is enabled for testing
    cy.get('#settingsEnableTimer').check()
    cy.get('#createBotGameWithSettingsBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile', { timeout: 10000 }).should('have.length', 14)

    cy.wait(3000)
    cy.get('#turnTimer', { timeout: 5000 }).should('be.visible')
    
    // Sample timer values over time
    const timerSamples = []
    
    for (let i = 0; i < 10; i++) {
      cy.get('#turnTimer').invoke('text').then((text) => {
        const timerValue = text.trim()
        timerSamples.push(timerValue)
        
        // Verify format is always M:SS
        expect(timerValue).to.match(/^\d:\d{2}$/, `Timer sample ${i + 1} should have format M:SS`)
        
        // Verify timer value is reasonable (0:00 to 2:00)
        const seconds = convertTimerToSeconds(timerValue)
        expect(seconds).to.be.within(0, 120, `Timer sample ${i + 1} should be between 0-120 seconds`)
        
        cy.log(`⏰ Sample ${i + 1}: ${timerValue} (${seconds}s)`)
      })
      
      cy.wait(1000)
    }
    
    cy.then(() => {
      cy.log('✅ All timer format checks passed')
      cy.log('Timer samples:', timerSamples)
    })
  })
})

// Helper function to convert timer display to seconds
function convertTimerToSeconds(timerText) {
  const [minutes, seconds] = timerText.split(':').map(Number)
  return minutes * 60 + seconds
}
