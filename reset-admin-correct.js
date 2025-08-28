require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

connectDB();

async function resetAdminPasswordCorrectly() {
  try {
    const user = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Resetting password for admin user:', user.email);
    
    // Set new password as plain text - the pre-save hook will hash it
    user.password = 'admin123';
    await user.save();
    
    console.log('Password has been reset successfully!');
    console.log('Testing new password...');
    
    // Test the password
    const isMatch = await user.comparePassword('admin123');
    console.log('Password test result:', isMatch ? 'SUCCESS' : 'FAILED');
    
    console.log('\nLogin credentials:');
    console.log('Email: pearlman.aaron@gmail.com');
    console.log('Password: admin123');
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

resetAdminPasswordCorrectly();
