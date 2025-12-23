const mongoose = require('mongoose');

// Import all models to ensure they're registered
const User = require('../models/User');
const Game = require('../models/Game');
const Stats = require('../models/Stats');

// Database initialization and index creation
const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing database collections and indexes...');
    
    // Ensure indexes are created for all models
    await User.createIndexes();
    console.log('✅ User collection indexes created');
    
    await Game.createIndexes();
    console.log('✅ Game collection indexes created');
    
    await Stats.createIndexes();
    console.log('✅ Stats collection indexes created');
    
    // Create any additional custom indexes
    await createCustomIndexes();
    
    console.log('✅ Database initialization complete');
    return true;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
};

// Create custom indexes for performance
const createCustomIndexes = async () => {
  try {
    // Game collection indexes for performance
    await mongoose.connection.db.collection('games').createIndex(
      { gameId: 1 }, 
      { unique: true, background: true }
    );
    
    await mongoose.connection.db.collection('games').createIndex(
      { startTime: 1 }, 
      { background: true }
    );
    
    await mongoose.connection.db.collection('games').createIndex(
      { endTime: 1 }, 
      { background: true, sparse: true }
    );
    
    // User collection indexes
    await mongoose.connection.db.collection('users').createIndex(
      { email: 1 }, 
      { unique: true, background: true }
    );
    
    await mongoose.connection.db.collection('users').createIndex(
      { username: 1 }, 
      { unique: true, background: true }
    );
    
    await mongoose.connection.db.collection('users').createIndex(
      { lastLogin: 1 }, 
      { background: true }
    );
    
    // Stats collection indexes
    await mongoose.connection.db.collection('stats').createIndex(
      { userId: 1 }, 
      { unique: true, background: true }
    );
    
    console.log('✅ Custom indexes created successfully');
    
  } catch (error) {
    // Don't fail if indexes already exist
    if (error.code === 11000 || error.message.includes('already exists')) {
      console.log('ℹ️  Indexes already exist, skipping creation');
    } else {
      console.warn('⚠️  Warning creating custom indexes:', error.message);
    }
  }
};

// Check database health
const checkDatabaseHealth = async () => {
  try {
    // Check connection
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();
    
    // Get database stats
    const stats = await mongoose.connection.db.stats();
    
    console.log('📊 Database Health Check:');
    console.log(`   Status: ${result.ok ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   Collections: ${stats.collections}`);
    console.log(`   Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Index Size: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    
    return result.ok === 1;
    
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
};

module.exports = {
  initializeDatabase,
  createCustomIndexes,
  checkDatabaseHealth
};