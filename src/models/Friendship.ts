import mongoose, { Schema, Document } from 'mongoose';
import { IFriendship, IFriendshipModel } from '../types';

const friendshipSchema = new Schema<IFriendship>({
  requester: {
    type: String,
    ref: 'User',
    required: true
  },
  addressee: {
    type: String,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  // Cuándo se rechazó la solicitud: da el margen antes de dejar reintentarla.
  respondedAt: Date
});

// Ensure unique friendship pairs
friendshipSchema.index({ requester: 1, addressee: 1 }, { unique: true });

// Prevent self-friendship
friendshipSchema.pre('save', function(next) {
  if (this.requester === this.addressee) {
    return next(new Error('No puedes agregarte a ti mismo como amigo'));
  }
  next();
});

// Update acceptedAt when status changes to accepted
friendshipSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
  next();
});

// Get friendship status between two users
friendshipSchema.statics.getFriendshipStatus = async function(
  userId1: string, 
  userId2: string
): Promise<string | null> {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, addressee: userId2 },
      { requester: userId2, addressee: userId1 }
    ]
  });
  
  return friendship ? friendship.status : null;
};

// Get all friends for a user
friendshipSchema.statics.getFriends = async function(userId: string) {
  const friendships = await this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { addressee: userId, status: 'accepted' }
    ]
  }).populate('requester addressee', 'username elo avatar');

  return friendships.map((friendship: any) => {
    // requester/addressee are populated User documents here, not plain id
    // strings — compare by _id, not by the (unrelated) default toString()
    const friend = friendship.requester._id.toString() === userId
      ? friendship.addressee
      : friendship.requester;
    return {
      id: friend._id,
      username: friend.username,
      elo: friend.elo,
      avatar: friend.avatar
    };
  });
};

// Get pending friend requests for a user
friendshipSchema.statics.getPendingRequests = async function(userId: string) {
  return this.find({
    addressee: userId,
    status: 'pending'
  }).populate('requester', 'username elo');
};

export default mongoose.model<IFriendship, IFriendshipModel>('Friendship', friendshipSchema);
