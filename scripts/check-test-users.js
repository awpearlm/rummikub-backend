require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Connect to MongoDB
connectDB();

// Import User model
const User = require('../models/User');

async function checkUsers() {
  try {
    console.log('=== Checking All Test Users ===');
    
    // Find all test users
    const testUsers = await User.find({ 
      email: { $in: ['testuser@example.com', 'testuser2@example.com'] }
    });
    
    console.log(`Found ${testUsers.length} test users:`);
    
    for (const user of testUsers) {
      console.log(`\n--- ${user.email} ---`);
      console.log(`Username: ${user.username}`);
      console.log(`SignupComplete: ${user.signupComplete}`);
      console.log(`IsAdmin: ${user.isAdmin}`);
      console.log(`CreatedAt: ${user.createdAt}`);
      console.log(`Password hash: ${user.password.substring(0, 20)}...`);
      
      // Test password
      const testPassword = 'password123';
      const isMatch = await user.comparePassword(testPassword);
      console.log(`Password test (${testPassword}): ${isMatch ? 'PASS' : 'FAIL'}`);
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error checking users:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the function
checkUsers();
