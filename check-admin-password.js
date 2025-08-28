require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

connectDB();

async function checkPassword() {
  try {
    const user = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:');
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('Password hash:', user.password.substring(0, 20) + '...');
    
    // Test common passwords
    const testPasswords = ['l37m31n', 'password', 'admin', 'password123', 'admin123'];
    
    for (const testPass of testPasswords) {
      const isMatch = await bcrypt.compare(testPass, user.password);
      console.log(`Password test (${testPass}):`, isMatch ? 'PASS' : 'FAIL');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

checkPassword();
