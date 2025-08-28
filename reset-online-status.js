require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

connectDB();

async function resetAllOnlineStatus() {
  try {
    console.log('Resetting all users online status to false...');
    
    const result = await User.updateMany(
      {},
      {
        isOnline: false,
        lastSeen: new Date()
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users to offline status`);
    
    // Show current status
    const users = await User.find({}, 'username email isOnline lastSeen').sort({ username: 1 });
    console.log('\nCurrent user status:');
    users.forEach(user => {
      console.log(`- ${user.username} (${user.email}): ${user.isOnline ? 'Online' : 'Offline'}`);
    });
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

resetAllOnlineStatus();
