/// <reference types="cypress" />

describe('Basic Test', () => {
  it('should visit the frontend URL', () => {
    // Use the environment variable directly
    const frontendUrl = Cypress.env('currentFrontendUrl') || Cypress.config('baseUrl');
    cy.visit(frontendUrl, { failOnStatusCode: false });
    
    // Basic assertion to check the page loaded
    cy.get('body').should('be.visible');
  });
});
