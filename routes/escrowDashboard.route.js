import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
	getSellerEscrowDashboard,
	getBuyerEscrowDashboard,
	getEscrowTransactionDetails
} from "../controllers/escrowDashboard.controller.js";

const router = express.Router();


router.get("/seller/dashboard", protectRoute, getSellerEscrowDashboard);


router.get("/buyer/dashboard", protectRoute, getBuyerEscrowDashboard);


router.get("/transaction/:transactionId", protectRoute, getEscrowTransactionDetails);

export default router;
