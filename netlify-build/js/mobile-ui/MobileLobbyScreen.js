/**
 * Mobile Lobby Screen
 * Provides a card-based game listing layout with pull-to-refresh and floating action button
 * Implements portrait-optimized lobby interface for mobile devices
 */

class MobileLobbyScreen {
    constructor() {
        this.isVisible = false;
        this.games = [];
        this.players = [];
        this.invitations = [];
        this.activeTab = 'games';
        this.isRefreshing = false;
        this.lastRefresh = null;
        
        this.refreshThreshold = 100; // Pull distance to trigger refresh
        this.pullStartY = 0;
        this.pullCurrentY = 0;
        this.isPulling = false;
        
        // Real-time update intervals
        this.updateIntervals = new Map();
        this.realTimeUpdateEnabled = true;
        
        this.init();
    }

    init() {
        this.createLobbyScreen();
        this.setupEventListeners();
        this.setupPullToRefresh();
        this.loadInitialData();
    }

    createLobbyScreen() {
        // Create main lobby screen container
        this.screenElement = document.createElement('div');
        this.screenElement.id = 'mobile-lobby-screen';
        this.screenElement.className = 'mobile-screen mobile-lobby-screen portrait-screen';
        this.screenElement.style.display = 'none';

        this.screenElement.innerHTML = `
            <!-- Lobby Header -->
            <div class="mobile-lobby-header">
                <div class="lobby-title">
                    <h1><i class="fas fa-chess-board"></i> J-kube</h1>
                    <div class="user-info">
                        <span class="username" id="mobile-lobby-username">Player</span>
                        <div class="connection-status" id="mobile-lobby-connection">
                            <i class="fas fa-circle"></i>
                            <span>Online</span>
                        </div>
                    </div>
                </div>
                <div class="lobby-actions">
                    <button class="header-btn" id="mobile-lobby-settings">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="header-btn" id="mobile-lobby-logout">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="mobile-lobby-tabs">
                <button class="tab-btn active" data-tab="games">
                    <i class="fas fa-gamepad"></i>
                    <span>Games</span>
                    <div class="tab-indicator"></div>
                </button>
                <button class="tab-btn" data-tab="players">
                    <i class="fas fa-users"></i>
                    <span>Players</span>
                    <div class="tab-indicator"></div>
                </button>
                <button class="tab-btn" data-tab="invitations">
                    <i class="fas fa-envelope"></i>
                    <span>Invites</span>
                    <div class="tab-badge" id="invitations-badge">0</div>
                    <div class="tab-indicator"></div>
                </button>
            </div>

            <!-- Content Container with Pull-to-Refresh -->
            <div class="mobile-lobby-content">
                <div class="pull-to-refresh-indicator" id="pull-refresh-indicator">
                    <div class="refresh-spinner">
                        <i class="fas fa-sync-alt"></i>
                    </div>
                    <span class="refresh-text">Pull to refresh</span>
                </div>

                <!-- Games Tab Content -->
                <div class="tab-content active" id="games-tab">
                    <div class="games-list" id="mobile-games-list">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading games...</span>
                        </div>
                    </div>
                </div>

                <!-- Players Tab Content -->
                <div class="tab-content" id="players-tab">
                    <div class="players-list" id="mobile-players-list">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading players...</span>
                        </div>
                    </div>
                </div>

                <!-- Invitations Tab Content -->
                <div class="tab-content" id="invitations-tab">
                    <div class="invitations-list" id="mobile-invitations-list">
                        <div class="empty-state">
                            <i class="fas fa-envelope-open"></i>
                            <h3>No Invitations</h3>
                            <p>You don't have any game invitations yet</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Floating Action Button -->
            <button class="floating-action-btn" id="mobile-create-game-fab">
                <i class="fas fa-plus"></i>
            </button>
        `;

        // Append to body
        document.body.appendChild(this.screenElement);
    }

    setupEventListeners() {
        // Tab navigation
        const tabButtons = this.screenElement.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Floating Action Button
        const fab = this.screenElement.querySelector('#mobile-create-game-fab');
        fab.addEventListener('click', () => {
            this.navigateToGameCreation();
        });

        // Header actions
        const settingsBtn = this.screenElement.querySelector('#mobile-lobby-settings');
        settingsBtn.addEventListener('click', () => {
            this.showSettings();
        });

        const logoutBtn = this.screenElement.querySelector('#mobile-lobby-logout');
        logoutBtn.addEventListener('click', () => {
            this.logout();
        });

        // Game card interactions (delegated)
        const gamesList = this.screenElement.querySelector('#mobile-games-list');
        gamesList.addEventListener('click', (e) => {
            const gameCard = e.target.closest('.game-card');
            if (gameCard) {
                const gameId = gameCard.dataset.gameId;
                this.joinGame(gameId);
            }
        });

        // Player interactions (delegated)
        const playersList = this.screenElement.querySelector('#mobile-players-list');
        playersList.addEventListener('click', (e) => {
            const playerCard = e.target.closest('.player-card');
            const inviteBtn = e.target.closest('.invite-btn');
            
            if (inviteBtn) {
                e.stopPropagation();
                const playerId = inviteBtn.dataset.playerId;
                this.sendInvitation(playerId);
            } else if (playerCard) {
                const playerId = playerCard.dataset.playerId;
                this.showPlayerProfile(playerId);
            }
        });

        // Invitation interactions (delegated)
        const invitationsList = this.screenElement.querySelector('#mobile-invitations-list');
        invitationsList.addEventListener('click', (e) => {
            const acceptBtn = e.target.closest('.accept-invitation-btn');
            const declineBtn = e.target.closest('.decline-invitation-btn');
            
            if (acceptBtn) {
                const invitationId = acceptBtn.dataset.invitationId;
                this.acceptInvitation(invitationId);
            } else if (declineBtn) {
                const invitationId = declineBtn.dataset.invitationId;
                this.declineInvitation(invitationId);
            }
        });
    }

    setupPullToRefresh() {
        const content = this.screenElement.querySelector('.mobile-lobby-content');
        const indicator = this.screenElement.querySelector('#pull-refresh-indicator');

        content.addEventListener('touchstart', (e) => {
            if (content.scrollTop === 0) {
                this.pullStartY = e.touches[0].clientY;
                this.isPulling = true;
            }
        }, { passive: true });

        content.addEventListener('touchmove', (e) => {
            if (!this.isPulling) return;

            this.pullCurrentY = e.touches[0].clientY;
            const pullDistance = this.pullCurrentY - this.pullStartY;

            if (pullDistance > 0 && content.scrollTop === 0) {
                e.preventDefault();
                
                const progress = Math.min(pullDistance / this.refreshThreshold, 1);
                const translateY = Math.min(pullDistance * 0.5, 60);
                
                indicator.style.transform = `translateY(${translateY}px)`;
                indicator.style.opacity = progress;
                
                const spinner = indicator.querySelector('.refresh-spinner i');
                spinner.style.transform = `rotate(${progress * 360}deg)`;
                
                if (pullDistance >= this.refreshThreshold) {
                    indicator.querySelector('.refresh-text').textContent = 'Release to refresh';
                    indicator.classList.add('ready-to-refresh');
                } else {
                    indicator.querySelector('.refresh-text').textContent = 'Pull to refresh';
                    indicator.classList.remove('ready-to-refresh');
                }
            }
        }, { passive: false });

        content.addEventListener('touchend', () => {
            if (!this.isPulling) return;

            const pullDistance = this.pullCurrentY - this.pullStartY;
            
            if (pullDistance >= this.refreshThreshold) {
                this.triggerRefresh();
            } else {
                this.resetPullToRefresh();
            }
            
            this.isPulling = false;
        });
    }

    triggerRefresh() {
        const indicator = this.screenElement.querySelector('#pull-refresh-indicator');
        
        indicator.style.transform = 'translateY(40px)';
        indicator.style.opacity = '1';
        indicator.querySelector('.refresh-text').textContent = 'Refreshing...';
        indicator.classList.add('refreshing');
        
        const spinner = indicator.querySelector('.refresh-spinner i');
        spinner.classList.add('fa-spin');
        
        this.refreshData().finally(() => {
            setTimeout(() => {
                this.resetPullToRefresh();
            }, 500);
        });
    }

    resetPullToRefresh() {
        const indicator = this.screenElement.querySelector('#pull-refresh-indicator');
        
        indicator.style.transform = 'translateY(-60px)';
        indicator.style.opacity = '0';
        indicator.querySelector('.refresh-text').textContent = 'Pull to refresh';
        indicator.classList.remove('ready-to-refresh', 'refreshing');
        
        const spinner = indicator.querySelector('.refresh-spinner i');
        spinner.classList.remove('fa-spin');
        spinner.style.transform = 'rotate(0deg)';
    }

    switchTab(tabName) {
        // Update active tab button with animation
        const tabButtons = this.screenElement.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            const isActive = btn.dataset.tab === tabName;
            btn.classList.toggle('active', isActive);
            
            // Add ripple effect
            if (isActive) {
                this.addRippleEffect(btn);
            }
        });

        // Update active tab content with smooth transition
        const tabContents = this.screenElement.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            const isActive = content.id === `${tabName}-tab`;
            
            if (isActive) {
                // Show new content
                content.classList.add('active');
            } else {
                // Hide old content
                content.classList.remove('active');
            }
        });

        const previousTab = this.activeTab;
        this.activeTab = tabName;

        // Load data for the active tab if needed
        this.loadTabData(tabName);
        
        // Update real-time intervals
        this.updateRealTimeIntervals(previousTab, tabName);
    }

    addRippleEffect(button) {
        // Create ripple element
        const ripple = document.createElement('div');
        ripple.className = 'tab-ripple';
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
            left: 50%;
            top: 50%;
            width: 40px;
            height: 40px;
            margin-left: -20px;
            margin-top: -20px;
        `;
        
        button.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    updateRealTimeIntervals(previousTab, newTab) {
        // Clear previous tab's interval
        if (this.updateIntervals.has(previousTab)) {
            clearInterval(this.updateIntervals.get(previousTab));
            this.updateIntervals.delete(previousTab);
        }
        
        // Set up new tab's real-time updates
        if (this.realTimeUpdateEnabled && this.isVisible) {
            this.setupRealTimeUpdates(newTab);
        }
    }

    setupRealTimeUpdates(tabName) {
        if (!this.realTimeUpdateEnabled) return;
        
        let updateInterval;
        
        switch (tabName) {
            case 'games':
                // Update games every 10 seconds
                updateInterval = setInterval(() => {
                    if (this.isVisible && this.activeTab === 'games') {
                        this.loadGames(true); // Silent update
                    }
                }, 10000);
                break;
                
            case 'players':
                // Update players every 15 seconds
                updateInterval = setInterval(() => {
                    if (this.isVisible && this.activeTab === 'players') {
                        this.loadPlayers(true); // Silent update
                    }
                }, 15000);
                break;
                
            case 'invitations':
                // Update invitations every 5 seconds
                updateInterval = setInterval(() => {
                    if (this.isVisible && this.activeTab === 'invitations') {
                        this.loadInvitations(true); // Silent update
                    }
                }, 5000);
                break;
        }
        
        if (updateInterval) {
            this.updateIntervals.set(tabName, updateInterval);
        }
    }

    async loadInitialData() {
        // Set user info
        const username = localStorage.getItem('username') || 'Player';
        this.screenElement.querySelector('#mobile-lobby-username').textContent = username;

        // Update connection status
        this.updateConnectionStatus('online');

        // Load initial tab data
        await this.loadTabData(this.activeTab);
        
        // Set up connection status monitoring
        this.setupConnectionStatusMonitoring();
    }

    updateConnectionStatus(status) {
        const connectionElement = this.screenElement.querySelector('#mobile-lobby-connection');
        const statusMap = {
            'online': { icon: 'fas fa-circle', text: 'Online', color: '#10b981' },
            'connecting': { icon: 'fas fa-spinner fa-spin', text: 'Connecting...', color: '#f59e0b' },
            'offline': { icon: 'fas fa-circle', text: 'Offline', color: '#ef4444' }
        };
        
        const statusInfo = statusMap[status] || statusMap['offline'];
        
        connectionElement.innerHTML = `
            <i class="${statusInfo.icon}" style="color: ${statusInfo.color}"></i>
            <span>${statusInfo.text}</span>
        `;
    }

    setupConnectionStatusMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.updateConnectionStatus('online');
            this.showToast('Connection restored', 'success');
            // Refresh current tab data
            this.loadTabData(this.activeTab);
        });

        window.addEventListener('offline', () => {
            this.updateConnectionStatus('offline');
            this.showToast('Connection lost', 'error');
        });

        // Monitor network quality if available
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                const connection = navigator.connection;
                if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                    this.showToast('Slow connection detected', 'warning');
                }
            });
        }
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'games':
                await this.loadGames();
                break;
            case 'players':
                await this.loadPlayers();
                break;
            case 'invitations':
                await this.loadInvitations();
                break;
        }
    }

    async loadGames(silent = false) {
        const gamesList = this.screenElement.querySelector('#mobile-games-list');
        
        try {
            // Show loading state only if not silent update
            if (!silent) {
                gamesList.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading games...</span>
                    </div>
                `;
            }

            // Fetch games from API with better error handling
            const response = await fetch('/api/games', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // Check if we got HTML instead of JSON (common server error)
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    console.error('Server returned HTML instead of JSON for /api/games');
                    throw new Error('Server configuration error - API endpoints not properly configured');
                }
                throw new Error(`Failed to load games: ${response.status} ${response.statusText}`);
            }

            let games;
            try {
                games = await response.json();
            } catch (jsonError) {
                console.error('Failed to parse games JSON response:', jsonError);
                // Try to get the response text to see what we actually received
                const responseText = await response.text();
                console.error('Response text:', responseText.substring(0, 200));
                throw new Error('Server returned invalid JSON response');
            }
            
            // Check if games have changed (for silent updates)
            const gamesChanged = !silent || JSON.stringify(this.games) !== JSON.stringify(games);
            
            this.games = games;
            
            if (gamesChanged) {
                this.renderGames();
                
                // Show update indicator for silent updates
                if (silent && gamesChanged) {
                    this.showUpdateIndicator('Games updated');
                }
            }

        } catch (error) {
            console.error('Error loading games:', error);
            
            // If this is the first load and we're getting server errors, show mock data
            if (!silent && this.games.length === 0 && error.message.includes('Server configuration error')) {
                console.log('Showing mock games data due to server configuration issues');
                this.games = this.getMockGamesData();
                this.renderGames();
                this.showToast('Using demo data - server API not configured', 'warning');
                return;
            }
            
            // Only show error state if not a silent update
            if (!silent) {
                gamesList.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Unable to Load Games</h3>
                        <p>${error.message}</p>
                        <button class="retry-btn" onclick="window.mobileLobbyScreen?.loadGames()">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                        <button class="demo-btn" onclick="window.mobileLobbyScreen?.loadMockData()">
                            <i class="fas fa-play"></i> Try Demo Mode
                        </button>
                    </div>
                `;
            } else {
                // For silent updates, show a temporary error indicator
                this.showToast(`Failed to update games: ${error.message}`, 'error');
            }
        }
    }

    renderGames() {
        const gamesList = this.screenElement.querySelector('#mobile-games-list');
        
        if (this.games.length === 0) {
            gamesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gamepad"></i>
                    <h3>No Active Games</h3>
                    <p>Be the first to create a game!</p>
                    <button class="create-game-btn" onclick="window.mobileLobbyScreen.navigateToGameCreation()">
                        <i class="fas fa-plus"></i> Create Game
                    </button>
                </div>
            `;
            return;
        }

        const gamesHTML = this.games.map(game => this.createGameCard(game)).join('');
        gamesList.innerHTML = gamesHTML;
    }

    createGameCard(game) {
        const playerCount = game.players ? game.players.length : 0;
        const maxPlayers = game.maxPlayers || 4;
        const isJoinable = playerCount < maxPlayers && game.status === 'waiting';
        
        return `
            <div class="game-card ${isJoinable ? 'joinable' : 'full'}" data-game-id="${game.id}">
                <div class="game-card-header">
                    <div class="game-info">
                        <h3 class="game-title">Game ${game.id}</h3>
                        <div class="game-status ${game.status}">
                            <i class="fas fa-circle"></i>
                            <span>${this.getStatusText(game.status)}</span>
                        </div>
                    </div>
                    <div class="player-count">
                        <i class="fas fa-users"></i>
                        <span>${playerCount}/${maxPlayers}</span>
                    </div>
                </div>
                
                <div class="game-card-body">
                    <div class="game-players">
                        ${game.players ? game.players.map(player => `
                            <div class="player-avatar">
                                <span>${player.username.charAt(0).toUpperCase()}</span>
                            </div>
                        `).join('') : ''}
                        ${playerCount < maxPlayers ? `
                            <div class="player-avatar empty">
                                <i class="fas fa-plus"></i>
                            </div>
                        `.repeat(maxPlayers - playerCount) : ''}
                    </div>
                    
                    <div class="game-details">
                        <div class="game-setting">
                            <i class="fas fa-clock"></i>
                            <span>${game.timerEnabled ? '2 min timer' : 'No timer'}</span>
                        </div>
                        <div class="game-setting">
                            <i class="fas fa-calendar"></i>
                            <span>Created ${this.formatTimeAgo(game.createdAt)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="game-card-footer">
                    ${isJoinable ? `
                        <button class="join-game-btn">
                            <i class="fas fa-sign-in-alt"></i>
                            Join Game
                        </button>
                    ` : `
                        <div class="game-full-indicator">
                            <i class="fas fa-lock"></i>
                            <span>${game.status === 'in_progress' ? 'In Progress' : 'Full'}</span>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    async loadPlayers(silent = false) {
        const playersList = this.screenElement.querySelector('#mobile-players-list');
        
        try {
            if (!silent) {
                playersList.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading players...</span>
                    </div>
                `;
            }

            // Fetch online players from API with better error handling
            const response = await fetch('/api/players/online', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // Check if we got HTML instead of JSON
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    console.error('Server returned HTML instead of JSON for /api/players/online');
                    throw new Error('Server configuration error - API endpoints not properly configured');
                }
                throw new Error(`Failed to load players: ${response.status} ${response.statusText}`);
            }

            let players;
            try {
                players = await response.json();
            } catch (jsonError) {
                console.error('Failed to parse players JSON response:', jsonError);
                const responseText = await response.text();
                console.error('Response text:', responseText.substring(0, 200));
                throw new Error('Server returned invalid JSON response');
            }
            
            // Check if players have changed
            const playersChanged = !silent || JSON.stringify(this.players) !== JSON.stringify(players);
            
            this.players = players;
            
            if (playersChanged) {
                this.renderPlayers();
                
                if (silent && playersChanged) {
                    this.showUpdateIndicator('Players updated');
                }
            }

        } catch (error) {
            console.error('Error loading players:', error);
            
            // If this is the first load and we're getting server errors, show mock data
            if (!silent && this.players.length === 0 && error.message.includes('Server configuration error')) {
                console.log('Showing mock players data due to server configuration issues');
                this.players = this.getMockPlayersData();
                this.renderPlayers();
                this.showToast('Using demo data - server API not configured', 'warning');
                return;
            }
            
            if (!silent) {
                playersList.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Unable to Load Players</h3>
                        <p>${error.message}</p>
                        <button class="retry-btn" onclick="window.mobileLobbyScreen?.loadPlayers()">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                        <button class="demo-btn" onclick="window.mobileLobbyScreen?.loadMockData()">
                            <i class="fas fa-play"></i> Try Demo Mode
                        </button>
                    </div>
                `;
            } else {
                this.showToast(`Failed to update players: ${error.message}`, 'error');
            }
        }
    }

    renderPlayers() {
        const playersList = this.screenElement.querySelector('#mobile-players-list');
        
        if (this.players.length === 0) {
            playersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Players Online</h3>
                    <p>You're the only one here right now</p>
                </div>
            `;
            return;
        }

        const playersHTML = this.players.map(player => this.createPlayerCard(player)).join('');
        playersList.innerHTML = playersHTML;layersHTML;
    }

    createPlayerCard(player) {
        const currentUsername = localStorage.getItem('username');
        const isCurrentUser = player.username === currentUsername;
        
        return `
            <div class="player-card ${isCurrentUser ? 'current-user' : ''}" data-player-id="${player.id}">
                <div class="player-avatar">
                    <span>${player.username.charAt(0).toUpperCase()}</span>
                    <div class="status-indicator ${player.status}"></div>
                </div>
                
                <div class="player-info">
                    <h3 class="player-name">
                        ${player.username}
                        ${isCurrentUser ? '<span class="you-indicator">(You)</span>' : ''}
                    </h3>
                    <div class="player-status">
                        <i class="fas fa-circle"></i>
                        <span>${this.getPlayerStatusText(player.status)}</span>
                    </div>
                    <div class="player-stats">
                        <div class="stat">
                            <i class="fas fa-trophy"></i>
                            <span>${player.wins || 0} wins</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-gamepad"></i>
                            <span>${player.gamesPlayed || 0} games</span>
                        </div>
                    </div>
                </div>
                
                ${!isCurrentUser ? `
                    <div class="player-actions">
                        <button class="invite-btn" data-player-id="${player.id}">
                            <i class="fas fa-envelope"></i>
                            Invite
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async loadInvitations(silent = false) {
        const invitationsList = this.screenElement.querySelector('#mobile-invitations-list');
        
        try {
            if (!silent) {
                invitationsList.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading invitations...</span>
                    </div>
                `;
            }

            // Fetch invitations from API
            const response = await fetch('/api/invitations', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load invitations');
            }

            const invitations = await response.json();
            
            // Check if invitations have changed
            const invitationsChanged = !silent || JSON.stringify(this.invitations) !== JSON.stringify(invitations);
            
            this.invitations = invitations;
            
            if (invitationsChanged) {
                this.renderInvitations();
                this.updateInvitationsBadge();
                
                if (silent && invitationsChanged) {
                    this.showUpdateIndicator('Invitations updated');
                }
            }

        } catch (error) {
            console.error('Error loading invitations:', error);
            
            if (!silent) {
                invitationsList.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Unable to Load Invitations</h3>
                        <p>Please check your connection and try again</p>
                        <button class="retry-btn" onclick="window.mobileLobbyScreen.loadInvitations()">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                    </div>
                `;
            }
        }
    }

    renderInvitations() {
        const invitationsList = this.screenElement.querySelector('#mobile-invitations-list');
        
        if (this.invitations.length === 0) {
            invitationsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <h3>No Invitations</h3>
                    <p>You don't have any game invitations yet</p>
                </div>
            `;
            return;
        }

        const invitationsHTML = this.invitations.map(invitation => this.createInvitationCard(invitation)).join('');
        invitationsList.innerHTML = invitationsHTML;
    }

    createInvitationCard(invitation) {
        return `
            <div class="invitation-card" data-invitation-id="${invitation.id}">
                <div class="invitation-header">
                    <div class="inviter-info">
                        <div class="inviter-avatar">
                            <span>${invitation.fromUser.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="invitation-details">
                            <h3>${invitation.fromUser.username}</h3>
                            <p>invited you to join a game</p>
                            <div class="invitation-time">
                                <i class="fas fa-clock"></i>
                                <span>${this.formatTimeAgo(invitation.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="invitation-body">
                    <div class="game-preview">
                        <div class="game-setting">
                            <i class="fas fa-users"></i>
                            <span>${invitation.game.playerCount}/${invitation.game.maxPlayers} players</span>
                        </div>
                        <div class="game-setting">
                            <i class="fas fa-clock"></i>
                            <span>${invitation.game.timerEnabled ? '2 min timer' : 'No timer'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="invitation-actions">
                    <button class="decline-invitation-btn" data-invitation-id="${invitation.id}">
                        <i class="fas fa-times"></i>
                        Decline
                    </button>
                    <button class="accept-invitation-btn" data-invitation-id="${invitation.id}">
                        <i class="fas fa-check"></i>
                        Accept
                    </button>
                </div>
            </div>
        `;
    }

    updateInvitationsBadge() {
        const badge = this.screenElement.querySelector('#invitations-badge');
        const count = this.invitations.length;
        
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    async refreshData() {
        this.isRefreshing = true;
        this.lastRefresh = new Date();
        
        try {
            await this.loadTabData(this.activeTab);
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    // Navigation methods
    navigateToGameCreation() {
        if (window.mobileUISystem) {
            window.mobileUISystem.emit('navigateToGameCreation');
        } else {
            // Fallback navigation
            window.location.href = 'mobile-game-creation-demo.html';
        }
    }

    // Game actions
    async joinGame(gameId) {
        try {
            const response = await fetch(`/api/games/${gameId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to join game');
            }

            // Navigate to game screen
            window.location.href = `index.html?game=${gameId}`;

        } catch (error) {
            console.error('Error joining game:', error);
            this.showToast('Failed to join game. Please try again.', 'error');
        }
    }

    // Player actions
    showPlayerProfile(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        // Create player profile modal
        const modal = document.createElement('div');
        modal.className = 'player-profile-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <div class="player-avatar-large">
                        <span>${player.username.charAt(0).toUpperCase()}</span>
                        <div class="status-indicator ${player.status}"></div>
                    </div>
                    <div class="player-details">
                        <h2>${player.username}</h2>
                        <div class="player-status">
                            <i class="fas fa-circle"></i>
                            <span>${this.getPlayerStatusText(player.status)}</span>
                        </div>
                    </div>
                    <button class="close-modal-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="player-stats-detailed">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-trophy"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${player.wins || 0}</div>
                                <div class="stat-label">Wins</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-gamepad"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${player.gamesPlayed || 0}</div>
                                <div class="stat-label">Games Played</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${this.calculateWinRate(player)}%</div>
                                <div class="stat-label">Win Rate</div>
                            </div>
                        </div>
                    </div>
                    
                    ${player.username !== localStorage.getItem('username') ? `
                        <div class="player-actions-modal">
                            <button class="action-btn invite-player-btn" data-player-id="${player.id}">
                                <i class="fas fa-envelope"></i>
                                Send Game Invitation
                            </button>
                            <button class="action-btn challenge-player-btn" data-player-id="${player.id}">
                                <i class="fas fa-sword"></i>
                                Challenge to Game
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add modal styles
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal-btn');
        const backdrop = modal.querySelector('.modal-backdrop');
        const inviteBtn = modal.querySelector('.invite-player-btn');
        const challengeBtn = modal.querySelector('.challenge-player-btn');

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) {
                    document.body.removeChild(modal);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);

        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => {
                this.sendInvitation(playerId);
                closeModal();
            });
        }

        if (challengeBtn) {
            challengeBtn.addEventListener('click', () => {
                this.challengePlayer(playerId);
                closeModal();
            });
        }

        // Show modal with animation
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 50);
    }

    calculateWinRate(player) {
        if (!player.gamesPlayed || player.gamesPlayed === 0) return 0;
        return Math.round((player.wins / player.gamesPlayed) * 100);
    }

    async challengePlayer(playerId) {
        try {
            const response = await fetch('/api/games/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ playerId })
            });

            if (!response.ok) {
                throw new Error('Failed to send challenge');
            }

            const result = await response.json();
            
            // Navigate to the created game
            window.location.href = `index.html?game=${result.gameId}`;

        } catch (error) {
            console.error('Error sending challenge:', error);
            this.showToast('Failed to send challenge. Please try again.', 'error');
        }
    }

    async sendInvitation(playerId) {
        try {
            // Show loading state
            this.showToast('Sending invitation...', 'info');

            const response = await fetch('/api/invitations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    playerId,
                    gameType: 'standard',
                    message: 'Join me for a game!'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send invitation');
            }

            const result = await response.json();
            this.showToast('Invitation sent successfully!', 'success');

            // Update the player's status to show invitation sent
            this.updatePlayerInvitationStatus(playerId, 'sent');

        } catch (error) {
            console.error('Error sending invitation:', error);
            this.showToast('Failed to send invitation. Please try again.', 'error');
        }
    }

    updatePlayerInvitationStatus(playerId, status) {
        const playerCard = this.screenElement.querySelector(`[data-player-id="${playerId}"]`);
        if (playerCard) {
            const inviteBtn = playerCard.querySelector('.invite-btn');
            if (inviteBtn) {
                if (status === 'sent') {
                    inviteBtn.innerHTML = '<i class="fas fa-check"></i> Invited';
                    inviteBtn.disabled = true;
                    inviteBtn.style.background = '#10b981';
                    inviteBtn.style.opacity = '0.7';
                }
            }
        }
    }

    // Invitation actions
    async acceptInvitation(invitationId) {
        try {
            const response = await fetch(`/api/invitations/${invitationId}/accept`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to accept invitation');
            }

            const result = await response.json();
            
            // Navigate to the game
            window.location.href = `index.html?game=${result.gameId}`;

        } catch (error) {
            console.error('Error accepting invitation:', error);
            this.showToast('Failed to accept invitation. Please try again.', 'error');
        }
    }

    async declineInvitation(invitationId) {
        try {
            const response = await fetch(`/api/invitations/${invitationId}/decline`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to decline invitation');
            }

            // Remove invitation from list
            this.invitations = this.invitations.filter(inv => inv.id !== invitationId);
            this.renderInvitations();
            this.updateInvitationsBadge();

            this.showToast('Invitation declined', 'info');

        } catch (error) {
            console.error('Error declining invitation:', error);
            this.showToast('Failed to decline invitation. Please try again.', 'error');
        }
    }

    // Settings and logout
    showSettings() {
        console.log('Show settings modal');
        // Implementation would show settings modal
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }

    // Utility methods
    getStatusText(status) {
        const statusMap = {
            'waiting': 'Waiting for players',
            'in_progress': 'In progress',
            'finished': 'Finished'
        };
        return statusMap[status] || status;
    }

    getPlayerStatusText(status) {
        const statusMap = {
            'online': 'Online',
            'in_game': 'In game',
            'away': 'Away'
        };
        return statusMap[status] || status;
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return time.toLocaleDateString();
    }

    showUpdateIndicator(message) {
        // Create a subtle update indicator
        const indicator = document.createElement('div');
        indicator.className = 'update-indicator';
        indicator.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>${message}</span>
        `;
        indicator.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(16, 185, 129, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            z-index: 1500;
            opacity: 0;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        
        document.body.appendChild(indicator);
        
        // Show indicator
        setTimeout(() => {
            indicator.style.opacity = '1';
            indicator.style.transform = 'translateX(-50%) translateY(0)';
        }, 100);
        
        // Hide and remove indicator
        setTimeout(() => {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => {
                if (indicator.parentNode) {
                    document.body.removeChild(indicator);
                }
            }, 300);
        }, 2000);
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `mobile-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // Screen management
    show() {
        this.screenElement.style.display = 'flex';
        this.isVisible = true;
        
        // Apply mobile optimizations
        document.body.classList.add('mobile-lobby-active');
        
        // Refresh data when showing
        this.refreshData();
        
        // Start real-time updates for current tab
        this.setupRealTimeUpdates(this.activeTab);
    }

    // Mock data methods for demo mode
    getMockGamesData() {
        return [
            {
                id: 'demo-1',
                players: [
                    { username: 'Alice' },
                    { username: 'Bob' }
                ],
                maxPlayers: 4,
                status: 'waiting',
                timerEnabled: true,
                createdAt: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
            },
            {
                id: 'demo-2',
                players: [
                    { username: 'Charlie' },
                    { username: 'Diana' },
                    { username: 'Eve' }
                ],
                maxPlayers: 4,
                status: 'waiting',
                timerEnabled: false,
                createdAt: new Date(Date.now() - 600000).toISOString() // 10 minutes ago
            },
            {
                id: 'demo-3',
                players: [
                    { username: 'Frank' },
                    { username: 'Grace' },
                    { username: 'Henry' },
                    { username: 'Ivy' }
                ],
                maxPlayers: 4,
                status: 'in_progress',
                timerEnabled: true,
                createdAt: new Date(Date.now() - 900000).toISOString() // 15 minutes ago
            }
        ];
    }

    getMockPlayersData() {
        return [
            {
                id: 'player-1',
                username: 'Alice',
                status: 'online',
                wins: 15,
                gamesPlayed: 23
            },
            {
                id: 'player-2',
                username: 'Bob',
                status: 'in_game',
                wins: 8,
                gamesPlayed: 12
            },
            {
                id: 'player-3',
                username: 'Charlie',
                status: 'online',
                wins: 22,
                gamesPlayed: 30
            },
            {
                id: 'player-4',
                username: 'Diana',
                status: 'away',
                wins: 5,
                gamesPlayed: 8
            }
        ];
    }

    loadMockData() {
        console.log('Loading mock data for demo mode...');
        
        // Load mock games
        this.games = this.getMockGamesData();
        this.renderGames();
        
        // Load mock players
        this.players = this.getMockPlayersData();
        this.renderPlayers();
        
        // Clear invitations for demo
        this.invitations = [];
        this.renderInvitations();
        this.updateInvitationsBadge();
        
        this.showToast('Demo mode activated - using sample data', 'success');
    }

    hide() {
        this.screenElement.style.display = 'none';
        this.isVisible = false;
        
        // Remove mobile optimizations
        document.body.classList.remove('mobile-lobby-active');
        
        // Clear all real-time update intervals
        this.clearAllRealTimeUpdates();
    }

    clearAllRealTimeUpdates() {
        this.updateIntervals.forEach((interval, tabName) => {
            clearInterval(interval);
        });
        this.updateIntervals.clear();
    }

    destroy() {
        // Clear all real-time updates
        this.clearAllRealTimeUpdates();
        
        if (this.screenElement) {
            document.body.removeChild(this.screenElement);
        }
        
        document.body.classList.remove('mobile-lobby-active');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileLobbyScreen;
} else if (typeof window !== 'undefined') {
    window.MobileLobbyScreen = MobileLobbyScreen;
}