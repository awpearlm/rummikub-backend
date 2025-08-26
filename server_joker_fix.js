/**
 * J_kube Server Joker Fix
 * 
 * This file contains the specific fix for the joker validation issue in the server.js file.
 * Apply this change to fix the joker validation problem where the server is incorrectly
 * rejecting valid joker groups.
 */

// ORIGINAL CODE from server.js with bug:
/* 
isValidGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) {
    console.log(`Group invalid: size ${tiles.length} not between 3-4`);
    return false;
  }
  
  // Create a detailed log of the tiles being validated
  const tileDetails = tiles.map(t => {
    if (t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'))) return "JOKER";
    return `${t.number}${t.color.charAt(0)}`;
  }).join(", ");
  console.log(`Validating group with tiles: [${tileDetails}]`);
  
  // Enhanced joker detection that checks either isJoker property or id
  const jokerCount = tiles.filter(t => {
    return t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'));
  }).length;
  
  // Also update nonJokers filter to use the same enhanced detection
  const nonJokers = tiles.filter(t => {
    return !(t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker')));
  });
  
  // If all jokers, it's valid (matching client-side behavior)
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
  
  // Debug log for group validation
  console.log(`Group validation - Number: ${targetNumber}, Colors: [${colors.join(', ')}], Jokers: ${jokerCount}`);
  console.log(`Remaining colors: [${remainingColors.join(', ')}]`);
  
  // We need enough remaining colors for the jokers
  if (jokerCount > remainingColors.length) {
    console.log(`Group invalid: not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
    return false;
  }
  
  // Groups can have at most 4 tiles (one of each color)
  if (nonJokers.length + jokerCount > 4) {
    console.log(`Group invalid: too many tiles (${nonJokers.length} + ${jokerCount} jokers > 4)`);
    return false;
  }
  
  // We've passed all validation checks
  console.log(`Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
  return true;
}
*/

// FIXED VERSION with improved joker validation:
function isValidGroup(tiles) {
  if (tiles.length < 3 || tiles.length > 4) {
    console.log(`Group invalid: size ${tiles.length} not between 3-4`);
    return false;
  }
  
  // Create a detailed log of the tiles being validated
  const tileDetails = tiles.map(t => {
    if (t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker'))) return "JOKER";
    return `${t.number}${t.color.charAt(0)}`;
  }).join(", ");
  console.log(`Validating group with tiles: [${tileDetails}]`);
  
  // ENHANCED joker detection with multiple fallbacks
  const jokerCount = tiles.filter(t => {
    return t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker'));
  }).length;
  
  // Also update nonJokers filter to use the same enhanced detection
  const nonJokers = tiles.filter(t => {
    return !(t.isJoker || t.number === null || (t.id && t.id.toLowerCase().includes('joker')));
  });
  
  // If all jokers, it's valid (matching client-side behavior)
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
  
  // Debug log for group validation
  console.log(`Group validation - Number: ${targetNumber}, Colors: [${colors.join(', ')}], Jokers: ${jokerCount}`);
  console.log(`Remaining colors: [${remainingColors.join(', ')}]`);
  
  // We need enough remaining colors for the jokers
  if (jokerCount > remainingColors.length) {
    console.log(`Group invalid: not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
    return false;
  }
  
  // Groups can have at most 4 tiles (one of each color)
  if (nonJokers.length + jokerCount > 4) {
    console.log(`Group invalid: too many tiles (${nonJokers.length} + ${jokerCount} jokers > 4)`);
    return false;
  }
  
  // We've passed all validation checks
  console.log(`Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
  return true;
}

// Additional helper function to normalize joker properties in playSet and playMultipleSets
function normalizeJokers(tiles) {
  return tiles.map(tile => {
    // Normalize joker detection - check multiple properties
    if (tile.isJoker || tile.number === null || 
        (tile.id && typeof tile.id === 'string' && tile.id.toLowerCase().includes('joker'))) {
      return { ...tile, isJoker: true, number: null, color: null };
    }
    return tile;
  });
}

// HOW TO APPLY THE FIX:
/*
1. Replace the isValidGroup method in server.js with the fixed version above.

2. Add the normalizeJokers function shown above.

3. Update the playSet method to normalize jokers before validation:
   
   // Find all tiles in the set from the player's hand
   const tilesInSet = tileIds.map(tileId => {
     return currentPlayer.hand.find(tile => tile.id === tileId);
   });
   
   // Check if all tiles were found
   if (tilesInSet.some(tile => !tile)) {
     return socket.emit('error', { message: 'Invalid tiles in set' });
   }
   
   // Normalize joker properties to prevent serialization issues
   const normalizedTiles = normalizeJokers(tilesInSet);
   
   // Validate the set with normalized tiles
   if (!isValidSet(normalizedTiles) && !isValidRun(normalizedTiles)) {
     return socket.emit('error', { message: 'Invalid set' });
   }

4. Update the playMultipleSets method to normalize jokers before validation:

   for (const tileIds of setArrays) {
     const tiles = tileIds.map(id => player.hand.find(t => t.id === id)).filter(Boolean);
     if (tiles.length !== tileIds.length) return false;
     
     // Normalize joker properties to ensure consistency
     const normalizedTiles = normalizeJokers(tiles);
     
     if (!this.isValidSet(normalizedTiles)) return false;
     
     const setValue = this.calculateSetValue(normalizedTiles);
     totalValue += setValue;
     validatedSets.push({ tiles: normalizedTiles, setValue });
   }
*/

// BONUS: Debug function to help identify issues with joker serialization
function debugJokerValidation(tiles) {
  console.log('DEBUG - Joker Validation:');
  console.log('Tiles:', JSON.stringify(tiles));
  
  tiles.forEach((tile, index) => {
    console.log(`Tile ${index}:`, {
      id: tile.id,
      isJoker: tile.isJoker,
      isJokerType: typeof tile.isJoker,
      number: tile.number,
      numberType: typeof tile.number,
      color: tile.color,
      colorType: typeof tile.color,
      hasJokerInId: tile.id && tile.id.includes('joker')
    });
  });
  
  const jokerCount = tiles.filter(t => t.isJoker || t.number === null || 
    (t.id && t.id.toLowerCase().includes('joker'))).length;
  console.log('Joker count:', jokerCount);
  
  const numbers = tiles.filter(t => !(t.isJoker || t.number === null || 
    (t.id && t.id.toLowerCase().includes('joker')))).map(t => t.number);
  console.log('Numbers:', numbers);
  console.log('Unique numbers:', new Set(numbers).size);
  
  const colors = tiles.filter(t => !(t.isJoker || t.number === null || 
    (t.id && t.id.toLowerCase().includes('joker')))).map(t => t.color);
  console.log('Colors:', colors);
  console.log('Unique colors:', new Set(colors).size);
  
  const isValid = isValidGroup(tiles);
  console.log('Is valid group?', isValid);
  
  return isValid;
}
