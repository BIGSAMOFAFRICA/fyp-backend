import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import axios from "axios";
import FormData from "form-data";
import { protectRoute, requireRole, strictAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ----------------------
// Product Schema
// ----------------------
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, min: 0, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  isFeatured: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

// ----------------------
// Cloudinary Upload
// ----------------------
const CLOUDINARY_CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function uploadToCloudinary(fileBuffer, folder = "products") {
  const formData = new FormData();
  formData.append("file", fileBuffer, { filename: "upload.jpg" });
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    formData,
    { headers: formData.getHeaders() }
  );

  return res.data.secure_url;
}

// ----------------------
// Controllers
// ----------------------
router.get("/", async (req, res) => {
  const products = await Product.find({ status: "approved" });
  res.json(products);
});

router.get("/featured", async (req, res) => {
  const products = await Product.find({ isFeatured: true, status: "approved" });
  res.json(products);
});

// Seller uploads
router.post("/", protectRoute, requireRole("seller"), upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    if (!req.file) return res.status(400).json({ message: "Image is required" });

    const imageUrl = await uploadToCloudinary(req.file.buffer);

    const product = await Product.create({
      name,
      description,
      price,
      category,
      image: imageUrl,
      sellerId: req.user._id,
      status: req.user.role === "admin" ? "approved" : "pending",
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: "Error creating product", error: err.message });
  }
});

// Admin approves product
router.patch("/:id/approve", protectRoute, strictAdminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  product.status = "approved";
  await product.save();
  res.json(product);
});

// Admin rejects product
router.patch("/:id/reject", protectRoute, strictAdminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  product.status = "rejected";
  await product.save();
  res.json(product);
});

// Toggle featured
router.patch("/:id/featured", protectRoute, strictAdminOnly, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  product.isFeatured = !product.isFeatured;
  await product.save();
  res.json(product);
});

// Seller: get own products grouped by status
router.get("/seller/grouped", protectRoute, requireRole("seller"), async (req, res) => {
  const sellerId = req.user._id;
  const products = await Product.find({ sellerId });
  const grouped = { pending: [], approved: [], rejected: [] };
  products.forEach(p => { if (grouped[p.status]) grouped[p.status].push(p); });
  res.json(grouped);
});

export default router;
