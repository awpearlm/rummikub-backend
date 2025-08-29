// Debug password setting process
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function debugPassword() {
    try {
        console.log('🔍 Password Debug Process');
        console.log('========================');
        
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const User = require('../models/User');
        
        const admin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        console.log('👤 Current admin found');
        console.log('🔒 Current hash:', admin.password);
        
        // Test the password we think we set
        const testPassword = 'j1ll14nm3';
        console.log('🧪 Testing password:', testPassword);
        
        const isMatch = await bcrypt.compare(testPassword, admin.password);
        console.log('🔑 Password match:', isMatch ? '✅ YES' : '❌ NO');
        
        if (!isMatch) {
            console.log('');
            console.log('🔧 Setting password manually...');
            
            // Hash the password properly
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(testPassword, salt);
            
            console.log('🔒 New hash will be:', hashedPassword);
            
            // Update the password
            admin.password = hashedPassword;
            await admin.save();
            
            console.log('💾 Password saved');
            
            // Test immediately
            const newUser = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
            const immediateTest = await bcrypt.compare(testPassword, newUser.password);
            
            console.log('🧪 Immediate test:', immediateTest ? '✅ SUCCESS' : '❌ FAILED');
            console.log('🔒 Final hash:', newUser.password);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

debugPassword();
