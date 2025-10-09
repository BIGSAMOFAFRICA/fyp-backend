


import express from "express";
import { login, logout, signup, refreshToken, getProfile, requestPasswordReset, resetPassword, verifyPasswordResetOTP } from "../controllers/auth.controller.js";
import { sendOTP, verifyOTP } from "../controllers/verification.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);
router.get("/profile", protectRoute, getProfile);
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/verify-otp", verifyPasswordResetOTP);

export default router;