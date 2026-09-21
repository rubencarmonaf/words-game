import { Document } from 'mongoose';
import { AvatarOptions } from './avatar';

export * from './avatar';

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
  avatar: AvatarOptions;
  createdAt: Date;
  lastActive: Date;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
  emailKey?: string;
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  emailVerificationSentAt?: Date | null;
  unverifiedExpiresAt?: Date | null;
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
  avatar: AvatarOptions;
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
  gameType: 'versus' | 'lobby';
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
  respondedAt?: Date;
}

// Friendship Model with static methods
export interface IFriendshipModel {
  getFriends(userId: string): Promise<any[]>;
  getFriendshipStatus(userId1: string, userId2: string): Promise<string | null>;
  getPendingRequests(userId: string): Promise<any[]>;
}

// Direct message (1:1 chat) Types
export interface IMessage extends Document {
  _id: string;
  from: string;
  to: string;
  text: string;
  /** 'lobby-invite' es una invitación a un lobby "Con amigos" que queda en el
   * hilo (con su lobbyId) para poder aceptarla más tarde. */
  kind: 'text' | 'lobby-invite';
  lobbyId?: string;
  read: boolean;
  createdAt: Date;
}

// Matchmaking Types
export interface MatchmakingPlayer {
  userId: string;
  username: string;
  elo: number;
  avatar: AvatarOptions;
  socketId?: string;
  queuedAt: number;
  /** Última vez que se vio a este jugador con un socket conectado mientras esperaba. */
  lastSeen?: number;
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
  /** Código estable para que el cliente distinga errores (p. ej. EMAIL_NOT_VERIFIED). */
  code?: string;
}

export interface AuthResponse {
  token: string;
  user: IUserPublic;
}

/** Con la verificación de email activa el registro no devuelve sesión, solo el aviso. */
export interface RegisterResponse {
  token?: string;
  user?: IUserPublic;
  verificationRequired?: boolean;
  email?: string;
  emailSent?: boolean;
}

export interface WordValidationResponse {
  valid: boolean;
  message?: string;
}

// Game Logic Types
export interface GameConfig {
  prefix: string;
  duration: number;
  gameType: 'versus' | 'lobby';
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
