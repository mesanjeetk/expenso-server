import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const me = asyncHandler(async (req, res) => {
    const user = req.user;
    res.status(200).json(new ApiResponse(200, { user }, "User fetched successfully"));
});


export { me };