// controllers/milk.controller.js
import mongoose from "mongoose";
import { MilkDay } from "../models/milkDay.model.js";
import { Household } from "../models/household.model.js";
import { Transaction } from "../models/transaction.model.js";
import { ActivityLog } from "../models/activitylog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

/** Default price per litre. Change if you want household-level config later. */
const DEFAULT_PRICE_PER_LITRE = 52;

/** Normalize date to UTC day-start (00:00:00) */
function normalizeDay(d) {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

/** Reuse your household membership check */
async function assertHouseholdMemberSimple(userId, householdId) {
  const hh = await Household.findById(householdId).lean();
  if (!hh) throw new ApiError(404, "Household not found");
  const member = (hh.members || []).find(m => m.user.toString() === userId.toString());
  if (!member) throw new ApiError(403, "User is not a member of this household");
  return hh;
}

/**
 * Upsert daily milk record (household-level)
 * Body: { household, date (ISO string), litres }
 */
export const upsertDailyMilk = asyncHandler(async (req, res) => {
  const { household, date, litres } = req.body ?? {};
  if (!household || !date || typeof litres === "undefined") {
    throw new ApiError(400, "household, date and litres are required");
  }

  const normalizedDate = normalizeDay(date);
  const hh = await assertHouseholdMemberSimple(req.user._id, household);

  const value = Number(litres);
  if (isNaN(value) || value < 0) throw new ApiError(400, "Invalid litres value");

  // create or update the day's record
  const entry = await MilkDay.findOneAndUpdate(
    { household, date: normalizedDate },
    { $set: { litres: value }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true }
  );

  // optional activity log (one entry)
  await ActivityLog.create({
    household,
    user: req.user._id,
    action: "upsert_milk_day",
    after: entry
  });

  return res.json(new ApiResponse(200, { entry }, "Daily milk saved."));
});

/**
 * List all daily entries for a month and totals.
 * Query params: householdId, month (1-12), year (YYYY)
 */
export const listMonthMilk = asyncHandler(async (req, res) => {
  const { householdId, month, year } = req.query ?? {};
  if (!householdId || !month || !year) throw new ApiError(400, "householdId, month and year are required");

  await assertHouseholdMemberSimple(req.user._id, householdId);

  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const entries = await MilkDay.find({
    household: householdId,
    date: { $gte: start, $lt: end }
  }).sort({ date: 1 }).lean();

  // totals
  const totalLitres = entries.reduce((s, e) => s + (Number(e.litres) || 0), 0);
  const pricePerLitre = DEFAULT_PRICE_PER_LITRE;
  const totalAmount = Math.round(totalLitres * pricePerLitre * 100) / 100; // 2-decimal

  return res.json(new ApiResponse(200, {
    entries,
    totals: { totalLitres, pricePerLitre, totalAmount }
  }, "Monthly milk entries fetched."));
});

/**
 * Generate monthly milk transaction (single transaction, no reimbursements).
 * Body: { householdId, month, year, payer? }  — payer defaults to household.primaryHolder
 */
export const generateMonthlyMilkTransaction = asyncHandler(async (req, res) => {
  const { householdId, month, year, payer } = req.body ?? {};
  if (!householdId || !month || !year) throw new ApiError(400, "householdId, month and year required");

  const hh = await assertHouseholdMemberSimple(req.user._id, householdId);

  // compute range
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  // aggregate total litres for household in the month
  const agg = await MilkDay.aggregate([
    { $match: { household: mongoose.Types.ObjectId(householdId), date: { $gte: start, $lt: end } } },
    { $group: { _id: null, totalLitres: { $sum: "$litres" } } }
  ]);

  const totalLitres = agg && agg[0] ? Number(agg[0].totalLitres || 0) : 0;
  if (totalLitres === 0) {
    throw new ApiError(400, "No milk entries found for the month");
  }

  const pricePerLitre = DEFAULT_PRICE_PER_LITRE;
  const totalAmount = Math.round(totalLitres * pricePerLitre * 100) / 100;

  // choose payer: explicit or primaryHolder
  const payerId = payer ? mongoose.Types.ObjectId(payer) : (hh.primaryHolder ? hh.primaryHolder : null);
  if (!payerId) throw new ApiError(400, "No payer specified and household has no primaryHolder");

  // Create a single Transaction representing the month's milk cost
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const created = await Transaction.create([{
      household: householdId,
      createdBy: req.user._id,
      payer: payerId,
      amount: Number(totalAmount),
      currency: hh.currency || "INR",
      category: "Milk",
      note: `Monthly milk for ${start.toLocaleString("default", { month: "long", year: "numeric" })} — ${totalLitres} L @ ${pricePerLitre}/L`,
      date: end, // month-end as transaction date
      reimbursements: [] // NO reimbursements for milk (household expense)
    }], { session });

    const saved = created[0];

    await ActivityLog.create([{
      household: householdId,
      transaction: saved._id,
      user: req.user._id,
      action: "generated_monthly_milk",
      after: saved
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const resp = await Transaction.findById(saved._id).populate("payer", "name email");

    return res.status(201).json(new ApiResponse(201, { transaction: resp }, "Monthly milk transaction created."));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});
