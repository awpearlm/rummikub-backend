require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

connectDB();

async function resetAdminPassword() {
  try {
    const user = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Resetting password for admin user:', user.email);
    
    // Set new password
    const newPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    await user.save();
    
    console.log('Password has been reset successfully!');
    console.log('New login credentials:');
    console.log('Email:', user.email);
    console.log('Password:', newPassword);
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

resetAdminPassword();
