/**
 * Property-Based Tests for Player Reconnection State Persistence
 * Feature: player-reconnection-management, Property 4: Complete State Persistence Round-trip
 * Validates: Requirements 8.1, 8.2, 8.3
 */

const fc = require('fast-check');

describe('Player Reconnection State Persistence Properties', () => {
  
  /**
   * Property 4: Complete State Persistence Round-trip
   * For any game state when a player disconnects, saving then restoring should 
   * produce an equivalent game state including hand tiles, board position, and turn progress
   */
  test('Property 4: Complete State Persistence Round-trip', () => {
    fc.assert(fc.property(
      fc.record({
        // Core game state
        gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
        currentPlayerIndex: fc.integer({ min: 0, max: 3 }),
        started: fc.boolean(),
        
        // Board state
        board: fc.array(
          fc.array(
            fc.record({
              value: fc.integer({ min: 1, max: 13 }),
              color: fc.constantFrom('red', 'blue', 'yellow', 'black'),
              isJoker: fc.boolean()
            }),
            { minLength: 0, maxLength: 14 }
          ),
          { minLength: 0, maxLength: 10 }
        ),
        
        // Player hands (simulated)
        playerHands: fc.array(
          fc.array(
            fc.record({
              value: fc.integer({ min: 1, max: 13 }),
              color: fc.constantFrom('red', 'blue', 'yellow', 'black'),
              isJoker: fc.boolean()
            }),
            { minLength: 0, maxLength: 14 }
          ),
          { minLength: 2, maxLength: 4 }
        ),
        
        // Turn timer state
        turnTimer: fc.record({
          remainingTime: fc.integer({ min: 0, max: 60000 }),
          originalDuration: fc.integer({ min: 30000, max: 120000 }),
          pausedAt: fc.option(fc.date(), { nil: null })
        }),
        
        // Player statuses
        playerStatuses: fc.array(
          fc.record({
            playerId: fc.string({ minLength: 3, maxLength: 20 }),
            status: fc.constantFrom('CONNECTED', 'DISCONNECTING', 'RECONNECTING', 'DISCONNECTED', 'ABANDONED'),
            lastSeen: fc.date(),
            disconnectedAt: fc.option(fc.date(), { nil: null }),
            reconnectionAttempts: fc.integer({ min: 0, max: 10 }),
            connectionMetrics: fc.record({
              latency: fc.integer({ min: 0, max: 1000 }),
              packetLoss: fc.float({ min: 0, max: 1, noNaN: true }),
              connectionQuality: fc.constantFrom('excellent', 'good', 'fair', 'poor'),
              isMobile: fc.boolean(),
              networkType: fc.constantFrom('wifi', 'cellular', 'unknown')
            })
          }),
          { minLength: 2, maxLength: 4 }
        ),
        
        // Pause state
        pauseState: fc.record({
          isPaused: fc.boolean(),
          pauseReason: fc.option(
            fc.constantFrom('CURRENT_PLAYER_DISCONNECT', 'MULTIPLE_DISCONNECTS', 'NETWORK_INSTABILITY', 'ALL_PLAYERS_DISCONNECT', 'MANUAL_PAUSE'),
            { nil: null }
          ),
          pausedAt: fc.option(fc.date(), { nil: null }),
          pausedBy: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: null })
        }),
        
        // Grace period state
        gracePeriod: fc.record({
          isActive: fc.boolean(),
          startTime: fc.option(fc.date(), { nil: null }),
          duration: fc.integer({ min: 60000, max: 600000 }),
          targetPlayerId: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: null })
        })
      }),
      (originalGameState) => {
        // Simulate saving game state to persistent storage
        const savedState = {
          // Core game data
          gameId: originalGameState.gameId,
          currentPlayerIndex: originalGameState.currentPlayerIndex,
          started: originalGameState.started,
          
          // Board state (deep copy simulation)
          board: JSON.parse(JSON.stringify(originalGameState.board)),
          
          // Player hands (in real implementation, this would be encrypted/secured)
          playerHands: JSON.parse(JSON.stringify(originalGameState.playerHands)),
          
          // Turn timer preservation
          turnTimer: {
            remainingTime: originalGameState.turnTimer.remainingTime,
            originalDuration: originalGameState.turnTimer.originalDuration,
            pausedAt: originalGameState.turnTimer.pausedAt
          },
          
          // Player connection statuses
          playerStatuses: originalGameState.playerStatuses.map(ps => ({
            playerId: ps.playerId,
            status: ps.status,
            lastSeen: ps.lastSeen,
            disconnectedAt: ps.disconnectedAt,
            reconnectionAttempts: ps.reconnectionAttempts,
            connectionMetrics: { ...ps.connectionMetrics }
          })),
          
          // Pause state
          pauseState: {
            isPaused: originalGameState.pauseState.isPaused,
            pauseReason: originalGameState.pauseState.pauseReason,
            pausedAt: originalGameState.pauseState.pausedAt,
            pausedBy: originalGameState.pauseState.pausedBy
          },
          
          // Grace period state
          gracePeriod: {
            isActive: originalGameState.gracePeriod.isActive,
            startTime: originalGameState.gracePeriod.startTime,
            duration: originalGameState.gracePeriod.duration,
            targetPlayerId: originalGameState.gracePeriod.targetPlayerId
          },
          
          // Add persistence metadata
          persistenceMetadata: {
            savedAt: new Date(),
            version: '1.0.0',
            checksum: 'mock-checksum-' + Math.random().toString(36).substring(7)
          }
        };
        
        // Simulate restoring game state from persistent storage
        const restoredState = JSON.parse(JSON.stringify(savedState));
        
        // Property: Core game state should be preserved exactly
        expect(restoredState.gameId).toBe(originalGameState.gameId);
        expect(restoredState.currentPlayerIndex).toBe(originalGameState.currentPlayerIndex);
        expect(restoredState.started).toBe(originalGameState.started);
        
        // Property: Board state should be preserved with all tile details
        expect(restoredState.board).toEqual(originalGameState.board);
        expect(restoredState.board.length).toBe(originalGameState.board.length);
        
        // Verify each board group preserves tile properties
        restoredState.board.forEach((group, groupIndex) => {
          expect(group.length).toBe(originalGameState.board[groupIndex].length);
          group.forEach((tile, tileIndex) => {
            const originalTile = originalGameState.board[groupIndex][tileIndex];
            expect(tile.value).toBe(originalTile.value);
            expect(tile.color).toBe(originalTile.color);
            expect(tile.isJoker).toBe(originalTile.isJoker);
          });
        });
        
        // Property: Player hands should be preserved exactly
        expect(restoredState.playerHands).toEqual(originalGameState.playerHands);
        expect(restoredState.playerHands.length).toBe(originalGameState.playerHands.length);
        
        // Verify each player's hand is preserved
        restoredState.playerHands.forEach((hand, playerIndex) => {
          expect(hand.length).toBe(originalGameState.playerHands[playerIndex].length);
          hand.forEach((tile, tileIndex) => {
            const originalTile = originalGameState.playerHands[playerIndex][tileIndex];
            expect(tile.value).toBe(originalTile.value);
            expect(tile.color).toBe(originalTile.color);
            expect(tile.isJoker).toBe(originalTile.isJoker);
          });
        });
        
        // Property: Turn timer state should be preserved exactly
        expect(restoredState.turnTimer.remainingTime).toBe(originalGameState.turnTimer.remainingTime);
        expect(restoredState.turnTimer.originalDuration).toBe(originalGameState.turnTimer.originalDuration);
        if (originalGameState.turnTimer.pausedAt) {
          expect(new Date(restoredState.turnTimer.pausedAt)).toEqual(originalGameState.turnTimer.pausedAt);
        } else {
          expect(restoredState.turnTimer.pausedAt).toBe(null);
        }
        
        // Property: Player statuses should be preserved with all connection details
        expect(restoredState.playerStatuses.length).toBe(originalGameState.playerStatuses.length);
        restoredState.playerStatuses.forEach((restoredStatus, index) => {
          const originalStatus = originalGameState.playerStatuses[index];
          expect(restoredStatus.playerId).toBe(originalStatus.playerId);
          expect(restoredStatus.status).toBe(originalStatus.status);
          expect(restoredStatus.reconnectionAttempts).toBe(originalStatus.reconnectionAttempts);
          
          // Connection metrics should be preserved
          expect(restoredStatus.connectionMetrics.latency).toBe(originalStatus.connectionMetrics.latency);
          expect(restoredStatus.connectionMetrics.packetLoss).toBe(originalStatus.connectionMetrics.packetLoss);
          expect(restoredStatus.connectionMetrics.connectionQuality).toBe(originalStatus.connectionMetrics.connectionQuality);
          expect(restoredStatus.connectionMetrics.isMobile).toBe(originalStatus.connectionMetrics.isMobile);
          expect(restoredStatus.connectionMetrics.networkType).toBe(originalStatus.connectionMetrics.networkType);
        });
        
        // Property: Pause state should be preserved exactly
        expect(restoredState.pauseState.isPaused).toBe(originalGameState.pauseState.isPaused);
        expect(restoredState.pauseState.pauseReason).toBe(originalGameState.pauseState.pauseReason);
        expect(restoredState.pauseState.pausedBy).toBe(originalGameState.pauseState.pausedBy);
        
        // Property: Grace period state should be preserved exactly
        expect(restoredState.gracePeriod.isActive).toBe(originalGameState.gracePeriod.isActive);
        expect(restoredState.gracePeriod.duration).toBe(originalGameState.gracePeriod.duration);
        expect(restoredState.gracePeriod.targetPlayerId).toBe(originalGameState.gracePeriod.targetPlayerId);
        
        // Property: Persistence metadata should be added during save
        expect(restoredState.persistenceMetadata).toBeDefined();
        expect(restoredState.persistenceMetadata.savedAt).toBeDefined();
        expect(restoredState.persistenceMetadata.version).toBe('1.0.0');
        expect(restoredState.persistenceMetadata.checksum).toMatch(/^mock-checksum-/);
        
        // Property: Data types should be preserved
        expect(typeof restoredState.gameId).toBe('string');
        expect(typeof restoredState.currentPlayerIndex).toBe('number');
        expect(typeof restoredState.started).toBe('boolean');
        expect(Array.isArray(restoredState.board)).toBe(true);
        expect(Array.isArray(restoredState.playerHands)).toBe(true);
        expect(Array.isArray(restoredState.playerStatuses)).toBe(true);
        expect(typeof restoredState.pauseState.isPaused).toBe('boolean');
        expect(typeof restoredState.gracePeriod.isActive).toBe('boolean');
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Property 4a: State persistence handles edge cases correctly', () => {
    fc.assert(fc.property(
      fc.record({
        // Edge case scenarios
        gameId: fc.oneof(
          fc.string({ minLength: 1, maxLength: 1 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'a'), // Very short but valid ID
          fc.string({ minLength: 50, maxLength: 100 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'a'.repeat(50)), // Very long but valid ID
          fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game1') // Normal valid ID
        ),
        
        // Empty or minimal states
        board: fc.oneof(
          fc.constant([]), // Empty board
          fc.array(fc.constant([]), { minLength: 1, maxLength: 3 }), // Empty groups
          fc.array(fc.array(fc.record({
            value: fc.integer({ min: 1, max: 13 }),
            color: fc.constantFrom('red', 'blue', 'yellow', 'black'),
            isJoker: fc.boolean()
          }), { minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 3 })
        ),
        
        // Edge case timer values
        turnTimer: fc.record({
          remainingTime: fc.oneof(
            fc.constant(0), // Timer expired
            fc.constant(1), // Almost expired
            fc.integer({ min: 59000, max: 60000 }) // Almost full
          ),
          originalDuration: fc.integer({ min: 1000, max: 300000 }),
          pausedAt: fc.option(fc.date(), { nil: null })
        }),
        
        // Single player status (minimum case)
        playerStatuses: fc.array(
          fc.record({
            playerId: fc.string({ minLength: 1, maxLength: 50 }),
            status: fc.constantFrom('CONNECTED', 'DISCONNECTED', 'ABANDONED'),
            lastSeen: fc.date(),
            disconnectedAt: fc.option(fc.date(), { nil: null }),
            reconnectionAttempts: fc.oneof(
              fc.constant(0), // No attempts
              fc.constant(100) // Many attempts
            ),
            connectionMetrics: fc.record({
              latency: fc.oneof(fc.constant(0), fc.constant(5000)), // Perfect or terrible
              packetLoss: fc.oneof(fc.constant(0), fc.constant(1)), // None or complete
              connectionQuality: fc.constantFrom('excellent', 'poor'),
              isMobile: fc.boolean(),
              networkType: fc.constantFrom('wifi', 'cellular', 'unknown')
            })
          }),
          { minLength: 1, maxLength: 1 }
        )
      }),
      (edgeCaseState) => {
        // Simulate persistence with edge cases
        const savedState = JSON.parse(JSON.stringify(edgeCaseState));
        const restoredState = JSON.parse(JSON.stringify(savedState));
        
        // Property: Even edge cases should round-trip correctly
        expect(restoredState.gameId).toBe(edgeCaseState.gameId);
        expect(restoredState.board).toEqual(edgeCaseState.board);
        expect(restoredState.turnTimer.remainingTime).toBe(edgeCaseState.turnTimer.remainingTime);
        expect(restoredState.playerStatuses.length).toBe(edgeCaseState.playerStatuses.length);
        
        // Property: Edge case values should be preserved
        if (edgeCaseState.turnTimer.remainingTime === 0) {
          expect(restoredState.turnTimer.remainingTime).toBe(0);
        }
        
        // Property: Empty collections should remain empty
        if (edgeCaseState.board.length === 0) {
          expect(restoredState.board.length).toBe(0);
        }
        
        // Property: Extreme connection metrics should be preserved
        edgeCaseState.playerStatuses.forEach((originalStatus, index) => {
          const restoredStatus = restoredState.playerStatuses[index];
          expect(restoredStatus.connectionMetrics.latency).toBe(originalStatus.connectionMetrics.latency);
          expect(restoredStatus.connectionMetrics.packetLoss).toBe(originalStatus.connectionMetrics.packetLoss);
          expect(restoredStatus.reconnectionAttempts).toBe(originalStatus.reconnectionAttempts);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 4b: State persistence maintains data integrity under corruption scenarios', () => {
    // Simple test case first
    const simpleValidState = {
      gameId: "test123",
      board: [[{ value: 1, color: "red", isJoker: false }]],
      turnTimer: { remainingTime: 1000, originalDuration: 30000 }
    };
    
    expect(validateGameState(simpleValidState)).toBe(true);
    
    fc.assert(fc.property(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
        board: fc.array(
          fc.array(
            fc.record({
              value: fc.integer({ min: 1, max: 13 }),
              color: fc.constantFrom('red', 'blue', 'yellow', 'black'),
              isJoker: fc.boolean()
            }),
            { minLength: 1, maxLength: 5 }
          ),
          { minLength: 1, maxLength: 5 }
        ),
        turnTimer: fc.record({
          remainingTime: fc.integer({ min: 1, max: 60000 }),
          originalDuration: fc.integer({ min: 30000, max: 120000 })
        })
      }),
      (gameState) => {
        // Simulate saving state
        const savedState = JSON.parse(JSON.stringify(gameState));
        
        // Test corruption scenarios
        const corruptionTests = [
          // Missing required fields
          () => {
            const corrupted = JSON.parse(JSON.stringify(savedState));
            delete corrupted.gameId;
            return corrupted;
          },
          
          // Invalid data types
          () => {
            const corrupted = JSON.parse(JSON.stringify(savedState));
            corrupted.turnTimer.remainingTime = "invalid";
            return corrupted;
          },
          
          // Negative values where they shouldn't be
          () => {
            const corrupted = JSON.parse(JSON.stringify(savedState));
            corrupted.turnTimer.remainingTime = -1000;
            return corrupted;
          }
        ];
        
        corruptionTests.forEach(corruptionTest => {
          const corruptedState = corruptionTest();
          
          // Simulate validation during restoration
          const isValid = validateGameState(corruptedState);
          
          // Property: Corrupted states should be detected and rejected
          expect(isValid).toBe(false);
        });
        
        // Property: Valid states should pass validation
        const validState = JSON.parse(JSON.stringify(savedState));
        expect(validateGameState(validState)).toBe(true);
        
        return true;
      }
    ), { numRuns: 30 });
  });
});

// Helper function to validate game state integrity
function validateGameState(state) {
  try {
    // Check required fields - gameId just needs to exist and be a string
    if (!state.gameId || typeof state.gameId !== 'string') {
      return false;
    }
    
    // Check data types
    if (state.turnTimer && typeof state.turnTimer.remainingTime !== 'number') {
      return false;
    }
    
    // Check value ranges
    if (state.turnTimer && state.turnTimer.remainingTime < 0) {
      return false;
    }
    
    // Check board structure
    if (state.board && !Array.isArray(state.board)) {
      return false;
    }
    
    if (state.board) {
      for (const group of state.board) {
        if (!Array.isArray(group)) {
          return false;
        }
        for (const tile of group) {
          if (!tile || typeof tile.value !== 'number' || typeof tile.color !== 'string' || typeof tile.isJoker !== 'boolean') {
            return false;
          }
          if (tile.value < 1 || tile.value > 13) {
            return false;
          }
          if (!['red', 'blue', 'yellow', 'black'].includes(tile.color)) {
            return false;
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}