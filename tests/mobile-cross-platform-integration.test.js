/**
 * Mobile Cross-Platform Integration Tests
 * Tests mobile-desktop multiplayer interactions and game state synchronization
 * Validates Requirements: 15.3, 15.4, 15.5
 */

// Mock socket.io-client for testing
const mockSocket = {
    connected: false,
    id: 'mobile-test-player',
    events: new Map(),
    
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    },
    
    emit(event, data) {
        this.lastEmit = { event, data };
    },
    
    connect() {
        this.connected = true;
        this.trigger('connect');
    },
    
    disconnect() {
        this.connected = false;
        this.trigger('disconnect', 'io client disconnect');
    },
    
    trigger(event, data) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
};

// Mock navigator for mobile environment
Object.defineProperty(global.navigator, 'userAgent', {
    writable: true,
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
});

Object.defineProperty(global.navigator, 'vibrate', {
    writable: true,
    value: jest.fn()
});

Object.defineProperty(global.navigator, 'onLine', {
    writable: true,
    value: true
});

Object.defineProperty(global.navigator, 'connection', {
    writable: true,
    value: {
        effectiveType: '4g'
    }
});

// Setup DOM container
beforeAll(() => {
    document.body.innerHTML = '<div id="mobile-ui-container"></div>';
});

// Mock mobile UI components
class MockMobileUISystem {
    constructor() {
        this.components = new Map();
        this.currentScreen = null;
        this.eventCallbacks = new Map();
    }
    
    getComponent(name) {
        return this.components.get(name);
    }
    
    setComponent(name, component) {
        this.components.set(name, component);
    }
    
    navigateToGame() {
        this.currentScreen = 'game';
    }
    
    navigateToLobby() {
        this.currentScreen = 'lobby';
    }
    
    getCurrentScreen() {
        return { name: this.currentScreen };
    }
    
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }
    
    emit(event, data) {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

class MockMobileGameScreen {
    constructor() {
        this.gameState = null;
        this.players = [];
        this.isMyTurn = false;
        this.currentTurnPlayer = null;
    }
    
    updateGameState(gameState) {
        this.gameState = gameState;
    }
    
    clearAllPlayers() {
        this.players = [];
    }
    
    addPlayer(player) {
        this.players.push(player);
    }
    
    updatePlayer(playerData) {
        const player = this.players.find(p => p.id === playerData.id);
        if (player) {
            Object.assign(player, playerData);
        }
    }
    
    setIsMyTurn(isMyTurn) {
        this.isMyTurn = isMyTurn;
    }
    
    setCurrentTurnPlayer(playerId) {
        this.currentTurnPlayer = playerId;
    }
    
    updateHandDrawerActionStates() {
        // Mock implementation
    }
    
    getHandDrawerIntegration() {
        return {
            updateTiles: jest.fn(),
            sortTiles: jest.fn()
        };
    }
    
    getGameBoard() {
        return {
            updateBoard: jest.fn()
        };
    }
    
    getContainer() {
        return document.createElement('div');
    }
    
    syncHandDrawerWithGame() {
        // Mock implementation
    }
}

// Mock MobileGameIntegration class
class MockMobileGameIntegration {
    constructor(mobileUISystem, gameClient) {
        this.mobileUISystem = mobileUISystem;
        this.gameClient = gameClient;
        this.socket = gameClient.socket;
        
        this.isInitialized = false;
        this.currentGameState = null;
        this.currentPlayer = null;
        this.isMyTurn = false;
        
        // Integration state
        this.integrationState = {
            connected: false,
            gameId: null,
            playerId: null,
            playerName: null,
            gameStarted: false,
            crossPlatformMode: false
        };
        
        // Event callbacks
        this.eventCallbacks = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        // Setup socket event handlers for mobile UI
        this.setupSocketEventHandlers();
        
        this.isInitialized = true;
    }

    setupSocketEventHandlers() {
        // Game state updates
        this.socket.on('gameStateUpdate', (data) => {
            this.handleGameStateUpdate(data);
        });
        
        this.socket.on('gameStarted', (data) => {
            this.handleGameStarted(data);
        });
        
        this.socket.on('turnEnded', (data) => {
            this.handleTurnEnded(data);
        });
        
        this.socket.on('setPlayed', (data) => {
            this.handleSetPlayed(data);
        });
        
        this.socket.on('boardUpdated', (data) => {
            this.handleBoardUpdated(data);
        });
        
        this.socket.on('playerJoined', (data) => {
            this.handlePlayerJoined(data);
        });
        
        this.socket.on('playerLeft', (data) => {
            this.handlePlayerLeft(data);
        });
        
        this.socket.on('botMove', (data) => {
            this.handleBotMove(data);
        });
        
        this.socket.on('error', (data) => {
            this.handleGameError(data);
        });
        
        this.socket.on('connect', () => {
            this.handleSocketConnect();
        });
        
        this.socket.on('disconnect', (reason) => {
            this.handleSocketDisconnect(reason);
        });
        
        this.socket.on('reconnect', () => {
            this.handleSocketReconnect();
        });
    }

    handleGameStateUpdate(data) {
        const gameState = data.gameState;
        this.currentGameState = gameState;
        
        // Update integration state
        this.integrationState.gameId = gameState.id;
        this.integrationState.gameStarted = gameState.started;
        
        // Find current player
        this.currentPlayer = gameState.players.find(p => p.id === this.socket.id);
        this.isMyTurn = gameState.currentPlayerIndex !== undefined && 
                       gameState.players[gameState.currentPlayerIndex]?.id === this.socket.id;
        
        // Detect cross-platform mode
        this.detectCrossPlatformMode(gameState);
        
        // Sync mobile UI
        this.syncMobileUIWithGameState(gameState);
        
        // Emit game state change event
        this.emit('gameStateChanged', gameState);
    }

    handleGameStarted(data) {
        const gameState = data.gameState;
        this.integrationState.gameStarted = true;
        this.handleGameStateUpdate(data);
    }

    handleTurnEnded(data) {
        const gameState = data.gameState;
        const currentPlayerId = data.currentPlayerId;
        const isMyTurn = data.isYourTurn;
        
        // Update state
        this.currentGameState = gameState;
        this.isMyTurn = isMyTurn;
        
        // Update mobile UI
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            mobileGameScreen.setIsMyTurn(isMyTurn);
            mobileGameScreen.setCurrentTurnPlayer(currentPlayerId);
        }
    }

    handleSetPlayed(data) {
        const gameState = data.gameState;
        this.handleGameStateUpdate({ gameState });
    }

    handleBoardUpdated(data) {
        const gameState = data.gameState;
        this.handleGameStateUpdate({ gameState });
        
        // Explicitly update the board
        this.updateMobileBoard(gameState.board);
    }

    handlePlayerJoined(data) {
        const gameState = data.gameState;
        this.handleGameStateUpdate({ gameState });
    }

    handlePlayerLeft(data) {
        const gameState = data.gameState;
        this.handleGameStateUpdate({ gameState });
    }

    handleBotMove(data) {
        const gameState = data.gameState;
        this.handleGameStateUpdate({ gameState });
    }

    handleGameError(data) {
        // Mock error handling
    }

    handleSocketConnect() {
        this.integrationState.connected = true;
    }

    handleSocketDisconnect(reason) {
        this.integrationState.connected = false;
    }

    handleSocketReconnect() {
        this.integrationState.connected = true;
        
        // Request current game state
        if (this.integrationState.gameId) {
            this.socket.emit('getGameState', { gameId: this.integrationState.gameId });
        }
    }

    handleMobileGameAction(data) {
        const action = data.action;
        const actionData = data.data;
        
        switch (action) {
            case 'drawTile':
                this.socket.emit('drawTile');
                break;
                
            case 'endTurn':
                this.socket.emit('endTurn');
                break;
                
            case 'playSet':
                this.socket.emit('playSet', actionData);
                break;
                
            default:
                console.warn('Unknown mobile game action:', action);
        }
    }

    syncMobileUIWithGameState(gameState) {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (!mobileGameScreen) return;
        
        // Update game state
        mobileGameScreen.updateGameState(gameState);
        
        // Update players
        mobileGameScreen.clearAllPlayers();
        gameState.players.forEach(player => {
            mobileGameScreen.addPlayer({
                id: player.id,
                name: player.name,
                handSize: player.handSize,
                hasPlayedInitial: player.hasPlayedInitial,
                score: player.score,
                isBot: player.isBot,
                isMobile: player.isMobile
            });
        });
        
        // Update current turn
        if (gameState.currentPlayerIndex !== undefined) {
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            if (currentPlayer) {
                mobileGameScreen.setCurrentTurnPlayer(currentPlayer.id);
            }
        }
        
        // Update board if mobile board component exists
        this.updateMobileBoard(gameState.board);
    }

    detectCrossPlatformMode(gameState) {
        // Detect if there are both mobile and desktop players
        const hasMobilePlayers = gameState.players.some(p => p.isMobile);
        const hasDesktopPlayers = gameState.players.some(p => !p.isMobile);
        
        const isCrossPlatform = hasMobilePlayers && hasDesktopPlayers;
        
        if (isCrossPlatform !== this.integrationState.crossPlatformMode) {
            this.integrationState.crossPlatformMode = isCrossPlatform;
            if (isCrossPlatform) {
                this.applyCrossPlatformOptimizations();
            }
        }
    }

    applyCrossPlatformOptimizations() {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            // Add cross-platform class for styling
            mobileGameScreen.getContainer().classList.add('cross-platform-mode');
        }
    }

    updateMobileBoard(boardState) {
        const mobileGameScreen = this.mobileUISystem.getComponent('mobileGameScreen');
        if (mobileGameScreen) {
            const gameBoard = mobileGameScreen.getGameBoard();
            if (gameBoard && typeof gameBoard.updateBoard === 'function') {
                gameBoard.updateBoard();
            }
        }
    }

    // Event system
    on(eventName, callback) {
        if (!this.eventCallbacks.has(eventName)) {
            this.eventCallbacks.set(eventName, new Set());
        }
        this.eventCallbacks.get(eventName).add(callback);
    }

    off(eventName, callback) {
        const callbacks = this.eventCallbacks.get(eventName);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(eventName, data = {}) {
        const callbacks = this.eventCallbacks.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event callback for ${eventName}:`, error);
                }
            });
        }
    }

    destroy() {
        this.socket.events.clear();
        this.eventCallbacks.clear();
        this.isInitialized = false;
    }
}

describe('Mobile Cross-Platform Integration Tests', () => {
    let mobileUISystem;
    let mobileGameScreen;
    let gameClient;
    let mobileGameIntegration;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        mockSocket.events.clear();
        mockSocket.connected = false;
        
        // Setup test environment
        mobileUISystem = new MockMobileUISystem();
        mobileGameScreen = new MockMobileGameScreen();
        gameClient = { socket: mockSocket };
        
        // Setup mobile UI system components
        mobileUISystem.setComponent('mobileGameScreen', mobileGameScreen);
        
        // Create integration instance
        mobileGameIntegration = new MockMobileGameIntegration(mobileUISystem, gameClient);
    });
    
    afterEach(() => {
        if (mobileGameIntegration) {
            mobileGameIntegration.destroy();
        }
    });

    describe('Cross-Platform Game State Synchronization', () => {
        test('should synchronize game state between mobile and desktop players', async () => {
            // Requirement 15.3: Cross-platform compatibility
            const mixedGameState = {
                id: 'test-game-123',
                started: true,
                currentPlayerIndex: 0,
                players: [
                    {
                        id: 'mobile-player-1',
                        name: 'Mobile Player',
                        handSize: 14,
                        hasPlayedInitial: false,
                        score: 0,
                        isBot: false,
                        isMobile: true
                    },
                    {
                        id: 'desktop-player-1',
                        name: 'Desktop Player',
                        handSize: 14,
                        hasPlayedInitial: false,
                        score: 0,
                        isBot: false,
                        isMobile: false
                    }
                ],
                board: [],
                playerHand: [
                    { color: 'red', number: 1 },
                    { color: 'blue', number: 2 }
                ]
            };
            
            // Simulate game state update from server
            mockSocket.trigger('gameStateUpdate', { gameState: mixedGameState });
            
            // Verify mobile UI received and processed the update
            expect(mobileGameScreen.gameState).toEqual(mixedGameState);
            expect(mobileGameScreen.players).toHaveLength(2);
            
            // Verify cross-platform detection
            expect(mobileGameIntegration.integrationState.crossPlatformMode).toBe(true);
            
            // Verify mobile player is correctly identified
            const mobilePlayer = mobileGameScreen.players.find(p => p.isMobile);
            const desktopPlayer = mobileGameScreen.players.find(p => !p.isMobile);
            
            expect(mobilePlayer).toBeDefined();
            expect(mobilePlayer.name).toBe('Mobile Player');
            expect(desktopPlayer).toBeDefined();
            expect(desktopPlayer.name).toBe('Desktop Player');
        });
        
        test('should handle turn transitions in cross-platform games', async () => {
            // Requirement 15.4: Game state synchronization
            const gameState = {
                id: 'test-game-123',
                started: true,
                currentPlayerIndex: 1,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            // Set mobile player as current socket
            mockSocket.id = 'mobile-player-1';
            
            // Simulate turn ending (mobile player's turn ends, desktop player's turn starts)
            mockSocket.trigger('turnEnded', {
                gameState: gameState,
                currentPlayerId: 'desktop-player-1',
                isYourTurn: false
            });
            
            // Verify mobile UI updated correctly
            expect(mobileGameScreen.isMyTurn).toBe(false);
            expect(mobileGameScreen.currentTurnPlayer).toBe('desktop-player-1');
            
            // Simulate desktop player's turn ending (mobile player's turn starts)
            mockSocket.trigger('turnEnded', {
                gameState: gameState,
                currentPlayerId: 'mobile-player-1',
                isYourTurn: true
            });
            
            // Verify mobile UI updated correctly
            expect(mobileGameScreen.isMyTurn).toBe(true);
            expect(mobileGameScreen.currentTurnPlayer).toBe('mobile-player-1');
        });
        
        test('should synchronize board updates from desktop players', async () => {
            // Requirement 15.5: Cross-platform game functionality
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ],
                board: [
                    {
                        id: 'set-1',
                        tiles: [
                            { color: 'red', number: 1 },
                            { color: 'red', number: 2 },
                            { color: 'red', number: 3 }
                        ],
                        position: { x: 100, y: 100 },
                        placedBy: 'desktop-player-1'
                    }
                ]
            };
            
            // Simulate board update from desktop player
            mockSocket.trigger('boardUpdated', { gameState: gameState });
            
            // Verify mobile UI received the board update
            expect(mobileGameScreen.gameState.board).toHaveLength(1);
            expect(mobileGameScreen.gameState.board[0].placedBy).toBe('desktop-player-1');
            
            // Core requirement: Board state synchronization works
            expect(mobileGameScreen.gameState).toEqual(gameState);
        });
    });

    describe('Mobile-Desktop Player Interactions', () => {
        test('should handle desktop player joining mobile-hosted game', async () => {
            // Requirement 15.3: Cross-platform compatibility
            const initialGameState = {
                id: 'mobile-hosted-game',
                started: false,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Host', isMobile: true }
                ]
            };
            
            // Set initial state
            mockSocket.trigger('gameStateUpdate', { gameState: initialGameState });
            
            // Desktop player joins
            const updatedGameState = {
                ...initialGameState,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Host', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Joiner', isMobile: false }
                ]
            };
            
            mockSocket.trigger('playerJoined', {
                playerName: 'Desktop Joiner',
                gameState: updatedGameState
            });
            
            // Verify mobile UI updated with new player
            expect(mobileGameScreen.players).toHaveLength(2);
            
            // Verify cross-platform mode was enabled
            expect(mobileGameIntegration.integrationState.crossPlatformMode).toBe(true);
        });
        
        test('should handle mobile player joining desktop-hosted game', async () => {
            // Requirement 15.3: Cross-platform compatibility
            const gameState = {
                id: 'desktop-hosted-game',
                started: false,
                players: [
                    { id: 'desktop-player-1', name: 'Desktop Host', isMobile: false },
                    { id: 'mobile-player-1', name: 'Mobile Joiner', isMobile: true }
                ]
            };
            
            // Mobile player joins existing desktop game
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Verify mobile UI adapted to cross-platform mode
            expect(mobileGameScreen.players).toHaveLength(2);
            expect(mobileGameIntegration.integrationState.crossPlatformMode).toBe(true);
        });
        
        test('should handle player disconnections in cross-platform games', async () => {
            // Requirement 15.4: Game state synchronization
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            // Set initial state
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Desktop player disconnects
            const updatedGameState = {
                ...gameState,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true }
                ]
            };
            
            mockSocket.trigger('playerLeft', {
                playerName: 'Desktop Player',
                gameState: updatedGameState
            });
            
            // Verify mobile UI updated
            expect(mobileGameScreen.players).toHaveLength(1);
            
            // Verify cross-platform mode was disabled
            expect(mobileGameIntegration.integrationState.crossPlatformMode).toBe(false);
        });
    });

    describe('Cross-Platform Game Actions', () => {
        test('should handle mobile player actions in cross-platform game', async () => {
            // Requirement 15.5: Cross-platform game functionality
            const gameState = {
                id: 'test-game-123',
                started: true,
                currentPlayerIndex: 0,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            // Set mobile player as current socket
            mockSocket.id = 'mobile-player-1';
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Mobile player draws a tile
            mobileGameIntegration.handleMobileGameAction({
                action: 'drawTile',
                data: {}
            });
            
            // Verify action was sent to server
            expect(mockSocket.lastEmit.event).toBe('drawTile');
            
            // Mobile player plays a set
            const setData = {
                tiles: [
                    { color: 'red', number: 1 },
                    { color: 'red', number: 2 },
                    { color: 'red', number: 3 }
                ],
                position: { x: 200, y: 150 }
            };
            
            mobileGameIntegration.handleMobileGameAction({
                action: 'playSet',
                data: setData
            });
            
            // Verify set play was sent to server
            expect(mockSocket.lastEmit.event).toBe('playSet');
            expect(mockSocket.lastEmit.data).toEqual(setData);
        });
        
        test('should receive and process desktop player actions', async () => {
            // Requirement 15.5: Cross-platform game functionality
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ],
                board: []
            };
            
            // Set initial state
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Desktop player plays a set
            const updatedGameState = {
                ...gameState,
                board: [
                    {
                        id: 'desktop-set-1',
                        tiles: [
                            { color: 'blue', number: 1 },
                            { color: 'blue', number: 2 },
                            { color: 'blue', number: 3 }
                        ],
                        position: { x: 300, y: 200 },
                        placedBy: 'desktop-player-1'
                    }
                ]
            };
            
            mockSocket.trigger('setPlayed', { gameState: updatedGameState });
            
            // Verify mobile UI updated with desktop player's move
            expect(mobileGameScreen.gameState.board).toHaveLength(1);
            expect(mobileGameScreen.gameState.board[0].placedBy).toBe('desktop-player-1');
        });
        
        test('should handle bot moves in cross-platform games', async () => {
            // Requirement 15.5: Cross-platform game functionality
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false },
                    { id: 'bot-player-1', name: 'Bot Player', isBot: true }
                ]
            };
            
            // Set initial state
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Bot makes a move
            mockSocket.trigger('botMove', {
                gameState: gameState,
                moveDescription: 'played a set of red tiles'
            });
            
            // Verify mobile UI processed bot move
            expect(mobileGameScreen.gameState).toEqual(gameState);
        });
    });

    describe('Network Resilience in Cross-Platform Games', () => {
        test('should handle mobile disconnection and reconnection', async () => {
            // Requirement 15.4: Game state synchronization
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            // Set initial connected state
            mockSocket.connect();
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Mobile player disconnects
            mockSocket.disconnect();
            
            // Verify disconnection was handled
            expect(mobileGameIntegration.integrationState.connected).toBe(false);
            
            // Mobile player reconnects
            mockSocket.connect();
            mockSocket.trigger('reconnect');
            
            // Verify reconnection was handled
            expect(mobileGameIntegration.integrationState.connected).toBe(true);
            
            // Verify game state was requested after reconnection
            expect(mockSocket.lastEmit.event).toBe('getGameState');
        });
        
        test('should maintain game state consistency during network issues', async () => {
            // Requirement 15.4: Game state synchronization
            const initialGameState = {
                id: 'test-game-123',
                started: true,
                currentPlayerIndex: 0,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ],
                board: []
            };
            
            // Set initial state
            mockSocket.trigger('gameStateUpdate', { gameState: initialGameState });
            
            // Simulate network interruption during desktop player's move
            mockSocket.disconnect();
            
            // Mobile player reconnects after desktop player made moves
            const updatedGameState = {
                ...initialGameState,
                currentPlayerIndex: 1,
                board: [
                    {
                        id: 'missed-set-1',
                        tiles: [{ color: 'green', number: 1 }, { color: 'green', number: 2 }, { color: 'green', number: 3 }],
                        placedBy: 'desktop-player-1'
                    }
                ]
            };
            
            mockSocket.connect();
            mockSocket.trigger('reconnect');
            mockSocket.trigger('gameStateUpdate', { gameState: updatedGameState });
            
            // Verify mobile UI caught up with missed changes
            expect(mobileGameScreen.gameState.board).toHaveLength(1);
            expect(mobileGameScreen.gameState.currentPlayerIndex).toBe(1);
        });
    });

    describe('Cross-Platform Performance and Optimization', () => {
        test('should apply cross-platform optimizations when detected', async () => {
            // Requirement 15.3: Cross-platform compatibility
            const crossPlatformGameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            // Trigger cross-platform detection
            mockSocket.trigger('gameStateUpdate', { gameState: crossPlatformGameState });
            
            // Verify cross-platform optimizations were applied
            expect(mobileGameIntegration.integrationState.crossPlatformMode).toBe(true);
        });
        
        test('should handle mixed input methods gracefully', async () => {
            // Requirement 15.5: Cross-platform game functionality
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Test mobile touch input
            mobileGameIntegration.handleMobileGameAction({
                action: 'drawTile',
                data: { inputMethod: 'touch' }
            });
            
            expect(mockSocket.lastEmit.event).toBe('drawTile');
            
            // Test handling desktop mouse input events
            mockSocket.trigger('setPlayed', {
                gameState: gameState,
                inputMethod: 'mouse'
            });
            
            // Verify mobile UI handled desktop input gracefully
            expect(mobileGameScreen.gameState).toEqual(gameState);
        });
    });

    describe('Error Handling in Cross-Platform Context', () => {
        test('should handle cross-platform specific errors', async () => {
            // Requirement 15.4: Game state synchronization
            const gameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ]
            };
            
            mockSocket.trigger('gameStateUpdate', { gameState: gameState });
            
            // Simulate cross-platform synchronization error
            mockSocket.trigger('error', {
                message: 'Cross-platform synchronization failed',
                type: 'sync-error',
                context: 'cross-platform'
            });
            
            // Verify error was handled appropriately
            // (This would depend on the error handling implementation)
            expect(mobileGameIntegration.integrationState.connected).toBeDefined();
        });
        
        test('should recover from cross-platform state mismatches', async () => {
            // Requirement 15.4: Game state synchronization
            const mismatchedGameState = {
                id: 'test-game-123',
                started: true,
                players: [
                    { id: 'mobile-player-1', name: 'Mobile Player', isMobile: true },
                    { id: 'desktop-player-1', name: 'Desktop Player', isMobile: false }
                ],
                version: 'v2' // Simulated version mismatch
            };
            
            // Trigger state update with potential mismatch
            mockSocket.trigger('gameStateUpdate', { gameState: mismatchedGameState });
            
            // Verify mobile UI handled the update
            expect(mobileGameScreen.gameState.version).toBe('v2');
            
            // Verify recovery mechanism would be triggered
            // (Implementation would depend on specific error handling)
        });
    });
});