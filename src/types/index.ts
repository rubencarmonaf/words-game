import { Document } from 'mongoose';

// User Types
export interface IUser extends Document {
  _id: string;
  username: string;
  email: string;
  password: string;
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  createdAt: Date;
  lastActive: Date;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  updateStats(): void;
  updateElo(opponentElo: number, won: boolean, kFactor?: number): number;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublicJSON(): IUserPublic;
}

export interface IUserPublic {
  id: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

// Game Types
export interface IGamePlayer {
  userId: string;
  username: string;
  words: string[];
  score: number;
  eloBefore?: number;
  eloAfter?: number;
  eloChange?: number;
}

export interface IGame extends Document {
  _id: string;
  gameId: string;
  players: IGamePlayer[];
  prefix: string;
  gameType: 'versus' | 'friendly';
  status: 'waiting' | 'active' | 'finished';
  duration: number;
  startedAt?: Date;
  finishedAt?: Date;
  winner?: string;
  allWords: string[];
  createdAt: Date;
  calculateDuration(): number;
  getStats(): GameStats;
}

export interface GameStats {
  totalWords: number;
  uniqueWords: number;
  averageWordsPerPlayer: number;
  duration: number;
}

// Friendship Types
export interface IFriendship extends Document {
  _id: string;
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  createdAt: Date;
  acceptedAt?: Date;
}

// Friendship Model with static methods
export interface IFriendshipModel {
  getFriends(userId: string): Promise<any[]>;
  getFriendshipStatus(userId1: string, userId2: string): Promise<string | null>;
  getPendingRequests(userId: string): Promise<any[]>;
}

// Matchmaking Types
export interface MatchmakingPlayer {
  userId: string;
  username: string;
  elo: number;
  socketId?: string;
}

// Socket Types
export interface AuthenticatedSocket {
  userId: string;
  username: string;
}

export interface SocketEvents {
  authenticate: (token: string) => void;
  matchFound: (data: { gameId: string; opponent: string }) => void;
  gameStart: (data: { gameId: string; prefix: string; players: IGamePlayer[] }) => void;
  wordSubmitted: (data: { word: string; playerId: string; score: number }) => void;
  gameEnd: (data: { winner: string; finalScores: IGamePlayer[] }) => void;
  error: (message: string) => void;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthResponse {
  token: string;
  user: IUserPublic;
}

export interface WordValidationResponse {
  valid: boolean;
  message?: string;
}

// Game Logic Types
export interface GameConfig {
  prefix: string;
  duration: number;
  gameType: 'versus' | 'friendly';
  players: string[];
}

export interface GameState {
  gameId: string;
  status: 'waiting' | 'active' | 'finished';
  players: IGamePlayer[];
  prefix: string;
  allWords: string[];
  timeRemaining: number;
  currentPlayer?: string;
}

// ELO Calculation Types
export interface EloResult {
  newRating: number;
  ratingChange: number;
}

// Dictionary Types
export interface DictionaryService {
  validateWord(word: string): Promise<boolean>;
}

// Express Request Extensions
export interface AuthenticatedRequest {
  user: {
    userId: string;
    username: string;
  };
  body: any;
  headers: any;
}

// Daily Challenge Types
export interface IDailyChallenge {
  _id: string;
  date: string;
  prefix: string;
  createdAt: Date;
}

export interface IDailyChallengeCompletion {
  _id: string;
  userId: string;
  date: string;
  wordsFound: string[];
  completedAt: Date;
  rewardEarned: number;
}

export interface DailyChallengeResponse {
  challenge: IDailyChallenge;
  isCompleted: boolean;
  wordsFound?: string[];
  timeUntilNext?: {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
}

// Socket Extensions
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
}
