require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0];
const username = args[1];
const password = args[2];

if (!email || !username || !password) {
  console.error('Usage: node create-prod-admin.js <email> <username> <password>');
  process.exit(1);
}

// Connect to MongoDB
connectDB();

// Import User model
const User = require('../models/User');

async function createAdminUser() {
  try {
    console.log('=== Creating Production Admin User ===');
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        console.log('\nA user with this email already exists.');
        
        // If user exists, check if they are already an admin
        if (existingUser.isAdmin) {
          console.log('This user is already an admin.');
        } else {
          // Promote to admin
          existingUser.isAdmin = true;
          await existingUser.save();
          console.log('User has been promoted to admin successfully.');
        }
      } else {
        console.log('\nA user with this username already exists. Please choose a different username.');
      }
      
      mongoose.disconnect();
      return;
    }
    
    // Create salt & hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new admin user
    const newAdmin = new User({
      email,
      username,
      password: hashedPassword,
      isAdmin: true,
      signupComplete: true // Skip email verification for admin
    });
    
    await newAdmin.save();
    
    console.log('\nAdmin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log('You can now log in with these credentials.');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error creating admin user:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the function
createAdminUser();
