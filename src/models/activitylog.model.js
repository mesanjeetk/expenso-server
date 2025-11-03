import mongoose from "mongoose";


const ActivityLogSchema = new mongoose.Schema({
  household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who did the action
  action: { type: String, required: true }, // e.g., 'created_tx', 'marked_received', 'edited_tx'
  before: { type: mongoose.Schema.Types.Mixed }, // optional snapshot
  after: { type: mongoose.Schema.Types.Mixed }, // optional snapshot
  createdAt: { type: Date, default: Date.now }
});


export const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);