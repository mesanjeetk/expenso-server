// middlewares/auth.middleware.js
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { Household } from "../models/household.model.js";

/**
 * verifyJWT(options)
 * options:
 *   - allowGuest (boolean): don't throw if no token (req.user stays undefined)
 *   - requireHousehold (boolean): if true, checks that user is member of req.params.householdId or req.body.household
 *   - allowedRoles (array): restricts to household roles (e.g., ['admin'])
 */
export const verifyJWT = (options = {}) => asyncHandler(async (req, res, next) => {
  try {
    const { allowGuest = false, requireHousehold = false, allowedRoles = [] } = options;

    // --- get token from cookie, header, or query ---
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.query?.token;

    if (!token) {
      if (allowGuest) {
        req.user = null;
        return next();
      }
      throw new ApiError(401, "Unauthorized request (no token)");
    }

    // --- verify token ---
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?._id) throw new ApiError(401, "Invalid token payload");

    // --- find user ---
    const user = await User.findById(decoded._id).select("-password");
    if (!user) throw new ApiError(401, "User not found");

    req.user = user;

    // --- optional household membership check ---
    if (requireHousehold) {
      const householdId = req.params.householdId || req.body.household || req.query.householdId;
      if (!householdId) throw new ApiError(400, "Household ID required");

      const household = await Household.findById(householdId);
      if (!household) throw new ApiError(404, "Household not found");

      const memberEntry = household.members.find(m => m.user.toString() === user._id.toString());
      if (!memberEntry) throw new ApiError(403, "User not part of this household");

      // attach household & role to req
      req.household = household;
      req.role = memberEntry.role;

      // --- check allowed roles ---
      if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        if (!allowedRoles.includes(memberEntry.role)) {
          throw new ApiError(403, "Forbidden: insufficient role");
        }
      }
    }

    next();
  } catch (error) {
    if (options.allowGuest && (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError")) {
      req.user = null;
      return next();
    }
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
