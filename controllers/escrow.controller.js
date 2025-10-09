import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import EscrowTransaction from "../models/escrowTransaction.model.js";

export const getPendingTransactions = async (req, res) => {
  try {
    const transactions = await EscrowTransaction.find({ status: "pending" })
      .populate("buyerId", "name email")
      .populate("sellerId", "name email")
      .populate("productId", "name price");
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const buyerPay = async (req, res) => {
  try {
    const { productId } = req.body;
    const buyerId = req.user._id;
    const product = await Product.findById(productId);
    
    if (!product || product.status !== "approved") {
      return res.status(400).json({ message: "Product not available for purchase" });
    }
    
    if (String(product.sellerId) === String(buyerId)) {
      return res.status(400).json({ message: "Cannot buy your own product" });
    }
    
    if (product.status === "sold") {
      return res.status(400).json({ message: "Product already sold" });
    }
    
    const buyer = await User.findById(buyerId);
    if (buyer.walletBalance < product.price) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }
    
    const totalAmount = product.price;
    const adminShare = Math.round(totalAmount * 0.15);
    const sellerShare = totalAmount - adminShare;
    
    buyer.walletBalance -= totalAmount;
    await buyer.save();
    
    const transaction = await EscrowTransaction.create({
      buyerId,
      sellerId: product.sellerId,
      productId,
      totalAmount,
      adminShare,
      sellerShare,
      status: "pending",
      confirmationCode: Math.floor(1000 + Math.random() * 9000).toString(),
      confirmationCodeExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      transactionLog: [{
        status: "pending",
        message: "Payment received and held in escrow awaiting seller confirmation.",
        timestamp: new Date()
      }]
    });
    
    product.status = "sold";
    product.buyerId = buyerId;
    await product.save();
    
    const seller = await User.findById(product.sellerId);
    seller.pendingEarnings += sellerShare;
    await seller.save();
    
    res.json({ 
      message: "Payment in escrow", 
      transaction,
      adminShare,
      sellerShare 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const adminRelease = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await EscrowTransaction.findById(transactionId);
    
    if (!transaction || transaction.status !== "pending") {
      return res.status(400).json({ message: "Invalid transaction or already processed" });
    }
    
    const seller = await User.findById(transaction.sellerId);
    
    seller.pendingEarnings -= transaction.sellerShare;
    seller.totalEarnings += transaction.sellerShare;
    await seller.save();
    
    transaction.status = "released";
    transaction.isConfirmed = true;
    transaction.releasedAt = new Date();
    transaction.confirmedAt = new Date();
    transaction.transactionLog.push({
      status: "released",
      message: "Escrow released to seller by admin",
      timestamp: new Date()
    });
    await transaction.save();
    
    const product = await Product.findById(transaction.productId);
    if (product) {
      product.status = "sold";
      product.buyerId = transaction.buyerId;
      await product.save();
    }
    
    res.json({ 
      message: "Escrow released to seller", 
      transaction,
      adminShare: transaction.adminShare,
      sellerShare: transaction.sellerShare
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const adminRefund = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await EscrowTransaction.findById(transactionId);
    
    if (!transaction || transaction.status !== "pending") {
      return res.status(400).json({ message: "Invalid transaction or already processed" });
    }
    
    const buyer = await User.findById(transaction.buyerId);
    buyer.walletBalance += transaction.totalAmount;
    await buyer.save();
    
    const seller = await User.findById(transaction.sellerId);
    seller.pendingEarnings -= transaction.sellerShare;
    await seller.save();
    
    transaction.status = "refunded";
    transaction.transactionLog.push({
      status: "refunded",
      message: "Escrow refunded to buyer by admin",
      timestamp: new Date()
    });
    await transaction.save();
    
    const product = await Product.findById(transaction.productId);
    if (product) {
      product.status = "approved";
      product.buyerId = null;
      await product.save();
    }
    
    res.json({ 
      message: "Escrow refunded to buyer", 
      transaction,
      refundAmount: transaction.totalAmount
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getSellerTransactions = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const transactions = await EscrowTransaction.find({ sellerId })
      .populate("buyerId", "name email")
      .populate("productId", "name price")
      .sort({ createdAt: -1 });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getBuyerTransactions = async (req, res) => {
  try {
    const buyerId = req.user._id;
    const transactions = await EscrowTransaction.find({ buyerId })
      .populate("sellerId", "name email")
      .populate("productId", "name price")
      .sort({ createdAt: -1 });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.params.id || req.user._id;
    const transactions = await EscrowTransaction.find({ sellerId })
      .populate("buyerId", "name email")
      .populate("productId", "name price")
      .sort({ createdAt: -1 });
    
    const stats = {
      totalSales: transactions.filter(t => t.status === "released").length,
      pendingSales: transactions.filter(t => t.status === "pending").length,
      totalRevenue: transactions.filter(t => t.status === "released").reduce((sum, t) => sum + t.sellerShare, 0),
      pendingRevenue: transactions.filter(t => t.status === "pending").reduce((sum, t) => sum + t.sellerShare, 0)
    };
    
    res.json({ transactions, stats });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getBuyerDashboard = async (req, res) => {
  try {
    const buyerId = req.params.id || req.user._id;
    const transactions = await EscrowTransaction.find({ buyerId })
      .populate("sellerId", "name email")
      .populate("productId", "name price")
      .sort({ createdAt: -1 });
    
    const stats = {
      totalPurchases: transactions.length,
      completedPurchases: transactions.filter(t => t.status === "released").length,
      pendingPurchases: transactions.filter(t => t.status === "pending").length,
      totalSpent: transactions.reduce((sum, t) => sum + t.totalAmount, 0)
    };
    
    res.json({ transactions, stats });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getAllEscrowTransactions = async (req, res) => {
  try {
    const transactions = await EscrowTransaction.find()
      .populate("buyerId", "name email")
      .populate("sellerId", "name email")
      .populate("productId", "name price")
      .sort({ createdAt: -1 });
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
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
    
    res.json({
      totalAdminRevenue,
      pendingAdminRevenue,
      totalMarketplaceRevenue,
      totalOrders: releasedTransactions.length + pendingTransactions.length + completedTransactions.length,
      releasedOrders: releasedTransactions.length,
      pendingOrders: pendingTransactions.length,
      completedOrders: completedTransactions.length
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};