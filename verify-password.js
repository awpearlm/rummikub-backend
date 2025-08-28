require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

connectDB();

async function verifyPassword() {
  try {
    const user = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Testing admin123 password...');
    const isMatch = await bcrypt.compare('admin123', user.password);
    console.log('Password verification:', isMatch ? 'SUCCESS' : 'FAILED');
    
    console.log('User details:');
    console.log('- Email:', user.email);
    console.log('- Username:', user.username);
    console.log('- IsAdmin:', user.isAdmin);
    console.log('- SignupComplete:', user.signupComplete);
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

verifyPassword();
