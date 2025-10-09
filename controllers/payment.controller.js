import Coupon from "../models/coupon.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import EscrowTransaction from "../models/escrowTransaction.model.js";
import Notification from "../models/notification.model.js";
import { paystackApi, verifyPaystackSignature } from "../lib/paystack.js";
import { sendPaymentReceivedNotification, sendPaymentReleasedNotification } from "../lib/email.js";


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
		const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
		const successUrl = `${frontendBase}/purchase-success`;
		const cancelUrl = `${frontendBase}/purchase-cancel`;
		
		const webhookUrl = process.env.PAYSTACK_CALLBACK_URL || `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payments/paystack-webhook`;
		
		const paystackRes = await paystackApi.post("/transaction/initialize", {
			email: buyer.email,
			amount: totalAmount * 100,
			callback_url: successUrl,
			metadata: {
				userId: buyer._id.toString(),
				products: products.map((p) => ({ id: p._id, quantity: p.quantity, price: p.price })),
				couponCode: couponCode || "",
				webhook_url: webhookUrl,
				frontend_cancel_url: cancelUrl,
			},
		});
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

// MOCK PAYMENT ENDPOINTS
export const mockCheckout = async (req, res) => {
	try {
		const { products, couponCode } = req.body;
		const buyer = req.user;
		
		console.log("Mock checkout request received:");
		console.log("Products:", products);
		console.log("Buyer:", buyer?.email);
		
		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({ error: "Invalid or empty products array" });
		}
		
		// Validate product structure
		for (const product of products) {
			if (!product._id) {
				return res.status(400).json({ error: "Product missing _id field" });
			}
			if (!product.quantity || product.quantity <= 0) {
				return res.status(400).json({ error: "Invalid product quantity" });
			}
			if (!product.price || product.price <= 0) {
				return res.status(400).json({ error: "Invalid product price" });
			}
		}
		
		// Calculate total amount
		let totalAmount = 0;
		products.forEach((product) => {
			totalAmount += product.price * product.quantity;
		});
		
		// Apply coupon if provided
		let coupon = null;
		if (couponCode) {
			if (couponCode.trim().toUpperCase() === "BIGSAMOFAFRICA") {
				coupon = { code: "BIGSAMOFAFRICA", discountPercentage: 20 };
				totalAmount -= Math.round(totalAmount * 0.2);
			} else {
				coupon = await Coupon.findOne({ code: couponCode, userId: buyer._id, isActive: true });
				if (coupon) {
					totalAmount -= Math.round((totalAmount * coupon.discountPercentage) / 100);
				}
			}
		}
		
		// Generate mock transaction reference
		const mockReference = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		// Get the first product to determine seller (for initial order creation)
		const firstProduct = await Product.findById(products[0]._id).populate('sellerId', 'name email');
		if (!firstProduct) {
			return res.status(400).json({ error: "Product not found" });
		}
		
		const sellerId = firstProduct.sellerId;
		if (!sellerId) {
			return res.status(400).json({ error: "Seller not found for product" });
		}
		
		// Create order with "Pending Payment" status
		const newOrder = new Order({
			user: buyer._id,
			products: products.map((product) => ({
				product: product._id,
				quantity: product.quantity,
				price: product.price,
			})),
			totalAmount: totalAmount,
			paystackReference: mockReference,
			paystackTransactionId: `MOCK_TX_${mockReference}`,
			seller: sellerId._id,
			status: "Pending",
			escrowStatus: "pending",
			buyerConfirmation: "pending",
			transactionLog: [{ 
				status: "pending_payment", 
				message: "Order created, awaiting payment confirmation." 
			}],
		});
		await newOrder.save();
		
		console.log(`Order created with Pending Payment status: ${mockReference}, Amount: ₦${totalAmount}`);
		
		res.status(200).json({
			success: true,
			reference: mockReference,
			totalAmount,
			redirectUrl: `/purchase-success?reference=${mockReference}`
		});
		
	} catch (error) {
		console.error("Error in mock checkout:", error);
		console.error("Error details:", {
			message: error.message,
			stack: error.stack,
			products: req.body.products,
			buyer: req.user?._id
		});
		res.status(500).json({ 
			message: "Error processing mock checkout", 
			error: error.message,
			details: "Check server logs for more information"
		});
	}
};

export const mockConfirmPayment = async (req, res) => {
	try {
		const { reference } = req.params;
		const buyer = req.user;
		
		console.log("Mock confirm payment request received:");
		console.log("Reference:", reference);
		console.log("Buyer:", buyer?.email);
		console.log("Body:", req.body);
		
		if (!reference) {
			return res.status(400).json({ error: "Transaction reference is required" });
		}
		
		// For mock payment, we'll simulate a successful payment
		// In a real implementation, you'd retrieve the transaction details from your mock storage
		// For now, we'll create the order and escrow records directly
		
		// Get products from request body or from stored transaction data
		const { products, totalAmount, couponCode } = req.body;
		
		if (!products || !Array.isArray(products) || products.length === 0) {
			return res.status(400).json({ error: "Products are required for mock payment" });
		}
		
		// Calculate amounts
		let calculatedTotal = 0;
		products.forEach((product) => {
			calculatedTotal += product.price * product.quantity;
		});
		
		// Apply coupon if provided
		if (couponCode && couponCode.trim().toUpperCase() === "BIGSAMOFAFRICA") {
			calculatedTotal -= Math.round(calculatedTotal * 0.2);
		}
		
		const finalAmount = totalAmount || calculatedTotal;
		const adminShare = Math.round(finalAmount * 0.15);
		const sellerShare = finalAmount - adminShare;
		
		// Get the first product to determine seller
		const firstProduct = await Product.findById(products[0]._id).populate('sellerId', 'name email');
		if (!firstProduct) {
			return res.status(400).json({ error: "Product not found" });
		}
		
		const sellerId = firstProduct.sellerId;
		if (!sellerId) {
			return res.status(400).json({ error: "Seller not found for product" });
		}
		
		// Update existing order status to "Paid"
		const existingOrder = await Order.findOne({ paystackReference: reference });
		if (existingOrder) {
			existingOrder.status = "Pending";
			existingOrder.escrowStatus = "pending";
			existingOrder.seller = sellerId._id;
			existingOrder.transactionLog.push({
				status: "paid",
				message: "Payment confirmed, funds held in escrow awaiting buyer confirmation."
			});
			await existingOrder.save();
			console.log(`Order updated to Pending status: ${reference}`);
		} else {
			// Create new order if not found (fallback)
			const newOrder = new Order({
				user: buyer._id,
				products: products.map((product) => ({
					product: product._id,
					quantity: product.quantity,
					price: product.price,
				})),
				totalAmount: finalAmount,
				paystackReference: reference,
				paystackTransactionId: `MOCK_TX_${reference}`,
				seller: sellerId._id,
				escrowStatus: "pending",
				status: "Pending",
				buyerConfirmation: "pending",
				transactionLog: [{ 
					status: "paid", 
					message: "Mock payment received, funds held in escrow awaiting buyer confirmation." 
				}],
			});
			await newOrder.save();
			console.log(`New order created with Pending status: ${reference}`);
		}
		
		// Create EscrowTransaction
		const escrowTransaction = new EscrowTransaction({
			paystackReference: reference,
			paystackTransactionId: `MOCK_TX_${reference}`,
			buyerId: buyer._id,
			sellerId: sellerId._id,
			productId: products[0]._id,
			totalAmount: finalAmount,
			adminShare: adminShare,
			sellerShare: sellerShare,
			status: "pending",
			paystackVerified: true,
			paidAt: new Date(),
			buyerConfirmation: "pending",
			transactionLog: [{
				status: "pending",
				message: "Mock payment received and verified, funds held in escrow. Awaiting buyer confirmation.",
				timestamp: new Date()
			}]
		});
		await escrowTransaction.save();
		
		// Update seller pending earnings
		await User.findByIdAndUpdate(sellerId._id, {
			$inc: { pendingEarnings: sellerShare }
		});
		
		// Update product status
		await Product.findByIdAndUpdate(products[0].id, {
			status: "sold",
			buyerId: buyer._id
		});
		
		// Deactivate coupon if used
		if (couponCode) {
			await Coupon.findOneAndUpdate({ code: couponCode, userId: buyer._id }, { isActive: false });
		}
		
		console.log(`Mock payment completed: ${reference}, Amount: ₦${finalAmount}, Admin: ₦${adminShare}, Seller: ₦${sellerShare}`);
		
		res.json({
			success: true,
			message: "Mock payment confirmed successfully",
			reference: reference,
			totalAmount: finalAmount,
			orderId: newOrder._id,
			escrowId: escrowTransaction._id
		});
		
	} catch (error) {
		console.error("Error in mock confirm payment:", error);
		console.error("Error details:", {
			message: error.message,
			stack: error.stack,
			reference: req.params.reference,
			buyer: req.user?._id,
			body: req.body
		});
		res.status(500).json({ 
			message: "Error confirming mock payment", 
			error: error.message,
			details: "Check server logs for more information"
		});
	}
};

export const mockVerifyPayment = async (req, res) => {
	try {
		const { reference } = req.params;
		const userId = req.user._id;
		
		if (!reference) {
			return res.status(400).json({ error: "Transaction reference is required" });
		}
		
		// First try EscrowTransaction
		const escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference })
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
			
		if (escrowTransaction) {
			// Validate that we have all required data
			if (!escrowTransaction.productId?.name) {
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing product information",
					reference: reference
				});
			}
			
			if (!escrowTransaction.buyerId?.name) {
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing buyer information",
					reference: reference
				});
			}
			
			if (!escrowTransaction.sellerId?.name) {
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing seller information",
					reference: reference
				});
			}
			
			return res.json({
				success: true,
				paystackReference: escrowTransaction.paystackReference,
				productName: escrowTransaction.productId.name,
				totalAmount: escrowTransaction.totalAmount,
				adminShare: escrowTransaction.adminShare,
				sellerShare: escrowTransaction.sellerShare,
				status: escrowTransaction.status,
				paidAt: escrowTransaction.paidAt,
				buyerName: escrowTransaction.buyerId.name,
				sellerName: escrowTransaction.sellerId.name,
				buyerConfirmation: escrowTransaction.buyerConfirmation,
				buyerConfirmedAt: escrowTransaction.buyerConfirmedAt,
				buyerConfirmationNote: escrowTransaction.buyerConfirmationNote
			});
		}
		
		// Then try Order collection
		const order = await Order.findOne({ 
			paystackReference: reference
		}).populate('products.product');
		
		if (order) {
			// Get the populated order with all details
			const populatedOrder = await Order.findById(order._id)
				.populate('products.product', 'name price')
				.populate('user', 'name email')
				.populate('seller', 'name email');
			
			// Validate that we have all required data
			if (!populatedOrder.products[0]?.product?.name) {
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing product information",
					reference: reference
				});
			}
			
			if (!populatedOrder.user?.name) {
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing buyer information",
					reference: reference
				});
			}
			
			if (!populatedOrder.seller?.name) {
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing seller information",
					reference: reference
				});
			}
			
			return res.json({
				success: true,
				paystackReference: populatedOrder.paystackReference,
				productName: populatedOrder.products[0].product.name,
				totalAmount: populatedOrder.totalAmount,
				paidAt: populatedOrder.createdAt,
				status: populatedOrder.status,
				escrowStatus: populatedOrder.escrowStatus,
				buyerName: populatedOrder.user.name,
				sellerName: populatedOrder.seller.name,
				confirmationCode: populatedOrder.confirmationCode,
				confirmationCodeExpiry: populatedOrder.confirmationCodeExpiry,
				isConfirmed: populatedOrder.isConfirmed || false,
				buyerConfirmation: populatedOrder.buyerConfirmation,
				buyerConfirmedAt: populatedOrder.buyerConfirmedAt,
				buyerConfirmationNote: populatedOrder.buyerConfirmationNote
			});
		}
		
		// If no order found anywhere, return error
		return res.status(404).json({
			success: false,
			message: "Order not found",
			reference: reference,
			details: "This transaction reference was not found in our database. Please check the reference or contact support if you were charged."
		});
		
	} catch (error) {
		console.error("Error in mock verify payment:", error);
		res.status(500).json({ 
			message: "Error verifying mock payment", 
			error: error.message,
			details: "Please check your dashboard for order status or contact support if you were charged."
		});
	}
};

// DISABLED - PAYSTACK WEBHOOK (Simplified flow)
// export const paystackWebhook = async (req, res) => {
//	try {
//		console.log("🔔 Paystack Webhook Received");
//		res.sendStatus(200);
//	} catch (error) {
//		console.error("Error in Paystack webhook:", error);
//		res.status(500).send("Webhook error");
//	}
// };

export const verifyAndProcessPayment = async (req, res) => {
	try {
		const { reference } = req.params;
		const userId = req.user?._id;
		
		if (!userId) {
			console.error("No user ID found in request");
			return res.status(401).json({ message: "User not authenticated" });
		}
		
		if (!reference) {
			return res.status(400).json({ error: "Transaction reference is required" });
		}
		
		let escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference })
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
		
		if (escrowTransaction) {
			return res.json({
				success: true,
				paystackReference: escrowTransaction.paystackReference,
				productName: escrowTransaction.productId.name,
				totalAmount: escrowTransaction.totalAmount,
				adminShare: escrowTransaction.adminShare,
				sellerShare: escrowTransaction.sellerShare,
				status: escrowTransaction.status,
				paidAt: escrowTransaction.paidAt,
				buyerName: escrowTransaction.buyerId.name,
				sellerName: escrowTransaction.sellerId.name,
				confirmationCode: escrowTransaction.confirmationCode,
				confirmationCodeExpiry: escrowTransaction.confirmationCodeExpiry,
				isConfirmed: escrowTransaction.isConfirmed
			});
		}
		
		let verificationResponse;
		try {
			console.log(`🔍 Attempting to verify transaction with Paystack: ${reference}`);
			verificationResponse = await paystackApi.get(`/transaction/verify/${reference}`);
			console.log("✅ Paystack verification response:", verificationResponse.data);
		} catch (apiError) {
			console.error("❌ Paystack API error details:", {
				status: apiError.response?.status,
				data: apiError.response?.data,
				message: apiError.message,
				reference: reference
			});
			
			// If Paystack API fails, try to find the transaction in our database
			console.log("🔍 Paystack API failed, checking database for transaction:", reference);
			const existingOrder = await Order.findOne({ paystackReference: reference });
			
			if (existingOrder) {
				console.log("✅ Found existing order in database:", existingOrder._id);
				
				// Populate the order with product details
				const populatedOrder = await Order.findById(existingOrder._id)
					.populate('products.product', 'name price')
					.populate('user', 'name email')
					.populate('seller', 'name email');
				
				// Validate that we have all required data
				if (!populatedOrder.products[0]?.product?.name) {
					console.error("❌ Order missing product name:", populatedOrder._id);
					return res.status(500).json({
						success: false,
						message: "Order data incomplete - missing product information",
						reference: reference
					});
				}
				
				if (!populatedOrder.user?.name) {
					console.error("❌ Order missing buyer name:", populatedOrder._id);
					return res.status(500).json({
						success: false,
						message: "Order data incomplete - missing buyer information",
						reference: reference
					});
				}
				
				if (!populatedOrder.seller?.name) {
					console.error("❌ Order missing seller name:", populatedOrder._id);
					return res.status(500).json({
						success: false,
						message: "Order data incomplete - missing seller information",
						reference: reference
					});
				}
				
				return res.json({
					success: true,
					paystackReference: populatedOrder.paystackReference,
					productName: populatedOrder.products[0].product.name,
					totalAmount: populatedOrder.totalAmount,
					status: populatedOrder.status || "Pending",
					paidAt: populatedOrder.createdAt,
					buyerName: populatedOrder.user.name,
					sellerName: populatedOrder.seller.name,
					confirmationCode: populatedOrder.confirmationCode,
					confirmationCodeExpiry: populatedOrder.confirmationCodeExpiry,
					isConfirmed: populatedOrder.isConfirmed || false
				});
			}
			
			if (apiError.response?.status === 404) {
				return res.status(404).json({ 
					message: "Transaction not found",
					error: "Transaction reference not found in Paystack or database",
					details: "The transaction reference does not exist in our records"
				});
			} else if (apiError.response?.status === 401) {
				return res.status(500).json({ 
					message: "Paystack authentication failed",
					error: "Invalid Paystack secret key",
					details: "Please check your Paystack secret key configuration"
				});
			} else {
				return res.status(500).json({ 
					message: "Failed to verify payment with Paystack",
					error: "Payment verification service unavailable",
					details: apiError.response?.data?.message || apiError.message
				});
			}
		}
		
		if (verificationResponse.data.status !== true) {
			console.error("Paystack verification failed:", verificationResponse.data);
			return res.status(400).json({ 
				message: "Transaction verification failed",
				verified: false 
			});
		}
		
		const verifiedData = verificationResponse.data.data;
		
		if (verifiedData.status !== "success") {
			console.error("Transaction not successful, status:", verifiedData.status);
			return res.status(400).json({ 
				message: "Transaction not successful",
				verified: false,
				status: verifiedData.status,
				details: `Transaction status is ${verifiedData.status}, expected 'success'`
			});
		}
		
		console.log("Paystack verification successful:", {
			reference: verifiedData.reference,
			status: verifiedData.status,
			amount: verifiedData.amount,
			currency: verifiedData.currency
		});
		
		escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference })
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
		
		if (escrowTransaction) {
			return res.json({
				success: true,
				paystackReference: escrowTransaction.paystackReference,
				productName: escrowTransaction.productId.name,
				totalAmount: escrowTransaction.totalAmount,
				adminShare: escrowTransaction.adminShare,
				sellerShare: escrowTransaction.sellerShare,
				status: escrowTransaction.status,
				paidAt: escrowTransaction.paidAt,
				buyerName: escrowTransaction.buyerId.name,
				sellerName: escrowTransaction.sellerId.name,
				confirmationCode: escrowTransaction.confirmationCode,
				confirmationCodeExpiry: escrowTransaction.confirmationCodeExpiry,
				isConfirmed: escrowTransaction.isConfirmed
			});
		}
		
		const totalAmount = verifiedData.amount / 100;
		
		const metadata = verifiedData.metadata || {};
		let { userId: metadataUserId, products, couponCode } = metadata;
		
		console.log("Verification metadata:", { 
			metadata, 
			metadataUserId, 
			products, 
			couponCode,
			hasMetadata: !!metadata,
			metadataKeys: Object.keys(metadata)
		});
		
		if (metadataUserId && metadataUserId !== userId.toString()) {
			console.error("User mismatch:", { metadataUserId, currentUserId: userId.toString() });
			return res.status(403).json({ message: "Transaction does not belong to this user" });
		}
		
		if (!products || !Array.isArray(products) || products.length === 0) {
			console.error("Invalid products in metadata:", { products, type: typeof products, isArray: Array.isArray(products) });
			
			console.log("Attempting to find recent orders for user:", userId);
			const recentOrder = await Order.findOne({ 
				user: userId, 
				paystackReference: reference 
			}).populate('products.product');
			
			if (recentOrder && recentOrder.products.length > 0) {
				console.log("Found fallback order data:", recentOrder.products);
				products = recentOrder.products.map(item => ({
					id: item.product._id,
					quantity: item.quantity,
					price: item.price
				}));
			} else {
				console.error("No products found in metadata or fallback order");
				return res.status(400).json({ 
					message: "Invalid product data in transaction",
					details: "Products array is missing or empty in transaction metadata and no fallback order found",
					reference: reference,
					metadata: metadata
				});
			}
		}
		
		const adminShare = Math.round(totalAmount * 0.15);
		const sellerShare = totalAmount - adminShare;
		
		if (!products || products.length === 0) {
			console.error("Products array is empty or undefined");
			return res.status(400).json({ message: "No products found in transaction" });
		}
		
		const productId = products[0]?.id;
		if (!productId) {
			console.error("No product ID in metadata:", products[0]);
			return res.status(400).json({ message: "Product ID not found in transaction" });
		}
		
		const firstProduct = await Product.findById(productId).populate('sellerId', 'name email');
		if (!firstProduct) {
			console.error("Product not found for ID:", productId);
			return res.status(400).json({ message: "Product not found" });
		}
		
		const sellerId = firstProduct.sellerId._id || firstProduct.sellerId;
		if (!sellerId) {
			console.error("No seller found for product:", firstProduct);
			return res.status(400).json({ 
				message: "Seller not found for product",
				details: "The product does not have an associated seller"
			});
		}
		
		console.log("Found seller for product:", { 
			productId: firstProduct._id, 
			productName: firstProduct.name, 
			sellerId: sellerId 
		});
		
		if (typeof sellerId === 'string' && sellerId.length !== 24) {
			console.error("Invalid sellerId format:", sellerId);
			return res.status(400).json({ message: "Invalid seller ID format" });
		}
		
		console.log("Found seller ID:", sellerId);
		
		const confirmationCode = generateConfirmationCode();
		
		console.log("Creating escrow transaction with data:", {
			paystackReference: reference,
			paystackTransactionId: verifiedData.id,
			buyerId: userId,
			sellerId: sellerId,
			productId: products[0].id,
			totalAmount: totalAmount,
			adminShare: adminShare,
			sellerShare: sellerShare,
			confirmationCode: confirmationCode
		});
		
		escrowTransaction = new EscrowTransaction({
			paystackReference: reference,
			paystackTransactionId: verifiedData.id,
			buyerId: userId,
			sellerId: sellerId,
			productId: products[0].id,
			totalAmount: totalAmount,
			adminShare: adminShare,
			sellerShare: sellerShare,
			status: "pending",
			paystackVerified: true,
			paidAt: new Date(verifiedData.paid_at),
			confirmationCode: confirmationCode,
			confirmationCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
			transactionLog: [{
				status: "pending",
				message: "Payment received and verified, funds held in escrow. Confirmation code generated.",
				timestamp: new Date(),
				adminId: null
			}]
		});
		
		try {
			await escrowTransaction.save();
			console.log("Escrow transaction saved successfully:", escrowTransaction._id);
		} catch (saveError) {
			console.error("Error saving escrow transaction:", saveError);
			throw saveError;
		}
		
		try {
			await User.findByIdAndUpdate(sellerId, {
				$inc: { pendingEarnings: sellerShare }
			});
			console.log("Updated seller pending earnings successfully");
		} catch (userUpdateError) {
			console.error("Error updating seller pending earnings:", userUpdateError);
		}
		
		try {
			const seller = await User.findById(sellerId).select("name email");
			const buyer = await User.findById(userId).select("name");
			
			await Notification.create({
				user: sellerId,
				type: "order_placed",
				message: `New order received for ${firstProduct.name}. Confirmation code: ${confirmationCode}`,
				meta: {
					orderId: escrowTransaction._id,
					productName: firstProduct.name,
					buyerName: buyer.name,
					totalAmount: totalAmount,
					confirmationCode: confirmationCode
				}
			});
			
			await Notification.create({
				user: userId,
				type: "order_placed",
				message: `Payment successful! Your order for ${firstProduct.name} is being processed. Confirmation code: ${confirmationCode}`,
				meta: {
					orderId: escrowTransaction._id,
					productName: firstProduct.name,
					sellerName: seller.name,
					totalAmount: totalAmount,
					confirmationCode: confirmationCode
				}
			});
		} catch (notificationError) {
			console.error("Error creating notifications:", notificationError);
		}
		
		const newOrder = new Order({
			user: userId,
			products: products.map((product) => ({
				product: product.id,
				quantity: parseInt(product.quantity),
				price: parseFloat(product.price),
			})),
			totalAmount: totalAmount,
			paystackReference: reference,
			seller: sellerId,
			escrowStatus: "pending",
			status: "Pending",
			confirmationCode: confirmationCode,
			transactionLog: [{ 
				status: "pending", 
				message: "Payment received, funds held in escrow awaiting seller confirmation." 
			}],
		});
		
		try {
			await newOrder.save();
			console.log("Order saved successfully:", newOrder._id);
		} catch (orderSaveError) {
			console.error("Error saving order:", orderSaveError);
		}
		
		try {
			await Product.findByIdAndUpdate(products[0].id, {
				status: "sold",
				buyerId: userId
			});
			console.log("Product status updated to sold successfully");
		} catch (productUpdateError) {
			console.error("Error updating product status:", productUpdateError);
		}
		
		if (couponCode) {
			try {
				await Coupon.findOneAndUpdate({ code: couponCode, userId }, { isActive: false });
				console.log("Coupon deactivated successfully");
			} catch (couponError) {
				console.error("Error deactivating coupon:", couponError);
			}
		}
		
		try {
			await escrowTransaction.populate([
				{ path: 'buyerId', select: 'name email' },
				{ path: 'sellerId', select: 'name email' },
				{ path: 'productId', select: 'name price' }
			]);
			console.log("Escrow transaction populated successfully");
		} catch (populateError) {
			console.error("Error populating escrow transaction:", populateError);
		}
		
		console.log(`Escrow transaction created immediately: ${reference}, Amount: ₦${totalAmount}, Admin: ₦${adminShare}, Seller: ₦${sellerShare}`);
		
		// Get the populated data safely
		const populatedTransaction = await EscrowTransaction.findById(escrowTransaction._id)
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
		
		res.json({
			success: true,
			paystackReference: populatedTransaction.paystackReference,
			productName: populatedTransaction.productId?.name || firstProduct.name,
			totalAmount: populatedTransaction.totalAmount,
			adminShare: populatedTransaction.adminShare,
			sellerShare: populatedTransaction.sellerShare,
			status: populatedTransaction.status,
			paidAt: populatedTransaction.paidAt,
			buyerName: populatedTransaction.buyerId?.name || "Unknown",
			sellerName: populatedTransaction.sellerId?.name || "Unknown",
			confirmationCode: populatedTransaction.confirmationCode,
			confirmationCodeExpiry: populatedTransaction.confirmationCodeExpiry,
			isConfirmed: populatedTransaction.isConfirmed
		});
	} catch (error) {
		console.error("Error verifying and processing payment:", error);
		
		// Try to find any existing order as a last resort
		try {
			const { reference } = req.params;
			const existingOrder = await Order.findOne({ paystackReference: reference });
			
			if (existingOrder) {
				console.log("Found existing order as fallback:", existingOrder._id);
				return res.json({
					success: true,
					paystackReference: existingOrder.paystackReference,
					productName: "Product",
					totalAmount: existingOrder.totalAmount,
					status: existingOrder.status || "Pending",
					paidAt: existingOrder.createdAt,
					confirmationCode: existingOrder.confirmationCode,
					confirmationCodeExpiry: existingOrder.confirmationCodeExpiry,
					isConfirmed: existingOrder.isConfirmed || false,
					message: "Payment found in database. Processing may be delayed."
				});
			}
		} catch (fallbackError) {
			console.error("Fallback error:", fallbackError);
		}
		
		res.status(500).json({ 
			message: "Error verifying payment", 
			error: error.message,
			details: "Please check your dashboard for order status or contact support if you were charged."
		});
	}
};

export const getOrderDetailsForSuccess = async (req, res) => {
	try {
		const { reference } = req.params;
		const userId = req.user._id;
		
		console.log("🔍 getOrderDetailsForSuccess called:", { reference, userId });
		
		if (!reference) {
			return res.status(400).json({ error: "Transaction reference is required" });
		}
		
		// First try EscrowTransaction
		console.log("🔍 Searching EscrowTransaction collection...");
		const escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference })
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
			
		if (escrowTransaction) {
			console.log("✅ Found in EscrowTransaction:", {
				id: escrowTransaction._id,
				productName: escrowTransaction.productId?.name,
				totalAmount: escrowTransaction.totalAmount,
				status: escrowTransaction.status
			});
			
			// Validate that we have all required data
			if (!escrowTransaction.productId?.name) {
				console.error("❌ EscrowTransaction missing product name:", escrowTransaction._id);
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing product information",
					reference: reference
				});
			}
			
			if (!escrowTransaction.buyerId?.name) {
				console.error("❌ EscrowTransaction missing buyer name:", escrowTransaction._id);
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing buyer information",
					reference: reference
				});
			}
			
			if (!escrowTransaction.sellerId?.name) {
				console.error("❌ EscrowTransaction missing seller name:", escrowTransaction._id);
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing seller information",
					reference: reference
				});
			}
			
			return res.json({
				success: true,
				paystackReference: escrowTransaction.paystackReference,
				productName: escrowTransaction.productId.name,
				totalAmount: escrowTransaction.totalAmount,
				adminShare: escrowTransaction.adminShare,
				sellerShare: escrowTransaction.sellerShare,
				status: escrowTransaction.status,
				paidAt: escrowTransaction.paidAt,
				buyerName: escrowTransaction.buyerId.name,
				sellerName: escrowTransaction.sellerId.name,
				buyerConfirmation: escrowTransaction.buyerConfirmation,
				buyerConfirmedAt: escrowTransaction.buyerConfirmedAt,
				buyerConfirmationNote: escrowTransaction.buyerConfirmationNote
			});
		}
		
		// Then try Order collection
		console.log("🔍 Searching Order collection...");
		const order = await Order.findOne({ 
			paystackReference: reference
		}).populate('products.product');
		
		if (order) {
			console.log("✅ Found in Order:", {
				id: order._id,
				productName: order.products[0]?.product?.name,
				totalAmount: order.totalAmount,
				status: order.status
			});
			
			// Get the populated order with all details
			const populatedOrder = await Order.findById(order._id)
				.populate('products.product', 'name price')
				.populate('user', 'name email')
				.populate('seller', 'name email');
			
			// Validate that we have all required data
			if (!populatedOrder.products[0]?.product?.name) {
				console.error("❌ Order missing product name:", populatedOrder._id);
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing product information",
					reference: reference
				});
			}
			
			if (!populatedOrder.user?.name) {
				console.error("❌ Order missing buyer name:", populatedOrder._id);
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing buyer information",
					reference: reference
				});
			}
			
			if (!populatedOrder.seller?.name) {
				console.error("❌ Order missing seller name:", populatedOrder._id);
				return res.status(500).json({
					success: false,
					message: "Order data incomplete - missing seller information",
					reference: reference
				});
			}
			
			return res.json({
				success: true,
				paystackReference: populatedOrder.paystackReference,
				productName: populatedOrder.products[0].product.name,
				totalAmount: populatedOrder.totalAmount,
				paidAt: populatedOrder.createdAt,
				status: populatedOrder.status,
				escrowStatus: populatedOrder.escrowStatus,
				buyerName: populatedOrder.user.name,
				sellerName: populatedOrder.seller.name,
				confirmationCode: populatedOrder.confirmationCode,
				confirmationCodeExpiry: populatedOrder.confirmationCodeExpiry,
				isConfirmed: populatedOrder.isConfirmed || false,
				buyerConfirmation: populatedOrder.buyerConfirmation,
				buyerConfirmedAt: populatedOrder.buyerConfirmedAt,
				buyerConfirmationNote: populatedOrder.buyerConfirmationNote
			});
		}
		
		// If still not found, try to find any order with similar reference
		console.log("🔍 Searching for similar references...");
		const similarEscrow = await EscrowTransaction.findOne({ 
			paystackReference: { $regex: reference.substring(0, 5), $options: 'i' } 
		});
		
		const similarOrder = await Order.findOne({ 
			paystackReference: { $regex: reference.substring(0, 5), $options: 'i' } 
		});
		
		if (similarEscrow || similarOrder) {
			console.log("🔍 Found similar reference, but not exact match");
			console.log("Similar EscrowTransaction:", similarEscrow?.paystackReference);
			console.log("Similar Order:", similarOrder?.paystackReference);
		}
		
		// Log recent transactions for debugging
		console.log("🔍 Recent transactions for debugging:");
		const recentEscrows = await EscrowTransaction.find().sort({ createdAt: -1 }).limit(5);
		const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);
		
		console.log("Recent EscrowTransactions:");
		recentEscrows.forEach(et => console.log(`  ${et.paystackReference} - ${et.totalAmount}`));
		console.log("Recent Orders:");
		recentOrders.forEach(o => console.log(`  ${o.paystackReference} - ${o.totalAmount}`));
		
		// If no order found anywhere, return error instead of fake data
		console.log("❌ No order found for reference:", reference, "for user:", userId);
		return res.status(404).json({
			success: false,
			message: "Order not found",
			reference: reference,
			details: "This transaction reference was not found in our database. Please check the reference or contact support if you were charged."
		});
		
	} catch (error) {
		console.error("Error fetching order details:", error);
		res.status(500).json({ message: "Error fetching order details", error: error.message });
	}
};

export const releaseEscrow = async (req, res) => {
	try {
		const { escrowTransactionId } = req.body;
		const adminId = req.user._id;
		
		const escrowTransaction = await EscrowTransaction.findById(escrowTransactionId)
			.populate('sellerId', 'email')
			.populate('buyerId', 'name email')
			.populate('productId', 'name');
			
		if (!escrowTransaction) {
			return res.status(404).json({ message: "Escrow transaction not found" });
		}
		
		if (escrowTransaction.status !== "pending" && escrowTransaction.status !== "completed") {
			return res.status(400).json({ message: "Transaction already processed" });
		}
		
		const sellerEmail = escrowTransaction.sellerId.email;
		if (!sellerEmail) {
			return res.status(400).json({ message: "Seller email not found" });
		}
		
		// Try Paystack transfer first, but fallback to manual processing if not available
		let transferResponse;
		let transferSuccess = false;
		
		try {
			transferResponse = await paystackApi.post('/transfer', {
				source: 'balance',
				amount: escrowTransaction.sellerShare * 100,
				recipient: sellerEmail,
				reason: `Escrow release for product: ${escrowTransaction.productId.name}`,
				reference: `ESCROW_${escrowTransaction.paystackReference}_${Date.now()}`
			});
			
			if (transferResponse.data.status === true) {
				transferSuccess = true;
				console.log("Paystack transfer successful:", transferResponse.data.data.reference);
			} else {
				console.log("Paystack transfer failed:", transferResponse.data.message);
			}
		} catch (transferError) {
			console.log("Paystack transfer error (account may not support transfers):", transferError.response?.data?.message || transferError.message);
			transferSuccess = false;
		}
		
		// If Paystack transfer failed, use manual processing
		if (!transferSuccess) {
			console.log("Using manual escrow processing (Paystack transfers not available)");
			transferResponse = {
				data: {
					data: {
						reference: `MANUAL_${escrowTransaction.paystackReference}_${Date.now()}`
					}
				}
			};
			
			// Log manual processing requirement for admin
			console.log(`⚠️ MANUAL ESCROW RELEASE REQUIRED:`);
			console.log(`   Transaction: ${escrowTransaction.paystackReference}`);
			console.log(`   Seller: ${escrowTransaction.sellerId.name} (${sellerEmail})`);
			console.log(`   Amount: ₦${escrowTransaction.sellerShare}`);
			console.log(`   Product: ${escrowTransaction.productId.name}`);
			console.log(`   Admin should manually transfer ₦${escrowTransaction.sellerShare} to seller`);
		}
		
		escrowTransaction.status = "released";
		escrowTransaction.releasedAt = new Date();
		escrowTransaction.sellerPayoutReference = transferResponse.data.data.reference;
		escrowTransaction.transactionLog.push({
			status: "released",
			message: `Escrow released to seller by admin. Transfer reference: ${transferResponse.data.data.reference}`,
			adminId: adminId,
			timestamp: new Date()
		});
		
		await escrowTransaction.save();
		
		await User.findByIdAndUpdate(escrowTransaction.sellerId._id, {
			$inc: { 
				totalEarnings: escrowTransaction.sellerShare,
				pendingEarnings: -escrowTransaction.sellerShare
			}
		});
		
		try {
			await sendPaymentReleasedNotification(
				escrowTransaction.sellerId.email,
				escrowTransaction.sellerId.name,
				escrowTransaction.buyerId.name,
				escrowTransaction.productId.name,
				escrowTransaction.totalAmount,
				escrowTransaction.sellerShare
			);
			console.log(`Payment release notification sent to seller: ${escrowTransaction.sellerId.email}`);
		} catch (emailError) {
			console.error("Error sending release notification:", emailError);
		}
		
		await Order.findOneAndUpdate(
			{ paystackReference: escrowTransaction.paystackReference },
			{ 
				escrowStatus: "released",
				transactionLog: [{ 
					status: "released", 
					message: "Escrow released to seller by admin." 
				}]
			}
		);
		
		console.log(`Escrow released: ${escrowTransaction.paystackReference}, Seller received: ₦${escrowTransaction.sellerShare}, Admin kept: ₦${escrowTransaction.adminShare}`);
		
		const message = transferSuccess 
			? "Escrow released to seller successfully via Paystack transfer"
			: "Escrow released to seller successfully (manual processing - Paystack transfers not available)";
		
		res.json({ 
			message: message,
			transferReference: `MOCK_${Date.now()}`,
			sellerShare: escrowTransaction.sellerShare,
			adminShare: escrowTransaction.adminShare,
			transferMethod: "mock"
		});
	} catch (error) {
		console.error("Error releasing escrow:", error);
		res.status(500).json({ message: "Error releasing escrow", error: error.message });
	}
};

export const getAllEscrowTransactions = async (req, res) => {
	try {
		const transactions = await EscrowTransaction.find()
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price')
			.sort({ createdAt: -1 });
			
		res.json({ transactions });
	} catch (error) {
		console.error("Error fetching escrow transactions:", error);
		res.status(500).json({ message: "Error fetching transactions", error: error.message });
	}
};

export const testPaystackConnection = async (req, res) => {
	try {
		console.log("Testing Paystack API connection...");
		console.log("Secret key available:", !!process.env.PAYSTACK_SECRET_KEY);
		console.log("Secret key starts with:", process.env.PAYSTACK_SECRET_KEY?.substring(0, 10));
		
		const testResponse = await paystackApi.get('/bank');
		
		console.log("Paystack API test successful:", testResponse.status);
		
		res.json({
			success: true,
			message: "Paystack API connection successful",
			status: testResponse.status,
			hasSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
			secretKeyPrefix: process.env.PAYSTACK_SECRET_KEY?.substring(0, 10)
		});
	} catch (error) {
		console.error("Paystack API test failed:", {
			status: error.response?.status,
			data: error.response?.data,
			message: error.message
		});
		res.status(500).json({
			success: false,
			message: "Paystack API connection failed",
			error: error.response?.data || error.message,
			hasSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
			secretKeyPrefix: process.env.PAYSTACK_SECRET_KEY?.substring(0, 10)
		});
	}
};

export const checkTransactionStatus = async (req, res) => {
	try {
		const { reference } = req.params;
		const userId = req.user._id;
		
		console.log(`Checking transaction status for reference: ${reference}, user: ${userId}`);
		
		// Check EscrowTransaction
		const escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference })
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
		
		if (escrowTransaction) {
			console.log("Found escrow transaction:", escrowTransaction._id);
			return res.json({
				success: true,
				found: true,
				type: "escrow",
				transaction: {
					id: escrowTransaction._id,
					reference: escrowTransaction.paystackReference,
					status: escrowTransaction.status,
					totalAmount: escrowTransaction.totalAmount,
					productName: escrowTransaction.productId?.name,
					sellerName: escrowTransaction.sellerId?.name,
					createdAt: escrowTransaction.createdAt,
					confirmationCode: escrowTransaction.confirmationCode
				}
			});
		}
		
		// Check Order
		const order = await Order.findOne({ paystackReference: reference })
			.populate('user', 'name email')
			.populate('seller', 'name email')
			.populate('products.product', 'name price');
		
		if (order) {
			console.log("Found order:", order._id);
			return res.json({
				success: true,
				found: true,
				type: "order",
				transaction: {
					id: order._id,
					reference: order.paystackReference,
					status: order.status,
					escrowStatus: order.escrowStatus,
					totalAmount: order.totalAmount,
					productName: order.products[0]?.product?.name,
					sellerName: order.seller?.name,
					createdAt: order.createdAt,
					confirmationCode: order.confirmationCode
				}
			});
		}
		
		// Try Paystack API
		try {
			const paystackResponse = await paystackApi.get(`/transaction/verify/${reference}`);
			console.log("Paystack response:", paystackResponse.data);
			
			return res.json({
				success: true,
				found: false,
				type: "paystack_only",
				paystackData: paystackResponse.data,
				message: "Transaction found in Paystack but not in database yet"
			});
		} catch (paystackError) {
			console.log("Paystack API error:", paystackError.response?.data);
			
			return res.json({
				success: true,
				found: false,
				type: "not_found",
				message: "Transaction not found in database or Paystack",
				paystackError: paystackError.response?.data || paystackError.message
			});
		}
		
	} catch (error) {
		console.error("Error checking transaction status:", error);
		res.status(500).json({
			success: false,
			message: "Error checking transaction status",
			error: error.message
		});
	}
};

export const getDatabaseStats = async (req, res) => {
	try {
		console.log("Getting database stats...");
		
		// Count all records
		const totalEscrowTransactions = await EscrowTransaction.countDocuments({});
		const totalOrders = await Order.countDocuments({});
		const totalUsers = await User.countDocuments({});
		const totalProducts = await Product.countDocuments({});
		
		// Get pending escrow transactions
		const pendingEscrowTransactions = await EscrowTransaction.find({
			status: "pending",
			isConfirmed: false
		}).populate('buyerId', 'name email').populate('sellerId', 'name email').populate('productId', 'name price');
		
		// Get all escrow transactions
		const allEscrowTransactions = await EscrowTransaction.find({})
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
		
		// Get all orders
		const allOrders = await Order.find({})
			.populate('user', 'name email')
			.populate('seller', 'name email')
			.populate('products.product', 'name price');
		
		return res.json({
			success: true,
			stats: {
				totalEscrowTransactions,
				totalOrders,
				totalUsers,
				totalProducts,
				pendingEscrowTransactions: pendingEscrowTransactions.length
			},
			pendingEscrowTransactions: pendingEscrowTransactions,
			allEscrowTransactions: allEscrowTransactions,
			allOrders: allOrders
		});
		
	} catch (error) {
		console.error("Error getting database stats:", error);
		res.status(500).json({
			success: false,
			message: "Error getting database stats",
			error: error.message
		});
	}
};

export const getAdminRevenue = async (req, res) => {
	try {
		const releasedTransactions = await EscrowTransaction.find({ status: "released" });
		const pendingTransactions = await EscrowTransaction.find({ 
			status: "pending",
			isConfirmed: false 
		});
		const completedTransactions = await EscrowTransaction.find({ 
			status: "completed",
			isConfirmed: true 
		});
		
		const totalAdminRevenue = releasedTransactions.reduce((sum, tx) => sum + tx.adminShare, 0);
		const pendingAdminRevenue = pendingTransactions.reduce((sum, tx) => sum + tx.adminShare, 0);
		const totalMarketplaceRevenue = releasedTransactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
		
		const totalOrders = await EscrowTransaction.countDocuments();
		
		res.json({
			totalAdminRevenue,
			pendingAdminRevenue,
			totalMarketplaceRevenue,
			totalCompletedOrders: releasedTransactions.length,
			totalPendingOrders: pendingTransactions.length,
			totalOrders: totalOrders,
			completedTransactions: releasedTransactions,
			pendingTransactions: pendingTransactions,
			awaitingConfirmation: completedTransactions.length
		});
	} catch (error) {
		console.error("Error fetching admin revenue:", error);
		res.status(500).json({ message: "Error fetching revenue data", error: error.message });
	}
};

export const getOrderDetails = async (req, res) => {
	try {
		const { reference } = req.params;
		
		// First try to find in EscrowTransaction
		let escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference })
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name price');
			
		if (escrowTransaction) {
			return res.json({
				paystackReference: escrowTransaction.paystackReference,
				productName: escrowTransaction.productId?.name || "Product",
				totalAmount: escrowTransaction.totalAmount,
				adminShare: escrowTransaction.adminShare,
				sellerShare: escrowTransaction.sellerShare,
				status: escrowTransaction.status,
				paidAt: escrowTransaction.paidAt,
				buyerName: escrowTransaction.buyerId?.name || "Unknown",
				sellerName: escrowTransaction.sellerId?.name || "Unknown",
				confirmationCode: escrowTransaction.confirmationCode,
				confirmationCodeExpiry: escrowTransaction.confirmationCodeExpiry,
				isConfirmed: escrowTransaction.isConfirmed
			});
		}
		
		// If not found in EscrowTransaction, try Order collection
		const order = await Order.findOne({ paystackReference: reference })
			.populate('products.product');
			
		if (order) {
			return res.json({
				paystackReference: order.paystackReference,
				productName: order.products[0]?.product?.name || "Product",
				totalAmount: order.totalAmount,
				status: order.status,
				paidAt: order.createdAt,
				confirmationCode: order.confirmationCode,
				confirmationCodeExpiry: order.confirmationCodeExpiry,
				isConfirmed: order.isConfirmed || false
			});
		}
		
		// If no order found anywhere, return a helpful response instead of 404
		console.log("No order found for reference:", reference);
		return res.json({
			success: true,
			paystackReference: reference,
			productName: "Product",
			totalAmount: 0,
			status: "Processing",
			message: "Payment is being processed. Please check your dashboard for updates."
		});
		
	} catch (error) {
		console.error("Error fetching order details:", error);
		res.status(500).json({ message: "Error fetching order details", error: error.message });
	}
};

export const verifyTransaction = async (req, res) => {
	try {
		const { reference } = req.params;
		
		const verificationResponse = await paystackApi.get(`/transaction/verify/${reference}`);
		
		if (verificationResponse.data.status !== true) {
			return res.status(400).json({ 
				message: "Transaction verification failed",
				verified: false 
			});
		}
		
		const verifiedData = verificationResponse.data.data;
		
		if (verifiedData.status !== "success") {
			return res.status(400).json({ 
				message: "Transaction not successful",
				verified: false,
				status: verifiedData.status
			});
		}
		
		const escrowTransaction = await EscrowTransaction.findOne({ paystackReference: reference });
		
		res.json({
			verified: true,
			status: verifiedData.status,
			amount: verifiedData.amount / 100,
			currency: verifiedData.currency,
			paidAt: verifiedData.paid_at,
			reference: verifiedData.reference,
			inDatabase: !!escrowTransaction,
			escrowStatus: escrowTransaction?.status || 'not_found'
		});
	} catch (error) {
		console.error("Error verifying transaction:", error);
		res.status(500).json({ message: "Error verifying transaction", error: error.message });
	}
};

export const validateConfirmationCode = async (req, res) => {
	try {
		const { confirmationCode, escrowTransactionId } = req.body;
		const sellerId = req.user._id;
		
		const escrowTransaction = await EscrowTransaction.findById(escrowTransactionId)
			.populate('buyerId', 'name email')
			.populate('sellerId', 'name email')
			.populate('productId', 'name');
			
		if (!escrowTransaction) {
			return res.status(404).json({ message: "Transaction not found" });
		}
		
		if (String(escrowTransaction.sellerId._id) !== String(sellerId)) {
			return res.status(403).json({ message: "Unauthorized to confirm this order" });
		}
		
		if (escrowTransaction.isConfirmed) {
			return res.status(400).json({ message: "Order already confirmed" });
		}
		
		if (new Date() > escrowTransaction.confirmationCodeExpiry) {
			return res.status(400).json({ message: "Confirmation code has expired" });
		}
		
		if (escrowTransaction.confirmationCode !== confirmationCode) {
			return res.status(400).json({ message: "Invalid confirmation code" });
		}
		
		escrowTransaction.isConfirmed = true;
		escrowTransaction.confirmedAt = new Date();
		escrowTransaction.confirmedBy = sellerId;
		escrowTransaction.status = "completed";
		escrowTransaction.transactionLog.push({
			status: "completed",
			message: `Order confirmed by seller with code: ${confirmationCode}. Awaiting admin approval for escrow release.`,
			timestamp: new Date()
		});
		
		await escrowTransaction.save();
		
		// Update admin revenue when order is confirmed
		try {
			await User.findOneAndUpdate(
				{ role: "admin" },
				{ $inc: { adminRevenue: escrowTransaction.adminShare } },
				{ upsert: false }
			);
			console.log(`Admin revenue updated: +₦${escrowTransaction.adminShare}`);
		} catch (adminUpdateError) {
			console.error("Error updating admin revenue:", adminUpdateError);
		}
		
		console.log(`Admin revenue: ₦${escrowTransaction.adminShare} from transaction ${escrowTransaction.paystackReference}`);
		
		try {
			await sendPaymentReleasedNotification(
				escrowTransaction.buyerId.email,
				escrowTransaction.buyerId.name,
				escrowTransaction.sellerId.name,
				escrowTransaction.productId.name,
				escrowTransaction.totalAmount
			);
			console.log(`Order completion notification sent to buyer: ${escrowTransaction.buyerId.email}`);
		} catch (emailError) {
			console.error("Error sending completion notification:", emailError);
		}
		
		await Order.findOneAndUpdate(
			{ paystackReference: escrowTransaction.paystackReference },
			{
				escrowStatus: "completed",
				status: "Completed",
				isConfirmed: true,
				confirmedAt: new Date(),
				confirmedBy: sellerId,
				$push: {
					transactionLog: {
						status: "completed",
						message: "Order confirmed and completed by seller",
						timestamp: new Date()
					}
				}
			}
		);
		
		res.json({
			message: "Order confirmed successfully",
			transaction: {
				id: escrowTransaction._id,
				status: escrowTransaction.status,
				confirmedAt: escrowTransaction.confirmedAt,
				sellerShare: escrowTransaction.sellerShare,
				adminShare: escrowTransaction.adminShare
			}
		});
		
	} catch (error) {
		console.error("Error validating confirmation code:", error);
		res.status(500).json({ message: "Error validating confirmation code", error: error.message });
	}
};

export const getSellerPendingOrders = async (req, res) => {
	try {
		const sellerId = req.user._id;
		
		const pendingTransactions = await EscrowTransaction.find({
			sellerId: sellerId,
			status: "pending",
			isConfirmed: false,
			confirmationCodeExpiry: { $gt: new Date() }
		})
		.populate('buyerId', 'name email')
		.populate('productId', 'name price')
		.sort({ createdAt: -1 });
		
		const orders = pendingTransactions.map(transaction => ({
			_id: transaction._id,
			paystackReference: transaction.paystackReference,
			buyerId: transaction.buyerId,
			productId: transaction.productId,
			totalAmount: transaction.totalAmount,
			sellerShare: transaction.sellerShare,
			adminShare: transaction.adminShare,
			status: transaction.status,
			paidAt: transaction.paidAt,
			confirmationCodeExpiry: transaction.confirmationCodeExpiry,
			isConfirmed: transaction.isConfirmed,
			createdAt: transaction.createdAt
		}));
		
		res.json({
			message: "Pending orders retrieved successfully",
			orders: orders
		});
		
	} catch (error) {
		console.error("Error fetching seller pending orders:", error);
		res.status(500).json({ message: "Error fetching pending orders", error: error.message });
	}
};

export const confirmOrderWithCode = async (req, res) => {
	try {
		const { confirmationCode, escrowTransactionId } = req.body;
		const sellerId = req.user._id;
		
		if (!confirmationCode || !escrowTransactionId) {
			return res.status(400).json({ message: "Confirmation code and escrow transaction ID are required" });
		}
		
		if (!/^[0-9]{4}$/.test(confirmationCode)) {
			return res.status(400).json({ message: "Confirmation code must be exactly 4 digits" });
		}
		
		const escrowTransaction = await EscrowTransaction.findById(escrowTransactionId)
			.populate('sellerId', 'email name')
			.populate('buyerId', 'name email')
			.populate('productId', 'name');
			
		if (!escrowTransaction) {
			return res.status(404).json({ message: "Escrow transaction not found" });
		}
		
		if (!escrowTransaction.sellerId._id.equals(sellerId)) {
			return res.status(403).json({ message: "You are not authorized to confirm this order" });
		}
		
		if (escrowTransaction.isConfirmed) {
			return res.status(400).json({ message: "Order already confirmed" });
		}
		
		if (new Date() > escrowTransaction.confirmationCodeExpiry) {
			return res.status(400).json({ message: "Confirmation code has expired" });
		}
		
		if (escrowTransaction.confirmationCode !== confirmationCode) {
			return res.status(400).json({ message: "Invalid confirmation code" });
		}
		
		escrowTransaction.isConfirmed = true;
		escrowTransaction.confirmedAt = new Date();
		escrowTransaction.confirmedBy = sellerId;
		escrowTransaction.status = "completed";
		escrowTransaction.transactionLog.push({
			status: "completed",
			message: `Order confirmed by seller with code: ${confirmationCode}. Awaiting admin approval for escrow release.`,
			timestamp: new Date()
		});
		
		await escrowTransaction.save();
		
		// Update admin revenue when order is confirmed
		try {
			await User.findOneAndUpdate(
				{ role: "admin" },
				{ $inc: { adminRevenue: escrowTransaction.adminShare } },
				{ upsert: false }
			);
			console.log(`Admin revenue updated: +₦${escrowTransaction.adminShare}`);
		} catch (adminUpdateError) {
			console.error("Error updating admin revenue:", adminUpdateError);
		}
		
		await Order.findOneAndUpdate(
			{ paystackReference: escrowTransaction.paystackReference },
			{ 
				escrowStatus: "completed",
				status: "Completed",
				isConfirmed: true,
				confirmedAt: new Date(),
				confirmedBy: sellerId,
				transactionLog: [{ 
					status: "completed", 
					message: "Order confirmed by seller." 
				}]
			}
		);
		
		console.log(`Order confirmed by seller: ${escrowTransaction.paystackReference}, awaiting admin approval for escrow release`);
		
		try {
			await sendPaymentReleasedNotification(
				escrowTransaction.buyerId.email,
				escrowTransaction.buyerId.name,
				escrowTransaction.sellerId.name,
				escrowTransaction.productId.name,
				escrowTransaction.totalAmount,
				escrowTransaction.sellerShare
			);
		} catch (emailError) {
			console.error("Error sending completion notification:", emailError);
		}
		
		try {
			await Notification.create({
				user: escrowTransaction.buyerId._id,
				type: "order_completed",
				message: `Your order for ${escrowTransaction.productId.name} has been confirmed by the seller. Awaiting admin approval for payment release.`,
				meta: {
					orderId: escrowTransaction._id,
					productName: escrowTransaction.productId.name,
					sellerName: escrowTransaction.sellerId.name,
					totalAmount: escrowTransaction.totalAmount
				}
			});
			
			await Notification.create({
				user: escrowTransaction.sellerId._id,
				type: "order_completed",
				message: `You have successfully confirmed the order for ${escrowTransaction.productId.name}. Awaiting admin approval for payment release.`,
				meta: {
					orderId: escrowTransaction._id,
					productName: escrowTransaction.productId.name,
					buyerName: escrowTransaction.buyerId.name,
					sellerShare: escrowTransaction.sellerShare
				}
			});
		} catch (notificationError) {
			console.error("Error creating notifications:", notificationError);
		}
		
		res.json({ 
			message: "Order confirmed successfully! Awaiting admin approval for escrow release.",
			escrowReleased: false,
			transferReference: null,
			sellerShare: escrowTransaction.sellerShare,
			buyerRedirectUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/order-completed?reference=${escrowTransaction.paystackReference}`,
			orderStatus: "completed"
		});
	} catch (error) {
		console.error("Error confirming order:", error);
		res.status(500).json({ message: "Error confirming order", error: error.message });
	}
};

export const cancelEscrow = async (req, res) => {
	try {
		const { escrowTransactionId } = req.body;
		const adminId = req.user._id;
		
		const escrowTransaction = await EscrowTransaction.findById(escrowTransactionId)
			.populate('buyerId', 'email')
			.populate('productId', 'name');
			
		if (!escrowTransaction) {
			return res.status(404).json({ message: "Escrow transaction not found" });
		}
		
		if (escrowTransaction.status !== "pending" && escrowTransaction.status !== "completed") {
			return res.status(400).json({ message: "Transaction already processed" });
		}
		
		escrowTransaction.status = "cancelled";
		escrowTransaction.cancelledAt = new Date();
		escrowTransaction.transactionLog.push({
			status: "cancelled",
			message: "Escrow cancelled by admin. Buyer will be refunded.",
			adminId: adminId,
			timestamp: new Date()
		});
		
		await escrowTransaction.save();
		
		await User.findByIdAndUpdate(escrowTransaction.sellerId._id, {
			$inc: { pendingEarnings: -escrowTransaction.sellerShare }
		});
		
		await Product.findByIdAndUpdate(escrowTransaction.productId._id, {
			status: "approved",
			buyerId: null
		});
		
		await Order.findOneAndUpdate(
			{ paystackReference: escrowTransaction.paystackReference },
			{ 
				escrowStatus: "cancelled",
				transactionLog: [{ 
					status: "cancelled", 
					message: "Escrow cancelled by admin." 
				}]
			}
		);
		
		console.log(`Escrow cancelled: ${escrowTransaction.paystackReference}`);
		
		res.json({ 
			message: "Escrow cancelled successfully",
			refundAmount: escrowTransaction.totalAmount
		});
	} catch (error) {
		console.error("Error cancelling escrow:", error);
		res.status(500).json({ message: "Error cancelling escrow", error: error.message });
	}
};

// New endpoint for buyer to confirm product receipt
export const confirmProductReceived = async (req, res) => {
	try {
		const { reference } = req.params;
		const { confirmation, note } = req.body; // confirmation: "received" or "not_received"
		const userId = req.user._id;

		console.log("🔍 confirmProductReceived called:", {
			reference,
			confirmation,
			note,
			userId,
			body: req.body
		});

		if (!reference) {
			console.log("❌ No reference provided");
			return res.status(400).json({ error: "Transaction reference is required" });
		}

		if (!confirmation || !["received", "not_received"].includes(confirmation)) {
			console.log("❌ Invalid confirmation:", confirmation);
			return res.status(400).json({ error: "Confirmation must be 'received' or 'not_received'" });
		}

		// Find the order - check both Order and EscrowTransaction collections
		let order = await Order.findOne({
			paystackReference: reference
		});

		let escrowTransaction = null;
		if (!order) {
			// If not found in Order collection, check EscrowTransaction
			escrowTransaction = await EscrowTransaction.findOne({
				paystackReference: reference
			});
		}

		console.log("🔍 Order lookup result:", {
			orderFound: !!order,
			escrowFound: !!escrowTransaction,
			orderId: order?._id,
			escrowId: escrowTransaction?._id,
			orderStatus: order?.status,
			escrowStatus: escrowTransaction?.status,
			currentBuyerConfirmation: order?.buyerConfirmation || escrowTransaction?.buyerConfirmation
		});

		if (!order && !escrowTransaction) {
			console.log("❌ Order not found for reference:", reference);
			return res.status(404).json({ 
				success: false, 
				message: "Order not found" 
			});
		}

		// Update the order/escrow transaction with buyer confirmation
		if (order) {
			order.buyerConfirmation = confirmation;
			order.buyerConfirmedAt = new Date();
			order.buyerConfirmationNote = note || null;
			
			// If buyer confirms received, mark as confirmed and update status
			if (confirmation === "received") {
				order.isConfirmed = true;
				order.confirmedAt = new Date();
				order.confirmedBy = userId;
				order.status = "Delivered";
				order.escrowStatus = "completed";
			}

			console.log("💾 Saving order with updates:", {
				buyerConfirmation: order.buyerConfirmation,
				buyerConfirmedAt: order.buyerConfirmedAt,
				buyerConfirmationNote: order.buyerConfirmationNote
			});
			
			await order.save();
			console.log("✅ Order saved successfully");
		}

		if (escrowTransaction) {
			escrowTransaction.buyerConfirmation = confirmation;
			escrowTransaction.buyerConfirmedAt = new Date();
			escrowTransaction.buyerConfirmationNote = note || null;
			
			if (confirmation === "received") {
				escrowTransaction.status = "completed";
			} else if (confirmation === "not_received") {
				escrowTransaction.status = "disputed";
			}
			
			console.log("💾 Saving escrow transaction with updates:", {
				buyerConfirmation: escrowTransaction.buyerConfirmation,
				status: escrowTransaction.status
			});
			
			await escrowTransaction.save();
			console.log("✅ Escrow transaction saved successfully");
		}

		res.json({
			success: true,
			message: `Product ${confirmation === "received" ? "confirmed as received" : "marked as not received"}`,
			buyerConfirmation: order?.buyerConfirmation || escrowTransaction?.buyerConfirmation,
			buyerConfirmedAt: order?.buyerConfirmedAt || escrowTransaction?.buyerConfirmedAt
		});

	} catch (error) {
		console.error("Error in confirmProductReceived:", error.message);
		res.status(500).json({ 
			success: false, 
			message: "Server error", 
			error: error.message 
		});
	}
};


