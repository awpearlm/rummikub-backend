/**
 * Mobile Device Optimizations
 * Additional optimizations for mobile devices and touch interfaces
 */

class MobileOptimizations {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.isTouchDevice = this.detectTouch();
        
        this.init();
    }

    init() {
        if (this.isMobile || this.isTablet || this.isTouchDevice) {
            this.applyMobileOptimizations();
            this.setupOrientationHandling();
            this.optimizeScrolling();
            this.preventUnwantedBehaviors();
            this.addMobileClasses();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    detectTablet() {
        return /iPad|Android/i.test(navigator.userAgent) && 
               window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    detectTouch() {
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 || 
               navigator.msMaxTouchPoints > 0;
    }

    applyMobileOptimizations() {
        // Optimize tile sizes based on screen size
        this.optimizeTileSizes();
        
        // Improve button sizes for touch
        this.optimizeButtonSizes();
        
        // Add mobile-specific event listeners
        this.addMobileEventListeners();
        
        // Optimize game layout for mobile
        this.optimizeGameLayout();
    }

    optimizeTileSizes() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Calculate optimal tile size based on screen dimensions
        let tileSize = 50; // Default size
        
        if (screenWidth < 480) {
            // Small phones
            tileSize = Math.max(40, Math.min(screenWidth / 10, 45));
        } else if (screenWidth < 768) {
            // Large phones
            tileSize = Math.max(45, Math.min(screenWidth / 12, 50));
        } else if (screenWidth < 1024) {
            // Tablets
            tileSize = Math.max(50, Math.min(screenWidth / 15, 55));
        }
        
        // Apply tile size via CSS custom property
        document.documentElement.style.setProperty('--mobile-tile-size', `${tileSize}px`);
        document.documentElement.style.setProperty('--mobile-tile-font-size', `${Math.max(12, tileSize * 0.28)}px`);
    }

    optimizeButtonSizes() {
        // Ensure all interactive elements meet minimum touch target size (44px)
        const minTouchSize = 44;
        
        const buttons = document.querySelectorAll('.btn, button, .tile, input, select');
        buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            if (rect.width < minTouchSize || rect.height < minTouchSize) {
                button.style.minWidth = `${minTouchSize}px`;
                button.style.minHeight = `${minTouchSize}px`;
            }
        });
    }

    addMobileEventListeners() {
        // Handle device orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
                this.optimizeTileSizes();
            }, 100);
        });

        // Handle window resize for responsive adjustments
        window.addEventListener('resize', this.debounce(() => {
            this.optimizeTileSizes();
            this.optimizeGameLayout();
        }, 250));

        // Handle visibility change (app switching)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Re-optimize when app becomes visible again
                setTimeout(() => {
                    this.optimizeTileSizes();
                }, 100);
            }
        });
    }

    optimizeGameLayout() {
        const gameScreen = document.getElementById('gameScreen');
        if (!gameScreen || !gameScreen.classList.contains('active')) return;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const isLandscape = screenWidth > screenHeight;

        // Optimize layout based on orientation and screen size
        if (this.isMobile) {
            if (isLandscape) {
                this.optimizeLandscapeLayout();
            } else {
                this.optimizePortraitLayout();
            }
        }
    }

    optimizeLandscapeLayout() {
        const gameContainer = document.querySelector('.game-container');
        const gameBoard = document.querySelector('.game-board');
        const playerHandSection = document.querySelector('.player-hand-section');
        
        if (gameContainer) {
            gameContainer.style.display = 'flex';
            gameContainer.style.flexDirection = 'row';
            gameContainer.style.height = '100vh';
        }
        
        if (gameBoard) {
            gameBoard.style.flex = '1';
            gameBoard.style.minHeight = '0';
        }
        
        if (playerHandSection) {
            playerHandSection.style.width = '200px';
            playerHandSection.style.maxHeight = 'none';
            playerHandSection.style.overflowY = 'auto';
        }
    }

    optimizePortraitLayout() {
        const gameContainer = document.querySelector('.game-container');
        const gameBoard = document.querySelector('.game-board');
        const playerHandSection = document.querySelector('.player-hand-section');
        
        if (gameContainer) {
            gameContainer.style.display = 'flex';
            gameContainer.style.flexDirection = 'column';
            gameContainer.style.height = '100vh';
        }
        
        if (gameBoard) {
            gameBoard.style.flex = '1';
            gameBoard.style.minHeight = '200px';
        }
        
        if (playerHandSection) {
            playerHandSection.style.width = 'auto';
            playerHandSection.style.maxHeight = '40vh';
            playerHandSection.style.overflowY = 'auto';
        }
    }

    setupOrientationHandling() {
        this.handleOrientationChange();
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
    }

    handleOrientationChange() {
        const orientation = window.orientation || 0;
        const isLandscape = Math.abs(orientation) === 90 || window.innerWidth > window.innerHeight;
        
        document.body.classList.toggle('landscape', isLandscape);
        document.body.classList.toggle('portrait', !isLandscape);
        
        // Show orientation hint for game screen
        const gameScreen = document.getElementById('gameScreen');
        if (gameScreen && gameScreen.classList.contains('active')) {
            if (!isLandscape && this.isMobile) {
                document.body.classList.add('encourage-landscape');
            } else {
                document.body.classList.remove('encourage-landscape');
            }
        }
        
        // Trigger layout optimization
        setTimeout(() => {
            this.optimizeGameLayout();
        }, 200);
    }

    optimizeScrolling() {
        // Add smooth scrolling to scrollable elements
        const scrollableElements = document.querySelectorAll(
            '.game-board, .player-hand, .games-list-container, .leaderboard-content'
        );
        
        scrollableElements.forEach(element => {
            element.style.webkitOverflowScrolling = 'touch';
            element.style.scrollBehavior = 'smooth';
        });
    }

    preventUnwantedBehaviors() {
        // Prevent pull-to-refresh
        document.body.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        document.body.addEventListener('touchmove', (e) => {
            // Prevent pull-to-refresh when at top of page
            if (e.touches.length > 1 || 
                (window.pageYOffset === 0 && e.touches[0].clientY > e.touches[0].clientY)) {
                e.preventDefault();
            }
        }, { passive: false });

        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Prevent context menu on game elements
        document.addEventListener('contextmenu', (e) => {
            const gameElements = ['.tile', '.board-area', '.player-hand', '.game-container'];
            if (gameElements.some(selector => e.target.closest(selector))) {
                e.preventDefault();
            }
        });
    }

    addMobileClasses() {
        document.body.classList.add('mobile-optimized');
        
        if (this.isMobile) {
            document.body.classList.add('mobile-device');
        }
        
        if (this.isTablet) {
            document.body.classList.add('tablet-device');
        }
        
        if (this.isTouchDevice) {
            document.body.classList.add('touch-device');
        }
    }

    // Utility function for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public method to re-optimize (can be called when game state changes)
    reoptimize() {
        this.optimizeTileSizes();
        this.optimizeGameLayout();
        this.optimizeButtonSizes();
    }
}

// Initialize mobile optimizations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.mobileOptimizations = new MobileOptimizations();
    console.log('Mobile optimizations initialized');
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileOptimizations;
}