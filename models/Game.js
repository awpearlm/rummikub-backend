const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String, // For non-registered players
    score: {
      type: Number,
      default: 0
    },
    isWinner: {
      type: Boolean,
      default: false
    },
    isBot: {
      type: Boolean,
      default: false
    }
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  boardState: {
    type: Array,
    default: []
  },
  winner: {
    type: String,
    default: null
  },
  gameLog: {
    type: Array,
    default: []
  },
  isBotGame: {
    type: Boolean,
    default: false
  }
});

// Method to calculate game duration
GameSchema.methods.endGame = function(winner) {
  this.endTime = Date.now();
  this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60)); // Convert to minutes
  this.winner = winner;
  
  // Set winner in players array
  if (winner) {
    this.players.forEach(player => {
      if (player.name === winner) {
        player.isWinner = true;
      }
    });
  }
};

// Method to check if this is a multiplayer game (not bot game)
GameSchema.methods.isMultiplayer = function() {
  // If isBotGame is explicitly set, use that
  if (this.isBotGame !== undefined) {
    return !this.isBotGame;
  }
  
  // Otherwise check if any players are bots
  const botPlayers = this.players.filter(player => player.isBot);
  return botPlayers.length === 0;
};

module.exports = mongoose.model('Game', GameSchema);
