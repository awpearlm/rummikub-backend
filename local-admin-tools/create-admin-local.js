// LOCAL ONLY - Create admin user
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

function askQuestion(question) {
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

async function createAdmin() {
    try {
        console.log('👤 Create Admin User');
        console.log('===================');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/j_kube');
        console.log('✅ Connected to MongoDB');
        
        const User = require('../models/User');
        
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'pearlman.aaron@gmail.com' });
        if (existingAdmin) {
            console.log('✅ Admin user already exists!');
            console.log(`📧 Email: ${existingAdmin.email}`);
            console.log(`👤 Username: ${existingAdmin.username}`);
            console.log('Use the password reset script instead.');
            process.exit(0);
        }
        
        // Get details
        const email = 'pearlman.aaron@gmail.com';
        const username = await askQuestion('Enter admin username: ');
        const password = await askQuestion('Enter admin password: ');
        
        if (!username || !password || password.length < 6) {
            console.log('❌ Invalid input. Username and password (6+ chars) required.');
            process.exit(1);
        }
        
        // Hash password
        console.log('🔒 Creating admin user...');
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create admin user
        const adminUser = new User({
            email,
            username,
            password: hashedPassword,
            isAdmin: true,
            signupComplete: true  // Allow immediate login
        });
        
        await adminUser.save();
        
        console.log('✅ Admin user created successfully!');
        console.log('');
        console.log('🎯 Login at: https://jkube.netlify.app/admin.html');
        console.log(`📧 Email: ${email}`);
        console.log(`👤 Username: ${username}`);
        console.log('🔐 Password: [your password]');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createAdmin();
