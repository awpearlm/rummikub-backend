// Simple password reset - LOCAL ONLY
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

function askPassword() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question('Enter new admin password: ', (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function resetAdminPassword() {
    try {
        console.log('🔐 Quick Admin Password Reset');
        console.log('=============================');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
        console.log('✅ Connected to database');
        
        const User = require('./models/User');
        
        const admin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        if (!admin) {
            console.log('❌ Admin user not found');
            return;
        }
        
        console.log(`👤 Found admin: ${admin.email}`);
        console.log(`📅 Last login: ${admin.lastLogin}`);
        
        const newPassword = await askPassword();
        
        if (!newPassword || newPassword.length < 3) {
            console.log('❌ Password too short');
            return;
        }
        
        // Hash and save new password
        console.log('🔒 Updating password...');
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        admin.password = hashedPassword;
        await admin.save();
        
        console.log('✅ Password updated successfully!');
        console.log('');
        console.log('🎯 Test at: https://jkube.netlify.app/admin.html');
        console.log(`📧 Email: ${admin.email}`);
        console.log('🔐 Password: [your new password]');
        
        // Test the new password immediately
        const testMatch = await bcrypt.compare(newPassword, hashedPassword);
        console.log(`🧪 Password test: ${testMatch ? '✅ Working' : '❌ Failed'}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetAdminPassword();
