
import express from "express";
import { buyerPay, adminRelease, adminRefund, getSellerDashboard, getBuyerDashboard, getPendingTransactions } from "../controllers/escrow.controller.js";
import { protectRoute, isAdmin } from "../middleware/auth.middleware.js";
const router = express.Router();

// Admin: Get all pending transactions for review
router.get("/admin/transactions/pending", protectRoute, isAdmin, getPendingTransactions);


// Buyer pays for a product (escrow)
router.post("/buyer/pay", protectRoute, buyerPay);

// Admin releases escrow to seller
router.post("/admin/release/:transactionId", protectRoute, isAdmin, adminRelease);

// Admin refunds buyer
router.post("/admin/refund/:transactionId", protectRoute, isAdmin, adminRefund);

// Seller dashboard analytics
router.get("/seller/dashboard/:id", protectRoute, getSellerDashboard);

// Buyer dashboard analytics
router.get("/buyer/dashboard/:id", protectRoute, getBuyerDashboard);

export default router;
