/**
 * Property-Based Tests for Notification Broadcasting
 * Feature: player-reconnection-management, Property 7: Notification Broadcasting
 * Validates: Requirements 1.3, 6.3, 9.1, 9.2, 9.5
 */

const fc = require('fast-check');
const NotificationBroadcaster = require('../services/notificationBroadcaster');
const EventEmitter = require('events');

// Mock Socket.IO for testing
class MockSocketIO extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.emittedEvents = [];
  }

  to(roomId) {
    return {
      emit: (eventName, data) => {
        this.emittedEvents.push({
          room: roomId,
          event: eventName,
          data: data,
          timestamp: new Date()
        });
      }
    };
  }

  getEmittedEvents() {
    return this.emittedEvents;
  }

  clearEvents() {
    this.emittedEvents = [];
  }
}

describe('Notification Broadcasting Property Tests', () => {
  let mockIO;
  let notificationBroadcaster;

  beforeEach(() => {
    mockIO = new MockSocketIO();
    notificationBroadcaster = new NotificationBroadcaster(mockIO);
  });

  afterEach(() => {
    if (notificationBroadcaster) {
      notificationBroadcaster.shutdown();
    }
  });

  /**
   * Property 7: Notification Broadcasting
   * For any pause, reconnection, or continuation event, all remaining players should receive 
   * appropriate notifications with complete information
   * Validates: Requirements 1.3, 6.3, 9.1, 9.2, 9.5
   */
  test('Property 7: All pause events broadcast complete notifications to all players', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        playerName: fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
        playerId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        reason: fc.constantFrom('CURRENT_PLAYER_DISCONNECT', 'MULTIPLE_DISCONNECTS', 'NETWORK_INSTABILITY'),
        pausedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
      }),
      async (pauseInfo) => {
        // Clear previous events
        mockIO.clearEvents();
        
        // Broadcast game pause notification
        notificationBroadcaster.broadcastGamePaused(pauseInfo.gameId, pauseInfo);
        
        // Property: Exactly one pause notification should be emitted
        const events = mockIO.getEmittedEvents();
        expect(events).toHaveLength(1);
        
        const pauseEvent = events[0];
        
        // Property: Event should be sent to correct room
        expect(pauseEvent.room).toBe(pauseInfo.gameId);
        expect(pauseEvent.event).toBe('gamePaused');
        
        // Property: Notification should contain complete information
        expect(pauseEvent.data.type).toBe('game_paused');
        expect(pauseEvent.data.gameId).toBe(pauseInfo.gameId);
        expect(pauseEvent.data.playerName).toBe(pauseInfo.playerName);
        expect(pauseEvent.data.playerId).toBe(pauseInfo.playerId);
        expect(pauseEvent.data.reason).toBe(pauseInfo.reason);
        expect(pauseEvent.data.pausedAt).toBe(pauseInfo.pausedAt);
        
        // Property: Message should be formatted appropriately for the reason
        expect(pauseEvent.data.message).toContain(pauseInfo.playerName);
        expect(pauseEvent.data.message).toContain('paused');
        
        // Property: Timestamp should be recent
        expect(pauseEvent.data.timestamp).toBeInstanceOf(Date);
        expect(Date.now() - pauseEvent.data.timestamp.getTime()).toBeLessThan(1000);
      }
    ), { numRuns: 100 });
  });

  test('Property 7: All resume events broadcast welcome back messages with duration info', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        playerName: fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
        playerId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        resumedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
        pauseDuration: fc.integer({ min: 1000, max: 600000 }), // 1 second to 10 minutes
        disconnectedDuration: fc.integer({ min: 1000, max: 600000 }),
        isCurrentPlayer: fc.boolean()
      }),
      async (resumeInfo) => {
        // Clear previous events
        mockIO.clearEvents();
        
        // Broadcast game resume notification
        notificationBroadcaster.broadcastGameResumed(resumeInfo.gameId, resumeInfo);
        
        // Broadcast welcome back message
        notificationBroadcaster.broadcastWelcomeBack(resumeInfo.gameId, {
          playerName: resumeInfo.playerName,
          playerId: resumeInfo.playerId,
          disconnectedDuration: resumeInfo.disconnectedDuration,
          isCurrentPlayer: resumeInfo.isCurrentPlayer
        });
        
        // Property: Exactly two notifications should be emitted (resume + welcome back)
        const events = mockIO.getEmittedEvents();
        expect(events).toHaveLength(2);
        
        const resumeEvent = events.find(e => e.event === 'gameResumed');
        const welcomeEvent = events.find(e => e.event === 'playerWelcomeBack');
        
        // Property: Both events should exist
        expect(resumeEvent).toBeDefined();
        expect(welcomeEvent).toBeDefined();
        
        // Property: Resume event should contain complete information
        expect(resumeEvent.data.type).toBe('game_resumed');
        expect(resumeEvent.data.gameId).toBe(resumeInfo.gameId);
        expect(resumeEvent.data.playerName).toBe(resumeInfo.playerName);
        expect(resumeEvent.data.pauseDuration).toBe(resumeInfo.pauseDuration);
        expect(resumeEvent.data.formattedPauseDuration).toBeDefined();
        
        // Property: Welcome back event should contain complete information
        expect(welcomeEvent.data.type).toBe('player_welcome_back');
        expect(welcomeEvent.data.gameId).toBe(resumeInfo.gameId);
        expect(welcomeEvent.data.playerName).toBe(resumeInfo.playerName);
        expect(welcomeEvent.data.isCurrentPlayer).toBe(resumeInfo.isCurrentPlayer);
        expect(welcomeEvent.data.formattedDisconnectedDuration).toBeDefined();
        
        // Property: Welcome message should indicate turn status for current player
        if (resumeInfo.isCurrentPlayer) {
          expect(welcomeEvent.data.message).toContain("It's your turn");
        } else {
          expect(welcomeEvent.data.message).toContain("The game continues");
        }
      }
    ), { numRuns: 100 });
  });

  test('Property 7: Grace period updates broadcast periodic notifications with accurate timing', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        targetPlayerName: fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
        targetPlayerId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        duration: fc.integer({ min: 60000, max: 600000 }), // 1 to 10 minutes
        startTime: fc.constant(new Date(Date.now() - 30000)) // Always 30 seconds ago
      }),
      async (gracePeriodInfo) => {
        // Clear previous events
        mockIO.clearEvents();
        
        // Start grace period updates
        notificationBroadcaster.startGracePeriodUpdates(gracePeriodInfo.gameId, gracePeriodInfo);
        
        // Property: Initial grace period start notification should be emitted
        const events = mockIO.getEmittedEvents();
        expect(events.length).toBeGreaterThanOrEqual(1);
        
        const startEvent = events.find(e => e.event === 'gracePeriodStart');
        expect(startEvent).toBeDefined();
        
        // Property: Start event should contain complete information
        expect(startEvent.data.type).toBe('grace_period_start');
        expect(startEvent.data.gameId).toBe(gracePeriodInfo.gameId);
        expect(startEvent.data.targetPlayerName).toBe(gracePeriodInfo.targetPlayerName);
        expect(startEvent.data.targetPlayerId).toBe(gracePeriodInfo.targetPlayerId);
        expect(startEvent.data.duration).toBe(gracePeriodInfo.duration);
        
        // Property: Time remaining should be calculated correctly
        expect(startEvent.data.timeRemaining).toBeGreaterThan(0);
        expect(startEvent.data.timeRemaining).toBeLessThanOrEqual(gracePeriodInfo.duration);
        expect(startEvent.data.formattedTimeRemaining).toMatch(/^\d+:\d{2}$/);
        
        // Property: Message should contain player name
        expect(startEvent.data.message).toContain(gracePeriodInfo.targetPlayerName);
        expect(startEvent.data.message).toContain('reconnect');
        
        // Clean up
        notificationBroadcaster.stopGracePeriodUpdates(gracePeriodInfo.gameId);
      }
    ), { numRuns: 100 });
  });

  test('Property 7: Continuation options broadcast complete option descriptions', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        targetPlayerName: fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
        targetPlayerId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        options: fc.constantFrom(
          ['skip_turn', 'add_bot', 'end_game'],
          ['skip_turn', 'end_game'],
          ['add_bot', 'end_game']
        )
      }),
      async (optionsInfo) => {
        // Clear previous events
        mockIO.clearEvents();
        
        // Broadcast continuation options
        notificationBroadcaster.broadcastContinuationOptions(optionsInfo.gameId, optionsInfo);
        
        // Property: Exactly one options notification should be emitted
        const events = mockIO.getEmittedEvents();
        expect(events).toHaveLength(1);
        
        const optionsEvent = events[0];
        
        // Property: Event should be sent to correct room
        expect(optionsEvent.room).toBe(optionsInfo.gameId);
        expect(optionsEvent.event).toBe('continuationOptions');
        
        // Property: Options should be formatted with complete descriptions
        expect(optionsEvent.data.type).toBe('continuation_options');
        expect(optionsEvent.data.gameId).toBe(optionsInfo.gameId);
        expect(optionsEvent.data.targetPlayerName).toBe(optionsInfo.targetPlayerName);
        expect(optionsEvent.data.options).toHaveLength(optionsInfo.options.length);
        
        // Property: Each option should have complete information
        optionsEvent.data.options.forEach(option => {
          expect(option.id).toBeDefined();
          expect(option.title).toBeDefined();
          expect(option.description).toBeDefined();
          expect(option.icon).toBeDefined();
          
          // Property: Option should be one of the valid choices
          expect(['skip_turn', 'add_bot', 'end_game']).toContain(option.id);
        });
        
        // Property: Message should contain target player name
        expect(optionsEvent.data.message).toContain(optionsInfo.targetPlayerName);
      }
    ), { numRuns: 100 });
  });

  test('Property 7: Voting progress broadcasts include complete vote information', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        voterName: fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
        choice: fc.constantFrom('skip_turn', 'add_bot', 'end_game'),
        totalVotes: fc.integer({ min: 1, max: 4 }),
        totalPlayers: fc.integer({ min: 2, max: 4 }),
        voteCounts: fc.record({
          skip_turn: fc.integer({ min: 0, max: 4 }),
          add_bot: fc.integer({ min: 0, max: 4 }),
          end_game: fc.integer({ min: 0, max: 4 })
        })
      }),
      async (votingInfo) => {
        // Ensure totalVotes is not greater than totalPlayers
        const adjustedVotingInfo = {
          ...votingInfo,
          totalVotes: Math.min(votingInfo.totalVotes, votingInfo.totalPlayers)
        };
        
        // Clear previous events
        mockIO.clearEvents();
        
        // Broadcast voting progress
        notificationBroadcaster.broadcastVotingProgress(adjustedVotingInfo.gameId, adjustedVotingInfo);
        
        // Property: Exactly one voting progress notification should be emitted
        const events = mockIO.getEmittedEvents();
        expect(events).toHaveLength(1);
        
        const votingEvent = events[0];
        
        // Property: Event should contain complete voting information
        expect(votingEvent.data.type).toBe('voting_progress');
        expect(votingEvent.data.gameId).toBe(adjustedVotingInfo.gameId);
        expect(votingEvent.data.voterName).toBe(adjustedVotingInfo.voterName);
        expect(votingEvent.data.choice).toBe(adjustedVotingInfo.choice);
        expect(votingEvent.data.totalVotes).toBe(adjustedVotingInfo.totalVotes);
        expect(votingEvent.data.totalPlayers).toBe(adjustedVotingInfo.totalPlayers);
        
        // Property: Choice should be formatted as readable text
        expect(votingEvent.data.choiceText).toBeDefined();
        expect(votingEvent.data.choiceText).not.toContain('_');
        
        // Property: Vote counts should be included
        expect(votingEvent.data.voteCounts).toEqual(adjustedVotingInfo.voteCounts);
        
        // Property: Completion status should be accurate
        const expectedComplete = adjustedVotingInfo.totalVotes >= adjustedVotingInfo.totalPlayers;
        expect(votingEvent.data.isComplete).toBe(expectedComplete);
        
        // Property: Message should contain voter name and choice
        expect(votingEvent.data.message).toContain(adjustedVotingInfo.voterName);
        expect(votingEvent.data.message).toContain(`${adjustedVotingInfo.totalVotes}/${adjustedVotingInfo.totalPlayers}`);
      }
    ), { numRuns: 100 });
  });

  test('Property 7: Continuation decisions broadcast final results with action details', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        gameId: fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
        decision: fc.constantFrom('skip_turn', 'add_bot', 'end_game'),
        targetPlayerName: fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
        actionResult: fc.record({
          type: fc.constantFrom('skip_turn', 'add_bot', 'end_game'),
          targetPlayerId: fc.string({ minLength: 5, maxLength: 20 }),
          message: fc.string({ minLength: 10, maxLength: 100 }),
          botName: fc.option(fc.string({ minLength: 5, maxLength: 15 }))
        }),
        votes: fc.array(fc.record({
          playerId: fc.string({ minLength: 5, maxLength: 20 }),
          choice: fc.constantFrom('skip_turn', 'add_bot', 'end_game')
        }), { minLength: 1, maxLength: 4 })
      }),
      async (decisionInfo) => {
        // Clear previous events
        mockIO.clearEvents();
        
        // Broadcast continuation decision
        notificationBroadcaster.broadcastContinuationDecision(decisionInfo.gameId, decisionInfo);
        
        // Property: Exactly one decision notification should be emitted
        const events = mockIO.getEmittedEvents();
        expect(events).toHaveLength(1);
        
        const decisionEvent = events[0];
        
        // Property: Event should contain complete decision information
        expect(decisionEvent.data.type).toBe('continuation_decision');
        expect(decisionEvent.data.gameId).toBe(decisionInfo.gameId);
        expect(decisionEvent.data.decision).toBe(decisionInfo.decision);
        expect(decisionEvent.data.targetPlayerName).toBe(decisionInfo.targetPlayerName);
        expect(decisionEvent.data.actionResult).toEqual(decisionInfo.actionResult);
        expect(decisionEvent.data.votes).toEqual(decisionInfo.votes);
        
        // Property: Decision should be formatted as readable text
        expect(decisionEvent.data.decisionText).toBeDefined();
        expect(decisionEvent.data.decisionText).not.toContain('_');
        
        // Property: Message should be appropriate for the decision type
        expect(decisionEvent.data.message).toContain(decisionInfo.targetPlayerName);
        
        if (decisionInfo.decision === 'skip_turn') {
          expect(decisionEvent.data.message).toContain('skipped');
        } else if (decisionInfo.decision === 'add_bot') {
          expect(decisionEvent.data.message).toContain('replaced');
        } else if (decisionInfo.decision === 'end_game') {
          expect(decisionEvent.data.message).toContain('ended');
        }
        
        // Property: Timestamp should be recent
        expect(decisionEvent.data.timestamp).toBeInstanceOf(Date);
        expect(Date.now() - decisionEvent.data.timestamp.getTime()).toBeLessThan(1000);
      }
    ), { numRuns: 100 });
  });

  // Test duration formatting utility
  test('Duration formatting produces human-readable strings', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 7200000 }), // 0 to 2 hours
      (milliseconds) => {
        const formatted = notificationBroadcaster.formatDuration(milliseconds);
        
        // Property: Should always return a string
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
        
        // Property: Should not contain raw numbers without units
        if (milliseconds >= 1000) {
          expect(formatted).toMatch(/(second|minute|hour)/);
        }
        
        // Property: Should handle edge cases
        if (milliseconds < 1000) {
          expect(formatted).toBe('less than a second');
        }
      }
    ), { numRuns: 100 });
  });

  // Test time remaining formatting
  test('Time remaining formatting produces MM:SS format', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 3600000 }), // 0 to 1 hour
      (milliseconds) => {
        const formatted = notificationBroadcaster.formatTimeRemaining(milliseconds);
        
        // Property: Should always return MM:SS format
        expect(formatted).toMatch(/^\d+:\d{2}$/);
        
        // Property: Seconds should be 00-59
        const [minutes, seconds] = formatted.split(':');
        expect(parseInt(seconds)).toBeGreaterThanOrEqual(0);
        expect(parseInt(seconds)).toBeLessThanOrEqual(59);
        
        // Property: Should handle zero correctly
        if (milliseconds <= 0) {
          expect(formatted).toBe('0:00');
        }
      }
    ), { numRuns: 100 });
  });
});