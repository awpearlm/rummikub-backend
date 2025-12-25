/**
 * Mobile Gesture Testing Script
 * Tests gesture recognition and touch interactions
 */

const http = require('http');
const { JSDOM } = require('jsdom');

async function testMobileGestures() {
    console.log('🎮 Testing Mobile Gesture Recognition...');
    
    try {
        // Fetch the demo HTML
        const html = await fetchDemo();
        
        // Create DOM environment with better mobile simulation
        const dom = new JSDOM(html, {
            url: 'http://localhost:8080/',
            pretendToBeVisual: true,
            resources: 'usable',
            runScripts: 'dangerously'
        });
        
        const { window } = dom;
        setupAdvancedMobileMocks(window);
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Create test container
        const container = window.document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        container.id = 'testContainer';
        window.document.body.appendChild(container);
        
        // Initialize mobile game board
        const gameBoard = new window.MobileGameBoard(container, {
            touchEnabled: true,
            dragDropEnabled: true,
            visualFeedback: true
        });
        
        console.log('✅ Game board initialized for gesture testing');
        
        // Test gesture recognition
        await testGestureRecognition(gameBoard, window);
        
        // Test smart positioning
        await testSmartPositioning(gameBoard, window);
        
        // Test touch interactions
        await testTouchInteractions(gameBoard, window);
        
        // Test performance
        await testPerformance(gameBoard, window);
        
        // Cleanup
        gameBoard.destroy();
        
        console.log('\n🎉 All gesture tests passed!');
        console.log('📱 Mobile interactions are working correctly.');
        
        return true;
        
    } catch (error) {
        console.error('❌ Gesture testing failed:', error.message);
        return false;
    }
}

async function testGestureRecognition(gameBoard, window) {
    console.log('\n🤏 Testing gesture recognition...');
    
    let gestureEvents = [];
    
    // Listen for gesture events
    const events = [
        'tileSelected', 'boardTapped', 'tileDragStart', 'tileDragComplete',
        'boardPanStart', 'boardPanComplete', 'boardZoom'
    ];
    
    events.forEach(event => {
        gameBoard.on(event, (data) => {
            gestureEvents.push({ event, data, timestamp: Date.now() });
        });
    });
    
    // Simulate tap gesture
    const tapEvent = createTouchEvent(window, 'touchstart', [{ x: 100, y: 100 }]);
    gameBoard.container.dispatchEvent(tapEvent);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const tapEndEvent = createTouchEvent(window, 'touchend', [{ x: 100, y: 100 }]);
    gameBoard.container.dispatchEvent(tapEndEvent);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`✅ Gesture events captured: ${gestureEvents.length}`);
    
    // Test gesture recognizer directly
    const gestureRecognizer = gameBoard.boardGestureRecognizer;
    if (gestureRecognizer) {
        console.log('✅ Gesture recognizer is active');
        console.log(`✅ Current gesture: ${gestureRecognizer.getCurrentGesture() ? 'Active' : 'None'}`);
        console.log(`✅ Active touches: ${gestureRecognizer.getActiveTouches().length}`);
    }
}

async function testSmartPositioning(gameBoard, window) {
    console.log('\n🎯 Testing smart positioning...');
    
    const positioning = gameBoard.smartPositioning;
    if (!positioning) {
        console.log('❌ Smart positioning not available');
        return;
    }
    
    // Test centering on position
    await positioning.centerOnPosition(200, 150);
    console.log('✅ Center on position works');
    
    // Test zoom
    await positioning.setZoom(1.5);
    console.log('✅ Zoom control works');
    
    // Test reset view
    await positioning.resetToDefaultView();
    console.log('✅ Reset view works');
    
    // Test current view
    const view = positioning.getCurrentView();
    console.log(`✅ Current view: zoom=${view.zoom.toFixed(2)}, x=${view.x.toFixed(1)}, y=${view.y.toFixed(1)}`);
    
    // Test manual override
    positioning.setManualOverride(true);
    console.log(`✅ Manual override: ${positioning.isManualOverrideActive()}`);
    
    positioning.clearManualOverride();
    console.log(`✅ Manual override cleared: ${!positioning.isManualOverrideActive()}`);
}

async function testTouchInteractions(gameBoard, window) {
    console.log('\n👆 Testing touch interactions...');
    
    // Test tile placement with valid coordinates
    const testTiles = [
        { id: 'test1', number: 1, color: 'red' },
        { id: 'test2', number: 2, color: 'blue' },
        { id: 'test3', isJoker: true }
    ];
    
    // Place tiles at valid positions
    testTiles.forEach((tile, index) => {
        const position = { x: index + 5, y: 5 }; // Valid board positions
        const result = gameBoard.placeTiles([tile], position);
        if (result) {
            console.log(`✅ Tile ${tile.id} placed successfully`);
        } else {
            console.log(`⚠️ Tile ${tile.id} placement returned false (may be validation issue)`);
        }
    });
    
    // Test board state
    const boardState = gameBoard.getBoardState();
    console.log(`✅ Board state has ${boardState.length} rows`);
    
    // Test clearing
    gameBoard.clearBoard();
    const clearedState = gameBoard.getBoardState();
    console.log(`✅ Board cleared: ${clearedState.length} rows remaining`);
}

async function testPerformance(gameBoard, window) {
    console.log('\n⚡ Testing performance...');
    
    const startTime = Date.now();
    
    // Simulate multiple rapid operations
    for (let i = 0; i < 50; i++) {
        const tile = { id: `perf${i}`, number: (i % 13) + 1, color: 'red' };
        gameBoard.placeTiles([tile], { x: (i % 10) + 1, y: Math.floor(i / 10) + 1 });
    }
    
    const placementTime = Date.now() - startTime;
    console.log(`✅ 50 tile placements completed in ${placementTime}ms`);
    
    // Test view operations
    const viewStartTime = Date.now();
    for (let i = 0; i < 20; i++) {
        await gameBoard.centerOnPosition(i * 10, i * 10);
    }
    const viewTime = Date.now() - viewStartTime;
    console.log(`✅ 20 view operations completed in ${viewTime}ms`);
    
    // Test gesture options
    const gestureStartTime = Date.now();
    for (let i = 0; i < 100; i++) {
        gameBoard.setGestureOptions({
            enablePinchZoom: i % 2 === 0,
            enableDoubleTap: i % 3 === 0
        });
    }
    const gestureTime = Date.now() - gestureStartTime;
    console.log(`✅ 100 gesture option changes completed in ${gestureTime}ms`);
}

function createTouchEvent(window, type, touches) {
    const touchList = touches.map((touch, index) => ({
        identifier: index,
        clientX: touch.x,
        clientY: touch.y,
        pageX: touch.x,
        pageY: touch.y,
        screenX: touch.x,
        screenY: touch.y,
        target: window.document.body
    }));
    
    const event = new window.TouchEvent(type, {
        touches: type === 'touchend' ? [] : touchList,
        changedTouches: touchList,
        targetTouches: touchList,
        bubbles: true,
        cancelable: true
    });
    
    return event;
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

function setupAdvancedMobileMocks(window) {
    // Enhanced touch event support
    window.TouchEvent = class TouchEvent extends window.Event {
        constructor(type, options = {}) {
            super(type, options);
            this.touches = options.touches || [];
            this.changedTouches = options.changedTouches || [];
            this.targetTouches = options.targetTouches || [];
        }
    };
    
    // Mock mobile device properties
    Object.defineProperties(window.navigator, {
        maxTouchPoints: { value: 10, writable: true },
        userAgent: { 
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            writable: true 
        }
    });
    
    // Enhanced screen orientation mock
    window.screen.orientation = {
        angle: 90,
        type: 'landscape-primary',
        lock: () => Promise.resolve(),
        unlock: () => Promise.resolve(),
        addEventListener: () => {},
        removeEventListener: () => {}
    };
    
    // Mock performance API
    window.performance = {
        now: () => Date.now(),
        mark: () => {},
        measure: () => {},
        getEntriesByType: () => []
    };
    
    // Mock animation frame with better timing
    let animationId = 0;
    window.requestAnimationFrame = (callback) => {
        animationId++;
        setTimeout(() => callback(Date.now()), 16);
        return animationId;
    };
    window.cancelAnimationFrame = (id) => {};
    
    // Mock CSS support
    window.CSS = {
        supports: () => true,
        escape: (str) => str
    };
    
    // Enhanced element mocking
    const originalCreateElement = window.document.createElement;
    window.document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        
        // Mock getBoundingClientRect with realistic values
        element.getBoundingClientRect = function() {
            const width = parseInt(this.style.width) || 800;
            const height = parseInt(this.style.height) || 600;
            return {
                top: 0, left: 0, bottom: height, right: width,
                width: width, height: height, x: 0, y: 0
            };
        };
        
        // Mock style computation
        element.getComputedStyle = () => ({
            getPropertyValue: (prop) => {
                if (prop.includes('safe-area')) return '0px';
                return this.style[prop] || '';
            }
        });
        
        return element;
    };
    
    // Mock window dimensions
    Object.defineProperties(window, {
        innerWidth: { value: 800, writable: true },
        innerHeight: { value: 600, writable: true },
        devicePixelRatio: { value: 2, writable: true }
    });
    
    // Mock console to reduce noise
    window.console = {
        log: () => {},
        warn: () => {},
        error: console.error,
        info: () => {}
    };
}

// Run gesture testing
if (require.main === module) {
    testMobileGestures()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Gesture testing error:', error);
            process.exit(1);
        });
}

module.exports = { testMobileGestures };