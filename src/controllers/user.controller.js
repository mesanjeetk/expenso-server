import { Household } from "../models/household.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendHouseHoldInvitesEmail } from "../utils/email.js";

const me = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ApiError(404, "Invalid request");
    }
    return res.status(200).json(
        new ApiResponse(200, { user }, "User fetched successfully")
    );
});

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
        throw new ApiError(400, "Please provide valid input.");
    }
    if (!newPassword.trim() || !oldPassword.trim()) {
        throw new ApiError(400, "Password must be provided.");
    }
    if (newPassword.length < 6 || oldPassword.length < 6) {
        throw new ApiError(400, "Password length must be greater than 6.");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isCorrect = await user.isPasswordCorrect(oldPassword); // <-- IMPORTANT!
    if (!isCorrect) {
        throw new ApiError(401, "Invalid Password");
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password updated successfully")
    );
});


const sendHouseHoldInvite = asyncHandler(async (req, res) => {
    const { usersId } = req.body;

    if (!Array.isArray(usersId) || usersId.length === 0) {
        throw new ApiError(400, "At least provide one user id");
    }

    // find household user belongs to
    const household = await Household.findOne({
        $or: [
            { primaryHolder: req.user._id },
            { "members.user": req.user._id }
        ]
    });

    if (!household) {
        throw new ApiError(404, "You are not part of any household");
    }

    const users = await User.find({ _id: { $in: usersId } })
        .select("email name _id")
        .lean();

    if (!users.length) throw new ApiError(404, "No users found");

    const currentMembersIds = household.members.map(m => m.user.toString());
    const pendingIds = household.pendingInvites.map(p => p.user.toString());

    // filter users not already member and not already pending
    const usersToInvite = users.filter(u =>
        !currentMembersIds.includes(u._id.toString()) &&
        !pendingIds.includes(u._id.toString())
    );

    if (!usersToInvite.length) {
        return res.status(200).json(new ApiResponse(200, {}, "Nothing to invite"));
    }

    const inviteAcceptLink = `${process.env.CLIENT_URL}/house-invite/${household.joinCode}`;

    // send email
    await Promise.all(
        usersToInvite.map(u =>
            sendHouseHoldInvitesEmail({
                to: u.email,
                inviterName: req.user.name,
                inviteAcceptLink,
            })
        )
    );

    // add pending invites to DB
    usersToInvite.forEach(u => {
        household.pendingInvites.push({
            user: u._id,
            invitedBy: req.user._id,
        });
    });
    await household.save();

    res.status(200).json(
        new ApiResponse(200, { invitedCount: usersToInvite.length }, "Invites sent")
    );
});

const acceptHouseholdInvite = asyncHandler(async (req, res) => {
    const { joinCode } = req.body;  // frontend will send joinCode
    const userId = req.user._id;    // logged in user

    if (!joinCode || typeof joinCode !== "string") {
        throw new ApiError(400, "joinCode is required");
    }

    const household = await Household.findOne({ joinCode });

    if (!household) {
        throw new ApiError(404, "Invalid join code");
    }

    const isAlreadyMember = household.members.some(
        m => m.user.toString() === userId.toString()
    );

    if (isAlreadyMember) {
        return res.status(200).json(new ApiResponse(200, {}, "Already a member"));
    }

    const pending = household.pendingInvites.find(
        i => i.user.toString() === userId.toString()
    );

    if (!pending) {
        throw new ApiError(400, "No pending invite found for this user");
    }

    // remove from pendingInvites
    household.pendingInvites = household.pendingInvites.filter(
        i => i.user.toString() !== userId.toString()
    );

    // add to members
    household.members.push({
        user: userId,
        role: "member",
        joinedAt: new Date()
    });

    await household.save();

    await User.findByIdAndUpdate(userId, {
        $addToSet: { households: household._id },
        $setOnInsert: { defaultHousehold: household._id }
    });

    return res.status(200).json(
        new ApiResponse(200, {}, "Household invite accepted successfully")
    );
});




export { me, changePassword, sendHouseHoldInvite, acceptHouseholdInvite };