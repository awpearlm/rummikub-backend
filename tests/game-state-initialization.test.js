/**
 * Property-Based Tests for Game State Initialization
 * Feature: rummikub-stability, Property 4: Game State Initialization
 * Validates: Requirements 2.4
 */

const fc = require('fast-check');

// Define RummikubGame class for testing (extracted from server.js)
class RummikubGame {
  constructor(gameId, isBotGame = false, botDifficulty = 'medium') {
    this.id = gameId;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.deck = [];
    this.board = [];
    this.boardSnapshot = [];
    this.started = false;
    this.winner = null;
    this.chatMessages = [];
    this.gameLog = [];
    this.isBotGame = isBotGame;
    this.botDifficulty = botDifficulty;
    this.createdAt = Date.now();
    this.isDebugMode = false;
    this.initializeDeck();
  }

  initializeDeck() {
    const colors = ['red', 'blue', 'yellow', 'black'];
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    
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
    
    // Add jokers
    this.deck.push({ id: 'joker_1', color: null, number: null, isJoker: true });
    this.deck.push({ id: 'joker_2', color: null, number: null, isJoker: true });
    
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
    
    if (!playerId || typeof playerId !== 'string' || playerId.length === 0) {
      return false;
    }
    
    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      return false;
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
    return true;
  }

  addBotPlayer() {
    if (this.players.length >= 4) return false;
    
    const botNames = ['Dogman-do', 'Turdburg', 'Babyman', 'Bot_D'];
    const usedNames = this.players.filter(p => p.isBot).map(p => p.name);
    const availableNames = botNames.filter(name => !usedNames.includes(name));
    
    if (availableNames.length === 0) {
      return false;
    }
    
    const botName = availableNames[0];
    
    const botPlayer = {
      id: 'bot_' + Math.random().toString(36).substr(2, 9),
      name: botName,
      hand: [],
      hasPlayedInitial: false,
      score: 0,
      isBot: true
    };
    
    this.players.push(botPlayer);
    return botPlayer;
  }

  startGame() {
    if (this.players.length < 2) return false;
    
    // Check for debug mode
    if (this.isBotGame && this.botDifficulty === 'debug') {
      this.dealDebugHand();
    } else {
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
    this.takeBoardSnapshot();
    
    return true;
  }

  dealDebugHand() {
    // Find human player (non-bot)
    const humanPlayer = this.players.find(p => !p.isBot);
    const botPlayers = this.players.filter(p => p.isBot);
    
    if (!humanPlayer || botPlayers.length === 0) {
      return;
    }
    
    // Create debug hand that can go out completely
    const debugTiles = [
      // First set: Three 13s in different colors (39 points)
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
      
      // Fifth set: Two 10s + joker
      { id: 'red_10_0', color: 'red', number: 10, isJoker: false },
      { id: 'blue_10_0', color: 'blue', number: 10, isJoker: false },
      { id: 'joker_1', color: null, number: null, isJoker: true }
    ];
    
    // Remove these specific tiles from deck to avoid duplicates
    debugTiles.forEach(debugTile => {
      const index = this.deck.findIndex(tile => tile.id === debugTile.id);
      if (index !== -1) {
        this.deck.splice(index, 1);
      }
    });
    
    // Give debug tiles to human player
    humanPlayer.hand = [...debugTiles];
    
    // Give all bot players normal random hands
    botPlayers.forEach(bot => {
      for (let i = 0; i < 14; i++) {
        if (this.deck.length > 0) {
          bot.hand.push(this.deck.pop());
        }
      }
    });
  }

  takeBoardSnapshot() {
    this.boardSnapshot = JSON.parse(JSON.stringify(this.board));
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
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
      isBotGame: this.isBotGame
    };
  }
}

describe('Game State Initialization Properties', () => {
  
  /**
   * Property 4: Game State Initialization
   * For any valid game configuration, starting the game should deal the correct number of tiles 
   * to each player and establish proper turn order
   */
  test('Property 4: Game initialization deals correct tiles and establishes turn order', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 }),
        playerNames: fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 4, maxLength: 4 }
        ).map(names => [...new Set(names)]), // Ensure unique names
        isBotGame: fc.boolean(),
        difficulty: fc.constantFrom('easy', 'medium', 'hard', 'debug')
      }),
      (gameConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId, gameConfig.isBotGame, gameConfig.difficulty);
        
        // Add the specified number of players
        const actualPlayerNames = gameConfig.playerNames.slice(0, gameConfig.playerCount);
        const playerIds = [];
        
        actualPlayerNames.forEach((playerName, index) => {
          const playerId = `player-${index}-${Math.random().toString(36).substr(2, 9)}`;
          playerIds.push(playerId);
          
          if (gameConfig.isBotGame && index > 0) {
            // Add bot players for bot games (except first player)
            game.addBotPlayer();
          } else {
            // Add human players
            game.addPlayer(playerId, playerName);
          }
        });
        
        // Property: Game should not be started initially
        expect(game.started).toBe(false);
        expect(game.players.every(p => p.hand.length === 0)).toBe(true);
        
        // Start the game
        const startResult = game.startGame();
        
        // Property: Game should start successfully with 2+ players
        expect(startResult).toBe(true);
        expect(game.started).toBe(true);
        
        // Property: Each player should have exactly 14 tiles (unless debug mode)
        if (gameConfig.isBotGame && gameConfig.difficulty === 'debug') {
          // Debug mode has special tile distribution
          const humanPlayer = game.players.find(p => !p.isBot);
          const botPlayer = game.players.find(p => p.isBot);
          
          if (humanPlayer && botPlayer) {
            expect(humanPlayer.hand.length).toBe(15); // Debug hand has 15 tiles
            expect(botPlayer.hand.length).toBe(14); // Bot gets normal hand
          }
        } else {
          // Normal mode: all players get 14 tiles
          game.players.forEach(player => {
            expect(player.hand.length).toBe(14);
          });
        }
        
        // Property: Turn order should be established (starts with player 0)
        expect(game.currentPlayerIndex).toBe(0);
        expect(game.getCurrentPlayer()).toBe(game.players[0]);
        
        // Property: Board should be empty initially
        expect(game.board).toHaveLength(0);
        expect(game.boardSnapshot).toHaveLength(0);
        
        // Property: No winner should be declared initially
        expect(game.winner).toBe(null);
        
        // Property: Deck should have remaining tiles after dealing
        const totalTilesDealt = game.players.reduce((sum, player) => sum + player.hand.length, 0);
        const expectedRemainingTiles = 106 - totalTilesDealt;
        expect(game.deck.length).toBe(expectedRemainingTiles);
        
        // Property: All dealt tiles should be unique
        const allDealtTiles = [];
        game.players.forEach(player => {
          player.hand.forEach(tile => {
            allDealtTiles.push(tile.id);
          });
        });
        const uniqueDealtTiles = new Set(allDealtTiles);
        expect(uniqueDealtTiles.size).toBe(allDealtTiles.length);
        
        // Property: Players should have initial game state
        game.players.forEach(player => {
          expect(player.hasPlayedInitial).toBe(false);
          expect(player.score).toBe(0);
        });
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Property 4a: Game initialization fails appropriately with insufficient players', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 0, max: 1 }),
        playerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
      }),
      (gameConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add insufficient number of players
        if (gameConfig.playerCount === 1) {
          const playerId = 'player-' + Math.random().toString(36).substr(2, 9);
          game.addPlayer(playerId, gameConfig.playerName);
        }
        // If playerCount is 0, add no players
        
        // Property: Game should not start with insufficient players
        const startResult = game.startGame();
        
        expect(startResult).toBe(false);
        expect(game.started).toBe(false);
        
        // Property: No tiles should be dealt if game doesn't start
        game.players.forEach(player => {
          expect(player.hand.length).toBe(0);
        });
        
        // Property: Deck should remain full
        expect(game.deck.length).toBe(106);
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 4b: Tile distribution maintains deck integrity', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 }),
        gameMode: fc.constantFrom('normal', 'bot-easy', 'bot-medium', 'bot-hard')
      }),
      (gameConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const isBotGame = gameConfig.gameMode !== 'normal';
        const difficulty = gameConfig.gameMode === 'normal' ? 'medium' : gameConfig.gameMode.replace('bot-', '');
        const game = new RummikubGame(gameId, isBotGame, difficulty);
        
        // Record initial deck composition
        const initialDeckTiles = new Set(game.deck.map(tile => tile.id));
        expect(initialDeckTiles.size).toBe(106); // All tiles should be unique
        
        // Add players
        for (let i = 0; i < gameConfig.playerCount; i++) {
          if (isBotGame && i > 0) {
            game.addBotPlayer();
          } else {
            const playerId = `player-${i}-${Math.random().toString(36).substr(2, 9)}`;
            const playerName = `Player${i}`;
            game.addPlayer(playerId, playerName);
          }
        }
        
        // Start the game
        game.startGame();
        
        // Property: All tiles should be accounted for (in hands or deck)
        const tilesInHands = new Set();
        game.players.forEach(player => {
          player.hand.forEach(tile => {
            tilesInHands.add(tile.id);
          });
        });
        
        const tilesInDeck = new Set(game.deck.map(tile => tile.id));
        
        // Property: No tile should be in both hand and deck
        const intersection = new Set([...tilesInHands].filter(x => tilesInDeck.has(x)));
        expect(intersection.size).toBe(0);
        
        // Property: All original tiles should be accounted for
        const allCurrentTiles = new Set([...tilesInHands, ...tilesInDeck]);
        expect(allCurrentTiles.size).toBe(106);
        
        // Property: Every original tile should still exist somewhere
        initialDeckTiles.forEach(tileId => {
          expect(allCurrentTiles.has(tileId)).toBe(true);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 4c: Debug mode initialization provides correct special hands', () => {
    fc.assert(fc.property(
      fc.record({
        humanPlayerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        botCount: fc.integer({ min: 1, max: 3 })
      }),
      (gameConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId, true, 'debug'); // Bot game with debug difficulty
        
        // Add human player
        const humanPlayerId = 'human-' + Math.random().toString(36).substr(2, 9);
        game.addPlayer(humanPlayerId, gameConfig.humanPlayerName);
        
        // Add bot players
        for (let i = 0; i < gameConfig.botCount; i++) {
          game.addBotPlayer();
        }
        
        // Start the game (should trigger debug mode)
        const startResult = game.startGame();
        
        expect(startResult).toBe(true);
        expect(game.started).toBe(true);
        
        // Property: Human player should get debug hand (15 tiles)
        const humanPlayer = game.players.find(p => !p.isBot);
        expect(humanPlayer).toBeDefined();
        expect(humanPlayer.hand.length).toBe(15);
        
        // Property: Debug hand should contain specific winning combinations
        const humanHand = humanPlayer.hand;
        
        // Check for three 13s in different colors
        const thirteens = humanHand.filter(tile => tile.number === 13);
        expect(thirteens.length).toBe(3);
        const thirteenColors = new Set(thirteens.map(tile => tile.color));
        expect(thirteenColors.size).toBe(3); // Different colors
        
        // Check for joker
        const jokers = humanHand.filter(tile => tile.isJoker);
        expect(jokers.length).toBe(1);
        
        // Property: Bot players should get normal hands (14 tiles each)
        const botPlayers = game.players.filter(p => p.isBot);
        botPlayers.forEach(bot => {
          expect(bot.hand.length).toBe(14);
        });
        
        // Property: Total tiles dealt should be correct
        const totalTilesDealt = game.players.reduce((sum, player) => sum + player.hand.length, 0);
        const expectedTilesDealt = 15 + (gameConfig.botCount * 14); // Human gets 15, bots get 14 each
        expect(totalTilesDealt).toBe(expectedTilesDealt);
        
        return true;
      }
    ), { numRuns: 30 });
  });
  
  test('Property 4d: Turn order consistency across game states', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 }),
        playerNames: fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 4, maxLength: 4 }
        ).map(names => [...new Set(names)])
      }),
      (gameConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        const actualPlayerNames = gameConfig.playerNames.slice(0, gameConfig.playerCount);
        const playerIds = [];
        
        // Add players
        actualPlayerNames.forEach((playerName, index) => {
          const playerId = `player-${index}-${Math.random().toString(36).substr(2, 9)}`;
          playerIds.push(playerId);
          game.addPlayer(playerId, playerName);
        });
        
        // Start the game
        game.startGame();
        
        // Property: Current player should be the first player added
        expect(game.currentPlayerIndex).toBe(0);
        expect(game.getCurrentPlayer().id).toBe(playerIds[0]);
        expect(game.getCurrentPlayer().name).toBe(actualPlayerNames[0]);
        
        // Property: Game state should reflect correct turn order for all players
        playerIds.forEach((playerId, index) => {
          const gameState = game.getGameState(playerId);
          
          expect(gameState.currentPlayerIndex).toBe(0);
          expect(gameState.players[0].id).toBe(playerIds[0]);
          expect(gameState.players[index].id).toBe(playerId);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
});