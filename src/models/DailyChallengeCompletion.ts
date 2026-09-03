import mongoose, { Schema, Document } from 'mongoose';

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
  const today = new Date().toISOString().split('T')[0];
  const completion = await this.findOne({ userId, date: today });
  return !!completion;
};

export default mongoose.model<IDailyChallengeCompletion>('DailyChallengeCompletion', dailyChallengeCompletionSchema);
