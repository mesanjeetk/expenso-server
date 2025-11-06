// models/milkDay.model.js
import mongoose from "mongoose";

const MilkDaySchema = new mongoose.Schema({
  household: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true },
  date: { type: Date, required: true }, // normalized to day start (UTC) by controller
  litres: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Unique one record per household + date
MilkDaySchema.index({ household: 1, date: 1 }, { unique: true });

export const MilkDay = mongoose.model("MilkDay", MilkDaySchema);
