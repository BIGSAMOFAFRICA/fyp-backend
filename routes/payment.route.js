import express from "express";
import { protectRoute, requireRole, strictAdminOnly } from "../middleware/auth.middleware.js";
import { paystackWebhook, createCheckoutSession, releaseEscrow } from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/create-checkout-session", protectRoute, createCheckoutSession);
router.post("/paystack-webhook", paystackWebhook);
router.post("/release-escrow", protectRoute, strictAdminOnly, releaseEscrow);

export default router;
