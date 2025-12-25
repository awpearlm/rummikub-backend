/**
 * Unit Tests for Mobile Player Avatar State Management
 * Tests the core functionality of the player avatar system
 * 
 * Feature: mobile-ui, Property 3: Player Avatar State Synchronization
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6
 */

// Setup DOM environment for testing
beforeAll(() => {
    document.body.innerHTML = `
        <div id="testContainer" class="mobile-game-avatars-container"></div>
    `;
});

// Import the PlayerAvatarSystem after setting up environment
const PlayerAvatarSystem = require('../netlify-build/js/mobile-ui/PlayerAvatarSystem.js');

describe('Mobile Player Avatar State Management Unit Tests', () => {
    let avatarSystem;
    let container;

    beforeEach(() => {
        container = document.getElementById('testContainer');
        container.innerHTML = '';
        avatarSystem = new PlayerAvatarSystem(container);
    });

    afterEach(() => {
        if (avatarSystem) {
            avatarSystem.destroy();
        }
    });

    test('should create avatar with correct player information', () => {
        const playerData = {
            playerId: 'test-player',
            playerName: 'Alice',
            isConnected: true,
            tileCount: 14,
            score: 50
        };
        
        const success = avatarSystem.addPlayer(playerData);
        expect(success).toBe(true);
        
        // Verify avatar was created
        const avatarElement = container.querySelector(`[data-player-id="${playerData.playerId}"]`);
        expect(avatarElement).toBeTruthy();
        
        // Verify initial is displayed correctly
        const circle = avatarElement.querySelector('.player-avatar-circle');
        expect(circle).toBeTruthy();
        expect(circle.textContent).toBe('A');
        
        // Verify connection status indicator
        const connectionStatus = avatarElement.querySelector('.player-avatar-connection-status');
        expect(connectionStatus).toBeTruthy();
        expect(connectionStatus.classList.contains('connected')).toBe(true);
        
        // Verify tooltip contains correct information
        const tooltip = avatarElement.querySelector('.player-avatar-tooltip');
        expect(tooltip).toBeTruthy();
        expect(tooltip.innerHTML).toContain('Alice');
        expect(tooltip.innerHTML).toContain('14');
        expect(tooltip.innerHTML).toContain('50');
        
        // Verify stored data is correct
        const storedData = avatarSystem.getPlayer(playerData.playerId);
        expect(storedData).toBeTruthy();
        expect(storedData.playerId).toBe(playerData.playerId);
        expect(storedData.playerName).toBe(playerData.playerName);
        expect(storedData.isConnected).toBe(playerData.isConnected);
    });

    test('should manage turn indicators correctly', () => {
        const players = [
            { playerId: 'player1', playerName: 'Alice', isConnected: true, tileCount: 14, score: 0 },
            { playerId: 'player2', playerName: 'Bob', isConnected: true, tileCount: 13, score: 25 },
            { playerId: 'player3', playerName: 'Charlie', isConnected: true, tileCount: 12, score: 15 }
        ];
        
        // Add all players
        players.forEach(player => {
            avatarSystem.addPlayer(player);
        });
        
        // Set current turn to player2
        avatarSystem.setCurrentTurn('player2');
        
        // Verify only player2 has turn indicator
        players.forEach(player => {
            const avatarElement = container.querySelector(`[data-player-id="${player.playerId}"]`);
            expect(avatarElement).toBeTruthy();
            
            const isCurrentTurn = player.playerId === 'player2';
            expect(avatarElement.classList.contains('current-turn')).toBe(isCurrentTurn);
            
            // Verify stored data reflects turn status
            const storedData = avatarSystem.getPlayer(player.playerId);
            expect(storedData.isCurrentTurn).toBe(isCurrentTurn);
        });
        
        // Verify getCurrentTurnPlayer returns correct player
        const currentPlayer = avatarSystem.getCurrentTurnPlayer();
        expect(currentPlayer).toBeTruthy();
        expect(currentPlayer.playerId).toBe('player2');
    });

    test('should update connection status correctly', () => {
        const playerData = {
            playerId: 'test-player',
            playerName: 'Alice',
            isConnected: true,
            tileCount: 10,
            score: 50
        };
        
        avatarSystem.addPlayer(playerData);
        
        // Change connection status to disconnected
        avatarSystem.setPlayerConnected(playerData.playerId, false);
        
        // Verify visual update
        const avatarElement = container.querySelector(`[data-player-id="${playerData.playerId}"]`);
        const connectionStatus = avatarElement.querySelector('.player-avatar-connection-status');
        expect(connectionStatus.classList.contains('connected')).toBe(false);
        
        // Verify opacity reflects connection status
        expect(avatarElement.style.opacity).toBe('0.6');
        
        // Verify stored data is updated
        const storedData = avatarSystem.getPlayer(playerData.playerId);
        expect(storedData.isConnected).toBe(false);
        
        // Change back to connected
        avatarSystem.setPlayerConnected(playerData.playerId, true);
        expect(connectionStatus.classList.contains('connected')).toBe(true);
        expect(avatarElement.style.opacity).toBe('1');
    });

    test('should update player stats in tooltips', () => {
        const playerData = {
            playerId: 'test-player',
            playerName: 'Alice',
            isConnected: true,
            tileCount: 14,
            score: 50
        };
        
        avatarSystem.addPlayer(playerData);
        
        // Update stats
        const newStats = { tileCount: 10, score: 75 };
        avatarSystem.updatePlayerStats(playerData.playerId, newStats);
        
        // Verify tooltip contains updated stats
        const avatarElement = container.querySelector(`[data-player-id="${playerData.playerId}"]`);
        const tooltip = avatarElement.querySelector('.player-avatar-tooltip');
        expect(tooltip.innerHTML).toContain('10');
        expect(tooltip.innerHTML).toContain('75');
        
        // Verify stored data is updated
        const storedData = avatarSystem.getPlayer(playerData.playerId);
        expect(storedData.tileCount).toBe(10);
        expect(storedData.score).toBe(75);
    });

    test('should handle duplicate player IDs gracefully', () => {
        const playerData = {
            playerId: 'test-player',
            playerName: 'Test Player',
            isConnected: true,
            tileCount: 10,
            score: 50
        };
        
        // Add player first time
        const firstAdd = avatarSystem.addPlayer(playerData);
        expect(firstAdd).toBe(true);
        expect(avatarSystem.getPlayerCount()).toBe(1);
        
        // Try to add same player again (should update instead)
        const secondAdd = avatarSystem.addPlayer(playerData);
        expect(secondAdd).toBe(true);
        expect(avatarSystem.getPlayerCount()).toBe(1);
    });

    test('should handle maximum avatar limit', () => {
        const maxAvatars = avatarSystem.config.maxAvatars;
        
        // Add maximum number of players
        for (let i = 0; i < maxAvatars; i++) {
            const success = avatarSystem.addPlayer({
                playerId: `player-${i}`,
                playerName: `Player ${i}`,
                isConnected: true,
                tileCount: 10,
                score: 0
            });
            expect(success).toBe(true);
        }
        
        // Try to add one more player
        const extraPlayer = avatarSystem.addPlayer({
            playerId: 'extra-player',
            playerName: 'Extra Player',
            isConnected: true,
            tileCount: 10,
            score: 0
        });
        
        expect(extraPlayer).toBe(false);
        expect(avatarSystem.getPlayerCount()).toBe(maxAvatars);
    });

    test('should handle avatar click interactions', (done) => {
        const playerData = {
            playerId: 'clickable-player',
            playerName: 'Clickable Player',
            isConnected: true,
            tileCount: 10,
            score: 50
        };
        
        avatarSystem.addPlayer(playerData);
        
        // Listen for avatar click event
        avatarSystem.on('avatarClicked', (data) => {
            expect(data.playerId).toBe(playerData.playerId);
            expect(data.playerData).toBeTruthy();
            done();
        });
        
        // Simulate click on avatar
        const avatarElement = container.querySelector(`[data-player-id="${playerData.playerId}"]`);
        avatarElement.click();
    });

    test('should handle turn transitions with events', (done) => {
        const playerData = {
            playerId: 'turn-player',
            playerName: 'Turn Player',
            isConnected: true,
            tileCount: 10,
            score: 50
        };
        
        avatarSystem.addPlayer(playerData);
        
        // Listen for turn change event
        avatarSystem.on('turnChanged', (data) => {
            expect(data.playerId).toBe(playerData.playerId);
            expect(data.playerData.isCurrentTurn).toBe(true);
            done();
        });
        
        // Set current turn
        avatarSystem.setCurrentTurn(playerData.playerId);
    });

    test('should clean up resources on destroy', () => {
        const playerData = {
            playerId: 'cleanup-player',
            playerName: 'Cleanup Player',
            isConnected: true,
            tileCount: 10,
            score: 50
        };
        
        avatarSystem.addPlayer(playerData);
        expect(avatarSystem.getPlayerCount()).toBe(1);
        expect(container.children.length).toBe(1);
        
        avatarSystem.destroy();
        expect(avatarSystem.getPlayerCount()).toBe(0);
        expect(container.children.length).toBe(0);
    });

    test('should handle missing player operations gracefully', () => {
        // Try to update non-existent player
        const updateResult = avatarSystem.updatePlayer({
            playerId: 'non-existent',
            playerName: 'Non Existent',
            tileCount: 5
        });
        expect(updateResult).toBe(false);
        
        // Try to remove non-existent player
        const removeResult = avatarSystem.removePlayer('non-existent');
        expect(removeResult).toBe(false);
        
        // Try to set turn for non-existent player
        avatarSystem.setCurrentTurn('non-existent');
        expect(avatarSystem.getCurrentTurnPlayer()).toBeNull();
    });

    test('should handle tooltip visibility correctly', () => {
        const playerData = {
            playerId: 'tooltip-player',
            playerName: 'Tooltip Player',
            isConnected: true,
            tileCount: 10,
            score: 50
        };
        
        avatarSystem.addPlayer(playerData);
        
        const avatarElement = container.querySelector(`[data-player-id="${playerData.playerId}"]`);
        const tooltip = avatarElement.querySelector('.player-avatar-tooltip');
        
        // Initially tooltip should not be visible
        expect(tooltip.classList.contains('visible')).toBe(false);
        
        // Click to show tooltip
        avatarElement.click();
        expect(tooltip.classList.contains('visible')).toBe(true);
        
        // Click again to hide tooltip
        avatarElement.click();
        expect(tooltip.classList.contains('visible')).toBe(false);
    });

    test('should assign colors consistently', () => {
        const players = [
            { playerId: 'player1', playerName: 'Alice', isConnected: true, tileCount: 14, score: 0 },
            { playerId: 'player2', playerName: 'Bob', isConnected: true, tileCount: 13, score: 25 },
            { playerId: 'player3', playerName: 'Charlie', isConnected: true, tileCount: 12, score: 15 }
        ];
        
        // Add all players
        players.forEach(player => {
            avatarSystem.addPlayer(player);
        });
        
        // Verify each player has a color assigned
        const allPlayers = avatarSystem.getAllPlayers();
        allPlayers.forEach((player, index) => {
            expect(player.color).toBeTruthy();
            expect(typeof player.color).toBe('string');
            expect(player.color).toMatch(/^#[0-9A-F]{6}$/i);
            
            // Verify color is applied to DOM element
            const avatarElement = container.querySelector(`[data-player-id="${player.playerId}"]`);
            const circle = avatarElement.querySelector('.player-avatar-circle');
            expect(circle.style.backgroundColor).toBeTruthy();
        });
    });
});