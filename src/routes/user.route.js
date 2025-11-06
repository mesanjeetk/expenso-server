import { Router } from "express";
import { acceptHouseholdInvite, changePassword, me, sendHouseHoldInvite } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/me").get(verifyJWT, me);
router.route("/change-password").post(verifyJWT, changePassword);
router.route("/send-invites").post(verifyJWT, sendHouseHoldInvite);
router.route("/accept-invites").post(verifyJWT, acceptHouseholdInvite);

export default router;