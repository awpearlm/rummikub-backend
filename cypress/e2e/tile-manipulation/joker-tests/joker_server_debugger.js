/**
 * Joker Server Debug Tool
 * 
 * This tool provides enhanced logging for joker-related operations on the server
 * to diagnose validation and serialization issues.
 */

// Enhanced Joker Debugger for server.js
const jokerDebugger = {
  // Enable/disable debug mode
  enabled: true,
  
  // Log level (1=errors only, 2=warnings, 3=info, 4=verbose)
  logLevel: 4,
  
  // Store diagnostic information
  diagnostics: [],
  
  // Clear diagnostics
  clear: function() {
    this.diagnostics = [];
  },
  
  // Enhanced logging with timestamp
  log: function(level, message, data = null) {
    if (!this.enabled || level > this.logLevel) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level === 1 ? 'ERROR' : level === 2 ? 'WARN' : level === 3 ? 'INFO' : 'DEBUG',
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : null
    };
    
    this.diagnostics.push(logEntry);
    
    // Format console output
    const logPrefix = `[${timestamp.split('T')[1].slice(0, -1)}] [JOKER-${logEntry.level}]`;
    
    if (data) {
      console.log(`${logPrefix} ${message}`, data);
    } else {
      console.log(`${logPrefix} ${message}`);
    }
  },
  
  // Debug function for inspecting joker objects
  inspectJoker: function(tile, context) {
    if (!this.enabled) return;
    
    const isJokerById = tile.id && tile.id.toLowerCase().includes('joker');
    const isJokerByProperty = tile.isJoker === true;
    const isJokerByBothMethods = isJokerById && isJokerByProperty;
    
    const inspection = {
      context,
      tile: JSON.parse(JSON.stringify(tile)),
      isJokerById,
      isJokerByProperty,
      isJokerByBothMethods,
      isJokerPropertyType: typeof tile.isJoker,
      colorPropertyType: typeof tile.color,
      numberPropertyType: typeof tile.number
    };
    
    this.log(4, `Joker inspection (${context})`, inspection);
    
    return isJokerById || isJokerByProperty;
  },
  
  // Analyze a set of tiles and log diagnostic information
  analyzeSet: function(tiles, context) {
    if (!this.enabled) return;
    
    const analysis = {
      context,
      tileCount: tiles.length,
      jokerCount: 0,
      jokerByIdOnly: 0,
      jokerByPropertyOnly: 0,
      jokerByBoth: 0,
      tilesWithMissingProps: 0,
      tileDetails: []
    };
    
    // Analyze each tile
    tiles.forEach(tile => {
      const isJokerById = tile.id && tile.id.toLowerCase().includes('joker');
      const isJokerByProperty = tile.isJoker === true;
      
      const tileDetail = {
        id: tile.id,
        isJokerById,
        isJokerByProperty,
        properties: {
          isJoker: tile.isJoker,
          isJokerType: typeof tile.isJoker,
          color: tile.color,
          colorType: typeof tile.color,
          number: tile.number,
          numberType: typeof tile.number
        }
      };
      
      // Count joker detection methods
      if (isJokerById && isJokerByProperty) {
        analysis.jokerByBoth++;
        analysis.jokerCount++;
      } else if (isJokerById) {
        analysis.jokerByIdOnly++;
        analysis.jokerCount++;
      } else if (isJokerByProperty) {
        analysis.jokerByPropertyOnly++;
        analysis.jokerCount++;
      }
      
      // Check for missing or null properties
      if (!tile.hasOwnProperty('isJoker') || 
          !tile.hasOwnProperty('color') || 
          !tile.hasOwnProperty('number')) {
        analysis.tilesWithMissingProps++;
      }
      
      analysis.tileDetails.push(tileDetail);
    });
    
    this.log(3, `Set analysis (${context})`, analysis);
    
    return analysis;
  },
  
  // Apply the patch to enhance joker detection
  patchIsValidGroup: function(originalFunction) {
    const self = this;
    
    return function(tiles) {
      // Log incoming tiles
      self.log(3, 'isValidGroup called with tiles', tiles);
      self.analyzeSet(tiles, 'isValidGroup input');
      
      // Enhanced joker detection
      const jokerCount = tiles.filter(t => {
        const isJoker = t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker'));
        if (isJoker) {
          self.log(4, 'Joker detected', t);
        }
        return isJoker;
      }).length;
      
      const nonJokers = tiles.filter(t => {
        return !(t.isJoker === true || (t.id && t.id.toLowerCase().includes('joker')));
      });
      
      self.log(3, `Enhanced joker detection: ${jokerCount} jokers, ${nonJokers.length} non-jokers`);
      
      // Original function logic with enhanced joker detection
      if (tiles.length < 3 || tiles.length > 4) {
        self.log(2, `Group invalid: size ${tiles.length} not between 3-4`);
        return false;
      }
      
      // If all jokers, it's valid
      if (jokerCount === tiles.length) {
        self.log(3, 'Group valid: all jokers');
        return true;
      }
      
      // All non-joker tiles must be same number
      const numbers = nonJokers.map(t => t.number);
      if (new Set(numbers).size > 1) {
        self.log(2, `Group invalid: different numbers found ${numbers.join(', ')}`);
        return false;
      }
      
      // All non-joker tiles must be different colors
      const colors = nonJokers.map(t => t.color);
      if (new Set(colors).size !== colors.length) {
        self.log(2, `Group invalid: duplicate colors found ${colors.join(', ')}`);
        return false;
      }
      
      // For diagnostic info
      const targetNumber = numbers[0];
      const usedColors = new Set(colors);
      const availableColors = ['red', 'blue', 'yellow', 'black'];
      const remainingColors = availableColors.filter(color => !usedColors.has(color));
      
      self.log(3, `Group validation - Number: ${targetNumber}, Colors: [${colors.join(', ')}], Jokers: ${jokerCount}`);
      self.log(3, `Remaining colors: [${remainingColors.join(', ')}]`);
      
      // We need enough remaining colors for the jokers
      if (jokerCount > remainingColors.length) {
        self.log(2, `Group invalid: not enough remaining colors for jokers (${jokerCount} jokers, ${remainingColors.length} colors)`);
        return false;
      }
      
      // We've passed all validation checks
      self.log(3, `Group valid with ${jokerCount} jokers and ${nonJokers.length} regular tiles`);
      return true;
    };
  },
  
  // Apply patch to normalize joker properties
  patchPlaySet: function(originalFunction) {
    const self = this;
    
    return function(socketId, gameId, tileIds) {
      self.log(3, `playSet called - Game: ${gameId}, Tiles: ${tileIds.join(', ')}`);
      
      // Get the original result
      const result = originalFunction.call(this, socketId, gameId, tileIds);
      
      // Log the result
      self.log(3, `playSet result: ${result ? 'SUCCESS' : 'FAILURE'}`);
      
      return result;
    };
  },
  
  // Helper function to get diagnostic data
  getDiagnostics: function() {
    return this.diagnostics;
  }
};

// Export for use in server.js
module.exports = jokerDebugger;
