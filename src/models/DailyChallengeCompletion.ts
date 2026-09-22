import mongoose, { Schema, Document } from 'mongoose';
import { todayInSpain } from '../utils/date';

export interface IDailyChallengeCompletion extends Document {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  wordsFound: string[];
  completedAt: Date;
  rewardEarned: number;
}

const dailyChallengeCompletionSchema = new Schema<IDailyChallengeCompletion>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  wordsFound: [{
    type: String,
    required: true
  }],
  completedAt: {
    type: Date,
    default: Date.now
  },
  rewardEarned: {
    type: Number,
    required: true,
    min: 0
  }
});

// Compound index to ensure one completion per user per day
dailyChallengeCompletionSchema.index({ userId: 1, date: 1 }, { unique: true });

// Static method to check if user has completed today's challenge
dailyChallengeCompletionSchema.statics.hasUserCompletedToday = async function(userId: string): Promise<boolean> {
  const today = todayInSpain();
  const completion = await this.findOne({ userId, date: today });
  return !!completion;
};

// Días seguidos completando el reto: cuenta hacia atrás desde hoy. Si hoy aún no se ha jugado
// la racha no se da por rota todavía (sigue "viva" mientras quede el día) — solo se rompe si
// ayer tampoco se jugó. 400 días de tope: de sobra para cualquier racha real, acota la consulta.
dailyChallengeCompletionSchema.statics.getStreak = async function(userId: string): Promise<number> {
  const rows = await this.find({ userId }, 'date').sort({ date: -1 }).limit(400).lean();
  const dates = new Set(rows.map((r: any) => r.date as string));

  // cursor es un día de calendario "en blanco" (medianoche UTC de esa fecha), solo para poder
  // restarle días con setUTCDate; no representa ningún instante real ni huso horario.
  const fmt = (d: Date): string => d.toISOString().split('T')[0];
  const cursor = new Date(`${todayInSpain()}T00:00:00Z`);
  if (!dates.has(fmt(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (dates.has(fmt(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
};

export default mongoose.model<IDailyChallengeCompletion>('DailyChallengeCompletion', dailyChallengeCompletionSchema);
