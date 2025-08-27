require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Connect to MongoDB
connectDB();

// Import User model
const User = require('../models/User');

async function createTestUser() {
  try {
    console.log('=== Creating Test User ===');
    
    // Test user details
    const email = 'testuser@example.com';
    const username = 'testuser';
    const password = 'password123';
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      console.log('\nA test user already exists with this email or username.');
      console.log('Details:');
      console.log(`Email: ${existingUser.email}`);
      console.log(`Username: ${existingUser.username}`);
      console.log(`Is Admin: ${existingUser.isAdmin ? 'Yes' : 'No'}`);
      console.log('\nYou can use these credentials for testing.');
      
      mongoose.disconnect();
      return;
    }
    
    // Create salt & hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new test user
    const newUser = new User({
      email,
      username,
      password: hashedPassword,
      isAdmin: false, // Non-admin user
      signupComplete: true // Skip email verification for testing
    });
    
    await newUser.save();
    
    console.log('\nTest user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('You can now log in with these credentials for testing.');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error creating test user:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the function
createTestUser();
