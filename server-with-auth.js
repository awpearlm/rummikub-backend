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
  'https://feature-user-authentication--jkube.netlify.app'
];

// Helper function to check if origin is allowed
const isOriginAllowed = (origin) => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return true;
  
  // In development, allow all origins
  if (process.env.NODE_ENV !== 'production') return true;
  
  // Check if origin is in our allowed list
  if (allowedOrigins.includes(origin)) return true;
  
  // Check if origin is a Netlify domain
  if (origin.endsWith('.netlify.app')) return true;
  
  return false;
};

const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins in development mode
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security and middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// Configure CORS simply
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'netlify-build')));

// API Routes
// Middleware to add CORS headers to all API responses
app.use('/api', (req, res, next) => {
  // Set permissive CORS headers for all origins
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/games', gamesRoutes);

// Game state management
const games = new Map();
const players = new Map();

// Rummikub game logic
class RummikubGame {
  constructor(gameId, isBotGame = false, botDifficulty = 'medium') {
    this.id = gameId;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.deck = [];
    this.board = [];
    this.boardSnapshot = []; // Store board state at start of each turn
    this.timerEnabled = false; // Default to timer disabled
    this.turnTimeLimit = 120; // 2 minutes in seconds
    this.turnStartTime = null; // When the current turn started
    this.turnTimerInterval = null; // Server-side timer interval
    this.started = false;
    this.winner = null;
    this.chatMessages = [];
    this.gameLog = [];
    this.isBotGame = isBotGame;
    this.botDifficulty = botDifficulty;
    this.createdAt = Date.now(); // Add creation timestamp
    console.log(`🎮 Game ${gameId} created, isBotGame: ${isBotGame}`);
    this.initializeDeck();
  }

  initializeDeck() {
    // Create Rummikub tiles: 2 sets of numbers 1-13 in 4 colors, plus 2 jokers
    const colors = ['red', 'blue', 'yellow', 'black'];
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    
    // Clear the deck first to ensure we start fresh
    this.deck = [];
    
    // Add numbered tiles (2 of each)
    for (let set = 0; set < 2; set++) {
      for (const color of colors) {
        for (const number of numbers) {
          this.deck.push({
            id: `${color}_${number}_${set}`,
            color,
            number,
            isJoker: false
          });
        }
      }
    }
    
    // Add jokers (exactly 2 as per standard Rummikub rules)
    this.deck.push({ id: 'joker_1', color: null, number: null, isJoker: true });
    this.deck.push({ id: 'joker_2', color: null, number: null, isJoker: true });
    
    // Shuffle deck
    this.shuffleDeck();
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= 4) return false;
    
    const player = {
      id: playerId,
      name: playerName,
      hand: [],
      hasPlayedInitial: false,
      score: 0,
      isBot: false
    };
    
    this.players.push(player);
    return true;
  }

  addBotPlayer() {
    if (this.players.length >= 4) return false;
    
    const botNames = ['Dogman-do', 'Turdburg', 'Babyman', 'Bot_D'];
    const usedNames = this.players.filter(p => p.isBot).map(p => p.name);
    const availableNames = botNames.filter(name => !usedNames.includes(name));
    
    if (availableNames.length === 0) {
      console.log('No more unique bot names available');
      return false;
    }
    
    const botName = availableNames[0]; // Take the first available name
    
    const botPlayer = {
      id: 'bot_' + Math.random().toString(36).substr(2, 9),
      name: botName, // Just the clean bot name
      hand: [],
      hasPlayedInitial: false,
      score: 0,
      isBot: true
    };
    
    this.players.push(botPlayer);
    console.log(`Added bot player: ${botPlayer.name} (Total players: ${this.players.length})`);
    return botPlayer;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }
  }

  startGame() {
    if (this.players.length < 2) return false;
    
    // Deal 14 tiles to each player
    for (const player of this.players) {
      for (let i = 0; i < 14; i++) {
        if (this.deck.length > 0) {
          player.hand.push(this.deck.pop());
        }
      }
    }
    
    this.started = true;
    
    // Take initial board snapshot (empty board)
    this.takeBoardSnapshot();
    
    return true;
  }

  drawTile(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.deck.length === 0) return null;
    
    const tile = this.deck.pop();
    player.hand.push(tile);
    
    return tile;
  }

  isValidSet(tiles) {
    if (tiles.length < 3) {
      return false;
    }
    
    // Check if it's a run (consecutive numbers, same color)
    const isRun = this.isValidRun(tiles);
    if (isRun) {
      return true;
    }
    
    // Check if it's a group (same number, different colors)
    const isGroup = this.isValidGroup(tiles);
    return isGroup;
  }

  isValidRun(tiles) {
    if (tiles.length < 3) return false;
    
    // All non-joker tiles must be same color
    const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
    if (new Set(colors).size > 1) return false;
    
    // Need at least one real tile to determine color
    if (colors.length === 0) return false;
    
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    const sortedNumbers = nonJokers.map(t => t.number).sort((a, b) => a - b);
    
    // Simple case: no jokers
    if (jokerCount === 0) {
      for (let i = 1; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] !== sortedNumbers[i-1] + 1) return false;
      }
      return true;
    }
    
    // With jokers: try to find valid consecutive sequence
    const minNumber = sortedNumbers[0];
    const maxNumber = sortedNumbers[sortedNumbers.length - 1];
    const totalTiles = tiles.length;
    
    // Try starting positions from (minNumber - jokerCount) to minNumber
    for (let start = Math.max(1, minNumber - jokerCount); start <= minNumber; start++) {
      const end = start + totalTiles - 1;
      if (end > 13) continue; // Invalid range
      
      // Check if this sequence works
      let jokersNeeded = 0;
      let realTileIndex = 0;
      
      for (let pos = start; pos <= end; pos++) {
        if (realTileIndex < sortedNumbers.length && sortedNumbers[realTileIndex] === pos) {
          realTileIndex++;
        } else {
          jokersNeeded++;
        }
      }
      
      if (jokersNeeded === jokerCount && realTileIndex === sortedNumbers.length) {
        return true;
      }
    }
    
    return false;
  }

  isValidGroup(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
      return false;
    }
    
    // Enhanced joker detection that checks isJoker property, null number, or id
    const jokerCount = tiles.filter(t => {
      return t.isJoker === true || t.number === null || (t.id && t.id.toLowerCase().includes('joker'));
    }).length;
    
    // Also update nonJokers filter to use the same enhanced detection
    const nonJokers = tiles.filter(t => {
      return !(t.isJoker === true || t.number === null || (t.id && t.id.toLowerCase().includes('joker')));
    });
    
    // Need at least one real tile to determine the group number
    if (nonJokers.length === 0) {
      return false;
    }
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) {
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      return false;
    }
    
    // Check if we can form a valid group with jokers
    const targetNumber = numbers[0];
    const usedColors = new Set(colors);
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    // We need enough remaining colors for the jokers
    if (jokerCount > remainingColors.length) {
      return false;
    }
    
    // Groups can have at most 4 tiles (one of each color)
    if (nonJokers.length + jokerCount > 4) {
      return false;
    }
    
    return true;
  }

  playSet(playerId, tileIds, setIndex = null) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.getCurrentPlayer().id) {
      return false;
    }
    
    const tiles = tileIds.map(id => player.hand.find(t => t.id === id)).filter(Boolean);
    if (tiles.length !== tileIds.length) {
      return false;
    }
    
    // Normalize joker properties to ensure consistency
    tiles.forEach(tile => {
      if (tile.isJoker || tile.number === null || (tile.id && tile.id.toLowerCase().includes('joker'))) {
        // Ensure joker properties are set correctly
        tile.isJoker = true;
        tile.color = null;
        tile.number = null;
      }
    });
    
    if (!this.isValidSet(tiles)) {
      return false;
    }
    
    // Remove tiles from player's hand
    tiles.forEach(tile => {
      const index = player.hand.findIndex(t => t.id === tile.id);
      if (index !== -1) {
        player.hand.splice(index, 1);
      }
    });
    
    // Add to board
    if (setIndex !== null && this.board[setIndex]) {
      this.board[setIndex].push(...tiles);
    } else {
      this.board.push(tiles);
    }
    
    player.hasPlayedInitial = true;
    
    // Check for win
    if (player.hand.length === 0) {
      this.winner = player;
    }
    
    return true;
  }

  playMultipleSets(playerId, setArrays) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.getCurrentPlayer().id) return false;
    
    // Validate all sets first
    const validatedSets = [];
    
    for (const tileIds of setArrays) {
      const tiles = tileIds.map(id => player.hand.find(t => t.id === id)).filter(Boolean);
      if (tiles.length !== tileIds.length) {
        return false;
      }
      
      // Normalize joker properties to ensure consistency
      tiles.forEach(tile => {
        if (tile.isJoker || tile.number === null || (tile.id && tile.id.toLowerCase().includes('joker'))) {
          // Ensure joker properties are set correctly
          tile.isJoker = true;
          tile.color = null;
          tile.number = null;
        }
      });
      
      if (!this.isValidSet(tiles)) {
        return false;
      }
      
      validatedSets.push({ tiles });
    }
    
    // All sets are valid, now execute the play
    validatedSets.forEach(({ tiles }) => {
      // Remove tiles from player's hand
      tiles.forEach(tile => {
        const index = player.hand.findIndex(t => t.id === tile.id);
        if (index !== -1) {
          player.hand.splice(index, 1);
        }
      });
      
      // Add to board
      this.board.push(tiles);
    });
    
    player.hasPlayedInitial = true;
    
    // Check for win
    if (player.hand.length === 0) {
      this.winner = player;
    }
    
    return { success: true, setsPlayed: validatedSets.length };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    
    // Take a snapshot of the board state at the start of the new turn
    this.takeBoardSnapshot();
  }

  addChatMessage(playerId, message) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    
    this.chatMessages.push({
      id: Date.now(),
      playerId,
      playerName: player.name,
      message,
      timestamp: new Date().toISOString()
    });
  }

  addGameLogEntry(playerId, action, details = '') {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    
    this.gameLog.push({
      id: Date.now(),
      playerId,
      playerName: player.name,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }

  getGameState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return {
      id: this.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        handSize: p.hand.length,
        hasPlayedInitial: p.hasPlayedInitial,
        score: p.score,
        isBot: p.isBot || false
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      board: this.board,
      boardSnapshot: this.boardSnapshot,
      started: this.started,
      winner: this.winner,
      chatMessages: this.chatMessages,
      gameLog: this.gameLog,
      playerHand: player ? player.hand : [],
      deckSize: this.deck.length,
      isBotGame: this.isBotGame,
      timerEnabled: this.timerEnabled
    };
  }

  // Board management
  takeBoardSnapshot() {
    // Deep copy the current board state
    this.boardSnapshot = JSON.parse(JSON.stringify(this.board));
  }

  restoreBoardSnapshot() {
    // Restore board to snapshot state
    this.board = JSON.parse(JSON.stringify(this.boardSnapshot));
  }

  // Schedule bot moves
  scheduleNextBotMove(io, gameId, delay = 4000) {
    if (!this.isBotGame || !this.started || this.winner) return;
    
    setTimeout(() => {
      const currentPlayer = this.getCurrentPlayer();
      
      if (currentPlayer && currentPlayer.isBot) {
        // Simple bot move: just draw a tile
        this.drawTile(currentPlayer.id);
        this.nextTurn();
        
        // Send update to all players
        this.players.forEach(player => {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit('botMove', {
              gameState: this.getGameState(player.id)
            });
          }
        });
        
        const nextPlayer = this.getCurrentPlayer();
        
        // Only schedule next move if the new current player is also a bot
        if (nextPlayer && nextPlayer.isBot) {
          this.scheduleNextBotMove(io, gameId, 3500);
        }
      }
    }, delay);
  }
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
const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (http://0.0.0.0:${PORT})`);
});
