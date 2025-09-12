import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/product.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

// Fetch products for a seller grouped by status
export const getSellerProductsByStatus = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const products = await Product.find({ sellerId });
    const grouped = {
      pending: [],
      approved: [],
      rejected: [],
    };
    for (const p of products) {
      if (grouped[p.status]) grouped[p.status].push(p);
    }
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller products", error: error.message });
  }
};

// Homepage products - only approved
export const getApprovedProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "approved" }).sort({ createdAt: -1 });
    res.json(products); // ✅ return array directly
  } catch (error) {
    console.log("Error in getApprovedProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getPendingProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "pending" });
    res.json(products); // ✅ return array
  } catch (error) {
    console.log("Error in getPendingProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Approve product (admin only)
export const approveProduct = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.status = "approved";
    await product.save();

    // ✅ Fix: use sellerId
    if (product.sellerId) {
      const seller = await User.findById(product.sellerId);
      if (seller) {
        await Notification.create({
          user: seller._id,
          type: "product_approved",
          message: `Your product '${product.name}' was approved!`,
          meta: { productId: product._id },
        });
      }
    }

    res.json(product);
  } catch (error) {
    console.log("Error in approveProduct controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reject product (admin only)
export const rejectProduct = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.status = "rejected";
    await product.save();

    // ✅ Fix: use sellerId
    if (product.sellerId) {
      const seller = await User.findById(product.sellerId);
      if (seller) {
        await Notification.create({
          user: seller._id,
          type: "product_rejected",
          message: `Your product '${product.name}' was rejected.`,
          meta: { productId: product._id },
        });
      }
    }

    res.json(product);
  } catch (error) {
    console.log("Error in rejectProduct controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
