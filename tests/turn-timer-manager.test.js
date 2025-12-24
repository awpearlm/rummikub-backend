/**
 * Turn Timer Manager Tests
 * Property-based tests for timer preservation and restoration
 * Feature: player-reconnection-management
 */

const fc = require('fast-check');
const mongoose = require('mongoose');
const Game = require('../models/Game');
const turnTimerManager = require('../services/turnTimerManager');

// Test database setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rummikub_test';

describe('Turn Timer Manager', () => {
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
    await Game.deleteMany({ gameId: /^test-timer-/ });
    
    // Clear timer manager state
    turnTimerManager.shutdown();
  });

  afterEach(async () => {
    // Clean up test data
    await Game.deleteMany({ gameId: /^test-timer-/ });
  });

  /**
   * Property 1: Timer Preservation and Restoration
   * Feature: player-reconnection-management, Property 1: Timer Preservation and Restoration
   * Validates: Requirements 1.2, 5.1, 5.2
   */
  describe('Property 1: Timer Preservation and Restoration', () => {
    test('should preserve and restore timer state exactly across pause/resume cycles', async () => {
      await fc.assert(fc.asyncProperty(
        // Generate test data
        fc.record({
          gameId: fc.constant(`test-timer-${++testGameCounter}-${Date.now()}`),
          playerId: fc.string({ minLength: 3, maxLength: 20 }),
          remainingTime: fc.integer({ min: 1000, max: 300000 }), // 1s to 5min
          originalDuration: fc.integer({ min: 30000, max: 600000 }), // 30s to 10min
          turnStartTime: fc.date({ min: new Date(Date.now() - 300000), max: new Date() })
        }),
        
        async (testData) => {
          const { gameId, playerId, remainingTime, originalDuration, turnStartTime } = testData;
          
          // Create test game
          const gameDoc = new Game({
            gameId,
            players: [{ name: playerId, score: 0 }],
            gameState: { currentPlayerIndex: 0, started: true },
            turnTimer: {
              remainingTime: null,
              originalDuration,
              pausedAt: null
            }
          });
          await gameDoc.save();

          // Property: Preserve timer state
          const preserveResult = await turnTimerManager.preserveTimer(
            gameId, 
            playerId, 
            remainingTime, 
            turnStartTime
          );

          // Verify preservation was successful
          expect(preserveResult.success).toBe(true);
          expect(preserveResult.gameId).toBe(gameId);
          expect(preserveResult.playerId).toBe(playerId);
          expect(typeof preserveResult.remainingTime).toBe('number');
          expect(preserveResult.remainingTime).toBeGreaterThanOrEqual(0);

          // Verify timer is marked as preserved
          expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);
          expect(turnTimerManager.isTimerActive(gameId)).toBe(false);

          // Get preserved state
          const preservedState = turnTimerManager.getPreservedTimerState(gameId);
          expect(preservedState).not.toBeNull();
          expect(preservedState.gameId).toBe(gameId);
          expect(preservedState.playerId).toBe(playerId);

          // Verify database state matches preserved state
          const updatedGame = await Game.findOne({ gameId });
          expect(updatedGame.turnTimer.remainingTime).toBe(preservedState.remainingTime);
          expect(updatedGame.turnTimer.pausedAt).toBeDefined();

          // Property: Restore timer state with exact preserved time
          const restoreResult = await turnTimerManager.restoreTimer(gameId, playerId);

          // Verify restoration was successful
          expect(restoreResult.success).toBe(true);
          expect(restoreResult.gameId).toBe(gameId);
          expect(restoreResult.playerId).toBe(playerId);
          expect(restoreResult.remainingTime).toBe(preservedState.remainingTime);
          expect(restoreResult.isActive).toBe(true);

          // Verify timer is now active and not preserved
          expect(turnTimerManager.isTimerActive(gameId)).toBe(true);
          expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);

          // Verify database state is updated
          const restoredGame = await Game.findOne({ gameId });
          expect(restoredGame.turnTimer.remainingTime).toBe(preservedState.remainingTime);
          expect(restoredGame.turnTimer.pausedAt).toBeNull();

          // Property: Round-trip preservation should maintain exact time
          // (within reasonable precision bounds)
          const timeDifference = Math.abs(restoreResult.remainingTime - remainingTime);
          const maxAcceptableDifference = 1000; // 1 second tolerance for processing time
          expect(timeDifference).toBeLessThanOrEqual(maxAcceptableDifference);

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 100 });
    });

    test('should handle timer preservation with precise timing calculations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          gameId: fc.constant(`test-timer-precise-${++testGameCounter}-${Date.now()}`),
          playerId: fc.string({ minLength: 3, maxLength: 20 }),
          originalDuration: fc.integer({ min: 60000, max: 300000 }), // 1-5 minutes
          elapsedTime: fc.integer({ min: 1000, max: 60000 }) // 1s to 1min elapsed
        }),
        
        async (testData) => {
          const { gameId, playerId, originalDuration, elapsedTime } = testData;
          
          // Create test game
          const gameDoc = new Game({
            gameId,
            players: [{ name: playerId, score: 0 }],
            gameState: { currentPlayerIndex: 0, started: true },
            turnTimer: {
              remainingTime: null,
              originalDuration,
              pausedAt: null
            }
          });
          await gameDoc.save();

          // Simulate turn start time in the past
          const turnStartTime = new Date(Date.now() - elapsedTime);
          const expectedRemainingTime = Math.max(0, originalDuration - elapsedTime);

          // Property: Preserve timer with precise calculation
          const preserveResult = await turnTimerManager.preserveTimer(
            gameId, 
            playerId, 
            originalDuration, // Pass original duration as remaining time
            turnStartTime
          );

          // Verify precise calculation
          expect(preserveResult.success).toBe(true);
          const calculatedRemaining = preserveResult.remainingTime;
          const timeDifference = Math.abs(calculatedRemaining - expectedRemainingTime);
          
          // Should be within 100ms of expected (accounting for processing time)
          expect(timeDifference).toBeLessThanOrEqual(100);

          // Property: Restored time should match preserved time exactly
          const restoreResult = await turnTimerManager.restoreTimer(gameId, playerId);
          expect(restoreResult.remainingTime).toBe(calculatedRemaining);

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 100 });
    });

    test('should handle edge cases in timer preservation', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          gameId: fc.constant(`test-timer-edge-${++testGameCounter}-${Date.now()}`),
          playerId: fc.string({ minLength: 3, maxLength: 20 }),
          remainingTime: fc.oneof(
            fc.constant(0), // Expired timer
            fc.integer({ min: 1, max: 1000 }), // Very short time
            fc.integer({ min: 300000, max: 600000 }) // Long time
          ),
          originalDuration: fc.integer({ min: 30000, max: 600000 })
        }),
        
        async (testData) => {
          const { gameId, playerId, remainingTime, originalDuration } = testData;
          
          // Create test game
          const gameDoc = new Game({
            gameId,
            players: [{ name: playerId, score: 0 }],
            gameState: { currentPlayerIndex: 0, started: true },
            turnTimer: {
              remainingTime: null,
              originalDuration,
              pausedAt: null
            }
          });
          await gameDoc.save();

          // Property: Should handle all valid remaining times
          const preserveResult = await turnTimerManager.preserveTimer(
            gameId, 
            playerId, 
            remainingTime
          );

          expect(preserveResult.success).toBe(true);
          expect(preserveResult.remainingTime).toBeGreaterThanOrEqual(0);
          expect(preserveResult.remainingTime).toBeLessThanOrEqual(originalDuration);

          // Property: Should restore even edge case times correctly
          const restoreResult = await turnTimerManager.restoreTimer(gameId, playerId);
          expect(restoreResult.success).toBe(true);
          expect(restoreResult.remainingTime).toBe(preserveResult.remainingTime);

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Unit tests for specific scenarios and error conditions
   */
  describe('Timer Preservation Unit Tests', () => {
    test('should handle invalid remaining time gracefully', async () => {
      const gameId = `test-timer-invalid-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      await gameDoc.save();

      // Test invalid remaining times
      await expect(turnTimerManager.preserveTimer(gameId, playerId, -1000))
        .rejects.toThrow('Invalid remaining time');
      
      await expect(turnTimerManager.preserveTimer(gameId, playerId, 'invalid'))
        .rejects.toThrow('Invalid remaining time');

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should handle non-existent game gracefully', async () => {
      const gameId = 'non-existent-game';
      const playerId = 'test-player';

      await expect(turnTimerManager.preserveTimer(gameId, playerId, 60000))
        .rejects.toThrow('Game non-existent-game not found');

      await expect(turnTimerManager.restoreTimer(gameId, playerId))
        .rejects.toThrow('Game non-existent-game not found');
    });

    test('should provide default duration when no preserved state exists', async () => {
      const gameId = `test-timer-default-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game without preserved timer state
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: null, pausedAt: null }
      });
      await gameDoc.save();

      // Restore should use default duration
      const restoreResult = await turnTimerManager.restoreTimer(gameId, playerId);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.remainingTime).toBe(120000); // Default 2 minutes

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should clear timer state correctly', async () => {
      const gameId = `test-timer-clear-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      await gameDoc.save();

      // Preserve timer
      await turnTimerManager.preserveTimer(gameId, playerId, 60000);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);

      // Clear preserved timer
      turnTimerManager.clearPreservedTimer(gameId);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);

      // Restore timer (should create active timer)
      await turnTimerManager.restoreTimer(gameId, playerId, 45000);
      expect(turnTimerManager.isTimerActive(gameId)).toBe(true);

      // Clear active timer
      turnTimerManager.clearActiveTimer(gameId);
      expect(turnTimerManager.isTimerActive(gameId)).toBe(false);

      // Clear all timer state
      await turnTimerManager.preserveTimer(gameId, playerId, 30000);
      await turnTimerManager.restoreTimer(gameId, playerId);
      turnTimerManager.clearAllTimerState(gameId);
      expect(turnTimerManager.isTimerPreserved(gameId)).toBe(false);
      expect(turnTimerManager.isTimerActive(gameId)).toBe(false);

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should provide accurate timer statistics', async () => {
      const gameId1 = `test-timer-stats1-${Date.now()}`;
      const gameId2 = `test-timer-stats2-${Date.now()}`;
      const playerId = 'test-player';

      // Create test games
      const gameDoc1 = new Game({
        gameId: gameId1,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      const gameDoc2 = new Game({
        gameId: gameId2,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      await gameDoc1.save();
      await gameDoc2.save();

      // Create preserved and active timers
      await turnTimerManager.preserveTimer(gameId1, playerId, 60000);
      await turnTimerManager.restoreTimer(gameId2, playerId, 45000);

      // Check statistics
      const stats = turnTimerManager.getTimerStatistics();
      expect(stats.preservedTimers).toBe(1);
      expect(stats.activeTimers).toBe(1);
      expect(stats.totalGames).toBe(2);
      expect(stats.config).toBeDefined();
      expect(stats.timestamp).toBeInstanceOf(Date);

      // Clean up
      await Game.deleteMany({ gameId: { $in: [gameId1, gameId2] } });
    });
  });

  /**
   * Property 15: Timer Behavior During Grace Period
   * Feature: player-reconnection-management, Property 15: Timer Behavior During Grace Period
   * Validates: Requirements 5.3
   */
  describe('Property 15: Timer Behavior During Grace Period', () => {
    test('should keep timer paused during entire grace period countdown', async () => {
      await fc.assert(fc.asyncProperty(
        // Generate test data
        fc.record({
          gameId: fc.constant(`test-grace-timer-${++testGameCounter}-${Date.now()}`),
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
              remainingTime: null,
              originalDuration,
              pausedAt: null
            }
          });
          await gameDoc.save();

          // Property: Pause timer for grace period
          const pauseResult = await turnTimerManager.pauseTimerForGracePeriod(
            gameId, 
            gracePeriodDuration
          );

          // If there was no active timer, pause should indicate this
          if (!pauseResult.success) {
            expect(pauseResult.reason).toBe('no_active_timer');
            // Clean up and continue
            await Game.deleteOne({ gameId });
            return;
          }

          // Verify timer is paused during grace period
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

          // Property: Timer synchronization should show paused state
          const syncData = await turnTimerManager.synchronizeTimer(gameId);
          expect(syncData).not.toBeNull();
          expect(syncData.timerState.isPaused).toBe(true);
          expect(syncData.gameState.gracePeriodActive).toBe(true);

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 100 });
    });

    test('should handle grace period expiration with different continuation decisions', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          gameId: fc.constant(`test-grace-expiry-${++testGameCounter}-${Date.now()}`),
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
      ), { numRuns: 100 });
    });

    test('should maintain timer synchronization across grace period lifecycle', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          gameId: fc.constant(`test-grace-sync-${++testGameCounter}-${Date.now()}`),
          playerId: fc.string({ minLength: 3, maxLength: 20 }),
          remainingTime: fc.integer({ min: 15000, max: 90000 }), // 15s to 1.5min
          gracePeriodDuration: fc.integer({ min: 60000, max: 300000 }), // 1min to 5min
          originalDuration: fc.integer({ min: 120000, max: 300000 })
        }),
        
        async (testData) => {
          const { gameId, playerId, remainingTime, gracePeriodDuration, originalDuration } = testData;
          
          // Create test game
          const gameDoc = new Game({
            gameId,
            players: [{ name: playerId, score: 0 }],
            gameState: { currentPlayerIndex: 0, started: true },
            turnTimer: {
              remainingTime: null,
              originalDuration,
              pausedAt: null
            }
          });
          await gameDoc.save();

          // Start with active timer
          await turnTimerManager.restoreTimer(gameId, playerId, remainingTime);
          
          // Property: Initial sync should show active timer
          let syncData = await turnTimerManager.synchronizeTimer(gameId);
          expect(syncData).not.toBeNull();
          expect(syncData.timerState.isActive).toBe(true);
          expect(syncData.gameState.gracePeriodActive).toBe(false);

          // Start grace period (this should pause the timer)
          gameDoc.isPaused = true;
          gameDoc.gracePeriod.isActive = true;
          gameDoc.gracePeriod.startTime = new Date();
          gameDoc.gracePeriod.duration = gracePeriodDuration;
          gameDoc.gracePeriod.targetPlayerId = playerId;
          await gameDoc.save();

          await turnTimerManager.pauseTimerForGracePeriod(gameId, gracePeriodDuration);

          // Property: Sync during grace period should show paused timer
          syncData = await turnTimerManager.synchronizeTimer(gameId);
          expect(syncData).not.toBeNull();
          expect(syncData.timerState.isPaused).toBe(true);
          expect(syncData.gameState.gracePeriodActive).toBe(true);
          expect(syncData.gameState.gracePeriodRemaining).toBeGreaterThan(0);

          // Property: Timer state should be consistent across multiple sync calls
          const syncData2 = await turnTimerManager.synchronizeTimer(gameId);
          expect(syncData2.timerState.remainingTime).toBe(syncData.timerState.remainingTime);
          expect(syncData2.gameState.gracePeriodActive).toBe(syncData.gameState.gracePeriodActive);

          // Clean up
          await Game.deleteOne({ gameId });
        }
      ), { numRuns: 100 });
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
    test('should validate timer state consistency', async () => {
      const gameId = `test-timer-validation-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      await gameDoc.save();

      // Test valid state (no timers)
      let validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);

      // Test valid state (preserved timer)
      await turnTimerManager.preserveTimer(gameId, playerId, 60000);
      validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(true);

      // Test valid state (active timer)
      await turnTimerManager.restoreTimer(gameId, playerId);
      validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(true);

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should detect timer state inconsistencies', async () => {
      const gameId = `test-timer-inconsistent-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        isPaused: true, // Game is paused
        turnTimer: { remainingTime: 60000, originalDuration: 120000, pausedAt: new Date() }
      });
      await gameDoc.save();

      // Create active timer while game is paused (inconsistent state)
      await turnTimerManager.restoreTimer(gameId, playerId);

      // Validation should detect the inconsistency
      const validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Active timer exists while game is paused');

  /**
   * Timer State Validation Tests
   */
  describe('Timer State Validation', () => {
    test('should validate timer state consistency', async () => {
      const gameId = `test-timer-validation-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        turnTimer: { remainingTime: null, originalDuration: 120000, pausedAt: null }
      });
      await gameDoc.save();

      // Test valid state (no timers)
      let validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);

      // Test valid state (preserved timer)
      await turnTimerManager.preserveTimer(gameId, playerId, 60000);
      validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(true);

      // Test valid state (active timer)
      await turnTimerManager.restoreTimer(gameId, playerId);
      validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(true);

      // Clean up
      await Game.deleteOne({ gameId });
    });

    test('should detect timer state inconsistencies', async () => {
      const gameId = `test-timer-inconsistent-${Date.now()}`;
      const playerId = 'test-player';

      // Create test game
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0 }],
        gameState: { currentPlayerIndex: 0, started: true },
        isPaused: true, // Game is paused
        turnTimer: { remainingTime: 60000, originalDuration: 120000, pausedAt: new Date() }
      });
      await gameDoc.save();

      // Create active timer while game is paused (inconsistent state)
      await turnTimerManager.restoreTimer(gameId, playerId);

      // Validation should detect the inconsistency
      const validation = await turnTimerManager.validateTimerState(gameId);
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Active timer exists while game is paused');

      // Clean up
      await Game.deleteOne({ gameId });
    });
  });
});