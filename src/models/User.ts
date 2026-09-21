import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, DEFAULT_AVATAR } from '../types';
import { normalizeEmail } from '../utils/emailAddress';

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
  // Identifica la bandeja (sin puntos de Gmail ni +alias) para que no se pueda
  // abrir infinitas cuentas con variantes de una misma dirección. Se calcula solo.
  emailKey: {
    type: String,
    unique: true,
    sparse: true
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
  avatar: {
    type: Schema.Types.Mixed,
    default: () => ({ ...DEFAULT_AVATAR })
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
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  emailVerificationSentAt: {
    type: Date,
    default: null
  },
  // Mientras la cuenta no esté verificada, MongoDB la borra sola al llegar esta
  // fecha (índice TTL); al verificar se quita el campo. Las cuentas sin él no caducan.
  unverifiedExpiresAt: {
    type: Date,
    default: null
  }
});

userSchema.index({ unverifiedExpiresAt: 1 }, { expireAfterSeconds: 0 });

userSchema.pre('validate', function(next) {
  // Solo al crear o al cambiar el email: las cuentas anteriores reciben su clave al arrancar (ver migrateUsers).
  if (this.email && (this.isNew || this.isModified('email'))) {
    this.emailKey = normalizeEmail(this.email);
  }
  next();
});

// Update win rate when games are played
userSchema.methods.updateStats = function(): void {
  this.winRate = this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed) * 100 : 0;
  this.lastActive = new Date();
};

// K=60 da ~30 puntos por victoria entre rivales de ELO igual (más si el rival
// tiene más ELO, menos si tiene menos).
const ELO_K_FACTOR = 60;
// La fórmula ELO pura da ~0 al favorito enorme (1200 vs 0 → 99,9% esperado de
// ganar), y una partida ganada que no mueve nada se siente rota. Todo
// resultado decisivo mueve al menos esto.
const ELO_MIN_SWING = 5;

/** Cambio de ELO que recibiría un jugador con `playerElo` al ganar/perder
 * contra `opponentElo`. Es la fuente única tanto del cálculo real como de la
 * previsión que se muestra en la pantalla de versus. El ELO nunca baja de 0,
 * así que la pérdida se recorta a lo que el jugador realmente tiene. */
export function eloChangeFor(playerElo: number, opponentElo: number, won: boolean, kFactor: number = ELO_K_FACTOR): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const swing = Math.max(ELO_MIN_SWING, Math.round(kFactor * (won ? 1 - expectedScore : expectedScore)));
  return won ? swing : -Math.min(swing, playerElo);
}

// Aplica el resultado de una partida y devuelve el cambio de ELO realmente aplicado.
userSchema.methods.updateElo = function(
  opponentElo: number,
  won: boolean,
  kFactor: number = ELO_K_FACTOR
): number {
  const appliedChange = eloChangeFor(this.elo, opponentElo, won, kFactor);
  const newElo = this.elo + appliedChange;
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
    avatar: this.avatar || { ...DEFAULT_AVATAR }
  };
};

export default mongoose.model<IUser>('User', userSchema);
