import mongoose, { Schema, Document } from 'mongoose';
import { IGame, IGamePlayer, GameStats } from '../types';

const gamePlayerSchema = new Schema<IGamePlayer>({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  words: [String],
  score: {
    type: Number,
    default: 0
  },
  eloBefore: Number,
  eloAfter: Number,
  eloChange: Number
});

const gameSchema = new Schema<IGame>({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  players: [gamePlayerSchema],
  prefix: {
    type: String,
    required: true,
    maxlength: 5
  },
  gameType: {
    type: String,
    enum: ['versus', 'friendly'],
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  },
  duration: {
    type: Number,
    default: 300 // 5 minutes
  },
  startedAt: Date,
  finishedAt: Date,
  winner: String,
  allWords: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate game duration
gameSchema.methods.calculateDuration = function(): number {
  if (this.startedAt && this.finishedAt) {
    return Math.floor((this.finishedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  return 0;
};

// Get game statistics
gameSchema.methods.getStats = function(): GameStats {
  return {
    totalWords: this.allWords.length,
    uniqueWords: [...new Set(this.allWords)].length,
    averageWordsPerPlayer: this.players.reduce((sum: number, player: IGamePlayer) => sum + player.score, 0) / this.players.length,
    duration: this.calculateDuration()
  };
};

// Start the game
gameSchema.methods.start = function(): void {
  this.status = 'active';
  this.startedAt = new Date();
};

// End the game
gameSchema.methods.end = function(winnerId?: string): void {
  this.status = 'finished';
  this.finishedAt = new Date();
  if (winnerId) {
    this.winner = winnerId;
  }
};

// Add word to game
gameSchema.methods.addWord = function(word: string, playerId: string): boolean {
  // Check if word is already used
  if (this.allWords.includes(word.toLowerCase())) {
    return false;
  }

  // Check if word starts with prefix
  if (!word.toLowerCase().startsWith(this.prefix.toLowerCase())) {
    return false;
  }

  // Add word to game
  this.allWords.push(word.toLowerCase());

  // Add word to player
  const player = this.players.find((p: IGamePlayer) => p.userId === playerId);
  if (player) {
    player.words.push(word.toLowerCase());
    player.score += 1;
  }

  return true;
};

// Get current game state
gameSchema.methods.getGameState = function() {
  const timeRemaining = this.startedAt 
    ? Math.max(0, this.duration - Math.floor((Date.now() - this.startedAt.getTime()) / 1000))
    : this.duration;

  return {
    gameId: this.gameId,
    status: this.status,
    players: this.players,
    prefix: this.prefix,
    allWords: this.allWords,
    timeRemaining,
    currentPlayer: this.players[0]?.userId // For turn-based games
  };
};

export default mongoose.model<IGame>('Game', gameSchema);
