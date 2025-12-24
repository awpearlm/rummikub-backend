/**
 * Analytics Logger for Player Reconnection Management
 * Implements Requirements 10.1, 10.2, 10.4
 * 
 * Provides comprehensive event logging with timestamps, reconnection success rate tracking,
 * and pause frequency and duration monitoring.
 */

const EventEmitter = require('events');

class AnalyticsLogger extends EventEmitter {
  constructor() {
    super();
    
    // Event storage
    this.disconnectionEvents = [];
    this.reconnectionEvents = [];
    this.pauseEvents = [];
    this.gracePeriodEvents = [];
    this.continuationEvents = [];
    
    // Timer reference
    this.metricsUpdateTimer = null;
    
    // Metrics tracking
    this.metrics = {
      // Disconnection metrics
      totalDisconnections: 0,
      disconnectionsByReason: new Map(),
      disconnectionsByPlayer: new Map(),
      disconnectionsByGame: new Map(),
      
      // Reconnection metrics
      totalReconnectionAttempts: 0,
      successfulReconnections: 0,
      failedReconnections: 0,
      reconnectionsByPlayer: new Map(),
      averageReconnectionTime: 0,
      
      // Pause metrics
      totalPauses: 0,
      pausesByReason: new Map(),
      pausesByGame: new Map(),
      totalPauseDuration: 0,
      averagePauseDuration: 0,
      
      // Grace period metrics
      totalGracePeriods: 0,
      expiredGracePeriods: 0,
      successfulGracePeriods: 0,
      averageGracePeriodDuration: 0,
      
      // Continuation metrics
      totalContinuationDecisions: 0,
      continuationDecisionsByType: new Map(),
      
      // Connection quality metrics
      connectionQualityDistribution: new Map(),
      mobileDisconnectionRate: 0,
      networkTypeDisconnections: new Map()
    };
    
    // Configuration
    this.config = {
      maxEventHistory: 10000, // Maximum events to keep in memory
      metricsUpdateInterval: 60000, // Update metrics every minute
      eventRetentionDays: 30, // Keep events for 30 days
      batchSize: 100 // Batch size for bulk operations
    };
    
    // Start metrics update interval only if not in test environment
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      this.startMetricsUpdater();
    }
    
    console.log('📊 Analytics Logger initialized');
  }

  /**
   * Log disconnection event with comprehensive details
   * Requirements: 10.1, 10.2
   * @param {Object} eventData - Disconnection event data
   */
  logDisconnectionEvent(eventData) {
    try {
      const event = {
        eventType: 'DISCONNECTION',
        timestamp: new Date(),
        playerId: eventData.playerId,
        gameId: eventData.gameId,
        reason: eventData.reason || 'unknown',
        connectionInfo: {
          isMobile: eventData.isMobile || false,
          networkType: eventData.networkType || 'unknown',
          connectionQuality: eventData.connectionQuality || 'unknown',
          latency: eventData.latency || null,
          packetLoss: eventData.packetLoss || 0
        },
        gameState: {
          isCurrentPlayer: eventData.isCurrentPlayer || false,
          turnNumber: eventData.turnNumber || 0,
          playerCount: eventData.playerCount || 0,
          gamePhase: eventData.gamePhase || 'unknown'
        },
        sessionInfo: {
          sessionDuration: eventData.sessionDuration || 0,
          previousDisconnections: eventData.previousDisconnections || 0,
          reconnectionAttempts: eventData.reconnectionAttempts || 0
        },
        metadata: eventData.metadata || {}
      };

      // Add to event history
      this.disconnectionEvents.push(event);
      this.trimEventHistory('disconnectionEvents');

      // Update metrics
      this.updateDisconnectionMetrics(event);

      // Emit event for real-time processing
      this.emit('disconnectionLogged', event);

      console.log(`📊 Disconnection event logged: ${eventData.playerId} from ${eventData.gameId} (reason: ${eventData.reason})`);

      return event;

    } catch (error) {
      console.error('❌ Failed to log disconnection event:', error.message);
      return null;
    }
  }

  /**
   * Log reconnection event with success/failure details
   * Requirements: 10.1, 10.2
   * @param {Object} eventData - Reconnection event data
   */
  logReconnectionEvent(eventData) {
    try {
      const event = {
        eventType: 'RECONNECTION',
        timestamp: new Date(),
        playerId: eventData.playerId,
        gameId: eventData.gameId,
        success: eventData.success || false,
        attemptNumber: eventData.attemptNumber || 1,
        reconnectionTime: eventData.reconnectionTime || 0, // Time taken to reconnect in ms
        disconnectionDuration: eventData.disconnectionDuration || 0, // How long they were disconnected
        reason: eventData.reason || (eventData.success ? 'successful' : 'failed'),
        connectionInfo: {
          isMobile: eventData.isMobile || false,
          networkType: eventData.networkType || 'unknown',
          connectionQuality: eventData.connectionQuality || 'unknown',
          latency: eventData.latency || null
        },
        gameState: {
          wasPaused: eventData.wasPaused || false,
          wasResumed: eventData.wasResumed || false,
          gracePeriodActive: eventData.gracePeriodActive || false,
          gracePeriodRemaining: eventData.gracePeriodRemaining || 0
        },
        stateRestoration: {
          success: eventData.stateRestorationSuccess || false,
          dataIntegrityValid: eventData.dataIntegrityValid || false,
          fallbackUsed: eventData.fallbackUsed || false
        },
        metadata: eventData.metadata || {}
      };

      // Add to event history
      this.reconnectionEvents.push(event);
      this.trimEventHistory('reconnectionEvents');

      // Update metrics
      this.updateReconnectionMetrics(event);

      // Emit event for real-time processing
      this.emit('reconnectionLogged', event);

      console.log(`📊 Reconnection event logged: ${eventData.playerId} to ${eventData.gameId} (success: ${eventData.success})`);

      return event;

    } catch (error) {
      console.error('❌ Failed to log reconnection event:', error.message);
      return null;
    }
  }

  /**
   * Log pause event with duration and reason
   * Requirements: 10.1, 10.4
   * @param {Object} eventData - Pause event data
   */
  logPauseEvent(eventData) {
    try {
      const event = {
        eventType: 'PAUSE',
        timestamp: new Date(),
        gameId: eventData.gameId,
        pauseType: eventData.pauseType || 'start', // 'start', 'end', 'expired'
        reason: eventData.reason || 'unknown',
        playerId: eventData.playerId || null, // Player who caused the pause
        duration: eventData.duration || 0, // Duration in ms (for end events)
        gameState: {
          currentPlayerIndex: eventData.currentPlayerIndex || 0,
          turnNumber: eventData.turnNumber || 0,
          playerCount: eventData.playerCount || 0,
          timerRemaining: eventData.timerRemaining || 0
        },
        gracePeriod: {
          started: eventData.gracePeriodStarted || false,
          duration: eventData.gracePeriodDuration || 0,
          targetPlayerId: eventData.gracePeriodTargetPlayer || null
        },
        metadata: eventData.metadata || {}
      };

      // Add to event history
      this.pauseEvents.push(event);
      this.trimEventHistory('pauseEvents');

      // Update metrics
      this.updatePauseMetrics(event);

      // Emit event for real-time processing
      this.emit('pauseLogged', event);

      console.log(`📊 Pause event logged: ${eventData.gameId} ${eventData.pauseType} (reason: ${eventData.reason})`);

      return event;

    } catch (error) {
      console.error('❌ Failed to log pause event:', error.message);
      return null;
    }
  }

  /**
   * Log grace period event
   * Requirements: 10.1, 10.2
   * @param {Object} eventData - Grace period event data
   */
  logGracePeriodEvent(eventData) {
    try {
      const event = {
        eventType: 'GRACE_PERIOD',
        timestamp: new Date(),
        gameId: eventData.gameId,
        gracePeriodType: eventData.gracePeriodType || 'start', // 'start', 'end', 'expired'
        targetPlayerId: eventData.targetPlayerId,
        duration: eventData.duration || 0,
        timeRemaining: eventData.timeRemaining || 0,
        outcome: eventData.outcome || null, // 'reconnected', 'expired', 'cancelled'
        connectionMetrics: {
          connectionQuality: eventData.connectionQuality || 'unknown',
          isMobile: eventData.isMobile || false,
          networkType: eventData.networkType || 'unknown',
          isExtended: eventData.isExtended || false // Extended grace period for poor connections
        },
        metadata: eventData.metadata || {}
      };

      // Add to event history
      this.gracePeriodEvents.push(event);
      this.trimEventHistory('gracePeriodEvents');

      // Update metrics
      this.updateGracePeriodMetrics(event);

      // Emit event for real-time processing
      this.emit('gracePeriodLogged', event);

      console.log(`📊 Grace period event logged: ${eventData.gameId} ${eventData.gracePeriodType} for ${eventData.targetPlayerId}`);

      return event;

    } catch (error) {
      console.error('❌ Failed to log grace period event:', error.message);
      return null;
    }
  }

  /**
   * Log continuation decision event
   * Requirements: 10.1, 10.2
   * @param {Object} eventData - Continuation decision event data
   */
  logContinuationEvent(eventData) {
    try {
      const event = {
        eventType: 'CONTINUATION',
        timestamp: new Date(),
        gameId: eventData.gameId,
        decision: eventData.decision || 'unknown', // 'skip_turn', 'add_bot', 'end_game'
        targetPlayerId: eventData.targetPlayerId,
        votingInfo: {
          totalVotes: eventData.totalVotes || 0,
          totalPlayers: eventData.totalPlayers || 0,
          voteCounts: eventData.voteCounts || {},
          votingDuration: eventData.votingDuration || 0
        },
        gameState: {
          turnNumber: eventData.turnNumber || 0,
          playerCount: eventData.playerCount || 0,
          remainingPlayers: eventData.remainingPlayers || 0
        },
        outcome: {
          gameEnded: eventData.gameEnded || false,
          botAdded: eventData.botAdded || false,
          turnSkipped: eventData.turnSkipped || false
        },
        metadata: eventData.metadata || {}
      };

      // Add to event history
      this.continuationEvents.push(event);
      this.trimEventHistory('continuationEvents');

      // Update metrics
      this.updateContinuationMetrics(event);

      // Emit event for real-time processing
      this.emit('continuationLogged', event);

      console.log(`📊 Continuation event logged: ${eventData.gameId} decision ${eventData.decision} for ${eventData.targetPlayerId}`);

      return event;

    } catch (error) {
      console.error('❌ Failed to log continuation event:', error.message);
      return null;
    }
  }

  /**
   * Update disconnection metrics
   * Requirements: 10.2
   * @param {Object} event - Disconnection event
   */
  updateDisconnectionMetrics(event) {
    try {
      // Total disconnections
      this.metrics.totalDisconnections++;

      // By reason
      const reasonCount = this.metrics.disconnectionsByReason.get(event.reason) || 0;
      this.metrics.disconnectionsByReason.set(event.reason, reasonCount + 1);

      // By player
      const playerCount = this.metrics.disconnectionsByPlayer.get(event.playerId) || 0;
      this.metrics.disconnectionsByPlayer.set(event.playerId, playerCount + 1);

      // By game
      const gameCount = this.metrics.disconnectionsByGame.get(event.gameId) || 0;
      this.metrics.disconnectionsByGame.set(event.gameId, gameCount + 1);

      // Connection quality distribution
      const qualityCount = this.metrics.connectionQualityDistribution.get(event.connectionInfo.connectionQuality) || 0;
      this.metrics.connectionQualityDistribution.set(event.connectionInfo.connectionQuality, qualityCount + 1);

      // Mobile disconnection rate
      if (event.connectionInfo.isMobile) {
        this.metrics.mobileDisconnectionRate = this.calculateMobileDisconnectionRate();
      }

      // Network type disconnections
      const networkCount = this.metrics.networkTypeDisconnections.get(event.connectionInfo.networkType) || 0;
      this.metrics.networkTypeDisconnections.set(event.connectionInfo.networkType, networkCount + 1);

    } catch (error) {
      console.error('❌ Failed to update disconnection metrics:', error.message);
    }
  }

  /**
   * Update reconnection metrics
   * Requirements: 10.2
   * @param {Object} event - Reconnection event
   */
  updateReconnectionMetrics(event) {
    try {
      // Total attempts
      this.metrics.totalReconnectionAttempts++;

      // Success/failure counts
      if (event.success) {
        this.metrics.successfulReconnections++;
      } else {
        this.metrics.failedReconnections++;
      }

      // By player
      const playerStats = this.metrics.reconnectionsByPlayer.get(event.playerId) || {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalReconnectionTime: 0
      };
      
      playerStats.attempts++;
      if (event.success) {
        playerStats.successes++;
        playerStats.totalReconnectionTime += event.reconnectionTime;
      } else {
        playerStats.failures++;
      }
      
      this.metrics.reconnectionsByPlayer.set(event.playerId, playerStats);

      // Update average reconnection time
      this.updateAverageReconnectionTime();

    } catch (error) {
      console.error('❌ Failed to update reconnection metrics:', error.message);
    }
  }

  /**
   * Update pause metrics
   * Requirements: 10.4
   * @param {Object} event - Pause event
   */
  updatePauseMetrics(event) {
    try {
      if (event.pauseType === 'start') {
        this.metrics.totalPauses++;

        // By reason
        const reasonCount = this.metrics.pausesByReason.get(event.reason) || 0;
        this.metrics.pausesByReason.set(event.reason, reasonCount + 1);

        // By game
        const gameCount = this.metrics.pausesByGame.get(event.gameId) || 0;
        this.metrics.pausesByGame.set(event.gameId, gameCount + 1);
      }

      if (event.pauseType === 'end' && event.duration > 0) {
        this.metrics.totalPauseDuration += event.duration;
        this.updateAveragePauseDuration();
      }

    } catch (error) {
      console.error('❌ Failed to update pause metrics:', error.message);
    }
  }

  /**
   * Update grace period metrics
   * Requirements: 10.2
   * @param {Object} event - Grace period event
   */
  updateGracePeriodMetrics(event) {
    try {
      if (event.gracePeriodType === 'start') {
        this.metrics.totalGracePeriods++;
      }

      if (event.gracePeriodType === 'end') {
        if (event.outcome === 'reconnected') {
          this.metrics.successfulGracePeriods++;
        } else if (event.outcome === 'expired') {
          this.metrics.expiredGracePeriods++;
        }
      }

      // Update average grace period duration
      if (event.duration > 0) {
        this.updateAverageGracePeriodDuration(event.duration);
      }

    } catch (error) {
      console.error('❌ Failed to update grace period metrics:', error.message);
    }
  }

  /**
   * Update continuation metrics
   * Requirements: 10.2
   * @param {Object} event - Continuation event
   */
  updateContinuationMetrics(event) {
    try {
      this.metrics.totalContinuationDecisions++;

      // By decision type
      const decisionCount = this.metrics.continuationDecisionsByType.get(event.decision) || 0;
      this.metrics.continuationDecisionsByType.set(event.decision, decisionCount + 1);

    } catch (error) {
      console.error('❌ Failed to update continuation metrics:', error.message);
    }
  }

  /**
   * Calculate mobile disconnection rate
   * Requirements: 10.2
   * @returns {number} - Mobile disconnection rate as percentage
   */
  calculateMobileDisconnectionRate() {
    try {
      const mobileDisconnections = this.disconnectionEvents.filter(e => e.connectionInfo.isMobile).length;
      const totalDisconnections = this.disconnectionEvents.length;
      
      return totalDisconnections > 0 ? (mobileDisconnections / totalDisconnections) * 100 : 0;
    } catch (error) {
      console.error('❌ Failed to calculate mobile disconnection rate:', error.message);
      return 0;
    }
  }

  /**
   * Update average reconnection time
   * Requirements: 10.2
   */
  updateAverageReconnectionTime() {
    try {
      const successfulReconnections = this.reconnectionEvents.filter(e => e.success);
      if (successfulReconnections.length === 0) {
        this.metrics.averageReconnectionTime = 0;
        return;
      }

      const totalTime = successfulReconnections.reduce((sum, event) => sum + event.reconnectionTime, 0);
      this.metrics.averageReconnectionTime = totalTime / successfulReconnections.length;

    } catch (error) {
      console.error('❌ Failed to update average reconnection time:', error.message);
    }
  }

  /**
   * Update average pause duration
   * Requirements: 10.4
   */
  updateAveragePauseDuration() {
    try {
      if (this.metrics.totalPauses === 0) {
        this.metrics.averagePauseDuration = 0;
        return;
      }

      this.metrics.averagePauseDuration = this.metrics.totalPauseDuration / this.metrics.totalPauses;

    } catch (error) {
      console.error('❌ Failed to update average pause duration:', error.message);
    }
  }

  /**
   * Update average grace period duration
   * Requirements: 10.2
   * @param {number} duration - Grace period duration
   */
  updateAverageGracePeriodDuration(duration) {
    try {
      const currentAverage = this.metrics.averageGracePeriodDuration;
      const totalGracePeriods = this.metrics.totalGracePeriods;
      
      if (totalGracePeriods === 1) {
        this.metrics.averageGracePeriodDuration = duration;
      } else {
        // Calculate running average
        this.metrics.averageGracePeriodDuration = 
          ((currentAverage * (totalGracePeriods - 1)) + duration) / totalGracePeriods;
      }

    } catch (error) {
      console.error('❌ Failed to update average grace period duration:', error.message);
    }
  }

  /**
   * Get reconnection success rate
   * Requirements: 10.2
   * @returns {number} - Success rate as percentage
   */
  getReconnectionSuccessRate() {
    try {
      if (this.metrics.totalReconnectionAttempts === 0) return 0;
      
      return (this.metrics.successfulReconnections / this.metrics.totalReconnectionAttempts) * 100;
    } catch (error) {
      console.error('❌ Failed to calculate reconnection success rate:', error.message);
      return 0;
    }
  }

  /**
   * Get grace period success rate
   * Requirements: 10.2
   * @returns {number} - Success rate as percentage
   */
  getGracePeriodSuccessRate() {
    try {
      if (this.metrics.totalGracePeriods === 0) return 0;
      
      return (this.metrics.successfulGracePeriods / this.metrics.totalGracePeriods) * 100;
    } catch (error) {
      console.error('❌ Failed to calculate grace period success rate:', error.message);
      return 0;
    }
  }

  /**
   * Get comprehensive analytics summary
   * Requirements: 10.1, 10.2, 10.4
   * @returns {Object} - Analytics summary
   */
  getAnalyticsSummary() {
    try {
      return {
        overview: {
          totalDisconnections: this.metrics.totalDisconnections,
          totalReconnectionAttempts: this.metrics.totalReconnectionAttempts,
          reconnectionSuccessRate: this.getReconnectionSuccessRate(),
          totalPauses: this.metrics.totalPauses,
          totalGracePeriods: this.metrics.totalGracePeriods,
          gracePeriodSuccessRate: this.getGracePeriodSuccessRate()
        },
        disconnections: {
          byReason: Object.fromEntries(this.metrics.disconnectionsByReason),
          byConnectionQuality: Object.fromEntries(this.metrics.connectionQualityDistribution),
          byNetworkType: Object.fromEntries(this.metrics.networkTypeDisconnections),
          mobileDisconnectionRate: this.metrics.mobileDisconnectionRate
        },
        reconnections: {
          successfulReconnections: this.metrics.successfulReconnections,
          failedReconnections: this.metrics.failedReconnections,
          averageReconnectionTime: this.metrics.averageReconnectionTime,
          successRate: this.getReconnectionSuccessRate()
        },
        pauses: {
          totalPauses: this.metrics.totalPauses,
          byReason: Object.fromEntries(this.metrics.pausesByReason),
          totalDuration: this.metrics.totalPauseDuration,
          averageDuration: this.metrics.averagePauseDuration
        },
        gracePeriods: {
          total: this.metrics.totalGracePeriods,
          successful: this.metrics.successfulGracePeriods,
          expired: this.metrics.expiredGracePeriods,
          successRate: this.getGracePeriodSuccessRate(),
          averageDuration: this.metrics.averageGracePeriodDuration
        },
        continuations: {
          totalDecisions: this.metrics.totalContinuationDecisions,
          byType: Object.fromEntries(this.metrics.continuationDecisionsByType)
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to generate analytics summary:', error.message);
      return {
        error: 'Failed to generate analytics summary',
        generatedAt: new Date()
      };
    }
  }

  /**
   * Get events within a time range
   * Requirements: 10.1
   * @param {string} eventType - Type of events to retrieve
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Array} - Filtered events
   */
  getEventsInTimeRange(eventType, startTime, endTime) {
    try {
      let events = [];
      
      switch (eventType) {
        case 'disconnection':
          events = this.disconnectionEvents;
          break;
        case 'reconnection':
          events = this.reconnectionEvents;
          break;
        case 'pause':
          events = this.pauseEvents;
          break;
        case 'gracePeriod':
          events = this.gracePeriodEvents;
          break;
        case 'continuation':
          events = this.continuationEvents;
          break;
        default:
          throw new Error(`Unknown event type: ${eventType}`);
      }

      return events.filter(event => {
        const eventTime = new Date(event.timestamp);
        return eventTime >= startTime && eventTime <= endTime;
      });

    } catch (error) {
      console.error('❌ Failed to get events in time range:', error.message);
      return [];
    }
  }

  /**
   * Trim event history to prevent memory issues
   * @param {string} eventArrayName - Name of the event array to trim
   */
  trimEventHistory(eventArrayName) {
    try {
      const events = this[eventArrayName];
      if (events && events.length > this.config.maxEventHistory) {
        const excessEvents = events.length - this.config.maxEventHistory;
        events.splice(0, excessEvents);
        console.log(`📊 Trimmed ${excessEvents} old ${eventArrayName} events`);
      }
    } catch (error) {
      console.error(`❌ Failed to trim ${eventArrayName}:`, error.message);
    }
  }

  /**
   * Start metrics updater interval
   */
  startMetricsUpdater() {
    this.metricsUpdateTimer = setInterval(() => {
      try {
        // Update calculated metrics
        this.updateAverageReconnectionTime();
        this.updateAveragePauseDuration();
        this.metrics.mobileDisconnectionRate = this.calculateMobileDisconnectionRate();
        
        // Emit metrics update event
        this.emit('metricsUpdated', this.getAnalyticsSummary());
        
      } catch (error) {
        console.error('❌ Failed to update metrics:', error.message);
      }
    }, this.config.metricsUpdateInterval);
  }

  /**
   * Stop metrics updater interval
   */
  stopMetricsUpdater() {
    if (this.metricsUpdateTimer) {
      clearInterval(this.metricsUpdateTimer);
      this.metricsUpdateTimer = null;
    }
  }

  /**
   * Clear old events based on retention policy
   * Requirements: 10.1
   */
  clearOldEvents() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.eventRetentionDays);

      const eventTypes = [
        'disconnectionEvents',
        'reconnectionEvents', 
        'pauseEvents',
        'gracePeriodEvents',
        'continuationEvents'
      ];

      let totalCleared = 0;

      eventTypes.forEach(eventType => {
        const events = this[eventType];
        const originalLength = events.length;
        
        // Filter out old events
        this[eventType] = events.filter(event => new Date(event.timestamp) > cutoffDate);
        
        const cleared = originalLength - this[eventType].length;
        totalCleared += cleared;
      });

      if (totalCleared > 0) {
        console.log(`📊 Cleared ${totalCleared} old events (older than ${this.config.eventRetentionDays} days)`);
      }

      return totalCleared;

    } catch (error) {
      console.error('❌ Failed to clear old events:', error.message);
      return 0;
    }
  }

  /**
   * Export analytics data for external analysis
   * Requirements: 10.1, 10.2
   * @returns {Object} - Complete analytics data export
   */
  exportAnalyticsData() {
    try {
      return {
        summary: this.getAnalyticsSummary(),
        events: {
          disconnections: this.disconnectionEvents,
          reconnections: this.reconnectionEvents,
          pauses: this.pauseEvents,
          gracePeriods: this.gracePeriodEvents,
          continuations: this.continuationEvents
        },
        metrics: this.metrics,
        config: this.config,
        exportedAt: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to export analytics data:', error.message);
      return {
        error: 'Failed to export analytics data',
        exportedAt: new Date()
      };
    }
  }

  /**
   * Reset all analytics data
   * Requirements: 10.1
   */
  resetAnalytics() {
    try {
      // Stop any running timers
      this.stopMetricsUpdater();
      
      // Clear all events
      this.disconnectionEvents.splice(0);
      this.reconnectionEvents.splice(0);
      this.pauseEvents.splice(0);
      this.gracePeriodEvents.splice(0);
      this.continuationEvents.splice(0);

      // Reset all metrics
      this.metrics = {
        // Disconnection metrics
        totalDisconnections: 0,
        disconnectionsByReason: new Map(),
        disconnectionsByPlayer: new Map(),
        disconnectionsByGame: new Map(),
        
        // Reconnection metrics
        totalReconnectionAttempts: 0,
        successfulReconnections: 0,
        failedReconnections: 0,
        reconnectionsByPlayer: new Map(),
        averageReconnectionTime: 0,
        
        // Pause metrics
        totalPauses: 0,
        pausesByReason: new Map(),
        pausesByGame: new Map(),
        totalPauseDuration: 0,
        averagePauseDuration: 0,
        
        // Grace period metrics
        totalGracePeriods: 0,
        expiredGracePeriods: 0,
        successfulGracePeriods: 0,
        averageGracePeriodDuration: 0,
        
        // Continuation metrics
        totalContinuationDecisions: 0,
        continuationDecisionsByType: new Map(),
        
        // Connection quality metrics
        connectionQualityDistribution: new Map(),
        mobileDisconnectionRate: 0,
        networkTypeDisconnections: new Map()
      };

      console.log('📊 Analytics data reset');
      this.emit('analyticsReset');

    } catch (error) {
      console.error('❌ Failed to reset analytics:', error.message);
    }
  }

  /**
   * Analyze disconnection cause patterns
   * Requirements: 10.3
   * @returns {Object} - Pattern analysis results
   */
  analyzeDisconnectionPatterns() {
    try {
      const patterns = {
        // Temporal patterns
        timeOfDayPatterns: this.analyzeTimeOfDayPatterns(),
        dayOfWeekPatterns: this.analyzeDayOfWeekPatterns(),
        
        // Connection patterns
        connectionQualityPatterns: this.analyzeConnectionQualityPatterns(),
        networkTypePatterns: this.analyzeNetworkTypePatterns(),
        mobileVsDesktopPatterns: this.analyzeMobileVsDesktopPatterns(),
        
        // Game-specific patterns
        gamePhasePatterns: this.analyzeGamePhasePatterns(),
        playerCountPatterns: this.analyzePlayerCountPatterns(),
        turnNumberPatterns: this.analyzeTurnNumberPatterns(),
        
        // Behavioral patterns
        repeatOffenderPatterns: this.analyzeRepeatOffenderPatterns(),
        sessionDurationPatterns: this.analyzeSessionDurationPatterns(),
        
        // Correlation patterns
        reconnectionSuccessPatterns: this.analyzeReconnectionSuccessPatterns(),
        
        generatedAt: new Date()
      };
      
      return patterns;
      
    } catch (error) {
      console.error('❌ Failed to analyze disconnection patterns:', error.message);
      return {
        error: 'Failed to analyze disconnection patterns',
        generatedAt: new Date()
      };
    }
  }

  /**
   * Analyze time of day patterns for disconnections
   * Requirements: 10.3
   * @returns {Object} - Time of day analysis
   */
  analyzeTimeOfDayPatterns() {
    const hourlyDistribution = new Array(24).fill(0);
    
    this.disconnectionEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyDistribution[hour]++;
    });
    
    // Find peak hours
    const maxDisconnections = Math.max(...hourlyDistribution);
    const peakHours = hourlyDistribution
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count === maxDisconnections)
      .map(item => item.hour);
    
    return {
      hourlyDistribution,
      peakHours,
      peakDisconnectionCount: maxDisconnections,
      insights: this.generateTimeOfDayInsights(hourlyDistribution, peakHours)
    };
  }

  /**
   * Analyze day of week patterns for disconnections
   * Requirements: 10.3
   * @returns {Object} - Day of week analysis
   */
  analyzeDayOfWeekPatterns() {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyDistribution = new Array(7).fill(0);
    
    this.disconnectionEvents.forEach(event => {
      const dayOfWeek = new Date(event.timestamp).getDay();
      dailyDistribution[dayOfWeek]++;
    });
    
    // Find peak days
    const maxDisconnections = Math.max(...dailyDistribution);
    const peakDays = dailyDistribution
      .map((count, day) => ({ day: dayNames[day], count }))
      .filter(item => item.count === maxDisconnections)
      .map(item => item.day);
    
    return {
      dailyDistribution: dailyDistribution.map((count, index) => ({
        day: dayNames[index],
        count
      })),
      peakDays,
      peakDisconnectionCount: maxDisconnections,
      insights: this.generateDayOfWeekInsights(dailyDistribution, peakDays)
    };
  }

  /**
   * Analyze connection quality patterns
   * Requirements: 10.3
   * @returns {Object} - Connection quality analysis
   */
  analyzeConnectionQualityPatterns() {
    const qualityDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      unknown: 0
    };
    
    const qualityReconnectionRates = {
      excellent: { attempts: 0, successes: 0 },
      good: { attempts: 0, successes: 0 },
      fair: { attempts: 0, successes: 0 },
      poor: { attempts: 0, successes: 0 },
      unknown: { attempts: 0, successes: 0 }
    };
    
    // Analyze disconnections by quality
    this.disconnectionEvents.forEach(event => {
      const quality = event.connectionInfo.connectionQuality || 'unknown';
      if (qualityDistribution.hasOwnProperty(quality)) {
        qualityDistribution[quality]++;
      }
    });
    
    // Analyze reconnection success by quality
    this.reconnectionEvents.forEach(event => {
      const quality = event.connectionInfo.connectionQuality || 'unknown';
      if (qualityReconnectionRates.hasOwnProperty(quality)) {
        qualityReconnectionRates[quality].attempts++;
        if (event.success) {
          qualityReconnectionRates[quality].successes++;
        }
      }
    });
    
    // Calculate success rates
    const successRatesByQuality = {};
    Object.keys(qualityReconnectionRates).forEach(quality => {
      const data = qualityReconnectionRates[quality];
      successRatesByQuality[quality] = data.attempts > 0 ? 
        (data.successes / data.attempts) * 100 : 0;
    });
    
    return {
      disconnectionsByQuality: qualityDistribution,
      reconnectionRatesByQuality: successRatesByQuality,
      insights: this.generateConnectionQualityInsights(qualityDistribution, successRatesByQuality)
    };
  }

  /**
   * Analyze network type patterns
   * Requirements: 10.3
   * @returns {Object} - Network type analysis
   */
  analyzeNetworkTypePatterns() {
    const networkDistribution = {
      wifi: 0,
      cellular: 0,
      unknown: 0
    };
    
    const networkReconnectionRates = {
      wifi: { attempts: 0, successes: 0 },
      cellular: { attempts: 0, successes: 0 },
      unknown: { attempts: 0, successes: 0 }
    };
    
    // Analyze disconnections by network type
    this.disconnectionEvents.forEach(event => {
      const networkType = event.connectionInfo.networkType || 'unknown';
      if (networkDistribution.hasOwnProperty(networkType)) {
        networkDistribution[networkType]++;
      }
    });
    
    // Analyze reconnection success by network type
    this.reconnectionEvents.forEach(event => {
      const networkType = event.connectionInfo.networkType || 'unknown';
      if (networkReconnectionRates.hasOwnProperty(networkType)) {
        networkReconnectionRates[networkType].attempts++;
        if (event.success) {
          networkReconnectionRates[networkType].successes++;
        }
      }
    });
    
    // Calculate success rates
    const successRatesByNetwork = {};
    Object.keys(networkReconnectionRates).forEach(networkType => {
      const data = networkReconnectionRates[networkType];
      successRatesByNetwork[networkType] = data.attempts > 0 ? 
        (data.successes / data.attempts) * 100 : 0;
    });
    
    return {
      disconnectionsByNetwork: networkDistribution,
      reconnectionRatesByNetwork: successRatesByNetwork,
      insights: this.generateNetworkTypeInsights(networkDistribution, successRatesByNetwork)
    };
  }

  /**
   * Analyze mobile vs desktop patterns
   * Requirements: 10.3
   * @returns {Object} - Mobile vs desktop analysis
   */
  analyzeMobileVsDesktopPatterns() {
    const deviceDistribution = {
      mobile: 0,
      desktop: 0
    };
    
    const deviceReconnectionRates = {
      mobile: { attempts: 0, successes: 0 },
      desktop: { attempts: 0, successes: 0 }
    };
    
    // Analyze disconnections by device type
    this.disconnectionEvents.forEach(event => {
      const deviceType = event.connectionInfo.isMobile ? 'mobile' : 'desktop';
      deviceDistribution[deviceType]++;
    });
    
    // Analyze reconnection success by device type
    this.reconnectionEvents.forEach(event => {
      const deviceType = event.connectionInfo.isMobile ? 'mobile' : 'desktop';
      deviceReconnectionRates[deviceType].attempts++;
      if (event.success) {
        deviceReconnectionRates[deviceType].successes++;
      }
    });
    
    // Calculate success rates
    const successRatesByDevice = {};
    Object.keys(deviceReconnectionRates).forEach(deviceType => {
      const data = deviceReconnectionRates[deviceType];
      successRatesByDevice[deviceType] = data.attempts > 0 ? 
        (data.successes / data.attempts) * 100 : 0;
    });
    
    return {
      disconnectionsByDevice: deviceDistribution,
      reconnectionRatesByDevice: successRatesByDevice,
      insights: this.generateMobileVsDesktopInsights(deviceDistribution, successRatesByDevice)
    };
  }

  /**
   * Analyze game phase patterns
   * Requirements: 10.3
   * @returns {Object} - Game phase analysis
   */
  analyzeGamePhasePatterns() {
    const phaseDistribution = {
      waiting: 0,
      playing: 0,
      ended: 0
    };
    
    this.disconnectionEvents.forEach(event => {
      const phase = event.gameState.gamePhase || 'unknown';
      if (phaseDistribution.hasOwnProperty(phase)) {
        phaseDistribution[phase]++;
      }
    });
    
    return {
      disconnectionsByPhase: phaseDistribution,
      insights: this.generateGamePhaseInsights(phaseDistribution)
    };
  }

  /**
   * Analyze player count patterns
   * Requirements: 10.3
   * @returns {Object} - Player count analysis
   */
  analyzePlayerCountPatterns() {
    const playerCountDistribution = {};
    
    this.disconnectionEvents.forEach(event => {
      const playerCount = event.gameState.playerCount || 0;
      playerCountDistribution[playerCount] = (playerCountDistribution[playerCount] || 0) + 1;
    });
    
    return {
      disconnectionsByPlayerCount: playerCountDistribution,
      insights: this.generatePlayerCountInsights(playerCountDistribution)
    };
  }

  /**
   * Analyze turn number patterns
   * Requirements: 10.3
   * @returns {Object} - Turn number analysis
   */
  analyzeTurnNumberPatterns() {
    const turnRanges = {
      early: 0,    // turns 0-10
      middle: 0,   // turns 11-30
      late: 0      // turns 31+
    };
    
    this.disconnectionEvents.forEach(event => {
      const turnNumber = event.gameState.turnNumber || 0;
      if (turnNumber <= 10) {
        turnRanges.early++;
      } else if (turnNumber <= 30) {
        turnRanges.middle++;
      } else {
        turnRanges.late++;
      }
    });
    
    return {
      disconnectionsByTurnRange: turnRanges,
      insights: this.generateTurnNumberInsights(turnRanges)
    };
  }

  /**
   * Analyze repeat offender patterns
   * Requirements: 10.3
   * @returns {Object} - Repeat offender analysis
   */
  analyzeRepeatOffenderPatterns() {
    const playerDisconnectionCounts = {};
    
    this.disconnectionEvents.forEach(event => {
      const playerId = event.playerId;
      playerDisconnectionCounts[playerId] = (playerDisconnectionCounts[playerId] || 0) + 1;
    });
    
    // Categorize players by disconnection frequency
    const categories = {
      occasional: 0,    // 1-2 disconnections
      frequent: 0,      // 3-5 disconnections
      chronic: 0        // 6+ disconnections
    };
    
    Object.values(playerDisconnectionCounts).forEach(count => {
      if (count <= 2) {
        categories.occasional++;
      } else if (count <= 5) {
        categories.frequent++;
      } else {
        categories.chronic++;
      }
    });
    
    return {
      playerDisconnectionCounts,
      playerCategories: categories,
      insights: this.generateRepeatOffenderInsights(categories, playerDisconnectionCounts)
    };
  }

  /**
   * Analyze session duration patterns
   * Requirements: 10.3
   * @returns {Object} - Session duration analysis
   */
  analyzeSessionDurationPatterns() {
    const durationRanges = {
      short: 0,     // < 5 minutes
      medium: 0,    // 5-30 minutes
      long: 0       // > 30 minutes
    };
    
    this.disconnectionEvents.forEach(event => {
      const duration = event.sessionInfo.sessionDuration || 0;
      const durationMinutes = duration / (1000 * 60);
      
      if (durationMinutes < 5) {
        durationRanges.short++;
      } else if (durationMinutes <= 30) {
        durationRanges.medium++;
      } else {
        durationRanges.long++;
      }
    });
    
    return {
      disconnectionsBySessionDuration: durationRanges,
      insights: this.generateSessionDurationInsights(durationRanges)
    };
  }

  /**
   * Analyze reconnection success patterns
   * Requirements: 10.3
   * @returns {Object} - Reconnection success analysis
   */
  analyzeReconnectionSuccessPatterns() {
    const attemptRanges = {
      firstAttempt: { attempts: 0, successes: 0 },
      secondAttempt: { attempts: 0, successes: 0 },
      multipleAttempts: { attempts: 0, successes: 0 }
    };
    
    this.reconnectionEvents.forEach(event => {
      const attemptNumber = event.attemptNumber || 1;
      
      if (attemptNumber === 1) {
        attemptRanges.firstAttempt.attempts++;
        if (event.success) attemptRanges.firstAttempt.successes++;
      } else if (attemptNumber === 2) {
        attemptRanges.secondAttempt.attempts++;
        if (event.success) attemptRanges.secondAttempt.successes++;
      } else {
        attemptRanges.multipleAttempts.attempts++;
        if (event.success) attemptRanges.multipleAttempts.successes++;
      }
    });
    
    // Calculate success rates
    const successRates = {};
    Object.keys(attemptRanges).forEach(range => {
      const data = attemptRanges[range];
      successRates[range] = data.attempts > 0 ? (data.successes / data.attempts) * 100 : 0;
    });
    
    return {
      reconnectionByAttempt: attemptRanges,
      successRatesByAttempt: successRates,
      insights: this.generateReconnectionSuccessInsights(successRates)
    };
  }
  getStatus() {
    try {
      return {
        eventCounts: {
          disconnections: this.disconnectionEvents.length,
          reconnections: this.reconnectionEvents.length,
          pauses: this.pauseEvents.length,
          gracePeriods: this.gracePeriodEvents.length,
          continuations: this.continuationEvents.length
        },
        metrics: {
          totalDisconnections: this.metrics.totalDisconnections,
          reconnectionSuccessRate: this.getReconnectionSuccessRate(),
          totalPauses: this.metrics.totalPauses,
          gracePeriodSuccessRate: this.getGracePeriodSuccessRate()
        },
        config: this.config,
        memoryUsage: {
          maxEventHistory: this.config.maxEventHistory,
          currentEventCount: this.disconnectionEvents.length + 
                            this.reconnectionEvents.length + 
                            this.pauseEvents.length + 
                            this.gracePeriodEvents.length + 
                            this.continuationEvents.length
        },
        statusGeneratedAt: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to get analytics status:', error.message);
      return {
        error: 'Failed to get analytics status',
        statusGeneratedAt: new Date()
      };
    }
  }
  /**
   * Generate insights for time of day patterns
   * Requirements: 10.5
   */
  generateTimeOfDayInsights(hourlyDistribution, peakHours) {
    const insights = [];
    
    if (peakHours.length > 0) {
      insights.push(`Peak disconnection hours: ${peakHours.join(', ')}`);
      
      // Check for business hours pattern
      const businessHours = peakHours.filter(hour => hour >= 9 && hour <= 17);
      if (businessHours.length > 0) {
        insights.push('High disconnections during business hours may indicate workplace network issues');
      }
      
      // Check for evening pattern
      const eveningHours = peakHours.filter(hour => hour >= 18 && hour <= 23);
      if (eveningHours.length > 0) {
        insights.push('Evening disconnections may be due to increased home network usage');
      }
    }
    
    return insights;
  }

  /**
   * Generate insights for day of week patterns
   * Requirements: 10.5
   */
  generateDayOfWeekInsights(dailyDistribution, peakDays) {
    const insights = [];
    
    if (peakDays.length > 0) {
      insights.push(`Peak disconnection days: ${peakDays.join(', ')}`);
      
      // Check for weekend pattern
      const weekendDays = peakDays.filter(day => day === 'Saturday' || day === 'Sunday');
      if (weekendDays.length > 0) {
        insights.push('Weekend disconnections may be due to casual gaming sessions with unstable connections');
      }
      
      // Check for weekday pattern
      const weekdays = peakDays.filter(day => !['Saturday', 'Sunday'].includes(day));
      if (weekdays.length > 0) {
        insights.push('Weekday disconnections may be related to work-from-home network congestion');
      }
    }
    
    return insights;
  }

  /**
   * Generate insights for connection quality patterns
   * Requirements: 10.5
   */
  generateConnectionQualityInsights(qualityDistribution, successRates) {
    const insights = [];
    
    // Check poor connection impact
    if (qualityDistribution.poor > 0) {
      const poorPercentage = (qualityDistribution.poor / Object.values(qualityDistribution).reduce((a, b) => a + b, 0)) * 100;
      insights.push(`${poorPercentage.toFixed(1)}% of disconnections occur with poor connection quality`);
      
      if (successRates.poor < 50) {
        insights.push('Poor connection quality significantly reduces reconnection success rate');
      }
    }
    
    // Check excellent connection issues
    if (qualityDistribution.excellent > 0 && successRates.excellent < 90) {
      insights.push('Even excellent connections show reconnection issues - may indicate server-side problems');
    }
    
    return insights;
  }

  /**
   * Generate insights for network type patterns
   * Requirements: 10.5
   */
  generateNetworkTypeInsights(networkDistribution, successRates) {
    const insights = [];
    
    // Check cellular vs wifi
    if (networkDistribution.cellular > 0 && networkDistribution.wifi > 0) {
      const cellularRate = successRates.cellular || 0;
      const wifiRate = successRates.wifi || 0;
      
      if (cellularRate < wifiRate - 10) {
        insights.push('Cellular connections have significantly lower reconnection success rates than WiFi');
      }
      
      const cellularPercentage = (networkDistribution.cellular / (networkDistribution.cellular + networkDistribution.wifi)) * 100;
      insights.push(`${cellularPercentage.toFixed(1)}% of disconnections occur on cellular networks`);
    }
    
    return insights;
  }

  /**
   * Generate insights for mobile vs desktop patterns
   * Requirements: 10.5
   */
  generateMobileVsDesktopInsights(deviceDistribution, successRates) {
    const insights = [];
    
    if (deviceDistribution.mobile > 0 && deviceDistribution.desktop > 0) {
      const mobileRate = successRates.mobile || 0;
      const desktopRate = successRates.desktop || 0;
      
      if (mobileRate < desktopRate - 10) {
        insights.push('Mobile devices have significantly lower reconnection success rates');
        insights.push('Consider implementing mobile-specific reconnection strategies');
      }
      
      const mobilePercentage = (deviceDistribution.mobile / (deviceDistribution.mobile + deviceDistribution.desktop)) * 100;
      insights.push(`${mobilePercentage.toFixed(1)}% of disconnections occur on mobile devices`);
    }
    
    return insights;
  }

  /**
   * Generate insights for game phase patterns
   * Requirements: 10.5
   */
  generateGamePhaseInsights(phaseDistribution) {
    const insights = [];
    
    const total = Object.values(phaseDistribution).reduce((a, b) => a + b, 0);
    
    if (phaseDistribution.waiting > 0) {
      const waitingPercentage = (phaseDistribution.waiting / total) * 100;
      if (waitingPercentage > 30) {
        insights.push('High disconnections during waiting phase - consider improving lobby experience');
      }
    }
    
    if (phaseDistribution.playing > 0) {
      const playingPercentage = (phaseDistribution.playing / total) * 100;
      insights.push(`${playingPercentage.toFixed(1)}% of disconnections occur during active gameplay`);
    }
    
    return insights;
  }

  /**
   * Generate insights for player count patterns
   * Requirements: 10.5
   */
  generatePlayerCountInsights(playerCountDistribution) {
    const insights = [];
    
    const counts = Object.keys(playerCountDistribution).map(Number).sort((a, b) => a - b);
    const mostProblematic = counts.reduce((a, b) => 
      playerCountDistribution[a] > playerCountDistribution[b] ? a : b
    );
    
    insights.push(`Most disconnections occur in ${mostProblematic}-player games`);
    
    if (mostProblematic >= 6) {
      insights.push('Large games may be more prone to disconnections due to network complexity');
    }
    
    return insights;
  }

  /**
   * Generate insights for turn number patterns
   * Requirements: 10.5
   */
  generateTurnNumberInsights(turnRanges) {
    const insights = [];
    
    const total = Object.values(turnRanges).reduce((a, b) => a + b, 0);
    
    if (turnRanges.early > 0) {
      const earlyPercentage = (turnRanges.early / total) * 100;
      if (earlyPercentage > 40) {
        insights.push('High early-game disconnections may indicate onboarding or tutorial issues');
      }
    }
    
    if (turnRanges.late > 0) {
      const latePercentage = (turnRanges.late / total) * 100;
      if (latePercentage > 30) {
        insights.push('Late-game disconnections may be due to game length or complexity');
      }
    }
    
    return insights;
  }

  /**
   * Generate insights for repeat offender patterns
   * Requirements: 10.5
   */
  generateRepeatOffenderInsights(categories, playerCounts) {
    const insights = [];
    
    const totalPlayers = Object.values(categories).reduce((a, b) => a + b, 0);
    
    if (categories.chronic > 0) {
      const chronicPercentage = (categories.chronic / totalPlayers) * 100;
      insights.push(`${chronicPercentage.toFixed(1)}% of players are chronic disconnectors (6+ disconnections)`);
      
      if (chronicPercentage > 10) {
        insights.push('High number of chronic disconnectors - consider connection quality requirements');
      }
    }
    
    if (categories.frequent > 0) {
      const frequentPercentage = (categories.frequent / totalPlayers) * 100;
      insights.push(`${frequentPercentage.toFixed(1)}% of players disconnect frequently (3-5 times)`);
    }
    
    return insights;
  }

  /**
   * Generate insights for session duration patterns
   * Requirements: 10.5
   */
  generateSessionDurationInsights(durationRanges) {
    const insights = [];
    
    const total = Object.values(durationRanges).reduce((a, b) => a + b, 0);
    
    if (durationRanges.short > 0) {
      const shortPercentage = (durationRanges.short / total) * 100;
      if (shortPercentage > 40) {
        insights.push('High disconnections in short sessions may indicate initial connection problems');
      }
    }
    
    if (durationRanges.long > 0) {
      const longPercentage = (durationRanges.long / total) * 100;
      insights.push(`${longPercentage.toFixed(1)}% of disconnections occur in long sessions (30+ minutes)`);
    }
    
    return insights;
  }

  /**
   * Generate insights for reconnection success patterns
   * Requirements: 10.5
   */
  generateReconnectionSuccessInsights(successRates) {
    const insights = [];
    
    if (successRates.firstAttempt > 0) {
      insights.push(`First reconnection attempt success rate: ${successRates.firstAttempt.toFixed(1)}%`);
      
      if (successRates.firstAttempt < 70) {
        insights.push('Low first-attempt success rate - consider improving initial reconnection logic');
      }
    }
    
    if (successRates.multipleAttempts > 0) {
      if (successRates.multipleAttempts > successRates.firstAttempt) {
        insights.push('Multiple attempts improve reconnection success - retry logic is effective');
      } else {
        insights.push('Multiple attempts do not improve success - may need different reconnection strategy');
      }
    }
    
    return insights;
  }

  /**
   * Create connection stability insights
   * Requirements: 10.3, 10.5
   * @returns {Object} - Connection stability analysis
   */
  createConnectionStabilityInsights() {
    try {
      const stability = {
        overallStability: this.calculateOverallStability(),
        stabilityByDevice: this.calculateStabilityByDevice(),
        stabilityByNetwork: this.calculateStabilityByNetwork(),
        stabilityTrends: this.calculateStabilityTrends(),
        recommendations: this.generateStabilityRecommendations()
      };
      
      return stability;
      
    } catch (error) {
      console.error('❌ Failed to create connection stability insights:', error.message);
      return {
        error: 'Failed to create connection stability insights',
        generatedAt: new Date()
      };
    }
  }

  /**
   * Calculate overall connection stability
   * Requirements: 10.3
   */
  calculateOverallStability() {
    const totalSessions = this.disconnectionEvents.length;
    const successfulReconnections = this.reconnectionEvents.filter(e => e.success).length;
    
    if (totalSessions === 0) return { score: 100, rating: 'excellent' };
    
    const stabilityScore = totalSessions > 0 ? 
      Math.max(0, 100 - (totalSessions * 10) + (successfulReconnections * 5)) : 100;
    
    let rating = 'poor';
    if (stabilityScore >= 80) rating = 'excellent';
    else if (stabilityScore >= 60) rating = 'good';
    else if (stabilityScore >= 40) rating = 'fair';
    
    return {
      score: Math.round(stabilityScore),
      rating,
      totalDisconnections: totalSessions,
      successfulReconnections
    };
  }

  /**
   * Calculate stability by device type
   * Requirements: 10.3
   */
  calculateStabilityByDevice() {
    const deviceStats = {
      mobile: { disconnections: 0, reconnections: 0 },
      desktop: { disconnections: 0, reconnections: 0 }
    };
    
    this.disconnectionEvents.forEach(event => {
      const deviceType = event.connectionInfo.isMobile ? 'mobile' : 'desktop';
      deviceStats[deviceType].disconnections++;
    });
    
    this.reconnectionEvents.forEach(event => {
      if (event.success) {
        const deviceType = event.connectionInfo.isMobile ? 'mobile' : 'desktop';
        deviceStats[deviceType].reconnections++;
      }
    });
    
    return deviceStats;
  }

  /**
   * Calculate stability by network type
   * Requirements: 10.3
   */
  calculateStabilityByNetwork() {
    const networkStats = {
      wifi: { disconnections: 0, reconnections: 0 },
      cellular: { disconnections: 0, reconnections: 0 },
      unknown: { disconnections: 0, reconnections: 0 }
    };
    
    this.disconnectionEvents.forEach(event => {
      const networkType = event.connectionInfo.networkType || 'unknown';
      if (networkStats[networkType]) {
        networkStats[networkType].disconnections++;
      }
    });
    
    this.reconnectionEvents.forEach(event => {
      if (event.success) {
        const networkType = event.connectionInfo.networkType || 'unknown';
        if (networkStats[networkType]) {
          networkStats[networkType].reconnections++;
        }
      }
    });
    
    return networkStats;
  }

  /**
   * Calculate stability trends over time
   * Requirements: 10.3
   */
  calculateStabilityTrends() {
    // Group events by day for the last 7 days
    const now = new Date();
    const trends = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayDisconnections = this.disconnectionEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= date && eventDate < nextDate;
      }).length;
      
      const dayReconnections = this.reconnectionEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= date && eventDate < nextDate && event.success;
      }).length;
      
      trends.push({
        date: date.toISOString().split('T')[0],
        disconnections: dayDisconnections,
        reconnections: dayReconnections,
        stabilityScore: dayDisconnections > 0 ? 
          Math.max(0, 100 - (dayDisconnections * 10) + (dayReconnections * 5)) : 100
      });
    }
    
    return trends;
  }

  /**
   * Generate stability recommendations
   * Requirements: 10.5
   */
  generateStabilityRecommendations() {
    const recommendations = [];
    const patterns = this.analyzeDisconnectionPatterns();
    
    // Mobile-specific recommendations
    if (patterns.mobileVsDesktopPatterns.disconnectionsByDevice.mobile > 0) {
      const mobileRate = patterns.mobileVsDesktopPatterns.reconnectionRatesByDevice.mobile || 0;
      if (mobileRate < 70) {
        recommendations.push({
          priority: 'high',
          category: 'mobile',
          recommendation: 'Implement mobile-specific reconnection strategies with longer grace periods'
        });
      }
    }
    
    // Network-specific recommendations
    if (patterns.networkTypePatterns.disconnectionsByNetwork.cellular > 0) {
      const cellularRate = patterns.networkTypePatterns.reconnectionRatesByNetwork.cellular || 0;
      if (cellularRate < 60) {
        recommendations.push({
          priority: 'medium',
          category: 'network',
          recommendation: 'Add cellular network detection and adaptive connection handling'
        });
      }
    }
    
    // Connection quality recommendations
    if (patterns.connectionQualityPatterns.disconnectionsByQuality.poor > 0) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        recommendation: 'Implement connection quality warnings and suggest network improvements'
      });
    }
    
    // Repeat offender recommendations
    if (patterns.repeatOffenderPatterns.playerCategories.chronic > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'users',
        recommendation: 'Consider connection requirements or assisted troubleshooting for chronic disconnectors'
      });
    }
    
    return recommendations;
  }

  /**
   * Add user experience impact analysis
   * Requirements: 10.5
   * @returns {Object} - User experience impact analysis
   */
  addUserExperienceImpactAnalysis() {
    try {
      const impact = {
        gameDisruption: this.calculateGameDisruptionImpact(),
        playerFrustration: this.calculatePlayerFrustrationMetrics(),
        gameCompletionRates: this.calculateGameCompletionImpact(),
        playerRetention: this.calculatePlayerRetentionImpact(),
        recommendations: this.generateUXRecommendations()
      };
      
      return impact;
      
    } catch (error) {
      console.error('❌ Failed to analyze user experience impact:', error.message);
      return {
        error: 'Failed to analyze user experience impact',
        generatedAt: new Date()
      };
    }
  }

  /**
   * Calculate game disruption impact
   * Requirements: 10.5
   */
  calculateGameDisruptionImpact() {
    const totalPauses = this.pauseEvents.filter(e => e.pauseType === 'start').length;
    const totalGames = new Set(this.pauseEvents.map(e => e.gameId)).size;
    
    const averagePauseDuration = this.metrics.averagePauseDuration / 1000; // Convert to seconds
    const gamesWithPauses = totalGames > 0 ? totalPauses / totalGames : 0;
    
    return {
      totalGamesPaused: totalGames,
      averagePausesPerGame: gamesWithPauses,
      averagePauseDurationSeconds: averagePauseDuration,
      disruptionScore: Math.min(100, gamesWithPauses * 20 + (averagePauseDuration / 60) * 10)
    };
  }

  /**
   * Calculate player frustration metrics
   * Requirements: 10.5
   */
  calculatePlayerFrustrationMetrics() {
    const failedReconnections = this.reconnectionEvents.filter(e => !e.success).length;
    const expiredGracePeriods = this.gracePeriodEvents.filter(e => 
      e.gracePeriodType === 'expired' || e.outcome === 'expired'
    ).length;
    
    const frustrationScore = (failedReconnections * 15) + (expiredGracePeriods * 25);
    
    return {
      failedReconnectionAttempts: failedReconnections,
      expiredGracePeriods,
      frustrationScore: Math.min(100, frustrationScore),
      frustrationLevel: frustrationScore < 20 ? 'low' : 
                      frustrationScore < 50 ? 'medium' : 'high'
    };
  }

  /**
   * Calculate game completion impact
   * Requirements: 10.5
   */
  calculateGameCompletionImpact() {
    const gamesEnded = this.continuationEvents.filter(e => e.decision === 'end_game').length;
    const totalContinuationDecisions = this.continuationEvents.length;
    
    const completionImpactRate = totalContinuationDecisions > 0 ? 
      (gamesEnded / totalContinuationDecisions) * 100 : 0;
    
    return {
      gamesEndedDueToDisconnection: gamesEnded,
      totalContinuationDecisions,
      completionImpactRate,
      impact: completionImpactRate < 10 ? 'low' : 
              completionImpactRate < 30 ? 'medium' : 'high'
    };
  }

  /**
   * Calculate player retention impact
   * Requirements: 10.5
   */
  calculatePlayerRetentionImpact() {
    const patterns = this.analyzeDisconnectionPatterns();
    const chronicDisconnectors = patterns.repeatOffenderPatterns.playerCategories.chronic;
    const totalPlayers = Object.values(patterns.repeatOffenderPatterns.playerCategories)
      .reduce((a, b) => a + b, 0);
    
    const retentionRisk = totalPlayers > 0 ? (chronicDisconnectors / totalPlayers) * 100 : 0;
    
    return {
      chronicDisconnectors,
      totalPlayers,
      retentionRiskPercentage: retentionRisk,
      riskLevel: retentionRisk < 5 ? 'low' : 
                 retentionRisk < 15 ? 'medium' : 'high'
    };
  }

  /**
   * Generate UX recommendations
   * Requirements: 10.5
   */
  generateUXRecommendations() {
    const recommendations = [];
    const impact = this.addUserExperienceImpactAnalysis();
    
    if (impact.gameDisruption && impact.gameDisruption.disruptionScore > 50) {
      recommendations.push({
        priority: 'high',
        category: 'disruption',
        recommendation: 'Reduce game pause frequency by improving connection stability detection'
      });
    }
    
    if (impact.playerFrustration && impact.playerFrustration.frustrationLevel === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'frustration',
        recommendation: 'Improve reconnection success rates and provide better user feedback during reconnection attempts'
      });
    }
    
    if (impact.gameCompletionRates && impact.gameCompletionRates.impact === 'high') {
      recommendations.push({
        priority: 'medium',
        category: 'completion',
        recommendation: 'Implement better continuation options to reduce games ending due to disconnections'
      });
    }
    
    if (impact.playerRetention && impact.playerRetention.riskLevel === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'retention',
        recommendation: 'Provide connection troubleshooting assistance for players with frequent disconnections'
      });
    }
    
    return recommendations;
  }

  /**
   * Get status information for monitoring
   * Requirements: 10.1
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      totalEvents: this.eventHistory.length,
      recentEvents: this.eventHistory.filter(e => 
        Date.now() - e.timestamp.getTime() < 3600000 // Last hour
      ).length,
      eventTypes: Object.keys(this.eventCounts),
      totalEventTypes: Object.keys(this.eventCounts).length,
      cacheSize: this.patternCache.size,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
const analyticsLogger = new AnalyticsLogger();

// Export both the class and singleton instance
module.exports = analyticsLogger;
module.exports.AnalyticsLogger = AnalyticsLogger;