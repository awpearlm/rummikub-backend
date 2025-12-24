/**
 * Property-Based Tests for Reconnection Data Integrity Validation
 * Feature: player-reconnection-management, Property 18: Data Integrity Validation
 * Validates: Requirements 8.4, 8.5
 */

const fc = require('fast-check');
const reconnectionHandler = require('../services/reconnectionHandler');
const Game = require('../models/Game');

describe('Reconnection Data Integrity Validation Properties', () => {
  
  /**
   * Property 18: Data Integrity Validation
   * For any game state restoration, the system should verify data integrity before resuming 
   * and provide fallback options if validation fails
   */
  test('Property 18: Data Integrity Validation', () => {
    fc.assert(fc.property(
      fc.record({
        // Game document structure
        gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
        
        // Players array with potential integrity issues
        players: fc.array(
          fc.record({
            name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
            userId: fc.option(fc.string({ minLength: 1, maxLength: 24 }), { nil: null }),
            score: fc.oneof(
              fc.integer({ min: 0, max: 1000 }), // Valid scores
              fc.integer({ min: -100, max: -1 }), // Invalid negative scores
              fc.constant(null), // Missing scores
              fc.constant(undefined), // Undefined scores
              fc.constant("invalid") // Wrong type
            ),
            isBot: fc.oneof(
              fc.boolean(), // Valid boolean
              fc.constant(null), // Missing boolean
              fc.constant("true"), // Wrong type
              fc.constant(1) // Wrong type
            ),
            isWinner: fc.boolean()
          }),
          { minLength: 1, maxLength: 4 }
        ),
        
        // Game state with potential corruption
        gameState: fc.oneof(
          fc.record({
            currentPlayerIndex: fc.oneof(
              fc.integer({ min: 0, max: 3 }), // Valid index
              fc.integer({ min: -1, max: -1 }), // Invalid negative
              fc.integer({ min: 10, max: 20 }), // Out of bounds
              fc.constant(null), // Missing
              fc.constant("0") // Wrong type
            ),
            board: fc.oneof(
              fc.array(fc.array(fc.record({
                value: fc.integer({ min: 1, max: 13 }),
                color: fc.constantFrom('red', 'blue', 'yellow', 'black'),
                isJoker: fc.boolean()
              })), { minLength: 0, max: 10 }), // Valid board
              fc.constant(null), // Missing board
              fc.constant("invalid"), // Wrong type
              fc.array(fc.constant("invalid")) // Invalid board structure
            ),
            started: fc.oneof(
              fc.boolean(), // Valid
              fc.constant(null), // Missing
              fc.constant("true") // Wrong type
            )
          }),
          fc.constant(null), // Missing game state entirely
          fc.constant("invalid") // Wrong type for game state
        ),
        
        // Player statuses with potential issues
        playerStatuses: fc.oneof(
          fc.array(
            fc.record({
              playerId: fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }), // Valid
                fc.constant(""), // Empty string
                fc.constant(null) // Missing
              ),
              status: fc.oneof(
                fc.constantFrom('CONNECTED', 'DISCONNECTING', 'RECONNECTING', 'DISCONNECTED', 'ABANDONED'), // Valid
                fc.constant("INVALID_STATUS"), // Invalid status
                fc.constant(null) // Missing status
              ),
              lastSeen: fc.oneof(
                fc.date(), // Valid date
                fc.constant(null), // Missing
                fc.constant("invalid-date") // Invalid date
              ),
              connectionMetrics: fc.oneof(
                fc.record({
                  latency: fc.oneof(
                    fc.integer({ min: 0, max: 5000 }), // Valid
                    fc.integer({ min: -100, max: -1 }), // Invalid negative
                    fc.constant("invalid") // Wrong type
                  ),
                  connectionQuality: fc.oneof(
                    fc.constantFrom('excellent', 'good', 'fair', 'poor'), // Valid
                    fc.constant("invalid_quality") // Invalid quality
                  )
                }),
                fc.constant(null) // Missing metrics
              )
            }),
            { minLength: 0, maxLength: 4 }
          ),
          fc.constant(null) // Missing player statuses
        ),
        
        // Pause state with potential corruption
        pauseState: fc.record({
          isPaused: fc.oneof(
            fc.boolean(), // Valid
            fc.constant(null), // Missing
            fc.constant("true") // Wrong type
          ),
          pauseReason: fc.oneof(
            fc.constantFrom('CURRENT_PLAYER_DISCONNECT', 'MULTIPLE_DISCONNECTS', 'NETWORK_INSTABILITY'), // Valid
            fc.constant("INVALID_REASON"), // Invalid reason
            fc.constant(null) // Missing (valid for non-paused games)
          ),
          pausedBy: fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }), // Valid
            fc.constant(null) // Missing (valid for non-paused games)
          )
        }),
        
        // Grace period with potential issues
        gracePeriod: fc.record({
          isActive: fc.oneof(
            fc.boolean(), // Valid
            fc.constant("true") // Wrong type
          ),
          startTime: fc.oneof(
            fc.date(), // Valid
            fc.constant(null), // Valid for inactive
            fc.constant("invalid-date") // Invalid
          ),
          duration: fc.oneof(
            fc.integer({ min: 60000, max: 600000 }), // Valid
            fc.integer({ min: -1000, max: 0 }), // Invalid negative/zero
            fc.constant("invalid") // Wrong type
          ),
          targetPlayerId: fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }), // Valid
            fc.constant(null), // Valid for inactive
            fc.constant("") // Invalid empty string
          )
        })
      }),
      async (gameData) => {
        // Create a mock game document with the generated data
        const mockGameDoc = {
          gameId: gameData.gameId,
          players: gameData.players || [],
          gameState: gameData.gameState,
          playerStatuses: gameData.playerStatuses || [],
          isPaused: gameData.pauseState?.isPaused,
          pauseReason: gameData.pauseState?.pauseReason,
          pausedBy: gameData.pauseState?.pausedBy,
          gracePeriod: gameData.gracePeriod || {},
          endTime: null // Assume game is still active
        };
        
        // Test the validation function
        const validationResult = await reconnectionHandler.validateGameStateIntegrity(mockGameDoc);
        
        // Property: Validation should always return a result object
        expect(validationResult).toBeDefined();
        expect(typeof validationResult).toBe('object');
        expect(validationResult).toHaveProperty('isValid');
        expect(validationResult).toHaveProperty('errors');
        expect(validationResult).toHaveProperty('validatedAt');
        expect(validationResult).toHaveProperty('gameId');
        
        // Property: isValid should be boolean
        expect(typeof validationResult.isValid).toBe('boolean');
        
        // Property: errors should be an array
        expect(Array.isArray(validationResult.errors)).toBe(true);
        
        // Property: If validation fails, errors array should not be empty
        if (!validationResult.isValid) {
          expect(validationResult.errors.length).toBeGreaterThan(0);
          
          // Property: Each error should be a string
          validationResult.errors.forEach(error => {
            expect(typeof error).toBe('string');
            expect(error.length).toBeGreaterThan(0);
          });
        }
        
        // Property: If validation passes, errors array should be empty
        if (validationResult.isValid) {
          expect(validationResult.errors.length).toBe(0);
        }
        
        // Property: Specific validation rules should be enforced
        
        // Missing game ID should cause validation failure
        if (!gameData.gameId || typeof gameData.gameId !== 'string') {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('game ID'))).toBe(true);
        }
        
        // Empty players array should cause validation failure
        if (!gameData.players || gameData.players.length === 0) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('players'))).toBe(true);
        }
        
        // Missing game state should cause validation failure
        if (!gameData.gameState) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('game state'))).toBe(true);
        }
        
        // Invalid current player index should cause validation failure
        if (gameData.gameState && 
            (gameData.gameState.currentPlayerIndex === null || 
             gameData.gameState.currentPlayerIndex === undefined ||
             typeof gameData.gameState.currentPlayerIndex !== 'number')) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.toLowerCase().includes('current player') || e.toLowerCase().includes('index'))).toBe(true);
        }
        
        // Current player index out of bounds should cause validation failure
        if (gameData.gameState && 
            typeof gameData.gameState.currentPlayerIndex === 'number' &&
            gameData.players &&
            gameData.gameState.currentPlayerIndex >= gameData.players.length) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('out of bounds'))).toBe(true);
        }
        
        // Invalid board state should cause validation failure
        if (gameData.gameState && 
            gameData.gameState.board !== null &&
            !Array.isArray(gameData.gameState.board)) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('board'))).toBe(true);
        }
        
        // Player status validation
        if (gameData.playerStatuses && Array.isArray(gameData.playerStatuses)) {
          gameData.playerStatuses.forEach(status => {
            if (!status.playerId || status.playerId === "") {
              expect(validationResult.isValid).toBe(false);
              expect(validationResult.errors.some(e => e.includes('player ID'))).toBe(true);
            }
          });
        }
        
        // Pause state consistency validation
        if (gameData.pauseState?.isPaused === true) {
          if (!gameData.pauseState.pauseReason) {
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.some(e => e.includes('pause reason'))).toBe(true);
          }
          if (!gameData.pauseState.pausedBy) {
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.some(e => e.includes('pausedBy'))).toBe(true);
          }
        }
        
        // Grace period consistency validation
        if (gameData.gracePeriod?.isActive === true) {
          if (!gameData.gracePeriod.startTime) {
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.some(e => e.includes('start time'))).toBe(true);
          }
          if (!gameData.gracePeriod.targetPlayerId || gameData.gracePeriod.targetPlayerId === "") {
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.some(e => e.includes('target player'))).toBe(true);
          }
          if (typeof gameData.gracePeriod.duration !== 'number' || gameData.gracePeriod.duration <= 0) {
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.some(e => e.includes('duration'))).toBe(true);
          }
        }
        
        // Property: validatedAt should be a recent date
        expect(validationResult.validatedAt).toBeInstanceOf(Date);
        expect(Date.now() - validationResult.validatedAt.getTime()).toBeLessThan(1000); // Within 1 second
        
        // Property: gameId should match input
        expect(validationResult.gameId).toBe(gameData.gameId);
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Property 18a: Data integrity validation provides appropriate fallback options', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
        
        // Specific corruption scenarios
        corruptionType: fc.constantFrom(
          'missing_game_state',
          'invalid_current_player',
          'corrupted_player_statuses',
          'inconsistent_pause_state',
          'invalid_grace_period'
        ),
        
        players: fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            score: fc.integer({ min: 0, max: 1000 }),
            isBot: fc.boolean()
          }),
          { minLength: 2, maxLength: 4 }
        )
      }),
      async (testData) => {
        // Create corrupted game document based on corruption type
        let mockGameDoc = {
          gameId: testData.gameId,
          players: testData.players,
          gameState: {
            currentPlayerIndex: 0,
            board: [],
            started: true
          },
          playerStatuses: [],
          isPaused: false,
          gracePeriod: { isActive: false },
          endTime: null
        };
        
        // Apply specific corruption
        switch (testData.corruptionType) {
          case 'missing_game_state':
            mockGameDoc.gameState = null;
            break;
          case 'invalid_current_player':
            mockGameDoc.gameState.currentPlayerIndex = testData.players.length + 5; // Out of bounds
            break;
          case 'corrupted_player_statuses':
            mockGameDoc.playerStatuses = [{ playerId: "", status: "INVALID" }]; // Invalid status
            break;
          case 'inconsistent_pause_state':
            mockGameDoc.isPaused = true;
            mockGameDoc.pauseReason = null; // Missing reason for paused game
            break;
          case 'invalid_grace_period':
            mockGameDoc.gracePeriod = {
              isActive: true,
              startTime: null, // Missing start time for active grace period
              targetPlayerId: ""
            };
            break;
        }
        
        // Test validation
        const validationResult = await reconnectionHandler.validateGameStateIntegrity(mockGameDoc);
        
        // Property: Corrupted states should fail validation
        expect(validationResult.isValid).toBe(false);
        expect(validationResult.errors.length).toBeGreaterThan(0);
        
        // Test fallback option generation
        const fallbackOptions = await reconnectionHandler.generateFallbackOptions(mockGameDoc, validationResult);
        
        // Property: Fallback options should always be provided
        expect(Array.isArray(fallbackOptions)).toBe(true);
        expect(fallbackOptions.length).toBeGreaterThan(0);
        
        // Property: Fallback options should be strings
        fallbackOptions.forEach(option => {
          expect(typeof option).toBe('string');
          expect(option.length).toBeGreaterThan(0);
        });
        
        // Property: Specific fallback options should be provided based on corruption type
        switch (testData.corruptionType) {
          case 'missing_game_state':
            expect(fallbackOptions).toContain('reset_game_state');
            break;
          case 'invalid_current_player':
            expect(fallbackOptions).toContain('reset_current_player');
            break;
          case 'corrupted_player_statuses':
            expect(fallbackOptions).toContain('reset_player_statuses');
            break;
        }
        
        // Property: Common fallback options should always be available
        expect(fallbackOptions).toContain('create_new_game');
        expect(fallbackOptions).toContain('contact_support');
        
        // Property: No duplicate fallback options
        const uniqueOptions = [...new Set(fallbackOptions)];
        expect(uniqueOptions.length).toBe(fallbackOptions.length);
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 18b: Player data validation detects all integrity issues', () => {
    fc.assert(fc.property(
      fc.record({
        // Player data with potential issues
        name: fc.oneof(
          fc.string({ minLength: 1, maxLength: 20 }), // Valid name
          fc.constant(null), // Missing name
          fc.constant(""), // Empty name
          fc.constant(undefined) // Undefined name
        ),
        userId: fc.oneof(
          fc.string({ minLength: 1, maxLength: 24 }), // Valid userId
          fc.constant(null), // Missing userId
          fc.constant(""), // Empty userId
          fc.constant(undefined) // Undefined userId
        ),
        score: fc.oneof(
          fc.integer({ min: 0, max: 1000 }), // Valid score
          fc.integer({ min: -100, max: -1 }), // Invalid negative score
          fc.constant(null), // Missing score
          fc.constant(undefined), // Undefined score
          fc.constant("100"), // Wrong type (string)
          fc.constant(3.14) // Wrong type (float)
        ),
        isBot: fc.oneof(
          fc.boolean(), // Valid boolean
          fc.constant(null), // Missing boolean
          fc.constant(undefined), // Undefined boolean
          fc.constant("true"), // Wrong type (string)
          fc.constant(1) // Wrong type (number)
        )
      }),
      (playerData) => {
        // Create mock game document
        const mockGameDoc = {
          gameId: "test123",
          players: [playerData],
          gameState: { currentPlayerIndex: 0 }
        };
        
        // Test player data validation
        const validationResult = reconnectionHandler.validatePlayerData(playerData, mockGameDoc);
        
        // Property: Validation should always return a result
        expect(validationResult).toBeDefined();
        expect(typeof validationResult).toBe('object');
        expect(validationResult).toHaveProperty('isValid');
        expect(validationResult).toHaveProperty('errors');
        
        // Property: isValid should be boolean
        expect(typeof validationResult.isValid).toBe('boolean');
        
        // Property: errors should be an array
        expect(Array.isArray(validationResult.errors)).toBe(true);
        
        // Property: Specific validation rules
        
        // Player must have either name or userId
        if ((!playerData.name || playerData.name === "") && 
            (!playerData.userId || playerData.userId === "")) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('name') && e.includes('userId'))).toBe(true);
        }
        
        // Score validation
        if (playerData.score === null || playerData.score === undefined) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('score'))).toBe(true);
        }
        
        if (typeof playerData.score !== 'number' || playerData.score < 0) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('score'))).toBe(true);
        }
        
        // isBot validation
        if (playerData.isBot === undefined) {
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.errors.some(e => e.includes('isBot'))).toBe(true);
        }
        
        // Property: If all data is valid, validation should pass
        if (playerData.name && 
            typeof playerData.score === 'number' && 
            playerData.score >= 0 && 
            typeof playerData.isBot === 'boolean') {
          expect(validationResult.isValid).toBe(true);
          expect(validationResult.errors.length).toBe(0);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });
});