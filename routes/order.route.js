import express from "express";
import { getSellerOrders, getSellerRevenue, getMarketplaceAnalytics } from "../controllers/order.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();


router.get("/seller/orders", protectRoute, getSellerOrders);

router.get("/seller/revenue", protectRoute, getSellerRevenue);

router.get("/admin/analytics", protectRoute, getMarketplaceAnalytics);

export default router;
