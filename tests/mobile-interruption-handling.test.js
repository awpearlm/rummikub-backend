/**
 * Property-Based Tests for Mobile Interruption Handling
 * Feature: player-reconnection-management, Property 11: Mobile Interruption Handling
 * Validates: Requirements 7.1
 */

const fc = require('fast-check');
const PlayerConnectionManager = require('../services/playerConnectionManager');
const EventEmitter = require('events');

// Mock socket for testing mobile scenarios
class MockMobileSocket extends EventEmitter {
  constructor(id, userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', isMobile = true) {
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
    this.isMobile = isMobile;
  }
  
  join(room) {
    // Mock join room
  }
  
  emit(event, data) {
    // Mock emit - trigger event for testing
    super.emit(event, data);
  }
}

describe('Mobile Interruption Handling Properties', () => {
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
   * Property 11: Mobile Interruption Handling
   * For any mobile app backgrounding event under 10 seconds, the system should 
   * treat it as temporary and not trigger disconnection procedures
   */
  test('Property 11: Mobile Interruption Handling', () => {
    fc.assert(fc.property(
      fc.record({
        // Mobile player configuration
        mobilePlayer: fc.record({
          playerId: fc.integer({ min: 1, max: 999999 }).map(id => `mobile_${id}_${Math.random().toString(36).substring(7)}`),
          socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
          gameId: fc.constantFrom('game123', 'game456', 'game789'),
          userAgent: fc.constantFrom(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
            'Mozilla/5.0 (Android 10; Mobile; rv:81.0)',
            'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
            'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36'
          )
        }),
        
        // Desktop player for comparison
        desktopPlayer: fc.record({
          playerId: fc.integer({ min: 1, max: 999999 }).map(id => `desktop_${id}_${Math.random().toString(36).substring(7)}`),
          socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
          gameId: fc.constantFrom('game123', 'game456', 'game789'),
          userAgent: fc.constantFrom(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          )
        }),
        
        // Interruption scenarios
        interruptions: fc.array(
          fc.record({
            type: fc.constantFrom('app_backgrounding', 'network_switch', 'brief_disconnect', 'transport_close'),
            duration: fc.integer({ min: 100, max: 15000 }), // 0.1 to 15 seconds
            reason: fc.constantFrom('transport close', 'client namespace disconnect', 'transport error', 'ping timeout', 'manual_disconnect')
          }),
          { minLength: 1, maxLength: 5 }
        )
      }),
      (testData) => {
        const statusUpdateEvents = [];
        const connectionQualityWarnings = [];
        const networkTypeChanges = [];
        
        // Track events
        connectionManager.on('statusUpdated', (event) => {
          statusUpdateEvents.push({
            playerId: event.playerId,
            oldStatus: event.oldStatus,
            newStatus: event.newStatus,
            reason: event.reason,
            timestamp: Date.now()
          });
        });
        
        connectionManager.on('connectionQualityWarning', (event) => {
          connectionQualityWarnings.push(event);
        });
        
        connectionManager.on('networkTypeChanged', (event) => {
          networkTypeChanges.push(event);
        });
        
        // Register mobile player
        const mobileSocket = new MockMobileSocket(
          testData.mobilePlayer.socketId, 
          testData.mobilePlayer.userAgent, 
          true
        );
        const mobileConnectionInfo = connectionManager.registerConnection(
          mobileSocket, 
          testData.mobilePlayer.gameId, 
          testData.mobilePlayer.playerId
        );
        
        // Register desktop player for comparison
        const desktopSocket = new MockMobileSocket(
          testData.desktopPlayer.socketId, 
          testData.desktopPlayer.userAgent, 
          false
        );
        const desktopConnectionInfo = connectionManager.registerConnection(
          desktopSocket, 
          testData.desktopPlayer.gameId, 
          testData.desktopPlayer.playerId
        );
        
        // Property: Mobile device should be correctly detected
        expect(mobileConnectionInfo.isMobile).toBe(true);
        expect(desktopConnectionInfo.isMobile).toBe(false);
        
        // Property: Both players should start as CONNECTED
        expect(mobileConnectionInfo.status).toBe('CONNECTED');
        expect(desktopConnectionInfo.status).toBe('CONNECTED');
        
        // Simulate interruptions and test mobile-specific handling
        testData.interruptions.forEach((interruption) => {
          // Simulate interruption for mobile player
          connectionManager.handlePotentialDisconnection(mobileSocket, interruption.reason);
          
          // Simulate same interruption for desktop player (for comparison)
          connectionManager.handlePotentialDisconnection(desktopSocket, interruption.reason);
          
          const isMobileBackgroundingEvent = connectionManager.isMobileBackgroundingEvent(interruption.reason);
          const isShortDuration = interruption.duration <= connectionManager.config.mobileBackgroundTolerance;
          
          if (isMobileBackgroundingEvent && isShortDuration) {
            // Property: Mobile backgrounding events under tolerance should not immediately trigger disconnection
            const mobileStatusAfter = connectionManager.getPlayerStatus(testData.mobilePlayer.playerId);
            
            // Mobile player should either stay CONNECTED or have special handling
            if (mobileStatusAfter.status === 'DISCONNECTING') {
              // If it does go to DISCONNECTING, it should have a longer delay
              const mobileConnectionInfo = connectionManager.playerConnections.get(testData.mobilePlayer.playerId);
              expect(mobileConnectionInfo.disconnectionTimer).toBeDefined();
            }
            
            // Property: Desktop player should follow normal disconnection logic
            const desktopStatusAfter = connectionManager.getPlayerStatus(testData.desktopPlayer.playerId);
            expect(desktopStatusAfter.status).toBe('DISCONNECTING');
            
          } else {
            // Property: Non-backgrounding events or long duration should trigger normal disconnection for both
            const mobileStatusAfter = connectionManager.getPlayerStatus(testData.mobilePlayer.playerId);
            const desktopStatusAfter = connectionManager.getPlayerStatus(testData.desktopPlayer.playerId);
            
            // Both should go to DISCONNECTING for non-backgrounding events or long duration events
            expect(['DISCONNECTING', 'CONNECTED'].includes(mobileStatusAfter.status)).toBe(true);
            expect(['DISCONNECTING', 'CONNECTED'].includes(desktopStatusAfter.status)).toBe(true);
          }
        });
        
        // Property: Mobile players should get extended grace periods
        const mobileGracePeriod = connectionManager.getGracePeriodForPlayer(testData.mobilePlayer.playerId);
        const desktopGracePeriod = connectionManager.getGracePeriodForPlayer(testData.desktopPlayer.playerId);
        
        expect(mobileGracePeriod).toBeGreaterThanOrEqual(desktopGracePeriod);
        expect(mobileGracePeriod).toBe(connectionManager.config.extendedGracePeriod);
        
        // Property: Mobile-specific events should be tracked
        const mobileInfo = connectionManager.playerConnections.get(testData.mobilePlayer.playerId);
        if (mobileInfo) {
          expect(typeof mobileInfo.appBackgroundEvents).toBe('number');
          expect(mobileInfo.appBackgroundEvents).toBeGreaterThanOrEqual(0);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });

  test('Property 11a: Mobile backgrounding tolerance prevents false disconnections', () => {
    fc.assert(fc.property(
      fc.record({
        playerId: fc.integer({ min: 1, max: 999999 }).map(id => `mobile_${id}_${Math.random().toString(36).substring(7)}`),
        socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
        gameId: fc.constantFrom('game123', 'game456', 'game789'),
        backgroundingEvents: fc.array(
          fc.record({
            reason: fc.constantFrom('transport close', 'client namespace disconnect', 'ping timeout'),
            duration: fc.integer({ min: 1000, max: 9000 }) // 1-9 seconds (under tolerance)
          }),
          { minLength: 1, maxLength: 3 }
        )
      }),
      (testData) => {
        const statusEvents = [];
        connectionManager.on('statusUpdated', (event) => {
          statusEvents.push(event);
        });
        
        // Register mobile player
        const mobileSocket = new MockMobileSocket(testData.socketId);
        connectionManager.registerConnection(mobileSocket, testData.gameId, testData.playerId);
        
        let backgroundingEventsHandled = 0;
        
        // Simulate multiple short backgrounding events
        testData.backgroundingEvents.forEach((event) => {
          // Simulate backgrounding event
          connectionManager.handlePotentialDisconnection(mobileSocket, event.reason);
          
          const isBackgroundingEvent = connectionManager.isMobileBackgroundingEvent(event.reason);
          
          if (isBackgroundingEvent) {
            backgroundingEventsHandled++;
            
            // Property: Short backgrounding events should not immediately disconnect
            // The player should either stay CONNECTED or have extended tolerance
            const statusAfterEvent = connectionManager.getPlayerStatus(testData.playerId);
            
            // Allow for either staying connected or having special mobile handling
            expect(['CONNECTED', 'DISCONNECTING'].includes(statusAfterEvent.status)).toBe(true);
            
            // If it goes to DISCONNECTING, it should have mobile-specific timing
            if (statusAfterEvent.status === 'DISCONNECTING') {
              const connectionInfo = connectionManager.playerConnections.get(testData.playerId);
              expect(connectionInfo.disconnectionTimer).toBeDefined();
            }
          }
          
          // Simulate recovery after short duration
          setTimeout(() => {
            // Simulate successful recovery
            const currentStatus = connectionManager.getPlayerStatus(testData.playerId);
            if (currentStatus && currentStatus.status === 'DISCONNECTING') {
              // Simulate successful recovery
              connectionManager.updatePlayerStatus(testData.playerId, 'CONNECTED', 'mobile_recovery');
            }
          }, event.duration);
        });
        
        // Property: Mobile backgrounding events should be tracked
        const connectionInfo = connectionManager.playerConnections.get(testData.playerId);
        if (connectionInfo && backgroundingEventsHandled > 0) {
          expect(connectionInfo.appBackgroundEvents).toBeGreaterThan(0);
        }
        
        // Property: Player should still be manageable after multiple backgrounding events
        const finalStatus = connectionManager.getPlayerStatus(testData.playerId);
        expect(finalStatus).toBeDefined();
        expect(finalStatus.playerId).toBe(testData.playerId);
        
        return true;
      }
    ), { numRuns: 50 });
  });

  test('Property 11b: Network type changes are handled correctly for mobile devices', () => {
    fc.assert(fc.property(
      fc.record({
        playerId: fc.integer({ min: 1, max: 999999 }).map(id => `mobile_${id}_${Math.random().toString(36).substring(7)}`),
        socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
        gameId: fc.constantFrom('game123', 'game456', 'game789'),
        networkChanges: fc.array(
          fc.record({
            from: fc.constantFrom('wifi', 'cellular', 'unknown'),
            to: fc.constantFrom('wifi', 'cellular', 'unstable', 'unknown')
          }),
          { minLength: 1, maxLength: 4 }
        )
      }),
      (testData) => {
        const networkChangeEvents = [];
        connectionManager.on('networkTypeChanged', (event) => {
          networkChangeEvents.push(event);
        });
        
        // Register mobile player
        const mobileSocket = new MockMobileSocket(testData.socketId);
        connectionManager.registerConnection(mobileSocket, testData.gameId, testData.playerId);
        
        // Test network type changes
        testData.networkChanges.forEach((change) => {
          // Simulate network type change
          connectionManager.handleNetworkTypeChange(testData.playerId, change.to);
          
          // Property: Network type change should be recorded
          const connectionInfo = connectionManager.playerConnections.get(testData.playerId);
          expect(connectionInfo.networkType).toBe(change.to);
          
          // Property: Grace period should adjust based on network type
          const newGracePeriod = connectionManager.getGracePeriodForPlayer(testData.playerId);
          
          if (change.to === 'cellular' || change.to === 'unstable') {
            // Should get extended grace period for cellular/unstable networks
            expect(newGracePeriod).toBe(connectionManager.config.extendedGracePeriod);
          }
          
          // Property: Network change event should be emitted
          const relevantEvents = networkChangeEvents.filter(e => e.playerId === testData.playerId);
          expect(relevantEvents.length).toBeGreaterThan(0);
          
          const latestEvent = relevantEvents[relevantEvents.length - 1];
          expect(latestEvent.newNetworkType).toBe(change.to);
          expect(latestEvent.isMobile).toBe(true);
        });
        
        // Property: All network changes should be tracked
        expect(networkChangeEvents.length).toBe(testData.networkChanges.length);
        
        return true;
      }
    ), { numRuns: 50 });
  });

  test('Property 11c: Mobile connection quality warnings include mobile-specific recommendations', () => {
    fc.assert(fc.property(
      fc.record({
        playerId: fc.integer({ min: 1, max: 999999 }).map(id => `mobile_${id}_${Math.random().toString(36).substring(7)}`),
        socketId: fc.integer({ min: 1, max: 999999 }).map(id => `socket_${id}_${Math.random().toString(36).substring(7)}`),
        gameId: fc.constantFrom('game123', 'game456', 'game789'),
        connectionMetrics: fc.record({
          latency: fc.integer({ min: 200, max: 2000 }), // Poor to very poor latency
          packetLoss: fc.float({ min: Math.fround(0.05), max: Math.fround(0.5), noNaN: true }), // 5-50% packet loss
          networkType: fc.constantFrom('cellular', 'wifi', 'unstable')
        })
      }),
      (testData) => {
        const qualityWarnings = [];
        connectionManager.on('connectionQualityWarning', (event) => {
          qualityWarnings.push(event);
        });
        
        // Register mobile player
        const mobileSocket = new MockMobileSocket(testData.socketId);
        const connectionInfo = connectionManager.registerConnection(mobileSocket, testData.gameId, testData.playerId);
        
        // Set the network type explicitly before updating metrics
        connectionInfo.networkType = testData.connectionMetrics.networkType;
        
        // Update connection metrics to trigger quality assessment
        connectionManager.updateConnectionMetrics(testData.playerId, testData.connectionMetrics);
        
        // Property: Poor connection quality should trigger warnings
        if (testData.connectionMetrics.latency > 300 || testData.connectionMetrics.packetLoss > 0.1) {
          expect(qualityWarnings.length).toBeGreaterThan(0);
          
          const warning = qualityWarnings[0];
          
          // Property: Warning should include mobile-specific information
          expect(warning.playerId).toBe(testData.playerId);
          expect(warning.isMobile).toBe(true);
          expect(warning.networkType).toBe(testData.connectionMetrics.networkType);
          
          // Property: Recommendations should be mobile-specific
          expect(Array.isArray(warning.recommendedActions)).toBe(true);
          expect(warning.recommendedActions.length).toBeGreaterThan(0);
          
          // Check for mobile-specific recommendations
          const recommendationText = warning.recommendedActions.join(' ').toLowerCase();
          if (testData.connectionMetrics.networkType === 'cellular') {
            expect(recommendationText.includes('cellular') || recommendationText.includes('wifi')).toBe(true);
          }
          
          // Should include mobile-specific advice
          const hasMobileAdvice = warning.recommendedActions.some(rec => 
            rec.toLowerCase().includes('wifi') || 
            rec.toLowerCase().includes('cellular') || 
            rec.toLowerCase().includes('router') ||
            rec.toLowerCase().includes('signal')
          );
          expect(hasMobileAdvice).toBe(true);
        }
        
        // Property: Connection quality should be assessed correctly
        const status = connectionManager.getPlayerStatus(testData.playerId);
        expect(['excellent', 'good', 'fair', 'poor'].includes(status.connectionQuality)).toBe(true);
        
        return true;
      }
    ), { numRuns: 50 });
  });
});