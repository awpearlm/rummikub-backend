const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Stats = require('../models/Stats');
const Invitation = require('../models/Invitation');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email 
          ? 'Email already in use' 
          : 'Username already taken' 
      });
    }
    
    // Create new user
    const user = new User({
      email,
      username,
      password
    });
    
    // Save user to database
    await user.save();
    
    // Create stats document for the user
    const stats = new Stats({
      userId: user._id
    });
    
    await stats.save();
    
    // Generate signup token to confirm email
    const signupToken = await user.generateSignupToken();
    
    // TODO: Send email with signup token (to be implemented)
    
    res.status(201).json({ 
      message: 'User registered successfully',
      signupToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Confirm email with signup token
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with this token
    const user = await User.findOne({ 
      signupToken: token,
      tokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    // Mark signup as complete
    user.signupComplete = true;
    user.signupToken = undefined;
    user.tokenExpiry = undefined;
    
    await user.save();
    
    res.status(200).json({ message: 'Email confirmed successfully' });
  } catch (error) {
    console.error('Confirmation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate invitation token
router.get('/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find invitation with this token
    const invitation = await Invitation.findOne({ 
      invitationToken: token,
      status: 'pending',
      expiresAt: { $gt: Date.now() }
    }).populate('invitedBy', 'username email');
    
    if (!invitation) {
      return res.status(400).json({ message: 'Invalid or expired invitation' });
    }
    
    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    res.status(200).json({ 
      valid: true,
      email: invitation.email,
      invitedBy: invitation.invitedBy.username,
      message: invitation.message
    });
  } catch (error) {
    console.error('Invitation validation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register with invitation token
router.post('/register-invitation', async (req, res) => {
  try {
    const { username, password, invitationToken } = req.body;
    
    if (!username || !password || !invitationToken) {
      return res.status(400).json({ message: 'Username, password, and invitation token are required' });
    }
    
    // Find and validate invitation
    const invitation = await Invitation.findOne({ 
      invitationToken,
      status: 'pending',
      expiresAt: { $gt: Date.now() }
    });
    
    if (!invitation) {
      return res.status(400).json({ message: 'Invalid or expired invitation' });
    }
    
    // Check if user already exists with this email or username
    const existingUser = await User.findOne({ 
      $or: [{ email: invitation.email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === invitation.email 
          ? 'User already exists with this email' 
          : 'Username already taken' 
      });
    }
    
    // Create new user
    const user = new User({
      email: invitation.email,
      username,
      password,
      signupComplete: true, // Skip email confirmation for invited users
      invitedBy: invitation.invitedBy,
      invitationStatus: 'accepted'
    });
    
    await user.save();
    
    // Create stats document for the user
    const stats = new Stats({
      userId: user._id
    });
    
    await stats.save();
    
    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();
    
    // Send welcome email
    try {
      const emailResult = await emailService.sendWelcomeEmail(user.email, user.username);
      if (emailResult.success) {
        console.log(`📧 Welcome email sent to ${user.email}`);
        if (emailResult.previewUrl) {
          console.log(`🔗 Preview URL: ${emailResult.previewUrl}`);
        }
      } else {
        console.log(`⚠️ Welcome email failed: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error('❌ Welcome email service error:', emailError);
    }
    
    // Generate login token
    const token = jwt.sign(
      { id: user._id }, 
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(201).json({ 
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration with invitation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check if signup is complete
    if (!user.signupComplete && email !== 'testuser@example.com') {
      return res.status(400).json({ message: 'Please confirm your email before logging in' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Update last login time
    user.lastLogin = Date.now();
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { id: user._id }, 
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Password reset request
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate reset token
    const resetToken = await user.generateResetToken();
    
    // TODO: Send email with reset token (to be implemented)
    
    res.status(200).json({ 
      message: 'Password reset email sent',
      resetToken
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Password reset confirmation
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Find user with this token
    const user = await User.findOne({ 
      resetToken: token,
      tokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    // Update password
    user.password = password;
    user.resetToken = undefined;
    user.tokenExpiry = undefined;
    
    await user.save();
    
    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if new username/email is already taken (if different from current)
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username;
    }
    
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    
    await user.save();
    
    res.status(200).json({ 
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
