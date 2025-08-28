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
        cy.get('#email').type(email)
        cy.get('#password').type(password)
        cy.get('#login-button').click()
        
        // Wait for redirect back to main page
        cy.url({ timeout: 15000 }).should('not.include', 'login.html')
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
