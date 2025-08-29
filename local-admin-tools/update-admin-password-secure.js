require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const connectDB = require('./config/db');
const User = require('./models/User');

// Create readline interface for secure password input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to hide password input
function hideInput(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let password = '';
    
    stdin.on('data', function(char) {
      char = char + '';
      
      switch(char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          console.log('\nPassword update cancelled.');
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    });
  });
}

async function updateAdminPassword() {
  try {
    await connectDB();
    
    console.log('🔐 Secure Admin Password Update');
    console.log('================================');
    
    // Find the admin user
    const user = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
    if (!user) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    console.log(`👤 Found admin user: ${user.email}`);
    console.log('');
    
    // Get new password
    const newPassword = await hideInput('Enter new admin password: ');
    
    if (newPassword.length < 8) {
      console.log('❌ Password must be at least 8 characters long');
      process.exit(1);
    }
    
    // Confirm password
    const confirmPassword = await hideInput('Confirm new password: ');
    
    if (newPassword !== confirmPassword) {
      console.log('❌ Passwords do not match');
      process.exit(1);
    }
    
    console.log('');
    console.log('🔒 Updating password...');
    
    // Hash the new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update the user
    user.password = hashedPassword;
    await user.save();
    
    console.log('✅ Admin password updated successfully!');
    console.log('');
    console.log('📋 Updated admin credentials:');
    console.log(`   Email: ${user.email}`);
    console.log('   Password: [HIDDEN FOR SECURITY]');
    console.log('');
    console.log('💡 You can now log in with your new password');
    
  } catch (error) {
    console.error('❌ Error updating password:', error);
  } finally {
    rl.close();
    mongoose.disconnect();
    process.exit(0);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n❌ Password update cancelled.');
  rl.close();
  mongoose.disconnect();
  process.exit(0);
});

console.log('Starting admin password update...');
updateAdminPassword();
