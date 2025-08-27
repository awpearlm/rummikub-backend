require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Connect to MongoDB
connectDB();

// Import User model
const User = require('../models/User');
const Stats = require('../models/Stats');

async function createSecondTestUser() {
  try {
    console.log('=== Creating Second Test User for Multiplayer Testing ===');
    
    // Second test user details
    const email = 'testuser2@example.com';
    const username = 'testuser2';
    const password = 'password123';
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      console.log('\nSecond test user already exists!');
      console.log('Details:');
      console.log(`Email: ${existingUser.email}`);
      console.log(`Username: ${existingUser.username}`);
      console.log(`Is Admin: ${existingUser.isAdmin ? 'Yes' : 'No'}`);
      console.log('\nYou can use these credentials for multiplayer testing.');
      
      mongoose.disconnect();
      return;
    }
    
    // Create salt & hash password - Let the User model handle this automatically
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new test user with plain password (model will hash it)
    const newUser = new User({
      email,
      username,
      password: password, // Pass plain password, let model hash it
      isAdmin: false, // Non-admin user
      signupComplete: true // Skip email verification for testing
    });
    
    await newUser.save();
    
    // Create stats document for the user
    const stats = new Stats({
      userId: newUser._id,
      gamesPlayed: 0,
      gamesWon: 0,
      winPercentage: 0,
      totalPoints: 0,
      highestScore: 0,
      avgPointsPerGame: 0,
      totalPlayTime: 0
    });
    
    await stats.save();
    
    console.log('\nSecond test user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('\n=== Multiplayer Testing Setup ===');
    console.log('You now have two test users for multiplayer testing:');
    console.log('1. testuser@example.com / testuser / password123');
    console.log('2. testuser2@example.com / testuser2 / password123');
    console.log('\nOpen two browser windows/tabs and log in with different users to test multiplayer functionality!');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error creating second test user:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the function
createSecondTestUser();
