const fs = require('fs');

// Define new implementations
const updatedIsValidGroup = `  isValidGroup(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
      console.log("Group invalid: size " + tiles.length + " not between 3-4");
      return false;
    }
    
    // Create a detailed log of the tiles being validated
    const tileDetails = tiles.map(t => {
      if (t.isJoker) return "JOKER";
      return t.number + t.color.charAt(0);
    }).join(", ");
    console.log("Validating group with tiles: [" + tileDetails + "]");
    
    const jokerCount = tiles.filter(t => t.isJoker).length;
    const nonJokers = tiles.filter(t => !t.isJoker);
    
    // If all jokers, it's valid (matches client behavior)
    if (jokerCount === tiles.length && tiles.length >= 3) {
      console.log("Group valid: all jokers");
      return true;
    }
    
    // Need at least one real tile to determine the group number
    if (nonJokers.length === 0) {
      console.log("Group invalid: all jokers, need at least one real tile");
      return false;
    }
    
    // All non-joker tiles must be same number
    const numbers = nonJokers.map(t => t.number);
    if (new Set(numbers).size > 1) {
      console.log("Group invalid: different numbers found " + numbers.join(', '));
      return false;
    }
    
    // All non-joker tiles must be different colors
    const colors = nonJokers.map(t => t.color);
    if (new Set(colors).size !== colors.length) {
      console.log("Group invalid: duplicate colors found " + colors.join(', '));
      return false;
    }
    
    // Check if we can form a valid group with jokers
    const targetNumber = numbers[0];
    const usedColors = new Set(colors);
    const availableColors = ['red', 'blue', 'yellow', 'black'];
    const remainingColors = availableColors.filter(color => !usedColors.has(color));
    
    // Debug log for group validation
    console.log("Group validation - Number: " + targetNumber + ", Colors: [" + colors.join(', ') + "], Jokers: " + jokerCount);
    console.log("Remaining colors: [" + remainingColors.join(', ') + "]");
    
    // We need enough remaining colors for the jokers
    if (jokerCount > remainingColors.length) {
      console.log("Group invalid: not enough remaining colors for jokers (" + jokerCount + " jokers, " + remainingColors.length + " colors)");
      return false;
    }
    
    // We've passed all validation checks
    console.log("Group valid with " + jokerCount + " jokers and " + nonJokers.length + " regular tiles");
    return true;
  }`;

const updatedIsValidSet = `  isValidSet(tiles) {
    if (tiles.length < 3) {
      console.log("Set invalid: too few tiles (" + tiles.length + " < 3)");
      return false;
    }
    
    // Log the tiles being validated
    const tileInfo = tiles.map(t => t.isJoker ? "joker" : t.color + "_" + t.number).join(", ");
    console.log("Server validating set: [" + tileInfo + "]");
    
    // Check if it's a run (consecutive numbers, same color)
    const isRun = this.isValidRun(tiles);
    if (isRun) {
      console.log("Valid run detected");
      return true;
    }
    
    // Check if it's a group (same number, different colors)
    const isGroup = this.isValidGroup(tiles);
    if (isGroup) {
      console.log("Valid group detected");
    } else {
      console.log("Set invalid: neither a valid run nor group");
    }
    return isGroup;
  }`;

// Write to files
fs.writeFileSync('updated_isValidGroup.js', updatedIsValidGroup);
fs.writeFileSync('updated_isValidSet.js', updatedIsValidSet);

console.log("Files created successfully!");
