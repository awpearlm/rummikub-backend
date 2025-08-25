const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    // We'll use environment variables to control where tests run
    // By default we use local, but can override for CI/CD testing
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 15000, // Increased for more reliability with remote servers
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    experimentalStudio: true,
    // Configure these for testing against your deployed environments
    env: {
      // For testing with locally running server
      local: {
        frontendUrl: 'http://localhost:3000',
        backendUrl: 'http://localhost:3000',
      },
      // For testing against deployed environments
      production: {
        frontendUrl: 'https://jkube.netlify.app', // Correct Netlify URL
        backendUrl: 'https://rummikub-backend.onrender.com', // Your Render backend URL
      },
    },
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })
      
      // Allow overriding the environment via command line
      const environment = process.env.CYPRESS_ENVIRONMENT || 'local'
      console.log(`Setting up Cypress with environment: ${environment}`)
      
      // Create a copy of the environment settings to avoid modifying the original config
      config.env.environment = environment
      config.env.currentFrontendUrl = config.env[environment]?.frontendUrl || config.baseUrl
      config.env.currentBackendUrl = config.env[environment]?.backendUrl || config.baseUrl
      
      // Use the frontend URL as the baseUrl
      config.baseUrl = config.env.currentFrontendUrl
      
      console.log(`Frontend URL: ${config.env.currentFrontendUrl}`)
      console.log(`Backend URL: ${config.env.currentBackendUrl}`)
      
      return config
    },
  },
})
