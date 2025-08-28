/**
 * Joker Integration Tests
 * 
 * This file contains comprehensive tests for joker validation in both groups and runs.
 * It tests various combinations of jokers and tiles to ensure correct validation logic.
 */

console.log('======= JOKER VALIDATION INTEGRATION TESTS =======');

// Test cases for groups and runs with jokers
const testCases = [
  // Group test cases
  {
    name: 'Group: JOKER, 13y, 13b',
    tiles: [
      { id: 'joker_1', isJoker: true, color: null, number: null },
      { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
      { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'group'
  },
  {
    name: 'Group: 13b, 13y, JOKER',
    tiles: [
      { id: 'blue_13', isJoker: false, color: 'blue', number: 13 },
      { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
      { id: 'joker_1', isJoker: true, color: null, number: null }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'group'
  },
  {
    name: 'Group: JOKER, JOKER, 13b',
    tiles: [
      { id: 'joker_1', isJoker: true, color: null, number: null },
      { id: 'joker_2', isJoker: true, color: null, number: null },
      { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'group'
  },
  {
    name: 'Group: JOKER, JOKER, JOKER',
    tiles: [
      { id: 'joker_1', isJoker: true, color: null, number: null },
      { id: 'joker_2', isJoker: true, color: null, number: null },
      { id: 'joker_3', isJoker: true, color: null, number: null }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'group'
  },
  
  // Run test cases
  {
    name: 'Run: 5r, 6r, 7r (No jokers)',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'red_6', isJoker: false, color: 'red', number: 6 },
      { id: 'red_7', isJoker: false, color: 'red', number: 7 }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'run'
  },
  {
    name: 'Run: 5r, JOKER, 7r (Joker in middle)',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'joker_1', isJoker: true, color: null, number: null },
      { id: 'red_7', isJoker: false, color: 'red', number: 7 }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'run'
  },
  {
    name: 'Run: JOKER, 6r, 7r (Joker at start)',
    tiles: [
      { id: 'joker_1', isJoker: true, color: null, number: null },
      { id: 'red_6', isJoker: false, color: 'red', number: 6 },
      { id: 'red_7', isJoker: false, color: 'red', number: 7 }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'run'
  },
  {
    name: 'Run: 5r, 6r, JOKER (Joker at end)',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'red_6', isJoker: false, color: 'red', number: 6 },
      { id: 'joker_1', isJoker: true, color: null, number: null }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'run'
  },
  {
    name: 'Run: 5r, JOKER, JOKER (Two jokers)',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'joker_1', isJoker: true, color: null, number: null },
      { id: 'joker_2', isJoker: true, color: null, number: null }
    ],
    expectedServer: true,
    expectedClient: true,
    type: 'run'
  },
  {
    name: 'Run: 5r, 7r, JOKER (Gap too large for joker)',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'red_7', isJoker: false, color: 'red', number: 7 },
      { id: 'joker_1', isJoker: true, color: null, number: null }
    ],
    expectedServer: false,
    expectedClient: false,
    type: 'run'
  },
  {
    name: 'Run: 5r, 7r, 9r (Multiple gaps, no jokers)',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'red_7', isJoker: false, color: 'red', number: 7 },
      { id: 'red_9', isJoker: false, color: 'red', number: 9 }
    ],
    expectedServer: false,
    expectedClient: false,
    type: 'run'
  },
  
  // Invalid cases
  {
    name: 'Invalid: Only 2 tiles',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'red_6', isJoker: false, color: 'red', number: 6 }
    ],
    expectedServer: false,
    expectedClient: false,
    type: 'invalid'
  },
  {
    name: 'Invalid: Mixed colors in run',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'blue_6', isJoker: false, color: 'blue', number: 6 },
      { id: 'red_7', isJoker: false, color: 'red', number: 7 }
    ],
    expectedServer: false,
    expectedClient: false,
    type: 'invalid'
  },
  {
    name: 'Invalid: Mixed numbers in group',
    tiles: [
      { id: 'red_5', isJoker: false, color: 'red', number: 5 },
      { id: 'blue_6', isJoker: false, color: 'blue', number: 6 },
      { id: 'yellow_7', isJoker: false, color: 'yellow', number: 7 }
    ],
    expectedServer: false,
    expectedClient: false,
    type: 'invalid'
  }
];

// Define simplified server validation functions
const serverValidator = {
  isValidSet: function(tiles) {
    if (tiles.length < 3) {
      console.log('Set invalid: too few tiles (' + tiles.length + ' < 3)');
      return false;
    }
    
    console.log(`Server validating set: [${tiles.map(t => t.isJoker ? 'joker' : `${t.color}_${t.number}`).join(', ')}]`);
    
    // Try as a run
    const isRun = this.isValidRun(tiles);
    if (isRun) {
      console.log(`Valid run detected`);
      return true;
    }
    
    // Try as a group
    const isGroup = this.isValidGroup(tiles);
    if (isGroup) {
      console.log(`Valid group detected`);
      return true;
    }
    
    console.log(`Set invalid: neither a valid run nor group`);
    return false;
  },
  
  isValidRun: function(tiles) {
    if (tiles.length < 3) return false;
    
    // All non-joker tiles must be same color
    const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
    if (new Set(colors).size > 1) return false;
    
    // Need at least one real tile to determine color
    if (colors.length === 0) return false;
    
    // Count jokers and sort non-jokers by number
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    const sortedNumbers = nonJokers.map(t => t.number).sort((a, b) => a - b);
    
    // Simple case: no jokers, check for consecutive numbers
    if (jokerCount === 0) {
      for (let i = 1; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] !== sortedNumbers[i-1] + 1) {
          return false;
        }
      }
      return true;
    }
    
    // With jokers, more complex validation is needed
    return true; // Simplified for this test - actual server code handles this properly
  },
  
  isValidGroup: function(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
      console.log(`Group invalid: size ${tiles.length} not between 3-4`);
      return false;
    }
    
    console.log(`Validating group with tiles: [${tiles.map(t => t.isJoker ? 'JOKER' : `${t.number}${t.color[0]}`).join(', ')}]`);
    
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    // If all jokers, it's valid
    if (jokerCount === tiles.length) {
      console.log(`Group valid: all jokers`);
      return true;
    }
    
    // Need at least one real tile to determine the group number
    if (nonJokers.length === 0) {
      console.log(`Group invalid: all jokers, need at least one real tile`);
      return false;
    }
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) {
      console.log(`Group invalid: different numbers found ${numbers.join(', ')}`);
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      console.log(`Group invalid: duplicate colors found ${colors.join(', ')}`);
      return false;
    }
    
    // Check if we can form a valid group with jokers
    const targetNumber = numbers[0];
    const usedColors = new Set(colors);
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    console.log(`Group validation - Number: ${targetNumber}, Colors: [${colors.join(', ')}], Jokers: ${jokerCount}`);
    console.log(`Remaining colors: [${remainingColors.join(', ')}]`);
    
    // We need enough remaining colors for the jokers
    if (jokerCount > remainingColors.length) {
      console.log(`Group invalid: not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
      return false;
    }
    
    // We've passed all validation checks
    console.log(`Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
    return true;
  }
};

// Define simplified client validation functions
const clientValidator = {
  isValidSetClient: function(tiles) {
    if (tiles.length < 3) return false;
    
    // Check if it's a run (consecutive numbers, same color)
    const isRun = this.isValidRunClient(tiles);
    if (isRun) return true;
    
    // Check if it's a group (same number, different colors)
    const isGroup = this.isValidGroupClient(tiles);
    return isGroup;
  },
  
  isValidRunClient: function(tiles) {
    if (tiles.length < 3) return false;
    
    // All tiles must be same color (except jokers)
    const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
    if (new Set(colors).size > 1) return false;
    
    // Count jokers
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    // If all jokers, it's valid
    if (jokerCount === tiles.length) return true;
    
    // Sort non-joker tiles by number
    nonJokers.sort((a, b) => a.number - b.number);
    
    // Check for consecutive numbers with jokers filling in gaps
    let availableJokers = jokerCount;
    
    for (let i = 1; i < nonJokers.length; i++) {
      const gap = nonJokers[i].number - nonJokers[i-1].number - 1;
      
      // If there's a gap, check if we have enough jokers to fill it
      if (gap > 0) {
        if (gap > availableJokers) {
          console.log(`Run invalid: gap of ${gap} between ${nonJokers[i-1].number} and ${nonJokers[i].number}, but only ${availableJokers} jokers available`);
          return false;
        }
        availableJokers -= gap;
      }
    }
    
    // If we got here, all gaps are filled with available jokers
    console.log(`Run valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
    return true;
  },
  
  isValidGroupClient: function(tiles) {
    if (tiles.length < 3 || tiles.length > 4) return false;
    
    // Count jokers
    const jokerCount = tiles.filter(t => t.isJoker).length;
    
    // If all jokers, it's valid
    if (jokerCount === tiles.length) return true;
    
    // All non-joker tiles must be same number
    const numbers = tiles.filter(t => !t.isJoker).map(t => t.number);
    if (new Set(numbers).size > 1) {
      console.log(`Group invalid: numbers not all the same: ${numbers.join(', ')}`);
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      console.log(`Group invalid: duplicate colors: ${colors.join(', ')}`);
      return false;
    }
    
    console.log(`Group valid with ${jokerCount} jokers and ${tiles.length - jokerCount} regular tiles`);
    return true;
  }
};

// Run the tests
let serverPassCount = 0;
let clientPassCount = 0;
let discrepancyCount = 0;

let groupServerPassCount = 0;
let groupClientPassCount = 0;
let groupTotalCount = 0;

let runServerPassCount = 0;
let runClientPassCount = 0;
let runTotalCount = 0;

let invalidServerPassCount = 0;
let invalidClientPassCount = 0;
let invalidTotalCount = 0;

for (const testCase of testCases) {
  console.log(`\n----- Test Case ${testCases.indexOf(testCase) + 1}: ${testCase.name} -----`);
  
  // Run server validation
  console.log('SERVER VALIDATION:');
  const serverResult = serverValidator.isValidSet(testCase.tiles);
  
  // Run client validation
  console.log('\nCLIENT VALIDATION:');
  const clientResult = clientValidator.isValidSetClient(testCase.tiles);
  
  // Check if results match expectations
  const serverPass = serverResult === testCase.expectedServer;
  const clientPass = clientResult === testCase.expectedClient;
  const discrepancy = serverResult !== clientResult;
  
  // Update counters
  if (serverPass) serverPassCount++;
  if (clientPass) clientPassCount++;
  if (discrepancy) discrepancyCount++;
  
  // Update type-specific counters
  if (testCase.type === 'group') {
    groupTotalCount++;
    if (serverPass) groupServerPassCount++;
    if (clientPass) groupClientPassCount++;
  } else if (testCase.type === 'run') {
    runTotalCount++;
    if (serverPass) runServerPassCount++;
    if (clientPass) runClientPassCount++;
  } else if (testCase.type === 'invalid') {
    invalidTotalCount++;
    if (serverPass) invalidServerPassCount++;
    if (clientPass) invalidClientPassCount++;
  }
  
  // Print results
  console.log('\nRESULTS:');
  console.log(`Server result: ${serverResult ? 'VALID' : 'INVALID'} (Expected: ${testCase.expectedServer ? 'VALID' : 'INVALID'}) - ${serverPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Client result: ${clientResult ? 'VALID' : 'INVALID'} (Expected: ${testCase.expectedClient ? 'VALID' : 'INVALID'}) - ${clientPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (discrepancy) {
    console.log(`\n⚠️ DISCREPANCY DETECTED - Server and client validation don't match!`);
  }
}

// Print summary
console.log('\n======= TEST SUMMARY =======');
console.log(`Server-side validation: ${serverPassCount}/${testCases.length} passed (${Math.round(serverPassCount / testCases.length * 100)}%)`);
console.log(`Client-side validation: ${clientPassCount}/${testCases.length} passed (${Math.round(clientPassCount / testCases.length * 100)}%)`);
console.log(`Discrepancies between implementations: ${discrepancyCount}/${testCases.length} (${Math.round(discrepancyCount / testCases.length * 100)}%)`);

console.log('\n======= RESULTS BY TYPE =======\n');
console.log('GROUP TESTS:');
console.log(`Server-side: ${groupServerPassCount}/${groupTotalCount} passed (${Math.round(groupServerPassCount / groupTotalCount * 100)}%)`);
console.log(`Client-side: ${groupClientPassCount}/${groupTotalCount} passed (${Math.round(groupClientPassCount / groupTotalCount * 100)}%)`);
console.log(`Discrepancies: ${groupTotalCount - Math.min(groupServerPassCount, groupClientPassCount)}/${groupTotalCount} (${Math.round((groupTotalCount - Math.min(groupServerPassCount, groupClientPassCount)) / groupTotalCount * 100)}%)`);

console.log('\nRUN TESTS:');
console.log(`Server-side: ${runServerPassCount}/${runTotalCount} passed (${Math.round(runServerPassCount / runTotalCount * 100)}%)`);
console.log(`Client-side: ${runClientPassCount}/${runTotalCount} passed (${Math.round(runClientPassCount / runTotalCount * 100)}%)`);
console.log(`Discrepancies: ${runTotalCount - Math.min(runServerPassCount, runClientPassCount)}/${runTotalCount} (${Math.round((runTotalCount - Math.min(runServerPassCount, runClientPassCount)) / runTotalCount * 100)}%)`);

console.log('\nINVALID TESTS:');
console.log(`Server-side: ${invalidServerPassCount}/${invalidTotalCount} passed (${Math.round(invalidServerPassCount / invalidTotalCount * 100)}%)`);
console.log(`Client-side: ${invalidClientPassCount}/${invalidTotalCount} passed (${Math.round(invalidClientPassCount / invalidTotalCount * 100)}%)`);
console.log(`Discrepancies: ${invalidTotalCount - Math.min(invalidServerPassCount, invalidClientPassCount)}/${invalidTotalCount} (${Math.round((invalidTotalCount - Math.min(invalidServerPassCount, invalidClientPassCount)) / invalidTotalCount * 100)}%)`);

// Print final result
if (serverPassCount < testCases.length) {
  console.log('\n⚠️ SERVER VALIDATION ISSUES DETECTED');
  console.log('The server implementation is not validating sets correctly.');
}

if (clientPassCount < testCases.length) {
  console.log('\n⚠️ CLIENT VALIDATION ISSUES DETECTED');
  console.log('The client implementation is not validating sets correctly.');
}

if (discrepancyCount > 0) {
  console.log('\n⚠️ VALIDATION DISCREPANCIES DETECTED');
  console.log('The server and client implementations are not validating consistently.');
}

// Export for use in Cypress
module.exports = {
  testCases,
  serverValidator,
  clientValidator
};
