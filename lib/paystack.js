import axios from "axios";

export const paystackApi = axios.create({
	baseURL: "https://api.paystack.co",
	headers: {
		Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
		"Content-Type": "application/json",
	},
});

// Helper to verify Paystack webhook signature
export function verifyPaystackSignature(req) {
	const crypto = require("crypto");
	const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
		.update(JSON.stringify(req.body))
		.digest("hex");
	return hash === req.headers["x-paystack-signature"];
} 