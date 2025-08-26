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

  // [KEEP ALL EXISTING SOCKET HANDLERS HERE]
  // This is where the original socket.io handlers would be
  
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

// Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
