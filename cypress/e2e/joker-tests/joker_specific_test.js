/**
 * Joker Group Fix Test
 * 
 * This script tests the fix for the JOKER, 13y, 13b validation issue.
 * Run this script to test both the original implementation and the fixed implementation.
 */

console.log('======= DETAILED JOKER GROUP VALIDATION TEST =======');
console.log('Testing problematic case: JOKER, 13y, 13b (Server rejects but client accepts)\n');

// Create test tiles
const testTiles = [
  { id: 'joker_1', isJoker: true, color: null, number: null },
  { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
  { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
];

console.log('Tiles to validate: [JOKER, 13y, 13b]\n');

// Original server implementation
function isValidGroupOriginal(tiles) {
  console.log('⚙️ SERVER VALIDATION STEPS:');
  
  // Step 1: Check tile count
  if (tiles.length < 3 || tiles.length > 4) {
    console.log('❌ Step 1: Invalid tile count - not between 3-4');
    return false;
  }
  console.log('✅ Step 1: Tile count OK - between 3-4');
  
  // Step 2: Count jokers
  const jokerCount = tiles.filter(t => t.isJoker).length;
  const nonJokers = tiles.filter(t => !t.isJoker);
  console.log(`ℹ️ Step 2: Found ${jokerCount} jokers and ${nonJokers.length} non-jokers`);
  
  // Step 3: Check if all jokers
  if (jokerCount === tiles.length) {
    console.log('✅ Step 3: All jokers - valid group');
    return true;
  }
  console.log('ℹ️ Step 3: Not all jokers - continuing validation');
  
  // Step 4: Need at least one real tile
  if (nonJokers.length === 0) {
    console.log('❌ Step 4: No real tiles to determine group number');
    return false;
  }
  console.log('✅ Step 4: At least one real tile present');
  
  // Step 5: All non-joker tiles must be same number
  const numbers = nonJokers.map(t => t.number);
  if (new Set(numbers).size > 1) {
    console.log(`❌ Step 5: Different numbers found: ${numbers.join(', ')}`);
    return false;
  }
  console.log(`✅ Step 5: All non-jokers have same number: ${numbers[0]}`);
  
  // Step 6: All non-joker tiles must be different colors
  const colors = nonJokers.map(t => t.color);
  if (new Set(colors).size !== colors.length) {
    console.log(`❌ Step 6: Duplicate colors found: ${colors.join(', ')}`);
    return false;
  }
  console.log(`✅ Step 6: All non-jokers have different colors: ${colors.join(', ')}`);
  
  // Step 7: Check if we can form a valid group with jokers
  const targetNumber = numbers[0];
  const usedColors = new Set(colors);
  const availableColors = ['red', 'blue', 'yellow', 'black'];
  const remainingColors = availableColors.filter(color => !usedColors.has(color));
  
  console.log(`ℹ️ Step 7: Used colors: ${colors.join(', ')}`);
  console.log(`ℹ️ Step 7: Remaining colors: ${remainingColors.join(', ')}`);
  
  // We need enough remaining colors for the jokers
  if (jokerCount > remainingColors.length) {
    console.log(`❌ Step 7: Not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
    return false;
  }
  console.log(`✅ Step 7: Enough remaining colors (${remainingColors.length}) for jokers (${jokerCount})`);
  
  // Step 8: Groups can have at most 4 tiles (one of each color)
  if (nonJokers.length + jokerCount > 4) {
    console.log(`❌ Step 8: Too many tiles (${nonJokers.length} + ${jokerCount} jokers > 4)`);
    return false;
  }
  console.log(`✅ Step 8: Total tiles (${tiles.length}) doesn't exceed 4`);
  
  // We've passed all validation checks
  console.log(`✅ FINAL: Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
  return true;
}

// Client implementation (simplified version)
function isValidGroupClient(tiles) {
  console.log('⚙️ CLIENT VALIDATION STEPS:');
  
  // Step 1: Check tile count
  if (tiles.length < 3 || tiles.length > 4) {
    console.log('❌ Step 1: Invalid tile count - not between 3-4');
    return false;
  }
  console.log('✅ Step 1: Tile count OK - between 3-4');
  
  // Step 2: Count jokers
  const jokerCount = tiles.filter(t => t.isJoker).length;
  console.log(`ℹ️ Step 2: Found ${jokerCount} jokers`);
  
  // Step 3: Check if all jokers
  if (jokerCount === tiles.length) {
    console.log('✅ Step 3: All jokers - valid group');
    return true;
  }
  console.log('ℹ️ Step 3: Not all jokers - continuing validation');
  
  // Step 4: All non-joker tiles must be same number
  const numbers = tiles.filter(t => !t.isJoker).map(t => t.number);
  if (new Set(numbers).size > 1) {
    console.log(`❌ Step 4: Different numbers found: ${numbers.join(', ')}`);
    return false;
  }
  console.log(`✅ Step 4: All non-jokers have same number: ${numbers[0]}`);
  
  // Step 5: All non-joker tiles must be different colors
  const colors = tiles.filter(t => !t.isJoker).map(t => t.color);
  if (new Set(colors).size !== colors.length) {
    console.log(`❌ Step 5: Duplicate colors found: ${colors.join(', ')}`);
    return false;
  }
  console.log(`✅ Step 5: All non-jokers have different colors: ${colors.join(', ')}`);
  
  // We've passed all validation checks
  console.log(`✅ FINAL: Group valid with ${jokerCount} jokers and ${tiles.length - jokerCount} regular tiles`);
  return true;
}

// Fixed server implementation (with enhanced joker detection)
function isValidGroupFixed(tiles) {
  console.log('⚙️ SERVER VALIDATION (FIXED VERSION) STEPS:');
  
  // Step 1: Check tile count
  if (tiles.length < 3 || tiles.length > 4) {
    console.log('❌ Step 1: Invalid tile count - not between 3-4');
    return false;
  }
  console.log('✅ Step 1: Tile count OK - between 3-4');
  
  // Step 2: Count jokers - ENHANCED DETECTION
  const jokerCount = tiles.filter(t => {
    return t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'));
  }).length;
  const nonJokers = tiles.filter(t => {
    // Use the same enhanced detection logic but inverted
    return !(t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker')));
  });
  console.log(`ℹ️ Step 2: Found ${jokerCount} jokers and ${nonJokers.length} non-jokers`);
  
  // Step 3: Check if all jokers
  if (jokerCount === tiles.length) {
    console.log('✅ Step 3: All jokers - valid group');
    return true;
  }
  console.log('ℹ️ Step 3: Not all jokers - continuing validation');
  
  // Step 4: All non-joker tiles must be same number
  const numbers = nonJokers.map(t => t.number);
  if (new Set(numbers).size > 1) {
    console.log(`❌ Step 4: Different numbers found: ${numbers.join(', ')}`);
    return false;
  }
  console.log(`✅ Step 4: All non-jokers have same number: ${numbers[0]}`);
  
  // Step 5: All non-joker tiles must be different colors
  const colors = nonJokers.map(t => t.color);
  if (new Set(colors).size !== colors.length) {
    console.log(`❌ Step 5: Duplicate colors found: ${colors.join(', ')}`);
    return false;
  }
  console.log(`✅ Step 5: All non-jokers have different colors: ${colors.join(', ')}`);
  
  // Step 6: Groups can have at most 4 tiles (one of each color)
  if (nonJokers.length + jokerCount > 4) {
    console.log(`❌ Step 6: Too many tiles (${nonJokers.length} + ${jokerCount} jokers > 4)`);
    return false;
  }
  console.log(`✅ Step 6: Total tiles (${tiles.length}) doesn't exceed 4`);
  
  // We've passed all validation checks
  console.log(`✅ FINAL: Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
  return true;
}

// Run the tests
console.log('\n------ CURRENT SERVER IMPLEMENTATION ------');
const serverResult = isValidGroupOriginal(testTiles);

console.log('\n------ CLIENT IMPLEMENTATION ------');
const clientResult = isValidGroupClient(testTiles);

console.log('\n------ FIXED SERVER IMPLEMENTATION ------');
const fixedResult = isValidGroupFixed(testTiles);

// Print the summary
console.log('\n======= TEST SUMMARY =======');
console.log(`Server validation result: ${serverResult ? 'VALID ✅' : 'INVALID ❌'}`);
console.log(`Client validation result: ${clientResult ? 'VALID ✅' : 'INVALID ❌'}`);
console.log(`Fixed server validation result: ${fixedResult ? 'VALID ✅' : 'INVALID ❌'}`);

if (serverResult === clientResult) {
  console.log('\n✅ No discrepancy detected - server and client implementations match.');
} else {
  console.log('\n❌ DISCREPANCY DETECTED: The server and client implementations give different results.');
  console.log('This explains the bug you\'re experiencing - the client accepts the set but the server rejects it.');
}

// For using this in the Cypress test environment
module.exports = {
  isValidGroupOriginal,
  isValidGroupClient,
  isValidGroupFixed,
  testTiles
};
