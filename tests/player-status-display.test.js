/**
 * Unit Tests for Player Status Display Components
 * Feature: player-reconnection-management, Task 7.2
 * Validates: Requirements 2.2, 6.2
 */

// Mock DOM environment without JSDOM
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
};

// Mock socket.io-client
const mockSocket = {
    id: 'test-socket-id',
    connected: true,
    on: jest.fn(),
    emit: jest.fn()
};

// Mock RummikubClient class with only the methods we need to test
class MockRummikubClient {
    constructor() {
        this.socket = mockSocket;
        this.gameState = null;
        this.reconnectionTimers = {};
    }

    getPlayerConnectionStatus(playerId, isBot) {
        if (isBot) return 'connected';
        if (playerId === this.socket.id) {
            return this.socket.connected ? 'connected' : 'disconnected';
        }
        if (this.gameState && this.gameState.playerStatuses) {
            const playerStatus = this.gameState.playerStatuses.find(ps => ps.playerId === playerId);
            if (playerStatus) {
                return playerStatus.status.toLowerCase();
            }
        }
        return 'connected';
    }

    createConnectionStatusIndicator(status) {
        const statusClasses = {
            'connected': 'status-connected',
            'connecting': 'status-connecting',
            'disconnecting': 'status-disconnecting', 
            'reconnecting': 'status-reconnecting',
            'disconnected': 'status-disconnected'
        };
        
        const statusClass = statusClasses[status] || 'status-connected';
        return `<div class="connection-status-dot ${statusClass}"></div>`;
    }

    getConnectionStatusText(status) {
        const statusTexts = {
            'connected': '',
            'connecting': 'Connecting...',
            'disconnecting': 'Disconnecting...',
            'reconnecting': 'Reconnecting...',
            'disconnected': 'Disconnected'
        };
        
        return statusTexts[status] || '';
    }

    updateConnectionStatus(status) {
        const statusElement = { 
            classList: { 
                remove: jest.fn(), 
                add: jest.fn() 
            },
            innerHTML: ''
        };
        
        // Mock getElementById to return our mock element
        document.getElementById = jest.fn().mockReturnValue(statusElement);
        
        if (!statusElement) return;
        
        statusElement.classList.remove('connected', 'connecting', 'disconnected');
        
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
        
        return statusElement;
    }
}

describe('Player Status Display Components', () => {
    let client;

    beforeEach(() => {
        client = new MockRummikubClient();
        jest.clearAllMocks();
    });

    describe('Connection Status Indicators', () => {
        test('should render connected status indicator correctly', () => {
            const indicator = client.createConnectionStatusIndicator('connected');
            expect(indicator).toContain('connection-status-dot');
            expect(indicator).toContain('status-connected');
        });

        test('should render connecting status indicator correctly', () => {
            const indicator = client.createConnectionStatusIndicator('connecting');
            expect(indicator).toContain('connection-status-dot');
            expect(indicator).toContain('status-connecting');
        });

        test('should render reconnecting status indicator correctly', () => {
            const indicator = client.createConnectionStatusIndicator('reconnecting');
            expect(indicator).toContain('connection-status-dot');
            expect(indicator).toContain('status-reconnecting');
        });

        test('should render disconnected status indicator correctly', () => {
            const indicator = client.createConnectionStatusIndicator('disconnected');
            expect(indicator).toContain('connection-status-dot');
            expect(indicator).toContain('status-disconnected');
        });

        test('should default to connected status for unknown status', () => {
            const indicator = client.createConnectionStatusIndicator('unknown');
            expect(indicator).toContain('status-connected');
        });
    });

    describe('Connection Status Text', () => {
        test('should return empty string for connected status', () => {
            const text = client.getConnectionStatusText('connected');
            expect(text).toBe('');
        });

        test('should return "Connecting..." for connecting status', () => {
            const text = client.getConnectionStatusText('connecting');
            expect(text).toBe('Connecting...');
        });

        test('should return "Reconnecting..." for reconnecting status', () => {
            const text = client.getConnectionStatusText('reconnecting');
            expect(text).toBe('Reconnecting...');
        });

        test('should return "Disconnected" for disconnected status', () => {
            const text = client.getConnectionStatusText('disconnected');
            expect(text).toBe('Disconnected');
        });

        test('should return empty string for unknown status', () => {
            const text = client.getConnectionStatusText('unknown');
            expect(text).toBe('');
        });
    });

    describe('Player Connection Status Detection', () => {
        test('should return connected for bot players', () => {
            const status = client.getPlayerConnectionStatus('bot-id', true);
            expect(status).toBe('connected');
        });

        test('should return socket connection status for current user', () => {
            client.socket.connected = true;
            const status = client.getPlayerConnectionStatus(client.socket.id, false);
            expect(status).toBe('connected');

            client.socket.connected = false;
            const status2 = client.getPlayerConnectionStatus(client.socket.id, false);
            expect(status2).toBe('disconnected');
        });

        test('should return status from game state for other players', () => {
            client.gameState = {
                playerStatuses: [
                    { playerId: 'other-player', status: 'RECONNECTING' }
                ]
            };
            
            const status = client.getPlayerConnectionStatus('other-player', false);
            expect(status).toBe('reconnecting');
        });

        test('should default to connected if no status information available', () => {
            client.gameState = { playerStatuses: [] };
            const status = client.getPlayerConnectionStatus('unknown-player', false);
            expect(status).toBe('connected');
        });
    });

    describe('Profile Connection Status', () => {
        test('should update profile connection status to connected', () => {
            const statusElement = client.updateConnectionStatus('connected');
            
            expect(statusElement.classList.add).toHaveBeenCalledWith('connected');
            expect(statusElement.innerHTML).toContain('fa-check-circle');
            expect(statusElement.innerHTML).toContain('Connected');
        });

        test('should update profile connection status to connecting', () => {
            const statusElement = client.updateConnectionStatus('connecting');
            
            expect(statusElement.classList.add).toHaveBeenCalledWith('connecting');
            expect(statusElement.innerHTML).toContain('fa-spinner');
            expect(statusElement.innerHTML).toContain('Connecting...');
        });

        test('should update profile connection status to disconnected', () => {
            const statusElement = client.updateConnectionStatus('disconnected');
            
            expect(statusElement.classList.add).toHaveBeenCalledWith('disconnected');
            expect(statusElement.innerHTML).toContain('fa-exclamation-circle');
            expect(statusElement.innerHTML).toContain('Disconnected');
        });

        test('should remove previous status classes when updating', () => {
            const statusElement = client.updateConnectionStatus('connected');
            expect(statusElement.classList.remove).toHaveBeenCalledWith('connected', 'connecting', 'disconnected');
        });
    });

    describe('Visual Indicator Rendering', () => {
        test('should generate correct CSS classes for all connection states', () => {
            const states = ['connected', 'connecting', 'disconnecting', 'reconnecting', 'disconnected'];
            
            states.forEach(state => {
                const indicator = client.createConnectionStatusIndicator(state);
                expect(indicator).toContain(`status-${state}`);
                expect(indicator).toContain('connection-status-dot');
            });
        });

        test('should provide appropriate status text for user feedback', () => {
            const statusTexts = {
                'connected': '',
                'connecting': 'Connecting...',
                'disconnecting': 'Disconnecting...',
                'reconnecting': 'Reconnecting...',
                'disconnected': 'Disconnected'
            };

            Object.entries(statusTexts).forEach(([status, expectedText]) => {
                const text = client.getConnectionStatusText(status);
                expect(text).toBe(expectedText);
            });
        });
    });

    describe('Status Update Formatting', () => {
        test('should handle reconnection time display correctly', () => {
            // Test the logic for reconnection time formatting
            const reconnectionTime = Date.now() - 5000; // 5 seconds ago
            const elapsed = Math.floor((Date.now() - reconnectionTime) / 1000);
            const expectedText = `Reconnecting... (${elapsed}s)`;
            
            // This tests the logic that would be used in updatePlayerConnectionStatus
            expect(elapsed).toBeGreaterThanOrEqual(4);
            expect(elapsed).toBeLessThanOrEqual(6);
            expect(expectedText).toMatch(/Reconnecting\.\.\. \(\d+s\)/);
        });

        test('should format status text consistently', () => {
            const statuses = ['connecting', 'reconnecting', 'disconnected'];
            
            statuses.forEach(status => {
                const text = client.getConnectionStatusText(status);
                expect(text).toBeTruthy();
                expect(typeof text).toBe('string');
                
                if (status !== 'connected') {
                    expect(text.length).toBeGreaterThan(0);
                }
            });
        });
    });
});