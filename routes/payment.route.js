import express from "express";
import { protectRoute, requireRole, strictAdminOnly } from "../middleware/auth.middleware.js";
import { 
	createCheckoutSession, 
	releaseEscrow, 
	getAllEscrowTransactions,
	getAdminRevenue,
	cancelEscrow,
	getOrderDetails,
	verifyTransaction,
	// Removed confirmOrderWithCode - no longer needed
	getSellerPendingOrders,
	getOrderDetailsForSuccess,
	verifyAndProcessPayment,
	testPaystackConnection,
	checkTransactionStatus,
	getDatabaseStats,
	confirmProductReceived,
	// MOCK PAYMENT ENDPOINTS
	mockCheckout,
	mockConfirmPayment,
	mockVerifyPayment
} from "../controllers/payment.controller.js";

const router = express.Router();

// Webhook middleware - only for Paystack webhook endpoint
// router.post("/paystack-webhook", express.raw({ type: 'application/json' }), paystackWebhook);
router.post("/create-checkout-session", protectRoute, createCheckoutSession);

// MOCK PAYMENT ROUTES
router.post("/mock-checkout", protectRoute, mockCheckout);
router.post("/mock-confirm/:reference", protectRoute, mockConfirmPayment);
router.get("/mock-verify/:reference", protectRoute, mockVerifyPayment);
router.get("/test-paystack", testPaystackConnection);
router.get("/check-transaction/:reference", protectRoute, checkTransactionStatus);
router.get("/database-stats", protectRoute, getDatabaseStats);
router.get("/verify-and-process/:reference", protectRoute, verifyAndProcessPayment);
router.get("/order-details-success/:reference", protectRoute, getOrderDetailsForSuccess);
router.post("/confirm-product/:reference", protectRoute, confirmProductReceived);

router.get("/paystack-webhook", (req, res) => {
	res.status(405).json({ 
		error: "Method not allowed", 
		message: "This endpoint only accepts POST requests from Paystack webhooks",
		info: "Use POST method to send webhook data from Paystack"
	});
});


router.options("/paystack-webhook", (req, res) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'POST');
	res.header('Access-Control-Allow-Headers', 'Content-Type, x-paystack-signature');
	res.sendStatus(200);
});
router.get("/order-details/:reference", protectRoute, getOrderDetails);
router.get("/verify/:reference", protectRoute, verifyTransaction);


router.get("/seller/pending-orders", protectRoute, requireRole(["seller"]), getSellerPendingOrders);
// Removed seller confirmation route - now only relies on buyer confirmation


router.get("/escrow/transactions", protectRoute, strictAdminOnly, getAllEscrowTransactions);
router.get("/escrow/revenue", protectRoute, strictAdminOnly, getAdminRevenue);
router.post("/escrow/release", protectRoute, strictAdminOnly, releaseEscrow);
router.post("/escrow/cancel", protectRoute, strictAdminOnly, cancelEscrow);


router.post("/release-escrow", protectRoute, strictAdminOnly, releaseEscrow);

export default router;
