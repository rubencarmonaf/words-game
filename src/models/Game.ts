import mongoose, { Schema, Document } from 'mongoose';
import { IGame, IGamePlayer, GameStats } from '../types';
import { stripAccents } from '../utils/text';

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
    enum: ['versus', 'lobby'],
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
  const normalized = word.toLowerCase();
  // Prefijo y repetidas ignoran los acentos: "invierno" vale para el prefijo "ín", y da igual
  // con qué acentos se haya dicho antes una palabra para contar como la misma.
  const normalizedKey = stripAccents(normalized);

  // Check if word starts with prefix
  if (!normalizedKey.startsWith(stripAccents(this.prefix.toLowerCase()))) {
    return false;
  }

  // Cada jugador puede usar cualquier palabra, aunque otro ya la haya dicho: solo se rechaza
  // repetir una propia (y quien no juega esta partida no puede añadir palabras).
  const player = this.players.find((p: IGamePlayer) => p.userId === playerId);
  if (!player || player.words.some((w: string) => stripAccents(w) === normalizedKey)) {
    return false;
  }

  player.words.push(normalized);
  player.score += 1;

  // allWords es el conjunto de palabras distintas de la partida (para las estadísticas)
  if (!this.allWords.some((w: string) => stripAccents(w) === normalizedKey)) {
    this.allWords.push(normalized);
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
