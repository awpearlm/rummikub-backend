/**
 * Backend Integration Test for Player Reconnection Management
 * Task 6: Checkpoint - Core backend functionality complete
 * 
 * This test verifies that all backend components integrate correctly:
 * - Game Pause Controller
 * - Player Connection Manager  
 * - Turn Timer Manager
 * - Reconnection Handler
 * - Enhanced Game Model
 */

const mongoose = require('mongoose');
const Game = require('../models/Game');
const gamePauseController = require('../services/gamePauseController');
const PlayerConnectionManager = require('../services/playerConnectionManager');
const turnTimerManager = require('../services/turnTimerManager');
const reconnectionHandler = require('../services/reconnectionHandler');

// Test database configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rummikub_test';

describe('Backend Integration Tests - Player Reconnection Management', () => {
  let testGameCounter = 0;
  let playerConnectionManager;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
    
    // Initialize player connection manager
    playerConnectionManager = new PlayerConnectionManager();
    
    console.log('🧪 Backend Integration Tests initialized');
  });

  afterAll(async () => {
    // Clean up test data
    await Game.deleteMany({ gameId: /^test-integration-/ });
    
    // Shutdown services
    gamePauseController.shutdown();
    turnTimerManager.shutdown();
    reconnectionHandler.cleanup();
    
    // Close database connection
    await mongoose.connection.close();
    
    console.log('🧹 Backend Integration Tests cleanup complete');
  });

  beforeEach(() => {
    testGameCounter++;
  });

  /**
   * Test 1: Database Schema Integration
   * Verify that the enhanced Game model works correctly with all new fields
   */
  describe('Database Schema Integration', () => {
    test('should create game with all reconnection management fields', async () => {
      const gameId = `test-integration-schema-${testGameCounter}`;
      
      // Create a game with all reconnection management fields
      const gameDoc = new Game({
        gameId,
        players: [
          { name: 'Player1', score: 0, isBot: false },
          { name: 'Player2', score: 0, isBot: false }
        ],
        gameState: {
          currentPlayerIndex: 0,
          board: [],
          started: true
        },
        // Reconnection management fields
        isPaused: false,
        gracePeriod: {
          isActive: false,
          duration: 180000
        },
        turnTimer: {
          remainingTime: 120000,
          originalDuration: 120000
        },
        playerStatuses: [
          {
            playerId: 'Player1',
            status: 'CONNECTED',
            connectionMetrics: {
              latency: 50,
              connectionQuality: 'good',
              isMobile: false,
              networkType: 'wifi'
            }
          },
          {
            playerId: 'Player2', 
            status: 'CONNECTED',
            connectionMetrics: {
              latency: 75,
              connectionQuality: 'good',
              isMobile: true,
              networkType: 'cellular'
            }
          }
        ],
        continuationOptions: {
          presented: false,
          options: [],
          votes: []
        },
        reconnectionEvents: []
      });

      // Save to database
      await gameDoc.save();

      // Verify the game was saved correctly
      const savedGame = await Game.findOne({ gameId });
      expect(savedGame).toBeTruthy();
      expect(savedGame.gameId).toBe(gameId);
      expect(savedGame.players).toHaveLength(2);
      expect(savedGame.playerStatuses).toHaveLength(2);
      expect(savedGame.isPaused).toBe(false);
      expect(savedGame.gracePeriod.isActive).toBe(false);
      expect(savedGame.turnTimer.remainingTime).toBe(120000);
      
      // Test model methods
      expect(savedGame.isCurrentPlayerDisconnected()).toBe(false);
      expect(savedGame.getGracePeriodTimeRemaining()).toBe(0);
      expect(savedGame.isGracePeriodExpired()).toBe(false);
      
      console.log('✅ Database schema integration test passed');
    });

    test('should handle database indexes efficiently', async () => {
      const gameId = `test-integration-indexes-${testGameCounter}`;
      
      // Create multiple games for index testing
      const games = [];
      for (let i = 0; i < 5; i++) {
        const game = new Game({
          gameId: `${gameId}-${i}`,
          players: [{ name: `Player${i}`, score: 0 }],
          gameState: { currentPlayerIndex: 0 },
          isPaused: i % 2 === 0, // Alternate paused state
          playerStatuses: [{
            playerId: `Player${i}`,
            status: i < 3 ? 'CONNECTED' : 'DISCONNECTED'
          }]
        });
        games.push(game);
      }
      
      await Game.insertMany(games);
      
      // Test indexed queries
      const startTime = Date.now();
      
      // Query by gameId (indexed)
      const gameById = await Game.findOne({ gameId: `${gameId}-2` });
      expect(gameById).toBeTruthy();
      
      // Query by pause status (indexed)
      const pausedGames = await Game.find({ isPaused: true });
      expect(pausedGames.length).toBeGreaterThanOrEqual(3);
      
      // Query by player status (indexed)
      const connectedPlayers = await Game.find({ 'playerStatuses.status': 'CONNECTED' });
      expect(connectedPlayers.length).toBeGreaterThanOrEqual(3);
      
      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(100); // Should be fast with indexes
      
      console.log(`✅ Database index test passed (${queryTime}ms)`);
    });
  });

  /**
   * Test 2: Component Integration
   * Verify that all services work together correctly
   */
  describe('Component Integration', () => {
    test('should integrate pause controller with timer manager', async () => {
      const gameId = `test-integration-pause-timer-${testGameCounter}`;
      const playerId = 'TestPlayer1';
      
      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0 },
        turnTimer: { remainingTime: 60000, originalDuration: 120000 }
      });
      await gameDoc.save();
      
      // Test timer preservation during pause
      const preserveResult = await turnTimerManager.preserveTimer(
        gameId, 
        playerId, 
        45000, // 45 seconds remaining
        new Date(Date.now() - 75000) // Started 75 seconds ago
      );
      
      expect(preserveResult.success).toBe(true);
      expect(preserveResult.remainingTime).toBeCloseTo(45000, -2); // Within 100ms
      
      // Test game pause with preserved timer
      const pauseResult = await gamePauseController.pauseGame(
        gameId,
        'CURRENT_PLAYER_DISCONNECT',
        playerId,
        { remainingTime: preserveResult.remainingTime }
      );
      
      expect(pauseResult.success).toBe(true);
      
      // Verify integration - game should be paused and timer preserved
      const updatedGame = await Game.findOne({ gameId });
      expect(updatedGame.isPaused).toBe(true);
      expect(updatedGame.pauseReason).toBe('CURRENT_PLAYER_DISCONNECT');
      expect(updatedGame.turnTimer.remainingTime).toBeCloseTo(45000, -2);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);
      
      // Test resume with timer restoration
      const resumeResult = await gamePauseController.resumeGame(gameId, playerId);
      expect(resumeResult.success).toBe(true);
      
      const restoreResult = await turnTimerManager.restoreTimer(gameId, playerId);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.remainingTime).toBeCloseTo(45000, -2);
      
      console.log('✅ Pause controller + timer manager integration test passed');
    });

    test('should integrate connection manager with pause controller', async () => {
      const gameId = `test-integration-connection-pause-${testGameCounter}`;
      const playerId = 'TestPlayer2';
      
      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0 }
      });
      await gameDoc.save();
      
      // Mock socket for connection manager
      const mockSocket = {
        id: 'socket123',
        handshake: { headers: { 'user-agent': 'Mozilla/5.0' } },
        emit: jest.fn(),
        once: jest.fn(),
        off: jest.fn()
      };
      
      // Register connection
      const connectionInfo = playerConnectionManager.registerConnection(
        mockSocket,
        gameId,
        playerId
      );
      
      expect(connectionInfo.playerId).toBe(playerId);
      expect(connectionInfo.status).toBe('CONNECTED');
      
      // Simulate disconnection
      playerConnectionManager.handlePotentialDisconnection(mockSocket, 'network_error');
      
      // Wait for debounced disconnection
      await new Promise(resolve => setTimeout(resolve, 3100));
      
      // Check if player status was updated
      const playerStatus = playerConnectionManager.getPlayerStatus(playerId);
      expect(playerStatus.status).toBe('DISCONNECTED');
      
      // Test that pause controller can access connection info
      const gamePlayersStatus = playerConnectionManager.getGamePlayersStatus(gameId);
      expect(gamePlayersStatus).toHaveLength(1);
      expect(gamePlayersStatus[0].status).toBe('DISCONNECTED');
      
      // Test grace period calculation based on connection metrics
      const gracePeriod = playerConnectionManager.getGracePeriodForPlayer(playerId);
      expect(gracePeriod).toBeGreaterThan(0);
      expect(gracePeriod).toBeLessThanOrEqual(300000); // Max 5 minutes
      
      console.log('✅ Connection manager + pause controller integration test passed');
    });

    test('should integrate reconnection handler with all components', async () => {
      const gameId = `test-integration-reconnection-${testGameCounter}`;
      const playerId = 'TestPlayer3';
      
      // Create test game with paused state
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0 },
        isPaused: true,
        pauseReason: 'CURRENT_PLAYER_DISCONNECT',
        pausedBy: playerId,
        gracePeriod: {
          isActive: true,
          startTime: new Date(),
          duration: 180000,
          targetPlayerId: playerId
        },
        turnTimer: {
          remainingTime: 30000,
          pausedAt: new Date(),
          originalDuration: 120000
        },
        playerStatuses: [{
          playerId,
          status: 'DISCONNECTED',
          disconnectedAt: new Date()
        }]
      });
      await gameDoc.save();
      
      // Preserve timer state
      await turnTimerManager.preserveTimer(gameId, playerId, 30000);
      
      // Test reconnection attempt
      const reconnectionResult = await reconnectionHandler.attemptReconnection(
        playerId,
        gameId,
        { latency: 100, connectionQuality: 'good' }
      );
      
      expect(reconnectionResult.success).toBe(true);
      expect(reconnectionResult.wasGameResumed).toBe(true);
      
      // Verify all components were updated correctly
      const updatedGame = await Game.findOne({ gameId });
      expect(updatedGame.isPaused).toBe(false);
      expect(updatedGame.gracePeriod.isActive).toBe(false);
      
      // Verify timer was restored
      const timerState = await turnTimerManager.getTimerState(gameId);
      expect(timerState).toBeTruthy();
      expect(timerState.isActive).toBe(true);
      
      // Verify player status was updated
      const playerStatus = updatedGame.getPlayerStatus(playerId);
      expect(playerStatus.status).toBe('CONNECTED');
      
      console.log('✅ Reconnection handler integration test passed');
    });
  });

  /**
   * Test 3: End-to-End Flow Testing
   * Test complete disconnect → pause → grace period → reconnection → resume flow
   */
  describe('End-to-End Flow Testing', () => {
    test('should handle complete disconnect-reconnect flow', async () => {
      const gameId = `test-integration-e2e-${testGameCounter}`;
      const playerId = 'E2EPlayer';
      
      // Step 1: Create active game
      const gameDoc = new Game({
        gameId,
        players: [
          { name: playerId, score: 0 },
          { name: 'OtherPlayer', score: 0 }
        ],
        gameState: { currentPlayerIndex: 0 }, // E2EPlayer is current
        turnTimer: { remainingTime: 90000, originalDuration: 120000 }
      });
      await gameDoc.save();
      
      console.log('📝 Step 1: Game created');
      
      // Step 2: Preserve timer and pause game (simulating current player disconnect)
      const preserveResult = await turnTimerManager.preserveTimer(gameId, playerId, 90000);
      expect(preserveResult.success).toBe(true);
      
      const pauseResult = await gamePauseController.pauseGame(
        gameId,
        'CURRENT_PLAYER_DISCONNECT',
        playerId,
        { remainingTime: 90000 }
      );
      expect(pauseResult.success).toBe(true);
      
      console.log('📝 Step 2: Game paused, timer preserved');
      
      // Step 3: Start grace period
      const gracePeriodResult = await gamePauseController.startGracePeriod(
        gameId,
        playerId,
        { connectionQuality: 'good' }
      );
      expect(gracePeriodResult.success).toBe(true);
      
      console.log('📝 Step 3: Grace period started');
      
      // Step 4: Verify paused state
      let currentGame = await Game.findOne({ gameId });
      expect(currentGame.isPaused).toBe(true);
      expect(currentGame.gracePeriod.isActive).toBe(true);
      expect(currentGame.turnTimer.remainingTime).toBe(90000);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);
      
      console.log('📝 Step 4: Paused state verified');
      
      // Step 5: Attempt reconnection
      const reconnectionResult = await reconnectionHandler.attemptReconnection(
        playerId,
        gameId,
        { latency: 75, connectionQuality: 'good' }
      );
      expect(reconnectionResult.success).toBe(true);
      expect(reconnectionResult.wasGameResumed).toBe(true);
      
      console.log('📝 Step 5: Reconnection successful');
      
      // Step 6: Verify resumed state
      currentGame = await Game.findOne({ gameId });
      expect(currentGame.isPaused).toBe(false);
      expect(currentGame.gracePeriod.isActive).toBe(false);
      expect(currentGame.pauseReason).toBeNull();
      
      // Verify timer was restored
      const timerState = await turnTimerManager.getTimerState(gameId);
      expect(timerState.isActive).toBe(true);
      expect(timerState.remainingTime).toBeCloseTo(90000, -2);
      
      // Verify player status
      const playerStatus = currentGame.getPlayerStatus(playerId);
      expect(playerStatus.status).toBe('CONNECTED');
      
      // Verify reconnection events were logged
      expect(currentGame.reconnectionEvents.length).toBeGreaterThan(0);
      const pauseEvent = currentGame.reconnectionEvents.find(e => e.eventType === 'PAUSE');
      const resumeEvent = currentGame.reconnectionEvents.find(e => e.eventType === 'RESUME');
      expect(pauseEvent).toBeTruthy();
      expect(resumeEvent).toBeTruthy();
      
      console.log('✅ Complete end-to-end flow test passed');
    });

    test('should handle grace period expiration with continuation options', async () => {
      const gameId = `test-integration-grace-expiry-${testGameCounter}`;
      const playerId = 'GracePlayer';
      
      // Create paused game with active grace period
      const gameDoc = new Game({
        gameId,
        players: [
          { name: playerId, score: 0 },
          { name: 'OtherPlayer', score: 0 }
        ],
        gameState: { currentPlayerIndex: 0 },
        isPaused: true,
        pauseReason: 'CURRENT_PLAYER_DISCONNECT',
        pausedBy: playerId,
        gracePeriod: {
          isActive: true,
          startTime: new Date(Date.now() - 181000), // Expired 1 second ago
          duration: 180000,
          targetPlayerId: playerId
        },
        turnTimer: {
          remainingTime: 60000,
          pausedAt: new Date(),
          originalDuration: 120000
        }
      });
      await gameDoc.save();
      
      // Handle grace period expiration
      const expirationResult = await gamePauseController.handleGracePeriodExpired(gameId);
      expect(expirationResult.success).toBe(true);
      expect(expirationResult.continuationOptions).toEqual(['skip_turn', 'add_bot', 'end_game']);
      
      // Verify continuation options were presented
      const updatedGame = await Game.findOne({ gameId });
      expect(updatedGame.continuationOptions.presented).toBe(true);
      expect(updatedGame.continuationOptions.options).toEqual(['skip_turn', 'add_bot', 'end_game']);
      
      // Test voting
      const voteResult = await gamePauseController.addContinuationVote(gameId, 'OtherPlayer', 'skip_turn');
      expect(voteResult.success).toBe(true);
      expect(voteResult.decision).toBe('skip_turn');
      
      // Process the decision
      const decisionResult = await gamePauseController.processContinuationDecision(
        gameId,
        'skip_turn',
        [{ playerId: 'OtherPlayer', choice: 'skip_turn' }]
      );
      expect(decisionResult.success).toBe(true);
      expect(decisionResult.decision).toBe('skip_turn');
      
      console.log('✅ Grace period expiration with continuation options test passed');
    });
  });

  /**
   * Test 4: Error Handling and Edge Cases
   * Verify robust error handling across all components
   */
  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid game IDs gracefully', async () => {
      const invalidGameId = 'nonexistent-game-123';
      
      // Test pause controller
      const pauseResult = await gamePauseController.pauseGame(
        invalidGameId,
        'CURRENT_PLAYER_DISCONNECT',
        'TestPlayer'
      );
      expect(pauseResult.success).toBe(false);
      
      // Test timer manager
      const timerResult = await turnTimerManager.preserveTimer(
        invalidGameId,
        'TestPlayer',
        60000
      );
      expect(timerResult.success).toBe(false);
      
      // Test reconnection handler
      const reconnectionResult = await reconnectionHandler.attemptReconnection(
        'TestPlayer',
        invalidGameId
      );
      expect(reconnectionResult.success).toBe(false);
      expect(reconnectionResult.reason).toBe('game_not_found');
      
      console.log('✅ Invalid game ID error handling test passed');
    });

    test('should handle concurrent operations safely', async () => {
      const gameId = `test-integration-concurrent-${testGameCounter}`;
      const playerId = 'ConcurrentPlayer';
      
      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0 },
        turnTimer: { remainingTime: 60000, originalDuration: 120000 }
      });
      await gameDoc.save();
      
      // Test concurrent pause operations
      const pausePromises = [
        gamePauseController.pauseGame(gameId, 'CURRENT_PLAYER_DISCONNECT', playerId),
        gamePauseController.pauseGame(gameId, 'NETWORK_INSTABILITY', playerId),
        gamePauseController.pauseGame(gameId, 'CURRENT_PLAYER_DISCONNECT', playerId)
      ];
      
      const pauseResults = await Promise.allSettled(pausePromises);
      
      // Only one should succeed, others should fail gracefully
      const successfulPauses = pauseResults.filter(r => 
        r.status === 'fulfilled' && r.value.success
      );
      expect(successfulPauses.length).toBe(1);
      
      // Verify game is in consistent state
      const finalGame = await Game.findOne({ gameId });
      expect(finalGame.isPaused).toBe(true);
      expect(finalGame.pauseReason).toBeTruthy();
      
      console.log('✅ Concurrent operations safety test passed');
    });

    test('should handle database connection issues', async () => {
      // Temporarily close database connection
      await mongoose.connection.close();
      
      const gameId = `test-integration-db-error-${testGameCounter}`;
      
      // Test operations with closed database
      try {
        await gamePauseController.pauseGame(gameId, 'CURRENT_PLAYER_DISCONNECT', 'TestPlayer');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('failed');
      }
      
      // Reconnect database
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      console.log('✅ Database connection error handling test passed');
    });
  });

  /**
   * Test 5: Performance and Resource Management
   * Verify that components manage resources efficiently
   */
  describe('Performance and Resource Management', () => {
    test('should manage memory efficiently with multiple games', async () => {
      const baseGameId = `test-integration-memory-${testGameCounter}`;
      const gameCount = 10;
      
      // Create multiple games
      const games = [];
      for (let i = 0; i < gameCount; i++) {
        const gameId = `${baseGameId}-${i}`;
        const game = new Game({
          gameId,
          players: [{ name: `Player${i}`, score: 0 }],
          gameState: { currentPlayerIndex: 0 }
        });
        games.push(game);
      }
      
      await Game.insertMany(games);
      
      // Perform operations on all games
      const operations = [];
      for (let i = 0; i < gameCount; i++) {
        const gameId = `${baseGameId}-${i}`;
        operations.push(
          turnTimerManager.preserveTimer(gameId, `Player${i}`, 60000),
          gamePauseController.pauseGame(gameId, 'CURRENT_PLAYER_DISCONNECT', `Player${i}`)
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const operationTime = Date.now() - startTime;
      
      // Verify operations completed in reasonable time
      expect(operationTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify successful operations
      const successfulOps = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      );
      expect(successfulOps.length).toBeGreaterThan(gameCount); // At least one operation per game
      
      // Check memory usage
      const timerStats = turnTimerManager.getTimerStatistics();
      expect(timerStats.preservedTimers).toBe(gameCount);
      
      // Clean up
      for (let i = 0; i < gameCount; i++) {
        const gameId = `${baseGameId}-${i}`;
        turnTimerManager.clearAllTimerState(gameId);
      }
      
      console.log(`✅ Memory efficiency test passed (${operationTime}ms for ${gameCount} games)`);
    });

    test('should clean up resources properly', async () => {
      const gameId = `test-integration-cleanup-${testGameCounter}`;
      
      // Create game and perform operations
      const gameDoc = new Game({
        gameId,
        players: [{ name: 'CleanupPlayer', score: 0 }],
        gameState: { currentPlayerIndex: 0 }
      });
      await gameDoc.save();
      
      // Create timer state
      await turnTimerManager.preserveTimer(gameId, 'CleanupPlayer', 60000);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);
      
      // Create pause state
      await gamePauseController.pauseGame(gameId, 'CURRENT_PLAYER_DISCONNECT', 'CleanupPlayer');
      
      // Test cleanup
      turnTimerManager.clearAllTimerState(gameId);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);
      expect(turnTimerManager.isTimerActive(gameId)).toBe(false);
      
      // Test service shutdown
      const initialStats = turnTimerManager.getTimerStatistics();
      turnTimerManager.shutdown();
      
      // Verify cleanup
      const finalStats = turnTimerManager.getTimerStatistics();
      expect(finalStats.activeTimers).toBe(0);
      expect(finalStats.preservedTimers).toBe(0);
      
      console.log('✅ Resource cleanup test passed');
    });
  });
});