# Copilot Instructions for J_kube - Multiplayer Rummikub Game

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a multiplayer online Rummikub game built with Node.js, Express, Socket.IO, and vanilla JavaScript. The game allows players to connect from anywhere in the world to play the classic tile-laying game with integrated real-time chat.

## Architecture
- **Backend**: Node.js with Express server
- **Real-time Communication**: Socket.IO for multiplayer functionality and chat
- **Frontend**: Vanilla HTML, CSS, and JavaScript with modern UI design
- **Game Logic**: Complete Rummikub implementation with proper rules

## Key Features
- Room-based multiplayer system with shareable game codes
- Real-time gameplay with turn management
- Integrated chat system for player communication
- Responsive design for desktop and mobile
- Complete Rummikub rules implementation (sets, runs, initial 30-point play)
- Beautiful, modern UI with smooth animations

## Code Style Guidelines
- Use ES6+ features where appropriate
- Follow modern JavaScript best practices
- Maintain clean, readable code with proper error handling
- Use semantic HTML and CSS Grid/Flexbox for layouts
- Ensure responsive design principles

## Game Rules Implemented
- Traditional Rummikub tile set (106 tiles: 2 sets of 1-13 in 4 colors + 2 jokers)
- Valid sets: 3+ consecutive numbers (same color) or 3+ same numbers (different colors)
- Initial play requirement: 30+ points
- Turn-based gameplay with tile drawing option
- Win condition: first player to empty their hand

## Socket.IO Events
- Game management: createGame, joinGame, startGame, leaveGame
- Gameplay: playSet, drawTile, endTurn
- Communication: sendMessage, playerJoined, playerLeft
- State updates: gameStarted, setPlayed, gameWon, error

## Development Notes
- Game state is managed on the server with client-side rendering
- All game validation happens server-side for security
- UI updates are reactive to socket events
- Chat messages are limited to 100 recent messages per game
