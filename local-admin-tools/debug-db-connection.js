// Check database connection and verify user
require('dotenv').config();
const mongoose = require('mongoose');

async function checkConnection() {
    try {
        console.log('🔍 Database Connection Check');
        console.log('============================');
        
        // Show what URI we're using
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube';
        console.log('📡 MongoDB URI:', uri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
        
        await mongoose.connect(uri);
        console.log('✅ Connected successfully');
        
        // Check database name
        const dbName = mongoose.connection.db.databaseName;
        console.log('🗄️  Database name:', dbName);
        
        const User = require('./models/User');
        
        // Find all users
        const users = await User.find({}).lean();
        console.log(`👥 Total users found: ${users.length}`);
        
        if (users.length > 0) {
            users.forEach((user, index) => {
                console.log(`\n${index + 1}. 📧 Email: ${user.email}`);
                console.log(`   👤 Username: ${user.username || 'N/A'}`);
                console.log(`   🔐 Admin: ${user.isAdmin ? 'YES' : 'NO'}`);
                console.log(`   📅 Created: ${user.createdAt}`);
                console.log(`   🏷️  ID: ${user._id}`);
            });
        }
        
        // Check if the specific admin exists
        const admin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        if (admin) {
            console.log('\n✅ Admin user found!');
            console.log('📧 Email:', admin.email);
            console.log('👤 Username:', admin.username);
            console.log('🔐 Is Admin:', admin.isAdmin);
            console.log('🔒 Has Password:', admin.password ? 'YES' : 'NO');
            console.log('📏 Password Length:', admin.password ? admin.password.length : 0);
        } else {
            console.log('\n❌ Admin user NOT found in this database');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected');
        process.exit(0);
    }
}

checkConnection();
