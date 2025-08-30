/**
 * Joker Value Calculation Test
 * 
 * Tests the server-side joker value calculation for initial play requirements.
 * This script specifically focuses on verifying that sets with jokers
 * are correctly valued for the 30-point initial play requirement.
 */

// Immediately-invoked function to avoid polluting global scope
(async function() {
  console.log('======= JOKER VALUE CALCULATION TEST =======');
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
  
  // Test sets for value calculation
  const testSets = [
    // Group with joker: should be 39 points (13×3)
    {
      name: "Group: Joker + Yellow 13 + Blue 13",
      tiles: [
        { id: 'joker_1', isJoker: true, color: null, number: null },
        { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
        { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
      ],
      expectedValue: 39,
      isGroup: true
    },
    
    // Run with joker: should be 24 points (7+8+9)
    {
      name: "Run: Red 7 + Red 8 + Joker (as Red 9)",
      tiles: [
        { id: 'red_7', isJoker: false, color: 'red', number: 7 },
        { id: 'red_8', isJoker: false, color: 'red', number: 8 },
        { id: 'joker_1', isJoker: true, color: null, number: null }
      ],
      expectedValue: 24,
      isGroup: false
    },
    
    // Group of all the same number: should be 24 points (8×3)
    {
      name: "Group: Red 8 + Blue 8 + Yellow 8",
      tiles: [
        { id: 'red_8', isJoker: false, color: 'red', number: 8 },
        { id: 'blue_8', isJoker: false, color: 'blue', number: 8 },
        { id: 'yellow_8', isJoker: false, color: 'yellow', number: 8 }
      ],
      expectedValue: 24,
      isGroup: true
    },
    
    // Run with multiple jokers: should be 26 points (6+7+6+7)
    {
      name: "Run: Blue 6 + Joker (as Blue 7) + Blue 8 + Joker (as Blue 9)",
      tiles: [
        { id: 'blue_6', isJoker: false, color: 'blue', number: 6 },
        { id: 'joker_1', isJoker: true, color: null, number: null },
        { id: 'blue_8', isJoker: false, color: 'blue', number: 8 },
        { id: 'joker_2', isJoker: true, color: null, number: null }
      ],
      expectedValue: 30,
      isGroup: false
    }
  ];
  
  // Client-side group validation function
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
  
  // Client-side run validation function
  const isValidRunClient = (tiles) => {
    // Need at least one non-joker to determine color
    const nonJokers = tiles.filter(t => !t.isJoker);
    if (nonJokers.length === 0) return false;
    
    // All non-joker tiles must be same color
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size > 1) return false;
    
    // Sort by number
    const sortedTiles = [...nonJokers].sort((a, b) => a.number - b.number);
    
    // Check if they form a consecutive sequence
    for (let i = 1; i < sortedTiles.length; i++) {
      const gap = sortedTiles[i].number - sortedTiles[i-1].number - 1;
      if (gap < 0) return false; // Numbers are not in ascending order
    }
    
    // Count total gaps in the sequence
    let totalGaps = 0;
    for (let i = 1; i < sortedTiles.length; i++) {
      totalGaps += sortedTiles[i].number - sortedTiles[i-1].number - 1;
    }
    
    // Need enough jokers to fill the gaps
    const jokerCount = tiles.filter(t => t.isJoker).length;
    return jokerCount >= totalGaps;
  };
  
  // Client-side value calculation function
  const calculateValueClient = (tiles, isGroup) => {
    const nonJokers = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.filter(t => t.isJoker).length;
    
    if (nonJokers.length === 0) return 0;
    
    if (isGroup) {
      // Group: all tiles have the same value
      const groupNumber = nonJokers[0].number;
      return groupNumber * tiles.length;
    } else {
      // Run: sum of the tile values including jokers
      const sortedTiles = [...nonJokers].sort((a, b) => a.number - b.number);
      
      // Determine the sequence with jokers
      let sequence = [];
      for (let i = 0; i < sortedTiles.length; i++) {
        sequence.push(sortedTiles[i].number);
        
        // Add jokers between tiles if needed
        if (i < sortedTiles.length - 1) {
          const gap = sortedTiles[i+1].number - sortedTiles[i].number - 1;
          for (let j = 1; j <= gap; j++) {
            sequence.push(sortedTiles[i].number + j);
          }
        }
      }
      
      // If we have leftover jokers, add them at the end
      const usedJokers = sequence.length - nonJokers.length;
      const remainingJokers = jokerCount - usedJokers;
      
      for (let i = 1; i <= remainingJokers; i++) {
        if (sequence.length > 0) {
          // Add to the end of the sequence
          sequence.push(sequence[sequence.length - 1] + 1);
        }
      }
      
      // Sum the sequence values
      return sequence.reduce((sum, num) => sum + num, 0);
    }
  };
  
  // Run client-side value calculation tests
  console.log('\n🧪 Testing client-side value calculation...');
  
  for (const testSet of testSets) {
    console.log(`\nTesting: ${testSet.name}`);
    
    // Check validation
    const isValid = testSet.isGroup 
      ? isValidGroupClient(testSet.tiles) 
      : isValidRunClient(testSet.tiles);
    
    console.log(`Validation result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    if (isValid) {
      const clientValue = calculateValueClient(testSet.tiles, testSet.isGroup);
      console.log(`Client-side value: ${clientValue} points`);
      console.log(`Expected value: ${testSet.expectedValue} points`);
      console.log(`Is value correct? ${clientValue === testSet.expectedValue ? '✅ YES' : '❌ NO'}`);
      console.log(`Meets 30-point requirement? ${clientValue >= 30 ? '✅ YES' : '❌ NO'}`);
    }
  }
  
  // Test server-side value calculation (if available)
  console.log('\n🧪 Testing server-side value calculation...');
  
  // Helper function to test server-side value calculation
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
      
      // Send value calculation request
      try {
        rummikubClient.socket.emit('calculateSetValue', { tiles: set });
      } catch (e) {
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
  
  // Try to test server-side value calculation for each set
  try {
    const criticalTestSet = testSets[0]; // Group with joker: should be 39 points
    console.log(`\nTesting critical set: ${criticalTestSet.name}`);
    
    const serverValueResult = await testServerSetValue(criticalTestSet.tiles);
    
    if (serverValueResult.message === 'Timeout - no response from server') {
      console.log('⚠️ The server doesn\'t have a direct set value calculation API endpoint.');
      console.log('This is normal - we\'ll need to test in a real game instead.');
    } else {
      console.log(`Server value result: ${serverValueResult.value} points`);
      console.log(`Expected value: ${criticalTestSet.expectedValue} points`);
      console.log(`Is server value correct? ${serverValueResult.value === criticalTestSet.expectedValue ? '✅ YES' : '❌ NO'}`);
      console.log(`Meets 30-point requirement? ${serverValueResult.value >= 30 ? '✅ YES' : '❌ NO'}`);
    }
  } catch (e) {
    console.log('⚠️ Error testing server value calculation:', e);
  }
  
  // Instructions for testing in a real game
  console.log('\n======= REAL GAME TESTING =======');
  console.log('To test this fix in a real game:');
  console.log('1. Start a game with bots in debug mode');
  console.log('2. Try to play a set with: Joker + Yellow 13 + Blue 13');
  console.log('3. The server should calculate this as 39 points (13×3)');
  console.log('4. This exceeds the 30-point requirement for initial play');
  console.log('5. The play should be accepted');
  
  console.log('\n======= FIX EXPLANATION =======');
  console.log('The critical issue is in the calculateSetValue function:');
  console.log('When calculating group values, jokers should be assigned the same value as the group number.');
  console.log('For example, in a group of two 13s + joker, the joker should be worth 13 points.');
  console.log('This gives a total value of 39 points, meeting the 30-point requirement.');
  
  console.log('\n======= TEST COMPLETE =======');
})();
