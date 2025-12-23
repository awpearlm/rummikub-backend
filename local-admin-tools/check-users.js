// LOCAL ONLY - Check what users exist
require('dotenv').config();
const mongoose = require('mongoose');

async function checkUsers() {
    try {
        console.log('🔍 Checking existing users...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
        console.log('✅ Connected to MongoDB');
        
        const User = require('../models/User');
        
        const users = await User.find({}, 'email username isAdmin createdAt').lean();
        
        if (users.length === 0) {
            console.log('❌ No users found in database');
        } else {
            console.log(`📊 Found ${users.length} users:`);
            users.forEach((user, index) => {
                console.log(`${index + 1}. Email: ${user.email}`);
                console.log(`   Username: ${user.username || 'N/A'}`);
                console.log(`   Admin: ${user.isAdmin ? 'YES' : 'NO'}`);
                console.log(`   Created: ${user.createdAt}`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkUsers();
