# J_kube Game Reconnection Testing

This document outlines the testing strategy for the J_kube game's reconnection functionality.

## Test Overview

The tests verify that the game properly handles disconnections and reconnections, ensuring that:

1. Game state is preserved during reconnection
2. Players can rejoin their games after a disconnection
3. The UI provides clear information about reconnection options
4. Edge cases like expired sessions are handled gracefully

## Setup

To run the tests, you'll need to have Node.js installed. Then install the dependencies:

```bash
npm install
```

## Running Tests

Start the game server in one terminal:

```bash
npm start
```

Then run the tests in another terminal:

### Run all tests

```bash
npm test
```

### Run specific test suites

```bash
# Basic reconnection tests
npm run test:reconnection

# Multiplayer reconnection tests
npm run test:multiplayer

# Edge case tests
npm run test:edge
```

### Open Cypress Test Runner

```bash
npm run test:open
```

## Test Scenarios

### Basic Reconnection Tests

- Verify game info is saved to localStorage when creating a game
- Verify connection lost overlay appears when connection is lost
- Verify correct reconnection information is displayed when game data exists
- Verify successful reconnection when clicking the reconnect button
- Verify game data is cleared from localStorage when leaving a game

### Multiplayer Reconnection Tests

- Verify game state is maintained across reconnection with multiple players in the game
- Verify host can reconnect while other players remain in the game

### Edge Case Tests

- Verify expired game information is handled gracefully
- Verify non-existent game IDs are handled gracefully
- Verify reconnection behavior after a game has ended

## Manual Testing Checklist

For manual testing, use the following steps:

1. **Create a game and note the game ID**
   - Enter your name and create a new game
   - Verify game ID is displayed and localStorage contains game info

2. **Simulate connection loss**
   - Open browser developer tools (F12)
   - In the Console tab, run: `window.game.socket.disconnect()`
   - Verify connection lost overlay appears

3. **Test reconnection**
   - Click the "Reconnect to Game" button
   - Verify game reconnects and state is preserved
   - Verify you can continue playing

4. **Test page refresh**
   - While in an active game, refresh the browser page
   - Verify the welcome screen shows your name pre-filled
   - Verify a notification about your saved game appears

5. **Test connection loss followed by refresh**
   - Disconnect the socket as in step 2
   - Refresh the page completely
   - Verify your name is pre-filled and you're notified about your saved game

6. **Test game completion**
   - Complete a game (or use developer console to trigger victory)
   - Verify localStorage game info is cleared
   - Verify after refreshing there is no saved game info

## Common Issues

- If tests fail due to timeouts, try increasing the timeout values in the Cypress config
- If the reconnection doesn't work, check the browser console for error messages
- Socket.IO version differences can affect reconnection behavior
