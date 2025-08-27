const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const statsRoutes = require('./routes/stats');
const gamesRoutes = require('./routes/games');

// Import models
const User = require('./models/User');
const Stats = require('./models/Stats');
const Game = require('./models/Game');

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure CORS for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000', 
  'http://127.0.0.1:3000',
  'https://jkube.netlify.app',
  'https://*.netlify.app'
];

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow all in development
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      
      // In production, allow specified origins or Netlify domains
      if (!origin || allowedOrigins.includes(origin) || origin.match(/\.netlify\.app$/)) {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security and middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    
    // In production, check against our allowed origins
    if (allowedOrigins.includes(origin) || origin.match(/\.netlify\.app$/)) {
      return callback(null, true);
    }
    
    // If not allowed
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'netlify-build')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/games', gamesRoutes);

// Game state management
const games = new Map();
const players = new Map();

// Rummikub game logic
class RummikubGame {
  // [KEEP ALL EXISTING GAME LOGIC HERE]
  // This is where the original RummikubGame class would be
}

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    // If no token, allow connection but track as guest
    if (!token) {
      socket.user = { isGuest: true };
      return next();
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by id
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      socket.user = { isGuest: true };
      return next();
    }
    
    // Set user in socket
    socket.user = {
      id: user._id,
      username: user.username,
      isAdmin: user.isAdmin,
      isGuest: false
    };
    
    next();
  } catch (error) {
    // Allow connection even with invalid token, but as guest
    socket.user = { isGuest: true };
    next();
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id, socket.user?.isGuest ? '(Guest)' : `(${socket.user.username})`);

  // [ORIGINAL SOCKET HANDLERS FROM SERVER.JS]
  socket.on('createGame', (data) => {
    const gameId = generateGameId();
    const game = new RummikubGame(gameId);
    
    // Set debug mode flag if provided
    game.isDebugMode = data.isDebugMode || false;
    
    // Set timer option if provided
    game.timerEnabled = data.timerEnabled || false;
    
    if (game.addPlayer(socket.id, data.playerName)) {
      games.set(gameId, game);
      players.set(socket.id, { 
        gameId, 
        playerName: data.playerName,
        isDebugEnabled: data.isDebugMode || false
      });
      
      socket.join(gameId);
      socket.emit('gameCreated', { gameId, gameState: game.getGameState(socket.id) });
      
      console.log(`Game created: ${gameId} by ${data.playerName}, debug mode: ${game.isDebugMode}`);
    } else {
      socket.emit('error', { message: 'Failed to create game' });
    }
  });

  socket.on('createBotGame', (data) => {
    const gameId = generateGameId();
    const botCount = data.botCount || 1; // Default to 1 bot if not specified
    const game = new RummikubGame(gameId, true, data.difficulty);
    
    if (game.addPlayer(socket.id, data.playerName)) {
      // Add the specified number of bot players
      const addedBots = [];
      for (let i = 0; i < botCount; i++) {
        const bot = game.addBotPlayer();
        if (bot) {
          addedBots.push(bot);
          console.log(`Successfully added bot ${i + 1}/${botCount}: ${bot.name}`);
        } else {
          console.log(`Failed to add bot ${i + 1}/${botCount}`);
          break;
        }
      }
      
      console.log(`Total players in game: ${game.players.length} (1 human + ${addedBots.length} bots)`);
      
      games.set(gameId, game);
      players.set(socket.id, { gameId, playerName: data.playerName });
      
      socket.join(gameId);
      
      // Auto-start bot game
      if (game.startGame()) {
        socket.emit('botGameCreated', { gameId, gameState: game.getGameState(socket.id) });
        
        // Add welcome message from bots
        const botNames = addedBots.map(bot => bot.name);
        if (addedBots.length === 1) {
          game.addChatMessage('bot', `Hello ${data.playerName}! I'm ready to play. Good luck! 🤖`);
        } else {
          game.addChatMessage('bot', `Hello ${data.playerName}! We're ${botNames.join(', ')} and we're ready to play. Good luck! 🤖`);
        }
        
        // Only start bot moves if it's the bot's turn
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer && currentPlayer.isBot) {
          game.scheduleNextBotMove(io, gameId, 5000);
        }
        
        console.log(`Bot game created: ${gameId} by ${data.playerName} vs ${botNames.join(', ')} (${addedBots.length} bots)`);
      }
    } else {
      socket.emit('error', { message: 'Failed to create bot game' });
    }
  });

  socket.on('joinGame', (data) => {
    const game = games.get(data.gameId);
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.addPlayer(socket.id, data.playerName)) {
      players.set(socket.id, { gameId: data.gameId, playerName: data.playerName });
      
      socket.join(data.gameId);
      socket.emit('gameJoined', { gameId: data.gameId, gameState: game.getGameState(socket.id) });
      
      // Notify all players in the game
      io.to(data.gameId).emit('playerJoined', {
        playerName: data.playerName,
        gameState: game.getGameState(socket.id)
      });
      
      console.log(`${data.playerName} joined game: ${data.gameId}`);
    } else {
      socket.emit('error', { message: 'Game is full or failed to join' });
    }
  });

  socket.on('getGameState', (data) => {
    console.log(`Player ${socket.id} requesting game state for game: ${data.gameId}`);
    const game = games.get(data.gameId);
    
    if (!game) {
      console.log(`Game not found for state request: ${data.gameId}`);
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    socket.emit('gameStateUpdate', { gameState: game.getGameState(socket.id) });
    console.log(`Game state sent to player ${socket.id} for game ${data.gameId}`);
  });

  socket.on('startGame', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    if (game.startGame()) {
      // Send personalized game state to each player
      game.players.forEach(player => {
        io.to(player.id).emit('gameStarted', {
          gameState: game.getGameState(player.id)
        });
      });
      
      console.log(`Game started: ${playerData.gameId}`);
    } else {
      socket.emit('error', { message: 'Cannot start game (need at least 2 players)' });
    }
  });

  socket.on('playSet', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Check if this is multiple sets for initial play
    if (Array.isArray(data.setArrays)) {
      const result = game.playMultipleSets(socket.id, data.setArrays);
      if (result && result.success) {
        // Send individual game states to each player
        game.players.forEach(player => {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit('setPlayed', {
              gameState: game.getGameState(player.id)
            });
          }
        });
        
        if (game.winner) {
          io.to(playerData.gameId).emit('gameWon', {
            winner: game.winner,
            gameState: game.getGameState(socket.id)
          });
          return;
        }
      } else {
        socket.emit('error', { message: 'Invalid sets or insufficient points for initial play' });
      }
    } else {
      // Single set play (existing logic)
      if (game.playSet(socket.id, data.tileIds, data.setIndex)) {
        // Send individual game states to each player
        game.players.forEach(player => {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit('setPlayed', {
              gameState: game.getGameState(player.id)
            });
          }
        });
        
        if (game.winner) {
          io.to(playerData.gameId).emit('gameWon', {
            winner: game.winner,
            gameState: game.getGameState(socket.id)
          });
          return;
        }
        
        // Human players continue their turn after playing a set
        // They must manually end their turn
      } else {
        socket.emit('error', { message: 'Invalid set' });
      }
    }
  });

  socket.on('drawTile', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    const tile = game.drawTile(socket.id);
    if (tile) {
      // Clear the current timer before changing turns
      game.clearTurnTimer();
      
      // Always advance turn after drawing a tile (this ends the player's turn)
      game.nextTurn();
      
      // Send individual game states to each player
      game.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.emit('tileDrawn', {
            gameState: game.getGameState(player.id),
            currentPlayerId: game.getCurrentPlayer()?.id,
            isYourTurn: player.id === game.getCurrentPlayer()?.id
          });
        }
      });
      
      // Trigger bot move if it's a bot game and next player is bot
      const nextPlayer = game.getCurrentPlayer();
      if (game.isBotGame && nextPlayer && nextPlayer.isBot) {
        console.log(`👤➡️🤖 Human drew tile, triggering bot move for ${nextPlayer.name}`);
        game.scheduleNextBotMove(io, playerData.gameId, 4000);
      } else {
        console.log(`👤 Human drew tile, next player: ${nextPlayer?.name} (isBot: ${nextPlayer?.isBot})`);
      }
    } else {
      socket.emit('error', { message: 'No tiles left to draw' });
    }
  });

  socket.on('endTurn', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Only allow human players to manually end their turn
    const currentPlayer = game.getCurrentPlayer();
    if (!currentPlayer.isBot) {
      // Validate board state before ending turn - strict validation with isEndTurn=true
      const validation = game.validateBoardState(true);
      if (!validation.valid) {
        socket.emit('error', { 
          message: `Cannot end turn - board has invalid sets. Check set ${validation.invalidSetIndex + 1}.`,
          invalidSetIndex: validation.invalidSetIndex 
        });
        return;
      }
      
      // Reset any turn-specific flags
      currentPlayer.hasManipulatedJoker = false;
      
      // Clear the current timer before changing turns
      game.clearTurnTimer();
      
      game.nextTurn();
      
      // Send individual game states to each player
      game.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          // Send a more detailed turnEnded event with the current player info
          playerSocket.emit('turnEnded', {
            gameState: game.getGameState(player.id),
            currentPlayerId: game.getCurrentPlayer()?.id,
            isYourTurn: player.id === game.getCurrentPlayer()?.id
          });
        }
      });
      
      // Trigger bot move if it's a bot game and we just advanced to bot
      if (game.isBotGame) {
        console.log(`👤➡️🤖 Human ended turn, triggering bot move`);
        game.scheduleNextBotMove(io, playerData.gameId, 4000);
      }
    }
  });

  socket.on('sendMessage', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    game.addChatMessage(socket.id, data.message);
    io.to(playerData.gameId).emit('messageReceived', {
      chatMessages: game.chatMessages
    });
  });

  socket.on('disconnect', () => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.gameId);
      if (game) {
        game.removePlayer(socket.id);
        
        // If it's a bot game and a human player disconnects, terminate the game immediately
        if (game.isBotGame && !socket.id.startsWith('bot_')) {
          console.log(`Human player left bot game ${playerData.gameId}, terminating game`);
          games.delete(playerData.gameId);
        } else {
          // For multiplayer games, notify other players
          io.to(playerData.gameId).emit('playerLeft', {
            playerName: playerData.playerName,
            gameState: game.getGameState(socket.id)
          });
          
          // Clean up empty games
          if (game.players.length === 0) {
            games.delete(playerData.gameId);
          }
        }
      }
      
      players.delete(socket.id);
      console.log(`Player disconnected: ${playerData.playerName}`);
    }
  });

  // Additional handlers for authenticated users
  
  // Get user profile
  socket.on('getUserProfile', async () => {
    if (socket.user.isGuest) {
      socket.emit('userProfileData', { isGuest: true });
      return;
    }
    
    try {
      // Get user stats
      const stats = await Stats.findOne({ userId: socket.user.id });
      
      // Get recent games
      const recentGames = await Game.find({ 
        'players.userId': socket.user.id 
      }).sort({ endTime: -1 }).limit(5);
      
      socket.emit('userProfileData', {
        user: {
          username: socket.user.username,
          isAdmin: socket.user.isAdmin,
          isGuest: false
        },
        stats: stats || {},
        recentGames
      });
    } catch (error) {
      console.error('Get user profile error:', error);
      socket.emit('error', { message: 'Failed to get user profile' });
    }
  });
  
  // Record game result
  socket.on('recordGameResult', async (data) => {
    if (socket.user.isGuest) return;
    
    try {
      const { gameId, won, points, playTime, isBotGame } = data;
      
      // Get the game record
      const game = await Game.findOne({ gameId });
      
      // Check if this is a bot game, either from data or from game record
      const isComputerGame = isBotGame || (game && game.isBotGame);
      
      // Only update stats for multiplayer games (not bot games)
      if (!isComputerGame) {
        console.log(`Recording stats for multiplayer game ${gameId}`);
        
        // Update stats
        const stats = await Stats.findOne({ userId: socket.user.id });
        
        if (stats) {
          stats.updateAfterGame(won, points, playTime);
          await stats.save();
        } else {
          const newStats = new Stats({
            userId: socket.user.id,
            gamesPlayed: 1,
            gamesWon: won ? 1 : 0,
            winPercentage: won ? 100 : 0,
            totalPoints: points,
            highestScore: points,
            avgPointsPerGame: points,
            totalPlayTime: playTime
          });
          
          await newStats.save();
        }
      } else {
        console.log(`Skipping stats update for bot game ${gameId}`);
      }
      
      // Always store the game record, whether it's a bot game or not
      if (game) {
        // Update the player record with user ID
        const playerIndex = game.players.findIndex(p => p.name === socket.id || p.name === data.playerName);
        
        if (playerIndex !== -1) {
          game.players[playerIndex].userId = socket.user.id;
        }
        
        await game.save();
      }
      
      socket.emit('gameResultRecorded', { success: true });
    } catch (error) {
      console.error('Record game result error:', error);
      socket.emit('error', { message: 'Failed to record game result' });
    }
  });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'netlify-build', 'index.html'));
});

// Helper functions
function generateGameId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
