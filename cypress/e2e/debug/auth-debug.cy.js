/// <reference types="cypress" />

describe('Authentication Debug', () => {
  
  it('should debug the login process step by step', () => {
    // Log environment info
    const environment = Cypress.env('environment') || 'local';
    const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
    const backendUrl = Cypress.env('currentBackendUrl') || Cypress.config('baseUrl');
    
    console.log(`Testing Environment: ${environment}`);
    console.log(`Frontend URL: ${frontendUrl}`);
    console.log(`Backend URL: ${backendUrl}`);
    
    cy.log(`Testing Environment: ${environment}`);
    cy.log(`Frontend URL: ${frontendUrl}`);
    cy.log(`Backend URL: ${backendUrl}`);
    
    // Clear all state first
    cy.clearCookies()
    cy.clearLocalStorage()
    
    // Visit the site - this will redirect to login.html if not authenticated
    cy.log('Step 1: Visiting homepage')
    cy.visit('/')
    
    // Wait for redirect to login page
    cy.log('Step 2: Checking if redirected to login')
    cy.url({ timeout: 10000 }).should('include', 'login.html')
    cy.log('✅ Successfully redirected to login page')
    
    // Check if login form elements are present
    cy.log('Step 3: Checking login form elements')
    cy.get('#email', { timeout: 10000 }).should('be.visible')
    cy.get('#password', { timeout: 10000 }).should('be.visible')
    cy.get('#login-button', { timeout: 10000 }).should('be.visible')
    cy.log('✅ Login form elements are visible')
    
    // Fill in credentials
    cy.log('Step 4: Filling in credentials')
    cy.get('#email').clear().type('testuser@example.com')
    cy.get('#password').clear().type('password123')
    cy.log('✅ Credentials filled')
    
    // Click login and wait for response
    cy.log('Step 5: Clicking login button')
    cy.get('#login-button').click()
    
    // Wait a moment and check what happens
    cy.wait(3000)
    
    // Check current URL and page state
    cy.log('Step 6: Checking post-login state')
    cy.url().then((url) => {
      cy.log(`Current URL after login: ${url}`)
    })
    
    // Check for any error messages
    cy.get('body').then(($body) => {
      if ($body.find('.error').length > 0) {
        cy.get('.error').then(($error) => {
          cy.log(`Error message found: ${$error.text()}`)
        })
      }
      
      if ($body.find('[class*="error"]').length > 0) {
        cy.get('[class*="error"]').then(($error) => {
          cy.log(`Error element found: ${$error.text()}`)
        })
      }
      
      if ($body.find('#error').length > 0) {
        cy.get('#error').then(($error) => {
          cy.log(`Error div found: ${$error.text()}`)
        })
      }
    })
    
    // Check localStorage for auth token
    cy.window().then((win) => {
      const token = win.localStorage.getItem('token');
      const user = win.localStorage.getItem('user');
      cy.log(`Auth token in localStorage: ${token ? 'Present' : 'Missing'}`)
      cy.log(`User data in localStorage: ${user ? 'Present' : 'Missing'}`)
    })
    
    // Try to navigate to index.html manually to see if we're authenticated
    cy.log('Step 7: Manually navigating to index.html')
    cy.visit('/index.html')
    
    cy.wait(2000)
    
    cy.url().then((url) => {
      cy.log(`URL after visiting index.html: ${url}`)
    })
    
    // Check if we stay on index.html or get redirected back to login
    cy.url({ timeout: 5000 }).then((url) => {
      if (url.includes('index.html')) {
        cy.log('✅ Successfully authenticated - staying on index.html')
        cy.get('#welcomeScreen', { timeout: 10000 }).should('exist')
      } else {
        cy.log('❌ Authentication failed - redirected back to login')
      }
    })
  })
  
  it('should test different credentials', () => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/login.html')
    
    // Try testuser2 credentials
    cy.log('Testing testuser2@example.com credentials')
    cy.get('#email').clear().type('testuser2@example.com')
    cy.get('#password').clear().type('password123')
    cy.get('#login-button').click()
    
    cy.wait(3000)
    
    cy.url().then((url) => {
      cy.log(`URL with testuser2: ${url}`)
    })
    
    // Check localStorage
    cy.window().then((win) => {
      const token = win.localStorage.getItem('token');
      cy.log(`testuser2 token: ${token ? 'Present' : 'Missing'}`)
    })
  })
  
})
