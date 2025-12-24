/**
 * Basic Pause/Resume Flow Test
 * Task 6: Checkpoint - Core backend functionality complete
 * 
 * This test verifies the basic pause/resume flow without UI components
 */

const mongoose = require('mongoose');
const Game = require('../models/Game');
const gamePauseController = require('../services/gamePauseController');
const turnTimerManager = require('../services/turnTimerManager');

// Test database configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rummikub_test';

describe('Basic Pause/Resume Flow Test', () => {
  let testGameCounter = 0;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
    
    console.log('🧪 Basic Pause/Resume Flow Test initialized');
  });

  afterAll(async () => {
    // Clean up test data
    await Game.deleteMany({ gameId: /^test-basic-/ });
    
    // Shutdown services
    gamePauseController.shutdown();
    turnTimerManager.shutdown();
    
    // Close database connection
    await mongoose.connection.close();
    
    console.log('🧹 Basic Pause/Resume Flow Test cleanup complete');
  });

  beforeEach(() => {
    testGameCounter++;
  });

  test('should complete basic pause and resume flow', async () => {
    const gameId = `test-basic-pause-resume-${testGameCounter}`;
    const playerId = 'TestPlayer';
    
    console.log(`🧪 Testing basic pause/resume flow for game ${gameId}`);
    
    // Step 1: Create a test game
    const gameDoc = new Game({
      gameId,
      players: [
        { name: playerId, score: 0 },
        { name: 'OtherPlayer', score: 0 }
      ],
      gameState: { 
        currentPlayerIndex: 0, // TestPlayer is current
        board: [],
        started: true
      },
      turnTimer: { 
        remainingTime: 90000, // 90 seconds remaining
        originalDuration: 120000 // 2 minutes total
      }
    });
    
    await gameDoc.save();
    console.log('✅ Step 1: Test game created');
    
    // Step 2: Preserve timer state
    const preserveResult = await turnTimerManager.preserveTimer(
      gameId, 
      playerId, 
      90000 // 90 seconds remaining
    );
    
    expect(preserveResult.success).toBe(true);
    expect(preserveResult.remainingTime).toBeCloseTo(90000, -2);
    console.log('✅ Step 2: Timer preserved');
    
    // Step 3: Pause the game
    const pauseResult = await gamePauseController.pauseGame(
      gameId,
      'CURRENT_PLAYER_DISCONNECT',
      playerId,
      { remainingTime: 90000 }
    );
    
    expect(pauseResult.success).toBe(true);
    console.log('✅ Step 3: Game paused');
    
    // Step 4: Verify paused state
    const pausedGame = await Game.findOne({ gameId });
    expect(pausedGame.isPaused).toBe(true);
    expect(pausedGame.pauseReason).toBe('CURRENT_PLAYER_DISCONNECT');
    expect(pausedGame.pausedBy).toBe(playerId);
    expect(pausedGame.turnTimer.remainingTime).toBe(90000);
    expect(turnTimerManager.isTimerPreserved(gameId)).toBe(true);
    console.log('✅ Step 4: Paused state verified');
    
    // Step 5: Resume the game
    const resumeResult = await gamePauseController.resumeGame(gameId, playerId);
    expect(resumeResult.success).toBe(true);
    console.log('✅ Step 5: Game resumed');
    
    // Step 6: Restore timer
    const restoreResult = await turnTimerManager.restoreTimer(gameId, playerId);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.remainingTime).toBeCloseTo(90000, -2);
    console.log('✅ Step 6: Timer restored');
    
    // Step 7: Verify resumed state
    const resumedGame = await Game.findOne({ gameId });
    expect(resumedGame.isPaused).toBe(false);
    expect(resumedGame.pauseReason).toBeNull();
    expect(resumedGame.pausedBy).toBeNull();
    expect(resumedGame.gracePeriod.isActive).toBe(false);
    console.log('✅ Step 7: Resumed state verified');
    
    // Step 8: Verify timer state
    const timerState = await turnTimerManager.getTimerState(gameId);
    expect(timerState).toBeTruthy();
    expect(timerState.isActive).toBe(true);
    expect(timerState.remainingTime).toBeCloseTo(90000, -2);
    console.log('✅ Step 8: Timer state verified');
    
    console.log('🎉 Basic pause/resume flow test completed successfully');
  });

  test('should handle grace period correctly', async () => {
    const gameId = `test-basic-grace-period-${testGameCounter}`;
    const playerId = 'GraceTestPlayer';
    
    console.log(`🧪 Testing grace period for game ${gameId}`);
    
    // Create and pause game
    const gameDoc = new Game({
      gameId,
      players: [{ name: playerId, score: 0 }],
      gameState: { currentPlayerIndex: 0 },
      isPaused: true,
      pauseReason: 'CURRENT_PLAYER_DISCONNECT',
      pausedBy: playerId
    });
    
    await gameDoc.save();
    console.log('✅ Step 1: Paused game created');
    
    // Start grace period
    const gracePeriodResult = await gamePauseController.startGracePeriod(
      gameId,
      playerId,
      { connectionQuality: 'good' }
    );
    
    expect(gracePeriodResult.success).toBe(true);
    expect(gracePeriodResult.duration).toBe(180000); // 3 minutes for good connection
    console.log('✅ Step 2: Grace period started');
    
    // Verify grace period state
    const gameWithGracePeriod = await Game.findOne({ gameId });
    expect(gameWithGracePeriod.gracePeriod.isActive).toBe(true);
    expect(gameWithGracePeriod.gracePeriod.targetPlayerId).toBe(playerId);
    expect(gameWithGracePeriod.gracePeriod.duration).toBe(180000);
    console.log('✅ Step 3: Grace period state verified');
    
    // Get grace period status
    const gracePeriodStatus = await gamePauseController.getGracePeriodStatus(gameId);
    expect(gracePeriodStatus).toBeTruthy();
    expect(gracePeriodStatus.isActive).toBe(true);
    expect(gracePeriodStatus.targetPlayerId).toBe(playerId);
    expect(gracePeriodStatus.timeRemaining).toBeGreaterThan(0);
    console.log('✅ Step 4: Grace period status verified');
    
    console.log('🎉 Grace period test completed successfully');
  });

  test('should handle database schema correctly', async () => {
    const gameId = `test-basic-schema-${testGameCounter}`;
    
    console.log(`🧪 Testing database schema for game ${gameId}`);
    
    // Create game with all reconnection fields
    const gameDoc = new Game({
      gameId,
      players: [
        { name: 'Player1', score: 0, isBot: false },
        { name: 'Player2', score: 0, isBot: true }
      ],
      gameState: {
        currentPlayerIndex: 0,
        board: [],
        started: true
      },
      // Reconnection management fields
      isPaused: false,
      pauseReason: null,
      pausedAt: null,
      pausedBy: null,
      gracePeriod: {
        isActive: false,
        startTime: null,
        duration: 180000,
        targetPlayerId: null
      },
      turnTimer: {
        remainingTime: 120000,
        pausedAt: null,
        originalDuration: 120000
      },
      playerStatuses: [
        {
          playerId: 'Player1',
          status: 'CONNECTED',
          lastSeen: new Date(),
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
          lastSeen: new Date(),
          connectionMetrics: {
            latency: 25,
            connectionQuality: 'excellent',
            isMobile: false,
            networkType: 'wifi'
          }
        }
      ],
      continuationOptions: {
        presented: false,
        presentedAt: null,
        options: [],
        votes: []
      },
      reconnectionEvents: []
    });
    
    await gameDoc.save();
    console.log('✅ Step 1: Game with full schema saved');
    
    // Retrieve and verify
    const savedGame = await Game.findOne({ gameId });
    expect(savedGame).toBeTruthy();
    expect(savedGame.gameId).toBe(gameId);
    expect(savedGame.players).toHaveLength(2);
    expect(savedGame.playerStatuses).toHaveLength(2);
    expect(savedGame.isPaused).toBe(false);
    expect(savedGame.gracePeriod.isActive).toBe(false);
    expect(savedGame.turnTimer.remainingTime).toBe(120000);
    expect(savedGame.continuationOptions.presented).toBe(false);
    expect(savedGame.reconnectionEvents).toHaveLength(0);
    console.log('✅ Step 2: Schema fields verified');
    
    // Test model methods
    expect(savedGame.isCurrentPlayerDisconnected()).toBe(false);
    expect(savedGame.getGracePeriodTimeRemaining()).toBe(0);
    expect(savedGame.isGracePeriodExpired()).toBe(false);
    
    const player1Status = savedGame.getPlayerStatus('Player1');
    expect(player1Status).toBeTruthy();
    expect(player1Status.status).toBe('CONNECTED');
    console.log('✅ Step 3: Model methods verified');
    
    console.log('🎉 Database schema test completed successfully');
  });
});