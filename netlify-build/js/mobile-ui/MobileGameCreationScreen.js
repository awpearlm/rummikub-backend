/**
 * Mobile Game Creation Screen
 * Provides landscape-optimized game setup interface with step-by-step configuration flow
 * Implements visual player slot management and touch-friendly game settings
 */

class MobileGameCreationScreen {
    constructor() {
        this.isVisible = false;
        this.currentStep = 'settings';
        this.gameSettings = {
            maxPlayers: 4,
            timerEnabled: true,
            timerDuration: 120, // 2 minutes in seconds
            gameMode: 'standard',
            isPrivate: false,
            allowSpectators: true
        };
        this.playerSlots = [];
        this.invitedPlayers = [];
        this.isCreating = false;
        
        this.init();
    }

    init() {
        this.createGameCreationScreen();
        this.setupEventListeners();
        this.initializePlayerSlots();
        this.loadAvailablePlayers();
    }

    createGameCreationScreen() {
        // Create main game creation screen container
        this.screenElement = document.createElement('div');
        this.screenElement.id = 'mobile-game-creation-screen';
        this.screenElement.className = 'mobile-screen mobile-game-creation-screen landscape-screen';
        this.screenElement.style.display = 'none';

        this.screenElement.innerHTML = `
            <!-- Game Creation Header -->
            <div class="mobile-game-creation-header safe-area-container">
                <div class="header-left">
                    <button class="header-btn back-btn" id="mobile-game-creation-back">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <div class="header-title">
                        <h1>Create Game</h1>
                        <div class="step-indicator">
                            <span class="step-text" id="step-indicator-text">Game Settings</span>
                            <div class="step-progress">
                                <div class="progress-bar" id="step-progress-bar"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="header-right">
                    <button class="header-btn help-btn" id="mobile-game-creation-help">
                        <i class="fas fa-question-circle"></i>
                    </button>
                </div>
            </div>

            <!-- Step Navigation -->
            <div class="step-navigation">
                <button class="step-nav-btn active" data-step="settings">
                    <div class="step-icon">
                        <i class="fas fa-cog"></i>
                    </div>
                    <span>Settings</span>
                </button>
                <button class="step-nav-btn" data-step="players">
                    <div class="step-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <span>Players</span>
                </button>
                <button class="step-nav-btn" data-step="review">
                    <div class="step-icon">
                        <i class="fas fa-check"></i>
                    </div>
                    <span>Review</span>
                </button>
            </div>

            <!-- Main Content Area -->
            <div class="mobile-game-creation-content">
                <!-- Settings Step -->
                <div class="step-content active" id="settings-step">
                    <div class="settings-container">
                        <div class="settings-section">
                            <h2>Game Configuration</h2>
                            
                            <!-- Max Players Setting -->
                            <div class="setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-users"></i>
                                    <span>Maximum Players</span>
                                </div>
                                <div class="setting-control">
                                    <div class="player-count-selector">
                                        <button class="count-btn decrease" data-setting="maxPlayers" data-action="decrease">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <span class="count-display" id="max-players-display">4</span>
                                        <button class="count-btn increase" data-setting="maxPlayers" data-action="increase">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Timer Setting -->
                            <div class="setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-clock"></i>
                                    <span>Turn Timer</span>
                                </div>
                                <div class="setting-control">
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="timer-enabled" checked>
                                        <label for="timer-enabled" class="toggle-label">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Timer Duration (when enabled) -->
                            <div class="setting-item timer-duration-setting">
                                <div class="setting-label">
                                    <i class="fas fa-stopwatch"></i>
                                    <span>Timer Duration</span>
                                </div>
                                <div class="setting-control">
                                    <div class="duration-selector">
                                        <button class="duration-btn" data-duration="60">1 min</button>
                                        <button class="duration-btn active" data-duration="120">2 min</button>
                                        <button class="duration-btn" data-duration="180">3 min</button>
                                        <button class="duration-btn" data-duration="300">5 min</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Game Mode Setting -->
                            <div class="setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-gamepad"></i>
                                    <span>Game Mode</span>
                                </div>
                                <div class="setting-control">
                                    <div class="mode-selector">
                                        <button class="mode-btn active" data-mode="standard">
                                            <i class="fas fa-chess-board"></i>
                                            <span>Standard</span>
                                        </button>
                                        <button class="mode-btn" data-mode="quick">
                                            <i class="fas fa-bolt"></i>
                                            <span>Quick Play</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="settings-section">
                            <h2>Privacy & Access</h2>
                            
                            <!-- Private Game Setting -->
                            <div class="setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-lock"></i>
                                    <span>Private Game</span>
                                    <div class="setting-description">Only invited players can join</div>
                                </div>
                                <div class="setting-control">
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="private-game">
                                        <label for="private-game" class="toggle-label">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Allow Spectators Setting -->
                            <div class="setting-item">
                                <div class="setting-label">
                                    <i class="fas fa-eye"></i>
                                    <span>Allow Spectators</span>
                                    <div class="setting-description">Let others watch the game</div>
                                </div>
                                <div class="setting-control">
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="allow-spectators" checked>
                                        <label for="allow-spectators" class="toggle-label">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Players Step -->
                <div class="step-content" id="players-step">
                    <div class="players-container">
                        <div class="players-section">
                            <h2>Player Slots</h2>
                            <div class="player-slots-grid" id="player-slots-grid">
                                <!-- Player slots will be dynamically generated -->
                            </div>
                        </div>

                        <div class="players-section">
                            <h2>Available Players</h2>
                            <div class="available-players-list" id="available-players-list">
                                <div class="loading-state">
                                    <i class="fas fa-spinner fa-spin"></i>
                                    <span>Loading players...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Review Step -->
                <div class="step-content" id="review-step">
                    <div class="review-container">
                        <div class="review-section">
                            <h2>Game Summary</h2>
                            <div class="game-summary-card">
                                <div class="summary-item">
                                    <div class="summary-label">
                                        <i class="fas fa-users"></i>
                                        <span>Players</span>
                                    </div>
                                    <div class="summary-value" id="summary-players">4 players max</div>
                                </div>
                                
                                <div class="summary-item">
                                    <div class="summary-label">
                                        <i class="fas fa-clock"></i>
                                        <span>Timer</span>
                                    </div>
                                    <div class="summary-value" id="summary-timer">2 minutes per turn</div>
                                </div>
                                
                                <div class="summary-item">
                                    <div class="summary-label">
                                        <i class="fas fa-gamepad"></i>
                                        <span>Mode</span>
                                    </div>
                                    <div class="summary-value" id="summary-mode">Standard Game</div>
                                </div>
                                
                                <div class="summary-item">
                                    <div class="summary-label">
                                        <i class="fas fa-lock"></i>
                                        <span>Privacy</span>
                                    </div>
                                    <div class="summary-value" id="summary-privacy">Public Game</div>
                                </div>
                            </div>
                        </div>

                        <div class="review-section">
                            <h2>Invited Players</h2>
                            <div class="invited-players-preview" id="invited-players-preview">
                                <div class="empty-state">
                                    <i class="fas fa-user-plus"></i>
                                    <span>No players invited yet</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="mobile-game-creation-actions">
                <button class="action-btn secondary" id="previous-step-btn" style="display: none;">
                    <i class="fas fa-arrow-left"></i>
                    <span>Previous</span>
                </button>
                
                <button class="action-btn primary" id="next-step-btn">
                    <span>Next</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
                
                <button class="action-btn primary create-game-btn" id="create-game-btn" style="display: none;">
                    <i class="fas fa-plus"></i>
                    <span>Create Game</span>
                </button>
            </div>

            <!-- Loading Overlay -->
            <div class="loading-overlay" id="game-creation-loading" style="display: none;">
                <div class="loading-content">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <h3>Creating Game...</h3>
                    <p>Setting up your game room</p>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(this.screenElement);
    }

    setupEventListeners() {
        // Back button
        const backBtn = this.screenElement.querySelector('#mobile-game-creation-back');
        backBtn.addEventListener('click', () => {
            this.navigateToLobby();
        });

        // Help button
        const helpBtn = this.screenElement.querySelector('#mobile-game-creation-help');
        helpBtn.addEventListener('click', () => {
            this.showHelp();
        });

        // Step navigation
        const stepNavBtns = this.screenElement.querySelectorAll('.step-nav-btn');
        stepNavBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const step = e.currentTarget.dataset.step;
                this.navigateToStep(step);
            });
        });

        // Action buttons
        const nextBtn = this.screenElement.querySelector('#next-step-btn');
        const prevBtn = this.screenElement.querySelector('#previous-step-btn');
        const createBtn = this.screenElement.querySelector('#create-game-btn');

        nextBtn.addEventListener('click', () => {
            this.nextStep();
        });

        prevBtn.addEventListener('click', () => {
            this.previousStep();
        });

        createBtn.addEventListener('click', () => {
            this.createGame();
        });

        // Settings controls
        this.setupSettingsControls();
    }

    setupSettingsControls() {
        // Player count controls
        const countBtns = this.screenElement.querySelectorAll('.count-btn');
        countBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const setting = e.currentTarget.dataset.setting;
                const action = e.currentTarget.dataset.action;
                this.updatePlayerCount(action);
            });
        });

        // Timer toggle
        const timerToggle = this.screenElement.querySelector('#timer-enabled');
        timerToggle.addEventListener('change', (e) => {
            this.gameSettings.timerEnabled = e.target.checked;
            this.updateTimerDurationVisibility();
            this.updateStepValidation();
        });

        // Timer duration buttons
        const durationBtns = this.screenElement.querySelectorAll('.duration-btn');
        durationBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const duration = parseInt(e.currentTarget.dataset.duration);
                this.updateTimerDuration(duration);
            });
        });

        // Game mode buttons
        const modeBtns = this.screenElement.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.updateGameMode(mode);
            });
        });

        // Privacy toggles
        const privateToggle = this.screenElement.querySelector('#private-game');
        privateToggle.addEventListener('change', (e) => {
            this.gameSettings.isPrivate = e.target.checked;
            this.updateStepValidation();
        });

        const spectatorsToggle = this.screenElement.querySelector('#allow-spectators');
        spectatorsToggle.addEventListener('change', (e) => {
            this.gameSettings.allowSpectators = e.target.checked;
            this.updateStepValidation();
        });
    }

    initializePlayerSlots() {
        this.playerSlots = [];
        for (let i = 0; i < this.gameSettings.maxPlayers; i++) {
            this.playerSlots.push({
                id: i,
                player: null,
                isBot: false,
                isEmpty: true
            });
        }
        this.renderPlayerSlots();
    }

    updatePlayerCount(action) {
        const currentCount = this.gameSettings.maxPlayers;
        let newCount = currentCount;

        if (action === 'increase' && currentCount < 6) {
            newCount = currentCount + 1;
        } else if (action === 'decrease' && currentCount > 2) {
            newCount = currentCount - 1;
        }

        if (newCount !== currentCount) {
            this.gameSettings.maxPlayers = newCount;
            this.screenElement.querySelector('#max-players-display').textContent = newCount;
            
            // Update player slots
            this.initializePlayerSlots();
            this.updateStepValidation();
            
            // Add visual feedback
            this.addSettingFeedback('maxPlayers');
        }
    }

    updateTimerDuration(duration) {
        this.gameSettings.timerDuration = duration;
        
        // Update active button
        const durationBtns = this.screenElement.querySelectorAll('.duration-btn');
        durationBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.duration) === duration);
        });
        
        this.addSettingFeedback('timerDuration');
        this.updateStepValidation();
    }

    updateGameMode(mode) {
        this.gameSettings.gameMode = mode;
        
        // Update active button
        const modeBtns = this.screenElement.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        this.addSettingFeedback('gameMode');
        this.updateStepValidation();
    }

    updateTimerDurationVisibility() {
        const durationSetting = this.screenElement.querySelector('.timer-duration-setting');
        durationSetting.style.display = this.gameSettings.timerEnabled ? 'flex' : 'none';
    }

    addSettingFeedback(settingName) {
        // Add visual feedback for setting changes
        const settingItem = this.screenElement.querySelector(`[data-setting="${settingName}"]`)?.closest('.setting-item') ||
                           this.screenElement.querySelector('.setting-item');
        
        if (settingItem) {
            settingItem.classList.add('setting-updated');
            setTimeout(() => {
                settingItem.classList.remove('setting-updated');
            }, 300);
        }
    }

    renderPlayerSlots() {
        const slotsGrid = this.screenElement.querySelector('#player-slots-grid');
        
        const slotsHTML = this.playerSlots.map((slot, index) => {
            return this.createPlayerSlotHTML(slot, index);
        }).join('');
        
        slotsGrid.innerHTML = slotsHTML;
        
        // Add event listeners to player slots
        this.setupPlayerSlotListeners();
    }

    createPlayerSlotHTML(slot, index) {
        if (slot.isEmpty) {
            return `
                <div class="player-slot empty" data-slot-id="${slot.id}">
                    <div class="slot-content">
                        <div class="slot-avatar">
                            <i class="fas fa-plus"></i>
                        </div>
                        <div class="slot-info">
                            <span class="slot-label">Player ${index + 1}</span>
                            <span class="slot-status">Empty</span>
                        </div>
                    </div>
                    <div class="slot-actions">
                        <button class="slot-action-btn add-player" data-slot-id="${slot.id}">
                            <i class="fas fa-user-plus"></i>
                        </button>
                        <button class="slot-action-btn add-bot" data-slot-id="${slot.id}">
                            <i class="fas fa-robot"></i>
                        </button>
                    </div>
                </div>
            `;
        } else if (slot.isBot) {
            const botName = slot.botConfig ? slot.botConfig.name : 'Bot Player';
            const botDifficulty = slot.botConfig ? slot.botConfig.difficulty : 'medium';
            
            return `
                <div class="player-slot bot" data-slot-id="${slot.id}">
                    <div class="slot-content">
                        <div class="slot-avatar bot-avatar ${botDifficulty}">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="slot-info">
                            <span class="slot-label">${botName}</span>
                            <span class="slot-status">${botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1)} AI</span>
                        </div>
                    </div>
                    <div class="slot-actions">
                        <button class="slot-action-btn configure-bot" data-slot-id="${slot.id}" title="Configure Bot">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button class="slot-action-btn remove-player" data-slot-id="${slot.id}" title="Remove Bot">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="player-slot filled" data-slot-id="${slot.id}">
                    <div class="slot-content">
                        <div class="slot-avatar player-avatar">
                            <span>${slot.player.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="slot-info">
                            <span class="slot-label">${slot.player.username}</span>
                            <span class="slot-status">Invited</span>
                        </div>
                    </div>
                    <div class="slot-actions">
                        <button class="slot-action-btn remove-player" data-slot-id="${slot.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    setupPlayerSlotListeners() {
        // Add player buttons
        const addPlayerBtns = this.screenElement.querySelectorAll('.add-player');
        addPlayerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.currentTarget.dataset.slotId);
                this.showPlayerSelection(slotId);
            });
        });

        // Add bot buttons
        const addBotBtns = this.screenElement.querySelectorAll('.add-bot');
        addBotBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.currentTarget.dataset.slotId);
                this.addBotToSlot(slotId);
            });
        });

        // Configure bot buttons
        const configureBotBtns = this.screenElement.querySelectorAll('.configure-bot');
        configureBotBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.currentTarget.dataset.slotId);
                this.configureBotPlayer(slotId);
            });
        });

        // Remove player buttons
        const removePlayerBtns = this.screenElement.querySelectorAll('.remove-player');
        removePlayerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.currentTarget.dataset.slotId);
                this.removePlayerFromSlot(slotId);
            });
        });
    }

    async loadAvailablePlayers() {
        const playersList = this.screenElement.querySelector('#available-players-list');
        
        try {
            const response = await fetch('/api/players/online', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load players');
            }

            const players = await response.json();
            
            // Filter out current user
            const currentUsername = localStorage.getItem('username');
            this.availablePlayers = players.filter(player => player.username !== currentUsername);
            
            this.renderAvailablePlayers();

        } catch (error) {
            console.error('Error loading players:', error);
            playersList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Players</h3>
                    <p>Please check your connection and try again</p>
                </div>
            `;
        }
    }

    renderAvailablePlayers() {
        const playersList = this.screenElement.querySelector('#available-players-list');
        
        if (!this.availablePlayers || this.availablePlayers.length === 0) {
            playersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Players Available</h3>
                    <p>No other players are online right now</p>
                </div>
            `;
            return;
        }

        const playersHTML = this.availablePlayers.map(player => {
            const isInvited = this.invitedPlayers.some(invited => invited.id === player.id);
            
            return `
                <div class="available-player-card ${isInvited ? 'invited' : ''}" data-player-id="${player.id}">
                    <div class="player-avatar">
                        <span>${player.username.charAt(0).toUpperCase()}</span>
                        <div class="status-indicator ${player.status}"></div>
                    </div>
                    <div class="player-info">
                        <h3>${player.username}</h3>
                        <div class="player-status">
                            <i class="fas fa-circle"></i>
                            <span>${this.getPlayerStatusText(player.status)}</span>
                        </div>
                    </div>
                    <div class="player-actions">
                        ${isInvited ? `
                            <button class="invite-btn invited" disabled>
                                <i class="fas fa-check"></i>
                                Invited
                            </button>
                        ` : `
                            <button class="invite-btn" data-player-id="${player.id}">
                                <i class="fas fa-envelope"></i>
                                Invite
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        
        playersList.innerHTML = playersHTML;
        
        // Add event listeners
        const inviteBtns = playersList.querySelectorAll('.invite-btn:not(.invited)');
        inviteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerId = e.currentTarget.dataset.playerId;
                this.invitePlayerToSlot(playerId);
            });
        });
    }

    // Navigation methods
    navigateToStep(step) {
        if (this.currentStep === step) return;
        
        // Validate current step before moving
        if (!this.validateCurrentStep()) {
            this.showStepValidationError();
            return;
        }
        
        // Additional validation for specific step transitions
        if (!this.canNavigateToStep(step)) {
            this.showStepNavigationError(step);
            return;
        }
        
        this.currentStep = step;
        this.updateStepDisplay();
        this.updateStepNavigation();
        this.updateActionButtons();
        this.updateProgressBar();
        
        // Add smooth transition effect
        this.addStepTransitionEffect();
    }

    canNavigateToStep(targetStep) {
        const steps = ['settings', 'players', 'review'];
        const currentIndex = steps.indexOf(this.currentStep);
        const targetIndex = steps.indexOf(targetStep);
        
        // Can always go backwards
        if (targetIndex < currentIndex) {
            return true;
        }
        
        // Can only go forward one step at a time
        if (targetIndex > currentIndex + 1) {
            return false;
        }
        
        // Validate intermediate steps
        for (let i = 0; i < targetIndex; i++) {
            const stepName = steps[i];
            if (!this.validateStep(stepName)) {
                return false;
            }
        }
        
        return true;
    }

    validateStep(stepName) {
        switch (stepName) {
            case 'settings':
                return this.validateSettingsStep();
            case 'players':
                return this.validatePlayersStep();
            case 'review':
                return this.validateReviewStep();
            default:
                return true;
        }
    }

    showStepNavigationError(targetStep) {
        const stepNames = {
            'settings': 'Game Settings',
            'players': 'Player Management',
            'review': 'Review & Create'
        };
        
        const targetStepName = stepNames[targetStep] || targetStep;
        this.showToast(`Please complete previous steps before accessing ${targetStepName}`, 'error');
    }

    addStepTransitionEffect() {
        // Add visual feedback for step transitions
        const activeContent = this.screenElement.querySelector('.step-content.active');
        if (activeContent) {
            activeContent.style.opacity = '0';
            activeContent.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                activeContent.style.opacity = '1';
                activeContent.style.transform = 'translateY(0)';
            }, 50);
        }
    }

    nextStep() {
        const steps = ['settings', 'players', 'review'];
        const currentIndex = steps.indexOf(this.currentStep);
        
        if (currentIndex < steps.length - 1) {
            const nextStep = steps[currentIndex + 1];
            this.navigateToStep(nextStep);
        }
    }

    previousStep() {
        const steps = ['settings', 'players', 'review'];
        const currentIndex = steps.indexOf(this.currentStep);
        
        if (currentIndex > 0) {
            const prevStep = steps[currentIndex - 1];
            this.navigateToStep(prevStep);
        }
    }

    updateStepDisplay() {
        // Update step content visibility
        const stepContents = this.screenElement.querySelectorAll('.step-content');
        stepContents.forEach(content => {
            const isActive = content.id === `${this.currentStep}-step`;
            content.classList.toggle('active', isActive);
        });
        
        // Update step indicator text
        const stepTexts = {
            'settings': 'Game Settings',
            'players': 'Player Management',
            'review': 'Review & Create'
        };
        
        this.screenElement.querySelector('#step-indicator-text').textContent = stepTexts[this.currentStep];
    }

    updateStepNavigation() {
        // Update step navigation buttons
        const stepNavBtns = this.screenElement.querySelectorAll('.step-nav-btn');
        stepNavBtns.forEach(btn => {
            const isActive = btn.dataset.step === this.currentStep;
            btn.classList.toggle('active', isActive);
        });
    }

    updateActionButtons() {
        const nextBtn = this.screenElement.querySelector('#next-step-btn');
        const prevBtn = this.screenElement.querySelector('#previous-step-btn');
        const createBtn = this.screenElement.querySelector('#create-game-btn');
        
        // Show/hide previous button
        prevBtn.style.display = this.currentStep === 'settings' ? 'none' : 'flex';
        
        // Show/hide next vs create button
        if (this.currentStep === 'review') {
            nextBtn.style.display = 'none';
            createBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'flex';
            createBtn.style.display = 'none';
        }
        
        // Update review step content when entering review
        if (this.currentStep === 'review') {
            this.updateReviewSummary();
        }
    }

    updateProgressBar() {
        const steps = ['settings', 'players', 'review'];
        const currentIndex = steps.indexOf(this.currentStep);
        const progress = ((currentIndex + 1) / steps.length) * 100;
        
        const progressBar = this.screenElement.querySelector('#step-progress-bar');
        progressBar.style.width = `${progress}%`;
    }

    validateCurrentStep() {
        switch (this.currentStep) {
            case 'settings':
                return this.validateSettingsStep();
            case 'players':
                return this.validatePlayersStep();
            case 'review':
                return this.validateReviewStep();
            default:
                return true;
        }
    }

    validateSettingsStep() {
        // Basic validation - all settings have defaults, so always valid
        return true;
    }

    validatePlayersStep() {
        // At least one player slot should be filled (including bots)
        const filledSlots = this.playerSlots.filter(slot => !slot.isEmpty);
        return filledSlots.length >= 1;
    }

    validateReviewStep() {
        return this.validateSettingsStep() && this.validatePlayersStep();
    }

    updateStepValidation() {
        // Update UI based on validation state
        const isValid = this.validateCurrentStep();
        const nextBtn = this.screenElement.querySelector('#next-step-btn');
        const createBtn = this.screenElement.querySelector('#create-game-btn');
        
        if (this.currentStep === 'review') {
            createBtn.disabled = !isValid;
        } else {
            nextBtn.disabled = !isValid;
        }
    }

    showStepValidationError() {
        let message = 'Please complete all required fields';
        
        if (this.currentStep === 'players') {
            message = 'Please add at least one player or bot to continue';
        }
        
        this.showToast(message, 'error');
    }

    // Player management methods
    showPlayerSelection(slotId) {
        // Create player selection modal
        const modal = document.createElement('div');
        modal.className = 'player-selection-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Select Player</h2>
                    <button class="close-modal-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="player-selection-list" id="player-selection-list">
                        ${this.renderPlayerSelectionList()}
                    </div>
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
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal-btn');
        const backdrop = modal.querySelector('.modal-backdrop');

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

        // Add player selection listeners
        const playerCards = modal.querySelectorAll('.selectable-player-card');
        playerCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const playerId = e.currentTarget.dataset.playerId;
                this.addPlayerToSlot(slotId, playerId);
                closeModal();
            });
        });

        // Show modal with animation
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 50);
    }

    renderPlayerSelectionList() {
        if (!this.availablePlayers || this.availablePlayers.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Players Available</h3>
                    <p>No other players are online right now</p>
                </div>
            `;
        }

        // Filter out already invited players
        const availableForSelection = this.availablePlayers.filter(player => 
            !this.invitedPlayers.some(invited => invited.id === player.id)
        );

        if (availableForSelection.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-user-check"></i>
                    <h3>All Players Invited</h3>
                    <p>You've already invited all available players</p>
                </div>
            `;
        }

        return availableForSelection.map(player => `
            <div class="selectable-player-card" data-player-id="${player.id}">
                <div class="player-avatar">
                    <span>${player.username.charAt(0).toUpperCase()}</span>
                    <div class="status-indicator ${player.status}"></div>
                </div>
                <div class="player-info">
                    <h3>${player.username}</h3>
                    <div class="player-status">
                        <i class="fas fa-circle"></i>
                        <span>${this.getPlayerStatusText(player.status)}</span>
                    </div>
                    <div class="player-stats">
                        <span class="stat">
                            <i class="fas fa-trophy"></i>
                            ${player.wins || 0} wins
                        </span>
                        <span class="stat">
                            <i class="fas fa-gamepad"></i>
                            ${player.gamesPlayed || 0} games
                        </span>
                    </div>
                </div>
                <div class="selection-indicator">
                    <i class="fas fa-plus"></i>
                </div>
            </div>
        `).join('');
    }

    addPlayerToSlot(slotId, playerId) {
        const player = this.availablePlayers.find(p => p.id === playerId);
        const slot = this.playerSlots.find(s => s.id === slotId);
        
        if (!player || !slot || !slot.isEmpty) return;
        
        // Add player to slot
        slot.isEmpty = false;
        slot.isBot = false;
        slot.player = player;
        
        // Add to invited players list
        this.invitedPlayers.push(player);
        
        // Update UI
        this.renderPlayerSlots();
        this.renderAvailablePlayers();
        this.updateStepValidation();
        
        this.showToast(`${player.username} added to game`, 'success');
    }

    addBotToSlot(slotId) {
        const slot = this.playerSlots.find(s => s.id === slotId);
        if (slot && slot.isEmpty) {
            // Show bot configuration modal
            this.showBotConfigurationModal(slotId);
        }
    }

    showBotConfigurationModal(slotId, existingConfig = null) {
        const modal = document.createElement('div');
        modal.className = 'bot-configuration-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add Bot Player</h2>
                    <button class="close-modal-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="bot-options">
                        <div class="bot-difficulty-section">
                            <h3>Bot Difficulty</h3>
                            <div class="difficulty-options">
                                <button class="difficulty-btn active" data-difficulty="easy">
                                    <i class="fas fa-seedling"></i>
                                    <span>Easy</span>
                                    <div class="difficulty-description">Good for beginners</div>
                                </button>
                                <button class="difficulty-btn" data-difficulty="medium">
                                    <i class="fas fa-balance-scale"></i>
                                    <span>Medium</span>
                                    <div class="difficulty-description">Balanced challenge</div>
                                </button>
                                <button class="difficulty-btn" data-difficulty="hard">
                                    <i class="fas fa-fire"></i>
                                    <span>Hard</span>
                                    <div class="difficulty-description">Expert level</div>
                                </button>
                            </div>
                        </div>
                        
                        <div class="bot-personality-section">
                            <h3>Bot Personality</h3>
                            <div class="personality-options">
                                <button class="personality-btn active" data-personality="balanced">
                                    <i class="fas fa-user"></i>
                                    <span>Balanced</span>
                                </button>
                                <button class="personality-btn" data-personality="aggressive">
                                    <i class="fas fa-fist-raised"></i>
                                    <span>Aggressive</span>
                                </button>
                                <button class="personality-btn" data-personality="defensive">
                                    <i class="fas fa-shield-alt"></i>
                                    <span>Defensive</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" id="cancel-bot-btn">Cancel</button>
                    <button class="modal-btn primary" id="add-bot-btn">Add Bot</button>
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
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(modal);

        let selectedDifficulty = existingConfig ? existingConfig.difficulty : 'easy';
        let selectedPersonality = existingConfig ? existingConfig.personality : 'balanced';

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal-btn');
        const backdrop = modal.querySelector('.modal-backdrop');
        const cancelBtn = modal.querySelector('#cancel-bot-btn');
        const addBtn = modal.querySelector('#add-bot-btn');

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
        cancelBtn.addEventListener('click', closeModal);

        // Difficulty selection
        const difficultyBtns = modal.querySelectorAll('.difficulty-btn');
        difficultyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                difficultyBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                selectedDifficulty = e.currentTarget.dataset.difficulty;
            });
        });

        // Personality selection
        const personalityBtns = modal.querySelectorAll('.personality-btn');
        personalityBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                personalityBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                selectedPersonality = e.currentTarget.dataset.personality;
            });
        });

        // Add bot button
        addBtn.addEventListener('click', () => {
            this.createBotPlayer(slotId, selectedDifficulty, selectedPersonality);
            closeModal();
        });

        // Show modal with animation
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 50);
    }

    createBotPlayer(slotId, difficulty, personality) {
        const slot = this.playerSlots.find(s => s.id === slotId);
        if (slot && slot.isEmpty) {
            slot.isEmpty = false;
            slot.isBot = true;
            slot.player = null;
            slot.botConfig = {
                difficulty: difficulty,
                personality: personality,
                name: this.generateBotName(difficulty, personality)
            };
            
            this.renderPlayerSlots();
            this.updateStepValidation();
            
            const difficultyText = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
            this.showToast(`${difficultyText} bot player added`, 'success');
        }
    }

    generateBotName(difficulty, personality) {
        const names = {
            easy: ['Rookie', 'Newbie', 'Learner', 'Beginner'],
            medium: ['Player', 'Challenger', 'Competitor', 'Rival'],
            hard: ['Expert', 'Master', 'Champion', 'Ace']
        };
        
        const difficultyNames = names[difficulty] || names.medium;
        const randomName = difficultyNames[Math.floor(Math.random() * difficultyNames.length)];
        
        return `${randomName} Bot`;
    }

    configureBotPlayer(slotId) {
        const slot = this.playerSlots.find(s => s.id === slotId);
        if (slot && slot.isBot) {
            // Show bot configuration modal with current settings
            this.showBotConfigurationModal(slotId, slot.botConfig);
        }
    }

    removePlayerFromSlot(slotId) {
        const slot = this.playerSlots.find(s => s.id === slotId);
        if (slot && !slot.isEmpty) {
            // If removing a real player, remove from invited list
            if (!slot.isBot && slot.player) {
                this.invitedPlayers = this.invitedPlayers.filter(p => p.id !== slot.player.id);
                this.renderAvailablePlayers();
            }
            
            slot.isEmpty = true;
            slot.isBot = false;
            slot.player = null;
            
            this.renderPlayerSlots();
            this.updateStepValidation();
            this.showToast('Player removed', 'info');
        }
    }

    invitePlayerToSlot(playerId) {
        const player = this.availablePlayers.find(p => p.id === playerId);
        if (!player) return;
        
        // Find first empty slot
        const emptySlot = this.playerSlots.find(slot => slot.isEmpty);
        if (!emptySlot) {
            this.showToast('All player slots are full', 'error');
            return;
        }
        
        // Add player to slot
        emptySlot.isEmpty = false;
        emptySlot.isBot = false;
        emptySlot.player = player;
        
        // Add to invited players list
        this.invitedPlayers.push(player);
        
        // Update UI
        this.renderPlayerSlots();
        this.renderAvailablePlayers();
        this.updateStepValidation();
        
        this.showToast(`${player.username} invited to game`, 'success');
    }

    updateReviewSummary() {
        // Update players summary
        const playersText = `${this.gameSettings.maxPlayers} players max`;
        this.screenElement.querySelector('#summary-players').textContent = playersText;
        
        // Update timer summary
        const timerText = this.gameSettings.timerEnabled 
            ? `${Math.floor(this.gameSettings.timerDuration / 60)} minutes per turn`
            : 'No timer';
        this.screenElement.querySelector('#summary-timer').textContent = timerText;
        
        // Update mode summary
        const modeText = this.gameSettings.gameMode === 'standard' ? 'Standard Game' : 'Quick Play';
        this.screenElement.querySelector('#summary-mode').textContent = modeText;
        
        // Update privacy summary
        const privacyText = this.gameSettings.isPrivate ? 'Private Game' : 'Public Game';
        this.screenElement.querySelector('#summary-privacy').textContent = privacyText;
        
        // Update invited players preview
        this.updateInvitedPlayersPreview();
    }

    updateInvitedPlayersPreview() {
        const preview = this.screenElement.querySelector('#invited-players-preview');
        
        if (this.invitedPlayers.length === 0) {
            preview.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus"></i>
                    <span>No players invited yet</span>
                </div>
            `;
            return;
        }
        
        const playersHTML = this.invitedPlayers.map(player => `
            <div class="invited-player-preview">
                <div class="player-avatar">
                    <span>${player.username.charAt(0).toUpperCase()}</span>
                </div>
                <span class="player-name">${player.username}</span>
            </div>
        `).join('');
        
        preview.innerHTML = playersHTML;
    }

    // Game creation
    async createGame() {
        if (this.isCreating) return;
        
        // Final validation before creation
        if (!this.validateReviewStep()) {
            this.showToast('Please complete all required fields before creating the game', 'error');
            return;
        }
        
        this.isCreating = true;
        this.showLoadingOverlay();
        
        try {
            const gameData = {
                maxPlayers: this.gameSettings.maxPlayers,
                timerEnabled: this.gameSettings.timerEnabled,
                timerDuration: this.gameSettings.timerDuration,
                gameMode: this.gameSettings.gameMode,
                isPrivate: this.gameSettings.isPrivate,
                allowSpectators: this.gameSettings.allowSpectators,
                invitedPlayers: this.invitedPlayers.map(p => p.id),
                botPlayers: this.playerSlots.filter(slot => slot.isBot).length,
                // Include bot configurations
                botConfigurations: this.playerSlots
                    .filter(slot => slot.isBot && slot.botConfig)
                    .map(slot => slot.botConfig)
            };
            
            console.log('Creating game with data:', gameData);
            
            const response = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gameData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }
            
            const result = await response.json();
            
            console.log('Game created successfully:', result);
            
            // Navigate to the created game
            this.navigateToGame(result.gameId);
            
        } catch (error) {
            console.error('Error creating game:', error);
            
            let errorMessage = 'Failed to create game. Please try again.';
            
            // Provide more specific error messages
            if (error.message.includes('Network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message.includes('401')) {
                errorMessage = 'Authentication error. Please log in again.';
            } else if (error.message.includes('403')) {
                errorMessage = 'You do not have permission to create games.';
            } else if (error.message.includes('400')) {
                errorMessage = 'Invalid game settings. Please check your configuration.';
            }
            
            this.showToast(errorMessage, 'error');
            this.hideLoadingOverlay();
        } finally {
            this.isCreating = false;
        }
    }

    showLoadingOverlay() {
        const overlay = this.screenElement.querySelector('#game-creation-loading');
        overlay.style.display = 'flex';
        
        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 50);
    }

    hideLoadingOverlay() {
        const overlay = this.screenElement.querySelector('#game-creation-loading');
        overlay.style.opacity = '0';
        
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }

    navigateToLobby() {
        // Check if user has made changes
        if (this.hasUnsavedChanges()) {
            this.showConfirmationDialog(
                'Discard Changes?',
                'You have unsaved changes. Are you sure you want to leave?',
                () => {
                    this.performNavigationToLobby();
                }
            );
        } else {
            this.performNavigationToLobby();
        }
    }

    performNavigationToLobby() {
        if (window.mobileUISystem) {
            window.mobileUISystem.emit('navigateToLobby');
        } else {
            // Fallback navigation
            window.location.href = 'mobile-lobby-demo.html';
        }
    }

    hasUnsavedChanges() {
        // Check if any players have been invited or bots added
        const hasInvitedPlayers = this.invitedPlayers.length > 0;
        const hasBots = this.playerSlots.some(slot => slot.isBot);
        
        // Check if settings have been changed from defaults
        const defaultSettings = {
            maxPlayers: 4,
            timerEnabled: true,
            timerDuration: 120,
            gameMode: 'standard',
            isPrivate: false,
            allowSpectators: true
        };
        
        const hasChangedSettings = Object.keys(defaultSettings).some(key => 
            this.gameSettings[key] !== defaultSettings[key]
        );
        
        return hasInvitedPlayers || hasBots || hasChangedSettings;
    }

    showConfirmationDialog(title, message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'confirmation-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" id="cancel-confirmation">Cancel</button>
                    <button class="modal-btn primary destructive" id="confirm-action">Leave</button>
                </div>
            </div>
        `;

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
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(modal);

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) {
                    document.body.removeChild(modal);
                }
            }, 300);
        };

        const cancelBtn = modal.querySelector('#cancel-confirmation');
        const confirmBtn = modal.querySelector('#confirm-action');
        const backdrop = modal.querySelector('.modal-backdrop');

        cancelBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);
        
        confirmBtn.addEventListener('click', () => {
            closeModal();
            onConfirm();
        });

        // Show modal with animation
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 50);
    }

    navigateToGame(gameId) {
        // Show success message before navigation
        this.showToast('Game created successfully!', 'success');
        
        // Add slight delay for user feedback
        setTimeout(() => {
            if (gameId) {
                window.location.href = `index.html?game=${gameId}`;
            } else {
                // Fallback to main game page
                window.location.href = 'index.html';
            }
        }, 1000);
    }

    // Utility methods
    getPlayerStatusText(status) {
        const statusMap = {
            'online': 'Online',
            'in_game': 'In game',
            'away': 'Away'
        };
        return statusMap[status] || status;
    }

    showHelp() {
        // Show help modal with game creation tips
        console.log('Show help modal');
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
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // Screen management
    show() {
        this.screenElement.style.display = 'flex';
        this.isVisible = true;
        
        // Apply mobile optimizations
        document.body.classList.add('mobile-game-creation-active');
        
        // Reset to first step
        this.currentStep = 'settings';
        this.updateStepDisplay();
        this.updateStepNavigation();
        this.updateActionButtons();
        this.updateProgressBar();
        
        // Load fresh data
        this.loadAvailablePlayers();
    }

    hide() {
        this.screenElement.style.display = 'none';
        this.isVisible = false;
        
        // Remove mobile optimizations
        document.body.classList.remove('mobile-game-creation-active');
    }

    destroy() {
        if (this.screenElement && this.screenElement.parentNode) {
            this.screenElement.parentNode.removeChild(this.screenElement);
        }
        
        document.body.classList.remove('mobile-game-creation-active');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileGameCreationScreen;
} else if (typeof window !== 'undefined') {
    window.MobileGameCreationScreen = MobileGameCreationScreen;
}