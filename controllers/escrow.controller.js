// Admin: Get all pending transactions, with buyer and product populated
export const getPendingTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: "pending" })
      .populate("buyerId", "name email")
      .populate("productId", "name price");
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Transaction from "../models/transaction.model.js";

// Buyer pays for a product (escrow)
export const buyerPay = async (req, res) => {
  try {
    const { productId } = req.body;
    const buyerId = req.user._id;
    const product = await Product.findById(productId);
    if (!product || product.status !== "active") {
      return res.status(400).json({ message: "Product not available" });
    }
    if (String(product.sellerId) === String(buyerId)) {
      return res.status(400).json({ message: "Cannot buy your own product" });
    }
    // Deduct from buyer's wallet (simulate payment)
    const buyer = await User.findById(buyerId);
    if (buyer.walletBalance < product.price) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }
    buyer.walletBalance -= product.price;
    await buyer.save();
    // Move to escrow (create transaction)
    const transaction = await Transaction.create({
      buyerId,
      sellerId: product.sellerId,
      productId,
      amount: product.price,
      status: "pending",
    });
    // Update product status
    product.status = "pending";
    await product.save();
    // Add to seller's escrow balance
    const seller = await User.findById(product.sellerId);
    seller.escrowBalance += product.price;
    await seller.save();
    res.json({ message: "Payment in escrow", transaction });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Admin releases escrow to seller
export const adminRelease = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.status !== "Holding") {
      return res.status(400).json({ message: "Invalid transaction" });
    }
    // Move funds from escrow to seller wallet
    const seller = await User.findById(transaction.sellerId);
    if (seller.escrowBalance < transaction.amount) {
      return res.status(400).json({ message: "Insufficient escrow balance" });
    }
    seller.escrowBalance -= transaction.amount;
    seller.walletBalance += transaction.amount;
    await seller.save();
    transaction.status = "Released";
    transaction.releasedAt = new Date();
    await transaction.save();
    // Mark product as sold
    const product = await Product.findById(transaction.productId);
    if (product) {
      product.status = "sold";
      product.buyerId = transaction.buyerId;
      await product.save();
    }
    res.json({ message: "Escrow released to seller", transaction });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Admin refunds buyer
export const adminRefund = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.status !== "Holding") {
      return res.status(400).json({ message: "Invalid transaction" });
    }
    // Refund buyer
    const buyer = await User.findById(transaction.buyerId);
    buyer.walletBalance += transaction.amount;
    await buyer.save();
    // Remove from seller's escrow
    const seller = await User.findById(transaction.sellerId);
    if (seller.escrowBalance < transaction.amount) {
      return res.status(400).json({ message: "Insufficient escrow balance" });
    }
    seller.escrowBalance -= transaction.amount;
    await seller.save();
    transaction.status = "Refunded";
    transaction.refundedAt = new Date();
    await transaction.save();
    // Mark product as available
    const product = await Product.findById(transaction.productId);
    if (product) {
      product.status = "active";
      product.buyerId = null;
      await product.save();
    }
    res.json({ message: "Escrow refunded to buyer", transaction });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Seller dashboard analytics

export const getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.params.id;
    const seller = await User.findById(sellerId).select("_id name email walletBalance escrowBalance virtualAccountNumber role");
    if (!seller) {
      return res.status(404).json({ message: "Seller not found", seller: null, products: [], transactions: [] });
    }

    const products = await Product.find({ sellerId });
    const totalProducts = products.length;
    const pendingProducts = products.filter(p => p.status === "pending");
    const approvedProducts = products.filter(p => p.status === "active");
    const rejectedProducts = products.filter(p => p.status === "rejected");
    const soldProducts = products.filter(p => p.status === "sold");

    const transactions = await Transaction.find({ sellerId })
      .sort({ createdAt: -1 })
      .populate("buyerId", "_id name email")
      .populate("productId", "_id name price");

    const totalRevenue = soldProducts.reduce((sum, p) => sum + (p.price || 0), 0);

    res.json({
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
        walletBalance: seller.walletBalance,
        escrowBalance: seller.escrowBalance,
        virtualAccountNumber: seller.virtualAccountNumber,
        role: seller.role,
      },
      products,
      totalProducts,
      pending: pendingProducts.length,
      approved: approvedProducts.length,
      rejected: rejectedProducts.length,
      sold: soldProducts.length,
      totalRevenue,
      transactions,
      message: transactions.length === 0 ? "No sales yet" : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message, seller: null, products: [], transactions: [] });
  }
};

// Buyer dashboard analytics

export const getBuyerDashboard = async (req, res) => {
  try {
    const buyerId = req.params.id;
    const buyer = await User.findById(buyerId).select("_id name email walletBalance role");
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found", buyer: null, purchases: [], transactions: [] });
    }

    const transactions = await Transaction.find({ buyerId })
      .sort({ createdAt: -1 })
      .populate("sellerId", "_id name email")
      .populate("productId", "_id name price");

    const purchases = transactions.map(tx => tx.productId);

    res.json({
      buyer: {
        id: buyer._id,
        name: buyer.name,
        email: buyer.email,
        walletBalance: buyer.walletBalance,
        role: buyer.role,
      },
      purchases,
      transactions,
      message: transactions.length === 0 ? "No purchases yet" : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message, buyer: null, purchases: [], transactions: [] });
  }
};
