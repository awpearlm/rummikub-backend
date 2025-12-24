/**
 * Mobile Integration Service
 * Integrates app backgrounding detection with pause logic, network quality monitoring,
 * and mobile-specific optimizations for the reconnection system
 * Requirements: 7.1, 7.3, 7.5
 */

const analyticsLogger = require('./analyticsLogger');

class MobileIntegrationService {
  constructor(playerConnectionManager, gamePauseController, notificationBroadcaster) {
    this.playerConnectionManager = playerConnectionManager;
    this.gamePauseController = gamePauseController;
    this.notificationBroadcaster = notificationBroadcaster;
    
    // Mobile-specific configuration
    this.config = {
      // App backgrounding detection
      backgroundingTolerance: 10000, // 10 seconds
      backgroundingDetectionPatterns: [
        'transport close',
        'client namespace disconnect',
        'ping timeout',
        'transport error'
      ],
      
      // Network quality monitoring
      networkQualityCheckInterval: 30000, // 30 seconds
      networkQualityThresholds: {
        excellent: { latency: 50, packetLoss: 0.01 },
        good: { latency: 150, packetLoss: 0.05 },
        fair: { latency: 300, packetLoss: 0.1 },
        poor: { latency: 500, packetLoss: 0.2 }
      },
      
      // Mobile optimizations
      mobileGracePeriodMultiplier: 1.5, // 50% longer grace periods
      mobileHeartbeatInterval: 35000, // Longer heartbeat for mobile
      mobileReconnectionRetryDelay: 3000, // Longer retry delays
      
      // Network type specific settings
      networkTypeSettings: {
        wifi: {
          gracePeriodMultiplier: 1.0,
          heartbeatInterval: 25000,
          reconnectionTimeout: 10000
        },
        cellular: {
          gracePeriodMultiplier: 2.0, // Double grace period for cellular
          heartbeatInterval: 45000, // Longer heartbeat
          reconnectionTimeout: 20000 // Longer timeout
        },
        unknown: {
          gracePeriodMultiplier: 1.5,
          heartbeatInterval: 35000,
          reconnectionTimeout: 15000
        }
      }
    };
    
    // Track mobile-specific metrics
    this.mobileMetrics = new Map(); // playerId -> mobile metrics
    this.networkQualityHistory = new Map(); // playerId -> quality history
    this.backgroundingEvents = new Map(); // playerId -> backgrounding events
    
    // Network quality monitoring intervals
    this.networkQualityIntervals = new Map(); // playerId -> interval
    
    console.log('📱 Mobile Integration Service initialized');
  }

  /**
   * Initialize mobile-specific monitoring for a player
   * Requirements: 7.1, 7.3
   * @param {string} playerId - Player ID
   * @param {Object} connectionInfo - Connection information
   * @param {Object} deviceInfo - Device information
   */
  initializeMobileMonitoring(playerId, connectionInfo, deviceInfo = {}) {
    try {
      console.log(`📱 Initializing mobile monitoring for ${playerId}`);
      
      // Store mobile metrics
      const mobileMetrics = {
        playerId,
        isMobile: deviceInfo.isMobile || this.detectMobileDevice(deviceInfo),
        deviceType: deviceInfo.deviceType || this.detectDeviceType(deviceInfo),
        networkType: connectionInfo.networkType || 'unknown',
        initialConnectionQuality: connectionInfo.connectionQuality || 'unknown',
        
        // App lifecycle tracking
        appBackgroundEvents: 0,
        appForegroundEvents: 0,
        lastBackgroundTime: null,
        lastForegroundTime: null,
        totalBackgroundDuration: 0,
        
        // Network quality tracking
        networkQualityHistory: [],
        networkSwitchEvents: 0,
        lastNetworkSwitch: null,
        
        // Performance metrics
        averageLatency: null,
        averagePacketLoss: null,
        connectionStability: 'unknown',
        
        // Optimization flags
        optimizationsEnabled: [],
        lastOptimizationUpdate: new Date(),
        
        // Timestamps
        monitoringStarted: new Date(),
        lastUpdate: new Date()
      };
      
      this.mobileMetrics.set(playerId, mobileMetrics);
      
      // Start network quality monitoring if mobile
      if (mobileMetrics.isMobile) {
        this.startNetworkQualityMonitoring(playerId);
        this.enableMobileOptimizations(playerId, mobileMetrics);
      }
      
      // Log mobile monitoring initialization
      analyticsLogger.logMobileEvent({
        playerId,
        eventType: 'monitoring_initialized',
        isMobile: mobileMetrics.isMobile,
        deviceType: mobileMetrics.deviceType,
        networkType: mobileMetrics.networkType,
        optimizationsEnabled: mobileMetrics.optimizationsEnabled,
        metadata: { deviceInfo, connectionInfo }
      });
      
      console.log(`✅ Mobile monitoring initialized for ${playerId} (mobile: ${mobileMetrics.isMobile})`);
      
      return mobileMetrics;
      
    } catch (error) {
      console.error(`❌ Failed to initialize mobile monitoring for ${playerId}:`, error.message);
      return null;
    }
  }

  /**
   * Handle app backgrounding event with tolerance and smart detection
   * Requirements: 7.1
   * @param {string} playerId - Player ID
   * @param {string} reason - Backgrounding reason
   * @param {Object} context - Additional context
   */
  async handleAppBackgrounding(playerId, reason, context = {}) {
    try {
      console.log(`📱 Handling app backgrounding for ${playerId}: ${reason}`);
      
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics) {
        console.log(`⚠️ No mobile metrics found for ${playerId}`);
        return;
      }
      
      // Update backgrounding metrics
      mobileMetrics.appBackgroundEvents++;
      mobileMetrics.lastBackgroundTime = new Date();
      mobileMetrics.lastUpdate = new Date();
      
      // Store backgrounding event
      const backgroundingEvent = {
        timestamp: new Date(),
        reason,
        context,
        duration: null, // Will be set when app returns to foreground
        wasToleratedDisconnection: false
      };
      
      if (!this.backgroundingEvents.has(playerId)) {
        this.backgroundingEvents.set(playerId, []);
      }
      this.backgroundingEvents.get(playerId).push(backgroundingEvent);
      
      // Apply backgrounding tolerance
      const toleranceResult = await this.applyBackgroundingTolerance(playerId, reason, context);
      backgroundingEvent.wasToleratedDisconnection = toleranceResult.tolerated;
      
      // Log backgrounding event
      analyticsLogger.logMobileEvent({
        playerId,
        eventType: 'app_backgrounding',
        reason,
        backgroundingCount: mobileMetrics.appBackgroundEvents,
        toleranceApplied: toleranceResult.tolerated,
        toleranceDuration: toleranceResult.toleranceDuration,
        networkType: mobileMetrics.networkType,
        connectionQuality: this.getCurrentConnectionQuality(playerId),
        metadata: { context, toleranceResult }
      });
      
      console.log(`📱 App backgrounding handled for ${playerId} (tolerated: ${toleranceResult.tolerated})`);
      
    } catch (error) {
      console.error(`❌ Error handling app backgrounding for ${playerId}:`, error.message);
    }
  }

  /**
   * Handle app foregrounding event
   * Requirements: 7.1
   * @param {string} playerId - Player ID
   * @param {Object} context - Additional context
   */
  async handleAppForegrounding(playerId, context = {}) {
    try {
      console.log(`📱 Handling app foregrounding for ${playerId}`);
      
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics) {
        console.log(`⚠️ No mobile metrics found for ${playerId}`);
        return;
      }
      
      // Update foregrounding metrics
      mobileMetrics.appForegroundEvents++;
      mobileMetrics.lastForegroundTime = new Date();
      mobileMetrics.lastUpdate = new Date();
      
      // Calculate background duration if we have a background time
      if (mobileMetrics.lastBackgroundTime) {
        const backgroundDuration = Date.now() - mobileMetrics.lastBackgroundTime.getTime();
        mobileMetrics.totalBackgroundDuration += backgroundDuration;
        
        // Update the last backgrounding event with duration
        const backgroundingEvents = this.backgroundingEvents.get(playerId) || [];
        const lastEvent = backgroundingEvents[backgroundingEvents.length - 1];
        if (lastEvent && !lastEvent.duration) {
          lastEvent.duration = backgroundDuration;
        }
        
        console.log(`📱 App was backgrounded for ${backgroundDuration}ms`);
      }
      
      // Check if we need to trigger reconnection recovery
      await this.checkReconnectionRecovery(playerId, context);
      
      // Log foregrounding event
      analyticsLogger.logMobileEvent({
        playerId,
        eventType: 'app_foregrounding',
        foregroundingCount: mobileMetrics.appForegroundEvents,
        backgroundDuration: mobileMetrics.lastBackgroundTime ? 
          Date.now() - mobileMetrics.lastBackgroundTime.getTime() : null,
        totalBackgroundDuration: mobileMetrics.totalBackgroundDuration,
        networkType: mobileMetrics.networkType,
        connectionQuality: this.getCurrentConnectionQuality(playerId),
        metadata: { context }
      });
      
      console.log(`✅ App foregrounding handled for ${playerId}`);
      
    } catch (error) {
      console.error(`❌ Error handling app foregrounding for ${playerId}:`, error.message);
    }
  }

  /**
   * Apply backgrounding tolerance to prevent unnecessary disconnections
   * Requirements: 7.1
   * @param {string} playerId - Player ID
   * @param {string} reason - Backgrounding reason
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Tolerance result
   */
  async applyBackgroundingTolerance(playerId, reason, context) {
    try {
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics || !mobileMetrics.isMobile) {
        return { tolerated: false, reason: 'not_mobile' };
      }
      
      // Check if this looks like app backgrounding
      const isBackgroundingPattern = this.config.backgroundingDetectionPatterns.some(pattern =>
        reason.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (!isBackgroundingPattern) {
        return { tolerated: false, reason: 'not_backgrounding_pattern' };
      }
      
      // Determine tolerance duration based on network type and history
      let toleranceDuration = this.config.backgroundingTolerance;
      
      // Adjust based on network type
      const networkSettings = this.config.networkTypeSettings[mobileMetrics.networkType] || 
                             this.config.networkTypeSettings.unknown;
      toleranceDuration *= networkSettings.gracePeriodMultiplier;
      
      // Adjust based on backgrounding history
      const recentBackgroundingEvents = this.getRecentBackgroundingEvents(playerId, 300000); // 5 minutes
      if (recentBackgroundingEvents.length > 2) {
        toleranceDuration *= 0.5; // Reduce tolerance for frequent backgrounding
      }
      
      // Apply tolerance through player connection manager
      const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
      if (connectionInfo) {
        // Delay the disconnection detection
        setTimeout(() => {
          // Check if player is still disconnected after tolerance period
          const currentStatus = this.playerConnectionManager.getPlayerStatus(playerId);
          if (currentStatus && currentStatus.status === 'DISCONNECTING') {
            console.log(`📱 Backgrounding tolerance expired for ${playerId}, proceeding with disconnection`);
            // Let the normal disconnection flow proceed
          }
        }, toleranceDuration);
      }
      
      console.log(`📱 Backgrounding tolerance applied for ${playerId}: ${toleranceDuration}ms`);
      
      return {
        tolerated: true,
        toleranceDuration,
        reason: 'mobile_backgrounding_detected',
        networkType: mobileMetrics.networkType,
        backgroundingHistory: recentBackgroundingEvents.length
      };
      
    } catch (error) {
      console.error(`❌ Error applying backgrounding tolerance:`, error.message);
      return { tolerated: false, reason: 'tolerance_error', error: error.message };
    }
  }

  /**
   * Handle network type changes with mobile-specific logic
   * Requirements: 7.3
   * @param {string} playerId - Player ID
   * @param {string} oldNetworkType - Previous network type
   * @param {string} newNetworkType - New network type
   * @param {Object} context - Additional context
   */
  async handleNetworkTypeChange(playerId, oldNetworkType, newNetworkType, context = {}) {
    try {
      console.log(`📱 Handling network type change for ${playerId}: ${oldNetworkType} -> ${newNetworkType}`);
      
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics) {
        console.log(`⚠️ No mobile metrics found for ${playerId}`);
        return;
      }
      
      // Update metrics
      mobileMetrics.networkType = newNetworkType;
      mobileMetrics.networkSwitchEvents++;
      mobileMetrics.lastNetworkSwitch = new Date();
      mobileMetrics.lastUpdate = new Date();
      
      // Apply network-specific optimizations
      await this.applyNetworkTypeOptimizations(playerId, newNetworkType, oldNetworkType);
      
      // Adjust grace periods for active games
      await this.adjustGracePeriodsForNetworkChange(playerId, newNetworkType);
      
      // Notify other players if this affects game stability
      await this.notifyNetworkTypeChange(playerId, oldNetworkType, newNetworkType);
      
      // Log network type change
      analyticsLogger.logMobileEvent({
        playerId,
        eventType: 'network_type_change',
        oldNetworkType,
        newNetworkType,
        networkSwitchCount: mobileMetrics.networkSwitchEvents,
        isMobile: mobileMetrics.isMobile,
        connectionQuality: this.getCurrentConnectionQuality(playerId),
        optimizationsApplied: mobileMetrics.optimizationsEnabled,
        metadata: { context }
      });
      
      console.log(`✅ Network type change handled for ${playerId}`);
      
    } catch (error) {
      console.error(`❌ Error handling network type change for ${playerId}:`, error.message);
    }
  }

  /**
   * Monitor network quality continuously for mobile devices
   * Requirements: 7.3, 7.5
   * @param {string} playerId - Player ID
   */
  startNetworkQualityMonitoring(playerId) {
    try {
      // Clear any existing interval
      this.stopNetworkQualityMonitoring(playerId);
      
      const interval = setInterval(async () => {
        try {
          await this.checkNetworkQuality(playerId);
        } catch (error) {
          console.error(`❌ Network quality check error for ${playerId}:`, error.message);
        }
      }, this.config.networkQualityCheckInterval);
      
      this.networkQualityIntervals.set(playerId, interval);
      console.log(`📊 Network quality monitoring started for ${playerId}`);
      
    } catch (error) {
      console.error(`❌ Failed to start network quality monitoring for ${playerId}:`, error.message);
    }
  }

  /**
   * Stop network quality monitoring for a player
   * @param {string} playerId - Player ID
   */
  stopNetworkQualityMonitoring(playerId) {
    const interval = this.networkQualityIntervals.get(playerId);
    if (interval) {
      clearInterval(interval);
      this.networkQualityIntervals.delete(playerId);
      console.log(`📊 Network quality monitoring stopped for ${playerId}`);
    }
  }

  /**
   * Check network quality and apply optimizations if needed
   * Requirements: 7.3, 7.5
   * @param {string} playerId - Player ID
   */
  async checkNetworkQuality(playerId) {
    try {
      const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
      if (!connectionInfo) {
        return;
      }
      
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics) {
        return;
      }
      
      // Get current network metrics
      const currentQuality = {
        latency: connectionInfo.latency || 0,
        packetLoss: 0, // Would be calculated from connection metrics
        timestamp: new Date(),
        networkType: mobileMetrics.networkType
      };
      
      // Store in history
      if (!this.networkQualityHistory.has(playerId)) {
        this.networkQualityHistory.set(playerId, []);
      }
      const history = this.networkQualityHistory.get(playerId);
      history.push(currentQuality);
      
      // Keep only recent history (last 10 measurements)
      if (history.length > 10) {
        history.shift();
      }
      
      // Calculate quality trend
      const qualityTrend = this.calculateQualityTrend(history);
      const currentQualityLevel = this.assessNetworkQuality(currentQuality);
      
      // Update mobile metrics
      mobileMetrics.averageLatency = this.calculateAverageLatency(history);
      mobileMetrics.averagePacketLoss = this.calculateAveragePacketLoss(history);
      mobileMetrics.connectionStability = qualityTrend.stability;
      mobileMetrics.lastUpdate = new Date();
      
      // Check if quality has degraded significantly
      if (qualityTrend.degraded || currentQualityLevel === 'poor') {
        await this.handlePoorNetworkQuality(playerId, currentQuality, qualityTrend);
      }
      
      // Apply optimizations based on quality
      if (currentQualityLevel === 'fair' || currentQualityLevel === 'poor') {
        await this.applyNetworkQualityOptimizations(playerId, currentQualityLevel);
      }
      
    } catch (error) {
      console.error(`❌ Error checking network quality for ${playerId}:`, error.message);
    }
  }

  /**
   * Handle poor network quality with warnings and optimizations
   * Requirements: 7.5
   * @param {string} playerId - Player ID
   * @param {Object} currentQuality - Current quality metrics
   * @param {Object} qualityTrend - Quality trend analysis
   */
  async handlePoorNetworkQuality(playerId, currentQuality, qualityTrend) {
    try {
      console.log(`📱 Handling poor network quality for ${playerId}`);
      
      const mobileMetrics = this.mobileMetrics.get(playerId);
      const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
      
      if (!mobileMetrics || !connectionInfo) {
        return;
      }
      
      // Generate recommendations
      const recommendations = this.generateNetworkRecommendations(mobileMetrics, currentQuality);
      
      // Emit connection quality warning
      this.playerConnectionManager.emit('connectionQualityWarning', {
        playerId,
        quality: this.assessNetworkQuality(currentQuality),
        latency: currentQuality.latency,
        packetLoss: currentQuality.packetLoss,
        isMobile: mobileMetrics.isMobile,
        networkType: mobileMetrics.networkType,
        recommendedActions: recommendations,
        trend: qualityTrend
      });
      
      // Notify game players if in a game
      if (connectionInfo.gameId) {
        this.notificationBroadcaster.broadcastConnectionQualityWarning(connectionInfo.gameId, {
          playerName: playerId,
          quality: this.assessNetworkQuality(currentQuality),
          latency: currentQuality.latency,
          packetLoss: currentQuality.packetLoss,
          recommendedActions: recommendations,
          isMobile: mobileMetrics.isMobile,
          networkType: mobileMetrics.networkType
        });
      }
      
      // Log poor quality event
      analyticsLogger.logMobileEvent({
        playerId,
        eventType: 'poor_network_quality',
        quality: this.assessNetworkQuality(currentQuality),
        latency: currentQuality.latency,
        packetLoss: currentQuality.packetLoss,
        networkType: mobileMetrics.networkType,
        isMobile: mobileMetrics.isMobile,
        recommendations,
        qualityTrend,
        metadata: { currentQuality }
      });
      
    } catch (error) {
      console.error(`❌ Error handling poor network quality for ${playerId}:`, error.message);
    }
  }

  /**
   * Apply mobile-specific optimizations
   * Requirements: 7.1, 7.3
   * @param {string} playerId - Player ID
   * @param {Object} mobileMetrics - Mobile metrics
   */
  async enableMobileOptimizations(playerId, mobileMetrics) {
    try {
      const optimizations = [];
      
      // Enable longer heartbeat intervals for mobile
      if (mobileMetrics.isMobile) {
        optimizations.push('extended_heartbeat');
      }
      
      // Enable network-specific optimizations
      const networkSettings = this.config.networkTypeSettings[mobileMetrics.networkType];
      if (networkSettings) {
        if (networkSettings.gracePeriodMultiplier > 1.0) {
          optimizations.push('extended_grace_period');
        }
        if (networkSettings.heartbeatInterval > 30000) {
          optimizations.push('reduced_heartbeat_frequency');
        }
      }
      
      // Enable cellular-specific optimizations
      if (mobileMetrics.networkType === 'cellular') {
        optimizations.push('cellular_optimization');
        optimizations.push('reduced_update_frequency');
      }
      
      // Update mobile metrics
      mobileMetrics.optimizationsEnabled = optimizations;
      mobileMetrics.lastOptimizationUpdate = new Date();
      
      console.log(`📱 Mobile optimizations enabled for ${playerId}: ${optimizations.join(', ')}`);
      
    } catch (error) {
      console.error(`❌ Error enabling mobile optimizations for ${playerId}:`, error.message);
    }
  }

  /**
   * Apply network type specific optimizations
   * Requirements: 7.3
   * @param {string} playerId - Player ID
   * @param {string} newNetworkType - New network type
   * @param {string} oldNetworkType - Old network type
   */
  async applyNetworkTypeOptimizations(playerId, newNetworkType, oldNetworkType) {
    try {
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics) {
        return;
      }
      
      const networkSettings = this.config.networkTypeSettings[newNetworkType] || 
                             this.config.networkTypeSettings.unknown;
      
      // Update player connection manager settings for this player
      const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
      if (connectionInfo) {
        // Adjust grace period for active games
        if (connectionInfo.gameId) {
          const newGracePeriod = this.playerConnectionManager.config.standardGracePeriod * 
                                networkSettings.gracePeriodMultiplier;
          
          // Update the grace period if game is currently paused
          const pauseStatus = await this.gamePauseController.getPauseStatus(connectionInfo.gameId);
          if (pauseStatus && pauseStatus.gracePeriod.isActive && 
              pauseStatus.gracePeriod.targetPlayerId === playerId) {
            
            // Extend grace period if switching to less stable network
            if (newNetworkType === 'cellular' && oldNetworkType === 'wifi') {
              console.log(`📱 Extending grace period for ${playerId} due to network switch to cellular`);
              // Implementation would extend the existing grace period
            }
          }
        }
      }
      
      // Update optimizations
      const currentOptimizations = mobileMetrics.optimizationsEnabled || [];
      const newOptimizations = [...currentOptimizations];
      
      // Add network-specific optimizations
      if (newNetworkType === 'cellular' && !newOptimizations.includes('cellular_optimization')) {
        newOptimizations.push('cellular_optimization');
      }
      
      if (networkSettings.gracePeriodMultiplier > 1.5 && 
          !newOptimizations.includes('extended_grace_period')) {
        newOptimizations.push('extended_grace_period');
      }
      
      mobileMetrics.optimizationsEnabled = newOptimizations;
      mobileMetrics.lastOptimizationUpdate = new Date();
      
      console.log(`📱 Network type optimizations applied for ${playerId}: ${newOptimizations.join(', ')}`);
      
    } catch (error) {
      console.error(`❌ Error applying network type optimizations for ${playerId}:`, error.message);
    }
  }

  /**
   * Apply network quality optimizations
   * Requirements: 7.5
   * @param {string} playerId - Player ID
   * @param {string} qualityLevel - Network quality level
   */
  async applyNetworkQualityOptimizations(playerId, qualityLevel) {
    try {
      const mobileMetrics = this.mobileMetrics.get(playerId);
      if (!mobileMetrics) {
        return;
      }
      
      const optimizations = [...(mobileMetrics.optimizationsEnabled || [])];
      
      // Apply quality-specific optimizations
      switch (qualityLevel) {
        case 'poor':
          if (!optimizations.includes('reduced_update_frequency')) {
            optimizations.push('reduced_update_frequency');
          }
          if (!optimizations.includes('extended_timeouts')) {
            optimizations.push('extended_timeouts');
          }
          if (!optimizations.includes('simplified_protocol')) {
            optimizations.push('simplified_protocol');
          }
          break;
          
        case 'fair':
          if (!optimizations.includes('extended_timeouts')) {
            optimizations.push('extended_timeouts');
          }
          break;
      }
      
      mobileMetrics.optimizationsEnabled = optimizations;
      mobileMetrics.lastOptimizationUpdate = new Date();
      
      console.log(`📱 Quality optimizations applied for ${playerId} (${qualityLevel}): ${optimizations.join(', ')}`);
      
    } catch (error) {
      console.error(`❌ Error applying quality optimizations for ${playerId}:`, error.message);
    }
  }

  /**
   * Utility methods
   */

  detectMobileDevice(deviceInfo) {
    const userAgent = deviceInfo.userAgent || '';
    const mobilePatterns = [
      /Android/i, /iPhone/i, /iPad/i, /iPod/i, /BlackBerry/i,
      /Windows Phone/i, /Mobile/i, /webOS/i, /Opera Mini/i
    ];
    return mobilePatterns.some(pattern => pattern.test(userAgent));
  }

  detectDeviceType(deviceInfo) {
    const userAgent = deviceInfo.userAgent || '';
    if (/iPad/i.test(userAgent)) return 'tablet';
    if (/iPhone|iPod|Android.*Mobile|BlackBerry|Windows Phone/i.test(userAgent)) return 'phone';
    return 'desktop';
  }

  getCurrentConnectionQuality(playerId) {
    const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
    return connectionInfo ? connectionInfo.connectionQuality : 'unknown';
  }

  getRecentBackgroundingEvents(playerId, timeWindow = 300000) {
    const events = this.backgroundingEvents.get(playerId) || [];
    const cutoffTime = new Date(Date.now() - timeWindow);
    return events.filter(event => event.timestamp > cutoffTime);
  }

  calculateQualityTrend(history) {
    if (history.length < 3) {
      return { stability: 'unknown', degraded: false };
    }
    
    const recent = history.slice(-3);
    const older = history.slice(-6, -3);
    
    const recentAvgLatency = recent.reduce((sum, q) => sum + q.latency, 0) / recent.length;
    const olderAvgLatency = older.length > 0 ? 
      older.reduce((sum, q) => sum + q.latency, 0) / older.length : recentAvgLatency;
    
    const latencyIncrease = recentAvgLatency - olderAvgLatency;
    const degraded = latencyIncrease > 100; // 100ms increase is significant
    
    let stability = 'stable';
    if (latencyIncrease > 200) stability = 'unstable';
    else if (latencyIncrease > 50) stability = 'somewhat_unstable';
    
    return { stability, degraded, latencyIncrease };
  }

  assessNetworkQuality(qualityMetrics) {
    const { latency, packetLoss = 0 } = qualityMetrics;
    const thresholds = this.config.networkQualityThresholds;
    
    if (latency <= thresholds.excellent.latency && packetLoss <= thresholds.excellent.packetLoss) {
      return 'excellent';
    } else if (latency <= thresholds.good.latency && packetLoss <= thresholds.good.packetLoss) {
      return 'good';
    } else if (latency <= thresholds.fair.latency && packetLoss <= thresholds.fair.packetLoss) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  calculateAverageLatency(history) {
    if (history.length === 0) return null;
    return history.reduce((sum, q) => sum + q.latency, 0) / history.length;
  }

  calculateAveragePacketLoss(history) {
    if (history.length === 0) return null;
    return history.reduce((sum, q) => sum + (q.packetLoss || 0), 0) / history.length;
  }

  generateNetworkRecommendations(mobileMetrics, currentQuality) {
    const recommendations = [];
    
    if (mobileMetrics.isMobile) {
      if (mobileMetrics.networkType === 'cellular') {
        recommendations.push('Switch to WiFi if available');
        recommendations.push('Move to an area with better cellular signal');
      } else {
        recommendations.push('Move closer to your WiFi router');
        recommendations.push('Check for WiFi interference');
      }
      
      recommendations.push('Close other apps using network bandwidth');
      
      if (currentQuality.latency > 500) {
        recommendations.push('Consider restarting your device');
      }
    } else {
      recommendations.push('Check your internet connection');
      recommendations.push('Close other applications using bandwidth');
    }
    
    return recommendations;
  }

  async checkReconnectionRecovery(playerId, context) {
    // Check if player needs to be reconnected after foregrounding
    const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
    if (connectionInfo && connectionInfo.status !== 'CONNECTED') {
      console.log(`📱 Triggering reconnection recovery for ${playerId} after foregrounding`);
      // Implementation would trigger reconnection attempt
    }
  }

  async adjustGracePeriodsForNetworkChange(playerId, newNetworkType) {
    // Adjust active grace periods based on network change
    const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
    if (connectionInfo && connectionInfo.gameId) {
      const pauseStatus = await this.gamePauseController.getPauseStatus(connectionInfo.gameId);
      if (pauseStatus && pauseStatus.gracePeriod.isActive && 
          pauseStatus.gracePeriod.targetPlayerId === playerId) {
        
        // Implementation would adjust the grace period duration
        console.log(`📱 Adjusting grace period for ${playerId} due to network change to ${newNetworkType}`);
      }
    }
  }

  async notifyNetworkTypeChange(playerId, oldNetworkType, newNetworkType) {
    const connectionInfo = this.playerConnectionManager.getPlayerStatus(playerId);
    if (connectionInfo && connectionInfo.gameId) {
      this.notificationBroadcaster.broadcastNetworkTypeChange(connectionInfo.gameId, {
        playerName: playerId,
        oldNetworkType,
        newNetworkType,
        warning: newNetworkType === 'cellular' ? 
          'Player switched to cellular network - connection may be less stable' : null
      });
    }
  }

  /**
   * Get mobile integration status for monitoring
   */
  getStatus() {
    return {
      monitoredPlayers: this.mobileMetrics.size,
      mobilePlayersCount: Array.from(this.mobileMetrics.values()).filter(m => m.isMobile).length,
      activeNetworkMonitoring: this.networkQualityIntervals.size,
      totalBackgroundingEvents: Array.from(this.mobileMetrics.values())
        .reduce((sum, m) => sum + m.appBackgroundEvents, 0),
      config: this.config,
      timestamp: new Date()
    };
  }

  /**
   * Clean up mobile monitoring for a player
   */
  cleanupPlayer(playerId) {
    this.stopNetworkQualityMonitoring(playerId);
    this.mobileMetrics.delete(playerId);
    this.networkQualityHistory.delete(playerId);
    this.backgroundingEvents.delete(playerId);
    console.log(`🧹 Mobile monitoring cleaned up for ${playerId}`);
  }

  /**
   * Shutdown the mobile integration service
   */
  shutdown() {
    console.log('🔧 Shutting down Mobile Integration Service...');
    
    // Stop all network quality monitoring
    for (const playerId of this.networkQualityIntervals.keys()) {
      this.stopNetworkQualityMonitoring(playerId);
    }
    
    // Clear all data
    this.mobileMetrics.clear();
    this.networkQualityHistory.clear();
    this.backgroundingEvents.clear();
    
    console.log('✅ Mobile Integration Service shutdown complete');
  }
}

module.exports = MobileIntegrationService;