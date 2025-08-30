/**
 * Joker Serialization Test
 * 
 * This test examines how joker objects are serialized/deserialized during transmission
 * to identify the root cause of validation issues.
 */

const socketUrl = 'https://rummikub-backend.onrender.com'; // Production backend URL

// Utility function to create a network logger
function createNetworkLogger() {
  const log = [];
  
  return {
    add: function(type, data) {
      const entry = {
        timestamp: new Date().toISOString(),
        type,
        data: JSON.parse(JSON.stringify(data)) // Deep clone to capture current state
      };
      log.push(entry);
      console.log(`${entry.timestamp} [${type}]`, JSON.stringify(entry.data));
    },
    getLog: function() {
      return log;
    }
  };
}

// Test class to run in browser
class JokerNetworkTest {
  constructor() {
    this.socket = null;
    this.gameId = null;
    this.playerId = null;
    this.logger = createNetworkLogger();
    this.testTiles = [];
    this.testResults = {
      connected: false,
      gameCreated: false,
      playSetAttempted: false,
      playSetResult: null,
      errorMessage: null
    };
  }
  
  async connect() {
    console.log(`Connecting to ${socketUrl}`);
    
    return new Promise((resolve, reject) => {
      try {
        // Connect to the Socket.IO server
        this.socket = io(socketUrl);
        
        this.socket.on('connect', () => {
          this.playerId = this.socket.id;
          this.logger.add('connect', { playerId: this.playerId });
          this.testResults.connected = true;
          console.log(`Connected with player ID: ${this.playerId}`);
          resolve(true);
        });
        
        this.socket.on('connect_error', (error) => {
          this.logger.add('connect_error', { error: error.toString() });
          this.testResults.errorMessage = `Connection error: ${error.toString()}`;
          reject(error);
        });
        
        // Set up event listeners
        this.setupEventListeners();
        
      } catch (error) {
        this.logger.add('exception', { error: error.toString() });
        this.testResults.errorMessage = `Exception: ${error.toString()}`;
        reject(error);
      }
    });
  }
  
  setupEventListeners() {
    // Game creation events
    this.socket.on('gameCreated', (data) => {
      this.logger.add('gameCreated', data);
      this.gameId = data.gameId;
      this.testResults.gameCreated = true;
      console.log(`Game created with ID: ${this.gameId}`);
    });
    
    // Set play events
    this.socket.on('setPlayed', (data) => {
      this.logger.add('setPlayed', data);
      this.testResults.playSetResult = true;
      console.log('Set played successfully:', data);
    });
    
    // Error events
    this.socket.on('error', (data) => {
      this.logger.add('error', data);
      this.testResults.playSetResult = false;
      this.testResults.errorMessage = data.message;
      console.error('Error received:', data);
    });
  }
  
  async createGame() {
    return new Promise((resolve) => {
      const playerName = 'TestPlayer';
      const createGameData = {
        playerName,
        gameOptions: { jokers: true }
      };
      
      this.logger.add('createGame_request', createGameData);
      this.socket.emit('createGame', createGameData);
      
      // Wait for game creation response
      const checkInterval = setInterval(() => {
        if (this.testResults.gameCreated) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
  }
  
  prepareTestTiles() {
    // Create test tiles with jokers and regular tiles
    this.testTiles = [
      // Standard joker
      { id: 'joker_1', isJoker: true, color: null, number: null },
      // Regular tiles
      { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
      { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
    ];
    
    // Log the prepared tiles
    this.logger.add('test_tiles', this.testTiles);
    console.log('Prepared test tiles:', this.testTiles);
    
    return this.testTiles;
  }
  
  isValidGroup(tiles) {
    // Client-side validation for groups
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
  }
  
  async attemptPlaySet() {
    return new Promise((resolve) => {
      const tiles = this.prepareTestTiles();
      
      // Validate the set client-side
      const isValid = this.isValidGroup(tiles);
      this.logger.add('client_validation', { isValid });
      console.log(`Client validation result: ${isValid ? 'VALID ✓' : 'INVALID ✗'}`);
      
      if (!isValid) {
        this.testResults.playSetAttempted = true;
        this.testResults.playSetResult = false;
        this.testResults.errorMessage = 'Client validation failed';
        resolve(false);
        return;
      }
      
      // Get tile IDs for the playSet request
      const tileIds = tiles.map(t => t.id);
      
      // Record the actual serialized data
      const serializedTiles = JSON.stringify(tiles);
      this.logger.add('serialized_tiles', { serializedTiles });
      
      // Log the request
      this.logger.add('playSet_request', { gameId: this.gameId, tileIds });
      
      // Emit the playSet event
      this.testResults.playSetAttempted = true;
      this.socket.emit('playSet', this.gameId, tileIds);
      
      // Wait for playSet response
      setTimeout(() => {
        resolve(this.testResults.playSetResult);
      }, 2000); // Allow 2 seconds for response
    });
  }
  
  async runTest() {
    try {
      console.log('==== JOKER NETWORK TEST STARTING ====');
      
      // Step 1: Connect to server
      await this.connect();
      console.log('✅ Connected to server');
      
      // Step 2: Create a game
      await this.createGame();
      console.log('✅ Game created');
      
      // Step 3: Attempt to play a set with jokers
      const playSetResult = await this.attemptPlaySet();
      console.log(`${playSetResult ? '✅' : '❌'} Play set attempt: ${playSetResult ? 'SUCCESS' : 'FAILED'}`);
      
      // Step 4: Generate test report
      const testReport = {
        timestamp: new Date().toISOString(),
        results: this.testResults,
        logs: this.logger.getLog()
      };
      
      console.log('==== TEST REPORT ====');
      console.log('Connected:', this.testResults.connected);
      console.log('Game Created:', this.testResults.gameCreated);
      console.log('Play Set Attempted:', this.testResults.playSetAttempted);
      console.log('Play Set Result:', this.testResults.playSetResult);
      console.log('Error Message:', this.testResults.errorMessage);
      
      return testReport;
      
    } catch (error) {
      console.error('Test failed with error:', error);
      return {
        timestamp: new Date().toISOString(),
        error: error.toString(),
        results: this.testResults,
        logs: this.logger.getLog()
      };
    }
  }
  
  // Helper to run in browser console
  static async runInBrowser() {
    const test = new JokerNetworkTest();
    const results = await test.runTest();
    console.log('Complete test results:', results);
    return results;
  }
}

// Export for browser or Node.js use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JokerNetworkTest;
} else if (typeof window !== 'undefined') {
  window.JokerNetworkTest = JokerNetworkTest;
}
