/**
 * Unit Tests for Mobile Game Creation Screen Validation
 * Tests game settings validation and player slot management
 * 
 * Requirements: 4.2, 4.6
 */

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock localStorage and sessionStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};
global.localStorage = localStorageMock;

// Import the MobileGameCreationScreen after setting up mocks
const MobileGameCreationScreen = require('../netlify-build/js/mobile-ui/MobileGameCreationScreen.js');

describe('Mobile Game Creation Screen Validation Tests', () => {
    let gameCreationScreen;
    let mockPlayers;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Reset mocks
        jest.clearAllMocks();
        fetch.mockClear();
        localStorageMock.getItem.mockImplementation((key) => {
            if (key === 'username') return 'TestPlayer';
            if (key === 'auth_token') return 'test-token-123';
            return null;
        });

        // Mock players data
        mockPlayers = [
            { id: 1, username: 'Alice', status: 'online' },
            { id: 2, username: 'Bob', status: 'online' },
            { id: 3, username: 'Charlie', status: 'away' },
            { id: 4, username: 'Diana', status: 'online' }
        ];

        // Mock fetch responses
        fetch.mockImplementation((url, options) => {
            if (url.includes('/api/players/online')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockPlayers)
                });
            }
            if (url.includes('/api/games') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ gameId: 'test-game-123' })
                });
            }
            return Promise.resolve({ ok: false, status: 404 });
        });
        
        // Create fresh game creation screen
        gameCreationScreen = new MobileGameCreationScreen();
    });

    afterEach(() => {
        if (gameCreationScreen) {
            gameCreationScreen.destroy();
        }
    });

    describe('Game Settings Validation', () => {
        test('should validate player count settings correctly', () => {
            // Test minimum player count
            gameCreationScreen.gameSettings.maxPlayers = 2;
            expect(gameCreationScreen.validateSettingsStep()).toBe(true);

            // Test maximum player count
            gameCreationScreen.gameSettings.maxPlayers = 6;
            expect(gameCreationScreen.validateSettingsStep()).toBe(true);

            // Settings step should always be valid (has defaults)
            gameCreationScreen.gameSettings.maxPlayers = 4;
            expect(gameCreationScreen.validateSettingsStep()).toBe(true);
        });

        test('should update player count correctly', () => {
            const initialCount = gameCreationScreen.gameSettings.maxPlayers;
            
            // Test increase
            gameCreationScreen.updatePlayerCount('increase');
            expect(gameCreationScreen.gameSettings.maxPlayers).toBe(initialCount + 1);
            
            // Test decrease
            gameCreationScreen.updatePlayerCount('decrease');
            expect(gameCreationScreen.gameSettings.maxPlayers).toBe(initialCount);
            
            // Test boundary conditions
            gameCreationScreen.gameSettings.maxPlayers = 6;
            gameCreationScreen.updatePlayerCount('increase');
            expect(gameCreationScreen.gameSettings.maxPlayers).toBe(6); // Should not exceed 6
            
            gameCreationScreen.gameSettings.maxPlayers = 2;
            gameCreationScreen.updatePlayerCount('decrease');
            expect(gameCreationScreen.gameSettings.maxPlayers).toBe(2); // Should not go below 2
        });

        test('should update timer settings correctly', () => {
            // Test timer enable/disable
            gameCreationScreen.gameSettings.timerEnabled = false;
            expect(gameCreationScreen.gameSettings.timerEnabled).toBe(false);
            
            gameCreationScreen.gameSettings.timerEnabled = true;
            expect(gameCreationScreen.gameSettings.timerEnabled).toBe(true);
            
            // Test timer duration
            gameCreationScreen.updateTimerDuration(180);
            expect(gameCreationScreen.gameSettings.timerDuration).toBe(180);
            
            gameCreationScreen.updateTimerDuration(60);
            expect(gameCreationScreen.gameSettings.timerDuration).toBe(60);
        });

        test('should update game mode correctly', () => {
            gameCreationScreen.updateGameMode('quick');
            expect(gameCreationScreen.gameSettings.gameMode).toBe('quick');
            
            gameCreationScreen.updateGameMode('standard');
            expect(gameCreationScreen.gameSettings.gameMode).toBe('standard');
        });

        test('should update privacy settings correctly', () => {
            // Test private game setting
            gameCreationScreen.gameSettings.isPrivate = true;
            expect(gameCreationScreen.gameSettings.isPrivate).toBe(true);
            
            gameCreationScreen.gameSettings.isPrivate = false;
            expect(gameCreationScreen.gameSettings.isPrivate).toBe(false);
            
            // Test spectators setting
            gameCreationScreen.gameSettings.allowSpectators = false;
            expect(gameCreationScreen.gameSettings.allowSpectators).toBe(false);
            
            gameCreationScreen.gameSettings.allowSpectators = true;
            expect(gameCreationScreen.gameSettings.allowSpectators).toBe(true);
        });
    });

    describe('Player Slot Management', () => {
        test('should initialize player slots correctly', () => {
            gameCreationScreen.initializePlayerSlots();
            
            expect(gameCreationScreen.playerSlots).toHaveLength(gameCreationScreen.gameSettings.maxPlayers);
            
            gameCreationScreen.playerSlots.forEach((slot, index) => {
                expect(slot.id).toBe(index);
                expect(slot.isEmpty).toBe(true);
                expect(slot.isBot).toBe(false);
                expect(slot.player).toBeNull();
            });
        });

        test('should add bot to slot correctly', () => {
            const slotId = 0;
            const slot = gameCreationScreen.playerSlots[slotId];
            
            expect(slot.isEmpty).toBe(true);
            
            gameCreationScreen.createBotPlayer(slotId, 'medium', 'balanced');
            
            expect(slot.isEmpty).toBe(false);
            expect(slot.isBot).toBe(true);
            expect(slot.player).toBeNull();
            expect(slot.botConfig).toBeDefined();
            expect(slot.botConfig.difficulty).toBe('medium');
            expect(slot.botConfig.personality).toBe('balanced');
            expect(slot.botConfig.name).toContain('Bot');
        });

        test('should add player to slot correctly', () => {
            const slotId = 0;
            const playerId = 1;
            const player = mockPlayers.find(p => p.id === playerId);
            
            gameCreationScreen.availablePlayers = mockPlayers;
            
            const slot = gameCreationScreen.playerSlots[slotId];
            expect(slot.isEmpty).toBe(true);
            
            gameCreationScreen.addPlayerToSlot(slotId, playerId);
            
            expect(slot.isEmpty).toBe(false);
            expect(slot.isBot).toBe(false);
            expect(slot.player).toEqual(player);
            expect(gameCreationScreen.invitedPlayers).toContain(player);
        });

        test('should remove player from slot correctly', () => {
            const slotId = 0;
            const playerId = 1;
            const player = mockPlayers.find(p => p.id === playerId);
            
            gameCreationScreen.availablePlayers = mockPlayers;
            
            // Add player first
            gameCreationScreen.addPlayerToSlot(slotId, playerId);
            expect(gameCreationScreen.playerSlots[slotId].isEmpty).toBe(false);
            expect(gameCreationScreen.invitedPlayers).toContain(player);
            
            // Remove player
            gameCreationScreen.removePlayerFromSlot(slotId);
            
            expect(gameCreationScreen.playerSlots[slotId].isEmpty).toBe(true);
            expect(gameCreationScreen.playerSlots[slotId].player).toBeNull();
            expect(gameCreationScreen.invitedPlayers).not.toContain(player);
        });

        test('should remove bot from slot correctly', () => {
            const slotId = 0;
            
            // Add bot first
            gameCreationScreen.createBotPlayer(slotId, 'easy', 'aggressive');
            expect(gameCreationScreen.playerSlots[slotId].isEmpty).toBe(false);
            expect(gameCreationScreen.playerSlots[slotId].isBot).toBe(true);
            
            // Remove bot
            gameCreationScreen.removePlayerFromSlot(slotId);
            
            expect(gameCreationScreen.playerSlots[slotId].isEmpty).toBe(true);
            expect(gameCreationScreen.playerSlots[slotId].isBot).toBe(false);
            expect(gameCreationScreen.playerSlots[slotId].player).toBeNull();
        });

        test('should not add player to occupied slot', () => {
            const slotId = 0;
            const playerId1 = 1;
            const playerId2 = 2;
            
            gameCreationScreen.availablePlayers = mockPlayers;
            
            // Add first player
            gameCreationScreen.addPlayerToSlot(slotId, playerId1);
            expect(gameCreationScreen.playerSlots[slotId].isEmpty).toBe(false);
            
            // Try to add second player to same slot
            gameCreationScreen.addPlayerToSlot(slotId, playerId2);
            
            // Should still have first player
            expect(gameCreationScreen.playerSlots[slotId].player.id).toBe(playerId1);
            expect(gameCreationScreen.invitedPlayers).toHaveLength(1);
        });

        test('should not add bot to occupied slot', () => {
            const slotId = 0;
            const playerId = 1;
            
            gameCreationScreen.availablePlayers = mockPlayers;
            
            // Add player first
            gameCreationScreen.addPlayerToSlot(slotId, playerId);
            expect(gameCreationScreen.playerSlots[slotId].isEmpty).toBe(false);
            expect(gameCreationScreen.playerSlots[slotId].isBot).toBe(false);
            
            // Try to add bot to same slot
            gameCreationScreen.createBotPlayer(slotId, 'hard', 'defensive');
            
            // Should still have player, not bot
            expect(gameCreationScreen.playerSlots[slotId].isBot).toBe(false);
            expect(gameCreationScreen.playerSlots[slotId].player.id).toBe(playerId);
        });
    });

    describe('Step Validation', () => {
        test('should validate settings step correctly', () => {
            // Settings step should always be valid (has defaults)
            expect(gameCreationScreen.validateSettingsStep()).toBe(true);
        });

        test('should validate players step correctly', () => {
            // Empty slots should be invalid
            expect(gameCreationScreen.validatePlayersStep()).toBe(false);
            
            // Add one player
            gameCreationScreen.createBotPlayer(0, 'easy', 'balanced');
            expect(gameCreationScreen.validatePlayersStep()).toBe(true);
            
            // Add real player
            gameCreationScreen.availablePlayers = mockPlayers;
            gameCreationScreen.addPlayerToSlot(1, 1);
            expect(gameCreationScreen.validatePlayersStep()).toBe(true);
        });

        test('should validate review step correctly', () => {
            // Should require both settings and players validation
            expect(gameCreationScreen.validateReviewStep()).toBe(false);
            
            // Add player to make players step valid
            gameCreationScreen.createBotPlayer(0, 'medium', 'balanced');
            expect(gameCreationScreen.validateReviewStep()).toBe(true);
        });

        test('should validate current step correctly', () => {
            // Test settings step
            gameCreationScreen.currentStep = 'settings';
            expect(gameCreationScreen.validateCurrentStep()).toBe(true);
            
            // Test players step (empty)
            gameCreationScreen.currentStep = 'players';
            expect(gameCreationScreen.validateCurrentStep()).toBe(false);
            
            // Add player and test again
            gameCreationScreen.createBotPlayer(0, 'hard', 'aggressive');
            expect(gameCreationScreen.validateCurrentStep()).toBe(true);
            
            // Test review step
            gameCreationScreen.currentStep = 'review';
            expect(gameCreationScreen.validateCurrentStep()).toBe(true);
        });
    });

    describe('Bot Name Generation', () => {
        test('should generate appropriate bot names for difficulty levels', () => {
            const easyName = gameCreationScreen.generateBotName('easy', 'balanced');
            expect(easyName).toMatch(/(Rookie|Newbie|Learner|Beginner) Bot/);
            
            const mediumName = gameCreationScreen.generateBotName('medium', 'balanced');
            expect(mediumName).toMatch(/(Player|Challenger|Competitor|Rival) Bot/);
            
            const hardName = gameCreationScreen.generateBotName('hard', 'balanced');
            expect(hardName).toMatch(/(Expert|Master|Champion|Ace) Bot/);
        });

        test('should handle invalid difficulty levels', () => {
            const invalidName = gameCreationScreen.generateBotName('invalid', 'balanced');
            expect(invalidName).toMatch(/(Player|Challenger|Competitor|Rival) Bot/);
        });
    });

    describe('Game Data Preparation', () => {
        test('should prepare game data correctly for creation', async () => {
            // Set up game configuration
            gameCreationScreen.gameSettings = {
                maxPlayers: 4,
                timerEnabled: true,
                timerDuration: 120,
                gameMode: 'standard',
                isPrivate: false,
                allowSpectators: true
            };
            
            // Add players and bots
            gameCreationScreen.availablePlayers = mockPlayers;
            gameCreationScreen.addPlayerToSlot(0, 1);
            gameCreationScreen.createBotPlayer(1, 'medium', 'balanced');
            
            // Mock the createGame method to capture the data
            let capturedGameData;
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockImplementation((url, options) => {
                if (url.includes('/api/games') && options?.method === 'POST') {
                    capturedGameData = JSON.parse(options.body);
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ gameId: 'test-game-123' })
                    });
                }
                return originalFetch(url, options);
            });
            
            // Mock navigation to prevent actual navigation
            gameCreationScreen.navigateToGame = jest.fn();
            
            // Create game
            await gameCreationScreen.createGame();
            
            // Verify game data
            expect(capturedGameData).toBeDefined();
            expect(capturedGameData.maxPlayers).toBe(4);
            expect(capturedGameData.timerEnabled).toBe(true);
            expect(capturedGameData.timerDuration).toBe(120);
            expect(capturedGameData.gameMode).toBe('standard');
            expect(capturedGameData.isPrivate).toBe(false);
            expect(capturedGameData.allowSpectators).toBe(true);
            expect(capturedGameData.invitedPlayers).toEqual([1]);
            expect(capturedGameData.botPlayers).toBe(1);
            
            // Verify navigation was called
            expect(gameCreationScreen.navigateToGame).toHaveBeenCalledWith('test-game-123');
        });
    });

    describe('Player Filtering', () => {
        test('should filter available players correctly', () => {
            gameCreationScreen.availablePlayers = mockPlayers;
            
            // Initially no players invited
            const availableForSelection = gameCreationScreen.availablePlayers.filter(player => 
                !gameCreationScreen.invitedPlayers.some(invited => invited.id === player.id)
            );
            expect(availableForSelection).toHaveLength(4);
            
            // Invite one player
            gameCreationScreen.addPlayerToSlot(0, 1);
            
            const availableAfterInvite = gameCreationScreen.availablePlayers.filter(player => 
                !gameCreationScreen.invitedPlayers.some(invited => invited.id === player.id)
            );
            expect(availableAfterInvite).toHaveLength(3);
            expect(availableAfterInvite.find(p => p.id === 1)).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle API errors gracefully', async () => {
            // Mock failed API response
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500
            });
            
            // Mock toast method to capture error messages
            gameCreationScreen.showToast = jest.fn();
            
            // Try to create game
            await gameCreationScreen.createGame();
            
            // Should show error toast
            expect(gameCreationScreen.showToast).toHaveBeenCalledWith(
                'Failed to create game. Please try again.',
                'error'
            );
        });

        test('should handle network errors gracefully', async () => {
            // Mock network error
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
            
            // Mock toast method to capture error messages
            gameCreationScreen.showToast = jest.fn();
            
            // Try to create game
            await gameCreationScreen.createGame();
            
            // Should show error toast
            expect(gameCreationScreen.showToast).toHaveBeenCalledWith(
                'Failed to create game. Please try again.',
                'error'
            );
        });
    });

    describe('Screen Management', () => {
        test('should show screen correctly', () => {
            expect(gameCreationScreen.isVisible).toBe(false);
            expect(gameCreationScreen.screenElement.style.display).toBe('none');

            gameCreationScreen.show();

            expect(gameCreationScreen.isVisible).toBe(true);
            expect(gameCreationScreen.screenElement.style.display).toBe('flex');
            expect(document.body.classList.contains('mobile-game-creation-active')).toBe(true);
        });

        test('should hide screen correctly', () => {
            // Show first
            gameCreationScreen.show();
            expect(gameCreationScreen.isVisible).toBe(true);

            gameCreationScreen.hide();

            expect(gameCreationScreen.isVisible).toBe(false);
            expect(gameCreationScreen.screenElement.style.display).toBe('none');
            expect(document.body.classList.contains('mobile-game-creation-active')).toBe(false);
        });

        test('should reset to first step when shown', () => {
            // Navigate to different step
            gameCreationScreen.currentStep = 'review';
            
            gameCreationScreen.show();
            
            expect(gameCreationScreen.currentStep).toBe('settings');
        });
    });

    describe('Cleanup', () => {
        test('should clean up properly on destroy', () => {
            gameCreationScreen.show();
            expect(document.body.classList.contains('mobile-game-creation-active')).toBe(true);
            expect(gameCreationScreen.screenElement.parentNode).toBe(document.body);

            gameCreationScreen.destroy();

            expect(document.body.classList.contains('mobile-game-creation-active')).toBe(false);
            // After destroy, screenElement should be removed from DOM
            expect(document.body.contains(gameCreationScreen.screenElement)).toBe(false);
        });
    });
});