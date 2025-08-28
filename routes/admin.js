const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Apply authentication and admin check to all routes
router.use(authenticateToken, isAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user stats
    const stats = await Stats.findOne({ userId: user._id });
    
    res.status(200).json({ 
      user,
      stats: stats || {}
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (admin functionality)
router.put('/users/:id', async (req, res) => {
  try {
    const { username, email, isAdmin } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update fields if provided
    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (isAdmin !== undefined) user.isAdmin = isAdmin;
    
    await user.save();
    
    res.status(200).json({ 
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete user stats
    await Stats.findOneAndDelete({ userId: user._id });
    
    // Delete user
    await user.remove();
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get game statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments();
    
    // Get user stats summary
    const stats = await Stats.aggregate([
      {
        $group: {
          _id: null,
          totalGamesPlayed: { $sum: '$gamesPlayed' },
          totalGamesWon: { $sum: '$gamesWon' },
          totalPoints: { $sum: '$totalPoints' },
          avgWinPercentage: { $avg: '$winPercentage' },
          avgPointsPerGame: { $avg: '$avgPointsPerGame' },
          totalPlayTime: { $sum: '$totalPlayTime' }
        }
      }
    ]);
    
    // Get top players by wins
    const topPlayers = await Stats.find()
      .sort({ gamesWon: -1 })
      .limit(10)
      .populate('userId', 'username');
    
    res.status(200).json({
      totalUsers,
      gameStats: stats[0] || {},
      topPlayers: topPlayers.map(player => ({
        username: player.userId.username,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
        winPercentage: player.winPercentage,
        highestScore: player.highestScore
      }))
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
