import express from "express";
import { getSellerOrders, getSellerRevenue, getMarketplaceAnalytics } from "../controllers/order.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Seller: get their orders
router.get("/seller/orders", protectRoute, getSellerOrders);
// Seller: get their revenue
router.get("/seller/revenue", protectRoute, getSellerRevenue);
// Admin: get analytics
router.get("/admin/analytics", protectRoute, getMarketplaceAnalytics);

export default router;
