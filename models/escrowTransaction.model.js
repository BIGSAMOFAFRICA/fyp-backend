import mongoose from "mongoose";

const escrowTransactionSchema = new mongoose.Schema(
  {
    
    paystackReference: {
      type: String,
      required: true,
      unique: true
    },
    paystackTransactionId: {
      type: String,
      required: true,
      unique: true
    },
    
    
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
    
    
    status: {
      type: String,
      enum: ["pending", "released", "cancelled", "refunded", "completed", "disputed"],
      default: "pending",
    },
    
    
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
    
    
    paystackVerified: {
      type: Boolean,
      default: false,
    },
    
    
    paidAt: {
      type: Date,
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    
    
    adminPayoutReference: {
      type: String,
      default: null,
    },
    sellerPayoutReference: {
      type: String,
      default: null,
    },
    
    
    transactionLog: [
      {
        status: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
      }
    ]
  },
  { timestamps: true }
);


escrowTransactionSchema.index({ buyerId: 1, status: 1 });
escrowTransactionSchema.index({ sellerId: 1, status: 1 });
escrowTransactionSchema.index({ status: 1, createdAt: -1 });

const EscrowTransaction = mongoose.model("EscrowTransaction", escrowTransactionSchema);

export default EscrowTransaction;
