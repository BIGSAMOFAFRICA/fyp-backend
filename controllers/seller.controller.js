// Create a new product for seller
import Product from "../models/product.model.js";
// Reuse admin product creation logic, but set status to 'pending' and assign sellerId
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
    // Optionally handle image upload here if needed (cloudinary, etc.)
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
// (duplicate import removed)
import User from "../models/user.model.js";

// Get seller dashboard analytics and product lists

// Enhanced: Seller dashboard shows products by status and revenue (from approved transactions)
import Transaction from "../models/transaction.model.js";
export const getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const seller = await User.findById(sellerId).select("name email");
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    // Get all products by this seller
    const products = await Product.find({ sellerId });
    // Group by status
    const pendingProducts = products.filter(p => p.status === "pending");
    const approvedProducts = products.filter(p => p.status === "approved");
    const rejectedProducts = products.filter(p => p.status === "rejected");

    // Revenue: sum of all approved transactions for this seller
    const approvedTransactions = await Transaction.find({ sellerId, status: "approved" }).populate("buyerId", "name email").populate("productId", "name");
    const totalRevenue = approvedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Recent transactions (last 5)
    const recentTransactions = approvedTransactions.slice(-5).map(t => ({
      _id: t._id,
      amount: t.amount,
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

// Delete a product (only by owner)
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
