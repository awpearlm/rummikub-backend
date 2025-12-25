/**
 * CSS Loading Optimization Script
 * Efficiently loads CSS files with critical path optimization
 * Requirements: 3.4, 3.5
 */

class CSSLoader {
    constructor() {
        this.loadedStyles = new Set();
        this.criticalLoaded = false;
        this.performanceMetrics = {
            startTime: performance.now(),
            criticalLoadTime: null,
            totalLoadTime: null,
            failedLoads: []
        };
        
        this.init();
    }
    
    init() {
        // Preload critical fonts
        this.preloadFonts();
        
        // Load critical CSS inline if not already present
        this.ensureCriticalCSS();
        
        // Load non-critical CSS asynchronously
        this.loadNonCriticalCSS();
        
        // Monitor performance
        this.monitorPerformance();
    }
    
    preloadFonts() {
        const fonts = [
            'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
        ];
        
        fonts.forEach(fontUrl => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = fontUrl;
            link.onload = () => {
                link.rel = 'stylesheet';
            };
            document.head.appendChild(link);
        });
    }
    
    ensureCriticalCSS() {
        // Check if critical CSS is already inlined
        const criticalStyle = document.querySelector('style[data-critical]');
        if (!criticalStyle) {
            this.loadCSSFile('css/critical-responsive.css', true);
        } else {
            this.criticalLoaded = true;
            this.performanceMetrics.criticalLoadTime = performance.now() - this.performanceMetrics.startTime;
        }
    }
    
    loadNonCriticalCSS() {
        // Wait for critical CSS to load first
        const loadNonCritical = () => {
            const nonCriticalFiles = [
                'css/responsive-optimized.css',
                'styles.css',
                'connection-status.css'
            ];
            
            // Load non-critical CSS files asynchronously
            nonCriticalFiles.forEach((file, index) => {
                setTimeout(() => {
                    this.loadCSSFile(file, false);
                }, index * 50); // Stagger loading to prevent blocking
            });
        };
        
        if (this.criticalLoaded) {
            loadNonCritical();
        } else {
            // Wait for critical CSS
            const checkCritical = setInterval(() => {
                if (this.criticalLoaded) {
                    clearInterval(checkCritical);
                    loadNonCritical();
                }
            }, 10);
        }
    }
    
    loadCSSFile(href, isCritical = false) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (this.loadedStyles.has(href)) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href + '?v=' + Date.now(); // Cache busting
            
            // Add loading attributes for non-critical CSS
            if (!isCritical) {
                link.media = 'print';
                link.onload = () => {
                    link.media = 'all';
                    this.loadedStyles.add(href);
                    resolve();
                };
            } else {
                link.onload = () => {
                    this.loadedStyles.add(href);
                    this.criticalLoaded = true;
                    this.performanceMetrics.criticalLoadTime = performance.now() - this.performanceMetrics.startTime;
                    resolve();
                };
            }
            
            link.onerror = () => {
                console.warn(`Failed to load CSS: ${href}`);
                this.performanceMetrics.failedLoads.push(href);
                
                // For critical CSS failures, try fallback
                if (isCritical) {
                    this.loadFallbackCSS();
                }
                
                reject(new Error(`Failed to load ${href}`));
            };
            
            document.head.appendChild(link);
        });
    }
    
    loadFallbackCSS() {
        // Inline minimal critical CSS as fallback
        const fallbackCSS = `
            * { box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                margin: 0; padding: 0; line-height: 1.5;
            }
            .btn { 
                padding: 12px 16px; border: none; border-radius: 8px;
                cursor: pointer; font-weight: 500; min-height: 44px;
            }
            .btn-primary { background: #667eea; color: white; }
            .hidden { display: none !important; }
            @media (max-width: 768px) {
                .welcome-container { padding: 10px; }
                .profile-bubble { 
                    position: fixed; top: 10px; right: 10px; z-index: 1000;
                    background: rgba(255,255,255,0.95); border-radius: 12px; padding: 8px;
                }
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = fallbackCSS;
        style.setAttribute('data-fallback', 'true');
        document.head.appendChild(style);
        
        this.criticalLoaded = true;
        console.log('Loaded fallback critical CSS');
    }
    
    monitorPerformance() {
        // Monitor when all CSS is loaded
        const checkComplete = () => {
            const allLinks = document.querySelectorAll('link[rel="stylesheet"]');
            let loadedCount = 0;
            
            allLinks.forEach(link => {
                if (link.sheet) {
                    loadedCount++;
                }
            });
            
            if (loadedCount === allLinks.length) {
                this.performanceMetrics.totalLoadTime = performance.now() - this.performanceMetrics.startTime;
                this.reportPerformance();
            } else {
                setTimeout(checkComplete, 100);
            }
        };
        
        setTimeout(checkComplete, 500);
    }
    
    reportPerformance() {
        const metrics = this.performanceMetrics;
        
        console.log('CSS Loading Performance:', {
            criticalLoadTime: `${metrics.criticalLoadTime?.toFixed(2)}ms`,
            totalLoadTime: `${metrics.totalLoadTime?.toFixed(2)}ms`,
            loadedStyles: this.loadedStyles.size,
            failedLoads: metrics.failedLoads.length
        });
        
        // Report to analytics if available
        if (window.gtag) {
            window.gtag('event', 'css_load_performance', {
                critical_load_time: Math.round(metrics.criticalLoadTime || 0),
                total_load_time: Math.round(metrics.totalLoadTime || 0),
                failed_loads: metrics.failedLoads.length
            });
        }
        
        // Warn about slow loading
        if (metrics.criticalLoadTime > 1000) {
            console.warn('Critical CSS took longer than 1s to load');
        }
        
        if (metrics.failedLoads.length > 0) {
            console.warn('Some CSS files failed to load:', metrics.failedLoads);
        }
    }
    
    // Public method to load additional CSS on demand
    loadOnDemand(href) {
        return this.loadCSSFile(href, false);
    }
    
    // Public method to check if CSS is loaded
    isLoaded(href) {
        return this.loadedStyles.has(href);
    }
    
    // Public method to get performance metrics
    getMetrics() {
        return { ...this.performanceMetrics };
    }
}

// Initialize CSS loader
const cssLoader = new CSSLoader();

// Expose globally for debugging
window.cssLoader = cssLoader;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSSLoader;
}