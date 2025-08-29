// Set password correctly with model middleware
require('dotenv').config();
const mongoose = require('mongoose');

async function setPasswordCorrectly() {
    try {
        console.log('🔐 Correct Password Reset');
        console.log('=========================');
        
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const User = require('../models/User');
        
        const admin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        if (!admin) {
            console.log('❌ Admin not found');
            return;
        }
        
        console.log('👤 Found admin:', admin.email);
        console.log('🔒 Current hash:', admin.password.substring(0, 20) + '...');
        
        // Set PLAIN TEXT password - let the model hash it
        const newPassword = 'j1ll14nm3';
        console.log('🔧 Setting plain text password:', newPassword);
        
        admin.password = newPassword; // Plain text - model will hash it
        await admin.save(); // This triggers the pre('save') middleware
        
        console.log('💾 Password saved (model auto-hashed it)');
        
        // Test the password
        const updatedAdmin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        console.log('🔒 New hash:', updatedAdmin.password.substring(0, 20) + '...');
        
        // Test using the model's comparePassword method
        const isMatch = await updatedAdmin.comparePassword(newPassword);
        console.log('🧪 Password test:', isMatch ? '✅ SUCCESS!' : '❌ FAILED');
        
        if (isMatch) {
            console.log('');
            console.log('🎉 Password reset successful!');
            console.log('🎯 Try logging in at: https://jkube.netlify.app/admin.html');
            console.log(`📧 Email: ${admin.email}`);
            console.log(`🔐 Password: ${newPassword}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

setPasswordCorrectly();
