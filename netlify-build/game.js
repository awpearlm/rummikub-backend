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
        this.gameMode = null; // 'multiplayer' or 'bot'
        this.botDifficulty = 'medium';
        this.hasAutoSorted = false; // Track if auto-sort has been done
        this.hasPlayedTilesThisTurn = false; // Track if tiles have been played this turn
        
        // UI State tracking for drag-and-drop
        this.pendingMoves = []; // Track moves that haven't been confirmed by server
        this.originalGameState = null; // Backup of game state before any pending moves
        
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
        document.getElementById('createGameBtn').addEventListener('click', () => this.createGame());
        document.getElementById('joinGameBtn').addEventListener('click', () => this.showJoinForm());
        document.getElementById('joinGameSubmit').addEventListener('click', () => this.joinGame());
        
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

        this.socket.on('gameStarted', (data) => {
            this.gameState = data.gameState;
            console.log(`🃏 DEBUG: Received playerHand with ${this.gameState.playerHand?.length || 0} tiles:`, 
                this.gameState.playerHand?.slice(0, 5).map(t => `${t.isJoker ? 'JOKER' : t.number + t.color[0]}`));
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
        });

        this.socket.on('reconnect', () => {
            this.showNotification('Reconnected!', 'success');
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
            this.renderGameBoard();
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
            this.renderGameBoard();
            this.showNotification('Board restored to turn start', 'info');
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
                this.socket.emit('createGame', { playerName });
            });
        } else {
            // Already connected
            this.socket.emit('createGame', { playerName });
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

    drawTile() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        this.socket.emit('drawTile');
    }

    endTurn() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        this.socket.emit('endTurn');
    }

    undoLastMove() {
        if (!this.isMyTurn()) {
            this.showNotification("It's not your turn!", 'error');
            return;
        }
        
        if (!this.hasBoardStateChanged()) {
            this.showNotification("Nothing to undo!", 'error');
            return;
        }
        
        // Restore board to the latest snapshot
        if (this.gameState && this.gameState.boardSnapshot) {
            const restoredBoard = JSON.parse(JSON.stringify(this.gameState.boardSnapshot));
            this.updateBoard(restoredBoard);
            this.showNotification("Last move undone", 'success');
        }
    }

    hasBoardStateChanged() {
        if (!this.gameState || !this.gameState.boardSnapshot || !this.gameState.board) {
            return false;
        }
        
        // Compare current board state with the snapshot
        const currentBoard = JSON.stringify(this.gameState.board);
        const snapshotBoard = JSON.stringify(this.gameState.boardSnapshot);
        
        return currentBoard !== snapshotBoard;
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
        
        // Sort by number and check consecutive (simplified - doesn't handle jokers perfectly)
        const sortedTiles = [...tiles].sort((a, b) => {
            if (a.isJoker) return -1;
            if (b.isJoker) return 1;
            return a.number - b.number;
        });
        
        const numbers = sortedTiles.filter(t => !t.isJoker).map(t => t.number);
        for (let i = 1; i < numbers.length; i++) {
            if (numbers[i] !== numbers[i-1] + 1) return false;
        }
        
        return true;
    }
    
    isValidGroupClient(tiles) {
        if (tiles.length < 3 || tiles.length > 4) return false;
        
        // All tiles must be same number (except jokers)
        const numbers = tiles.filter(t => !t.isJoker).map(t => t.number);
        if (new Set(numbers).size > 1) return false;
        
        // All tiles must be different colors (except jokers)
        const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
        if (new Set(colors).size !== colors.length) return false;
        
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

    getCurrentPlayer() {
        // Get the player object for the current user (me)
        return this.gameState?.players?.find(p => p.id === this.socket.id) || null;
    }

    // Optimistic update methods for drag-and-drop
    startOptimisticMove() {
        // Save the current game state as backup
        if (!this.originalGameState) {
            this.originalGameState = JSON.parse(JSON.stringify(this.gameState));
        }
    }

    applyOptimisticMove(moveType, moveData) {
        this.startOptimisticMove();
        
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return;

        const move = {
            type: moveType,
            data: moveData,
            timestamp: Date.now()
        };

        if (moveType === 'hand-to-board') {
            // Remove tile from hand and add to board
            const tileIndex = currentPlayer.hand.findIndex(t => t.id === moveData.tileId);
            if (tileIndex !== -1) {
                const tile = currentPlayer.hand.splice(tileIndex, 1)[0];
                
                if (moveData.targetSetIndex === -1) {
                    // Create new set
                    this.gameState.board.push([tile]);
                    move.data.newSetIndex = this.gameState.board.length - 1;
                } else {
                    // Add to existing set
                    this.gameState.board[moveData.targetSetIndex].push(tile);
                }
            }
        } else if (moveType === 'board-to-board') {
            // Move tile between board sets
            const sourceSet = this.gameState.board[moveData.sourceSetIndex];
            if (sourceSet && sourceSet[moveData.sourceTileIndex]) {
                const tile = sourceSet.splice(moveData.sourceTileIndex, 1)[0];
                
                // Remove empty sets
                if (sourceSet.length === 0) {
                    this.gameState.board.splice(moveData.sourceSetIndex, 1);
                    // Adjust target index if necessary
                    if (moveData.targetSetIndex > moveData.sourceSetIndex) {
                        moveData.targetSetIndex--;
                    }
                }
                
                if (moveData.targetSetIndex === -1) {
                    // Create new set
                    this.gameState.board.push([tile]);
                    move.data.newSetIndex = this.gameState.board.length - 1;
                } else {
                    // Add to existing set
                    this.gameState.board[moveData.targetSetIndex].push(tile);
                }
            }
        } else if (moveType === 'board-to-hand') {
            // Move tile from board back to hand
            const sourceSet = this.gameState.board[moveData.sourceSetIndex];
            if (sourceSet && sourceSet[moveData.sourceTileIndex]) {
                const tile = sourceSet.splice(moveData.sourceTileIndex, 1)[0];
                currentPlayer.hand.push(tile);
                
                // Remove empty sets
                if (sourceSet.length === 0) {
                    this.gameState.board.splice(moveData.sourceSetIndex, 1);
                }
            }
        }

        this.pendingMoves.push(move);
        
        // Update the UI
        this.updateGameState();
    }

    confirmOptimisticMoves() {
        // Server confirmed the moves, clear pending moves and backup
        this.pendingMoves = [];
        this.originalGameState = null;
    }

    revertOptimisticMoves() {
        // Server rejected the moves, restore original state
        if (this.originalGameState) {
            this.gameState = this.originalGameState;
            this.originalGameState = null;
            this.pendingMoves = [];
            this.updateGameState();
        }
    }

    undoLastOptimisticMove() {
        if (this.pendingMoves.length === 0) return;
        
        // Revert all moves and replay all but the last one
        const movesToReplay = this.pendingMoves.slice(0, -1);
        this.revertOptimisticMoves();
        
        // Replay the remaining moves
        movesToReplay.forEach(move => {
            this.applyOptimisticMove(move.type, move.data);
        });
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
            // Auto-sort tiles by number on initial deal only
            this.autoSortHandByNumber();
            
            // Always refresh grid layout when hand changes to ensure tiles are properly removed/added
            if (!this.tileGridLayout || this.hasHandChanged() || this.needsGridExpansion) {
                this.initializeGridLayout();
                this.needsGridExpansion = false;
            }
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
            this.lastKnownHandSize = currentSize;
            
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
            
            playerDiv.innerHTML = `
                <div class="player-avatar ${isBot ? 'bot-avatar' : ''}">${player.name.charAt(0).toUpperCase()}</div>
                <div class="player-info">
                    <div class="player-name">${player.name} ${playerLabel} ${botIcon}</div>
                    <div class="player-stats">
                        ${player.handSize} tiles
                        ${player.hasPlayedInitial ? '✓ Played initial' : ''}
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
        } else {
            turnElement.textContent = 'Waiting to start';
        }
    }

    renderPlayerHand() {
        const handElement = document.getElementById('playerHand');
        
        if (!this.gameState.playerHand || this.gameState.playerHand.length === 0) {
            handElement.innerHTML = '<div class="hand-placeholder"><p>Your tiles will appear here when the game starts</p></div>';
            return;
        }
        
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
        
        let gridSize;
        if (maxSlots) {
            gridSize = maxSlots;
        } else if (handSize <= 21) {
            gridSize = 21; // Start with 3 rows (21 slots) for normal gameplay
        } else {
            // Only expand beyond 21 when we actually have more than 21 tiles
            gridSize = Math.ceil(handSize / tilesPerRow) * tilesPerRow;
        }
        
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
            
            // Store the original index for reordering
            this.draggedTileIndex = index;
        });
        
        tileElement.addEventListener('dragend', (e) => {
            tileElement.classList.remove('dragging');
            this.clearDropIndicators();
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
        });
    }

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
            
            boardElement.appendChild(setElement);
        });
        
        // Add a drop zone for creating new sets
        if (this.isMyTurn()) {
            const newSetZone = document.createElement('div');
            newSetZone.className = 'new-set-drop-zone';
            newSetZone.innerHTML = '<p>Drop tiles here to create a new set</p>';
            this.setupNewSetDropZone(newSetZone);
            boardElement.appendChild(newSetZone);
        }
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
        } else {
            this.selectedTiles.splice(index, 1);
            tileElement.classList.remove('selected');
        }
        
        this.updatePlayButton();
        this.updateActionButtons(); // Update button states when selection changes
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
        
        // End Turn button  
        const endBtn = document.getElementById('endTurnBtn');
        if (endBtn) {
            endBtn.style.opacity = canAct ? '1' : '0.5';
            endBtn.disabled = !canAct;
            if (canAct) {
                endBtn.removeAttribute('disabled');
            } else {
                endBtn.setAttribute('disabled', 'disabled');
            }
        }
        
        // Play Set button - disabled if not player's turn OR no tiles selected
        const playBtn = document.getElementById('playSetBtn');
        if (playBtn) {
            const hasSelectedTiles = this.selectedTiles.length > 0;
            const canPlay = canAct && hasSelectedTiles;
            playBtn.style.opacity = canPlay ? '1' : '0.5';
            playBtn.disabled = !canPlay;
            if (canPlay) {
                playBtn.removeAttribute('disabled');
            } else {
                playBtn.setAttribute('disabled', 'disabled');
            }
        }
        
        // Undo button - only enabled if it's player's turn and board state has changed
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            const canUndo = canAct && this.hasBoardStateChanged();
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
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
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
        });
        
        tileElement.addEventListener('dragend', () => {
            tileElement.style.cursor = 'grab';
            tileElement.classList.remove('dragging');
        });
    }

    setupSetDropZone(setElement, setIndex) {
        setElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's a hand tile and should be rejected
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                if (dragData.type === 'hand-tile' && !this.canDragSingleTileToBoard()) {
                    setElement.classList.add('drag-rejected');
                    return;
                }
            } catch (error) {
                // If we can't parse, allow normal behavior
            }
            
            setElement.classList.add('drag-over');
        });
        
        setElement.addEventListener('dragleave', () => {
            setElement.classList.remove('drag-over');
            setElement.classList.remove('drag-rejected');
        });
        
        setElement.addEventListener('drop', (e) => {
            e.preventDefault();
            setElement.classList.remove('drag-over');
            setElement.classList.remove('drag-rejected');
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                this.handleTileDrop(dragData, setIndex);
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        });
    }

    setupNewSetDropZone(newSetZone) {
        newSetZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's a hand tile and should be rejected
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                if (dragData.type === 'hand-tile' && !this.canDragSingleTileToBoard()) {
                    newSetZone.classList.add('drag-rejected');
                    return;
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
            
            // Check if it's a hand tile and should be rejected
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                if (dragData.type === 'hand-tile' && !this.canDragSingleTileToBoard()) {
                    placeholderElement.classList.add('drag-rejected');
                    return;
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

    canDragSingleTileToBoard() {
        // Only allow single tile drag to board AFTER player has made initial 30+ point play
        const currentPlayer = this.getCurrentPlayer();
        return currentPlayer && currentPlayer.hasPlayedInitial;
    }

    handleTileDrop(dragData, targetSetIndex) {
        if (!this.isMyTurn()) {
            this.showNotification('Not your turn!', 'error');
            return;
        }

        // RULE ENFORCEMENT: Prevent single tile drops from hand to board UNTIL player has gone out
        if (dragData.type === 'hand-tile' && !this.canDragSingleTileToBoard()) {
            this.showNotification('Cannot drop single tiles to board until you make your initial 30+ point play! Use "Play Selected" button.', 'error');
            return;
        }

        // Create a copy of the current board for manipulation
        let newBoard = JSON.parse(JSON.stringify(this.gameState.board));

        if (dragData.type === 'hand-tile') {
            // Tile from hand - add to existing set or create new set
            if (targetSetIndex === -1) {
                // Create new set
                newBoard.push([dragData.tile]);
            } else {
                // Add to existing set
                newBoard[targetSetIndex].push(dragData.tile);
            }
            
            // Remove tile from hand (this will be handled by server validation)
            
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
                // Add to existing set
                if (targetSetIndex < newBoard.length) {
                    newBoard[targetSetIndex].push(movedTile);
                } else {
                    // Target set was removed, create new set
                    newBoard.push([movedTile]);
                }
            }
        }

        // Send board update to server
        this.updateBoard(newBoard);
    }

    updateBoard(newBoard) {
        this.socket.emit('updateBoard', { board: newBoard });
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
