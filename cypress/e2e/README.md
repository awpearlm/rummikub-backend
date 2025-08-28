# E2E Test Organization

This directory contains all end-to-end tests for the J_kube Rummikub game, organized by functional categories.

## Test Categories

### 📁 **authentication/**
- `signup-page.cy.js` - User registration and login functionality

### 📁 **game-creation/**
- `game-creation.cy.js` - Game creation, joining, and setup tests

### 📁 **game-mechanics/**
- `game-mechanics.cy.js` - Core game rules and mechanics
- `game-logic-integration.cy.js` - Game logic integration tests
- `game-progression.cy.js` - Turn progression and game flow
- `draw-button-behavior.cy.js` - Draw tile button functionality

### 📁 **tile-manipulation/**
- `tile-manipulation.cy.js` - Drag and drop tile movement
- `player-hand-layout.cy.js` - Hand organization and display
- `joker-tests/` - Comprehensive joker functionality tests
  - Multiple joker-specific test files covering value calculation, validation, and integration

### 📁 **reconnection/**
- `reconnection.cy.js` - Basic reconnection functionality
- `reconnection-edge-cases.cy.js` - Edge cases and error scenarios
- `multiplayer-reconnection.cy.js` - Multiplayer reconnection scenarios

### 📁 **invitations/**
- `invitation-api.cy.js` - Invitation API functionality
- `invitation-production.cy.js` - Production invitation features
- `invitation-system.cy.js` - Complete invitation workflow
- `INVITATION-TESTS-README.md` - Invitation test documentation

### 📁 **ui-interface/**
- `ui-features.cy.js` - User interface elements and interactions

### 📁 **admin/**
- `admin-invitation-management.cy.js` - Administrative invitation management

### 📄 **Root Level**
- `basic-test.cy.js` - Basic connectivity and fundamental functionality test

## Running Tests

### Run all tests:
```bash
npm run cypress:run
```

### Run tests by category:
```bash
# Authentication tests
npx cypress run --spec "cypress/e2e/authentication/**/*.cy.js"

# Game mechanics tests
npx cypress run --spec "cypress/e2e/game-mechanics/**/*.cy.js"

# Tile manipulation tests
npx cypress run --spec "cypress/e2e/tile-manipulation/**/*.cy.js"

# Reconnection tests
npx cypress run --spec "cypress/e2e/reconnection/**/*.cy.js"
```

### Run specific test files:
```bash
npx cypress run --spec "cypress/e2e/game-mechanics/game-logic-integration.cy.js"
```

## Test Priorities

1. **Critical Path**: `basic-test.cy.js` → `authentication/` → `game-creation/` → `game-mechanics/`
2. **Core Functionality**: `tile-manipulation/` → `reconnection/`
3. **Administrative**: `invitations/` → `admin/`
4. **UI Polish**: `ui-interface/`

## Notes

- The joker tests subfolder contains extensive testing for joker functionality, which is a complex part of Rummikub rules
- Invitation tests include both API-level and production workflow testing
- Reconnection tests cover various network scenarios and edge cases
- All tests are designed to work with the authentication-enabled server
