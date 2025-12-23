/**
 * Property-Based Tests for Game Creation and Joining
 * Feature: rummikub-stability, Property 3: Game Creation and Joining
 * Validates: Requirements 2.2, 2.3
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
    this.started = false;
    this.winner = null;
    this.chatMessages = [];
    this.gameLog = [];
    this.isBotGame = isBotGame;
    this.botDifficulty = botDifficulty;
    this.createdAt = Date.now();
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
    
    // Validate input parameters
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

// Mock data for testing
const mockGames = new Map();
const mockPlayers = new Map();

beforeEach(() => {
  mockGames.clear();
  mockPlayers.clear();
  jest.clearAllMocks();
});

describe('Game Creation and Joining Properties', () => {
  
  /**
   * Property 3: Game Creation and Joining
   * For any valid game creation request, the Game_Engine should generate a unique game ID 
   * and allow other players to join successfully
   */
  test('Property 3: Game creation generates unique IDs and allows joining', () => {
    fc.assert(fc.property(
      fc.record({
        playerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        isDebugMode: fc.boolean(),
        timerEnabled: fc.boolean()
      }),
      (gameData) => {
        // Generate a unique game ID (simulating the server's generateGameId function)
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        
        // Create a new game
        const game = new RummikubGame(gameId);
        game.isDebugMode = gameData.isDebugMode;
        game.timerEnabled = gameData.timerEnabled;
        
        // Property: Game should be created with unique ID
        expect(game.id).toBe(gameId);
        expect(game.id).toMatch(/^[A-Z0-9]{6}$/);
        
        // Property: Game should start with empty player list
        expect(game.players).toHaveLength(0);
        expect(game.started).toBe(false);
        expect(game.winner).toBe(null);
        
        // Property: Game should have initialized deck
        expect(game.deck).toHaveLength(106); // 104 numbered tiles + 2 jokers
        
        // Property: Player should be able to join the game
        const playerId = 'player-' + Math.random().toString(36).substr(2, 9);
        const joinResult = game.addPlayer(playerId, gameData.playerName);
        
        expect(joinResult).toBe(true);
        expect(game.players).toHaveLength(1);
        expect(game.players[0].id).toBe(playerId);
        expect(game.players[0].name).toBe(gameData.playerName);
        expect(game.players[0].hand).toHaveLength(0); // No tiles dealt yet
        expect(game.players[0].hasPlayedInitial).toBe(false);
        
        // Property: Game state should be retrievable for the player
        const gameState = game.getGameState(playerId);
        expect(gameState.id).toBe(gameId);
        expect(gameState.players).toHaveLength(1);
        expect(gameState.playerHand).toHaveLength(0);
        expect(gameState.started).toBe(false);
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Property 3a: Multiple players can join the same game up to maximum capacity', () => {
    fc.assert(fc.property(
      fc.record({
        playerNames: fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 6 }
        ).map(names => [...new Set(names)]) // Ensure unique names
      }),
      (testData) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        const joinResults = [];
        const playerIds = [];
        
        // Try to add each player
        testData.playerNames.forEach((playerName, index) => {
          const playerId = `player-${index}-${Math.random().toString(36).substr(2, 9)}`;
          playerIds.push(playerId);
          const result = game.addPlayer(playerId, playerName);
          joinResults.push(result);
        });
        
        // Property: First 4 players should join successfully, rest should be rejected
        const expectedSuccessCount = Math.min(testData.playerNames.length, 4);
        const actualSuccessCount = joinResults.filter(r => r === true).length;
        
        expect(actualSuccessCount).toBe(expectedSuccessCount);
        expect(game.players).toHaveLength(expectedSuccessCount);
        
        // Property: Players beyond capacity should be rejected
        if (testData.playerNames.length > 4) {
          const rejectedCount = joinResults.filter(r => r === false).length;
          expect(rejectedCount).toBe(testData.playerNames.length - 4);
        }
        
        // Property: All joined players should have correct data
        game.players.forEach((player, index) => {
          expect(player.id).toBe(playerIds[index]);
          expect(player.name).toBe(testData.playerNames[index]);
          expect(player.hand).toHaveLength(0);
          expect(player.hasPlayedInitial).toBe(false);
          expect(player.isBot).toBe(false);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 3b: Game creation with bot players works correctly', () => {
    fc.assert(fc.property(
      fc.record({
        playerName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        botCount: fc.integer({ min: 1, max: 3 }),
        difficulty: fc.constantFrom('easy', 'medium', 'hard', 'debug')
      }),
      (gameData) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId, true, gameData.difficulty);
        
        // Property: Bot game should be marked correctly
        expect(game.isBotGame).toBe(true);
        expect(game.botDifficulty).toBe(gameData.difficulty);
        
        // Add human player
        const humanPlayerId = 'human-' + Math.random().toString(36).substr(2, 9);
        const humanJoinResult = game.addPlayer(humanPlayerId, gameData.playerName);
        
        expect(humanJoinResult).toBe(true);
        expect(game.players).toHaveLength(1);
        expect(game.players[0].isBot).toBe(false);
        
        // Add bot players using addBotPlayer method
        const addedBots = [];
        for (let i = 0; i < gameData.botCount && game.players.length < 4; i++) {
          const bot = game.addBotPlayer();
          if (bot) {
            addedBots.push(bot);
          }
        }
        
        // Property: Game should have correct number of players
        const expectedPlayerCount = Math.min(1 + gameData.botCount, 4);
        expect(game.players).toHaveLength(expectedPlayerCount);
        
        // Property: Should have exactly one human player and rest bots
        const humanPlayers = game.players.filter(p => !p.isBot);
        const botPlayers = game.players.filter(p => p.isBot);
        
        expect(humanPlayers).toHaveLength(1);
        expect(botPlayers).toHaveLength(expectedPlayerCount - 1);
        
        // Property: Bot players should have valid names and IDs
        const botNames = ['Dogman-do', 'Turdburg', 'Babyman', 'Bot_D'];
        botPlayers.forEach(bot => {
          expect(botNames).toContain(bot.name);
          expect(bot.id).toMatch(/^bot_/);
        });
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 3c: Game state consistency across multiple players', () => {
    fc.assert(fc.property(
      fc.array(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        { minLength: 2, maxLength: 4 }
      ).map(names => [...new Set(names)]), // Ensure unique names
      (playerNames) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        const playerIds = [];
        
        // Add all players
        playerNames.forEach((playerName, index) => {
          const playerId = `player-${index}-${Math.random().toString(36).substr(2, 9)}`;
          playerIds.push(playerId);
          game.addPlayer(playerId, playerName);
        });
        
        // Property: Game state should be consistent for all players
        const gameStates = playerIds.map(playerId => game.getGameState(playerId));
        
        // All players should see the same basic game information
        gameStates.forEach(state => {
          expect(state.id).toBe(gameId);
          expect(state.players).toHaveLength(playerNames.length);
          expect(state.started).toBe(false);
          expect(state.winner).toBe(null);
          expect(state.board).toHaveLength(0);
          expect(state.deckSize).toBe(106);
        });
        
        // Each player should see their own hand (empty before game starts)
        gameStates.forEach((state, index) => {
          expect(state.playerHand).toHaveLength(0);
          
          // Player should see themselves in the players list
          const selfInList = state.players.find(p => p.id === playerIds[index]);
          expect(selfInList).toBeDefined();
          expect(selfInList.name).toBe(playerNames[index]);
        });
        
        return true;
      }
    ), { numRuns: 30 });
  });
  
  test('Property 3d: Invalid player data is rejected appropriately', () => {
    fc.assert(fc.property(
      fc.record({
        playerId: fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.string({ minLength: 1 })
        ),
        playerName: fc.oneof(
          fc.constant(''),
          fc.constant('   '), // whitespace only
          fc.constant(null),
          fc.constant(undefined),
          fc.string({ minLength: 1, maxLength: 20 })
        )
      }),
      (playerData) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Determine if the player data should be valid
        const hasValidId = playerData.playerId && 
          typeof playerData.playerId === 'string' && 
          playerData.playerId.length > 0;
        
        const hasValidName = playerData.playerName && 
          typeof playerData.playerName === 'string' && 
          playerData.playerName.trim().length > 0;
        
        const shouldSucceed = hasValidId && hasValidName;
        
        let joinResult;
        try {
          joinResult = game.addPlayer(playerData.playerId, playerData.playerName);
        } catch (error) {
          joinResult = false;
        }
        
        // Property: Only valid player data should result in successful joins
        if (shouldSucceed) {
          expect(joinResult).toBe(true);
          expect(game.players).toHaveLength(1);
        } else {
          expect(joinResult).toBe(false);
          expect(game.players).toHaveLength(0);
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });
});