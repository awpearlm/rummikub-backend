/**
 * Validation script to test the "Go to my game" button fix
 */

console.log('🔧 Starting button fix validation...');

// Test 1: Check if the button exists in the DOM
function testButtonExists() {
    const button = document.getElementById('createGameWithSettingsBtn');
    if (button) {
        console.log('✅ Test 1 PASSED: Button exists in DOM');
        return true;
    } else {
        console.error('❌ Test 1 FAILED: Button not found in DOM');
        return false;
    }
}

// Test 2: Check if addSafeEventListener function exists
function testSafeEventListener() {
    if (typeof addSafeEventListener === 'function') {
        console.log('✅ Test 2 PASSED: addSafeEventListener function exists');
        return true;
    } else {
        console.error('❌ Test 2 FAILED: addSafeEventListener function not found');
        return false;
    }
}

// Test 3: Check if modal styles are loaded
function testModalStyles() {
    const modal = document.getElementById('gameSettingsModal');
    if (!modal) {
        console.error('❌ Test 3 FAILED: Modal element not found');
        return false;
    }
    
    // Add show class and check if it displays
    modal.classList.add('show');
    const styles = getComputedStyle(modal);
    const isVisible = styles.display === 'flex';
    modal.classList.remove('show');
    
    if (isVisible) {
        console.log('✅ Test 3 PASSED: Modal styles are working');
        return true;
    } else {
        console.error('❌ Test 3 FAILED: Modal styles not working', {
            display: styles.display,
            visibility: styles.visibility
        });
        return false;
    }
}

// Test 4: Check if authentication data is present
function testAuthentication() {
    const token = localStorage.getItem('auth_token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        console.log('✅ Test 4 PASSED: Authentication data present', { username });
        return true;
    } else {
        console.warn('⚠️ Test 4 WARNING: No authentication data found', {
            token: token ? 'present' : 'missing',
            username: username || 'missing'
        });
        return false;
    }
}

// Test 5: Simulate the complete flow
function testCompleteFlow() {
    console.log('🔧 Testing complete flow...');
    
    // Set up mock auth if needed
    if (!localStorage.getItem('auth_token')) {
        localStorage.setItem('auth_token', 'test_token');
        localStorage.setItem('username', 'TestUser');
        console.log('🔧 Set up mock authentication');
    }
    
    // Check if RummikubClient exists
    if (typeof RummikubClient === 'undefined') {
        console.error('❌ Test 5 FAILED: RummikubClient not found');
        return false;
    }
    
    try {
        // Create a test client
        const testClient = new RummikubClient();
        
        // Test createGame
        testClient.createGame();
        
        // Check if modal is open
        const modal = document.getElementById('gameSettingsModal');
        const isModalOpen = modal && modal.classList.contains('show');
        
        if (isModalOpen) {
            console.log('✅ Test 5 PASSED: Complete flow working');
            
            // Clean up
            modal.classList.remove('show');
            return true;
        } else {
            console.error('❌ Test 5 FAILED: Modal not opened by createGame');
            return false;
        }
    } catch (error) {
        console.error('❌ Test 5 FAILED: Error in complete flow', error);
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('🚀 Running all validation tests...');
    
    const tests = [
        { name: 'Button Exists', fn: testButtonExists },
        { name: 'Safe Event Listener', fn: testSafeEventListener },
        { name: 'Modal Styles', fn: testModalStyles },
        { name: 'Authentication', fn: testAuthentication },
        { name: 'Complete Flow', fn: testCompleteFlow }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        console.log(`\n🔧 Running test: ${test.name}`);
        try {
            if (test.fn()) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`❌ Test ${test.name} threw error:`, error);
            failed++;
        }
    });
    
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED! The button fix should be working.');
    } else {
        console.log('⚠️ Some tests failed. The button may not work properly.');
    }
    
    return failed === 0;
}

// Export for use in browser console
window.validateButtonFix = runAllTests;

// Auto-run if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 1000); // Wait 1 second for everything to load
    });
} else {
    setTimeout(runAllTests, 1000);
}