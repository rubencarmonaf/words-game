import mongoose, { Schema } from 'mongoose';
import { IMessage } from '../types';

const messageSchema = new Schema<IMessage>({
  from: {
    type: String,
    ref: 'User',
    required: true
  },
  to: {
    type: String,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  kind: {
    type: String,
    enum: ['text', 'lobby-invite'],
    default: 'text'
  },
  lobbyId: {
    type: String
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Cubre el historial de un hilo (from+to en cualquier orden) ordenado por fecha
messageSchema.index({ from: 1, to: 1, createdAt: 1 });
messageSchema.index({ to: 1, from: 1, createdAt: 1 });
// Cubre el conteo de no leídos por remitente
messageSchema.index({ to: 1, read: 1 });

export default mongoose.model<IMessage>('Message', messageSchema);
