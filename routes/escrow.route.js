
import express from "express";
import { 
  buyerPay, 
  adminRelease, 
  adminRefund, 
  getSellerDashboard, 
  getBuyerDashboard, 
  getPendingTransactions,
  getAdminRevenue,
  getAllEscrowTransactions
} from "../controllers/escrow.controller.js";
import { protectRoute, isAdmin } from "../middleware/auth.middleware.js";
const router = express.Router();


router.get("/admin/transactions/pending", protectRoute, isAdmin, getPendingTransactions);


router.get("/admin/transactions/all", protectRoute, isAdmin, getAllEscrowTransactions);


router.get("/admin/revenue", protectRoute, isAdmin, getAdminRevenue);


router.post("/buyer/pay", protectRoute, buyerPay);


router.post("/admin/release/:transactionId", protectRoute, isAdmin, adminRelease);


router.post("/admin/refund/:transactionId", protectRoute, isAdmin, adminRefund);


router.get("/seller/dashboard/:id", protectRoute, getSellerDashboard);


router.get("/buyer/dashboard/:id", protectRoute, getBuyerDashboard);

export default router;
