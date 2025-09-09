import express from "express";
const router = express.Router();
import { getSellerDashboard, deleteSellerProduct, createSellerProduct } from "../controllers/seller.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getSellerProductsByStatus } from "../controllers/product.controller.js";

// Seller dashboard analytics and product lists
router.get("/analytics", protectRoute, getSellerDashboard);
// Seller: Get own products grouped by status
router.get("/products", protectRoute, getSellerProductsByStatus);
// Create a new product (seller only)
router.post("/products", protectRoute, createSellerProduct);
// Delete a product (only by owner)
router.delete("/product/:id", protectRoute, deleteSellerProduct);

export default router;
