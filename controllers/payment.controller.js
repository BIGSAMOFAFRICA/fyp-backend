import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import { paystackApi, verifyPaystackSignature } from "../lib/paystack.js";
// import Paystack integration here (to be implemented)

// Initiate Paystack payment
export const createCheckoutSession = async (req, res) => {
	try {
		const { products, couponCode } = req.body;
		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({ error: "Invalid or empty products array" });
		}
		let totalAmount = 0;
		products.forEach((product) => {
			totalAmount += product.price * product.quantity;
		});
		let coupon = null;
		if (couponCode) {
			// Special case for BIGSAMOFAFRICA coupon: 20% off for any user
			if (couponCode.trim().toUpperCase() === "BIGSAMOFAFRICA") {
				coupon = { code: "BIGSAMOFAFRICA", discountPercentage: 20 };
				totalAmount -= Math.round(totalAmount * 0.2);
			} else {
				coupon = await Coupon.findOne({ code: couponCode, userId: req.user._id, isActive: true });
				if (coupon) {
					totalAmount -= Math.round((totalAmount * coupon.discountPercentage) / 100);
				}
			}
		}
		const buyer = await User.findById(req.user._id);
		// Set frontend URLs for success and cancel
		const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
		const successUrl = `${frontendBase}/purchase-success`;
		const cancelUrl = `${frontendBase}/purchase-cancel`;
		const paystackRes = await paystackApi.post("/transaction/initialize", {
			email: buyer.email,
			amount: totalAmount * 100, // Paystack expects kobo
			metadata: {
				userId: buyer._id.toString(),
				products: products.map((p) => ({ id: p._id, quantity: p.quantity, price: p.price })),
				couponCode: couponCode || "",
				success_url: successUrl,
				cancel_url: cancelUrl,
			},
		});
		// For frontend compatibility, return { url } as well as other keys
		res.status(200).json({
			url: paystackRes.data.data.authorization_url,
			authorization_url: paystackRes.data.data.authorization_url,
			paystackReference: paystackRes.data.data.reference,
			totalAmount,
			success_url: successUrl,
			cancel_url: cancelUrl,
		});
	} catch (error) {
		console.error("Error processing checkout:", error);
		res.status(500).json({ message: "Error processing checkout", error: error.message });
	}
};

// Paystack webhook/payment confirmation
export const paystackWebhook = async (req, res) => {
	try {
		if (!verifyPaystackSignature(req)) {
			return res.status(401).send("Invalid signature");
		}
		const event = req.body;
		if (event.event === "charge.success") {
			const data = event.data;
			const { userId, products, couponCode } = data.metadata;
			const sellerId = await Product.findById(products[0].id).then(p => p.seller);
			const newOrder = new Order({
				user: userId,
				products: products.map((product) => ({
					product: product.id,
					quantity: product.quantity,
					price: product.price,
				})),
				totalAmount: data.amount / 100,
				paystackReference: data.reference,
				seller: sellerId,
				escrowStatus: "pending",
				transactionLog: [{ status: "pending", message: "Payment received, awaiting admin release." }],
			});
			await newOrder.save();
			if (couponCode) {
				await Coupon.findOneAndUpdate({ code: couponCode, userId }, { isActive: false });
			}
		}
		res.sendStatus(200);
	} catch (error) {
		console.error("Error in Paystack webhook:", error);
		res.status(500).send("Webhook error");
	}
};

// Admin releases escrow
export const releaseEscrow = async (req, res) => {
	try {
		const { orderId } = req.body;
		const order = await Order.findById(orderId);
		if (!order) return res.status(404).json({ message: "Order not found" });
		if (order.escrowStatus === "released") return res.status(400).json({ message: "Already released" });
		// Simulate payout to seller (Paystack transfer API can be used in production)
		order.escrowStatus = "released";
		order.transactionLog.push({ status: "released", message: "Escrow released to seller by admin." });
		await order.save();
		res.json({ message: "Escrow released to seller." });
	} catch (error) {
		console.error("Error releasing escrow:", error);
		res.status(500).json({ message: "Error releasing escrow", error: error.message });
	}
};

// ... (remove all Stripe/coupon helper functions)
