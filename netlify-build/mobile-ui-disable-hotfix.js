/**
 * PRODUCTION HOTFIX: Mobile UI System Disabler
 * This script completely disables the mobile UI system in production
 * Load this BEFORE any mobile UI scripts to prevent initialization
 */

(function() {
    'use strict';
    
    console.log('🚫 PRODUCTION HOTFIX: Disabling Mobile UI System');
    
    // Block MobileUISystem constructor completely
    window.MobileUISystem = function() {
        console.log('🚫 Mobile UI System blocked by production hotfix');
        return {
            init: () => Promise.resolve(),
            components: new Map(),
            isInitialized: false,
            currentScreen: null,
            screenHistory: [],
            config: {},
            eventCallbacks: new Map(),
            emit: () => {},
            on: () => {},
            off: () => {},
            getComponent: () => null,
            showScreen: () => Promise.resolve(),
            hideScreen: () => Promise.resolve(),
            navigateToScreen: () => Promise.resolve(),
            goBack: () => Promise.resolve(),
            destroy: () => Promise.resolve()
        };
    };
    
    // Block all mobile component constructors
    const mobileComponents = [
        'MobileLobbyScreen', 
        'MobileLoginScreen',
        'MobileGameCreationScreen',
        'MobileGameScreen',
        'MobileNavigationController',
        'MobileInteractionRouter',
        'MobileInterfaceToggle',
        'MobileInterfaceActivator',
        'OrientationManager',
        'TouchManager',
        'GestureRecognizer',
        'SafeAreaHandler',
        'PlayerAvatarSystem'
    ];
    
    mobileComponents.forEach(componentName => {
        window[componentName] = function() {
            console.log(`🚫 ${componentName} blocked by production hotfix`);
            return {
                init: () => Promise.resolve(),
                show: () => Promise.resolve(),
                hide: () => Promise.resolve(),
                destroy: () => Promise.resolve(),
                activate: () => Promise.resolve(),
                deactivate: () => Promise.resolve(),
                isVisible: false,
                isReady: () => false,
                isActive: () => false,
                loadGames: () => Promise.resolve([]),
                loadPlayers: () => Promise.resolve([]),
                loadInvitations: () => Promise.resolve([]),
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => {},
                handleTouch: () => {},
                handleGesture: () => {},
                handleOrientationChange: () => {}
            };
        };
    });
    
    // Ensure desktop UI is visible
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🔧 Production hotfix ensuring desktop UI visibility');
        
        // Remove mobile interface classes
        document.body.classList.remove(
            'mobile-interface-active',
            'mobile-device', 
            'mobile-optimized',
            'mobile-lobby-active'
        );
        document.documentElement.classList.remove('mobile-interface');
        
        // Add responsive design mode
        document.body.classList.add('responsive-design-mode');
        
        // Ensure welcome screen is visible
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.style.display = '';
            welcomeScreen.classList.add('active');
        }
        
        // Hide game pause overlay if it's showing incorrectly
        const gamePauseOverlay = document.getElementById('gamePauseOverlay');
        if (gamePauseOverlay) {
            gamePauseOverlay.style.display = 'none';
        }
        
        // Hide any mobile screens that might be created
        setTimeout(() => {
            const mobileScreens = document.querySelectorAll(
                '.mobile-screen, .mobile-lobby-screen, .mobile-fallback-interface, .mobile-login-screen, .mobile-game-screen'
            );
            mobileScreens.forEach(screen => {
                if (screen) {
                    screen.style.display = 'none';
                }
            });
        }, 1000);
        
        console.log('✅ Production hotfix applied - desktop UI should be visible');
    });
    
    // Override debug functions
    window.debugMobileInterface = function() {
        return {
            status: 'DISABLED_BY_HOTFIX',
            reason: 'Production hotfix applied to disable mobile UI system',
            desktopUIVisible: true,
            responsiveMode: true,
            mobileInterfaceBlocked: true,
            hotfixActive: true
        };
    };
    
    window.forceMobileInterface = function() {
        console.warn('🚫 Mobile interface blocked by production hotfix');
    };
    
    console.log('🚫 Production hotfix loaded - Mobile UI System disabled');
    
})();