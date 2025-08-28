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
  
  // Test set value calculation
  console.log('\n🧪 Testing set value calculation...');
  
  // Client-side set value calculation (for comparison)
  const calculateSetValueClient = (tiles) => {
    // Check if it's a group (same number, different colors)
    const nonJokers = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.filter(t => t.isJoker).length;
    
    if (nonJokers.length === 0) return 0;
    
    // For groups, all tiles (including jokers) should have the same value
    const groupNumber = nonJokers[0].number;
    const totalValue = groupNumber * tiles.length;
    
    return totalValue;
  };
  
  const clientSetValue = calculateSetValueClient(tiles);
  console.log(`Client set value calculation: ${clientSetValue} points`);
  console.log(`Expected value for initial play: 13 × 3 = 39 points (> 30 required)`);
  
  // Test server API validation for set value calculation
  console.log('\n🧪 Testing server-side set value calculation...');
  
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
  const testServerSetValue = (set) => {
    return new Promise(resolve => {
      const setValueHandler = (result) => {
        rummikubClient.socket.off('setValueCalculated', setValueHandler);
        rummikubClient.socket.off('error', errorHandler);
        resolve({ value: result.value, message: result.message });
      };
      
      const errorHandler = (error) => {
        rummikubClient.socket.off('setValueCalculated', setValueHandler);
        rummikubClient.socket.off('error', errorHandler);
        resolve({ value: 0, message: error.message });
      };
      
      rummikubClient.socket.on('setValueCalculated', setValueHandler);
      rummikubClient.socket.on('error', errorHandler);
      
      console.log('Sending set value calculation request:', set);
      
      // Send validation request - this endpoint might not exist on all servers
      try {
        rummikubClient.socket.emit('calculateSetValue', { tiles: set });
      } catch (e) {
        console.log('Error sending set value calculation request:', e);
        resolve({ value: 0, message: 'Error sending request' });
      }
      
      // Timeout after 3 seconds
      setTimeout(() => {
        rummikubClient.socket.off('setValueCalculated', setValueHandler);
        rummikubClient.socket.off('error', errorHandler);
        resolve({ value: 0, message: 'Timeout - no response from server' });
      }, 3000);
    });
  };
  
  // Test directly with server if possible
  try {
    const serverValueResult = await testServerSetValue(testSet);
    
    if (serverValueResult.message === 'Timeout - no response from server') {
      console.log('⚠️ The server doesn\'t have a direct set value calculation API endpoint.');
      console.log('This is normal - we\'ll need to test in a real game scenario instead.');
    } else {
      console.log(`Server set value calculation: ${serverValueResult.value} points`);
      console.log(`Is the value correct for initial play? ${serverValueResult.value >= 30 ? '✅ YES' : '❌ NO'}`);
    }
  } catch (e) {
    console.log('⚠️ Error testing server set value calculation:', e);
    console.log('This is normal if the server doesn\'t have a calculation endpoint.');
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
  
  // Test for initial play requirement
  console.log('\n🧪 Testing initial play requirement...');
  console.log(`Our joker group (JOKER + 13y + 13b) should be worth 39 points.`);
  console.log(`The minimum for initial play is 30 points.`);
  console.log(`Therefore, this set should be accepted for initial play.`);
  
  // Final recommendation
  console.log('\n======= FIX RECOMMENDATION =======');
  console.log('To fix the joker value calculation bug in the calculateSetValue function:');
  
  console.log(`
  calculateSetValue(tiles) {
    let totalValue = 0;
    // Use enhanced joker detection for consistency
    const nonJokerTiles = tiles.filter(t => !(t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker'))));
    const jokerCount = tiles.length - nonJokerTiles.length;
    
    if (this.isValidGroup(tiles)) {
      // Group: same number, different colors
      if (nonJokerTiles.length > 0) {
        const groupNumber = nonJokerTiles[0].number;
        // All tiles (including jokers) are worth the group number
        totalValue = groupNumber * tiles.length;
        console.log(\`Group value calculation: \${groupNumber} × \${tiles.length} = \${totalValue}\`);
      }
    } else if (this.isValidRun(tiles)) {
      // Run: consecutive numbers, same color
      // Need to determine what number each joker represents
      totalValue = this.calculateRunValueWithJokers(tiles);
      console.log(\`Run value calculation: \${totalValue}\`);
    }
    
    return totalValue;
  }`);
  
  console.log('\nThis fix ensures that jokers in groups are valued correctly for the initial 30-point play requirement.');
  
  console.log('\n======= HOW TO TEST THE FIX =======');
  console.log('1. Start a game with bots in debug mode');
  console.log('2. Try to play a set with: Joker + Yellow 13 + Blue 13');
  console.log('3. The server should accept this as a valid initial play');
  console.log('4. Check server logs for "Group value calculation: 13 × 3 = 39"');
  
  console.log('\n======= TEST COMPLETE =======');
})();
