const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const Invitation = require('../models/Invitation');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Apply authentication and admin check to all routes
router.use(authenticateToken, isAdmin);

// Get all users with enhanced info
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('invitedBy', 'username email')
      .sort({ createdAt: -1 });
    
    // Add stats for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const stats = await Stats.findOne({ userId: user._id });
      return {
        ...user.toObject(),
        stats: stats || {
          gamesPlayed: 0,
          gamesWon: 0,
          winPercentage: 0,
          totalPlayTime: 0,
          highestScore: 0
        },
        // Calculate online status (online if seen within last 5 minutes)
        isCurrentlyOnline: user.isOnline && (Date.now() - new Date(user.lastSeen)) < 5 * 60 * 1000
      };
    }));
    
    res.status(200).json({ users: usersWithStats });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send invitation
router.post('/invitations', async (req, res) => {
  try {
    const { email, message } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    // Check if invitation already exists and is pending
    const existingInvitation = await Invitation.findOne({ 
      email: email.toLowerCase(), 
      status: 'pending' 
    });
    
    if (existingInvitation) {
      return res.status(400).json({ message: 'Invitation already sent to this email' });
    }
    
    // Create new invitation
    const invitation = new Invitation({
      email: email.toLowerCase(),
      invitedBy: req.user.id,
      message: message || '',
      invitationToken: Invitation.generateInvitationToken()
    });
    
    await invitation.save();
    
    // TODO: Send actual email here
    // For now, we'll just log the invitation link
    const invitationLink = `${process.env.FRONTEND_URL || 'https://jkube.netlify.app'}/signup?token=${invitation.invitationToken}`;
    console.log(`📧 Invitation sent to ${email}:`);
    console.log(`🔗 Invitation link: ${invitationLink}`);
    
    res.status(201).json({ 
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        invitationLink,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all invitations
router.get('/invitations', async (req, res) => {
  try {
    const invitations = await Invitation.find()
      .populate('invitedBy', 'username email')
      .sort({ sentAt: -1 });
    
    res.status(200).json({ invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel invitation
router.delete('/invitations/:id', async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id);
    
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'Can only cancel pending invitations' });
    }
    
    invitation.status = 'cancelled';
    await invitation.save();
    
    res.status(200).json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('invitedBy', 'username email');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user stats
    const stats = await Stats.findOne({ userId: user._id });
    
    // Get users invited by this user
    const invitedUsers = await User.find({ invitedBy: user._id })
      .select('username email createdAt invitationStatus');
    
    res.status(200).json({ 
      user,
      stats: stats || {},
      invitedUsers
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
    
    // Prevent deleting yourself
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    // Delete user stats
    await Stats.findOneAndDelete({ userId: user._id });
    
    // Cancel any pending invitations sent by this user
    await Invitation.updateMany(
      { invitedBy: user._id, status: 'pending' },
      { status: 'cancelled' }
    );
    
    // Delete user
    await User.findByIdAndDelete(user._id);
    
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comprehensive statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
      lastSeen: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });
    const onlineUsers = await User.countDocuments({ 
      isOnline: true,
      lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });
    const totalInvitations = await Invitation.countDocuments();
    const pendingInvitations = await Invitation.countDocuments({ status: 'pending' });
    
    // Get user registration over time (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get user stats summary
    const gameStats = await Stats.aggregate([
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
    
    // Get recent activity (users who logged in recently)
    const recentActivity = await User.find({ 
      lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    })
      .select('username lastLogin')
      .sort({ lastLogin: -1 })
      .limit(10);
    
    res.status(200).json({
      overview: {
        totalUsers,
        activeUsers,
        onlineUsers,
        totalInvitations,
        pendingInvitations
      },
      userRegistrations,
      gameStats: gameStats[0] || {
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        totalPoints: 0,
        avgWinPercentage: 0,
        avgPointsPerGame: 0,
        totalPlayTime: 0
      },
      topPlayers: topPlayers.map(player => ({
        username: player.userId?.username || 'Unknown',
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
        winPercentage: player.winPercentage,
        highestScore: player.highestScore,
        totalPlayTime: player.totalPlayTime
      })),
      recentActivity: recentActivity.map(user => ({
        username: user.username,
        lastLogin: user.lastLogin
      }))
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
