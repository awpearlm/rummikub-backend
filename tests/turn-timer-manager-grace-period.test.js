/**
 * Turn Timer Manager Grace Period Tests
 * Property-based tests for timer behavior during grace periods
 * Feature: player-reconnection-management
 */

const fc = require('fast-check');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const turnTimerManager = require('../services/turnTimerManager');

// Test database setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rummikub_test';

describe('Turn Timer Manager Grace Period Tests', () => {
  let testGameCounter = 0;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await Game.deleteMany({ gameId: /^test-grace-/ });
    
    // Clear timer manager state
    turnTimerManager.shutdown();
  });

  afterEach(async () => {
    // Clean up test data
    await Game.deleteMany({ gameId: /^test-grace-/ });
  });

  /**
   * Property 15: Timer Behavior During Grace Period
   * Feature: player-reconnection-management, Property 15: Timer Behavior During Grace Period
   * Validates: Requirements 5.3
   */
  describe('Property 15: Timer Behavior During Grace Period', () => {
    test('should keep timer paused during entire grace period countdown', async () => {
      await fc.assert(fc.asyncProperty(
        // Generate test data with unique gameId
        fc.record({
          gameId: fc.integer({ min: 1, max: 999999 }).map(n => `test-grace-timer-${n}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`),
          playerId: fc.string({ minLength: 3, maxLength: 20 }),
          remainingTime: fc.integer({ min: 10000, max: 120000 }), // 10s to 2min
          gracePeriodDuration: fc.integer({ min: 30000, max: 180000 }), // 30s to 3min
          originalDuration: fc.integer({ min: 60000, max: 300000 }) // 1min to 5min
        }),
        
        async (testData) => {
          const { gameId, playerId, remainingTime, gracePeriodDuration, originalDuration } = testData;
          
          // Create test game with grace period active
          const gameDoc = new Game({
            gameId,
            players: [{ name: playerId, score: 0 }],
            gameState: { currentPlayerIndex: 0, started: true },
            isPaused: true,
            gracePeriod: {
              isActive: true,
              startTime: new Date(),
              duration: gracePeriodDuration,
              targetPlayerId: playerId
            },
            turnTimer: {
              remainingTime: remainingTime,
              originalDuration,
              pausedAt: new Date()
            }
          });
          await gameDoc.save();

          // Start with active timer, then pause for grace period
          await turnTimerManager.restoreTimer(gameId, playerId, remainingTime);
          
          // Property: Pause timer for grace period
          const pauseResult = await turnTimerManager.pauseTimerForGracePeriod(
            gameId, 
            gracePeriodDuration
          );

          expect(pauseResult.success).toBe(true);
          expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);
          expect(turnTimerManager.isTimerActive(gameId)).toBe(false);

          // Property: Timer should remain paused during grace period
          const shouldRemainPaused = await turnTimerManager.shouldTimerRemainPaused(gameId);
          expect(shouldRemainPaused).toBe(true);

          // Property: Grace period timer status should reflect paused state
          const gracePeriodStatus = await turnTimerManager.getGracePeriodTimerStatus(gameId);
          expect(gracePeriodStatus).not.toBeNull();
          expect(gracePeriodStatus.gracePeriodActive).toBe(true);
          expect(gracePeriodStatus.timerPaused).toBe(true);
          expect(gracePeriodStatus.timerPreserved).toBe(true);
          expect(gracePeriodStatus.timerActive).toBe(false);

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 50 }); // Reduced runs for faster testing
    });

    test('should handle grace period expiration with different continuation decisions', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          gameId: fc.integer({ min: 1, max: 999999 }).map(n => `test-grace-expiry-${n}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`),
          playerId: fc.string({ minLength: 3, maxLength: 20 }),
          remainingTime: fc.integer({ min: 5000, max: 60000 }), // 5s to 1min
          continuationDecision: fc.oneof(
            fc.constant('skip_turn'),
            fc.constant('add_bot'),
            fc.constant('end_game')
          ),
          originalDuration: fc.integer({ min: 60000, max: 180000 })
        }),
        
        async (testData) => {
          const { gameId, playerId, remainingTime, continuationDecision, originalDuration } = testData;
          
          // Create test game with multiple players for turn skipping
          const gameDoc = new Game({
            gameId,
            players: [
              { name: playerId, score: 0 },
              { name: 'player2', score: 0 },
              { name: 'player3', score: 0 }
            ],
            gameState: { currentPlayerIndex: 0, started: true },
            isPaused: true,
            gracePeriod: {
              isActive: true,
              startTime: new Date(Date.now() - 180000), // Expired grace period
              duration: 180000,
              targetPlayerId: playerId
            },
            turnTimer: {
              remainingTime,
              originalDuration,
              pausedAt: new Date()
            }
          });
          await gameDoc.save();

          // Preserve timer state first
          await turnTimerManager.preserveTimer(gameId, playerId, remainingTime);

          // Property: Handle grace period expiration
          const expirationResult = await turnTimerManager.handleGracePeriodExpiration(
            gameId, 
            continuationDecision
          );

          expect(expirationResult.success).toBe(true);
          expect(expirationResult.decision).toBe(continuationDecision);
          expect(expirationResult.action).toBeDefined();

          // Property: Verify behavior based on continuation decision
          switch (continuationDecision) {
            case 'skip_turn':
              // Timer should be reset for next player
              expect(expirationResult.action.success).toBe(true);
              expect(expirationResult.action.nextPlayerId).toBeDefined();
              expect(turnTimerManager.isTimerActive(gameId)).toBe(true);
              expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);
              break;

            case 'add_bot':
              // Timer should continue for bot
              expect(expirationResult.action.success).toBe(true);
              expect(expirationResult.action.botPlayerId).toBeDefined();
              expect(expirationResult.action.continuedFromPreserved).toBe(true);
              expect(turnTimerManager.isTimerActive(gameId)).toBe(true);
              expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);
              break;

            case 'end_game':
              // All timer state should be cleared
              expect(expirationResult.action.type).toBe('timer_cleared');
              expect(turnTimerManager.isTimerActive(gameId)).toBe(false);
              expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);
              break;
          }

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 50 }); // Reduced runs for faster testing
    });
  });

  /**
   * Unit tests for grace period timer behavior
   */
  describe('Grace Period Timer Behavior Unit Tests', () => {
    test('should handle bot timer continuation correctly', async () => {
      const gameId = `test-bot-timer-${Date.now()}`;
      const playerId = 'disconnected-player';
      const botPlayerId = 'Bot_ABC123';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      await gameDoc.save();

      // Preserve timer state
      await turnTimerManager.preserveTimer(gameId, playerId, 45000);

      // Continue timer for bot
      const botResult = await turnTimerManager.continueTimerForBot(gameId, botPlayerId);

      expect(botResult.success).toBe(true);
      expect(botResult.botPlayerId).toBe(botPlayerId);
      expect(botResult.remainingTime).toBe(45000);
      expect(botResult.continuedFromPreserved).toBe(true);
      expect(turnTimerManager.isTimerActive(gameId)).toBe(true);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should determine timer pause status correctly during grace period', async () => {
      const gameId = `test-pause-status-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game with active grace period
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        isPaused: true,
        gracePeriod: {
          isActive: true,
          startTime: new Date(),
          duration: 180000,
          targetPlayerId: playerId
        },
        turnTimer: { remainingTime: 60000, originalDuration: 120000, pausedAt: new Date() }
      });
      await gameDoc.save();

      // Should remain paused during grace period
      const shouldPause = await turnTimerManager.shouldTimerRemainPaused(gameId);
      expect(shouldPause).toBe(true);

      // End grace period
      gameDoc.isPaused = false;
      gameDoc.gracePeriod.isActive = false;
      await gameDoc.save();

      // Should not remain paused after grace period
      const shouldPauseAfter = await turnTimerManager.shouldTimerRemainPaused(gameId);
      expect(shouldPauseAfter).toBe(false);

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should provide comprehensive grace period timer status', async () => {
      const gameId = `test-grace-status-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game with grace period
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        isPaused: true,
        gracePeriod: {
          isActive: true,
          startTime: new Date(),
          duration: 180000,
          targetPlayerId: playerId
        },
        turnTimer: { remainingTime: 75000, originalDuration: 120000, pausedAt: new Date() }
      });
      await gameDoc.save();

      // Preserve timer
      await turnTimerManager.preserveTimer(gameId, playerId, 75000);

      // Get grace period timer status
      const status = await turnTimerManager.getGracePeriodTimerStatus(gameId);

      expect(status).not.toBeNull();
      expect(status.gameId).toBe(gameId);
      expect(status.gracePeriodActive).toBe(true);
      expect(status.gracePeriodRemaining).toBeGreaterThan(0);
      expect(status.timerPaused).toBe(true);
      expect(status.timerPreserved).toBe(true);
      expect(status.timerActive).toBe(false);
      expect(status.preservedTime).toBe(75000);
      expect(status.targetPlayerId).toBe(playerId);

      // Clean up
      await Game.deleteOne({ gameId });
    });
  });
});