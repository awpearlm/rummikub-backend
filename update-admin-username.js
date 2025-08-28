require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

connectDB();

async function updateAdminUsername() {
  try {
    const user = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
    if (!user) {
      console.log('Admin user not found');
      return;
    }
    
    console.log('Current username:', user.username);
    console.log('Updating username to: admin_1');
    
    // Check if admin_1 username is already taken
    const existingUser = await User.findOne({ username: 'admin_1' });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      console.log('Username admin_1 is already taken by another user');
      return;
    }
    
    // Update username
    user.username = 'admin_1';
    await user.save();
    
    console.log('Username updated successfully!');
    console.log('\nUpdated admin credentials:');
    console.log('Email: pearlman.aaron@gmail.com');
    console.log('Username: admin_1');
    console.log('Password: admin123');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

updateAdminUsername();
