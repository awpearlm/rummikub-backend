const mongoose = require('mongoose');

const StatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  gamesWon: {
    type: Number,
    default: 0
  },
  winPercentage: {
    type: Number,
    default: 0
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  highestScore: {
    type: Number,
    default: 0
  },
  avgPointsPerGame: {
    type: Number,
    default: 0
  },
  totalPlayTime: {
    type: Number, // in minutes
    default: 0
  },
  // Track bot games separately (not included in the main stats)
  botGamesPlayed: {
    type: Number,
    default: 0
  },
  botGamesWon: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Method to update stats after a multiplayer game
StatsSchema.methods.updateAfterGame = function(won, points, playTime) {
  this.gamesPlayed += 1;
  if (won) this.gamesWon += 1;
  
  this.winPercentage = (this.gamesWon / this.gamesPlayed) * 100;
  this.totalPoints += points;
  this.totalPlayTime += playTime;
  this.avgPointsPerGame = this.totalPoints / this.gamesPlayed;
  
  if (points > this.highestScore) {
    this.highestScore = points;
  }
  
  this.lastUpdated = Date.now();
};

// Method to track bot games (for future reference)
StatsSchema.methods.trackBotGame = function(won) {
  this.botGamesPlayed += 1;
  if (won) this.botGamesWon += 1;
  this.lastUpdated = Date.now();
};

module.exports = mongoose.model('Stats', StatsSchema);
