# Joker Validation Bug Fix

## Issue Summary

We discovered a bug in the server-side validation of joker tiles when used in groups (sets of same number, different colors). The server was not properly identifying joker tiles in some cases, causing valid sets to be rejected.

## Root Cause

The server was using inconsistent methods to identify joker tiles:

1. Some code paths identified jokers by the `isJoker` property being `true`
2. Other code paths identified jokers by checking if the `id` contained the word "joker"
3. However, a third indicator - tiles with `number === null` - was not being checked consistently

When tiles went through serialization/deserialization (e.g., when sent from client to server), the representation might change, but the logic needed to handle all these cases consistently.

## Changes Made

We enhanced the joker detection logic in three key places:

### 1. `isValidGroup` function

Updated to identify jokers using all three criteria:
- `isJoker === true`
- `number === null`
- `id` contains "joker"

```javascript
const jokerCount = tiles.filter(t => {
  return t.isJoker === true || t.number === null || (t.id && t.id.toLowerCase().includes('joker'));
}).length;

// Similar update to nonJokers filter
```

### 2. `playSet` function

Added enhanced joker normalization logic to ensure all jokers have consistent properties:

```javascript
// Normalize joker properties to ensure consistency
tiles.forEach(tile => {
  if (tile.isJoker || tile.number === null || (tile.id && tile.id.toLowerCase().includes('joker'))) {
    // Ensure joker properties are set correctly
    tile.isJoker = true;
    tile.color = null;
    tile.number = null;
  }
});
```

### 3. `playMultipleSets` function

Applied the same joker normalization logic as in `playSet`.

## Testing

To verify this fix:
1. Create a game with a joker tile and two 13 tiles of different colors (e.g., yellow and blue)
2. Try to form a group with these three tiles
3. The server should now accept this as a valid group

The enhanced joker detection logic should now properly identify and normalize jokers regardless of how they're represented.
