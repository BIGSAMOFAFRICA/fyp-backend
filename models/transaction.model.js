import mongoose from "mongoose";



const transactionSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    adminShare: {
      type: Number,
      required: true,
      min: 0,
    },
    sellerShare: {
      type: Number,
      required: true,
      min: 0,
    },
    orderStatus: {
      type: String,
      enum: ["pending", "completed", "delivered", "cancelled"],
      default: "pending",
    },
    escrowStatus: {
      type: String,
      enum: ["holding", "released", "refunded"],
      default: "holding",
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
