# 🎮 J_kube - Multiplayer Rummikub Online

A beautiful, modern multiplayer Rummikub game with user authentication that allows friends and family to play together from anywhere in the world. Perfect for staying connected across long distances!

![Rummikub Game](https://img.shields.io/badge/Game-Rummikub-blue) ![Multiplayer](https://img.shields.io/badge/Mode-Multiplayer-green) ![Real-time](https://img.shields.io/badge/Chat-Real--time-orange) ![Authentication](https://img.shields.io/badge/Auth-Secure-red)

## ✨ Features

### 🔐 Authentication System
- **User Registration & Login** - Secure JWT-based authentication
- **Protected Game Access** - Must be logged in to play
- **User Profile System** - Personalized profile with avatar and status
- **Session Persistence** - Stay logged in across browser sessions

### 🎯 Core Gameplay
- **Complete Rummikub Implementation** - All traditional rules and mechanics
- **Two Game Modes** - Play against AI bot or with friends online
- **Real-time Multiplayer** - Play with 2-4 players simultaneously
- **Smart AI Opponents** - Three difficulty levels for bot games
- **Turn-based Strategy** - Proper turn management and game flow
- **Win Detection** - Automatic game completion and winner announcement

### 🤖 AI Bot Features
- **Three Difficulty Levels** - Easy, Medium, and Hard bots
- **Smart Decision Making** - Bots analyze possible moves and make strategic choices
- **Realistic Gameplay** - Bots follow the same rules and play at human-like pace
- **Practice Mode** - Perfect for learning the game or practicing strategies

### 🌐 Online Features
- **Room-based System** - Create private games with shareable codes
- **Cross-platform** - Play from any device with a web browser
- **Real-time Chat** - Stay connected with integrated messaging (multiplayer mode)
- **Responsive Design** - Optimized for desktop and mobile devices

### 🎨 User Experience
- **Beautiful Modern UI** - Clean, intuitive interface with smooth animations
- **User Profile Bubble** - Avatar, username, and connection status in one place
- **Color-coded Tiles** - Easy-to-read tiles with proper Rummikub colors
- **Interactive Gameplay** - Click to select tiles, drag and drop coming soon
- **Smart Sorting** - Auto-sort your hand by color and number
- **Intelligent Reconnection** - 10-second grace period before prompting manual refresh
- **Stale Game Cleanup** - Automatic removal of inactive games

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)
- MongoDB database (for user authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd J_kube
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

6. **Create your account**
   - Register a new account or login with existing credentials
   - Enjoy authenticated, secure gameplay!

## 🧪 Testing

J_kube includes comprehensive automated testing for key features, especially the connection and reconnection functionality.

### Running Tests

#### Standard Test Suite
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:reconnection
npm run test:multiplayer
npm run test:edge
```

#### Automated Test Script
We provide a complete test automation script that handles the entire process:

```bash
# Make script executable (first time only)
chmod +x run-reconnection-tests.sh

# Run the automated test suite
./run-reconnection-tests.sh
```

The automated script:
- Starts the server
- Runs all test suites
- Generates a detailed HTML report
- Manages the server lifecycle

#### Docker-based Testing
For completely isolated testing:

```bash
# Make script executable (first time only)
chmod +x run-docker-tests.sh

# Run the Docker-based tests
./run-docker-tests.sh
```

This runs tests in a containerized environment for maximum consistency.

### Test Reports
Test reports are generated in the `test-reports` directory, including:
- HTML summary report
- Test logs
- Server logs
- Video recordings of test runs

For more details on testing, see [TESTING.md](TESTING.md).

## 🎮 How to Play

### Getting Started
1. **Create an account** or **login** to access the game
2. **Choose your game mode** from the authenticated dashboard:
   - **Play vs Computer**: Practice against AI opponents with adjustable difficulty
   - **Play with Friends**: Create or join multiplayer games for social play

### Bot Game Setup (vs Computer)
1. **Select difficulty level**:
   - **Easy**: Friendly bot that makes simple moves
   - **Medium**: Challenging bot with good strategy
   - **Hard**: Expert bot that plays optimally
2. **Click "Start Game vs Bot"** to begin immediately

### Multiplayer Game Setup (with Friends)
1. **Create a new game** or **join an existing game** with a game code
2. **Share the game code** with friends (up to 4 players total)
3. **Start the game** when everyone has joined

### Gameplay Rules
- **Objective**: Be the first player to play all your tiles
- **Sets**: Create groups of 3+ tiles:
  - **Runs**: Consecutive numbers in the same color (e.g., Red 4-5-6)
  - **Groups**: Same number in different colors (e.g., Red 7, Blue 7, Yellow 7)
- **Initial Play**: Your first play must be worth at least 30 points
- **Turn Actions**:
  - Play valid sets from your hand
  - Draw a tile if you can't/don't want to play
  - End your turn

### Tile Values
- Numbers 1-13: Face value (1 = 1 point, 13 = 13 points)
- Jokers: Can substitute any tile (worth the value they represent)

## 🛠️ Technical Details

### Technology Stack
- **Backend**: Node.js + Express + MongoDB
- **Authentication**: JWT + bcryptjs
- **Real-time**: Socket.IO
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Security**: Helmet.js + CORS
- **Testing**: Cypress for end-to-end testing

### Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Web Browser   │    │   Web Browser   │
│   (Player 1)    │    │   (Player 2)    │    │   (Player 3)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴────────────┐
                    │     Express Server       │
                    │     + Socket.IO          │
                    │                          │
                    │  ┌─────────────────────┐ │
                    │  │   Game Engine       │ │
                    │  │   - Rule Validation │ │
                    │  │   - State Management│ │
                    │  │   - Turn Logic      │ │
                    │  └─────────────────────┘ │
                    └──────────────────────────┘
```

### Key Features Implementation

#### Game State Management
- Server-side game state validation
- Real-time synchronization across all clients
- Persistent game rooms until all players leave
- LocalStorage for game state preservation during reconnection

#### Connection Recovery System
- Automatic reconnection attempts when connection is lost
- Manual reconnection option with game state preservation
- Session persistence using browser storage
- Clear user feedback during connection issues

#### AI Bot System
- **Smart Move Analysis**: Bots analyze all possible tile combinations
- **Difficulty-based Strategy**: Different AI personalities for varied challenge levels
- **Realistic Timing**: Bots take time to "think" before making moves
- **Rule Compliance**: Bots follow the same rules as human players

#### Socket.IO Events
- `createGame` / `joinGame` - Room management
- `createBotGame` - Start new bot game
- `playSet` / `drawTile` / `endTurn` - Gameplay actions
- `sendMessage` - Chat functionality (multiplayer)
- `gameStarted` / `playerJoined` / `gameWon` / `botMove` - State updates

## 🎯 Game Rules Reference

### Valid Sets

#### Runs (Consecutive Numbers, Same Color)
```
✅ Red: 4-5-6-7
✅ Blue: 10-11-12
✅ Yellow: 1-2-3-4-5
```

#### Groups (Same Number, Different Colors)
```
✅ 8: Red-Blue-Yellow
✅ 12: Red-Blue-Yellow-Black
✅ 3: Blue-Yellow-Black
```

### Initial Play Requirement
Your first play must total at least 30 points:
```
✅ Red 10-11-12 = 33 points
✅ Blue 8 + Yellow 8 + Black 8 + Red 6-7-8 = 45 points
❌ Blue 2-3-4 = 9 points (too low)
```

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will run on port 3000 by default, or use the PORT environment variable.

## 🤝 Contributing

This is a personal project created for family and friends, but contributions are welcome! 

### Areas for Enhancement
- [ ] Drag and drop tile movement
- [ ] Advanced joker handling
- [ ] Game replay functionality
- [ ] Player statistics and rankings
- [ ] Custom tile themes
- [ ] Tournament mode

## 📝 License

MIT License - feel free to use this code for your own family game nights!

## 💝 Dedication

*This game was created with love to help keep families and friends connected across any distance. Whether you're in the UK or Michigan, there's always time for a good game of Rummikub!*

---

**Happy Gaming! 🎲✨**

*Share a game code, gather your friends, and let the tiles fall where they may!*
# Force redeploy Mon Aug 26 12:19:22 BST 2025
