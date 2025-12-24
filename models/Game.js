const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String, // For non-registered players
    score: {
      type: Number,
      default: 0
    },
    isWinner: {
      type: Boolean,
      default: false
    },
    isBot: {
      type: Boolean,
      default: false
    }
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  boardState: {
    type: Array,
    default: []
  },
  winner: {
    type: String,
    default: null
  },
  gameLog: {
    type: Array,
    default: []
  },
  isBotGame: {
    type: Boolean,
    default: false
  },
  // Enhanced game state for persistence
  gameState: {
    board: {
      type: Array,
      default: []
    },
    currentPlayerIndex: {
      type: Number,
      default: 0
    },
    started: {
      type: Boolean,
      default: false
    },
    winner: {
      type: String,
      default: null
    },
    turnStartTime: {
      type: Date,
      default: Date.now
    }
  },
  // Persistence metadata
  persistence: {
    lastSaved: {
      type: Date,
      default: Date.now
    },
    saveVersion: {
      type: Number,
      default: 1
    },
    memoryState: {
      type: Boolean,
      default: false
    }
  },
  // Lifecycle management
  lifecycle: {
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    cleanupScheduled: {
      type: Date
    }
  },
  // Metadata for debugging and monitoring
  metadata: {
    version: {
      type: String,
      default: '1.0.0'
    },
    serverInstance: {
      type: String,
      default: 'default'
    }
  },
  
  // Player Reconnection Management fields
  isPaused: {
    type: Boolean,
    default: false
  },
  pauseReason: {
    type: String,
    enum: ['CURRENT_PLAYER_DISCONNECT', 'MULTIPLE_DISCONNECTS', 'NETWORK_INSTABILITY', 'ALL_PLAYERS_DISCONNECT', 'MANUAL_PAUSE', null],
    default: null
  },
  pausedAt: {
    type: Date,
    default: null
  },
  pausedBy: {
    type: String, // playerId who caused pause
    default: null
  },
  
  gracePeriod: {
    isActive: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: Date,
      default: null
    },
    duration: {
      type: Number, // milliseconds
      default: 180000 // 3 minutes default
    },
    targetPlayerId: {
      type: String,
      default: null
    }
  },
  
  turnTimer: {
    remainingTime: {
      type: Number, // milliseconds
      default: null
    },
    pausedAt: {
      type: Date,
      default: null
    },
    originalDuration: {
      type: Number,
      default: 60000 // 1 minute default
    }
  },
  
  playerStatuses: [{
    playerId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['CONNECTED', 'DISCONNECTING', 'RECONNECTING', 'DISCONNECTED', 'ABANDONED'],
      default: 'CONNECTED'
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    disconnectedAt: {
      type: Date,
      default: null
    },
    reconnectionAttempts: {
      type: Number,
      default: 0
    },
    connectionMetrics: {
      latency: {
        type: Number,
        default: 0
      },
      packetLoss: {
        type: Number,
        default: 0
      },
      connectionQuality: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor'],
        default: 'good'
      },
      isMobile: {
        type: Boolean,
        default: false
      },
      networkType: {
        type: String,
        enum: ['wifi', 'cellular', 'unknown'],
        default: 'unknown'
      }
    }
  }],
  
  continuationOptions: {
    presented: {
      type: Boolean,
      default: false
    },
    presentedAt: {
      type: Date,
      default: null
    },
    options: [{
      type: String,
      enum: ['skip_turn', 'add_bot', 'end_game']
    }],
    votes: [{
      playerId: {
        type: String,
        required: true
      },
      choice: {
        type: String,
        enum: ['skip_turn', 'add_bot', 'end_game'],
        required: true
      },
      votedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Analytics and monitoring for reconnection events
  reconnectionEvents: [{
    eventType: {
      type: String,
      enum: ['DISCONNECT', 'RECONNECT', 'PAUSE', 'RESUME', 'GRACE_PERIOD_START', 'GRACE_PERIOD_EXPIRE', 'CONTINUATION_DECISION'],
      required: true
    },
    playerId: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }]
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Method to calculate game duration
GameSchema.methods.endGame = function(winner) {
  this.endTime = Date.now();
  this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60)); // Convert to minutes
  this.winner = winner;
  
  // Set winner in players array
  if (winner) {
    this.players.forEach(player => {
      if (player.name === winner) {
        player.isWinner = true;
      }
    });
  }
};

// Method to check if this is a multiplayer game (not bot game)
GameSchema.methods.isMultiplayer = function() {
  // If isBotGame is explicitly set, use that
  if (this.isBotGame !== undefined) {
    return !this.isBotGame;
  }
  
  // Otherwise check if any players are bots
  const botPlayers = this.players.filter(player => player.isBot);
  return botPlayers.length === 0;
};

// Player Reconnection Management methods
GameSchema.methods.pauseGame = function(reason, playerId, preservedState = {}) {
  this.isPaused = true;
  this.pauseReason = reason;
  this.pausedAt = new Date();
  this.pausedBy = playerId;
  
  // Preserve turn timer state
  if (preservedState.remainingTime !== undefined) {
    this.turnTimer.remainingTime = preservedState.remainingTime;
    this.turnTimer.pausedAt = new Date();
  }
  
  // Log the pause event
  this.reconnectionEvents.push({
    eventType: 'PAUSE',
    playerId: playerId,
    reason: reason,
    metadata: preservedState
  });
};

GameSchema.methods.resumeGame = function(playerId, restoredState = {}) {
  this.isPaused = false;
  this.pauseReason = null;
  this.pausedAt = null;
  this.pausedBy = null;
  
  // End grace period if active
  this.gracePeriod.isActive = false;
  this.gracePeriod.startTime = null;
  this.gracePeriod.targetPlayerId = null;
  
  // Restore turn timer
  if (this.turnTimer.remainingTime !== null) {
    this.turnTimer.pausedAt = null;
  }
  
  // Log the resume event
  this.reconnectionEvents.push({
    eventType: 'RESUME',
    playerId: playerId,
    metadata: restoredState
  });
};

GameSchema.methods.startGracePeriod = function(playerId, duration = 180000) {
  this.gracePeriod.isActive = true;
  this.gracePeriod.startTime = new Date();
  this.gracePeriod.duration = duration;
  this.gracePeriod.targetPlayerId = playerId;
  
  // Log the grace period start
  this.reconnectionEvents.push({
    eventType: 'GRACE_PERIOD_START',
    playerId: playerId,
    metadata: { duration: duration }
  });
};

GameSchema.methods.updatePlayerStatus = function(playerId, status, connectionMetrics = {}) {
  let playerStatus = this.playerStatuses.find(ps => ps.playerId === playerId);
  
  if (!playerStatus) {
    // Create new player status entry
    playerStatus = {
      playerId: playerId,
      status: status,
      lastSeen: new Date(),
      disconnectedAt: status === 'DISCONNECTED' ? new Date() : null,
      reconnectionAttempts: 0,
      connectionMetrics: {
        latency: connectionMetrics.latency || 0,
        packetLoss: connectionMetrics.packetLoss || 0,
        connectionQuality: connectionMetrics.connectionQuality || 'good',
        isMobile: connectionMetrics.isMobile || false,
        networkType: connectionMetrics.networkType || 'unknown'
      }
    };
    this.playerStatuses.push(playerStatus);
  } else {
    // Update existing player status
    const oldStatus = playerStatus.status;
    playerStatus.status = status;
    playerStatus.lastSeen = new Date();
    
    if (status === 'DISCONNECTED' && oldStatus !== 'DISCONNECTED') {
      playerStatus.disconnectedAt = new Date();
    } else if (status === 'CONNECTED' && oldStatus !== 'CONNECTED') {
      playerStatus.disconnectedAt = null;
      playerStatus.reconnectionAttempts += 1;
    }
    
    // Update connection metrics
    if (connectionMetrics) {
      Object.assign(playerStatus.connectionMetrics, connectionMetrics);
    }
  }
  
  // Log the status change event
  this.reconnectionEvents.push({
    eventType: status === 'DISCONNECTED' ? 'DISCONNECT' : 'RECONNECT',
    playerId: playerId,
    metadata: { 
      oldStatus: playerStatus ? playerStatus.status : null,
      newStatus: status,
      connectionMetrics: connectionMetrics
    }
  });
};

GameSchema.methods.getPlayerStatus = function(playerId) {
  return this.playerStatuses.find(ps => ps.playerId === playerId);
};

GameSchema.methods.isCurrentPlayerDisconnected = function() {
  if (!this.gameState || this.gameState.currentPlayerIndex === undefined) {
    return false;
  }
  
  const currentPlayer = this.players[this.gameState.currentPlayerIndex];
  if (!currentPlayer) {
    return false;
  }
  
  const playerStatus = this.getPlayerStatus(currentPlayer.name || currentPlayer.userId);
  return playerStatus && (playerStatus.status === 'DISCONNECTED' || playerStatus.status === 'ABANDONED');
};

GameSchema.methods.presentContinuationOptions = function() {
  this.continuationOptions.presented = true;
  this.continuationOptions.presentedAt = new Date();
  this.continuationOptions.options = ['skip_turn', 'add_bot', 'end_game'];
  this.continuationOptions.votes = [];
  
  // Log the continuation options presentation
  this.reconnectionEvents.push({
    eventType: 'CONTINUATION_DECISION',
    playerId: this.gracePeriod.targetPlayerId || 'system',
    metadata: { action: 'present_options' }
  });
};

GameSchema.methods.addContinuationVote = function(playerId, choice) {
  // Remove any existing vote from this player
  this.continuationOptions.votes = this.continuationOptions.votes.filter(
    vote => vote.playerId !== playerId
  );
  
  // Add new vote
  this.continuationOptions.votes.push({
    playerId: playerId,
    choice: choice,
    votedAt: new Date()
  });
};

GameSchema.methods.getGracePeriodTimeRemaining = function() {
  if (!this.gracePeriod.isActive || !this.gracePeriod.startTime) {
    return 0;
  }
  
  const elapsed = Date.now() - this.gracePeriod.startTime.getTime();
  const remaining = this.gracePeriod.duration - elapsed;
  return Math.max(0, remaining);
};

GameSchema.methods.isGracePeriodExpired = function() {
  return this.gracePeriod.isActive && this.getGracePeriodTimeRemaining() <= 0;
};

// Database indexes for efficient reconnection queries
GameSchema.index({ gameId: 1 }); // Primary game lookup
GameSchema.index({ isPaused: 1, pausedAt: 1 }); // Find paused games
GameSchema.index({ 'gracePeriod.isActive': 1, 'gracePeriod.startTime': 1 }); // Grace period queries
GameSchema.index({ 'playerStatuses.playerId': 1, 'playerStatuses.status': 1 }); // Player status lookups
GameSchema.index({ 'lifecycle.lastActivity': 1 }); // Game cleanup queries
GameSchema.index({ 'reconnectionEvents.timestamp': 1, 'reconnectionEvents.eventType': 1 }); // Analytics queries

module.exports = mongoose.model('Game', GameSchema);
