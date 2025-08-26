/**
 * Joker Server Fix
 * 
 * This file contains the fixes needed for the server-side joker validation issue.
 * Apply these changes to your server.js file.
 */

// 1. Enhanced isValidGroup function with better joker detection
function isValidGroup(tiles) {
  // Count jokers
  const jokerCount = tiles.filter(t => t.isJoker || t.number === null).length;
  
  // If all tiles are jokers, it's valid
  if (jokerCount === tiles.length) return true;
  
  // For groups, all non-joker tiles must be the same number
  const numbers = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.number);
  if (new Set(numbers).size > 1) return false;
  
  // All non-joker tiles must be different colors
  const colors = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.color);
  if (new Set(colors).size !== colors.length) return false;
  
  return true;
}

// 2. Normalize joker properties function
const normalizeJokers = (tiles) => {
  return tiles.map(tile => {
    // Normalize joker detection - check multiple properties
    if (tile.isJoker || tile.number === null || 
        (tile.id && typeof tile.id === 'string' && tile.id.includes('joker'))) {
      return { ...tile, isJoker: true, number: null, color: null };
    }
    return tile;
  });
};

// 3. Example modified playSet function
socket.on('playSet', (gameId, tileIds) => {
  // Find the game
  const game = games.find(g => g.id === gameId);
  if (!game) return socket.emit('error', { message: 'Game not found' });
  
  // Get current player
  const currentPlayer = game.players.find(p => p.id === socket.id);
  if (!currentPlayer) return socket.emit('error', { message: 'Player not found' });
  
  // Check if it's the player's turn
  if (game.currentPlayerId !== socket.id) {
    return socket.emit('error', { message: 'Not your turn' });
  }
  
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
  
  // Validate the set
  if (!isValidGroup(normalizedTiles) && !isValidRun(normalizedTiles)) {
    return socket.emit('error', { message: 'Invalid set' });
  }
  
  // Remove tiles from player's hand
  currentPlayer.hand = currentPlayer.hand.filter(tile => !tileIds.includes(tile.id));
  
  // Add the set to the table
  game.table.push(normalizedTiles);
  
  // Broadcast the update
  io.to(gameId).emit('setPlayed', {
    playerId: socket.id,
    tiles: normalizedTiles
  });
  
  // Update game state
  updateGameState(game);
});

// 4. Debug function to help identify issues with joker serialization
// Add this function to help debug joker validation issues
const debugJokerValidation = (tiles) => {
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
  
  const jokerCount = tiles.filter(t => t.isJoker || t.number === null).length;
  console.log('Joker count:', jokerCount);
  
  const numbers = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.number);
  console.log('Numbers:', numbers);
  console.log('Unique numbers:', new Set(numbers).size);
  
  const colors = tiles.filter(t => !t.isJoker && t.number !== null).map(t => t.color);
  console.log('Colors:', colors);
  console.log('Unique colors:', new Set(colors).size);
  
  const isValid = isValidGroup(tiles);
  console.log('Is valid group?', isValid);
  
  return isValid;
};

// You can call this debug function in your playSet and other validation functions
// to help troubleshoot the issue.
