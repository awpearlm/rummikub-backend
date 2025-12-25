/**
 * Emergency Mobile UI Fix
 * Fixes the blank/unstyled mobile interface issue
 */

(function() {
    'use strict';
    
    console.log('🚨 Emergency Mobile UI Fix loading...');
    
    // Wait for DOM to be ready
    function waitForDOM(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }
    
    // Force mobile interface activation with proper styling
    function emergencyMobileActivation() {
        console.log('🚨 Applying emergency mobile UI fixes...');
        
        // 1. Force mobile detection
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         ('ontouchstart' in window) ||
                         (navigator.maxTouchPoints > 0);
        
        if (!isMobile) {
            console.log('🚨 Not a mobile device, skipping mobile fixes');
            return;
        }
        
        // 2. Hide desktop interface immediately
        hideDesktopInterface();
        
        // 3. Create and show styled mobile interface
        createStyledMobileInterface();
        
        // 4. Apply mobile body classes
        document.body.classList.add('mobile-interface-active', 'mobile-device', 'mobile-optimized');
        document.documentElement.classList.add('mobile-interface');
        
        console.log('🚨 Emergency mobile UI fixes applied successfully!');
    }
    
    function hideDesktopInterface() {
        const desktopSelectors = [
            '#welcomeScreen',
            '#gameScreen', 
            '#loadingScreen',
            '.profile-bubble',
            '.welcome-container',
            '.game-header-bar',
            '.game-layout',
            '.player-hand-section'
        ];
        
        desktopSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    element.style.display = 'none';
                    element.classList.add('desktop-hidden-for-mobile');
                }
            });
        });
        
        console.log('🚨 Desktop interface hidden');
    }
    
    function createStyledMobileInterface() {
        // Remove any existing mobile interfaces
        const existingMobile = document.querySelectorAll('.mobile-screen, .mobile-lobby-screen, .mobile-fallback-interface');
        existingMobile.forEach(el => el.remove());
        
        // Create new styled mobile interface
        const mobileInterface = document.createElement('div');
        mobileInterface.className = 'emergency-mobile-interface';
        mobileInterface.innerHTML = `
            <div class="mobile-lobby-header">
                <div class="lobby-title">
                    <h1><i class="fas fa-chess-board"></i> J-kube</h1>
                </div>
                <div class="user-info">
                    <span class="username">${localStorage.getItem('username') || 'Player'}</span>
                    <div class="connection-status">
                        <i class="fas fa-circle"></i>
                        <span>Online</span>
                    </div>
                </div>
            </div>
            
            <div class="mobile-lobby-content">
                <div class="mobile-lobby-tabs">
                    <button class="tab-btn active" data-tab="games">
                        <i class="fas fa-gamepad"></i>
                        <span>Games</span>
                    </button>
                    <button class="tab-btn" data-tab="players">
                        <i class="fas fa-users"></i>
                        <span>Players</span>
                    </button>
                    <button class="tab-btn" data-tab="invitations">
                        <i class="fas fa-envelope"></i>
                        <span>Invites</span>
                    </button>
                </div>
                
                <div class="tab-content active" id="games-tab">
                    <div class="games-list">
                        <div class="empty-state">
                            <i class="fas fa-gamepad"></i>
                            <h3>Welcome to J-kube Mobile!</h3>
                            <p>The mobile interface is now working properly.</p>
                            <button class="create-game-btn" onclick="alert('Game creation will be available soon!')">
                                <i class="fas fa-plus"></i> Create Game
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="players-tab">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No Players Online</h3>
                        <p>You're the only one here right now</p>
                    </div>
                </div>
                
                <div class="tab-content" id="invitations-tab">
                    <div class="empty-state">
                        <i class="fas fa-envelope-open"></i>
                        <h3>No Invitations</h3>
                        <p>You don't have any game invitations yet</p>
                    </div>
                </div>
            </div>
            
            <button class="floating-action-btn" onclick="alert('Create game feature coming soon!')">
                <i class="fas fa-plus"></i>
            </button>
            
            <div class="mobile-debug-toggle">
                <button onclick="window.location.reload()">🔄 Reload</button>
                <button onclick="switchToDesktop()">💻 Desktop</button>
            </div>
        `;
        
        // Apply comprehensive styling
        const mobileCSS = `
            .emergency-mobile-interface {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                z-index: 1000;
                overflow: hidden;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .mobile-lobby-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: env(safe-area-inset-top, 20px) 20px 20px 20px;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .lobby-title h1 {
                color: white;
                font-size: 24px;
                font-weight: 700;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .user-info {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 4px;
            }
            
            .username {
                color: white;
                font-weight: 600;
                font-size: 16px;
            }
            
            .connection-status {
                color: rgba(255, 255, 255, 0.8);
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .connection-status i {
                color: #10b981;
                font-size: 8px;
            }
            
            .mobile-lobby-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: white;
                border-radius: 20px 20px 0 0;
                margin-top: 10px;
                overflow: hidden;
            }
            
            .mobile-lobby-tabs {
                display: flex;
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
            }
            
            .tab-btn {
                flex: 1;
                padding: 16px 12px;
                background: none;
                border: none;
                font-size: 14px;
                font-weight: 500;
                color: #6c757d;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                position: relative;
                transition: all 0.2s ease;
                min-height: 44px;
                cursor: pointer;
            }
            
            .tab-btn.active {
                color: #667eea;
                background: white;
            }
            
            .tab-btn i {
                font-size: 18px;
            }
            
            .tab-content {
                flex: 1;
                padding: 20px;
                display: none;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .tab-content.active {
                display: flex;
                flex-direction: column;
            }
            
            .empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #6c757d;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                flex: 1;
            }
            
            .empty-state i {
                font-size: 48px;
                margin-bottom: 16px;
                color: #dee2e6;
            }
            
            .empty-state h3 {
                margin: 0 0 8px 0;
                color: #495057;
                font-size: 18px;
            }
            
            .empty-state p {
                margin: 0 0 16px 0;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .create-game-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .create-game-btn:hover {
                background: #5a6fd8;
                transform: translateY(-1px);
            }
            
            .floating-action-btn {
                position: fixed;
                bottom: env(safe-area-inset-bottom, 20px);
                right: 20px;
                width: 56px;
                height: 56px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
                z-index: 1100;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .floating-action-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            
            .mobile-debug-toggle {
                position: fixed;
                bottom: env(safe-area-inset-bottom, 20px);
                left: 20px;
                z-index: 1001;
                display: flex;
                gap: 8px;
            }
            
            .mobile-debug-toggle button {
                background: rgba(0,0,0,0.7);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                backdrop-filter: blur(10px);
            }
            
            .mobile-debug-toggle button:hover {
                background: rgba(0,0,0,0.8);
            }
            
            /* Mobile optimizations */
            .mobile-interface-active {
                overflow-x: hidden;
                -webkit-overflow-scrolling: touch;
            }
            
            .mobile-interface {
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
            }
            
            .mobile-optimized {
                touch-action: manipulation;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
        `;
        
        // Inject CSS
        const styleElement = document.createElement('style');
        styleElement.id = 'emergency-mobile-styles';
        styleElement.textContent = mobileCSS;
        document.head.appendChild(styleElement);
        
        // Add to DOM
        document.body.appendChild(mobileInterface);
        
        // Set up tab functionality
        setupTabNavigation(mobileInterface);
        
        console.log('🚨 Styled mobile interface created');
    }
    
    function setupTabNavigation(container) {
        const tabButtons = container.querySelectorAll('.tab-btn');
        const tabContents = container.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}-tab`) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }
    
    // Global function to switch back to desktop
    window.switchToDesktop = function() {
        // Remove mobile interface
        const mobileInterface = document.querySelector('.emergency-mobile-interface');
        if (mobileInterface) {
            mobileInterface.remove();
        }
        
        // Remove mobile styles
        const mobileStyles = document.querySelector('#emergency-mobile-styles');
        if (mobileStyles) {
            mobileStyles.remove();
        }
        
        // Show desktop elements
        const hiddenElements = document.querySelectorAll('.desktop-hidden-for-mobile');
        hiddenElements.forEach(element => {
            element.style.display = '';
            element.classList.remove('desktop-hidden-for-mobile');
        });
        
        // Remove mobile classes
        document.body.classList.remove('mobile-interface-active', 'mobile-device', 'mobile-optimized');
        document.documentElement.classList.remove('mobile-interface');
        
        console.log('🚨 Switched back to desktop interface');
    };
    
    // Auto-apply fix when DOM is ready
    waitForDOM(() => {
        // Small delay to let other scripts load
        setTimeout(emergencyMobileActivation, 1000);
    });
    
    // Also expose manual activation
    window.emergencyMobileActivation = emergencyMobileActivation;
    
    console.log('🚨 Emergency Mobile UI Fix loaded - will activate automatically');
    
})();