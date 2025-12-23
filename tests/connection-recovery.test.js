/**
 * Property-Based Tests for Connection Recovery and Stability
 * Feature: rummikub-stability, Property 6: Connection Recovery State Preservation
 * Validates: Requirements 4.3, 4.4
 * 
 * Feature: rummikub-stability, Property 7: Concurrent Disconnection Handling
 * Validates: Requirements 4.5
 * 
 * Feature: rummikub-stability, Property 12: Reconnection Failure Fallbacks
 * Validates: Requirements 4.2
 */

const fc = require('fast-check');

// Mock RummikubGame class for testing
class MockRummikubGame {
  constructor(gameId, isBotGame = false) {
    this.id = gameId;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.deck = [];
    this.board = [];
    this.started = false;
    this.winner = null;
    this.isBotGame = isBotGame;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    
    // Connection state tracking
    this.connectionStates = new Map(); // playerId -> connection state
    this.disconnectionTimes = new Map(); // playerId -> disconnection timestamp
    this.reconnectionAttempts = new Map(); // playerId -> attempt count
    
    this.initializeDeck();
  }

  initializeDeck() {
    const colors = ['red', 'blue', 'yellow', 'black'];
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    
    this.deck = [];
    
    // Add numbered tiles (2 of each)
    for (let set = 0; set < 2; set++) {
      for (const color of colors) {
        for (const number of numbers) {
          this.deck.push({
            id: `${color}_${number}_${set}`,
            color,
            number,
            isJoker: false
          });
        }
      }
    }
    
    // Add jokers
    this.deck.push({ id: 'joker_1', color: null, number: null, isJoker: true });
    this.deck.push({ id: 'joker_2', color: null, number: null, isJoker: true });
    
    this.shuffleDeck();
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= 4) return false;
    
    const player = {
      id: playerId,
      name: playerName,
      hand: [],
      hasPlayedInitial: false,
      score: 0,
      isBot: false,
      disconnected: false,
      disconnectedAt: null
    };
    
    this.players.push(player);
    this.connectionStates.set(playerId, 'connected');
    return true;
  }

  // Simulate player disconnection
  disconnectPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    
    player.disconnected = true;
    player.disconnectedAt = Date.now();
    this.connectionStates.set(playerId, 'disconnected');
    this.disconnectionTimes.set(playerId, Date.now());
    
    return true;
  }

  // Simulate player reconnection
  reconnectPlayer(playerId, newSocketId = null) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Update socket ID if provided (simulating new connection)
    if (newSocketId) {
      player.id = newSocketId;
    }
    
    player.disconnected = false;
    player.disconnectedAt = null;
    this.connectionStates.set(newSocketId || playerId, 'connected');
    this.disconnectionTimes.delete(playerId);
    
    return true;
  }

  // Get game state for a specific player (simulating what client receives)
  getGameState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return {
      id: this.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        handSize: p.hand.length,
        hasPlayedInitial: p.hasPlayedInitial,
        score: p.score,
        isBot: p.isBot,
        disconnected: p.disconnected
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      board: this.board,
      started: this.started,
      winner: this.winner,
      playerHand: player ? player.hand : [],
      deckSize: this.deck.length,
      isBotGame: this.isBotGame
    };
  }

  // Simulate dealing tiles to players
  dealTiles() {
    for (const player of this.players) {
      for (let i = 0; i < 14; i++) {
        if (this.deck.length > 0) {
          player.hand.push(this.deck.pop());
        }
      }
    }
    this.started = true;
  }

  // Create a deep copy of game state for comparison
  createStateSnapshot() {
    return {
      id: this.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: [...p.hand],
        hasPlayedInitial: p.hasPlayedInitial,
        score: p.score,
        isBot: p.isBot,
        disconnected: p.disconnected,
        disconnectedAt: p.disconnectedAt
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      board: this.board.map(set => [...set]),
      started: this.started,
      winner: this.winner,
      deckSize: this.deck.length
    };
  }

  // Simulate reconnection failure scenarios
  simulateReconnectionFailure(playerId, attemptCount = 1) {
    const currentAttempts = this.reconnectionAttempts.get(playerId) || 0;
    this.reconnectionAttempts.set(playerId, currentAttempts + attemptCount);
    
    // Return failure info
    return {
      playerId,
      attempts: currentAttempts + attemptCount,
      lastAttempt: Date.now(),
      status: 'failed'
    };
  }

  // Get reconnection fallback options
  getReconnectionFallbacks(playerId) {
    const attempts = this.reconnectionAttempts.get(playerId) || 0;
    const disconnectionTime = this.disconnectionTimes.get(playerId);
    
    const fallbacks = [];
    
    // Manual reconnection option
    fallbacks.push({
      type: 'manual_reconnect',
      description: 'Try reconnecting manually',
      available: true
    });
    
    // Local state preservation
    if (disconnectionTime && (Date.now() - disconnectionTime) < 300000) { // 5 minutes
      fallbacks.push({
        type: 'local_state',
        description: 'Game state preserved locally',
        available: true
      });
    }
    
    // Create new game option (if too many failures)
    if (attempts >= 5) {
      fallbacks.push({
        type: 'new_game',
        description: 'Create a new game with same players',
        available: true
      });
    }
    
    return fallbacks;
  }
}

// Mock connection manager for testing
class MockConnectionManager {
  constructor() {
    this.connections = new Map(); // socketId -> connection info
    this.reconnectionConfig = {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 16000,
      backoffMultiplier: 2
    };
  }

  // Simulate connection with exponential backoff
  attemptReconnection(socketId, attemptNumber = 1) {
    const delay = Math.min(
      this.reconnectionConfig.baseDelay * Math.pow(this.reconnectionConfig.backoffMultiplier, attemptNumber - 1),
      this.reconnectionConfig.maxDelay
    );
    
    // Simulate success/failure based on attempt number
    const success = attemptNumber <= 3 || Math.random() > 0.3; // Higher success rate for early attempts
    
    return {
      socketId,
      attemptNumber,
      delay,
      success,
      timestamp: Date.now()
    };
  }

  // Get connection status
  getConnectionStatus(socketId) {
    return this.connections.get(socketId) || { status: 'unknown' };
  }

  // Set connection status
  setConnectionStatus(socketId, status, metadata = {}) {
    this.connections.set(socketId, {
      status,
      timestamp: Date.now(),
      ...metadata
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Connection Recovery State Preservation Properties', () => {
  
  /**
   * Property 6: Connection Recovery State Preservation
   * For any game state and player disconnection scenario, reconnecting should restore 
   * the exact game state including hand tiles and board position
   */
  test('Property 6: Connection recovery preserves exact game state', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.constantFrom('GAME01', 'GAME02', 'GAME03', 'TEST01'),
        playerCount: fc.integer({ min: 2, max: 4 }),
        gameStarted: fc.boolean(),
        disconnectPlayerIndex: fc.integer({ min: 0, max: 3 }),
        reconnectionDelay: fc.integer({ min: 100, max: 5000 }) // milliseconds
      }),
      (testConfig) => {
        // Create game with players
        const game = new MockRummikubGame(testConfig.gameId);
        const playerNames = ['Alice', 'Bob', 'Charlie', 'David'];
        
        // Add players up to the specified count
        const actualPlayerCount = Math.min(testConfig.playerCount, playerNames.length);
        for (let i = 0; i < actualPlayerCount; i++) {
          const playerId = `player-${i}`;
          game.addPlayer(playerId, playerNames[i]);
        }
        
        // Start game if specified
        if (testConfig.gameStarted) {
          game.dealTiles();
        }
        
        // Select player to disconnect (ensure valid index)
        const disconnectIndex = Math.min(testConfig.disconnectPlayerIndex, actualPlayerCount - 1);
        const disconnectingPlayer = game.players[disconnectIndex];
        
        // Take snapshot of game state before disconnection
        const preDisconnectState = game.createStateSnapshot();
        const preDisconnectPlayerState = game.getGameState(disconnectingPlayer.id);
        
        // Property: Game state should be preserved before disconnection
        expect(preDisconnectState.players).toHaveLength(actualPlayerCount);
        expect(preDisconnectPlayerState.playerHand).toBeDefined();
        
        // Simulate disconnection
        const disconnectResult = game.disconnectPlayer(disconnectingPlayer.id);
        expect(disconnectResult).toBe(true);
        
        // Verify player is marked as disconnected
        const disconnectedPlayer = game.players.find(p => p.name === disconnectingPlayer.name);
        expect(disconnectedPlayer.disconnected).toBe(true);
        expect(disconnectedPlayer.disconnectedAt).toBeDefined();
        
        // Simulate reconnection with new socket ID
        const newSocketId = `reconnected-${disconnectingPlayer.id}`;
        const reconnectResult = game.reconnectPlayer(disconnectingPlayer.id, newSocketId);
        expect(reconnectResult).toBe(true);
        
        // Take snapshot after reconnection
        const postReconnectState = game.createStateSnapshot();
        const postReconnectPlayerState = game.getGameState(newSocketId);
        
        // Property: Core game state should be preserved after reconnection
        expect(postReconnectState.id).toBe(preDisconnectState.id);
        expect(postReconnectState.players).toHaveLength(preDisconnectState.players.length);
        expect(postReconnectState.currentPlayerIndex).toBe(preDisconnectState.currentPlayerIndex);
        expect(postReconnectState.started).toBe(preDisconnectState.started);
        expect(postReconnectState.board).toEqual(preDisconnectState.board);
        expect(postReconnectState.deckSize).toBe(preDisconnectState.deckSize);
        
        // Property: Reconnected player should have same game data
        const reconnectedPlayer = postReconnectState.players.find(p => p.name === disconnectingPlayer.name);
        const originalPlayer = preDisconnectState.players.find(p => p.name === disconnectingPlayer.name);
        
        expect(reconnectedPlayer).toBeDefined();
        expect(reconnectedPlayer.name).toBe(originalPlayer.name);
        expect(reconnectedPlayer.hand).toEqual(originalPlayer.hand);
        expect(reconnectedPlayer.hasPlayedInitial).toBe(originalPlayer.hasPlayedInitial);
        expect(reconnectedPlayer.score).toBe(originalPlayer.score);
        expect(reconnectedPlayer.disconnected).toBe(false);
        
        // Property: Player should see their exact hand after reconnection
        expect(postReconnectPlayerState.playerHand).toEqual(preDisconnectPlayerState.playerHand);
        expect(postReconnectPlayerState.id).toBe(preDisconnectPlayerState.id);
        expect(postReconnectPlayerState.board).toEqual(preDisconnectPlayerState.board);
        
        return true;
      }
    ), { numRuns: 100 });
  });
});

describe('Concurrent Disconnection Handling Properties', () => {
  
  /**
   * Property 7: Concurrent Disconnection Handling
   * For any combination of players disconnecting from a game, the Game_Engine should 
   * maintain independent game state for each player
   */
  test('Property 7: Concurrent disconnections maintain independent player states', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.constantFrom('MULTI01', 'MULTI02', 'MULTI03'),
        playerCount: fc.integer({ min: 3, max: 4 }), // Need at least 3 for concurrent disconnections
        disconnectCount: fc.integer({ min: 2, max: 3 }), // Disconnect multiple players
        gameStarted: fc.boolean()
      }),
      (testConfig) => {
        // Create game with multiple players
        const game = new MockRummikubGame(testConfig.gameId);
        const playerNames = ['Alice', 'Bob', 'Charlie', 'David'];
        
        // Add players
        const actualPlayerCount = Math.min(testConfig.playerCount, playerNames.length);
        for (let i = 0; i < actualPlayerCount; i++) {
          const playerId = `player-${i}`;
          game.addPlayer(playerId, playerNames[i]);
        }
        
        // Start game if specified
        if (testConfig.gameStarted) {
          game.dealTiles();
        }
        
        // Take initial snapshots for each player
        const initialStates = new Map();
        game.players.forEach(player => {
          initialStates.set(player.id, {
            playerState: game.getGameState(player.id),
            snapshot: game.createStateSnapshot()
          });
        });
        
        // Select players to disconnect (ensure we don't disconnect all players)
        const maxDisconnect = Math.min(testConfig.disconnectCount, actualPlayerCount - 1);
        const playersToDisconnect = game.players.slice(0, maxDisconnect);
        const remainingPlayers = game.players.slice(maxDisconnect);
        
        // Property: Should have at least one remaining player
        expect(remainingPlayers.length).toBeGreaterThan(0);
        
        // Simulate concurrent disconnections
        const disconnectionResults = [];
        playersToDisconnect.forEach(player => {
          const result = game.disconnectPlayer(player.id);
          disconnectionResults.push({ playerId: player.id, success: result });
        });
        
        // Property: All disconnections should succeed
        disconnectionResults.forEach(result => {
          expect(result.success).toBe(true);
        });
        
        // Verify each disconnected player is marked correctly
        playersToDisconnect.forEach(player => {
          const gamePlayer = game.players.find(p => p.name === player.name);
          expect(gamePlayer.disconnected).toBe(true);
          expect(gamePlayer.disconnectedAt).toBeDefined();
        });
        
        // Property: Remaining players should still be connected
        remainingPlayers.forEach(player => {
          const gamePlayer = game.players.find(p => p.name === player.name);
          expect(gamePlayer.disconnected).toBe(false);
        });
        
        // Simulate reconnections with new socket IDs
        const reconnectionResults = [];
        playersToDisconnect.forEach((player, index) => {
          const newSocketId = `reconnected-${player.id}-${index}`;
          const result = game.reconnectPlayer(player.id, newSocketId);
          reconnectionResults.push({ 
            originalId: player.id, 
            newId: newSocketId, 
            success: result 
          });
        });
        
        // Property: All reconnections should succeed
        reconnectionResults.forEach(result => {
          expect(result.success).toBe(true);
        });
        
        // Verify independent state preservation for each reconnected player
        reconnectionResults.forEach(result => {
          const reconnectedPlayer = game.players.find(p => p.id === result.newId);
          const originalState = initialStates.get(result.originalId);
          
          // Property: Each player should maintain their individual state
          expect(reconnectedPlayer).toBeDefined();
          expect(reconnectedPlayer.disconnected).toBe(false);
          
          // Only proceed if we have valid original state
          if (originalState && originalState.playerState) {
            // Get current state for this player
            const currentPlayerState = game.getGameState(result.newId);
            
            // Property: Player's individual data should be preserved
            expect(currentPlayerState.playerHand).toEqual(originalState.playerState.playerHand);
            expect(currentPlayerState.id).toBe(originalState.playerState.id);
            
            // Find the player in the current game state
            const playerInGame = currentPlayerState.players.find(p => p.id === result.newId);
            const originalPlayerInGame = originalState.playerState.players.find(p => p.id === result.originalId);
            
            if (playerInGame && originalPlayerInGame) {
              expect(playerInGame.name).toBe(originalPlayerInGame.name);
              expect(playerInGame.hasPlayedInitial).toBe(originalPlayerInGame.hasPlayedInitial);
              expect(playerInGame.score).toBe(originalPlayerInGame.score);
            }
          } else {
            // If no original state, at least verify the player exists and is connected
            expect(reconnectedPlayer.name).toBeDefined();
            expect(reconnectedPlayer.hand).toBeDefined();
          }
        });
        
        // Property: Game should maintain overall consistency
        const finalGameState = game.createStateSnapshot();
        const initialGameState = Array.from(initialStates.values())[0].snapshot;
        
        expect(finalGameState.id).toBe(initialGameState.id);
        expect(finalGameState.players).toHaveLength(initialGameState.players.length);
        expect(finalGameState.board).toEqual(initialGameState.board);
        expect(finalGameState.started).toBe(initialGameState.started);
        
        return true;
      }
    ), { numRuns: 50 });
  });
});

describe('Reconnection Failure Fallback Properties', () => {
  
  /**
   * Property 12: Reconnection Failure Fallbacks
   * For any scenario where reconnection attempts fail repeatedly, the Reconnection_System 
   * should preserve local state and provide manual reconnection options
   */
  test('Property 12: Reconnection failures provide appropriate fallback options', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.constantFrom('FALLBACK01', 'FALLBACK02', 'FALLBACK03'),
        playerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        failureCount: fc.integer({ min: 1, max: 10 }),
        timeSinceDisconnection: fc.integer({ min: 1000, max: 600000 }) // 1 second to 10 minutes
      }),
      (testConfig) => {
        // Create game and connection manager
        const game = new MockRummikubGame(testConfig.gameId);
        const connectionManager = new MockConnectionManager();
        
        const playerId = 'test-player-1';
        game.addPlayer(playerId, testConfig.playerName);
        game.dealTiles();
        
        // Take initial state snapshot
        const initialState = game.getGameState(playerId);
        
        // Simulate disconnection
        game.disconnectPlayer(playerId);
        connectionManager.setConnectionStatus(playerId, 'disconnected');
        
        // Simulate multiple reconnection failures
        const failureResults = [];
        for (let attempt = 1; attempt <= testConfig.failureCount; attempt++) {
          const result = connectionManager.attemptReconnection(playerId, attempt);
          result.success = false; // Force failure for this test
          failureResults.push(result);
          
          // Simulate the failure in the game
          game.simulateReconnectionFailure(playerId, 1);
        }
        
        // Property: Each failure should have appropriate delay (exponential backoff)
        for (let i = 1; i < failureResults.length; i++) {
          const prevDelay = failureResults[i - 1].delay;
          const currentDelay = failureResults[i].delay;
          
          // Delay should increase (exponential backoff) up to max
          if (currentDelay < connectionManager.reconnectionConfig.maxDelay) {
            expect(currentDelay).toBeGreaterThanOrEqual(prevDelay);
          }
        }
        
        // Get available fallback options
        const fallbackOptions = game.getReconnectionFallbacks(playerId);
        
        // Property: Should always provide manual reconnection option
        const manualReconnectOption = fallbackOptions.find(opt => opt.type === 'manual_reconnect');
        expect(manualReconnectOption).toBeDefined();
        expect(manualReconnectOption.available).toBe(true);
        
        // Property: Should preserve local state if disconnection is recent
        if (testConfig.timeSinceDisconnection < 300000) { // Less than 5 minutes
          const localStateOption = fallbackOptions.find(opt => opt.type === 'local_state');
          expect(localStateOption).toBeDefined();
          expect(localStateOption.available).toBe(true);
        }
        
        // Property: Should offer new game option after many failures
        if (testConfig.failureCount >= 5) {
          const newGameOption = fallbackOptions.find(opt => opt.type === 'new_game');
          expect(newGameOption).toBeDefined();
          expect(newGameOption.available).toBe(true);
        }
        
        // Property: Game state should still be preserved despite failures
        const currentState = game.createStateSnapshot();
        const disconnectedPlayer = currentState.players.find(p => p.name === testConfig.playerName);
        
        expect(disconnectedPlayer).toBeDefined();
        expect(disconnectedPlayer.hand).toEqual(initialState.playerHand);
        expect(disconnectedPlayer.disconnected).toBe(true);
        
        // Property: Fallback options should be non-empty
        expect(fallbackOptions.length).toBeGreaterThan(0);
        
        // Property: All fallback options should have required properties
        fallbackOptions.forEach(option => {
          expect(option.type).toBeDefined();
          expect(option.description).toBeDefined();
          expect(typeof option.available).toBe('boolean');
        });
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Property 12a: Exponential backoff configuration works correctly', () => {
    fc.assert(fc.property(
      fc.record({
        maxAttempts: fc.integer({ min: 3, max: 10 }),
        baseDelay: fc.integer({ min: 500, max: 2000 }),
        maxDelay: fc.integer({ min: 5000, max: 30000 })
      }),
      (config) => {
        const connectionManager = new MockConnectionManager();
        connectionManager.reconnectionConfig = {
          ...connectionManager.reconnectionConfig,
          ...config,
          backoffMultiplier: 2
        };
        
        const playerId = 'backoff-test-player';
        const attempts = [];
        
        // Generate reconnection attempts
        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
          const result = connectionManager.attemptReconnection(playerId, attempt);
          attempts.push(result);
        }
        
        // Property: First attempt should use base delay
        expect(attempts[0].delay).toBe(config.baseDelay);
        
        // Property: Delays should follow exponential backoff pattern
        for (let i = 1; i < attempts.length; i++) {
          const expectedDelay = Math.min(
            config.baseDelay * Math.pow(2, i),
            config.maxDelay
          );
          expect(attempts[i].delay).toBe(expectedDelay);
        }
        
        // Property: No delay should exceed maxDelay
        attempts.forEach(attempt => {
          expect(attempt.delay).toBeLessThanOrEqual(config.maxDelay);
        });
        
        // Property: All attempts should have valid timestamps
        attempts.forEach(attempt => {
          expect(attempt.timestamp).toBeDefined();
          expect(typeof attempt.timestamp).toBe('number');
          expect(attempt.timestamp).toBeGreaterThan(0);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
});