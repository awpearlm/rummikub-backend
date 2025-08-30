/**
 * Joker Group Fix - Server Side
 * 
 * This patch fixes the issue with validating joker groups like [JOKER, 13y, 13b]
 * Applied changes to the server.js file in the isValidGroup and playSet functions.
 */

// Documentation of the fixes applied:

// ====== FIX 1: ENHANCED JOKER DETECTION ======

// In the isValidGroup function, we replaced:
// const jokerCount = tiles.filter(t => t.isJoker).length;
// const nonJokers = tiles.filter(t => !t.isJoker);

// With this enhanced version:
// const jokerCount = tiles.filter(t => {
//   return t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'));
// }).length;
// const nonJokers = tiles.filter(t => {
//   return !(t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker')));
// });

// ====== FIX 2: IMPROVED TILE DETAILS LOGGING ======

// Updated the tile details logging to use the enhanced joker detection:
// const tileDetails = tiles.map(t => {
//   if (t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'))) return "JOKER";
//   return `${t.number}${t.color.charAt(0)}`;
// }).join(", ");

// ====== FIX 3: JOKER NORMALIZATION IN PLAYSET ======

// In the playSet function, added normalization after retrieving tiles:
// tiles.forEach(tile => {
//   if (tile.id && tile.id.toLowerCase().includes('joker')) {
//     // Ensure joker properties are set correctly
//     tile.isJoker = true;
//     tile.color = null;
//     tile.number = null;
//   }
// });

// ====== FIX 4: JOKER NORMALIZATION IN PLAYMULTIPLESETS ======

// In the playMultipleSets function, added the same normalization for consistency:
// tiles.forEach(tile => {
//   if (tile.id && tile.id.toLowerCase().includes('joker')) {
//     // Ensure joker properties are set correctly
//     tile.isJoker = true;
//     tile.color = null;
//     tile.number = null;
//   }
// });

/**
 * WHY THIS WORKS:
 * 
 * The issue was that sometimes the joker object's isJoker property wasn't being 
 * properly preserved during serialization/deserialization between client and server.
 * 
 * Our fix uses two strategies:
 * 
 * 1. Enhanced detection: We now identify jokers by either the isJoker property OR
 *    by checking if the tile's ID contains "joker"
 * 
 * 2. Normalization: We ensure all joker objects have consistent properties by
 *    setting isJoker=true, color=null, and number=null for any tile with "joker" in the ID
 * 
 * This provides redundancy in joker detection and makes the system more robust.
 */

// Export the test cases for Cypress integration
module.exports = {
  // Test case: JOKER, 13y, 13b
  testCase1: [
    { id: 'joker_1', isJoker: true, color: null, number: null },
    { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
  ],
  
  // Test case: 13b, 13y, JOKER
  testCase2: [
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 },
    { id: 'yellow_13', isJoker: false, color: 'yellow', number: 13 },
    { id: 'joker_1', isJoker: true, color: null, number: null }
  ],
  
  // Test case: JOKER, JOKER, 13b
  testCase3: [
    { id: 'joker_1', isJoker: true, color: null, number: null },
    { id: 'joker_2', isJoker: true, color: null, number: null },
    { id: 'blue_13', isJoker: false, color: 'blue', number: 13 }
  ]
};
