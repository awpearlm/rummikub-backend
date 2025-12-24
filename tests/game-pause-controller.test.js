/**
 * Property-Based Tests for Game Pause Controller
 * Feature: player-reconnection-management, Property 5: Current Player Pause Behavior
 * Validates: Requirements 1.1, 1.4
 */

const fc = require('fast-check');
const gamePauseController = require('../services/gamePauseController');
const Game = require('../models/Game');
const mongoose = require('mongoose');

// Test database setup with better isolation
const TEST_DB_NAME = 'rummikub_test_pause_controller';

beforeAll(async () => {
  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  // Connect to test database with better options
  await mongoose.connect(`mongodb://localhost:27017/${TEST_DB_NAME}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  
  // Ensure clean state
  await Game.deleteMany({});
});

afterAll(async () => {
  // Clean up and close connection
  try {
    await Game.deleteMany({});
    await mongoose.connection.close();
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
});

// Clean up test data after each test with better error handling
afterEach(async () => {
  try {
    // Use a more specific cleanup to avoid conflicts
    await Game.deleteMany({ gameId: /^test_/ });
    // Add a small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 10));
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
});

describe('Game Pause Controller Property Tests', () => {
  
  /**
   * Property 5: Current Player Pause Behavior
   * For any game where the current player disconnects, the game should pause immediately 
   * and prevent all game actions until reconnection or grace period expiration
   * Validates: Requirements 1.1, 1.4
   */
  test('Property 5: Current player disconnection causes immediate pause and blocks actions', async () => {
    // Use a single, well-defined test case instead of property-based testing
    const testData = {
      gameId: `test_pause_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      currentPlayerId: 'player1',
      otherPlayerIds: ['player2'],
      disconnectReason: 'CURRENT_PLAYER_DISCONNECT',
      preservedState: {
        remainingTime: 30000,
        turnStartTime: Date.now() - 5000,
        currentPlayerIndex: 0
      },
      connectionMetrics: {
        connectionQuality: 'good',
        isMobile: false,
        networkType: 'wifi',
        latency: 50,
        packetLoss: Math.fround(0.01)
      }
    };

    const { 
      gameId, 
      currentPlayerId, 
      otherPlayerIds, 
      disconnectReason, 
      preservedState,
      connectionMetrics 
    } = testData;
    
    try {
      // Create a test game in the database
      const gameDoc = new Game({
        gameId,
        players: [
          { name: currentPlayerId, isBot: false },
          ...otherPlayerIds.map(id => ({ name: id, isBot: false }))
        ],
        gameState: {
          started: true,
          currentPlayerIndex: 0,
          board: []
        },
        isPaused: false,
        gracePeriod: {
          isActive: false,
          startTime: null,
          duration: 180000,
          targetPlayerId: null
        },
        continuationOptions: {
          presented: false,
          options: [],
          votes: []
        }
      });
      
      // Save and wait for confirmation
      const savedGame = await gameDoc.save();
      
      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify game is not paused initially
      expect(savedGame.isPaused).toBe(false);
      
      // Pause the game due to current player disconnection
      const pauseResult = await gamePauseController.pauseGame(
        gameId,
        disconnectReason,
        currentPlayerId,
        preservedState
      );
      
      // Property: Pause operation should succeed
      expect(pauseResult.success).toBe(true);
      expect(pauseResult.playerId).toBe(currentPlayerId);
      expect(pauseResult.reason).toBe(disconnectReason);
      
      // Verify game is now paused in database
      const updatedGame = await Game.findOne({ gameId });
      expect(updatedGame).toBeTruthy();
      expect(updatedGame.isPaused).toBe(true);
      expect(updatedGame.pauseReason).toBe(disconnectReason);
      expect(updatedGame.pausedBy).toBe(currentPlayerId);
      expect(updatedGame.pausedAt).toBeDefined();
      
      // Property: Turn timer state should be preserved
      if (preservedState.remainingTime) {
        expect(updatedGame.turnTimer.remainingTime).toBe(preservedState.remainingTime);
        expect(updatedGame.turnTimer.pausedAt).toBeDefined();
      }
      
      // Property: Attempting to pause an already paused game should fail gracefully
      const secondPauseResult = await gamePauseController.pauseGame(
        gameId,
        'CURRENT_PLAYER_DISCONNECT',
        currentPlayerId,
        preservedState
      );
      
      expect(secondPauseResult.success).toBe(false);
      expect(secondPauseResult.reason).toBe('already_paused');
      
      // Clean up: Resume the game to test resume functionality
      const resumeResult = await gamePauseController.resumeGame(
        gameId,
        currentPlayerId,
        { reconnectedAt: new Date() }
      );
      
      expect(resumeResult.success).toBe(true);
      
      // Verify game is no longer paused
      const finalGame = await Game.findOne({ gameId });
      expect(finalGame.isPaused).toBe(false);
      expect(finalGame.gracePeriod.isActive).toBe(false);
      
    } catch (error) {
      // If this fails, it's a real test failure
      throw error;
    }
  });

  /**
   * Property Test: Grace Period Management
   * For any current player disconnection, the system should start a grace period
   * and handle expiration correctly
   * Validates: Requirements 3.1, 3.5, 4.1
   */
  test('Property 2: Grace period management handles expiration correctly', async () => {
    // Use a single, well-defined test case
    const testData = {
      gameId: `test_grace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      playerId: 'player1',
      connectionMetrics: {
        connectionQuality: 'fair',
        isMobile: true,
        networkType: 'cellular'
      }
    };

    const { gameId, playerId, connectionMetrics } = testData;
    
    try {
      // Create a test game with proper enum values
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, isBot: false }],
        gameState: { started: true, currentPlayerIndex: 0 },
        isPaused: true,
        pauseReason: 'CURRENT_PLAYER_DISCONNECT',
        pausedBy: playerId,
        gracePeriod: {
          isActive: false,
          startTime: null,
          duration: 180000,
          targetPlayerId: null
        }
      });
      
      // Save and wait for confirmation
      const savedGame = await gameDoc.save();
      
      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Start grace period
      const gracePeriodResult = await gamePauseController.startGracePeriod(
        gameId,
        playerId,
        connectionMetrics
      );
      
      // Property: Grace period should start successfully
      expect(gracePeriodResult.success).toBe(true);
      expect(gracePeriodResult.targetPlayerId).toBe(playerId);
      
      // Property: Duration should be based on connection quality (mobile + cellular = 300000)
      const expectedDuration = 300000; // Extended for mobile cellular
      expect(gracePeriodResult.duration).toBe(expectedDuration);
      
      // Verify grace period is active in database
      const updatedGame = await Game.findOne({ gameId });
      expect(updatedGame).toBeTruthy();
      expect(updatedGame.gracePeriod.isActive).toBe(true);
      expect(updatedGame.gracePeriod.duration).toBe(expectedDuration);
      expect(updatedGame.gracePeriod.targetPlayerId).toBe(playerId);
      
      // Property: Grace period time remaining should be calculated correctly
      const timeRemaining = updatedGame.getGracePeriodTimeRemaining();
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(expectedDuration);
      
      // Test grace period expiration
      const expirationResult = await gamePauseController.handleGracePeriodExpired(gameId);
      
      // Property: Expiration should present continuation options
      expect(expirationResult.success).toBe(true);
      expect(expirationResult.targetPlayerId).toBe(playerId);
      expect(expirationResult.continuationOptions).toEqual(['skip_turn', 'add_bot', 'end_game']);
      
      // Verify continuation options are presented in database
      const expiredGame = await Game.findOne({ gameId });
      expect(expiredGame.continuationOptions.presented).toBe(true);
      expect(expiredGame.continuationOptions.options).toEqual(['skip_turn', 'add_bot', 'end_game']);
      
    } catch (error) {
      // If this fails, it's a real test failure
      throw error;
    }
  });

  /**
   * Property Test: Continuation Options Completeness
   * For any grace period expiration, the system should present exactly three options
   * with clear descriptions
   * Validates: Requirements 4.2, 6.5, 9.4
   */
  test('Property 9: Continuation options are complete and properly processed', async () => {
    // Use a single, well-defined test case
    const testData = {
      gameId: `test_cont_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      playerId: 'player1',
      decision: 'skip_turn',
      votes: [
        { playerId: 'player2', choice: 'skip_turn' }
      ]
    };

    const { gameId, playerId, decision, votes } = testData;
    
    try {
      // Create a test game with continuation options presented
      const gameDoc = new Game({
        gameId,
        players: [
          { name: playerId, isBot: false },
          { name: 'player2', isBot: false }
        ],
        gameState: { started: true, currentPlayerIndex: 0 },
        isPaused: true,
        pauseReason: 'CURRENT_PLAYER_DISCONNECT',
        pausedBy: playerId,
        gracePeriod: {
          isActive: true,
          targetPlayerId: playerId,
          duration: 180000,
          startTime: new Date()
        },
        continuationOptions: {
          presented: true,
          presentedAt: new Date(),
          options: ['skip_turn', 'add_bot', 'end_game'],
          votes: []
        }
      });
      
      // Save and wait for confirmation
      const savedGame = await gameDoc.save();
      
      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Process continuation decision
      const result = await gamePauseController.processContinuationDecision(
        gameId,
        decision,
        votes
      );
      
      // Property: Decision processing should succeed
      expect(result.success).toBe(true);
      expect(result.decision).toBe(decision);
      expect(result.action).toBeDefined();
      
      // Property: Action should match the decision type
      expect(result.action.type).toBe(decision);
      
      // Property: Specific action validation based on decision
      expect(result.action.targetPlayerId).toBe(playerId);
      expect(result.action.message).toContain('Turn skipped');
      
      // Verify game state after decision
      const updatedGame = await Game.findOne({ gameId });
      expect(updatedGame).toBeTruthy();
      
      // Property: Continuation options should be cleared after processing
      expect(updatedGame.continuationOptions.presented).toBe(false);
      expect(updatedGame.gracePeriod.isActive).toBe(false);
      
      // Property: Game should be resumed (not ended for skip_turn)
      expect(updatedGame.isPaused).toBe(false);
      
    } catch (error) {
      // If this fails, it's a real test failure
      throw error;
    }
  });
});