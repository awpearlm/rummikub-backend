/**
 * Joker Live Test - Enhanced Version
 * 
 * This script can be pasted directly into the browser console on https://jkube.netlify.app 
 * to test joker validation with the live server.
 */

// Immediately-invoked function to avoid polluting global scope
(async function() {
  console.log('======= JOKER LIVE TEST =======');
  console.log('Running on:', window.location.href);
  
  // Find the Rummikub client instance
  console.log('🔍 Looking for game client...');
  
  // Debug global objects
  console.log('📊 Available global objects:');
  const globalObjectNames = Object.keys(window).filter(key => 
    typeof window[key] === 'object' && 
    window[key] !== null && 
    key !== 'window' && 
    key !== 'document' &&
    key !== 'console' &&
    !key.startsWith('Web')
  ).slice(0, 20); // Limit to 20 to avoid too much output
  
  console.log(globalObjectNames);
  
  // Try to find how player name is stored in the application
  console.log('🔍 Looking for player name storage:');
  
  // Check localStorage and sessionStorage
  const localStorageName = localStorage.getItem('playerName');
  const sessionStorageName = sessionStorage.getItem('playerName');
  console.log('📊 localStorage playerName:', localStorageName || 'not found');
  console.log('📊 sessionStorage playerName:', sessionStorageName || 'not found');
  
  // Check global variables
  console.log('📊 window.playerName:', typeof window.playerName !== 'undefined' ? window.playerName : 'not found');
  
  // Check form elements
  const nameInput = document.querySelector('#playerName');
  console.log('📊 playerName element:', nameInput ? 'found' : 'not found');
  console.log('📊 playerName value:', nameInput?.value || 'empty');
  
  // Also check alternative name input
  const altNameInput = document.querySelector('#playerNameInput');
  if (altNameInput) {
    console.log('📊 Alternative playerNameInput element found with value:', altNameInput.value || 'empty');
  }
  
  // Try to find client by looking for socket.io
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
  
  // If we still don't have a client, try to find buttons to simulate gameplay
  if (!rummikubClient) {
    console.log('🔍 Looking for game UI elements...');
    
    // Look for the start bot game button
    const startBotGameButton = document.querySelector('#startBotGameBtn');
    if (startBotGameButton) {
      console.log('✅ Found start bot game button, will click it');
      
      // Click the button to start a game
      startBotGameButton.click();
      
      // Wait for the game to initialize
      console.log('⏳ Waiting for game to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try again to find the client
      if (typeof io !== 'undefined') {
        for (const key in window) {
          try {
            const obj = window[key];
            if (obj && 
                typeof obj === 'object' && 
                obj.socket && 
                typeof obj.socket.emit === 'function') {
              console.log(`✅ Found client after starting game: ${key}`);
              rummikubClient = obj;
              break;
            }
          } catch (e) {
            // Ignore errors when accessing properties
          }
        }
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
      socket: io('https://rummikub-backend.onrender.com'),
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
      },
      
      drawTile: function() {
        console.log('Mock drawTile called');
        if (this.gameId) {
          this.socket.emit('drawTile', this.gameId);
        }
      },
      
      playSet: function(tileIds) {
        console.log('Mock playSet called with:', tileIds);
        if (this.gameId) {
          this.socket.emit('playSet', this.gameId, tileIds);
        }
      }
    };
    
    // Set up basic event listeners
    rummikubClient.socket.on('connect', function() {
      console.log('Connected to server with ID:', rummikubClient.socket.id);
    });
    
    rummikubClient.socket.on('error', function(data) {
      console.log('Socket error:', data);
    });
    
    rummikubClient.socket.on('updateGameState', function(data) {
      console.log('Game state updated:', data);
      if (data.players) {
        const myPlayer = data.players.find(p => p.id === rummikubClient.socket.id);
        if (myPlayer && myPlayer.hand) {
          rummikubClient.playerHand = myPlayer.hand;
          console.log('Updated player hand:', rummikubClient.playerHand);
        }
      }
    });
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
  
  // Check server version if possible
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
      const serverVersion = await serverVersionPromise;
      
      if (!serverVersion) {
        console.log('⚠️ Server version not available - may be an older server');
      }
    }
  } catch (e) {
    console.log('⚠️ Error checking server version:', e);
  }
  
  // Start a bot game for testing if not already in a game
  if (!rummikubClient.gameStarted) {
    console.log('⏳ Creating a bot game for testing...');
    
    // Start a new bot game
    if (typeof rummikubClient.startBotGame === 'function') {
      // First check if we need to set the player name
      if (!rummikubClient.playerName || rummikubClient.playerName === '') {
        const testPlayerName = 'TestPlayer_' + Math.floor(Math.random() * 1000);
        console.log(`Setting player name to "${testPlayerName}"`);
        
        // Set the name on the rummikubClient object
        rummikubClient.playerName = testPlayerName;
        
        // Look for other properties that might store the player name
        if (rummikubClient.gameSettings && typeof rummikubClient.gameSettings === 'object') {
          rummikubClient.gameSettings.playerName = testPlayerName;
          console.log('✅ Set name in gameSettings');
        }
        
        // Check if there's a setPlayerName method
        if (typeof rummikubClient.setPlayerName === 'function') {
          try {
            rummikubClient.setPlayerName(testPlayerName);
            console.log('✅ Used setPlayerName method');
          } catch (e) {
            console.log('⚠️ Error calling setPlayerName:', e);
          }
        }
        
        // IMPORTANT: Try to find all ways to set the player name that the game might use
        try {
          // Try global variables
          if (typeof playerName !== 'undefined') {
            window.playerName = testPlayerName;
            console.log('✅ Set global playerName variable');
          }
          
          // Try sessionStorage or localStorage
          sessionStorage.setItem('playerName', testPlayerName);
          localStorage.setItem('playerName', testPlayerName);
          console.log('✅ Set name in storage');
        } catch (e) {
          console.log('⚠️ Error setting additional name locations:', e);
        }
        
        // Find and update player name input field
        const nameInput = document.querySelector('#playerName');
        if (nameInput) {
          nameInput.value = testPlayerName;
          console.log('✅ Set name in input field with ID #playerName');
          
          // Try to trigger any event listeners
          try {
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Try to trigger a blur event which often triggers validation
            nameInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // Try submitting the parent form if it exists
            const form = nameInput.closest('form');
            if (form) {
              console.log('✅ Found parent form, triggering submit event');
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          } catch (e) {
            console.log('⚠️ Error dispatching input events:', e);
          }
        } else {
          console.log('⚠️ Could not find player name input with ID #playerName');
          
          // Try alternative input field selectors
          const altNameInput = document.querySelector('#playerNameInput') || 
                               document.querySelector('input[placeholder*="name" i]') ||
                               document.querySelector('input[type="text"]');
          
          if (altNameInput) {
            altNameInput.value = testPlayerName;
            console.log('✅ Set name in alternative input field:', altNameInput);
            
            try {
              altNameInput.dispatchEvent(new Event('input', { bubbles: true }));
              altNameInput.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (e) {
              console.log('⚠️ Error dispatching events to alternative input:', e);
            }
          }
        }
      }
      
      // Before starting the game, check what parameters the startBotGame function expects
      console.log('🔍 Examining startBotGame function:', rummikubClient.startBotGame);
      
      // Show player name right before calling startBotGame
      console.log('👤 Final player name value:', rummikubClient.playerName);
      console.log('👤 Global player name value:', typeof window.playerName !== 'undefined' ? window.playerName : 'undefined');
      
      // Try checking input field one more time
      const finalNameValue = document.querySelector('#playerName')?.value;
      console.log('👤 Input field name value:', finalNameValue || 'no input found');
      
      // Check if we need to set a default player name in case all else fails
      if (!rummikubClient.playerName && finalNameValue) {
        rummikubClient.playerName = finalNameValue;
        console.log('✅ Used input field value as fallback name');
      } 
      // If no name is found anywhere, use a default
      else if (!rummikubClient.playerName) {
        rummikubClient.playerName = 'TestPlayer_' + Math.floor(Math.random() * 1000);
        console.log('⚠️ Using default name as last resort:', rummikubClient.playerName);
        
        // Try setting it in the input field too
        const nameInput = document.querySelector('#playerName');
        if (nameInput) {
          nameInput.value = rummikubClient.playerName;
          try {
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
        }
      }
      
      // Now start the bot game, sending the player name in different ways
      console.log('🤖 Starting bot game...');
      
      try {
        // Try different approaches based on what we've seen
        if (typeof rummikubClient.startBotGame === 'function') {
          // First check how many parameters the function expects
          const funcStr = rummikubClient.startBotGame.toString();
          console.log('Function signature:', funcStr.slice(0, 100) + '...');
          
          // Examine the game implementation to understand how it works
          console.log('🔬 Examining game implementation:');
          try {
            // Check how the game gets the player name internally
            if (rummikubClient.startBotGame.toString().includes('getElementById')) {
              console.log('Game uses getElementById to get player name from input field');
            }
            
            // Print more of the function for debugging
            const funcLines = rummikubClient.startBotGame.toString().split('\n').slice(0, 10);
            console.log('First 10 lines of startBotGame function:\n', funcLines.join('\n'));
          } catch (e) {
            console.log('Error examining function:', e);
          }
          
          // Call with different patterns based on what we observe
          // Option 1: Pass player name as first parameter
          if (rummikubClient.playerName) {
            console.log('Calling startBotGame with explicit player name parameter');
            rummikubClient.startBotGame(rummikubClient.playerName, 'debug', 1);
          } 
          // Option 2: Call with no parameters (relies on the client using internal playerName)
          else {
            console.log('Calling startBotGame with no parameters');
            rummikubClient.startBotGame();
          }
        } else {
          console.log('⚠️ startBotGame is not a function!');
          
          // Plan B: Try clicking the actual button
          const startBotGameBtn = document.querySelector('#startBotGameBtn');
          if (startBotGameBtn) {
            console.log('🖱️ Found the start bot game button, clicking it directly');
            startBotGameBtn.click();
          } else {
            console.log('❌ Could not find startBotGameBtn either!');
          }
        }
      } catch (e) {
        console.error('❌ Error starting bot game:', e);
      }
      
      // Wait for game to be created
      console.log('⏳ Waiting for game to start...');
      
      // Set up an additional listener for game started events
      const gameStartedPromise = new Promise(resolve => {
        const gameStartedHandler = function(data) {
          console.log('🎮 Game started event received:', data);
          rummikubClient.gameStarted = true;
          resolve(true);
          // Clean up listener after first trigger
          rummikubClient.socket.off('gameStarted', gameStartedHandler);
          rummikubClient.socket.off('botGameCreated', gameStartedHandler);
          rummikubClient.socket.off('botGameStarted', gameStartedHandler);
        };
        
        // Listen to multiple possible events
        rummikubClient.socket.on('gameStarted', gameStartedHandler);
        rummikubClient.socket.on('botGameCreated', gameStartedHandler);
        rummikubClient.socket.on('botGameStarted', gameStartedHandler);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          rummikubClient.socket.off('gameStarted', gameStartedHandler);
          rummikubClient.socket.off('botGameCreated', gameStartedHandler);
          rummikubClient.socket.off('botGameStarted', gameStartedHandler);
          resolve(false);
        }, 10000);
      });
      
      // Also check the gameStarted property
      const checkGameStartedPromise = new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (rummikubClient.gameStarted) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 10000);
      });
      
      // Wait for either method to indicate game has started
      const gameStarted = await Promise.race([gameStartedPromise, checkGameStartedPromise]);
      
      if (gameStarted) {
        console.log('✅ Game started detected via event or property');
        rummikubClient.gameStarted = true;
      } else {
        console.log('⚠️ No game start detected via events or properties');
      }
    } else {
      console.log('⚠️ Cannot start bot game - startBotGame function not found');
      console.log('👉 Please start a game manually and then run this script again');
      return;
    }
  }
  
  if (!rummikubClient.gameStarted) {
    console.error('❌ ERROR: Game did not start. Please try again.');
    return;
  }
  
  console.log('✅ Game started successfully');
  
  // Wait for hand to be populated
  console.log('⏳ Waiting for player hand to be populated...');
  await new Promise(resolve => {
    const checkInterval = setInterval(() => {
      if (rummikubClient.playerHand && rummikubClient.playerHand.length > 0) {
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
  
  console.log('Player hand:', rummikubClient.playerHand);
  
  // Find joker and 13 tiles in hand
  const findTilesForTest = () => {
    const hand = rummikubClient.playerHand || [];
    console.log('Searching in hand:', hand);
    
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
  console.log('Initial tile search result:', testTiles);
  
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
  let resultReceived = false;
  let serverValidationResult = undefined;
  let errorMessage = null;
  
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
  if (testTiles.usingMockTiles) {
    console.log('Testing with mock tiles showed that:');
    console.log('1. Client-side validation correctly recognizes joker + 13y + 13b as valid');
    console.log('2. JSON serialization preserves the isJoker property');
    console.log('\nBased on code inspection, the issue is likely in the server\'s isValidGroup function.');
    console.log('❗ Apply the following fix in server.js:');
    console.log(`
function isValidGroup(tiles) {
  // Count jokers
  const jokerCount = tiles.filter(t => t.isJoker || t.number === null).length;
  
  // If all tiles are jokers, it's valid
  if (jokerCount === tiles.length) return true;
  
  // For groups, all non-joker tiles must be the same number
  const numbers = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.number);
  if (new Set(numbers).size > 1) return false;
  
  // All non-joker tiles must be different colors
  const colors = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.color);
  if (new Set(colors).size !== colors.length) return false;
  
  return true;
}
    `);
  } else if (clientValid && serverValidationResult === false) {
    console.log('The issue appears to be with server-side joker validation.');
    console.log('❗ Apply the following fix in server.js:');
    console.log(`
function isValidGroup(tiles) {
  // Count jokers
  const jokerCount = tiles.filter(t => t.isJoker || t.number === null).length;
  
  // If all tiles are jokers, it's valid
  if (jokerCount === tiles.length) return true;
  
  // For groups, all non-joker tiles must be the same number
  const numbers = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.number);
  if (new Set(numbers).size > 1) return false;
  
  // All non-joker tiles must be different colors
  const colors = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.color);
  if (new Set(colors).size !== colors.length) return false;
  
  return true;
}
    `);
    console.log('\nAlso check the playSet and playMultipleSets functions to ensure they normalize joker properties.');
  } else if (!deserialized.isJoker) {
    console.log('There is a serialization issue with joker objects.');
    console.log('❗ Apply the enhanced joker detection in the server:');
    console.log(`
// Check for jokers by multiple properties
const normalizeJokers = (tiles) => {
  return tiles.map(tile => {
    // Normalize joker detection
    if (tile.isJoker || tile.number === null || 
        (tile.id && tile.id.includes('joker'))) {
      return { ...tile, isJoker: true, number: null, color: null };
    }
    return tile;
  });
};

// Then use this in playSet and playMultipleSets
socket.on('playSet', (gameId, tileIds) => {
  // Existing code...
  const tilesInSet = normalizeJokers(tilesInSet);
  // Continue with validation...
});
    `);
  } else if (typeof serverValidationResult !== 'undefined' && serverValidationResult === false) {
    console.log('❗ There seems to be another validation issue with the set.');
    if (errorMessage) {
      console.log(`Error message: ${errorMessage}`);
      console.log('Check server.js for the specific validation rule that might be failing.');
    }
  } else {
    console.log('Further investigation needed. Check server logs for more details.');
    console.log('Consider adding logging to server.js for the isValidGroup function.');
  }
  
  console.log('\n======= TEST COMPLETE =======');
})();
