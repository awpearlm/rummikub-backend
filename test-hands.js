// Quick test to verify hand dealing logic

// Import the RummikubGame class
class RummikubGame {
    constructor(gameId) {
        this.id = gameId;
        this.players = [];
        this.deck = [];
        this.board = [];
        this.currentPlayerIndex = 0;
        this.started = false;
        this.winner = null;
        this.chatMessages = [];
        this.gameLog = [];
        this.boardSnapshot = [];
        this.isBotGame = false;
        this.botDifficulty = 'medium';
        
        this.createDeck();
    }
    
    createDeck() {
        // Create Rummikub tiles: 2 sets of numbers 1-13 in 4 colors, plus 2 jokers
        const colors = ['red', 'blue', 'orange', 'black'];
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        
        // Create two copies of each tile
        for (let copy = 0; copy < 2; copy++) {
            for (const color of colors) {
                for (const number of numbers) {
                    this.deck.push({
                        id: `${color}_${number}_${copy}`,
                        color: color,
                        number: number,
                        isJoker: false
                    });
                }
            }
        }
        
        // Add jokers
        this.deck.push({ id: 'joker_1', color: null, number: null, isJoker: true });
        this.deck.push({ id: 'joker_2', color: null, number: null, isJoker: true });
        
        // Shuffle deck
        this.shuffleDeck();
    }
    
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    
    addPlayer(playerId, playerName) {
        if (this.players.length >= 4) return false;
        
        const player = {
            id: playerId,
            name: playerName,
            hand: [],
            hasPlayedInitial: false,
            score: 0,
            isBot: false
        };
        
        this.players.push(player);
        return true;
    }
    
    start() {
        if (this.started) return false;
        
        console.log(`🎲 Normal mode: dealing random tiles`);
        console.log(`🚨🚨🚨 DEBUGGING HANDS ISSUE - PLAYERS COUNT: ${this.players.length} 🚨🚨🚨`);
        // Normal mode: Deal 14 tiles to each player
        for (const player of this.players) {
            console.log(`🚨 DEALING TO: ${player.name} (${player.id.slice(-4)})`);
            for (let i = 0; i < 14; i++) {
                if (this.deck.length > 0) {
                    player.hand.push(this.deck.pop());
                }
            }
            console.log(`🚨 FINAL HAND FOR ${player.name}: ${player.hand.length} tiles`);
            console.log(`🚨 ${player.name} tiles:`, 
                player.hand.slice(0, 5).map(t => `${t.isJoker ? 'JOKER' : t.number + t.color[0]}`));
        }
        console.log(`🚨🚨🚨 ALL HANDS DEALT! 🚨🚨🚨`);
        
        this.started = true;
        return true;
    }
}

// Create a test game
const game = new RummikubGame('TEST123');

// Add two players
game.addPlayer('player1', 'Alice');
game.addPlayer('player2', 'Bob');

console.log('🧪 Testing hand dealing...');
console.log(`📊 Deck size before dealing: ${game.deck.length}`);

// Start the game (which deals hands)
game.start();

console.log(`📊 Deck size after dealing: ${game.deck.length}`);

// Check each player's hand
game.players.forEach((player, index) => {
    console.log(`\n🃏 Player ${index + 1}: ${player.name}`);
    console.log(`   Hand size: ${player.hand.length}`);
    console.log(`   First 5 tiles: ${player.hand.slice(0, 5).map(t => t.isJoker ? 'JOKER' : `${t.number}${t.color[0]}`).join(', ')}`);
    console.log(`   Tile IDs: ${player.hand.slice(0, 5).map(t => t.id).join(', ')}`);
});

// Check if hands are identical
const hand1 = game.players[0].hand.map(t => t.id).sort();
const hand2 = game.players[1].hand.map(t => t.id).sort();
const identical = JSON.stringify(hand1) === JSON.stringify(hand2);

console.log(`\n🔍 Hands identical? ${identical ? '❌ YES (BUG!)' : '✅ NO (CORRECT)'}`);
