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

// Add CORS headers as early as possible
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Configure CORS for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000', 
  'http://127.0.0.1:3000',
  'https://jkube.netlify.app',
  'https://debug-drag-drop-work--jkube.netlify.app',
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
    origin: '*', // Allow all origins
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Try polling first
  pingTimeout: 60000, // Increase ping timeout to 60 seconds
  pingInterval: 25000, // More frequent pings to detect disconnections
  connectTimeout: 30000, // Longer connection timeout
  allowEIO3: true // Allow older engine.io versions for compatibility
});

// Security and middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// Configure CORS simply
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true
}));

// Handle preflight requests for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.sendStatus(200);
});

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeGames: games.size,
    activePlayers: players.size
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'netlify-build', 'index.html'));
});

// Game state management
const games = new Map();
const players = new Map();

// Helper function to check if a game was abandoned (not properly completed)
function isGameAbandoned(winner) {
  if (!winner) return true; // No winner means incomplete
  
  // Check for abandonment reasons
  const abandonmentReasons = [
    'Game abandoned due to inactivity',
    'Single player timeout',
    'Game timeout',
    'No active players remaining',
    'abandoned',
    'timeout',
    'inactivity'
  ];
  
  return abandonmentReasons.some(reason => 
    winner.toLowerCase().includes(reason.toLowerCase())
  );
}

// Pass the in-memory games map to the games routes so it can get real-time player counts
gamesRoutes.setInMemoryGames(games);
app.use('/api/games', gamesRoutes);

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
    
    // Game lifecycle management
    this.lastUserJoinTime = Date.now(); // When the last user joined
    this.lastActivityTime = Date.now(); // When last meaningful action occurred
    this.singlePlayerTimer = null; // Timer for single player timeout
    this.unstartedGameTimer = null; // Timer for unstarted game timeout
    this.inactivityTimer = null; // Timer for game inactivity
    
    console.log(`🎮 Game ${gameId} created, isBotGame: ${isBotGame}`);
    this.initializeDeck();
    this.startLifecycleManagement();
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
    
    // Check if player with this name already exists (for reconnection scenarios)
    const existingPlayer = this.players.find(p => p.name === playerName);
    if (existingPlayer) {
      // Update the player's ID (socket ID) for reconnection
      existingPlayer.id = playerId;
      console.log(`Player ${playerName} reconnected with new socket ID: ${playerId}`);
      return true;
    }
    
    const player = {
      id: playerId,
      name: playerName,
      hand: [],
      hasPlayedInitial: false,
      score: 0,
      isBot: false
    };
    
    this.players.push(player);
    
    // Record that a user joined for lifecycle management
    this.recordUserJoin();
    
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
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1) {
      // Store the player's name for logging
      const playerName = this.players[playerIndex].name;
      
      // For multiplayer games, don't immediately remove the player on disconnect
      // This allows them to reconnect with the same player data
      if (!this.isBotGame) {
        // Mark the player as disconnected but keep their data for potential reconnection
        this.players[playerIndex].disconnected = true;
        this.players[playerIndex].disconnectedAt = Date.now();
        console.log(`Player ${playerName} temporarily disconnected, data preserved for reconnection`);
      } else {
        // For bot games, remove the player immediately
        this.players.splice(playerIndex, 1);
        console.log(`Player ${playerName} removed from bot game`);
      }
      
      // If it was their turn, move to the next player
      if (this.currentPlayerIndex >= this.players.length) {
        this.currentPlayerIndex = 0;
      } else if (playerIndex === this.currentPlayerIndex) {
        this.nextTurn();
      }
    }
    
    // Clean up disconnected players that haven't reconnected within 30 minutes
    this.cleanupDisconnectedPlayers();
  }
  
  cleanupDisconnectedPlayers() {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    // Filter out players who have been disconnected for over 30 minutes
    const initialCount = this.players.length;
    const removedPlayers = [];
    
    this.players = this.players.filter(player => {
      // Keep connected players and recently disconnected players
      const shouldKeep = !player.disconnected || player.disconnectedAt > thirtyMinutesAgo;
      if (!shouldKeep) {
        removedPlayers.push(player.name);
      }
      return shouldKeep;
    });
    
    const removedCount = initialCount - this.players.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} disconnected players from game ${this.id}: ${removedPlayers.join(', ')}`);
      
      // Update MongoDB to reflect the current player list
      this.updateGamePlayersInDB();
    }
  }
  
  // Update the MongoDB game document to reflect current players
  async updateGamePlayersInDB() {
    try {
      const Game = require('./models/Game');
      const gameDoc = await Game.findOne({ gameId: this.id });
      
      if (gameDoc) {
        // Update the players array to only include active (non-disconnected) players
        const activePlayers = this.players.filter(p => !p.disconnected).map(p => ({
          name: p.name,
          isBot: p.isBot || false
        }));
        
        gameDoc.players = activePlayers;
        await gameDoc.save();
        console.log(`Updated MongoDB game ${this.id} with ${activePlayers.length} active players`);
      }
    } catch (error) {
      console.error(`Error updating game players in DB for ${this.id}:`, error.message);
    }
  }

  startGame() {
    if (this.players.length < 2) return false;
    
    // Deal tiles based on bot difficulty or debug player
    console.log(`🔧 DEBUG: About to check debug conditions - isBotGame: ${this.isBotGame}, botDifficulty: "${this.botDifficulty}"`);
    if (this.isBotGame && this.botDifficulty === 'debug') {
      console.log(`🔧 DEBUG MODE DETECTED! Calling dealDebugHand...`);
      // Debug mode: Give human player a preset hand for testing
      this.dealDebugHand();
    } else if (this.isBotGame && this.botDifficulty === 'lastTile') {
      console.log(`🔧 LAST TILE TEST MODE DETECTED! Dealing 4-tile hand...`);
      // Special test mode: Give human player exactly 4 tiles for last tile duplication test
      this.dealLastTileTestHand();
    } else {
      console.log(`🎲 Normal mode: dealing random tiles`);
      // Normal mode: Deal 14 tiles to each player
      for (const player of this.players) {
        for (let i = 0; i < 14; i++) {
          if (this.deck.length > 0) {
            player.hand.push(this.deck.pop());
          }
        }
      }
    }
    
    this.started = true;
    
    // Take initial board snapshot (empty board)
    this.takeBoardSnapshot();
    
    // Start the timer for the first player if timer is enabled
    if (this.timerEnabled) {
      console.log(`⏰ Starting timer for first player: ${this.players[this.currentPlayerIndex].name}`);
      this.startTurnTimer();
    }
    
    console.log(`✅ Game ${this.id} started successfully`);
    return true;
  }

  dealDebugHand() {
    console.log(`🔧 dealDebugHand called! Looking for players...`);
    
    // Find human player (non-bot)
    const humanPlayer = this.players.find(p => !p.isBot);
    const botPlayer = this.players.find(p => p.isBot);
    
    console.log(`🔧 Found players - Human: ${humanPlayer?.name}, Bot: ${botPlayer?.name}`);
    
    if (!humanPlayer || !botPlayer) {
      console.log(`🔧 ERROR: Missing players! Human: ${!!humanPlayer}, Bot: ${!!botPlayer}`);
      return;
    }
    
    // Create debug hand that can go out completely (win immediately) with a joker
    const debugTiles = [
      // First set: Three 13s in different colors (39 points - satisfies initial play requirement)
      { id: 'red_13_0', color: 'red', number: 13, isJoker: false },
      { id: 'blue_13_0', color: 'blue', number: 13, isJoker: false },
      { id: 'yellow_13_0', color: 'yellow', number: 13, isJoker: false },
      
      // Second set: Run in red (1-2-3)
      { id: 'red_1_0', color: 'red', number: 1, isJoker: false },
      { id: 'red_2_0', color: 'red', number: 2, isJoker: false },
      { id: 'red_3_0', color: 'red', number: 3, isJoker: false },
      
      // Third set: Run in blue (4-5-6)
      { id: 'blue_4_0', color: 'blue', number: 4, isJoker: false },
      { id: 'blue_5_0', color: 'blue', number: 5, isJoker: false },
      { id: 'blue_6_0', color: 'blue', number: 6, isJoker: false },
      
      // Fourth set: Three 7s in different colors
      { id: 'red_7_0', color: 'red', number: 7, isJoker: false },
      { id: 'blue_7_0', color: 'blue', number: 7, isJoker: false },
      { id: 'yellow_7_0', color: 'yellow', number: 7, isJoker: false },
      
      // Fifth set: Two 10s + joker (can represent any 10)
      { id: 'red_10_0', color: 'red', number: 10, isJoker: false },
      { id: 'blue_10_0', color: 'blue', number: 10, isJoker: false },
      
      // Extra testing tile: Joker for last tile duplication testing
      { id: 'joker_1', color: null, number: null, isJoker: true }
    ];
    
    console.log(`🔧 Created debug tiles: ${debugTiles.length} tiles`);
    
    // Remove these specific tiles from deck to avoid duplicates
    debugTiles.forEach(debugTile => {
      const index = this.deck.findIndex(tile => tile.id === debugTile.id);
      if (index !== -1) {
        this.deck.splice(index, 1);
        console.log(`🔧 Removed ${debugTile.id} from deck`);
      }
    });
    
    // Give debug tiles to human player (exactly 14 tiles for perfect win)
    humanPlayer.hand = [...debugTiles];
    console.log(`🔧 Gave debug tiles to ${humanPlayer.name}: ${humanPlayer.hand.length} tiles`);
    
    console.log(`🔧 Final human hand size: ${humanPlayer.hand.length}`);
    console.log(`🔧 Human hand sets: 3×13s (${debugTiles.slice(0,3).map(t => t.color).join(', ')}), red 1-2-3, blue 4-5-6, 3×7s, 2×10s, +1 joker`);
    
    // Give bot normal random hand
    for (let i = 0; i < 14; i++) {
      if (this.deck.length > 0) {
        botPlayer.hand.push(this.deck.pop());
      }
    }
    
    console.log(`🔧 Bot ${botPlayer.name} hand size: ${botPlayer.hand.length}`);
    console.log(`🔧 Deck remaining: ${this.deck.length} tiles`);
  }

  dealLastTileTestHand() {
    console.log(`🔧 dealLastTileTestHand called! Setting up 4-tile hand for last tile duplication test...`);
    
    // Find human player (non-bot)
    const humanPlayer = this.players.find(p => !p.isBot);
    const botPlayer = this.players.find(p => p.isBot);
    
    console.log(`🔧 Found players - Human: ${humanPlayer?.name}, Bot: ${botPlayer?.name}`);
    
    if (!humanPlayer || !botPlayer) {
      console.log(`🔧 ERROR: Missing players! Human: ${!!humanPlayer}, Bot: ${!!botPlayer}`);
      return;
    }
    
    // Create a 4-tile hand: three 13s (different colors) + one extra tile for the duplication test
    const testTiles = [
      // Three 13s in different colors (39 points - valid initial play)
      { id: 'red_13_0', color: 'red', number: 13, isJoker: false },
      { id: 'blue_13_0', color: 'blue', number: 13, isJoker: false },
      { id: 'yellow_13_0', color: 'yellow', number: 13, isJoker: false },
      // One extra tile to test last tile duplication
      { id: 'red_4_0', color: 'red', number: 4, isJoker: false }
    ];
    
    // Clear human player's hand and give them the test tiles
    humanPlayer.hand = [];
    testTiles.forEach(tile => {
      humanPlayer.hand.push(tile);
    });
    
    console.log(`🔧 Gave last tile test hand to ${humanPlayer.name}: ${humanPlayer.hand.length} tiles`);
    console.log(`🔧 Test hand: 3×13s (red, blue, yellow) + red 4`);
    
    // Give bot a minimal hand (just enough to play)
    botPlayer.hand = [];
    for (let i = 0; i < 4; i++) {
      if (this.deck.length > 0) {
        botPlayer.hand.push(this.deck.pop());
      }
    }
    
    console.log(`🔧 Bot ${botPlayer.name} hand size: ${botPlayer.hand.length}`);
    console.log(`🔧 Deck remaining: ${this.deck.length} tiles`);
  }

  // Start the turn timer on the server
  startTurnTimer() {
    // Clear any existing timer
    this.clearTurnTimer();
    
    // Set the turn start time
    this.turnStartTime = Date.now();
    
    const currentPlayer = this.getCurrentPlayer();
    console.log(`⏰ Starting timer for ${currentPlayer ? currentPlayer.name : 'unknown'}, ${this.turnTimeLimit}s limit`);
    
    // Delay the initial timer broadcast to allow for the client-side animation (2.5s)
    setTimeout(() => {
      // Send initial timer update after the notification animation would be complete
      this.broadcastTimerUpdate(this.turnTimeLimit);
      
      // Create an interval to broadcast the timer updates
      this.turnTimerInterval = setInterval(() => {
        // Calculate remaining time
        const elapsedSeconds = Math.floor((Date.now() - this.turnStartTime - 2500) / 1000); // Account for animation delay
        const remainingTime = Math.max(0, this.turnTimeLimit - elapsedSeconds);
        
        // Broadcast timer update to all players
        this.broadcastTimerUpdate(remainingTime);
        
        // If time is up, handle it
        if (remainingTime <= 0) {
          this.handleTimeUp();
        }
      }, 1000); // Update every second
    }, 2500); // Wait for notification animation to complete
  }
  
  // Clear the turn timer
  clearTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
  }
  
  // Broadcast timer update to all players in the game
  broadcastTimerUpdate(remainingTime) {
    // Only broadcast if the game is still active
    if (this.started && !this.winner) {
      console.log(`⏰ Broadcasting timer update: ${remainingTime}s remaining`);
      io.to(this.id).emit('timerUpdate', {
        remainingTime: remainingTime,
        currentPlayerIndex: this.currentPlayerIndex,
        currentPlayerId: this.getCurrentPlayer()?.id
      });
    }
  }
  
  // Handle time up for current player
  handleTimeUp() {
    // Clear the timer
    this.clearTurnTimer();
    
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return;
    
    console.log(`⏰ Time's up for ${currentPlayer.name}!`);
    
    // Find tiles that need to be returned to the player's hand
    // Compare current board with snapshot to find tiles that were moved from hand to board
    const currentTileIds = new Set();
    const snapshotTileIds = new Set();
    
    // Collect all tile IDs currently on the board
    this.board.forEach(set => {
      set.forEach(tile => {
        currentTileIds.add(tile.id);
      });
    });
    
    // Collect all tile IDs from the board snapshot
    this.boardSnapshot.forEach(set => {
      set.forEach(tile => {
        snapshotTileIds.add(tile.id);
      });
    });
    
    // Find tiles that were added to the board during this turn
    const tilesAddedThisTurn = [];
    for (const tileId of currentTileIds) {
      if (!snapshotTileIds.has(tileId)) {
        // Find the actual tile object on the board
        for (const set of this.board) {
          const tile = set.find(t => t.id === tileId);
          if (tile) {
            tilesAddedThisTurn.push(tile);
            break;
          }
        }
      }
    }
    
    // Return tiles to player's hand and restore board to snapshot
    if (tilesAddedThisTurn.length > 0) {
      console.log(`⏰ Returning ${tilesAddedThisTurn.length} tiles to ${currentPlayer.name}'s hand`);
      
      // Add tiles back to player's hand
      currentPlayer.hand.push(...tilesAddedThisTurn);
      
      // Restore board to the snapshot state
      this.board = JSON.parse(JSON.stringify(this.boardSnapshot));
    }
    
    // Skip to next player
    this.nextTurn();
    
    // Broadcast the updated game state
    io.to(this.id).emit('timeUp', {
      gameState: this.getGameState(),
      message: `Time's up for ${currentPlayer.name}! Turn skipped.`
    });
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

  calculateSetValue(tiles) {
    let totalValue = 0;
    // Use enhanced joker detection for consistency
    const nonJokerTiles = tiles.filter(t => !(t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker'))));
    const jokerCount = tiles.length - nonJokerTiles.length;
    
    // Enhanced logging for debugging
    console.log(`calculateSetValue called with ${tiles.length} tiles (${jokerCount} jokers)`);
    const tileDetails = tiles.map(t => {
      if (t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker'))) 
        return "JOKER";
      return `${t.color}-${t.number}`;
    }).join(", ");
    console.log(`Tiles: [${tileDetails}]`);
    
    if (this.isValidGroup(tiles)) {
      // Group: same number, different colors
      if (nonJokerTiles.length > 0) {
        const groupNumber = nonJokerTiles[0].number;
        // All tiles (including jokers) are worth the group number
        totalValue = groupNumber * tiles.length;
        console.log(`Group value calculation: ${groupNumber} points × ${tiles.length} tiles = ${totalValue} points`);
        console.log(`Group breakdown: ${nonJokerTiles.length} regular tiles (${groupNumber} each) + ${jokerCount} jokers (${groupNumber} each)`);
      } else if (jokerCount > 0) {
        // Edge case: all jokers in a group (shouldn't happen in normal play)
        // Assign a default value (this matches client behavior)
        totalValue = 13 * tiles.length; // Maximum possible value
        console.log(`All-joker group value calculation: 13 × ${tiles.length} = ${totalValue}`);
      }
    } else if (this.isValidRun(tiles)) {
      // Run: consecutive numbers, same color
      // Need to determine what number each joker represents
      totalValue = this.calculateRunValueWithJokers(tiles);
      console.log(`Run value calculation: ${totalValue} points`);
    } else {
      console.log(`Set is neither a valid group nor run - no value calculated`);
    }
    
    // Final value check for initial play requirement
    console.log(`Final set value: ${totalValue} points ${totalValue >= 30 ? '(meets 30-point requirement)' : '(below 30-point requirement)'}`);
    return totalValue;
  }

  calculateRunValueWithJokers(tiles) {
    // Use enhanced joker detection for consistency
    const nonJokers = tiles.filter(t => !(t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker'))));
    const jokerCount = tiles.length - nonJokers.length;
    
    // Enhanced logging for run calculation
    console.log(`calculateRunValueWithJokers called with ${tiles.length} tiles (${jokerCount} jokers)`);
    const nonJokerDetails = nonJokers.map(t => `${t.color}-${t.number}`).join(", ");
    console.log(`Non-joker tiles: [${nonJokerDetails}]`);
    
    if (nonJokers.length === 0) {
      // All jokers case
      console.log(`All jokers in run - assigning consecutive values starting from 1`);
      let value = 0;
      for (let i = 1; i <= tiles.length; i++) {
        value += i;
      }
      console.log(`All-joker run total: ${value} points`);
      return value;
    }
    
    // Sort non-jokers by number to determine the sequence
    nonJokers.sort((a, b) => a.number - b.number);
    
    // Determine the complete sequence including jokers
    const minNumber = nonJokers[0].number;
    const maxNumber = nonJokers[nonJokers.length - 1].number;
    const sequenceLength = tiles.length;
    
    // Calculate if jokers fill gaps or extend the sequence
    const knownRange = maxNumber - minNumber + 1;
    const missingInRange = knownRange - nonJokers.length;
    
    let sequenceStart;
    if (missingInRange === jokerCount) {
      // Jokers fill gaps in the known range
      sequenceStart = minNumber;
      console.log(`Jokers fill gaps in range ${minNumber}-${maxNumber}`);
    } else {
      // Some jokers extend the sequence
      // We need to determine the optimal placement
      // For value calculation, place jokers to minimize total value (conservative approach)
      sequenceStart = Math.max(1, minNumber - Math.floor((jokerCount - missingInRange) / 2));
      console.log(`Jokers extend sequence, starting from ${sequenceStart}`);
    }
    
    // Calculate total value for the complete sequence
    let total = 0;
    for (let i = 0; i < sequenceLength; i++) {
      total += sequenceStart + i;
    }
    
    console.log(`Run sequence ${sequenceStart} to ${sequenceStart + sequenceLength - 1}: total value = ${total}`);
    return total;
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
  
  // Validate all sets on the board
  validateBoardState(isEndTurn = false) {
    // Validate that all sets on the board are legal
    for (let i = 0; i < this.board.length; i++) {
      const set = this.board[i];
      
      // When ending a turn, enforce that sets must have 3+ tiles and be valid
      // During a turn, allow partial sets with fewer than 3 tiles
      if ((isEndTurn && set.length < 3) || !this.isValidPartialSet(set, isEndTurn)) {
        console.log(`❌ Invalid set found at index ${i}:`, set.map(t => `${t.color || 'joker'}_${t.number || 'J'}`));
        return { valid: false, invalidSetIndex: i };
      }
    }
    console.log(`✅ Board state is valid: ${this.board.length} sets`);
    return { valid: true };
  }
  
  // Check if a set is valid or could become valid
  isValidPartialSet(tiles, isEndTurn = true) {
    // If ending turn, use the strict validation
    if (isEndTurn) {
      return this.isValidSet(tiles);
    }
    
    // During turn, allow partial sets that could become valid
    if (tiles.length === 0) return true; // Empty sets are allowed during manipulation
    if (tiles.length === 1) return true; // Single tiles are allowed during manipulation
    if (tiles.length === 2) return true; // Two tiles are allowed during manipulation
    
    // For 3+ tiles, they must form a valid set
    return this.isValidSet(tiles);
  }

  // Check if a joker was taken and used in a new set
  checkJokerManipulation(oldBoard, newBoard, player) {
    let jokersRemoved = [];
    let jokersAdded = [];
    
    // Find jokers removed from old board
    oldBoard.forEach((set, setIndex) => {
      set.forEach(tile => {
        if (tile.isJoker) {
          // Check if this joker still exists in the new board
          let found = false;
          for (const newSet of newBoard) {
            for (const newTile of newSet) {
              if (newTile.id === tile.id) {
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (!found) {
            jokersRemoved.push(tile.id);
          }
        }
      });
    });
    
    // Find jokers added to new board
    newBoard.forEach((set, setIndex) => {
      set.forEach(tile => {
        if (tile.isJoker) {
          // Check if this joker existed in the old board
          let found = false;
          for (const oldSet of oldBoard) {
            for (const oldTile of oldSet) {
              if (oldTile.id === tile.id) {
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (!found) {
            jokersAdded.push(tile.id);
          }
        }
      });
    });
    
    console.log(`Jokers removed: ${jokersRemoved.length}, Jokers added: ${jokersAdded.length}`);
    return {
      removed: jokersRemoved,
      added: jokersAdded,
      manipulated: jokersRemoved.length > 0 || jokersAdded.length > 0
    };
  }

  restoreFromSnapshot() {
    // Restore board to snapshot state
    this.board = JSON.parse(JSON.stringify(this.boardSnapshot));
    console.log(`🔄 Board restored from snapshot: ${this.board.length} sets`);
  }

  // Method to restore the board from snapshot (wrapper for restoreFromSnapshot)
  restoreBoardSnapshot() {
    this.restoreFromSnapshot();
    console.log(`🔄 Board restored from snapshot using restoreBoardSnapshot`);
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

    // Check initial play requirement (30+ points for first play)
    if (!player.hasPlayedInitial) {
      const setValue = this.calculateSetValue(tiles);
      console.log(`==========================================`);
      console.log(`Initial play validation:`);
      console.log(`Set value: ${setValue} points`);
      console.log(`Required points: 30+`);
      console.log(`Meets requirement: ${setValue >= 30 ? 'YES' : 'NO'}`);
      console.log(`==========================================`);
      
      if (setValue < 30) {
        console.log(`Initial play rejected: insufficient points (${setValue})`);
        return false;
      }
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
    
    // Record meaningful activity (playing sets)
    this.recordActivity();
    
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
    
    // Record meaningful activity (playing multiple sets)
    this.recordActivity();
    
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
    
    // Start the turn timer if enabled
    if (this.timerEnabled) {
      this.startTurnTimer();
    }
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
    
    // Record meaningful activity for certain actions (not drawing tiles)
    if (action === 'played_set' || action === 'ended_turn') {
      this.recordActivity();
    }
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

  // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
  // This method is essential for drag-and-drop functionality
  // Removing or changing this will cause "updateBoard is not a function" server crashes
  updateBoard(newBoard) {
    // Update the board with new arrangement
    this.board = newBoard;
  }
  
  // Restore game state from MongoDB document
  static async restoreFromMongoDB(gameId) {
    try {
      const dbGame = await Game.findOne({ gameId });
      
      if (!dbGame || dbGame.endTime) {
        console.log(`Cannot restore game ${gameId}: not found or already ended`);
        return null;
      }
      
      const game = new RummikubGame(gameId);
      game.isBotGame = dbGame.isBotGame || false;
      
      // Restore board state if available
      if (dbGame.boardState && Array.isArray(dbGame.boardState)) {
        game.board = dbGame.boardState;
      }
      
      // Restore game log if available
      if (dbGame.gameLog && Array.isArray(dbGame.gameLog)) {
        game.gameLog = dbGame.gameLog;
      }
      
      // Restore start time
      game.createdAt = dbGame.startTime || Date.now();
      
      // Note: player hands, current player index, etc. will need to be
      // re-established when players reconnect
      
      console.log(`Successfully restored game ${gameId} from MongoDB`);
      return game;
    } catch (error) {
      console.error(`Error restoring game ${gameId} from MongoDB:`, error);
      return null;
    }
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
              gameState: this.getGameState(player.id),
              moveDescription: 'drew a tile'
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
  
  // Clear the turn timer
  clearTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
    this.turnStartTime = null;
  }
  
  // Game Lifecycle Management Methods
  
  startLifecycleManagement() {
    // Start checking for single player timeout
    this.checkSinglePlayerTimeout();
    // Start checking for unstarted game timeout
    this.checkUnstartedGameTimeout();
    // Start checking for inactivity timeout
    this.checkInactivityTimeout();
  }
  
  // Rule 1: If a game has only 1 user, close after 5 minutes if no one joins
  checkSinglePlayerTimeout() {
    this.singlePlayerTimer = setInterval(() => {
      const activePlayerCount = this.getActivePlayerCount();
      
      if (activePlayerCount === 1 && !this.started) {
        const timeSinceLastJoin = Date.now() - this.lastUserJoinTime;
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeSinceLastJoin >= fiveMinutes) {
          console.log(`🕐 Game ${this.id} closing: Single player timeout (5 minutes)`);
          this.closeGame('Single player timeout - no other players joined within 5 minutes');
          return;
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  // Rule 2: Unstarted games close 5 minutes after last user joins
  checkUnstartedGameTimeout() {
    this.unstartedGameTimer = setInterval(() => {
      if (!this.started) {
        const timeSinceLastJoin = Date.now() - this.lastUserJoinTime;
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeSinceLastJoin >= fiveMinutes) {
          console.log(`🕐 Game ${this.id} closing: Unstarted game timeout (5 minutes since last join)`);
          this.closeGame('Game timeout - not started within 5 minutes of last player joining');
          return;
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  // Rule 3: Games with no meaningful activity for 10 minutes close
  checkInactivityTimeout() {
    this.inactivityTimer = setInterval(() => {
      if (this.started && !this.winner) {
        const timeSinceActivity = Date.now() - this.lastActivityTime;
        const tenMinutes = 10 * 60 * 1000;
        
        if (timeSinceActivity >= tenMinutes) {
          console.log(`🕐 Game ${this.id} closing: Inactivity timeout (10 minutes)`);
          this.closeGame('Game abandoned due to inactivity (10 minutes)');
          return;
        }
      }
    }, 60000); // Check every minute
  }
  
  // Get count of active (non-disconnected) players
  getActivePlayerCount() {
    return this.players.filter(p => !p.disconnected).length;
  }
  
  // Record meaningful activity (not just drawing tiles)
  recordActivity() {
    this.lastActivityTime = Date.now();
  }
  
  // Record when a user joins
  recordUserJoin() {
    this.lastUserJoinTime = Date.now();
  }
  
  // Close and cleanup the game
  closeGame(reason) {
    console.log(`🔚 Closing game ${this.id}: ${reason}`);
    
    // Clear all timers
    if (this.singlePlayerTimer) {
      clearInterval(this.singlePlayerTimer);
      this.singlePlayerTimer = null;
    }
    if (this.unstartedGameTimer) {
      clearInterval(this.unstartedGameTimer);
      this.unstartedGameTimer = null;
    }
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    this.clearTurnTimer();
    
    // Mark as ended in MongoDB
    this.endGameInDB(reason);
    
    // This game should be removed from the games map by the caller
    this.closed = true;
    this.closeReason = reason;
  }
  
  // End the game in MongoDB
  async endGameInDB(reason) {
    try {
      const Game = require('./models/Game');
      const gameDoc = await Game.findOne({ gameId: this.id });
      
      if (gameDoc && !gameDoc.endTime) {
        gameDoc.endTime = new Date();
        gameDoc.winner = reason;
        await gameDoc.save();
        console.log(`📝 Game ${this.id} marked as ended in MongoDB: ${reason}`);
      }
    } catch (error) {
      console.error(`Error ending game ${this.id} in DB:`, error.message);
    }
  }
  
  // Override cleanup to also handle Rule 4: 0 users = close immediately
  cleanupDisconnectedPlayers() {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    // Filter out players who have been disconnected for over 30 minutes
    const initialCount = this.players.length;
    const removedPlayers = [];
    
    this.players = this.players.filter(player => {
      // Keep connected players and recently disconnected players
      const shouldKeep = !player.disconnected || player.disconnectedAt > thirtyMinutesAgo;
      if (!shouldKeep) {
        removedPlayers.push(player.name);
      }
      return shouldKeep;
    });
    
    const removedCount = initialCount - this.players.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} disconnected players from game ${this.id}: ${removedPlayers.join(', ')}`);
      
      // Update MongoDB to reflect the current player list
      this.updateGamePlayersInDB();
    }
    
    // Rule 4: If no active players remain, close the game immediately
    const activePlayerCount = this.getActivePlayerCount();
    if (activePlayerCount === 0) {
      console.log(`🕐 Game ${this.id} closing: No active players remaining`);
      this.closeGame('No active players remaining');
      return true; // Signal that game should be removed
    }
    
    return false;
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
    
    // Update user online status and last seen
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeen: new Date()
    });
    
    console.log(`✅ Authenticated socket connection: ${user.username} (${socket.id})`);
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

  // Save game state to MongoDB periodically
  const saveGameToMongoDB = async (gameId) => {
    try {
      const game = games.get(gameId);
      if (!game) return;
      
      // Find the existing game document
      const gameDoc = await Game.findOne({ gameId });
      if (!gameDoc) return;
      
      // Update the game state
      gameDoc.boardState = game.board;
      gameDoc.gameLog = game.gameLog;
      
      // Save the updated document
      await gameDoc.save();
      console.log(`Game ${gameId} state saved to MongoDB`);
    } catch (error) {
      console.error(`Error saving game state to MongoDB: ${error.message}`);
    }
  };

  // [ORIGINAL SOCKET HANDLERS FROM SERVER.JS]
  socket.on('createGame', async (data) => {
    const gameId = generateGameId();
    const game = new RummikubGame(gameId);
    
    // Set debug mode flag if provided
    game.isDebugMode = data.isDebugMode || false;
    
    // Set timer option if provided
    game.timerEnabled = data.timerEnabled || false;
    
    // Use authenticated username if available, otherwise use provided name
    const playerName = (socket.user && !socket.user.isGuest) ? socket.user.username : data.playerName;
    console.log(`Using player name for game: ${playerName} (authenticated: ${!socket.user.isGuest})`);
    
    if (game.addPlayer(socket.id, playerName)) {
      games.set(gameId, game);
      players.set(socket.id, { 
        gameId, 
        playerName: playerName,
        isDebugEnabled: data.isDebugMode || false
      });
      
      // Also save to MongoDB for persistence
      try {
        // Create a MongoDB game document
        const userId = socket.user && !socket.user.isGuest ? socket.user.id : null;
        
        const gameDocument = new Game({
          gameId: gameId,
          players: [{
            userId: userId,
            name: data.playerName,
            isBot: false
          }],
          startTime: new Date(),
          boardState: [],
          gameLog: [],
          isBotGame: false
        });
        
        await gameDocument.save();
        console.log(`Game ${gameId} saved to MongoDB`);
      } catch (error) {
        console.error('Error saving game to MongoDB:', error);
        // Continue anyway - the game will work in memory even if DB save fails
      }
      
      socket.join(gameId);
      socket.emit('gameCreated', { gameId, gameState: game.getGameState(socket.id) });
      
      console.log(`Game created: ${gameId} by ${data.playerName}, debug mode: ${game.isDebugMode}`);
    } else {
      socket.emit('error', { message: 'Failed to create game' });
    }
  });

  socket.on('createBotGame', async (data) => {
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
      
      // Also save to MongoDB for persistence
      try {
        // Create a MongoDB game document with bot players
        const userId = socket.user && !socket.user.isGuest ? socket.user.id : null;
        
        const playerDocs = [{
          userId: userId,
          name: data.playerName,
          isBot: false
        }];
        
        // Add bot players to the document
        addedBots.forEach(bot => {
          playerDocs.push({
            name: bot.name,
            isBot: true
          });
        });
        
        const gameDocument = new Game({
          gameId: gameId,
          players: playerDocs,
          startTime: new Date(),
          boardState: [],
          gameLog: [],
          isBotGame: true
        });
        
        await gameDocument.save();
        console.log(`Bot game ${gameId} saved to MongoDB`);
      } catch (error) {
        console.error('Error saving bot game to MongoDB:', error);
        // Continue anyway - the game will work in memory even if DB save fails
      }
      
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

  socket.on('joinGame', async (data) => {
    // First try to get the game from in-memory cache
    let game = games.get(data.gameId);
    
    // If not found in memory, try to find it in MongoDB
    if (!game) {
      try {
        // Try to restore the game from MongoDB
        game = await RummikubGame.restoreFromMongoDB(data.gameId);
        
        if (game) {
          // If successfully restored, add it to the in-memory cache
          games.set(data.gameId, game);
          console.log(`Restored game ${data.gameId} from MongoDB for player join`);
        }
      } catch (error) {
        console.error(`Error loading game from MongoDB: ${error.message}`);
      }
    }
    
    // If still not found, return error
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // Use authenticated username if available, otherwise use provided name
    const playerName = (socket.user && !socket.user.isGuest) ? socket.user.username : data.playerName;
    console.log(`Player joining game: ${playerName} (authenticated: ${!socket.user.isGuest})`);

    if (game.addPlayer(socket.id, playerName)) {
      players.set(socket.id, { gameId: data.gameId, playerName: playerName });
      
      // Update MongoDB record
      try {
        const userId = socket.user && !socket.user.isGuest ? socket.user.id : null;
        
        await Game.findOneAndUpdate(
          { gameId: data.gameId },
          { 
            $push: { 
              players: { 
                userId: userId,
                name: playerName,
                isBot: false
              } 
            } 
          },
          { new: true }
        );
        console.log(`Added player ${data.playerName} to game ${data.gameId} in MongoDB`);
      } catch (error) {
        console.error(`Error updating MongoDB game: ${error.message}`);
      }
      
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

  socket.on('getGameState', async (data) => {
    console.log(`Player ${socket.id} requesting game state for game: ${data.gameId}`);
    
    // First try to get the game from in-memory cache
    let game = games.get(data.gameId);
    
    // If not found in memory, try to find it in MongoDB
    if (!game) {
      try {
        // Try to restore the game from MongoDB
        game = await RummikubGame.restoreFromMongoDB(data.gameId);
        
        if (game) {
          // If successfully restored, add it to the in-memory cache
          games.set(data.gameId, game);
          console.log(`Restored game ${data.gameId} from MongoDB for game state request`);
        }
      } catch (error) {
        console.error(`Error loading game from MongoDB: ${error.message}`);
      }
    }
    
    // If still not found, return error
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
        
        // Save game state to MongoDB
        saveGameToMongoDB(playerData.gameId);
        
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
        
        // Save game state to MongoDB
        saveGameToMongoDB(playerData.gameId);
        
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
      
      // Save game state to MongoDB
      saveGameToMongoDB(playerData.gameId);
      
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
      
      // Check for win condition before ending turn
      if (currentPlayer.hand.length === 0) {
        game.winner = currentPlayer;
        io.to(playerData.gameId).emit('gameWon', {
          winner: game.winner,
          gameState: game.getGameState(socket.id)
        });
        return;
      }
      
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
      
      // Save game state to MongoDB
      saveGameToMongoDB(playerData.gameId);
      
      // Trigger bot move if it's a bot game and we just advanced to bot
      if (game.isBotGame) {
        console.log(`👤➡️🤖 Human ended turn, triggering bot move`);
        game.scheduleNextBotMove(io, playerData.gameId, 4000);
      }
    }
  });

  socket.on('updateBoard', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Only allow current player to update board
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
    console.log('🐛 [SERVER DEBUG] updateBoard received:', {
      playerId: socket.id,
      playerName: currentPlayer.name,
      tilesFromHand: data.tilesFromHand,
      currentHandSize: currentPlayer.hand.length,
      isLastTile: currentPlayer.hand.length === 1,
      boardTileCount: game.board.flat().length
    });
    // 🐛 END DEBUG LOGGING
    
    // Check if this is the first board update in the turn and create a snapshot
    // This ensures we always have a snapshot to compare against for undo
    if (!game.boardSnapshot) {
      game.boardSnapshot = JSON.parse(JSON.stringify(game.board));
      console.log('🎮 Created initial board snapshot for this turn');
    }
    
    // Find tiles that were moved from hand to board
    // Instead of just looking at added tiles, we'll use an explicit approach
    if (data.tilesFromHand && Array.isArray(data.tilesFromHand) && data.tilesFromHand.length > 0) {
      // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
      console.log('🐛 [SERVER DEBUG] Processing tilesFromHand:', {
        tilesFromHand: data.tilesFromHand,
        handSizeBefore: currentPlayer.hand.length,
        handTileIdsBefore: currentPlayer.hand.map(t => t.id)
      });
      // 🐛 END DEBUG LOGGING
      
      console.log(`Player ${currentPlayer.name} moved tiles from hand to board:`, data.tilesFromHand);
      
      // Remove these specific tiles from the player's hand
      data.tilesFromHand.forEach(tileId => {
        const tileIndex = currentPlayer.hand.findIndex(t => t.id === tileId);
        if (tileIndex !== -1) {
          // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
          console.log(`🐛 [SERVER DEBUG] Removing tile ${tileId} from hand at index ${tileIndex}`);
          // 🐛 END DEBUG LOGGING
          
          currentPlayer.hand.splice(tileIndex, 1);
          console.log(`Removed tile ${tileId} from ${currentPlayer.name}'s hand`);
        } else {
          // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
          console.log(`🐛 [SERVER DEBUG] WARNING: Tile ${tileId} not found in hand!`);
          // 🐛 END DEBUG LOGGING
        }
      });
      
      // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
      console.log('🐛 [SERVER DEBUG] After tile removal:', {
        handSizeAfter: currentPlayer.hand.length,
        handTileIdsAfter: currentPlayer.hand.map(t => t.id),
        removedTileCount: data.tilesFromHand.length
      });
      // 🐛 END DEBUG LOGGING
    }
    
    // Check if joker manipulation is occurring
    const jokerChange = game.checkJokerManipulation(game.board, data.board, currentPlayer);
    
    // Update the board with new arrangement
    game.updateBoard(data.board);
    
    // Skip validation during the turn - only validate when ending turn
    // This allows players to freely organize tiles during their turn
    
    // Mark that player has manipulated tiles this turn (necessary for end turn validation)
    if (jokerChange.manipulated) {
      currentPlayer.hasManipulatedJoker = true;
    }
    
    // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
    console.log('🐛 [SERVER DEBUG] Broadcasting game state update:', {
      currentPlayerHandSize: currentPlayer.hand.length,
      currentPlayerTileIds: currentPlayer.hand.map(t => t.id),
      boardTileCount: game.board.flat().length
    });
    // 🐛 END DEBUG LOGGING
    
    // Send updated game state to all players
    game.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        // Send a complete game state update instead of just boardUpdated
        // This ensures clients have the latest hand and board state
        playerSocket.emit('gameStateUpdate', {
          gameState: game.getGameState(player.id)
        });
      }
    });
  });

  socket.on('updatePlayerHand', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Only allow current player to update their hand
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    console.log(`🎮 ${currentPlayer.name} updated their hand - now has ${data.newHand.length} tiles`);
    
    // Update the player's hand
    currentPlayer.hand = data.newHand;
    
    // If board data is provided, update the board too
    if (data.board) {
      game.updateBoard(data.board);
      
      // Ensure the board snapshot exists for the first move in a turn
      if (!game.boardSnapshot) {
        game.boardSnapshot = JSON.parse(JSON.stringify(game.board));
        console.log('🎮 Created initial board snapshot for this turn');
      }
    }
    
    // Send updated game state to all players
    game.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('gameStateUpdate', {
          gameState: game.getGameState(player.id)
        });
      }
    });
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

  socket.on('disconnect', async () => {
    // Update user online status if they were authenticated
    if (socket.user && !socket.user.isGuest) {
      try {
        await User.findByIdAndUpdate(socket.user.id, {
          isOnline: false,
          lastSeen: new Date()
        });
        console.log(`🔌 User ${socket.user.username} disconnected, updated online status`);
      } catch (error) {
        console.error('Error updating user offline status:', error);
      }
    }
    
    const playerData = players.get(socket.id);
    if (playerData) {
      const game = games.get(playerData.gameId);
      if (game) {
        // If it's a bot game and a human player disconnects, terminate the game immediately
        if (game.isBotGame && !socket.id.startsWith('bot_')) {
          console.log(`Human player left bot game ${playerData.gameId}, terminating game`);
          games.delete(playerData.gameId);
        } else {
          // For multiplayer games, mark the player as disconnected but don't remove them
          // This gives them a chance to reconnect
          const player = game.players.find(p => p.id === socket.id);
          if (player) {
            console.log(`Player ${player.name} disconnected from game ${playerData.gameId}, marking as disconnected`);
            player.disconnected = true;
            player.disconnectedAt = Date.now();
            
            // Update MongoDB after 30 seconds to reflect the disconnection in the available games list
            setTimeout(() => {
              if (games.has(playerData.gameId)) {
                const currentGame = games.get(playerData.gameId);
                currentGame.updateGamePlayersInDB();
              }
            }, 30000); // 30 seconds delay
          }
          
          // Notify other players
          io.to(playerData.gameId).emit('playerLeft', {
            playerName: playerData.playerName,
            gameState: game.getGameState(socket.id)
          });
          
          // Trigger immediate cleanup check for the game
          setTimeout(() => {
            if (games.has(playerData.gameId)) {
              const currentGame = games.get(playerData.gameId);
              const shouldClose = currentGame.cleanupDisconnectedPlayers();
              if (shouldClose) {
                // Game should be closed, trigger global cleanup
                cleanupClosedGames();
              }
            }
          }, 5000); // 5 seconds delay to allow for quick reconnections
        }
      }
      
      // Keep the player mapping for potential reconnection
      console.log(`Player disconnected: ${playerData.playerName} (socket mapping will be removed)`);
      players.delete(socket.id);
    }
  });

  // Handle reconnection attempts
  socket.on('reconnect_attempt', async () => {
    console.log(`Player ${socket.id} attempting to reconnect`);
  });

  socket.on('rejoinGame', async (data) => {
    // Use authenticated username if available, otherwise use provided name
    const playerName = (socket.user && !socket.user.isGuest) ? socket.user.username : data.playerName;
    console.log(`Player ${socket.id} attempting to rejoin game ${data.gameId} as ${playerName}`);
    
    // Validate that we have a proper gameId
    if (!data.gameId || data.gameId === "UNDEFINED" || data.gameId === "undefined") {
      socket.emit('error', { message: 'Invalid game ID for reconnection' });
      return;
    }
    
    // First try to get the game from in-memory cache
    let game = games.get(data.gameId);
    
    // If not found in memory, try to find it in MongoDB
    if (!game) {
      try {
        const dbGame = await Game.findOne({ gameId: data.gameId });
        
        if (dbGame && !dbGame.endTime) {
          // If found in DB and not ended, create a new in-memory game with the same ID
          console.log(`Found game ${data.gameId} in MongoDB, restoring to memory for reconnection`);
          game = new RummikubGame(data.gameId);
          game.isBotGame = dbGame.isBotGame || false;
          games.set(data.gameId, game);
        }
      } catch (error) {
        console.error(`Error loading game from MongoDB for reconnection: ${error.message}`);
      }
    }
    
    // If still not found, return error
    if (!game) {
      socket.emit('error', { message: 'Game not found for reconnection' });
      return;
    }

    // Check if player was already in the game
    const existingPlayer = game.players.find(p => p.name === playerName);
    
    if (existingPlayer) {
      // Update the player's socket ID
      existingPlayer.id = socket.id;
    } else {
      // Add as a new player if not at capacity
      if (!game.addPlayer(socket.id, playerName)) {
        socket.emit('error', { message: 'Game is full, cannot rejoin' });
        return;
      }
    }
    
    // Update player mapping
    players.set(socket.id, { gameId: data.gameId, playerName: playerName });
    
    // Join the socket room
    socket.join(data.gameId);
    
    // Send game state to the reconnected player
    socket.emit('gameJoined', { 
      gameId: data.gameId, 
      gameState: game.getGameState(socket.id),
      reconnected: true
    });
    
    // Notify other players
    socket.to(data.gameId).emit('playerReconnected', {
      playerName: data.playerName,
      gameState: game.getGameState(socket.id)
    });
    
    console.log(`Player ${data.playerName} successfully rejoined game ${data.gameId}`);
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
      
      // Check if the game was properly completed (not abandoned)
      const isGameCompleted = game && game.winner && !isGameAbandoned(game.winner);
      
      // Only update stats for properly completed multiplayer games
      if (!isComputerGame && isGameCompleted) {
        console.log(`Recording stats for completed multiplayer game ${gameId}`);
        
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
      } else if (isComputerGame) {
        console.log(`Skipping stats update for bot game ${gameId}`);
      } else if (!isGameCompleted) {
        console.log(`Skipping stats update for abandoned/incomplete game ${gameId}: ${game?.winner || 'no winner'}`);
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

  socket.on('moveFromBoardToHand', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Check if it's the player's turn using getCurrentPlayer method
    const currentPlayer = game.getCurrentPlayer();
    const player = game.players.find(p => p.id === socket.id);
    if (!player || currentPlayer.id !== player.id) {
      socket.emit('error', { message: 'Not your turn!' });
      return;
    }

    console.log(`🔄 ${player.name} moving tile from board to hand:`, data.tile);

    // Make sure we're working with a valid tile and indices
    if (!data.tile || data.sourceSetIndex === undefined || data.sourceTileIndex === undefined) {
      socket.emit('error', { message: 'Invalid tile data!' });
      return;
    }

    // Properly update the board by removing the tile at the specified position
    try {
      if (game.board[data.sourceSetIndex] && 
          game.board[data.sourceSetIndex][data.sourceTileIndex]) {
        
        // Remove tile from specified position
        game.board[data.sourceSetIndex].splice(data.sourceTileIndex, 1);
        
        // Clean up empty sets
        game.board = game.board.filter(set => set.length > 0);
        
        // Add tile to player's hand (safe copy to prevent references)
        const tileCopy = JSON.parse(JSON.stringify(data.tile));
        player.hand.push(tileCopy);
        
        // Broadcast updated game state to each player with their respective game state
        game.players.forEach(p => {
          const playerSocket = io.sockets.sockets.get(p.id);
          if (playerSocket) {
            playerSocket.emit('gameStateUpdate', {
              gameState: game.getGameState(p.id)
            });
          }
        });
      } else {
        socket.emit('error', { message: 'Invalid board position!' });
      }
    } catch (err) {
      console.error("Error in moveFromBoardToHand:", err);
      socket.emit('error', { message: 'Error processing move!' });
    }
  });

  socket.on('requestUndoTurn', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;
    
    // Only allow current player to undo
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    // Track tiles that need to be returned to the player's hand
    // Compare current board with snapshot to find tiles that were moved from hand to board
    const currentTileIds = new Set();
    const snapshotTileIds = new Set();
    
    // Collect all tile IDs currently on the board
    game.board.forEach(set => {
      set.forEach(tile => {
        currentTileIds.add(tile.id);
      });
    });
    
    // Collect all tile IDs that were on the board at the beginning of the turn
    game.boardSnapshot.forEach(set => {
      set.forEach(tile => {
        snapshotTileIds.add(tile.id);
      });
    });
    
    // Find tiles that are on the board now but weren't in the snapshot
    // These need to be returned to the player's hand
    const tilesToReturn = [];
    currentTileIds.forEach(tileId => {
      if (!snapshotTileIds.has(tileId)) {
        // Find the tile in the current board
        for (const set of game.board) {
          const tileIndex = set.findIndex(t => t.id === tileId);
          if (tileIndex !== -1) {
            tilesToReturn.push(set[tileIndex]);
            break;
          }
        }
      }
    });
    
    // Restore the board to the snapshot taken at the beginning of turn
    game.restoreFromSnapshot();
    
    // Return the identified tiles to the player's hand
    tilesToReturn.forEach(tile => {
      currentPlayer.hand.push(tile);
    });
    
    // Reset any turn-specific flags
    currentPlayer.hasManipulatedJoker = false;
    
    // Send updated game state (including hand and board) to all players
    game.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('gameStateUpdate', {
          gameState: game.getGameState(player.id)
        });
      }
    });
    
    console.log(`🔄 ${currentPlayer.name} undid their turn, returned ${tilesToReturn.length} tiles to hand`);
  });
  
  socket.on('validateBoard', (data) => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Use the appropriate validation mode - strict for end turn, relaxed during turn
    const isEndTurn = data?.isEndTurn || false;
    const validation = game.validateBoardState(isEndTurn);
    socket.emit('boardValidation', validation);
  });

  socket.on('restoreBoard', () => {
    const playerData = players.get(socket.id);
    if (!playerData) return;

    const game = games.get(playerData.gameId);
    if (!game) return;

    // Only allow current player to restore board
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    game.restoreFromSnapshot();
    
    // Send updated game state to all players
    game.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('boardRestored', {
          gameState: game.getGameState(player.id)
        });
      }
    });
  });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'netlify-build', 'index.html'));
});

// Game Lifecycle Management - Global cleanup functions

// Function to clean up closed games from the games map
function cleanupClosedGames() {
  const closedGames = [];
  
  for (const [gameId, game] of games.entries()) {
    if (game.closed) {
      closedGames.push(gameId);
    } else {
      // Also check if cleanup methods indicate the game should close
      const shouldClose = game.cleanupDisconnectedPlayers();
      if (shouldClose) {
        closedGames.push(gameId);
      }
    }
  }
  
  // Remove closed games from the map
  closedGames.forEach(gameId => {
    const game = games.get(gameId);
    if (game) {
      console.log(`🗑️ Removing closed game ${gameId} from memory: ${game.closeReason || 'Unknown reason'}`);
      
      // Notify any remaining players
      game.players.forEach(player => {
        if (!player.disconnected) {
          const socket = io.sockets.sockets.get(player.id);
          if (socket) {
            socket.emit('gameEnded', {
              reason: game.closeReason || 'Game closed',
              message: 'This game has been closed due to inactivity or timeout.'
            });
          }
        }
      });
      
      // Remove from players map
      players.forEach((playerData, socketId) => {
        if (playerData.gameId === gameId) {
          players.delete(socketId);
        }
      });
    }
    
    games.delete(gameId);
  });
  
  if (closedGames.length > 0) {
    console.log(`🧹 Cleaned up ${closedGames.length} closed games`);
  }
}

// Run cleanup every 2 minutes
setInterval(cleanupClosedGames, 2 * 60 * 1000);

// Also run cleanup when the disconnect handler is called
const originalCleanupDisconnectedPlayers = RummikubGame.prototype.cleanupDisconnectedPlayers;

// Helper functions
function generateGameId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Server
const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (http://0.0.0.0:${PORT})`);
});
