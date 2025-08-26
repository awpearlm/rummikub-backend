# End-to-End Tests for Rummikub Game

This directory contains Cypress end-to-end tests for the Rummikub game. These tests verify various aspects of the game's functionality, including UI layout, game mechanics, and specific features.

## Test Files

### Player Hand Layout Tests
`player-hand-layout.cy.js` - Tests the layout of the player's hand, ensuring it correctly displays 10 tiles per row.

- Verifies the player hand uses CSS grid with 10 columns
- Checks that tiles properly wrap to the next row after 10 tiles
- Ensures proper spacing and appearance of tiles

### Draw Button Behavior Tests
`draw-button-behavior.cy.js` - Tests the behavior of the Draw button under various game conditions.

- Verifies the Draw button is enabled at the start of a turn
- Checks that the Draw button is disabled when a tile is selected
- Ensures the Draw button is disabled after playing tiles to the board
- Verifies the Draw button is enabled after using Undo
- Tests that the Draw button is enabled when the board is restored to its original state
- Confirms the Draw button stays disabled if the board is changed but not fully restored

### Game Logic Integration Tests
`game-logic-integration.cy.js` - Comprehensive tests that verify multiple aspects of the game together.

- Tests the player hand layout with 10 tiles per row
- Verifies all Draw button behaviors in sequence
- Tests full game turn progression with drawing, playing, and ending turns

## Custom Commands

The following custom commands are available for testing:

- `getFrontendUrl()` - Gets the configured frontend URL for testing
- `drawButtonShouldBeEnabled()` - Asserts that the Draw button is enabled
- `drawButtonShouldBeDisabled()` - Asserts that the Draw button is disabled
- `storeInitialBoardState()` - Stores the current board state for later comparison
- `boardShouldMatchInitialState()` - Checks if the board matches the previously stored state

## Running the Tests

To run the tests:

```bash
# Run all tests
npm run cypress:run

# Run specific test file
npm run cypress:run -- --spec "cypress/e2e/draw-button-behavior.cy.js"

# Open Cypress Test Runner
npm run cypress:open
```

## Test Environment

The tests can run against different environments:

- Local development: `npm run cypress:run:local`
- Production: `npm run cypress:run:production`

The environment configurations are defined in `cypress.config.js`.

## Recent Improvements (August 2023)

### Bug Fixes
- Fixed issues with assertion chaining in tests (`or()` not being a function)
- Updated End Turn button tests to account for game logic where the button is only enabled after board changes
- Simplified test cases to improve reliability and focus on core functionality

### Test Enhancements
- Added more robust board state comparison logic using aliasing
- Improved error handling and conditional test execution
- Added better logging for test debugging and clarity
- Ensured all tests adapt to the actual game implementation rather than assuming behavior

### Code Quality
- Removed duplicate code blocks and fixed syntax errors
- Used proper DOM state assertions instead of custom commands where appropriate
- Improved wait times and timeouts for more stable tests
- Added more comments to explain test intent and expected behavior
