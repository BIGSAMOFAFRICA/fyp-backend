
import Product from "../models/product.model.js";
import EscrowTransaction from "../models/escrowTransaction.model.js";

export const createSellerProduct = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error("Unauthorized: req.user missing in createSellerProduct");
      return res.status(401).json({ message: "Unauthorized: User not authenticated" });
    }
    const sellerId = req.user._id;
    const { name, description, price, image, category } = req.body;
    if (!name || !description || !price || !image || !category) {
      return res.status(400).json({ message: "All product fields are required" });
    }
    
    const productData = {
      name,
      description,
      price: Number(price),
      image,
      category,
      sellerId,
      status: "pending",
    };
    console.log("Attaching sellerId to product:", sellerId);
    const product = await Product.create(productData);
    res.status(201).json({ message: "Product created", product });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

import User from "../models/user.model.js";





export const getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const seller = await User.findById(sellerId).select("name email");
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    
    const products = await Product.find({ sellerId });
    
    const pendingProducts = products.filter(p => p.status === "pending");
    const approvedProducts = products.filter(p => p.status === "approved");
    const rejectedProducts = products.filter(p => p.status === "rejected");

    
    const allTransactions = await EscrowTransaction.find({ sellerId }).populate("buyerId", "name email").populate("productId", "name");
    
    
    const releasedTransactions = allTransactions.filter(t => t.status === "released");
    const totalRevenue = releasedTransactions.reduce((sum, t) => sum + (t.sellerShare || 0), 0);

    
    const recentTransactions = allTransactions.slice(-10).map(t => ({
      _id: t._id,
      amount: t.totalAmount,
      sellerShare: t.sellerShare,
      buyer: t.buyerId,
      product: t.productId,
      status: t.status,
      createdAt: t.createdAt
    }));

    res.json({
      profile: seller,
      totalRevenue,
      totalProducts: products.length,
      pendingProducts,
      approvedProducts,
      rejectedProducts,
      analytics: {
        pending: pendingProducts.length,
        approved: approvedProducts.length,
        rejected: rejectedProducts.length
      },
      recentTransactions
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


export const deleteSellerProduct = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const product = await Product.findOne({ _id: req.params.id, sellerId });
    if (!product) return res.status(404).json({ message: "Product not found or not yours" });
    await product.remove();
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
