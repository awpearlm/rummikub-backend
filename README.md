# 🎮 J_kube - Multiplayer Rummikub Online

A beautiful, modern multiplayer Rummikub game that allows friends and family to play together from anywhere in the world. Perfect for staying connected across long distances!

![Rummikub Game](https://img.shields.io/badge/Game-Rummikub-blue) ![Multiplayer](https://img.shields.io/badge/Mode-Multiplayer-green) ![Real-time](https://img.shields.io/badge/Chat-Real--time-orange)

## ✨ Features

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
- **Color-coded Tiles** - Easy-to-read tiles with proper Rummikub colors
- **Interactive Gameplay** - Click to select tiles, drag and drop coming soon
- **Smart Sorting** - Auto-sort your hand by color and number

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

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

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🎮 How to Play

### Game Mode Selection
1. **Enter your name** on the welcome screen
2. **Choose your game mode**:
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
- **Backend**: Node.js + Express
- **Real-time**: Socket.IO
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Security**: Helmet.js + CORS

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
