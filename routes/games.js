const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const { authenticateToken } = require('../middleware/auth');

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

module.exports = router;
