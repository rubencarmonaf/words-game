import mongoose, { Schema, Document } from 'mongoose';
import { todayInSpain } from '../utils/date';

export interface IDailyChallenge extends Document {
  _id: string;
  date: string; // YYYY-MM-DD format
  prefix: string;
  createdAt: Date;
}

const dailyChallengeSchema = new Schema<IDailyChallenge>({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  prefix: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 4
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Static method to get today's challenge
dailyChallengeSchema.statics.getTodaysChallenge = async function() {
  const today = todayInSpain();

  let challenge = await this.findOne({ date: today });
  
  if (!challenge) {
    // Generate new daily challenge with random prefix (max 3 letters, balanced consonants/vowels)
    const prefixes = [
      // 2 letras - Consonante + Vocal
      'CA', 'CO', 'CU', 'CE', 'CI', 'DA', 'DE', 'DI', 'DO', 'DU', 'FA', 'FE', 'FI', 'FO', 'FU', 'GA', 'GE', 'GI', 'GO', 'GU', 'HA', 'HE', 'HI', 'HO', 'HU', 'JA', 'JE', 'JI', 'JO', 'JU', 'LA', 'LE', 'LI', 'LO', 'LU', 'MA', 'ME', 'MI', 'MO', 'MU', 'NA', 'NE', 'NI', 'NO', 'NU', 'PA', 'PE', 'PI', 'PO', 'PU', 'QU', 'RA', 'RE', 'RI', 'RO', 'RU', 'SA', 'SE', 'SI', 'SO', 'SU', 'TA', 'TE', 'TI', 'TO', 'TU', 'VA', 'VE', 'VI', 'VO', 'VU', 'ZA', 'ZE', 'ZI', 'ZO', 'ZU',
    ];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    
    challenge = new this({
      date: today,
      prefix: randomPrefix
    });
    
    await challenge.save();
  }
  
  return challenge;
};

export default mongoose.model<IDailyChallenge>('DailyChallenge', dailyChallengeSchema);
