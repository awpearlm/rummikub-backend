/**
 * Joker Tests README
 * 
 * This file provides an overview of the joker validation tests and tools,
 * along with instructions for investigating and fixing the joker validation issues.
 */

# Joker Validation Tests

## Overview

These tests help diagnose and fix issues with joker validation in the Rummikub game, 
specifically the case where a joker group like `[JOKER, 13y, 13b]` is rejected by the server
despite being valid according to the game rules.

## Test Files

1. **joker_integration_tests.js**  
   Comprehensive test suite for validating different joker combinations in groups and runs.

2. **joker_e2e_test.js**  
   End-to-end test that simulates the full flow from client to server with joker validation.

3. **joker_network_diagnostic.js**  
   Simulates network communication to diagnose serialization/deserialization issues with joker objects.

4. **joker_browser_network_test.js**  
   Client-side test for real Socket.IO communication with the server.

5. **joker_test_client.html**  
   A minimal test client for testing joker validation with real network requests.

6. **joker_server_debugger.js**  
   Enhanced logging tool for server-side joker operations.

7. **joker_group_fix.js**  
   Documentation of the fixes applied to the server code.

## The Issue

The core issue appears to be a serialization/deserialization problem:

1. When joker objects are sent from the client to the server via Socket.IO, the `isJoker` property 
   can sometimes be lost or transformed.

2. The server's validation logic relies solely on the `isJoker` property, causing valid joker groups 
   to be rejected.

## Running the Tests

### Integration Tests

```bash
node cypress/e2e/joker-tests/joker_integration_tests.js
```

### End-to-End Test

```bash
node cypress/e2e/joker-tests/joker_e2e_test.js
```

### Network Diagnostic

```bash
node cypress/e2e/joker-tests/joker_network_diagnostic.js
```

### Browser Network Test

1. Host the files on a local server
2. Open joker_test_client.html in a browser
3. Follow the on-screen instructions

## Server Fix Implementation

The recommended fix involves two key changes to the server code:

### 1. Enhanced Joker Detection

In the `isValidGroup` function, replace:

```javascript
const jokerCount = tiles.filter(t => t.isJoker).length;
```

With:

```javascript
const jokerCount = tiles.filter(t => {
  return t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'));
}).length;
```

And similarly for the `nonJokers` variable.

### 2. Joker Property Normalization

In both `playSet` and `playMultipleSets` functions, add this code after retrieving the tiles:

```javascript
// Normalize joker properties to ensure consistency
tiles.forEach(tile => {
  if (tile.id && tile.id.toLowerCase().includes('joker')) {
    tile.isJoker = true;
    tile.color = null;
    tile.number = null;
  }
});
```

## Why This Works

The fix makes joker detection more robust by:

1. Looking for jokers based on either the `isJoker` property OR the tile ID
2. Normalizing joker properties to ensure consistent validation

This redundancy ensures that even if the `isJoker` property is lost during serialization/deserialization,
the jokers will still be correctly identified by their IDs.

## Debugging the Issue Further

If the issue persists, use the `joker_server_debugger.js` to add enhanced logging to the server:

```javascript
const jokerDebugger = require('./cypress/e2e/joker-tests/joker_server_debugger');

// Patch the isValidGroup function
const originalIsValidGroup = isValidGroup;
isValidGroup = jokerDebugger.patchIsValidGroup(originalIsValidGroup);

// Patch the playSet function
const originalPlaySet = playSet;
playSet = jokerDebugger.patchPlaySet(originalPlaySet);
```

Then check the server logs for detailed diagnostics on joker validation.

## Console Logs Analysis

The console logs you provided show that:

1. The client successfully validates the joker group (`Group valid with 1 jokers and 2 regular tiles`)
2. The client calculates the correct set value (`Initial play set value: 39 points`)
3. The client logs the group as valid (`Valid group detected: JOKER, 13y, 13b`)
4. But the server responds with an error (`[ERROR] Invalid set`)

This confirms that the issue is with the server-side validation, not the client-side. The fixes
described above should resolve this by making the server's joker detection more robust.
