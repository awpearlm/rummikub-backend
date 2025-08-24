const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure CORS for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000', 
  'http://127.0.0.1:3000',
  'https://jkube.netlify.app', // Your actual Netlify app URL
  'https://*.netlify.app' // Allow any Netlify subdomain
];

const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security and middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'netlify-build')));

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
    console.log(`🎮 Game ${gameId} created, isBotGame: ${isBotGame}`);
    this.initializeDeck();
  }

  initializeDeck() {
    // Create Rummikub tiles: 2 sets of numbers 1-13 in 4 colors, plus 2 jokers
    const colors = ['red', 'blue', 'yellow', 'black'];
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    
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
    
    // Add jokers
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
    
    console.log(`🚀 Starting game ${this.id} with ${this.players.length} players`);
    console.log(`🔧 Debug check: isBotGame=${this.isBotGame}, botDifficulty="${this.botDifficulty}", isDebugMode=${this.isDebugMode}`);
    
    // Check if debug mode should be enabled (either by flag or player name)
    let debugPlayer = null;
    
    // First, check if the game was created with debug mode flag
    if (this.isDebugMode) {
      console.log(`🔧 GAME DEBUG MODE ENABLED via checkbox! Game creator will get debug hand...`);
      debugPlayer = this.players[0]; // First player is the creator
      console.log(`🔧 Game creator is: ${debugPlayer.name}`);
    } 
    
    // If no debug mode flag, check for debug player names
    if (!debugPlayer) {
      console.log(`🔧 DEBUG CHECK - Searching for 'dbug' or 'debug' in player names...`);
      
      // Try different debugging approaches
      const debugPatterns = ['dbug', 'debug'];
      
      for (const pattern of debugPatterns) {
        for (const player of this.players) {
          const playerNameLower = String(player.name).toLowerCase().trim();
          const isMatch = playerNameLower === pattern;
          console.log(`🔧 Checking player "${player.name}" against "${pattern}": ${isMatch}`);
          
          if (isMatch) {
            debugPlayer = player;
            console.log(`🔧 DEBUG PLAYER FOUND: "${player.name}" matches pattern "${pattern}"`);
            break;
          }
        }
        if (debugPlayer) break;
      }
    }

    console.log(`🔧 Debug player found:`, debugPlayer ? debugPlayer.name : "NONE");
    
    // Deal tiles based on bot difficulty or debug player
    if (this.isBotGame && this.botDifficulty === 'debug') {
      console.log(`🔧 DEBUG MODE DETECTED! Calling dealDebugHand...`);
      // Debug mode: Give human player a preset hand for testing
      this.dealDebugHand();
    } else if (debugPlayer) {
      console.log(`🔧 MULTIPLAYER DEBUG MODE DETECTED! Player "${debugPlayer.name}" gets winning hand...`);
      // Multiplayer debug mode: Give debug player a winning hand
      this.dealMultiplayerDebugHand(debugPlayer);
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
      { id: 'joker_1', color: null, number: null, isJoker: true },
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
    
    // Give debug tiles to human player (exactly 15 tiles for perfect win)
    humanPlayer.hand = [...debugTiles];
    console.log(`🔧 Gave debug tiles to ${humanPlayer.name}: ${humanPlayer.hand.length} tiles`);
    
    console.log(`🔧 Final human hand size: ${humanPlayer.hand.length}`);
    console.log(`🔧 Human hand sets: 3×13s (${debugTiles.slice(0,3).map(t => t.color).join(', ')}), red 1-2-3, blue 4-5-6, 3×7s, 2×10s+joker`);
    
    // Give bot normal random hand
    for (let i = 0; i < 14; i++) {
      if (this.deck.length > 0) {
        botPlayer.hand.push(this.deck.pop());
      }
    }
    
    console.log(`🔧 Debug mode: Human player given perfect win hand (5 sets = instant win)`);
  }

  drawTile(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.deck.length === 0) return null;
    
    const tile = this.deck.pop();
    player.hand.push(tile);
    
    // Log the action
    this.addGameLogEntry(playerId, 'drew_tile', `${this.deck.length + 1} tiles left`);
    
    return tile;
  }

  isValidSet(tiles) {
    if (tiles.length < 3) return false;
    
    // Check if it's a run (consecutive numbers, same color)
    const isRun = this.isValidRun(tiles);
    if (isRun) return true;
    
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
    if (tiles.length < 3 || tiles.length > 4) return false;
    
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    // Need at least one real tile to determine the group number
    if (nonJokers.length === 0) return false;
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) return false;
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) return false;
    
    // Check if we can form a valid group with jokers
    const targetNumber = numbers[0];
    const usedColors = new Set(colors);
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    // We need enough remaining colors for the jokers
    if (jokerCount > remainingColors.length) return false;
    
    // Groups can have at most 4 tiles (one of each color)
    if (nonJokers.length + jokerCount > 4) return false;
    
    return true;
  }

  calculateSetValue(tiles) {
    let totalValue = 0;
    const nonJokerTiles = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.filter(t => t.isJoker).length;
    
    if (this.isValidGroup(tiles)) {
      // Group: same number, different colors
      if (nonJokerTiles.length > 0) {
        const groupNumber = nonJokerTiles[0].number;
        // All tiles (including jokers) are worth the group number
        totalValue = groupNumber * tiles.length;
      }
    } else if (this.isValidRun(tiles)) {
      // Run: consecutive numbers, same color
      // Need to determine what number each joker represents
      totalValue = this.calculateRunValueWithJokers(tiles);
    }
    
    return totalValue;
  }

  calculateRunValueWithJokers(tiles) {
    const nonJokers = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.filter(t => t.isJoker).length;
    
    if (jokerCount === 0) {
      // Simple case: just sum the tile values
      return nonJokers.reduce((sum, tile) => sum + tile.number, 0);
    }
    
    // Find the valid sequence that these tiles represent
    const sortedNumbers = nonJokers.map(t => t.number).sort((a, b) => a - b);
    const minNumber = sortedNumbers[0];
    const totalTiles = tiles.length;
    
    // Try different starting positions to find the valid sequence
    for (let start = Math.max(1, minNumber - jokerCount); start <= minNumber; start++) {
      const end = start + totalTiles - 1;
      if (end > 13) continue;
      
      // Check if this sequence works with our tiles
      let jokersUsed = 0;
      let realTileIndex = 0;
      let valid = true;
      let sequenceValue = 0;
      
      for (let pos = start; pos <= end; pos++) {
        sequenceValue += pos; // Add this number to total value
        
        if (realTileIndex < sortedNumbers.length && sortedNumbers[realTileIndex] === pos) {
          realTileIndex++;
        } else {
          jokersUsed++;
          if (jokersUsed > jokerCount) {
            valid = false;
            break;
          }
        }
      }
      
      if (valid && realTileIndex === sortedNumbers.length && jokersUsed === jokerCount) {
        return sequenceValue;
      }
    }
    
    // Fallback: shouldn't happen if isValidRun worked correctly
    console.warn('Could not determine joker values in run, using fallback calculation');
    let fallbackValue = nonJokers.reduce((sum, tile) => sum + tile.number, 0);
    if (nonJokers.length > 0) {
      const avgValue = fallbackValue / nonJokers.length;
      fallbackValue += jokerCount * Math.round(avgValue);
    }
    return fallbackValue;
  }
  playSet(playerId, tileIds, setIndex = null) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.getCurrentPlayer().id) return false;
    
    const tiles = tileIds.map(id => player.hand.find(t => t.id === id)).filter(Boolean);
    if (tiles.length !== tileIds.length) return false;
    
    if (!this.isValidSet(tiles)) return false;
    
    // Check initial 30-point requirement
    if (!player.hasPlayedInitial) {
      const setValue = this.calculateSetValue(tiles);
      if (setValue < 30) {
        return false; // Not enough points for initial play
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
    
    // Log the action
    const setValue = this.calculateSetValue(tiles);
    this.addGameLogEntry(playerId, 'played_set', `${tiles.length} tiles (${setValue} points)`);
    
    player.hasPlayedInitial = true;
    
    // Check for win
    if (player.hand.length === 0) {
      this.winner = player;
    }
    
    return true;
  }

  // New method to handle multiple sets for initial play
  playMultipleSets(playerId, setArrays) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.getCurrentPlayer().id) return false;
    
    // Validate all sets first
    const validatedSets = [];
    let totalValue = 0;
    
    for (const tileIds of setArrays) {
      const tiles = tileIds.map(id => player.hand.find(t => t.id === id)).filter(Boolean);
      if (tiles.length !== tileIds.length) return false;
      
      if (!this.isValidSet(tiles)) return false;
      
      const setValue = this.calculateSetValue(tiles);
      totalValue += setValue;
      validatedSets.push({ tiles, setValue });
    }
    
    // Check initial 30-point requirement for combined sets
    if (!player.hasPlayedInitial && totalValue < 30) {
      return false; // Combined sets don't meet 30-point requirement
    }
    
    // All sets are valid, now execute the play
    validatedSets.forEach(({ tiles, setValue }) => {
      // Remove tiles from player's hand
      tiles.forEach(tile => {
        const index = player.hand.findIndex(t => t.id === tile.id);
        if (index !== -1) {
          player.hand.splice(index, 1);
        }
      });
      
      // Add to board
      this.board.push(tiles);
      
      // Log the action
      this.addGameLogEntry(playerId, 'played_set', `${tiles.length} tiles (${setValue} points)`);
    });
    
    player.hasPlayedInitial = true;
    
    // Check for win
    if (player.hand.length === 0) {
      this.winner = player;
    }
    
    return { success: true, totalValue, setsPlayed: validatedSets.length };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      console.log(`⏭️  ${currentPlayer.name} ends turn`);
      this.addGameLogEntry(currentPlayer.id, 'ended_turn', '');
    }
    
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    
    const newPlayer = this.getCurrentPlayer();
    if (newPlayer) {
      console.log(`▶️  ${newPlayer.name} starts turn`);
      this.addGameLogEntry(newPlayer.id, 'started_turn', '');
      
      // Take a snapshot of the board state at the start of the new turn
      this.takeBoardSnapshot();
      
      // Start the turn timer if enabled
      if (this.timerEnabled) {
        this.startTurnTimer();
      }
    }
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
    
    // Restore board to snapshot (undo any uncommitted moves)
    this.restoreBoardSnapshot();
    
    // Draw a tile for the player
    this.drawTileForPlayer(currentPlayer.id);
    
    // Add to game log
    this.addGameLogEntry(currentPlayer.id, 'time_up', 'Drew tile automatically');
    
    // Move to next player
    this.nextTurn();
    
    // Broadcast updated game state
    io.to(this.id).emit('turnEnded', {
      gameState: this.getPublicGameState(),
      message: `Time's up for ${currentPlayer.name}! Drew a tile and ended turn.`
    });
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
    
    // Keep only last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages.splice(0, this.chatMessages.length - 100);
    }
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
    
    // Keep only last 50 log entries
    if (this.gameLog.length > 50) {
      this.gameLog.splice(0, this.gameLog.length - 50);
    }
  }
  
  // Method to find a tile by ID anywhere in the game (hand or board)
  getTileById(tileId) {
    // Look in players' hands
    for (const player of this.players) {
      const tile = player.hand.find(t => t.id === tileId);
      if (tile) return tile;
    }
    
    // Look on the board
    for (const set of this.board) {
      const tile = set.find(t => t.id === tileId);
      if (tile) return tile;
    }
    
    // Look in the deck (though this isn't likely to be found)
    const tile = this.deck.find(t => t.id === tileId);
    if (tile) return tile;
    
    return null;
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

  // Board management and validation
  takeBoardSnapshot() {
    // Deep copy the current board state
    this.boardSnapshot = JSON.parse(JSON.stringify(this.board));
    console.log(`📸 Board snapshot taken: ${this.boardSnapshot.length} sets`);
  }

  restoreFromSnapshot() {
    // Restore board to snapshot state
    this.board = JSON.parse(JSON.stringify(this.boardSnapshot));
    console.log(`🔄 Board restored from snapshot: ${this.board.length} sets`);
  }

  updateBoard(newBoard) {
    // Update the board with new arrangement
    this.board = newBoard;
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

  validateBoardState(isEndTurn = true) {
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
    
    // During a turn, allow 1-2 tile "partial" sets as long as they could potentially be valid
    if (tiles.length < 3) {
      // Allow any combination of 1-2 tiles during a turn
      return true;
    }
    
    // For 3+ tiles, check if they form a valid set
    return this.isValidSet(tiles);
  }

  // Bot AI Logic
  makeBotMove() {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.isBot) return null;

    // Initialize consecutive draw counter if not exists
    if (currentPlayer.consecutiveDraws === undefined) {
      currentPlayer.consecutiveDraws = 0;
    }

    console.log(`Bot ${currentPlayer.name} making move. Hand size: ${currentPlayer.hand.length}, hasPlayedInitial: ${currentPlayer.hasPlayedInitial}, consecutiveDraws: ${currentPlayer.consecutiveDraws}`);

    // STRATEGY 1: Play a complete set from hand
    if (this.tryPlayCompleteSet(currentPlayer)) {
      // Reset consecutive draws counter when successfully playing tiles
      currentPlayer.consecutiveDraws = 0;
      return {
        type: 'playSet',
        description: 'played a set from hand'
      };
    }

    // STRATEGY 2: Play tiles on existing board sets if the board has sets
    if (this.board.length > 0 && this.tryPlayOnExistingSets(currentPlayer)) {
      // Reset consecutive draws counter when successfully playing tiles
      currentPlayer.consecutiveDraws = 0;
      return {
        type: 'playSet',
        description: 'added to existing set'
      };
    }

    // STRATEGY 3: If bot has drawn too many consecutive tiles (3+), 
    // make a more aggressive play attempt or rearrange board
    if (currentPlayer.consecutiveDraws >= 3) {
      if (this.tryAggressivePlay(currentPlayer)) {
        // Reset consecutive draws counter when successfully playing tiles
        currentPlayer.consecutiveDraws = 0;
        return {
          type: 'playSet',
          description: 'made an aggressive play'
        };
      }
    }

    // STRATEGY 4: If can't play, draw a tile
    console.log(`Bot attempting to draw tile. Deck size: ${this.deck.length}`);
    const drawnTile = this.drawTile(currentPlayer.id);
    if (drawnTile) {
      // Increment consecutive draws counter
      currentPlayer.consecutiveDraws++;
      console.log(`Bot drew tile: ${drawnTile.color}_${drawnTile.number || 'joker'}, consecutive draws: ${currentPlayer.consecutiveDraws}`);
      return {
        type: 'drawTile',
        description: 'drew a tile'
      };
    } else {
      console.log(`Bot failed to draw tile - deck empty or other error`);
    }

    return null;
  }
  
  tryPlayCompleteSet(player) {
    // Find and play complete sets from hand
    const possibleSets = this.findPossibleSets(player.hand);
    
    // Filter sets that meet initial play requirements if needed
    const validSets = player.hasPlayedInitial 
      ? possibleSets 
      : possibleSets.filter(set => this.calculateSetValue(set) >= 30);
    
    console.log(`Found ${possibleSets.length} possible sets, ${validSets.length} valid for initial play`);
    
    if (validSets.length > 0) {
      // Choose the best set based on difficulty
      const setToPlay = this.chooseBestSet(validSets);
      console.log(`Attempting to play set:`, setToPlay?.map(t => `${t.color}_${t.number}`));
      
      if (setToPlay && this.playSet(player.id, setToPlay.map(t => t.id))) {
        console.log(`Bot successfully played set`);
        return true;
      } else {
        console.log(`Bot failed to play set`);
      }
    }
    
    return false;
  }
  
  calculateSetValue(set) {
    return set.reduce((sum, tile) => sum + (tile.isJoker ? 0 : tile.number), 0);
  }
  
  tryPlayOnExistingSets(player) {
    // Don't try this strategy if the player hasn't made their initial play
    if (!player.hasPlayedInitial) return false;
    
    // Go through each tile in the player's hand
    for (const tile of player.hand) {
      // Skip jokers for this simple strategy (we'll use them in aggressive play)
      if (tile.isJoker) continue;
      
      // Check each set on the board
      for (let setIndex = 0; setIndex < this.board.length; setIndex++) {
        const boardSet = this.board[setIndex];
        
        // Try to add the tile to the beginning or end of run sets
        if (this.isValidRun(boardSet)) {
          const testBeginning = [tile, ...boardSet];
          if (this.isValidRun(testBeginning)) {
            console.log(`Bot adding tile ${tile.color}_${tile.number} to beginning of run`);
            // Add the tile to the set
            if (this.playSet(player.id, [tile.id], setIndex)) {
              return true;
            }
          }
          
          const testEnd = [...boardSet, tile];
          if (this.isValidRun(testEnd)) {
            console.log(`Bot adding tile ${tile.color}_${tile.number} to end of run`);
            // Add the tile to the set
            if (this.playSet(player.id, [tile.id], setIndex)) {
              return true;
            }
          }
        }
        
        // Try to add to group sets
        if (this.isValidGroup(boardSet) && boardSet.length < 4) {
          const testGroup = [...boardSet, tile];
          if (this.isValidGroup(testGroup)) {
            console.log(`Bot adding tile ${tile.color}_${tile.number} to group`);
            // Add the tile to the set
            if (this.playSet(player.id, [tile.id], setIndex)) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }
  
  tryAggressivePlay(player) {
    // This is a more aggressive strategy when the bot has been drawing too many tiles
    console.log(`Bot making aggressive play attempt after ${player.consecutiveDraws} consecutive draws`);
    
    // STRATEGY 1: Use jokers more aggressively
    const jokers = player.hand.filter(t => t.isJoker);
    const nonJokers = player.hand.filter(t => !t.isJoker);
    
    if (jokers.length > 0 && this.board.length > 0 && player.hasPlayedInitial) {
      // Try to add jokers to existing sets
      for (let setIndex = 0; setIndex < this.board.length; setIndex++) {
        const boardSet = this.board[setIndex];
        
        // Add joker to a run
        if (this.isValidRun(boardSet)) {
          const jokerTile = jokers[0];
          const testEnd = [...boardSet, jokerTile];
          
          if (this.isValidRun(testEnd)) {
            console.log(`Bot adding joker to end of run`);
            if (this.playSet(player.id, [jokerTile.id], setIndex)) {
              return true;
            }
          }
        }
        
        // Add joker to a group
        if (this.isValidGroup(boardSet) && boardSet.length < 4) {
          const jokerTile = jokers[0];
          const testGroup = [...boardSet, jokerTile];
          
          if (this.isValidGroup(testGroup)) {
            console.log(`Bot adding joker to group`);
            if (this.playSet(player.id, [jokerTile.id], setIndex)) {
              return true;
            }
          }
        }
      }
    }
    
    // STRATEGY 2: Look for pairs of tiles that could make a set with a joker
    if (jokers.length > 0 && nonJokers.length >= 2) {
      // Check for pairs of same color, consecutive numbers
      for (let i = 0; i < nonJokers.length - 1; i++) {
        for (let j = i + 1; j < nonJokers.length; j++) {
          const tile1 = nonJokers[i];
          const tile2 = nonJokers[j];
          
          // Same color, one number apart
          if (tile1.color === tile2.color && Math.abs(tile1.number - tile2.number) === 2) {
            const testSet = [tile1, tile2, jokers[0]].sort((a, b) => 
              a.isJoker ? 0 : b.isJoker ? 0 : a.number - b.number
            );
            
            if (this.isValidSet(testSet)) {
              // Try to play this set if it meets initial play requirements
              if (!player.hasPlayedInitial && this.calculateSetValue(testSet) < 30) {
                continue;
              }
              
              console.log(`Bot creating run with joker: ${testSet.map(t => t.isJoker ? 'joker' : `${t.color}_${t.number}`).join(', ')}`);
              if (this.playSet(player.id, testSet.map(t => t.id))) {
                return true;
              }
            }
          }
          
          // Same number, different colors
          if (tile1.number === tile2.number && tile1.color !== tile2.color) {
            const testSet = [tile1, tile2, jokers[0]];
            
            if (this.isValidSet(testSet)) {
              // Try to play this set if it meets initial play requirements
              if (!player.hasPlayedInitial && this.calculateSetValue(testSet) < 30) {
                continue;
              }
              
              console.log(`Bot creating group with joker: ${testSet.map(t => t.isJoker ? 'joker' : `${t.color}_${t.number}`).join(', ')}`);
              if (this.playSet(player.id, testSet.map(t => t.id))) {
                return true;
              }
            }
          }
        }
      }
    }
    
    // If all else fails but we have two jokers, try to play them with any tile
    if (jokers.length >= 2 && nonJokers.length >= 1 && player.hasPlayedInitial) {
      const tile = nonJokers[0];
      const testSet = [tile, jokers[0], jokers[1]];
      
      console.log(`Bot making desperate play with 2 jokers and ${tile.color}_${tile.number}`);
      if (this.playSet(player.id, testSet.map(t => t.id))) {
        return true;
      }
    }
    
    return false;
  }

  findPossibleSets(hand) {
    const sets = [];
    
    // Group tiles by color and number for faster analysis
    const tilesByColor = {};
    const tilesByNumber = {};
    const jokers = hand.filter(t => t.isJoker);
    
    // Organize tiles by color and number
    for (const tile of hand) {
      if (tile.isJoker) continue;
      
      if (!tilesByColor[tile.color]) {
        tilesByColor[tile.color] = [];
      }
      tilesByColor[tile.color].push(tile);
      
      if (!tilesByNumber[tile.number]) {
        tilesByNumber[tile.number] = [];
      }
      tilesByNumber[tile.number].push(tile);
    }
    
    // Sort tiles within each color by number
    for (const color in tilesByColor) {
      tilesByColor[color].sort((a, b) => a.number - b.number);
    }
    
    // 1. Find runs (same color, consecutive numbers)
    for (const color in tilesByColor) {
      const colorTiles = tilesByColor[color];
      
      // Try all possible starting positions for runs
      for (let start = 0; start < colorTiles.length; start++) {
        let currentRun = [colorTiles[start]];
        let lastNumber = colorTiles[start].number;
        
        // Add consecutive numbers to the run
        for (let j = start + 1; j < colorTiles.length; j++) {
          if (colorTiles[j].number === lastNumber + 1) {
            currentRun.push(colorTiles[j]);
            lastNumber = colorTiles[j].number;
          } else if (colorTiles[j].number > lastNumber + 1) {
            // Gap detected, check if we can use jokers to bridge it
            const gap = colorTiles[j].number - lastNumber - 1;
            if (jokers.length >= gap) {
              // We have enough jokers to fill the gap
              for (let k = 0; k < gap; k++) {
                currentRun.push(jokers[k]);
              }
              currentRun.push(colorTiles[j]);
              lastNumber = colorTiles[j].number;
            } else {
              // Not enough jokers, end the run
              break;
            }
          }
        }
        
        // Add valid runs (3+ tiles)
        if (currentRun.length >= 3) {
          sets.push([...currentRun]);
          
          // Also add subsets of the run (if 4+ tiles)
          if (currentRun.length > 3) {
            for (let i = 0; i < currentRun.length - 2; i++) {
              for (let j = i + 3; j <= currentRun.length; j++) {
                const subset = currentRun.slice(i, j);
                if (subset.length >= 3 && subset.length !== currentRun.length) {
                  sets.push([...subset]);
                }
              }
            }
          }
        }
      }
    }
    
    // 2. Find groups (same number, different colors)
    for (const number in tilesByNumber) {
      const numberTiles = tilesByNumber[number];
      
      // If we have 3 or 4 tiles of same number
      if (numberTiles.length >= 3 && numberTiles.length <= 4) {
        // Check that they're all different colors
        const colors = new Set(numberTiles.map(t => t.color));
        if (colors.size === numberTiles.length) {
          sets.push([...numberTiles]);
        }
      }
      
      // If we have 2 tiles of same number but different colors and at least 1 joker
      if (numberTiles.length === 2 && jokers.length >= 1) {
        const colors = new Set(numberTiles.map(t => t.color));
        if (colors.size === 2) {
          sets.push([...numberTiles, jokers[0]]);
        }
      }
    }
    
    // 3. Check all possible combinations of 3+ tiles (traditional approach)
    // This catches sets that might have been missed by the optimized approaches above
    for (let i = 0; i < hand.length - 2; i++) {
      for (let j = i + 1; j < hand.length - 1; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          const testSet = [hand[i], hand[j], hand[k]];
          if (this.isValidSet(testSet) && !this.isDuplicateSet(sets, testSet)) {
            sets.push(testSet);
            
            // Try adding more tiles to this set
            for (let l = k + 1; l < hand.length; l++) {
              const extendedSet = [...testSet, hand[l]];
              if (this.isValidSet(extendedSet) && !this.isDuplicateSet(sets, extendedSet)) {
                sets.push(extendedSet);
              }
            }
          }
        }
      }
    }
    
    return sets;
  }
  
  isDuplicateSet(existingSets, newSet) {
    // Check if a set with the same tiles already exists
    const newSetIds = new Set(newSet.map(t => t.id));
    
    for (const existingSet of existingSets) {
      if (existingSet.length !== newSet.length) continue;
      
      const existingSetIds = new Set(existingSet.map(t => t.id));
      
      // Check if all IDs match
      let allMatch = true;
      for (const id of newSetIds) {
        if (!existingSetIds.has(id)) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) return true;
    }
    
    return false;
  }

  chooseBestSet(possibleSets) {
    if (possibleSets.length === 0) return null;

    const currentPlayer = this.getCurrentPlayer();
    const needsInitial = currentPlayer && !currentPlayer.hasPlayedInitial;

    // Sort sets by value and pick based on difficulty and initial play requirements
    const sortedSets = possibleSets.sort((a, b) => {
      const valueA = a.reduce((sum, tile) => sum + (tile.isJoker ? 0 : tile.number), 0);
      const valueB = b.reduce((sum, tile) => sum + (tile.isJoker ? 0 : tile.number), 0);
      
      // If player needs to make initial play, prioritize sets >= 30 points
      if (needsInitial) {
        if (valueA >= 30 && valueB < 30) return -1;
        if (valueA < 30 && valueB >= 30) return 1;
      }
      
      // For normal play or tie-breaking initial plays
      return valueB - valueA; // Highest value first
    });

    // Filter out sets that don't meet initial play requirements if needed
    const validSets = needsInitial 
      ? sortedSets.filter(set => this.calculateSetValue(set) >= 30)
      : sortedSets;
    
    if (validSets.length === 0) return null;

    switch (this.botDifficulty) {
      case 'easy':
        // Easy bot plays randomly or lower value sets
        // But still respects initial play requirements
        return validSets[Math.floor(Math.random() * Math.min(3, validSets.length))];
      case 'hard':
        // Hard bot always plays the best set
        return validSets[0];
      default: // medium
        // Medium bot plays good sets but not always optimal
        const topSets = validSets.slice(0, Math.min(2, validSets.length));
        return topSets[Math.floor(Math.random() * topSets.length)];
    }
  }

  scheduleNextBotMove(io, gameId, delay = 4000) {
    console.log(`🔍 scheduleNextBotMove called for game ${gameId}, isBotGame: ${this.isBotGame}, started: ${this.started}, winner: ${!!this.winner}`);
    
    if (!this.isBotGame || !this.started || this.winner) return;
    
    setTimeout(() => {
      const currentPlayer = this.getCurrentPlayer();
      console.log(`⏰ Bot move timeout executed, current player: ${currentPlayer?.name}, isBot: ${currentPlayer?.isBot}`);
      
      if (currentPlayer && currentPlayer.isBot) {
        const botMove = this.makeBotMove();
        
        if (botMove) {
          console.log(`🤖 Bot ${currentPlayer.name} ${botMove.description}`);
          
          // Check for bot win first, before sending updates
          if (this.winner && this.winner.isBot) {
            console.log(`🏆 Bot won! Ending game.`);
            // Send final game state to all players
            this.players.forEach(player => {
              const playerSocket = io.sockets.sockets.get(player.id);
              if (playerSocket) {
                playerSocket.emit('gameWon', {
                  winner: this.winner,
                  gameState: this.getGameState(player.id)
                });
              }
            });
            return; // Don't continue with turn management
          }
          
          // Always end turn after bot move (whether playing set or drawing tile)
          this.nextTurn();
          
          // Send bot move update to all players with their individual game states (after turn advancement)
          this.players.forEach(player => {
            const playerSocket = io.sockets.sockets.get(player.id);
            if (playerSocket) {
              playerSocket.emit('botMove', {
                gameState: this.getGameState(player.id),
                moveDescription: botMove.description
              });
            }
          });
          
          const nextPlayer = this.getCurrentPlayer();
          
          // Only schedule next move if the new current player is also a bot
          if (nextPlayer && nextPlayer.isBot) {
            console.log(`🔄 Scheduling next bot move...`);
            this.scheduleNextBotMove(io, gameId, 3500);
          } else {
            console.log(`👤 Turn passed to human player: ${nextPlayer?.name}`);
          }
        } else {
          console.log(`❌ Bot couldn't make a move`);
        }
      }
    }, delay);
  }

  dealMultiplayerDebugHand(debugPlayer) {
    console.log(`🔧 dealMultiplayerDebugHand called for player: ${debugPlayer.name}`);
    
    // FORCE a specific debug hand regardless of the deck
    const forcedDebugHand = [
      // First set: Three 13s in different colors (39 points)
      { id: 'red_13_0', color: 'red', number: 13, isJoker: false },
      { id: 'blue_13_0', color: 'blue', number: 13, isJoker: false },
      { id: 'yellow_13_0', color: 'yellow', number: 13, isJoker: false },
      
      // Second set: Run in blue (1-2-3)
      { id: 'blue_1_0', color: 'blue', number: 1, isJoker: false },
      { id: 'blue_2_0', color: 'blue', number: 2, isJoker: false },
      { id: 'blue_3_0', color: 'blue', number: 3, isJoker: false },
      
      // Third set: Three 4s in different colors
      { id: 'red_4_0', color: 'red', number: 4, isJoker: false },
      { id: 'blue_4_0', color: 'blue', number: 4, isJoker: false },
      { id: 'yellow_4_0', color: 'yellow', number: 4, isJoker: false },
      
      // Fourth set: Run in black (5-6-7)
      { id: 'black_5_0', color: 'black', number: 5, isJoker: false },
      { id: 'black_6_0', color: 'black', number: 6, isJoker: false },
      { id: 'black_7_0', color: 'black', number: 7, isJoker: false },
      
      // Final set for testing joker bug: Red 10, Red 11, and Joker (joker as Red 12)
      { id: 'red_10_0', color: 'red', number: 10, isJoker: false },
      { id: 'red_11_0', color: 'red', number: 11, isJoker: false },
      { id: 'joker_1', color: null, number: null, isJoker: true }
    ];
    
    console.log(`🔧 Created forced debug hand with ${forcedDebugHand.length} tiles`);
    
    // First, reconstruct a fresh deck to make sure we don't have any conflicts
    this.deck = [];
    this.initializeDeck();
    
    // Remove debug tiles from the deck by ID to prevent duplicates
    forcedDebugHand.forEach(debugTile => {
      const index = this.deck.findIndex(tile => 
        debugTile.isJoker ? tile.isJoker : (tile.color === debugTile.color && tile.number === debugTile.number)
      );
      
      if (index !== -1) {
        this.deck.splice(index, 1);
        console.log(`🔧 Removed similar tile from deck: ${debugTile.color || 'joker'} ${debugTile.number || ''}`);
      }
    });
    
    // Shuffle remaining deck for other players
    this.shuffleDeck();
    console.log(`🔧 Reshuffled deck after removing debug tiles, remaining: ${this.deck.length}`);
    
    // Assign the debug hand to the debug player
    debugPlayer.hand = forcedDebugHand;
    console.log(`🔧 Forced debug hand assigned to ${debugPlayer.name}: ${debugPlayer.hand.length} tiles`);
    console.log(`🔧 Debug hand includes: Red 10, Red 11, Joker (should be Red 12)`);
    
    // Give other players normal random hands from remaining deck
    for (const player of this.players) {
      if (player.id !== debugPlayer.id) {
        player.hand = [];
        for (let i = 0; i < 14; i++) {
          if (this.deck.length > 0) {
            player.hand.push(this.deck.pop());
          }
        }
        console.log(`🔧 Gave ${player.name} normal hand: ${player.hand.length} tiles`);
      }
    }
    
    console.log(`🔧 Multiplayer debug mode: ${debugPlayer.name} given winning hand with joker test case`);
  }
}
// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

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
              gameState: game.getGameState(player.id)
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
            playerSocket.emit('turnEnded', {
              gameState: game.getGameState(player.id)
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
          
          // Notify other players
          io.to(playerData.gameId).emit('playerLeft', {
            playerName: playerData.playerName,
            gameState: game.getGameState(socket.id)
          });
          
          // Clean up empty games
          if (game.players.length === 0) {
            games.delete(playerData.gameId);
          }
        }
        
        players.delete(socket.id);
        console.log(`Player disconnected: ${playerData.playerName}`);
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
      
      // Check if this is the first board update in the turn and create a snapshot
      // This ensures we always have a snapshot to compare against for undo
      if (!game.boardSnapshot) {
        game.boardSnapshot = JSON.parse(JSON.stringify(game.board));
        console.log('🎮 Created initial board snapshot for this turn');
      }
      
      // Find tiles that were moved from hand to board
      // Instead of just looking at added tiles, we'll use an explicit approach
      if (data.tilesFromHand && Array.isArray(data.tilesFromHand) && data.tilesFromHand.length > 0) {
        console.log(`Player ${currentPlayer.name} moved tiles from hand to board:`, data.tilesFromHand);
        
        // Remove these specific tiles from the player's hand
        data.tilesFromHand.forEach(tileId => {
          const tileIndex = currentPlayer.hand.findIndex(t => t.id === tileId);
          if (tileIndex !== -1) {
            currentPlayer.hand.splice(tileIndex, 1);
            console.log(`Removed tile ${tileId} from ${currentPlayer.name}'s hand`);
          }
        });
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
      
      // Send restored board to all players
      game.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.emit('boardRestored', {
            gameState: game.getGameState(player.id)
          });
        }
      });
    });
});  // End of io.on('connection') handler

// Helper functions
function generateGameId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'netlify-build', 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/games/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  if (game) {
    res.json({ exists: true, playerCount: game.players.length, started: game.started });
  } else {
    res.json({ exists: false });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Rummikub game server running on port ${PORT}`);
  console.log(`🌐 Open your browser to http://localhost:${PORT}`);
});
