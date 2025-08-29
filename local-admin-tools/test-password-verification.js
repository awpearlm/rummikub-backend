// Test password verification
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

async function testPassword() {
    try {
        console.log('🔐 Password Verification Test');
        console.log('============================');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
        const User = require('./models/User');
        
        const admin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        if (!admin) {
            console.log('❌ Admin user not found');
            return;
        }
        
        console.log('👤 Found admin:', admin.email);
        console.log('🔒 Stored hash:', admin.password);
        console.log('');
        
        // Test the passwords you might be using
        const testPasswords = [
            'j1ll14nm3',
            'jillianme', 
            'admin123',
            'jill14nm3'
        ];
        
        for (const testPass of testPasswords) {
            const isMatch = await bcrypt.compare(testPass, admin.password);
            console.log(`🔑 Testing "${testPass}": ${isMatch ? '✅ MATCH' : '❌ No match'}`);
        }
        
        console.log('');
        console.log('💡 If none match, you can update the password using the reset script');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testPassword();
