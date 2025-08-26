const express = require('express');
const router = express.Router();
const Stats = require('../models/Stats');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get current user's stats
router.get('/me', async (req, res) => {
  try {
    const stats = await Stats.findOne({ userId: req.user.id });
    
    if (!stats) {
      // Create stats if not found
      const newStats = new Stats({
        userId: req.user.id
      });
      
      await newStats.save();
      return res.status(200).json({ stats: newStats });
    }
    
    res.status(200).json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    // Get leaderboard based on wins
    const leaderboard = await Stats.find()
      .sort({ gamesWon: -1 })
      .limit(20)
      .populate('userId', 'username');
    
    res.status(200).json({
      leaderboard: leaderboard.map(player => ({
        username: player.userId.username,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
        winPercentage: player.winPercentage,
        highestScore: player.highestScore
      }))
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update stats after a game
router.post('/update', async (req, res) => {
  try {
    const { won, points, playTime, isBotGame } = req.body;
    
    // Skip stats update for bot games
    if (isBotGame) {
      return res.status(200).json({
        message: 'Stats not updated for bot game',
        skipReason: 'bot game'
      });
    }
    
    const stats = await Stats.findOne({ userId: req.user.id });
    
    if (!stats) {
      // Create stats if not found
      const newStats = new Stats({
        userId: req.user.id,
        gamesPlayed: 1,
        gamesWon: won ? 1 : 0,
        winPercentage: won ? 100 : 0,
        totalPoints: points || 0,
        highestScore: points || 0,
        avgPointsPerGame: points || 0,
        totalPlayTime: playTime || 0
      });
      
      await newStats.save();
      return res.status(200).json({ 
        message: 'Stats created successfully',
        stats: newStats 
      });
    }
    
    // Update stats
    stats.updateAfterGame(won, points || 0, playTime || 0);
    await stats.save();
    
    res.status(200).json({ 
      message: 'Stats updated successfully',
      stats 
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
