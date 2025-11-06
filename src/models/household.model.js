import mongoose from "mongoose";

const HouseholdSchema = new mongoose.Schema({
  name: { type: String, default: 'My Household', trim: true },
  joinCode: { type: String, required: true, unique: true },
  primaryHolder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin','member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  pendingInvites: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now }
  }],
  currency: { type: String, default: 'INR' },
  timezone: { type: String, default: 'Asia/Kolkata' },
}, { timestamps: true });


export const Household = mongoose.model('Household', HouseholdSchema);