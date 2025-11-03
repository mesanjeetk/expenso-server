// controllers/auth.controller.js
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateToken } from "../utils/lib.js";

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body ?? {};

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

  // Create user (handle duplicate race-condition)
  let user;
  try {
    user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: trimmedPassword,
    });
  } catch (err) {
    // Mongo duplicate key race condition
    if (err && err.code === 11000) {
      throw new ApiError(400, "User with this email already exists.");
    }
    throw err;
  }

  // Generate token. If your generateToken expects the whole user object, change this to `generateToken(user)`
  const token = generateToken(user);

  if (!user || !token) {
    throw new ApiError(500, "User registration failed.");
  }

  // Remove sensitive fields from response
  const resdata = {
    _id: user._id,
    name: user.name,
    email: user.email,
  };

  // Optional: set token as secure httpOnly cookie (uncomment if desired)
  /*
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  res.cookie("token", token, cookieOptions);
  */

  res.status(201).json(new ApiResponse(201, { user: resdata, token }, "User registered successfully."));
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

  const user = await User.findOne({ email: normalizedEmail }).select("+password"); // ensure password is selectable if schema hides it

  if (!user || !(await user.isPasswordCorrect(trimmedPassword))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  const token = generateToken(user._id ?? user.id ?? user);

  const resdata = {
    _id: user._id,
    name: user.name,
    email: user.email,
  };

  // Optional cookie set (uncomment if you prefer cookie-based auth)
  /*
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  res.cookie("token", token, cookieOptions);
  */

  res.status(200).json(new ApiResponse(200, { user: resdata, token }, "User logged in successfully."));
});

export { register, login };
