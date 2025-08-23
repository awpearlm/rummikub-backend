class RummikubClient {
    constructor() {
        // Determine the backend URL based on environment
        const backendUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : 'https://rummikub-backend.onrender.com'; // Your deployed backend URL
        
        console.log('🌐 Connecting to:', backendUrl);
        this.socket = io(backendUrl, {
            timeout: 20000, // 20 second timeout
            forceNew: true,
            transports: ['websocket', 'polling'] // Try websocket first, fallback to polling
        });
        
        // Add connection debugging
        this.socket.on('connect', () => {
            console.log('✅ Connected to server!', this.socket.id);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected:', reason);
        });
        
        this.gameState = null;
        this.selectedTiles = [];
        this.playerName = '';
        this.gameId = '';
        this.timerEnabled = false;
        this.turnTimeLimit = 120; // 2 minutes in seconds
        
        // Sound effects
        this.sounds = {};
        // Initialize sounds only after user interaction
        this.soundsInitialized = false;
        this.soundEnabled = true;
        this.timerInterval = null;
        this.remainingTime = this.turnTimeLimit;
        this.lastActivePlayerId = null; // Keep track of the last active player for timer resets
        this.hasBoardChanged = false;
        this.gameMode = null; // 'multiplayer' or 'bot'
        this.botDifficulty = 'medium';
        this.hasAutoSorted = false; // Track if auto-sort has been done
        this.hasPlayedTilesThisTurn = false; // Track if tiles have been played this turn
        this.hasBoardChanged = false; // Track if the board has been changed this turn
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    initializeEventListeners() {
        // Game mode selection
        document.getElementById('playWithBotBtn').addEventListener('click', () => this.selectGameMode('bot'));
        document.getElementById('playWithFriendsBtn').addEventListener('click', () => this.selectGameMode('multiplayer'));
        
        // Bot game button - with error handling
        const startBotBtn = document.getElementById('startBotGameBtn');
        if (startBotBtn) {
            startBotBtn.addEventListener('click', () => {
                console.log('🤖 Start Bot Game button clicked!');
                this.startBotGame();
            });
        } else {
            console.error('❌ Could not find startBotGameBtn element');
        }
        
        // Welcome screen events
        document.getElementById('createGameBtn').addEventListener('click', () => {
            this.initializeSounds(); // Initialize sounds on first user interaction
            this.createGame();
        });
        document.getElementById('joinGameBtn').addEventListener('click', () => {
            this.initializeSounds(); // Initialize sounds on first user interaction
            this.showJoinForm();
        });
        document.getElementById('joinGameSubmit').addEventListener('click', () => {
            this.initializeSounds(); // Initialize sounds on first user interaction
            this.joinGame();
        });
        
        // Game screen events
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('drawTileBtn').addEventListener('click', () => this.drawTile());
        document.getElementById('undoBtn').addEventListener('click', () => this.undoLastMove());
        document.getElementById('endTurnBtn').addEventListener('click', () => this.endTurn());
        document.getElementById('leaveGameBtn').addEventListener('click', () => this.leaveGame());
        document.getElementById('playSetBtn').addEventListener('click', () => this.playSelectedTiles());
        
        // Hand sorting events
        document.getElementById('sortByColorBtn').addEventListener('click', () => this.sortHandByColor());
        document.getElementById('sortByNumberBtn').addEventListener('click', () => this.sortHandByNumber());
        
        // Chat events
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Enter key events
        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createGame();
        });
        
        document.getElementById('gameId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        
        // Copy game ID to clipboard
        const copyGameIdBtn = document.getElementById('copyGameIdBtn');
        if (copyGameIdBtn) {
            copyGameIdBtn.addEventListener('click', () => {
                const gameId = document.getElementById('currentGameId').textContent;
                if (gameId) {
                    navigator.clipboard.writeText(gameId)
                        .then(() => {
                            this.showNotification('Game code copied to clipboard!', 'success');
                        })
                        .catch(err => {
                            console.error('Failed to copy: ', err);
                            this.showNotification('Failed to copy game code', 'error');
                        });
                }
            });
        }
    }

    initializeSocketListeners() {
        this.socket.on('gameCreated', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showGameScreen();
            this.updateGameState();
            this.showNotification(`Game created! Share code: ${data.gameId}`, 'success');
        });

        this.socket.on('gameJoined', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showGameScreen();
            this.updateGameState();
            this.showNotification('Joined game successfully!', 'success');
        });

        this.socket.on('playerJoined', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            this.showNotification(`${data.playerName} joined the game`, 'info');
        });

        this.socket.on('playerLeft', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            this.showNotification(`${data.playerName} left the game`, 'info');
        });
        
        // Add explicit listener for gameStateUpdate events
        this.socket.on('gameStateUpdate', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
        });
        
        // Timer synchronization
        this.socket.on('timerUpdate', (data) => {
            // Update remaining time from server
            this.remainingTime = data.remainingTime;
            
            console.log(`⏰ Timer update from server: ${this.remainingTime}s remaining`);
            
            // Update timer display
            this.updateTimerDisplay();
            
            // Update timer classes based on time
            const timerElement = document.getElementById('turnTimer');
            if (timerElement) {
                timerElement.classList.remove('timer-warning', 'timer-danger');
                
                if (this.remainingTime <= 30 && this.remainingTime > 10) {
                    timerElement.classList.add('timer-warning');
                } else if (this.remainingTime <= 10) {
                    timerElement.classList.add('timer-danger');
                }
            }
        });

        this.socket.on('gameStarted', (data) => {
            console.log('🎲 RAW gameStarted data:', JSON.stringify(data, null, 2));
            console.log('🎮 My Socket ID:', this.socket.id);
            
            // Check if I'm getting the right player data
            const myPlayerData = data.gameState.players.find(p => p.id === this.socket.id);
            if (myPlayerData) {
                console.log('✅ Found my player data:', myPlayerData.name, 'Hand size:', myPlayerData.handSize);
            } else {
                console.log('🚨 NO PLAYER DATA FOUND for socket:', this.socket.id);
                console.log('🔍 Available players:', data.gameState.players.map(p => ({
                    name: p.name,
                    id: p.id,
                    handSize: p.handSize
                })));
            }
            this.gameState = data.gameState;
            this.updateGameState();
            this.showNotification('Game started!', 'success');
            document.getElementById('startGameBtn').classList.add('hidden');
        });

        this.socket.on('setPlayed', (data) => {
            this.gameState = data.gameState;
            this.hasPlayedTilesThisTurn = true; // Mark that tiles have been played this turn
            this.updateGameState();
            this.clearSelection();
            this.showNotification('Set played successfully!', 'success');
        });

        this.socket.on('tileDrawn', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            this.showNotification('Tile drawn', 'info');
        });

        this.socket.on('turnEnded', (data) => {
            this.gameState = data.gameState;
            this.hasPlayedTilesThisTurn = false; // Reset for new turn
            this.hasBoardChanged = false; // Reset board change flag for new turn
            this.updateGameState();
        });

        this.socket.on('messageReceived', (data) => {
            this.updateChat(data.chatMessages);
        });

        this.socket.on('gameWon', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            this.showVictoryCelebration(data.winner.name);
        });

        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });

        this.socket.on('disconnect', () => {
            this.showNotification('Connection lost. Reconnecting...', 'error');
            // Stop any timers when disconnected
            this.clearTimer();
        });

        this.socket.on('reconnect', () => {
            this.showNotification('Reconnected! Syncing game state...', 'success');
            
            // Request the latest game state after reconnection
            if (this.gameId) {
                console.log('🔄 Reconnected - requesting latest game state for game:', this.gameId);
                this.socket.emit('getGameState', { gameId: this.gameId });
            }
        });

        // Bot game events
        this.socket.on('botGameCreated', (data) => {
            console.log('🎮 botGameCreated event received:', data);
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            console.log('📺 Calling showGameScreen()...');
            this.showGameScreen();
            console.log('🔄 Calling updateGameState()...');
            this.updateGameState();
            this.showNotification('Bot game started!', 'success');
        });

        this.socket.on('botMove', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            this.showNotification(`Bot played: ${data.moveDescription}`, 'info');
        });

        // Board management events
        this.socket.on('boardUpdated', (data) => {
            this.gameState = data.gameState;
            // Update the full game state, not just the board
            this.updateGameState();
        });

        this.socket.on('boardValidation', (validation) => {
            if (!validation.valid) {
                this.showNotification(`Invalid board state! Check set ${validation.invalidSetIndex + 1}`, 'error');
                this.highlightInvalidSet(validation.invalidSetIndex);
            } else {
                this.showNotification('Board state is valid!', 'success');
            }
        });

        this.socket.on('boardRestored', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            this.showNotification('Board restored to turn start', 'info');
        });

        // General game state updates
        this.socket.on('gameStateUpdate', (data) => {
            console.log('🎮 Game state updated', data);
            const wasMyTurn = this.isMyTurn();
            this.gameState = data.gameState;
            
            // If turn changed from me to someone else, clear any selections
            if (wasMyTurn && !this.isMyTurn()) {
                this.selectedTiles = [];
            }
            
            this.updateGameState();
        });
    }

    selectGameMode(mode) {
        this.gameMode = mode;
        
        // Reset all button states first
        document.querySelectorAll('.btn-mode').forEach(btn => btn.classList.remove('active'));
        
        // Hide both option panels initially
        document.getElementById('multiplayerOptions').classList.add('hidden');
        document.getElementById('botGameOptions').classList.add('hidden');
        
        if (mode === 'bot') {
            document.getElementById('playWithBotBtn').classList.add('active');
            document.getElementById('botGameOptions').classList.remove('hidden');
        } else if (mode === 'multiplayer') {
            document.getElementById('playWithFriendsBtn').classList.add('active');
            document.getElementById('multiplayerOptions').classList.remove('hidden');
        }
    }

    startBotGame() {
        console.log('🎯 startBotGame() called');
        const playerName = document.getElementById('playerName').value.trim();
        console.log('👤 Player name:', playerName);
        
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }
        
        this.playerName = playerName;
        this.botDifficulty = document.getElementById('botDifficulty').value;
        this.botCount = parseInt(document.getElementById('botCount').value);
        console.log('🤖 Bot difficulty:', this.botDifficulty);
        console.log('🤖 Bot count:', this.botCount);
        this.showLoadingScreen();
        console.log('📡 Emitting createBotGame event...');
        this.socket.emit('createBotGame', { 
            playerName, 
            difficulty: this.botDifficulty,
            botCount: this.botCount
        });
    }

    createGame() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }
        
        // Debug mode is determined by using name "debug"
        const isDebugMode = playerName.toLowerCase() === 'debug';
        if (isDebugMode) {
            console.log('🔧 Debug mode enabled! Game creator will get debug hand.');
        }
        
        // Check if timer is enabled
        const timerEnabled = document.getElementById('enableTimer').checked;
        this.timerEnabled = timerEnabled;
        console.log(`🕒 Turn timer: ${timerEnabled ? 'ENABLED' : 'disabled'}`);
        
        this.playerName = playerName;
        this.showLoadingScreen();
        
        // Check if socket is connected
        if (!this.socket.connected) {
            console.log('🔌 Socket not connected, waiting...');
            // Set a timeout for connection
            const connectionTimeout = setTimeout(() => {
                console.error('❌ Connection timeout');
                this.showWelcomeScreen();
                this.showNotification('Unable to connect to game server. Please try again in a moment.', 'error');
            }, 15000); // 15 second timeout
            
            // Wait for connection
            this.socket.once('connect', () => {
                clearTimeout(connectionTimeout);
                console.log('✅ Connected! Sending createGame...');
                const isDebugMode = playerName.toLowerCase() === 'debug';
                console.log('🔧 Debug mode:', isDebugMode ? 'ENABLED' : 'disabled');
                this.socket.emit('createGame', { 
                    playerName, 
                    isDebugMode,
                    timerEnabled: this.timerEnabled
                });
            });
        } else {
            // Already connected
            const isDebugMode = playerName.toLowerCase() === 'debug';
            console.log('🔧 Debug mode:', isDebugMode ? 'ENABLED' : 'disabled');
            this.socket.emit('createGame', { 
                playerName, 
                isDebugMode,
                timerEnabled: this.timerEnabled
            });
        }
    }

    showJoinForm() {
        const joinForm = document.getElementById('joinGameForm');
        joinForm.classList.toggle('hidden');
        if (!joinForm.classList.contains('hidden')) {
            document.getElementById('gameId').focus();
        }
    }

    joinGame() {
        const playerName = document.getElementById('playerName').value.trim();
        const gameId = document.getElementById('gameId').value.trim().toUpperCase();
        
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }
        
        if (!gameId) {
            this.showNotification('Please enter a game code', 'error');
            return;
        }
        
        this.playerName = playerName;
        this.showLoadingScreen();
        this.socket.emit('joinGame', { playerName, gameId });
    }

    startGame() {
        this.socket.emit('startGame');
    }

    // Play sound effects
    initializeSounds() {
        if (this.soundsInitialized) return;
        
        try {
            // Create with absolute URLs to ensure they're found
            const baseUrl = window.location.origin;
            const soundPath = `${baseUrl}/sounds/`;
            
            // Use the most reliable sound files
            this.sounds = {
                pickupTile: new Audio(`${soundPath}tile-pickup.mp3`),
                placeTile: new Audio(`${soundPath}tile-place.mp3`),
                turnStart: new Audio(`${soundPath}turn-notification.mp3`),
                timeUp: new Audio(`${soundPath}time-up.mp3`)
            };
            
            // Preload sounds
            Object.values(this.sounds).forEach(sound => {
                sound.volume = 0.3; // Lower volume to 30%
                sound.load();
            });
            
            this.soundsInitialized = true;
            console.log('🔊 Sound effects initialized with base path:', soundPath);
        } catch (error) {
            console.error('❌ Error initializing sounds:', error);
        }
    }
    
    // Play sound effects
    playSound(sound) {
        if (!this.soundsInitialized) {
            this.initializeSounds();
        }
        
        if (this.soundEnabled && this.sounds[sound]) {
            try {
                // Create a new audio element each time for better reliability
                const audioElement = this.sounds[sound].cloneNode();
                audioElement.volume = 0.3; // Set volume to 30%
                
                // Simple play with error handling
                audioElement.play().catch(e => {
                    console.log(`Sound playback prevented: ${e.message}`);
                });
            } catch (error) {
                console.error('❌ Error playing sound:', error);
            }
        }
    }

    drawTile() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        this.playSound('pickupTile');
        this.socket.emit('drawTile');
    }

    endTurn() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        // Clear any selected tiles before ending the turn
        this.selectedTiles = [];
        this.renderPlayerHand();
        
        this.socket.emit('endTurn');
        this.hasBoardChanged = false; // Reset the flag when ending turn
        this.clearTimer(); // Stop the timer when ending turn
        this.updateActionButtons();
    }

    undoLastMove() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        
        // Always allow undo during the player's turn, even if board state hasn't changed
        // This is because tiles might have been moved but not yet detected as a change
        
        // Request a full undo from the server, which will also return tiles to hand
        this.socket.emit('requestUndoTurn');
        this.hasBoardChanged = false; // Reset the flag when undoing
        
        // Reset the timer when undoing
        if (this.timerEnabled) {
            this.clearTimer();
            this.startTimer();
        }
        
        this.updateActionButtons();
        this.showNotification("Restored board to beginning of turn", 'success');
    }

    hasBoardStateChanged() {
        if (!this.gameState || !this.gameState.boardSnapshot || !this.gameState.board) {
            return false;
        }
        
        // Compare current board state with the snapshot
        const currentBoard = JSON.stringify(this.gameState.board);
        const snapshotBoard = JSON.stringify(this.gameState.boardSnapshot);
        
        const hasChanged = currentBoard !== snapshotBoard;
        
        // Update the board changed flag
        this.hasBoardChanged = hasChanged;
        
        return hasChanged;
    }

    leaveGame() {
        if (confirm('Are you sure you want to leave the game?')) {
            location.reload();
        }
    }

    playSelectedTiles() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        
        if (this.selectedTiles.length < 3) {
            this.showNotification('Select at least 3 tiles to play a set', 'error');
            return;
        }
        
        this.playSound('placeTile');
        
        // Get selected tile objects
        const selectedTileObjects = this.selectedTiles.map(id => 
            this.gameState.playerHand.find(tile => tile.id === id)
        ).filter(Boolean);
        
        // Debug the selected set
        this.validateAndDebugSet(selectedTileObjects);
        
        // Check if player hasn't played initial yet
        const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
        const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;
        
        if (needsInitialPlay) {
            // For initial play, try to detect multiple sets within selected tiles
            const multipleSets = this.detectMultipleSets(this.selectedTiles);
            
            if (multipleSets.length > 1) {
                // Send multiple sets for initial play validation
                this.socket.emit('playSet', { setArrays: multipleSets });
                console.log(`🎯 Playing ${multipleSets.length} sets for initial play:`, multipleSets);
            } else {
                // Single set - use existing logic
                this.socket.emit('playSet', { tileIds: this.selectedTiles });
            }
        } else {
            // After initial play, only single sets allowed per play action
            this.socket.emit('playSet', { tileIds: this.selectedTiles });
        }
    }
    
    validateAndDebugSet(tiles) {
        // Check if this selection is a valid set
        const isRun = this.isValidRunClient(tiles);
        const isGroup = this.isValidGroupClient(tiles);
        const isValid = isRun || isGroup;
        
        // Create detailed debug info
        const tileInfo = tiles.map(t => {
            if (t.isJoker) return "JOKER";
            return `${t.number}${t.color[0]}`;
        }).join(', ');
        
        // Show status in toast
        if (isValid) {
            if (isRun) {
                this.showNotification(`Valid run detected: ${tileInfo}`, 'info');
            } else {
                this.showNotification(`Valid group detected: ${tileInfo}`, 'info');
            }
        } else {
            this.showNotification(`Invalid set: ${tileInfo}. Please make a valid set (run or group).`, 'error');
            
            // Provide detailed error info in console
            console.log(`🔍 Debug set validation:`, {
                tiles,
                isRun,
                isGroup,
                tileInfo
            });
        }
    }
    
    detectMultipleSets(selectedTileIds) {
        // Get the actual tile objects
        const selectedTiles = selectedTileIds.map(id => 
            this.gameState.playerHand.find(tile => tile.id === id)
        ).filter(Boolean);
        
        if (selectedTiles.length < 6) {
            // Not enough tiles for multiple sets, return as single set
            return [selectedTileIds];
        }
        
        // Try to find multiple valid sets within the selection
        const sets = [];
        const remainingTiles = [...selectedTiles];
        const remainingIds = [...selectedTileIds];
        
        // Simple approach: try all combinations of 3+ tiles to find valid sets
        while (remainingTiles.length >= 3) {
            let foundSet = false;
            
            // Try to find a valid set of 3 tiles first
            for (let i = 0; i < remainingTiles.length - 2; i++) {
                for (let j = i + 1; j < remainingTiles.length - 1; j++) {
                    for (let k = j + 1; k < remainingTiles.length; k++) {
                        const testSet = [remainingTiles[i], remainingTiles[j], remainingTiles[k]];
                        if (this.isValidSetClient(testSet)) {
                            // Found a valid set, try to extend it
                            const setTiles = [...testSet];
                            const setIds = setTiles.map(t => t.id);
                            
                            // Try to add a 4th tile if it makes a valid set
                            for (let l = 0; l < remainingTiles.length; l++) {
                                if (!setTiles.includes(remainingTiles[l])) {
                                    const extendedSet = [...setTiles, remainingTiles[l]];
                                    if (this.isValidSetClient(extendedSet)) {
                                        setTiles.push(remainingTiles[l]);
                                        setIds.push(remainingTiles[l].id);
                                        break; // Only add one more tile
                                    }
                                }
                            }
                            
                            // Remove used tiles from remaining
                            setTiles.forEach(tile => {
                                const tileIndex = remainingTiles.findIndex(t => t.id === tile.id);
                                const idIndex = remainingIds.findIndex(id => id === tile.id);
                                if (tileIndex !== -1) remainingTiles.splice(tileIndex, 1);
                                if (idIndex !== -1) remainingIds.splice(idIndex, 1);
                            });
                            
                            sets.push(setIds);
                            foundSet = true;
                            break;
                        }
                    }
                    if (foundSet) break;
                }
                if (foundSet) break;
            }
            
            if (!foundSet) {
                // Couldn't find any more valid sets
                break;
            }
        }
        
        // If we found multiple sets, return them; otherwise return original selection as single set
        if (sets.length > 1) {
            console.log(`🔍 Detected ${sets.length} sets:`, sets);
            return sets;
        } else {
            return [selectedTileIds];
        }
    }
    
    isValidSetClient(tiles) {
        if (tiles.length < 3) return false;
        
        // Check if it's a run (consecutive numbers, same color)
        const isRun = this.isValidRunClient(tiles);
        if (isRun) return true;
        
        // Check if it's a group (same number, different colors)
        const isGroup = this.isValidGroupClient(tiles);
        return isGroup;
    }
    
    isValidRunClient(tiles) {
        if (tiles.length < 3) return false;
        
        // All tiles must be same color (except jokers)
        const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
        if (new Set(colors).size > 1) return false;
        
        // Count jokers
        const jokerCount = tiles.filter(t => t.isJoker).length;
        const nonJokers = tiles.filter(t => !t.isJoker);
        
        // If all jokers, it's valid
        if (jokerCount === tiles.length) return true;
        
        // Sort non-joker tiles by number
        nonJokers.sort((a, b) => a.number - b.number);
        
        // Check for consecutive numbers with jokers filling in gaps
        let availableJokers = jokerCount;
        
        for (let i = 1; i < nonJokers.length; i++) {
            const gap = nonJokers[i].number - nonJokers[i-1].number - 1;
            
            // If there's a gap, check if we have enough jokers to fill it
            if (gap > 0) {
                if (gap > availableJokers) {
                    // Not enough jokers to fill the gap
                    console.log(`Run invalid: gap of ${gap} between ${nonJokers[i-1].number} and ${nonJokers[i].number}, but only ${availableJokers} jokers available`);
                    return false;
                }
                availableJokers -= gap;
            }
        }
        
        // If we got here, all gaps are filled with available jokers
        console.log(`Run valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
        return true;
    }
    
    isValidGroupClient(tiles) {
        if (tiles.length < 3 || tiles.length > 4) return false;
        
        // Count jokers
        const jokerCount = tiles.filter(t => t.isJoker).length;
        
        // If all jokers, it's valid
        if (jokerCount === tiles.length) return true;
        
        // All non-joker tiles must be same number
        const numbers = tiles.filter(t => !t.isJoker).map(t => t.number);
        if (new Set(numbers).size > 1) {
            console.log(`Group invalid: numbers not all the same: ${numbers.join(', ')}`);
            return false;
        }
        
        // All non-joker tiles must be different colors
        const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
        if (new Set(colors).size !== colors.length) {
            console.log(`Group invalid: duplicate colors: ${colors.join(', ')}`);
            return false;
        }
        
        console.log(`Group valid with ${jokerCount} jokers and ${tiles.length - jokerCount} regular tiles`);
        return true;
    }

    clearSelection() {
        this.selectedTiles = [];
        document.querySelectorAll('.tile.selected').forEach(tile => {
            tile.classList.remove('selected');
        });
        this.updatePlayButton();
    }

    sortHandByColor() {
        if (!this.gameState || !this.gameState.playerHand) return;
        
        // Sort by color first, then by number
        this.gameState.playerHand.sort((a, b) => {
            if (a.isJoker && b.isJoker) return 0;
            if (a.isJoker) return 1;
            if (b.isJoker) return -1;
            
            const colorOrder = { red: 0, blue: 1, yellow: 2, black: 3 };
            const colorDiff = colorOrder[a.color] - colorOrder[b.color];
            if (colorDiff !== 0) return colorDiff;
            
            return a.number - b.number;
        });
        
        // Reset grid layout to place sorted tiles in order
        this.initializeGridLayout();
        
        // Place sorted tiles in grid order
        this.gameState.playerHand.forEach((tile, index) => {
            if (index < this.tileGridLayout.length) {
                this.tileGridLayout[index] = tile;
            }
        });
        
        // Clear remaining slots
        for (let i = this.gameState.playerHand.length; i < this.tileGridLayout.length; i++) {
            this.tileGridLayout[i] = null;
        }
        
        this.renderPlayerHand();
        this.showNotification('Hand sorted by color', 'info');
    }

    sortHandByNumber() {
        if (!this.gameState || !this.gameState.playerHand) return;
        
        // Sort by number first, then by color
        this.gameState.playerHand.sort((a, b) => {
            if (a.isJoker && b.isJoker) return 0;
            if (a.isJoker) return 1;
            if (b.isJoker) return -1;
            
            const numberDiff = a.number - b.number;
            if (numberDiff !== 0) return numberDiff;
            
            const colorOrder = { red: 0, blue: 1, yellow: 2, black: 3 };
            return colorOrder[a.color] - colorOrder[b.color];
        });
        
        // Reset grid layout to place sorted tiles in order
        this.initializeGridLayout();
        
        // Place sorted tiles in grid order
        this.gameState.playerHand.forEach((tile, index) => {
            if (index < this.tileGridLayout.length) {
                this.tileGridLayout[index] = tile;
            }
        });
        
        // Clear remaining slots
        for (let i = this.gameState.playerHand.length; i < this.tileGridLayout.length; i++) {
            this.tileGridLayout[i] = null;
        }
        
        this.renderPlayerHand();
        this.showNotification('Hand sorted by number', 'info');
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.socket.emit('sendMessage', { message });
        input.value = '';
    }

    isMyTurn() {
        if (!this.gameState || !this.gameState.started || !this.socket) {
            console.log(`❌ Not my turn: gameState=${!!this.gameState}, started=${this.gameState?.started}, socket=${!!this.socket}`);
            return false;
        }
        
        if (!this.gameState.players || this.gameState.players.length === 0) {
            console.log(`❌ Not my turn: no players in game state`);
            return false;
        }
        
        const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        if (!currentPlayer) {
            console.log(`❌ Not my turn: no current player at index ${this.gameState.currentPlayerIndex}`);
            return false;
        }
        
        const result = currentPlayer.id === this.socket.id;
        console.log(`🔍 Turn check: currentPlayer=${currentPlayer.name} (${currentPlayer.id}), myId=${this.socket.id}, isMyTurn=${result}`);
        
        return result;
    }
    
    // Show turn notification when it becomes the player's turn
    showTurnNotification(playerName) {
        // Update the player name in the notification
        const nameElement = document.getElementById('turnNotificationPlayerName');
        nameElement.textContent = playerName === this.getMyName() ? "Your Turn!" : `${playerName}'s Turn!`;
        
        console.log(`🎮 Showing turn notification for: ${playerName}`);
        
        // Get the overlay element
        const overlay = document.getElementById('turnNotificationOverlay');
        
        // First make sure it's not hidden
        overlay.classList.remove('hidden');
        
        // Add a slight delay to ensure CSS transition works properly
        setTimeout(() => {
            // Show the notification by adding the 'show' class
            overlay.classList.add('show');
            
            // Play a notification sound
            this.playSound('turnStart');
            
            // Hide the notification after the animation completes
            // Animation duration is 2.5s in the CSS
            setTimeout(() => {
                this.hideTurnNotification();
            }, 2500);
        }, 50);
        
        return new Promise(resolve => {
            // Resolve the promise after the notification animation completes
            setTimeout(resolve, 2550);
        });
    }
    
    // Hide the turn notification overlay
    hideTurnNotification() {
        const overlay = document.getElementById('turnNotificationOverlay');
        overlay.classList.remove('show');
        
        // Add a delay before hiding completely to allow exit animation to finish
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 500);
    }
    
    // Get the current player's name
    getMyName() {
        if (!this.gameState || !this.gameState.players || !this.socket) {
            return 'You';
        }
        
        const myPlayer = this.gameState.players.find(p => p.id === this.socket.id);
        return myPlayer ? myPlayer.name : 'You';
    }

    showWelcomeScreen() {
        this.hideAllScreens();
        document.getElementById('welcomeScreen').classList.add('active');
    }

    showGameScreen() {
        console.log('📺 showGameScreen() called');
        this.hideAllScreens();
        console.log('📺 Showing game screen...');
        document.getElementById('gameScreen').classList.add('active');
        console.log('📺 Game screen should now be visible');
    }

    showLoadingScreen() {
        this.hideAllScreens();
        document.getElementById('loadingScreen').classList.add('active');
    }

    hideAllScreens() {
        console.log('🫥 hideAllScreens() called');
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            console.log('🫥 Removed active class from:', screen.id);
        });
    }

    updateGameState() {
        if (!this.gameState) return;
        
        // Update game ID
        document.getElementById('currentGameId').textContent = this.gameId;
        
        // Update players list
        this.renderPlayersList();
        
        // Update current turn
        this.updateCurrentTurn();
        
        // Update deck count
        document.getElementById('deckCount').textContent = this.gameState.deckSize || 106;
        
        // Initialize grid layout if hand changed
        if (this.gameState.playerHand) {
            // Check if we need to add a single new tile (like after drawing)
            const handSize = this.gameState.playerHand.length;
            const lastKnownSize = this.lastKnownHandSize || 0;
            
            if (this.tileGridLayout && handSize === lastKnownSize + 1 && lastKnownSize > 0) {
                // We likely just drew a single tile - preserve the existing layout
                this.addNewTileToLayout();
            } else {
                // Auto-sort tiles by number on initial deal only
                this.autoSortHandByNumber();
                
                // Always refresh grid layout when hand changes to ensure tiles are properly removed/added
                if (!this.tileGridLayout || this.hasHandChanged() || this.needsGridExpansion) {
                    this.initializeGridLayout();
                    this.needsGridExpansion = false;
                }
            }
            
            // Update last known hand size
            this.lastKnownHandSize = handSize;
        }
        
        // Update player hand
        this.renderPlayerHand();
        
        // Update game board
        this.renderGameBoard();
        
        // Update chat
        this.updateChat(this.gameState.chatMessages);
        
        // Update game log
        this.updateGameLog(this.gameState.gameLog);
        
        // Show/hide start button
        const startBtn = document.getElementById('startGameBtn');
        if (this.gameState.started) {
            startBtn.classList.add('hidden');
        } else if (this.gameState.players.length >= 2) {
            startBtn.classList.remove('hidden');
        }
        
        // Update action buttons
        this.updateActionButtons();
    }

    autoSortHandByNumber() {
        if (!this.gameState || !this.gameState.playerHand) return;
        
        // Only auto-sort if this is the initial deal (14 tiles normal, 15 tiles debug) or first time
        // Never sort when drawing a new tile
        if ((this.gameState.playerHand.length === 14 || this.gameState.playerHand.length === 15) && !this.hasAutoSorted) {
            // Sort by number first, then by color (same logic as manual sort)
            this.gameState.playerHand.sort((a, b) => {
                if (a.isJoker && b.isJoker) return 0;
                if (a.isJoker) return 1;
                if (b.isJoker) return -1;
                
                const numberDiff = a.number - b.number;
                if (numberDiff !== 0) return numberDiff;
                
                const colorOrder = { red: 0, blue: 1, yellow: 2, black: 3 };
                return colorOrder[a.color] - colorOrder[b.color];
            });
            
            this.hasAutoSorted = true;
            console.log('🔢 Auto-sorted initial hand by number');
        }
        // After initial sort, new tiles are added to the end (no auto-sorting)
    }

    hasHandChanged() {
        // Check if the hand has changed (new tiles added/removed)
        if (!this.lastKnownHandSize) {
            this.lastKnownHandSize = this.gameState.playerHand.length;
            return true;
        }
        
        const currentSize = this.gameState.playerHand.length;
        if (currentSize !== this.lastKnownHandSize) {
            // Don't update the last known size here - we'll do it in updateGameState
            
            // Only trigger grid expansion when we actually exceed the current visible capacity
            const currentGridCapacity = this.tileGridLayout ? this.tileGridLayout.length : 0;
            if (currentSize > 21 && currentSize > currentGridCapacity) {
                this.needsGridExpansion = true;
            }
            
            return true;
        }
        
        // Also check if the actual tiles have changed (same count but different tiles)
        if (this.gameState.playerHand && this.tileGridLayout) {
            const currentTileIds = new Set(this.gameState.playerHand.map(t => t.id));
            const gridTileIds = new Set(this.tileGridLayout.filter(t => t !== null).map(t => t.id));
            
            // If the sets don't match, the hand has changed
            if (currentTileIds.size !== gridTileIds.size || 
                [...currentTileIds].some(id => !gridTileIds.has(id))) {
                return true;
            }
        }
        
        return false;
    }
    
    // Add a newly drawn tile to the layout without disrupting existing tile positions
    addNewTileToLayout() {
        if (!this.tileGridLayout || !this.gameState.playerHand) return;
        
        // Find the new tile - it should be the one that's not in our current grid layout
        const existingTileIds = new Set(this.tileGridLayout.filter(t => t !== null).map(t => t.id));
        const newTile = this.gameState.playerHand.find(tile => !existingTileIds.has(tile.id));
        
        if (!newTile) {
            console.log('⚠️ No new tile found after draw - falling back to initializeGridLayout');
            this.initializeGridLayout();
            return;
        }
        
        console.log('🎲 Adding new tile to layout:', newTile.id);
        
        // Find the first empty slot in the grid to place the new tile
        let emptySlotIndex = this.tileGridLayout.findIndex(slot => slot === null);
        
        if (emptySlotIndex === -1) {
            // No empty slots, expand the grid
            const oldLength = this.tileGridLayout.length;
            this.tileGridLayout = [...this.tileGridLayout, ...Array(7).fill(null)];
            emptySlotIndex = oldLength;
            this.needsGridExpansion = true;
        }
        
        // Place the new tile in the empty slot
        this.tileGridLayout[emptySlotIndex] = newTile;
    }

    renderPlayersList() {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        this.gameState.players.forEach((player, index) => {
            const isCurrentTurn = this.gameState.started && index === this.gameState.currentPlayerIndex;
            const isMe = player.id === this.socket.id;
            const isBot = player.isBot;
            
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-item ${isCurrentTurn ? 'current-turn' : ''}`;
            
            const botIcon = isBot ? '<i class="fas fa-robot" style="margin-left: 5px; color: #ed8936;"></i>' : '';
            const playerLabel = isMe ? '(You)' : '';
            
            // Simplified layout for horizontal player list
            playerDiv.innerHTML = `
                <div class="player-avatar ${isBot ? 'bot-avatar' : ''}">${player.name.charAt(0).toUpperCase()}</div>
                <div class="player-info">
                    <div class="player-name">${player.name} ${playerLabel} ${botIcon}</div>
                    <div class="player-stats">
                        ${player.handSize} tiles
                    </div>
                </div>
            `;
            
            playersList.appendChild(playerDiv);
        });
    }

    updateCurrentTurn() {
        const turnElement = document.getElementById('currentTurnPlayer');
        if (this.gameState.started && this.gameState.players.length > 0) {
            const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
            turnElement.textContent = currentPlayer ? currentPlayer.name : 'Unknown';
            
            // Store the timer option from the game state
            this.timerEnabled = this.gameState.timerEnabled || false;
            
            // Manage timer
            const timerElement = document.getElementById('turnTimer');
            if (this.timerEnabled) {
                timerElement.classList.remove('hidden');
                
                // Check if the active player has changed
                const currentPlayerId = currentPlayer ? currentPlayer.id : null;
                
                // If the current player has changed
                if (currentPlayerId !== this.lastActivePlayerId) {
                    this.lastActivePlayerId = currentPlayerId;
                    console.log('⏰ Turn change detected for: ' + currentPlayer.name);
                    
                    // Show turn notification if it's my turn or another player's turn
                    if (this.isMyTurn() || this.gameState.started) {
                        // Show the notification and wait for it to complete before starting timer
                        this.showTurnNotification(currentPlayer.name)
                            .then(() => {
                                console.log('⏰ Turn notification complete, server will update timer');
                            });
                    }
                }
                
                // Only show the timer, server will send timer updates
                this.updateTimerDisplay();
            } else {
                timerElement.classList.add('hidden');
                this.clearTimer();
            }
        } else {
            turnElement.textContent = 'Waiting to start';
            
            // Hide timer when game not started
            const timerElement = document.getElementById('turnTimer');
            if (timerElement) {
                timerElement.classList.add('hidden');
            }
            this.clearTimer();
        }
    }

    renderPlayerHand() {
        const handElement = document.getElementById('playerHand');
        
        console.log(`🎯 renderPlayerHand() called with ${this.gameState.playerHand?.length || 0} tiles`);
        console.log(`🃏 Tiles to render:`, this.gameState.playerHand?.slice(0, 5).map(t => `${t.isJoker ? 'JOKER' : t.number + t.color[0]}`));
        console.log(`🆔 First 3 tile IDs:`, this.gameState.playerHand?.slice(0, 3).map(t => t.id));
        
        if (!this.gameState.playerHand || this.gameState.playerHand.length === 0) {
            console.log(`⚠️ Skipping render - no tiles to display`);
            // Don't clear the hand if game has started but we have 0 tiles - this might be a sync issue
            if (!this.gameState.started) {
                handElement.innerHTML = '<div class="hand-placeholder"><p>Your tiles will appear here when the game starts</p></div>';
            }
            return;
        }
        
        console.log(`✅ Proceeding with hand render for ${this.gameState.playerHand.length} tiles`);
        handElement.innerHTML = '';
        
        // Dynamic grid sizing based on number of tiles
        const totalTiles = this.gameState.playerHand.length;
        const tilesPerRow = 7;
        
        // Calculate rows needed: start with 3 rows (21 slots), add more only when needed
        let rowsNeeded = 3; // Default to 3 rows (21 slots)
        if (totalTiles > 21) {
            rowsNeeded = Math.ceil(totalTiles / tilesPerRow);
        }
        
        const maxGridSlots = rowsNeeded * tilesPerRow;
        
        // Initialize grid layout if not exists or if it needs to grow
        if (!this.tileGridLayout || this.tileGridLayout.length < maxGridSlots) {
            this.initializeGridLayout(maxGridSlots);
        }
        
        // Update CSS grid template
        handElement.style.gridTemplateRows = `repeat(${rowsNeeded}, 1fr)`;
        handElement.style.gridTemplateColumns = `repeat(${tilesPerRow}, 1fr)`;
        
        // Fill grid positions - only show slots up to what we actually need
        for (let i = 0; i < maxGridSlots; i++) {
            const tile = this.tileGridLayout[i];
            
            if (tile) {
                const tileElement = this.createTileElement(tile, true);
                tileElement.addEventListener('click', () => this.toggleTileSelection(tile.id, tileElement));
                
                // Add drag and drop functionality
                this.addDragAndDropToTile(tileElement, tile, i);
                
                // Calculate grid position
                const row = Math.floor(i / tilesPerRow) + 1;
                const col = (i % tilesPerRow) + 1;
                tileElement.style.gridRow = row;
                tileElement.style.gridColumn = col;
                
                handElement.appendChild(tileElement);
            } else {
                // Only create empty slots that are visible and useful for drag-and-drop
                // Show empty slots in current rows, but only a few extra beyond the tiles
                const currentRowOfThisSlot = Math.floor(i / tilesPerRow);
                const lastTileRow = Math.floor((totalTiles - 1) / tilesPerRow);
                
                // Show empty slot if:
                // 1. It's in a row that has tiles, OR
                // 2. It's in the first few slots of the next row (for drag-and-drop)
                const shouldShowSlot = currentRowOfThisSlot <= lastTileRow || 
                                     (currentRowOfThisSlot === lastTileRow + 1 && (i % tilesPerRow) < 3);
                
                if (shouldShowSlot) {
                    const emptySlot = document.createElement('div');
                    emptySlot.className = 'empty-slot';
                    emptySlot.dataset.slotIndex = i;
                    
                    const row = Math.floor(i / tilesPerRow) + 1;
                    const col = (i % tilesPerRow) + 1;
                    emptySlot.style.gridRow = row;
                    emptySlot.style.gridColumn = col;
                    
                    this.addDropFunctionalityToSlot(emptySlot, i);
                    handElement.appendChild(emptySlot);
                }
            }
        }
    }

    initializeGridLayout(maxSlots = null) {
        // Calculate dynamic grid size based on current hand
        const handSize = this.gameState?.playerHand?.length || 0;
        const tilesPerRow = 7;
        
        console.log(`🔧 initializeGridLayout() called with handSize=${handSize}, maxSlots=${maxSlots}`);
        
        let gridSize;
        if (maxSlots) {
            gridSize = maxSlots;
        } else if (handSize <= 21) {
            gridSize = 21; // Start with 3 rows (21 slots) for normal gameplay
        } else {
            // Only expand beyond 21 when we actually have more than 21 tiles
            gridSize = Math.ceil(handSize / tilesPerRow) * tilesPerRow;
        }
        
        console.log(`🎯 Creating grid with ${gridSize} slots for ${handSize} tiles`);
        
        // Create a fresh grid and place current hand tiles
        this.tileGridLayout = new Array(gridSize).fill(null);
        
        // Place all current hand tiles in the grid
        if (this.gameState?.playerHand) {
            this.gameState.playerHand.forEach((tile, index) => {
                if (index < this.tileGridLayout.length) {
                    this.tileGridLayout[index] = tile;
                }
            });
        }
    }

    syncGridLayoutToGameState() {
        // Update gameState.playerHand to match the current grid layout
        this.gameState.playerHand = this.tileGridLayout.filter(tile => tile !== null);
    }

    addDragAndDropToTile(tileElement, tile, index) {
        tileElement.draggable = true;
        tileElement.dataset.tileIndex = index;
        
        tileElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            e.dataTransfer.setData('application/tile-id', tile.id);
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'hand-tile',
                tile: tile,
                sourceIndex: index
            }));
            tileElement.classList.add('dragging');
            
            // Play tile pickup sound when starting to drag
            this.playSound('pickupTile');
            
            // Store the original index for reordering
            this.draggedTileIndex = index;
        });
        
        tileElement.addEventListener('dragend', (e) => {
            tileElement.classList.remove('dragging');
            this.clearDropIndicators();
            
            // Play placement sound on drop if not handled elsewhere
            // (This ensures sound plays even if drop isn't on a valid target)
            if (!e.dataTransfer.dropEffect || e.dataTransfer.dropEffect === 'none') {
                this.playSound('placeTile');
            }
        });
        
        tileElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            tileElement.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
        });
        
        tileElement.addEventListener('dragleave', (e) => {
            tileElement.style.backgroundColor = '';
        });
        
        tileElement.addEventListener('drop', (e) => {
            e.preventDefault();
            tileElement.style.backgroundColor = '';
            
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = parseInt(e.target.closest('.tile').dataset.tileIndex);
            
            if (draggedIndex !== targetIndex) {
                this.reorderTiles(draggedIndex, targetIndex);
            }
        });
        
        // Add drop functionality to the hand container
        const handElement = document.getElementById('playerHand');
        handElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            handElement.classList.add('drag-over');
        });
        
        handElement.addEventListener('dragleave', (e) => {
            if (!handElement.contains(e.relatedTarget)) {
                handElement.classList.remove('drag-over');
            }
        });
        
        handElement.addEventListener('drop', (e) => {
            e.preventDefault();
            handElement.classList.remove('drag-over');
            
            // Handle dropping board tiles back to hand
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                
                if (dragData.type === 'board-tile') {
                    this.handleBoardTileToHand(dragData);
                    // Note: handleBoardTileToHand already plays the pickupTile sound
                }
            } catch (error) {
                console.log('No drag data or non-board tile dropped on hand');
            }
        });    }

    addDropFunctionalityToSlot(slotElement, slotIndex) {
        slotElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            slotElement.style.backgroundColor = 'rgba(102, 126, 234, 0.3)';
            slotElement.style.border = '2px dashed #667eea';
        });
        
        slotElement.addEventListener('dragleave', (e) => {
            slotElement.style.backgroundColor = '';
            slotElement.style.border = '';
        });
        
        slotElement.addEventListener('drop', (e) => {
            e.preventDefault();
            slotElement.style.backgroundColor = '';
            slotElement.style.border = '';
            
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            
            if (draggedIndex !== slotIndex) {
                this.moveToEmptySlot(draggedIndex, slotIndex);
                // Note: moveToEmptySlot already plays the placeTile sound
            }
        });
    }

    moveToEmptySlot(fromIndex, toIndex) {
        if (!this.tileGridLayout) return;
        
        // Move the tile in the grid
        const movedTile = this.tileGridLayout[fromIndex];
        this.tileGridLayout[fromIndex] = null;
        this.tileGridLayout[toIndex] = movedTile;
        
        // Sync back to game state
        this.syncGridLayoutToGameState();
        
        // Play tile placement sound
        this.playSound('placeTile');
        
        this.renderPlayerHand();
        this.showNotification('Tile moved', 'info');
    }

    showDropIndicator(targetElement, clientX) {
        this.clearDropIndicators();
        
        const tile = targetElement.closest('.tile');
        if (!tile) return;
        
        const rect = tile.getBoundingClientRect();
        const isLeftHalf = clientX < rect.left + rect.width / 2;
        
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator active';
        
        if (isLeftHalf) {
            tile.parentNode.insertBefore(indicator, tile);
        } else {
            tile.parentNode.insertBefore(indicator, tile.nextSibling);
        }
    }

    clearDropIndicators() {
        document.querySelectorAll('.drop-indicator').forEach(indicator => {
            indicator.remove();
        });
    }

    reorderTiles(fromIndex, toIndex) {
        if (!this.tileGridLayout) return;
        
        // Swap the tiles in the grid
        const temp = this.tileGridLayout[fromIndex];
        this.tileGridLayout[fromIndex] = this.tileGridLayout[toIndex];
        this.tileGridLayout[toIndex] = temp;
        
        // Sync back to game state
        this.syncGridLayoutToGameState();
        
        // Play tile placement sound
        this.playSound('placeTile');
        
        this.renderPlayerHand();
        this.showNotification('Tiles reordered', 'info');
    }

    renderGameBoard() {
        const boardElement = document.getElementById('gameBoard');
        
        if (!this.gameState.board || this.gameState.board.length === 0) {
            boardElement.innerHTML = `
                <div class="board-placeholder">
                    <i class="fas fa-chess-board"></i>
                    <p>Played sets will appear here</p>
                    ${this.isMyTurn() ? '<p class="drop-zone-hint">Drag tiles here to create new sets</p>' : ''}
                </div>
            `;
            
            // Make the placeholder a drop zone if it's the player's turn
            if (this.isMyTurn()) {
                this.setupBoardDropZone(boardElement.querySelector('.board-placeholder'));
            }
            return;
        }
        
        boardElement.innerHTML = '';
        
        // Create a four-column layout by distributing sets evenly
        const columns = [
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div')
        ];
        
        columns.forEach((column, i) => {
            column.className = `board-column column-${i+1}`;
        });
        
        this.gameState.board.forEach((set, setIndex) => {
            const setElement = document.createElement('div');
            setElement.className = 'board-set';
            setElement.dataset.setIndex = setIndex;
            setElement.setAttribute('aria-label', `Set ${setIndex + 1} with ${set.length} tiles`);
            
            // Make set a drop zone if it's the player's turn
            if (this.isMyTurn()) {
                this.setupSetDropZone(setElement, setIndex);
            }
            
            set.forEach((tile, tileIndex) => {
                const tileElement = this.createTileElement(tile, this.isMyTurn());
                tileElement.classList.add('board-tile');
                tileElement.dataset.setIndex = setIndex;
                tileElement.dataset.tileIndex = tileIndex;
                
                // Check if this tile was already on the board at the start of the turn (committed)
                if (this.isTileCommitted(tile, setIndex, tileIndex)) {
                    tileElement.classList.add('committed');
                }
                
                // Make board tiles draggable if it's the player's turn
                if (this.isMyTurn()) {
                    this.setupBoardTileDrag(tileElement, tile, setIndex, tileIndex);
                }
                
                setElement.appendChild(tileElement);
            });
            
            // Distribute sets evenly between 4 columns (modulo 4)
            const columnIndex = setIndex % 4;
            columns[columnIndex].appendChild(setElement);
        });
        
        // Add a drop zone for creating new sets in the column with fewest sets
        if (this.isMyTurn()) {
            const newSetZone = document.createElement('div');
            newSetZone.className = 'new-set-drop-zone';
            newSetZone.innerHTML = '<p>Drop tiles here to create a new set</p>';
            this.setupNewSetDropZone(newSetZone);
            
            // Find the column with the fewest sets
            let minColumnIndex = 0;
            for (let i = 1; i < columns.length; i++) {
                if (columns[i].childElementCount < columns[minColumnIndex].childElementCount) {
                    minColumnIndex = i;
                }
            }
            
            // Add the new set drop zone to the column with fewest sets
            columns[minColumnIndex].appendChild(newSetZone);
        }
        
        // Add all columns to the board
        columns.forEach(column => {
            boardElement.appendChild(column);
        });
    }

    createTileElement(tile, isDraggable = false) {
        const tileElement = document.createElement('div');
        tileElement.className = `tile ${tile.color || ''} ${tile.isJoker ? 'joker' : ''}`;
        tileElement.dataset.tileId = tile.id;
        
        // Add accessibility attributes
        tileElement.setAttribute('role', 'button');
        tileElement.setAttribute('tabindex', '0');
        
        if (tile.isJoker) {
            tileElement.innerHTML = `
                <div class="tile-number">JOKER</div>
                <div class="tile-shape"></div>
            `;
            tileElement.setAttribute('aria-label', 'Joker tile');
        } else {
            const shapeMap = {
                red: 'star',
                blue: 'circle', 
                yellow: 'triangle',
                black: 'square'
            };
            
            tileElement.innerHTML = `
                <div class="tile-number">${tile.number}</div>
                <div class="tile-shape"></div>
            `;
            
            tileElement.setAttribute('aria-label', 
                `${tile.color} ${shapeMap[tile.color]} ${tile.number}`);
        }
        
        // Add keyboard support
        tileElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (isDraggable) {
                    this.toggleTileSelection(tile.id, tileElement);
                }
            }
        });
        
        return tileElement;
    }

    toggleTileSelection(tileId, tileElement) {
        const index = this.selectedTiles.indexOf(tileId);
        
        if (index === -1) {
            this.selectedTiles.push(tileId);
            tileElement.classList.add('selected');
            this.playSound('pickupTile');
        } else {
            this.selectedTiles.splice(index, 1);
            tileElement.classList.remove('selected');
            this.playSound('placeTile');
        }
        
        this.updatePlayButton();
    }

    updatePlayButton() {
        const playButton = document.getElementById('playSetBtn');
        const count = this.selectedTiles.length;
        
        if (count === 0) {
            playButton.innerHTML = '<i class="fas fa-play"></i> Play Selected';
        } else {
            playButton.innerHTML = `<i class="fas fa-play"></i> Play Selected (${count})`;
        }
    }

    updateActionButtons() {
        const isMyTurn = this.isMyTurn();
        const gameStarted = this.gameState && this.gameState.started;
        const canAct = isMyTurn && gameStarted;
        
        // Always check if board state has changed
        this.hasBoardStateChanged();
        
        // Draw Tile button - disable if tiles have been played this turn
        const drawBtn = document.getElementById('drawTileBtn');
        if (drawBtn) {
            const canDrawTile = canAct && !this.hasPlayedTilesThisTurn;
            drawBtn.style.opacity = canDrawTile ? '1' : '0.5';
            drawBtn.disabled = !canDrawTile;
            if (canDrawTile) {
                drawBtn.removeAttribute('disabled');
            } else {
                drawBtn.setAttribute('disabled', 'disabled');
            }
        }
        
        // End Turn button - only enable if board has been changed  
        const endBtn = document.getElementById('endTurnBtn');
        if (endBtn) {
            const canEndTurn = canAct && this.hasBoardChanged;
            endBtn.style.opacity = canEndTurn ? '1' : '0.5';
            endBtn.disabled = !canEndTurn;
            if (canEndTurn) {
                endBtn.removeAttribute('disabled');
            } else {
                endBtn.setAttribute('disabled', 'disabled');
            }
        }
        
        // Play Set button
        const playBtn = document.getElementById('playSetBtn');
        if (playBtn) {
            playBtn.style.opacity = canAct ? '1' : '0.5';
            playBtn.disabled = !canAct;
            if (canAct) {
                playBtn.removeAttribute('disabled');
            } else {
                playBtn.setAttribute('disabled', 'disabled');
            }
        }
        
        // Undo button - only enabled if it's player's turn and board state has changed
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            const canUndo = canAct && this.hasBoardChanged;
            undoBtn.style.opacity = canUndo ? '1' : '0.5';
            undoBtn.disabled = !canUndo;
            if (canUndo) {
                undoBtn.removeAttribute('disabled');
            } else {
                undoBtn.setAttribute('disabled', 'disabled');
            }
        }
        
        // Update debug info
        const debugElement = document.getElementById('debugInfo');
        if (debugElement) {
            const currentPlayer = this.gameState?.players?.[this.gameState?.currentPlayerIndex];
            debugElement.textContent = `MyTurn:${isMyTurn} Started:${gameStarted} Current:${currentPlayer?.name} MyId:${this.socket?.id} Buttons:${canAct ? 'ENABLED' : 'DISABLED'}`;
        }
        
        console.log(`🎮 Action buttons updated: isMyTurn=${isMyTurn}, gameStarted=${gameStarted}, canAct=${canAct}`);
        console.log(`🔍 Debug details:`, {
            gameState: !!this.gameState,
            players: this.gameState?.players?.length,
            currentPlayerIndex: this.gameState?.currentPlayerIndex,
            currentPlayer: this.gameState?.players?.[this.gameState?.currentPlayerIndex]?.name,
            mySocketId: this.socket?.id
        });
    }

    updateChat(messages) {
        const chatElement = document.getElementById('chatMessages');
        chatElement.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            chatElement.innerHTML = '<div style="text-align: center; color: #a0aec0; font-style: italic;">No messages yet. Say hello!</div>';
            return;
        }
        
        messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            
            const time = new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-sender">${message.playerName}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.message)}</div>
            `;
            
            chatElement.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        chatElement.scrollTop = chatElement.scrollHeight;
    }

    updateGameLog(logEntries) {
        const logElement = document.getElementById('gameLogMessages');
        logElement.innerHTML = '';
        
        if (!logEntries || logEntries.length === 0) {
            logElement.innerHTML = '<div style="text-align: center; color: #a0aec0; font-style: italic;">Game actions will appear here</div>';
            return;
        }
        
        logEntries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'game-log-entry';
            
            const time = new Date(entry.timestamp).toLocaleTimeString([], { 
                hour: '2-digit',
                minute: '2-digit' 
            });
            
            let actionText = '';
            switch (entry.action) {
                case 'played_set':
                    actionText = `played ${entry.details}`;
                    break;
                case 'drew_tile':
                    actionText = `drew a tile (${entry.details})`;
                    break;
                case 'started_turn':
                    actionText = `turn started`;
                    break;
                case 'ended_turn':
                    actionText = `turn ended`;
                    break;
                default:
                    actionText = entry.action;
            }
            
            entryDiv.innerHTML = `
                <span class="log-time">${time}</span>
                <span class="log-player">${entry.playerName}</span>
                <span class="log-action"> ${actionText}</span>
            `;
            
            logElement.appendChild(entryDiv);
        });
        
        // Scroll to bottom
        logElement.scrollTop = logElement.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Create toast container if it doesn't exist
        const container = document.getElementById('toast-container');
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Create icon based on type
        let icon;
        switch (type) {
            case 'success':
                icon = 'check-circle';
                break;
            case 'error':
                icon = 'exclamation-circle';
                break;
            case 'warning':
                icon = 'exclamation-triangle';
                break;
            default: // info
                icon = 'info-circle';
        }
        
        // Set toast content
        toast.innerHTML = `
            <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
            <div class="toast-content">${message}</div>
        `;
        
        // Add to container
        container.appendChild(toast);
        
        // Auto-remove after animation completes (5 seconds total)
        setTimeout(() => {
            toast.addEventListener('animationend', () => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, { once: true });
        }, 4500);
        
        // Log notification for debugging
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    showVictoryCelebration(winnerName) {
        const overlay = document.getElementById('victoryOverlay');
        const winnerElement = document.getElementById('winnerName');
        const playAgainBtn = document.getElementById('playAgainBtn');
        
        // Set winner name
        winnerElement.textContent = `${winnerName} Wins!`;
        
        // Create confetti
        this.createConfetti();
        
        // Show overlay
        overlay.classList.remove('hidden');
        
        // Setup play again button
        playAgainBtn.onclick = () => {
            this.hideVictoryCelebration();
            this.backToWelcome();
        };
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideVictoryCelebration();
        }, 10000);
    }

    hideVictoryCelebration() {
        const overlay = document.getElementById('victoryOverlay');
        overlay.classList.add('hidden');
        
        // Clear confetti
        const confettiContainer = overlay.querySelector('.confetti-container');
        confettiContainer.innerHTML = '';
    }

    createConfetti() {
        const confettiContainer = document.querySelector('.confetti-container');
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
        
        // Create 100 confetti pieces
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            confettiContainer.appendChild(confetti);
        }
    }

    backToWelcome() {
        // Switch to welcome screen
        const gameScreen = document.getElementById('gameScreen');
        const welcomeScreen = document.getElementById('welcomeScreen');
        
        gameScreen.classList.remove('active');
        welcomeScreen.classList.add('active');
        
        // Reset game state
        this.gameState = null;
        this.selectedTiles = [];
    }

    setupBoardTileDrag(tileElement, tile, setIndex, tileIndex) {
        tileElement.draggable = true;
        tileElement.style.cursor = 'grab';
        
        tileElement.addEventListener('dragstart', (e) => {
            tileElement.style.cursor = 'grabbing';
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'board-tile',
                tile: tile,
                sourceSetIndex: setIndex,
                sourceTileIndex: tileIndex
            }));
            tileElement.classList.add('dragging');
            
            // Play tile pickup sound when starting to drag
            this.playSound('pickupTile');
        });
        
        tileElement.addEventListener('dragend', () => {
            tileElement.style.cursor = 'grab';
            tileElement.classList.remove('dragging');
            
            // Play tile placement sound when drag ends
            this.playSound('placeTile');
        });
    }

    setupSetDropZone(setElement, setIndex) {
        // Add visual indicators for drag over locations
        const addPositionIndicators = (e) => {
            // Clear existing indicators
            setElement.querySelectorAll('.position-indicator').forEach(el => el.remove());
            
            // Create position indicator
            const indicator = document.createElement('div');
            indicator.className = 'position-indicator';
            
            // Determine where to show the indicator
            const rect = setElement.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const tileWidth = 70; // Approximate tile width
            const tiles = setElement.querySelectorAll('.tile');
            let insertPosition = Math.floor(mouseX / tileWidth);
            
            // Clamp insert position to valid range
            insertPosition = Math.min(Math.max(0, insertPosition), tiles.length);
            
            // Position indicator at insert position
            if (insertPosition === 0) {
                // Before first tile
                indicator.style.left = '0px';
                setElement.prepend(indicator);
            } else if (insertPosition === tiles.length) {
                // After last tile
                indicator.style.right = '0px';
                setElement.appendChild(indicator);
            } else {
                // Between tiles
                const tile = tiles[insertPosition];
                const tileRect = tile.getBoundingClientRect();
                indicator.style.left = (tileRect.left - rect.left - 5) + 'px';
                setElement.appendChild(indicator);
            }
            
            // Store the insert position as data attribute
            setElement.dataset.insertPosition = insertPosition;
        };
    
        setElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's a hand tile and reject visually only if player needs initial play
            try {
                const dragDataString = e.dataTransfer.getData('application/json');
                if (dragDataString) {
                    const dragData = JSON.parse(dragDataString);
                    const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
                    const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;
                    
                    if (dragData.type === 'hand-tile' && needsInitialPlay) {
                        setElement.classList.add('drag-rejected');
                        return;
                    }
                }
            } catch (error) {
                // If we can't parse, allow normal behavior
            }
            
            setElement.classList.add('drag-over');
            addPositionIndicators(e);
        });
        
        setElement.addEventListener('dragleave', (e) => {
            // Only remove drag-over if leaving the element (not moving within it)
            if (!setElement.contains(e.relatedTarget)) {
                setElement.classList.remove('drag-over');
                setElement.classList.remove('drag-rejected');
                setElement.querySelectorAll('.position-indicator').forEach(el => el.remove());
            }
        });
        
        setElement.addEventListener('drop', (e) => {
            e.preventDefault();
            setElement.classList.remove('drag-over');
            setElement.classList.remove('drag-rejected');
            setElement.querySelectorAll('.position-indicator').forEach(el => el.remove());
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                
                // Get the preferred insert position if available
                const insertPosition = parseInt(setElement.dataset.insertPosition);
                delete setElement.dataset.insertPosition;
                
                // Enhanced drop that respects insert position
                this.handleEnhancedTileDrop(dragData, setIndex, isNaN(insertPosition) ? null : insertPosition);
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        });
    }

    setupNewSetDropZone(newSetZone) {
        newSetZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's a hand tile and reject visually only if player needs initial play
            try {
                const dragDataString = e.dataTransfer.getData('application/json');
                if (dragDataString) {
                    const dragData = JSON.parse(dragDataString);
                    const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
                    const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;
                    
                    if (dragData.type === 'hand-tile' && needsInitialPlay) {
                        newSetZone.classList.add('drag-rejected');
                        return;
                    }
                }
            } catch (error) {
                // If we can't parse, allow normal behavior
            }
            
            newSetZone.classList.add('drag-over');
        });
        
        newSetZone.addEventListener('dragleave', () => {
            newSetZone.classList.remove('drag-over');
            newSetZone.classList.remove('drag-rejected');
        });
        
        newSetZone.addEventListener('drop', (e) => {
            e.preventDefault();
            newSetZone.classList.remove('drag-over');
            newSetZone.classList.remove('drag-rejected');
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                this.handleTileDrop(dragData, -1); // -1 indicates new set
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        });
    }

    setupBoardDropZone(placeholderElement) {
        placeholderElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's a hand tile and reject visually only if player needs initial play
            try {
                const dragDataString = e.dataTransfer.getData('application/json');
                if (dragDataString) {
                    const dragData = JSON.parse(dragDataString);
                    const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
                    const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;
                    
                    if (dragData.type === 'hand-tile' && needsInitialPlay) {
                        placeholderElement.classList.add('drag-rejected');
                        return;
                    }
                }
            } catch (error) {
                // If we can't parse, allow normal behavior
            }
            
            placeholderElement.classList.add('drag-over');
        });
        
        placeholderElement.addEventListener('dragleave', () => {
            placeholderElement.classList.remove('drag-over');
            placeholderElement.classList.remove('drag-rejected');
        });
        
        placeholderElement.addEventListener('drop', (e) => {
            e.preventDefault();
            placeholderElement.classList.remove('drag-over');
            placeholderElement.classList.remove('drag-rejected');
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                this.handleTileDrop(dragData, -1); // -1 indicates new set
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        });
    }

    handleTileDrop(dragData, targetSetIndex) {
        if (!this.isMyTurn()) {
            this.showNotification('Not your turn!', 'error');
            return;
        }

        // Get current player status
        const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
        const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;

        // Create a copy of the current board for manipulation
        let newBoard = JSON.parse(JSON.stringify(this.gameState.board));
        let tilesFromHand = [];  // Track tiles moved from hand to board

        if (dragData.type === 'hand-tile') {
            // Only prevent single tile drops from hand to board if player needs initial play
            if (needsInitialPlay) {
                this.showNotification('Must use "Play Selected" button for initial 30+ point play!', 'error');
                return;
            }
            
            console.log('🎯 Table manipulation: Adding single tile to board');
            // Tile from hand - add to existing set or create new set
            if (targetSetIndex === -1) {
                // Create new set
                newBoard.push([dragData.tile]);
            } else {
                // Add to existing set - but intelligently position the tile
                this.addTileToSetIntelligently(newBoard[targetSetIndex], dragData.tile);
            }
            
            // Track that this tile was moved from hand to board
            tilesFromHand.push(dragData.tile.id);
            
            // Remove tile from hand locally for immediate UI feedback
            const tileIndex = this.gameState.playerHand.findIndex(t => t.id === dragData.tile.id);
            if (tileIndex !== -1) {
                // Create a copy of the player's hand and remove the tile
                const newHand = [...this.gameState.playerHand];
                newHand.splice(tileIndex, 1);
                this.gameState.playerHand = newHand;
                
                // Render the updated hand
                this.renderPlayerHand();
            }
        } else if (dragData.type === 'board-tile') {
            // Moving tile between sets on board
            const sourceSetIndex = dragData.sourceSetIndex;
            const sourceTileIndex = dragData.sourceTileIndex;
            
            // Remove tile from source set
            const movedTile = newBoard[sourceSetIndex].splice(sourceTileIndex, 1)[0];
            
            // Remove empty sets
            if (newBoard[sourceSetIndex].length === 0) {
                newBoard.splice(sourceSetIndex, 1);
                // Adjust target index if necessary
                if (targetSetIndex > sourceSetIndex) {
                    targetSetIndex--;
                }
            }
            
            if (targetSetIndex === -1) {
                // Create new set
                newBoard.push([movedTile]);
            } else {
                // Add to existing set intelligently
                if (targetSetIndex < newBoard.length) {
                    this.addTileToSetIntelligently(newBoard[targetSetIndex], movedTile);
                } else {
                    // Target set was removed, create new set
                    newBoard.push([movedTile]);
                }
            }
        }

        // Send board update to server
        this.updateBoard(newBoard, tilesFromHand);
    }

    // Enhanced tile drop handler that respects insert position
    handleEnhancedTileDrop(dragData, targetSetIndex, insertPosition) {
        if (!this.isMyTurn()) {
            this.showNotification('Not your turn!', 'error');
            return;
        }

        // Get current player status
        const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
        const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;

        // Create a copy of the current board for manipulation
        let newBoard = JSON.parse(JSON.stringify(this.gameState.board));
        let tilesFromHand = [];  // Track tiles moved from hand to board

        if (dragData.type === 'hand-tile') {
            // Only prevent single tile drops from hand to board if player needs initial play
            if (needsInitialPlay) {
                this.showNotification('Must use "Play Selected" button for initial 30+ point play!', 'error');
                return;
            }
            
            console.log(`🎯 Table manipulation: Adding hand tile to board at set ${targetSetIndex}, position ${insertPosition}`);
            
            // Track that this tile was moved from hand to board
            tilesFromHand.push(dragData.tile.id);
            
            // Tile from hand - add to existing set or create new set
            if (targetSetIndex === -1) {
                // Create new set
                newBoard.push([dragData.tile]);
            } else {
                // Add to existing set at the specified position
                if (insertPosition !== null && targetSetIndex < newBoard.length) {
                    // Insert at specific position
                    insertPosition = Math.min(insertPosition, newBoard[targetSetIndex].length);
                    newBoard[targetSetIndex].splice(insertPosition, 0, dragData.tile);
                } else {
                    // Use intelligent placement as fallback
                    this.addTileToSetIntelligently(newBoard[targetSetIndex], dragData.tile);
                }
            }
            
            // Remove tile from hand
            // First find the tile in the hand
            const tileIndex = this.gameState.playerHand.findIndex(t => t.id === dragData.tile.id);
            if (tileIndex !== -1) {
                // Create a new hand array without the tile
                const newHand = [...this.gameState.playerHand];
                newHand.splice(tileIndex, 1);
                
                // Update the local hand immediately for visual feedback
                this.gameState.playerHand = newHand;
                this.renderPlayerHand();
                
                // Make sure buttons are updated (particularly undo button)
                this.updateActionButtons();
                
                console.log('🎮 Tile removed from hand and board updated');
            }
        } else if (dragData.type === 'board-tile') {
            // Moving tile between sets on board
            const sourceSetIndex = dragData.sourceSetIndex;
            const sourceTileIndex = dragData.sourceTileIndex;
            
            // Remove tile from source set
            const movedTile = newBoard[sourceSetIndex].splice(sourceTileIndex, 1)[0];
            
            // Remove empty sets
            if (newBoard[sourceSetIndex].length === 0) {
                newBoard.splice(sourceSetIndex, 1);
                // Adjust target index if necessary
                if (targetSetIndex > sourceSetIndex) {
                    targetSetIndex--;
                }
            }
            
            console.log(`🎯 Table manipulation: Moving board tile from set ${sourceSetIndex} to set ${targetSetIndex}, position ${insertPosition}`);
            
            if (targetSetIndex === -1) {
                // Create new set
                newBoard.push([movedTile]);
            } else {
                // Add to existing set at the specified position
                if (targetSetIndex < newBoard.length) {
                    if (insertPosition !== null) {
                        // Insert at specific position
                        insertPosition = Math.min(insertPosition, newBoard[targetSetIndex].length);
                        newBoard[targetSetIndex].splice(insertPosition, 0, movedTile);
                    } else {
                        // Use intelligent placement
                        this.addTileToSetIntelligently(newBoard[targetSetIndex], movedTile);
                    }
                } else {
                    // Target set was removed, create new set
                    newBoard.push([movedTile]);
                }
            }
        }

        // Send board update to server
        this.updateBoard(newBoard, tilesFromHand);
    }

    handleBoardTileToHand(dragData) {
        if (!this.isMyTurn()) {
            this.showNotification('Not your turn!', 'error');
            return;
        }

        // Prevent excessive processing of the same drag operation
        if (this._lastDragOperation && 
            this._lastDragOperation.time > Date.now() - 500 && 
            this._lastDragOperation.tileId === dragData.tile.id) {
            console.log('🛑 Preventing duplicate drag operation');
            return;
        }
        
        // Store this operation to prevent duplicates
        this._lastDragOperation = {
            time: Date.now(),
            tileId: dragData.tile.id
        };

        console.log('🔄 Moving tile from board back to hand:', dragData.tile);
        
        // Play tile pickup sound
        this.playSound('pickupTile');
        
        // Add the tile to the local hand immediately for better visual feedback
        // This will be overwritten when the server responds with the updated state
        if (this.gameState && this.gameState.playerHand) {
            // Create a deep copy to avoid reference issues
            const tileCopy = JSON.parse(JSON.stringify(dragData.tile));
            this.gameState.playerHand.push(tileCopy);
            this.renderPlayerHand();
        }

        // We send the request to the server for official state update
        this.socket.emit('moveFromBoardToHand', {
            tile: dragData.tile,
            sourceSetIndex: dragData.sourceSetIndex,
            sourceTileIndex: dragData.sourceTileIndex
        });
        
        // Disable the dragged tile temporarily to prevent double-clicks/drags
        const tileElement = document.querySelector(`[data-tile-id="${dragData.tile.id}"]`);
        if (tileElement) {
            tileElement.style.opacity = "0.5";
            tileElement.style.pointerEvents = "none";
            
            // Reset after a short delay
            setTimeout(() => {
                if (tileElement && tileElement.parentNode) {
                    tileElement.style.opacity = "1";
                    tileElement.style.pointerEvents = "auto";
                }
            }, 500);
        }
        
        this.showNotification('Moved tile back to hand', 'success');
    }

    // Intelligently add a tile to a set in the appropriate position
    addTileToSetIntelligently(set, tile) {
        if (!set || !tile) return;
        
        // First, determine if this is a run or a group
        let isRun = false;
        let isGroup = false;
        
        if (set.length >= 2) {
            // Check if it's potentially a run (consecutive numbers of same color)
            const nonJokers = set.filter(t => !t.isJoker);
            if (nonJokers.length >= 2) {
                const allSameColor = new Set(nonJokers.map(t => t.color)).size === 1;
                isRun = allSameColor;
                
                // If not a run, must be a group (same number, different colors)
                if (!isRun) {
                    const allSameNumber = new Set(nonJokers.map(t => t.number)).size === 1;
                    isGroup = allSameNumber;
                }
            }
        }
        
        // Handle joker - we'll insert it based on the set type
        if (tile.isJoker) {
            // For a group, just append the joker
            if (isGroup || (!isRun && !isGroup)) {
                set.push(tile);
                return;
            }
            
            // For a run, determine the best position based on the gaps
            if (isRun) {
                const numbers = set.filter(t => !t.isJoker).map(t => t.number).sort((a, b) => a - b);
                
                // Determine if joker should go at the beginning, end, or middle
                if (numbers.length >= 1) {
                    if (numbers[0] > 1) {
                        // Insert at the beginning (joker represents numbers[0]-1)
                        set.unshift(tile);
                        return;
                    } else if (numbers[numbers.length - 1] < 13) {
                        // Insert at the end (joker represents numbers[numbers.length-1]+1)
                        set.push(tile);
                        return;
                    } else {
                        // Look for gaps in the run
                        for (let i = 0; i < numbers.length - 1; i++) {
                            if (numbers[i+1] - numbers[i] > 1) {
                                // Find the position to insert at
                                let insertIndex = 0;
                                for (let j = 0; j < set.length; j++) {
                                    if (!set[j].isJoker && set[j].number === numbers[i]) {
                                        insertIndex = j + 1;
                                        break;
                                    }
                                }
                                set.splice(insertIndex, 0, tile);
                                return;
                            }
                        }
                        // If we get here, there are no gaps - append to end
                        set.push(tile);
                    }
                } else {
                    // No non-joker tiles, just append
                    set.push(tile);
                }
                return;
            }
        }
        
        // Non-joker tiles
        if (isRun) {
            // Insert the tile in the correct numerical order
            const currentColor = set.find(t => !t.isJoker)?.color;
            
            // If the color doesn't match and it's a run, this might not be valid
            // We'll insert it anyway and let end-turn validation catch the issue
            if (currentColor && tile.color !== currentColor) {
                set.push(tile);
                return;
            }
            
            // Insert in numerical order
            let insertIndex = set.length;
            for (let i = 0; i < set.length; i++) {
                const setTile = set[i];
                if ((setTile.isJoker && i === set.length - 1) || 
                    (!setTile.isJoker && tile.number < setTile.number)) {
                    insertIndex = i;
                    break;
                }
            }
            set.splice(insertIndex, 0, tile);
            return;
        }
        
        // For groups (same number, different colors)
        if (isGroup) {
            const currentNumber = set.find(t => !t.isJoker)?.number;
            
            // If the number doesn't match and it's a group, this might not be valid
            // We'll insert it anyway and let end-turn validation catch the issue
            if (currentNumber && tile.number !== currentNumber) {
                set.push(tile);
                return;
            }
            
            // Check if this color already exists in the group
            const colors = set.map(t => t.color);
            if (colors.includes(tile.color)) {
                // Color already exists, just append (may not be valid)
                set.push(tile);
                return;
            }
            
            // Insert based on color order (red, blue, yellow, black)
            const colorOrder = { 'red': 0, 'blue': 1, 'yellow': 2, 'black': 3 };
            let insertIndex = set.length;
            
            for (let i = 0; i < set.length; i++) {
                if (set[i].isJoker) continue;
                if (colorOrder[tile.color] < colorOrder[set[i].color]) {
                    insertIndex = i;
                    break;
                }
            }
            
            set.splice(insertIndex, 0, tile);
            return;
        }
        
        // If we can't determine the set type (e.g., only one tile), just append
        set.push(tile);
    }
    
    updateBoard(newBoard, tilesFromHand = []) {
        // Store local copy immediately for better UX response
        if (this.gameState) {
            this.gameState.board = newBoard;
            
            // Update the undo button based on the board state change
            this.updateActionButtons();
        }
        
        // Send to server with explicit list of tiles moved from hand
        this.socket.emit('updateBoard', { 
            board: newBoard,
            tilesFromHand: tilesFromHand
        });
    }

    highlightInvalidSet(setIndex) {
        const boardElement = document.getElementById('gameBoard');
        const setElements = boardElement.querySelectorAll('.board-set');
        
        // Remove previous highlights
        setElements.forEach(set => set.classList.remove('invalid-set'));
        
        // Highlight the invalid set
        if (setIndex < setElements.length) {
            setElements[setIndex].classList.add('invalid-set');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
                setElements[setIndex].classList.remove('invalid-set');
            }, 3000);
        }
    }

    // Check if a tile was already on the board at the start of the current turn
    isTileCommitted(tile, setIndex, tileIndex) {
        if (!this.gameState.boardSnapshot || !tile || !tile.id) {
            return false;
        }
        
        // Check if this tile ID exists anywhere in the board snapshot
        // Once a tile is committed, it stays committed regardless of position
        for (let snapSetIndex = 0; snapSetIndex < this.gameState.boardSnapshot.length; snapSetIndex++) {
            const snapshotSet = this.gameState.boardSnapshot[snapSetIndex];
            if (snapshotSet && Array.isArray(snapshotSet)) {
                for (let snapTileIndex = 0; snapTileIndex < snapshotSet.length; snapTileIndex++) {
                    const snapshotTile = snapshotSet[snapTileIndex];
                    if (snapshotTile && snapshotTile.id === tile.id) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    // Timer Methods
    startTimer() {
        if (!this.timerEnabled || !this.gameState?.timerEnabled) {
            return;
        }

        // Clear any existing timer
        this.clearTimer();
        
        // Show timer
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.classList.remove('hidden', 'timer-warning', 'timer-danger');
            
            // Add warning classes based on current time
            if (this.remainingTime <= 30 && this.remainingTime > 10) {
                timerElement.classList.add('timer-warning');
            } else if (this.remainingTime <= 10) {
                timerElement.classList.add('timer-danger');
            }
        }
        
        // Update display
        this.updateTimerDisplay();
        
        // We don't need to set up an interval for counting down
        // as we will receive timer updates from the server via the 'timerUpdate' event
    }
    
    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimerDisplay(remainingTime) {
        // If specific remaining time was provided (from server), use it
        if (remainingTime !== undefined) {
            this.remainingTime = remainingTime;
        }
        
        const timerElement = document.getElementById('turnTimer');
        if (!timerElement) return;
        
        if (this.remainingTime <= 0) {
            timerElement.textContent = '0:00';
            timerElement.classList.add('timer-warning');
        } else {
            const minutes = Math.floor(this.remainingTime / 60);
            const seconds = this.remainingTime % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Add warning class when less than 15 seconds remain
            if (this.remainingTime <= 15) {
                timerElement.classList.add('timer-warning');
            } else {
                timerElement.classList.remove('timer-warning');
            }
        }
        
        console.log(`⏰ Timer display updated: ${timerElement.textContent}`);
    }
}

// Add some fun Easter eggs
document.addEventListener('keydown', (e) => {
    // Konami code for fun
    if (e.code === 'ArrowUp') {
        console.log('🎮 Enjoy your game of Rummikub!');
    }
});

// Add game tips
const tips = [
    "💡 Tip: Look for runs (consecutive numbers) and groups (same number, different colors)!",
    "💡 Tip: Your first play must be worth at least 30 points!",
    "💡 Tip: Jokers can substitute for any tile in a set!",
    "💡 Tip: Try to keep diverse tiles to maximize your playing options!",
    "💡 Tip: Watch what other players pick up to guess their strategy!"
];

setInterval(() => {
    if (Math.random() < 0.1) { // 10% chance every interval
        const tip = tips[Math.floor(Math.random() * tips.length)];
        console.log(tip);
    }
}, 30000); // Every 30 seconds

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOM loaded, initializing RummikubClient...');
    window.game = new RummikubClient();
    console.log('✅ RummikubClient initialized');
});
