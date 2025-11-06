import { Router } from "express";
import { register, login, verifyEmail } from "../controllers/auth.controller.js";

const router = Router();

router.route("/register").post(register);
router.route("/login").post(login);
router.route("/verify-email").get(verifyEmail);


export default router;