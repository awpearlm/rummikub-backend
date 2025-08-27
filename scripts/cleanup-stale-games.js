require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Connect to MongoDB
connectDB();

// Import models
const Game = require('../models/Game');

async function cleanupStaleGames() {
  try {
    console.log('=== Cleaning Up Stale Games ===');
    
    // Check for aggressive cleanup flag
    const aggressive = process.argv.includes('--aggressive');
    console.log(`Cleanup mode: ${aggressive ? 'AGGRESSIVE' : 'NORMAL'}`);
    
    // Find all active games (have startTime but no endTime)
    const activeGames = await Game.find({ 
      startTime: { $exists: true }, 
      endTime: { $exists: false }
    });
    
    console.log(`Found ${activeGames.length} active games in database`);
    
    let gamesEnded = 0;
    let gamesDeleted = 0;
    
    for (const game of activeGames) {
      const gameAge = Date.now() - new Date(game.startTime).getTime();
      const hoursOld = gameAge / (1000 * 60 * 60);
      const minutesOld = gameAge / (1000 * 60);
      
      console.log(`\n--- Game ${game.gameId} ---`);
      console.log(`Created: ${game.startTime}`);
      console.log(`Age: ${hoursOld.toFixed(1)} hours (${minutesOld.toFixed(1)} minutes)`);
      console.log(`Players: ${game.players.length}`);
      console.log(`Is Bot Game: ${game.isBotGame || false}`);
      
      // Aggressive mode: end games older than 30 minutes
      // Normal mode: end games older than 1 hour
      const ageThreshold = aggressive ? 30 : 60; // minutes
      
      if (minutesOld > ageThreshold) {
        game.endTime = new Date();
        game.winner = `Game abandoned - automatic cleanup (${aggressive ? 'aggressive' : 'normal'} mode)`;
        await game.save();
        gamesEnded++;
        console.log(`✅ Ended stale game: ${game.gameId} (${minutesOld.toFixed(1)} min old)`);
      }
      
      // Delete games with invalid data (no players or empty player names)
      else if (game.players.length === 0 || 
               !game.players[0].name || 
               game.players[0].name === 'undefined') {
        await Game.deleteOne({ _id: game._id });
        gamesDeleted++;
        console.log(`🗑️ Deleted invalid game: ${game.gameId}`);
      }
      
      else {
        console.log(`⏳ Keeping recent game: ${game.gameId}`);
      }
    }
    
    console.log(`\n=== Cleanup Summary ===`);
    console.log(`Games ended: ${gamesEnded}`);
    console.log(`Games deleted: ${gamesDeleted}`);
    console.log(`Total cleaned: ${gamesEnded + gamesDeleted}`);
    
    if (aggressive) {
      console.log('\n💡 Tip: Run without --aggressive flag for normal cleanup (1 hour threshold)');
    } else {
      console.log('\n💡 Tip: Run with --aggressive flag to clean games older than 30 minutes');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error cleaning up stale games:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the cleanup
cleanupStaleGames();
