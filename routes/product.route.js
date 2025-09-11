import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getFeaturedProducts,
  getProductsByCategory,
  getRecommendedProducts,
  toggleFeaturedProduct,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  getApprovedProducts
} from "../controllers/product.controller.js";
import { protectRoute, requireRole, strictAdminOnly } from "../middleware/auth.middleware.js";
import Product from "../models/product.model.js";
import Transaction from "../models/transaction.model.js";
import mongoose from "mongoose";

const router = express.Router();

// Multer setup (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ----------------- ADMIN TRANSACTIONS -----------------
router.get("/transactions/pending", protectRoute, strictAdminOnly, async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: "pending" })
      .populate("productId", "name")
      .populate("buyerId", "name");
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------- PUBLIC PRODUCT ROUTES -----------------
router.get("/", getApprovedProducts);
router.get("/featured", getFeaturedProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/recommendations", getRecommendedProducts);

// ----------------- SELLER ROUTES -----------------
// Seller: Get own products grouped by status
router.get("/seller/:sellerId/grouped", protectRoute, requireRole("seller"), async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const grouped = await Product.aggregate([
      { $match: { sellerId: mongoose.Types.ObjectId(sellerId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const result = { pending: 0, approved: 0, rejected: 0 };
    grouped.forEach(g => { result[g._id] = g.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Seller: Submit product (with image upload)
router.post("/", protectRoute, requireRole("seller"), upload.single("image"), async (req, res) => {
  try {
    const { name, price, category, description } = req.body;

    if (!req.file) return res.status(400).json({ message: "Image file is required" });

    // Upload image to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: "products" }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      stream.end(req.file.buffer);
    });

    const product = await Product.create({
      name,
      price,
      category,
      description,
      image: result.secure_url,
      sellerId: req.user._id,
      status: "pending"
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------- ADMIN PRODUCT ROUTES -----------------
router.get("/pending", protectRoute, strictAdminOnly, getPendingProducts);
router.patch("/:id/approve", protectRoute, strictAdminOnly, approveProduct);
router.patch("/:id/reject", protectRoute, strictAdminOnly, rejectProduct);
router.delete("/:id", protectRoute, strictAdminOnly, deleteProduct);
router.patch("/:id", protectRoute, strictAdminOnly, toggleFeaturedProduct);
router.get("/all", protectRoute, strictAdminOnly, getAllProducts);

// ----------------- BUYER TRANSACTION -----------------
router.post("/buyer/purchase", protectRoute, async (req, res) => {
  try {
    const { productId, amount } = req.body;
    if (!productId || !amount) return res.status(400).json({ message: "productId and amount required" });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const transaction = await Transaction.create({
      productId,
      sellerId: product.sellerId,
      buyerId: req.user._id,
      amount,
      status: "pending"
    });

    res.status(201).json({ message: "Transaction created", transaction });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin approve/reject transaction
router.put("/admin/transactions/:id/approve", protectRoute, strictAdminOnly, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status === "approved") return res.status(400).json({ message: "Transaction already approved" });
    transaction.status = "approved";
    await transaction.save();
    res.json({ message: "Transaction approved", transaction });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/admin/transactions/:id/reject", protectRoute, strictAdminOnly, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });
    if (transaction.status === "rejected") return res.status(400).json({ message: "Transaction already rejected" });
    transaction.status = "rejected";
    await transaction.save();
    res.json({ message: "Transaction rejected", transaction });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
