// Game class for Rummikub game logic
class Game {
  constructor(id, isBotGame = false) {
    this.id = id;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.tilePool = [];
    this.board = []; // Array of sets on the board
    this.boardSnapshot = []; // For storing board state before a move
    this.started = false;
    this.turnTime = 120; // seconds
    this.turnTimeRemaining = 0;
    this.turnTimer = null;
    this.isBotGame = isBotGame;
    this.botDifficulty = 'medium'; // easy, medium, hard
    this.gameLog = [];
    this.chatMessages = [];
    this.initializeTiles();
    
    console.log("Game " + this.id + " created, isBotGame: " + isBotGame);
  }
  
  // Initialize the tile pool with 106 tiles (2 sets of 1-13 in 4 colors + 2 jokers)
  initializeTiles() {
    this.tilePool = [];
    const colors = ['red', 'blue', 'yellow', 'black'];
    
    // Create 2 sets of each colored number tile
    let tileId = 1;
    for (let set = 0; set < 2; set++) {
      for (let color of colors) {
        for (let number = 1; number <= 13; number++) {
          this.tilePool.push({
            id: tileId++,
            color: color,
            number: number,
            isJoker: false
          });
        }
      }
    }
    
    // Add 2 jokers
    this.tilePool.push({
      id: tileId++,
      color: null,
      number: null,
      isJoker: true
    });
    
    this.tilePool.push({
      id: tileId++,
      color: null,
      number: null,
      isJoker: true
    });
    
    // Shuffle the tiles
    this.shuffleTiles();
  }
  
  // Shuffle the tile pool using Fisher-Yates algorithm
  shuffleTiles() {
    for (let i = this.tilePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tilePool[i], this.tilePool[j]] = [this.tilePool[j], this.tilePool[i]];
    }
  }
  
  // Add a player to the game
  addPlayer(playerId, playerName) {
    if (this.started) return false;
    
    // Check if player already exists
    if (this.players.some(p => p.id === playerId)) {
      return false;
    }
    
    // Limit to 4 players
    if (this.players.length >= 4) {
      return false;
    }
    
    this.players.push({
      id: playerId,
      name: playerName,
      hand: [],
      hasPlayedInitialTiles: false,
      connected: true,
      isBot: false
    });
    
    return true;
  }
  
  // Add a bot player to the game
  addBotPlayer(botName = "Bot") {
    if (this.started) return false;
    
    // Limit to 4 players total
    if (this.players.length >= 4) {
      return false;
    }
    
    const botId = "bot-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    
    this.players.push({
      id: botId,
      name: botName,
      hand: [],
      hasPlayedInitialTiles: false,
      connected: true,
      isBot: true
    });
    
    return botId;
  }
  
  // Remove a player from the game
  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;
    
    // If game has started, mark as disconnected instead of removing
    if (this.started) {
      this.players[playerIndex].connected = false;
      
      // If all human players disconnected, end the game
      const anyHumanConnected = this.players.some(p => p.connected && !p.isBot);
      if (!anyHumanConnected) {
        // Game effectively ends
        this.started = false;
      }
      
      // If it was this player's turn, move to next player
      if (playerIndex === this.currentPlayerIndex) {
        this.nextTurn();
      }
      
      return true;
    }
    
    // If game hasn't started, return tiles to pool and remove player
    const playerTiles = this.players[playerIndex].hand;
    this.tilePool.push(...playerTiles);
    this.players.splice(playerIndex, 1);
    
    return true;
  }
  
  // Start the game, deal tiles to players
  startGame() {
    if (this.started || this.players.length < 2) {
      return false;
    }
    
    // Deal 14 tiles to each player
    for (let player of this.players) {
      for (let i = 0; i < 14; i++) {
        if (this.tilePool.length > 0) {
          const tile = this.tilePool.pop();
          player.hand.push(tile);
        }
      }
      
      // Sort the hand by color and number
      this.sortPlayerHand(player.id);
    }
    
    this.started = true;
    this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
    
    // Add game start entry to log
    this.addGameLogEntry(null, 'gameStarted', this.players.map(p => p.name).join(', '));
    
    console.log("Game " + this.id + " started successfully");
    
    // Start turn timer for first player
    this.startTurnTimer();
    
    return true;
  }
  
  // Draw a tile for a player
  drawTile(playerId) {
    // Check if it's the player's turn
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      console.log("Not player's turn");
      return null;
    }
    
    // Check if there are tiles left in the pool
    if (this.tilePool.length === 0) {
      console.log("No tiles left in pool");
      return null;
    }
    
    // Take the top tile from the pool
    const tile = this.tilePool.pop();
    
    // Add tile to player's hand
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.hand.push(tile);
      
      // Sort the hand
      this.sortPlayerHand(playerId);
      
      // End the player's turn
      this.nextTurn();
      
      // Add to game log
      this.addGameLogEntry(playerId, 'drawTile');
      
      return tile;
    }
    
    return null;
  }
  
  // Sort a player's hand by color and number
  sortPlayerHand(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // Sort by color (null/jokers last), then by number
    player.hand.sort((a, b) => {
      // Jokers go last
      if (a.isJoker && !b.isJoker) return 1;
      if (!a.isJoker && b.isJoker) return -1;
      if (a.isJoker && b.isJoker) return 0;
      
      // Sort by color
      if (a.color < b.color) return -1;
      if (a.color > b.color) return 1;
      
      // Then by number
      return a.number - b.number;
    });
    
    return true;
  }
  
  // Check if a set of tiles forms a valid run (same color, consecutive numbers)
  isValidRun(tiles) {
    if (tiles.length < 3) {
      return false;
    }
    
    const nonJokers = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.filter(t => t.isJoker).length;
    
    // Need at least one non-joker to determine the color
    if (nonJokers.length === 0) {
      return false;
    }
    
    // All non-joker tiles must be the same color
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size > 1) {
      return false;
    }
    
    // Sort non-joker tiles by number
    const sortedNonJokers = [...nonJokers].sort((a, b) => a.number - b.number);
    
    // Try different placements of jokers to see if we can form a valid run
    return this.canFormValidRun(sortedNonJokers, jokerCount);
  }
  
  // Helper to check if jokers can help form a valid run
  canFormValidRun(sortedNonJokers, jokerCount) {
    // Start with simplest case: no jokers
    if (jokerCount === 0) {
      // Check if numbers are consecutive
      for (let i = 1; i < sortedNonJokers.length; i++) {
        if (sortedNonJokers[i].number !== sortedNonJokers[i-1].number + 1) {
          return false;
        }
      }
      return true;
    }
    
    // With jokers, calculate gaps between numbers
    const gaps = [];
    for (let i = 1; i < sortedNonJokers.length; i++) {
      const gap = sortedNonJokers[i].number - sortedNonJokers[i-1].number - 1;
      if (gap > 0) {
        gaps.push(gap);
      }
    }
    
    // Total number of spots to fill with jokers
    const totalGapSize = gaps.reduce((sum, gap) => sum + gap, 0);
    
    // If we have enough jokers to fill all gaps, and no illegal gaps (>13)
    if (totalGapSize <= jokerCount && gaps.every(gap => gap <= 13)) {
      // Check if sequence could be valid with jokers
      const min = sortedNonJokers[0].number;
      const max = sortedNonJokers[sortedNonJokers.length - 1].number;
      
      // Need to handle possible jokers at beginning and end
      const remainingJokers = jokerCount - totalGapSize;
      const potentialRunLength = max - min + 1 + remainingJokers;
      
      // Valid run needs to be consecutive and at least length 3
      return potentialRunLength >= 3 && potentialRunLength <= 13;
    }
    
    return false;
  }
  
  isValidGroup(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
      console.log('Group invalid: size ' + tiles.length + ' not between 3-4');
      return false;
    }
    
    // Create a detailed log of the tiles being validated
    const tileDetails = tiles.map(t => {
      if (t.isJoker) return 'JOKER';
      return t.number + t.color.charAt(0);
    }).join(', ');
    console.log('Validating group with tiles: [' + tileDetails + ']');
    
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    // If all jokers, it's valid (matches client behavior)
    if (jokerCount === tiles.length && tiles.length >= 3) {
      console.log('Group valid: all jokers');
      return true;
    }
    
    // Need at least one real tile to determine the group number
    if (nonJokers.length === 0) {
      console.log('Group invalid: all jokers, need at least one real tile');
      return false;
    }
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) {
      console.log('Group invalid: different numbers found ' + numbers.join(', '));
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      console.log('Group invalid: duplicate colors found ' + colors.join(', '));
      return false;
    }
    
    // Check if we can form a valid group with jokers
    const targetNumber = numbers[0];
    const usedColors = new Set(colors);
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    // Debug log for group validation
    console.log('Group validation - Number: ' + targetNumber + ', Colors: [' + colors.join(', ') + '], Jokers: ' + jokerCount);
    console.log('Remaining colors: [' + remainingColors.join(', ') + ']');
    
    // We need enough remaining colors for the jokers
    if (jokerCount > remainingColors.length) {
      console.log('Group invalid: not enough remaining colors for jokers (' + jokerCount + ' jokers, ' + remainingColors.length + ' colors)');
      return false;
    }
    
    // We've passed all validation checks
    console.log('Group valid with ' + jokerCount + ' jokers and ' + nonJokers.length + ' regular tiles');
    return true;
  }

  isValidSet(tiles) {
    if (tiles.length < 3) {
      console.log('Set invalid: too few tiles (' + tiles.length + ' < 3)');
      return false;
    }
    
    // Log the tiles being validated
    const tileInfo = tiles.map(t => t.isJoker ? 'joker' : t.color + '_' + t.number).join(', ');
    console.log('Server validating set: [' + tileInfo + ']');
    
    // Check if it's a run (consecutive numbers, same color)
    const isRun = this.isValidRun(tiles);
    if (isRun) {
      console.log('Valid run detected');
      return true;
    }
    
    // Check if it's a group (same number, different colors)
    const isGroup = this.isValidGroup(tiles);
    if (isGroup) {
      console.log('Valid group detected');
    } else {
      console.log('Set invalid: neither a valid run nor group');
    }
    return isGroup;
  }
}
