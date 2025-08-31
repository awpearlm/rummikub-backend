class RummikubClient {
    constructor() {
        // Determine the backend URL based on environment
        const backendUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : 'https://rummikub-backend.onrender.com'; // Your deployed backend URL
        
        console.log('🌐 Connecting to:', backendUrl);
        
        // Check if user is authenticated
        this.token = localStorage.getItem('auth_token');
        this.username = localStorage.getItem('username');
        this.isAdmin = localStorage.getItem('is_admin') === 'true';
        
        // If not authenticated, redirect to login
        if (!this.token || !this.username) {
            window.location.href = '/login.html';
            return;
        }
        
        // Display the username in the profile bubble
        const profileUsername = document.getElementById('profileUsername');
        if (profileUsername) {
            profileUsername.textContent = this.username;
        }
        
        // Set the profile avatar initial (first letter of username)
        const profileAvatar = document.getElementById('profileInitial');
        if (profileAvatar) {
            profileAvatar.textContent = this.username.charAt(0).toUpperCase();
        }
        
        // Set up logout button
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => this.logout());
        }
        
        // Set up admin button (only for admins)
        const adminButton = document.getElementById('adminButton');
        if (adminButton) {
            if (this.isAdmin) {
                adminButton.style.display = 'block';
                adminButton.addEventListener('click', () => {
                    window.open('/admin.html', '_blank');
                });
            } else {
                adminButton.style.display = 'none';
            }
        }
        
        this.socket = io(backendUrl, {
            timeout: 20000, // 20 second timeout
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
            auth: this.token ? { token: this.token } : {}
        });
        
        // Add connection debugging
        this.socket.on('connect', () => {
            console.log('✅ Connected to server!', this.socket.id);
            // Update connection status
            this.updateConnectionStatus('connected');
            // Hide refresh button and connection lost overlay
            this.hideRefreshButton();
            this.hideConnectionLostOverlay();
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            // Update connection status
            this.updateConnectionStatus('disconnected');
            // Show connection lost overlay after a short delay if still not connected
            setTimeout(() => {
                if (!this.socket.connected) {
                    this.showConnectionLostOverlay();
                }
            }, 3000);
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected:', reason);
            
            // Update connection status
            this.updateConnectionStatus('disconnected');
            
            // Show user-friendly notification
            this.showNotification(`Connection lost: ${reason}. Attempting to reconnect...`, 'error');
            
            // Add a timer to show connection lost overlay if reconnection takes too long
            setTimeout(() => {
                if (!this.socket.connected) {
                    this.showConnectionLostOverlay();
                }
            }, 5000); // Wait 5 seconds before showing overlay
            
            // Handle server-initiated disconnects
            if (reason === 'io server disconnect') {
                console.log('Server disconnected us - attempting manual reconnection');
                this.socket.connect();
            }
        });
        
        // Add reconnection event listeners
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Reconnection attempt #${attemptNumber}`);
            this.updateConnectionStatus('connecting');
            this.updateReconnectionStatus(`Reconnection attempt ${attemptNumber}...`);
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`✅ Reconnected after ${attemptNumber} attempts!`);
            this.showNotification('Reconnected successfully! Resuming game...', 'success');
            this.updateConnectionStatus('connected');
            this.hideConnectionLostOverlay();
            
            // If we're in a game, rejoin it
            if (this.gameId && this.playerName) {
                console.log(`Rejoining game ${this.gameId} as ${this.playerName}`);
                this.rejoinGame(this.gameId, this.playerName);
            }
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.error('❌ Reconnection error:', error);
            this.showNotification('Error reconnecting to the server. Will retry...', 'error');
            this.updateConnectionStatus('disconnected');
        });
        
        this.socket.on('reconnect_failed', () => {
            console.error('❌ Failed to reconnect after all attempts');
            this.showNotification('Failed to reconnect after multiple attempts. Please refresh the page.', 'error');
            this.updateConnectionStatus('disconnected');
            this.updateReconnectionStatus('Automatic reconnection failed. Please refresh the game manually.');
        });
        
        this.gameState = null;
        this.previousBoardState = null; // Track previous board state for animations
        this.selectedTiles = [];
        this.playerName = '';
        this.gameId = '';
        this.timerEnabled = false;
        this.turnTimeLimit = 120; // 2 minutes in seconds
        
        // Initialize activity tracking
        this.lastActivityTime = Date.now();
        this.inactivityTimeout = 60000; // 1 minute in milliseconds
        this.inactivityCheckInterval = null;
        
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
        this.lastPlayedSet = null; // Track the last played set for detailed game log
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    // Check if user is authenticated and update UI accordingly
    checkAuthenticationStatus() {
        const loggedInStatus = document.getElementById('loggedInStatus');
        
        if (this.token && this.username) {
            // User is authenticated
            if (loggedInStatus) {
                loggedInStatus.style.display = 'block';
                loggedInStatus.innerHTML = `<i class="fas fa-user-check"></i> Logged in as: <strong>${this.username}</strong>`;
            }
        } else {
            // User is not authenticated, redirect to login
            window.location.href = '/login.html';
        }
    }
    
    // Logout the user
    logout() {
        // Clear any active reconnection timer
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
        
        // Clear all auth-related data from localStorage
        localStorage.removeItem('auth_token');
        localStorage.removeItem('username');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('is_admin');
        
        // Reset client properties
        this.token = null;
        this.username = null;
        
        // Show a notification
        this.showNotification('You have been logged out', 'info');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1000);
    }
    
    initializeEventListeners() {
        // Check authentication status on page load
        this.checkAuthenticationStatus();
        // Game mode selection
        addSafeEventListener('playWithBotBtn', 'click', () => this.selectGameMode('bot'));
        addSafeEventListener('playWithFriendsBtn', 'click', () => this.selectGameMode('multiplayer'));
        
        // Bot game button - with error handling
        addSafeEventListener('startBotGameBtn', 'click', () => {
            console.log('🤖 Start Bot Game button clicked!');
            this.startBotGame();
        });
        
        // Welcome screen events
        addSafeEventListener('createGameBtn', 'click', () => {
            this.initializeSounds(); // Initialize sounds on first user interaction
            this.createGame();
        });
        
        addSafeEventListener('joinGameBtn', 'click', () => {
            this.initializeSounds(); // Initialize sounds on first user interaction
            this.showJoinForm();
        });
        
        addSafeEventListener('joinGameSubmit', 'click', () => {
            this.initializeSounds(); // Initialize sounds on first user interaction
            this.joinGame();
        });
        
        // Game screen events
        addSafeEventListener('startGameBtn', 'click', () => this.startGame());
        addSafeEventListener('drawTileBtn', 'click', () => this.drawTile());
        addSafeEventListener('undoBtn', 'click', () => this.undoLastMove());
        addSafeEventListener('endTurnBtn', 'click', () => this.endTurn());
        addSafeEventListener('leaveGameBtn', 'click', () => this.leaveGame());
        addSafeEventListener('playSetBtn', 'click', () => this.playSelectedTiles());
        addSafeEventListener('refreshGameBtn', 'click', () => this.refreshGameState());
        addSafeEventListener('refreshGamesBtn', 'click', () => this.fetchAvailableGames());
        
        // Game log modal events
        addSafeEventListener('gameLogBtn', 'click', () => this.openGameLogModal());
        addSafeEventListener('closeGameLogBtn', 'click', () => this.closeGameLogModal());
        addSafeEventListener('gameLogModal', 'click', (event) => {
            if (event.target.classList.contains('game-log-scrim')) {
                this.closeGameLogModal();
            }
        });
        
        // Hand sorting events
        addSafeEventListener('sortByColorBtn', 'click', () => this.sortHandByColor());
        addSafeEventListener('sortByNumberBtn', 'click', () => this.sortHandByNumber());
        
        // Game settings modal events
        addSafeEventListener('closeSettingsBtn', 'click', () => this.closeSettingsModal());
        addSafeEventListener('cancelSettingsBtn', 'click', () => this.closeSettingsModal());
        addSafeEventListener('createGameWithSettingsBtn', 'click', () => this.createGameWithSettings());
        addSafeEventListener('gameSettingsModal', 'click', (event) => {
            if (event.target.classList.contains('modal-scrim')) {
                this.closeSettingsModal();
            }
        });
        
        // Enter key events
        addSafeEventListener('gameId', 'keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        
        // Track user activity on any interaction
        document.addEventListener('click', () => this.resetInactivityTimer());
        document.addEventListener('keydown', () => this.resetInactivityTimer());
        document.addEventListener('mousemove', () => this.resetInactivityTimer());
        document.addEventListener('touchstart', () => this.resetInactivityTimer());
        
        // Copy game ID to clipboard
        addSafeEventListener('copyGameIdBtn', 'click', () => {
            const gameId = safeGetElementById('currentGameId')?.textContent;
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

    initializeSocketListeners() {
        this.socket.on('gameCreated', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showGameScreen();
            this.updateGameState();
            this.showNotification(`Game created! Share code: ${data.gameId}`, 'success');
            
            // Save game info to localStorage
            this.saveGameStateToStorage();
            
            // Start tracking activity
            this.startInactivityCheck();
        });

        this.socket.on('gameJoined', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showGameScreen();
            this.updateGameState();
            this.showNotification('Joined game successfully!', 'success');
            
            // Save game info to localStorage
            this.saveGameStateToStorage();
            
            // Start tracking activity
            this.startInactivityCheck();
        });

        this.socket.on('botGameCreated', (data) => {
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            this.showGameScreen();
            this.updateGameState();
            this.showNotification(`Game with bots created! Game code: ${data.gameId}`, 'success');
            
            // Save game info to localStorage
            this.saveGameStateToStorage();
            
            // Start tracking activity
            this.startInactivityCheck();
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
            // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
            const previousHandSize = this.gameState?.playerHand?.length || 0;
            const newHandSize = data.gameState?.playerHand?.length || 0;
            const previousHandIds = this.gameState?.playerHand?.map(t => t.id) || [];
            const newHandIds = data.gameState?.playerHand?.map(t => t.id) || [];
            
            console.log('🐛 [DEBUG] gameStateUpdate received:', {
                handSizeChange: `${previousHandSize} → ${newHandSize}`,
                handIdsChanged: !previousHandIds.every(id => newHandIds.includes(id)) || !newHandIds.every(id => previousHandIds.includes(id)),
                previousHandIds,
                newHandIds
            });
            
            if (previousHandSize === 0 && newHandSize > 0) {
                console.log('🚨 [DEBUG] POTENTIAL DUPLICATION: Hand was empty, now has tiles!');
                console.log('🚨 [DEBUG] Restored tiles:', newHandIds);
            }
            // 🐛 END DEBUG LOGGING
            
            // Store the previous board state before updating
            if (this.gameState && this.gameState.board) {
                this.previousBoardState = JSON.parse(JSON.stringify(this.gameState.board));
            }
            
            this.gameState = data.gameState;
            this.updateGameState();
            
            // Reset inactivity timer whenever we get a game state update
            this.resetInactivityTimer();
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
            // Store the last played set for detailed game log
            if (data.playedTiles && data.playedTiles.length > 0) {
                this.lastPlayedSet = data.playedTiles;
            } else if (data.gameState && data.gameState.lastPlayedSet) {
                this.lastPlayedSet = data.gameState.lastPlayedSet;
            }
            
            // Sort the board sets before updating the game state
            if (data.gameState && data.gameState.board) {
                this.sortAllBoardSets(data.gameState.board);
            }
            
            this.gameState = data.gameState;
            this.hasPlayedTilesThisTurn = true; // Mark that tiles have been played this turn
            this.updateGameState();
            this.clearSelection();
            this.showNotification('Set played successfully!', 'success');
        });

        this.socket.on('tileDrawn', (data) => {
            this.gameState = data.gameState;
            
            // Force update of buttons based on server-provided turn info
            const isMyTurnNow = data.isYourTurn || (data.currentPlayerId === this.socket.id);
            console.log(`🎮 Tile drawn - isMyTurnNow: ${isMyTurnNow}, currentPlayerId: ${data.currentPlayerId}`);
            
            this.updateGameState();
            
            // Explicitly update action buttons after state update
            this.updateActionButtons();
            
            this.showNotification('Tile drawn', 'info');
        });

        this.socket.on('turnEnded', (data) => {
            this.gameState = data.gameState;
            this.hasPlayedTilesThisTurn = false; // Reset for new turn
            this.hasBoardChanged = false; // Reset board change flag for new turn
            
            // Force update of buttons based on server-provided turn info
            const isMyTurnNow = data.isYourTurn || (data.currentPlayerId === this.socket.id);
            console.log(`🎮 Turn ended - isMyTurnNow: ${isMyTurnNow}, currentPlayerId: ${data.currentPlayerId}`);
            
            this.updateGameState();
            
            // Explicitly update action buttons after state update
            this.updateActionButtons();
        });

        this.socket.on('messageReceived', (data) => {
            // Chat functionality has been removed
            console.log('Chat functionality has been removed');
        });

        this.socket.on('gameWon', (data) => {
            this.gameState = data.gameState;
            this.updateGameState();
            // Clear game info from storage since the game is over
            this.clearGameStateFromStorage();
            this.showVictoryCelebration(data.winner.name);
        });

        this.socket.on('error', (data) => {
            // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
            console.log('🐛 [DEBUG] Server error received:', {
                message: data.message,
                currentHandSize: this.gameState?.playerHand?.length || 0
            });
            // 🐛 END DEBUG LOGGING
            
            this.showNotification(data.message, 'error');
        });

        this.socket.on('disconnect', () => {
            this.showNotification('Connection lost. Reconnecting...', 'error');
            // Stop any timers when disconnected
            this.clearTimer();
            
            // Show the refresh button when disconnected
            this.showRefreshButton();
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
            
            // Initialize the previous board state (empty for a new game)
            this.previousBoardState = [];
            
            this.gameId = data.gameId;
            this.gameState = data.gameState;
            console.log('📺 Calling showGameScreen()...');
            this.showGameScreen();
            console.log('🔄 Calling updateGameState()...');
            this.updateGameState();
            this.showNotification('Bot game started!', 'success');
            
            // Start inactivity checking
            this.startInactivityCheck();
        });

        this.socket.on('botMove', (data) => {
            // Store the previous board state before updating
            if (this.gameState && this.gameState.board) {
                this.previousBoardState = JSON.parse(JSON.stringify(this.gameState.board));
            }
            
            this.gameState = data.gameState;
            
            // Check if it's now the player's turn and reset hasPlayedTilesThisTurn
            const isNowMyTurn = this.isMyTurn();
            if (isNowMyTurn) {
                this.hasPlayedTilesThisTurn = false;
            }
            
            this.updateGameState();
            this.showNotification(`Bot played: ${data.moveDescription}`, 'info');
            
            // Reset inactivity timer on bot move
            this.resetInactivityTimer();
        });

        // Board management events
        this.socket.on('boardUpdated', (data) => {
            // Store the previous board state before updating
            if (this.gameState && this.gameState.board) {
                this.previousBoardState = JSON.parse(JSON.stringify(this.gameState.board));
            }
            
            // Sort the board sets before updating the game state
            if (data.gameState && data.gameState.board) {
                this.sortAllBoardSets(data.gameState.board);
            }
            
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
            
            // Sort the board sets before updating the game state
            if (data.gameState && data.gameState.board) {
                this.sortAllBoardSets(data.gameState.board);
            }
            
            this.gameState = data.gameState;
            
            // If turn changed from me to someone else, clear any selections
            if (wasMyTurn && !this.isMyTurn()) {
                this.selectedTiles = [];
            }
            
            this.updateGameState();
            
            // Check if board has been restored to its original state (happens after undo)
            // This needs to be after updateGameState since it depends on the updated state
            if (this.isMyTurn()) {
                this.hasBoardStateChanged(); // This will now reset hasPlayedTilesThisTurn if board matches snapshot
            }
        });
    }

    selectGameMode(mode) {
        this.gameMode = mode;
        
        // Reset all button states first
        document.querySelectorAll('.btn-mode').forEach(btn => btn.classList.remove('active'));
        
        // Clear any existing games refresh interval when changing modes
        if (this.gamesRefreshInterval) {
            clearInterval(this.gamesRefreshInterval);
            this.gamesRefreshInterval = null;
        }
        
        // Hide both option panels initially
        document.getElementById('multiplayerOptions').classList.add('hidden');
        document.getElementById('botGameOptions').classList.add('hidden');
        
        if (mode === 'bot') {
            document.getElementById('playWithBotBtn').classList.add('active');
            document.getElementById('botGameOptions').classList.remove('hidden');
        } else if (mode === 'multiplayer') {
            document.getElementById('playWithFriendsBtn').classList.add('active');
            document.getElementById('multiplayerOptions').classList.remove('hidden');
            
            // Fetch available games when selecting multiplayer mode
            this.fetchAvailableGames();
        }
    }
    
    fetchAvailableGames() {
        const backendUrl = this.socket.io.uri;
        const gamesListContainer = document.getElementById('gamesList');
        
        // Clear any existing auto-refresh interval
        if (this.gamesRefreshInterval) {
            clearInterval(this.gamesRefreshInterval);
            this.gamesRefreshInterval = null;
        }
        
        if (gamesListContainer) {
            gamesListContainer.innerHTML = '<div class="loading-games"><i class="fas fa-spinner fa-spin"></i> Loading available games...</div>';
            
            // Function to fetch and update the games list
            const fetchAndUpdateGames = () => {
                // Only fetch if the multiplayer options are still visible
                if (document.getElementById('multiplayerOptions').classList.contains('hidden')) {
                    if (this.gamesRefreshInterval) {
                        clearInterval(this.gamesRefreshInterval);
                        this.gamesRefreshInterval = null;
                    }
                    return;
                }
                
                fetch(`${backendUrl}/api/games`)
                    .then(response => response.json())
                    .then(data => {
                        // The server returns { games: [...] }, so we need to extract the games array
                        const gamesList = data.games || [];
                        this.renderGamesList(gamesList);
                    })
                    .catch(error => {
                        console.error('Error fetching games:', error);
                        // Only show error if this is the first load
                        if (!this.hasLoadedGamesList) {
                            gamesListContainer.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Could not load games. Please try again.</div>';
                        }
                    });
            };
            
            // Initial fetch
            fetchAndUpdateGames();
            this.hasLoadedGamesList = true;
            
            // Set up auto-refresh every 10 seconds
            this.gamesRefreshInterval = setInterval(fetchAndUpdateGames, 10000);
        }
    }
    
    renderGamesList(games) {
        const gamesListContainer = document.getElementById('gamesList');
        if (!gamesListContainer) return;
        
        // Clear previous content
        gamesListContainer.innerHTML = '';
        
        if (games.length === 0) {
            gamesListContainer.innerHTML = '<div class="no-games-message"><i class="fas fa-info-circle"></i> No games available. Create a new one!</div>';
            return;
        }
        
        // Create a list of games
        const gamesList = document.createElement('ul');
        gamesList.className = 'games-list';
        
        games.forEach(game => {
            const gameItem = document.createElement('li');
            gameItem.className = 'game-item';
            
            // Calculate time since creation
            const createdTime = new Date(game.createdAt);
            const timeAgo = this.getTimeAgo(createdTime);
            
            // Check if the game is active
            const isActiveGame = game.status === 'ACTIVE';
            
            // Build the game item HTML with conditional button/status based on game state
            const itemHTML = `
                <div class="game-item-info">
                    <div class="game-host">
                        <i class="fas fa-user"></i> ${game.host}
                        ${isActiveGame ? '<span class="game-status-badge active">Active</span>' : ''}
                    </div>
                    <div class="game-details">
                        <span class="player-count"><i class="fas fa-users"></i> ${game.playerCount}/4</span>
                        <span class="game-time"><i class="fas fa-clock"></i> ${timeAgo}</span>
                    </div>
                </div>
            `;
            
            gameItem.innerHTML = itemHTML;
            
            // Add join button only for games that aren't active
            if (!isActiveGame) {
                const joinButton = document.createElement('button');
                joinButton.className = 'btn btn-join-game';
                joinButton.setAttribute('data-game-id', game.id);
                joinButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join';
                
                joinButton.addEventListener('click', (e) => {
                    const gameId = e.currentTarget.getAttribute('data-game-id');
                    // Auto-fill the game ID in the join form
                    document.getElementById('gameId').value = gameId;
                    this.joinGame();
                });
                
                gameItem.appendChild(joinButton);
            } else {
                // For active games, show a disabled button with "In Progress" text
                const statusButton = document.createElement('button');
                statusButton.className = 'btn btn-secondary btn-in-progress';
                statusButton.disabled = true;
                statusButton.innerHTML = '<i class="fas fa-hourglass-half"></i> In Progress';
                gameItem.appendChild(statusButton);
            }
            
            gamesList.appendChild(gameItem);
        });
        
        gamesListContainer.appendChild(gamesList);
    }
    
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    startBotGame() {
        console.log('🎯 startBotGame() called');
        // Use authenticated username instead of form input
        const playerName = this.username;
        console.log('👤 Player name:', playerName);
        
        if (!playerName) {
            this.showNotification('Please log in to play', 'error');
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
        // Use the authenticated username
        const playerName = this.username;
        if (!playerName) {
            this.showNotification('Please log in first', 'error');
            return;
        }
        
        // Show the settings modal instead of creating the game immediately
        this.playerName = playerName;
        this.openSettingsModal();
    }

    showJoinForm() {
        const joinForm = document.getElementById('joinGameForm');
        joinForm.classList.toggle('hidden');
        if (!joinForm.classList.contains('hidden')) {
            document.getElementById('gameId').focus();
        }
    }

    joinGame() {
        // Use the authenticated username
        const playerName = this.username;
        const gameId = document.getElementById('gameId').value.trim().toUpperCase();
        
        if (!playerName) {
            this.showNotification('Please log in to play', 'error');
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
        
        // Check if there are tiles left in the deck
        if (this.gameState && this.gameState.deckSize === 0) {
            this.showNotification("No tiles left in the deck!", 'warning');
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
        this.hasPlayedTilesThisTurn = false; // Reset this flag to allow drawing after an undo
        
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
        
        // If the board has been restored to its original state (matches the snapshot),
        // reset the hasPlayedTilesThisTurn flag to allow drawing again
        if (!hasChanged && this.hasPlayedTilesThisTurn) {
            this.hasPlayedTilesThisTurn = false;
            // Update buttons since we've changed a flag that affects them
            this.updateActionButtons();
        }
        
        return hasChanged;
    }

    leaveGame() {
        if (confirm('Are you sure you want to leave the game?')) {
            // Clear game info from storage
            this.clearGameStateFromStorage();
            
            // Stop inactivity check
            this.stopInactivityCheck();
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
        
        // Check if player hasn't played initial yet
        const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
        const needsInitialPlay = currentPlayer && !currentPlayer.hasPlayedInitial;
        
        // For sets with 6+ tiles, check for multiple sets first
        if (selectedTileObjects.length >= 6) {
            const multipleSets = this.detectMultipleSets(this.selectedTiles);
            
            if (multipleSets.length > 1) {
                console.log(`[INFO] Detected ${multipleSets.length} potential sets - validating each set separately`);
                
                // Validate each set individually
                const validSets = [];
                let allSetsValid = true;
                
                // For each detected set, validate it
                for (const setIds of multipleSets) {
                    const setTiles = setIds.map(id => 
                        this.gameState.playerHand.find(tile => tile.id === id)
                    ).filter(Boolean);
                    
                    // Check if this individual set is valid
                    const isSetValid = this.isValidRunClient(setTiles) || this.isValidGroupClient(setTiles);
                    
                    if (isSetValid) {
                        validSets.push(setIds);
                    } else {
                        allSetsValid = false;
                        console.log(`[ERROR] Invalid set found among multiple sets`);
                        break;
                    }
                }
                
                if (allSetsValid && validSets.length > 1) {
                    // All sets are valid - proceed with initial play check if needed
                    if (needsInitialPlay) {
                        // Calculate the combined value of all sets for initial play
                        let totalValue = 0;
                        
                        // For each detected set, get the tile objects and calculate the value
                        for (const setIds of validSets) {
                            const setTiles = setIds.map(id => 
                                this.gameState.playerHand.find(tile => tile.id === id)
                            ).filter(Boolean);
                            
                            // Add the value of this set to the total
                            totalValue += this.calculateSetValueClient(setTiles);
                        }
                        
                        console.log(`[INFO] Initial play with multiple sets - total value: ${totalValue} points`);
                        
                        // Check if the combined value meets the 30-point requirement
                        if (totalValue < 30) {
                            this.showNotification(`Initial play must be at least 30 points (current: ${totalValue})`, 'error');
                            return;
                        }
                        
                        // Show multiple sets detected notification
                        const tileCount = validSets.reduce((sum, set) => sum + set.length, 0);
                        this.showNotification(`Playing ${validSets.length} valid sets (${tileCount} tiles total, ${totalValue} points) for initial play`, 'success');
                        
                        // Send multiple sets for initial play validation
                        this.socket.emit('playSet', { setArrays: validSets });
                        console.log(`🎯 Playing ${validSets.length} sets for initial play:`, validSets);
                        return;
                    } else {
                        // Not initial play, but we have valid multiple sets
                        // We should still allow playing multiple sets at once
                        this.socket.emit('playSet', { setArrays: validSets });
                        console.log(`🎯 Playing ${validSets.length} sets:`, validSets);
                        return;
                    }
                }
            }
        }
        
        // If we get here, validate as a single set
        const isRun = this.isValidRunClient(selectedTileObjects);
        const isGroup = this.isValidGroupClient(selectedTileObjects);
        const isValid = isRun || isGroup;
        
        if (!isValid) {
            this.validateAndDebugSet(selectedTileObjects);
            console.log(`[ERROR] Invalid set rejected by client validation`);
            return; // Don't send invalid sets to server
        }
        
        // For initial play, check if we need to meet the 30-point threshold
        if (needsInitialPlay) {
            // Calculate set value
            const pointValue = this.calculateSetValueClient(selectedTileObjects);
            console.log(`[INFO] Initial play set value: ${pointValue} points`);
            
            if (pointValue < 30) {
                this.showNotification(`Initial play must be at least 30 points (current: ${pointValue})`, 'error');
                return;
            }
        }
        
        // If we got here, it's a valid single set
        this.validateAndDebugSet(selectedTileObjects);
        
        // Just send the tile IDs for a single set
        this.socket.emit('playSet', { tileIds: this.selectedTiles });
    }
    
    validateAndDebugSet(tiles) {
        // Check if this selection is a valid set
        const isRun = this.isValidRunClient(tiles);
        const isGroup = this.isValidGroupClient(tiles);
        const isValid = isRun || isGroup;
        
        // Detailed diagnostic info for joker sets
        const jokerCount = tiles.filter(t => t.isJoker).length;
        const nonJokers = tiles.filter(t => !t.isJoker);
        
        // Create detailed debug info
        const tileInfo = tiles.map(t => {
            if (t.isJoker) return "JOKER";
            return `${t.number}${t.color[0]}`;
        }).join(', ');
        
        // Log detailed diagnostic information for joker groups
        if (jokerCount > 0 && isGroup) {
            const numbers = nonJokers.map(t => t.number);
            const colors = nonJokers.map(t => t.color);
            console.log(`🃏 Joker group diagnostic:`, {
                nonJokerNumbers: numbers,
                nonJokerColors: colors,
                jokerCount: jokerCount,
                numbersSet: new Set(numbers).size,
                colorsSet: new Set(colors).size,
                isValidClientSide: isGroup
            });
        }
        
        // Check if this could be multiple sets instead
        if (!isValid && tiles.length >= 6) {
            // See if we can detect multiple valid sets
            const tileIds = tiles.map(t => t.id);
            const multipleSets = this.detectMultipleSets(tileIds);
            
            if (multipleSets.length > 1) {
                // Found multiple valid sets!
                this.showNotification(`Detected ${multipleSets.length} valid sets within selection`, 'success');
                return;
            }
        }
        
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
    
    calculateSetValueClient(tiles) {
        let totalValue = 0;
        const nonJokerTiles = tiles.filter(t => !t.isJoker);
        const jokerCount = tiles.filter(t => t.isJoker).length;
        
        if (this.isValidGroupClient(tiles)) {
            // For a group, all tiles have the same number value (including jokers)
            if (nonJokerTiles.length > 0) {
                const groupNumber = nonJokerTiles[0].number;
                // All tiles (including jokers) are worth the group number
                totalValue = groupNumber * tiles.length;
            }
        } else if (this.isValidRunClient(tiles)) {
            // For a run, add up all the numbers
            // For jokers, estimate their values based on the sequence
            const nonJokers = tiles.filter(t => !t.isJoker).sort((a, b) => a.number - b.number);
            
            if (jokerCount === 0) {
                // Simple case - just sum the numbers
                totalValue = nonJokers.reduce((sum, tile) => sum + tile.number, 0);
            } else {
                // With jokers - need to estimate the joker values
                // This is a simplified version for client-side estimation
                if (nonJokers.length > 0) {
                    // For runs with jokers, we'll use the average value of non-jokers as an estimate
                    const nonJokerSum = nonJokers.reduce((sum, tile) => sum + tile.number, 0);
                    const avgValue = nonJokerSum / nonJokers.length;
                    totalValue = nonJokerSum + (jokerCount * Math.round(avgValue));
                }
            }
        }
        
        return totalValue;
    }

    clearSelection() {
        this.selectedTiles = [];
        document.querySelectorAll('.tile.selected').forEach(tile => {
            tile.classList.remove('selected');
        });
        this.updatePlayButton();
        this.updateActionButtons(); // Update all buttons, including enabling the draw button
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
        // Chat functionality has been removed
        console.log('Chat functionality has been removed');
    }

    isMyTurn() {
        // Rate limiting to prevent infinite loops
        const now = Date.now();
        if (!this.lastTurnCheck) this.lastTurnCheck = 0;
        if (now - this.lastTurnCheck < 10) {
            // Too many calls in short time, return cached result
            return this.cachedTurnResult || false;
        }
        this.lastTurnCheck = now;
        
        if (!this.gameState || !this.gameState.started || !this.socket) {
            console.log(`❌ Not my turn: gameState=${!!this.gameState}, started=${this.gameState?.started}, socket=${!!this.socket}`);
            this.cachedTurnResult = false;
            return false;
        }
        
        if (!this.gameState.players || this.gameState.players.length === 0) {
            console.log(`❌ Not my turn: no players in game state`);
            this.cachedTurnResult = false;
            return false;
        }
        
        const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        if (!currentPlayer) {
            console.log(`❌ Not my turn: no current player at index ${this.gameState.currentPlayerIndex}`);
            this.cachedTurnResult = false;
            return false;
        }
        
        const result = currentPlayer.id === this.socket.id;
        
        // Add throttling to prevent spam logging
        const currentTime = Date.now();
        if (!this.lastTurnCheckLog || currentTime - this.lastTurnCheckLog > 1000) {
            console.log(`🔍 Turn check: currentPlayer=${currentPlayer.name} (${currentPlayer.id}), myId=${this.socket.id}, isMyTurn=${result}, index=${this.gameState.currentPlayerIndex}`);
            this.lastTurnCheckLog = currentTime;
        }
        
        this.cachedTurnResult = result;
        return result;
    }
    
    // Show turn notification when it becomes the player's turn
    showTurnNotification(playerName) {
        // Check if it's the player's turn
        const isMyTurn = playerName === this.getMyName();
        
        // Update the player name in the notification
        const nameElement = document.getElementById('turnNotificationPlayerName');
        nameElement.textContent = isMyTurn ? "Your Turn!" : `${playerName}'s Turn!`;
        
        console.log(`🎮 Showing turn notification for: ${playerName}`);
        
        // Get the overlay element and card element
        const overlay = document.getElementById('turnNotificationOverlay');
        const card = document.querySelector('.turn-notification-card');
        
        // Update the icon based on whose turn it is
        const iconElement = document.querySelector('.notification-icon i');
        if (iconElement) {
            // Use a star icon for player's turn, and regular play icon for others
            iconElement.className = isMyTurn ? 'fas fa-star' : 'fas fa-play-circle';
        }
        
        // Add or remove the "my-turn" class based on whose turn it is
        if (card) {
            if (isMyTurn) {
                card.classList.add('my-turn');
            } else {
                card.classList.remove('my-turn');
            }
        }
        
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
        
        // Load leaderboard when showing welcome screen
        this.loadLeaderboard();
    }

    showGameScreen() {
        console.log('📺 showGameScreen() called');
        this.hideAllScreens();
        console.log('📺 Showing game screen...');
        document.getElementById('gameScreen').classList.add('active');
        console.log('📺 Game screen should now be visible');
        
        // Clear any existing games refresh interval when starting a game
        if (this.gamesRefreshInterval) {
            clearInterval(this.gamesRefreshInterval);
            this.gamesRefreshInterval = null;
        }
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
    
    refreshGameState() {
        if (!this.gameId) {
            this.showNotification('No active game to refresh', 'error');
            return;
        }
        
        // Show loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100%';
        loadingOverlay.style.height = '100%';
        loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.zIndex = '9999';
        loadingOverlay.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
                <div><i class="fas fa-sync fa-spin" style="font-size: 30px; color: #667eea; margin-bottom: 15px;"></i></div>
                <div style="font-weight: bold;">Refreshing game state...</div>
                <div style="margin-top: 10px; font-size: 14px; color: #718096;">Please wait...</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        
        console.log('🔄 Requesting fresh game state for game:', this.gameId);
        this.socket.emit('getGameState', { gameId: this.gameId });
        
        this.showNotification('Refreshing game state...', 'info');
        
        // Hide the refresh button
        this.hideRefreshButton();
        
        // Reset the inactivity timer
        this.resetInactivityTimer();
        
        // Set a timeout to remove the loading overlay after a short delay
        setTimeout(() => {
            document.body.removeChild(loadingOverlay);
            this.showNotification('Game state refreshed!', 'success');
        }, 2000);
    }

    updateGameState() {
        if (!this.gameState) {
            console.warn('⚠️ Cannot update game state: gameState is null');
            return;
        }
        
        try {
            // Update game ID
            const currentGameIdElement = document.getElementById('currentGameId');
            if (currentGameIdElement) {
                currentGameIdElement.textContent = this.gameId;
            }
            
            // Update players list
            this.renderPlayersList();
            
            // Update current turn
            this.updateCurrentTurn();
            
            // Update deck count
            const deckCountElement = document.getElementById('deckCount');
            if (deckCountElement) {
                deckCountElement.textContent = this.gameState.deckSize || 106;
            }
            
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
                    
                    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
                    // Handle hand changes while preserving user's tile arrangement
                    if (!this.tileGridLayout) {
                        // No grid exists - create initial layout
                        this.initializeGridLayout();
                    } else if (this.needsGridExpansion) {
                        // Grid needs to grow - preserve existing positions
                        this.expandGridLayout();
                        this.needsGridExpansion = false;
                    } else if (handSize < lastKnownSize) {
                        // Tiles were played - remove them while preserving positions
                        this.updateGridLayoutAfterTilesPlayed();
                    } else {
                        // Fallback for other changes - preserve positions where possible
                        this.syncGridLayoutWithGameState();
                    }
                }
                
                // Update last known hand size
                this.lastKnownHandSize = handSize;
            }
            
            // Update player hand
            this.renderPlayerHand();
            
            // Update game board
            this.renderGameBoard();
            
            // Update game log
            this.updateGameLog(this.gameState.gameLog);
            
            // Show/hide start button
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn) {
                if (this.gameState.started) {
                    startBtn.classList.add('hidden');
                } else if (this.gameState.players.length >= 2) {
                    startBtn.classList.remove('hidden');
                }
            }
            
            // Update action buttons
            this.updateActionButtons();
        } catch (error) {
            console.error('❌ Error updating game state:', error);
        }
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
        if (!playersList) {
            console.warn('⚠️ PlayersList element not found');
            return;
        }
        
        if (!this.gameState || !this.gameState.players) {
            console.warn('⚠️ No game state or players available');
            return;
        }
        
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
        try {
            const handElement = document.getElementById('playerHand');
            if (!handElement) {
                console.warn('⚠️ Player hand element not found');
                return;
            }
            
            console.log(`🎯 renderPlayerHand() called with ${this.gameState?.playerHand?.length || 0} tiles`);
            console.log(`🃏 Tiles to render:`, this.gameState?.playerHand?.slice(0, 5)?.map(t => `${t.isJoker ? 'JOKER' : t.number + t.color[0]}`));
            console.log(`🆔 First 3 tile IDs:`, this.gameState?.playerHand?.slice(0, 3)?.map(t => t.id));
            
            if (!this.gameState?.playerHand || this.gameState.playerHand.length === 0) {
                console.log(`⚠️ Skipping render - no tiles to display`);
                // 🐛 FIX: Always clear the hand element when there are no tiles to prevent ghost tiles
                // This fixes the last tile duplication visual bug
                if (!this.gameState?.started) {
                    handElement.innerHTML = '<div class="hand-placeholder"><p>Your tiles will appear here when the game starts</p></div>';
                } else {
                    // Game is started but hand is empty - clear any remaining tile elements
                    handElement.innerHTML = '';
                    console.log(`🧹 Cleared hand display - game started with 0 tiles`);
                }
                return;
            }
            
            console.log(`✅ Proceeding with hand render for ${this.gameState.playerHand.length} tiles`);
            handElement.innerHTML = '';
            
            // Dynamic grid sizing based on number of tiles
            const totalTiles = this.gameState.playerHand.length;
            const tilesPerRow = 10; // Updated from 7 to 10 tiles per row
            
            // Calculate rows needed: start with 3 rows (30 slots), add more only when needed
            let rowsNeeded = 3; // Default to 3 rows (30 slots)
            if (totalTiles > 30) {
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
                        // Create empty slot for drag-and-drop target
                        const emptySlot = document.createElement('div');
                        emptySlot.className = 'empty-slot';
                        emptySlot.dataset.slotIndex = i;
                        
                        // Calculate grid position
                        const row = Math.floor(i / tilesPerRow) + 1;
                        const col = (i % tilesPerRow) + 1;
                        emptySlot.style.gridRow = row;
                        emptySlot.style.gridColumn = col;
                        
                        // Add drop functionality
                        this.addDropFunctionalityToSlot(emptySlot, i);
                        
                        handElement.appendChild(emptySlot);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error rendering player hand:', error);
        }
    }

    initializeGridLayout(maxSlots = null) {
        // Calculate dynamic grid size based on current hand
        const handSize = this.gameState?.playerHand?.length || 0;
        const tilesPerRow = 10; // Updated from 7 to 10 tiles per row
        
        console.log(`🔧 initializeGridLayout() called with handSize=${handSize}, maxSlots=${maxSlots}`);
        
        let gridSize;
        if (maxSlots) {
            gridSize = maxSlots;
        } else if (handSize <= 30) {
            gridSize = 30; // Start with 3 rows (30 slots) for normal gameplay
        } else {
            // Only expand beyond 30 when we actually have more than 30 tiles
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

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    updateGridLayoutAfterTilesPlayed() {
        // Remove played tiles from grid while preserving positions of remaining tiles
        if (!this.tileGridLayout || !this.gameState?.playerHand) return;
        
        // Create a set of current tile IDs for quick lookup
        const currentTileIds = new Set(this.gameState.playerHand.map(t => t.id));
        
        // Remove tiles that are no longer in the hand, keep others in their positions
        for (let i = 0; i < this.tileGridLayout.length; i++) {
            const tile = this.tileGridLayout[i];
            if (tile && !currentTileIds.has(tile.id)) {
                // This tile was played - remove it but keep the empty slot
                this.tileGridLayout[i] = null;
            }
        }
        
        console.log('🎯 Updated grid layout after tiles played - preserved positions');
    }

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    expandGridLayout() {
        // Expand grid while preserving existing tile positions
        const currentCapacity = this.tileGridLayout ? this.tileGridLayout.length : 0;
        const handSize = this.gameState?.playerHand?.length || 0;
        const tilesPerRow = 10;
        
        // Calculate new grid size
        const newGridSize = Math.ceil(handSize / tilesPerRow) * tilesPerRow;
        
        if (newGridSize > currentCapacity) {
            // Expand the grid array while preserving existing positions
            const oldLayout = this.tileGridLayout || [];
            this.tileGridLayout = new Array(newGridSize).fill(null);
            
            // Copy existing tiles to their same positions
            for (let i = 0; i < oldLayout.length; i++) {
                this.tileGridLayout[i] = oldLayout[i];
            }
            
            console.log(`🔧 Expanded grid from ${currentCapacity} to ${newGridSize} slots`);
        }
    }

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    syncGridLayoutWithGameState() {
        // Sync grid with gameState while trying to preserve positions where possible
        if (!this.gameState?.playerHand) return;
        
        // If no grid exists, create it
        if (!this.tileGridLayout) {
            this.initializeGridLayout();
            return;
        }
        
        const currentTileIds = new Set(this.gameState.playerHand.map(t => t.id));
        const existingTileIds = new Set();
        
        // First pass: remove tiles that are no longer in hand
        for (let i = 0; i < this.tileGridLayout.length; i++) {
            const tile = this.tileGridLayout[i];
            if (tile) {
                if (currentTileIds.has(tile.id)) {
                    existingTileIds.add(tile.id);
                } else {
                    // Remove tile that's no longer in hand
                    this.tileGridLayout[i] = null;
                }
            }
        }
        
        // Second pass: add new tiles to empty slots
        const newTiles = this.gameState.playerHand.filter(tile => !existingTileIds.has(tile.id));
        newTiles.forEach(tile => {
            // Find first empty slot for new tile
            const emptySlotIndex = this.tileGridLayout.findIndex(slot => slot === null);
            if (emptySlotIndex !== -1) {
                this.tileGridLayout[emptySlotIndex] = tile;
            }
        });
        
        console.log('🔄 Synced grid layout with game state - preserved existing positions');
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
        
        // We're no longer showing the drop indicator as per requirements
        // This method is kept for compatibility but doesn't create visual indicators
        
        const tile = targetElement.closest('.tile');
        if (!tile) return;
        
        const rect = tile.getBoundingClientRect();
        const isLeftHalf = clientX < rect.left + rect.width / 2;
        
        // Add a class to the parent to show it's a drop target
        const parent = tile.parentNode;
        if (parent) {
            parent.classList.add('drag-target');
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
        const boardElement = safeGetElementById('gameBoard');
        
        if (!boardElement) {
            console.error('❌ Cannot render game board: board element not found');
            return;
        }
        
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
        
        // Sort all sets on the board before rendering
        this.sortAllBoardSets(this.gameState.board);
        
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
        
        // Check if this is not my turn and we have a previous board state to compare with
        const shouldAnimateNewTiles = !this.isMyTurn() && this.previousBoardState !== null;
        
        // Keep track of new tiles found to play sound effect
        let newTilesFound = false;
        
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
                
                // Animate new tiles if we're not on our turn
                if (shouldAnimateNewTiles) {
                    const isNewTile = this.isNewlyAddedTile(tile, setIndex, tileIndex);
                    if (isNewTile) {
                        tileElement.classList.add('animate-new-tile');
                        newTilesFound = true;
                    }
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
        
        // Play a sound for new tiles if any were found
        if (shouldAnimateNewTiles && newTilesFound) {
            this.playSound('newTilePlaced');
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
            this.playSound('pickupTile');
        } else {
            this.selectedTiles.splice(index, 1);
            tileElement.classList.remove('selected');
            this.playSound('placeTile');
        }
        
        this.updatePlayButton();
        this.updateActionButtons(); // Update all action buttons to disable the draw button when tiles are selected
    }

    updatePlayButton() {
        const playButton = document.getElementById('playSetBtn');
        const count = this.selectedTiles.length;
        
        if (count === 0) {
            playButton.innerHTML = '<i class="fas fa-play"></i> Play Selected';
            playButton.style.opacity = '0.5';
            playButton.setAttribute('disabled', 'disabled');
        } else {
            playButton.innerHTML = `<i class="fas fa-play"></i> Play Selected (${count})`;
            
            // Only enable if it's the player's turn and the game has started
            if (this.isMyTurn() && this.gameState && this.gameState.started) {
                playButton.style.opacity = '1';
                playButton.removeAttribute('disabled');
            }
        }
    }

    updateActionButtons() {
        const isMyTurn = this.isMyTurn();
        const gameStarted = this.gameState && this.gameState.started;
        const canAct = isMyTurn && gameStarted;
        const noTilesLeft = this.gameState && this.gameState.deckSize === 0;
        
        // Always check if board state has changed
        this.hasBoardStateChanged();
        
        // Draw Tile button - disable if:
        // 1. Tiles have been played this turn
        // 2. No tiles left in the deck
        // 3. Tiles are selected (for Play Selected functionality)
        // Note: Board state changes should not prevent drawing if no new tiles have been played
        const drawBtn = document.getElementById('drawTileBtn');
        if (drawBtn) {
            const hasTilesSelected = this.selectedTiles && this.selectedTiles.length > 0;
            const canDrawTile = canAct && !this.hasPlayedTilesThisTurn && !noTilesLeft && !hasTilesSelected;
            
            // If no tiles are left, add a visual indication
            if (noTilesLeft) {
                drawBtn.style.opacity = '0.5';
                drawBtn.title = 'No tiles left in the deck';
            } else if (hasTilesSelected) {
                drawBtn.style.opacity = '0.5';
                drawBtn.title = 'Cannot draw while tiles are selected';
            } else if (this.hasPlayedTilesThisTurn) {
                drawBtn.style.opacity = '0.5';
                drawBtn.title = 'Cannot draw after playing tiles this turn';
            } else {
                drawBtn.style.opacity = canDrawTile ? '1' : '0.5';
                drawBtn.title = canDrawTile ? 'Draw a tile' : 'Cannot draw a tile right now';
            }
            
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
            const hasTilesSelected = this.selectedTiles && this.selectedTiles.length > 0;
            const canPlaySet = canAct && hasTilesSelected;
            
            playBtn.style.opacity = canPlaySet ? '1' : '0.5';
            playBtn.disabled = !canPlaySet;
            if (canPlaySet) {
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
        // Chat functionality has been removed
        console.log('Chat functionality has been removed');
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
                    // Enhanced details for played sets
                    const match = entry.details.match(/(\d+) tiles \((\d+) points\)/);
                    if (match) {
                        const [_, tileCount, points] = match;
                        let tileInfo = '';
                        
                        // If this set was played when a player last took their turn, try to describe the tiles
                        if (this.lastPlayedSet && this.lastPlayedSet.length > 0) {
                            tileInfo = this.describeTileSet(this.lastPlayedSet);
                            // Clear after use to avoid incorrect descriptions for future logs
                            this.lastPlayedSet = null;
                        }
                        
                        actionText = `played a set with ${tileCount} tiles (${points} points)${tileInfo ? ': ' + tileInfo : ''}`;
                    } else {
                        actionText = `played ${entry.details}`;
                    }
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
                ${entry.action === 'played_set' && actionText.includes('with') ? 
                  `<span class="log-tile-details">${this.getLastPlayedSetDescription()}</span>` : ''}
            `;
            
            logElement.appendChild(entryDiv);
        });
        
        // Scroll to bottom
        logElement.scrollTop = logElement.scrollHeight;
    }

    // Helper to get a description of the last played set
    getLastPlayedSetDescription() {
        // First check if we have direct tile objects
        if (this.lastPlayedSet && this.lastPlayedSet.length > 0) {
            return this.describeTileSet(this.lastPlayedSet);
        }
        
        // If we don't have the last played set, try to deduce from the game state
        if (this.gameState && this.gameState.board && this.gameState.board.length > 0) {
            // Get the most recently played set (last one on the board)
            const lastSet = this.gameState.board[this.gameState.board.length - 1];
            if (lastSet && lastSet.length > 0) {
                return this.describeTileSet(lastSet);
            }
        }
        
        return '';
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
        
        // Stop inactivity checker
        this.stopInactivityCheck();
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

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    // Sets up drag-and-drop zones for existing sets on the board
    // Handles precise positioning within sets via handleEnhancedTileDrop
    setupSetDropZone(setElement, setIndex) {
        // Add visual indicators for drag over locations
        const addPositionIndicators = (e) => {
            // Clear any existing indicators (though we don't add them anymore)
            setElement.querySelectorAll('.position-indicator').forEach(el => el.remove());
            
            // Determine insert position but don't show visual indicator
            const rect = setElement.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const tileWidth = 70; // Approximate tile width
            const tiles = setElement.querySelectorAll('.tile');
            let insertPosition = Math.floor(mouseX / tileWidth);
            
            // Clamp insert position to valid range
            insertPosition = Math.min(Math.max(0, insertPosition), tiles.length);
            
            // Store the insert position as data attribute (for functionality)
            setElement.dataset.insertPosition = insertPosition;
            
            // We no longer create or append position indicators as per requirements
            // The functionality is preserved but without the visual green line indicator
            
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

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    // Sets up drag-and-drop zones for creating new sets
    // Used for "Create New Set" zones and empty board placeholders
    setupNewSetDropZone(newSetZone) {
        newSetZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's not the player's turn and reject
            if (!this.isMyTurn()) {
                newSetZone.classList.add('drag-rejected');
                return;
            }
            
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
            
            // Prevent drops if it's not the player's turn
            if (!this.isMyTurn()) {
                return;
            }
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                this.handleTileDrop(dragData, -1); // -1 indicates new set
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        });
    }

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md  
    // Sets up drag-and-drop zones for empty board placeholders
    // Allows creating the first set when board is empty
    setupBoardDropZone(placeholderElement) {
        placeholderElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if it's not the player's turn and reject
            if (!this.isMyTurn()) {
                placeholderElement.classList.add('drag-rejected');
                return;
            }
            
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
            
            // Prevent drops if it's not the player's turn
            if (!this.isMyTurn()) {
                return;
            }
            
            try {
                const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
                this.handleTileDrop(dragData, -1); // -1 indicates new set
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        });
    }

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    // This is the core drag-and-drop handler for simple tile drops (new sets)
    // Used by setupNewSetDropZone and setupBoardDropZone
    handleTileDrop(dragData, targetSetIndex) {
        // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
        console.log('🔍 [DEBUG] handleTileDrop called:', {
            dragDataType: dragData.type,
            tileId: dragData.tile?.id,
            tileInfo: `${dragData.tile?.number} ${dragData.tile?.color}`,
            targetSetIndex,
            currentHandSize: this.gameState.playerHand.length,
            isLastTile: this.gameState.playerHand.length === 1
        });
        // 🐛 END DEBUG LOGGING

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
            // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
            console.log('🐛 [DEBUG] Processing hand-tile drop:', {
                beforeHandSize: this.gameState.playerHand.length,
                tileBeingMoved: `${dragData.tile.number} ${dragData.tile.color} (${dragData.tile.id})`,
                needsInitialPlay
            });
            // 🐛 END DEBUG LOGGING

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
            
            // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
            console.log('🐛 [DEBUG] About to remove tile from hand locally');
            // 🐛 END DEBUG LOGGING
            
            // Remove tile from hand locally for immediate UI feedback
            const tileIndex = this.gameState.playerHand.findIndex(t => t.id === dragData.tile.id);
            if (tileIndex !== -1) {
                // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
                console.log('🐛 [DEBUG] Removing tile from hand:', {
                    tileIndex,
                    beforeRemoval: this.gameState.playerHand.length,
                    tileId: dragData.tile.id
                });
                // 🐛 END DEBUG LOGGING
                
                // Create a copy of the player's hand and remove the tile
                const newHand = [...this.gameState.playerHand];
                newHand.splice(tileIndex, 1);
                this.gameState.playerHand = newHand;
                
                // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
                console.log('🐛 [DEBUG] After local removal:', {
                    afterRemoval: this.gameState.playerHand.length,
                    handTileIds: this.gameState.playerHand.map(t => t.id)
                });
                // 🐛 END DEBUG LOGGING
                
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

    // ⚠️ CRITICAL: DO NOT MODIFY OR REMOVE - See DRAG_DROP_PRESERVATION.md
    // Enhanced tile drop handler that respects insert position
    // Used by setupSetDropZone for precise positioning within existing sets
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
        
        // Simply add the tile to the set
        set.push(tile);
        
        // Then sort the entire set
        this.sortBoardSet(set);
    }
    
    updateBoard(newBoard, tilesFromHand = []) {
        // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
        console.log('🐛 [DEBUG] updateBoard called:', {
            tilesFromHand,
            currentHandSize: this.gameState?.playerHand?.length || 0,
            boardTileCount: newBoard.flat().length
        });
        // 🐛 END DEBUG LOGGING
        
        // Sort all sets on the board before updating
        this.sortAllBoardSets(newBoard);
        
        // Store local copy immediately for better UX response
        if (this.gameState) {
            this.gameState.board = newBoard;
            
            // Update the undo button based on the board state change
            this.updateActionButtons();
        }
        
        // 🐛 DEBUG LOGGING - REMOVE AFTER BUG FIX
        console.log('🐛 [DEBUG] Sending updateBoard to server:', {
            tilesFromHand,
            boardSets: newBoard.length,
            totalBoardTiles: newBoard.flat().length
        });
        // 🐛 END DEBUG LOGGING
        
        // Send to server with explicit list of tiles moved from hand
        this.socket.emit('updateBoard', { 
            board: newBoard,
            tilesFromHand: tilesFromHand
        });
    }
    
    // Sort all sets on the board for consistent display
    sortAllBoardSets(board) {
        if (!board || !Array.isArray(board)) return;
        
        board.forEach(set => {
            this.sortBoardSet(set);
        });
    }
    
    // Sort a single set based on whether it's a run or group
    sortBoardSet(set) {
        if (!set || !Array.isArray(set) || set.length < 2) return;
        
        // Determine if this is a run or a group
        const nonJokers = set.filter(t => !t.isJoker);
        const jokers = set.filter(t => t.isJoker);
        
        if (nonJokers.length < 2) {
            // Not enough non-joker tiles to determine type
            return;
        }
        
        // Check if it's a run (all same color)
        const colors = new Set(nonJokers.map(t => t.color));
        const isRun = colors.size === 1;
        
        // Check if it's a group (all same number)
        const numbers = new Set(nonJokers.map(t => t.number));
        const isGroup = numbers.size === 1;
        
        if (isRun) {
            // For runs, we need to infer where jokers should be placed
            
            // First, sort the non-joker tiles by number
            nonJokers.sort((a, b) => a.number - b.number);
            
            // If there are no jokers, just sort normally
            if (jokers.length === 0) {
                set.sort((a, b) => a.number - b.number);
                return;
            }
            
            // Create a new sorted array
            const sortedSet = [];
            
            // Find gaps in the run where jokers could be placed
            let jokerPositions = [];
            
            // Check for gaps between consecutive non-joker tiles
            for (let i = 1; i < nonJokers.length; i++) {
                const gap = nonJokers[i].number - nonJokers[i-1].number - 1;
                if (gap > 0) {
                    // Add potential joker positions for each gap
                    for (let j = 1; j <= gap; j++) {
                        jokerPositions.push({
                            position: nonJokers[i-1].number + j,
                            index: i // Insert after this index in the sortedSet
                        });
                    }
                }
            }
            
            // Sort positions by the size of the gap they fill
            jokerPositions.sort((a, b) => a.position - b.position);
            
            // If we have more jokers than identified gaps, check for positions at the start or end
            if (jokers.length > jokerPositions.length) {
                // Check if a joker could go before the first non-joker
                if (nonJokers.length > 0 && nonJokers[0].number > 1) {
                    jokerPositions.unshift({
                        position: nonJokers[0].number - 1,
                        index: 0 // Insert at the beginning
                    });
                }
                
                // Check if a joker could go after the last non-joker
                if (nonJokers.length > 0 && nonJokers[nonJokers.length - 1].number < 13) {
                    jokerPositions.push({
                        position: nonJokers[nonJokers.length - 1].number + 1,
                        index: nonJokers.length // Insert at the end
                    });
                }
            }
            
            // Use only as many joker positions as we have jokers
            jokerPositions = jokerPositions.slice(0, jokers.length);
            
            // Assign each joker its inferred number based on position
            jokers.forEach((joker, idx) => {
                if (idx < jokerPositions.length) {
                    joker._inferredNumber = jokerPositions[idx].position;
                } else {
                    // If we couldn't infer a position, just place at the end
                    joker._inferredNumber = 14; // Higher than any valid tile
                }
            });
            
            // Create the final sorted array including jokers
            set.sort((a, b) => {
                if (a.isJoker && b.isJoker) {
                    // Sort jokers by their inferred number
                    return a._inferredNumber - b._inferredNumber;
                }
                if (a.isJoker) {
                    return a._inferredNumber - b.number;
                }
                if (b.isJoker) {
                    return a.number - b._inferredNumber;
                }
                // Regular tiles sorted by number
                return a.number - b.number;
            });
            
            // Clean up temporary properties
            jokers.forEach(joker => {
                delete joker._inferredNumber;
            });
        } else if (isGroup) {
            // Sort by color for groups
            const colorOrder = { 'red': 0, 'blue': 1, 'yellow': 2, 'black': 3 };
            set.sort((a, b) => {
                // Handle jokers
                if (a.isJoker && b.isJoker) return 0;
                if (a.isJoker) return 1; // Jokers at the end
                if (b.isJoker) return -1;
                
                // Regular tiles are sorted by color
                return colorOrder[a.color] - colorOrder[b.color];
            });
        }
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
    // Helper to check if a tile was just added to the board in this update
    isNewlyAddedTile(tile, setIndex, tileIndex) {
        if (!this.previousBoardState) {
            return false;
        }
        
        // Check if this is a new set
        if (setIndex >= this.previousBoardState.length) {
            return true;
        }
        
        // Check if this is a new tile in an existing set
        if (this.previousBoardState[setIndex] && tileIndex >= this.previousBoardState[setIndex].length) {
            return true;
        }
        
        // Check if this is a different tile at the same position
        if (this.previousBoardState[setIndex] && this.previousBoardState[setIndex][tileIndex]) {
            const prevTile = this.previousBoardState[setIndex][tileIndex];
            // Compare tile properties to see if it's different
            if (prevTile.id !== tile.id || 
                prevTile.color !== tile.color || 
                prevTile.number !== tile.number || 
                prevTile.isJoker !== tile.isJoker) {
                return true;
            }
        }
        
        return false;
    }

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
    
    // Helper method to describe a set of tiles in human-readable format
    describeTileSet(tiles) {
        if (!tiles || tiles.length === 0) return '';
        
        // Ensure all tiles have valid properties
        if (!tiles.every(tile => tile && typeof tile === 'object')) {
            return `${tiles.length} tiles`;
        }
        
        // Check if it's a run (consecutive numbers, same color)
        const isRun = this.isRunSet(tiles);
        
        // Check if it's a group (same number, different colors)
        const isGroup = this.isGroupSet(tiles);
        
        if (isRun) {
            // Describe a run (e.g., "Red 5-7")
            // Safely access color
            const color = tiles[0] && tiles[0].color ? tiles[0].color : 'unknown';
            const numbers = tiles
                .filter(t => t && !t.isJoker) // Exclude jokers for number determination
                .map(t => t.number)
                .sort((a, b) => a - b);
            
            const jokers = tiles.filter(t => t && t.isJoker).length;
            const jokerText = jokers > 0 ? ` with ${jokers} joker${jokers > 1 ? 's' : ''}` : '';
            
            if (numbers.length === 0) {
                return `All jokers`;
            } else if (numbers.length === 1) {
                return `${color.charAt(0).toUpperCase() + color.slice(1)} ${numbers[0]}${jokerText}`;
            } else {
                return `${color.charAt(0).toUpperCase() + color.slice(1)} ${numbers[0]}-${numbers[numbers.length-1]}${jokerText}`;
            }
        } else if (isGroup) {
            // Describe a group (e.g., "Three 8s")
            const number = tiles.find(t => t && !t.isJoker)?.number;
            const colors = tiles.filter(t => t && !t.isJoker).map(t => t.color || 'unknown');
            const jokers = tiles.filter(t => t && t.isJoker).length;
            
            if (number === undefined) {
                return `All jokers`;
            } else {
                const colorsList = colors
                    .filter(c => c) // Filter out null/undefined colors
                    .map(c => c.charAt(0).toUpperCase() + c.slice(1))
                    .join(', ');
                const jokerText = jokers > 0 ? ` with ${jokers} joker${jokers > 1 ? 's' : ''}` : '';
                return `${number}s in ${colorsList || 'unknown colors'}${jokerText}`;
            }
        } else {
            // Generic description for invalid sets
            return `${tiles.length} tiles`;
        }
    }
    
    // Helper to check if a set is a run
    isRunSet(tiles) {
        if (!tiles || tiles.length < 3) return false;
        
        // Validate tiles have the necessary properties
        if (!tiles.every(t => t && typeof t === 'object')) return false;
        
        // Check all non-joker tiles are the same color
        const nonJokers = tiles.filter(t => t && !t.isJoker);
        if (nonJokers.length === 0) return true; // All jokers can be anything
        
        if (!nonJokers[0] || !nonJokers[0].color) return false;
        const firstColor = nonJokers[0].color;
        if (!nonJokers.every(t => t && t.color === firstColor)) return false;
        
        // Check numbers form a run (considering jokers can fill gaps)
        const numbers = nonJokers.filter(t => t && t.number != null).map(t => t.number).sort((a, b) => a - b);
        if (numbers.length === 0) return true; // All valid tiles are jokers
        
        const jokers = tiles.filter(t => t && t.isJoker).length;
        
        let gapsNeeded = 0;
        for (let i = 1; i < numbers.length; i++) {
            const gap = numbers[i] - numbers[i-1] - 1;
            if (gap > 0) gapsNeeded += gap;
        }
        
        return gapsNeeded <= jokers;
    }
    
    // Helper to check if a set is a group
    isGroupSet(tiles) {
        if (!tiles || tiles.length < 3 || tiles.length > 4) return false;
        
        // Validate tiles have the necessary properties
        if (!tiles.every(t => t && typeof t === 'object')) return false;
        
        // Check all non-joker tiles have the same number
        const nonJokers = tiles.filter(t => t && !t.isJoker);
        if (nonJokers.length === 0) return true; // All jokers can be anything
        
        if (!nonJokers[0] || nonJokers[0].number == null) return false;
        const firstNumber = nonJokers[0].number;
        if (!nonJokers.every(t => t && t.number === firstNumber)) return false;
        
        // Check all colors are different
        const colors = nonJokers.filter(t => t && t.color).map(t => t.color);
        if (colors.length === 0) return true; // All valid tiles are jokers
        return new Set(colors).size === colors.length;
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
    
    // Helper method to rejoin a game after reconnection
    rejoinGame(gameId, playerName) {
        // Emit event to server to rejoin the game
        this.socket.emit('joinGame', {
            gameId: gameId,
            playerName: playerName
        });
        
        this.showNotification(`Attempting to rejoin game ${gameId}...`, 'info');
    }
    
    // Methods for handling refresh button and inactivity
    showRefreshButton() {
        const refreshBtn = document.getElementById('refreshGameBtn');
        if (refreshBtn) {
            refreshBtn.classList.remove('hidden');
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Game';
            
            // Make sure the refresh button actually refreshes the page
            refreshBtn.onclick = () => {
                window.location.reload();
            };
        } else {
            console.warn('Refresh button not found in the DOM');
            
            // Create a floating refresh button if not found
            this.createFloatingRefreshButton();
        }
    }
    
    // Create a floating refresh button that stays visible even if the game UI is broken
    createFloatingRefreshButton() {
        if (document.getElementById('floatingRefreshBtn')) return; // Don't create duplicate buttons
        
        const btn = document.createElement('button');
        btn.id = 'floatingRefreshBtn';
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Game';
        btn.onclick = () => window.location.reload();
        
        // Style the button
        btn.style.position = 'fixed';
        btn.style.top = '20px';
        btn.style.right = '20px';
        btn.style.zIndex = '9999';
        btn.style.padding = '10px 20px';
        btn.style.backgroundColor = '#e74c3c';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '5px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        btn.style.animation = 'pulse 2s infinite';
        
        // Add a style for the pulse animation
        if (!document.getElementById('floatingBtnStyle')) {
            const style = document.createElement('style');
            style.id = 'floatingBtnStyle';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(btn);
    }
    
    hideRefreshButton() {
        const refreshBtn = document.getElementById('refreshGameBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('hidden');
        }
        
        // Also hide the floating refresh button if it exists
        const floatingBtn = document.getElementById('floatingRefreshBtn');
        if (floatingBtn) {
            floatingBtn.style.display = 'none';
        }
    }
    
    // Connection status management
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('profileConnectionStatus');
        if (!statusElement) return;
        
        // Remove all status classes
        statusElement.classList.remove('connected', 'connecting', 'disconnected');
        
        // Update the status element based on the new status
        switch (status) {
            case 'connected':
                statusElement.classList.add('connected');
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> <span>Connected</span>';
                break;
            case 'connecting':
                statusElement.classList.add('connecting');
                statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Connecting...</span>';
                break;
            case 'disconnected':
                statusElement.classList.add('disconnected');
                statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> <span>Disconnected</span>';
                break;
        }
    }

    async loadLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        const leaderboardLoading = document.querySelector('.leaderboard-loading');
        const leaderboardError = document.getElementById('leaderboardError');
        
        if (!leaderboardList) return;
        
        // Show loading state
        if (leaderboardLoading) leaderboardLoading.style.display = 'flex';
        if (leaderboardError) leaderboardError.style.display = 'none';
        leaderboardList.style.display = 'none';
        
        try {
            const backendUrl = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000' 
                : 'https://rummikub-backend.onrender.com';
            
            const response = await fetch(`${backendUrl}/api/stats/leaderboard/public`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }
            
            const data = await response.json();
            
            // Hide loading and show list
            if (leaderboardLoading) leaderboardLoading.style.display = 'none';
            if (leaderboardError) leaderboardError.style.display = 'none';
            leaderboardList.style.display = 'block';
            
            // Populate leaderboard
            if (data.leaderboard && data.leaderboard.length > 0) {
                leaderboardList.innerHTML = data.leaderboard.map(player => `
                    <div class="leaderboard-entry">
                        <div class="leaderboard-rank">#${player.rank}</div>
                        <div class="leaderboard-player">${player.username}</div>
                        <div class="leaderboard-wins">${player.gamesWon} win${player.gamesWon !== 1 ? 's' : ''}</div>
                    </div>
                `).join('');
            } else {
                leaderboardList.innerHTML = `
                    <div class="leaderboard-placeholder">
                        <i class="fas fa-users"></i>
                        <p>No players on the leaderboard yet</p>
                        <p>Be the first to complete a game!</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            
            // Show error state
            if (leaderboardLoading) leaderboardLoading.style.display = 'none';
            leaderboardList.style.display = 'none';
            if (leaderboardError) leaderboardError.style.display = 'flex';
        }
    }

    showConnectionLostOverlay() {
        const overlay = document.getElementById('connectionLostOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            
            // Check if we have game info stored
            const gameInfo = this.getGameStateFromStorage();
            const reconnectInfo = document.querySelector('.reconnect-info');
            
            if (gameInfo && gameInfo.gameId && gameInfo.playerName && reconnectInfo) {
                reconnectInfo.textContent = `You have an active game (${gameInfo.gameId}). Clicking the button below will attempt to restore your game session.`;
                
                // Update the button text to be more specific
                const reconnectBtn = document.getElementById('manualReconnectBtn');
                if (reconnectBtn) {
                    reconnectBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reconnect to Game #' + gameInfo.gameId;
                }
            } else if (reconnectInfo) {
                reconnectInfo.textContent = 'You don\'t have any saved games. Clicking the button below will refresh the page.';
                
                // Update the button text
                const reconnectBtn = document.getElementById('manualReconnectBtn');
                if (reconnectBtn) {
                    reconnectBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Page';
                }
            }
            
            // Set up the manual reconnect button
            const reconnectBtn = document.getElementById('manualReconnectBtn');
            if (reconnectBtn) {
                reconnectBtn.onclick = () => {
                    // This behavior is now handled in the DOMContentLoaded event
                    // as we set it up there for consistent behavior
                    const gameInfo = this.getGameStateFromStorage();
                    
                    if (gameInfo && gameInfo.gameId && gameInfo.playerName) {
                        console.log('🔄 Attempting to rejoin game with saved info:', gameInfo);
                        this.showNotification('Attempting to reconnect to your game...', 'info');
                        
                        // Show loading screen while reconnecting
                        document.getElementById('welcomeScreen').classList.remove('active');
                        document.getElementById('gameScreen').classList.remove('active');
                        document.getElementById('loadingScreen').classList.add('active');
                        
                        // Hide connection lost overlay
                        this.hideConnectionLostOverlay();
                        
                        // Attempt to rejoin with the stored game info
                        this.gameId = gameInfo.gameId;
                        this.playerName = gameInfo.playerName;
                        this.rejoinGame(gameInfo.gameId, gameInfo.playerName);
                    } else {
                        console.log('⚠️ No valid game info found, reloading page');
                        window.location.reload();
                    }
                };
            }
        }
    }
    
    hideConnectionLostOverlay() {
        const overlay = document.getElementById('connectionLostOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    updateReconnectionStatus(message) {
        const statusElement = document.getElementById('reconnectionStatus');
        if (statusElement) {
            statusElement.innerHTML = message;
        }
    }
    
    startInactivityCheck() {
        // Stop any existing interval first
        this.stopInactivityCheck();
        
        // Start the inactivity timer
        this.resetInactivityTimer();
        
        // Check for inactivity every 10 seconds
        this.inactivityCheckInterval = setInterval(() => {
            const now = Date.now();
            const inactiveDuration = now - this.lastActivityTime;
            
            // If inactive for more than the timeout, show the refresh button
            if (inactiveDuration > this.inactivityTimeout) {
                console.log('⚠️ User inactive for too long, showing refresh button');
                this.showRefreshButton();
            }
        }, 10000);
        
        console.log('🔄 Inactivity checker started');
    }
    
    stopInactivityCheck() {
        if (this.inactivityCheckInterval) {
            clearInterval(this.inactivityCheckInterval);
            this.inactivityCheckInterval = null;
            console.log('🛑 Inactivity checker stopped');
        }
    }
    
    resetInactivityTimer() {
        this.lastActivityTime = Date.now();
        // Hide the refresh button if it was shown due to inactivity
        this.hideRefreshButton();
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

// Game Log Modal methods
function openGameLogModal() {
    const modal = document.getElementById('gameLogModal');
    if (modal) {
        modal.classList.add('show');
        // Prevent scrolling of background content when modal is open
        document.body.style.overflow = 'hidden';
    }
}

function closeGameLogModal() {
    const modal = document.getElementById('gameLogModal');
    if (modal) {
        modal.classList.remove('show');
        // Restore scrolling when modal is closed
        document.body.style.overflow = '';
    }
}

// Add these methods to the RummikubClient prototype
RummikubClient.prototype.openGameLogModal = openGameLogModal;
RummikubClient.prototype.closeGameLogModal = closeGameLogModal;

// Add the settings modal methods to the prototype
RummikubClient.prototype.openSettingsModal = function() {
    const modal = document.getElementById('gameSettingsModal');
    if (modal) {
        modal.classList.add('show');
        // Copy the current timer setting to the modal
        const currentTimerSetting = document.getElementById('enableTimer')?.checked || true;
        document.getElementById('settingsEnableTimer').checked = currentTimerSetting;
        // Prevent scrolling of background content
        document.body.style.overflow = 'hidden';
    }
};

RummikubClient.prototype.closeSettingsModal = function() {
    const modal = document.getElementById('gameSettingsModal');
    if (modal) {
        modal.classList.remove('show');
        // Restore scrolling
        document.body.style.overflow = '';
    }
};

RummikubClient.prototype.createGameWithSettings = function() {
    // Get settings from the modal
    const timerEnabled = document.getElementById('settingsEnableTimer').checked;
    this.timerEnabled = timerEnabled;
    console.log(`🕒 Turn timer: ${timerEnabled ? 'ENABLED' : 'disabled'}`);
    
    // Close the modal
    this.closeSettingsModal();
    
    // Debug mode is determined by using name "debug"
    const isDebugMode = this.playerName.toLowerCase() === 'debug';
    if (isDebugMode) {
        console.log('🔧 Debug mode enabled! Game creator will get debug hand.');
    }
    
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
            this.socket.emit('createGame', { 
                playerName: this.playerName, 
                isDebugMode,
                timerEnabled: this.timerEnabled
            });
        });
    } else {
        // Already connected
        this.socket.emit('createGame', { 
            playerName: this.playerName, 
            isDebugMode,
            timerEnabled: this.timerEnabled
        });
    }
};

// Methods to save and restore game state
RummikubClient.prototype.saveGameStateToStorage = function() {
    if (!this.gameId || !this.playerName) return;
    
    try {
        const gameInfo = {
            gameId: this.gameId,
            playerName: this.playerName,
            timestamp: Date.now()
        };
        
        localStorage.setItem('rummikub_game_info', JSON.stringify(gameInfo));
        console.log('💾 Game info saved to localStorage:', gameInfo);
    } catch (err) {
        console.warn('Could not save game info to localStorage:', err);
    }
};

RummikubClient.prototype.clearGameStateFromStorage = function() {
    try {
        localStorage.removeItem('rummikub_game_info');
        console.log('🧹 Game info cleared from localStorage');
    } catch (err) {
        console.warn('Could not clear game info from localStorage:', err);
    }
};

RummikubClient.prototype.getGameStateFromStorage = function() {
    try {
        const gameInfoStr = localStorage.getItem('rummikub_game_info');
        if (!gameInfoStr) return null;
        
        const gameInfo = JSON.parse(gameInfoStr);
        
        // Check if stored game info is recent enough (within last 2 hours)
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        if (Date.now() - gameInfo.timestamp > twoHoursInMs) {
            console.log('🕒 Stored game info is too old, clearing');
            this.clearGameStateFromStorage();
            return null;
        }
        
        return gameInfo;
    } catch (err) {
        console.warn('Could not retrieve game info from localStorage:', err);
        return null;
    }
};

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOM loaded, initializing RummikubClient...');
    window.game = new RummikubClient();
    console.log('✅ RummikubClient initialized');
    
    // Load leaderboard on initial page load
    window.game.loadLeaderboard();
    
    // Set up manual reconnect button
    const manualReconnectBtn = document.getElementById('manualReconnectBtn');
    if (manualReconnectBtn) {
        manualReconnectBtn.addEventListener('click', () => {
            // Instead of reloading, try to restore from saved state
            const gameInfo = window.game.getGameStateFromStorage();
            
            if (gameInfo && gameInfo.gameId && gameInfo.playerName) {
                console.log('🔄 Attempting to rejoin game with saved info:', gameInfo);
                window.game.showNotification('Attempting to reconnect to your game...', 'info');
                
                // Show loading screen while reconnecting
                document.getElementById('welcomeScreen').classList.remove('active');
                document.getElementById('gameScreen').classList.remove('active');
                document.getElementById('loadingScreen').classList.add('active');
                
                // Hide connection lost overlay
                window.game.hideConnectionLostOverlay();
                
                // Attempt to rejoin with the stored game info
                window.game.gameId = gameInfo.gameId;
                window.game.playerName = gameInfo.playerName;
                window.game.rejoinGame(gameInfo.gameId, gameInfo.playerName);
            } else {
                console.log('⚠️ No valid game info found, reloading page');
                window.location.reload();
            }
        });
    }
    
    // Check if we have a saved game to restore
    const savedGameInfo = window.game.getGameStateFromStorage();
    if (savedGameInfo && savedGameInfo.gameId && savedGameInfo.playerName) {
        console.log('🔄 Found saved game info on page load:', savedGameInfo);
        
        // Fill in the player name field
        const playerNameInput = document.getElementById('playerName');
        if (playerNameInput) {
            playerNameInput.value = savedGameInfo.playerName;
        }
        
        // Show a toast notification about the saved game
        window.game.showNotification(`You have a saved game (${savedGameInfo.gameId}). You can rejoin it from the connection panel if disconnected.`, 'info', 8000);
    }
});

// Check if the user is authenticated and update UI accordingly
RummikubClient.prototype.checkAuthenticationStatus = function() {
    // Check for authentication token in localStorage
    const token = localStorage.getItem('auth_token');
    const username = localStorage.getItem('username');
    
    console.log('🔐 Checking authentication status:', token ? 'Token found' : 'No token');
    
    if (token && username) {
        return true;
    }
    
    return false;
};
