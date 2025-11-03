import mongoose from "mongoose";

const HouseholdSchema = new mongoose.Schema({
  name: { type: String, default: 'My Household', trim: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner','member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  currency: { type: String, default: 'INR' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  createdAt: { type: Date, default: Date.now }
});

export const Household = mongoose.model('Household', HouseholdSchema);