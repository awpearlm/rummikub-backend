/**
 * Joker Live Test
 * 
 * This script can be pasted directly into the browser console on https://jkube.netlify.app 
 * to test joker validation with the live server.
 */

// Immediately-invoked function to avoid polluting global scope
(async function() {
  console.log('======= JOKER LIVE TEST =======');
  console.log('Running on:', window.location.href);
  
  // Try to find the Rummikub client instance
  console.log('🔍 Searching for Rummikub client...');
  
  // Check multiple possible locations
  let rummikubClient = null;
  
  // Option 1: Direct window.rummikubClient
  if (window.rummikubClient) {
    console.log('✅ Found Rummikub client as window.rummikubClient');
    rummikubClient = window.rummikubClient;
  } 
  // Option 2: Look for the socket connection in window
  else if (window.socket) {
    console.log('✅ Found Socket.IO connection as window.socket');
    rummikubClient = { socket: window.socket };
  }
  // Option 3: Search for global game functions
  else {
    console.log('🔍 Searching for game functions...');
    const possibleFunctions = ['playSet', 'drawTile', 'startBotGame', 'endTurn'];
    const foundFunctions = possibleFunctions.filter(fn => typeof window[fn] === 'function');
    
    if (foundFunctions.length > 0) {
      console.log(`✅ Found ${foundFunctions.length} game functions in global scope`);
      
      // Create a proxy client using the global functions
      rummikubClient = {
        socket: null,
        playerHand: window.playerHand || []
      };
      
      // Add found functions to our proxy client
      foundFunctions.forEach(fn => {
        rummikubClient[fn] = window[fn];
      });
      
      // Try to find the socket
      if (window.io && window.io.managers) {
        const managers = Object.values(window.io.managers);
        if (managers.length > 0) {
          const sockets = Object.values(managers[0].nsps || {});
          if (sockets.length > 0) {
            rummikubClient.socket = sockets[0];
            console.log('✅ Found Socket.IO connection through io.managers');
          }
        }
      }
    }
  }
  
  // Final check if we have what we need
  if (!rummikubClient) {
    console.error('❌ ERROR: Rummikub client not found. Make sure you run this on https://jkube.netlify.app');
    
    // Log helpful information for debugging
    console.log('🔍 Available global variables:');
    console.log(Object.keys(window).filter(key => 
      ['game', 'client', 'socket', 'io', 'player', 'tile', 'joker'].some(term => 
        key.toLowerCase().includes(term)
      )
    ));
    return;
  }
  
  console.log('✅ Found Rummikub client interface');
  
  // Find functions in the global scope if not available on our client object
  const findFunction = (name) => {
    if (typeof rummikubClient[name] === 'function') {
      return rummikubClient[name].bind(rummikubClient);
    } else if (typeof window[name] === 'function') {
      return window[name];
    }
    return null;
  };
  
  // Try to get the player hand from various possible locations
  const getPlayerHand = () => {
    // Try to find player hand in various places
    if (Array.isArray(rummikubClient.playerHand)) {
      return rummikubClient.playerHand;
    } else if (Array.isArray(window.playerHand)) {
      return window.playerHand;
    } else if (window.player && Array.isArray(window.player.hand)) {
      return window.player.hand;
    } else if (window.game && window.game.player && Array.isArray(window.game.player.hand)) {
      return window.game.player.hand;
    }
    
    // Look for tile elements in the DOM as a last resort
    const tileElements = document.querySelectorAll('.player-tile, .tile');
    if (tileElements.length > 0) {
      console.log(`📋 Found ${tileElements.length} tile elements in the DOM`);
      
      // Try to extract tile data from data attributes or classes
      const extractedTiles = [];
      tileElements.forEach(el => {
        const isJoker = el.classList.contains('joker') || el.dataset.isJoker === 'true';
        const color = el.dataset.color || (el.className.match(/(red|blue|yellow|black)/i) || [])[0] || null;
        const number = el.dataset.number || parseInt(el.textContent.trim()) || null;
        const id = el.id || el.dataset.id || `tile_${Math.random().toString(36).substr(2, 9)}`;
        
        extractedTiles.push({
          id,
          isJoker,
          color: isJoker ? null : color,
          number: isJoker ? null : number
        });
      });
      
      return extractedTiles;
    }
    
    // Couldn't find the hand
    console.log('⚠️ Could not find player hand, will use mock tiles instead');
    return [];
  };
  
  if (!rummikubClient.socket || !rummikubClient.socket.connected) {
    console.error('❌ ERROR: Not connected to server. Please refresh the page and try again.');
    return;
  }
  
  console.log('✅ Connected to server');
  
  // Start a bot game for testing
  console.log('⏳ Creating a bot game for testing...');
  
  // Use the existing startBotGame function
  if (typeof rummikubClient.startBotGame !== 'function') {
    console.error('❌ ERROR: startBotGame function not found');
    return;
  }
  
  // Create a new bot game with debug mode
  rummikubClient.startBotGame('TestPlayer', 'debug', 1);
  
  // Wait for game to be created
  console.log('⏳ Waiting for game to start...');
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (rummikubClient.gameStarted) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 10000);
  });
  
  if (!rummikubClient.gameStarted) {
    console.error('❌ ERROR: Game did not start. Please try again.');
    return;
  }
  
  console.log('✅ Game started successfully');
  
  // Find joker and 13 tiles in hand
  const findTilesForTest = () => {
    const hand = rummikubClient.playerHand || [];
    
    // Find a joker
    const joker = hand.find(tile => tile.isJoker);
    
    // Find two 13 tiles of different colors
    const thirteens = hand.filter(tile => !tile.isJoker && tile.number === 13);
    const yellowThirteen = thirteens.find(tile => tile.color === 'yellow');
    const blueThirteen = thirteens.find(tile => tile.color === 'blue');
    
    return {
      joker,
      yellowThirteen,
      blueThirteen,
      hasAllTiles: joker && yellowThirteen && blueThirteen
    };
  };
  
  // First, check if we have the necessary tiles
  let testTiles = findTilesForTest();
  
  // If we don't have the right tiles, try drawing until we do (within reason)
  let drawCount = 0;
  while (!testTiles.hasAllTiles && drawCount < 15) {
    console.log('⏳ Drawing a tile to find required test tiles...');
    // Use the drawTile function if available, otherwise skip
    if (typeof rummikubClient.drawTile === 'function') {
      rummikubClient.drawTile();
      // Wait a moment for the draw to process
      await new Promise(resolve => setTimeout(resolve, 500));
      drawCount++;
      testTiles = findTilesForTest();
    } else {
      console.log('❌ Cannot draw tiles - drawTile function not found');
      break;
    }
  }
  
  if (!testTiles.hasAllTiles) {
    console.log('❌ Could not find all required tiles after drawing. Will create mock tiles instead.');
    
    // Create mock tiles for testing - these won't actually be playable
    testTiles = {
      joker: { id: 'joker_1', isJoker: true, color: null, number: null },
      yellowThirteen: { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
      blueThirteen: { id: 'blue_13', isJoker: false, color: 'blue', number: 13 },
      hasAllTiles: true,
      usingMockTiles: true
    };
  } else {
    console.log('✅ Found all required tiles for testing');
  }
  
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
  
  // If we have real tiles, try to play the set
  if (!testTiles.usingMockTiles) {
    console.log('\n🧪 Testing server-side validation (actual play)...');
    console.log('⏳ Attempting to play the set...');
    
    // Create a set with the test tiles
    const selectedTileIds = [
      testTiles.joker.id,
      testTiles.yellowThirteen.id,
      testTiles.blueThirteen.id
    ];
    
    // Set up listeners for the results
    let resultReceived = false;
    let serverValidationResult = null;
    let errorMessage = null;
    
    // Listen for setPlayed event
    const setPlayedListener = (data) => {
      console.log('✅ Server accepted the set!', data);
      resultReceived = true;
      serverValidationResult = true;
    };
    
    // Listen for error event
    const errorListener = (data) => {
      console.log('❌ Server rejected the set:', data);
      resultReceived = true;
      serverValidationResult = false;
      errorMessage = data.message;
    };
    
    // Add event listeners
    rummikubClient.socket.on('setPlayed', setPlayedListener);
    rummikubClient.socket.on('error', errorListener);
    
    // Try to play the set
    if (typeof rummikubClient.playSet === 'function') {
      rummikubClient.playSet(selectedTileIds);
      
      // Wait for the result
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (resultReceived) {
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
      
      // Remove event listeners
      rummikubClient.socket.off('setPlayed', setPlayedListener);
      rummikubClient.socket.off('error', errorListener);
      
      // Show result
      if (resultReceived) {
        console.log(`Server validation result: ${serverValidationResult ? '✅ VALID' : '❌ INVALID'}`);
        if (errorMessage) {
          console.log(`Error message: ${errorMessage}`);
        }
      } else {
        console.log('⚠️ No response received from server');
      }
    } else {
      console.log('❌ Cannot test server validation - playSet function not found');
    }
  } else {
    console.log('\n⚠️ Using mock tiles, cannot test actual server validation');
  }
  
  // Log serialization test
  console.log('\n🧪 Testing serialization of joker objects...');
  
  // Create a joker object
  const jokerObject = { id: 'test_joker', isJoker: true, color: null, number: null };
  console.log('Original joker object:', JSON.parse(JSON.stringify(jokerObject)));
  
  // Serialize and deserialize
  const serialized = JSON.stringify(jokerObject);
  const deserialized = JSON.parse(serialized);
  
  console.log('After serialization & deserialization:', deserialized);
  console.log('isJoker property preserved?', deserialized.isJoker === true);
  console.log('Property types:');
  console.log('- isJoker:', typeof deserialized.isJoker);
  console.log('- color:', typeof deserialized.color);
  console.log('- number:', typeof deserialized.number);
  
  // Final report
  console.log('\n======= TEST SUMMARY =======');
  console.log('Client validation: ' + (clientValid ? '✅ VALID' : '❌ INVALID'));
  
  if (!testTiles.usingMockTiles && resultReceived) {
    console.log('Server validation: ' + (serverValidationResult ? '✅ VALID' : '❌ INVALID'));
    console.log('Client/Server match? ' + ((clientValid === serverValidationResult) ? '✅ YES' : '❌ NO'));
  } else {
    console.log('Server validation: Not tested with real tiles');
  }
  
  console.log('Serialization preserves isJoker? ' + (deserialized.isJoker === true ? '✅ YES' : '❌ NO'));
  
  console.log('\n🧩 RECOMMENDATION:');
  if (clientValid && !serverValidationResult) {
    console.log('The issue appears to be with server-side joker validation.');
    console.log('Apply the fix in server.js as described in the README.');
  } else if (!deserialized.isJoker) {
    console.log('There is a serialization issue with joker objects.');
    console.log('Apply the enhanced joker detection fix as described in the README.');
  } else {
    console.log('Further investigation needed. Check server logs for more details.');
  }
  
  console.log('\n======= TEST COMPLETE =======');
})();
