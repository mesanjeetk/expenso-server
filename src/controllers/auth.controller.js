// controllers/auth.controller.js
import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Household } from "../models/household.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateToken } from "../utils/lib.js";
import { sendWelcomeEmail } from "../utils/email.js";

/**
 * Generate a short join code and ensure uniqueness by retrying a few times.
 */
async function makeUniqueJoinCode(len = 6, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const code = crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len).toUpperCase();
    const exists = await Household.findOne({ joinCode: code }).lean();
    if (!exists) return code;
  }
  // fallback — return a longer random string if collisions occur
  return crypto.randomBytes(len).toString("hex").slice(0, len).toUpperCase();
}

function generateEmailVerifyToken() {
  // random raw token (send this to user)
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 char

  // hashed version (store in db)
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = Date.now() + 10 * 60 * 1000;

  return { rawToken, hashedToken, expires };
}


/**
 * Register a new user and either create a household or join an existing one via joinCode.
 *
 * Request body:
 * { email, password, name, joinCode? }
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, name, joinCode } = req.body ?? {};

  // Basic types
  if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
    throw new ApiError(400, "Please provide valid input for email, password and name.");
  }

  // Normalize and trim
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const trimmedPassword = password.trim();

  // Non-empty checks
  if (!normalizedEmail || !trimmedName || !trimmedPassword) {
    throw new ApiError(400, "Please provide non-empty email, name and password.");
  }

  // Name length (tweakable)
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    throw new ApiError(400, "Name must be between 2 and 50 characters.");
  }

  // Password length
  if (trimmedPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long.");
  }

  // Simple email format check
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address.");
  }

  // Check existing user
  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    throw new ApiError(400, "User with this email already exists.");
  }

  // Start a mongoose session so user + household linking is atomic
  const session = await mongoose.startSession();
  session.startTransaction();

  const { rawToken, hashedToken, expires } = generateEmailVerifyToken();
  try {
    // Create user (UserSchema pre('save') will hash the password)
    // Using Model.create(array, { session }) to ensure it participates in session
    const createdUsers = await User.create(
      [
        {
          name: trimmedName,
          email: normalizedEmail,
          password: trimmedPassword,
          emailVerificationToken: hashedToken,
          emailVerificationExpires: expires
        },
      ],
      { session }
    );
    const newUser = createdUsers[0];

    let householdDoc = null;

    if (typeof joinCode === "string" && joinCode.trim()) {
      const code = joinCode.trim().toUpperCase();
      householdDoc = await Household.findOne({ joinCode: code }).session(session);

      if (!householdDoc) {
        await session.abortTransaction();
        session.endSession();
        throw new ApiError(400, "Invalid join code. Please check the code and try again.");
      }

      // Add user to household members if not already present
      const alreadyMember = householdDoc.members.some((m) => m.user.toString() === newUser._id.toString());
      if (!alreadyMember) {
        householdDoc.members.push({ user: newUser._id, role: "member", joinedAt: new Date() });
        await householdDoc.save({ session });
      }

      // Link household id to user.households
      newUser.households = Array.isArray(newUser.households) ? [...newUser.households, householdDoc._id] : [householdDoc._id];
      await newUser.save({ session });
    } else {
      // No joinCode — create a new household and make this user admin
      const code = await makeUniqueJoinCode(6);
      const createdHH = await Household.create(
        [
          {
            name: `${trimmedName}'s Household`,
            joinCode: code,
            members: [{ user: newUser._id, role: "admin", joinedAt: new Date() }],
            primaryHolder: newUser._id
          },
        ],
        { session }
      );
      householdDoc = createdHH[0];

      // link household to user
      newUser.households = [householdDoc._id];
      newUser.defaultHousehold = householdDoc._id;
      await newUser.save({ session });
    }

    await sendWelcomeEmail({ to: normalizedEmail, name: trimmedName, verifyLink: `http://localhost:8000/api/auth/verify-email?token=${rawToken}` })

    await session.commitTransaction();
    session.endSession();

    // create token
    const token = generateToken(newUser._id);

    const resUser = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      households: newUser.households ?? [],
    };

    const householdInfo = {
      _id: householdDoc._id,
      name: householdDoc.name,
      joinCode: householdDoc.joinCode,
    };

    res.status(201).json(new ApiResponse(201, { user: resUser, token, household: householdInfo }, "User registered successfully."));
  } catch (err) {
    // handle duplicate email race condition
    if (err && err.code === 11000) {
      await session.abortTransaction();
      session.endSession();
      throw new ApiError(400, "User with this email already exists.");
    }
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

/**
 * Login existing user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    throw new ApiError(400, "Please provide valid email and password.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  if (!normalizedEmail || !trimmedPassword) {
    throw new ApiError(400, "Please provide non-empty email and password.");
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid email address.");
  }

  // Password is stored in User.password (not hidden by schema). If you had set select:false for password,
  // you'd use .select('+password') here.
  const user = await User.findOne({ email: normalizedEmail }).select("+password").populate("households");

  if (!user || !(await user.isPasswordCorrect(trimmedPassword))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const token = generateToken(user._id);

  const resUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    households: (user.households || []).map(h => ({ _id: h._id, name: h.name, joinCode: h.joinCode })),
  };

  res.status(200).json(new ApiResponse(200, { user: resUser, token }, "User logged in successfully."));
});


const verifyEmail = asyncHandler(async (req, res) => {
  if (!req.query.token && typeof req.query.token !== "string") {
    throw new ApiError(400, "Please provide token");
  }

  const hashed = crypto.createHash("sha256").update(req.query.token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) throw new ApiError(400, "Invalid or expired token");

  // mark verified
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.status(200).json(new ApiResponse(200, {}, "Email verified successfully"))
});

export { register, login, verifyEmail };
