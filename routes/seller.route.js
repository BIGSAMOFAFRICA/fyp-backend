import express from "express";
const router = express.Router();
import { getSellerDashboard, deleteSellerProduct, createSellerProduct } from "../controllers/seller.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getSellerProductsByStatus } from "../controllers/product.controller.js";


router.get("/analytics", protectRoute, getSellerDashboard);

router.get("/products", protectRoute, getSellerProductsByStatus);

router.post("/products", protectRoute, createSellerProduct);

router.delete("/product/:id", protectRoute, deleteSellerProduct);

export default router;
