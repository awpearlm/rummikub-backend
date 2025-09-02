// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Helper function to get current backend URL
Cypress.Commands.add('getBackendUrl', () => {
  return cy.wrap(Cypress.env('currentBackendUrl') || Cypress.config('baseUrl'))
})

// Helper function to get current frontend URL
Cypress.Commands.add('getFrontendUrl', () => {
  return cy.wrap(Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl'))
})

// Custom command to check if localStorage has a game saved
Cypress.Commands.add('hasStoredGame', () => {
  return cy.window().then(win => {
    const gameInfo = win.localStorage.getItem('rummikub_game_info')
    return gameInfo !== null
  })
})

// Custom command to handle authentication and login
Cypress.Commands.add('login', (email = 'testuser@example.com', password = 'testpass123') => {
  cy.getFrontendUrl().then(frontendUrl => {
    // First try to visit the main page to see if we get redirected
    cy.visit(frontendUrl, { failOnStatusCode: false })
    
    // Check if we're redirected to login page
    cy.url().then(url => {
      if (url.includes('login.html')) {
        // We're on login page, proceed with login
        cy.get('#email', { timeout: 10000 }).should('be.visible').clear().type(email)
        cy.get('#password', { timeout: 10000 }).should('be.visible').clear().type(password)
        cy.get('#login-button').should('be.visible').click()
        
        // Wait for either redirect or error message
        cy.get('body').then($body => {
          // Check for error message first
          if ($body.find('.error-message').length > 0) {
            cy.get('.error-message').then($error => {
              if ($error.is(':visible') && $error.text().trim() !== '') {
                // Login failed, let the test fail with the error message
                cy.log(`Login failed: ${$error.text()}`)
                throw new Error(`Login failed: ${$error.text()}`)
              }
            })
          }
        })
        
        // Wait for redirect back to main page
        cy.url({ timeout: 20000 }).should('not.include', 'login.html')
        cy.url().should('include', 'index.html')
      }
      // If not redirected, we're already authenticated
    })
  })
})

// Custom command to create a test user account (for use in beforeEach)
Cypress.Commands.add('createTestUser', (email = 'testuser@example.com', password = 'testpass123') => {
  cy.getBackendUrl().then(backendUrl => {
    // Try to register the test user (will fail if already exists, that's ok)
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/auth/register`,
      body: { 
        username: 'TestUser',
        email: email, 
        password: password 
      },
      failOnStatusCode: false
    }).then(response => {
      cy.log(`User creation response: ${response.status} - ${response.body?.message || 'Success'}`)
      // Don't fail if user already exists (status 400 with "already exists" message is ok)
      if (response.status !== 201 && response.status !== 400) {
        cy.log(`Unexpected status code during user creation: ${response.status}`)
      }
    })
  })
})

// Custom command to ensure authenticated session
Cypress.Commands.add('ensureAuthenticated', (email = 'testuser@example.com', password = 'testpass123') => {
  // Create test user first (idempotent)
  cy.createTestUser(email, password)
  
  // Then login
  cy.login(email, password)
})

// Custom command to create a new game
Cypress.Commands.add('createGame', (playerName) => {
  // Visit the frontend URL
  cy.getFrontendUrl().then(url => {
    cy.visit(url, { failOnStatusCode: false })
    cy.log(`Visiting frontend URL: ${url}`)
  })
  
  // Fill out the form and create game
  cy.get('#playerName').clear().type(playerName)
  cy.get('#playWithFriendsBtn').click()
  cy.get('#createGameBtn').click()
  
  // Wait for the game to be created and game screen to be visible
  cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
  
  // Player should be listed in the players area
  cy.get('#playersList', { timeout: 15000 }).should('be.visible')
  cy.get('#playersList').should('contain', playerName)
  
  // Get and return the game ID
  return cy.get('#currentGameId').invoke('text')
})

// Custom command to join a game
Cypress.Commands.add('joinGame', (playerName, gameId) => {
  // Visit the frontend URL
  cy.getFrontendUrl().then(url => {
    cy.visit(url, { failOnStatusCode: false })
    cy.log(`Visiting frontend URL: ${url}`)
  })
  
  // Fill out the form and join game
  cy.get('#playerName').clear().type(playerName)
  cy.get('#playWithFriendsBtn').click()
  cy.get('#joinGameBtn').click()
  cy.get('#gameId').clear().type(gameId)
  cy.get('#joinGameSubmit').click()
  
  // Wait for the game to be joined and game screen to be visible
  cy.get('#gameScreen.active', { timeout: 15000 }).should('be.visible')
})

// Custom command to simulate connection loss
Cypress.Commands.add('simulateConnectionLoss', () => {
  return cy.window().then(win => {
    // Store a reference to the original socket
    const originalSocket = win.game.socket
    
    // Disconnect the socket
    win.game.socket.disconnect()
    
    // Return the socket so we can reconnect later if needed
    return originalSocket
  })
})

// Custom command to simulate reconnection
Cypress.Commands.add('simulateReconnection', (socket) => {
  return cy.window().then(win => {
    // Reconnect the socket
    socket.connect()
  })
})

// Command to force the connection lost overlay to appear
Cypress.Commands.add('forceConnectionLostOverlay', () => {
  return cy.window().then(win => {
    win.game.showConnectionLostOverlay()
  })
})

// Command to get game info from localStorage
Cypress.Commands.add('getStoredGameInfo', () => {
  return cy.window().then(win => {
    const gameInfoStr = win.localStorage.getItem('rummikub_game_info')
    if (gameInfoStr) {
      return JSON.parse(gameInfoStr)
    }
    return null
  })
})

// Command to log the current environment configuration
Cypress.Commands.add('logEnvironmentInfo', () => {
  // Simple console.log for debugging - doesn't use cy.task()
  const environment = Cypress.env('environment') || 'local';
  const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
  const backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl');
  
  console.log(`Testing Environment: ${environment}`);
  console.log(`Frontend URL: ${frontendUrl}`);
  console.log(`Backend URL: ${backendUrl}`);
  
  // Also log to the test interface
  cy.log(`Testing Environment: ${environment}`);
  cy.log(`Frontend URL: ${frontendUrl}`);
  cy.log(`Backend URL: ${backendUrl}`);
})

// Command to check if the draw button is enabled
Cypress.Commands.add('drawButtonShouldBeEnabled', () => {
  cy.get('#drawTileBtn').should('not.be.disabled')
  cy.get('#drawTileBtn').should('have.css', 'opacity', '1')
})

// Command to check if the draw button is disabled
Cypress.Commands.add('drawButtonShouldBeDisabled', () => {
  cy.get('#drawTileBtn').should('be.disabled')
  cy.get('#drawTileBtn').should('have.css', 'opacity', '0.5')
})

// Command to store the initial board state
Cypress.Commands.add('storeInitialBoardState', () => {
  cy.get('#gameBoard').invoke('html').as('initialBoardState')
})

// Command to check if board matches the stored initial state
Cypress.Commands.add('boardShouldMatchInitialState', () => {
  cy.get('#gameBoard').invoke('html').then(currentBoardHtml => {
    cy.get('@initialBoardState').then(initialBoardHtml => {
      expect(currentBoardHtml).to.equal(initialBoardHtml)
    })
  })
})

// ===== INVITATION SYSTEM COMMANDS =====

// Command to create admin user and get auth token
Cypress.Commands.add('createAdminUser', (username = 'testadmin', email = 'testadmin@test.com', password = 'adminpass123') => {
  cy.getBackendUrl().then(backendUrl => {
    // Try to register admin user
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/auth/register`,
      body: { username, email, password },
      failOnStatusCode: false
    }).then(() => {
      // Login to get token
      cy.request({
        method: 'POST',
        url: `${backendUrl}/api/auth/login`,
        body: { email, password }
      }).then((response) => {
        const authToken = response.body.token
        const userId = response.body.user.id
        
        // Make user admin
        cy.request({
          method: 'PUT',
          url: `${backendUrl}/api/admin/users/${userId}`,
          headers: { 'Authorization': `Bearer ${authToken}` },
          body: { isAdmin: true },
          failOnStatusCode: false
        })
        
        return cy.wrap({ authToken, userId, username, email })
      })
    })
  })
})

// Command to setup admin session in browser
Cypress.Commands.add('loginAsAdmin', (authToken, username = 'testadmin', userId = null) => {
  cy.getFrontendUrl().then(frontendUrl => {
    cy.visit(`${frontendUrl}/admin.html`)
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', authToken)
      win.localStorage.setItem('username', username)
      win.localStorage.setItem('is_admin', 'true')
      if (userId) {
        win.localStorage.setItem('user_id', userId)
      }
    })
    cy.reload()
  })
})

// Command to create invitation via API
Cypress.Commands.add('createInvitation', (authToken, email, message = 'Test invitation') => {
  cy.getBackendUrl().then(backendUrl => {
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/admin/invitations`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: { email, message }
    }).then((response) => {
      expect(response.status).to.equal(201)
      return cy.wrap(response.body.invitation)
    })
  })
})

// Command to validate invitation token
Cypress.Commands.add('validateInvitationToken', (token) => {
  cy.getBackendUrl().then(backendUrl => {
    cy.request({
      method: 'GET',
      url: `${backendUrl}/api/auth/invitation/${token}`,
      failOnStatusCode: false
    }).then((response) => {
      return cy.wrap(response)
    })
  })
})

// Command to register user with invitation token
Cypress.Commands.add('registerWithInvitation', (username, password, invitationToken) => {
  cy.getBackendUrl().then(backendUrl => {
    cy.request({
      method: 'POST',
      url: `${backendUrl}/api/auth/register-invitation`,
      headers: { 'Content-Type': 'application/json' },
      body: { username, password, invitationToken },
      failOnStatusCode: false
    }).then((response) => {
      return cy.wrap(response)
    })
  })
})

// Command to navigate to admin invitations tab
Cypress.Commands.add('goToInvitationsTab', () => {
  cy.get('[data-tab="invitations"]', { timeout: 10000 }).should('be.visible').click()
  cy.wait(1000)
  cy.get('#invitationsTableBody').should('be.visible')
})

// Command to send invitation through admin UI
Cypress.Commands.add('sendInvitationViaUI', (email, message = '') => {
  cy.get('button').contains('Send Invitation').should('be.visible').click()
  cy.get('#inviteForm').should('be.visible')
  cy.get('#inviteEmail').type(email)
  if (message) {
    cy.get('#inviteMessage').type(message)
  }
  cy.get('button').contains('Send').click()
  
  // Wait for and close the invitation link modal
  cy.get('.modal.show', { timeout: 10000 }).should('be.visible')
  cy.get('.invitation-link-input').invoke('val').as('invitationLink')
  cy.get('.modal.show button').contains('Close').click()
  
  // Return the invitation link
  cy.get('@invitationLink')
})

// Command to extract token from invitation link
Cypress.Commands.add('extractTokenFromLink', (invitationLink) => {
  const url = new URL(invitationLink)
  const token = url.searchParams.get('token')
  return cy.wrap(token)
})

// Command to complete signup flow
Cypress.Commands.add('completeSignup', (invitationToken, username, password) => {
  cy.getFrontendUrl().then(frontendUrl => {
    cy.visit(`${frontendUrl}/signup.html?token=${invitationToken}`)
    cy.get('#signupForm', { timeout: 10000 }).should('be.visible')
    
    cy.get('#username').type(username)
    cy.get('#password').type(password)
    cy.get('#confirmPassword').type(password)
    cy.get('#signupButton').click()
    
    cy.get('#signupSuccess', { timeout: 10000 }).should('be.visible')
    cy.url({ timeout: 5000 }).should('include', 'index.html')
    
    // Verify auth data in localStorage
    cy.window().then((win) => {
      expect(win.localStorage.getItem('auth_token')).to.not.be.null
      expect(win.localStorage.getItem('username')).to.equal(username)
    })
  })
})

// Command to check invitation status in admin table
Cypress.Commands.add('checkInvitationStatus', (email, expectedStatus) => {
  cy.get('#invitationsTableBody tr').contains(email).parent().within(() => {
    cy.get('.status-badge').should('contain', expectedStatus)
  })
})

// Command to cancel invitation from admin UI
Cypress.Commands.add('cancelInvitationViaUI', (email) => {
  cy.get('#invitationsTableBody tr').contains(email).parent().within(() => {
    cy.get('button').contains('Cancel').click()
  })
  
  cy.get('.modal.show').should('be.visible')
  cy.get('.modal.show button').contains('Delete').click()
  
  cy.get('.notification.success', { timeout: 10000 }).should('contain', 'cancelled successfully')
  cy.get('#invitationsTableBody').should('not.contain', email)
})

// Command to copy invitation link from admin table
Cypress.Commands.add('copyInvitationLink', (email) => {
  cy.get('#invitationsTableBody tr').contains(email).parent().within(() => {
    cy.get('button').contains('Copy Link').click()
  })
  
  cy.get('.notification.success', { timeout: 5000 }).should('contain', 'Link copied to clipboard')
})

// Command to wait for invitation to appear in table
Cypress.Commands.add('waitForInvitationInTable', (email, timeout = 10000) => {
  cy.get('#invitationsTableBody', { timeout }).should('contain', email)
  cy.get('#invitationsTableBody tr').contains(email).parent().should('be.visible')
})

// Command to verify invitation table row data
Cypress.Commands.add('verifyInvitationTableRow', (email, invitedBy, status = 'Pending') => {
  cy.get('#invitationsTableBody tr').contains(email).parent().within(() => {
    cy.get('td').eq(0).should('contain', email)
    cy.get('td').eq(1).should('contain', invitedBy)
    cy.get('td').eq(2).should('contain', status)
    cy.get('td').eq(3).should('not.be.empty') // Sent date
    cy.get('td').eq(4).should('not.be.empty') // Expires date
  })
})

// ===== GAME PLAY COMMANDS =====

// Command to make a valid initial play in debug mode
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

// Command to try alternative plays when standard debug play doesn't work
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
        cy.log('✅ Two 10s + joker forms valid set - playing it')
        cy.wrap($btn).click()
        cy.wait(2000)
        
        return cy.get('#gameBoard .tile').then($boardTiles => {
          if ($boardTiles.length >= 3) {
            cy.log('✅ Alternative play successful')
            return cy.wrap(true)
          } else {
            cy.log('❌ Alternative play failed')
            return cy.wrap(false)
          }
        })
      } else {
        cy.log('❌ Two 10s + joker not valid - trying basic sequence')
        return cy.tryBasicSequence(tiles)
      }
    })
  } else {
    cy.log('Not enough tens/jokers - trying basic sequence')
    return cy.tryBasicSequence(tiles)
  }
})

// Command to try a basic sequence as fallback
Cypress.Commands.add('tryBasicSequence', (tiles) => {
  cy.log('🔄 Trying basic sequence as last resort')
  
  // Try to find any 3+ consecutive numbers in same color
  const colors = ['red', 'blue', 'yellow', 'black']
  
  for (const color of colors) {
    const colorTiles = tiles.filter(t => t.color === color && !t.isJoker).sort((a, b) => a.value - b.value)
    
    // Look for consecutive numbers
    for (let i = 0; i < colorTiles.length - 2; i++) {
      const tile1 = colorTiles[i]
      const tile2 = colorTiles[i + 1]
      const tile3 = colorTiles[i + 2]
      
      if (tile2.value === tile1.value + 1 && tile3.value === tile2.value + 1) {
        const totalValue = tile1.value + tile2.value + tile3.value
        if (totalValue >= 30) {
          cy.log(`Found valid sequence: ${tile1.value}, ${tile2.value}, ${tile3.value} in ${color} (${totalValue} points)`)
          
          // Clear selections and select these tiles
          cy.get('#playerHand .tile.selected').click({ multiple: true })
          cy.wrap(tile1.element).click()
          cy.wrap(tile2.element).click()
          cy.wrap(tile3.element).click()
          
          return cy.get('#playSetBtn').then($btn => {
            if (!$btn.is(':disabled')) {
              cy.wrap($btn).click()
              cy.wait(2000)
              return cy.wrap(true)
            } else {
              return cy.wrap(false)
            }
          })
        }
      }
    }
  }
  
  cy.log('❌ No valid initial play found in debug hand')
  return cy.wrap(false)
})
