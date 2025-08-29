// LOCAL ONLY - DO NOT COMMIT TO REPO
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

// Simple password input function
function askPassword(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function resetPassword() {
    try {
        console.log('🔐 Local Admin Password Reset');
        console.log('============================');
        
        // Connect to MongoDB
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
        console.log('✅ Connected to MongoDB');
        
        // Import User model after connection
        const User = require('./models/User');
        
        // Find admin user
        const adminUser = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        if (!adminUser) {
            console.log('❌ Admin user not found');
            process.exit(1);
        }
        
        console.log(`👤 Found admin: ${adminUser.email}`);
        console.log(`📅 Last updated: ${adminUser.updatedAt}`);
        
        // Get new password
        const newPassword = await askPassword('\n🔑 Enter new admin password: ');
        
        if (!newPassword || newPassword.length < 6) {
            console.log('❌ Password must be at least 6 characters');
            process.exit(1);
        }
        
        // Hash password
        console.log('🔒 Hashing password...');
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password
        adminUser.password = hashedPassword;
        await adminUser.save();
        
        console.log('✅ Password updated successfully!');
        console.log('');
        console.log('🎯 Test your new password at: https://jkube.netlify.app/admin.html');
        console.log(`📧 Email: ${adminUser.email}`);
        console.log('🔐 Password: [your new password]');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
        process.exit(0);
    }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n❌ Cancelled by user');
    await mongoose.disconnect();
    process.exit(0);
});

resetPassword();
