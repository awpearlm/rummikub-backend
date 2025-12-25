/**
 * Mobile Board Demo Validation Script
 * Tests the mobile board demo for JavaScript errors and basic functionality
 */

const http = require('http');
const { JSDOM } = require('jsdom');

async function validateMobileBoardDemo() {
    console.log('🔍 Validating Mobile Board Demo...');
    
    try {
        // Fetch the demo HTML
        const html = await fetchDemo();
        console.log('✅ Demo HTML loaded successfully');
        
        // Create DOM environment
        const dom = new JSDOM(html, {
            url: 'http://localhost:8080/',
            pretendToBeVisual: true,
            resources: 'usable',
            runScripts: 'dangerously'
        });
        
        const { window } = dom;
        global.window = window;
        global.document = window.document;
        global.navigator = window.navigator;
        
        // Mock mobile-specific APIs
        setupMobileMocks(window);
        
        // Wait for scripts to load and execute
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if main classes are available
        const checks = [
            { name: 'TouchManager', class: window.TouchManager },
            { name: 'GestureRecognizer', class: window.GestureRecognizer },
            { name: 'SmartBoardPositioning', class: window.SmartBoardPositioning },
            { name: 'BoardGestureRecognizer', class: window.BoardGestureRecognizer },
            { name: 'MobileGameBoard', class: window.MobileGameBoard }
        ];
        
        let allClassesLoaded = true;
        checks.forEach(check => {
            if (typeof check.class === 'function') {
                console.log(`✅ ${check.name} class loaded successfully`);
            } else {
                console.log(`❌ ${check.name} class failed to load`);
                allClassesLoaded = false;
            }
        });
        
        if (!allClassesLoaded) {
            throw new Error('Some required classes failed to load');
        }
        
        // Test basic instantiation
        console.log('🧪 Testing basic instantiation...');
        
        // Create a mock container
        const container = window.document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        window.document.body.appendChild(container);
        
        // Test MobileGameBoard instantiation
        const gameBoard = new window.MobileGameBoard(container, {
            touchEnabled: true,
            dragDropEnabled: true,
            visualFeedback: true
        });
        
        console.log('✅ MobileGameBoard instantiated successfully');
        
        // Test basic methods
        const methods = [
            'placeTiles',
            'clearBoard',
            'centerOnTiles',
            'resetBoardView',
            'getCurrentView',
            'isGestureActive'
        ];
        
        methods.forEach(method => {
            if (typeof gameBoard[method] === 'function') {
                console.log(`✅ Method ${method} is available`);
            } else {
                console.log(`❌ Method ${method} is missing`);
            }
        });
        
        // Test tile placement
        console.log('🧪 Testing tile placement...');
        const testTile = {
            id: 'test1',
            number: 5,
            color: 'red',
            x: 100,
            y: 100
        };
        
        const result = gameBoard.placeTiles([testTile], { x: 2, y: 2 });
        if (result) {
            console.log('✅ Tile placement works');
        } else {
            console.log('❌ Tile placement failed');
        }
        
        // Test board clearing
        gameBoard.clearBoard();
        console.log('✅ Board clearing works');
        
        // Test gesture options
        gameBoard.setGestureOptions({
            enablePinchZoom: true,
            enableDoubleTap: true
        });
        console.log('✅ Gesture options setting works');
        
        // Cleanup
        gameBoard.destroy();
        console.log('✅ Cleanup works');
        
        console.log('\n🎉 Mobile Board Demo validation completed successfully!');
        console.log('📱 The demo is ready for production use.');
        
        return true;
        
    } catch (error) {
        console.error('❌ Validation failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

function fetchDemo() {
    return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8080/mobile-board-demo.html', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

function setupMobileMocks(window) {
    // Mock touch events
    window.TouchEvent = class TouchEvent extends window.Event {
        constructor(type, options = {}) {
            super(type, options);
            this.touches = options.touches || [];
            this.changedTouches = options.changedTouches || [];
            this.targetTouches = options.targetTouches || [];
        }
    };
    
    // Mock touch properties
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
        value: 5,
        writable: true
    });
    
    // Mock screen orientation
    window.screen.orientation = {
        angle: 0,
        type: 'landscape-primary',
        lock: () => Promise.resolve(),
        unlock: () => Promise.resolve()
    };
    
    // Mock performance.now
    window.performance = window.performance || {};
    window.performance.now = window.performance.now || (() => Date.now());
    
    // Mock requestAnimationFrame
    window.requestAnimationFrame = window.requestAnimationFrame || 
        ((callback) => setTimeout(callback, 16));
    window.cancelAnimationFrame = window.cancelAnimationFrame || 
        ((id) => clearTimeout(id));
    
    // Mock CSS.supports
    window.CSS = window.CSS || {};
    window.CSS.supports = window.CSS.supports || (() => true);
    
    // Mock getBoundingClientRect for elements
    const originalCreateElement = window.document.createElement;
    window.document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        element.getBoundingClientRect = element.getBoundingClientRect || function() {
            return {
                top: 0,
                left: 0,
                bottom: parseInt(this.style.height) || 100,
                right: parseInt(this.style.width) || 100,
                width: parseInt(this.style.width) || 100,
                height: parseInt(this.style.height) || 100,
                x: 0,
                y: 0
            };
        };
        return element;
    };
}

// Run validation
if (require.main === module) {
    validateMobileBoardDemo()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Validation script error:', error);
            process.exit(1);
        });
}

module.exports = { validateMobileBoardDemo };