import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		products: [
			{
				product: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Product",
					required: true,
				},
				quantity: {
					type: Number,
					required: true,
					min: 1,
				},
				price: {
					type: Number,
					required: true,
					min: 0,
				},
			},
		],
		totalAmount: {
			type: Number,
			required: true,
			min: 0,
		},
		escrowStatus: {
			type: String,
			enum: ["pending", "released", "completed"],
			default: "pending",
		},
		status: {
			type: String,
			enum: ["Pending", "Completed", "Cancelled"],
			default: "Pending",
		},
		confirmationCode: {
			type: String,
			length: 4,
			match: /^[0-9]{4}$/
		},
		confirmationCodeExpiry: {
			type: Date,
			default: function() {
				
				return new Date(Date.now() + 24 * 60 * 60 * 1000);
			}
		},
		isConfirmed: {
			type: Boolean,
			default: false
		},
		confirmedAt: {
			type: Date,
			default: null
		},
		confirmedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null
		},
		// New simplified confirmation fields
		buyerConfirmation: {
			type: String,
			enum: ["pending", "received", "not_received"],
			default: "pending"
		},
		buyerConfirmedAt: {
			type: Date,
			default: null
		},
		buyerConfirmationNote: {
			type: String,
			default: null
		},
	paystackReference: {
		type: String,
		unique: true
	},
	paystackTransactionId: {
		type: String,
		unique: true
	},
	seller: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
		transactionLog: [
			{
				status: String,
				timestamp: { type: Date, default: Date.now },
				message: String,
			},
		],
	},
	{ timestamps: true }
);


orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ escrowStatus: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
