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
			enum: ["pending", "released"],
			default: "pending",
		},
		paystackReference: {
			type: String,
			unique: true,
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

const Order = mongoose.model("Order", orderSchema);

export default Order;
