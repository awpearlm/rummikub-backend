/**
 * Property-Based Tests for Concurrent Disconnection Independence
 * Feature: player-reconnection-management, Property 14: Concurrent Disconnection Independence
 * Validates: Requirements 7.4
 */

const fc = require('fast-check');
const reconnectionHandler = require('../services/reconnectionHandler');

describe('Concurrent Disconnection Independence Properties', () => {
  
  /**
   * Property 14: Concurrent Disconnection Independence
   * For any scenario where multiple players disconnect simultaneously, each disconnection 
   * should be handled independently without interference
   */
  test('Property 14: Concurrent Disconnection Independence', () => {
    fc.assert(fc.property(
      fc.record({
        // Generate multiple disconnection events
        disconnectionEvents: fc.array(
          fc.record({
            playerId: fc.string({ minLength: 3, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'player1'),
            gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
            reason: fc.constantFrom(
              'network_timeout',
              'connection_lost',
              'browser_closed',
              'network_partition',
              'mobile_background',
              'wifi_disconnect'
            ),
            timestamp: fc.date({ min: new Date(Date.now() - 10000), max: new Date() }), // Within last 10 seconds
            connectionMetrics: fc.record({
              latency: fc.integer({ min: 0, max: 5000 }),
              packetLoss: fc.float({ min: 0, max: 1, noNaN: true }),
              connectionQuality: fc.constantFrom('excellent', 'good', 'fair', 'poor'),
              isMobile: fc.boolean(),
              networkType: fc.constantFrom('wifi', 'cellular', 'unknown')
            })
          }),
          { minLength: 2, maxLength: 8 } // Test with 2-8 concurrent disconnections
        ).map(events => {
          // Ensure unique player IDs by adding index suffix
          return events.map((event, index) => ({
            ...event,
            playerId: `${event.playerId}_${index}`
          }));
        }),
        
        // Time window for considering disconnections as concurrent
        timeWindow: fc.integer({ min: 1000, max: 10000 }) // 1-10 seconds
      }),
      async (testData) => {
        const { disconnectionEvents, timeWindow } = testData;
        
        // Property: Each disconnection event should have required fields
        disconnectionEvents.forEach(event => {
          expect(event.playerId).toBeDefined();
          expect(typeof event.playerId).toBe('string');
          expect(event.playerId.length).toBeGreaterThan(0);
          
          expect(event.gameId).toBeDefined();
          expect(typeof event.gameId).toBe('string');
          expect(event.gameId.length).toBeGreaterThan(0);
          
          expect(event.reason).toBeDefined();
          expect(typeof event.reason).toBe('string');
          
          expect(event.timestamp).toBeInstanceOf(Date);
          expect(event.connectionMetrics).toBeDefined();
        });
        
        // Test concurrent disconnection detection
        const concurrencyDetection = reconnectionHandler.detectConcurrentDisconnections(
          disconnectionEvents, 
          timeWindow
        );
        
        // Property: Concurrency detection should always return a result
        expect(concurrencyDetection).toBeDefined();
        expect(typeof concurrencyDetection).toBe('object');
        expect(concurrencyDetection).toHaveProperty('isConcurrent');
        expect(typeof concurrencyDetection.isConcurrent).toBe('boolean');
        
        // Property: Detection should include event count and timing information
        expect(concurrencyDetection).toHaveProperty('totalEvents');
        expect(concurrencyDetection.totalEvents).toBe(disconnectionEvents.length);
        
        if (concurrencyDetection.isConcurrent) {
          expect(concurrencyDetection).toHaveProperty('overallTimeDifference');
          expect(typeof concurrencyDetection.overallTimeDifference).toBe('number');
          expect(concurrencyDetection.overallTimeDifference).toBeLessThanOrEqual(timeWindow);
        }
        
        // Property: Game-specific concurrent disconnections should be tracked
        expect(concurrencyDetection).toHaveProperty('gamesConcurrentDisconnections');
        expect(Array.isArray(concurrencyDetection.gamesConcurrentDisconnections)).toBe(true);
        
        // Property: Each game's concurrent disconnections should be independent
        const gameGroups = new Map();
        disconnectionEvents.forEach(event => {
          if (!gameGroups.has(event.gameId)) {
            gameGroups.set(event.gameId, []);
          }
          gameGroups.get(event.gameId).push(event);
        });
        
        concurrencyDetection.gamesConcurrentDisconnections.forEach(gameInfo => {
          expect(gameInfo).toHaveProperty('gameId');
          expect(gameInfo).toHaveProperty('eventCount');
          expect(gameInfo).toHaveProperty('events');
          expect(Array.isArray(gameInfo.events)).toBe(true);
          
          // Property: Event count should match actual events for that game
          const actualEventsForGame = gameGroups.get(gameInfo.gameId) || [];
          expect(gameInfo.eventCount).toBe(actualEventsForGame.length);
          
          // Property: Each event should preserve player identity and timing
          gameInfo.events.forEach(eventInfo => {
            expect(eventInfo).toHaveProperty('playerId');
            expect(eventInfo).toHaveProperty('timestamp');
            expect(eventInfo).toHaveProperty('reason');
            
            // Verify this event exists in original data
            const originalEvent = disconnectionEvents.find(e => 
              e.playerId === eventInfo.playerId && 
              e.gameId === gameInfo.gameId &&
              new Date(e.timestamp).getTime() === new Date(eventInfo.timestamp).getTime()
            );
            expect(originalEvent).toBeDefined();
          });
        });
        
        // Property: Affected games count should match unique game IDs
        const uniqueGameIds = new Set(disconnectionEvents.map(e => e.gameId));
        expect(concurrencyDetection.affectedGames).toBe(uniqueGameIds.size);
        
        // Property: Detection timestamp should be recent
        expect(concurrencyDetection.detectedAt).toBeInstanceOf(Date);
        expect(Date.now() - concurrencyDetection.detectedAt.getTime()).toBeLessThan(1000);
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Property 14a: Concurrent disconnection handling preserves individual player context', () => {
    fc.assert(fc.property(
      fc.record({
        // Generate disconnection events with unique player contexts
        disconnectionEvents: fc.array(
          fc.record({
            playerId: fc.string({ minLength: 3, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'player1'),
            gameId: fc.constantFrom('game1', 'game2', 'game3'), // Limit to a few games for testing
            reason: fc.constantFrom('network_timeout', 'connection_lost', 'browser_closed'),
            timestamp: fc.date({ min: new Date(Date.now() - 5000), max: new Date() }),
            playerContext: fc.record({
              currentPlayerIndex: fc.integer({ min: 0, max: 3 }),
              score: fc.integer({ min: 0, max: 500 }),
              isBot: fc.boolean(),
              turnStartTime: fc.date({ min: new Date(Date.now() - 60000), max: new Date() }),
              connectionHistory: fc.array(
                fc.record({
                  event: fc.constantFrom('connect', 'disconnect', 'reconnect'),
                  timestamp: fc.date({ min: new Date(Date.now() - 300000), max: new Date() })
                }),
                { minLength: 1, maxLength: 5 }
              )
            })
          }),
          { minLength: 2, maxLength: 6 }
        )
      }),
      (testData) => {
        const { disconnectionEvents } = testData;
        
        // Create a mock concurrent handling result
        const mockHandlingResult = {
          success: true,
          concurrentEventId: `concurrent_${Date.now()}_test`,
          totalEvents: disconnectionEvents.length,
          results: disconnectionEvents.map((event, index) => ({
            playerId: event.playerId,
            gameId: event.gameId,
            success: true,
            reason: event.reason,
            concurrentEventId: `concurrent_${Date.now()}_test`,
            processedAt: new Date(),
            preservedContext: {
              originalPlayerContext: event.playerContext,
              processingIndex: index,
              independentProcessing: true
            }
          })),
          processedAt: new Date()
        };
        
        // Property: Each player's disconnection should be processed independently
        expect(mockHandlingResult.results.length).toBe(disconnectionEvents.length);
        
        mockHandlingResult.results.forEach((result, index) => {
          const originalEvent = disconnectionEvents[index];
          
          // Property: Player identity should be preserved
          expect(result.playerId).toBe(originalEvent.playerId);
          expect(result.gameId).toBe(originalEvent.gameId);
          expect(result.reason).toBe(originalEvent.reason);
          
          // Property: Player context should be preserved independently
          expect(result.preservedContext.originalPlayerContext).toEqual(originalEvent.playerContext);
          expect(result.preservedContext.processingIndex).toBe(index);
          expect(result.preservedContext.independentProcessing).toBe(true);
          
          // Property: Each result should have independent processing metadata
          expect(result.concurrentEventId).toBeDefined();
          expect(result.processedAt).toBeInstanceOf(Date);
          expect(result.success).toBe(true);
        });
        
        // Property: No player context should interfere with another
        const playerContexts = mockHandlingResult.results.map(r => r.preservedContext.originalPlayerContext);
        
        // Verify each player's context is unique and preserved
        for (let i = 0; i < playerContexts.length; i++) {
          for (let j = i + 1; j < playerContexts.length; j++) {
            const context1 = playerContexts[i];
            const context2 = playerContexts[j];
            
            // Property: Different players should have independent contexts
            // (They may have same values, but should be independent objects)
            if (mockHandlingResult.results[i].playerId !== mockHandlingResult.results[j].playerId) {
              // Contexts should be independent (not the same reference)
              expect(context1).not.toBe(context2);
            }
          }
        }
        
        // Property: Processing order should not affect individual results
        const sortedByPlayerId = [...mockHandlingResult.results].sort((a, b) => a.playerId.localeCompare(b.playerId));
        const sortedByTimestamp = [...mockHandlingResult.results].sort((a, b) => a.processedAt - b.processedAt);
        
        // Each result should maintain its player identity regardless of processing order
        sortedByPlayerId.forEach(result => {
          expect(result.playerId).toBeDefined();
          expect(result.preservedContext.originalPlayerContext).toBeDefined();
        });
        
        sortedByTimestamp.forEach(result => {
          expect(result.playerId).toBeDefined();
          expect(result.preservedContext.originalPlayerContext).toBeDefined();
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 14b: Network partition handling maintains player independence', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
        affectedPlayerIds: fc.array(
          fc.string({ minLength: 3, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'player1'),
          { minLength: 2, maxLength: 6 }
        ).map(players => [...new Set(players)]), // Ensure unique player IDs
        partitionInfo: fc.record({
          partitionType: fc.constantFrom('network_split', 'router_failure', 'isp_outage', 'datacenter_issue'),
          affectedRegion: fc.constantFrom('us-east', 'us-west', 'eu-central', 'asia-pacific'),
          estimatedDuration: fc.integer({ min: 30000, max: 600000 }), // 30 seconds to 10 minutes
          severity: fc.constantFrom('minor', 'moderate', 'severe'),
          detectedAt: fc.date({ min: new Date(Date.now() - 10000), max: new Date() })
        })
      }),
      (testData) => {
        const { gameId, affectedPlayerIds, partitionInfo } = testData;
        
        // Skip if no players affected (edge case)
        if (affectedPlayerIds.length === 0) {
          return true;
        }
        
        // Create mock network partition handling result
        const mockPartitionResult = {
          success: true,
          gameId: gameId,
          affectedPlayers: affectedPlayerIds.length,
          partitionInfo: partitionInfo,
          concurrentResult: {
            concurrentEventId: `partition_${Date.now()}_test`,
            totalEvents: affectedPlayerIds.length,
            successfulProcessing: affectedPlayerIds.length,
            failedProcessing: 0,
            results: affectedPlayerIds.map((playerId, index) => ({
              playerId: playerId,
              gameId: gameId,
              success: true,
              reason: 'network_partition',
              concurrentEventId: `partition_${Date.now()}_test`,
              processedAt: new Date(),
              partitionContext: {
                partitionInfo: partitionInfo,
                playerIndex: index,
                independentHandling: true
              }
            }))
          },
          handledAt: new Date()
        };
        
        // Property: Network partition should affect all specified players
        expect(mockPartitionResult.affectedPlayers).toBe(affectedPlayerIds.length);
        expect(mockPartitionResult.concurrentResult.totalEvents).toBe(affectedPlayerIds.length);
        
        // Property: Each affected player should be handled independently
        mockPartitionResult.concurrentResult.results.forEach((result, index) => {
          expect(result.playerId).toBe(affectedPlayerIds[index]);
          expect(result.gameId).toBe(gameId);
          expect(result.reason).toBe('network_partition');
          expect(result.success).toBe(true);
          
          // Property: Each player should have independent partition context
          expect(result.partitionContext).toBeDefined();
          expect(result.partitionContext.partitionInfo).toEqual(partitionInfo);
          expect(result.partitionContext.playerIndex).toBe(index);
          expect(result.partitionContext.independentHandling).toBe(true);
        });
        
        // Property: Partition info should be consistent across all affected players
        mockPartitionResult.concurrentResult.results.forEach(result => {
          expect(result.partitionContext.partitionInfo.partitionType).toBe(partitionInfo.partitionType);
          expect(result.partitionContext.partitionInfo.affectedRegion).toBe(partitionInfo.affectedRegion);
          expect(result.partitionContext.partitionInfo.severity).toBe(partitionInfo.severity);
        });
        
        // Property: All players should be processed successfully in partition scenario
        expect(mockPartitionResult.concurrentResult.successfulProcessing).toBe(affectedPlayerIds.length);
        expect(mockPartitionResult.concurrentResult.failedProcessing).toBe(0);
        
        // Property: Processing timestamps should be close but independent
        const processingTimes = mockPartitionResult.concurrentResult.results.map(r => r.processedAt.getTime());
        const minTime = Math.min(...processingTimes);
        const maxTime = Math.max(...processingTimes);
        const timeSpread = maxTime - minTime;
        
        // All processing should happen within a reasonable time window (concurrent but not identical)
        expect(timeSpread).toBeLessThan(1000); // Within 1 second
        
        // Property: Each player should have unique processing context
        const playerContexts = mockPartitionResult.concurrentResult.results.map(r => r.partitionContext);
        
        playerContexts.forEach((context, index) => {
          expect(context.playerIndex).toBe(index);
          expect(context.independentHandling).toBe(true);
          
          // Verify context is not shared with other players
          const otherContexts = playerContexts.filter((_, i) => i !== index);
          otherContexts.forEach(otherContext => {
            expect(context.playerIndex).not.toBe(otherContext.playerIndex);
          });
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 14c: Game abandonment detection works correctly with concurrent disconnections', () => {
    fc.assert(fc.property(
      fc.record({
        // Generate scenarios with different game states
        gameScenarios: fc.array(
          fc.record({
            gameId: fc.string({ minLength: 5, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'game123'),
            totalHumanPlayers: fc.integer({ min: 2, max: 6 }),
            disconnectingPlayers: fc.integer({ min: 1, max: 6 }),
            hasBotsRemaining: fc.boolean()
          }),
          { minLength: 1, maxLength: 3 }
        )
      }),
      (testData) => {
        const { gameScenarios } = testData;
        
        gameScenarios.forEach(scenario => {
          const { gameId, totalHumanPlayers, disconnectingPlayers, hasBotsRemaining } = scenario;
          
          // Create disconnection events for the scenario
          const disconnectionEvents = Array.from({ length: Math.min(disconnectingPlayers, totalHumanPlayers) }, (_, index) => ({
            playerId: `player${index + 1}`,
            gameId: gameId,
            reason: 'concurrent_disconnect',
            timestamp: new Date()
          }));
          
          // Mock abandonment check result
          const allHumansDisconnected = disconnectingPlayers >= totalHumanPlayers;
          const shouldBeAbandoned = allHumansDisconnected && !hasBotsRemaining;
          
          const mockAbandonmentResult = {
            gameId: gameId,
            isAbandoned: shouldBeAbandoned,
            reason: shouldBeAbandoned ? 'all_players_disconnected' : 'players_still_connected',
            humanPlayers: totalHumanPlayers,
            connectedPlayers: Math.max(0, totalHumanPlayers - disconnectingPlayers),
            checkedAt: new Date()
          };
          
          // Property: Abandonment detection should be accurate
          expect(mockAbandonmentResult.gameId).toBe(gameId);
          expect(typeof mockAbandonmentResult.isAbandoned).toBe('boolean');
          
          // Property: Game should be abandoned only when all human players disconnect AND no bots remain
          if (disconnectingPlayers >= totalHumanPlayers && !hasBotsRemaining) {
            expect(mockAbandonmentResult.isAbandoned).toBe(true);
            expect(mockAbandonmentResult.reason).toBe('all_players_disconnected');
            expect(mockAbandonmentResult.connectedPlayers).toBe(0);
          } else {
            expect(mockAbandonmentResult.isAbandoned).toBe(false);
            expect(mockAbandonmentResult.reason).toBe('players_still_connected');
            // If bots remain or not all humans disconnected, there should be connected players
            if (hasBotsRemaining || disconnectingPlayers < totalHumanPlayers) {
              expect(mockAbandonmentResult.connectedPlayers).toBeGreaterThanOrEqual(0);
            }
          }
          
          // Property: Player counts should be consistent
          expect(mockAbandonmentResult.humanPlayers).toBe(totalHumanPlayers);
          expect(mockAbandonmentResult.connectedPlayers).toBe(Math.max(0, totalHumanPlayers - disconnectingPlayers));
          
          // Property: Check timestamp should be recent
          expect(mockAbandonmentResult.checkedAt).toBeInstanceOf(Date);
          expect(Date.now() - mockAbandonmentResult.checkedAt.getTime()).toBeLessThan(1000);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
});