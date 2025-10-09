import axios from "axios";
import crypto from "crypto";

if (!process.env.PAYSTACK_SECRET_KEY) {
	console.warn("⚠️ PAYSTACK_SECRET_KEY not found in environment variables");
	console.warn("Please set PAYSTACK_SECRET_KEY in your environment or .env file");
	console.warn("For testing, you can use: sk_test_your_paystack_secret_key_here");
	console.warn("For production, you can use: sk_live_your_paystack_secret_key_here");
} else {
	console.log("✅ PAYSTACK_SECRET_KEY found:", process.env.PAYSTACK_SECRET_KEY.substring(0, 10) + "...");
}

export const paystackApi = axios.create({
	baseURL: "https://api.paystack.co",
	headers: {
		Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
		"Content-Type": "application/json",
	},
});

export function verifyPaystackSignature(req) {
	if (!process.env.PAYSTACK_SECRET_KEY) {
		console.error("⚠️ Cannot verify webhook signature: PAYSTACK_SECRET_KEY not found");
		return false;
	}
	
	const signature = req.headers["x-paystack-signature"];
	if (!signature) {
		console.error("⚠️ No Paystack signature found in headers");
		return false;
	}
	
	const body = req.body;
	if (!Buffer.isBuffer(body)) {
		console.error("⚠️ Webhook body is not a buffer");
		return false;
	}
	
	const hash = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
		.update(body)
		.digest("hex");
	
	const isValid = hash === signature;
	console.log("Webhook signature verification:", { isValid, provided: signature.substring(0, 10) + "...", calculated: hash.substring(0, 10) + "..." });
	
	return isValid;
}