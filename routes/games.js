const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const { authenticateToken } = require('../middleware/auth');

// We need access to the in-memory games map to get real-time player counts
// This will be injected by the main server
let inMemoryGames = null;

// Function to set the in-memory games reference
router.setInMemoryGames = (gamesMap) => {
  inMemoryGames = gamesMap;
};

// Get all active games (for lobby)
router.get('/', async (req, res) => {
  try {
    // Find games that are active (have startTime but no endTime)
    const activeGames = await Game.find({ 
      startTime: { $exists: true }, 
      endTime: { $exists: false },
      isBotGame: { $ne: true } // Exclude bot games
    }).sort({ startTime: -1 });
    
    // Clean up stale games (older than 2 hours with no activity)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await Game.updateMany(
      { 
        startTime: { $lt: twoHoursAgo },
        endTime: { $exists: false }
      },
      { 
        endTime: new Date(),
        winner: 'Game abandoned due to inactivity'
      }
    );
    
    // Format games for frontend consumption, filtering out invalid ones
    const formattedGames = activeGames
      .filter(game => {
        // Filter out games with invalid data
        const players = game.players || [];
        return players.length > 0 && players[0].name && game.startTime;
      })
      .map(game => {
        const players = game.players || [];
        const host = players.length > 0 ? players[0].name : 'Unknown';
        
        // Get real-time player count from in-memory game if available
        let playerCount = players.length; // Default to MongoDB count
        
        if (inMemoryGames && inMemoryGames.has(game.gameId)) {
          const inMemoryGame = inMemoryGames.get(game.gameId);
          // Count only non-disconnected players in the in-memory game
          const activePlayers = inMemoryGame.players.filter(p => !p.disconnected);
          playerCount = activePlayers.length;
        }
        
        return {
          id: game.gameId,
          host: host,
          playerCount: playerCount,
          createdAt: game.startTime,
          status: 'WAITING', // Active games are waiting for players
          isBotGame: game.isBotGame || false
        };
      });
    
    res.status(200).json({ games: formattedGames });
  } catch (error) {
    console.error('Get active games error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all games for a user
router.get('/my-games', authenticateToken, async (req, res) => {
  try {
    const games = await Game.find({ 
      'players.userId': req.user.id 
    }).sort({ startTime: -1 });
    
    res.status(200).json({ games });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific game by ID
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.id });
    
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    
    res.status(200).json({ game });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save a game (called at the end of a game)
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { 
      gameId, 
      players, 
      boardState, 
      winner, 
      gameLog,
      isBotGame 
    } = req.body;
    
    // Check if game already exists
    let game = await Game.findOne({ gameId });
    
    if (game) {
      // Update existing game
      game.players = players;
      game.boardState = boardState;
      game.gameLog = gameLog;
      game.isBotGame = isBotGame || false;
      game.endGame(winner);
    } else {
      // Create new game record
      game = new Game({
        gameId,
        players,
        boardState,
        gameLog,
        isBotGame: isBotGame || false
      });
      
      if (winner) {
        game.endGame(winner);
      }
    }
    
    await game.save();
    
    res.status(200).json({ 
      message: 'Game saved successfully',
      game 
    });
  } catch (error) {
    console.error('Save game error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent games (public leaderboard)
router.get('/recent/public', async (req, res) => {
  try {
    const recentGames = await Game.find({ endTime: { $exists: true } })
      .sort({ endTime: -1 })
      .limit(20);
    
    res.status(200).json({ games: recentGames });
  } catch (error) {
    console.error('Get recent games error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cleanup stale games (admin endpoint)
router.post('/cleanup', async (req, res) => {
  try {
    // End games that are older than 2 hours and still active
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const result = await Game.updateMany(
      { 
        startTime: { $lt: twoHoursAgo },
        endTime: { $exists: false }
      },
      { 
        endTime: new Date(),
        winner: 'Game abandoned due to inactivity'
      }
    );
    
    // Also remove games with invalid data (no players or no names)
    const invalidGames = await Game.deleteMany({
      $or: [
        { players: { $size: 0 } },
        { 'players.0.name': { $exists: false } },
        { 'players.0.name': null },
        { 'players.0.name': '' }
      ]
    });
    
    res.status(200).json({ 
      message: 'Cleanup completed',
      gamesEnded: result.modifiedCount,
      invalidGamesRemoved: invalidGames.deletedCount
    });
  } catch (error) {
    console.error('Cleanup games error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
