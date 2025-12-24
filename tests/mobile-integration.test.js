/**
 * Mobile Integration Tests
 * Task 11.3: Add mobile-specific integration
 * 
 * Tests app backgrounding detection with pause logic, network quality monitoring,
 * and mobile device compatibility
 * Requirements: 7.1, 7.3, 7.5
 */

const mongoose = require('mongoose');
const Game = require('../models/Game');
const MobileIntegrationService = require('../services/mobileIntegrationService');
const PlayerConnectionManager = require('../services/playerConnectionManager');
const gamePauseController = require('../services/gamePauseController');
const NotificationBroadcaster = require('../services/notificationBroadcaster');

// Test database configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rummikub_test';

// Mock Socket.IO
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn()
};

// Mock socket with mobile user agent
const createMobileSocket = (id, playerId, userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)') => ({
  id,
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  handshake: {
    headers: {
      'user-agent': userAgent
    }
  },
  conn: {
    transport: { name: 'websocket' }
  }
});

describe('Mobile Integration Tests', () => {
  let testGameCounter = 0;
  let mobileIntegrationService;
  let playerConnectionManager;
  let notificationBroadcaster;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
    
    console.log('📱 Mobile Integration Tests initialized');
  });

  afterAll(async () => {
    // Clean up test data
    await Game.deleteMany({ gameId: /^test-mobile-/ });
    
    // Shutdown services
    if (mobileIntegrationService) {
      mobileIntegrationService.shutdown();
    }
    
    // Close database connection
    await mongoose.connection.close();
    
    console.log('🧹 Mobile Integration Tests cleanup complete');
  });

  beforeEach(() => {
    testGameCounter++;
    
    // Initialize services
    playerConnectionManager = new PlayerConnectionManager();
    notificationBroadcaster = new NotificationBroadcaster(mockIo);
    mobileIntegrationService = new MobileIntegrationService(
      playerConnectionManager,
      gamePauseController,
      notificationBroadcaster
    );
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (mobileIntegrationService) {
      mobileIntegrationService.shutdown();
    }
  });

  /**
   * Test app backgrounding detection and tolerance
   */
  describe('App Backgrounding Detection', () => {
    test('should detect mobile device and initialize mobile monitoring', async () => {
      const playerId = 'mobile-player1';
      const socketId = 'mobile-socket1';
      const gameId = `test-mobile-${testGameCounter}-detection`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      // Initialize mobile monitoring
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      expect(mobileMetrics).toBeTruthy();
      expect(mobileMetrics.isMobile).toBe(true);
      expect(mobileMetrics.deviceType).toBe('phone');
      expect(mobileMetrics.optimizationsEnabled).toContain('extended_heartbeat');
      
      console.log('✅ Mobile device detection test passed');
    });

    test('should apply backgrounding tolerance for mobile app backgrounding', async () => {
      const playerId = 'mobile-player2';
      const socketId = 'mobile-socket2';
      const gameId = `test-mobile-${testGameCounter}-backgrounding`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      expect(mobileMetrics.isMobile).toBe(true);
      
      // Simulate app backgrounding
      await mobileIntegrationService.handleAppBackgrounding(
        playerId,
        'transport close',
        { reason: 'app_backgrounded' }
      );
      
      // Verify backgrounding was tracked
      expect(mobileMetrics.appBackgroundEvents).toBe(1);
      expect(mobileMetrics.lastBackgroundTime).toBeTruthy();
      
      // Simulate app foregrounding
      await mobileIntegrationService.handleAppForegrounding(
        playerId,
        { reason: 'app_foregrounded' }
      );
      
      // Verify foregrounding was tracked
      expect(mobileMetrics.appForegroundEvents).toBe(1);
      expect(mobileMetrics.lastForegroundTime).toBeTruthy();
      expect(mobileMetrics.totalBackgroundDuration).toBeGreaterThan(0);
      
      console.log('✅ App backgrounding tolerance test passed');
    });

    test('should not apply backgrounding tolerance for non-mobile devices', async () => {
      const playerId = 'desktop-player1';
      const socketId = 'desktop-socket1';
      const gameId = `test-mobile-${testGameCounter}-desktop`;
      
      // Create desktop socket
      const desktopSocket = createMobileSocket(
        socketId, 
        playerId, 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
      
      // Register connection and initialize monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        desktopSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: desktopSocket.handshake.headers['user-agent'] }
      );
      
      expect(mobileMetrics.isMobile).toBe(false);
      expect(mobileMetrics.deviceType).toBe('desktop');
      
      // Apply backgrounding tolerance
      const toleranceResult = await mobileIntegrationService.applyBackgroundingTolerance(
        playerId,
        'transport close',
        {}
      );
      
      expect(toleranceResult.tolerated).toBe(false);
      expect(toleranceResult.reason).toBe('not_mobile');
      
      console.log('✅ Desktop device backgrounding test passed');
    });

    test('should handle frequent backgrounding with reduced tolerance', async () => {
      const playerId = 'mobile-player3';
      const socketId = 'mobile-socket3';
      const gameId = `test-mobile-${testGameCounter}-frequent`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      // Simulate multiple backgrounding events
      for (let i = 0; i < 3; i++) {
        await mobileIntegrationService.handleAppBackgrounding(
          playerId,
          'transport close',
          { reason: `backgrounding_${i}` }
        );
        
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }
      
      expect(mobileMetrics.appBackgroundEvents).toBe(3);
      
      // Apply tolerance after frequent backgrounding
      const toleranceResult = await mobileIntegrationService.applyBackgroundingTolerance(
        playerId,
        'transport close',
        {}
      );
      
      expect(toleranceResult.tolerated).toBe(true);
      expect(toleranceResult.toleranceDuration).toBeLessThan(10000); // Reduced tolerance
      
      console.log('✅ Frequent backgrounding tolerance test passed');
    });
  });

  /**
   * Test network quality monitoring
   */
  describe('Network Quality Monitoring', () => {
    test('should start network quality monitoring for mobile devices', async () => {
      const playerId = 'mobile-player4';
      const socketId = 'mobile-socket4';
      const gameId = `test-mobile-${testGameCounter}-quality`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      expect(mobileMetrics.isMobile).toBe(true);
      
      // Verify network quality monitoring was started
      const status = mobileIntegrationService.getStatus();
      expect(status.activeNetworkMonitoring).toBe(1);
      
      // Stop monitoring
      mobileIntegrationService.stopNetworkQualityMonitoring(playerId);
      
      const updatedStatus = mobileIntegrationService.getStatus();
      expect(updatedStatus.activeNetworkMonitoring).toBe(0);
      
      console.log('✅ Network quality monitoring test passed');
    });

    test('should handle poor network quality with warnings and optimizations', async () => {
      const playerId = 'mobile-player5';
      const socketId = 'mobile-socket5';
      const gameId = `test-mobile-${testGameCounter}-poor-quality`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      // Update connection metrics to simulate poor quality
      playerConnectionManager.updateConnectionMetrics(playerId, {
        latency: 800, // High latency
        packetLoss: 0.15, // High packet loss
        timestamp: Date.now()
      });
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      // Simulate poor network quality
      const currentQuality = {
        latency: 800,
        packetLoss: 0.15,
        timestamp: new Date(),
        networkType: 'cellular'
      };
      
      const qualityTrend = {
        stability: 'unstable',
        degraded: true,
        latencyIncrease: 300
      };
      
      // Set up event listener for connection quality warning
      let warningEmitted = false;
      playerConnectionManager.on('connectionQualityWarning', (event) => {
        warningEmitted = true;
        expect(event.playerId).toBe(playerId);
        expect(event.quality).toBe('poor');
        expect(event.recommendedActions).toContain('Switch to WiFi if available');
      });
      
      // Handle poor network quality
      await mobileIntegrationService.handlePoorNetworkQuality(
        playerId,
        currentQuality,
        qualityTrend
      );
      
      expect(warningEmitted).toBe(true);
      
      console.log('✅ Poor network quality handling test passed');
    });

    test('should apply network quality optimizations based on quality level', async () => {
      const playerId = 'mobile-player6';
      const socketId = 'mobile-socket6';
      const gameId = `test-mobile-${testGameCounter}-optimizations`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      // Apply poor quality optimizations
      await mobileIntegrationService.applyNetworkQualityOptimizations(playerId, 'poor');
      
      expect(mobileMetrics.optimizationsEnabled).toContain('reduced_update_frequency');
      expect(mobileMetrics.optimizationsEnabled).toContain('extended_timeouts');
      expect(mobileMetrics.optimizationsEnabled).toContain('simplified_protocol');
      
      // Apply fair quality optimizations
      await mobileIntegrationService.applyNetworkQualityOptimizations(playerId, 'fair');
      
      expect(mobileMetrics.optimizationsEnabled).toContain('extended_timeouts');
      
      console.log('✅ Network quality optimizations test passed');
    });
  });

  /**
   * Test network type changes
   */
  describe('Network Type Changes', () => {
    test('should handle network type change from WiFi to cellular', async () => {
      const playerId = 'mobile-player7';
      const socketId = 'mobile-socket7';
      const gameId = `test-mobile-${testGameCounter}-network-change`;
      
      // Create game document
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0, isBot: false }],
        gameState: {
          currentPlayerIndex: 0,
          board: [],
          turnNumber: 1
        },
        lifecycle: {
          startTime: new Date(Date.now() - 60000),
          lastActivity: new Date()
        }
      });
      await gameDoc.save();
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      // Initial network type is WiFi
      mobileMetrics.networkType = 'wifi';
      
      // Handle network type change to cellular
      await mobileIntegrationService.handleNetworkTypeChange(
        playerId,
        'wifi',
        'cellular',
        { reason: 'network_switch' }
      );
      
      expect(mobileMetrics.networkType).toBe('cellular');
      expect(mobileMetrics.networkSwitchEvents).toBe(1);
      expect(mobileMetrics.optimizationsEnabled).toContain('cellular_optimization');
      
      console.log('✅ Network type change test passed');
    });

    test('should apply cellular-specific optimizations', async () => {
      const playerId = 'mobile-player8';
      const socketId = 'mobile-socket8';
      const gameId = `test-mobile-${testGameCounter}-cellular`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { 
          userAgent: mobileSocket.handshake.headers['user-agent'],
          networkType: 'cellular'
        }
      );
      
      // Set network type to cellular
      mobileMetrics.networkType = 'cellular';
      
      // Apply network type optimizations
      await mobileIntegrationService.applyNetworkTypeOptimizations(
        playerId,
        'cellular',
        'wifi'
      );
      
      expect(mobileMetrics.optimizationsEnabled).toContain('cellular_optimization');
      expect(mobileMetrics.optimizationsEnabled).toContain('extended_grace_period');
      
      console.log('✅ Cellular optimizations test passed');
    });
  });

  /**
   * Test mobile device compatibility
   */
  describe('Mobile Device Compatibility', () => {
    test('should detect different mobile device types correctly', async () => {
      const testCases = [
        {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
          expectedDevice: 'phone',
          expectedMobile: true
        },
        {
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
          expectedDevice: 'tablet',
          expectedMobile: true
        },
        {
          userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
          expectedDevice: 'phone',
          expectedMobile: true
        },
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          expectedDevice: 'desktop',
          expectedMobile: false
        }
      ];
      
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const playerId = `test-player-${i}`;
        const socketId = `test-socket-${i}`;
        const gameId = `test-mobile-${testGameCounter}-device-${i}`;
        
        // Create socket with specific user agent
        const socket = createMobileSocket(socketId, playerId, testCase.userAgent);
        
        // Register connection and initialize monitoring
        const connectionInfo = playerConnectionManager.registerConnection(
          socket, gameId, playerId
        );
        
        const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
          playerId,
          connectionInfo,
          { userAgent: testCase.userAgent }
        );
        
        expect(mobileMetrics.isMobile).toBe(testCase.expectedMobile);
        expect(mobileMetrics.deviceType).toBe(testCase.expectedDevice);
        
        // Clean up
        mobileIntegrationService.cleanupPlayer(playerId);
      }
      
      console.log('✅ Mobile device compatibility test passed');
    });

    test('should handle mobile-specific grace period extensions', async () => {
      const playerId = 'mobile-player9';
      const socketId = 'mobile-socket9';
      const gameId = `test-mobile-${testGameCounter}-grace-period`;
      
      // Create game document
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0, isBot: false }],
        gameState: {
          currentPlayerIndex: 0,
          board: [],
          turnNumber: 1
        },
        lifecycle: {
          startTime: new Date(Date.now() - 60000),
          lastActivity: new Date()
        }
      });
      await gameDoc.save();
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { 
          userAgent: mobileSocket.handshake.headers['user-agent'],
          networkType: 'cellular'
        }
      );
      
      // Set cellular network type for extended grace period
      mobileMetrics.networkType = 'cellular';
      
      // Get grace period for mobile player
      const gracePeriod = playerConnectionManager.getGracePeriodForPlayer(playerId);
      const standardGracePeriod = playerConnectionManager.config.standardGracePeriod;
      
      // Mobile cellular should get extended grace period
      expect(gracePeriod).toBeGreaterThan(standardGracePeriod);
      
      console.log('✅ Mobile grace period extension test passed');
    });

    test('should provide mobile-specific network recommendations', async () => {
      const playerId = 'mobile-player10';
      const socketId = 'mobile-socket10';
      const gameId = `test-mobile-${testGameCounter}-recommendations`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { 
          userAgent: mobileSocket.handshake.headers['user-agent'],
          networkType: 'cellular'
        }
      );
      
      mobileMetrics.networkType = 'cellular';
      
      // Generate recommendations for poor cellular quality
      const currentQuality = {
        latency: 600,
        packetLoss: 0.1,
        timestamp: new Date(),
        networkType: 'cellular'
      };
      
      const recommendations = mobileIntegrationService.generateNetworkRecommendations(
        mobileMetrics,
        currentQuality
      );
      
      expect(recommendations).toContain('Switch to WiFi if available');
      expect(recommendations).toContain('Move to an area with better cellular signal');
      expect(recommendations).toContain('Close other apps using network bandwidth');
      
      console.log('✅ Mobile network recommendations test passed');
    });
  });

  /**
   * Test integration with reconnection flow
   */
  describe('Integration with Reconnection Flow', () => {
    test('should integrate mobile optimizations with reconnection flow', async () => {
      const playerId = 'mobile-player11';
      const socketId = 'mobile-socket11';
      const gameId = `test-mobile-${testGameCounter}-reconnection`;
      
      // Create game document
      const gameDoc = new Game({
        gameId,
        players: [{ name: playerId, score: 0, isBot: false }],
        gameState: {
          currentPlayerIndex: 0,
          board: [],
          turnNumber: 1
        },
        lifecycle: {
          startTime: new Date(Date.now() - 60000),
          lastActivity: new Date()
        }
      });
      await gameDoc.save();
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize mobile monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      const mobileMetrics = mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { 
          userAgent: mobileSocket.handshake.headers['user-agent'],
          networkType: 'cellular'
        }
      );
      
      expect(mobileMetrics.isMobile).toBe(true);
      expect(mobileMetrics.networkType).toBe('cellular');
      
      // Simulate disconnection with mobile backgrounding
      await mobileIntegrationService.handleAppBackgrounding(
        playerId,
        'transport close',
        { reason: 'app_backgrounded' }
      );
      
      // Verify backgrounding tolerance was applied
      expect(mobileMetrics.appBackgroundEvents).toBe(1);
      
      // Simulate reconnection after foregrounding
      await mobileIntegrationService.handleAppForegrounding(
        playerId,
        { reason: 'app_foregrounded' }
      );
      
      // Verify foregrounding was handled
      expect(mobileMetrics.appForegroundEvents).toBe(1);
      expect(mobileMetrics.totalBackgroundDuration).toBeGreaterThan(0);
      
      console.log('✅ Mobile reconnection integration test passed');
    });
  });

  /**
   * Test service status and cleanup
   */
  describe('Service Management', () => {
    test('should provide accurate service status', async () => {
      const playerId1 = 'mobile-status-1';
      const playerId2 = 'desktop-status-2';
      const socketId1 = 'socket-status-1';
      const socketId2 = 'socket-status-2';
      const gameId = `test-mobile-${testGameCounter}-status`;
      
      // Create mobile and desktop sockets
      const mobileSocket = createMobileSocket(socketId1, playerId1);
      const desktopSocket = createMobileSocket(
        socketId2, 
        playerId2, 
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
      
      // Register connections and initialize monitoring
      const mobileConnection = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId1
      );
      const desktopConnection = playerConnectionManager.registerConnection(
        desktopSocket, gameId, playerId2
      );
      
      mobileIntegrationService.initializeMobileMonitoring(
        playerId1,
        mobileConnection,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      mobileIntegrationService.initializeMobileMonitoring(
        playerId2,
        desktopConnection,
        { userAgent: desktopSocket.handshake.headers['user-agent'] }
      );
      
      // Get service status
      const status = mobileIntegrationService.getStatus();
      
      expect(status.monitoredPlayers).toBe(2);
      expect(status.mobilePlayersCount).toBe(1); // Only one mobile player
      expect(status.activeNetworkMonitoring).toBe(1); // Only mobile gets monitoring
      
      console.log('✅ Service status test passed');
    });

    test('should clean up player data correctly', async () => {
      const playerId = 'cleanup-player';
      const socketId = 'cleanup-socket';
      const gameId = `test-mobile-${testGameCounter}-cleanup`;
      
      // Create mobile socket
      const mobileSocket = createMobileSocket(socketId, playerId);
      
      // Register connection and initialize monitoring
      const connectionInfo = playerConnectionManager.registerConnection(
        mobileSocket, gameId, playerId
      );
      
      mobileIntegrationService.initializeMobileMonitoring(
        playerId,
        connectionInfo,
        { userAgent: mobileSocket.handshake.headers['user-agent'] }
      );
      
      // Verify player is monitored
      let status = mobileIntegrationService.getStatus();
      expect(status.monitoredPlayers).toBe(1);
      expect(status.activeNetworkMonitoring).toBe(1);
      
      // Clean up player
      mobileIntegrationService.cleanupPlayer(playerId);
      
      // Verify cleanup
      status = mobileIntegrationService.getStatus();
      expect(status.monitoredPlayers).toBe(0);
      expect(status.activeNetworkMonitoring).toBe(0);
      
      console.log('✅ Player cleanup test passed');
    });
  });
});