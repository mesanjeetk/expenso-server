// controllers/transaction.controller.js
import mongoose from "mongoose";
import { Transaction } from "../models/transaction.model.js";
import { Household } from "../models/household.model.js";
import { ActivityLog } from "../models/activitylog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

/**
 * Helper: ensures user is a member of the household and returns household doc + member entry
 */
async function assertHouseholdMember(userId, householdId) {
  const hh = await Household.findById(householdId).lean();
  if (!hh) throw new ApiError(404, "Household not found");
  const member = (hh.members || []).find(m => m.user.toString() === userId.toString());
  if (!member) throw new ApiError(403, "User is not a member of this household");
  return { household: hh, member };
}

/**
 * Helper: auto-compute reimbursements if none provided
 * Default behaviour: exclude payer from owing (payer's share = 0), split the total among other household members equally
 * Rounding: uses Math.floor and distributes remainder to first members
 */
function computeEqualReimbursements(members, payerId, totalAmount) {
  // members: array of objects { user: ObjectId, role, joinedAt }
  const userIds = members.map(m => (m.user ? m.user.toString() : m.toString()));
  const others = userIds.filter(id => id !== payerId.toString());

  if (others.length === 0) {
    // nobody else to reimburse
    return [];
  }

  const total = Number(totalAmount);
  if (isNaN(total) || total < 0) throw new ApiError(400, "Invalid total amount for reimbursement calculation");

  // Use paise-friendly calculation by working in cents (or paise) if you switch later.
  const base = Math.floor((total / others.length) * 100) / 100; // round down to 2 decimals
  let remainder = Math.round((total - base * others.length) * 100); // in cents/paise
  const reimbursements = others.map((uid, idx) => {
    let extra = 0;
    if (remainder > 0) {
      extra = 0.01;
      remainder -= 1;
    }
    const amount = Math.round((base + extra) * 100) / 100;
    return { user: mongoose.Types.ObjectId(uid), amount, received: false };
  });

  return reimbursements;
}

/**
 * Create a transaction
 * Body:
 *  { household, payer, amount, currency?, category?, note?, date?, reimbursements?: [{ user, amount }], personalMoney?: boolean }
 */
const createTransaction = asyncHandler(async (req, res) => {
  const {
    household,
    payer,
    amount,
    currency = "INR",
    category = "Other",
    note,
    date,
    reimbursements,
    personalMoney: personalMoneyInput
  } = req.body ?? {};

  const files = req.files || [];

  if (!household || !payer || typeof amount === "undefined") {
    throw new ApiError(400, "household, payer and amount are required");
  }

  // caller must be household member
  await assertHouseholdMember(req.user._id, household);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // load household with members and primaryHolder
    const hh = await Household.findById(household).select("members primaryHolder").session(session);
    if (!hh) throw new ApiError(404, "Household not found");

    const payerIdStr = mongoose.Types.ObjectId(payer).toString();
    const primaryHolderIdStr = hh.primaryHolder ? hh.primaryHolder.toString() : null;

    // Decide whether payer used personal money.
    let personalMoney;
    if (typeof personalMoneyInput === "boolean") {
      personalMoney = personalMoneyInput;
    } else {
      personalMoney = primaryHolderIdStr ? (payerIdStr !== primaryHolderIdStr) : true;
    }

    // reimbursementsToSave: honor explicit reimbursements if provided
    let reimbursementsToSave = reimbursements;
    if (Array.isArray(reimbursementsToSave) && reimbursementsToSave.length) {
      // ensure `user` fields are ObjectIds and amounts are Numbers
      reimbursementsToSave = reimbursementsToSave.map(r => {
        if (!r.user || typeof r.amount === "undefined") {
          throw new ApiError(400, "Each reimbursement must include user and amount");
        }
        const amt = Number(r.amount);
        if (isNaN(amt) || amt < 0) throw new ApiError(400, "Invalid reimbursement amount");
        return {
          user: mongoose.Types.ObjectId(r.user),
          amount: amt,
          received: !!r.received,
          notes: r?.notes || ""
        };
      });
    } else {
      // No explicit reimbursements: compute based on primaryHolder + personalMoney rules
      if (!personalMoney) {
        // Paid from household money => no reimbursements
        reimbursementsToSave = [];
      } else {
        // personalMoney === true
        if (primaryHolderIdStr && payerIdStr !== primaryHolderIdStr) {
          // Primary holder exists and payer is someone else:
          // Charge the primary holder the full amount.
          const amt = Number(amount);
          if (isNaN(amt) || amt < 0) throw new ApiError(400, "Invalid amount");
          reimbursementsToSave = [
            { user: mongoose.Types.ObjectId(primaryHolderIdStr), amount: amt, received: false }
          ];
        } else {
          // fallback to equal split among other members excluding payer
          reimbursementsToSave = computeEqualReimbursements(hh.members, payerIdStr, amount);
        }
      }
    }

    let attachments = [];

    if (files.length > 0) {
      const [result] = await Promise.all(files.map(file => uploadOnCloudinary(file.path)));
      for (const r of result) {
        attachments.push({ url: r.secure_url, public_id: r.public_id })
      }
    }

    // create transaction
    const created = await Transaction.create(
      [
        {
          household,
          createdBy: req.user._id,
          payer,
          amount: Number(amount),
          currency,
          category,
          note,
          date: date ? new Date(date) : new Date(),
          reimbursements: reimbursementsToSave,
          attachments
        }
      ],
      { session }
    );

    const saved = created[0];

    // activity log
    await ActivityLog.create(
      [
        {
          household,
          transaction: saved._id,
          user: req.user._id,
          action: "created_tx",
          after: saved,
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const resp = await Transaction.findById(saved._id)
      .populate("payer", "name email")
      .populate("createdBy", "name email")
      .populate("reimbursements.user", "name email");

    return res.status(201).json(new ApiResponse(201, { transaction: resp }, "Transaction added successfully."));
  } catch (err) {
    if (attachments.length > 0 ) {
      await deleteFromCloudinary(attachments.map(e => e.public_id))
    }
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/**
 * List transactions (aggregate + paginate)
 * Query params:
 *   - householdId (required)
 *   - page, limit
 *   - month, year
 *   - filter = unpaid | all | mine (mine: transactions where payer==req.user._id)
 *   - payerId
 *   - search
 */
const listTransactions = asyncHandler(async (req, res) => {
  const {
    householdId, page = 1, limit = 20, month, year, filter, payerId, search
  } = req.query ?? {};

  if (!householdId) throw new ApiError(400, "householdId is required");

  await assertHouseholdMember(req.user._id, householdId);

  const pipeline = [];
  pipeline.push({ $match: { household: mongoose.Types.ObjectId(householdId) } });

  if (month && year) {
    const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    pipeline.push({ $match: { date: { $gte: start, $lt: end } } });
  }

  if (filter === "unpaid") {
    pipeline.push({ $match: { "reimbursements.received": false } });
  } else if (filter === "mine") {
    pipeline.push({ $match: { payer: mongoose.Types.ObjectId(req.user._id) } });
  }

  if (payerId) {
    pipeline.push({ $match: { payer: mongoose.Types.ObjectId(payerId) } });
  }

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { category: { $regex: search, $options: "i" } },
          { note: { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  pipeline.push({ $sort: { date: -1, createdAt: -1 } });

  const options = { page: parseInt(page, 10), limit: parseInt(limit, 10) };

  const agg = Transaction.aggregate(pipeline);

  const result = await Transaction.aggregatePaginate(agg, options);

  return res.json(new ApiResponse(200, { ...result }, "Transactions fetched successfully."));
});

/**p
 * Get a single transaction by id
 */
const getTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Transaction id required");

  const tx = await Transaction.findById(id)
    .populate("payer", "name email")
    .populate("createdBy", "name email")
    .populate("reimbursements.user", "name email")
    .lean();

  if (!tx) throw new ApiError(404, "Transaction not found");

  await assertHouseholdMember(req.user._id, tx.household);

  return res.json(new ApiResponse(200, { transaction: tx }, "Transaction retrieved."));
});

/**
 * Update transaction (basic fields + reimbursements)
 * Body can contain: amount, category, note, date, reimbursements (full replace)
 */
const updateTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body ?? {};

  if (!id) throw new ApiError(400, "Transaction id required");

  const tx = await Transaction.findById(id);
  if (!tx) throw new ApiError(404, "Transaction not found");

  await assertHouseholdMember(req.user._id, tx.household);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const before = tx.toObject();

    // Apply updatable fields
    const allowed = ["amount", "currency", "category", "note", "date", "reimbursements", "attachments"];
    allowed.forEach(key => {
      if (typeof updates[key] !== "undefined") {
        tx[key] = updates[key];
      }
    });

    await tx.save({ session });

    await ActivityLog.create(
      [
        {
          household: tx.household,
          transaction: tx._id,
          user: req.user._id,
          action: "edited_tx",
          before,
          after: tx.toObject()
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const updated = await Transaction.findById(tx._id).populate("reimbursements.user", "name email");
    return res.json(new ApiResponse(200, { transaction: updated }, "Transaction updated successfully."));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/**
 * Mark a reimbursement as received.
 * PATCH /transactions/:id/mark-received
 * Body: { userId }  // the user who paid (the ower)
 * Who can call: payer or the household member (we check household membership)
 */
const markReimbursementReceived = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body ?? {};

  if (!id || !userId) throw new ApiError(400, "Transaction id and userId required");

  const tx = await Transaction.findById(id);
  if (!tx) throw new ApiError(404, "Transaction not found");

  await assertHouseholdMember(req.user._id, tx.household);

  const rIndex = tx.reimbursements.findIndex(r => r.user.toString() === userId.toString());
  if (rIndex === -1) throw new ApiError(400, "No reimbursement entry for this user");

  if (tx.reimbursements[rIndex].received) {
    throw new ApiError(400, "Reimbursement already marked as received");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const before = tx.toObject();

    tx.reimbursements[rIndex].received = true;
    tx.reimbursements[rIndex].receivedAt = new Date();

    await tx.save({ session });

    await ActivityLog.create(
      [
        {
          household: tx.household,
          transaction: tx._id,
          user: req.user._id,
          action: "marked_received",
          before,
          after: tx.toObject()
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const updated = await Transaction.findById(tx._id).populate("reimbursements.user", "name email");
    return res.json(new ApiResponse(200, { transaction: updated }, "Reimbursement marked as received."));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/**
 * Delete transaction (soft-delete would be better in prod)
 */
const deleteTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Transaction id required");

  const tx = await Transaction.findById(id);
  if (!tx) throw new ApiError(404, "Transaction not found");

  // allow only household admin or creator to delete (example policy)
  const hh = await Household.findById(tx.household);
  const member = hh.members.find(m => m.user.toString() === req.user._id.toString());
  const isAdmin = member && member.role === "admin";
  const isCreator = tx.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) throw new ApiError(403, "Only household admin or transaction creator can delete");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await tx.remove({ session });

    await ActivityLog.create(
      [
        {
          household: tx.household,
          transaction: tx._id,
          user: req.user._id,
          action: "deleted_tx",
          before: tx.toObject()
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json(new ApiResponse(200, {}, "Transaction deleted successfully."));
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});


export {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  markReimbursementReceived,
  deleteTransaction
}
