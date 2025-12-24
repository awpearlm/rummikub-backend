/**
 * Property-Based Tests for Comprehensive Event Logging
 * Feature: player-reconnection-management, Property 20: Comprehensive Event Logging
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

const fc = require('fast-check');
const { AnalyticsLogger } = require('../services/analyticsLogger');

describe('Comprehensive Event Logging Property Tests', () => {
  let analyticsLogger;

  beforeEach(() => {
    // Create a fresh analytics logger instance for each test
    analyticsLogger = new AnalyticsLogger();
  });

  afterEach(() => {
    // Clean up after each test
    if (analyticsLogger) {
      if (analyticsLogger.stopMetricsUpdater) {
        analyticsLogger.stopMetricsUpdater();
      }
      if (analyticsLogger.resetAnalytics) {
        analyticsLogger.resetAnalytics();
      }
    }
  });

  /**
   * Property 20: Comprehensive Event Logging
   * For any disconnection, reconnection, or pause event, the system should log complete information 
   * including timestamp, player, reason, and relevant metrics
   * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
   */
  describe('Property 20: Comprehensive Event Logging', () => {
    test('should log all disconnection events with complete information', () => {
      fc.assert(fc.property(
        // Generate random disconnection event data
        fc.record({
          playerId: fc.string({ minLength: 1, maxLength: 20 }),
          gameId: fc.string({ minLength: 1, maxLength: 20 }),
          reason: fc.oneof(
            fc.constant('network_timeout'),
            fc.constant('client_disconnect'),
            fc.constant('heartbeat_timeout'),
            fc.constant('mobile_background'),
            fc.constant('connection_lost')
          ),
          isMobile: fc.boolean(),
          networkType: fc.oneof(
            fc.constant('wifi'),
            fc.constant('cellular'),
            fc.constant('unknown')
          ),
          connectionQuality: fc.oneof(
            fc.constant('excellent'),
            fc.constant('good'),
            fc.constant('fair'),
            fc.constant('poor')
          ),
          latency: fc.option(fc.integer({ min: 10, max: 2000 })),
          packetLoss: fc.float({ min: 0, max: 1 }),
          sessionDuration: fc.integer({ min: 1000, max: 3600000 }),
          previousDisconnections: fc.integer({ min: 0, max: 10 }),
          reconnectionAttempts: fc.integer({ min: 0, max: 5 }),
          isCurrentPlayer: fc.boolean(),
          turnNumber: fc.integer({ min: 0, max: 100 }),
          playerCount: fc.integer({ min: 2, max: 8 }),
          gamePhase: fc.oneof(
            fc.constant('waiting'),
            fc.constant('playing'),
            fc.constant('ended')
          )
        }),
        (eventData) => {
          // Log the disconnection event
          const loggedEvent = analyticsLogger.logDisconnectionEvent(eventData);
          
          // Verify event was logged successfully
          expect(loggedEvent).not.toBeNull();
          expect(loggedEvent.eventType).toBe('DISCONNECTION');
          
          // Verify all required fields are present with correct types
          expect(typeof loggedEvent.timestamp).toBe('object');
          expect(loggedEvent.timestamp instanceof Date).toBe(true);
          expect(typeof loggedEvent.playerId).toBe('string');
          expect(loggedEvent.playerId).toBe(eventData.playerId);
          expect(typeof loggedEvent.gameId).toBe('string');
          expect(loggedEvent.gameId).toBe(eventData.gameId);
          expect(typeof loggedEvent.reason).toBe('string');
          expect(loggedEvent.reason).toBe(eventData.reason);
          
          // Verify connection info is preserved
          expect(typeof loggedEvent.connectionInfo).toBe('object');
          expect(loggedEvent.connectionInfo.isMobile).toBe(eventData.isMobile);
          expect(loggedEvent.connectionInfo.networkType).toBe(eventData.networkType);
          expect(loggedEvent.connectionInfo.connectionQuality).toBe(eventData.connectionQuality);
          
          // Verify game state is preserved
          expect(typeof loggedEvent.gameState).toBe('object');
          expect(loggedEvent.gameState.isCurrentPlayer).toBe(eventData.isCurrentPlayer);
          expect(loggedEvent.gameState.turnNumber).toBe(eventData.turnNumber);
          expect(loggedEvent.gameState.playerCount).toBe(eventData.playerCount);
          
          // Verify session info is preserved
          expect(typeof loggedEvent.sessionInfo).toBe('object');
          expect(loggedEvent.sessionInfo.sessionDuration).toBe(eventData.sessionDuration);
          expect(loggedEvent.sessionInfo.previousDisconnections).toBe(eventData.previousDisconnections);
          
          // Verify event is stored in analytics
          const events = analyticsLogger.disconnectionEvents;
          expect(events.length).toBe(1);
          expect(events[0]).toBe(loggedEvent);
          
          // Verify metrics are updated
          const summary = analyticsLogger.getAnalyticsSummary();
          expect(summary.overview.totalDisconnections).toBe(1);
          expect(summary.disconnections.byReason[eventData.reason]).toBe(1);
        }
      ), { numRuns: 25 });
    });

    test('should log all reconnection events with complete information', () => {
      fc.assert(fc.property(
        // Generate random reconnection event data
        fc.record({
          playerId: fc.string({ minLength: 1, maxLength: 20 }),
          gameId: fc.string({ minLength: 1, maxLength: 20 }),
          success: fc.boolean(),
          attemptNumber: fc.integer({ min: 1, max: 10 }),
          reconnectionTime: fc.integer({ min: 100, max: 30000 }),
          disconnectionDuration: fc.integer({ min: 1000, max: 300000 }),
          reason: fc.oneof(
            fc.constant('successful'),
            fc.constant('failed'),
            fc.constant('timeout'),
            fc.constant('network_error')
          ),
          isMobile: fc.boolean(),
          networkType: fc.oneof(
            fc.constant('wifi'),
            fc.constant('cellular'),
            fc.constant('unknown')
          ),
          connectionQuality: fc.oneof(
            fc.constant('excellent'),
            fc.constant('good'),
            fc.constant('fair'),
            fc.constant('poor')
          ),
          wasPaused: fc.boolean(),
          wasResumed: fc.boolean(),
          gracePeriodActive: fc.boolean(),
          gracePeriodRemaining: fc.integer({ min: 0, max: 300000 }),
          stateRestorationSuccess: fc.boolean(),
          dataIntegrityValid: fc.boolean(),
          fallbackUsed: fc.boolean()
        }),
        (eventData) => {
          // Log the reconnection event
          const loggedEvent = analyticsLogger.logReconnectionEvent(eventData);
          
          // Verify event was logged successfully
          expect(loggedEvent).not.toBeNull();
          expect(loggedEvent.eventType).toBe('RECONNECTION');
          
          // Verify all required fields are present with correct types
          expect(typeof loggedEvent.timestamp).toBe('object');
          expect(loggedEvent.timestamp instanceof Date).toBe(true);
          expect(typeof loggedEvent.playerId).toBe('string');
          expect(loggedEvent.playerId).toBe(eventData.playerId);
          expect(typeof loggedEvent.gameId).toBe('string');
          expect(loggedEvent.gameId).toBe(eventData.gameId);
          expect(typeof loggedEvent.success).toBe('boolean');
          expect(loggedEvent.success).toBe(eventData.success);
          expect(typeof loggedEvent.attemptNumber).toBe('number');
          expect(loggedEvent.attemptNumber).toBe(eventData.attemptNumber);
          
          // Verify timing information is preserved
          expect(typeof loggedEvent.reconnectionTime).toBe('number');
          expect(loggedEvent.reconnectionTime).toBe(eventData.reconnectionTime);
          expect(typeof loggedEvent.disconnectionDuration).toBe('number');
          expect(loggedEvent.disconnectionDuration).toBe(eventData.disconnectionDuration);
          
          // Verify connection info is preserved
          expect(typeof loggedEvent.connectionInfo).toBe('object');
          expect(loggedEvent.connectionInfo.isMobile).toBe(eventData.isMobile);
          expect(loggedEvent.connectionInfo.networkType).toBe(eventData.networkType);
          
          // Verify game state is preserved
          expect(typeof loggedEvent.gameState).toBe('object');
          expect(loggedEvent.gameState.wasPaused).toBe(eventData.wasPaused);
          expect(loggedEvent.gameState.wasResumed).toBe(eventData.wasResumed);
          expect(loggedEvent.gameState.gracePeriodActive).toBe(eventData.gracePeriodActive);
          
          // Verify state restoration info is preserved
          expect(typeof loggedEvent.stateRestoration).toBe('object');
          expect(loggedEvent.stateRestoration.success).toBe(eventData.stateRestorationSuccess);
          expect(loggedEvent.stateRestoration.dataIntegrityValid).toBe(eventData.dataIntegrityValid);
          expect(loggedEvent.stateRestoration.fallbackUsed).toBe(eventData.fallbackUsed);
          
          // Verify event is stored in analytics
          const events = analyticsLogger.reconnectionEvents;
          expect(events.length).toBe(1);
          expect(events[0]).toBe(loggedEvent);
          
          // Verify metrics are updated
          const summary = analyticsLogger.getAnalyticsSummary();
          expect(summary.overview.totalReconnectionAttempts).toBe(1);
          if (eventData.success) {
            expect(summary.reconnections.successfulReconnections).toBe(1);
          } else {
            expect(summary.reconnections.failedReconnections).toBe(1);
          }
        }
      ), { numRuns: 25 });
    });

    test('should log all pause events with complete information', () => {
      fc.assert(fc.property(
        // Generate random pause event data
        fc.record({
          gameId: fc.string({ minLength: 1, maxLength: 20 }),
          pauseType: fc.oneof(
            fc.constant('start'),
            fc.constant('end'),
            fc.constant('expired')
          ),
          reason: fc.oneof(
            fc.constant('CURRENT_PLAYER_DISCONNECT'),
            fc.constant('NETWORK_INSTABILITY'),
            fc.constant('MANUAL_PAUSE')
          ),
          playerId: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
          duration: fc.integer({ min: 0, max: 600000 }),
          currentPlayerIndex: fc.integer({ min: 0, max: 7 }),
          turnNumber: fc.integer({ min: 0, max: 100 }),
          playerCount: fc.integer({ min: 2, max: 8 }),
          timerRemaining: fc.integer({ min: 0, max: 60000 }),
          gracePeriodStarted: fc.boolean(),
          gracePeriodDuration: fc.integer({ min: 0, max: 300000 }),
          gracePeriodTargetPlayer: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
        }),
        (eventData) => {
          // Log the pause event
          const loggedEvent = analyticsLogger.logPauseEvent(eventData);
          
          // Verify event was logged successfully
          expect(loggedEvent).not.toBeNull();
          expect(loggedEvent.eventType).toBe('PAUSE');
          
          // Verify all required fields are present with correct types
          expect(typeof loggedEvent.timestamp).toBe('object');
          expect(loggedEvent.timestamp instanceof Date).toBe(true);
          expect(typeof loggedEvent.gameId).toBe('string');
          expect(loggedEvent.gameId).toBe(eventData.gameId);
          expect(typeof loggedEvent.pauseType).toBe('string');
          expect(loggedEvent.pauseType).toBe(eventData.pauseType);
          expect(typeof loggedEvent.reason).toBe('string');
          expect(loggedEvent.reason).toBe(eventData.reason);
          expect(typeof loggedEvent.duration).toBe('number');
          expect(loggedEvent.duration).toBe(eventData.duration);
          
          // Verify game state is preserved
          expect(typeof loggedEvent.gameState).toBe('object');
          expect(loggedEvent.gameState.currentPlayerIndex).toBe(eventData.currentPlayerIndex);
          expect(loggedEvent.gameState.turnNumber).toBe(eventData.turnNumber);
          expect(loggedEvent.gameState.playerCount).toBe(eventData.playerCount);
          expect(loggedEvent.gameState.timerRemaining).toBe(eventData.timerRemaining);
          
          // Verify grace period info is preserved
          expect(typeof loggedEvent.gracePeriod).toBe('object');
          expect(loggedEvent.gracePeriod.started).toBe(eventData.gracePeriodStarted);
          expect(loggedEvent.gracePeriod.duration).toBe(eventData.gracePeriodDuration);
          
          // Verify event is stored in analytics
          const events = analyticsLogger.pauseEvents;
          expect(events.length).toBe(1);
          expect(events[0]).toBe(loggedEvent);
          
          // Verify metrics are updated for start events
          if (eventData.pauseType === 'start') {
            const summary = analyticsLogger.getAnalyticsSummary();
            expect(summary.overview.totalPauses).toBe(1);
            expect(summary.pauses.byReason[eventData.reason]).toBe(1);
          }
        }
      ), { numRuns: 25 });
    });

    test('should log all grace period events with complete information', () => {
      fc.assert(fc.property(
        // Generate random grace period event data
        fc.record({
          gameId: fc.string({ minLength: 1, maxLength: 20 }),
          gracePeriodType: fc.oneof(
            fc.constant('start'),
            fc.constant('end'),
            fc.constant('expired')
          ),
          targetPlayerId: fc.string({ minLength: 1, maxLength: 20 }),
          duration: fc.integer({ min: 180000, max: 300000 }),
          timeRemaining: fc.integer({ min: 0, max: 300000 }),
          outcome: fc.option(fc.oneof(
            fc.constant('reconnected'),
            fc.constant('expired'),
            fc.constant('cancelled')
          )),
          connectionQuality: fc.oneof(
            fc.constant('excellent'),
            fc.constant('good'),
            fc.constant('fair'),
            fc.constant('poor')
          ),
          isMobile: fc.boolean(),
          networkType: fc.oneof(
            fc.constant('wifi'),
            fc.constant('cellular'),
            fc.constant('unknown')
          ),
          isExtended: fc.boolean()
        }),
        (eventData) => {
          // Log the grace period event
          const loggedEvent = analyticsLogger.logGracePeriodEvent(eventData);
          
          // Verify event was logged successfully
          expect(loggedEvent).not.toBeNull();
          expect(loggedEvent.eventType).toBe('GRACE_PERIOD');
          
          // Verify all required fields are present with correct types
          expect(typeof loggedEvent.timestamp).toBe('object');
          expect(loggedEvent.timestamp instanceof Date).toBe(true);
          expect(typeof loggedEvent.gameId).toBe('string');
          expect(loggedEvent.gameId).toBe(eventData.gameId);
          expect(typeof loggedEvent.gracePeriodType).toBe('string');
          expect(loggedEvent.gracePeriodType).toBe(eventData.gracePeriodType);
          expect(typeof loggedEvent.targetPlayerId).toBe('string');
          expect(loggedEvent.targetPlayerId).toBe(eventData.targetPlayerId);
          expect(typeof loggedEvent.duration).toBe('number');
          expect(loggedEvent.duration).toBe(eventData.duration);
          expect(typeof loggedEvent.timeRemaining).toBe('number');
          expect(loggedEvent.timeRemaining).toBe(eventData.timeRemaining);
          
          // Verify connection metrics are preserved
          expect(typeof loggedEvent.connectionMetrics).toBe('object');
          expect(loggedEvent.connectionMetrics.connectionQuality).toBe(eventData.connectionQuality);
          expect(loggedEvent.connectionMetrics.isMobile).toBe(eventData.isMobile);
          expect(loggedEvent.connectionMetrics.networkType).toBe(eventData.networkType);
          expect(loggedEvent.connectionMetrics.isExtended).toBe(eventData.isExtended);
          
          // Verify event is stored in analytics
          const events = analyticsLogger.gracePeriodEvents;
          expect(events.length).toBe(1);
          expect(events[0]).toBe(loggedEvent);
          
          // Verify metrics are updated for start events
          if (eventData.gracePeriodType === 'start') {
            const summary = analyticsLogger.getAnalyticsSummary();
            expect(summary.overview.totalGracePeriods).toBe(1);
          }
        }
      ), { numRuns: 25 });
    });

    test('should log all continuation events with complete information', () => {
      fc.assert(fc.property(
        // Generate random continuation event data
        fc.record({
          gameId: fc.string({ minLength: 1, maxLength: 20 }),
          decision: fc.oneof(
            fc.constant('skip_turn'),
            fc.constant('add_bot'),
            fc.constant('end_game')
          ),
          targetPlayerId: fc.string({ minLength: 1, maxLength: 20 }),
          totalVotes: fc.integer({ min: 1, max: 8 }),
          totalPlayers: fc.integer({ min: 2, max: 8 }),
          votingDuration: fc.integer({ min: 1000, max: 60000 }),
          turnNumber: fc.integer({ min: 0, max: 100 }),
          playerCount: fc.integer({ min: 2, max: 8 }),
          remainingPlayers: fc.integer({ min: 1, max: 8 }),
          gameEnded: fc.boolean(),
          botAdded: fc.boolean(),
          turnSkipped: fc.boolean()
        }),
        (eventData) => {
          // Generate vote counts that match the decision
          const voteCounts = {
            skip_turn: 0,
            add_bot: 0,
            end_game: 0
          };
          voteCounts[eventData.decision] = eventData.totalVotes;
          eventData.voteCounts = voteCounts;
          
          // Log the continuation event
          const loggedEvent = analyticsLogger.logContinuationEvent(eventData);
          
          // Verify event was logged successfully
          expect(loggedEvent).not.toBeNull();
          expect(loggedEvent.eventType).toBe('CONTINUATION');
          
          // Verify all required fields are present with correct types
          expect(typeof loggedEvent.timestamp).toBe('object');
          expect(loggedEvent.timestamp instanceof Date).toBe(true);
          expect(typeof loggedEvent.gameId).toBe('string');
          expect(loggedEvent.gameId).toBe(eventData.gameId);
          expect(typeof loggedEvent.decision).toBe('string');
          expect(loggedEvent.decision).toBe(eventData.decision);
          expect(typeof loggedEvent.targetPlayerId).toBe('string');
          expect(loggedEvent.targetPlayerId).toBe(eventData.targetPlayerId);
          
          // Verify voting info is preserved
          expect(typeof loggedEvent.votingInfo).toBe('object');
          expect(loggedEvent.votingInfo.totalVotes).toBe(eventData.totalVotes);
          expect(loggedEvent.votingInfo.totalPlayers).toBe(eventData.totalPlayers);
          expect(loggedEvent.votingInfo.votingDuration).toBe(eventData.votingDuration);
          expect(typeof loggedEvent.votingInfo.voteCounts).toBe('object');
          
          // Verify game state is preserved
          expect(typeof loggedEvent.gameState).toBe('object');
          expect(loggedEvent.gameState.turnNumber).toBe(eventData.turnNumber);
          expect(loggedEvent.gameState.playerCount).toBe(eventData.playerCount);
          expect(loggedEvent.gameState.remainingPlayers).toBe(eventData.remainingPlayers);
          
          // Verify outcome is preserved
          expect(typeof loggedEvent.outcome).toBe('object');
          expect(loggedEvent.outcome.gameEnded).toBe(eventData.gameEnded);
          expect(loggedEvent.outcome.botAdded).toBe(eventData.botAdded);
          expect(loggedEvent.outcome.turnSkipped).toBe(eventData.turnSkipped);
          
          // Verify event is stored in analytics
          const events = analyticsLogger.continuationEvents;
          expect(events.length).toBe(1);
          expect(events[0]).toBe(loggedEvent);
          
          // Verify metrics are updated
          const summary = analyticsLogger.getAnalyticsSummary();
          expect(summary.overview.totalContinuationDecisions).toBe(1);
          expect(summary.continuations.byType[eventData.decision]).toBe(1);
        }
      ), { numRuns: 25 });
    });

    test('should maintain event history within configured limits', () => {
      fc.assert(fc.property(
        // Generate array of events that exceeds the limit
        fc.array(
          fc.record({
            playerId: fc.string({ minLength: 1, maxLength: 10 }),
            gameId: fc.string({ minLength: 1, maxLength: 10 }),
            reason: fc.constant('test_reason')
          }),
          { minLength: 50, maxLength: 200 }
        ),
        (events) => {
          // Set a small limit for testing
          const originalLimit = analyticsLogger.config.maxEventHistory;
          analyticsLogger.config.maxEventHistory = 100;
          
          try {
            // Log all events
            events.forEach(eventData => {
              analyticsLogger.logDisconnectionEvent(eventData);
            });
            
            // Verify event history is trimmed to the limit
            expect(analyticsLogger.disconnectionEvents.length).toBeLessThanOrEqual(100);
            
            // If we logged more than 100 events, verify only the most recent ones are kept
            if (events.length > 100) {
              expect(analyticsLogger.disconnectionEvents.length).toBe(100);
              
              // Verify the events are the most recent ones (last 100 from the input)
              const expectedEvents = events.slice(-100);
              for (let i = 0; i < 100; i++) {
                expect(analyticsLogger.disconnectionEvents[i].playerId).toBe(expectedEvents[i].playerId);
                expect(analyticsLogger.disconnectionEvents[i].gameId).toBe(expectedEvents[i].gameId);
              }
            }
          } finally {
            // Restore original limit
            analyticsLogger.config.maxEventHistory = originalLimit;
          }
        }
      ), { numRuns: 15 }); // Fewer runs for this test as it's more expensive
    });

    test('should calculate metrics correctly across multiple events', () => {
      fc.assert(fc.property(
        // Generate multiple events of different types
        fc.record({
          disconnections: fc.array(
            fc.record({
              playerId: fc.string({ minLength: 1, maxLength: 10 }),
              gameId: fc.string({ minLength: 1, maxLength: 10 }),
              reason: fc.oneof(
                fc.constant('network_timeout'),
                fc.constant('client_disconnect'),
                fc.constant('heartbeat_timeout')
              ),
              isMobile: fc.boolean()
            }),
            { minLength: 1, maxLength: 20 }
          ),
          reconnections: fc.array(
            fc.record({
              playerId: fc.string({ minLength: 1, maxLength: 10 }),
              gameId: fc.string({ minLength: 1, maxLength: 10 }),
              success: fc.boolean(),
              reconnectionTime: fc.integer({ min: 100, max: 10000 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          pauses: fc.array(
            fc.record({
              gameId: fc.string({ minLength: 1, maxLength: 10 }),
              pauseType: fc.oneof(fc.constant('start'), fc.constant('end')),
              reason: fc.constant('CURRENT_PLAYER_DISCONNECT'),
              duration: fc.integer({ min: 1000, max: 60000 })
            }),
            { minLength: 1, maxLength: 20 }
          )
        }),
        (eventData) => {
          // Log all disconnection events
          eventData.disconnections.forEach(event => {
            analyticsLogger.logDisconnectionEvent(event);
          });
          
          // Log all reconnection events
          eventData.reconnections.forEach(event => {
            analyticsLogger.logReconnectionEvent(event);
          });
          
          // Log all pause events
          eventData.pauses.forEach(event => {
            analyticsLogger.logPauseEvent(event);
          });
          
          // Get analytics summary
          const summary = analyticsLogger.getAnalyticsSummary();
          
          // Verify disconnection metrics
          expect(summary.overview.totalDisconnections).toBe(eventData.disconnections.length);
          
          // Verify reconnection metrics
          expect(summary.overview.totalReconnectionAttempts).toBe(eventData.reconnections.length);
          const successfulReconnections = eventData.reconnections.filter(r => r.success).length;
          const failedReconnections = eventData.reconnections.filter(r => !r.success).length;
          expect(summary.reconnections.successfulReconnections).toBe(successfulReconnections);
          expect(summary.reconnections.failedReconnections).toBe(failedReconnections);
          
          // Verify success rate calculation
          if (eventData.reconnections.length > 0) {
            const expectedSuccessRate = (successfulReconnections / eventData.reconnections.length) * 100;
            expect(summary.reconnections.successRate).toBeCloseTo(expectedSuccessRate, 2);
          }
          
          // Verify pause metrics
          const pauseStarts = eventData.pauses.filter(p => p.pauseType === 'start').length;
          expect(summary.overview.totalPauses).toBe(pauseStarts);
          
          // Verify mobile disconnection rate
          const mobileDisconnections = eventData.disconnections.filter(d => d.isMobile).length;
          if (eventData.disconnections.length > 0) {
            const expectedMobileRate = (mobileDisconnections / eventData.disconnections.length) * 100;
            expect(summary.disconnections.mobileDisconnectionRate).toBeCloseTo(expectedMobileRate, 2);
          }
        }
      ), { numRuns: 20 });
    });

    test('should provide time-based event filtering', () => {
      fc.assert(fc.property(
        // Generate events with different timestamps
        fc.array(
          fc.record({
            playerId: fc.string({ minLength: 1, maxLength: 10 }),
            gameId: fc.string({ minLength: 1, maxLength: 10 }),
            reason: fc.constant('test_reason'),
            // Generate timestamp within last 24 hours
            timestampOffset: fc.integer({ min: 0, max: 86400000 }) // 24 hours in ms
          }),
          { minLength: 5, maxLength: 50 }
        ),
        (eventDataArray) => {
          const now = new Date();
          
          // Log events with different timestamps
          eventDataArray.forEach((eventData, index) => {
            const event = analyticsLogger.logDisconnectionEvent(eventData);
            // Manually set timestamp to test filtering
            event.timestamp = new Date(now.getTime() - eventData.timestampOffset);
          });
          
          // Define time range (last 12 hours)
          const startTime = new Date(now.getTime() - 43200000); // 12 hours ago
          const endTime = now;
          
          // Get events in time range
          const filteredEvents = analyticsLogger.getEventsInTimeRange('disconnection', startTime, endTime);
          
          // Verify all returned events are within the time range
          filteredEvents.forEach(event => {
            expect(event.timestamp >= startTime).toBe(true);
            expect(event.timestamp <= endTime).toBe(true);
          });
          
          // Verify we get the expected number of events
          const expectedCount = eventDataArray.filter(eventData => {
            const eventTime = new Date(now.getTime() - eventData.timestampOffset);
            return eventTime >= startTime && eventTime <= endTime;
          }).length;
          
          expect(filteredEvents.length).toBe(expectedCount);
        }
      ), { numRuns: 10 });
    });
  });
});