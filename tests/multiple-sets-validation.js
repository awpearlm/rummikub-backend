/**
 * Multiple Sets Validation Tests
 * 
 * This file contains tests for validating multiple sets in the Rummikub game.
 * It specifically focuses on the issue where the Play Selected button doesn't recognize
 * multiple valid groups when they should be valid.
 */

// Mock the game state with a test hand containing known tiles
const mockGameState = {
    playerHand: [
        // Group of 7s (red, blue, yellow)
        { id: 'red_7_0', color: 'red', number: 7, isJoker: false },
        { id: 'blue_7_0', color: 'blue', number: 7, isJoker: false },
        { id: 'yellow_7_0', color: 'yellow', number: 7, isJoker: false },
        
        // Group of 4s (blue, yellow, black)
        { id: 'blue_4_0', color: 'blue', number: 4, isJoker: false },
        { id: 'yellow_4_0', color: 'yellow', number: 4, isJoker: false },
        { id: 'black_4_0', color: 'black', number: 4, isJoker: false },
        
        // Additional tiles not part of test sets
        { id: 'red_2_0', color: 'red', number: 2, isJoker: false },
        { id: 'blue_3_0', color: 'blue', number: 3, isJoker: false },
        { id: 'joker_1', color: null, number: null, isJoker: true }
    ],
    players: [
        { id: 'test_player_id', hasPlayedInitial: false }
    ],
    currentPlayerIndex: 0
};

// Mock the RummikubClient methods needed for testing
const mockClient = {
    gameState: { ...mockGameState },
    socket: { id: 'test_player_id', emit: jest.fn() },
    showNotification: jest.fn(),
    validateAndDebugSet: jest.fn(),
    isValidGroupClient: jest.fn(),
    isValidRunClient: jest.fn(),
    calculateSetValueClient: jest.fn(),
    detectMultipleSets: jest.fn(),
    playSound: jest.fn(),
    isMyTurn: () => true
};

// Test functions
function runDetectMultipleSetsTest() {
    console.log('===== TEST: detectMultipleSets function =====');
    
    // Get original implementation to test
    const detectMultipleSets = RummikubClient.prototype.detectMultipleSets;
    
    // Test case 1: Two groups (7s and 4s)
    const selectedTileIds = [
        'red_7_0', 'blue_7_0', 'yellow_7_0',
        'blue_4_0', 'yellow_4_0', 'black_4_0'
    ];
    
    // Bind the function to our mock client
    const boundFunction = detectMultipleSets.bind(mockClient);
    const result = boundFunction(selectedTileIds);
    
    console.log(`Result sets detected: ${result.length}`);
    result.forEach((set, index) => {
        console.log(`Set ${index + 1}: ${set.join(', ')}`);
    });
    
    // Verify that both sets were detected
    const success = result.length === 2 && 
                  result.some(set => set.includes('red_7_0') && set.includes('blue_7_0') && set.includes('yellow_7_0')) &&
                  result.some(set => set.includes('blue_4_0') && set.includes('yellow_4_0') && set.includes('black_4_0'));
    
    console.log(`Test result: ${success ? 'PASSED' : 'FAILED'}`);
    return success;
}

function runPlaySelectedTilesTest() {
    console.log('===== TEST: playSelectedTiles function =====');
    
    // Create a test version of the playSelectedTiles function
    function testPlaySelectedTiles() {
        // Setup the test scenario
        mockClient.selectedTiles = [
            'red_7_0', 'blue_7_0', 'yellow_7_0',
            'blue_4_0', 'yellow_4_0', 'black_4_0'
        ];
        
        // Mock the validation functions to return true
        mockClient.isValidGroupClient.mockImplementation(() => true);
        mockClient.isValidRunClient.mockImplementation(() => false);
        mockClient.calculateSetValueClient.mockImplementation(() => 15); // 7+7+7 or 4+4+4
        
        // Mock detectMultipleSets to return our two groups
        mockClient.detectMultipleSets.mockImplementation(() => [
            ['red_7_0', 'blue_7_0', 'yellow_7_0'],
            ['blue_4_0', 'yellow_4_0', 'black_4_0']
        ]);
        
        // Get original implementation
        const playSelectedTiles = RummikubClient.prototype.playSelectedTiles;
        
        // Capture socket.emit calls
        mockClient.socket.emit.mockClear();
        
        // Call the function
        const boundFunction = playSelectedTiles.bind(mockClient);
        boundFunction();
        
        // Check what was sent to the server
        const emitCalls = mockClient.socket.emit.mock.calls;
        console.log(`Number of socket.emit calls: ${emitCalls.length}`);
        
        if (emitCalls.length > 0) {
            console.log(`Event emitted: ${emitCalls[0][0]}`);
            console.log('Data sent:', JSON.stringify(emitCalls[0][1], null, 2));
            
            // Check if the correct event and data was sent
            const success = 
                emitCalls[0][0] === 'playSet' && 
                emitCalls[0][1].setArrays && 
                emitCalls[0][1].setArrays.length === 2;
            
            console.log(`Test result: ${success ? 'PASSED' : 'FAILED'}`);
            return success;
        } else {
            console.log('No emit calls were made - this indicates a validation failure');
            console.log(`Test result: FAILED`);
            return false;
        }
    }
    
    return testPlaySelectedTiles();
}

function runValidationTest() {
    console.log('===== TEST: Validation Logic =====');
    
    // This test focuses on the validation logic in playSelectedTiles
    
    // Step 1: Test isValidSetClient
    const isValidSetClient = RummikubClient.prototype.isValidSetClient;
    mockClient.isValidGroupClient.mockImplementation(tiles => {
        // Check if it's a valid group (same number, different colors)
        if (tiles.length < 3) return false;
        
        // Get all numbers and colors
        const numbers = tiles.filter(t => !t.isJoker).map(t => t.number);
        const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
        
        // All tiles must have the same number
        return new Set(numbers).size === 1 && 
               // All tiles must have different colors
               new Set(colors).size === colors.length;
    });
    
    mockClient.isValidRunClient.mockImplementation(() => false);
    
    // Test each set separately
    const group1 = mockGameState.playerHand.filter(t => t.id.includes('7_0'));
    const group2 = mockGameState.playerHand.filter(t => t.id.includes('4_0'));
    
    const boundFunction = isValidSetClient.bind(mockClient);
    const group1Valid = boundFunction(group1);
    const group2Valid = boundFunction(group2);
    
    console.log(`Group of 7s valid? ${group1Valid}`);
    console.log(`Group of 4s valid? ${group2Valid}`);
    
    // Test combined (should fail as a single set, but work as multiple sets)
    const combined = [...group1, ...group2];
    const combinedValid = boundFunction(combined);
    console.log(`Combined as single set valid? ${combinedValid}`);
    
    // Overall validation test
    const success = group1Valid && group2Valid && !combinedValid;
    console.log(`Test result: ${success ? 'PASSED' : 'FAILED'}`);
    return success;
}

function runEndToEndTest() {
    console.log('===== END-TO-END TEST: Multiple Sets Initial Play =====');
    
    // Mock the client with just enough to trace through the full logic
    const testClient = {
        gameState: { ...mockGameState },
        socket: { id: 'test_player_id', emit: jest.fn() },
        selectedTiles: [
            'red_7_0', 'blue_7_0', 'yellow_7_0',
            'blue_4_0', 'yellow_4_0', 'black_4_0'
        ],
        showNotification: jest.fn(msg => console.log(`Notification: ${msg}`)),
        playSound: jest.fn(),
        isMyTurn: () => true
    };
    
    // Bind the real implementation of these methods to our test client
    testClient.isValidRunClient = RummikubClient.prototype.isValidRunClient.bind(testClient);
    testClient.isValidGroupClient = RummikubClient.prototype.isValidGroupClient.bind(testClient);
    testClient.isValidSetClient = RummikubClient.prototype.isValidSetClient.bind(testClient);
    testClient.detectMultipleSets = RummikubClient.prototype.detectMultipleSets.bind(testClient);
    testClient.calculateSetValueClient = RummikubClient.prototype.calculateSetValueClient.bind(testClient);
    testClient.validateAndDebugSet = RummikubClient.prototype.validateAndDebugSet.bind(testClient);
    
    // Now call playSelectedTiles
    const playSelectedTiles = RummikubClient.prototype.playSelectedTiles.bind(testClient);
    
    // Execute the function
    console.log('Executing playSelectedTiles with 6 tiles (two valid groups)...');
    playSelectedTiles();
    
    // Check the result
    const emitCalls = testClient.socket.emit.mock.calls;
    if (emitCalls.length === 0) {
        console.log('ERROR: No socket emit calls were made. Validation failed.');
        console.log('Test result: FAILED');
        return false;
    }
    
    console.log(`Event emitted: ${emitCalls[0][0]}`);
    console.log('Data sent:', JSON.stringify(emitCalls[0][1], null, 2));
    
    const success = emitCalls[0][0] === 'playSet' && 
                  emitCalls[0][1].setArrays && 
                  emitCalls[0][1].setArrays.length === 2;
    
    console.log(`Test result: ${success ? 'PASSED' : 'FAILED'}`);
    return success;
}

// Execute all tests
console.log('\n🧪 RUNNING MULTIPLE SETS VALIDATION TESTS 🧪\n');

const test1Success = runDetectMultipleSetsTest();
console.log('\n');

const test2Success = runPlaySelectedTilesTest();
console.log('\n');

const test3Success = runValidationTest();
console.log('\n');

const test4Success = runEndToEndTest();
console.log('\n');

console.log('🧪 TEST SUMMARY 🧪');
console.log(`Detect Multiple Sets: ${test1Success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Play Selected Tiles: ${test2Success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Validation Logic: ${test3Success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`End-to-End Test: ${test4Success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Overall Result: ${(test1Success && test2Success && test3Success && test4Success) ? '✅ PASSED' : '❌ FAILED'}`);
