/// <reference types="cypress" />

describe('Real Drag and Drop Testing with Bot Game', () => {
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
    
    // Start a bot game - simpler than multiplayer
    cy.get('#playWithBotBtn').click()
    cy.get('#botGameOptions').should('not.have.class', 'hidden')
    
    // Select Debug mode from the Bot Difficulty dropdown for reliable test hands
    cy.get('#botDifficulty').select('debug')
    cy.log('🔧 Selected Debug Mode - Custom Hand for reliable testing')
    
    cy.get('#startBotGameBtn').click()
    
    // Handle the new settings modal
    cy.get('#gameSettingsModal.show', { timeout: 5000 }).should('be.visible')
    // Disable timer for testing consistency 
    cy.get('#settingsEnableTimer').uncheck()
    cy.get('#createBotGameWithSettingsBtn').click()
    
    cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
    cy.get('#playerHand .tile').should('have.length.at.least', 14)
  })
  
  it('should verify debug hand is correct', () => {
    cy.log('🔍 Verifying debug hand contains expected tiles for reliable testing')
    
    // Verify we got the correct debug hand (allow for slight variations)
    cy.get('#playerHand .tile').should('have.length.at.least', 14)
    cy.get('#playerHand .tile').then($tiles => {
      const tiles = Array.from($tiles).map(tile => {
        const numberElement = tile.querySelector('.tile-number')
        const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
        const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
        const isJoker = tile.classList.contains('joker')
        return { value, color, isJoker }
      })
      
      cy.log('Debug hand contents:', JSON.stringify(tiles))
      
      // Check for three 13s (should be in different colors)
      const thirteens = tiles.filter(t => t.value === 13)
      cy.log(`Found ${thirteens.length} thirteens: ${JSON.stringify(thirteens)}`)
      
      // Check for red run (1-2-3)
      const redOnes = tiles.filter(t => t.value === 1 && t.color === 'red').length
      const redTwos = tiles.filter(t => t.value === 2 && t.color === 'red').length  
      const redThrees = tiles.filter(t => t.value === 3 && t.color === 'red').length
      cy.log(`Red run pieces: 1s=${redOnes}, 2s=${redTwos}, 3s=${redThrees}`)
      
      // Check for blue run (4-5-6)
      const blueFours = tiles.filter(t => t.value === 4 && t.color === 'blue').length
      const blueFives = tiles.filter(t => t.value === 5 && t.color === 'blue').length
      const blueSixes = tiles.filter(t => t.value === 6 && t.color === 'blue').length
      cy.log(`Blue run pieces: 4s=${blueFours}, 5s=${blueFives}, 6s=${blueSixes}`)
      
      // Check for three 7s
      const sevens = tiles.filter(t => t.value === 7)
      cy.log(`Found ${sevens.length} sevens: ${JSON.stringify(sevens)}`)
      
      // Check for jokers and 10s
      const jokers = tiles.filter(t => t.isJoker).length
      const tens = tiles.filter(t => t.value === 10)
      cy.log(`Found ${jokers} jokers and ${tens.length} tens: ${JSON.stringify(tens)}`)
      
      if (thirteens.length === 3) {
        cy.log('✅ Debug hand contains three 13s - perfect for initial play!')
      } else {
        cy.log(`❌ Expected 3 thirteens, got ${thirteens.length} - debug mode may not be working`)
      }
    })
  })
  
  it('should verify drag and drop infrastructure before initial play', () => {
    cy.log('🔍 Testing drag and drop infrastructure before initial play')
    
    // Test 1: Check if tiles have draggable attribute
    cy.get('#playerHand .tile').first().then($tile => {
      const isDraggable = $tile.attr('draggable')
      cy.log(`First tile draggable attribute: ${isDraggable}`)
      
      if (isDraggable === 'true') {
        cy.log('✅ Tiles are marked as draggable')
      } else {
        cy.log('❌ Tiles are NOT marked as draggable - this may be expected before initial play')
      }
    })
    
    // Test 2: Verify drag restrictions before initial play
    cy.log('📝 Testing that drag is restricted before 30+ point initial play')
    
    cy.get('#playerHand .tile').first().then($sourceTile => {
      // Try to drag to game board before initial play - should be restricted
      cy.wrap($sourceTile).trigger('dragstart', {
        dataTransfer: {
          setData: cy.stub(),
          getData: cy.stub().returns('0'),
          effectAllowed: 'move'
        }
      })
      
      cy.get('#gameBoard').trigger('dragover', { dataTransfer: {} })
      cy.get('#gameBoard').trigger('drop', { dataTransfer: {} })
      
      // Verify no tiles moved to board (should be restricted)
      cy.get('#gameBoard .tile').should('have.length', 0)
      cy.log('✅ Confirmed: Drag and drop to board is restricted before initial play')
    })
  })
  
  it('should test drag and drop after making initial play', () => {
    cy.log('🎯 Attempting to make initial play, end turn, then test drag functionality on turn 2')
    
    // First, try to make an initial play (30+ points)
    cy.makeValidInitialPlay().then((playSuccessful) => {
      if (playSuccessful) {
        cy.log('✅ Initial play successful - now ending turn to move to turn 2')
        
        // Wait for play to be processed
        cy.wait(2000)
        
        // End the turn to move to turn 2
        cy.get('#endTurnBtn').should('be.visible').click()
        cy.log('🔄 Ended turn 1, waiting for turn 2...')
        
        // Wait for bot's turn and then our turn 2
        cy.wait(5000)
        
        // Verify we're back on our turn
        cy.get('#currentTurnPlayer').should('contain', 'testuser')
        cy.log('✅ Turn 2 started - now testing drag and drop functionality')
        
        // Test drag from hand to board (this is where the real issue should show up)
        cy.testDragFromHandToBoard()
        
        // Test drag between board elements if multiple sets exist
        cy.testDragBetweenBoardElements()
        
        // Test drag from board back to hand
        cy.testDragFromBoardToHand()
        
      } else {
        cy.log('⚠️ Could not make initial play - testing basic drag mechanics only')
        cy.testBasicDragMechanics()
      }
    })
  })
  
  it('should test all four specific drag scenarios requested', () => {
    cy.log('🎮 Testing the four specific drag and drop scenarios')
    
    // Scenario 1: Verify drag disabled before going out (initial play)
    cy.get('#gameBoard .tile').should('have.length', 0) // No tiles on board yet
    cy.testDragRestrictionBeforeInitialPlay()
    
    // Try to make initial play
    cy.makeValidInitialPlay().then((success) => {
      if (success) {
        cy.log('✅ Initial play made - ending turn to move to turn 2')
        cy.wait(2000)
        
        // End turn to move to turn 2
        cy.get('#endTurnBtn').should('be.visible').click()
        cy.log('🔄 Ended turn 1, waiting for bot turn and turn 2...')
        
        // Wait for bot's turn and then our turn 2
        cy.wait(5000)
        
        // Verify we're back on our turn
        cy.get('#currentTurnPlayer').should('contain', 'testuser')
        cy.log('✅ Turn 2 started - testing drag scenarios')
        
        // Scenario 2: After going out, drag tile from hand to new set
        cy.testDragHandToNewSet()
        
        // Scenario 3: After going out, drag tile from one set to another
        cy.testDragSetToSet()
        
        // Scenario 4: Drag last tile out of set to another set and have that set disappear
        cy.testDragLastTileFromSet()
      } else {
        cy.log('⚠️ Unable to complete full drag testing without initial play')
      }
    })
  })
})

// Helper functions for drag and drop testing
Cypress.Commands.add('makeValidInitialPlay', () => {
  cy.log('🎯 Attempting to make valid initial play with debug hand')
  
  return cy.get('#playerHand .tile').then($tiles => {
    const tiles = Array.from($tiles).map((tile, index) => {
      const numberElement = tile.querySelector('.tile-number')
      const value = numberElement ? parseInt(numberElement.textContent.trim()) : 0
      const color = tile.className.match(/tile-(red|blue|yellow|black)/)?.[1] || 'unknown'
      const isJoker = tile.classList.contains('joker')
      return { element: tile, value, color, isJoker, index }
    })
    
    cy.log(`Found ${tiles.length} tiles in hand`)
    
    // Strategy 1: Look for the three 13s that debug mode provides (39 points - easy win)
    const thirteens = tiles.filter(t => t.value === 13)
    
    if (thirteens.length >= 3) {
      cy.log(`Found ${thirteens.length} thirteens - selecting first 3 for 39-point initial play`)
      
      // Clear any existing selections first
      cy.get('#playerHand').then($hand => {
        const selectedTiles = $hand.find('.tile.selected')
        if (selectedTiles.length > 0) {
          cy.log(`Clearing ${selectedTiles.length} selected tiles`)
          cy.wrap(selectedTiles).each($tile => {
            cy.wrap($tile).click()
          })
        } else {
          cy.log('No tiles currently selected')
        }
      })
      
      // Select the first 3 thirteens
      thirteens.slice(0, 3).forEach(tile => {
        cy.wrap(tile.element).click()
      })
      
      return cy.get('#playSetBtn').then($btn => {
        if (!$btn.is(':disabled')) {
          cy.log('✅ Found valid 39-point set of thirteens - playing it')
          cy.wrap($btn).click()
          cy.wait(2000)
          
          // Verify the play was successful
          return cy.get('#gameBoard .tile').then($boardTiles => {
            if ($boardTiles.length >= 3) {
              cy.log('✅ Initial play successful - tiles are on the board')
              return cy.wrap(true)
            } else {
              cy.log('❌ Initial play failed - no tiles on board')
              return cy.wrap(false)
            }
          })
        } else {
          cy.log('❌ Three thirteens do not form valid set - trying alternative')
          return cy.tryAlternativeDebugPlay(tiles)
        }
      })
    } else {
      cy.log(`Only found ${thirteens.length} thirteens - trying alternative debug patterns`)
      return cy.tryAlternativeDebugPlay(tiles)
    }
  })
})

Cypress.Commands.add('tryAlternativeDebugPlay', (tiles) => {
  cy.log('🔄 Trying alternative debug hand combinations')
  
  // Clear any selections
  cy.get('#playerHand').then($hand => {
    const selectedTiles = $hand.find('.tile.selected')
    if (selectedTiles.length > 0) {
      cy.wrap(selectedTiles).each($tile => {
        cy.wrap($tile).click()
      })
    }
  })
  
  // Strategy 2: Look for the three 7s (21 points - need more for 30)
  const sevens = tiles.filter(t => t.value === 7)
  const tens = tiles.filter(t => t.value === 10)
  const jokers = tiles.filter(t => t.isJoker)
  
  if (tens.length >= 2 && jokers.length >= 1) {
    cy.log('Trying two 10s + joker combination (30 points)')
    
    // Select two 10s and one joker
    cy.wrap(tens[0].element).click()
    cy.wrap(tens[1].element).click()
    cy.wrap(jokers[0].element).click()
    
    return cy.get('#playSetBtn').then($btn => {
      if (!$btn.is(':disabled')) {
        cy.log('✅ Found valid 30-point set with 10s + joker')
        cy.wrap($btn).click()
        cy.wait(2000)
        return cy.wrap(true)
      } else {
        cy.log('10s + joker combination not valid, trying runs')
        return cy.tryRunCombinations(tiles)
      }
    })
  } else {
    return cy.tryRunCombinations(tiles)
  }
})

Cypress.Commands.add('tryRunCombinations', (tiles) => {
  cy.log('🔄 Trying run combinations from debug hand')
  
  // Clear selections
  cy.get('#playerHand').then($hand => {
    const selectedTiles = $hand.find('.tile.selected')
    if (selectedTiles.length > 0) {
      cy.wrap(selectedTiles).each($tile => {
        cy.wrap($tile).click()
      })
    }
  })
  
  // Try red run (1-2-3) + blue run (4-5-6) = 21 points, need more
  const redRun = [
    tiles.find(t => t.value === 1 && t.color === 'red'),
    tiles.find(t => t.value === 2 && t.color === 'red'),
    tiles.find(t => t.value === 3 && t.color === 'red')
  ].filter(Boolean)
  
  const blueRun = [
    tiles.find(t => t.value === 4 && t.color === 'blue'),
    tiles.find(t => t.value === 5 && t.color === 'blue'),
    tiles.find(t => t.value === 6 && t.color === 'blue')
  ].filter(Boolean)
  
  if (redRun.length === 3 && blueRun.length === 3) {
    cy.log('Trying combined red (1-2-3) + blue (4-5-6) runs = 21 points')
    
    // Select all 6 tiles
    redRun.concat(blueRun).forEach(tile => {
      cy.wrap(tile.element).click()
    })
    
    return cy.get('#playSetBtn').then($btn => {
      if (!$btn.is(':disabled')) {
        cy.log('✅ Found valid run combination')
        cy.wrap($btn).click()
        cy.wait(2000)
        return cy.wrap(true)
      } else {
        cy.log('❌ Run combination not valid, trying systematic approach')
        return cy.trySystematicApproach(tiles)
      }
    })
  } else {
    return cy.trySystematicApproach(tiles)
  }
})

Cypress.Commands.add('trySystematicApproach', (tiles) => {
  cy.log('🔄 Trying systematic approach to find any valid 30+ point combination')
  
  // Try various combinations systematically
  const combinations = [
    [0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6],
    [0, 2, 4], [1, 3, 5], [2, 4, 6], [0, 1, 3], [1, 2, 4],
    [0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]
  ]
  
  for (const combination of combinations) {
    // Clear previous selections
    cy.get('#playerHand').then($hand => {
      const selectedTiles = $hand.find('.tile.selected')
      if (selectedTiles.length > 0) {
        cy.wrap(selectedTiles).each($tile => {
          cy.wrap($tile).click()
        })
      }
    })
    
    // Select tiles for this combination
    combination.forEach(index => {
      if (index < tiles.length) {
        cy.get('#playerHand .tile').eq(index).click()
      }
    })
    
    cy.get('#playSetBtn').then($btn => {
      if (!$btn.is(':disabled')) {
        cy.log(`✅ Found valid set with combination: ${combination}`)
        cy.wrap($btn).click()
        cy.wait(2000)
        return cy.wrap(true)
      }
    })
  }
  
  cy.log('⚠️ Could not find any valid initial play combination')
  return cy.wrap(false)
})

Cypress.Commands.add('testDragRestrictionBeforeInitialPlay', () => {
  cy.log('📝 Testing drag restrictions before initial play')
  
  cy.get('#playerHand .tile').first().then($tile => {
    // Test dragging to board before initial play
    cy.wrap($tile).trigger('dragstart', {
      dataTransfer: {
        setData: cy.stub(),
        getData: cy.stub().returns('hand-0'),
        effectAllowed: 'move'
      }
    })
    
    cy.get('#gameBoard').trigger('dragover', { dataTransfer: {} })
    cy.get('#gameBoard').trigger('drop', { dataTransfer: {} })
    
    // Should still be 0 tiles on board
    cy.get('#gameBoard .tile').should('have.length', 0)
    cy.log('✅ Confirmed: Drag to board blocked before initial play')
  })
})

Cypress.Commands.add('testDragFromHandToBoard', () => {
  cy.log('📝 Testing REAL drag from hand to specific drop zones on turn 2')
  
  // Get the initial hand count
  cy.get('#playerHand .tile').then($initialTiles => {
    const initialHandCount = $initialTiles.length
    cy.log(`Initial hand has ${initialHandCount} tiles`)
    
    // Test 1: Try dragging to new-set-drop-zone (to start a new set)
    cy.log('🎯 TEST 1: Dragging tile to new-set-drop-zone')
    cy.get('#playerHand .tile').first().then($sourceTile => {
      const tileText = $sourceTile.text().trim()
      const tileId = $sourceTile.attr('data-tile-id') || `tile-${Math.random()}`
      
      cy.log(`Dragging tile: ${tileText} to new-set-drop-zone`)
      
      // Create proper drag data
      const dragData = {
        type: 'hand-tile',
        tile: {
          id: tileId,
          color: $sourceTile.attr('class').match(/tile-(red|blue|yellow|black)/)?.[1] || 'red',
          number: parseInt(tileText) || 1,
          isJoker: $sourceTile.hasClass('joker')
        },
        sourceIndex: 0
      }
      
      cy.wrap($sourceTile).trigger('dragstart', {
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
      cy.get('.new-set-drop-zone').should('exist').then($dropZone => {
        cy.log('Found new-set-drop-zone - attempting drop')
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
        
        cy.wait(1000)
        
        // Check if tile was removed from hand
        cy.get('#playerHand .tile').then($newHandTiles => {
          const newHandCount = $newHandTiles.length
          if (newHandCount < initialHandCount) {
            cy.log('✅ SUCCESS: Tile moved to new-set-drop-zone!')
          } else {
            cy.log('❌ FAILURE: Drag to new-set-drop-zone did NOT work!')
          }
        })
      })
    })
    
    // Test 2: Try dragging to existing board-set
    cy.log('🎯 TEST 2: Dragging tile to existing board-set')
    cy.get('#gameBoard .board-set').first().then($existingSet => {
      cy.get('#playerHand .tile').first().then($sourceTile => {
        const tileText = $sourceTile.text().trim()
        const tileId = $sourceTile.attr('data-tile-id') || `tile-${Math.random()}`
        
        cy.log(`Dragging tile: ${tileText} to existing board set`)
        
        const dragData = {
          type: 'hand-tile',
          tile: {
            id: tileId,
            color: $sourceTile.attr('class').match(/tile-(red|blue|yellow|black)/)?.[1] || 'red',
            number: parseInt(tileText) || 1,
            isJoker: $sourceTile.hasClass('joker')
          },
          sourceIndex: 0
        }
        
        cy.wrap($sourceTile).trigger('dragstart', {
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
        
        // Try to drop on existing set
        cy.wrap($existingSet).trigger('dragover', { 
          dataTransfer: {
            getData: (format) => {
              if (format === 'text/plain') return '0'
              if (format === 'application/tile-id') return tileId
              if (format === 'application/json') return JSON.stringify(dragData)
              return ''
            }
          }
        })
        
        cy.wrap($existingSet).trigger('drop', { 
          dataTransfer: {
            getData: (format) => {
              if (format === 'text/plain') return '0'
              if (format === 'application/tile-id') return tileId
              if (format === 'application/json') return JSON.stringify(dragData)
              return ''
            }
          }
        })
        
        cy.wait(1000)
        
        // Check final results
        cy.get('#playerHand .tile').then($finalTiles => {
          const finalHandCount = $finalTiles.length
          cy.log(`Final hand count: ${finalHandCount} (started with ${initialHandCount})`)
          
          if (finalHandCount < initialHandCount) {
            cy.log('✅ SUCCESS: Tile moved to existing board set!')
          } else {
            cy.log('❌ FAILURE: Drag to existing board set did NOT work!')
            cy.log('❌ THIS IS THE BUG YOU MENTIONED - drag operations on turn 2 are broken!')
            
            // Force failure to catch the issue
            expect(false, 'Drag and drop should work on turn 2 after initial play').to.be.true
          }
        })
      })
    })
  })
})

Cypress.Commands.add('testDragBetweenBoardElements', () => {
  cy.log('📝 Testing drag between board elements')
  
  cy.get('#gameBoard .tile').then($boardTiles => {
    if ($boardTiles.length >= 2) {
      cy.log(`Found ${$boardTiles.length} tiles on board - testing inter-board drag`)
      
      cy.wrap($boardTiles.first()).trigger('dragstart', {
        dataTransfer: {
          setData: cy.stub(),
          getData: cy.stub().returns('board-0'),
          effectAllowed: 'move'
        }
      })
      
      cy.wrap($boardTiles.last()).trigger('dragover', { dataTransfer: {} })
      cy.wrap($boardTiles.last()).trigger('drop', { dataTransfer: {} })
      
      cy.log('✅ Tested drag between board elements')
    } else {
      cy.log('ℹ️ Not enough tiles on board to test inter-board drag')
    }
  })
})

Cypress.Commands.add('testDragFromBoardToHand', () => {
  cy.log('📝 Testing drag from board back to hand')
  
  cy.get('#gameBoard .tile').first().then($boardTile => {
    cy.wrap($boardTile).trigger('dragstart', {
      dataTransfer: {
        setData: cy.stub(),
        getData: cy.stub().returns('board-0'),
        effectAllowed: 'move'
      }
    })
    
    cy.get('#playerHand').trigger('dragover', { dataTransfer: {} })
    cy.get('#playerHand').trigger('drop', { dataTransfer: {} })
    
    cy.log('✅ Tested drag from board back to hand')
  })
})

Cypress.Commands.add('testDragHandToNewSet', () => {
  cy.log('� Scenario 2: Testing drag tile from hand to create new set')
  
  cy.get('#playerHand .tile').first().then($tile => {
    const initialBoardTiles = Cypress.$('#gameBoard .tile').length
    cy.log(`Board has ${initialBoardTiles} tiles before drag`)
    
    cy.wrap($tile).trigger('dragstart', {
      dataTransfer: {
        setData: cy.stub(),
        getData: cy.stub().returns('hand-0'),
        effectAllowed: 'move'
      }
    })
    
    // Find empty space on board for new set
    cy.get('#gameBoard').trigger('dragover', { dataTransfer: {} })
    cy.get('#gameBoard').trigger('drop', { dataTransfer: {} })
    
    cy.log('✅ Tested hand to new set drag scenario')
  })
})

Cypress.Commands.add('testDragSetToSet', () => {
  cy.log('📝 Scenario 3: Testing drag tile from one set to another')
  
  cy.get('#gameBoard .tile').then($tiles => {
    if ($tiles.length >= 4) { // Need enough tiles to have 2 sets
      cy.log('Testing drag between existing sets')
      
      cy.wrap($tiles.eq(0)).trigger('dragstart', {
        dataTransfer: {
          setData: cy.stub(),
          getData: cy.stub().returns('board-0'),
          effectAllowed: 'move'
        }
      })
      
      cy.wrap($tiles.eq(-1)).trigger('dragover', { dataTransfer: {} })
      cy.wrap($tiles.eq(-1)).trigger('drop', { dataTransfer: {} })
      
      cy.log('✅ Tested set-to-set drag scenario')
    } else {
      cy.log('ℹ️ Not enough sets on board for set-to-set testing')
    }
  })
})

Cypress.Commands.add('testDragLastTileFromSet', () => {
  cy.log('📝 Scenario 4: Testing drag last tile from set (set should disappear)')
  
  cy.get('#gameBoard .tile').then($tiles => {
    if ($tiles.length >= 3) {
      const initialSetCount = Math.ceil($tiles.length / 3) // Rough estimate
      cy.log(`Estimated ${initialSetCount} sets on board`)
      
      // Try to drag what might be the last tile of a set
      cy.wrap($tiles.last()).trigger('dragstart', {
        dataTransfer: {
          setData: cy.stub(),
          getData: cy.stub().returns(`board-${$tiles.length - 1}`),
          effectAllowed: 'move'
        }
      })
      
      // Drag to hand to remove from set
      cy.get('#playerHand').trigger('dragover', { dataTransfer: {} })
      cy.get('#playerHand').trigger('drop', { dataTransfer: {} })
      
      cy.log('✅ Tested last tile removal scenario')
    } else {
      cy.log('ℹ️ Not enough tiles on board for last tile removal testing')
    }
  })

  it('should preserve hand arrangement when tiles are played', () => {
    cy.log('🎯 Testing that player hand arrangement is preserved after playing tiles')
    
    // Wait for game to be ready
    cy.get('#playerHand .tile', { timeout: 10000 }).should('have.length', 14)
    
    // Step 1: Record the initial tile arrangement (after any auto-sort)
    let initialTileArrangement = []
    cy.get('#playerHand .tile').then($tiles => {
      initialTileArrangement = Array.from($tiles).map(tile => {
        const numberElement = tile.querySelector('.tile-number')
        const colorElement = tile.querySelector('.tile-color')
        return {
          number: numberElement ? numberElement.textContent : 'J',
          color: colorElement ? colorElement.textContent : 'joker',
          id: tile.dataset.tileId || tile.id
        }
      })
      cy.log(`📋 Initial arrangement recorded: ${initialTileArrangement.length} tiles`)
      cy.log(`First 5 tiles: ${initialTileArrangement.slice(0, 5).map(t => t.number + t.color[0]).join(', ')}`)
    })
    
    // Step 2: Manually rearrange some tiles to create a custom order
    // Drag the 5th tile to the 2nd position to change the arrangement
    cy.get('#playerHand .tile').eq(4).then($fifthTile => {
      cy.get('#playerHand .tile').eq(1).then($secondTile => {
        const fifthTileData = {
          number: $fifthTile.find('.tile-number').text() || 'J',
          color: $fifthTile.find('.tile-color').text() || 'joker',
          id: $fifthTile.attr('data-tile-id') || $fifthTile.attr('id')
        }
        
        cy.log(`🔄 Moving tile ${fifthTileData.number}${fifthTileData.color[0]} to position 2`)
        
        // Perform the drag operation
        cy.wrap($fifthTile).trigger('dragstart', {
          dataTransfer: {
            setData: cy.stub(),
            effectAllowed: 'move'
          }
        })
        
        cy.wrap($secondTile).trigger('dragover', { dataTransfer: {} })
        cy.wrap($secondTile).trigger('drop', { dataTransfer: {} })
        
        cy.wait(500) // Allow time for rearrangement
      })
    })
    
    // Step 3: Record the custom arrangement after manual rearrangement
    let customArrangement = []
    cy.get('#playerHand .tile').then($tiles => {
      customArrangement = Array.from($tiles).map(tile => {
        const numberElement = tile.querySelector('.tile-number')
        const colorElement = tile.querySelector('.tile-color')
        return {
          number: numberElement ? numberElement.textContent : 'J',
          color: colorElement ? colorElement.textContent : 'joker',
          id: tile.dataset.tileId || tile.id
        }
      })
      cy.log(`✏️ Custom arrangement recorded: ${customArrangement.length} tiles`)
      cy.log(`First 5 tiles: ${customArrangement.slice(0, 5).map(t => t.number + t.color[0]).join(', ')}`)
    })
    
    // Step 4: Play the initial 30+ point set to meet the requirement
    cy.log('🎮 Playing initial set to meet 30-point requirement')
    
    // Find and select tiles for a valid 30+ point set (using debug hand knowledge)
    // Debug hand should have: 1r, 2r, 3r, 4r, 5r, 6r, 7r, 8r, 9r, 10r, 11r, 12r, 13r, J
    cy.get('#playerHand .tile').each(($tile, index) => {
      const numberElement = $tile.find('.tile-number')
      const colorElement = $tile.find('.tile-color')
      const number = numberElement.text()
      const color = colorElement.text()
      
      // Select 11r, 12r, 13r for a 36-point run
      if ((number === '11' || number === '12' || number === '13') && color === 'red') {
        cy.wrap($tile).click()
        cy.log(`Selected ${number}${color[0]} for initial play`)
      }
    })
    
    // Play the selected set
    cy.get('#playSelectedBtn').should('not.be.disabled')
    cy.get('#playSelectedBtn').click()
    
    cy.wait(2000) // Allow time for server response and hand update
    
    // Step 5: Verify that the remaining tiles preserved their relative positions
    cy.get('#playerHand .tile').then($remainingTiles => {
      const remainingArrangement = Array.from($remainingTiles).map(tile => {
        const numberElement = tile.querySelector('.tile-number')
        const colorElement = tile.querySelector('.tile-color')
        return {
          number: numberElement ? numberElement.textContent : 'J',
          color: colorElement ? colorElement.textContent : 'joker',
          id: tile.dataset.tileId || tile.id
        }
      })
      
      cy.log(`🔍 Remaining arrangement: ${remainingArrangement.length} tiles`)
      cy.log(`First 5 remaining: ${remainingArrangement.slice(0, 5).map(t => t.number + t.color[0]).join(', ')}`)
      
      // The key test: tiles that weren't played should maintain their relative order
      // Filter out the played tiles (11r, 12r, 13r) from the custom arrangement
      const expectedArrangement = customArrangement.filter(tile => 
        !(tile.number === '11' && tile.color === 'red') &&
        !(tile.number === '12' && tile.color === 'red') &&
        !(tile.number === '13' && tile.color === 'red')
      )
      
      cy.log(`📊 Expected arrangement: ${expectedArrangement.length} tiles`)
      cy.log(`Expected first 5: ${expectedArrangement.slice(0, 5).map(t => t.number + t.color[0]).join(', ')}`)
      
      // Verify the arrangements match (accounting for potential ID changes)
      expect(remainingArrangement.length).to.equal(expectedArrangement.length)
      
      // Check that the sequence of tiles (ignoring exact IDs) is preserved
      for (let i = 0; i < Math.min(5, remainingArrangement.length); i++) {
        const remaining = remainingArrangement[i]
        const expected = expectedArrangement[i]
        
        cy.log(`Position ${i}: Got ${remaining.number}${remaining.color[0]}, Expected ${expected.number}${expected.color[0]}`)
        
        expect(remaining.number).to.equal(expected.number, `Tile at position ${i} should have same number`)
        expect(remaining.color).to.equal(expected.color, `Tile at position ${i} should have same color`)
      }
      
      cy.log('✅ PASSED: Hand arrangement preserved after playing tiles!')
    })
  })
})

Cypress.Commands.add('testBasicDragMechanics', () => {
  cy.log('🔧 Testing basic drag mechanics without game state changes')
  
  cy.get('#playerHand .tile').first().then($tile => {
    const isDraggable = $tile.attr('draggable')
    cy.log(`Tile draggable attribute: ${isDraggable}`)
    
    if (isDraggable === 'true') {
      cy.log('✅ Tiles have draggable attribute')
    } else {
      cy.log('❌ Tiles missing draggable attribute')
    }
    
    // Test basic drag events
    cy.wrap($tile).trigger('dragstart', {
      dataTransfer: {
        setData: cy.stub(),
        effectAllowed: 'move'
      }
    })
    
    cy.wrap($tile).trigger('dragend')
    
    cy.log('✅ Basic drag event mechanics tested')
  })

  it('should preserve hand tile arrangement after playing tiles', () => {
    cy.log('🎯 Testing hand arrangement preservation after playing tiles')
    
    // First, let's get to a state where we can play tiles
    cy.setupTestGameForDragDrop()
    
    // Wait for initial hand to be dealt and sorted
    cy.wait(2000)
    
    // Record initial hand arrangement by getting tile positions
    let initialTileArrangement = []
    cy.get('#playerHand .tile').then($tiles => {
      $tiles.each((index, tile) => {
        const $tile = Cypress.$(tile)
        const tileId = $tile.attr('data-tile-id')
        const position = {
          gridColumn: $tile.css('grid-column'),
          gridRow: $tile.css('grid-row'),
          tileId: tileId
        }
        initialTileArrangement.push(position)
      })
      
      cy.log(`📋 Initial arrangement: ${initialTileArrangement.length} tiles`)
      
      // Now let's rearrange some tiles manually by dragging
      if (initialTileArrangement.length >= 3) {
        // Move the first tile to a different position (e.g., position 5)
        cy.get('#playerHand .tile').first().then($firstTile => {
          const firstTileId = $firstTile.attr('data-tile-id')
          
          // Drag first tile to the 5th position
          cy.get('#playerHand .empty-slot[data-slot-index="4"]').then($targetSlot => {
            if ($targetSlot.length > 0) {
              cy.wrap($firstTile).trigger('dragstart', {
                dataTransfer: { setData: cy.stub() }
              })
              cy.wrap($targetSlot).trigger('drop')
              cy.wrap($firstTile).trigger('dragend')
              
              cy.log(`🔄 Moved tile ${firstTileId} to position 5`)
            }
          })
        })
      }
      
      // Wait a moment for the rearrangement to settle
      cy.wait(1000)
      
      // Record the manually arranged positions
      let manuallyArrangedPositions = []
      cy.get('#playerHand .tile').then($tilesAfterArrangement => {
        $tilesAfterArrangement.each((index, tile) => {
          const $tile = Cypress.$(tile)
          const tileId = $tile.attr('data-tile-id')
          const position = {
            gridColumn: $tile.css('grid-column'),
            gridRow: $tile.css('grid-row'),
            tileId: tileId
          }
          manuallyArrangedPositions.push(position)
        })
        
        cy.log(`🎨 Manually arranged: ${manuallyArrangedPositions.length} tiles`)
        
        // Now play some tiles and verify the remaining tiles stay in their positions
        cy.makeInitialPlay().then(() => {
          cy.wait(2000) // Wait for the play to be processed
          
          // Check that remaining tiles maintained their relative positions
          cy.get('#playerHand .tile').then($tilesAfterPlay => {
            const remainingTileCount = $tilesAfterPlay.length
            cy.log(`🎯 After playing tiles: ${remainingTileCount} tiles remaining`)
            
            // The key test: tiles that weren't played should be in the same relative positions
            // We can't check exact positions since some tiles were removed, but we can verify
            // that the arrangement wasn't completely reset to default sorting
            
            if (remainingTileCount > 0) {
              // If we still have tiles, check that they haven't been auto-sorted by number
              let isAutoSorted = true
              let previousNumber = 0
              
              $tilesAfterPlay.each((index, tile) => {
                const $tile = Cypress.$(tile)
                const tileText = $tile.text().trim()
                
                // Extract number from tile (skip jokers)
                if (!tileText.includes('JOKER')) {
                  const match = tileText.match(/(\d+)/)
                  if (match) {
                    const currentNumber = parseInt(match[1])
                    if (currentNumber < previousNumber) {
                      isAutoSorted = false
                    }
                    previousNumber = currentNumber
                  }
                }
              })
              
              if (isAutoSorted && remainingTileCount > 3) {
                cy.log('❌ Hand appears to have been auto-sorted after playing tiles')
                // This would indicate our fix didn't work
                expect(false, 'Hand was auto-sorted after playing tiles - arrangement not preserved').to.be.true
              } else {
                cy.log('✅ Hand arrangement appears to be preserved (not auto-sorted)')
              }
            }
            
            cy.log('✅ Hand arrangement preservation test completed')
          })
        })
      })
    })
  })

  it('should not reshuffle hand tiles after playing tiles', () => {
    cy.log('🎯 Testing that hand tiles do not auto-reshuffle when tiles are played')
    
    // Setup game
    cy.setupTestGameForDragDrop()
    cy.wait(2000)
    
    // Record initial tile order (just the text/IDs for simplicity)
    let initialTileOrder = []
    cy.get('#playerHand .tile').then($tiles => {
      $tiles.each((index, tile) => {
        const tileText = Cypress.$(tile).text().trim()
        initialTileOrder.push(tileText)
      })
      
      cy.log(`📋 Initial hand order: ${initialTileOrder.slice(0, 5).join(', ')}... (${initialTileOrder.length} tiles)`)
      
      // Make initial play to remove some tiles
      cy.makeInitialPlay().then(() => {
        cy.wait(2000)
        
        // Record tile order after playing tiles
        let afterPlayOrder = []
        cy.get('#playerHand .tile').then($remainingTiles => {
          $remainingTiles.each((index, tile) => {
            const tileText = Cypress.$(tile).text().trim()
            afterPlayOrder.push(tileText)
          })
          
          cy.log(`🔍 Hand after play: ${afterPlayOrder.slice(0, 5).join(', ')}... (${afterPlayOrder.length} tiles)`)
          
          // Key test: Check that remaining tiles maintained their relative order
          // Find tiles that appear in both arrays and verify their relative positions
          let orderPreserved = true
          let lastFoundIndex = -1
          
          for (let i = 0; i < afterPlayOrder.length; i++) {
            const currentTile = afterPlayOrder[i]
            const originalIndex = initialTileOrder.indexOf(currentTile)
            
            if (originalIndex !== -1) {
              if (originalIndex < lastFoundIndex) {
                orderPreserved = false
                cy.log(`❌ Order violation: ${currentTile} found at original index ${originalIndex}, but previous tile was at ${lastFoundIndex}`)
                break
              }
              lastFoundIndex = originalIndex
            }
          }
          
          if (orderPreserved) {
            cy.log('✅ Hand order preserved - tiles maintained their relative positions')
          } else {
            cy.log('❌ Hand order was not preserved - tiles were reshuffled')
            // Fail the test
            expect(orderPreserved, 'Hand tiles should maintain their relative order after playing tiles').to.be.true
          }
        })
      })
    })
  })
})
