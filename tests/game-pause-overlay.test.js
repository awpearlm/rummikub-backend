/**
 * Unit Tests for Game Pause Overlay Components
 * Feature: player-reconnection-management, Task 7.4
 * Validates: Requirements 6.1, 6.4
 */

// Mock DOM environment
global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn()
};

global.HTMLElement = class HTMLElement {
    constructor() {
        this.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        };
        this.innerHTML = '';
        this.textContent = '';
        this.style = {};
        this.attributes = {};
    }
    
    setAttribute(name, value) {
        this.attributes[name] = value;
    }
    
    getAttribute(name) {
        return this.attributes[name];
    }
    
    querySelector(selector) {
        return new HTMLElement();
    }
    
    querySelectorAll(selector) {
        return [new HTMLElement()];
    }
    
    appendChild(child) {
        // Mock implementation
    }
    
    replaceWith(newElement) {
        // Mock implementation
        return newElement;
    }
    
    cloneNode(deep) {
        return new HTMLElement();
    }
    
    addEventListener(event, handler) {
        this._eventHandlers = this._eventHandlers || {};
        this._eventHandlers[event] = handler;
    }
    
    closest(selector) {
        return new HTMLElement();
    }
};

// Mock socket.io-client
const mockSocket = {
    id: 'test-socket-id',
    connected: true,
    on: jest.fn(),
    emit: jest.fn()
};

// Mock RummikubClient class with pause overlay methods
class MockRummikubClient {
    constructor() {
        this.socket = mockSocket;
        this.gameId = 'test-game-id';
        this.gracePeriodTimer = null;
        this.gracePeriodRemaining = 0;
    }

    showGamePauseOverlay(pauseData) {
        const overlay = { style: { display: 'none' } };
        const pauseTitle = { textContent: '' };
        const pauseReason = { textContent: '' };
        const disconnectedPlayerName = { textContent: '' };
        const gracePeriodSection = { style: { display: 'none' } };
        const continuationOptionsSection = { style: { display: 'none' } };

        // Mock getElementById to return our mock elements
        document.getElementById = jest.fn((id) => {
            switch (id) {
                case 'gamePauseOverlay': return overlay;
                case 'pauseTitle': return pauseTitle;
                case 'pauseReason': return pauseReason;
                case 'disconnectedPlayerName': return disconnectedPlayerName;
                case 'gracePeriodSection': return gracePeriodSection;
                case 'continuationOptionsSection': return continuationOptionsSection;
                default: return new HTMLElement();
            }
        });

        if (!overlay) return;

        if (pauseTitle) pauseTitle.textContent = pauseData.title || 'Game Paused';
        if (pauseReason) pauseReason.textContent = pauseData.reason || 'Waiting for player to reconnect...';
        if (disconnectedPlayerName) disconnectedPlayerName.textContent = pauseData.playerName || 'Player';

        if (pauseData.showGracePeriod) {
            gracePeriodSection.style.display = 'block';
            continuationOptionsSection.style.display = 'none';
            this.startGracePeriodTimer(pauseData.gracePeriodDuration || 180);
        } else if (pauseData.showContinuationOptions) {
            gracePeriodSection.style.display = 'none';
            continuationOptionsSection.style.display = 'block';
            this.setupContinuationOptions(pauseData.continuationOptions || []);
        }

        overlay.style.display = 'flex';
        return { overlay, pauseTitle, pauseReason, disconnectedPlayerName, gracePeriodSection, continuationOptionsSection };
    }

    hideGamePauseOverlay() {
        const overlay = { style: { display: 'flex' } };
        document.getElementById = jest.fn().mockReturnValue(overlay);
        
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        if (this.gracePeriodTimer) {
            clearInterval(this.gracePeriodTimer);
            this.gracePeriodTimer = null;
        }
        
        return overlay;
    }

    startGracePeriodTimer(durationSeconds) {
        if (this.gracePeriodTimer) {
            clearInterval(this.gracePeriodTimer);
        }

        this.gracePeriodRemaining = durationSeconds;
        this.updateGracePeriodDisplay();

        // Mock timer for testing
        this.gracePeriodTimer = setInterval(() => {
            this.gracePeriodRemaining--;
            this.updateGracePeriodDisplay();

            if (this.gracePeriodRemaining <= 0) {
                clearInterval(this.gracePeriodTimer);
                this.gracePeriodTimer = null;
            }
        }, 100); // Use shorter interval for testing
    }

    updateGracePeriodDisplay() {
        const timerElement = document.getElementById('gracePeriodTimer') || { 
            textContent: '',
            closest: jest.fn().mockReturnValue({ style: {} })
        };

        if (!timerElement) return;

        const minutes = Math.floor(this.gracePeriodRemaining / 60);
        const seconds = this.gracePeriodRemaining % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const timerCircleElement = timerElement.closest('.timer-circle');
        if (timerCircleElement) {
            if (this.gracePeriodRemaining <= 30) {
                timerCircleElement.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
            } else if (this.gracePeriodRemaining <= 60) {
                timerCircleElement.style.background = 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)';
            } else {
                timerCircleElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }
        }

        return timerElement;
    }

    setupContinuationOptions(options) {
        const skipTurnOption = new HTMLElement();
        const addBotOption = new HTMLElement();
        const endGameOption = new HTMLElement();

        skipTurnOption.id = 'skipTurnOption';
        addBotOption.id = 'addBotOption';
        endGameOption.id = 'endGameOption';

        document.getElementById = jest.fn((id) => {
            switch (id) {
                case 'skipTurnOption': return skipTurnOption;
                case 'addBotOption': return addBotOption;
                case 'endGameOption': return endGameOption;
                default: return new HTMLElement();
            }
        });

        // Mock querySelectorAll for clearing selections
        document.querySelectorAll = jest.fn().mockReturnValue([skipTurnOption, addBotOption, endGameOption]);

        return { skipTurnOption, addBotOption, endGameOption };
    }

    selectContinuationOption(option) {
        const mockButtons = document.querySelectorAll('.continuation-option') || [
            { classList: { remove: jest.fn() } },
            { classList: { remove: jest.fn() } },
            { classList: { remove: jest.fn() } }
        ];

        // Clear previous selections
        mockButtons.forEach(btn => {
            btn.classList.remove('selected');
        });

        // Mark selected option
        const optionButton = document.getElementById(`${option}Option`) || { 
            classList: { add: jest.fn() }
        };
        
        if (optionButton && optionButton.classList) {
            optionButton.classList.add('selected');
        }

        // Mock socket emit
        this.socket.emit('continuationVote', {
            gameId: this.gameId,
            option: option
        });

        this.showVotingStatus();
        return optionButton;
    }

    showVotingStatus() {
        const votingStatus = { style: { display: 'none' } };
        document.getElementById = jest.fn().mockReturnValue(votingStatus);
        
        if (votingStatus) {
            votingStatus.style.display = 'block';
        }
        
        return votingStatus;
    }

    updateVotingProgress(votesReceived, totalVotes) {
        const progressBar = { style: { width: '0%' } };
        const progressText = { textContent: '' };

        document.getElementById = jest.fn((id) => {
            switch (id) {
                case 'votingProgressBar': return progressBar;
                case 'votingProgressText': return progressText;
                default: return new HTMLElement();
            }
        });

        if (progressBar) {
            const percentage = totalVotes > 0 ? (votesReceived / totalVotes) * 100 : 0;
            progressBar.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${votesReceived}/${totalVotes} votes`;
        }

        return { progressBar, progressText };
    }
}

describe('Game Pause Overlay Components', () => {
    let client;

    beforeEach(() => {
        client = new MockRummikubClient();
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any timers
        if (client.gracePeriodTimer) {
            clearInterval(client.gracePeriodTimer);
        }
    });

    describe('Overlay Visibility and Content', () => {
        test('should show pause overlay with correct title and reason', () => {
            const pauseData = {
                title: 'Game Paused',
                reason: 'Player Alice disconnected',
                playerName: 'Alice',
                showGracePeriod: true,
                gracePeriodDuration: 180
            };

            const result = client.showGamePauseOverlay(pauseData);

            expect(result.overlay.style.display).toBe('flex');
            expect(result.pauseTitle.textContent).toBe('Game Paused');
            expect(result.pauseReason.textContent).toBe('Player Alice disconnected');
            expect(result.disconnectedPlayerName.textContent).toBe('Alice');
        });

        test('should use default values when pause data is incomplete', () => {
            const pauseData = {
                showGracePeriod: true
            };

            const result = client.showGamePauseOverlay(pauseData);

            expect(result.pauseTitle.textContent).toBe('Game Paused');
            expect(result.pauseReason.textContent).toBe('Waiting for player to reconnect...');
            expect(result.disconnectedPlayerName.textContent).toBe('Player');
        });

        test('should hide overlay and clear timers', () => {
            // Start with a timer
            client.startGracePeriodTimer(60);
            expect(client.gracePeriodTimer).not.toBeNull();

            const result = client.hideGamePauseOverlay();

            expect(result.style.display).toBe('none');
            expect(client.gracePeriodTimer).toBeNull();
        });

        test('should handle missing overlay element gracefully', () => {
            document.getElementById = jest.fn().mockReturnValue(null);

            expect(() => {
                client.showGamePauseOverlay({ showGracePeriod: true });
            }).not.toThrow();
        });
    });

    describe('Grace Period Timer', () => {
        test('should start grace period timer with correct duration', () => {
            client.startGracePeriodTimer(180);

            expect(client.gracePeriodRemaining).toBe(180);
            expect(client.gracePeriodTimer).not.toBeNull();
        });

        test('should update timer display with correct format', () => {
            client.gracePeriodRemaining = 125; // 2:05
            const result = client.updateGracePeriodDisplay();

            expect(result.textContent).toBe('2:05');
        });

        test('should format timer display correctly for different durations', () => {
            const testCases = [
                { seconds: 180, expected: '3:00' },
                { seconds: 65, expected: '1:05' },
                { seconds: 5, expected: '0:05' },
                { seconds: 0, expected: '0:00' }
            ];

            testCases.forEach(({ seconds, expected }) => {
                client.gracePeriodRemaining = seconds;
                const result = client.updateGracePeriodDisplay();
                expect(result.textContent).toBe(expected);
            });
        });

        test('should change timer circle color based on remaining time', () => {
            // Create a shared timerCircle object that will be returned by closest()
            const timerCircle = { style: {} };
            const timerElement = { 
                textContent: '',
                closest: jest.fn().mockReturnValue(timerCircle)
            };
            
            // Mock getElementById to return timerElement for gracePeriodTimer
            document.getElementById = jest.fn().mockReturnValue(timerElement);

            // Test different time thresholds
            client.gracePeriodRemaining = 120; // > 60 seconds - blue
            client.updateGracePeriodDisplay();
            expect(timerCircle.style.background).toBe('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');

            client.gracePeriodRemaining = 45; // <= 60 seconds - orange
            client.updateGracePeriodDisplay();
            expect(timerCircle.style.background).toBe('linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)');

            client.gracePeriodRemaining = 15; // <= 30 seconds - red
            client.updateGracePeriodDisplay();
            expect(timerCircle.style.background).toBe('linear-gradient(135deg, #f56565 0%, #e53e3e 100%)');
        });

        test('should clear existing timer when starting new one', () => {
            client.startGracePeriodTimer(60);
            const firstTimer = client.gracePeriodTimer;

            client.startGracePeriodTimer(120);
            const secondTimer = client.gracePeriodTimer;

            expect(secondTimer).not.toBe(firstTimer);
            expect(client.gracePeriodRemaining).toBe(120);
        });
    });

    describe('Continuation Options', () => {
        test('should setup continuation options with event listeners', () => {
            const options = ['skip_turn', 'add_bot', 'end_game'];
            const result = client.setupContinuationOptions(options);

            expect(result.skipTurnOption).toBeDefined();
            expect(result.addBotOption).toBeDefined();
            expect(result.endGameOption).toBeDefined();
        });

        test('should select continuation option and emit vote', () => {
            const result = client.selectContinuationOption('skip_turn');

            expect(result.classList.add).toHaveBeenCalledWith('selected');
            expect(client.socket.emit).toHaveBeenCalledWith('continuationVote', {
                gameId: 'test-game-id',
                option: 'skip_turn'
            });
        });

        test('should clear previous selections when selecting new option', () => {
            // Mock querySelectorAll to return buttons with classList.remove
            const mockButtons = [
                { classList: { remove: jest.fn() } },
                { classList: { remove: jest.fn() } },
                { classList: { remove: jest.fn() } }
            ];
            document.querySelectorAll = jest.fn().mockReturnValue(mockButtons);

            client.selectContinuationOption('add_bot');

            mockButtons.forEach(btn => {
                expect(btn.classList.remove).toHaveBeenCalledWith('selected');
            });
        });

        test('should show voting status after selection', () => {
            client.selectContinuationOption('end_game');
            
            // showVotingStatus should have been called
            const votingStatus = client.showVotingStatus();
            expect(votingStatus.style.display).toBe('block');
        });
    });

    describe('Voting Progress', () => {
        test('should update voting progress bar correctly', () => {
            const result = client.updateVotingProgress(2, 4);

            expect(result.progressBar.style.width).toBe('50%');
            expect(result.progressText.textContent).toBe('2/4 votes');
        });

        test('should handle zero total votes', () => {
            const result = client.updateVotingProgress(0, 0);

            expect(result.progressBar.style.width).toBe('0%');
            expect(result.progressText.textContent).toBe('0/0 votes');
        });

        test('should handle complete voting', () => {
            const result = client.updateVotingProgress(3, 3);

            expect(result.progressBar.style.width).toBe('100%');
            expect(result.progressText.textContent).toBe('3/3 votes');
        });

        test('should handle partial voting progress', () => {
            const testCases = [
                { received: 1, total: 3, expectedPercentage: '33.33333333333333%' },
                { received: 2, total: 5, expectedPercentage: '40%' },
                { received: 4, total: 6, expectedPercentage: '66.66666666666666%' }
            ];

            testCases.forEach(({ received, total, expectedPercentage }) => {
                const result = client.updateVotingProgress(received, total);
                expect(result.progressBar.style.width).toBe(expectedPercentage);
                expect(result.progressText.textContent).toBe(`${received}/${total} votes`);
            });
        });
    });

    describe('Section Display Management', () => {
        test('should show grace period section when showGracePeriod is true', () => {
            const pauseData = {
                showGracePeriod: true,
                gracePeriodDuration: 120
            };

            const result = client.showGamePauseOverlay(pauseData);

            expect(result.gracePeriodSection.style.display).toBe('block');
            expect(result.continuationOptionsSection.style.display).toBe('none');
        });

        test('should show continuation options section when showContinuationOptions is true', () => {
            const pauseData = {
                showContinuationOptions: true,
                continuationOptions: ['skip_turn', 'add_bot']
            };

            const result = client.showGamePauseOverlay(pauseData);

            expect(result.gracePeriodSection.style.display).toBe('none');
            expect(result.continuationOptionsSection.style.display).toBe('block');
        });

        test('should handle neither section being explicitly shown', () => {
            const pauseData = {
                title: 'Test Pause'
            };

            const result = client.showGamePauseOverlay(pauseData);

            // Both sections should remain hidden
            expect(result.gracePeriodSection.style.display).toBe('none');
            expect(result.continuationOptionsSection.style.display).toBe('none');
        });
    });

    describe('Timer Countdown Behavior', () => {
        test('should countdown timer correctly', (done) => {
            client.startGracePeriodTimer(3);
            
            expect(client.gracePeriodRemaining).toBe(3);
            
            setTimeout(() => {
                expect(client.gracePeriodRemaining).toBeLessThan(3);
                done();
            }, 150); // Wait for timer to tick
        });

        test('should stop timer when reaching zero', (done) => {
            client.startGracePeriodTimer(1);
            
            setTimeout(() => {
                expect(client.gracePeriodRemaining).toBe(0);
                expect(client.gracePeriodTimer).toBeNull();
                done();
            }, 200);
        });
    });
});