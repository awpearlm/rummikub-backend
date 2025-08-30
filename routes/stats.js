const express = require('express');
const router = express.Router();
const Stats = require('../models/Stats');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Public leaderboard (no authentication required)
router.get('/leaderboard/public', async (req, res) => {
  try {
    // Get top 5 users by wins, excluding test and admin users
    const leaderboard = await Stats.find()
      .populate({
        path: 'userId',
        select: 'username email isAdmin',
        match: {
          isAdmin: false,
          email: { 
            $not: { 
              $regex: /test|example\.com/i 
            } 
          },
          username: { 
            $not: { 
              $regex: /test|admin|bot/i 
            } 
          }
        }
      })
      .sort({ gamesWon: -1 })
      .limit(10); // Get a few extra in case some are filtered out

    // Filter out entries where userId is null (due to match criteria)
    const filteredLeaderboard = leaderboard
      .filter(player => player.userId && player.gamesWon > 0)
      .slice(0, 5) // Take top 5
      .map((player, index) => ({
        rank: index + 1,
        username: player.userId.username,
        gamesWon: player.gamesWon,
        gamesPlayed: player.gamesPlayed,
        winPercentage: player.winPercentage
      }));

    res.status(200).json({
      leaderboard: filteredLeaderboard
    });
  } catch (error) {
    console.error('Get public leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply authentication to all routes below this point
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
    const { won, points, playTime, isBotGame, gameId } = req.body;
    
    // Skip stats update for bot games
    if (isBotGame) {
      return res.status(200).json({
        message: 'Stats not updated for bot game',
        skipReason: 'bot game'
      });
    }
    
    // Check if the game was properly completed (not abandoned)
    if (gameId) {
      const Game = require('../models/Game');
      const game = await Game.findOne({ gameId });
      
      if (game && game.winner && isGameAbandoned(game.winner)) {
        return res.status(200).json({
          message: 'Stats not updated for abandoned game',
          skipReason: 'game abandoned',
          reason: game.winner
        });
      }
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

// Helper function to check if a game was abandoned (not properly completed)
function isGameAbandoned(winner) {
  if (!winner) return true; // No winner means incomplete
  
  // Check for abandonment reasons
  const abandonmentReasons = [
    'Game abandoned due to inactivity',
    'Single player timeout',
    'Game timeout',
    'No active players remaining',
    'abandoned',
    'timeout',
    'inactivity'
  ];
  
  return abandonmentReasons.some(reason => 
    winner.toLowerCase().includes(reason.toLowerCase())
  );
}

module.exports = router;
