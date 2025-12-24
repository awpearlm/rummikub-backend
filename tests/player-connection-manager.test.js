/**
 * Property-Based Tests for Player Connection Manager
 * Feature: player-reconnection-management, Property 3: Real-time Status Updates
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5
 */

const fc = require('fast-check');
const PlayerConnectionManager = require('../services/playerConnectionManager');
const EventEmitter = require('events');

// Mock socket for testing
class MockSocket extends EventEmitter {
  constructor(id, userAgent = 'Mozilla/5.0') {
    super();
    this.id = id;
    this.handshake = {
      headers: {
        'user-agent': userAgent
      },
      address: '127.0.0.1'
    };
    this.conn = {
      transport: { name: 'websocket' }
    };
  }
  
  join(room) {
    // Mock join room
  }
  
  emit(event, data) {
    // Mock emit - trigger event for testing
    super.emit(event, data);
  }
}

describe('Player Connection Manager Properties', () => {
  let connectionManager;
  
  beforeEach(() => {
    connectionManager = new PlayerConnectionManager();
    // Increase max listeners to prevent warnings during property-based testing
    connectionManager.setMaxListeners(100);
  });
  
  afterEach(async () => {
    // Clean up any timers and connections
    if (connectionManager) {
      // Remove all event listeners to prevent memory leaks
      connectionManager.removeAllListeners();
      
      // Clean up all player connections
      const playerIds = Array.from(connectionManager.playerConnections.keys());
      for (const playerId of playerIds) {
        connectionManager.removePlayer(playerId);
      }
      
      // Clear all maps
      connectionManager.playerConnections.clear();
      connectionManager.socketToPlayer.clear();
      connectionManager.statusTimers.clear();
      connectionManager.heartbeatTimers.clear();
    }
    
    // Wait a bit for async cleanup
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  /**
   * Property 3: Real-time Status Updates
   * For any player connection status change, all other players should immediately 
   * see the updated status with appropriate visual indicators and notifications
   */
  test('Property 3: Real-time Status Updates', () => {
    fc.assert(fc.property(
      fc.record({
        // Generate multiple players for testing status updates
        players: fc.array(
          fc.record({
            playerId: fc.integer({ min: 1, max: 999999 }).map(id => `player_${id}_${Math.random().toString(36).substring(7)}`),
            socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
            gameId: fc.constant('game123'), // Use same game ID for all players
            userAgent: fc.oneof(
              fc.constant('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'),
              fc.constant('Mozilla/5.0 (Android 10; Mobile)'),
              fc.constant('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
            )
          }),
          { minLength: 2, maxLength: 4 }
        ),
        
        // Status transitions to test
        statusTransitions: fc.array(
          fc.record({
            playerIndex: fc.integer({ min: 0, max: 3 }),
            newStatus: fc.constantFrom('DISCONNECTING', 'RECONNECTING'), // Only valid transitions from CONNECTED
            reason: fc.constantFrom('network_timeout', 'heartbeat_timeout', 'manual_disconnect', 'reconnection_attempt', 'app_backgrounding')
          }),
          { minLength: 1, maxLength: 6 }
        )
      }),
      (testData) => {
        // Clean up any existing connections before starting this iteration
        const existingPlayerIds = Array.from(connectionManager.playerConnections.keys());
        for (const playerId of existingPlayerIds) {
          connectionManager.removePlayer(playerId);
        }
        connectionManager.playerConnections.clear();
        connectionManager.socketToPlayer.clear();
        connectionManager.statusTimers.clear();
        connectionManager.heartbeatTimers.clear();
        
        // Ensure we have valid player indices
        const validPlayers = testData.players.slice(0, Math.min(testData.players.length, 4));
        if (validPlayers.length < 2) return true; // Skip if not enough players
        
        // Track status update events
        const statusUpdateEvents = [];
        const connectionEvents = [];
        
        connectionManager.on('statusUpdated', (event) => {
          statusUpdateEvents.push({
            playerId: event.playerId,
            oldStatus: event.oldStatus,
            newStatus: event.newStatus,
            reason: event.reason,
            timestamp: Date.now()
          });
        });
        
        connectionManager.on('connectionRegistered', (event) => {
          connectionEvents.push({
            type: 'registered',
            playerId: event.playerId,
            timestamp: Date.now()
          });
        });
        
        connectionManager.on('disconnectionConfirmed', (event) => {
          connectionEvents.push({
            type: 'disconnected',
            playerId: event.playerId,
            reason: event.reason,
            timestamp: Date.now()
          });
        });
        
        connectionManager.on('reconnectionSuccessful', (event) => {
          connectionEvents.push({
            type: 'reconnected',
            playerId: event.playerId,
            timestamp: Date.now()
          });
        });
        
        // Register all players
        validPlayers.forEach(player => {
          const socket = new MockSocket(player.socketId, player.userAgent);
          const connectionInfo = connectionManager.registerConnection(socket, player.gameId, player.playerId);
          
          // Property: Registration should create connection info immediately
          expect(connectionInfo).toBeDefined();
          expect(connectionInfo.playerId).toBe(player.playerId);
          expect(connectionInfo.status).toBe('CONNECTED');
          expect(connectionInfo.isMobile).toBe(connectionManager.detectMobileDevice(socket));
        });
        
        // Property: All players should be registered and have CONNECTED status
        expect(connectionManager.playerConnections.size).toBe(validPlayers.length);
        validPlayers.forEach(player => {
          const status = connectionManager.getPlayerStatus(player.playerId);
          expect(status.status).toBe('CONNECTED');
          expect(status.playerId).toBe(player.playerId);
        });
        
        // Apply status transitions and verify real-time updates
        const validTransitions = testData.statusTransitions.filter(
          transition => transition.playerIndex < validPlayers.length
        );
        
        let successfulTransitions = 0;
        validTransitions.forEach((transition) => {
          const targetPlayer = validPlayers[transition.playerIndex];
          const initialEventCount = statusUpdateEvents.length;
          
          // Apply status change
          const success = connectionManager.updatePlayerStatus(
            targetPlayer.playerId, 
            transition.newStatus, 
            transition.reason
          );
          
          if (success) {
            successfulTransitions++;
            
            // Property: Status update should trigger immediate event
            expect(statusUpdateEvents.length).toBe(initialEventCount + 1);
            
            const latestEvent = statusUpdateEvents[statusUpdateEvents.length - 1];
            expect(latestEvent.playerId).toBe(targetPlayer.playerId);
            expect(latestEvent.newStatus).toBe(transition.newStatus);
            expect(latestEvent.reason).toBe(transition.reason);
            
            // Property: Status should be immediately visible to all players
            const updatedStatus = connectionManager.getPlayerStatus(targetPlayer.playerId);
            expect(updatedStatus.status).toBe(transition.newStatus);
            
            // Property: Other players should see the updated status in game status
            const gameStatuses = connectionManager.getGamePlayersStatus(targetPlayer.gameId);
            const targetPlayerStatus = gameStatuses.find(s => s.playerId === targetPlayer.playerId);
            expect(targetPlayerStatus).toBeDefined();
            expect(targetPlayerStatus.status).toBe(transition.newStatus);
            
            // Property: Status history should be maintained
            const connectionInfo = connectionManager.playerConnections.get(targetPlayer.playerId);
            expect(connectionInfo.statusHistory.length).toBeGreaterThan(1);
            
            const latestHistoryEntry = connectionInfo.statusHistory[connectionInfo.statusHistory.length - 1];
            expect(latestHistoryEntry.status).toBe(transition.newStatus);
            expect(latestHistoryEntry.reason).toBe(transition.reason);
          }
        });
        
        // Property: All successful status updates should have been processed in real-time
        expect(statusUpdateEvents.length).toBe(successfulTransitions);
        
        // Property: Status updates should maintain chronological order
        for (let i = 1; i < statusUpdateEvents.length; i++) {
          expect(statusUpdateEvents[i].timestamp).toBeGreaterThanOrEqual(statusUpdateEvents[i-1].timestamp);
        }
        
        // Property: Each player's current status should be queryable immediately
        validPlayers.forEach(player => {
          const currentStatus = connectionManager.getPlayerStatus(player.playerId);
          expect(currentStatus).toBeDefined();
          expect(currentStatus.playerId).toBe(player.playerId);
          expect(['CONNECTED', 'DISCONNECTING', 'RECONNECTING', 'DISCONNECTED'].includes(currentStatus.status)).toBe(true);
        });
        
        // Property: Game-wide status should be consistent
        const gameId = validPlayers[0].gameId;
        const gameStatuses = connectionManager.getGamePlayersStatus(gameId);
        expect(gameStatuses.length).toBe(validPlayers.length);
        
        gameStatuses.forEach(gameStatus => {
          const individualStatus = connectionManager.getPlayerStatus(gameStatus.playerId);
          expect(gameStatus.status).toBe(individualStatus.status);
          expect(gameStatus.playerId).toBe(individualStatus.playerId);
        });
        
        return true;
      }
    ), { numRuns: 100 });
  });

  test('Property 3a: Status updates handle concurrent changes correctly', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.constantFrom('game123', 'game456', 'game789'),
        players: fc.array(
          fc.record({
            playerId: fc.integer({ min: 1, max: 999999 }).map(id => `player_${id}_${Math.random().toString(36).substring(7)}`),
            socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`)
          }),
          { minLength: 2, maxLength: 4 }
        ),
        concurrentUpdates: fc.array(
          fc.record({
            playerIndex: fc.integer({ min: 0, max: 3 }),
            status: fc.constantFrom('DISCONNECTING', 'RECONNECTING'),
            delay: fc.integer({ min: 0, max: 50 }) // Small delays to simulate near-concurrent updates
          }),
          { minLength: 2, maxLength: 6 }
        )
      }),
      async (testData) => {
        const validPlayers = testData.players.slice(0, Math.min(testData.players.length, 4));
        if (validPlayers.length < 2) return true;
        
        const statusUpdateEvents = [];
        connectionManager.on('statusUpdated', (event) => {
          statusUpdateEvents.push({
            playerId: event.playerId,
            newStatus: event.newStatus,
            timestamp: Date.now()
          });
        });
        
        // Register all players
        validPlayers.forEach(player => {
          const socket = new MockSocket(player.socketId);
          connectionManager.registerConnection(socket, testData.gameId, player.playerId);
        });
        
        // Apply concurrent status updates
        const validUpdates = testData.concurrentUpdates.filter(
          update => update.playerIndex < validPlayers.length
        );
        
        const updatePromises = validUpdates.map((update) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              const targetPlayer = validPlayers[update.playerIndex];
              const success = connectionManager.updatePlayerStatus(
                targetPlayer.playerId,
                update.status,
                `concurrent_update_${Math.random().toString(36).substring(7)}`
              );
              resolve({ success, playerId: targetPlayer.playerId, status: update.status });
            }, update.delay);
          });
        });
        
        const results = await Promise.all(updatePromises);
        
        // Property: All concurrent updates should be processed
        results.forEach(result => {
          if (result.success) {
            const finalStatus = connectionManager.getPlayerStatus(result.playerId);
            expect(['CONNECTED', 'DISCONNECTING', 'RECONNECTING', 'DISCONNECTED'].includes(finalStatus.status)).toBe(true);
          }
        });
        
        // Property: No status updates should be lost
        expect(statusUpdateEvents.length).toBeGreaterThanOrEqual(results.filter(r => r.success).length);
        
        // Property: Final state should be consistent
        validPlayers.forEach(player => {
          const status = connectionManager.getPlayerStatus(player.playerId);
          expect(status).toBeDefined();
          expect(status.playerId).toBe(player.playerId);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });

  test('Property 3b: Mobile device status updates include mobile-specific indicators', () => {
    fc.assert(fc.property(
      fc.record({
        mobilePlayer: fc.record({
          playerId: fc.integer({ min: 1, max: 999999 }).map(id => `mobile_${id}_${Math.random().toString(36).substring(7)}`),
          socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
          gameId: fc.constantFrom('game123', 'game456', 'game789'),
          userAgent: fc.constantFrom(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            'Mozilla/5.0 (Android 10; Mobile; rv:81.0)',
            'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)'
          )
        }),
        desktopPlayer: fc.record({
          playerId: fc.integer({ min: 1, max: 999999 }).map(id => `desktop_${id}_${Math.random().toString(36).substring(7)}`),
          socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
          gameId: fc.constantFrom('game123', 'game456', 'game789'),
          userAgent: fc.constantFrom(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          )
        }),
        statusChange: fc.constantFrom('DISCONNECTING', 'RECONNECTING')
      }),
      (testData) => {
        const statusUpdateEvents = [];
        connectionManager.on('statusUpdated', (event) => {
          statusUpdateEvents.push(event);
        });
        
        // Register mobile player
        const mobileSocket = new MockSocket(testData.mobilePlayer.socketId, testData.mobilePlayer.userAgent);
        const mobileConnectionInfo = connectionManager.registerConnection(
          mobileSocket, 
          testData.mobilePlayer.gameId, 
          testData.mobilePlayer.playerId
        );
        
        // Register desktop player
        const desktopSocket = new MockSocket(testData.desktopPlayer.socketId, testData.desktopPlayer.userAgent);
        const desktopConnectionInfo = connectionManager.registerConnection(
          desktopSocket, 
          testData.desktopPlayer.gameId, 
          testData.desktopPlayer.playerId
        );
        
        // Property: Mobile detection should work correctly
        expect(mobileConnectionInfo.isMobile).toBe(true);
        expect(desktopConnectionInfo.isMobile).toBe(false);
        
        // Update mobile player status
        connectionManager.updatePlayerStatus(testData.mobilePlayer.playerId, testData.statusChange, 'mobile_test');
        
        // Property: Mobile player status should include mobile indicators
        const mobileStatus = connectionManager.getPlayerStatus(testData.mobilePlayer.playerId);
        expect(mobileStatus.isMobile).toBe(true);
        expect(mobileStatus.status).toBe(testData.statusChange);
        
        // Property: Desktop player status should not have mobile indicators
        const desktopStatus = connectionManager.getPlayerStatus(testData.desktopPlayer.playerId);
        expect(desktopStatus.isMobile).toBe(false);
        expect(desktopStatus.status).toBe('CONNECTED');
        
        // Property: Grace period should be different for mobile vs desktop
        const mobileGracePeriod = connectionManager.getGracePeriodForPlayer(testData.mobilePlayer.playerId);
        const desktopGracePeriod = connectionManager.getGracePeriodForPlayer(testData.desktopPlayer.playerId);
        
        // Mobile should get extended grace period
        expect(mobileGracePeriod).toBe(connectionManager.config.extendedGracePeriod);
        expect(desktopGracePeriod).toBe(connectionManager.config.standardGracePeriod);
        
        // Property: Status updates should include mobile-specific information
        const mobileStatusEvent = statusUpdateEvents.find(e => e.playerId === testData.mobilePlayer.playerId);
        expect(mobileStatusEvent).toBeDefined();
        expect(mobileStatusEvent.connectionInfo.isMobile).toBe(true);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  test('Property 3c: Status updates maintain consistency across rapid state changes', () => {
    fc.assert(fc.property(
      fc.record({
        playerId: fc.integer({ min: 1, max: 999999 }).map(id => `player_${id}_${Math.random().toString(36).substring(7)}`),
        socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
        gameId: fc.constantFrom('game123', 'game456', 'game789'),
        rapidTransitions: fc.array(
          fc.constantFrom('DISCONNECTING', 'RECONNECTING'),
          { minLength: 3, maxLength: 8 }
        )
      }),
      (testData) => {
        const statusUpdateEvents = [];
        connectionManager.on('statusUpdated', (event) => {
          statusUpdateEvents.push({
            playerId: event.playerId,
            oldStatus: event.oldStatus,
            newStatus: event.newStatus,
            timestamp: Date.now()
          });
        });
        
        // Register player
        const socket = new MockSocket(testData.socketId);
        connectionManager.registerConnection(socket, testData.gameId, testData.playerId);
        
        let lastValidStatus = 'CONNECTED';
        let successfulTransitions = 0;
        
        // Apply rapid status transitions
        testData.rapidTransitions.forEach((newStatus, index) => {
          // Only attempt valid transitions
          if (connectionManager.isValidStatusTransition(lastValidStatus, newStatus)) {
            const success = connectionManager.updatePlayerStatus(
              testData.playerId,
              newStatus,
              `rapid_transition_${index}`
            );
            
            if (success) {
              lastValidStatus = newStatus;
              successfulTransitions++;
            }
          }
        });
        
        // Property: Final status should match the last successful transition
        const finalStatus = connectionManager.getPlayerStatus(testData.playerId);
        expect(finalStatus.status).toBe(lastValidStatus);
        
        // Property: Number of status update events should match successful transitions
        expect(statusUpdateEvents.length).toBe(successfulTransitions);
        
        // Property: Status history should be maintained correctly
        const connectionInfo = connectionManager.playerConnections.get(testData.playerId);
        expect(connectionInfo.statusHistory.length).toBe(successfulTransitions + 1); // +1 for initial CONNECTED
        
        // Property: Each status in history should be a valid transition from the previous
        for (let i = 1; i < connectionInfo.statusHistory.length; i++) {
          const prevStatus = connectionInfo.statusHistory[i - 1].status;
          const currentStatus = connectionInfo.statusHistory[i].status;
          const isValidTransition = connectionManager.isValidStatusTransition(prevStatus, currentStatus);
          expect(isValidTransition).toBe(true);
        }
        
        // Property: Timestamps should be in chronological order
        for (let i = 1; i < statusUpdateEvents.length; i++) {
          expect(statusUpdateEvents[i].timestamp).toBeGreaterThanOrEqual(statusUpdateEvents[i-1].timestamp);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });
});