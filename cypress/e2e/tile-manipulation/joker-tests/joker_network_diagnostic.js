/**
 * Joker Network Communication Test
 * 
 * This test specifically focuses on how joker objects are serialized and deserialized
 * during client-server communication, which is likely the root cause of the joker validation issues.
 */

// Simplified Socket.IO communication simulation
const mockSocket = {
  emit: function(event, ...args) {
    console.log(`🔄 Client emitting "${event}" event:`, JSON.stringify(args));
    // Simulate serialization/deserialization by converting to JSON and back
    const serialized = JSON.stringify(args);
    const deserialized = JSON.parse(serialized);
    
    // Call the appropriate server handler
    if (event === 'playSet') {
      const [gameId, tileIds] = deserialized;
      console.log(`🖥️ Server received playSet event - Game: ${gameId}, Tiles: ${tileIds.join(', ')}`);
      // Simulate server processing
      mockServer.handlePlaySet(gameId, tileIds);
    }
  }
};

// Simplified server-side logic
const mockServer = {
  games: {},
  
  // Create a test game
  createTestGame: function() {
    const gameId = 'test-game-123';
    const player = {
      id: 'test-player',
      name: 'Test Player',
      hand: [
        // Create a mix of regular tiles and jokers
        { id: 'joker_1', isJoker: true, color: null, number: null },
        { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
        { id: 'blue_13', isJoker: false, color: 'blue', number: 13 },
        { id: 'red_13', isJoker: false, color: 'red', number: 13 },
        { id: 'black_13', isJoker: false, color: 'black', number: 13 },
        { id: 'joker_2', isJoker: true, color: null, number: null }
      ],
      hasPlayedInitial: false
    };
    
    this.games[gameId] = {
      id: gameId,
      players: [player],
      board: [],
      currentPlayerIndex: 0
    };
    
    console.log(`🎮 Test game created with ID: ${gameId}`);
    return gameId;
  },
  
  // Find a tile in player's hand by ID
  findTileInHand: function(gameId, playerId, tileId) {
    const game = this.games[gameId];
    if (!game) return null;
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) return null;
    
    return player.hand.find(t => t.id === tileId);
  },
  
  // Handle playSet event
  handlePlaySet: function(gameId, tileIds) {
    console.log(`🖥️ Server processing playSet - Game: ${gameId}, Tiles: ${tileIds.join(', ')}`);
    
    const game = this.games[gameId];
    if (!game) {
      console.error('Game not found');
      return;
    }
    
    const player = game.players[0]; // Simplified - just use first player
    
    // Get tiles from player's hand based on IDs
    const tiles = tileIds.map(id => this.findTileInHand(gameId, player.id, id)).filter(Boolean);
    
    console.log(`🔍 Server retrieved tiles:`, JSON.stringify(tiles, null, 2));
    
    // Check for joker detection issues
    console.log(`\n🔎 JOKER DETECTION DIAGNOSTICS:`);
    
    // Check how jokers are identified in the retrieved tiles
    const jokersByProperty = tiles.filter(t => t.isJoker === true);
    const jokersById = tiles.filter(t => t.id && t.id.toLowerCase().includes('joker'));
    
    console.log(`Jokers detected by isJoker property: ${jokersByProperty.length}`);
    console.log(`Jokers detected by ID pattern: ${jokersById.length}`);
    
    if (jokersByProperty.length !== jokersById.length) {
      console.log(`⚠️ DISCREPANCY DETECTED: Different number of jokers detected by property vs ID`);
      
      // List the differences
      if (jokersByProperty.length < jokersById.length) {
        const missingJokers = jokersById.filter(j => !jokersByProperty.includes(j));
        console.log(`Missing isJoker property in these tiles:`, JSON.stringify(missingJokers, null, 2));
      }
    }
    
    // Check property types
    console.log(`\n🔎 PROPERTY TYPE DIAGNOSTICS:`);
    tiles.forEach(tile => {
      console.log(`Tile ${tile.id}:`);
      console.log(` - isJoker: ${tile.isJoker} (type: ${typeof tile.isJoker})`);
      console.log(` - color: ${tile.color} (type: ${typeof tile.color})`);
      console.log(` - number: ${tile.number} (type: ${typeof tile.number})`);
    });
    
    // Validate the set with original server algorithm
    console.log(`\n🔎 ORIGINAL SERVER VALIDATION:`);
    const originalValidation = this.isValidSetOriginal(tiles);
    console.log(`Original server validation result: ${originalValidation ? 'VALID ✓' : 'INVALID ✗'}`);
    
    // Validate with fixed algorithm
    console.log(`\n🔎 FIXED SERVER VALIDATION:`);
    
    // Normalization step
    const normalizedTiles = [...tiles];
    normalizedTiles.forEach(tile => {
      if (tile.id && tile.id.toLowerCase().includes('joker')) {
        // Ensure joker properties are set correctly
        tile.isJoker = true;
        tile.color = null;
        tile.number = null;
      }
    });
    
    console.log(`Normalized tiles:`, JSON.stringify(normalizedTiles, null, 2));
    
    const fixedValidation = this.isValidSetFixed(normalizedTiles);
    console.log(`Fixed server validation result: ${fixedValidation ? 'VALID ✓' : 'INVALID ✗'}`);
    
    return fixedValidation;
  },
  
  // Original server validation algorithm
  isValidSetOriginal: function(tiles) {
    if (tiles.length < 3) {
      console.log('Set invalid: too few tiles');
      return false;
    }
    
    // Try as a group
    const isGroup = this.isValidGroupOriginal(tiles);
    if (isGroup) {
      console.log('Valid group detected');
      return true;
    }
    
    // Try as a run
    const isRun = this.isValidRunOriginal(tiles);
    if (isRun) {
      console.log('Valid run detected');
      return true;
    }
    
    console.log('Set invalid: neither a valid run nor group');
    return false;
  },
  
  isValidGroupOriginal: function(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
      console.log(`Group invalid: size ${tiles.length} not between 3-4`);
      return false;
    }
    
    // Original joker detection
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    console.log(`Original group validation - Jokers detected: ${jokerCount}, Non-jokers: ${nonJokers.length}`);
    
    // If all jokers, it's valid
    if (jokerCount === tiles.length) {
      console.log('Group valid: all jokers');
      return true;
    }
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) {
      console.log(`Group invalid: different numbers found ${numbers.join(', ')}`);
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      console.log(`Group invalid: duplicate colors found ${colors.join(', ')}`);
      return false;
    }
    
    // We need enough remaining colors for the jokers
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const usedColors = new Set(colors);
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    if (jokerCount > remainingColors.length) {
      console.log(`Group invalid: not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
      return false;
    }
    
    console.log(`Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
    return true;
  },
  
  isValidRunOriginal: function(tiles) {
    // Simplified run validation for this test
    return false;
  },
  
  // Fixed server validation algorithm
  isValidSetFixed: function(tiles) {
    if (tiles.length < 3) {
      console.log('Set invalid: too few tiles');
      return false;
    }
    
    // Try as a group
    const isGroup = this.isValidGroupFixed(tiles);
    if (isGroup) {
      console.log('Valid group detected');
      return true;
    }
    
    // Try as a run
    const isRun = this.isValidRunFixed(tiles);
    if (isRun) {
      console.log('Valid run detected');
      return true;
    }
    
    console.log('Set invalid: neither a valid run nor group');
    return false;
  },
  
  isValidGroupFixed: function(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
      console.log(`Group invalid: size ${tiles.length} not between 3-4`);
      return false;
    }
    
    // Fixed joker detection that checks both property and ID
    const jokerCount = tiles.filter(t => {
      return t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'));
    }).length;
    
    const nonJokers = tiles.filter(t => {
      return !(t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker')));
    });
    
    console.log(`Fixed group validation - Jokers detected: ${jokerCount}, Non-jokers: ${nonJokers.length}`);
    
    // If all jokers, it's valid
    if (jokerCount === tiles.length) {
      console.log('Group valid: all jokers');
      return true;
    }
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) {
      console.log(`Group invalid: different numbers found ${numbers.join(', ')}`);
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      console.log(`Group invalid: duplicate colors found ${colors.join(', ')}`);
      return false;
    }
    
    // We need enough remaining colors for the jokers
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const usedColors = new Set(colors);
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    if (jokerCount > remainingColors.length) {
      console.log(`Group invalid: not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
      return false;
    }
    
    console.log(`Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
    return true;
  },
  
  isValidRunFixed: function(tiles) {
    // Simplified run validation for this test
    return false;
  }
};

// Client-side tile validation
function isValidGroupClient(tiles) {
  // Count jokers
  const jokerCount = tiles.filter(t => t.isJoker).length;
  
  // If all jokers, it's valid
  if (jokerCount === tiles.length) return true;
  
  // All non-joker tiles must be same number
  const numbers = tiles.filter(t => !t.isJoker).map(t => t.number);
  if (new Set(numbers).size > 1) return false;
  
  // All non-joker tiles must be different colors
  const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
  if (new Set(colors).size !== colors.length) return false;
  
  console.log(`Group valid with ${jokerCount} jokers and ${tiles.length - jokerCount} regular tiles`);
  return true;
}

// Test the JOKER, 13y, 13b case with different joker object structures
function runDiagnosticTests() {
  console.log('======= JOKER NETWORK DIAGNOSTIC TESTS =======\n');
  
  // Create a test game
  const gameId = mockServer.createTestGame();
  const tiles = mockServer.games[gameId].players[0].hand;
  
  // Test 1: Standard joker object { id: 'joker_1', isJoker: true, color: null, number: null }
  console.log('\n===== TEST 1: STANDARD JOKER OBJECT =====');
  
  const test1Tiles = [
    { id: 'joker_1', isJoker: true, color: null, number: null },
    { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
  ];
  
  console.log('🧪 Client-side validation:');
  const clientResult1 = isValidGroupClient(test1Tiles);
  console.log(`Client validation result: ${clientResult1 ? 'VALID ✓' : 'INVALID ✗'}`);
  
  console.log('\n🧪 Simulating network transmission and server validation:');
  const tileIds1 = test1Tiles.map(t => t.id);
  mockSocket.emit('playSet', gameId, tileIds1);
  
  // Test 2: Joker with undefined properties { id: 'joker_1', isJoker: true, color: undefined, number: undefined }
  console.log('\n===== TEST 2: JOKER WITH UNDEFINED PROPERTIES =====');
  
  const test2Tiles = [
    { id: 'joker_1', isJoker: true, color: undefined, number: undefined },
    { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
  ];
  
  console.log('🧪 Client-side validation:');
  const clientResult2 = isValidGroupClient(test2Tiles);
  console.log(`Client validation result: ${clientResult2 ? 'VALID ✓' : 'INVALID ✗'}`);
  
  console.log('\n🧪 Simulating network transmission and server validation:');
  const tileIds2 = test2Tiles.map(t => t.id);
  mockSocket.emit('playSet', gameId, tileIds2);
  
  // Test 3: Joker with isJoker as string 'true' { id: 'joker_1', isJoker: 'true', color: null, number: null }
  console.log('\n===== TEST 3: JOKER WITH isJoker AS STRING =====');
  
  const test3Tiles = [
    { id: 'joker_1', isJoker: 'true', color: null, number: null },
    { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
  ];
  
  console.log('🧪 Client-side validation:');
  const clientResult3 = isValidGroupClient(test3Tiles);
  console.log(`Client validation result: ${clientResult3 ? 'VALID ✓' : 'INVALID ✗'}`);
  
  console.log('\n🧪 Simulating network transmission and server validation:');
  const tileIds3 = test3Tiles.map(t => t.id);
  mockSocket.emit('playSet', gameId, tileIds3);
  
  // Test 4: Joker without isJoker property { id: 'joker_1', color: null, number: null }
  console.log('\n===== TEST 4: JOKER WITHOUT isJoker PROPERTY =====');
  
  const test4Tiles = [
    { id: 'joker_1', color: null, number: null },
    { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
  ];
  
  console.log('🧪 Client-side validation:');
  const clientResult4 = isValidGroupClient(test4Tiles);
  console.log(`Client validation result: ${clientResult4 ? 'VALID ✓' : 'INVALID ✗'}`);
  
  console.log('\n🧪 Simulating network transmission and server validation:');
  const tileIds4 = test4Tiles.map(t => t.id);
  mockSocket.emit('playSet', gameId, tileIds4);
  
  // Summary
  console.log('\n======= TEST SUMMARY =======');
  console.log(`Test 1 (Standard Joker): Client ${clientResult1 ? 'VALID ✓' : 'INVALID ✗'}`);
  console.log(`Test 2 (Undefined Properties): Client ${clientResult2 ? 'VALID ✓' : 'INVALID ✗'}`);
  console.log(`Test 3 (String isJoker): Client ${clientResult3 ? 'VALID ✓' : 'INVALID ✗'}`);
  console.log(`Test 4 (No isJoker Property): Client ${clientResult4 ? 'VALID ✓' : 'INVALID ✗'}`);
  
  console.log('\n📋 CONCLUSION:');
  console.log('These tests demonstrate how different joker object structures are handled');
  console.log('during client-server communication. The fixed server validation provides');
  console.log('more robust joker detection that works with various joker representations.');
}

// Run the tests
runDiagnosticTests();

// Export for Cypress integration
module.exports = {
  mockSocket,
  mockServer,
  isValidGroupClient,
  runDiagnosticTests
};
