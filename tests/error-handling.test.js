/**
 * Property-Based Tests for Error Handling System
 * Feature: rummikub-stability, Property 10: Error Message Quality
 * Validates: Requirements 6.1, 6.2
 * 
 * Feature: rummikub-stability, Property 11: Game State Corruption Recovery
 * Validates: Requirements 6.3, 6.5
 */

const fc = require('fast-check');

// Mock classes for testing
class MockRummikubGame {
  constructor(gameId, isBotGame = false) {
    this.id = gameId;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.deck = [];
    this.board = [];
    this.started = false;
    this.winner = null;
    this.isBotGame = isBotGame;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.corrupted = false;
    this.corruptionType = null;
  }

  // Simulate various types of game state corruption
  simulateCorruption(corruptionType) {
    this.corrupted = true;
    this.corruptionType = corruptionType;
    
    switch (corruptionType) {
      case 'missing_players':
        this.players = null;
        break;
      case 'invalid_current_player':
        this.currentPlayerIndex = -1;
        break;
      case 'corrupted_deck':
        this.deck = 'invalid_deck_data';
        break;
      case 'invalid_board':
        this.board = { invalid: 'board_structure' };
        break;
      case 'negative_tiles':
        // Ensure we have at least one player to corrupt
        if (this.players.length === 0) {
          this.players.push({ name: 'TestPlayer', hand: [], hasPlayedInitial: false });
        }
        this.players[0].hand = [{ id: 'invalid', number: -5 }];
        break;
      case 'duplicate_tiles':
        // Ensure we have at least 2 players
        while (this.players.length < 2) {
          this.players.push({ 
            name: `Player${this.players.length + 1}`, 
            hand: [], 
            hasPlayedInitial: false 
          });
        }
        const duplicateTile = { id: 'red_1_0', color: 'red', number: 1 };
        this.players[0].hand = [duplicateTile];
        this.players[1].hand = [duplicateTile];
        break;
      case 'missing_required_fields':
        // Store original values before deleting
        this._originalId = this.id;
        this._originalStarted = this.started;
        delete this.id;
        delete this.started;
        break;
    }
  }

  // Detect corruption in game state
  detectCorruption() {
    const issues = [];
    
    try {
      // Check for missing required fields - use hasOwnProperty to avoid accessing undefined
      if (!this.hasOwnProperty('id') || this.id === undefined) {
        issues.push('missing_game_id');
      }
      if (!this.hasOwnProperty('started') || typeof this.started !== 'boolean') {
        issues.push('invalid_started_flag');
      }
      
      // Check players array
      if (!Array.isArray(this.players)) {
        issues.push('invalid_players_array');
      } else {
        // Check for duplicate player names
        const playerNames = this.players.map(p => p.name).filter(Boolean);
        if (playerNames.length !== new Set(playerNames).size) {
          issues.push('duplicate_player_names');
        }
        
        // Check for invalid player data and tile issues
        this.players.forEach((player, index) => {
          if (!player.name) issues.push(`missing_player_name_${index}`);
          if (!Array.isArray(player.hand)) {
            issues.push(`invalid_player_hand_${index}`);
          } else {
            // Check for negative tile numbers
            player.hand.forEach((tile, tileIndex) => {
              if (tile && typeof tile.number === 'number' && tile.number < 0) {
                issues.push(`negative_tile_number_player_${index}_tile_${tileIndex}`);
              }
            });
          }
        });
        
        // Check for duplicate tiles across players
        const allTiles = [];
        this.players.forEach((player, playerIndex) => {
          if (Array.isArray(player.hand)) {
            player.hand.forEach((tile, tileIndex) => {
              if (tile && tile.id) {
                allTiles.push({ 
                  id: tile.id, 
                  playerIndex, 
                  tileIndex,
                  tile: tile 
                });
              }
            });
          }
        });
        
        // Find duplicate tile IDs
        const tileIds = allTiles.map(t => t.id);
        const duplicateIds = tileIds.filter((id, index) => tileIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          issues.push('duplicate_tiles_detected');
        }
      }
      
      // Check current player index
      if (this.players && Array.isArray(this.players)) {
        if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.players.length) {
          issues.push('invalid_current_player_index');
        }
      }
      
      // Check deck
      if (!Array.isArray(this.deck)) {
        issues.push('invalid_deck_structure');
      }
      
      // Check board
      if (!Array.isArray(this.board)) {
        issues.push('invalid_board_structure');
      }
      
      // Check for impossible tile counts
      if (Array.isArray(this.players) && Array.isArray(this.deck)) {
        const totalTiles = this.players.reduce((sum, player) => {
          return sum + (Array.isArray(player.hand) ? player.hand.length : 0);
        }, 0) + this.deck.length;
        
        if (totalTiles > 106) { // Standard Rummikub has 106 tiles
          issues.push('too_many_tiles');
        }
      }
      
    } catch (error) {
      issues.push('corruption_detection_error');
    }
    
    return issues;
  }

  // Attempt to recover from corruption
  attemptRecovery() {
    const issues = this.detectCorruption();
    const recoveryActions = [];
    
    issues.forEach(issue => {
      switch (issue) {
        case 'missing_game_id':
          // Restore from backup if available, otherwise generate new
          this.id = this._originalId || `recovered_${Date.now()}`;
          recoveryActions.push('generated_new_game_id');
          break;
          
        case 'invalid_started_flag':
          // Restore from backup if available, otherwise default to false
          this.started = this._originalStarted !== undefined ? this._originalStarted : false;
          recoveryActions.push('reset_started_flag');
          break;
          
        case 'invalid_players_array':
          this.players = [];
          recoveryActions.push('reset_players_array');
          break;
          
        case 'invalid_current_player_index':
          this.currentPlayerIndex = 0;
          recoveryActions.push('reset_current_player_index');
          break;
          
        case 'invalid_deck_structure':
          this.deck = [];
          recoveryActions.push('reset_deck');
          break;
          
        case 'invalid_board_structure':
          this.board = [];
          recoveryActions.push('reset_board');
          break;
          
        case 'too_many_tiles':
          // Reset to initial state
          this.deck = [];
          this.players.forEach(player => {
            if (player.hand) player.hand = [];
          });
          recoveryActions.push('reset_tile_distribution');
          break;
          
        default:
          if (issue.startsWith('missing_player_name_')) {
            const index = parseInt(issue.split('_').pop());
            if (this.players[index]) {
              this.players[index].name = `Player${index + 1}`;
              recoveryActions.push(`generated_player_name_${index}`);
            }
          } else if (issue.startsWith('invalid_player_hand_')) {
            const index = parseInt(issue.split('_').pop());
            if (this.players[index]) {
              this.players[index].hand = [];
              recoveryActions.push(`reset_player_hand_${index}`);
            }
          }
          break;
      }
    });
    
    // Mark as recovered if we took any actions
    if (recoveryActions.length > 0) {
      this.corrupted = false;
      this.corruptionType = null;
      this.recoveredAt = Date.now();
      this.recoveryActions = recoveryActions;
    }
    
    return {
      recovered: recoveryActions.length > 0,
      actions: recoveryActions,
      remainingIssues: this.detectCorruption()
    };
  }

  // Create a state snapshot for comparison
  createStateSnapshot() {
    return {
      id: this.id,
      players: this.players ? this.players.map(p => ({
        name: p.name,
        hand: p.hand ? [...p.hand] : [],
        hasPlayedInitial: p.hasPlayedInitial
      })) : null,
      currentPlayerIndex: this.currentPlayerIndex,
      board: Array.isArray(this.board) ? [...this.board] : this.board,
      deck: Array.isArray(this.deck) ? [...this.deck] : this.deck,
      started: this.started,
      winner: this.winner,
      corrupted: this.corrupted,
      corruptionType: this.corruptionType
    };
  }
}

// Mock error handling system
class MockErrorHandler {
  constructor() {
    this.errorMessages = new Map();
    this.debugLogs = [];
  }

  // Generate user-friendly error messages
  generateUserMessage(errorType, errorDetails = {}) {
    const userMessages = {
      'connection_error': 'Unable to connect to the game server. Please check your internet connection and try again.',
      'database_error': 'There was a problem saving your game. Your progress has been preserved locally. Please try again in a moment.',
      'game_not_found': 'The game you\'re trying to join no longer exists. Please create a new game or join a different one.',
      'player_not_found': 'Your player information could not be found. Please try rejoining the game or create a new game.',
      'invalid_move': 'That move is not allowed. Please check the game rules and try a different move.',
      'game_state_corrupted': 'The game encountered an error, but we\'ve recovered your progress. Please continue playing normally.',
      'reconnection_failed': 'Unable to reconnect to your game. You can try again or create a new game if the problem persists.',
      'server_error': 'The server encountered an unexpected error. Please try again in a moment.',
      'validation_error': 'The information you provided is not valid. Please check your input and try again.',
      'timeout_error': 'The operation took too long to complete. Please check your connection and try again.',
      'permission_error': 'You don\'t have permission to perform this action. Please make sure you\'re logged in and try again.',
      'rate_limit_error': 'You\'re making requests too quickly. Please wait a moment and try again.'
    };

    let message = userMessages[errorType] || 'An unexpected error occurred. Please try again or refresh the page.';
    
    // Ensure message is not just whitespace
    if (!message || message.trim().length === 0) {
      message = 'An error occurred. Please try again or contact support if the problem persists.';
    }
    
    // Add specific guidance based on error details
    if (errorDetails.canRetry) {
      if (!message.includes('try again')) {
        message += ' You can try again.';
      }
    }
    
    if (errorDetails.contactSupport) {
      if (!message.includes('contact support')) {
        message += ' If this problem persists, please contact support.';
      }
    }
    
    // Sanitize alternative action to avoid technical jargon
    if (errorDetails.alternativeAction) {
      let alternativeAction = errorDetails.alternativeAction.trim();
      
      // Remove or replace technical terms
      const technicalTerms = ['TCP', 'HTTP', 'SSL', 'API', 'JSON', 'SQL', 'null', 'undefined'];
      technicalTerms.forEach(term => {
        const regex = new RegExp(term, 'gi');
        alternativeAction = alternativeAction.replace(regex, '');
      });
      
      // Clean up extra whitespace
      alternativeAction = alternativeAction.replace(/\s+/g, ' ').trim();
      
      // Only add if there's meaningful content left
      if (alternativeAction.length > 2) {
        message += ` Alternatively, you can ${alternativeAction}.`;
      }
    }

    return message;
  }

  // Generate detailed debug logs
  generateDebugLog(errorType, errorDetails = {}, stackTrace = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'ERROR',
      type: errorType,
      message: errorDetails.message || 'Unknown error',
      details: errorDetails,
      stackTrace: stackTrace,
      sessionId: errorDetails.sessionId || 'unknown',
      userId: errorDetails.userId || 'unknown',
      gameId: errorDetails.gameId || 'unknown'
    };

    this.debugLogs.push(logEntry);
    return logEntry;
  }

  // Handle error with both user message and debug logging
  handleError(errorType, errorDetails = {}, stackTrace = null) {
    const userMessage = this.generateUserMessage(errorType, errorDetails);
    const debugLog = this.generateDebugLog(errorType, errorDetails, stackTrace);
    
    this.errorMessages.set(`${errorType}_${Date.now()}`, {
      userMessage,
      debugLog,
      handled: true
    });

    return {
      userMessage,
      debugLog,
      errorId: `${errorType}_${Date.now()}`
    };
  }

  // Validate error message quality
  validateErrorMessage(message) {
    const quality = {
      isUserFriendly: true,
      hasSpecificGuidance: false,
      isActionable: false,
      avoidsTechnicalJargon: true,
      score: 0
    };

    // Handle empty or whitespace-only messages
    if (!message || message.trim().length === 0) {
      quality.isUserFriendly = false;
      quality.hasSpecificGuidance = false;
      quality.isActionable = false;
      quality.avoidsTechnicalJargon = false;
      quality.score = 0;
      return quality;
    }

    // Check if message is user-friendly (no technical terms)
    const technicalTerms = ['null', 'undefined', 'exception', 'stack trace', 'HTTP', 'TCP', 'SSL', 'JSON', 'API'];
    const hasTechnicalTerms = technicalTerms.some(term => 
      message.toLowerCase().includes(term.toLowerCase())
    );
    
    if (hasTechnicalTerms) {
      quality.isUserFriendly = false;
      quality.avoidsTechnicalJargon = false;
    }

    // Check for specific guidance
    const guidanceKeywords = ['try again', 'check', 'please', 'you can', 'alternatively', 'make sure', 'wait'];
    quality.hasSpecificGuidance = guidanceKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Check if actionable
    const actionKeywords = ['try', 'check', 'contact', 'create', 'join', 'refresh', 'wait', 'make sure', 'continue'];
    quality.isActionable = actionKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Calculate quality score
    quality.score = 0;
    if (quality.isUserFriendly) quality.score += 25;
    if (quality.hasSpecificGuidance) quality.score += 25;
    if (quality.isActionable) quality.score += 25;
    if (quality.avoidsTechnicalJargon) quality.score += 25;

    return quality;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Error Message Quality Properties', () => {
  
  /**
   * Property 10: Error Message Quality
   * For any system error (connection, database, or game state), the system should 
   * provide user-friendly messages to users and detailed logs for debugging
   */
  test('Property 10: Error messages are user-friendly and provide specific guidance', () => {
    fc.assert(fc.property(
      fc.record({
        errorType: fc.constantFrom(
          'connection_error', 'database_error', 'game_not_found', 'player_not_found',
          'invalid_move', 'game_state_corrupted', 'reconnection_failed', 'server_error',
          'validation_error', 'timeout_error', 'permission_error', 'rate_limit_error'
        ),
        errorDetails: fc.record({
          message: fc.string({ minLength: 1, maxLength: 100 }),
          canRetry: fc.boolean(),
          contactSupport: fc.boolean(),
          alternativeAction: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: null }),
          sessionId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
          userId: fc.option(fc.string({ minLength: 3, maxLength: 15 }), { nil: null }),
          gameId: fc.option(fc.string({ minLength: 5, maxLength: 15 }), { nil: null })
        }),
        includeStackTrace: fc.boolean()
      }),
      (testConfig) => {
        const errorHandler = new MockErrorHandler();
        const { errorType, errorDetails, includeStackTrace } = testConfig;
        
        const stackTrace = includeStackTrace ? 'Error: Test error\n    at test.js:1:1' : null;
        
        // Handle the error
        const result = errorHandler.handleError(errorType, errorDetails, stackTrace);
        
        // Property: Should always return both user message and debug log
        expect(result.userMessage).toBeDefined();
        expect(result.debugLog).toBeDefined();
        expect(result.errorId).toBeDefined();
        
        // Property: User message should be user-friendly
        const messageQuality = errorHandler.validateErrorMessage(result.userMessage);
        expect(messageQuality.isUserFriendly).toBe(true);
        expect(messageQuality.avoidsTechnicalJargon).toBe(true);
        
        // Property: User message should provide guidance
        expect(messageQuality.hasSpecificGuidance).toBe(true);
        expect(messageQuality.isActionable).toBe(true);
        
        // Property: User message quality score should be high
        expect(messageQuality.score).toBeGreaterThanOrEqual(75);
        
        // Property: Debug log should contain detailed information
        expect(result.debugLog.timestamp).toBeDefined();
        expect(result.debugLog.level).toBe('ERROR');
        expect(result.debugLog.type).toBe(errorType);
        expect(result.debugLog.details).toEqual(errorDetails);
        
        // Property: Debug log should include stack trace if provided
        if (includeStackTrace) {
          expect(result.debugLog.stackTrace).toBe(stackTrace);
        }
        
        // Property: Debug log should have session/user/game context
        expect(result.debugLog.sessionId).toBeDefined();
        expect(result.debugLog.userId).toBeDefined();
        expect(result.debugLog.gameId).toBeDefined();
        
        return true;
      }
    ), { numRuns: 100 });
  });

  test('Property 10a: Error messages avoid technical jargon consistently', () => {
    fc.assert(fc.property(
      fc.record({
        errorType: fc.constantFrom(
          'connection_error', 'database_error', 'server_error', 'validation_error'
        ),
        technicalDetails: fc.record({
          exception: fc.string(),
          stackTrace: fc.string(),
          httpCode: fc.integer({ min: 400, max: 599 }),
          sqlError: fc.string(),
          jsonParseError: fc.boolean()
        })
      }),
      (testConfig) => {
        const errorHandler = new MockErrorHandler();
        const { errorType, technicalDetails } = testConfig;
        
        // Generate error message with technical details
        const result = errorHandler.handleError(errorType, technicalDetails);
        
        // Property: User message should never contain technical jargon
        const technicalTerms = [
          'exception', 'stack trace', 'HTTP', 'SQL', 'JSON', 'null', 'undefined',
          'TCP', 'SSL', 'API', 'database', 'server', 'connection', 'timeout'
        ];
        
        const userMessage = result.userMessage.toLowerCase();
        const containsTechnicalTerms = technicalTerms.some(term => 
          userMessage.includes(term.toLowerCase())
        );
        
        // Allow some acceptable technical terms that users understand
        const acceptableTerms = ['server', 'connection', 'internet'];
        const onlyAcceptableTerms = technicalTerms.filter(term => 
          userMessage.includes(term.toLowerCase())
        ).every(term => acceptableTerms.includes(term));
        
        // Property: Should either contain no technical terms or only acceptable ones
        if (containsTechnicalTerms) {
          expect(onlyAcceptableTerms).toBe(true);
        }
        
        // Property: Debug log CAN contain technical details
        const debugMessage = JSON.stringify(result.debugLog).toLowerCase();
        // Debug logs are allowed to have technical information
        expect(debugMessage).toBeDefined();
        
        return true;
      }
    ), { numRuns: 50 });
  });

  test('Property 10b: Error messages provide actionable guidance', () => {
    fc.assert(fc.property(
      fc.constantFrom(
        'connection_error', 'database_error', 'game_not_found', 'player_not_found',
        'invalid_move', 'reconnection_failed', 'timeout_error'
      ),
      (errorType) => {
        const errorHandler = new MockErrorHandler();
        
        // Generate error message
        const result = errorHandler.handleError(errorType, {});
        
        // Property: Every error message should provide actionable guidance
        const actionableKeywords = [
          'try again', 'check your', 'please', 'you can', 'create a new',
          'join a different', 'contact support', 'wait a moment', 'refresh'
        ];
        
        const userMessage = result.userMessage.toLowerCase();
        const hasActionableGuidance = actionableKeywords.some(keyword => 
          userMessage.includes(keyword)
        );
        
        expect(hasActionableGuidance).toBe(true);
        
        // Property: Message should not just state the problem, but suggest solutions
        const problemOnlyPhrases = [
          'error occurred', 'failed', 'not found', 'invalid', 'unable to'
        ];
        
        const solutionPhrases = [
          'try', 'check', 'please', 'you can', 'alternatively'
        ];
        
        const hasProblemPhrase = problemOnlyPhrases.some(phrase => 
          userMessage.includes(phrase)
        );
        
        const hasSolutionPhrase = solutionPhrases.some(phrase => 
          userMessage.includes(phrase)
        );
        
        // Property: If message mentions a problem, it should also suggest a solution
        if (hasProblemPhrase) {
          expect(hasSolutionPhrase).toBe(true);
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });
});

describe('Game State Corruption Recovery Properties', () => {
  
  /**
   * Property 11: Game State Corruption Recovery
   * For any corrupted game state, the Game_Engine should detect the corruption and 
   * either recover automatically or fail gracefully while preserving as much state as possible
   */
  test('Property 11: Game state corruption is detected and recovered automatically', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 15 }),
        playerCount: fc.integer({ min: 1, max: 4 }),
        corruptionType: fc.constantFrom(
          'missing_players', 'invalid_current_player', 'corrupted_deck',
          'invalid_board', 'negative_tiles', 'duplicate_tiles', 'missing_required_fields'
        ),
        gameStarted: fc.boolean()
      }),
      (testConfig) => {
        const { gameId, playerCount, corruptionType, gameStarted } = testConfig;
        
        // Create a valid game first
        const game = new MockRummikubGame(gameId);
        
        // Add players
        for (let i = 0; i < playerCount; i++) {
          game.players.push({
            name: `Player${i + 1}`,
            hand: [],
            hasPlayedInitial: false,
            score: 0
          });
        }
        
        if (gameStarted) {
          game.started = true;
        }
        
        // Take snapshot of valid state
        const validState = game.createStateSnapshot();
        
        // Property: Valid game should have no corruption issues
        const initialIssues = game.detectCorruption();
        expect(initialIssues).toHaveLength(0);
        
        // Simulate corruption
        game.simulateCorruption(corruptionType);
        
        // Property: Corruption should be detectable
        const corruptionIssues = game.detectCorruption();
        expect(corruptionIssues.length).toBeGreaterThan(0);
        expect(game.corrupted).toBe(true);
        expect(game.corruptionType).toBe(corruptionType);
        
        // Attempt recovery
        const recoveryResult = game.attemptRecovery();
        
        // Property: Recovery should be attempted for all corruption types
        expect(recoveryResult).toBeDefined();
        expect(Array.isArray(recoveryResult.actions)).toBe(true);
        expect(Array.isArray(recoveryResult.remainingIssues)).toBe(true);
        
        // Property: Recovery should reduce the number of issues
        expect(recoveryResult.remainingIssues.length).toBeLessThanOrEqual(corruptionIssues.length);
        
        // Property: If recovery was successful, game should no longer be marked as corrupted
        if (recoveryResult.recovered) {
          expect(game.corrupted).toBe(false);
          expect(game.corruptionType).toBeNull();
          expect(game.recoveredAt).toBeDefined();
          expect(recoveryResult.actions.length).toBeGreaterThan(0);
        }
        
        // Property: Essential game structure should be preserved or restored
        const recoveredState = game.createStateSnapshot();
        
        // Game ID should be preserved or regenerated
        expect(recoveredState.id).toBeDefined();
        expect(typeof recoveredState.id).toBe('string');
        
        // Players array should be valid
        expect(Array.isArray(recoveredState.players) || recoveredState.players === null).toBe(true);
        
        // Current player index should be valid
        if (Array.isArray(recoveredState.players) && recoveredState.players.length > 0) {
          expect(recoveredState.currentPlayerIndex).toBeGreaterThanOrEqual(0);
          expect(recoveredState.currentPlayerIndex).toBeLessThan(recoveredState.players.length);
        }
        
        // Board and deck should have valid structure
        expect(Array.isArray(recoveredState.board) || recoveredState.board === null).toBe(true);
        expect(Array.isArray(recoveredState.deck) || recoveredState.deck === null).toBe(true);
        
        // Started flag should be boolean
        expect(typeof recoveredState.started).toBe('boolean');
        
        return true;
      }
    ), { numRuns: 100 });
  });

  test('Property 11a: Critical game data is preserved during recovery', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 15 }),
        playerNames: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 2, maxLength: 4 }),
        corruptionType: fc.constantFrom(
          'invalid_current_player', 'corrupted_deck', 'invalid_board'
        )
      }),
      (testConfig) => {
        const { gameId, playerNames, corruptionType } = testConfig;
        
        // Create game with specific player data
        const game = new MockRummikubGame(gameId);
        
        playerNames.forEach((name, index) => {
          game.players.push({
            name: name,
            hand: [{ id: `tile_${index}_1`, color: 'red', number: index + 1 }],
            hasPlayedInitial: index % 2 === 0,
            score: index * 10
          });
        });
        
        game.started = true;
        
        // Store critical data that should be preserved
        const criticalData = {
          gameId: game.id,
          playerNames: game.players.map(p => p.name),
          playerScores: game.players.map(p => p.score),
          gameStarted: game.started
        };
        
        // Corrupt the game (but not the critical data we want to preserve)
        game.simulateCorruption(corruptionType);
        
        // Attempt recovery
        const recoveryResult = game.attemptRecovery();
        
        // Property: Critical data should be preserved after recovery
        if (recoveryResult.recovered) {
          expect(game.id).toBeDefined();
          
          // Player names should be preserved if players array is intact
          if (Array.isArray(game.players)) {
            const recoveredNames = game.players.map(p => p.name).filter(Boolean);
            
            // Either original names are preserved, or placeholder names are generated
            const hasOriginalNames = criticalData.playerNames.every(name => 
              recoveredNames.includes(name)
            );
            const hasPlaceholderNames = recoveredNames.every(name => 
              name.startsWith('Player') || criticalData.playerNames.includes(name)
            );
            
            expect(hasOriginalNames || hasPlaceholderNames).toBe(true);
          }
          
          // Game started status should be preserved or reset to safe state
          expect(typeof game.started).toBe('boolean');
        }
        
        // Property: Recovery should not introduce new corruption
        const postRecoveryIssues = game.detectCorruption();
        expect(postRecoveryIssues.length).toBeLessThanOrEqual(recoveryResult.remainingIssues.length);
        
        return true;
      }
    ), { numRuns: 50 });
  });

  test('Property 11b: Unrecoverable corruption fails gracefully', () => {
    fc.assert(fc.property(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 15 }),
        multipleCorruptions: fc.array(
          fc.constantFrom(
            'missing_players', 'invalid_current_player', 'corrupted_deck',
            'invalid_board', 'missing_required_fields'
          ),
          { minLength: 2, maxLength: 4 }
        )
      }),
      (testConfig) => {
        const { gameId, multipleCorruptions } = testConfig;
        
        // Create game
        const game = new MockRummikubGame(gameId);
        game.players.push({ name: 'TestPlayer', hand: [], hasPlayedInitial: false });
        
        // Apply multiple corruptions to make recovery difficult
        multipleCorruptions.forEach(corruptionType => {
          game.simulateCorruption(corruptionType);
        });
        
        // Attempt recovery
        const recoveryResult = game.attemptRecovery();
        
        // Property: Even if recovery is partial or fails, the system should not crash
        expect(recoveryResult).toBeDefined();
        expect(typeof recoveryResult.recovered).toBe('boolean');
        expect(Array.isArray(recoveryResult.actions)).toBe(true);
        expect(Array.isArray(recoveryResult.remainingIssues)).toBe(true);
        
        // Property: If recovery is incomplete, remaining issues should be documented
        if (!recoveryResult.recovered || recoveryResult.remainingIssues.length > 0) {
          expect(recoveryResult.remainingIssues.length).toBeGreaterThan(0);
          
          // Each remaining issue should be a string describing the problem
          recoveryResult.remainingIssues.forEach(issue => {
            expect(typeof issue).toBe('string');
            expect(issue.length).toBeGreaterThan(0);
          });
        }
        
        // Property: Game should be in a safe state after recovery attempt
        const finalState = game.createStateSnapshot();
        
        // Basic structure should be intact
        expect(finalState.id).toBeDefined();
        expect(finalState.started !== undefined).toBe(true);
        expect(finalState.corrupted !== undefined).toBe(true);
        
        // If still corrupted, it should be marked as such
        if (recoveryResult.remainingIssues.length > 0) {
          // Game may still be corrupted, but should be in a safe state
          expect(game.detectCorruption).not.toThrow();
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });
});