require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('Connection string (masked):', process.env.MONGO_URI.replace(/:([^:@]+)@/, ':****@'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
    console.log('Your remote database is working correctly.');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Connection error:', err.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Check if you replaced <username> and <password> with your actual credentials');
    console.log('2. Ensure your IP address is whitelisted in the Network Access settings');
    console.log('3. Verify your database user has the correct permissions');
  });
