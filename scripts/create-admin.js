require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const connectDB = require('../config/db');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to MongoDB
connectDB();

// Import User model
const User = require('../models/User');

// Function to prompt user for input
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdminUser() {
  try {
    console.log('=== Create Admin User ===');
    
    // Get user input
    const email = await question('Enter admin email: ');
    const username = await question('Enter admin username: ');
    const password = await question('Enter admin password: ');
    
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
          const confirm = await question('Do you want to promote this user to admin? (y/n): ');
          if (confirm.toLowerCase() === 'y') {
            existingUser.isAdmin = true;
            await existingUser.save();
            console.log('User has been promoted to admin successfully.');
          }
        }
      } else {
        console.log('\nA user with this username already exists. Please choose a different username.');
      }
      
      rl.close();
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
    
    rl.close();
  } catch (error) {
    console.error('Error creating admin user:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the function
createAdminUser().then(() => {
  // Disconnect from MongoDB after completion
  setTimeout(() => {
    mongoose.disconnect();
    process.exit(0);
  }, 1000);
});
