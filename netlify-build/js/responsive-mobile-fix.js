/**
 * Responsive Mobile Fix
 * Ensures desktop UI is always visible and works well on mobile devices
 * Replaces complex mobile interface system with simple responsive design
 */

(function() {
    'use strict';
    
    console.log('🔧 Responsive Mobile Fix: Ensuring desktop UI is visible and responsive');
    
    // Immediately ensure desktop UI is visible
    function ensureDesktopUIVisible() {
        // Remove any mobile interface classes that might hide desktop UI
        document.body.classList.remove(
            'mobile-interface-active',
            'mobile-device', 
            'mobile-optimized',
            'mobile-lobby-active'
        );
        document.documentElement.classList.remove('mobile-interface');
        
        // Add responsive design mode
        document.body.classList.add('responsive-design-mode');
        
        // Ensure all desktop elements are visible
        const desktopSelectors = [
            '#welcomeScreen',
            '#gameScreen',
            '#loadingScreen',
            '.profile-bubble',
            '.welcome-container',
            '.game-header-bar',
            '.game-layout',
            '.player-hand-section',
            '#toast-container',
            '#connectionLostOverlay',
            '#gamePauseOverlay',
            '#victoryOverlay',
            '#turnNotificationOverlay',
            '#gameSettingsModal'
        ];
        
        let elementsRestored = 0;
        desktopSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element) {
                    // Remove any mobile hiding classes
                    element.classList.remove('desktop-hidden-for-mobile');
                    
                    // Restore display if it was hidden
                    if (element.style.display === 'none' && element.hasAttribute('data-original-display')) {
                        const originalDisplay = element.getAttribute('data-original-display');
                        element.style.display = originalDisplay;
                        element.removeAttribute('data-original-display');
                        elementsRestored++;
                    } else if (element.style.display === 'none') {
                        // If no original display stored, use default
                        element.style.display = '';
                        elementsRestored++;
                    }
                }
            });
        });
        
        if (elementsRestored > 0) {
            console.log(`✅ Restored visibility to ${elementsRestored} desktop UI elements`);
        }
        
        // Hide any mobile screens that might be visible
        const mobileScreens = document.querySelectorAll(
            '.mobile-screen, .mobile-lobby-screen, .mobile-fallback-interface, .mobile-login-screen, .mobile-game-screen'
        );
        let mobileElementsHidden = 0;
        mobileScreens.forEach(screen => {
            if (screen && window.getComputedStyle(screen).display !== 'none') {
                screen.style.display = 'none';
                mobileElementsHidden++;
            }
        });
        
        if (mobileElementsHidden > 0) {
            console.log(`✅ Hidden ${mobileElementsHidden} mobile interface elements`);
        }
    }
    
    // Run immediately
    ensureDesktopUIVisible();
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureDesktopUIVisible);
    }
    
    // Run after a short delay to catch any late-loading mobile scripts
    setTimeout(ensureDesktopUIVisible, 1000);
    
    // Set up viewport for mobile devices
    function setupMobileViewport() {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            // Update existing viewport for better mobile experience
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover';
        }
    }
    
    setupMobileViewport();
    
    // Add touch-friendly interactions for mobile
    function setupMobileTouchOptimizations() {
        // Prevent double-tap zoom on buttons (but allow pinch zoom)
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            const now = (new Date()).getTime();
            const target = event.target;
            
            // Only prevent double-tap zoom on interactive elements
            if (target.matches('button, .btn, input[type="button"], input[type="submit"]')) {
                if (now - lastTouchEnd <= 300) {
                    event.preventDefault();
                }
            }
            lastTouchEnd = now;
        }, false);
        
        // Add active states for better touch feedback
        document.addEventListener('touchstart', function(event) {
            const target = event.target;
            if (target.matches('button, .btn')) {
                target.classList.add('touch-active');
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function(event) {
            const target = event.target;
            if (target.matches('button, .btn')) {
                setTimeout(() => {
                    target.classList.remove('touch-active');
                }, 150);
            }
        }, { passive: true });
        
        // Add CSS for touch active states
        const touchStyles = document.createElement('style');
        touchStyles.textContent = `
            .touch-active {
                opacity: 0.7 !important;
                transform: scale(0.98) !important;
            }
            
            /* Improve touch targets */
            @media (max-width: 768px) {
                button, .btn, input[type="button"], input[type="submit"] {
                    min-height: 44px;
                    min-width: 44px;
                }
                
                /* Better spacing for touch */
                .action-buttons .btn {
                    margin: 4px;
                }
                
                /* Larger tap targets for game elements */
                .tile {
                    min-width: 44px;
                    min-height: 44px;
                }
            }
        `;
        document.head.appendChild(touchStyles);
    }
    
    setupMobileTouchOptimizations();
    
    // Override any mobile interface activation attempts
    function preventMobileInterfaceActivation() {
        // Override global mobile interface functions
        window.forceMobileInterface = function() {
            console.warn('🚫 Mobile interface activation blocked - using responsive desktop UI');
            console.log('💡 Desktop UI is now responsive and works well on mobile devices');
        };
        
        window.disableForceMobile = function() {
            console.log('✅ Mobile interface already disabled - using responsive desktop UI');
        };
        
        window.debugMobileInterface = function() {
            return {
                status: 'DISABLED',
                reason: 'User requested responsive desktop UI instead of separate mobile interface',
                desktopUIVisible: true,
                responsiveMode: true,
                mobileInterfaceBlocked: true
            };
        };
        
        // Block MobileInterfaceActivator if it tries to load
        if (window.MobileInterfaceActivator) {
            console.log('🚫 Blocking MobileInterfaceActivator - using responsive design instead');
            window.MobileInterfaceActivator = function() {
                console.warn('MobileInterfaceActivator blocked - using responsive desktop UI');
                return {
                    isMobile: false,
                    isActivated: false,
                    activateMobileInterface: () => console.warn('Mobile interface activation blocked'),
                    debugMobileInterface: () => ({ status: 'BLOCKED', reason: 'Using responsive design' })
                };
            };
        }
        
        // Clear any force mobile flags
        localStorage.removeItem('force_mobile_interface');
        sessionStorage.removeItem('force_mobile_interface');
    }
    
    preventMobileInterfaceActivation();
    
    // Monitor for any attempts to hide desktop UI
    function monitorDesktopUIVisibility() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const element = mutation.target;
                    
                    // Check if a desktop element was hidden
                    if (element.matches('#welcomeScreen, #gameScreen, .welcome-container, .game-header-bar, .player-hand-section')) {
                        if (element.style.display === 'none' && !element.classList.contains('screen')) {
                            console.warn('🔧 Desktop UI element was hidden, restoring visibility:', element.id || element.className);
                            element.style.display = '';
                        }
                    }
                }
                
                if (mutation.type === 'childList') {
                    // Check for mobile screens being added
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1 && node.matches && 
                            node.matches('.mobile-screen, .mobile-lobby-screen, .mobile-fallback-interface')) {
                            console.warn('🚫 Mobile screen element added, hiding it:', node.className);
                            node.style.display = 'none';
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['style', 'class']
        });
    }
    
    // Start monitoring after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', monitorDesktopUIVisibility);
    } else {
        monitorDesktopUIVisibility();
    }
    
    // Add helpful console messages
    console.log('📱 Responsive Mobile Fix Active:');
    console.log('  ✅ Desktop UI is visible and responsive');
    console.log('  ✅ Mobile interface system disabled');
    console.log('  ✅ Touch optimizations enabled');
    console.log('  ✅ Responsive CSS loaded');
    console.log('  💡 Desktop UI now adapts to mobile screen sizes');
    
    // Expose status check function
    window.checkResponsiveStatus = function() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const gameScreen = document.getElementById('gameScreen');
        const mobileScreens = document.querySelectorAll('.mobile-screen, .mobile-lobby-screen');
        
        return {
            responsiveMode: document.body.classList.contains('responsive-design-mode'),
            desktopUIVisible: {
                welcomeScreen: welcomeScreen ? window.getComputedStyle(welcomeScreen).display !== 'none' : false,
                gameScreen: gameScreen ? window.getComputedStyle(gameScreen).display !== 'none' : false
            },
            mobileInterfaceBlocked: true,
            mobileScreensHidden: Array.from(mobileScreens).every(screen => 
                window.getComputedStyle(screen).display === 'none'
            ),
            touchOptimizations: true,
            viewportConfigured: !!document.querySelector('meta[name="viewport"]')
        };
    };
    
})();