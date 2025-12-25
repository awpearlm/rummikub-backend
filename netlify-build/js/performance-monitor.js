/**
 * Performance Monitoring for Responsive UI
 * Tracks CSS loading performance and mobile layout metrics
 * Requirements: 3.5
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            cssLoadStart: performance.now(),
            cssLoadEnd: null,
            firstContentfulPaint: null,
            largestContentfulPaint: null,
            cumulativeLayoutShift: 0,
            firstInputDelay: null,
            touchResponseTimes: [],
            orientationChangeTimes: []
        };
        
        this.observers = [];
        this.init();
    }
    
    init() {
        this.observeWebVitals();
        this.observeTouchPerformance();
        this.observeOrientationChanges();
        this.observeCSSLoading();
        this.scheduleReport();
    }
    
    observeWebVitals() {
        // First Contentful Paint
        if ('PerformanceObserver' in window) {
            const paintObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        this.metrics.firstContentfulPaint = entry.startTime;
                    }
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });
            this.observers.push(paintObserver);
            
            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.largestContentfulPaint = lastEntry.startTime;
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.push(lcpObserver);
            
            // Cumulative Layout Shift
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        this.metrics.cumulativeLayoutShift += entry.value;
                    }
                }
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
            this.observers.push(clsObserver);
            
            // First Input Delay
            const fidObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
                }
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
            this.observers.push(fidObserver);
        }
    }
    
    observeTouchPerformance() {
        let touchStartTime = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartTime = performance.now();
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (touchStartTime > 0) {
                const responseTime = performance.now() - touchStartTime;
                this.metrics.touchResponseTimes.push(responseTime);
                
                // Keep only last 50 measurements
                if (this.metrics.touchResponseTimes.length > 50) {
                    this.metrics.touchResponseTimes.shift();
                }
                
                touchStartTime = 0;
            }
        }, { passive: true });
    }
    
    observeOrientationChanges() {
        let orientationChangeStart = 0;
        
        window.addEventListener('orientationchange', () => {
            orientationChangeStart = performance.now();
        });
        
        window.addEventListener('resize', () => {
            if (orientationChangeStart > 0) {
                const adaptationTime = performance.now() - orientationChangeStart;
                this.metrics.orientationChangeTimes.push(adaptationTime);
                
                // Keep only last 10 measurements
                if (this.metrics.orientationChangeTimes.length > 10) {
                    this.metrics.orientationChangeTimes.shift();
                }
                
                orientationChangeStart = 0;
            }
        });
    }
    
    observeCSSLoading() {
        // Monitor when all stylesheets are loaded
        const checkStylesheets = () => {
            const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
            let loadedCount = 0;
            
            stylesheets.forEach(link => {
                if (link.sheet) {
                    loadedCount++;
                }
            });
            
            if (loadedCount === stylesheets.length && stylesheets.length > 0) {
                this.metrics.cssLoadEnd = performance.now();
                return true;
            }
            return false;
        };
        
        // Check periodically until all CSS is loaded
        const checkInterval = setInterval(() => {
            if (checkStylesheets()) {
                clearInterval(checkInterval);
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!this.metrics.cssLoadEnd) {
                this.metrics.cssLoadEnd = performance.now();
                console.warn('CSS loading timeout reached');
            }
        }, 10000);
    }
    
    scheduleReport() {
        // Report metrics after page is fully loaded
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.generateReport();
            }, 2000); // Wait 2 seconds after load for final measurements
        });
        
        // Also report on page visibility change (when user switches tabs)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.generateReport();
            }
        });
    }
    
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio
            },
            metrics: {
                cssLoadTime: this.metrics.cssLoadEnd ? 
                    (this.metrics.cssLoadEnd - this.metrics.cssLoadStart) : null,
                firstContentfulPaint: this.metrics.firstContentfulPaint,
                largestContentfulPaint: this.metrics.largestContentfulPaint,
                cumulativeLayoutShift: this.metrics.cumulativeLayoutShift,
                firstInputDelay: this.metrics.firstInputDelay,
                averageTouchResponse: this.getAverageTouchResponse(),
                averageOrientationAdaptation: this.getAverageOrientationAdaptation()
            },
            performance: {
                navigation: performance.getEntriesByType('navigation')[0],
                memory: performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null
            }
        };
        
        this.logReport(report);
        this.sendToAnalytics(report);
        
        return report;
    }
    
    getAverageTouchResponse() {
        if (this.metrics.touchResponseTimes.length === 0) return null;
        
        const sum = this.metrics.touchResponseTimes.reduce((a, b) => a + b, 0);
        return sum / this.metrics.touchResponseTimes.length;
    }
    
    getAverageOrientationAdaptation() {
        if (this.metrics.orientationChangeTimes.length === 0) return null;
        
        const sum = this.metrics.orientationChangeTimes.reduce((a, b) => a + b, 0);
        return sum / this.metrics.orientationChangeTimes.length;
    }
    
    logReport(report) {
        console.group('📊 Responsive UI Performance Report');
        
        if (report.metrics.cssLoadTime) {
            console.log(`🎨 CSS Load Time: ${report.metrics.cssLoadTime.toFixed(2)}ms`);
        }
        
        if (report.metrics.firstContentfulPaint) {
            console.log(`🎯 First Contentful Paint: ${report.metrics.firstContentfulPaint.toFixed(2)}ms`);
        }
        
        if (report.metrics.largestContentfulPaint) {
            console.log(`📏 Largest Contentful Paint: ${report.metrics.largestContentfulPaint.toFixed(2)}ms`);
        }
        
        if (report.metrics.cumulativeLayoutShift) {
            console.log(`📐 Cumulative Layout Shift: ${report.metrics.cumulativeLayoutShift.toFixed(4)}`);
        }
        
        if (report.metrics.firstInputDelay) {
            console.log(`⚡ First Input Delay: ${report.metrics.firstInputDelay.toFixed(2)}ms`);
        }
        
        if (report.metrics.averageTouchResponse) {
            console.log(`👆 Average Touch Response: ${report.metrics.averageTouchResponse.toFixed(2)}ms`);
        }
        
        if (report.metrics.averageOrientationAdaptation) {
            console.log(`🔄 Average Orientation Adaptation: ${report.metrics.averageOrientationAdaptation.toFixed(2)}ms`);
        }
        
        // Performance warnings
        const warnings = [];
        
        if (report.metrics.cssLoadTime > 1000) {
            warnings.push('CSS loading is slow (>1s)');
        }
        
        if (report.metrics.firstContentfulPaint > 2500) {
            warnings.push('First Contentful Paint is slow (>2.5s)');
        }
        
        if (report.metrics.largestContentfulPaint > 4000) {
            warnings.push('Largest Contentful Paint is slow (>4s)');
        }
        
        if (report.metrics.cumulativeLayoutShift > 0.1) {
            warnings.push('Cumulative Layout Shift is high (>0.1)');
        }
        
        if (report.metrics.firstInputDelay > 100) {
            warnings.push('First Input Delay is high (>100ms)');
        }
        
        if (report.metrics.averageTouchResponse > 100) {
            warnings.push('Touch response is slow (>100ms)');
        }
        
        if (warnings.length > 0) {
            console.warn('⚠️ Performance Issues:', warnings);
        } else {
            console.log('✅ Performance looks good!');
        }
        
        console.groupEnd();
    }
    
    sendToAnalytics(report) {
        // Send to Google Analytics if available
        if (window.gtag) {
            window.gtag('event', 'responsive_ui_performance', {
                css_load_time: Math.round(report.metrics.cssLoadTime || 0),
                first_contentful_paint: Math.round(report.metrics.firstContentfulPaint || 0),
                largest_contentful_paint: Math.round(report.metrics.largestContentfulPaint || 0),
                cumulative_layout_shift: Math.round((report.metrics.cumulativeLayoutShift || 0) * 1000),
                first_input_delay: Math.round(report.metrics.firstInputDelay || 0),
                average_touch_response: Math.round(report.metrics.averageTouchResponse || 0),
                viewport_width: report.viewport.width,
                viewport_height: report.viewport.height
            });
        }
        
        // Send to custom analytics endpoint if configured
        if (window.ANALYTICS_ENDPOINT) {
            fetch(window.ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(report)
            }).catch(err => {
                console.warn('Failed to send performance data:', err);
            });
        }
    }
    
    // Public method to get current metrics
    getMetrics() {
        return { ...this.metrics };
    }
    
    // Public method to force a report
    forceReport() {
        return this.generateReport();
    }
    
    // Cleanup method
    destroy() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers = [];
    }
}

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor();

// Expose globally for debugging
window.performanceMonitor = performanceMonitor;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}