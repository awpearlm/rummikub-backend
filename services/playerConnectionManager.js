/**
 * Player Connection Manager for Rummikub Player Reconnection Management
 * Implements Requirements 2.1, 7.2
 * 
 * Provides real-time connection health monitoring, debounced disconnection detection,
 * and player status state machine management.
 */

const EventEmitter = require('events');
const analyticsLogger = require('./analyticsLogger');

class PlayerConnectionManager extends EventEmitter {
  constructor() {
    super();
    
    // Increase max listeners to prevent memory leak warnings in tests
    this.setMaxListeners(50);
    
    // Connection state tracking
    this.playerConnections = new Map(); // playerId -> connection info
    this.socketToPlayer = new Map(); // socketId -> playerId mapping
    
    // Connection monitoring configuration
    this.config = {
      // Debounced disconnection detection (3-second delay)
      disconnectionDelay: 3000,
      
      // Heartbeat monitoring
      heartbeatInterval: 25000, // 25 seconds
      heartbeatTimeout: 5000,   // 5 seconds to respond to ping
      
      // Mobile-specific settings
      mobileBackgroundTolerance: 10000, // 10 seconds for app backgrounding
      
      // Connection quality thresholds
      latencyThresholds: {
        excellent: 50,   // < 50ms
        good: 150,       // 50-150ms
        fair: 300,       // 150-300ms
        poor: 300        // > 300ms
      },
      
      // Grace period settings
      standardGracePeriod: 180000,  // 3 minutes
      extendedGracePeriod: 300000   // 5 minutes for unstable connections
    };
    
    // Status tracking
    this.statusTimers = new Map(); // playerId -> timer references
    this.heartbeatTimers = new Map(); // socketId -> timer references
    
    console.log('🔌 Player Connection Manager initialized');
  }

  /**
   * Register a new player connection
   * Requirements: 2.1
   */
  registerConnection(socket, gameId, playerId) {
    const connectionInfo = {
      playerId: playerId,
      socketId: socket.id,
      gameId: gameId,
      status: 'CONNECTED',
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      
      // Connection quality metrics
      latency: null,
      packetLoss: 0,
      connectionQuality: 'unknown',
      
      // Mobile detection
      isMobile: this.detectMobileDevice(socket),
      appBackgroundEvents: 0,
      networkType: this.detectNetworkType(socket),
      
      // Disconnection tracking
      disconnectionCount: 0,
      lastDisconnectReason: null,
      disconnectedAt: null,
      reconnectionAttempts: 0,
      
      // Status change history
      statusHistory: [{
        status: 'CONNECTED',
        timestamp: Date.now(),
        reason: 'initial_connection'
      }],
      
      // Timers and intervals
      heartbeatInterval: null,
      disconnectionTimer: null
    };
    
    // Store connection info
    this.playerConnections.set(playerId, connectionInfo);
    this.socketToPlayer.set(socket.id, playerId);
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring(socket, connectionInfo);
    
    console.log(`🔌 Player connection registered: ${playerId} (socket: ${socket.id}, mobile: ${connectionInfo.isMobile})`);
    
    // Emit connection registered event
    this.emit('connectionRegistered', {
      playerId,
      socketId: socket.id,
      gameId,
      connectionInfo
    });
    
    return connectionInfo;
  }

  /**
   * Update player connection status with state machine
   * Requirements: 2.1, 7.2
   */
  updatePlayerStatus(playerId, newStatus, reason = 'unknown') {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) {
      console.warn(`⚠️ Attempted to update status for unknown player: ${playerId}`);
      return false;
    }
    
    const oldStatus = connectionInfo.status;
    
    // Validate status transition
    if (!this.isValidStatusTransition(oldStatus, newStatus)) {
      console.warn(`⚠️ Invalid status transition for ${playerId}: ${oldStatus} -> ${newStatus}`);
      return false;
    }
    
    // Update status
    connectionInfo.status = newStatus;
    connectionInfo.lastSeen = Date.now();
    
    // Add to status history
    connectionInfo.statusHistory.push({
      status: newStatus,
      timestamp: Date.now(),
      reason: reason,
      previousStatus: oldStatus
    });
    
    // Keep only last 10 status changes
    if (connectionInfo.statusHistory.length > 10) {
      connectionInfo.statusHistory.splice(0, connectionInfo.statusHistory.length - 10);
    }
    
    console.log(`🔄 Player ${playerId} status: ${oldStatus} -> ${newStatus} (reason: ${reason})`);
    
    // Handle status-specific logic
    this.handleStatusChange(playerId, connectionInfo, oldStatus, newStatus, reason);
    
    // Emit status update event
    this.emit('statusUpdated', {
      playerId,
      oldStatus,
      newStatus,
      reason,
      connectionInfo
    });
    
    return true;
  }

  /**
   * Handle potential disconnection with debouncing and mobile-specific logic
   * Requirements: 7.1, 7.2
   */
  handlePotentialDisconnection(socket, reason = 'unknown') {
    const playerId = this.socketToPlayer.get(socket.id);
    if (!playerId) return;
    
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return;
    
    console.log(`🔌 Potential disconnection detected for ${playerId}: ${reason} (mobile: ${connectionInfo.isMobile})`);
    
    // If already disconnecting or disconnected, don't start another timer
    if (connectionInfo.status === 'DISCONNECTING' || connectionInfo.status === 'DISCONNECTED') {
      return;
    }
    
    // Mobile-specific handling for app backgrounding
    if (connectionInfo.isMobile && this.isMobileBackgroundingEvent(reason)) {
      console.log(`📱 Mobile app backgrounding detected for ${playerId}, applying tolerance`);
      connectionInfo.appBackgroundEvents++;
      
      // Use mobile backgrounding tolerance instead of immediate disconnection
      this.handleMobileBackgrounding(playerId, reason);
      return;
    }
    
    // Update to disconnecting status
    this.updatePlayerStatus(playerId, 'DISCONNECTING', reason);
    
    // Clear any existing disconnection timer
    if (connectionInfo.disconnectionTimer) {
      clearTimeout(connectionInfo.disconnectionTimer);
    }
    
    // Determine disconnection delay based on connection quality and mobile status
    const disconnectionDelay = this.getDisconnectionDelay(connectionInfo);
    
    // Start debounced disconnection timer
    connectionInfo.disconnectionTimer = setTimeout(() => {
      // Check if player is still in disconnecting state
      const currentInfo = this.playerConnections.get(playerId);
      if (currentInfo && currentInfo.status === 'DISCONNECTING') {
        this.confirmDisconnection(playerId, reason);
      }
    }, disconnectionDelay);
  }

  /**
   * Handle mobile app backgrounding with tolerance
   * Requirements: 7.1
   */
  handleMobileBackgrounding(playerId, reason) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return;
    
    // Don't immediately mark as disconnecting for mobile backgrounding
    // Instead, wait for the mobile tolerance period
    console.log(`📱 Mobile backgrounding tolerance active for ${playerId} (${this.config.mobileBackgroundTolerance}ms)`);
    
    // Clear any existing timer
    if (connectionInfo.disconnectionTimer) {
      clearTimeout(connectionInfo.disconnectionTimer);
    }
    
    // Set a longer timer for mobile backgrounding
    connectionInfo.disconnectionTimer = setTimeout(() => {
      const currentInfo = this.playerConnections.get(playerId);
      if (currentInfo && currentInfo.status === 'CONNECTED') {
        // If still no activity after tolerance period, treat as real disconnection
        console.log(`📱 Mobile backgrounding tolerance expired for ${playerId}`);
        this.updatePlayerStatus(playerId, 'DISCONNECTING', 'mobile_background_timeout');
        
        // Start normal disconnection process
        setTimeout(() => {
          const finalInfo = this.playerConnections.get(playerId);
          if (finalInfo && finalInfo.status === 'DISCONNECTING') {
            this.confirmDisconnection(playerId, 'mobile_background_timeout');
          }
        }, this.config.disconnectionDelay);
      }
    }, this.config.mobileBackgroundTolerance);
  }

  /**
   * Check if disconnection reason indicates mobile app backgrounding
   * Requirements: 7.1
   */
  isMobileBackgroundingEvent(reason) {
    const backgroundingReasons = [
      'transport close',
      'client namespace disconnect',
      'transport error',
      'ping timeout'
    ];
    
    return backgroundingReasons.some(bgReason => 
      reason.toLowerCase().includes(bgReason.toLowerCase())
    );
  }

  /**
   * Get appropriate disconnection delay based on connection quality and mobile status
   * Requirements: 7.2, 7.3
   */
  getDisconnectionDelay(connectionInfo) {
    let delay = this.config.disconnectionDelay;
    
    // Increase delay for poor connection quality
    if (connectionInfo.connectionQuality === 'poor') {
      delay *= 2; // 6 seconds for poor connections
    } else if (connectionInfo.connectionQuality === 'fair') {
      delay *= 1.5; // 4.5 seconds for fair connections
    }
    
    // Additional delay for mobile devices
    if (connectionInfo.isMobile) {
      delay *= 1.5; // Extra time for mobile network instability
    }
    
    return Math.min(delay, 10000); // Cap at 10 seconds maximum
  }

  /**
   * Confirm disconnection after debounce period
   * Requirements: 2.1, 7.2
   */
  confirmDisconnection(playerId, reason) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return;
    
    // Update to disconnected status
    connectionInfo.disconnectedAt = Date.now();
    connectionInfo.lastDisconnectReason = reason;
    connectionInfo.disconnectionCount++;
    
    this.updatePlayerStatus(playerId, 'DISCONNECTED', reason);
    
    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring(connectionInfo);
    
    // Clear socket mapping
    this.socketToPlayer.delete(connectionInfo.socketId);
    
    // Log disconnection event for analytics
    analyticsLogger.logDisconnectionEvent({
      playerId,
      gameId: connectionInfo.gameId,
      reason,
      isMobile: connectionInfo.isMobile,
      networkType: connectionInfo.networkType,
      connectionQuality: connectionInfo.connectionQuality,
      latency: connectionInfo.latency,
      packetLoss: connectionInfo.packetLoss,
      sessionDuration: Date.now() - connectionInfo.connectedAt,
      previousDisconnections: connectionInfo.disconnectionCount - 1,
      reconnectionAttempts: connectionInfo.reconnectionAttempts,
      metadata: {
        statusHistory: connectionInfo.statusHistory.slice(-3) // Last 3 status changes
      }
    });

    console.log(`🔌 Player ${playerId} confirmed disconnected (reason: ${reason})`);
    
    // Emit disconnection confirmed event
    this.emit('disconnectionConfirmed', {
      playerId,
      reason,
      connectionInfo,
      disconnectionCount: connectionInfo.disconnectionCount
    });
  }

  /**
   * Handle reconnection attempt
   * Requirements: 2.1
   */
  handleReconnection(socket, gameId, playerId) {
    console.log(`🔄 Reconnection attempt: ${playerId} (socket: ${socket.id})`);
    
    let connectionInfo = this.playerConnections.get(playerId);
    
    if (!connectionInfo) {
      // New connection, register normally
      return this.registerConnection(socket, gameId, playerId);
    }
    
    // This is a reconnection
    const oldSocketId = connectionInfo.socketId;
    
    // Update connection info
    connectionInfo.socketId = socket.id;
    connectionInfo.reconnectionAttempts++;
    connectionInfo.disconnectedAt = null;
    connectionInfo.lastDisconnectReason = null;
    
    // Clear any disconnection timer
    if (connectionInfo.disconnectionTimer) {
      clearTimeout(connectionInfo.disconnectionTimer);
      connectionInfo.disconnectionTimer = null;
    }
    
    // Update socket mapping
    this.socketToPlayer.delete(oldSocketId);
    this.socketToPlayer.set(socket.id, playerId);
    
    // Update to reconnecting status first
    this.updatePlayerStatus(playerId, 'RECONNECTING', 'reconnection_attempt');
    
    // Start heartbeat monitoring with new socket
    this.startHeartbeatMonitoring(socket, connectionInfo);
    
    // After successful setup, update to connected
    setTimeout(() => {
      this.updatePlayerStatus(playerId, 'CONNECTED', 'reconnection_successful');
    }, 100);
    
    // Log reconnection event for analytics
    const reconnectionTime = connectionInfo.disconnectedAt ? 
      Date.now() - connectionInfo.disconnectedAt : 0;
    
    analyticsLogger.logReconnectionEvent({
      playerId,
      gameId,
      success: true,
      attemptNumber: connectionInfo.reconnectionAttempts,
      reconnectionTime,
      disconnectionDuration: reconnectionTime,
      isMobile: connectionInfo.isMobile,
      networkType: connectionInfo.networkType,
      connectionQuality: connectionInfo.connectionQuality,
      latency: connectionInfo.latency,
      stateRestorationSuccess: true, // Assume success for now
      dataIntegrityValid: true, // Assume valid for now
      metadata: {
        oldSocketId,
        newSocketId: socket.id,
        statusHistory: connectionInfo.statusHistory.slice(-3)
      }
    });

    console.log(`✅ Player ${playerId} reconnected (old socket: ${oldSocketId}, new socket: ${socket.id})`);
    
    // Emit reconnection event
    this.emit('reconnectionSuccessful', {
      playerId,
      oldSocketId,
      newSocketId: socket.id,
      gameId,
      connectionInfo,
      attemptNumber: connectionInfo.reconnectionAttempts
    });
    
    return connectionInfo;
  }

  /**
   * Start heartbeat monitoring for a connection
   * Requirements: 2.1
   */
  startHeartbeatMonitoring(socket, connectionInfo) {
    // Clear any existing heartbeat
    this.stopHeartbeatMonitoring(connectionInfo);
    
    const heartbeatInterval = setInterval(() => {
      // Check if connection still exists and is active
      if (connectionInfo.status !== 'CONNECTED' && connectionInfo.status !== 'RECONNECTING') {
        clearInterval(heartbeatInterval);
        return;
      }
      
      // Send ping
      const pingTime = Date.now();
      socket.emit('ping', pingTime);
      
      // Set timeout for pong response
      const pongTimeout = setTimeout(() => {
        console.warn(`⚠️ Heartbeat timeout for ${connectionInfo.playerId}`);
        this.handlePotentialDisconnection(socket, 'heartbeat_timeout');
        clearInterval(heartbeatInterval);
      }, this.config.heartbeatTimeout);
      
      // Listen for pong response
      const pongHandler = (pongTime) => {
        if (pongTime === pingTime) {
          clearTimeout(pongTimeout);
          
          // Update connection metrics
          const latency = Date.now() - pingTime;
          this.updateConnectionMetrics(connectionInfo.playerId, {
            latency,
            timestamp: Date.now()
          });
          
          socket.off('pong', pongHandler);
        }
      };
      
      socket.once('pong', pongHandler);
      
    }, this.config.heartbeatInterval);
    
    // Store interval reference
    connectionInfo.heartbeatInterval = heartbeatInterval;
    this.heartbeatTimers.set(socket.id, heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring for a connection
   * Requirements: 2.1
   */
  stopHeartbeatMonitoring(connectionInfo) {
    if (connectionInfo.heartbeatInterval) {
      clearInterval(connectionInfo.heartbeatInterval);
      connectionInfo.heartbeatInterval = null;
    }
    
    if (connectionInfo.socketId) {
      const timer = this.heartbeatTimers.get(connectionInfo.socketId);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(connectionInfo.socketId);
      }
    }
  }

  /**
   * Validate status transitions according to state machine
   * Requirements: 2.1
   */
  isValidStatusTransition(fromStatus, toStatus) {
    // Allow same status (no-op transitions)
    if (fromStatus === toStatus) {
      return true;
    }
    
    const validTransitions = {
      'CONNECTED': ['DISCONNECTING', 'RECONNECTING'],
      'DISCONNECTING': ['DISCONNECTED', 'CONNECTED', 'RECONNECTING'],
      'RECONNECTING': ['CONNECTED', 'DISCONNECTED', 'DISCONNECTING'],
      'DISCONNECTED': ['RECONNECTING', 'CONNECTED']
    };
    
    const allowedTransitions = validTransitions[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * Handle status change logic
   * Requirements: 2.1
   */
  handleStatusChange(playerId, connectionInfo, oldStatus, newStatus, reason) {
    switch (newStatus) {
      case 'DISCONNECTING':
        // Start monitoring for potential recovery
        break;
        
      case 'DISCONNECTED':
        // Clean up resources, but keep connection info for potential reconnection
        this.stopHeartbeatMonitoring(connectionInfo);
        break;
        
      case 'RECONNECTING':
        // Reset some metrics for fresh start
        connectionInfo.reconnectionAttempts = (connectionInfo.reconnectionAttempts || 0) + 1;
        break;
        
      case 'CONNECTED':
        // Reset disconnection-related fields
        connectionInfo.disconnectedAt = null;
        connectionInfo.lastDisconnectReason = null;
        break;
    }
  }

  /**
   * Assess connection quality based on latency and packet loss
   * Requirements: 7.3, 7.5
   */
  assessConnectionQuality(latency, packetLoss = 0) {
    const thresholds = this.config.latencyThresholds;
    
    // Factor in packet loss
    let adjustedLatency = latency;
    if (packetLoss > 0.1) { // More than 10% packet loss
      adjustedLatency *= (1 + packetLoss * 2); // Increase effective latency
    }
    
    if (adjustedLatency < thresholds.excellent && packetLoss < 0.01) return 'excellent';
    if (adjustedLatency < thresholds.good && packetLoss < 0.05) return 'good';
    if (adjustedLatency < thresholds.fair && packetLoss < 0.1) return 'fair';
    return 'poor';
  }

  /**
   * Update connection metrics and assess quality
   * Requirements: 7.3, 7.5
   */
  updateConnectionMetrics(playerId, metrics) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return;
    
    const { latency, packetLoss = 0, timestamp = Date.now() } = metrics;
    
    // Update metrics
    connectionInfo.latency = latency;
    connectionInfo.packetLoss = packetLoss;
    connectionInfo.lastSeen = timestamp;
    
    // Assess connection quality
    const oldQuality = connectionInfo.connectionQuality;
    connectionInfo.connectionQuality = this.assessConnectionQuality(latency, packetLoss);
    
    // Check if quality has degraded significantly
    if (this.hasConnectionQualityDegraded(oldQuality, connectionInfo.connectionQuality)) {
      this.emitConnectionQualityWarning(playerId, connectionInfo);
    }
    
    // Update network type if available
    if (metrics.networkType) {
      connectionInfo.networkType = metrics.networkType;
    }
  }

  /**
   * Check if connection quality has degraded significantly
   * Requirements: 7.5
   */
  hasConnectionQualityDegraded(oldQuality, newQuality) {
    const qualityLevels = {
      'excellent': 4,
      'good': 3,
      'fair': 2,
      'poor': 1,
      'unknown': 0
    };
    
    const oldLevel = qualityLevels[oldQuality] || 0;
    const newLevel = qualityLevels[newQuality] || 0;
    
    // Consider it degraded if it drops by 2 or more levels, or drops to 'poor'
    return (oldLevel - newLevel >= 2) || (newQuality === 'poor' && oldQuality !== 'poor');
  }

  /**
   * Emit connection quality warning
   * Requirements: 7.5
   */
  emitConnectionQualityWarning(playerId, connectionInfo) {
    console.warn(`⚠️ Connection quality warning for ${playerId}: ${connectionInfo.connectionQuality} (latency: ${connectionInfo.latency}ms, packet loss: ${(connectionInfo.packetLoss * 100).toFixed(1)}%)`);
    
    this.emit('connectionQualityWarning', {
      playerId,
      quality: connectionInfo.connectionQuality,
      latency: connectionInfo.latency,
      packetLoss: connectionInfo.packetLoss,
      isMobile: connectionInfo.isMobile,
      networkType: connectionInfo.networkType,
      recommendedActions: this.getQualityRecommendations(connectionInfo)
    });
  }

  /**
   * Get recommendations based on connection quality
   * Requirements: 7.5
   */
  getQualityRecommendations(connectionInfo) {
    const recommendations = [];
    
    if (connectionInfo.connectionQuality === 'poor') {
      recommendations.push('Consider switching to a more stable network');
      
      if (connectionInfo.isMobile) {
        recommendations.push('Try switching from cellular to WiFi');
        recommendations.push('Move closer to your WiFi router');
      }
      
      if (connectionInfo.networkType === 'cellular') {
        recommendations.push('Check your cellular signal strength');
      }
      
      recommendations.push('Close other applications using network bandwidth');
    } else if (connectionInfo.connectionQuality === 'fair') {
      recommendations.push('Connection is unstable - consider improving network conditions');
      
      if (connectionInfo.isMobile) {
        recommendations.push('Ensure stable WiFi connection');
      }
    }
    
    return recommendations;
  }

  /**
   * Monitor connection stability over time
   * Requirements: 7.3
   */
  assessConnectionStability(playerId) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return 'unknown';
    
    const recentHistory = connectionInfo.statusHistory.slice(-5); // Last 5 status changes
    const disconnectionCount = connectionInfo.disconnectionCount || 0;
    const connectionAge = Date.now() - connectionInfo.connectedAt;
    
    // Consider unstable if:
    // - Multiple recent disconnections
    // - High disconnection rate
    // - Frequent status changes
    if (disconnectionCount >= 3 || 
        (disconnectionCount >= 2 && connectionAge < 300000) || // 2+ disconnections in 5 minutes
        recentHistory.length >= 4) { // 4+ status changes recently
      return 'unstable';
    }
    
    if (disconnectionCount >= 1 || recentHistory.length >= 2) {
      return 'somewhat_unstable';
    }
    
    return 'stable';
  }

  /**
   * Enhanced mobile device detection with more patterns
   * Requirements: 7.1
   */
  detectMobileDevice(socket) {
    const userAgent = socket.handshake.headers['user-agent'] || '';
    const mobilePatterns = [
      /Android/i,
      /iPhone/i,
      /iPad/i,
      /iPod/i,
      /BlackBerry/i,
      /Windows Phone/i,
      /Mobile/i,
      /webOS/i,
      /Opera Mini/i,
      /IEMobile/i,
      /WPDesktop/i,
      /Kindle/i,
      /Silk/i,
      /Tablet/i
    ];
    
    return mobilePatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Detect network type from connection with enhanced mobile detection
   * Requirements: 7.1, 7.3
   */
  detectNetworkType(socket) {
    const connection = socket.conn;
    const userAgent = socket.handshake.headers['user-agent'] || '';
    
    // Enhanced network type detection
    if (connection && connection.transport) {
      const transportName = connection.transport.name;
      
      // If using polling instead of websocket, likely indicates network issues
      if (transportName === 'polling') {
        return 'unstable';
      }
      
      // Check for mobile indicators in user agent
      if (this.detectMobileDevice(socket)) {
        // Try to determine if mobile is on WiFi or cellular
        // This is a simplified heuristic - in production you might use more sophisticated detection
        const hasWifiIndicators = userAgent.includes('WiFi') || userAgent.includes('WLAN');
        return hasWifiIndicators ? 'wifi' : 'cellular';
      }
      
      return transportName === 'websocket' ? 'wifi' : 'cellular';
    }
    
    return 'unknown';
  }

  /**
   * Handle network type change for a player
   * Requirements: 7.1, 7.3
   */
  handleNetworkTypeChange(playerId, newNetworkType) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return;
    
    const oldNetworkType = connectionInfo.networkType;
    connectionInfo.networkType = newNetworkType;
    
    console.log(`📶 Network type changed for ${playerId}: ${oldNetworkType} -> ${newNetworkType}`);
    
    // Emit network change event
    this.emit('networkTypeChanged', {
      playerId,
      oldNetworkType,
      newNetworkType,
      isMobile: connectionInfo.isMobile,
      connectionQuality: connectionInfo.connectionQuality
    });
    
    // Adjust grace period if needed based on new network type
    if (newNetworkType === 'cellular' && oldNetworkType === 'wifi') {
      console.log(`📱 Player ${playerId} switched to cellular - may need extended grace period`);
    }
  }

  /**
   * Get connection status for a player
   * Requirements: 2.1
   */
  getPlayerStatus(playerId) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) {
      return { status: 'unknown' };
    }
    
    return {
      playerId: connectionInfo.playerId,
      status: connectionInfo.status,
      connectedAt: connectionInfo.connectedAt,
      lastSeen: connectionInfo.lastSeen,
      latency: connectionInfo.latency,
      connectionQuality: connectionInfo.connectionQuality,
      isMobile: connectionInfo.isMobile,
      networkType: connectionInfo.networkType,
      disconnectionCount: connectionInfo.disconnectionCount,
      reconnectionAttempts: connectionInfo.reconnectionAttempts,
      gameId: connectionInfo.gameId
    };
  }

  /**
   * Get all players' status for a game
   * Requirements: 2.1
   */
  getGamePlayersStatus(gameId) {
    const gamePlayerStatuses = [];
    
    for (const [playerId, connectionInfo] of this.playerConnections) {
      if (connectionInfo.gameId === gameId) {
        gamePlayerStatuses.push(this.getPlayerStatus(playerId));
      }
    }
    
    return gamePlayerStatuses;
  }

  /**
   * Determine appropriate grace period for a player
   * Requirements: 7.3
   */
  getGracePeriodForPlayer(playerId) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) {
      return this.config.standardGracePeriod;
    }
    
    const stability = this.assessConnectionStability(playerId);
    
    // Use extended grace period for unstable connections or mobile devices
    if (stability === 'unstable' || 
        connectionInfo.connectionQuality === 'poor' || 
        connectionInfo.isMobile ||
        connectionInfo.networkType === 'cellular') {
      return this.config.extendedGracePeriod;
    }
    
    if (stability === 'somewhat_unstable' || connectionInfo.connectionQuality === 'fair') {
      // Intermediate grace period
      return Math.floor((this.config.standardGracePeriod + this.config.extendedGracePeriod) / 2);
    }
    
    return this.config.standardGracePeriod;
  }

  /**
   * Clean up connection info for a player
   * Requirements: 2.1
   */
  removePlayer(playerId) {
    const connectionInfo = this.playerConnections.get(playerId);
    if (!connectionInfo) return false;
    
    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring(connectionInfo);
    
    // Clear any timers
    if (connectionInfo.disconnectionTimer) {
      clearTimeout(connectionInfo.disconnectionTimer);
    }
    
    // Remove from mappings
    this.playerConnections.delete(playerId);
    if (connectionInfo.socketId) {
      this.socketToPlayer.delete(connectionInfo.socketId);
    }
    
    console.log(`🗑️ Player connection info removed: ${playerId}`);
    
    // Emit removal event
    this.emit('playerRemoved', { playerId, connectionInfo });
    
    return true;
  }

  /**
   * Get comprehensive status for monitoring
   * Requirements: 2.1
   */
  getStatus() {
    const totalPlayers = this.playerConnections.size;
    const statusCounts = {
      CONNECTED: 0,
      DISCONNECTING: 0,
      RECONNECTING: 0,
      DISCONNECTED: 0
    };
    
    let totalLatency = 0;
    let latencyCount = 0;
    
    for (const [playerId, connectionInfo] of this.playerConnections) {
      statusCounts[connectionInfo.status] = (statusCounts[connectionInfo.status] || 0) + 1;
      
      if (connectionInfo.latency !== null) {
        totalLatency += connectionInfo.latency;
        latencyCount++;
      }
    }
    
    return {
      totalPlayers,
      statusCounts,
      averageLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
      config: this.config
    };
  }
}

module.exports = PlayerConnectionManager;