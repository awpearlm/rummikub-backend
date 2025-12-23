/**
 * Property-Based Tests for Move Validation and State Updates
 * Feature: rummikub-stability, Property 5: Move Validation and State Updates
 * Validates: Requirements 2.5
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
    this.takeBoardSnapshot();
    
    return true;
  }

  takeBoardSnapshot() {
    this.boardSnapshot = JSON.parse(JSON.stringify(this.board));
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
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
    
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    // If all jokers, it's only valid if exactly 3 or 4 jokers
    if (jokerCount === tiles.length) {
      return jokerCount >= 3 && jokerCount <= 4;
    }
    
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

  calculateSetValue(tiles) {
    let totalValue = 0;
    const nonJokerTiles = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.length - nonJokerTiles.length;
    
    if (this.isValidGroup(tiles)) {
      // Group: same number, different colors
      if (nonJokerTiles.length > 0) {
        const groupNumber = nonJokerTiles[0].number;
        totalValue = groupNumber * tiles.length;
      } else if (jokerCount > 0) {
        totalValue = 13 * tiles.length; // Maximum possible value for all jokers
      }
    } else if (this.isValidRun(tiles)) {
      // Run: consecutive numbers, same color
      totalValue = this.calculateRunValueWithJokers(tiles);
    }
    
    return totalValue;
  }

  calculateRunValueWithJokers(tiles) {
    const nonJokers = tiles.filter(t => !t.isJoker);
    const jokerCount = tiles.length - nonJokers.length;
    
    if (jokerCount === 0) {
      return nonJokers.reduce((sum, tile) => sum + tile.number, 0);
    }
    
    if (nonJokers.length === 0) {
      // All jokers case - assign consecutive values starting from 1
      let value = 0;
      for (let i = 1; i <= tiles.length; i++) {
        value += i;
      }
      return value;
    }
    
    // Sort non-jokers by number to determine the sequence
    nonJokers.sort((a, b) => a.number - b.number);
    const minNumber = nonJokers[0].number;
    const sequenceLength = tiles.length;
    
    // For simplicity, assume jokers fill gaps or extend from the minimum
    let sequenceStart = Math.max(1, minNumber - Math.floor(jokerCount / 2));
    
    let total = 0;
    for (let i = 0; i < sequenceLength; i++) {
      total += sequenceStart + i;
    }
    
    return total;
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
    
    // Normalize joker properties
    tiles.forEach(tile => {
      if (tile.isJoker || tile.number === null || (tile.id && tile.id.toLowerCase().includes('joker'))) {
        tile.isJoker = true;
        tile.color = null;
        tile.number = null;
      }
    });
    
    if (!this.isValidSet(tiles)) {
      return false;
    }
    
    // Check initial 30-point requirement
    if (!player.hasPlayedInitial) {
      const setValue = this.calculateSetValue(tiles);
      if (setValue < 30) {
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
    let totalValue = 0;
    
    for (const tileIds of setArrays) {
      const tiles = tileIds.map(id => player.hand.find(t => t.id === id)).filter(Boolean);
      if (tiles.length !== tileIds.length) {
        return false;
      }
      
      // Normalize joker properties
      tiles.forEach(tile => {
        if (tile.isJoker || tile.number === null || (tile.id && tile.id.toLowerCase().includes('joker'))) {
          tile.isJoker = true;
          tile.color = null;
          tile.number = null;
        }
      });
      
      if (!this.isValidSet(tiles)) {
        return false;
      }
      
      const setValue = this.calculateSetValue(tiles);
      totalValue += setValue;
      validatedSets.push({ tiles, setValue });
    }
    
    // Check initial 30-point requirement for combined sets
    if (!player.hasPlayedInitial) {
      if (totalValue < 30) {
        return false;
      }
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
    
    return { success: true, totalValue, setsPlayed: validatedSets.length };
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

describe('Move Validation and State Updates Properties', () => {
  
  /**
   * Property 5: Move Validation and State Updates
   * For any game move (valid or invalid), the Game_Engine should correctly validate the move 
   * and update game state only for valid moves
   */
  test('Property 5: Valid moves update state, invalid moves are rejected', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 }),
        moveType: fc.constantFrom('valid_run', 'valid_group', 'invalid_short', 'invalid_mixed')
      }),
      (testConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add players
        const playerIds = [];
        for (let i = 0; i < testConfig.playerCount; i++) {
          const playerId = `player-${i}-${Math.random().toString(36).substr(2, 9)}`;
          const playerName = `Player${i}`;
          playerIds.push(playerId);
          game.addPlayer(playerId, playerName);
        }
        
        // Start the game
        game.startGame();
        
        const currentPlayer = game.getCurrentPlayer();
        const initialHandSize = currentPlayer.hand.length;
        const initialBoardSize = game.board.length;
        const initialHasPlayedInitial = currentPlayer.hasPlayedInitial;
        
        // Work with tiles actually in the player's hand
        let testTileIds = [];
        let expectedValid = false;
        
        switch (testConfig.moveType) {
          case 'valid_run':
            // Try to find a valid run in the player's hand or create one with high-value tiles
            // For testing, we'll add specific high-value tiles to ensure 30+ points
            const highValueTiles = [
              { id: 'red_13_0', color: 'red', number: 13, isJoker: false },
              { id: 'blue_13_0', color: 'blue', number: 13, isJoker: false },
              { id: 'yellow_13_0', color: 'yellow', number: 13, isJoker: false }
            ];
            
            // Replace some tiles in hand with our test tiles
            currentPlayer.hand.splice(0, 3, ...highValueTiles);
            testTileIds = highValueTiles.map(t => t.id);
            expectedValid = true;
            break;
            
          case 'valid_group':
            // Create a valid group with high-value tiles
            const groupTiles = [
              { id: 'red_12_0', color: 'red', number: 12, isJoker: false },
              { id: 'blue_12_0', color: 'blue', number: 12, isJoker: false },
              { id: 'yellow_12_0', color: 'yellow', number: 12, isJoker: false }
            ];
            
            // Replace some tiles in hand with our test tiles
            currentPlayer.hand.splice(0, 3, ...groupTiles);
            testTileIds = groupTiles.map(t => t.id);
            expectedValid = true;
            break;
            
          case 'invalid_short':
            // Try to play only 2 tiles (invalid)
            if (currentPlayer.hand.length >= 2) {
              testTileIds = [currentPlayer.hand[0].id, currentPlayer.hand[1].id];
            }
            expectedValid = false;
            break;
            
          case 'invalid_mixed':
            // Create an invalid mixed set if we have enough tiles
            if (currentPlayer.hand.length >= 3) {
              testTileIds = [currentPlayer.hand[0].id, currentPlayer.hand[1].id, currentPlayer.hand[2].id];
              // This will likely be invalid unless by chance they form a valid set
              expectedValid = false;
            }
            break;
        }
        
        if (testTileIds.length === 0) {
          return true; // Skip this test case if we can't create the scenario
        }
        
        // Attempt to play the set
        const playResult = game.playSet(currentPlayer.id, testTileIds);
        
        // For valid moves, check if they meet the 30-point requirement
        if (expectedValid && !initialHasPlayedInitial) {
          const testTiles = testTileIds.map(id => currentPlayer.hand.find(t => t.id === id) || 
            // Check if tile was moved to board
            game.board.flat().find(t => t.id === id)
          ).filter(Boolean);
          
          if (testTiles.length > 0) {
            const setValue = game.calculateSetValue(testTiles);
            const meetsInitialRequirement = setValue >= 30;
            expectedValid = expectedValid && meetsInitialRequirement;
          }
        }
        
        // Property: Play result should match expected validity
        if (expectedValid) {
          expect(playResult).toBe(true);
          expect(game.board.length).toBeGreaterThan(initialBoardSize);
          expect(currentPlayer.hasPlayedInitial).toBe(true);
        } else {
          expect(playResult).toBe(false);
          expect(currentPlayer.hasPlayedInitial).toBe(initialHasPlayedInitial);
        }
        
        return true;
      }
    ), { numRuns: 50 }); // Reduced runs since we're working with random hands
  });
  
  test('Property 5a: Initial play requirement is enforced correctly', () => {
    fc.assert(fc.property(
      fc.record({
        setValue: fc.integer({ min: 10, max: 50 }),
        hasPlayedInitial: fc.boolean()
      }),
      (testConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add two players
        const player1Id = 'player1-' + Math.random().toString(36).substr(2, 9);
        const player2Id = 'player2-' + Math.random().toString(36).substr(2, 9);
        game.addPlayer(player1Id, 'Player1');
        game.addPlayer(player2Id, 'Player2');
        
        // Start the game
        game.startGame();
        
        const currentPlayer = game.getCurrentPlayer();
        currentPlayer.hasPlayedInitial = testConfig.hasPlayedInitial;
        
        // Create a set with specific value
        let testTiles = [];
        if (testConfig.setValue >= 30) {
          // High value set: three 13s (39 points)
          testTiles = [
            { id: 'red_13_test', color: 'red', number: 13, isJoker: false },
            { id: 'blue_13_test', color: 'blue', number: 13, isJoker: false },
            { id: 'yellow_13_test', color: 'yellow', number: 13, isJoker: false }
          ];
        } else {
          // Low value set: three 1s (3 points) or adjust to match setValue
          const targetNumber = Math.max(1, Math.floor(testConfig.setValue / 3));
          testTiles = [
            { id: `red_${targetNumber}_test`, color: 'red', number: targetNumber, isJoker: false },
            { id: `blue_${targetNumber}_test`, color: 'blue', number: targetNumber, isJoker: false },
            { id: `yellow_${targetNumber}_test`, color: 'yellow', number: targetNumber, isJoker: false }
          ];
        }
        
        // Add test tiles to current player's hand
        testTiles.forEach(tile => {
          currentPlayer.hand.push(tile);
        });
        
        const actualSetValue = game.calculateSetValue(testTiles);
        const shouldSucceed = testConfig.hasPlayedInitial || actualSetValue >= 30;
        
        // Attempt to play the set
        const tileIds = testTiles.map(t => t.id);
        const playResult = game.playSet(currentPlayer.id, tileIds);
        
        // Property: Initial play requirement should be enforced correctly
        expect(playResult).toBe(shouldSucceed);
        
        if (shouldSucceed) {
          expect(currentPlayer.hasPlayedInitial).toBe(true);
          expect(game.board.length).toBe(1);
        } else {
          expect(game.board.length).toBe(0);
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 5b: Multiple sets can be played simultaneously for initial play', () => {
    fc.assert(fc.property(
      fc.record({
        setCount: fc.integer({ min: 2, max: 4 }),
        individualSetValues: fc.array(fc.integer({ min: 5, max: 20 }), { minLength: 4, maxLength: 4 })
      }),
      (testConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add two players
        const player1Id = 'player1-' + Math.random().toString(36).substr(2, 9);
        const player2Id = 'player2-' + Math.random().toString(36).substr(2, 9);
        game.addPlayer(player1Id, 'Player1');
        game.addPlayer(player2Id, 'Player2');
        
        // Start the game
        game.startGame();
        
        const currentPlayer = game.getCurrentPlayer();
        expect(currentPlayer.hasPlayedInitial).toBe(false);
        
        // Create multiple sets
        const setArrays = [];
        let totalExpectedValue = 0;
        
        for (let i = 0; i < testConfig.setCount; i++) {
          const setValue = testConfig.individualSetValues[i];
          const targetNumber = Math.max(1, Math.min(13, Math.floor(setValue / 3)));
          
          const testSet = [
            { id: `red_${targetNumber}_set${i}`, color: 'red', number: targetNumber, isJoker: false },
            { id: `blue_${targetNumber}_set${i}`, color: 'blue', number: targetNumber, isJoker: false },
            { id: `yellow_${targetNumber}_set${i}`, color: 'yellow', number: targetNumber, isJoker: false }
          ];
          
          // Add tiles to player's hand
          testSet.forEach(tile => {
            currentPlayer.hand.push(tile);
          });
          
          setArrays.push(testSet.map(t => t.id));
          totalExpectedValue += game.calculateSetValue(testSet);
        }
        
        const shouldSucceed = totalExpectedValue >= 30;
        
        // Attempt to play multiple sets
        const playResult = game.playMultipleSets(currentPlayer.id, setArrays);
        
        // Property: Multiple sets should succeed if total value >= 30
        if (shouldSucceed) {
          expect(playResult).toBeTruthy();
          expect(playResult.success).toBe(true);
          expect(playResult.setsPlayed).toBe(testConfig.setCount);
          expect(currentPlayer.hasPlayedInitial).toBe(true);
          expect(game.board.length).toBe(testConfig.setCount);
        } else {
          expect(playResult).toBe(false);
          expect(currentPlayer.hasPlayedInitial).toBe(false);
          expect(game.board.length).toBe(0);
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 5c: Turn-based move validation prevents out-of-turn plays', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 }),
        attemptingPlayerIndex: fc.integer({ min: 0, max: 3 })
      }),
      (testConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add players
        const playerIds = [];
        for (let i = 0; i < testConfig.playerCount; i++) {
          const playerId = `player-${i}-${Math.random().toString(36).substr(2, 9)}`;
          const playerName = `Player${i}`;
          playerIds.push(playerId);
          game.addPlayer(playerId, playerName);
        }
        
        // Start the game
        game.startGame();
        
        // Determine which player should attempt the move
        const attemptingPlayerIndex = testConfig.attemptingPlayerIndex % testConfig.playerCount;
        const attemptingPlayerId = playerIds[attemptingPlayerIndex];
        const attemptingPlayer = game.players[attemptingPlayerIndex];
        
        // Create a valid set for the attempting player
        const testTiles = [
          { id: 'red_13_test', color: 'red', number: 13, isJoker: false },
          { id: 'blue_13_test', color: 'blue', number: 13, isJoker: false },
          { id: 'yellow_13_test', color: 'yellow', number: 13, isJoker: false }
        ];
        
        // Add tiles to the attempting player's hand
        testTiles.forEach(tile => {
          attemptingPlayer.hand.push(tile);
        });
        
        const isCurrentPlayer = game.currentPlayerIndex === attemptingPlayerIndex;
        const tileIds = testTiles.map(t => t.id);
        
        // Attempt to play the set
        const playResult = game.playSet(attemptingPlayerId, tileIds);
        
        // Property: Only current player should be able to make moves
        expect(playResult).toBe(isCurrentPlayer);
        
        if (isCurrentPlayer) {
          // Current player should succeed
          expect(game.board.length).toBe(1);
          expect(attemptingPlayer.hasPlayedInitial).toBe(true);
        } else {
          // Non-current player should fail
          expect(game.board.length).toBe(0);
          expect(attemptingPlayer.hasPlayedInitial).toBe(false);
          
          // Tiles should remain in hand
          testTiles.forEach(testTile => {
            const tileInHand = attemptingPlayer.hand.find(t => t.id === testTile.id);
            expect(tileInHand).toBeDefined();
          });
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 5d: Tile drawing updates state correctly', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 })
      }),
      (testConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add players
        const playerIds = [];
        for (let i = 0; i < testConfig.playerCount; i++) {
          const playerId = `player-${i}-${Math.random().toString(36).substr(2, 9)}`;
          const playerName = `Player${i}`;
          playerIds.push(playerId);
          game.addPlayer(playerId, playerName);
        }
        
        // Start the game
        game.startGame();
        
        const currentPlayer = game.getCurrentPlayer();
        const initialHandSize = currentPlayer.hand.length;
        const initialDeckSize = game.deck.length;
        
        // Property: Should be able to draw tile if deck is not empty
        if (initialDeckSize > 0) {
          const drawnTile = game.drawTile(currentPlayer.id);
          
          expect(drawnTile).toBeDefined();
          expect(currentPlayer.hand.length).toBe(initialHandSize + 1);
          expect(game.deck.length).toBe(initialDeckSize - 1);
          
          // Property: Drawn tile should be in player's hand
          const tileInHand = currentPlayer.hand.find(t => t.id === drawnTile.id);
          expect(tileInHand).toBeDefined();
          expect(tileInHand).toEqual(drawnTile);
        } else {
          // Property: Should not be able to draw from empty deck
          const drawnTile = game.drawTile(currentPlayer.id);
          
          expect(drawnTile).toBe(null);
          expect(currentPlayer.hand.length).toBe(initialHandSize);
          expect(game.deck.length).toBe(0);
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });
  
  test('Property 5e: Win condition is detected correctly', () => {
    fc.assert(fc.property(
      fc.record({
        playerCount: fc.integer({ min: 2, max: 4 })
      }),
      (testConfig) => {
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const game = new RummikubGame(gameId);
        
        // Add players
        const playerIds = [];
        for (let i = 0; i < testConfig.playerCount; i++) {
          const playerId = `player-${i}-${Math.random().toString(36).substr(2, 9)}`;
          const playerName = `Player${i}`;
          playerIds.push(playerId);
          game.addPlayer(playerId, playerName);
        }
        
        // Start the game
        game.startGame();
        
        const currentPlayer = game.getCurrentPlayer();
        
        // Clear the player's hand except for 3 tiles to create a winning scenario
        const winningTiles = [
          { id: 'red_13_win', color: 'red', number: 13, isJoker: false },
          { id: 'blue_13_win', color: 'blue', number: 13, isJoker: false },
          { id: 'yellow_13_win', color: 'yellow', number: 13, isJoker: false }
        ];
        
        currentPlayer.hand = [...winningTiles];
        currentPlayer.hasPlayedInitial = true; // Skip initial play requirement
        
        expect(game.winner).toBe(null);
        
        // Play the winning set
        const tileIds = winningTiles.map(t => t.id);
        const playResult = game.playSet(currentPlayer.id, tileIds);
        
        // Property: Valid play that empties hand should trigger win
        expect(playResult).toBe(true);
        expect(currentPlayer.hand.length).toBe(0);
        expect(game.winner).toBe(currentPlayer);
        
        return true;
      }
    ), { numRuns: 30 });
  });
});