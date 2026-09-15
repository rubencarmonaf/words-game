import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  elo: {
    type: Number,
    default: 0,
    min: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  gamesWon: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 0
  },
  avatarColor: {
    type: String,
    enum: ['cobalt', 'scarlet', 'amber', 'lime'],
    default: 'cobalt'
  },
  avatarIcon: {
    type: String,
    enum: ['target', 'link', 'bolt', 'users', 'flame', 'star'],
    default: 'target'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
});

// Update win rate when games are played
userSchema.methods.updateStats = function(): void {
  this.winRate = this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed) * 100 : 0;
  this.lastActive = new Date();
};

// Calcula el cambio de ELO tras una partida. K=60 da ~30 puntos por victoria
// entre rivales de ELO igual (más si el rival tiene más ELO, menos si tiene menos).
userSchema.methods.updateElo = function(
  opponentElo: number,
  won: boolean,
  kFactor: number = 60
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - this.elo) / 400));
  const actualScore = won ? 1 : 0;
  const eloChange = Math.round(kFactor * (actualScore - expectedScore));

  // El ELO nunca baja de 0 (ver el validador `min` del esquema) — se aplica el
  // cambio real tras el recorte, no el teórico, para que lo devuelto sea preciso.
  const newElo = Math.max(0, this.elo + eloChange);
  const appliedChange = newElo - this.elo;
  this.elo = newElo;
  this.gamesPlayed += 1;
  if (won) this.gamesWon += 1;

  this.updateStats();
  return appliedChange;
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get public user data
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    elo: this.elo,
    gamesPlayed: this.gamesPlayed,
    gamesWon: this.gamesWon,
    winRate: this.winRate,
    avatarColor: this.avatarColor,
    avatarIcon: this.avatarIcon
  };
};

export default mongoose.model<IUser>('User', userSchema);
