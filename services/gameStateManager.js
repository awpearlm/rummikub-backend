/**
 * Enhanced Game State Manager
 * Handles MongoDB game state synchronization, automatic saves, and lifecycle cleanup
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const Game = require('../models/Game');
const mongoose = require('mongoose');

class GameStateManager {
  constructor() {
    this.saveQueue = new Map(); // Queue for pending saves
    this.saveInterval = null;
    this.cleanupInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the game state manager
   * Sets up periodic saves and cleanup intervals
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🔧 Initializing Enhanced Game State Manager...');
    
    // Start periodic save processing (every 30 seconds)
    this.saveInterval = setInterval(() => {
      this.processSaveQueue();
    }, 30000);

    // Start periodic cleanup (every hour)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredGames();
    }, 60 * 60 * 1000);

    this.isInitialized = true;
    console.log('✅ Game State Manager initialized');
  }

  /**
   * Shutdown the game state manager
   * Clears intervals and processes remaining saves
   */
  async shutdown() {
    if (!this.isInitialized) return;

    console.log('🔧 Shutting down Game State Manager...');
    
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Process any remaining saves
    await this.processSaveQueue();
    
    this.isInitialized = false;
    console.log('✅ Game State Manager shutdown complete');
  }

  /**
   * Save game state to MongoDB
   * Requirements: 5.1, 5.2
   * @param {string} gameId - The game ID
   * @param {Object} gameData - The game data to save
   * @returns {Promise<Object>} - The saved game document
   */
  async saveGameState(gameId, gameData) {
    try {
      console.log(`💾 Saving game state for ${gameId}...`);
      
      // Convert game data to MongoDB document format
      const gameDoc = this.convertToMongoDocument(gameData);
      
      // Use upsert to create or update
      const savedGame = await Game.findOneAndUpdate(
        { gameId },
        {
          $set: {
            ...gameDoc,
            'persistence.lastSaved': new Date(),
            'persistence.saveVersion': (gameDoc.persistence?.saveVersion || 0) + 1,
            'lifecycle.lastActivity': new Date()
          }
        },
        { 
          upsert: true, 
          new: true,
          runValidators: true
        }
      );

      console.log(`✅ Game ${gameId} saved successfully (version ${savedGame.persistence?.saveVersion || 1})`);
      return savedGame;
      
    } catch (error) {
      console.error(`❌ Failed to save game ${gameId}:`, error.message);
      throw new Error(`Game state save failed: ${error.message}`);
    }
  }

  /**
   * Load game state from MongoDB
   * Requirements: 5.4
   * @param {string} gameId - The game ID to load
   * @returns {Promise<Object|null>} - The loaded game data or null if not found
   */
  async loadGameState(gameId) {
    try {
      console.log(`📂 Loading game state for ${gameId}...`);
      
      const gameDoc = await Game.findOne({ gameId });
      
      if (!gameDoc) {
        console.log(`⚠️  Game ${gameId} not found in database`);
        return null;
      }

      // Convert MongoDB document back to game format
      const gameData = this.convertFromMongoDocument(gameDoc);
      
      console.log(`✅ Game ${gameId} loaded successfully`);
      return gameData;
      
    } catch (error) {
      console.error(`❌ Failed to load game ${gameId}:`, error.message);
      throw new Error(`Game state load failed: ${error.message}`);
    }
  }

  /**
   * Synchronize game state (immediate save)
   * Requirements: 5.2
   * @param {string} gameId - The game ID
   * @param {Object} gameData - The game data to sync
   * @returns {Promise<Object>} - The synced game document
   */
  async syncGameState(gameId, gameData) {
    // Add to save queue for immediate processing
    this.saveQueue.set(gameId, {
      gameData,
      timestamp: Date.now(),
      priority: 'high'
    });

    // Process immediately for high priority saves
    return await this.processSaveQueue();
  }

  /**
   * Queue a game state save for later processing
   * Requirements: 5.2
   * @param {string} gameId - The game ID
   * @param {Object} gameData - The game data to save
   * @param {string} priority - Save priority ('low', 'normal', 'high')
   */
  queueSave(gameId, gameData, priority = 'normal') {
    this.saveQueue.set(gameId, {
      gameData,
      timestamp: Date.now(),
      priority
    });

    console.log(`📝 Queued save for game ${gameId} (priority: ${priority})`);
  }

  /**
   * Process the save queue
   * @returns {Promise<void>}
   */
  async processSaveQueue() {
    if (this.saveQueue.size === 0) return;

    console.log(`🔄 Processing save queue (${this.saveQueue.size} games)...`);
    
    const saves = Array.from(this.saveQueue.entries());
    this.saveQueue.clear();

    // Sort by priority and timestamp
    saves.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b[1].priority] - priorityOrder[a[1].priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a[1].timestamp - b[1].timestamp; // Older first
    });

    // Process saves in batches to avoid overwhelming the database
    const batchSize = 5;
    for (let i = 0; i < saves.length; i += batchSize) {
      const batch = saves.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async ([gameId, { gameData }]) => {
          try {
            await this.saveGameState(gameId, gameData);
          } catch (error) {
            console.error(`❌ Batch save failed for game ${gameId}:`, error.message);
            // Re-queue failed saves with lower priority
            this.queueSave(gameId, gameData, 'low');
          }
        })
      );
    }

    console.log(`✅ Save queue processing complete`);
  }

  /**
   * Clean up expired games from the database
   * Requirements: 5.5
   * @returns {Promise<Object>} - Cleanup results
   */
  async cleanupExpiredGames() {
    try {
      console.log('🧹 Starting game lifecycle cleanup...');
      
      const now = new Date();
      const cutoffTimes = {
        completed: 24 * 60 * 60 * 1000, // 24 hours
        abandoned: 2 * 60 * 60 * 1000,  // 2 hours
        expired: 1 * 60 * 60 * 1000     // 1 hour
      };

      // Build cleanup filter for different game states
      const cleanupFilter = {
        $or: [
          // Completed games older than 24 hours
          {
            winner: { $ne: null },
            endTime: { $lt: new Date(now - cutoffTimes.completed) }
          },
          // Abandoned games (started but no winner, inactive for 2+ hours)
          {
            winner: null,
            'gameState.started': true,
            'lifecycle.lastActivity': { $lt: new Date(now - cutoffTimes.abandoned) }
          },
          // Expired games (never started, created 1+ hours ago)
          {
            'gameState.started': false,
            startTime: { $lt: new Date(now - cutoffTimes.expired) }
          }
        ]
      };

      // Find games to be deleted (for logging)
      const gamesToDelete = await Game.find(cleanupFilter, { gameId: 1, winner: 1, startTime: 1 });
      
      // Perform the cleanup
      const result = await Game.deleteMany(cleanupFilter);
      
      console.log(`🧹 Cleanup complete: ${result.deletedCount} games removed`);
      if (gamesToDelete.length > 0) {
        console.log(`   Deleted games: ${gamesToDelete.map(g => g.gameId).join(', ')}`);
      }

      return {
        deletedCount: result.deletedCount,
        deletedGames: gamesToDelete.map(g => g.gameId)
      };
      
    } catch (error) {
      console.error('❌ Game cleanup failed:', error.message);
      throw new Error(`Game cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get game state recovery information
   * Requirements: 5.3
   * @param {string} gameId - The game ID
   * @returns {Promise<Object|null>} - Recovery information or null
   */
  async getRecoveryInfo(gameId) {
    try {
      const gameDoc = await Game.findOne({ gameId }, {
        gameId: 1,
        'persistence.lastSaved': 1,
        'persistence.saveVersion': 1,
        'lifecycle.lastActivity': 1,
        'gameState.started': 1,
        players: 1
      });

      if (!gameDoc) return null;

      return {
        gameId: gameDoc.gameId,
        lastSaved: gameDoc.persistence?.lastSaved,
        saveVersion: gameDoc.persistence?.saveVersion || 0,
        lastActivity: gameDoc.lifecycle?.lastActivity,
        isStarted: gameDoc.gameState?.started || false,
        playerCount: gameDoc.players?.length || 0,
        canRecover: true
      };
      
    } catch (error) {
      console.error(`❌ Failed to get recovery info for ${gameId}:`, error.message);
      return null;
    }
  }

  /**
   * Convert game data to MongoDB document format
   * @param {Object} gameData - The game data
   * @returns {Object} - MongoDB document
   */
  convertToMongoDocument(gameData) {
    return {
      gameId: gameData.id,
      players: gameData.players.map(p => ({
        userId: p.isBot ? null : new mongoose.Types.ObjectId(),
        name: p.name,
        score: p.score || 0,
        isWinner: gameData.winner && gameData.winner.id === p.id,
        isBot: p.isBot || false
      })),
      startTime: gameData.lifecycle?.startTime || gameData.createdAt || new Date(),
      endTime: gameData.lifecycle?.endTime || null,
      duration: gameData.lifecycle?.endTime ? 
        Math.round((gameData.lifecycle.endTime - gameData.lifecycle.startTime) / (1000 * 60)) : 0,
      boardState: gameData.board || [],
      winner: gameData.winner ? gameData.winner.name : null,
      gameLog: gameData.gameLog || [],
      isBotGame: gameData.isBotGame || false,
      gameState: {
        board: gameData.board || [],
        currentPlayerIndex: gameData.currentPlayerIndex || 0,
        started: gameData.started || false,
        winner: gameData.winner ? gameData.winner.name : null,
        turnStartTime: new Date()
      },
      persistence: {
        lastSaved: new Date(),
        saveVersion: (gameData.persistence?.saveVersion || 0) + 1,
        memoryState: false
      },
      lifecycle: {
        startTime: gameData.lifecycle?.startTime || gameData.createdAt || new Date(),
        endTime: gameData.lifecycle?.endTime || null,
        lastActivity: new Date(),
        cleanupScheduled: null
      },
      metadata: {
        version: '1.0.0',
        serverInstance: process.env.SERVER_INSTANCE || 'default'
      }
    };
  }

  /**
   * Convert MongoDB document to game data format
   * @param {Object} doc - MongoDB document
   * @returns {Object} - Game data
   */
  convertFromMongoDocument(doc) {
    return {
      id: doc.gameId,
      players: doc.players.map(p => ({
        id: p.isBot ? `bot_${Math.random().toString(36).substring(2, 9)}` : p.userId?.toString() || 'recovered-player',
        name: p.name,
        hand: [], // Hand data would be restored separately in real implementation
        hasPlayedInitial: false,
        score: p.score,
        isBot: p.isBot
      })),
      currentPlayerIndex: doc.gameState?.currentPlayerIndex || 0,
      deck: [], // Deck would be reconstructed
      board: doc.boardState || doc.gameState?.board || [],
      boardSnapshot: [],
      started: doc.gameState?.started || false,
      winner: doc.winner ? { name: doc.winner } : null,
      chatMessages: [],
      gameLog: doc.gameLog || [],
      isBotGame: doc.isBotGame || false,
      createdAt: doc.startTime ? doc.startTime.getTime() : Date.now(),
      persistence: doc.persistence || {
        lastSaved: doc.updatedAt || new Date(),
        saveVersion: 1,
        memoryState: false
      },
      lifecycle: doc.lifecycle || {
        startTime: doc.startTime || new Date(),
        endTime: doc.endTime,
        lastActivity: doc.updatedAt || new Date(),
        cleanupScheduled: null
      }
    };
  }

  /**
   * Get connection status for monitoring
   * @returns {Object} - Connection status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      saveQueueSize: this.saveQueue.size,
      dbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      lastCleanup: this.lastCleanup || null
    };
  }
}

// Export singleton instance
const gameStateManager = new GameStateManager();

module.exports = gameStateManager;