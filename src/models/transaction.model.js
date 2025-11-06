import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';


const ReimbursementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who should pay
  amount: { type: Number, required: true, min: 0 }, // portion owed by that user
  currency: { type: String }, // optional override
  received: { type: Boolean, default: false }, // paid back?
  receivedAt: { type: Date }, // when received
  notes: { type: String } // optional (e.g., partial payment note)
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const TransactionSchema = new mongoose.Schema({
  household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who added the record
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who actually paid at purchase time
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  category: { type: String, default: 'Other' },
  note: { type: String },
  date: { type: Date, default: Date.now }, // date of transaction (when purchase happened)
  reimbursements: { type: [ReimbursementSchema], default: [] }, // per-person owed amounts & status
  attachments: { type: [AttachmentSchema], default: [] }, // photos/receipts
  isRecurring: { type: Boolean, default: false },
  recurringRule: { type: String }, // e.g., iCal RRULE or simple string
  metadata: { type: mongoose.Schema.Types.Mixed }, // flexible field for future needs
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

// helpful indexes
TransactionSchema.index({ household: 1, date: -1 });
TransactionSchema.index({ 'reimbursements.user': 1, 'reimbursements.received': 1 });
TransactionSchema.index({ payer: 1 }); // query by payer (filter=mine)
TransactionSchema.index({ createdBy: 1 }); // who created transactions
TransactionSchema.index({ category: 1 }); // category filtering
TransactionSchema.index({ isRecurring: 1 }); // recurring lookups
TransactionSchema.index({ createdAt: -1 }); // recent transactions

// Text index for search on category + note (useful for search feature)
TransactionSchema.index({ note: 'text', category: 'text' }, { default_language: "english" });
TransactionSchema.plugin(aggregatePaginate);

export const Transaction = mongoose.model('Transaction', TransactionSchema);
