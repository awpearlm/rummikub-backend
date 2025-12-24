const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const Invitation = require('../models/Invitation');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Apply authentication and admin check to all routes
router.use(authenticateToken, isAdmin);

// Get all users with enhanced info
router.get('/users', async (req, res) => {
  try {
    // Define test users to exclude from metrics but still show in admin panel for management
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
        isCurrentlyOnline: user.isOnline && (Date.now() - new Date(user.lastSeen)) < 5 * 60 * 1000,
        // Mark test users for visual distinction
        isTestUser: ['testuser', 'testuser2'].includes(user.username.toLowerCase())
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
    console.log('📧 Invitation request received');
    console.log('📦 Request body:', req.body);
    console.log('👤 Request user:', req.user ? { id: req.user.id, username: req.user.username, isAdmin: req.user.isAdmin } : 'undefined');
    
    const { email, message } = req.body;
    
    if (!email) {
      console.log('❌ Email validation failed: Email is required');
      return res.status(400).json({ message: 'Email is required' });
    }
    
    console.log('📧 Processing invitation for email:', email);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('❌ User validation failed: User already exists with email:', email);
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    // Check if invitation already exists and is pending
    const existingInvitation = await Invitation.findOne({ 
      email: email.toLowerCase(), 
      status: 'pending' 
    });
    
    if (existingInvitation) {
      console.log('❌ Invitation validation failed: Invitation already sent to:', email);
      return res.status(400).json({ message: 'Invitation already sent to this email' });
    }
    
    if (!req.user || !req.user.id) {
      console.log('❌ Auth validation failed: req.user or req.user.id is undefined');
      return res.status(400).json({ message: 'Authentication error: User not found' });
    }
    
    console.log('✅ All validations passed, creating invitation...');
    
    // Create new invitation
    const invitation = new Invitation({
      email: email.toLowerCase(),
      invitedBy: req.user.id,
      message: message || '',
      invitationToken: Invitation.generateInvitationToken()
    });
    
    console.log('💾 Saving invitation to database...');
    await invitation.save();
    console.log('✅ Invitation saved successfully with ID:', invitation._id);
    
    // Send the actual invitation email
    const invitationLink = `${process.env.FRONTEND_URL || 'https://jkube.netlify.app'}/signup.html?token=${invitation.invitationToken}`;
    
    try {
      const emailResult = await emailService.sendInvitationEmail(
        email,
        req.user.username,
        invitationLink,
        message
      );
      
      if (emailResult.success) {
        console.log(`📧 Invitation email sent successfully to ${email}`);
        if (emailResult.previewUrl) {
          console.log(`🔗 Preview URL: ${emailResult.previewUrl}`);
        }
      } else {
        console.log(`⚠️ Email sending failed: ${emailResult.error}`);
        console.log(`🔗 Invitation link (for manual sharing): ${invitationLink}`);
      }
    } catch (emailError) {
      console.error('❌ Email service error:', emailError);
      console.log(`🔗 Invitation link (for manual sharing): ${invitationLink}`);
    }
    
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
    console.error('💥 Invitation route error:', error);
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
    });
    
    // Check for specific MongoDB errors
    if (error.name === 'ValidationError') {
      console.error('🔍 Validation error details:', error.errors);
      return res.status(400).json({ 
        message: 'Validation error', 
        details: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    if (error.code === 11000) {
      console.error('🔍 Duplicate key error:', error.keyPattern);
      return res.status(400).json({ message: 'Duplicate invitation token generated, please try again' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all invitations
router.get('/invitations', async (req, res) => {
  try {
    const invitations = await Invitation.find({}).sort({ sentAt: -1 });
    res.status(200).json({ invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel invitation

// Protected cleanup endpoint (requires admin auth)
router.post('/cleanup-cancelled', async (req, res) => {
  try {
    console.log('🧹 Admin cleanup: Removing all cancelled invitations');
    
    // Find all cancelled invitations first
    const cancelledInvitations = await Invitation.find({ status: 'cancelled' });
    console.log(`📋 Found ${cancelledInvitations.length} cancelled invitations to remove`);
    
    // Log what's being removed
    cancelledInvitations.forEach(inv => {
      console.log(`   - ${inv.email} (ID: ${inv._id}, sent: ${inv.sentAt})`);
    });
    
    // Delete all cancelled invitations
    const deleteResult = await Invitation.deleteMany({ status: 'cancelled' });
    console.log(`✅ Deleted ${deleteResult.deletedCount} cancelled invitations`);
    
    res.status(200).json({ 
      message: 'Cleanup completed successfully',
      deletedCount: deleteResult.deletedCount,
      deletedInvitations: cancelledInvitations.map(inv => ({
        email: inv.email,
        id: inv._id,
        sentAt: inv.sentAt
      }))
    });
  } catch (error) {
    console.error('Cleanup error:', error);
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
    
    // Actually delete the invitation instead of just marking as cancelled
    await Invitation.findByIdAndDelete(req.params.id);
    
    console.log(`📧 Invitation to ${invitation.email} deleted by admin`);
    
    res.status(200).json({ message: 'Invitation deleted successfully' });
  } catch (error) {
    console.error('Delete invitation error:', error);
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
    // Define test users to exclude from metrics
    const testUsers = ['testuser', 'testuser2'];
    const excludeTestUsers = { username: { $nin: testUsers } };
    
    // Get total counts (excluding test users)
    const totalUsers = await User.countDocuments(excludeTestUsers);
    const activeUsers = await User.countDocuments({ 
      ...excludeTestUsers,
      lastSeen: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });
    const onlineUsers = await User.countDocuments({ 
      ...excludeTestUsers,
      isOnline: true,
      lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });
    const totalInvitations = await Invitation.countDocuments();
    const pendingInvitations = await Invitation.countDocuments({ status: 'pending' });
    
    // Get user registration over time (last 30 days, excluding test users)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userRegistrations = await User.aggregate([
      { 
        $match: { 
          createdAt: { $gte: thirtyDaysAgo },
          username: { $nin: testUsers }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get test user IDs to exclude from stats
    const testUserIds = await User.find({ username: { $in: testUsers } }).select('_id');
    const testUserObjectIds = testUserIds.map(user => user._id);
    
    // Get user stats summary (excluding test users)
    const gameStats = await Stats.aggregate([
      { $match: { userId: { $nin: testUserObjectIds } } },
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
    
    // Get top players by wins (excluding test users)
    const topPlayers = await Stats.find({ userId: { $nin: testUserObjectIds } })
      .sort({ gamesWon: -1 })
      .limit(10)
      .populate('userId', 'username');
    
    // Get recent activity (users who logged in recently, excluding test users)
    const recentActivity = await User.find({ 
      ...excludeTestUsers,
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
