import { Router } from "express";
import { me } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/me").get(verifyJWT, me);

export default router;