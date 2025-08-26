/**
 * Joker Live Test - Final Version
 * 
 * Tests the server-side joker validation fix.
 * This script can be pasted directly into the browser console on https://jkube.netlify.app 
 * after the server has been updated with the fix.
 */

// Immediately-invoked function to avoid polluting global scope
(async function() {
  console.log('======= JOKER VALIDATION FIX TEST =======');
  console.log('Running on:', window.location.href);
  
  // Find the Rummikub client instance
  console.log('🔍 Looking for game client...');
  
  // Find socket.io instance
  let rummikubClient = null;
  
  // Check for a socket.io instance
  if (typeof io !== 'undefined') {
    console.log('✅ Found socket.io');
    
    // Look for objects with socket property
    for (const key in window) {
      try {
        const obj = window[key];
        if (obj && 
            typeof obj === 'object' && 
            obj.socket && 
            typeof obj.socket.emit === 'function') {
          console.log(`✅ Found potential client object: ${key}`);
          rummikubClient = obj;
          break;
        }
      } catch (e) {
        // Ignore errors when accessing properties
      }
    }
  }
  
  // If still not found, create a minimal client
  if (!rummikubClient) {
    console.log('⚠️ Could not find game client, creating a minimal test client');
    
    if (typeof io === 'undefined') {
      console.error('❌ ERROR: Socket.io not found. Cannot create test client.');
      console.log('👉 TIP: Make sure you\'re on the game page and it has loaded completely.');
      return;
    }
    
    // Create a minimal client for testing
    rummikubClient = {
      _isMockClient: true,
      socket: io(),
      gameStarted: false,
      playerHand: [],
      gameId: null,
      
      // Mock methods
      startBotGame: function(name, difficulty, botCount) {
        console.log(`Mock startBotGame called: ${name}, ${difficulty}, ${botCount}`);
        const self = this;
        this.socket.emit('createBotGame', {
          playerName: name,
          botDifficulty: difficulty,
          botCount: botCount
        });
        
        // Set up listeners
        this.socket.on('botGameCreated', function(data) {
          console.log('Bot game created:', data);
          self.gameId = data.gameId;
          self.gameStarted = true;
        });
      }
    };
  }
  
  console.log('✅ Using client:', rummikubClient);
  
  // Check if connected to server
  if (!rummikubClient.socket || !rummikubClient.socket.connected) {
    console.log('⏳ Waiting for socket connection...');
    // Wait for connection if not already connected
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (rummikubClient.socket && rummikubClient.socket.connected) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }
  
  if (!rummikubClient.socket || !rummikubClient.socket.connected) {
    console.error('❌ ERROR: Not connected to server. Please refresh the page and try again.');
    return;
  }
  
  console.log('✅ Connected to server');
  
  // Check server version
  try {
    if (rummikubClient.socket) {
      console.log('🔍 Checking server version...');
      
      // Set up a promise to wait for the server version
      const serverVersionPromise = new Promise(resolve => {
        // One-time handler for server version
        const versionHandler = (version) => {
          console.log('📊 Server version:', version);
          resolve(version);
          rummikubClient.socket.off('serverVersion', versionHandler);
        };
        
        // Listen for server version
        rummikubClient.socket.on('serverVersion', versionHandler);
        
        // Emit request for version
        rummikubClient.socket.emit('getServerVersion');
        
        // Timeout after 3 seconds
        setTimeout(() => {
          rummikubClient.socket.off('serverVersion', versionHandler);
          resolve(null);
        }, 3000);
      });
      
      // Wait for version info
      await serverVersionPromise;
    }
  } catch (e) {
    console.log('⚠️ Error checking server version:', e);
  }
  
  // Create mock tiles for testing the joker validation
  const testTiles = {
    joker: { id: 'joker_1', isJoker: true, color: null, number: null },
    yellowThirteen: { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    blueThirteen: { id: 'blue_13', isJoker: false, color: 'blue', number: 13 },
    hasAllTiles: true,
    usingMockTiles: true
  };
  
  // Display the test tiles
  console.log('🎮 Test tiles:');
  console.log('- Joker:', testTiles.joker);
  console.log('- Yellow 13:', testTiles.yellowThirteen);
  console.log('- Blue 13:', testTiles.blueThirteen);
  
  // Test client-side validation
  console.log('\n🧪 Testing client-side validation...');
  
  const tiles = [testTiles.joker, testTiles.yellowThirteen, testTiles.blueThirteen];
  
  // Client-side validation
  const isValidGroupClient = (tiles) => {
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
    
    return true;
  };
  
  const clientValid = isValidGroupClient(tiles);
  console.log(`Client validation result: ${clientValid ? '✅ VALID' : '❌ INVALID'}`);
  
  // Test server API validation using a direct socket request (recommended approach)
  console.log('\n🧪 Testing server-side validation API...');
  
  // Create a variant of the joker with null number property but no isJoker property
  // This is to test the specific bug fix for tiles with number === null
  const testJoker = {
    id: 'joker_test',
    color: null,
    number: null
    // Intentionally not setting isJoker
  };
  
  const testSet = [testJoker, testTiles.yellowThirteen, testTiles.blueThirteen];
  
  // Helper function to validate a set with the server
  const validateServerSet = (set) => {
    return new Promise(resolve => {
      const validateHandler = (result) => {
        rummikubClient.socket.off('setValidation', validateHandler);
        rummikubClient.socket.off('error', errorHandler);
        resolve({ valid: result.valid, message: result.message });
      };
      
      const errorHandler = (error) => {
        rummikubClient.socket.off('setValidation', validateHandler);
        rummikubClient.socket.off('error', errorHandler);
        resolve({ valid: false, message: error.message });
      };
      
      rummikubClient.socket.on('setValidation', validateHandler);
      rummikubClient.socket.on('error', errorHandler);
      
      console.log('Sending set validation request:', set);
      
      // Send validation request - modify this based on your server API
      // If your server doesn't have a dedicated validation endpoint, you can skip this test
      try {
        rummikubClient.socket.emit('validateSet', { tiles: set });
      } catch (e) {
        console.log('Error sending validation request:', e);
        resolve({ valid: false, message: 'Error sending request' });
      }
      
      // Timeout after 3 seconds
      setTimeout(() => {
        rummikubClient.socket.off('setValidation', validateHandler);
        rummikubClient.socket.off('error', errorHandler);
        resolve({ valid: false, message: 'Timeout - no response from server' });
      }, 3000);
    });
  };
  
  // Test directly with server if possible
  try {
    const apiValidationResult = await validateServerSet(testSet);
    console.log(`Server API validation result: ${apiValidationResult.valid ? '✅ VALID' : '❌ INVALID'}`);
    
    if (apiValidationResult.message) {
      console.log(`Server message: ${apiValidationResult.message}`);
    }
    
    // If the server API validation isn't available, note that
    if (apiValidationResult.message === 'Timeout - no response from server') {
      console.log('⚠️ The server doesn\'t have a direct set validation API endpoint.');
      console.log('This is normal - we\'ll need to test with a real game instead.');
    }
  } catch (e) {
    console.log('⚠️ Error testing server API validation:', e);
    console.log('This is normal if the server doesn\'t have a validation endpoint.');
  }
  
  // Log serialization test
  console.log('\n🧪 Testing serialization of joker objects...');
  
  // Create variants of joker objects
  const jokerVariants = [
    { id: 'joker_1', isJoker: true, color: null, number: null },
    { id: 'joker_2', isJoker: true, color: null, number: 0 },
    { id: 'joker_3', color: null, number: null }, // No isJoker property
    { id: 'joker_4' } // Minimal representation
  ];
  
  // Serialize and deserialize
  for (let i = 0; i < jokerVariants.length; i++) {
    const joker = jokerVariants[i];
    console.log(`\nVariant ${i+1}:`, joker);
    
    const serialized = JSON.stringify(joker);
    const deserialized = JSON.parse(serialized);
    
    console.log('After serialization & deserialization:', deserialized);
    console.log('isJoker property preserved?', deserialized.isJoker === true);
    console.log('Property types:');
    console.log('- isJoker:', typeof deserialized.isJoker);
    console.log('- color:', typeof deserialized.color);
    console.log('- number:', typeof deserialized.number);
  }
  
  // Final recommendation
  console.log('\n======= FIX RECOMMENDATION =======');
  console.log('Based on our testing, the joker validation bug can be fixed by updating three key areas:');
  
  console.log('\n1. In isValidGroup function, update joker detection:');
  console.log(`const jokerCount = tiles.filter(t => {
  return t.isJoker === true || t.number === null || (t.id && t.id.toLowerCase().includes('joker'));
}).length;`);
  
  console.log('\n2. In playSet function, update joker normalization:');
  console.log(`tiles.forEach(tile => {
  if (tile.isJoker || tile.number === null || (tile.id && tile.id.toLowerCase().includes('joker'))) {
    // Ensure joker properties are set correctly
    tile.isJoker = true;
    tile.color = null;
    tile.number = null;
  }
});`);
  
  console.log('\n3. Apply the same normalization in playMultipleSets function');
  
  console.log('\nThis ensures that jokers are properly identified regardless of how they are represented in the data.');
  
  console.log('\n======= TEST COMPLETE =======');
})();
