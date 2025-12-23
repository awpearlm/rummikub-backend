# Design Document

## Overview

This design addresses getting the J_kube Rummikub application running properly by fixing MongoDB connectivity issues, then improving connection stability and game state management. The approach prioritizes immediate functionality over optimization, ensuring families can start playing while building a foundation for future stability improvements.

## Architecture

The application follows a client-server architecture with the following key components:

```mermaid
graph TB
    Client[Web Browser Client] --> Netlify[Netlify CDN]
    Netlify --> Server[Node.js Express Server]
    Server --> MongoDB[(MongoDB Atlas)]
    Server --> SocketIO[Socket.IO Real-time]
    SocketIO --> Client
    
    subgraph "Server Components"
        Server --> Auth[Authentication Layer]
        Server --> GameEngine[Game Engine]
        Server --> Lifecycle[Game Lifecycle Manager]
    end
    
    subgraph "Database Collections"
        MongoDB --> Users[Users Collection]
        MongoDB --> Games[Games Collection] 
        MongoDB --> Stats[Stats Collection]
    end
```

## Components and Interfaces

### Database Connection Manager

**Purpose**: Establish and maintain MongoDB Atlas connection with proper error handling and configuration validation.

**Key Methods**:
- `connectDB()`: Establish connection with retry logic
- `validateConnection()`: Test database connectivity
- `getConnectionStatus()`: Return current connection state
- `handleConnectionError()`: Process and log connection failures

**Configuration Requirements**:
- `MONGODB_URI`: Full MongoDB Atlas connection string
- `JWT_SECRET`: Secret key for authentication tokens
- `NODE_ENV`: Environment indicator (development/production)

### Enhanced Game State Manager

**Purpose**: Manage game state persistence between memory and MongoDB with automatic synchronization.

**Key Methods**:
- `saveGameState(gameId, gameData)`: Persist game to MongoDB
- `loadGameState(gameId)`: Restore game from MongoDB
- `syncGameState(gameId)`: Synchronize memory and database
- `cleanupExpiredGames()`: Remove old game records

**State Synchronization Strategy**:
- Immediate save on game creation
- Periodic saves every 30 seconds during active gameplay
- Save on critical events (player joins, moves, disconnections)
- Cleanup after game completion or 24-hour timeout

### Mobile-Responsive Interface System

**Purpose**: Ensure the game interface works seamlessly across desktop and mobile devices with touch-friendly controls.

**Key Components**:
- Responsive CSS Grid/Flexbox layouts
- Touch event handling for tile manipulation
- Viewport meta tag configuration
- Mobile-optimized tile sizing and spacing

**Mobile Interaction Strategy**:
- **Tile Selection**: Tap to select/deselect tiles
- **Tile Movement**: Drag and drop with touch events
- **Board Interaction**: Pinch-to-zoom for detailed board view
- **Menu Access**: Hamburger menu for mobile navigation

**Responsive Breakpoints**:
```css
/* Mobile First Approach */
@media (max-width: 768px) {
  /* Mobile styles */
  .tile { font-size: 14px; padding: 8px; }
  .game-board { overflow-x: auto; }
}

@media (min-width: 769px) {
  /* Desktop styles */
  .tile { font-size: 16px; padding: 12px; }
}
```

**Touch Event Handling System**:
```javascript
// Enhanced touch handling for mobile devices
const handleTouchInteraction = (element) => {
  let touchStartTime;
  let touchStartPos;
  
  element.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });
  
  element.addEventListener('touchend', (e) => {
    const touchDuration = Date.now() - touchStartTime;
    const touchEndPos = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const distance = Math.sqrt(
      Math.pow(touchEndPos.x - touchStartPos.x, 2) + 
      Math.pow(touchEndPos.y - touchStartPos.y, 2)
    );
    
    if (touchDuration < 200 && distance < 10) {
      // Quick tap - select tile
      handleTileSelection(element);
    } else if (distance > 20) {
      // Drag gesture - move tile
      handleTileDrag(element, touchStartPos, touchEndPos);
    }
  });
};
```

### Environment Configuration System

**Purpose**: Validate and manage environment variables with clear error reporting.

**Configuration Validation**:
- Check for required environment variables on startup
- Provide specific setup instructions for missing variables
- Support both local development and Netlify deployment
- Generate sample `.env` file if needed

**Required Environment Variables**:
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jkube
JWT_SECRET=your-secret-key-here
NODE_ENV=production
PORT=8000
```

**Purpose**: Handle Socket.IO disconnections with automatic reconnection and state restoration.

**Reconnection Strategy**:
1. **Immediate Retry**: 1 second delay for temporary network glitches
2. **Progressive Backoff**: 2s, 4s, 8s, 16s intervals for persistent issues
3. **Manual Fallback**: User-initiated reconnection after 30 seconds
4. **State Restoration**: Reload from localStorage and MongoDB

**Client-Side Recovery Flow**:
```javascript
// Simplified reconnection logic
socket.on('disconnect', () => {
  showConnectionLostOverlay();
  attemptAutoReconnection();
});

function attemptAutoReconnection() {
  let attempts = 0;
  const maxAttempts = 5;
  const baseDelay = 1000;
  
  const reconnect = () => {
    if (attempts < maxAttempts) {
      setTimeout(() => {
        socket.connect();
        attempts++;
      }, baseDelay * Math.pow(2, attempts));
    } else {
      showManualReconnectionOptions();
    }
  };
  
  reconnect();
}
```

### Mobile-Responsive Interface System

**Purpose**: Ensure the game interface works seamlessly across desktop and mobile devices with touch-friendly controls.

**Key Components**:
- Responsive CSS Grid/Flexbox layouts
- Touch event handling for tile manipulation
- Viewport meta tag configuration
- Mobile-optimized tile sizing and spacing

**Mobile Interaction Strategy**:
- **Tile Selection**: Tap to select/deselect tiles
- **Tile Movement**: Drag and drop with touch events
- **Board Interaction**: Pinch-to-zoom for detailed board view
- **Menu Access**: Hamburger menu for mobile navigation

**Responsive Breakpoints**:
```css
/* Mobile First Approach */
@media (max-width: 768px) {
  /* Mobile styles */
  .tile { font-size: 14px; padding: 8px; }
  .game-board { overflow-x: auto; }
}

@media (min-width: 769px) {
  /* Desktop styles */
  .tile { font-size: 16px; padding: 12px; }
}
```

**Purpose**: Validate and manage environment variables with clear error reporting.

**Configuration Validation**:
- Check for required environment variables on startup
- Provide specific setup instructions for missing variables
- Support both local development and Netlify deployment
- Generate sample `.env` file if needed

**Required Environment Variables**:
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jkube
JWT_SECRET=your-secret-key-here
NODE_ENV=production
PORT=8000
```

## Data Models

### Enhanced Game Document Schema

```javascript
const gameSchema = {
  gameId: String,           // Unique game identifier
  players: [{
    userId: ObjectId,       // Reference to User document
    name: String,           // Player display name
    isBot: Boolean,         // Bot player flag
    disconnectedAt: Date,   // Disconnection timestamp
    lastSeen: Date         // Last activity timestamp
  }],
  gameState: {
    board: Array,           // Current board state
    currentPlayerIndex: Number,
    started: Boolean,
    winner: String,
    turnStartTime: Date
  },
  persistence: {
    lastSaved: Date,        // Last MongoDB save
    saveVersion: Number,    // Optimistic locking
    memoryState: Boolean    // In-memory flag
  },
  lifecycle: {
    startTime: Date,
    endTime: Date,
    lastActivity: Date,
    cleanupScheduled: Date
  },
  isBotGame: Boolean,
  metadata: {
    version: String,        // App version
    serverInstance: String  // Server identifier
  }
};
```

### Connection State Tracking

```javascript
const connectionState = {
  socketId: String,
  userId: ObjectId,
  gameId: String,
  status: String,         // 'connected', 'disconnected', 'reconnecting'
  lastPing: Date,
  reconnectAttempts: Number,
  clientInfo: {
    userAgent: String,
    ipAddress: String,
    sessionId: String
  }
};
```

## Error Handling

### Database Connection Errors

**MongoDB Connection Failure**:
```javascript
// Enhanced error handling with specific guidance
const handleConnectionError = (error) => {
  console.error('MongoDB Connection Failed:', error.message);
  
  if (error.message.includes('authentication failed')) {
    console.error(`
    ❌ AUTHENTICATION ERROR
    
    Your MongoDB credentials are incorrect. Please check:
    1. Username and password in MONGODB_URI
    2. Database user permissions in MongoDB Atlas
    3. IP whitelist settings (add 0.0.0.0/0 for Netlify)
    
    Current MONGODB_URI format should be:
    mongodb+srv://username:password@cluster.mongodb.net/jkube
    `);
  } else if (error.message.includes('network')) {
    console.error(`
    ❌ NETWORK ERROR
    
    Cannot reach MongoDB Atlas. Please check:
    1. Internet connectivity
    2. MongoDB Atlas cluster status
    3. Firewall settings
    4. DNS resolution
    `);
  }
  
  // Provide fallback behavior
  console.log('🔄 Attempting to continue without database...');
  return { connected: false, fallback: true };
};
```

### Game State Recovery

**State Corruption Detection**:
- Validate game state structure on load
- Check for missing required fields
- Verify player count and turn consistency
- Detect impossible game states (negative tiles, invalid board)

**Recovery Strategies**:
1. **Minor Issues**: Auto-correct and log warnings
2. **Major Issues**: Restore from last known good state
3. **Critical Issues**: Create new game with same players
4. **Unrecoverable**: Clear state and notify players

### Socket.IO Error Handling

**Connection Error Types**:
- `connect_error`: Initial connection failure
- `disconnect`: Connection lost during gameplay
- `reconnect_error`: Reconnection attempt failed
- `timeout`: Request timeout

**User-Friendly Error Messages**:
```javascript
const errorMessages = {
  'connect_error': 'Unable to connect to game server. Please check your internet connection.',
  'disconnect': 'Connection lost. Attempting to reconnect...',
  'reconnect_error': 'Reconnection failed. You can try manually reconnecting.',
  'timeout': 'Server is taking too long to respond. Please try again.'
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Database Configuration Validation
*For any* set of environment variables, the Database_Layer should either successfully connect to MongoDB or provide specific error messages indicating exactly which configuration is invalid and how to fix it
**Validates: Requirements 1.1, 1.3, 3.2, 3.5**

### Property 2: User Data Persistence Round Trip
*For any* valid user registration or login data, storing the data and then retrieving it should produce equivalent user information
**Validates: Requirements 1.5**

### Property 3: Game Creation and Joining
*For any* valid game creation request, the Game_Engine should generate a unique game ID and allow other players to join successfully
**Validates: Requirements 2.2, 2.3**

### Property 4: Game State Initialization
*For any* valid game configuration, starting the game should deal the correct number of tiles to each player and establish proper turn order
**Validates: Requirements 2.4**

### Property 5: Move Validation and State Updates
*For any* game move (valid or invalid), the Game_Engine should correctly validate the move and update game state only for valid moves
**Validates: Requirements 2.5**

### Property 6: Connection Recovery State Preservation
*For any* game state and player disconnection scenario, reconnecting should restore the exact game state including hand tiles and board position
**Validates: Requirements 4.3, 4.4**

### Property 7: Concurrent Disconnection Handling
*For any* combination of players disconnecting from a game, the Game_Engine should maintain independent game state for each player
**Validates: Requirements 4.5**

### Property 8: Game State Persistence Round Trip
*For any* valid game state, saving to MongoDB and then loading should produce an equivalent game state
**Validates: Requirements 5.1, 5.4**

### Property 9: Game Lifecycle Cleanup
*For any* completed or abandoned game, the Game_Lifecycle should properly clean up database records and memory state
**Validates: Requirements 5.5**

### Property 10: Error Message Quality
*For any* system error (connection, database, or game state), the system should provide user-friendly messages to users and detailed logs for debugging
**Validates: Requirements 6.1, 6.2**

### Property 11: Game State Corruption Recovery
*For any* corrupted game state, the Game_Engine should detect the corruption and either recover automatically or fail gracefully while preserving as much state as possible
**Validates: Requirements 6.3, 6.5**

### Property 12: Reconnection Failure Fallbacks
*For any* scenario where reconnection attempts fail repeatedly, the Reconnection_System should preserve local state and provide manual reconnection options
**Validates: Requirements 4.2**

### Property 13: Mobile Touch Interface Compatibility
*For any* game interaction on mobile devices, the touch interface should provide equivalent functionality to desktop mouse interactions while maintaining drag-drop compatibility
**Validates: Requirements 8.1, 8.2, 8.3**

## Testing Strategy

### Unit Tests
- Database connection validation
- Game state serialization/deserialization
- Error handling for various failure scenarios
- Environment configuration validation

### Integration Tests
- End-to-end game creation and joining
- Player disconnection and reconnection flows
- MongoDB persistence and recovery
- Socket.IO event handling

### Property-Based Tests
- Game state consistency across save/load cycles
- Connection recovery maintains game integrity
- Error handling preserves user data
- Configuration validation catches all invalid states

**Dual Testing Approach**: Unit tests verify specific examples and edge cases, while property tests verify universal properties across all inputs. Both are necessary for comprehensive coverage.

**Property Test Configuration**: Each property test runs minimum 100 iterations with randomized inputs. Tests are tagged with format: **Feature: rummikub-stability, Property {number}: {property_text}**